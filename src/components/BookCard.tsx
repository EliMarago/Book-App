import { useEffect, useState } from 'react';
import {
  Trash2,
  Loader2,
  StickyNote,
  BookMarked,
  BookOpen,
  Pencil,
  ImageOff,
  Calendar,
  Flame,
  Sparkles,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import type { Book, Note } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { syncBookDateToSupabase, syncBookReadPagesToSupabase } from '@/lib/bookDates';
import { fetchBookCover } from '@/lib/bookCoverApi';
import { StarRating } from './StarRating';
import { useToast } from './Toast';
import { BookNotesModal } from './BookNotesModal';

const STATUS_COLORS: Record<Book['status'], string> = {
  reading: 'bg-amber-500/15 light:bg-amber-50 text-amber-400 light:text-amber-800 border-amber-500/30 light:border-amber-300',
  completed: 'bg-emerald-500/15 light:bg-emerald-50 text-emerald-400 light:text-emerald-800 border-emerald-500/30 light:border-emerald-300',
  want: 'bg-sky-500/15 light:bg-sky-50 text-sky-400 light:text-sky-800 border-sky-500/30 light:border-amber-300',
};

export function BookCard({
  book,
  onUpdate,
  onDelete,
  onEdit,
  onInspect,
  highlight = false,
}: {
  book: Book;
  onUpdate: (book: Book) => void;
  onDelete: (id: string) => void;
  onEdit: (book: Book) => void;
  onInspect?: (book: Book) => void;
  highlight?: boolean;
}) {
  const { toast } = useToast();
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes] = useState<Note[] | null>(null);
  const [notesCount, setNotesCount] = useState<number>(book.notes_count ?? 0);
  const [autoFetchingCover, setAutoFetchingCover] = useState(false);

  // Stato per l'aggiornamento rapido dell'avanzamento pagine
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressInput, setProgressInput] = useState(
    book.read_pages !== undefined && book.read_pages !== null ? String(book.read_pages) : ''
  );
  const [savingProgress, setSavingProgress] = useState(false);

  useEffect(() => {
    if (book.read_pages !== undefined && book.read_pages !== null) {
      setProgressInput(String(book.read_pages));
    }
  }, [book.read_pages]);

  // Sincronizza il conteggio con il libro passato come prop (es. da Dashboard o aggiornamenti genitore)
  useEffect(() => {
    if (book.notes_count !== undefined) {
      setNotesCount(book.notes_count);
    }
  }, [book.notes_count]);

  // Se notes_count non è definito e le note non sono ancora state caricate, carica il conteggio in background
  useEffect(() => {
    if (book.notes_count === undefined && notes === null) {
      supabase
        .from('notes')
        .select('id, content')
        .eq('book_id', book.id)
        .then(({ data }) => {
          if (data) {
            const count = data.filter((n) => !n.content.startsWith('__')).length;
            setNotesCount(count);
          }
        });
    }
  }, [book.id, book.notes_count, notes]);

  const displayCount = notes !== null ? notes.length : notesCount;

  const handleStatusChange = async (status: Book['status']) => {
    let newReadAt = book.read_at;
    let newReadPages = book.read_pages;
    if (status === 'completed') {
      if (!newReadAt) {
        newReadAt = new Date().toISOString();
        await syncBookDateToSupabase(book.id, newReadAt);
      }
      if (book.pages && (!newReadPages || newReadPages < book.pages)) {
        newReadPages = book.pages;
        await syncBookReadPagesToSupabase(book.id, newReadPages);
      }
    } else if (book.status === 'completed') {
      newReadAt = null;
      await syncBookDateToSupabase(book.id, null);
    }
    const updatePayload: any = { status, read_at: newReadAt, updated_at: new Date().toISOString() };
    if (newReadPages !== undefined) updatePayload.read_pages = newReadPages;

    let res = await supabase
      .from('books')
      .update(updatePayload)
      .eq('id', book.id)
      .select()
      .single();

    if (res.error && (res.error.message?.includes('read_pages') || res.error.message?.includes('read_at'))) {
      res = await supabase
        .from('books')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', book.id)
        .select()
        .single();
    }

    if (res.data) onUpdate({ ...res.data, read_at: newReadAt, read_pages: newReadPages, notes_count: displayCount });

    if (status === 'completed' && book.status !== 'completed') {
      toast({ message: `Hai completato "${book.title}"! 🎉`, type: 'success' });
    }
  };

  const persistReadPages = async (value: number) => {
    setSavingProgress(true);
    try {
      // 1. Prova aggiornamento su Supabase
      const res = await supabase
        .from('books')
        .update({ read_pages: value, updated_at: new Date().toISOString() })
        .eq('id', book.id)
        .select()
        .single();

      // 2. Sincronizza su local storage e note di backup
      await syncBookReadPagesToSupabase(book.id, value);

      const updated = res.data ?? { ...book, read_pages: value };
      onUpdate({ ...book, ...updated, read_pages: value, read_at: book.read_at, notes_count: displayCount });
      setEditingProgress(false);
    } catch (err) {
      console.error('Errore salvataggio progresso:', err);
      toast({ message: 'Impossibile salvare il progresso. Riprova.', type: 'error' });
    } finally {
      setSavingProgress(false);
    }
  };

  const handleSaveProgress = async () => {
    const val = progressInput.trim() ? parseInt(progressInput.trim(), 10) : 0;
    const cleanVal = !isNaN(val) && val >= 0 ? val : 0;
    await persistReadPages(cleanVal);
  };

  // Avanzamento rapido: aggiunge N pagine senza superare il totale del libro
  const handleQuickAddPages = async (amount: number) => {
    const current = book.read_pages || 0;
    const max = book.pages && book.pages > 0 ? book.pages : Infinity;
    const next = Math.min(max, current + amount);
    if (next === current) return;
    await persistReadPages(next);
    if (Number.isFinite(max) && next >= max) {
      toast({
        message: 'Ultima pagina raggiunta! Premi "Finito" per completare il libro.',
        type: 'info',
      });
    }
  };

  const handleMarkAsFinished = async () => {
    const finalPages = book.pages || book.read_pages || null;
    const readAtDate = new Date().toISOString();

    await syncBookDateToSupabase(book.id, readAtDate);
    if (finalPages) {
      await syncBookReadPagesToSupabase(book.id, finalPages);
    }

    const updatePayload: any = {
      status: 'completed',
      read_at: readAtDate,
      updated_at: readAtDate,
    };
    if (finalPages) updatePayload.read_pages = finalPages;

    let res = await supabase
      .from('books')
      .update(updatePayload)
      .eq('id', book.id)
      .select()
      .single();

    if (res.error && (res.error.message?.includes('read_pages') || res.error.message?.includes('pages'))) {
      const { read_pages: _rp, ...fallback } = updatePayload;
      res = await supabase
        .from('books')
        .update(fallback)
        .eq('id', book.id)
        .select()
        .single();
    }

    const updated = res.data ?? {
      ...book,
      status: 'completed',
      read_at: readAtDate,
      read_pages: finalPages,
      updated_at: readAtDate,
    };

    onUpdate({
      ...book,
      ...updated,
      status: 'completed',
      read_at: readAtDate,
      read_pages: finalPages,
      notes_count: displayCount,
    });

    toast({ message: `Hai completato "${book.title}"! 🎉`, type: 'success' });
  };

  const handleRatingChange = async (rating: number) => {
    const { data } = await supabase
      .from('books')
      .update({ rating, updated_at: new Date().toISOString() })
      .eq('id', book.id)
      .select()
      .single();
    if (data) onUpdate({ ...data, read_at: book.read_at, notes_count: displayCount });
  };

  const handleAutoFetchCover = async () => {
    setAutoFetchingCover(true);
    try {
      const cover = await fetchBookCover(book.title, book.author);
      if (cover) {
        const { data: updated } = await supabase
          .from('books')
          .update({ cover_url: cover, updated_at: new Date().toISOString() })
          .eq('id', book.id)
          .select()
          .single();
        if (updated) onUpdate({ ...updated, read_at: book.read_at, notes_count: displayCount });
      }
    } catch (e) {
      console.error('Errore recupero copertina:', e);
    } finally {
      setAutoFetchingCover(false);
    }
  };

  const renderBottomBar = () => (
    <>
      {/* Selettore Stato del libro */}
      <div className="relative shrink-0 inline-flex items-center">
        <select
          value={book.status}
          onChange={(e) => handleStatusChange(e.target.value as Book['status'])}
          aria-label="Stato del libro"
          className={`appearance-none h-7 sm:h-7.5 text-xs font-semibold pl-2.5 sm:pl-3 pr-6 rounded-full border cursor-pointer outline-none transition-colors inline-flex items-center shadow-xs active:scale-95 ${STATUS_COLORS[book.status]}`}
        >
          <option value="reading" className="bg-stone-900 light:bg-white text-stone-100 light:text-stone-900">In lettura</option>
          <option value="completed" className="bg-stone-900 light:bg-white text-stone-100 light:text-stone-900">Completato</option>
          <option value="want" className="bg-stone-900 light:bg-white text-stone-100 light:text-stone-900">Da leggere</option>
        </select>
        <ChevronDown size={12} className="absolute right-2 pointer-events-none opacity-70 shrink-0" />
      </div>

      {/* Badge Data di lettura */}
      {book.read_at ? (
        <span className="shrink-0 h-7 sm:h-7.5 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 light:text-emerald-700 bg-emerald-500/10 light:bg-emerald-50 border border-emerald-500/30 light:border-emerald-300/60 rounded-full px-2.5 sm:px-3 whitespace-nowrap">
          <Calendar size={12} className="shrink-0" />
          <span>
            {new Date(book.read_at).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </span>
      ) : null}

      {/* Pulsante Scheda / Trama */}
      {onInspect && (
        <button
          type="button"
          onClick={() => onInspect(book)}
          className="shrink-0 h-7 sm:h-7.5 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 rounded-full border border-stone-600 light:border-stone-300 text-stone-300 light:text-stone-700 hover:border-amber-500/40 hover:text-amber-300 light:hover:text-amber-700 hover:bg-stone-700/50 light:hover:bg-stone-100 transition-all cursor-pointer whitespace-nowrap active:scale-95"
          title="Apri Scheda Libro e trama"
        >
          <BookOpen size={12} className="shrink-0 text-amber-400 light:text-amber-600" />
          <span>Scheda</span>
        </button>
      )}

      {/* Pulsante Note */}
      <button
        type="button"
        onClick={() => setShowNotesModal(true)}
        className={`shrink-0 h-7 sm:h-7.5 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 rounded-full border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
          displayCount > 0
            ? 'border-amber-500/40 light:border-amber-300 text-amber-300 light:text-amber-800 bg-amber-500/10 light:bg-amber-50 hover:bg-amber-500/20 light:hover:bg-amber-100'
            : 'border-stone-600 light:border-stone-300 text-stone-300 light:text-stone-700 hover:bg-stone-700/50 light:hover:bg-stone-100'
        } ${showNotesModal ? 'ring-1 ring-amber-500/40 light:ring-amber-400' : ''}`}
        title={
          displayCount > 0
            ? `${displayCount} ${displayCount === 1 ? 'nota' : 'note'} (clicca per visualizzare o scrivere)`
            : 'Note (clicca per scrivere citazioni o riflessioni)'
        }
      >
        <StickyNote size={12} className={`shrink-0 ${displayCount > 0 ? 'text-amber-400 light:text-amber-600' : 'text-stone-400 light:text-stone-500'}`} />
        <span>
          {displayCount === 0
            ? 'Note'
            : displayCount === 1
              ? '1 nota'
              : `${displayCount} note`}
        </span>
      </button>
    </>
  );

  const renderProgressWidget = () => (
    <div className="p-2 sm:p-2.5 bg-amber-500/10 light:bg-amber-50/70 border border-amber-500/20 light:border-amber-200/80 rounded-lg transition-all">
      {editingProgress ? (
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 flex-nowrap min-w-0">
            <span className="text-[10px] sm:text-[11px] text-stone-400 light:text-stone-600 font-medium shrink-0">
              Pag.
            </span>
            <input
              type="number"
              min="0"
              max={book.pages ? book.pages : undefined}
              value={progressInput}
              onChange={(e) => setProgressInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveProgress();
                if (e.key === 'Escape') setEditingProgress(false);
              }}
              autoFocus
              className="w-14 sm:w-16 px-1.5 py-0.5 bg-stone-900 light:bg-white border border-amber-500/50 rounded text-xs text-stone-100 light:text-stone-900 outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="0"
            />
            {book.pages && book.pages > 0 && (
              <span className="text-[10px] sm:text-[11px] text-stone-500 light:text-stone-500 font-medium truncate">
                / {book.pages}
              </span>
            )}
            <button
              onClick={handleSaveProgress}
              disabled={savingProgress}
              className="text-[11px] sm:text-xs px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded cursor-pointer transition-colors shrink-0 active:scale-95"
            >
              {savingProgress ? <Loader2 size={11} className="animate-spin" /> : 'Salva'}
            </button>
            <button
              onClick={() => {
                setProgressInput(book.read_pages ? String(book.read_pages) : '');
                setEditingProgress(false);
              }}
              className="text-xs px-1 text-stone-400 hover:text-stone-200 light:hover:text-stone-800 cursor-pointer shrink-0"
              title="Annulla"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-amber-500/15 light:border-amber-200/60">
            <span className="text-[10px] text-stone-400 light:text-stone-500">
              Tutto letto?
            </span>
            <button
              type="button"
              onClick={handleMarkAsFinished}
              className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-400 light:text-emerald-700 bg-emerald-500/15 light:bg-emerald-100 hover:bg-emerald-500/25 border border-emerald-500/30 light:border-emerald-300 px-2 py-0.5 rounded cursor-pointer transition-colors active:scale-95"
              title="Ho finito di leggere tutto il libro! Segna come Completato"
            >
              <CheckCircle2 size={11} />
              <span>Finito</span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div
            onClick={() => {
              setProgressInput(book.read_pages ? String(book.read_pages) : '');
              setEditingProgress(true);
            }}
            className="cursor-pointer group/progress"
            title="Clicca per aggiornare la pagina letta"
          >
            <div className="flex items-center justify-between text-[11px] mb-1 gap-1">
              <span className="text-amber-300 light:text-amber-800 font-medium flex items-center gap-1 truncate">
                <Flame size={12} className="text-amber-400 light:text-amber-600 shrink-0" />
                <span className="truncate">
                  {book.read_pages && book.read_pages > 0
                    ? `Pag. ${book.read_pages}${book.pages ? ` di ${book.pages}` : ''}`
                    : book.pages
                      ? `Inizia (${book.pages} pag.)`
                      : 'Imposta pagina letta'}
                </span>
              </span>
              <span className="text-stone-400 light:text-stone-500 text-[10px] group-hover/progress:text-amber-300 light:group-hover/progress:text-amber-700 transition-colors font-semibold shrink-0 inline-flex items-center gap-1">
                <span>
                  {book.pages && book.pages > 0
                    ? `${Math.min(100, Math.round(((book.read_pages || 0) / book.pages) * 100))}%`
                    : 'Modifica'}
                </span>
                <Pencil size={10} className="opacity-70 group-hover/progress:opacity-100" />
              </span>
            </div>
            {book.pages && book.pages > 0 && (
              <div className="w-full bg-stone-800/80 light:bg-stone-200 h-1.5 rounded-full overflow-hidden mb-1.5">
                <div
                  className="bg-amber-400 light:bg-amber-500 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((book.read_pages || 0) / book.pages) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Avanzamento rapido: +10 / +25 / +50 pagine */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {[10, 25, 50].map((n) => (
              <button
                key={n}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickAddPages(n);
                }}
                disabled={
                  savingProgress ||
                  Boolean(book.pages && book.pages > 0 && (book.read_pages || 0) >= book.pages)
                }
                className="text-xs font-semibold px-2.5 py-1 rounded-md border border-amber-500/30 light:border-amber-300 text-amber-300 light:text-amber-800 bg-amber-500/10 light:bg-amber-100/70 hover:bg-amber-500/20 light:hover:bg-amber-200/70 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
                title={`Aggiungi ${n} pagine lette`}
              >
                +{n} pag.
              </button>
            ))}
            {savingProgress && <Loader2 size={13} className="animate-spin text-amber-400" />}
          </div>

          {/* Pulsante "Finito" responsive e dinamico */}
          <div className="flex items-center justify-between pt-1.5 border-t border-amber-500/15 light:border-amber-200/60 mt-1 gap-2">
            <span className="text-xs text-stone-400 light:text-stone-500 truncate">
              Hai finito il libro?
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleMarkAsFinished();
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 light:text-emerald-700 bg-emerald-500/15 light:bg-emerald-100 hover:bg-emerald-500/25 light:hover:bg-emerald-200 border border-emerald-500/30 light:border-emerald-300 px-3 py-1 rounded-md transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              title="Ho finito di leggere tutto il libro! Segna come Completato"
            >
              <CheckCircle2 size={13} className="text-emerald-400 light:text-emerald-600 shrink-0" />
              <span>Finito</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`group backdrop-blur-sm rounded-2xl border transition-all duration-200 active:scale-[0.99] sm:active:scale-100 ${
        highlight
          ? 'bg-gradient-to-br from-amber-950/30 via-stone-850 to-stone-900 light:from-amber-50/70 light:via-white light:to-amber-50/30 border-amber-500/40 light:border-amber-300 shadow-lg shadow-amber-500/5 hover:border-amber-400/60 light:hover:border-amber-400 ring-1 ring-amber-500/20 light:ring-amber-300/40'
          : 'bg-stone-850/80 light:bg-white border-stone-800/80 light:border-stone-200/90 hover:border-stone-700 light:hover:border-stone-300 hover:shadow-md shadow-xs'
      } overflow-hidden h-full flex flex-col`}
    >
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
        {/* Sezione superiore: Copertina e dettagli del libro */}
        <div className="flex items-start gap-3 sm:gap-4 flex-1">
          {/* Copertina a proporzioni fisse con effetto dorso libro */}
          <div
            onClick={() => {
              if (book.cover_url && onInspect) {
                onInspect(book);
              } else if (!book.cover_url) {
                handleAutoFetchCover();
              }
            }}
            className="relative shrink-0 w-20 sm:w-24 aspect-[2/3] rounded-lg overflow-hidden self-start bg-stone-900 light:bg-stone-100 flex items-center justify-center shadow-md border border-stone-800/80 light:border-stone-200 book-spine-effect group/cover cursor-pointer"
            title={book.cover_url ? 'Clicca per aprire la Scheda Libro e la trama' : 'Clicca per cercare la copertina in automatico'}
          >
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={`Copertina di ${book.title}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover/cover:scale-105"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-1.5 text-center">
                <BookMarked size={28} className="text-stone-600 light:text-stone-400 mb-1" />
                <span className="text-[9px] sm:text-[10px] text-stone-500 light:text-stone-400 leading-tight">
                  Nessuna copertina
                </span>
                {/* Badge indicatore di ricerca copertina su mobile */}
                <div className="sm:hidden mt-1.5 flex items-center gap-0.5 text-[9px] font-medium text-amber-400 light:text-amber-700 bg-amber-500/15 light:bg-amber-100 px-1 py-0.5 rounded border border-amber-500/30">
                  <Sparkles size={9} />
                  <span>Cerca</span>
                </div>
              </div>
            )}
            <ImageOff size={24} className="text-stone-600 light:text-stone-400 hidden" />

            {!book.cover_url && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAutoFetchCover();
                }}
                disabled={autoFetchingCover}
                className="absolute inset-0 bg-stone-950/85 light:bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-1.5 text-center opacity-0 group-hover/cover:opacity-100 transition-opacity cursor-pointer border border-amber-500/30"
                title="Cerca copertina in automatico con titolo e autore"
              >
                {autoFetchingCover ? (
                  <Loader2 size={16} className="animate-spin text-amber-400 light:text-amber-600 mb-1" />
                ) : (
                  <Sparkles size={16} className="text-amber-400 light:text-amber-600 mb-1" />
                )}
                <span className="text-[9px] sm:text-[10px] text-amber-300 light:text-amber-800 font-medium leading-tight">
                  {autoFetchingCover ? 'Cerco...' : 'Cerca copertina'}
                </span>
              </button>
            )}
          </div>

          {/* Colonna dettagli del libro */}
          <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
            <div>
              {highlight && (
                <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-amber-300 light:text-amber-700 tracking-wider uppercase mb-0.5 sm:mb-1">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 light:bg-amber-500 animate-pulse inline-block" />
                  <span>In lettura</span>
                </div>
              )}

              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0 flex-1">
                  <h3
                    onClick={() => onInspect?.(book)}
                    className={`font-serif text-base sm:text-lg font-semibold text-stone-100 light:text-stone-900 leading-snug break-words line-clamp-2 ${
                      onInspect ? 'cursor-pointer hover:text-amber-400 light:hover:text-amber-700 transition-colors' : ''
                    }`}
                    title={onInspect ? `${book.title} — Clicca per aprire la Scheda Libro` : book.title}
                  >
                    {book.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-stone-400 light:text-stone-600 text-xs sm:text-sm mt-0.5 flex-wrap">
                    <span className="truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none">{book.author}</span>
                    {book.pages && book.pages > 0 && (
                      <span className="text-[10px] sm:text-[11px] font-medium text-stone-300 light:text-stone-700 bg-stone-750/70 light:bg-stone-100 px-1.5 py-0.2 rounded border border-stone-600/40 light:border-stone-200 shrink-0">
                        {book.pages} pag.
                      </span>
                    )}
                  </div>
                </div>

                {/* Pulsanti azioni rapidi */}
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 -mr-1">
                  <button
                    type="button"
                    onClick={() => onEdit(book)}
                    className="opacity-75 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-stone-400 light:text-stone-500 hover:text-amber-400 light:hover:text-amber-600 p-1.5 rounded-md hover:bg-stone-700/40 light:hover:bg-stone-100 active:scale-90 cursor-pointer"
                    title="Modifica libro"
                    aria-label="Modifica libro"
                  >
                    <Pencil size={15} className="sm:w-4 sm:h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(book.id)}
                    className="opacity-75 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-stone-400 light:text-stone-500 hover:text-red-400 light:hover:text-red-600 p-1.5 rounded-md hover:bg-stone-700/40 light:hover:bg-stone-100 active:scale-90 cursor-pointer"
                    title="Elimina libro"
                    aria-label="Elimina libro"
                  >
                    <Trash2 size={15} className="sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-1.5 sm:mt-2">
              <StarRating value={book.rating} onChange={handleRatingChange} size={18} />
            </div>

            {/* Barra inferiore (Stato, Data, Scheda, Note): sempre sul fondo della colonna destra per equilibrare la copertina */}
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2.5 sm:pt-3">
              {renderBottomBar()}
            </div>
          </div>
        </div>

        {/* Se è in lettura: widget progresso a tutta larghezza in fondo alla card, separato con eleganza */}
        {book.status === 'reading' && (
          <div className="mt-3 pt-3 border-t border-amber-500/15 light:border-amber-200/60">
            {renderProgressWidget()}
          </div>
        )}
      </div>

      {/* Modale spaziosa e funzionale per gestione note del libro */}
      {showNotesModal && (
        <BookNotesModal
          book={book}
          onClose={() => setShowNotesModal(false)}
          onUpdateBook={(updated) => {
            onUpdate(updated);
            if (updated.notes_count !== undefined) {
              setNotesCount(updated.notes_count);
            }
          }}
          initialNotes={notes}
        />
      )}
    </div>
  );
}
