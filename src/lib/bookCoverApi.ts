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

const DETAILS_STORAGE_KEY = 'bookshelf_book_details_it_v2';
const detailsCache = new Map<string, BookDetails>();

// Pulisce eventuale cache precedente che poteva contenere trame in lingua straniera
try {
  localStorage.removeItem('bookshelf_book_details_v1');
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
 * Verifica in modo rigoroso che un testo (trama o sottotitolo) sia realmente in lingua italiana,
 * scartando testi in inglese, spagnolo, francese, tedesco o portoghese.
 */
function isItalianText(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();

  // Parole funzionali e lessico distintivo italiano
  const italianMatches =
    normalized.match(
      /\b(il|lo|gli|uno|una|dell|dello|della|dei|degli|delle|nel|nello|nella|nei|negli|nelle|sul|sullo|sulla|sui|sugli|sulle|dal|dallo|dalla|dai|dagli|dalle|tra|fra|che|non|più|anche|però|quindi|cioè|infatti|mentre|quando|dove|perché|poiché|così|già|può|possono|tutto|tutti|tutta|tutte|solo|soltanto|dopo|prima|ancora|sempre|molto|molti|molte|altro|altri|altra|altre|stesso|stessa|suo|sua|suoi|sue|loro|questo|questa|questi|queste|quello|quella|quelli|quelle|quale|quali|sono|stato|stata|stati|state|essere|avere|aveva|avevano|sarà|sarebbe|romanzo|storia|libro|protagonista|vita|mondo|anni|giorni|uomo|donna|casa|tempo|modo|occhi|cuore|morte|amore|famiglia|città|verità|viaggio|passato|futuro|attraverso|contro|senza|durante|insieme|intorno|dentro|fuori|dietro|sopra|sotto|oltre|racconta|narra|vicenda|personaggi|autore|lettore|edizione|pagine|capitolo)\b/g
    ) || [];

  // Parole funzionali distintive di lingue straniere (EN, ES, FR, DE, PT)
  const foreignMatches =
    normalized.match(
      /\b(the|and|with|that|this|from|have|has|had|were|been|would|could|should|their|there|about|which|when|what|where|who|whom|whose|into|through|after|before|between|without|against|however|although|because|while|novel|story|book|reader|himself|herself|themselves|nothing|everything|something|los|las|unos|unas|por|para|sin|sobre|entre|hasta|desde|hacia|según|mediante|pero|más|muy|casi|siempre|nunca|también|tampoco|porque|aunque|como|quien|quienes|cual|cuales|cuyo|cuya|estos|estas|esos|esas|aquel|aquella|nuestro|nuestra|todos|todas|otros|otras|mismo|misma|estar|había|fueron|tiene|tienen|puede|pueden|novela|les|des|une|dans|pour|avec|sans|sous|vers|chez|pendant|depuis|mais|donc|très|aussi|toujours|jamais|tout|tous|toute|toutes|autre|autres|même|mêmes|leur|leurs|notre|votre|cette|ces|quoi|dont|comment|pourquoi|parce|comme|sont|était|étaient|être|avoir|peut|der|die|das|den|dem|einer|eines|einem|einen|und|oder|aber|denn|sondern|mit|von|aus|bei|nach|seit|zur|zum|für|ohne|gegen|durch|über|unter|hinter|neben|zwischen|während|wegen|trotz|nicht|kein|keine|auch|noch|schon|immer|sehr|viel|mehr|als|wenn|weil|dass|warum|sind|war|waren|wird|werden|wurde|wurden|haben|hatte|kann|können|muss|seine|seiner|seinem|seinen|ihre|buch|geschichte|uma|uns|umas|dos|das|nos|nas|pelo|pela|pelos|pelas|num|numa|sem|sob|até|muito|sempre|também|embora|onde|quem|quais|este|estes|esse|essa|esses|essas|aquele|aquela|seus|suas|nosso|nossa|outro|outros|outra|outras|mesmo|mesma|foi|eram|têm|história|livro)\b/g
    ) || [];

  // Deve avere almeno 3 occorrenze italiane e nettamente più parole italiane rispetto a quelle straniere
  return italianMatches.length >= 3 && italianMatches.length > foreignMatches.length * 1.5;
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
 * Cerca trama e metadati del libro su Google Books (accettando SOLO trame in lingua italiana)
 */
async function fetchDetailsFromGoogleBooks(
  title: string,
  author?: string
): Promise<BookDetails | null> {
  const cleanTitle = sanitizeQuery(title);
  const cleanAuthor = author ? sanitizeQuery(author) : '';

  const queries = [
    cleanAuthor
      ? `intitle:${cleanTitle} inauthor:${cleanAuthor}&langRestrict=it`
      : `${cleanTitle}&langRestrict=it`,
    cleanAuthor ? `${cleanTitle} ${cleanAuthor}&langRestrict=it` : '',
    `${cleanTitle}&langRestrict=it`,
  ].filter(Boolean);

  let bestPartial: BookDetails | null = null;

  for (const q of queries) {
    try {
      const [termPart, langPart] = q.split('&langRestrict=');
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(termPart)}${
        langPart ? `&langRestrict=${langPart}` : ''
      }&maxResults=10`;

      const res = await fetchWithTimeout(url, 4500);
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.items || data.items.length === 0) continue;

      for (const item of data.items) {
        const info = item?.volumeInfo;
        if (!info) continue;

        // Se l'autore è specificato, verifichiamo che sia compatibile quando usiamo la query solo titolo
        if (cleanAuthor && !termPart.includes('inauthor:') && Array.isArray(info.authors)) {
          const authorWords = cleanAuthor.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
          const itemAuthors = info.authors.join(' ').toLowerCase();
          if (authorWords.length > 0 && !authorWords.some((w) => itemAuthors.includes(w))) {
            continue;
          }
        }

        const rawDesc = info.description ? cleanPlotText(info.description) : null;
        // Accetta la trama SOLO se è realmente in italiano
        const validItalianDesc = rawDesc && rawDesc.length > 30 && isItalianText(rawDesc) ? rawDesc : null;

        const publisher = info.publisher || null;
        const publishedDate = info.publishedDate ? String(info.publishedDate).slice(0, 4) : null;
        const categories = Array.isArray(info.categories)
          ? normalizeCategoriesToItalian(info.categories)
          : [];
        const pageCount = typeof info.pageCount === 'number' && info.pageCount > 0 ? info.pageCount : null;
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

        if (candidate.description) {
          return candidate;
        }
        if (!bestPartial && (candidate.publisher || candidate.publishedDate || candidate.categories.length > 0 || candidate.pageCount)) {
          bestPartial = candidate;
        }
      }
    } catch {
      // continua con la query successiva
    }
  }

  return bestPartial;
}

/**
 * Cerca trama e metadati su Apple Books Italia (accettando SOLO trame in lingua italiana)
 */
async function fetchDetailsFromAppleBooks(
  title: string,
  author?: string
): Promise<BookDetails | null> {
  const cleanTitle = sanitizeQuery(title);
  const cleanAuthor = author ? sanitizeQuery(author) : '';

  const searchTerms = [
    `${cleanTitle} ${cleanAuthor}`.trim(),
    cleanAuthor ? cleanTitle : '',
  ].filter(Boolean);

  for (const term of searchTerms) {
    try {
      const query = encodeURIComponent(term);
      const url = `https://itunes.apple.com/search?term=${query}&entity=ebook&country=IT&lang=it_it&limit=10`;

      const res = await fetchWithTimeout(url, 4500);
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.results || data.results.length === 0) continue;

      for (const item of data.results) {
        if (cleanAuthor && item.artistName) {
          const authorWords = cleanAuthor.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
          const artistLower = String(item.artistName).toLowerCase();
          if (authorWords.length > 0 && !authorWords.some((w) => artistLower.includes(w))) {
            continue;
          }
        }

        const desc = item.description ? cleanPlotText(item.description) : null;
        if (!desc || desc.length <= 30 || !isItalianText(desc)) {
          continue;
        }

        const genres = Array.isArray(item.genres)
          ? normalizeCategoriesToItalian(item.genres)
          : [];
        const releaseYear = item.releaseDate ? String(item.releaseDate).slice(0, 4) : null;

        return {
          description: desc,
          publisher: item.sellerName || null,
          publishedDate: releaseYear,
          categories: genres,
          pageCount: null,
          isbn: null,
          subtitle: null,
          source: 'Apple Books',
        };
      }
    } catch {
      // continua
    }
  }

  return null;
}

/**
 * Cerca la sinossi/trama in italiano su Wikipedia Italia (ottimo per classici e romanzi celebri)
 */
async function fetchDetailsFromWikipediaIt(
  title: string,
  author?: string
): Promise<BookDetails | null> {
  try {
    const cleanTitle = sanitizeQuery(title);
    const cleanAuthor = author ? sanitizeQuery(author) : '';
    const searchQuery = encodeURIComponent(`${cleanTitle} ${cleanAuthor} romanzo libro`.trim());
    const url = `https://it.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&explaintext=1&exintro=0&exchars=2500&generator=search&gsrsearch=${searchQuery}&gsrlimit=3`;

    const res = await fetchWithTimeout(url, 4500);
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const pageList = Object.values(pages) as any[];
    pageList.sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

    for (const page of pageList) {
      const pageTitle = String(page.title || '').toLowerCase();
      const extract = String(page.extract || '').trim();
      if (!extract || extract.length < 60) continue;

      // Verifica che la pagina sia pertinente al titolo o all'autore
      const titleWords = cleanTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      const isTitleMatch =
        titleWords.length === 0 || titleWords.some((w) => pageTitle.includes(w) || extract.toLowerCase().includes(w));
      if (!isTitleMatch) continue;

      // Se l'articolo contiene una sezione "== Trama ==", estraiamola insieme all'incipit
      let plotText = extract;
      const tramaMatch = extract.match(/==\s*Trama\s*==\s*([\s\S]*?)(?:==|$)/i);
      if (tramaMatch && tramaMatch[1] && tramaMatch[1].trim().length > 50) {
        const intro = extract.split(/==/)[0]?.trim() || '';
        const tramaSection = tramaMatch[1].trim();
        plotText = intro ? `${intro}\n\n${tramaSection}` : tramaSection;
      } else {
        // Altrimenti usa l'introduzione dell'articolo (prima delle sezioni secondarie)
        plotText = extract.split(/==/)[0]?.trim() || extract;
      }

      plotText = cleanPlotText(plotText);
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
  } catch {
    return null;
  }
}

/**
 * Fallback su Open Library (accettando SOLO trame in lingua italiana)
 */
async function fetchDetailsFromOpenLibrary(
  title: string,
  author?: string
): Promise<BookDetails | null> {
  try {
    const cleanTitle = sanitizeQuery(title);
    const cleanAuthor = author ? sanitizeQuery(author) : '';
    const query = encodeURIComponent(`${cleanTitle} ${cleanAuthor}`.trim());
    const searchUrl = `https://openlibrary.org/search.json?q=${query}&limit=3`;

    const res = await fetchWithTimeout(searchUrl, 4500);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.docs || data.docs.length === 0) return null;

    const doc = data.docs[0];
    let description: string | null = null;

    if (doc.key) {
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
          if (rawDesc && isItalianText(rawDesc)) {
            description = rawDesc;
          }
        }
      } catch {
        // ignore work fetch error
      }
    }

    return {
      description: description && description.length > 30 ? description : null,
      publisher: Array.isArray(doc.publisher) && doc.publisher.length > 0 ? doc.publisher[0] : null,
      publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : null,
      categories: Array.isArray(doc.subject) ? normalizeCategoriesToItalian(doc.subject) : [],
      pageCount: doc.number_of_pages_median || null,
      isbn: Array.isArray(doc.isbn) && doc.isbn.length > 0 ? doc.isbn[0] : null,
      subtitle: doc.subtitle && isItalianText(doc.subtitle) ? doc.subtitle : null,
      source: 'Open Library',
    };
  } catch {
    return null;
  }
}

/**
 * Recupera la scheda completa del libro rigorosamente in italiano (trama, editore, anno, generi, ISBN)
 * interrogando in cascata Google Books IT, Apple Books IT, Wikipedia Italia e Open Library.
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
    if (detailsCache.has(cacheKey)) {
      return detailsCache.get(cacheKey)!;
    }
    const stored = loadStoredDetailsCache();
    if (stored[cacheKey] && stored[cacheKey].description && isItalianText(stored[cacheKey].description)) {
      detailsCache.set(cacheKey, stored[cacheKey]);
      return stored[cacheKey];
    }
  }

  // 1. Eseguiamo in parallelo Google Books IT e Apple Books IT (entrambi filtrati solo per lingua italiana)
  const [googleRes, appleRes] = await Promise.allSettled([
    fetchDetailsFromGoogleBooks(trimmedTitle, trimmedAuthor),
    fetchDetailsFromAppleBooks(trimmedTitle, trimmedAuthor),
  ]);

  const google = googleRes.status === 'fulfilled' ? googleRes.value : null;
  const apple = appleRes.status === 'fulfilled' ? appleRes.value : null;

  // Scegliamo la trama italiana più completa e dettagliata
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

  let merged: BookDetails = {
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
    source: bestSource || google?.source || apple?.source || null,
  };

  // 2. Se né Google Books né Apple Books avevano la trama in italiano, cerchiamo su Wikipedia Italia e Open Library
  if (!merged.description) {
    const [wikiRes, openLibRes] = await Promise.allSettled([
      fetchDetailsFromWikipediaIt(trimmedTitle, trimmedAuthor),
      fetchDetailsFromOpenLibrary(trimmedTitle, trimmedAuthor),
    ]);

    const wiki = wikiRes.status === 'fulfilled' ? wikiRes.value : null;
    const openLib = openLibRes.status === 'fulfilled' ? openLibRes.value : null;

    if (wiki?.description) {
      merged.description = wiki.description;
      merged.source = 'Wikipedia IT';
    } else if (openLib?.description) {
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

  detailsCache.set(cacheKey, merged);
  if (merged.description || merged.publisher || merged.publishedDate) {
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
