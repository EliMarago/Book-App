import { supabase } from '@/lib/supabase';

export function getStoredDates(): Record<string, string> {
  try {
    const data = localStorage.getItem('books_read_at');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveBookDate(bookId: string, readAt: string | null) {
  try {
    const dates = getStoredDates();
    if (readAt) {
      dates[bookId] = readAt;
    } else {
      delete dates[bookId];
    }
    localStorage.setItem('books_read_at', JSON.stringify(dates));
  } catch (e) {
    console.error('Errore nel salvataggio della data in localStorage:', e);
  }
}

export function removeBookDate(bookId: string) {
  saveBookDate(bookId, null);
}

export async function syncBookDateToSupabase(bookId: string, readAt: string | null) {
  saveBookDate(bookId, readAt);
  try {
    // Rimuoviamo eventuali note di sistema precedenti per questo libro
    await supabase
      .from('notes')
      .delete()
      .eq('book_id', bookId)
      .like('content', '__READ_AT__:%');

    if (readAt) {
      // Inseriamo la nuova data come nota di sistema in Supabase
      await supabase.from('notes').insert({
        book_id: bookId,
        content: `__READ_AT__:${readAt}`,
      });
    }
  } catch (err) {
    console.error('Errore nel sincronizzare la data su Supabase:', err);
  }
}

export async function fetchNotesMetadataFromSupabase(): Promise<{
  dates: Record<string, string>;
  counts: Record<string, number>;
}> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('book_id, content');

    if (error || !data) {
      return { dates: {}, counts: {} };
    }

    const dates: Record<string, string> = {};
    const counts: Record<string, number> = {};

    for (const item of data) {
      if (item.content.startsWith('__READ_AT__:')) {
        dates[item.book_id] = item.content.replace('__READ_AT__:', '');
      } else {
        counts[item.book_id] = (counts[item.book_id] || 0) + 1;
      }
    }

    return { dates, counts };
  } catch (err) {
    console.error('Errore nel recupero note e date da Supabase:', err);
    return { dates: {}, counts: {} };
  }
}

export async function fetchDatesFromSupabase(): Promise<Record<string, string>> {
  const meta = await fetchNotesMetadataFromSupabase();
  return meta.dates;
}

