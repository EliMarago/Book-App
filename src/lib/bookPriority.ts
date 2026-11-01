import { supabase, type Book } from '@/lib/supabase';

const STORAGE_KEY = 'books_want_priority';

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

