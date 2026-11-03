import { supabase, type Book } from '@/lib/supabase';

const STORAGE_KEY = 'books_want_priority';
const BEST_STORAGE_KEY = 'books_best_order';

/**
 * Recupera l'ordine personalizzato della classifica dei migliori libri letti da localStorage.
 */
export function getStoredBestBooksOrder(): string[] {
  try {
    const raw = localStorage.getItem(BEST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Salva l'ordine della classifica dei migliori libri letti in localStorage.
 */
export function saveStoredBestBooksOrder(order: string[]): void {
  try {
    localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify(order));
  } catch (e) {
    console.error('Errore nel salvataggio della classifica dei migliori libri in localStorage:', e);
  }
}

/**
 * Sincronizza l'ordine della classifica dei migliori libri su Supabase nei metadati dell'utente.
 */
export async function syncBestBooksOrderToSupabase(order: string[]): Promise<void> {
  try {
    const { error } = await supabase.auth.updateUser({
      data: { best_books_order: order },
    });
    if (error) {
      console.warn('Errore salvataggio classifica su Supabase:', error);
    }
  } catch (e) {
    console.warn('Eccezione durante sync classifica su Supabase:', e);
  }
}

/**
 * Ordina i libri letti per la classifica d'onore dei "Migliori Libri Letti".
 * I libri presenti nell'array bestOrder mantengono esattamente la posizione scelta dall'utente.
 * Per i libri non ancora ordinati manualmente:
 * - Vengono inclusi i libri con valutazione >= 4 (o tutti i libri letti se non ce ne sono con >= 4),
 *   ordinati in ordine decrescente di rating (5 stelle prima, poi 4) e data di lettura più recente.
 */
export function orderBestBooks(completedBooks: Book[], bestOrder: string[]): Book[] {
  if (!completedBooks || completedBooks.length === 0) return [];

  const completedMap = new Map<string, Book>();
  completedBooks.forEach((b) => completedMap.set(b.id, b));

  const result: Book[] = [];
  const addedIds = new Set<string>();

  // 1. Aggiungi i libri secondo l'ordine personalizzato memorizzato
  if (Array.isArray(bestOrder)) {
    bestOrder.forEach((id) => {
      const book = completedMap.get(id);
      if (book && !addedIds.has(id)) {
        result.push(book);
        addedIds.add(id);
      }
    });
  }

  // 2. Tra i rimanenti, prendi i libri con rating >= 4 (o tutti se nessuno ha rating >= 4)
  const remaining = completedBooks.filter((b) => !addedIds.has(b.id));
  const highRated = remaining.filter((b) => (b.rating || 0) >= 4);
  const candidates = highRated.length > 0 ? highRated : remaining;

  candidates.sort((a, b) => {
    // Rating più alto prima
    const ratingDiff = (b.rating || 0) - (a.rating || 0);
    if (ratingDiff !== 0) return ratingDiff;

    // Data di lettura più recente
    const dateA = a.read_at ? new Date(a.read_at).getTime() : 0;
    const dateB = b.read_at ? new Date(b.read_at).getTime() : 0;
    return dateB - dateA;
  });

  candidates.forEach((b) => {
    if (!addedIds.has(b.id)) {
      result.push(b);
      addedIds.add(b.id);
    }
  });

  return result;
}

/**
 * Recupera l'ordine di priorità dei libri da leggere salvato in localStorage.
 * Restituisce un array ordinato di ID dei libri: il primo ID ha priorità #1.
 */
export function getStoredWantPriority(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Salva l'ordine di priorità dei libri da leggere in localStorage.
 */
export function saveStoredWantPriority(order: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch (e) {
    console.error('Errore nel salvataggio della priorità in localStorage:', e);
  }
}

/**
 * Sincronizza l'ordine di priorità su Supabase nei metadati dell'utente
 * (come reading_goals, senza richiedere modifiche alla tabella books).
 */
export async function syncWantPriorityToSupabase(order: string[]): Promise<void> {
  try {
    const { error } = await supabase.auth.updateUser({
      data: { want_priority: order },
    });
    if (error) {
      console.warn('Errore salvataggio priorità su Supabase:', error);
    }
  } catch (e) {
    console.warn('Eccezione durante sync priorità su Supabase:', e);
  }
}

/**
 * Ordina una lista di libri "Da leggere" secondo l'ordine di priorità salvato.
 * I libri presenti nell'array di priorità mantengono esattamente la posizione specificata.
 * Eventuali nuovi libri non ancora ordinati vengono posizionati in coda.
 */
export function orderWantBooks(books: Book[], priorityOrder: string[]): Book[] {
  if (!books || books.length === 0) return [];
  if (!priorityOrder || priorityOrder.length === 0) return [...books];

  const indexMap = new Map<string, number>();
  priorityOrder.forEach((id, idx) => {
    indexMap.set(id, idx);
  });

  return [...books].sort((a, b) => {
    const rankA = indexMap.has(a.id) ? indexMap.get(a.id)! : 999999;
    const rankB = indexMap.has(b.id) ? indexMap.get(b.id)! : 999999;
    if (rankA !== rankB) return rankA - rankB;

    // A parità di rango (libri nuovi), ordina per data di creazione più recente
    const dateA = new Date(a.created_at).getTime() || 0;
    const dateB = new Date(b.created_at).getTime() || 0;
    return dateB - dateA;
  });
}

/**
 * Sposta un libro prima o dopo un altro libro di destinazione (usato per Drag & Drop).
 */
export function reorderBookIds(
  currentOrderedBooksOrIds: (Book | string)[],
  sourceId: string,
  targetId: string
): string[] {
  const currentIds = currentOrderedBooksOrIds.map((item) =>
    typeof item === 'string' ? item : item.id
  );
  const fromIdx = currentIds.indexOf(sourceId);
  const toIdx = currentIds.indexOf(targetId);

  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
    return currentIds;
  }

  const next = [...currentIds];
  const [movedId] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, movedId);
  return next;
}

/**
 * Sposta la priorità di un libro di una posizione a sinistra/destra o in cima (per controlli touch/mobile).
 */
export function shiftBookPosition(
  currentOrderedBooksOrIds: (Book | string)[],
  bookId: string,
  direction: 'left' | 'right' | 'first' | 'last'
): string[] {
  const currentIds = currentOrderedBooksOrIds.map((item) =>
    typeof item === 'string' ? item : item.id
  );
  const index = currentIds.indexOf(bookId);

  if (index === -1) return currentIds;

  const next = [...currentIds];
  if (direction === 'left' && index > 0) {
    const [item] = next.splice(index, 1);
    next.splice(index - 1, 0, item);
  } else if (direction === 'right' && index < next.length - 1) {
    const [item] = next.splice(index, 1);
    next.splice(index + 1, 0, item);
  } else if (direction === 'first' && index > 0) {
    const [item] = next.splice(index, 1);
    next.unshift(item);
  } else if (direction === 'last' && index < next.length - 1) {
    const [item] = next.splice(index, 1);
    next.push(item);
  }

  return next;
}

