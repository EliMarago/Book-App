import { parseTitleAndAuthorQuery, getTitleSearchVariants } from './bookSearch';

// In-memory cache per evitare richieste duplicate per gli stessi titoli
const coverCache = new Map<string, string | null>();

const GOOGLE_BOOKS_API_KEY = (
  import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined
)?.trim();

export function getGoogleBooksUrl(query: string, extraParams = ''): string {
  const base = `https://www.googleapis.com/books/v1/volumes?q=${query}${extraParams}`;
  return GOOGLE_BOOKS_API_KEY ? `${base}&key=${encodeURIComponent(GOOGLE_BOOKS_API_KEY)}` : base;
}

/**
 * Pulisce la stringa rimuovendo caratteri speciali che potrebbero disturbare le ricerche
 */
function sanitizeQuery(str: string): string {
  return str
    .replace(/[\[\]\(\)\{\}"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Esegue una fetch con timeout automatico
 */
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Cerca la copertina su Apple Books / iTunes Ebook Search (alta risoluzione 600x600)
 */
async function searchAppleBooks(title: string, author?: string): Promise<string | null> {
  try {
    let cleanTitle = sanitizeQuery(title);
    let cleanAuthor = author ? sanitizeQuery(author) : '';

    if (!cleanAuthor && cleanTitle) {
      const parsed = parseTitleAndAuthorQuery(cleanTitle);
      if (parsed.author) {
        cleanTitle = parsed.title;
        cleanAuthor = parsed.author;
      }
    }

    const titleVariants = getTitleSearchVariants(cleanTitle);
    const searchTerms: string[] = [];
    for (const v of titleVariants) {
      if (cleanAuthor) searchTerms.push(`${v} ${cleanAuthor}`.trim());
      searchTerms.push(v);
    }
    if (cleanAuthor) searchTerms.push(cleanAuthor);

    for (const country of ['it', 'us']) {
      for (const term of searchTerms.slice(0, 3)) {
        const query = encodeURIComponent(term);
        const url = `https://itunes.apple.com/search?term=${query}&entity=ebook&country=${country}&limit=3`;

        const res = await fetchWithTimeout(url, 3500);
        if (!res.ok) continue;

        const data = await res.json();
        if (data.results && data.results.length > 0) {
          for (const item of data.results) {
            if (item.artworkUrl100) {
              return item.artworkUrl100
                .replace('100x100bb', '600x600bb')
                .replace('http://', 'https://');
            }
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Cerca la copertina sull'archivio globale di Open Library
 */
async function searchOpenLibrary(title: string, author?: string): Promise<string | null> {
  try {
    let cleanTitle = sanitizeQuery(title);
    let cleanAuthor = author ? sanitizeQuery(author) : '';

    if (!cleanAuthor && cleanTitle) {
      const parsed = parseTitleAndAuthorQuery(cleanTitle);
      if (parsed.author) {
        cleanTitle = parsed.title;
        cleanAuthor = parsed.author;
      }
    }

    const titleVariants = getTitleSearchVariants(cleanTitle);
    const terms = [
      cleanAuthor ? `${cleanTitle} ${cleanAuthor}`.trim() : cleanTitle,
      ...titleVariants.slice(1, 2).map((v) => (cleanAuthor ? `${v} ${cleanAuthor}`.trim() : v)),
    ];

    for (const term of terms) {
      const query = encodeURIComponent(term);
      const url = `https://openlibrary.org/search.json?q=${query}&limit=5`;

      const res = await fetchWithTimeout(url, 4500);
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.docs || data.docs.length === 0) continue;

      for (const doc of data.docs) {
        if (doc.cover_i) {
          return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        }
        if (doc.cover_edition_key) {
          return `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
        }
        if (Array.isArray(doc.isbn) && doc.isbn.length > 0) {
          return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Cerca la copertina su Google Books (con fallback)
 */
async function searchGoogleBooks(title: string, author?: string): Promise<string | null> {
  try {
    let cleanTitle = sanitizeQuery(title);
    let cleanAuthor = author ? sanitizeQuery(author) : '';

    if (!cleanAuthor && cleanTitle) {
      const parsed = parseTitleAndAuthorQuery(cleanTitle);
      if (parsed.author) {
        cleanTitle = parsed.title;
        cleanAuthor = parsed.author;
      }
    }

    const queries = [
      cleanAuthor ? `intitle:${cleanTitle} inauthor:${cleanAuthor}` : cleanTitle,
      cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle,
    ];

    for (const q of queries) {
      const url = getGoogleBooksUrl(encodeURIComponent(q), '&maxResults=3');
      const res = await fetchWithTimeout(url, 3800);
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.items || data.items.length === 0) continue;

      for (const item of data.items) {
        const imageLinks = item?.volumeInfo?.imageLinks;
        if (imageLinks) {
          const cover =
            imageLinks.extraLarge ||
            imageLinks.large ||
            imageLinks.medium ||
            imageLinks.thumbnail ||
            imageLinks.smallThumbnail;
          if (cover) {
            return cover.replace('http://', 'https://').replace('&edge=curl', '');
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * API principale per recuperare la copertina del libro.
 * Prova in cascata sorgenti affidabili e veloci (Apple Books, Open Library, Google Books).
 *
 * @param title Titolo del libro
 * @param author Autore del libro (opzionale ma consigliato)
 * @returns URL della copertina o null se non trovata
 */
export async function fetchBookCover(
  title: string,
  author?: string
): Promise<string | null> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return null;

  const trimmedAuthor = author?.trim() || '';
  const cacheKey = `${trimmedTitle.toLowerCase()}::${trimmedAuthor.toLowerCase()}`;

  if (coverCache.has(cacheKey)) {
    return coverCache.get(cacheKey) ?? null;
  }

  // 1. Apple Books (molto veloce, immagini editoriali ad alta definizione 600x600)
  const appleCover = await searchAppleBooks(trimmedTitle, trimmedAuthor);
  if (appleCover) {
    coverCache.set(cacheKey, appleCover);
    return appleCover;
  }

  // 2. Open Library (vastissimo catalogo internazionale e italiano)
  const openLibCover = await searchOpenLibrary(trimmedTitle, trimmedAuthor);
  if (openLibCover) {
    coverCache.set(cacheKey, openLibCover);
    return openLibCover;
  }

  // 3. Google Books come ulteriore risorsa
  const googleCover = await searchGoogleBooks(trimmedTitle, trimmedAuthor);
  if (googleCover) {
    coverCache.set(cacheKey, googleCover);
    return googleCover;
  }

  // Se nessun servizio trova un'immagine, memorizziamo null per evitare richieste ripetute
  coverCache.set(cacheKey, null);
  return null;
}

/**
 * Restituisce una lista di copertine alternative trovate per consentire all'utente di scegliere
 */
export async function searchAlternativeCovers(
  title: string,
  author?: string
): Promise<string[]> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return [];
  const trimmedAuthor = author?.trim() || '';

  const results: string[] = [];
  const seenCovers = new Set<string>();

  const addCover = (c: string | null | undefined) => {
    if (!c || seenCovers.has(c)) return;
    seenCovers.add(c);
    results.push(c);
  };

  let cleanTitle = sanitizeQuery(trimmedTitle);
  let cleanAuthor = trimmedAuthor ? sanitizeQuery(trimmedAuthor) : '';
  if (!cleanAuthor && cleanTitle) {
    const parsed = parseTitleAndAuthorQuery(cleanTitle);
    if (parsed.author) {
      cleanTitle = parsed.title;
      cleanAuthor = parsed.author;
    }
  }

  const titleVariants = getTitleSearchVariants(cleanTitle);
  const terms = [
    cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle,
    ...titleVariants.slice(1, 3).map((v) => (cleanAuthor ? `${v} ${cleanAuthor}` : v)),
  ];

  // 1. Apple Books (IT + US)
  try {
    for (const country of ['it', 'us']) {
      for (const term of terms.slice(0, 2)) {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&country=${country}&limit=4`;
        const res = await fetchWithTimeout(url, 3500);
        if (!res.ok) continue;
        const data = await res.json();
        for (const it of data.results || []) {
          if (it.artworkUrl100) {
            addCover(
              it.artworkUrl100.replace('100x100bb', '600x600bb').replace('http://', 'https://')
            );
          }
        }
      }
    }
  } catch {}

  // 2. Open Library
  try {
    const qTerm = cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle;
    const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(qTerm)}&limit=5`;
    const res = await fetchWithTimeout(olUrl, 4000);
    if (res.ok) {
      const data = await res.json();
      for (const doc of data.docs || []) {
        if (doc.cover_i) {
          addCover(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`);
        } else if (doc.cover_edition_key) {
          addCover(`https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`);
        }
      }
    }
  } catch {}

  // 3. Google Books
  try {
    const qTerm = cleanAuthor ? `intitle:${cleanTitle} inauthor:${cleanAuthor}` : cleanTitle;
    const gbUrl = getGoogleBooksUrl(encodeURIComponent(qTerm), '&maxResults=5');
    const res = await fetchWithTimeout(gbUrl, 3500);
    if (res.ok) {
      const data = await res.json();
      for (const item of data.items || []) {
        const imageLinks = item?.volumeInfo?.imageLinks;
        if (imageLinks) {
          const raw =
            imageLinks.extraLarge ||
            imageLinks.large ||
            imageLinks.medium ||
            imageLinks.thumbnail ||
            imageLinks.smallThumbnail;
          if (raw) {
            addCover(raw.replace('http://', 'https://').replace('&edge=curl', ''));
          }
        }
      }
    }
  } catch {}

  return results;
}

// In-memory cache per evitare richieste duplicate per il conteggio pagine
const pageCountCache = new Map<string, number | null>();

/**
 * Cerca il numero di pagine del libro interrogando Google Books e Open Library
 */
export async function fetchBookPageCount(
  title: string,
  author?: string
): Promise<number | null> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return null;
  const trimmedAuthor = author?.trim() || '';
  const cacheKey = `${trimmedTitle.toLowerCase()}::${trimmedAuthor.toLowerCase()}`;

  if (pageCountCache.has(cacheKey)) {
    return pageCountCache.get(cacheKey) ?? null;
  }

  // 1. Prova prima con Google Books (molto affidabile sul numero di pagine)
  try {
    let cleanTitle = sanitizeQuery(trimmedTitle);
    let cleanAuthor = trimmedAuthor ? sanitizeQuery(trimmedAuthor) : '';
    if (!cleanAuthor && cleanTitle) {
      const parsed = parseTitleAndAuthorQuery(cleanTitle);
      if (parsed.author) {
        cleanTitle = parsed.title;
        cleanAuthor = parsed.author;
      }
    }
    const query = encodeURIComponent(
      cleanAuthor ? `intitle:${cleanTitle} inauthor:${cleanAuthor}` : cleanTitle
    );
    const url = getGoogleBooksUrl(query, '&maxResults=3');

    const res = await fetchWithTimeout(url, 3800);
    if (res.ok) {
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        for (const item of data.items) {
          const pc = item?.volumeInfo?.pageCount;
          if (typeof pc === 'number' && pc > 0) {
            pageCountCache.set(cacheKey, pc);
            return pc;
          }
        }
      }
    }
  } catch {
    // Continua con Open Library
  }

  // 2. Fallback su Open Library
  try {
    const cleanTitle = sanitizeQuery(trimmedTitle);
    const cleanAuthor = trimmedAuthor ? sanitizeQuery(trimmedAuthor) : '';
    const query = encodeURIComponent(`${cleanTitle} ${cleanAuthor}`.trim());
    const url = `https://openlibrary.org/search.json?q=${query}&limit=5`;

    const res = await fetchWithTimeout(url, 4500);
    if (res.ok) {
      const data = await res.json();
      if (data.docs && data.docs.length > 0) {
        for (const doc of data.docs) {
          const pc = doc.number_of_pages_median || doc.number_of_pages;
          if (typeof pc === 'number' && pc > 0) {
            pageCountCache.set(cacheKey, pc);
            return pc;
          }
        }
      }
    }
  } catch {
    // nessun risultato
  }

  pageCountCache.set(cacheKey, null);
  return null;
}

export interface BookDetails {
  description: string | null;
  publisher: string | null;
  publishedDate: string | null;
  categories: string[];
  pageCount: number | null;
  isbn: string | null;
  subtitle: string | null;
  source: 'Google Books' | 'Apple Books' | 'Wikipedia IT' | 'Open Library' | null;
}

const DETAILS_STORAGE_KEY = 'bookshelf_book_details_it_v9';
const detailsCache = new Map<string, BookDetails>();

// Pulisce tutte le versioni precedenti della cache per rimuovere trame in lingua straniera o non corrette
try {
  localStorage.removeItem('bookshelf_book_details_v1');
  localStorage.removeItem('bookshelf_book_details_it_v2');
  localStorage.removeItem('bookshelf_book_details_it_v3');
  localStorage.removeItem('bookshelf_book_details_it_v4');
  localStorage.removeItem('bookshelf_book_details_it_v5');
  localStorage.removeItem('bookshelf_book_details_it_v6');
  localStorage.removeItem('bookshelf_book_details_it_v7');
  localStorage.removeItem('bookshelf_book_details_it_v8');
} catch {
  // ignore
}

function loadStoredDetailsCache(): Record<string, BookDetails> {
  try {
    const raw = localStorage.getItem(DETAILS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDetailsToStorage(key: string, details: BookDetails) {
  try {
    const current = loadStoredDetailsCache();
    current[key] = details;
    localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Esegue una query su iTunes / Apple Books con fallback automatico JSONP
 * per aggirare eventuali blocchi CORS del browser su itunes.apple.com.
 */
async function fetchItunesSearch(url: string, timeoutMs = 4500): Promise<any | null> {
  try {
    const res = await fetchWithTimeout(url, timeoutMs);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Se fetch fallisce per CORS nel browser, passa al fallback JSONP
  }

  if (typeof document === 'undefined' || typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const callbackName = `__itunes_cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      try {
        delete (window as any)[callbackName];
      } catch {
        (window as any)[callbackName] = undefined;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    }, timeoutMs);

    (window as any)[callbackName] = (data: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(null);
    };

    const sep = url.includes('?') ? '&' : '?';
    script.src = `${url}${sep}callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

const ITALIAN_STOPWORDS = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'e', 'ed', 'o', 'od', 'si', 'se', 'mi', 'ti', 'ci', 'vi', 'li', 'ne',
  'di', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'dell',
  'a', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'all',
  'da', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'dall',
  'in', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle', 'nell',
  'con', 'col', 'coi',
  'su', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', 'sull',
  'per', 'tra', 'fra', 'che', 'cui', 'chi', 'non', 'più', 'anche',
  'ma', 'però', 'quindi', 'cioè', 'infatti', 'mentre', 'quando',
  'dove', 'perché', 'poiché', 'finché', 'così', 'già', 'può', 'possono',
  'è', 'sono', 'era', 'erano', 'fu', 'stato', 'stata', 'stati', 'state',
  'essere', 'ha', 'hanno', 'aveva', 'avevano', 'sarà', 'sarebbe', 'sia',
  'tutto', 'tutti', 'tutta', 'tutte', 'solo', 'soltanto', 'dopo', 'prima',
  'ancora', 'sempre', 'molto', 'molti', 'molte', 'altro', 'altri', 'altra', 'altre',
  'stesso', 'stessa', 'suo', 'sua', 'suoi', 'sue', 'loro', 'proprio', 'propria',
  'questo', 'questa', 'questi', 'queste', 'quello', 'quella', 'quelli', 'quelle',
  'quale', 'quali', 'come', 'fino', 'ogni', 'senza', 'contro', 'durante',
  'insieme', 'intorno', 'dentro', 'fuori', 'dietro', 'sopra', 'sotto', 'oltre',
  'attraverso', 'verso', 'romanzo', 'romanzi', 'storia', 'storie', 'libro', 'libri',
  'protagonista', 'protagonisti', 'vita', 'mondo', 'anni', 'giorni', 'uomo', 'donna',
  'casa', 'tempo', 'modo', 'occhi', 'cuore', 'morte', 'amore', 'famiglia', 'città',
  'verità', 'realtà', 'libertà', 'viaggio', 'passato', 'futuro', 'racconta', 'narra',
  'vicenda', 'personaggi', 'autore', 'autrice', 'lettore', 'edizione', 'pagine',
  'capitolo', 'opera', 'racconto', 'racconti', 'giovane', 'ragazzo', 'ragazza',
  'figlio', 'figlia', 'padre', 'madre', 'fratello', 'sorella', 'moglie', 'marito',
  'amico', 'amici', 'segreto', 'segreti', 'mistero', 'indagine', 'omicidio',
  'commissario', 'ispettore', 'polizia', 'destino', 'passione', 'dolore', 'paura',
  'speranza', 'avventura', 'guerra', 'secolo', 'italia', 'notte', 'giorno', 'volta',
  'volte', 'parte', 'fine', 'inizio', 'mezzo', 'nulla', 'niente', 'qualcosa',
  'qualcuno', 'nessuno', 'alcuni', 'alcune', 'invece', 'eppure', 'tuttavia',
  'inoltre', 'infine', 'spesso', 'forse', 'quasi', 'intanto', 'allora', 'ora',
  'oggi', 'ieri', 'domani', 'qui', 'là', 'lì', 'né', 'sé', 'ciò', 'scopre',
  'decide', 'vive', 'torna', 'incontra', 'cerca', 'trova', 'sembra', 'diventa',
  'lascia', 'porta', 'arriva', 'essa', 'esse',
]);

// Parole ESCLUSIVE di altre lingue (English, Spanish, French, German, Portuguese) che NON esistono in italiano
const FOREIGN_STOPWORDS = new Set([
  // English
  'the', 'of', 'to', 'is', 'that', 'was', 'for', 'on', 'are', 'as', 'with', 'his',
  'they', 'at', 'be', 'this', 'have', 'from', 'had', 'by', 'but', 'not', 'what', 'were', 'we',
  'when', 'your', 'can', 'said', 'there', 'an', 'each', 'which', 'she', 'how', 'their', 'will', 'other',
  'about', 'out', 'many', 'then', 'them', 'these', 'some', 'her', 'would', 'make', 'him', 'into',
  'has', 'look', 'two', 'more', 'write', 'see', 'could', 'people', 'my', 'than', 'first', 'been', 'who',
  'its', 'now', 'find', 'down', 'day', 'did', 'get', 'over', 'new', 'only', 'little',
  'know', 'year', 'after', 'thing', 'our', 'just', 'good', 'think', 'great', 'where',
  'help', 'through', 'much', 'before', 'too', 'any', 'same', 'tell', 'boy', 'follow', 'came', 'want', 'show',
  'around', 'three', 'small', 'does', 'another', 'well', 'large', 'must', 'big', 'even',
  'such', 'because', 'turn', 'here', 'why', 'ask', 'went', 'men', 'read', 'need', 'different', 'home',
  'us', 'move', 'kind', 'again', 'change', 'off', 'away', 'house', 'answer',
  'found', 'study', 'still', 'learn', 'should', 'world', 'high', 'every', 'food', 'between', 'own', 'below',
  'country', 'last', 'school', 'keep', 'never', 'start', 'earth', 'eyes', 'light',
  'thought', 'head', 'under', 'story', 'novel', 'book', 'author', 'reader', 'chapter',
  'characters', 'friends', 'life', 'death', 'dark', 'girl', 'woman', 'wife',
  'husband', 'brother', 'sister', 'child', 'children', 'secrets', 'war', 'published', 'edition',
  // Spanish
  'el', 'los', 'las', 'unos', 'unas', 'por', 'para', 'sin', 'sobre', 'entre', 'hasta',
  'desde', 'hacia', 'según', 'sus', 'estos', 'estas', 'esos', 'esas',
  'aquel', 'aquella', 'aquellos', 'aquellas', 'más', 'muy', 'quien', 'quienes',
  'cual', 'cuales', 'cuyo', 'cuya', 'cuyos', 'cuyas', 'todos', 'todas', 'otro', 'otra', 'otros', 'otras',
  'mismo', 'misma', 'mismos', 'mismas', 'había', 'hubo', 'fueron', 'tienen', 'tenía',
  'puede', 'pueden', 'podía', 'años', 'historia', 'después', 'antes', 'siempre', 'nunca',
  'también', 'tampoco', 'porque', 'aunque', 'mientras', 'ahora', 'ayer', 'allí', 'ciudad',
  'muerte', 'hombre', 'mujer', 'hijo', 'hija', 'hijos', 'hijas', 'amigos', 'cuenta',
  'publicado', 'edición', 'página', 'páginas', 'capítulo',
  // French
  'dans', 'pour', 'sur', 'avec', 'sans', 'sous', 'chez', 'cette', 'ces',
  'dont', 'comment', 'pourquoi', 'elle', 'elles', 'nous', 'vous', 'leur', 'leurs',
  'mais', 'donc', 'aussi', 'toujours', 'jamais', 'rien', 'tous', 'toute', 'toutes',
  'même', 'mêmes', 'après', 'avant', 'pendant', 'depuis', 'femme', 'enfant', 'enfants',
  'nouveau', 'nouvelle',
  // German
  'der', 'die', 'das', 'dem', 'denn', 'sondern', 'aber', 'oder', 'mit', 'von', 'aus',
  'auf', 'nach', 'bei', 'seit', 'zur', 'zum', 'für', 'ohne', 'durch', 'über', 'unter',
  'vor', 'hinter', 'neben', 'zwischen', 'während', 'nicht', 'kein', 'keine', 'ist',
  'sind', 'waren', 'wird', 'haben', 'hatte', 'kann', 'muss', 'buch', 'geschichte',
  'leben', 'welt', 'zeit', 'jahre',
  // Portuguese
  'não', 'você', 'eles', 'elas', 'pelos', 'pelas', 'através', 'então', 'também',
  'fazer', 'estão', 'estava', 'tinha',
]);

/**
 * Verifica in modo rigoroso e affidabile al 100% che un testo sia scritto in lingua italiana.
 * Scarta categoricamente testi in inglese, spagnolo, francese, tedesco, portoghese o altre lingue.
 */
export function isItalianText(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 20) return false;

  const lower = trimmed.toLowerCase();

  // Caratteri o segni diacritici che NON esistono assolutamente nell'ortografia italiana
  // (es. spagnolo ñ, ¿, ¡; portoghese ã, õ; tedesco ß)
  if (/[ñãõß¿¡]/i.test(lower)) return false;

  // Caratteri cirillici, greci, arabi, CJK
  if (/[\u0400-\u04ff\u0370-\u03ff\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/.test(lower)) {
    return false;
  }

  const words = lower.match(/\p{L}+/gu);
  if (!words || words.length < 4) return false;

  let italianCount = 0;
  let foreignCount = 0;

  for (const w of words) {
    if (FOREIGN_STOPWORDS.has(w)) foreignCount++;
    if (ITALIAN_STOPWORDS.has(w)) italianCount++;
  }

  // Se contiene più di 2 parole straniere esclusive, NON è italiano (es. inglese, spagnolo, francese, tedesco)
  if (foreignCount > 2) return false;

  // Se contiene 1 o 2 parole straniere (es. titolo originale inglese o nome proprio tipo "New York"),
  // l'italiano deve dominare nettamente (almeno 3 parole italiane per parola straniera e almeno 3 parole italiane)
  if (foreignCount > 0) {
    return italianCount >= foreignCount * 3 && italianCount >= 3;
  }

  // Nessuna parola straniera rilevata: deve contenere almeno 1 parola tipica italiana per testi brevi,
  // o almeno 2 per testi normali
  return italianCount >= (words.length < 15 ? 1 : 2);
}

/**
 * Rileva se un testo è in italiano, in lingua originale inglese o in un'altra lingua
 */
export function detectLanguage(text: string | null | undefined): 'it' | 'en' | 'other' {
  if (!text) return 'other';
  if (isItalianText(text)) return 'it';

  const lower = text.toLowerCase();
  const words = lower.match(/\p{L}+/gu);
  if (!words || words.length < 4) return 'other';

  let itCount = 0;
  let enCount = 0;
  for (const w of words) {
    if (ITALIAN_STOPWORDS.has(w)) itCount++;
    if (FOREIGN_STOPWORDS.has(w)) enCount++;
  }

  if (itCount >= 3 && itCount > enCount * 1.5) return 'it';
  if (enCount >= 3 && enCount > itCount) return 'en';
  return 'other';
}

/**
 * Normalizza una stringa per confronti di compatibilità (senza accenti o punteggiatura)
 */
function normalizeForCompare(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`´"-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica corrispondenza esatta o varianti minime tra parole (es. traslitterazioni)
 */
function isWordMatch(w1: string, w2: string): boolean {
  if (w1 === w2) return true;
  if (w1.length >= 6 && w2.length >= 6) {
    if (
      Math.abs(w1.length - w2.length) <= 1 &&
      (w1.startsWith(w2.slice(0, -1)) || w2.startsWith(w1.slice(0, -1)))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Estrae le varianti del titolo (titolo intero, parte prima dei due punti, senza indicazioni volume)
 */
function getTitleVariants(rawTitle: string): string[] {
  const variants: string[] = [];

  // Rimuove indicazioni di volume tipo "(Vol. 1)", "Vol. 1", "#1", o numeri finali isolati "Harry Potter 1"
  const withoutVol = sanitizeQuery(
    rawTitle
      .replace(/\b(vol\.?|volume|tomo|parte|libro|episodio)\s*\d+\b/gi, '')
      .replace(/\(\s*\)/g, '')
  );

  // Titolo intero
  const full = sanitizeQuery(rawTitle);
  if (full) {
    variants.push(full);
  }

  if (withoutVol && withoutVol.length >= 2 && !variants.includes(withoutVol)) {
    variants.push(withoutVol);
  }

  // Separa su ':', ' - ', ' – ', '('
  const parts = rawTitle
    .split(/\s*[:\-–—(]\s*/)
    .map((p) => sanitizeQuery(p))
    .filter((p) => p.length >= 2);

  // Se il titolo contiene un sottotitolo separato da ':' o '-', inserisce prima la parte principale
  if (parts.length > 1 && parts[0].length >= 3 && !variants.includes(parts[0])) {
    variants.unshift(parts[0]);
  }

  // Variante senza numero finale (es. "Harry Potter 1" -> "Harry Potter")
  const withoutTrailingNum = sanitizeQuery(withoutVol.replace(/\s+\d+\s*$/, ''));
  if (withoutTrailingNum && withoutTrailingNum.length >= 3 && !variants.includes(withoutTrailingNum)) {
    variants.push(withoutTrailingNum);
  }

  for (const part of parts) {
    if (!variants.includes(part)) {
      variants.push(part);
    }
  }

  return variants.length > 0 ? variants : [rawTitle.trim()];
}

/**
 * Estrae il cognome o la parola chiave identificativa dell'autore
 */
function getAuthorKeyWord(author?: string): string {
  if (!author) return '';
  const cleaned = author
    .replace(/\b[A-Za-z]\./g, ' ')
    .replace(/[,()]/g, ' ')
    .trim();
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return sanitizeQuery(author);
  // Prende l'ultimo token se è sufficientemente lungo (cognome in "Nome Cognome"),
  // altrimenti il token più lungo (in caso di "Cognome Nome" o pseudonimo)
  const last = tokens[tokens.length - 1];
  const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
  return last.length >= 4 ? last : longest;
}

/**
 * Verifica rigorosamente che l'autore trovato sia compatibile con l'autore cercato.
 * Gestisce l'ordine "Cognome Nome", traslitterazioni ed eventuali secondi nomi.
 * IMPEDISCE categoricamente false corrispondenze dovute a semplici omonimie nel nome di battesimo (es. "Paolo", "Marco", "Stephen").
 */
function isAuthorCompatible(queryAuthor: string, candidateAuthor: string): boolean {
  if (!queryAuthor || !queryAuthor.trim()) return true;
  if (!candidateAuthor || !candidateAuthor.trim()) return false;

  const normQuery = normalizeForCompare(queryAuthor).replace(/[jy]/g, 'i');
  const normCand = normalizeForCompare(candidateAuthor).replace(/[jy]/g, 'i');

  if (normCand === normQuery) return true;

  const nameStop = new Set(['de', 'di', 'del', 'della', 'degli', 'delle', 'da', 'van', 'von', 'la', 'le', 'san', 'sant']);

  const queryWords = normQuery.split(/\s+/).filter((w) => !nameStop.has(w) && w.length >= 2);
  const candWords = normCand.split(/\s+/).filter((w) => !nameStop.has(w) && w.length >= 2);
  if (queryWords.length === 0 || candWords.length === 0) return false;

  // Se l'autore cercato è una singola parola (es. "Dante", "Calvino", "Orwell", "Omero"):
  if (queryWords.length === 1) {
    return candWords.some((cw) => isWordMatch(queryWords[0], cw) || cw.includes(queryWords[0]) || queryWords[0].includes(cw));
  }

  // Se l'autore cercato ha 2 o più parole (es. "Dante Alighieri", "Stephen King", "Paolo Cognetti"):
  // Il cognome (ultimo token) o il primo token (se formato "Cognome Nome") DEVE combaciare obbligatoriamente!
  const querySurname = queryWords[queryWords.length - 1];
  const queryFirstname = queryWords[0];

  const surnameMatches = candWords.some((cw) => isWordMatch(querySurname, cw));
  const firstnameMatchesAsSurname = candWords.some((cw) => isWordMatch(queryFirstname, cw));

  if (!surnameMatches && !firstnameMatchesAsSurname) {
    return false; // Né il cognome né il primo nome combaciano: AUTORE DIVERSO!
  }

  // Se il candidato ha 1 sola parola: deve essere il cognome cercato o il nome celebre (es. "Dante", "Calvino")
  if (candWords.length === 1) {
    return surnameMatches || firstnameMatchesAsSurname;
  }

  // Se sia la query che il candidato hanno 2 o più parole:
  // NON è ammesso che combaci SOLO il nome di battesimo se i cognomi differiscono (es. Paolo Cognetti != Paolo Giordano)!
  if (!surnameMatches && !candWords.some((cw) => isWordMatch(queryWords.slice(1).join(''), cw))) {
    return false;
  }

  // Richiede che almeno 2 token combacino, OPPURE che il cognome combaci e il primo nome sia un'iniziale compatibile
  const matchedCount = queryWords.filter((qw) =>
    candWords.some((cw) => isWordMatch(qw, cw) || (qw.length > 2 && cw.length === 1 && qw.startsWith(cw)))
  ).length;

  return matchedCount >= 2 || surnameMatches;
}

/**
 * Verifica rigorosamente che il titolo trovato sia compatibile con quello cercato.
 * Rifiuta categoricamente saggi, guide, analisi del testo o commentari.
 */
function isTitleCompatible(queryTitle: string, candidateTitle: string): boolean {
  const normQuery = normalizeForCompare(queryTitle);
  const normCand = normalizeForCompare(candidateTitle);
  if (!normQuery || !normCand) return false;
  if (normQuery === normCand) return true;

  // Rifiuta saggi, guide e commenti sull'opera se la query non li richiede esplicitamente
  const DERIVATIVE_PREFIXES = /\b(guida\s+(?:a|alla|al|ai|alle|per)|invito\s+alla\s+lettura|commento\s+(?:a|all'|alla|al|allo)|analisi\s+(?:del|della|di|testuale)|saggio\s+su|riassunto\s+(?:del|della|di)|dizionario\s+(?:del|di)|critica\s+(?:a|di)|antologia|biografia\s+di|le\s+lezioni\s+su|introduzione\s+a)\b/i;
  if (DERIVATIVE_PREFIXES.test(candidateTitle) && !DERIVATIVE_PREFIXES.test(queryTitle)) {
    return false;
  }

  // Separa eventuale sottotitolo o indicazione volume prima di normalizzare
  const candMain = normalizeForCompare(
    candidateTitle
      .split(/\s*[:\-–—(]\s*/)[0]
      .replace(/\b(vol\.?|volume|tomo|parte|libro|ediz|edizione|integrale)\s*\d*\b/gi, '')
  );
  const queryMain = normalizeForCompare(
    queryTitle
      .split(/\s*[:\-–—(]\s*/)[0]
      .replace(/\b(vol\.?|volume|tomo|parte|libro|ediz|edizione|integrale)\s*\d*\b/gi, '')
  );

  if (candMain === queryMain || candMain === normQuery) return true;

  // Per titoli corti (<= 5 caratteri o 1 parola), DEVE esserci coincidenza del titolo principale
  if (normQuery.length <= 5 || !normQuery.includes(' ')) {
    return candMain === normQuery || candMain === queryMain;
  }

  const stop = new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'l',
    'di', 'del', 'della', 'dei', 'degli', 'delle', 'd',
    'e', 'ed', 'in', 'su', 'per', 'con', 'da', 'a', 'al', 'alla',
  ]);
  const queryWords = normQuery.split(/\s+/).filter((w) => w.length >= 2 && !stop.has(w) && !/^\d+$/.test(w));
  const candWords = candMain.split(/\s+/).filter((w) => w.length >= 2 && !stop.has(w));

  if (queryWords.length === 0 || candWords.length === 0) return false;

  // I candidati non possono avere un eccesso di parole sconosciute nel titolo principale (es. "La casa" vs "La casa sul lago di notte")
  if (candWords.length > queryWords.length + 2) {
    return false;
  }

  const matched = queryWords.filter((qw) =>
    candWords.some((cw) => isWordMatch(qw, cw))
  );

  // Per titoli di 1-2 parole significative, tutte devono combaciare
  if (queryWords.length <= 2) {
    return matched.length === queryWords.length;
  }

  // Per titoli di 3 o più parole, almeno l'80% deve combaciare
  return matched.length >= Math.ceil(queryWords.length * 0.8);
}

/**
 * Calcola un punteggio di affinità tra il libro cercato e un risultato del catalogo.
 * Se l'autore è specificato dall'utente, l'autore DEVE combaciare (altrimenti punteggio = 0).
 */
function scoreCandidateMatch(
  titleVariants: string[],
  queryAuthor: string,
  candTitle: string,
  candSubtitle?: string | null,
  candAuthor?: string | null
): number {
  const fullCandTitle = [candTitle, candSubtitle].filter(Boolean).join(' - ');
  const normCand = normalizeForCompare(candTitle);
  const normPrimary = normalizeForCompare(titleVariants[0] || '');

  const exactTitle =
    normPrimary.length > 0 &&
    (normCand === normPrimary || normalizeForCompare(fullCandTitle) === normPrimary);

  const titleMatches =
    exactTitle ||
    titleVariants.some(
      (v) => isTitleCompatible(v, candTitle) || (candSubtitle ? isTitleCompatible(v, fullCandTitle) : false)
    );

  if (!titleMatches) return 0;

  // Se l'utente ha inserito l'autore, verifichiamo RIGOROSAMENTE che l'autore coincida
  if (queryAuthor && queryAuthor.trim()) {
    if (candAuthor && candAuthor.trim()) {
      if (!isAuthorCompatible(queryAuthor, candAuthor)) {
        return 0; // Autore diverso: SCARTATO per evitare trame di libri omonimi!
      }
      return exactTitle ? 200 : 160;
    } else {
      // Catalogo privo di autore: accettiamo solo se il titolo è lungo e specifico (>= 14 caratteri)
      if (exactTitle && normPrimary.length >= 14) {
        return 120;
      }
      return 0;
    }
  }

  return exactTitle ? 150 : 100;
}

/**
 * Traduce e normalizza le categorie / generi letterari in italiano,
 * rimuovendo etichette tecniche o in lingua straniera.
 */
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  fiction: 'Narrativa',
  'literary fiction': 'Narrativa letteraria',
  'general fiction': 'Narrativa',
  'contemporary fiction': 'Narrativa contemporanea',
  'historical fiction': 'Romanzo storico',
  'science fiction': 'Fantascienza',
  'sci-fi': 'Fantascienza',
  fantasy: 'Fantasy',
  'fantasy fiction': 'Fantasy',
  mystery: 'Giallo e Mistero',
  'mystery & detective': 'Giallo e Mistero',
  detective: 'Giallo',
  crime: 'Crime e Giallo',
  'true crime': 'True Crime',
  thriller: 'Thriller',
  thrillers: 'Thriller',
  suspense: 'Suspense',
  horror: 'Horror',
  romance: 'Romanzo rosa',
  'love stories': 'Sentimentale',
  adventure: 'Avventura',
  'action & adventure': 'Azione e Avventura',
  biography: 'Biografia',
  'biography & autobiography': 'Biografia e Autobiografia',
  autobiography: 'Autobiografia',
  memoir: 'Memorie',
  history: 'Storia',
  philosophy: 'Filosofia',
  psychology: 'Psicologia',
  'self-help': 'Crescita personale',
  'personal growth': 'Crescita personale',
  'business & economics': 'Economia e Business',
  business: 'Business',
  economics: 'Economia',
  politics: 'Politica',
  'political science': 'Scienze politiche',
  'social science': 'Scienze sociali',
  sociology: 'Sociologia',
  science: 'Scienze',
  nature: 'Natura',
  art: 'Arte',
  music: 'Musica',
  poetry: 'Poesia',
  drama: 'Teatro e Drammaturgia',
  'comics & graphic novels': 'Fumetti e Graphic Novel',
  comics: 'Fumetti',
  'graphic novels': 'Graphic Novel',
  'juvenile fiction': 'Narrativa per ragazzi',
  'juvenile nonfiction': 'Ragazzi',
  'young adult': 'Young Adult',
  'young adult fiction': 'Young Adult',
  children: 'Bambini e Ragazzi',
  classics: 'Classici',
  'literary criticism': 'Critica letteraria',
  'literary collections': 'Antologie letterarie',
  essays: 'Saggistica',
  nonfiction: 'Saggistica',
  religion: 'Religione e Spiritualità',
  spirituality: 'Spiritualità',
  'body, mind & spirit': 'Mente e Spirito',
  'health & fitness': 'Salute e Benessere',
  cooking: 'Cucina',
  travel: 'Viaggi',
  humor: 'Umorismo',
  'family & relationships': 'Famiglia e Relazioni',
  education: 'Educazione',
  computers: 'Informatica e Tecnologia',
  technology: 'Tecnologia',
  'sports & recreation': 'Sport',
};

const IGNORED_CATEGORIES = new Set([
  'general',
  'books',
  'libri',
  'electronic books',
  'ebook',
  'ebooks',
  'accessible book',
  'protected daisy',
  'in library',
  'large type books',
  'open syllabus project',
  'new york times bestseller',
  'translations into italian',
  'italian language',
  'italiano',
]);

function normalizeCategoriesToItalian(rawCategories: string[]): string[] {
  const result: string[] = [];

  for (const raw of rawCategories) {
    // Divide categorie composte tipo "Fiction / Thrillers / Suspense"
    const parts = raw.split(/[\/,&—–-]/).map((p) => p.trim()).filter(Boolean);

    for (const part of parts) {
      const lower = part.toLowerCase();
      if (IGNORED_CATEGORIES.has(lower)) continue;

      if (CATEGORY_TRANSLATIONS[lower]) {
        const translated = CATEGORY_TRANSLATIONS[lower];
        if (!result.includes(translated)) result.push(translated);
        continue;
      }

      // Se è già in italiano (es. da Apple Books Italia: "Romanzi e letteratura", "Gialli e thriller", "Narrativa")
      const looksItalian =
        /\b(romanzi|letteratura|narrativa|gialli|thriller|fantascienza|biografie|memorie|storia|saggistica|filosofia|psicologia|poesia|ragazzi|bambini|classici|avventura|arte|scienze|economia|politica|società|crescita|benessere|viaggi|cucina|umorismo|fumetti|religione|spiritualità)\b/i.test(
          part
        );

      if (looksItalian && !result.includes(part)) {
        result.push(part.charAt(0).toUpperCase() + part.slice(1));
      }
    }
  }

  return result.slice(0, 3);
}

/**
 * Pulisce e formatta il testo della trama rimuovendo tag HTML ed entità
 */
function cleanPlotText(raw: string): string {
  if (!raw) return '';
  let text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  // Decodifica entità HTML comuni
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&laquo;': '«',
    '&raquo;': '»',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&agrave;': 'à',
    '&egrave;': 'è',
    '&eacute;': 'é',
    '&igrave;': 'ì',
    '&ograve;': 'ò',
    '&ugrave;': 'ù',
  };

  for (const [entity, char] of Object.entries(entities)) {
    text = text.split(entity).join(char);
  }

  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Cerca trama e metadati del libro su Google Books (rigorosamente in lingua italiana)
 */
async function fetchDetailsFromGoogleBooks(
  title: string,
  author?: string
): Promise<BookDetails | null> {
  const titleVariants = getTitleVariants(title);
  const primaryTitle = titleVariants[0] || sanitizeQuery(title);
  const cleanAuthor = author ? sanitizeQuery(author) : '';
  const authorKey = getAuthorKeyWord(author);

  const querySpecs: Array<{ q: string; langRestrict?: string }> = [];

  if (cleanAuthor) {
    querySpecs.push({
      q: `${primaryTitle} ${cleanAuthor}`,
      langRestrict: 'it',
    });
    if (authorKey && authorKey !== cleanAuthor) {
      querySpecs.push({
        q: `${primaryTitle} ${authorKey}`,
        langRestrict: 'it',
      });
    }
    querySpecs.push({
      q: `intitle:${primaryTitle} inauthor:${authorKey || cleanAuthor}`,
      langRestrict: 'it',
    });
    // Senza langRestrict per individuare edizioni italiane prive di tag "it"
    querySpecs.push({
      q: `${primaryTitle} ${cleanAuthor}`,
    });
    querySpecs.push({
      q: `"${primaryTitle}" ${authorKey || cleanAuthor}`,
    });
    querySpecs.push({
      q: primaryTitle,
    });
  }

  for (const variant of titleVariants.slice(1, 3)) {
    querySpecs.push({
      q: authorKey ? `${variant} ${authorKey}` : variant,
      langRestrict: 'it',
    });
  }

  if (!cleanAuthor) {
    querySpecs.push({ q: primaryTitle, langRestrict: 'it' });
    querySpecs.push({ q: primaryTitle });
  }

  let bestWithPlot: BookDetails | null = null;
  let bestQualityScore = 0;
  let bestPartial: BookDetails | null = null;
  const volumeIdsToInspect: string[] = [];

  const seenQueries = new Set<string>();

  for (const spec of querySpecs) {
    const specKey = `${spec.q.toLowerCase()}::${spec.langRestrict || 'any'}`;
    if (!spec.q || seenQueries.has(specKey)) continue;
    seenQueries.add(specKey);

    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(spec.q)}${
        spec.langRestrict ? `&langRestrict=${spec.langRestrict}` : ''
      }&maxResults=20`;

      const res = await fetchWithTimeout(url, 4500);
      if (res.status === 429 || res.status === 403) break;
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.items || data.items.length === 0) continue;

      for (const item of data.items) {
        const info = item?.volumeInfo;
        if (!info || !info.title) continue;

        const itemAuthors = Array.isArray(info.authors) ? info.authors.join(' ') : '';
        const matchScore = scoreCandidateMatch(
          titleVariants,
          cleanAuthor,
          String(info.title),
          info.subtitle ? String(info.subtitle) : null,
          itemAuthors
        );
        if (matchScore === 0) continue;

        let rawDesc = info.description ? cleanPlotText(info.description) : null;
        if ((!rawDesc || rawDesc.length <= 25) && item?.searchInfo?.textSnippet) {
          const snippet = cleanPlotText(item.searchInfo.textSnippet);
          if (snippet.length > 35) {
            rawDesc = snippet;
          }
        }

        // Accetta SOLO ED ESCLUSIVAMENTE trame verificate in lingua italiana
        const validItalianDesc = rawDesc && isItalianText(rawDesc) ? rawDesc : null;

        // Se il libro combacia ma la lista non ha la descrizione completa, salviamo l'ID per lookup diretto
        if (
          (!validItalianDesc || validItalianDesc.length < 90) &&
          item.id &&
          matchScore >= 100 &&
          volumeIdsToInspect.length < 6 &&
          !volumeIdsToInspect.includes(String(item.id))
        ) {
          volumeIdsToInspect.push(String(item.id));
        }

        const publisher = info.publisher || null;
        const publishedDate = info.publishedDate ? String(info.publishedDate).slice(0, 4) : null;
        const categories = Array.isArray(info.categories)
          ? normalizeCategoriesToItalian(info.categories)
          : [];
        const pageCount =
          typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : null;
        const rawSubtitle = info.subtitle ? cleanPlotText(info.subtitle) : null;
        const subtitle = rawSubtitle && isItalianText(rawSubtitle) ? rawSubtitle : null;

        let isbn: string | null = null;
        if (Array.isArray(info.industryIdentifiers)) {
          const isbn13 = info.industryIdentifiers.find((id: any) => id.type === 'ISBN_13');
          const isbn10 = info.industryIdentifiers.find((id: any) => id.type === 'ISBN_10');
          isbn = isbn13?.identifier || isbn10?.identifier || null;
        }

        const candidate: BookDetails = {
          description: validItalianDesc,
          publisher,
          publishedDate,
          categories,
          pageCount,
          isbn,
          subtitle,
          source: 'Google Books',
        };

        if (
          !bestPartial &&
          (candidate.publisher ||
            candidate.publishedDate ||
            candidate.categories.length > 0 ||
            candidate.pageCount)
        ) {
          bestPartial = candidate;
        } else if (bestPartial !== null) {
          const currentPartial: BookDetails = bestPartial;
          bestPartial = {
            ...currentPartial,
            publisher: currentPartial.publisher || candidate.publisher,
            publishedDate: currentPartial.publishedDate || candidate.publishedDate,
            categories:
              currentPartial.categories.length > 0 ? currentPartial.categories : candidate.categories,
            pageCount: currentPartial.pageCount || candidate.pageCount,
            isbn: currentPartial.isbn || candidate.isbn,
            subtitle: currentPartial.subtitle || candidate.subtitle,
          };
        }

        if (candidate.description) {
          const qualityScore = matchScore * 3 + Math.min(candidate.description.length, 1000);
          if (!bestWithPlot || !bestWithPlot.description || qualityScore > bestQualityScore) {
            bestQualityScore = qualityScore;
            bestWithPlot = {
              ...candidate,
              publisher: candidate.publisher || bestPartial?.publisher || null,
              publishedDate: candidate.publishedDate || bestPartial?.publishedDate || null,
              categories:
                candidate.categories.length > 0
                  ? candidate.categories
                  : bestPartial?.categories || [],
              pageCount: candidate.pageCount || bestPartial?.pageCount || null,
              isbn: candidate.isbn || bestPartial?.isbn || null,
              subtitle: candidate.subtitle || bestPartial?.subtitle || null,
            };
          }
        }
      }

      if (bestWithPlot?.description && bestWithPlot.description.length >= 120) {
        return bestWithPlot;
      }
    } catch {
      // continua con la query successiva
    }
  }

  // Se la ricerca per lista non ha restituito una trama lunga, controlliamo il volume singolo per i volumi top
  if ((!bestWithPlot?.description || bestWithPlot.description.length < 100) && volumeIdsToInspect.length > 0) {
    const detailResults = await Promise.allSettled(
      volumeIdsToInspect.slice(0, 5).map(async (volId) => {
        const res = await fetchWithTimeout(
          `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(volId)}`,
          3500
        );
        if (!res.ok) return null;
        return res.json();
      })
    );

    for (const r of detailResults) {
      if (r.status !== 'fulfilled' || !r.value?.volumeInfo?.description) continue;
      const desc = cleanPlotText(r.value.volumeInfo.description);
      if (!desc || desc.length <= 25) continue;

      if (isItalianText(desc)) {
        if (!bestWithPlot?.description || desc.length > bestWithPlot.description.length) {
          const info = r.value.volumeInfo;
          bestWithPlot = {
            description: desc,
            publisher: info.publisher || bestPartial?.publisher || null,
            publishedDate:
              (info.publishedDate ? String(info.publishedDate).slice(0, 4) : null) ||
              bestPartial?.publishedDate ||
              null,
            categories:
              (Array.isArray(info.categories) && info.categories.length > 0
                ? normalizeCategoriesToItalian(info.categories)
                : bestPartial?.categories) || [],
            pageCount:
              (typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : null) ||
              bestPartial?.pageCount ||
              null,
            isbn: bestPartial?.isbn || null,
            subtitle: bestPartial?.subtitle || null,
            source: 'Google Books',
          };
        }
      }
    }
  }

  return bestWithPlot || bestPartial;
}

/**
 * Cerca trama e metadati su Apple Books Italia con fallback JSONP anti-CORS
 */
async function fetchDetailsFromAppleBooks(
  title: string,
  author?: string
): Promise<BookDetails | null> {
  const titleVariants = getTitleVariants(title);
  const primaryTitle = titleVariants[0] || sanitizeQuery(title);
  const cleanAuthor = author ? sanitizeQuery(author) : '';
  const authorKey = getAuthorKeyWord(author);

  const searchTerms = Array.from(
    new Set(
      [
        cleanAuthor ? `${primaryTitle} ${cleanAuthor}`.trim() : '',
        authorKey ? `${primaryTitle} ${authorKey}`.trim() : '',
        ...titleVariants.slice(1, 3).map((v) => (authorKey ? `${v} ${authorKey}`.trim() : v)),
        primaryTitle,
      ].filter(Boolean)
    )
  );

  let bestMatch: BookDetails | null = null;
  let bestQualityScore = 0;

  for (const term of searchTerms) {
    try {
      const query = encodeURIComponent(term);
      const url = `https://itunes.apple.com/search?term=${query}&entity=ebook&country=IT&lang=it_it&limit=25`;

      const data = await fetchItunesSearch(url, 4500);
      if (!data || !Array.isArray(data.results) || data.results.length === 0) continue;

      for (const item of data.results) {
        const trackName = String(item.trackName || '');
        if (!trackName) continue;

        const matchScore = scoreCandidateMatch(
          titleVariants,
          cleanAuthor,
          trackName,
          null,
          item.artistName ? String(item.artistName) : null
        );
        if (matchScore === 0) continue;

        const desc = item.description ? cleanPlotText(item.description) : null;
        if (!desc || desc.length <= 25) continue;

        // Scarta categoricamente trame non in italiano
        if (!isItalianText(desc)) {
          continue;
        }

        const genres = Array.isArray(item.genres)
          ? normalizeCategoriesToItalian(item.genres)
          : [];
        const releaseYear = item.releaseDate ? String(item.releaseDate).slice(0, 4) : null;

        const candidate: BookDetails = {
          description: desc,
          publisher: item.sellerName || null,
          publishedDate: releaseYear,
          categories: genres,
          pageCount: null,
          isbn: null,
          subtitle: null,
          source: 'Apple Books',
        };

        const qualityScore = matchScore * 3 + Math.min(desc.length, 1000);
        if (!bestMatch || !bestMatch.description || qualityScore > bestQualityScore) {
          bestQualityScore = qualityScore;
          bestMatch = candidate;
        }
      }

      if (bestMatch?.description && bestMatch.description.length >= 110) {
        return bestMatch;
      }
    } catch {
      // continua
    }
  }

  return bestMatch;
}

/**
 * Cerca la sinossi/trama in italiano su Wikipedia Italia.
 * Gestisce voci dedicate al libro o sezioni dedicate al libro dentro la voce dell'autore o della saga.
 */
async function fetchDetailsFromWikipediaIt(
  title: string,
  author?: string
): Promise<BookDetails | null> {
  const titleVariants = getTitleVariants(title);
  const primaryTitle = titleVariants[0] || sanitizeQuery(title);
  const normPrimary = normalizeForCompare(primaryTitle);
  const cleanAuthor = author ? sanitizeQuery(author) : '';
  const authorKey = getAuthorKeyWord(author);

  const searchQueries = Array.from(
    new Set(
      [
        authorKey ? `${primaryTitle} ${authorKey} romanzo` : '',
        authorKey ? `${primaryTitle} ${authorKey}` : '',
        `${primaryTitle} romanzo`,
        `${primaryTitle} libro`,
        ...titleVariants.slice(1, 3).map((v) => (authorKey ? `${v} ${authorKey}` : `${v} romanzo`)),
        primaryTitle,
      ].filter(Boolean)
    )
  );

  const candidatePages: Array<{ pageId: number; priority: number; isDedicatedBookPage: boolean }> = [];
  const seenPageIds = new Set<number>();

  for (const q of searchQueries) {
    if (candidatePages.length >= 4) break;
    try {
      const searchUrl = `https://it.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(
        q
      )}&srlimit=8`;
      const res = await fetchWithTimeout(searchUrl, 4000);
      if (!res.ok) continue;

      const data = await res.json();
      const results = data?.query?.search;
      if (!Array.isArray(results) || results.length === 0) continue;

      for (const item of results) {
        const pageId = item.pageid;
        const pageTitle = String(item.title || '');
        const lowerTitle = pageTitle.toLowerCase();
        const snippet = cleanPlotText(String(item.snippet || '')).toLowerCase();

        if (!pageId || seenPageIds.has(pageId)) continue;

        // Scarta pagine di disambiguazione, film, serie TV, album musicali o videogiochi
        if (
          /\((disambigua|film|serie televisiva|miniserie|album|singolo|brano|videogioco|personaggio|programma televisivo)/i.test(
            lowerTitle
          )
        ) {
          continue;
        }

        const strippedWikiTitle = pageTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
        const titleMatches = titleVariants.some((v) => isTitleCompatible(v, strippedWikiTitle));
        const snippetMentionsTitle =
          normPrimary.length >= 4 && normalizeForCompare(snippet).includes(normPrimary);

        const explicitBookTag =
          /\((romanzo|libro|opera|racconto|racconti|saggio|poema|tragedia|commedia|fumetto|manga|novella|fiaba|autobiografia)/i.test(
            lowerTitle
          );

        // Se l'utente ha indicato l'autore, la voce o lo snippet DEVE essere compatibile con l'autore cercato.
        // NESSUNA eccezione: evita che libri omonimi di autori diversi (es. "Inferno (romanzo)" di Dan Brown per Dante) vengano confusi!
        const authorCompatible = cleanAuthor
          ? isAuthorCompatible(cleanAuthor, `${pageTitle} ${snippet}`)
          : true;
        if (cleanAuthor && !authorCompatible) {
          continue;
        }

        const hasBookHint =
          explicitBookTag ||
          /\b(romanzo|libro|scritto|scritta|scrittore|scrittrice|autore|autrice|pubblicat[oa]|opera|racconto|racconti|saggio|trama|protagonista|edito|narrativa|bestseller|ciclo|saga)\b/i.test(
            snippet
          ) ||
          Boolean(authorKey && isAuthorCompatible(authorKey, snippet));

        if (titleMatches || (snippetMentionsTitle && hasBookHint)) {
          seenPageIds.add(pageId);
          const priority =
            (explicitBookTag ? 100 : 0) +
            (titleMatches ? 60 : 15) +
            (hasBookHint ? 30 : 0) +
            (authorKey && isAuthorCompatible(authorKey, `${pageTitle} ${snippet}`) ? 40 : 0);
          candidatePages.push({ pageId, priority, isDedicatedBookPage: titleMatches });
        }
      }
    } catch {
      // continua
    }
  }

  if (candidatePages.length === 0) return null;

  candidatePages.sort((a, b) => b.priority - a.priority);
  const topCandidates = candidatePages.slice(0, 3);

  // Scarica in parallelo gli estratti completi per i migliori candidati
  const extractResponses = await Promise.allSettled(
    topCandidates.map(async (cand) => {
      const extractUrl = `https://it.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&explaintext=1&pageids=${cand.pageId}`;
      const res = await fetchWithTimeout(extractUrl, 4500);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        extract: String(data?.query?.pages?.[cand.pageId]?.extract || '').trim(),
        isDedicatedBookPage: cand.isDedicatedBookPage,
      };
    })
  );

  for (const r of extractResponses) {
    if (r.status !== 'fulfilled' || !r.value || r.value.extract.length < 60) continue;
    const { extract, isDedicatedBookPage } = r.value;

    // Estrae l'introduzione (prima della prima sezione == ... ==)
    const intro = extract.split(/\n==+\s*[^=]+\s*==+/)[0]?.trim() || '';

    // Se l'utente ha fornito un autore, l'introduzione della voce deve confermare l'autore dell'opera
    if (cleanAuthor && !isAuthorCompatible(cleanAuthor, `${intro} ${extract.slice(0, 1000)}`)) {
      continue;
    }

    // Cerca una sezione dedicata alla trama / sinossi / contenuto
    const sectionMatch = extract.match(
      /==+\s*(?:Trama[^=\n]*|Sinossi[^=\n]*|Contenuto|Descrizione|Argomento|Il racconto|Sintesi|Storia|Vicenda|Riassunto)\s*==+\s*([\s\S]*?)(?:\n==\s*[^=]+\s*==|$)/i
    );

    let plotText = '';
    if (sectionMatch && sectionMatch[1] && sectionMatch[1].trim().length > 40) {
      const cleanSection = sectionMatch[1]
        .replace(/===+\s*[^=]+\s*===+/g, '\n')
        .trim();
      plotText =
        isDedicatedBookPage && intro && intro.length > 40
          ? `${intro}\n\n${cleanSection}`
          : cleanSection;
    } else if (isDedicatedBookPage && intro && intro.length > 50) {
      plotText = intro;
    } else {
      // Non è una pagina dedicata al libro e non ha una sezione trama: scartata
      continue;
    }

    plotText = cleanPlotText(plotText);
    if (plotText.length > 2400) {
      plotText = plotText.slice(0, 2400).replace(/\s+\S*$/, '') + '…';
    }

    if (plotText.length > 50 && isItalianText(plotText)) {
      return {
        description: plotText,
        publisher: null,
        publishedDate: null,
        categories: [],
        pageCount: null,
        isbn: null,
        subtitle: null,
        source: 'Wikipedia IT',
      };
    }
  }

  return null;
}

/**
 * Cerca trama e metadati su Open Library (solo edizioni con trama italiana)
 */
async function fetchDetailsFromOpenLibrary(
  title: string,
  author?: string
): Promise<BookDetails | null> {
  try {
    const titleVariants = getTitleVariants(title);
    const primaryTitle = titleVariants[0] || sanitizeQuery(title);
    const cleanAuthor = author ? sanitizeQuery(author) : '';
    const authorKey = getAuthorKeyWord(author);
    const query = encodeURIComponent(`${primaryTitle} ${authorKey || cleanAuthor}`.trim());
    const searchUrl = `https://openlibrary.org/search.json?q=${query}&limit=6`;

    const res = await fetchWithTimeout(searchUrl, 4500);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.docs || data.docs.length === 0) return null;

    let bestDoc = null;
    let description: string | null = null;

    for (const doc of data.docs) {
      if (!doc.key) continue;
      const docTitle = String(doc.title || '');
      const docAuthors = Array.isArray(doc.author_name) ? doc.author_name.join(' ') : '';
      const matchScore = scoreCandidateMatch(titleVariants, cleanAuthor, docTitle, null, docAuthors);
      if (matchScore === 0) continue;

      if (!bestDoc) bestDoc = doc;

      try {
        const workRes = await fetchWithTimeout(`https://openlibrary.org${doc.key}.json`, 4000);
        if (workRes.ok) {
          const workData = await workRes.json();
          let rawDesc: string | null = null;
          if (typeof workData.description === 'string') {
            rawDesc = cleanPlotText(workData.description);
          } else if (workData.description && typeof workData.description.value === 'string') {
            rawDesc = cleanPlotText(workData.description.value);
          }
          if (rawDesc && rawDesc.length > 25 && isItalianText(rawDesc)) {
            description = rawDesc;
            bestDoc = doc;
            break;
          }
        }
      } catch {
        // ignore
      }
    }

    if (!bestDoc && !description) return null;

    return {
      description,
      publisher:
        bestDoc && Array.isArray(bestDoc.publisher) && bestDoc.publisher.length > 0
          ? bestDoc.publisher[0]
          : null,
      publishedDate: bestDoc?.first_publish_year ? String(bestDoc.first_publish_year) : null,
      categories:
        bestDoc && Array.isArray(bestDoc.subject)
          ? normalizeCategoriesToItalian(bestDoc.subject)
          : [],
      pageCount: bestDoc?.number_of_pages_median || null,
      isbn:
        bestDoc && Array.isArray(bestDoc.isbn) && bestDoc.isbn.length > 0
          ? bestDoc.isbn[0]
          : null,
      subtitle: bestDoc?.subtitle && isItalianText(bestDoc.subtitle) ? bestDoc.subtitle : null,
      source: 'Open Library',
    };
  } catch {
    return null;
  }
}

/**
 * Recupera la scheda completa del libro rigorosamente in lingua italiana (trama, editore, anno, generi, ISBN)
 * interrogando in parallelo Google Books, Apple Books IT (con fallback JSONP) e Wikipedia Italia,
 * con fallback su Open Library.
 * Scarta categoricamente trame in lingua straniera o appartenenti a libri omonimi di autori diversi.
 */
export async function fetchBookDetails(
  title: string,
  author?: string,
  forceRefresh = false,
  confirmedPlot?: string | null
): Promise<BookDetails> {
  const trimmedTitle = title.trim();
  const trimmedAuthor = author?.trim() || '';
  const cacheKey = `${trimmedTitle.toLowerCase()}::${trimmedAuthor.toLowerCase()}`;

  // 0. Se è presente una trama confermata/salvata dall'utente per questo libro, usala istantaneamente senza scraping
  if (confirmedPlot && confirmedPlot.trim()) {
    const details: BookDetails = {
      description: confirmedPlot.trim(),
      publisher: null,
      publishedDate: null,
      categories: [],
      pageCount: null,
      isbn: null,
      subtitle: null,
      source: 'Google Books',
    };
    detailsCache.set(cacheKey, details);
    saveDetailsToStorage(cacheKey, details);
    return details;
  }

  if (!forceRefresh) {
    const cached = detailsCache.get(cacheKey);
    if (cached && cached.description && isItalianText(cached.description)) {
      return cached;
    }
    const stored = loadStoredDetailsCache();
    if (
      stored[cacheKey] &&
      stored[cacheKey].description &&
      isItalianText(stored[cacheKey].description)
    ) {
      detailsCache.set(cacheKey, stored[cacheKey]);
      return stored[cacheKey];
    }
  }

  // 1. Interroghiamo in parallelo Google Books, Apple Books IT e Wikipedia Italia
  const [googleRes, appleRes, wikiRes] = await Promise.allSettled([
    fetchDetailsFromGoogleBooks(trimmedTitle, trimmedAuthor),
    fetchDetailsFromAppleBooks(trimmedTitle, trimmedAuthor),
    fetchDetailsFromWikipediaIt(trimmedTitle, trimmedAuthor),
  ]);

  const google = googleRes.status === 'fulfilled' ? googleRes.value : null;
  const apple = appleRes.status === 'fulfilled' ? appleRes.value : null;
  const wiki = wikiRes.status === 'fulfilled' ? wikiRes.value : null;

  // Scegliamo la miglior trama italiana nativa
  let bestDescription: string | null = null;
  let bestSource: BookDetails['source'] = null;

  if (apple?.description && google?.description) {
    if (google.description.length >= apple.description.length * 0.8) {
      bestDescription = google.description;
      bestSource = 'Google Books';
    } else {
      bestDescription = apple.description;
      bestSource = 'Apple Books';
    }
  } else if (google?.description) {
    bestDescription = google.description;
    bestSource = 'Google Books';
  } else if (apple?.description) {
    bestDescription = apple.description;
    bestSource = 'Apple Books';
  }

  // Se Google Books e Apple Books non hanno trama nativa o hanno solo un frammento e Wikipedia IT ce l'ha, usa Wikipedia IT
  if (
    (!bestDescription || bestDescription.length < 90) &&
    wiki?.description &&
    wiki.description.length > (bestDescription?.length || 0)
  ) {
    bestDescription = wiki.description;
    bestSource = 'Wikipedia IT';
  }

  const merged: BookDetails = {
    description: bestDescription,
    publisher: google?.publisher || apple?.publisher || null,
    publishedDate: google?.publishedDate || apple?.publishedDate || null,
    categories:
      (apple?.categories && apple.categories.length > 0
        ? apple.categories
        : google?.categories) || [],
    pageCount: google?.pageCount || apple?.pageCount || null,
    isbn: google?.isbn || apple?.isbn || null,
    subtitle: google?.subtitle || apple?.subtitle || null,
    source: bestSource || google?.source || apple?.source || wiki?.source || null,
  };

  // 2. Se ancora manca la trama italiana, proviamo con Open Library
  if (!merged.description) {
    const openLib = await fetchDetailsFromOpenLibrary(trimmedTitle, trimmedAuthor);
    if (openLib?.description) {
      merged.description = openLib.description;
      merged.source = 'Open Library';
    }
    if (openLib) {
      merged.publisher = merged.publisher || openLib.publisher;
      merged.publishedDate = merged.publishedDate || openLib.publishedDate;
      merged.categories = merged.categories.length > 0 ? merged.categories : openLib.categories;
      merged.pageCount = merged.pageCount || openLib.pageCount;
      merged.isbn = merged.isbn || openLib.isbn;
      merged.subtitle = merged.subtitle || openLib.subtitle;
    }
  }

  // Salviamo in cache solo se abbiamo una trama italiana verificata al 100%
  if (merged.description && isItalianText(merged.description)) {
    detailsCache.set(cacheKey, merged);
    saveDetailsToStorage(cacheKey, merged);
  }

  return merged;
}

export interface BookSuggestion {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  pages: number | null;
  publishedYear: string | null;
  source?: string;
}

/**
 * Ricerca suggerimenti di autocompletamento libri (Titolo, Autore, Copertina, Pagine)
 * interrogando Apple Books (IT/US), Open Library e Google Books per compilazione istantanea 1-tap.
 */
export async function searchBookSuggestions(query: string): Promise<BookSuggestion[]> {
  const raw = sanitizeQuery(query);
  if (!raw || raw.length < 2) return [];

  const { title: parsedTitle, author: parsedAuthor } = parseTitleAndAuthorQuery(raw);
  const primaryTitle = parsedTitle || raw;
  const primaryAuthor = parsedAuthor;
  const titleVariants = getTitleSearchVariants(primaryTitle);

  const seen = new Set<string>();
  const results: BookSuggestion[] = [];

  const addResult = (s: BookSuggestion) => {
    const key = `${s.title.toLowerCase()}::${s.author.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(s);
  };

  // 1. Apple Books (IT + US) - Istantaneo, copertine 600x600 in alta risoluzione, immune a blocchi di quota 429
  try {
    const searchTerms: string[] = [];
    if (primaryAuthor) {
      for (const v of titleVariants) {
        searchTerms.push(`${v} ${primaryAuthor}`.trim());
      }
      searchTerms.push(primaryAuthor);
    }
    for (const v of titleVariants) {
      searchTerms.push(v);
    }

    for (const country of ['it', 'us']) {
      for (const term of searchTerms.slice(0, 5)) {
        const appleUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&country=${country}&limit=6`;
        const res = await fetchWithTimeout(appleUrl, 3200);
        if (!res.ok) continue;
        const data = await res.json();
        for (const item of data.results || []) {
          if (!item.trackName || !item.artistName) continue;
          let coverUrl: string | null = null;
          if (item.artworkUrl100) {
            coverUrl = item.artworkUrl100
              .replace('100x100bb', '600x600bb')
              .replace('http://', 'https://');
          }
          const releaseYear = item.releaseDate ? String(item.releaseDate).slice(0, 4) : null;
          addResult({
            id: `apple-${item.trackId || `${item.trackName}-${item.artistName}`}`,
            title: item.trackName,
            author: item.artistName,
            coverUrl,
            pages: null,
            publishedYear: releaseYear,
            source: 'Apple Books',
          });
        }
      }
      if (results.length >= 8) break;
    }
  } catch {}

  // 2. Open Library search
  if (results.length < 6) {
    try {
      const qTerm = primaryAuthor ? `${primaryTitle} ${primaryAuthor}` : primaryTitle;
      const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(qTerm)}&limit=6`;
      const res = await fetchWithTimeout(olUrl, 3500);
      if (res.ok) {
        const data = await res.json();
        for (const doc of data.docs || []) {
          if (!doc.title || !doc.author_name || doc.author_name.length === 0) continue;
          const auth = doc.author_name[0];
          let coverUrl: string | null = null;
          if (doc.cover_i) {
            coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          } else if (doc.cover_edition_key) {
            coverUrl = `https://covers.openlibrary.org/b/olid/${doc.cover_edition_key}-L.jpg`;
          }
          addResult({
            id: `ol-${doc.key || `${doc.title}-${auth}`}`,
            title: doc.title,
            author: auth,
            coverUrl,
            pages: doc.number_of_pages_median || doc.number_of_pages || null,
            publishedYear: doc.first_publish_year ? String(doc.first_publish_year) : null,
            source: 'Open Library',
          });
        }
      }
    } catch {}
  }

  // 3. Google Books (se disponibile e non in errore 429)
  if (results.length < 6) {
    try {
      const queries = [
        primaryAuthor ? `intitle:${primaryTitle} inauthor:${primaryAuthor}` : primaryTitle,
        primaryAuthor ? `${primaryTitle} ${primaryAuthor}` : primaryTitle,
      ];
      for (const q of queries) {
        const gbUrl = getGoogleBooksUrl(encodeURIComponent(q), '&maxResults=6');
        const res = await fetchWithTimeout(gbUrl, 3200);
        if (!res.ok) continue;
        const data = await res.json();
        for (const item of data.items || []) {
          const info = item?.volumeInfo;
          if (!info || !info.title) continue;
          const auth = Array.isArray(info.authors) && info.authors.length > 0 ? info.authors[0] : '';
          let coverUrl: string | null = null;
          if (info.imageLinks) {
            const raw = info.imageLinks.thumbnail || info.imageLinks.smallThumbnail;
            if (raw) coverUrl = raw.replace('http://', 'https://').replace('&edge=curl', '');
          }
          addResult({
            id: `gb-${item.id}`,
            title: info.title,
            author: auth,
            coverUrl,
            pages: typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : null,
            publishedYear: info.publishedDate ? String(info.publishedDate).slice(0, 4) : null,
            source: 'Google Books',
          });
        }
        if (results.length >= 6) break;
      }
    } catch {}
  }

  if (primaryAuthor) {
    results.sort((a, b) => {
      const aMatches = isAuthorCompatible(primaryAuthor, a.author);
      const bMatches = isAuthorCompatible(primaryAuthor, b.author);
      if (aMatches && !bMatches) return -1;
      if (!aMatches && bMatches) return 1;
      return 0;
    });
  }

  return results.slice(0, 8);
}

export interface PlotSearchResult {
  id: string;
  source: 'Google Books' | 'Apple Books' | 'Wikipedia IT' | 'Open Library';
  language?: 'it' | 'en' | 'other';
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publishedDate: string | null;
  description: string;
  pageCount: number | null;
  categories: string[];
  coverUrl: string | null;
  isbn: string | null;
}

export type GoogleBookSearchResult = PlotSearchResult;

/**
 * Ricerca multi-catalogo online di trame (Apple Books + Google Books + Wikipedia IT + Open Library).
 * Fornisce risultati completi e immediatamente selezionabili dall'utente per qualsiasi libro.
 */
export async function searchBookPlotsOnline(
  query: string,
  author?: string
): Promise<PlotSearchResult[]> {
  const clean = sanitizeQuery(query);
  if (!clean || clean.length < 2) return [];

  const { title: parsedTitle, author: parsedAuthor } = parseTitleAndAuthorQuery(clean);
  const primaryTitle = parsedTitle || clean;
  const cleanAuthor = author ? sanitizeQuery(author) : parsedAuthor;
  const titleVariants = getTitleSearchVariants(primaryTitle);
  const seenPlots = new Set<string>();

  const [applePromise, googlePromise, wikiPromise, openLibPromise] = await Promise.allSettled([
    // 1. Apple Books (IT + US)
    (async () => {
      try {
        const appleResults: PlotSearchResult[] = [];
        const terms: string[] = [];
        if (cleanAuthor) {
          for (const v of titleVariants) {
            terms.push(`${v} ${cleanAuthor}`.trim());
          }
          terms.push(cleanAuthor);
        }
        for (const v of titleVariants) {
          terms.push(v);
        }

        for (const country of ['it', 'us']) {
          for (const term of terms.slice(0, 5)) {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&country=${country}&limit=8`;
            const data = await fetchItunesSearch(url, 3800);
            if (!data?.results || !Array.isArray(data.results)) continue;

            for (const item of data.results) {
              const trackName = String(item.trackName || '').trim();
              if (!trackName) continue;
              const rawDesc = item.description ? cleanPlotText(item.description) : null;
              if (!rawDesc || rawDesc.length < 35) continue;

              const lang = detectLanguage(rawDesc);
              let coverUrl: string | null = null;
              if (item.artworkUrl100) {
                coverUrl = item.artworkUrl100
                  .replace('100x100bb', '600x600bb')
                  .replace('http://', 'https://');
              }

              appleResults.push({
                id: `apple-${item.trackId || `${trackName}-${item.artistName}`}`,
                source: 'Apple Books',
                language: lang,
                title: trackName,
                subtitle: null,
                authors: item.artistName ? [item.artistName] : [],
                publisher: item.sellerName || null,
                publishedDate: item.releaseDate ? String(item.releaseDate).slice(0, 4) : null,
                description: rawDesc,
                pageCount: null,
                categories: Array.isArray(item.genres) ? normalizeCategoriesToItalian(item.genres) : [],
                coverUrl,
                isbn: null,
              });
            }
          }
          if (appleResults.length >= 5) break;
        }
        return appleResults;
      } catch {
        return [];
      }
    })(),

    // 2. Google Books API
    (async () => {
      try {
        const searchTerms = [
          cleanAuthor ? `intitle:${primaryTitle} inauthor:${cleanAuthor}` : primaryTitle,
          clean,
        ];
        let items: any[] = [];

        for (const st of searchTerms) {
          let url = getGoogleBooksUrl(encodeURIComponent(st), '&maxResults=10&langRestrict=it');
          let res = await fetchWithTimeout(url, 3500);
          let data = res.ok ? await res.json() : null;

          if (!data?.items || data.items.length === 0) {
            url = getGoogleBooksUrl(encodeURIComponent(st), '&maxResults=10');
            res = await fetchWithTimeout(url, 3500);
            data = res.ok ? await res.json() : null;
          }

          if (data?.items && Array.isArray(data.items)) {
            items = data.items;
            break;
          }
        }

        if (items.length === 0) return [];

        const missingDescIds = items
          .filter((it) => !it?.volumeInfo?.description && it?.id)
          .slice(0, 4)
          .map((it) => it.id);

        const detailMap = new Map<string, string>();
        if (missingDescIds.length > 0) {
          await Promise.allSettled(
            missingDescIds.map(async (id) => {
              try {
                const detailRes = await fetchWithTimeout(
                  getGoogleBooksUrl('', `&id=${encodeURIComponent(id)}`),
                  3000
                );
                if (detailRes.ok) {
                  const detailData = await detailRes.json();
                  if (detailData?.volumeInfo?.description) {
                    detailMap.set(id, detailData.volumeInfo.description);
                  }
                }
              } catch {}
            })
          );
        }

        const gbResults: PlotSearchResult[] = [];
        for (const item of items) {
          const info = item?.volumeInfo || {};
          const title = info.title ? String(info.title).trim() : '';
          if (!title) continue;

          let rawDesc = info.description || detailMap.get(item.id) || null;
          if ((!rawDesc || rawDesc.length <= 25) && item?.searchInfo?.textSnippet) {
            rawDesc = item.searchInfo.textSnippet;
          }
          const desc = rawDesc ? cleanPlotText(rawDesc) : null;
          if (!desc || desc.length < 35) continue;

          const lang = detectLanguage(desc);
          const imageLinks = info.imageLinks;
          let coverUrl: string | null = null;
          if (imageLinks) {
            const raw =
              imageLinks.extraLarge ||
              imageLinks.large ||
              imageLinks.medium ||
              imageLinks.thumbnail ||
              imageLinks.smallThumbnail;
            if (raw) {
              coverUrl = raw.replace('http://', 'https://').replace('&edge=curl', '');
            }
          }

          let isbn: string | null = null;
          if (Array.isArray(info.industryIdentifiers)) {
            const isbn13 = info.industryIdentifiers.find((id: any) => id.type === 'ISBN_13');
            const isbn10 = info.industryIdentifiers.find((id: any) => id.type === 'ISBN_10');
            isbn = isbn13?.identifier || isbn10?.identifier || null;
          }

          gbResults.push({
            id: `gb-${item.id}`,
            source: 'Google Books',
            language: lang,
            title,
            subtitle: info.subtitle ? cleanPlotText(String(info.subtitle)) : null,
            authors: Array.isArray(info.authors) ? info.authors.map(String) : [],
            publisher: info.publisher ? String(info.publisher).trim() : null,
            publishedDate: info.publishedDate ? String(info.publishedDate).slice(0, 4) : null,
            description: desc,
            pageCount: typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : null,
            categories: Array.isArray(info.categories) ? normalizeCategoriesToItalian(info.categories) : [],
            coverUrl,
            isbn,
          });
        }
        return gbResults;
      } catch {
        return [];
      }
    })(),

    // 3. Wikipedia Italia API
    (async () => {
      try {
        const searchUrl = `https://it.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(
          primaryTitle + (cleanAuthor ? ` ${cleanAuthor}` : ' romanzo')
        )}&srlimit=6`;
        const res = await fetchWithTimeout(searchUrl, 3800);
        if (!res.ok) return [];

        const data = await res.json();
        const searchItems = data?.query?.search;
        if (!Array.isArray(searchItems) || searchItems.length === 0) return [];

        const wikiResults: PlotSearchResult[] = [];
        const topPages = searchItems
          .filter((it: any) => !/\((disambigua|film|album|serie)/i.test(String(it.title || '')))
          .slice(0, 3);

        await Promise.allSettled(
          topPages.map(async (page: any) => {
            try {
              const extUrl = `https://it.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&explaintext=1&pageids=${page.pageid}`;
              const extRes = await fetchWithTimeout(extUrl, 3800);
              if (!extRes.ok) return;

              const extData = await extRes.json();
              const fullText = String(extData?.query?.pages?.[page.pageid]?.extract || '').trim();
              if (fullText.length < 70) return;

              const intro = fullText.split(/\n==+\s*[^=]+\s*==+/)[0]?.trim() || '';
              const sectionMatch = fullText.match(
                /==+\s*(?:Trama[^=\n]*|Sinossi[^=\n]*|Contenuto|Descrizione|Argomento|Il racconto|Sintesi)\s*==+\s*([\s\S]*?)(?:\n==\s*[^=]+\s*==|$)/i
              );

              let plot = '';
              if (sectionMatch && sectionMatch[1] && sectionMatch[1].trim().length > 40) {
                const cleanSec = sectionMatch[1].replace(/===+\s*[^=]+\s*===+/g, '\n').trim();
                plot = intro.length > 50 ? `${intro}\n\n${cleanSec}` : cleanSec;
              } else if (intro.length > 60) {
                plot = intro;
              }

              plot = cleanPlotText(plot);
              if (plot.length > 2200) {
                plot = plot.slice(0, 2200).replace(/\s+\S*$/, '') + '…';
              }

              if (plot && plot.length >= 40 && isItalianText(plot)) {
                wikiResults.push({
                  id: `wiki-${page.pageid}`,
                  source: 'Wikipedia IT',
                  language: 'it',
                  title: String(page.title).replace(/\s*\([^)]*\)\s*$/, '').trim(),
                  subtitle: null,
                  authors: cleanAuthor ? [cleanAuthor] : [],
                  publisher: null,
                  publishedDate: null,
                  description: plot,
                  pageCount: null,
                  categories: ['Enciclopedia'],
                  coverUrl: null,
                  isbn: null,
                });
              }
            } catch {}
          })
        );
        return wikiResults;
      } catch {
        return [];
      }
    })(),

    // 4. Open Library API
    (async () => {
      try {
        const qTerm = cleanAuthor ? `${primaryTitle} ${cleanAuthor}` : primaryTitle;
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(qTerm)}&limit=5`;
        const res = await fetchWithTimeout(url, 4200);
        if (!res.ok) return [];

        const data = await res.json();
        if (!data?.docs || !Array.isArray(data.docs)) return [];

        const olResults: PlotSearchResult[] = [];
        const topDocs = data.docs.slice(0, 4);

        await Promise.allSettled(
          topDocs.map(async (doc: any) => {
            if (!doc.key) return;
            try {
              const workRes = await fetchWithTimeout(`https://openlibrary.org${doc.key}.json`, 3500);
              if (!workRes.ok) return;

              const workData = await workRes.json();
              let rawDesc = '';
              if (typeof workData.description === 'string') {
                rawDesc = cleanPlotText(workData.description);
              } else if (workData.description && typeof workData.description.value === 'string') {
                rawDesc = cleanPlotText(workData.description.value);
              }

              if (rawDesc && rawDesc.length >= 35) {
                const lang = detectLanguage(rawDesc);
                let coverUrl: string | null = null;
                if (doc.cover_i) {
                  coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
                }

                olResults.push({
                  id: `ol-${doc.key}`,
                  source: 'Open Library',
                  language: lang,
                  title: String(doc.title || clean),
                  subtitle: doc.subtitle ? String(doc.subtitle) : null,
                  authors: Array.isArray(doc.author_name) ? doc.author_name.map(String) : [],
                  publisher: Array.isArray(doc.publisher) ? String(doc.publisher[0]) : null,
                  publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
                  description: rawDesc,
                  pageCount: doc.number_of_pages_median || null,
                  categories: Array.isArray(doc.subject) ? normalizeCategoriesToItalian(doc.subject) : [],
                  coverUrl,
                  isbn: Array.isArray(doc.isbn) ? String(doc.isbn[0]) : null,
                });
              }
            } catch {}
          })
        );
        return olResults;
      } catch {
        return [];
      }
    })(),
  ]);

  const rawList: PlotSearchResult[] = [];
  if (applePromise.status === 'fulfilled') rawList.push(...applePromise.value);
  if (googlePromise.status === 'fulfilled') rawList.push(...googlePromise.value);
  if (wikiPromise.status === 'fulfilled') rawList.push(...wikiPromise.value);
  if (openLibPromise.status === 'fulfilled') rawList.push(...openLibPromise.value);

  const results: PlotSearchResult[] = [];
  for (const item of rawList) {
    const key = item.description.slice(0, 50).toLowerCase().replace(/\s+/g, ' ');
    if (seenPlots.has(key)) continue;
    seenPlots.add(key);
    results.push(item);
  }

  // Ordina per pertinenza:
  // 1. Risultati con autore coincidente
  // 2. Lingua italiana prioritariamente in cima
  // 3. Lunghezza e qualità del testo
  results.sort((a, b) => {
    if (cleanAuthor) {
      const aAuth = a.authors.some((au) => isAuthorCompatible(cleanAuthor, au));
      const bAuth = b.authors.some((au) => isAuthorCompatible(cleanAuthor, au));
      if (aAuth && !bAuth) return -1;
      if (!aAuth && bAuth) return 1;
    }
    // Lingua italiana in cima
    if (a.language === 'it' && b.language !== 'it') return -1;
    if (a.language !== 'it' && b.language === 'it') return 1;
    return b.description.length - a.description.length;
  });

  return results;
}

export const searchGoogleBooksManual = searchBookPlotsOnline;

/**
 * Salva e persiste una trama personalizzata o scelta da Google Books in cache e localStorage
 */
export function saveManualBookPlot(
  title: string,
  author: string | undefined,
  plot: string,
  extra?: Partial<BookDetails>
): BookDetails {
  const trimmedTitle = title.trim();
  const trimmedAuthor = author?.trim() || '';
  const cacheKey = `${trimmedTitle.toLowerCase()}::${trimmedAuthor.toLowerCase()}`;
  const stored = loadStoredDetailsCache();

  const current = detailsCache.get(cacheKey) || stored[cacheKey] || {
    description: null,
    publisher: null,
    publishedDate: null,
    categories: [],
    pageCount: null,
    isbn: null,
    subtitle: null,
    source: null,
  };

  const updated: BookDetails = {
    ...current,
    ...extra,
    description: plot.trim(),
    source: (extra?.source as any) || current.source || 'Google Books',
  };

  detailsCache.set(cacheKey, updated);
  saveDetailsToStorage(cacheKey, updated);

  if (trimmedAuthor) {
    const noAuthorKey = `${trimmedTitle.toLowerCase()}::`;
    detailsCache.set(noAuthorKey, updated);
    saveDetailsToStorage(noAuthorKey, updated);
  }

  return updated;
}

/**
 * Rimuove i dettagli salvati in cache per un libro
 */
export function clearCachedBookDetails(title: string, author?: string): void {
  const trimmedTitle = title.trim();
  const trimmedAuthor = author?.trim() || '';
  const cacheKey = `${trimmedTitle.toLowerCase()}::${trimmedAuthor.toLowerCase()}`;
  detailsCache.delete(cacheKey);
  try {
    const stored = loadStoredDetailsCache();
    delete stored[cacheKey];
    if (trimmedAuthor) {
      delete stored[`${trimmedTitle.toLowerCase()}::`];
    }
    localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore
  }
}
