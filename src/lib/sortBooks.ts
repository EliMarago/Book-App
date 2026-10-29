import type { Book } from '@/lib/supabase';

export type SortKey = 'recent' | 'oldest' | 'title' | 'author' | 'rating';

export const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'recent', label: 'Più recenti' },
  { value: 'oldest', label: 'Meno recenti' },
  { value: 'title', label: 'Titolo (A-Z)' },
  { value: 'author', label: 'Autore (A-Z)' },
  { value: 'rating', label: 'Voto più alto' },
];

const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

function dateValue(b: Book) {
  const d = new Date(b.read_at || b.created_at).getTime();
  return isNaN(d) ? 0 : d;
}

export function sortBooks(books: Book[], key: SortKey): Book[] {
  const list = [...books];
  switch (key) {
    case 'oldest':
      return list.sort((a, b) => dateValue(a) - dateValue(b));
    case 'title':
      return list.sort((a, b) => collator.compare(a.title, b.title));
    case 'author':
      return list.sort(
        (a, b) => collator.compare(a.author, b.author) || collator.compare(a.title, b.title)
      );
    case 'rating':
      return list.sort(
        (a, b) => b.rating - a.rating || collator.compare(a.title, b.title)
      );
    case 'recent':
    default:
      return list.sort((a, b) => dateValue(b) - dateValue(a));
  }
}

const STORAGE_KEY = 'books_sort_key';

export function getStoredSort(): SortKey {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as SortKey | null;
    return v && SORT_OPTIONS.some((o) => o.value === v) ? v : 'recent';
  } catch {
    return 'recent';
  }
}

export function storeSort(key: SortKey) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* ignore */
  }
}
