// In-memory cache per evitare richieste duplicate per gli stessi titoli
const coverCache = new Map<string, string | null>();

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
    const cleanTitle = sanitizeQuery(title);
    const cleanAuthor = author ? sanitizeQuery(author) : '';
    const query = encodeURIComponent(`${cleanTitle} ${cleanAuthor}`.trim());
    const url = `https://itunes.apple.com/search?term=${query}&entity=ebook&limit=3`;

    const res = await fetchWithTimeout(url, 4000);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.results && data.results.length > 0) {
      for (const item of data.results) {
        if (item.artworkUrl100) {
          // Converte l'anteprima 100x100 in una ad alta risoluzione 600x600 o 800x800
          return item.artworkUrl100
            .replace('100x100bb', '600x600bb')
            .replace('http://', 'https://');
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
    const cleanTitle = sanitizeQuery(title);
    const cleanAuthor = author ? sanitizeQuery(author) : '';
    const query = encodeURIComponent(`${cleanTitle} ${cleanAuthor}`.trim());
    const url = `https://openlibrary.org/search.json?q=${query}&limit=5`;

    const res = await fetchWithTimeout(url, 5000);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.docs || data.docs.length === 0) return null;

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
    const cleanTitle = sanitizeQuery(title);
    const cleanAuthor = author ? sanitizeQuery(author) : '';
    const query = encodeURIComponent(
      cleanAuthor ? `intitle:${cleanTitle} inauthor:${cleanAuthor}` : cleanTitle
    );
    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3`;

    const res = await fetchWithTimeout(url, 4000);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;

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

  const [appleCover, openLibCover, googleCover] = await Promise.allSettled([
    searchAppleBooks(trimmedTitle, trimmedAuthor),
    searchOpenLibrary(trimmedTitle, trimmedAuthor),
    searchGoogleBooks(trimmedTitle, trimmedAuthor),
  ]);

  if (appleCover.status === 'fulfilled' && appleCover.value) {
    results.push(appleCover.value);
  }
  if (openLibCover.status === 'fulfilled' && openLibCover.value && !results.includes(openLibCover.value)) {
    results.push(openLibCover.value);
  }
  if (googleCover.status === 'fulfilled' && googleCover.value && !results.includes(googleCover.value)) {
    results.push(googleCover.value);
  }

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
    const cleanTitle = sanitizeQuery(trimmedTitle);
    const cleanAuthor = trimmedAuthor ? sanitizeQuery(trimmedAuthor) : '';
    const query = encodeURIComponent(
      cleanAuthor ? `intitle:${cleanTitle} inauthor:${cleanAuthor}` : cleanTitle
    );
    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=3`;

    const res = await fetchWithTimeout(url, 4000);
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

const DETAILS_STORAGE_KEY = 'bookshelf_book_details_it_v8';
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
 */
function isAuthorCompatible(queryAuthor: string, candidateAuthor: string): boolean {
  if (!queryAuthor || !queryAuthor.trim()) return true;
  if (!candidateAuthor || !candidateAuthor.trim()) return false;

  const normQuery = normalizeForCompare(queryAuthor).replace(/[jy]/g, 'i');
  const normCand = normalizeForCompare(candidateAuthor).replace(/[jy]/g, 'i');

  if (normCand.includes(normQuery) || normQuery.includes(normCand)) return true;

  const queryWords = normQuery.split(/\s+/).filter((w) => w.length >= 3);
  const candWords = normCand.split(/\s+/).filter((w) => w.length >= 3);
  if (queryWords.length === 0 || candWords.length === 0) return false;

  // Il cognome o parola chiave principale dell'autore cercato deve comparire nell'autore candidato
  const authorKey = normalizeForCompare(getAuthorKeyWord(queryAuthor)).replace(/[jy]/g, 'i');
  if (authorKey && authorKey.length >= 3) {
    const keyMatches = candWords.some(
      (cw) => isWordMatch(authorKey, cw) || cw.includes(authorKey) || authorKey.includes(cw)
    );
    if (keyMatches) return true;
  }

  // Almeno una parola significativa dell'autore cercato deve combaciare
  return queryWords.some((qw) => candWords.some((cw) => isWordMatch(qw, cw)));
}

/**
 * Verifica rigorosamente che il titolo trovato sia compatibile con quello cercato
 */
function isTitleCompatible(queryTitle: string, candidateTitle: string): boolean {
  const normQuery = normalizeForCompare(queryTitle);
  const normCand = normalizeForCompare(candidateTitle);
  if (!normQuery || !normCand) return false;
  if (normQuery === normCand) return true;

  // Separa eventuale sottotitolo del candidato prima di normalizzare
  const candMain = normalizeForCompare(candidateTitle.split(/\s*[:\-–—(]\s*/)[0]);
  if (candMain === normQuery) return true;

  // Per titoli molto corti (es. "It", "Io", "1984"), deve combaciare esattamente il titolo principale
  if (normQuery.length <= 4) {
    return candMain === normQuery;
  }

  if (normCand.includes(normQuery) || candMain.includes(normQuery)) return true;
  if (normQuery.includes(candMain) && candMain.length >= normQuery.length * 0.7) return true;

  const stop = new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'l',
    'di', 'del', 'della', 'dei', 'degli', 'delle', 'd',
    'e', 'ed', 'in', 'su', 'per', 'con', 'da', 'a', 'al', 'alla',
  ]);
  const queryWords = normQuery.split(/\s+/).filter((w) => w.length >= 2 && !stop.has(w) && !/^\d+$/.test(w));
  const candWords = candMain.split(/\s+/).filter((w) => w.length >= 2 && !stop.has(w));

  if (queryWords.length === 0) {
    return candWords.some((w) => normQuery.split(/\s+/).includes(w));
  }

  // Per titoli di 1-2 parole significative, tutte devono combaciare
  const matched = queryWords.filter((qw) =>
    candWords.some((cw) => isWordMatch(qw, cw))
  );

  const threshold = queryWords.length <= 2 ? queryWords.length : Math.ceil(queryWords.length * 0.65);
  return matched.length >= threshold;
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

        // Se il libro combacia perfettamente ma la lista non ha la descrizione completa, salviamo l'ID per lookup diretto
        if (
          (!validItalianDesc || validItalianDesc.length < 90) &&
          item.id &&
          matchScore >= 160 &&
          volumeIdsToInspect.length < 3 &&
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
        } else if (bestPartial) {
          bestPartial = {
            ...bestPartial,
            publisher: bestPartial.publisher || candidate.publisher,
            publishedDate: bestPartial.publishedDate || candidate.publishedDate,
            categories:
              bestPartial.categories.length > 0 ? bestPartial.categories : candidate.categories,
            pageCount: bestPartial.pageCount || candidate.pageCount,
            isbn: bestPartial.isbn || candidate.isbn,
            subtitle: bestPartial.subtitle || candidate.subtitle,
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
      volumeIdsToInspect.slice(0, 2).map(async (volId) => {
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

        // Se l'utente ha indicato l'autore, la voce o lo snippet devono essere compatibili con l'autore cercato
        const authorCompatible = cleanAuthor
          ? isAuthorCompatible(cleanAuthor, `${pageTitle} ${snippet}`)
          : true;
        if (cleanAuthor && !authorCompatible && !explicitBookTag) {
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

    // Se l'utente ha fornito un autore, verifichiamo che l'estratto menzioni l'autore per evitare omonimie
    if (cleanAuthor && !isAuthorCompatible(cleanAuthor, extract)) {
      continue;
    }

    // Estrae l'introduzione (prima della prima sezione == ... ==)
    const intro = extract.split(/\n==+\s*[^=]+\s*==+/)[0]?.trim() || '';

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
    } else if (isDedicatedBookPage) {
      plotText = intro;
    } else {
      // È la pagina dell'autore o di una saga: cerchiamo i paragrafi che parlano specificamente del libro cercato
      const paragraphs = extract
        .split(/\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 70 && !p.startsWith('==') && normalizeForCompare(p).includes(normPrimary));
      if (paragraphs.length > 0) {
        plotText = paragraphs.slice(0, 2).join('\n\n');
      }
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
  forceRefresh = false
): Promise<BookDetails> {
  const trimmedTitle = title.trim();
  const trimmedAuthor = author?.trim() || '';
  const cacheKey = `${trimmedTitle.toLowerCase()}::${trimmedAuthor.toLowerCase()}`;

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
}

/**
 * Ricerca suggerimenti di autocompletamento libri (Titolo, Autore, Copertina, Pagine)
 * interrogando Google Books (preferenza lingua italiana) per compilazione istantanea 1-tap.
 */
export async function searchBookSuggestions(query: string): Promise<BookSuggestion[]> {
  const clean = sanitizeQuery(query);
  if (!clean || clean.length < 2) return [];

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(clean)}&langRestrict=it&maxResults=6`;
    const res = await fetchWithTimeout(url, 3500);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) return [];

    const seen = new Set<string>();
    const results: BookSuggestion[] = [];

    for (const item of data.items) {
      const info = item?.volumeInfo;
      if (!info || !info.title) continue;

      const title = String(info.title).trim();
      const author =
        Array.isArray(info.authors) && info.authors.length > 0
          ? String(info.authors[0]).trim()
          : '';
      if (!title || !author) continue;

      const dedupKey = `${title.toLowerCase()}::${author.toLowerCase()}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

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

      const pages =
        typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : null;
      const publishedYear = info.publishedDate ? String(info.publishedDate).slice(0, 4) : null;

      results.push({
        id: item.id || dedupKey,
        title,
        author,
        coverUrl,
        pages,
        publishedYear,
      });

      if (results.length >= 5) break;
    }

    return results;
  } catch {
    return [];
  }
}
