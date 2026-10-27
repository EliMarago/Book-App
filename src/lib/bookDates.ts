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

export function getStoredPages(): Record<string, number> {
  try {
    const data = localStorage.getItem('books_pages');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveBookPages(bookId: string, pages: number | null) {
  try {
    const stored = getStoredPages();
    if (pages !== null && pages !== undefined && pages > 0) {
      stored[bookId] = pages;
    } else {
      delete stored[bookId];
    }
    localStorage.setItem('books_pages', JSON.stringify(stored));
  } catch (e) {
    console.error('Errore nel salvataggio delle pagine in localStorage:', e);
  }
}

export function removeBookPages(bookId: string) {
  saveBookPages(bookId, null);
}

export function getStoredReadPages(): Record<string, number> {
  try {
    const data = localStorage.getItem('books_read_pages');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveBookReadPages(bookId: string, readPages: number | null) {
  try {
    const stored = getStoredReadPages();
    if (readPages !== null && readPages !== undefined && readPages >= 0) {
      stored[bookId] = readPages;
    } else {
      delete stored[bookId];
    }
    localStorage.setItem('books_read_pages', JSON.stringify(stored));
  } catch (e) {
    console.error('Errore nel salvataggio delle pagine lette in localStorage:', e);
  }
}

export function removeBookReadPages(bookId: string) {
  saveBookReadPages(bookId, null);
}

export async function syncBookReadPagesToSupabase(bookId: string, readPages: number | null) {
  saveBookReadPages(bookId, readPages);
  try {
    await supabase
      .from('notes')
      .delete()
      .eq('book_id', bookId)
      .like('content', '__READ_PAGES__:%');

    if (readPages !== null && readPages !== undefined && readPages >= 0) {
      await supabase.from('notes').insert({
        book_id: bookId,
        content: `__READ_PAGES__:${readPages}`,
      });
    }
  } catch (err) {
    console.error('Errore nel sincronizzare le pagine lette su Supabase:', err);
  }
}

export async function syncBookPagesToSupabase(bookId: string, pages: number | null) {
  saveBookPages(bookId, pages);
  try {
    // Rimuoviamo eventuali note di sistema precedenti per le pagine di questo libro
    await supabase
      .from('notes')
      .delete()
      .eq('book_id', bookId)
      .like('content', '__PAGES__:%');

    if (pages !== null && pages !== undefined && pages > 0) {
      // Inseriamo il conteggio pagine come nota di sistema in Supabase per persistenza di backup
      await supabase.from('notes').insert({
        book_id: bookId,
        content: `__PAGES__:${pages}`,
      });
    }
  } catch (err) {
    console.error('Errore nel sincronizzare le pagine su Supabase:', err);
  }
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
  pages: Record<string, number>;
  readPages: Record<string, number>;
  counts: Record<string, number>;
}> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('book_id, content');

    if (error || !data) {
      return { dates: {}, pages: {}, readPages: {}, counts: {} };
    }

    const dates: Record<string, string> = {};
    const pages: Record<string, number> = {};
    const readPages: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const item of data) {
      if (item.content.startsWith('__READ_AT__:')) {
        dates[item.book_id] = item.content.replace('__READ_AT__:', '');
      } else if (item.content.startsWith('__PAGES__:')) {
        const p = parseInt(item.content.replace('__PAGES__:', ''), 10);
        if (!isNaN(p) && p > 0) {
          pages[item.book_id] = p;
        }
      } else if (item.content.startsWith('__READ_PAGES__:')) {
        const rp = parseInt(item.content.replace('__READ_PAGES__:', ''), 10);
        if (!isNaN(rp) && rp >= 0) {
          readPages[item.book_id] = rp;
        }
      } else {
        counts[item.book_id] = (counts[item.book_id] || 0) + 1;
      }
    }

    return { dates, pages, readPages, counts };
  } catch (err) {
    console.error('Errore nel recupero note, date e pagine da Supabase:', err);
    return { dates: {}, pages: {}, readPages: {}, counts: {} };
  }
}

export async function fetchDatesFromSupabase(): Promise<Record<string, string>> {
  const meta = await fetchNotesMetadataFromSupabase();
  return meta.dates;
}

