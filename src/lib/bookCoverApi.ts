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
