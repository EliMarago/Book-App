import { supabase } from '@/lib/supabase';

// Traccia il timestamp dell'ultima modifica effettuata localmente da questo dispositivo
// per evitare che il canale Realtime ricarichi inutilmente tutta la libreria dopo un'azione locale.
let lastLocalMutationAt = 0;

export function markLocalMutation() {
  lastLocalMutationAt = Date.now();
}

export function isRecentLocalMutation(windowMs = 5000): boolean {
  return Date.now() - lastLocalMutationAt < windowMs;
}

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

export function getStoredPlots(): Record<string, string> {
  try {
    const data = localStorage.getItem('books_plots');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveBookPlot(bookId: string, plot: string | null) {
  try {
    const stored = getStoredPlots();
    if (plot && plot.trim()) {
      stored[bookId] = plot.trim();
    } else {
      delete stored[bookId];
    }
    localStorage.setItem('books_plots', JSON.stringify(stored));
  } catch (e) {
    console.error('Errore nel salvataggio della trama in localStorage:', e);
  }
}

export function removeBookPlot(bookId: string) {
  saveBookPlot(bookId, null);
}

export async function syncBookPlotToSupabase(bookId: string, plot: string | null) {
  markLocalMutation();
  saveBookPlot(bookId, plot);
  try {
    await supabase
      .from('notes')
      .delete()
      .eq('book_id', bookId)
      .like('content', '__PLOT__:%');

    if (plot && plot.trim()) {
      markLocalMutation();
      await supabase.from('notes').insert({
        book_id: bookId,
        content: `__PLOT__:${plot.trim()}`,
      });
    }
  } catch (err) {
    console.error('Errore nel sincronizzare la trama su Supabase:', err);
  }
}

export function getStoredTags(): Record<string, string[]> {
  try {
    const data = localStorage.getItem('books_tags');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveBookTags(bookId: string, tags: string[] | null) {
  try {
    const stored = getStoredTags();
    if (tags && tags.length > 0) {
      stored[bookId] = tags;
    } else {
      delete stored[bookId];
    }
    localStorage.setItem('books_tags', JSON.stringify(stored));
  } catch (e) {
    console.error('Errore nel salvataggio dei tag in localStorage:', e);
  }
}

export async function syncBookTagsToSupabase(bookId: string, tags: string[] | null) {
  markLocalMutation();
  saveBookTags(bookId, tags);
  try {
    await supabase
      .from('notes')
      .delete()
      .eq('book_id', bookId)
      .like('content', '__TAGS__:%');

    if (tags && tags.length > 0) {
      markLocalMutation();
      await supabase.from('notes').insert({
        book_id: bookId,
        content: `__TAGS__:${JSON.stringify(tags)}`,
      });
    }
  } catch (err) {
    console.error('Errore nel sincronizzare i tag su Supabase:', err);
  }
}

export async function syncBookReadPagesToSupabase(bookId: string, readPages: number | null) {
  markLocalMutation();
  saveBookReadPages(bookId, readPages);
  try {
    await supabase
      .from('notes')
      .delete()
      .eq('book_id', bookId)
      .like('content', '__READ_PAGES__:%');

    if (readPages !== null && readPages !== undefined && readPages >= 0) {
      markLocalMutation();
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
  markLocalMutation();
  saveBookPages(bookId, pages);
  try {
    // Rimuoviamo eventuali note di sistema precedenti per le pagine di questo libro
    await supabase
      .from('notes')
      .delete()
      .eq('book_id', bookId)
      .like('content', '__PAGES__:%');

    if (pages !== null && pages !== undefined && pages > 0) {
      markLocalMutation();
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
  markLocalMutation();
  saveBookDate(bookId, readAt);
  try {
    // Rimuoviamo eventuali note di sistema precedenti per questo libro
    await supabase
      .from('notes')
      .delete()
      .eq('book_id', bookId)
      .like('content', '__READ_AT__:%');

    if (readAt) {
      markLocalMutation();
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
  startedDates: Record<string, string>;
  pages: Record<string, number>;
  readPages: Record<string, number>;
  plots: Record<string, string>;
  tags: Record<string, string[]>;
  counts: Record<string, number>;
}> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('book_id, content');

    if (error || !data) {
      return { dates: {}, startedDates: {}, pages: {}, readPages: {}, plots: {}, tags: {}, counts: {} };
    }

    const dates: Record<string, string> = {};
    const startedDates: Record<string, string> = {};
    const pages: Record<string, number> = {};
    const readPages: Record<string, number> = {};
    const plots: Record<string, string> = {};
    const tags: Record<string, string[]> = {};
    const counts: Record<string, number> = {};

    for (const item of data) {
      if (item.content.startsWith('__READ_AT__:')) {
        dates[item.book_id] = item.content.replace('__READ_AT__:', '');
      } else if (item.content.startsWith('__STARTED_AT__:')) {
        startedDates[item.book_id] = item.content.replace('__STARTED_AT__:', '');
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
      } else if (item.content.startsWith('__PLOT__:')) {
        plots[item.book_id] = item.content.replace('__PLOT__:', '');
      } else if (item.content.startsWith('__TAGS__:')) {
        try {
          const parsed = JSON.parse(item.content.replace('__TAGS__:', ''));
          if (Array.isArray(parsed)) tags[item.book_id] = parsed.map(String);
        } catch {
          // ignora tag malformati
        }
      } else {
        counts[item.book_id] = (counts[item.book_id] || 0) + 1;
      }
    }

    return { dates, startedDates, pages, readPages, plots, tags, counts };
  } catch (err) {
    console.error('Errore nel recupero note, date e pagine da Supabase:', err);
    return { dates: {}, startedDates: {}, pages: {}, readPages: {}, plots: {}, tags: {}, counts: {} };
  }
}

export function getStoredStartedReadingDates(): Record<string, string> {
  try {
    const data = localStorage.getItem('books_started_reading_at');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveBookStartedReadingDate(bookId: string, startedAt: string | null) {
  try {
    const dates = getStoredStartedReadingDates();
    if (startedAt) {
      dates[bookId] = startedAt;
    } else {
      delete dates[bookId];
    }
    localStorage.setItem('books_started_reading_at', JSON.stringify(dates));
  } catch (e) {
    console.error('Errore nel salvataggio della data di inizio lettura in localStorage:', e);
  }
}

export function removeBookStartedReadingDate(bookId: string) {
  saveBookStartedReadingDate(bookId, null);
}

export async function syncBookStartedReadingToSupabase(bookId: string, startedAt: string | null) {
  markLocalMutation();
  saveBookStartedReadingDate(bookId, startedAt);
  try {
    await supabase
      .from('notes')
      .delete()
      .eq('book_id', bookId)
      .like('content', '__STARTED_AT__:%');

    if (startedAt) {
      markLocalMutation();
      await supabase.from('notes').insert({
        book_id: bookId,
        content: `__STARTED_AT__:${startedAt}`,
      });
    }
  } catch (err) {
    console.error('Errore nel sincronizzare la data di inizio lettura su Supabase:', err);
  }
}

/**
 * Calcola da quanto tempo un libro è in lettura (giorni, settimane, mesi, anni)
 * Formatta in italiano naturale:
 * - diffDays = 0: "Iniziato oggi"
 * - diffDays = 1: "In lettura da 1 giorno" (short: "da 1 giorno")
 * - diffDays < 30: "In lettura da X giorni" (short: "da X giorni")
 * - Mesi: "In lettura da 1 mese e X giorni" (short: "da 1 mese e X gg")
 */
export function formatReadingDuration(
  startedDate: string | Date | null | undefined,
  options?: { short?: boolean }
): string | null {
  if (!startedDate) return null;
  const start = new Date(startedDate);
  if (isNaN(start.getTime())) return null;

  const now = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = today.getTime() - startDay.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  const isShort = options?.short ?? false;

  if (diffDays === 0) {
    return 'Iniziato oggi';
  }

  if (diffDays === 1) {
    return isShort ? 'da 1 giorno' : 'In lettura da 1 giorno';
  }

  if (diffDays < 30) {
    return isShort ? `da ${diffDays} giorni` : `In lettura da ${diffDays} giorni`;
  }

  if (diffDays < 60) {
    const remDays = diffDays - 30;
    if (remDays === 0) {
      return isShort ? 'da 1 mese' : 'In lettura da 1 mese';
    }
    const remStr = remDays === 1 ? '1 giorno' : `${remDays} ${isShort ? 'gg' : 'giorni'}`;
    return isShort ? `da 1 mese e ${remStr}` : `In lettura da 1 mese e ${remStr}`;
  }

  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    const remDays = diffDays % 30;
    if (remDays === 0) {
      return isShort ? `da ${months} mesi` : `In lettura da ${months} mesi`;
    }
    const remStr = remDays === 1 ? '1 giorno' : `${remDays} ${isShort ? 'gg' : 'giorni'}`;
    return isShort ? `da ${months} mesi e ${remStr}` : `In lettura da ${months} mesi e ${remStr}`;
  }

  const years = Math.floor(diffDays / 365);
  if (years === 1) {
    return isShort ? 'da oltre 1 anno' : 'In lettura da oltre 1 anno';
  }
  return isShort ? `da oltre ${years} anni` : `In lettura da oltre ${years} anni`;
}

export function formatReadingStartDate(startedDate: string | Date | null | undefined): string | null {
  if (!startedDate) return null;
  const d = new Date(startedDate);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export async function fetchDatesFromSupabase(): Promise<Record<string, string>> {
  const meta = await fetchNotesMetadataFromSupabase();
  return meta.dates;
}

