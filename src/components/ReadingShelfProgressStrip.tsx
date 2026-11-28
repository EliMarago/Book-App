import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Flame,
  Loader2,
  Pencil,
  X,
} from 'lucide-react';
import { supabase, type Book } from '@/lib/supabase';
import {
  markLocalMutation,
  saveBookPages,
  saveBookReadPages,
  syncBookDateToSupabase,
  syncBookPagesToSupabase,
  syncBookReadPagesToSupabase,
} from '@/lib/bookDates';
import { FinishBookDialog } from './FinishBookDialog';
import { useToast } from './Toast';

interface ReadingShelfProgressStripProps {
  books: Book[];
  isAlwaysDarkWall: boolean;
  hasHangingLights: boolean;
  shelfStyle: 'mixed' | 'spines' | 'covers';
  onUpdateBook: (book: Book) => void;
}

const QUICK_PAGE_STEPS = [10, 25, 50] as const;
const QUICK_SYNC_DEBOUNCE_MS = 550;

export function ReadingShelfProgressStrip({
  books,
  isAlwaysDarkWall,
  hasHangingLights,
  shelfStyle,
  onUpdateBook,
}: ReadingShelfProgressStripProps) {
  const { toast } = useToast();

  // Espande di default solo il primo libro in lettura, lasciando gli altri su una riga sottile
  const [expandedBookId, setExpandedBookId] = useState<string | null>(() => books[0]?.id ?? null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState('');
  const [totalPagesInput, setTotalPagesInput] = useState('');
  const [savingBookId, setSavingBookId] = useState<string | null>(null);
  const [finishingBook, setFinishingBook] = useState<Book | null>(null);

  // Se il libro espanso viene completato/rimosso e restano altri libri in lettura, passa al primo disponibile
  useEffect(() => {
    if (books.length === 0) {
      setExpandedBookId(null);
      return;
    }
    if (expandedBookId !== null && !books.some((b) => b.id === expandedBookId)) {
      setExpandedBookId(books[0]?.id ?? null);
    }
  }, [books, expandedBookId]);

  // Coalesce tocchi rapidi (+10 / +25 / +50) in un'unica scrittura su Supabase,
  // aggiornando però istantaneamente (0ms) la UI e la cache locale.
  const pendingQuickSyncRef = useRef<
    Record<string, { timer: ReturnType<typeof setTimeout>; book: Book; nextPages: number }>
  >({});

  const flushPendingQuickSync = async (bookId: string) => {
    const entry = pendingQuickSyncRef.current[bookId];
    if (!entry) return;
    clearTimeout(entry.timer);
    delete pendingQuickSyncRef.current[bookId];

    const now = new Date().toISOString();
    try {
      await supabase
        .from('books')
        .update({ read_pages: entry.nextPages, updated_at: now })
        .eq('id', entry.book.id);
      await syncBookReadPagesToSupabase(entry.book.id, entry.nextPages);
    } catch (err) {
      console.error('Errore salvataggio rapido pagine:', err);
    }
  };

  useEffect(() => {
    const flushAll = () => {
      for (const id of Object.keys(pendingQuickSyncRef.current)) {
        void flushPendingQuickSync(id);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushAll();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      flushAll();
    };
  }, []);

  const openEditor = (book: Book) => {
    setExpandedBookId(book.id);
    setEditingBookId(book.id);
    setPageInput(book.read_pages && book.read_pages > 0 ? String(book.read_pages) : '');
    setTotalPagesInput(book.pages && book.pages > 0 ? String(book.pages) : '');
  };

  const closeEditor = () => {
    setEditingBookId(null);
    setPageInput('');
    setTotalPagesInput('');
  };

  const toggleRow = (bookId: string) => {
    if (expandedBookId === bookId) {
      setExpandedBookId(null);
      if (editingBookId === bookId) closeEditor();
    } else {
      setExpandedBookId(bookId);
      if (editingBookId && editingBookId !== bookId) closeEditor();
    }
  };

  const handleQuickAdd = (book: Book, delta: number) => {
    const current = Math.max(0, book.read_pages ?? 0);
    const maxPages = book.pages && book.pages > 0 ? book.pages : Infinity;
    const nextPages = Math.min(maxPages, current + delta);
    if (nextPages === current) return;

    const now = new Date().toISOString();
    markLocalMutation();
    saveBookReadPages(book.id, nextPages);

    const optimisticBook: Book = {
      ...book,
      read_pages: nextPages,
      updated_at: now,
    };
    onUpdateBook(optimisticBook);

    const existing = pendingQuickSyncRef.current[book.id];
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(() => {
      void flushPendingQuickSync(book.id);
    }, QUICK_SYNC_DEBOUNCE_MS);

    pendingQuickSyncRef.current[book.id] = {
      timer,
      book: optimisticBook,
      nextPages,
    };

    if (Number.isFinite(maxPages) && nextPages >= maxPages) {
      toast({
        message: 'Ultima pagina raggiunta! Tocca "Finito" per completare il libro.',
        type: 'info',
      });
    }
  };

  const handleManualSave = async (book: Book) => {
    const existingPending = pendingQuickSyncRef.current[book.id];
    if (existingPending) {
      clearTimeout(existingPending.timer);
      delete pendingQuickSyncRef.current[book.id];
    }

    const parsedRead = pageInput.trim() ? parseInt(pageInput.trim(), 10) : 0;
    const rawRead = !Number.isNaN(parsedRead) && parsedRead >= 0 ? parsedRead : 0;

    let nextTotalPages: number | null = book.pages && book.pages > 0 ? book.pages : null;
    if (!nextTotalPages && totalPagesInput.trim()) {
      const parsedTotal = parseInt(totalPagesInput.trim(), 10);
      if (!Number.isNaN(parsedTotal) && parsedTotal > 0) {
        nextTotalPages = parsedTotal;
      }
    }

    const clampedRead =
      nextTotalPages && nextTotalPages > 0 ? Math.min(nextTotalPages, rawRead) : rawRead;

    setSavingBookId(book.id);
    const now = new Date().toISOString();
    markLocalMutation();
    saveBookReadPages(book.id, clampedRead);
    if (nextTotalPages && nextTotalPages !== book.pages) {
      saveBookPages(book.id, nextTotalPages);
    }

    const optimisticBook: Book = {
      ...book,
      read_pages: clampedRead,
      ...(nextTotalPages ? { pages: nextTotalPages } : {}),
      updated_at: now,
    };
    onUpdateBook(optimisticBook);
    closeEditor();

    try {
      const payload: Record<string, unknown> = {
        read_pages: clampedRead,
        updated_at: now,
      };
      if (nextTotalPages && nextTotalPages !== book.pages) {
        payload.pages = nextTotalPages;
      }

      const res = await supabase.from('books').update(payload).eq('id', book.id);
      if (res.error && payload.pages !== undefined) {
        await supabase
          .from('books')
          .update({ read_pages: clampedRead, updated_at: now })
          .eq('id', book.id);
      }

      await syncBookReadPagesToSupabase(book.id, clampedRead);
      if (nextTotalPages && nextTotalPages !== book.pages) {
        await syncBookPagesToSupabase(book.id, nextTotalPages);
      }
    } catch (err) {
      console.error('Errore salvataggio pagina letta:', err);
      toast({ message: 'Impossibile salvare la pagina. Riprova.', type: 'error' });
    } finally {
      setSavingBookId(null);
    }
  };

  const handleMarkAsFinished = async (book: Book, rating = 0) => {
    const existingPending = pendingQuickSyncRef.current[book.id];
    if (existingPending) {
      clearTimeout(existingPending.timer);
      delete pendingQuickSyncRef.current[book.id];
    }

    const readAtDate = new Date().toISOString();
    const finalPages = book.pages || book.read_pages || null;
    const existingStartedAt = book.started_at || book.created_at || null;

    await syncBookDateToSupabase(book.id, readAtDate);
    if (finalPages) {
      await syncBookReadPagesToSupabase(book.id, finalPages);
    }

    const updatePayload: Record<string, unknown> = {
      status: 'completed',
      read_at: readAtDate,
      updated_at: readAtDate,
    };
    if (finalPages) updatePayload.read_pages = finalPages;
    if (rating > 0) updatePayload.rating = rating;

    let res = await supabase
      .from('books')
      .update(updatePayload)
      .eq('id', book.id)
      .select()
      .single();

    if (
      res.error &&
      (res.error.message?.includes('read_pages') || res.error.message?.includes('pages'))
    ) {
      const { read_pages: _rp, ...fallback } = updatePayload;
      res = await supabase.from('books').update(fallback).eq('id', book.id).select().single();
    }

    onUpdateBook({
      ...book,
      ...(res.data ?? {}),
      status: 'completed',
      read_at: readAtDate,
      started_at: existingStartedAt,
      read_pages: finalPages,
      ...(rating > 0 ? { rating } : {}),
    });

    toast({ message: `Hai completato "${book.title}"!`, type: 'success' });
  };

  if (books.length === 0) return null;

  const topSpacingClass =
    hasHangingLights && shelfStyle !== 'covers' ? 'mt-4 sm:mt-5' : 'mt-2.5 sm:mt-3';

  const containerSurfaceClass = isAlwaysDarkWall
    ? 'bg-stone-950/80 border-amber-300/20 divide-amber-200/12 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6)]'
    : 'bg-stone-900/90 light:bg-amber-50/95 border-amber-500/25 light:border-amber-300/85 divide-amber-500/15 light:divide-amber-200/80 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.5)] light:shadow-[0_6px_18px_-6px_rgba(120,83,28,0.16)]';

  return (
    <>
      {finishingBook && (
        <FinishBookDialog
          book={finishingBook}
          onCancel={() => setFinishingBook(null)}
          onConfirm={async (rating) => {
            const target = finishingBook;
            setFinishingBook(null);
            await handleMarkAsFinished(target, rating);
          }}
        />
      )}

      <div
        className={`${topSpacingClass} mx-0.5 sm:mx-1 rounded-xl border divide-y overflow-hidden ${containerSurfaceClass}`}
      >
        {books.map((book) => {
          const isExpanded = expandedBookId === book.id;
          const isEditing = editingBookId === book.id;
          const isSaving = savingBookId === book.id;
          const currentPages = Math.max(0, book.read_pages ?? 0);
          const totalPages = book.pages && book.pages > 0 ? book.pages : null;

          const effectiveTotalForPreview = (() => {
            if (totalPages) return totalPages;
            if (isEditing && totalPagesInput.trim()) {
              const parsed = parseInt(totalPagesInput.trim(), 10);
              if (!Number.isNaN(parsed) && parsed > 0) return parsed;
            }
            return null;
          })();

          const effectiveReadForPreview = (() => {
            if (!isEditing) return currentPages;
            const parsed = pageInput.trim() ? parseInt(pageInput.trim(), 10) : 0;
            return !Number.isNaN(parsed) && parsed >= 0 ? parsed : 0;
          })();

          const percent =
            effectiveTotalForPreview && effectiveTotalForPreview > 0
              ? Math.min(
                  100,
                  Math.max(0, Math.round((effectiveReadForPreview / effectiveTotalForPreview) * 100))
                )
              : null;

          const barWidthPercent =
            effectiveTotalForPreview && effectiveTotalForPreview > 0
              ? Math.min(
                  100,
                  Math.max(0, (effectiveReadForPreview / effectiveTotalForPreview) * 100)
                )
              : 0;

          const rowHighlightClass = isExpanded
            ? isAlwaysDarkWall
              ? 'bg-amber-400/[0.06]'
              : 'bg-amber-400/[0.05] light:bg-amber-100/45'
            : isAlwaysDarkWall
              ? 'hover:bg-amber-400/[0.04]'
              : 'hover:bg-amber-400/[0.04] light:hover:bg-amber-100/35';

          return (
            <div
              key={book.id}
              className={`px-3 py-2 sm:px-3.5 sm:py-2.5 transition-colors ${rowHighlightClass}`}
            >
              {/* Riga sottile a colpo d'occhio: Titolo + barra avanzamento + pagine + % */}
              <button
                type="button"
                onClick={() => toggleRow(book.id)}
                aria-expanded={isExpanded}
                className="w-full flex items-center gap-2 sm:gap-2.5 text-left cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
              >
                <Flame
                  size={12.5}
                  className={
                    isAlwaysDarkWall
                      ? 'text-amber-400 shrink-0'
                      : 'text-amber-400 light:text-amber-600 shrink-0'
                  }
                />

                <span
                  className={`font-serif font-semibold text-xs sm:text-sm leading-snug truncate min-w-0 flex-1 sm:flex-initial sm:max-w-[38%] ${
                    isAlwaysDarkWall
                      ? 'text-amber-50'
                      : 'text-stone-100 light:text-stone-950'
                  }`}
                >
                  {book.title}
                </span>

                {/* Barra orizzontale compatta sempre visibile */}
                <div
                  className={`w-14 xs:w-20 sm:flex-1 h-1.5 rounded-full overflow-hidden shrink-0 sm:shrink ${
                    isAlwaysDarkWall
                      ? 'bg-black/55'
                      : 'bg-stone-950/70 light:bg-amber-950/15'
                  }`}
                >
                  {effectiveTotalForPreview !== null && (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 transition-[width] duration-300 ease-out"
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  )}
                </div>

                {/* Conteggio pagine compatto (da xs in su; sotto i 420px compare nel pulsante di modifica) */}
                {totalPages ? (
                  <span
                    className={`hidden xs:inline text-[11px] sm:text-xs tabular-nums shrink-0 ${
                      isAlwaysDarkWall
                        ? 'text-amber-200/80'
                        : 'text-amber-200/80 light:text-amber-950/80'
                    }`}
                  >
                    {effectiveReadForPreview}/{totalPages}
                  </span>
                ) : null}

                {/* Percentuale o pagina corrente */}
                <span
                  className={`text-xs font-bold tabular-nums shrink-0 min-w-[2.25rem] text-right ${
                    isAlwaysDarkWall
                      ? 'text-amber-300'
                      : 'text-amber-300 light:text-amber-900'
                  }`}
                >
                  {percent !== null
                    ? `${percent}%`
                    : currentPages > 0
                      ? `p.${currentPages}`
                      : '0%'}
                </span>

                <ChevronDown
                  size={14}
                  className={`shrink-0 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  } ${
                    isAlwaysDarkWall
                      ? 'text-amber-200/75'
                      : 'text-amber-200/75 light:text-amber-900/70'
                  }`}
                />
              </button>

              {/* Cassetto azioni rapide visibile solo sulla riga espansa */}
              {isExpanded && (
                <div
                  className={`mt-2 pt-2 border-t ${
                    isAlwaysDarkWall
                      ? 'border-amber-200/10'
                      : 'border-amber-200/10 light:border-amber-200/80'
                  }`}
                >
                  {isEditing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleManualSave(book);
                      }}
                      className="flex items-center justify-between gap-1.5 flex-wrap xs:flex-nowrap"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <label
                          htmlFor={`shelf-progress-page-${book.id}`}
                          className={`text-[11px] sm:text-xs font-medium shrink-0 ${
                            isAlwaysDarkWall
                              ? 'text-amber-200/90'
                              : 'text-amber-200/90 light:text-amber-950/85'
                          }`}
                        >
                          Pag.
                        </label>
                        <input
                          id={`shelf-progress-page-${book.id}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoFocus
                          value={pageInput}
                          onChange={(e) => setPageInput(e.target.value.replace(/\D+/g, ''))}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') closeEditor();
                          }}
                          placeholder="0"
                          className={`w-16 sm:w-20 px-2 py-1 rounded-lg border text-base sm:text-xs font-bold tabular-nums caret-amber-400 selection:bg-amber-400/30 focus:outline-none focus:ring-2 focus:ring-amber-400/75 ${
                            isAlwaysDarkWall
                              ? 'bg-stone-900 border-amber-400/60 text-amber-50 placeholder:text-amber-200/40'
                              : 'bg-stone-950 light:bg-white border-amber-400/70 light:border-amber-500 text-stone-100 light:text-stone-950 placeholder:text-stone-500 light:placeholder:text-amber-900/40 light:caret-amber-700'
                          }`}
                        />
                        {totalPages ? (
                          <span
                            className={`text-[11px] sm:text-xs font-medium tabular-nums truncate ${
                              isAlwaysDarkWall
                                ? 'text-amber-200/80'
                                : 'text-amber-200/80 light:text-amber-950/75'
                            }`}
                          >
                            / {totalPages}
                          </span>
                        ) : (
                          <>
                            <span
                              className={`text-[11px] sm:text-xs font-medium shrink-0 ${
                                isAlwaysDarkWall
                                  ? 'text-amber-200/75'
                                  : 'text-amber-200/75 light:text-amber-950/75'
                              }`}
                            >
                              /
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={totalPagesInput}
                              onChange={(e) =>
                                setTotalPagesInput(e.target.value.replace(/\D+/g, ''))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') closeEditor();
                              }}
                              placeholder="tot."
                              aria-label="Pagine totali del libro"
                              className={`w-16 sm:w-20 px-2 py-1 rounded-lg border text-base sm:text-xs font-semibold tabular-nums caret-amber-400 selection:bg-amber-400/30 focus:outline-none focus:ring-2 focus:ring-amber-400/75 ${
                                isAlwaysDarkWall
                                  ? 'bg-stone-900 border-amber-300/35 text-amber-50 placeholder:text-amber-200/45'
                                  : 'bg-stone-950 light:bg-white border-stone-700 light:border-amber-300 text-stone-100 light:text-stone-950 placeholder:text-stone-400 light:placeholder:text-amber-900/50 light:caret-amber-700'
                              }`}
                            />
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg btn-amber text-stone-950 font-semibold text-xs cursor-pointer active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                        >
                          {isSaving ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} className="stroke-[2.75]" />
                          )}
                          <span>Salva</span>
                        </button>
                        <button
                          type="button"
                          onClick={closeEditor}
                          aria-label="Annulla modifica"
                          title="Annulla"
                          className={`p-1 rounded-lg border cursor-pointer transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                            isAlwaysDarkWall
                              ? 'bg-stone-900/80 border-amber-200/20 text-amber-200 hover:text-amber-50'
                              : 'bg-stone-800/80 light:bg-white border-stone-700 light:border-amber-300 text-stone-300 light:text-amber-950 hover:text-stone-100 light:hover:bg-amber-100/70'
                          }`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                        {QUICK_PAGE_STEPS.map((step) => (
                          <button
                            key={step}
                            type="button"
                            onClick={() => handleQuickAdd(book, step)}
                            disabled={
                              isSaving || (totalPages !== null && currentPages >= totalPages)
                            }
                            title={`Aggiungi ${step} pagine lette`}
                            aria-label={`Aggiungi ${step} pagine lette`}
                            className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border text-[11px] sm:text-xs font-semibold tabular-nums transition-colors cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                              isAlwaysDarkWall
                                ? 'bg-amber-400/15 hover:bg-amber-400/25 border-amber-300/35 text-amber-200'
                                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/35 text-amber-200 light:bg-white light:hover:bg-amber-100/85 light:border-amber-300 light:text-amber-950'
                            }`}
                          >
                            +{step}
                            <span className="hidden sm:inline"> pag.</span>
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => openEditor(book)}
                          title="Inserisci numero esatto di pagina"
                          aria-label="Inserisci numero esatto di pagina"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg border text-[11px] sm:text-xs font-medium tabular-nums transition-colors cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                            isAlwaysDarkWall
                              ? 'bg-stone-900/75 hover:bg-stone-800 border-amber-200/20 text-amber-200/90'
                              : 'bg-stone-850 hover:bg-stone-800 light:bg-white light:hover:bg-amber-100/70 border-stone-700 light:border-amber-300 text-amber-200/90 light:text-amber-950'
                          }`}
                        >
                          <Pencil size={11} className="shrink-0 opacity-85" />
                          <span className="xs:hidden">
                            {totalPages ? `${currentPages}/${totalPages}` : 'Pag.'}
                          </span>
                          <span className="hidden xs:inline">Pag.</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setFinishingBook(book)}
                        title="Segna il libro come completato"
                        className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg border text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer active:scale-95 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                          isAlwaysDarkWall
                            ? 'bg-emerald-500/18 hover:bg-emerald-500/28 border-emerald-400/40 text-emerald-200'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/35 text-emerald-200 light:bg-emerald-100 light:hover:bg-emerald-200/80 light:border-emerald-300 light:text-emerald-950'
                        }`}
                      >
                        <CheckCircle2 size={12} className="shrink-0" />
                        <span>Finito</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
