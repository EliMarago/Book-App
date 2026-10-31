import type { Book } from './supabase';

/**
 * Normalizza un testo rimuovendo accenti, caratteri speciali e punteggiatura
 */
export function normalizeSearchText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // rimuove accenti (è -> e, à -> a)
    .replace(/['’`´"-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stopwords comuni da escludere nel matching dei singoli token di ricerca
 */
const SEARCH_STOPWORDS = new Set([
  'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle',
  'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'a',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'l',
  'un', 'uno', 'una', 'un’',
  'e', 'ed', 'o', 'od',
  'by', 'the', 'of', 'and', 'to', 'in', 'on', 'at', 'with', 'from',
]);

/**
 * Rileva se una stringa è nel formato "Titolo del libro di Nome Autore" o "Titolo - Autore" o "Titolo by Autore"
 * e separa automaticamente titolo e autore.
 */
export function parseTitleAndAuthorQuery(input: string): { title: string; author: string } {
  if (!input) return { title: '', author: '' };
  const raw = input.trim();

  // Pattern comuni usati quando si incollano libri da social, store o liste
  const patterns: RegExp[] = [
    /\s+di\s+([A-ZÀ-ÖØ-öø-ÿ][\w\s.'’]+)$/i, // "Titolo di Nome Autore"
    /\s+by\s+([A-ZÀ-ÖØ-öø-ÿ][\w\s.'’]+)$/i, // "Title by Author"
    /\s+[-–—]\s+([A-ZÀ-ÖØ-öø-ÿ][\w\s.'’]+)$/i, // "Titolo - Autore"
    /\s+\/\s+([A-ZÀ-ÖØ-öø-ÿ][\w\s.'’]+)$/i, // "Titolo / Autore"
  ];

  for (const pat of patterns) {
    const match = raw.match(pat);
    if (match && match.index !== undefined && match[1]) {
      const author = match[1].trim();
      const title = raw.slice(0, match.index).trim();
      if (title.length >= 2 && author.length >= 2) {
        return { title, author };
      }
    }
  }

  return { title: raw, author: '' };
}

/**
 * Estrae sottotitoli e varianti dal titolo (es. per titoli compositi come "Felicità e altri disastri. If it makes you happy")
 */
export function getTitleSearchVariants(rawTitle: string): string[] {
  if (!rawTitle) return [];
  const clean = rawTitle.trim();
  const list: string[] = [clean];

  // Riconosce separatori frequenti: punto seguito da spazio, due punti, trattino, barra o parentesi
  const parts = clean
    .split(/[\.:\-\/|\(\)]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);

  for (const p of parts) {
    if (!list.some((existing) => existing.toLowerCase() === p.toLowerCase())) {
      list.push(p);
    }
  }

  return list;
}

/**
 * Verifica se un libro corrisponde a una query di ricerca globale.
 * Supporta:
 * - Ricerca per titolo completo o parziale
 * - Ricerca per autore completo o parziale
 * - Ricerche composte "Titolo di Autore" o "Autore Titolo"
 * - Ricerca multi-token (es. "Kiss candidate Bianca")
 * - Insensibile a maiuscole, minuscole, accenti e punteggiatura
 * - Ricerca anche su note, genere e trama
 */
export function matchesBookSearch(book: Book, rawQuery: string): boolean {
  if (!rawQuery || !rawQuery.trim()) return true;

  const qNorm = normalizeSearchText(rawQuery);
  if (!qNorm) return true;

  const titleNorm = normalizeSearchText(book.title);
  const authorNorm = normalizeSearchText(book.author);
  const plotNorm = normalizeSearchText(book.plot);

  // Testo combinato completo del libro
  const combined = `${titleNorm} ${authorNorm} ${plotNorm}`.trim();

  // 1. Corrispondenza sottostringa diretta sul testo combinato
  if (combined.includes(qNorm)) return true;

  // 2. Prova a separare la query se contiene pattern "di", "by", "-"
  const parsed = parseTitleAndAuthorQuery(rawQuery);
  if (parsed.author) {
    const pTitleNorm = normalizeSearchText(parsed.title);
    const pAuthorNorm = normalizeSearchText(parsed.author);
    const titleMatch = titleNorm.includes(pTitleNorm) || combined.includes(pTitleNorm);
    const authorMatch = authorNorm.includes(pAuthorNorm) || combined.includes(pAuthorNorm);
    if (titleMatch && authorMatch) return true;
  }

  // 3. Multi-token match: ogni parola significativa della query deve essere presente nel libro
  const tokens = qNorm
    .split(' ')
    .filter((w) => w.length >= 2 && !SEARCH_STOPWORDS.has(w));

  if (tokens.length === 0) {
    // Se la query conteneva solo stopwords o una lettera, controlla se appare come sottostringa
    return combined.includes(qNorm);
  }

  // Tutte le parole chiave cercate devono essere presenti nel libro
  return tokens.every((token) => combined.includes(token));
}
