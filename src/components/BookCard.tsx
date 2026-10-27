import { useEffect, useState } from 'react';
import {
  Trash2,
  Plus,
  Loader2,
  StickyNote,
  X,
  BookMarked,
  Link2,
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

const STATUS_COLORS: Record<Book['status'], string> = {
  reading: 'bg-amber-500/15 light:bg-amber-50 text-amber-400 light:text-amber-800 border-amber-500/30 light:border-amber-300',
  completed: 'bg-emerald-500/15 light:bg-emerald-50 text-emerald-400 light:text-emerald-800 border-emerald-500/30 light:border-emerald-300',
  want: 'bg-sky-500/15 light:bg-sky-50 text-sky-400 light:text-sky-800 border-sky-500/30 light:border-sky-300',
};

export function BookCard({
  book,
  onUpdate,
  onDelete,
  onEdit,
  highlight = false,
}: {
  book: Book;
  onUpdate: (book: Book) => void;
  onDelete: (id: string) => void;
  onEdit: (book: Book) => void;
  highlight?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [notesCount, setNotesCount] = useState<number>(book.notes_count ?? 0);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverInput, setCoverInput] = useState('');
  const [savingCover, setSavingCover] = useState(false);
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

  const loadNotes = async () => {
    setLoadingNotes(true);
    try {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('book_id', book.id)
        .order('created_at', { ascending: false });
      const userNotes = (data ?? []).filter((n) => !n.content.startsWith('__'));
      setNotes(userNotes);
      setNotesCount(userNotes.length);
    } catch (e) {
      console.error('Errore nel caricamento delle note:', e);
    } finally {
      setLoadingNotes(false);
    }
  };

  useEffect(() => {
    if (expanded && notes === null && !loadingNotes) {
      loadNotes();
    }
  }, [expanded, notes, loadingNotes]);

  const displayCount = notes !== null ? notes.length : notesCount;

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { data } = await supabase
      .from('notes')
      .insert({ book_id: book.id, content: newNote.trim() })
      .select()
      .single();
    if (data) {
      const updatedNotes = [data, ...(notes ?? [])];
      setNotes(updatedNotes);
      setNotesCount(updatedNotes.length);
      setNewNote('');
      onUpdate({ ...book, notes_count: updatedNotes.length });
    }
    setSavingNote(false);
  };

  const handleUpdateNote = async (id: string) => {
    if (!editContent.trim()) return;
    const { data } = await supabase
      .from('notes')
      .update({ content: editContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (data) {
      setNotes((prev) => (prev ?? []).map((n) => (n.id === id ? data : n)));
    }
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleDeleteNote = async (id: string) => {
    await supabase.from('notes').delete().eq('id', id);
    const updatedNotes = (notes ?? []).filter((n) => n.id !== id);
    setNotes(updatedNotes);
    setNotesCount(updatedNotes.length);
    onUpdate({ ...book, notes_count: updatedNotes.length });
  };

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
    }
    const updatePayload: any = { status, updated_at: new Date().toISOString() };
    if (newReadPages !== undefined) updatePayload.read_pages = newReadPages;

    let res = await supabase
      .from('books')
      .update(updatePayload)
      .eq('id', book.id)
      .select()
      .single();

    if (res.error && res.error.message?.includes('read_pages')) {
      res = await supabase
        .from('books')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', book.id)
        .select()
        .single();
    }

    if (res.data) onUpdate({ ...res.data, read_at: newReadAt, read_pages: newReadPages, notes_count: displayCount });
  };

  const handleSaveProgress = async () => {
    const val = progressInput.trim() ? parseInt(progressInput.trim(), 10) : 0;
    const cleanVal = !isNaN(val) && val >= 0 ? val : 0;
    setSavingProgress(true);

    try {
      // 1. Prova aggiornamento su Supabase
      const res = await supabase
        .from('books')
        .update({ read_pages: cleanVal, updated_at: new Date().toISOString() })
        .eq('id', book.id)
        .select()
        .single();

      // 2. Sincronizza su local storage e note di backup
      await syncBookReadPagesToSupabase(book.id, cleanVal);

      const updated = res.data ?? { ...book, read_pages: cleanVal };
      onUpdate({ ...book, ...updated, read_pages: cleanVal, read_at: book.read_at, notes_count: displayCount });
      setEditingProgress(false);
    } catch (err) {
      console.error('Errore salvataggio progresso:', err);
    } finally {
      setSavingProgress(false);
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

  const handleSaveCover = async () => {
    setSavingCover(true);
    const url = coverInput.trim() || null;
    const { data: updated } = await supabase
      .from('books')
      .update({ cover_url: url, updated_at: new Date().toISOString() })
      .eq('id', book.id)
      .select()
      .single();
    if (updated) onUpdate({ ...updated, read_at: book.read_at, notes_count: displayCount });
    setSavingCover(false);
    setShowCoverModal(false);
    setCoverInput('');
  };

  const openCoverModal = () => {
    setCoverInput(book.cover_url ?? '');
    setShowCoverModal(true);
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

  const handleDeleteBook = async () => {
    await supabase.from('books').delete().eq('id', book.id);
    onDelete(book.id);
  };

  const renderBottomBar = () => (
    <>
      {/* Selettore Stato del libro */}
      <div className="relative shrink-0 inline-flex items-center">
        <select
          value={book.status}
          onChange={(e) => handleStatusChange(e.target.value as Book['status'])}
          className={`appearance-none h-6 sm:h-7 text-[10px] sm:text-xs font-medium pl-2 sm:pl-2.5 pr-5 sm:pr-6 rounded-full border cursor-pointer outline-none transition-colors inline-flex items-center ${STATUS_COLORS[book.status]}`}
        >
          <option value="reading" className="bg-stone-900 light:bg-white text-stone-100 light:text-stone-900">In lettura</option>
          <option value="completed" className="bg-stone-900 light:bg-white text-stone-100 light:text-stone-900">Completato</option>
          <option value="want" className="bg-stone-900 light:bg-white text-stone-100 light:text-stone-900">Da leggere</option>
        </select>
        <ChevronDown size={11} className="absolute right-1.5 sm:right-2 pointer-events-none opacity-70 shrink-0" />
      </div>

      {/* Badge Data di lettura */}
      {book.read_at ? (
        <span className="shrink-0 h-6 sm:h-7 inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-emerald-400 light:text-emerald-700 bg-emerald-500/10 light:bg-emerald-50 border border-emerald-500/30 light:border-emerald-300/60 rounded-full px-2 sm:px-2.5 whitespace-nowrap">
          <Calendar size={11} className="shrink-0" />
          <span>
            {new Date(book.read_at).toLocaleDateString('it-IT', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        </span>
      ) : (
        <span className="shrink-0 h-6 sm:h-7 inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-stone-500 light:text-stone-500 bg-stone-800/60 light:bg-stone-100 border border-stone-700 light:border-stone-200 rounded-full px-2 sm:px-2.5 whitespace-nowrap">
          <Calendar size={11} className="shrink-0" />
          <span>Nessuna data</span>
        </span>
      )}

      {/* Pulsante Note */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`shrink-0 h-6 sm:h-7 inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 rounded-full border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
          displayCount > 0
            ? 'border-amber-500/40 light:border-amber-300 text-amber-300 light:text-amber-800 bg-amber-500/10 light:bg-amber-50 hover:bg-amber-500/20 light:hover:bg-amber-100'
            : 'border-stone-600 light:border-stone-300 text-stone-300 light:text-stone-700 hover:bg-stone-700/50 light:hover:bg-stone-100'
        } ${expanded ? 'ring-1 ring-amber-500/40 light:ring-amber-400' : ''}`}
        title={
          displayCount > 0
            ? `${displayCount} ${displayCount === 1 ? 'nota' : 'note'} (clicca per ${expanded ? 'chiudere' : 'aprire'})`
            : 'Note (clicca per aggiungere note)'
        }
      >
        <StickyNote size={11} className={`shrink-0 ${displayCount > 0 ? 'text-amber-400 light:text-amber-600' : 'text-stone-400 light:text-stone-500'}`} />
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
              <span className="text-stone-400 light:text-stone-500 text-[10px] group-hover/progress:text-amber-300 light:group-hover/progress:text-amber-700 transition-colors font-semibold shrink-0">
                {book.pages && book.pages > 0
                  ? `${Math.min(100, Math.round(((book.read_pages || 0) / book.pages) * 100))}%`
                  : 'Modifica'}
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

          {/* Pulsante "Finito" responsive e dinamico */}
          <div className="flex items-center justify-between pt-1 border-t border-amber-500/15 light:border-amber-200/60 mt-1 gap-1.5">
            <span className="text-[10px] text-stone-400 light:text-stone-500 truncate">
              Hai finito il libro?
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleMarkAsFinished();
              }}
              className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-400 light:text-emerald-700 bg-emerald-500/15 light:bg-emerald-100 hover:bg-emerald-500/25 light:hover:bg-emerald-200 border border-emerald-500/30 light:border-emerald-300 px-2 py-0.5 rounded-md transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              title="Ho finito di leggere tutto il libro! Segna come Completato"
            >
              <CheckCircle2 size={11} className="text-emerald-400 light:text-emerald-600 shrink-0" />
              <span>Finito</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`group backdrop-blur-sm rounded-xl border transition-all duration-200 active:scale-[0.99] sm:active:scale-100 ${
        highlight
          ? 'bg-gradient-to-br from-amber-950/30 via-stone-850 to-stone-900 light:from-amber-50/70 light:via-white light:to-amber-50/30 border-amber-500/40 light:border-amber-300 shadow-lg shadow-amber-500/5 hover:border-amber-400/60 light:hover:border-amber-400 ring-1 ring-amber-500/20 light:ring-amber-300/40'
          : 'bg-stone-800/60 light:bg-white border-stone-700 light:border-stone-200/90 hover:border-stone-600 light:hover:border-stone-300 hover:shadow-md shadow-xs'
      } overflow-hidden h-full flex flex-col`}
    >
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
        {/* Sezione superiore: Copertina e dettagli del libro */}
        <div className="flex items-start gap-3 sm:gap-4 flex-1">
          {/* Copertina a proporzioni fisse (evita allungamenti e distorsioni) */}
          <div
            onClick={!book.cover_url ? handleAutoFetchCover : undefined}
            className={`relative shrink-0 w-20 sm:w-24 ${
              book.status === 'reading' ? 'h-28 sm:h-34' : 'h-36'
            } rounded-lg overflow-hidden self-start bg-stone-900 light:bg-stone-100 flex items-center justify-center shadow-md border border-stone-800/80 light:border-stone-200 group/cover ${
              !book.cover_url ? 'cursor-pointer' : ''
            }`}
            title={!book.cover_url ? 'Clicca per cercare la copertina in automatico' : undefined}
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
                    className="font-serif text-base sm:text-lg font-semibold text-stone-100 light:text-stone-900 leading-snug break-words line-clamp-2"
                    title={book.title}
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
                    onClick={() => onEdit(book)}
                    className="opacity-75 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-stone-400 light:text-stone-500 hover:text-amber-400 light:hover:text-amber-600 p-1.5 rounded-md hover:bg-stone-700/40 light:hover:bg-stone-100 active:scale-90"
                    title="Modifica libro"
                    aria-label="Modifica libro"
                  >
                    <BookMarked size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="opacity-75 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-stone-400 light:text-stone-500 hover:text-red-400 light:hover:text-red-600 p-1.5 rounded-md hover:bg-stone-700/40 light:hover:bg-stone-100 active:scale-90"
                    title="Elimina libro"
                    aria-label="Elimina libro"
                  >
                    <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-1.5 sm:mt-2">
              <StarRating value={book.rating} onChange={handleRatingChange} size={18} />
            </div>

            {/* Se non è in lettura: barra inferiore posizionata nella colonna di destra */}
            {book.status !== 'reading' && (
              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2.5 sm:pt-3">
                {renderBottomBar()}
              </div>
            )}
          </div>
        </div>

        {/* Se è in lettura: barra azioni sopra e widget progresso sotto a tutta larghezza */}
        {book.status === 'reading' && (
          <div className="mt-2.5 sm:mt-3 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              {renderBottomBar()}
            </div>

            {renderProgressWidget()}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-stone-700 light:border-stone-200 px-4 py-3 bg-stone-900/40 light:bg-stone-50/70">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote size={16} className="text-amber-400 light:text-amber-600" />
            <span className="text-sm font-medium text-stone-200 light:text-stone-800">Le mie note</span>
          </div>

          <div className="space-y-2 mb-3">
            {loadingNotes ? (
              <div className="flex items-center gap-2 text-stone-500 light:text-stone-500 text-sm py-2">
                <Loader2 size={16} className="animate-spin text-amber-400 light:text-amber-600" />
                Caricamento note...
              </div>
            ) : (!notes || notes.length === 0) ? (
              <p className="text-stone-500 light:text-stone-500 text-sm italic">Nessuna nota. Aggiungi la prima!</p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="group/note bg-stone-800/60 light:bg-white rounded-lg p-3 border border-stone-700 light:border-stone-200 shadow-xs"
                >
                  {editingNoteId === note.id ? (
                    <div>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full bg-stone-900 light:bg-white border border-stone-600 light:border-stone-300 rounded-md p-2 text-sm text-stone-100 light:text-stone-900 focus:outline-none focus:border-amber-500/50 resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleUpdateNote(note.id)}
                          className="text-xs px-3 py-1 bg-amber-500 text-stone-900 font-medium rounded-md hover:bg-amber-400 cursor-pointer"
                        >
                          Salva
                        </button>
                        <button
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditContent('');
                          }}
                          className="text-xs px-3 py-1 text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 cursor-pointer"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-stone-200 light:text-stone-800 whitespace-pre-wrap break-words">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-stone-500 light:text-stone-400">
                          {new Date(note.created_at).toLocaleDateString('it-IT', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <div className="flex gap-2 opacity-80 sm:opacity-0 sm:group-hover/note:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditContent(note.content);
                            }}
                            className="text-xs text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 cursor-pointer"
                          >
                            Modifica
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-xs text-stone-400 light:text-stone-600 hover:text-red-400 cursor-pointer"
                          >
                            Elimina
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              placeholder="Aggiungi una nota per ricordare cosa hai letto..."
              className="flex-1 bg-stone-900/60 light:bg-white border border-stone-700 light:border-stone-300 rounded-lg p-2.5 text-sm text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500/50 resize-none shadow-xs"
            />
            <button
              onClick={handleAddNote}
              disabled={savingNote || !newNote.trim()}
              className="self-end p-2.5 bg-amber-500/10 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 text-amber-400 light:text-amber-800 rounded-lg hover:bg-amber-500/20 light:hover:bg-amber-200/80 disabled:opacity-30 transition-colors cursor-pointer"
            >
              {savingNote ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-stone-800 light:bg-white rounded-xl border border-stone-700 light:border-stone-200 p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold text-stone-100 light:text-stone-900">Elimina libro</h3>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-stone-500 light:text-stone-400 hover:text-stone-300 light:hover:text-stone-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-stone-400 light:text-stone-600 text-sm mb-6 leading-relaxed">
              Vuoi davvero eliminare "{book.title}"? Verranno cancellate anche tutte le note
              associate. Questa azione non può essere annullata.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-4 border border-stone-600 light:border-stone-300 text-stone-300 light:text-stone-700 rounded-lg hover:bg-stone-700/50 light:hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={handleDeleteBook}
                className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-400 text-white font-medium rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {showCoverModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setShowCoverModal(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-stone-700 light:border-stone-200 bg-stone-800 light:bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-700 light:border-stone-200 p-4">
              <h3 className="font-serif text-lg font-semibold text-stone-100 light:text-stone-900">Copertina</h3>
              <button
                onClick={() => setShowCoverModal(false)}
                className="text-stone-400 light:text-stone-500 transition hover:text-stone-200 light:hover:text-stone-800 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex h-36 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-700 light:border-stone-200 bg-stone-900 light:bg-stone-100 shadow-inner">
                  {coverInput.trim() ? (
                    <img
                      src={coverInput.trim()}
                      alt="Anteprima"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <BookMarked size={42} className="text-stone-600 light:text-stone-400" />
                  )}
                  <ImageOff size={28} className="hidden text-stone-600 light:text-stone-400" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-stone-300 light:text-stone-700">
                      URL immagine
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        setAutoFetchingCover(true);
                        const found = await fetchBookCover(book.title, book.author);
                        if (found) setCoverInput(found);
                        setAutoFetchingCover(false);
                      }}
                      disabled={autoFetchingCover}
                      className="flex items-center gap-1 text-xs text-amber-400 light:text-amber-700 hover:text-amber-300 light:hover:text-amber-800 disabled:opacity-40 font-medium px-2 py-0.5 rounded bg-amber-500/10 light:bg-amber-50 hover:bg-amber-500/20 light:hover:bg-amber-100 border border-amber-500/30 light:border-amber-300 transition-colors cursor-pointer"
                      title="Cerca automaticamente la copertina di questo libro"
                    >
                      {autoFetchingCover ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      <span>
                        {autoFetchingCover ? 'Ricerca...' : 'Cerca in automatico'}
                      </span>
                    </button>
                  </div>
                  <div className="relative">
                    <Link2
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400"
                    />
                    <input
                      type="url"
                      value={coverInput}
                      onChange={(e) => setCoverInput(e.target.value)}
                      className="w-full rounded-lg border border-stone-700 light:border-stone-300 bg-stone-900/60 light:bg-stone-50 py-2.5 pl-10 pr-3 text-sm text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      placeholder="https://..."
                    />
                  </div>
                  <p className="mt-2 text-xs text-stone-500 light:text-stone-500">
                    Incolla l'URL diretto di un'immagine. Lascia vuoto per rimuovere la copertina.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 gap-3 border-t border-stone-700 light:border-stone-200 bg-stone-800 light:bg-stone-50 p-4">
              <button
                type="button"
                onClick={() => {
                  setShowCoverModal(false);
                  setCoverInput('');
                }}
                className="flex-1 cursor-pointer rounded-lg border border-stone-600 light:border-stone-300 px-4 py-2.5 text-stone-300 light:text-stone-700 transition hover:bg-stone-700/60 light:hover:bg-stone-200/70 font-semibold"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSaveCover}
                disabled={savingCover}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-stone-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingCover && <Loader2 size={18} className="animate-spin" />}
                {savingCover ? 'Salvataggio...' : 'Modifica'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
