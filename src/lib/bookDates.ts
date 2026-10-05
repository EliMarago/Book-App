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

export async function fetchDatesFromSupabase(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase
      .from('notes')
      .select('book_id, content')
      .like('content', '__READ_AT__:%');

    const result: Record<string, string> = {};
    if (data) {
      for (const item of data) {
        const dateStr = item.content.replace('__READ_AT__:', '');
        result[item.book_id] = dateStr;
      }
    }
    return result;
  } catch {
    return {};
  }
}
