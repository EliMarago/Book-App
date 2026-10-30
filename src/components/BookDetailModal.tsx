import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Flame,
  Calendar,
  Layers,
  CheckCircle2,
  X,
  Sparkles,
  BookMarked,
  FileText,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Building2,
  Hash,
  StickyNote,
  Pencil,
  Trash2,
} from 'lucide-react';
import { supabase, type Book } from '@/lib/supabase';
import { StarRating } from './StarRating';
import { BookNotesModal } from './BookNotesModal';
import {
  syncBookDateToSupabase,
  syncBookReadPagesToSupabase,
  syncBookPagesToSupabase,
} from '@/lib/bookDates';
import { fetchBookDetails, type BookDetails } from '@/lib/bookCoverApi';

interface BookDetailModalProps {
  book: Book;
  onClose: () => void;
  onUpdateBook: (book: Book) => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
}

export function BookDetailModal({
  book: initialBook,
  onClose,
  onUpdateBook,
  onEditBook,
  onDeleteBook,
}: BookDetailModalProps) {
  const [book, setBook] = useState<Book>(initialBook);
  const [bookDetails, setBookDetails] = useState<BookDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [plotExpanded, setPlotExpanded] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);

  // Sincronizza se il libro cambia esternamente
  useEffect(() => {
    setBook(initialBook);
  }, [initialBook]);

  // Blocca lo scroll del body quando la Scheda Libro è aperta
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Gestione tasto Escape per chiudere la Scheda Libro
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !notesModalOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, notesModalOpen]);

  // Recupera trama e metadati editoriali in italiano
  useEffect(() => {
    let isMounted = true;
    setLoadingDetails(true);
    setPlotExpanded(false);

    fetchBookDetails(book.title, book.author)
      .then(async (details) => {
        if (!isMounted) return;
        setBookDetails(details);

        // Se il libro non aveva il numero di pagine salvato ma l'API lo ha trovato, aggiorniamolo silenziosamente
        if ((!book.pages || book.pages <= 0) && details.pageCount && details.pageCount > 0) {
          await syncBookPagesToSupabase(book.id, details.pageCount);
          const updated = { ...book, pages: details.pageCount };
          setBook(updated);
          onUpdateBook(updated);
        }
      })
      .catch(() => {
        if (isMounted) setBookDetails(null);
      })
      .finally(() => {
        if (isMounted) setLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [book.id, book.title, book.author]);

  const handleRefreshDetails = async () => {
    if (loadingDetails) return;
    setLoadingDetails(true);
    try {
      const details = await fetchBookDetails(book.title, book.author, true);
      setBookDetails(details);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleQuickAddPages = async (added: number) => {
    const current = book.read_pages || 0;
    const max = book.pages || 999999;
    const next = Math.min(max, current + added);
    await supabase
      .from('books')
      .update({ read_pages: next, updated_at: new Date().toISOString() })
      .eq('id', book.id);
    await syncBookReadPagesToSupabase(book.id, next);
    const updated = { ...book, read_pages: next };
    setBook(updated);
    onUpdateBook(updated);
  };

  const handleMarkAsFinished = async () => {
    const now = new Date().toISOString();
    const finalPages = book.pages ?? book.read_pages ?? null;
    await syncBookDateToSupabase(book.id, now);
    if (finalPages) {
      await syncBookReadPagesToSupabase(book.id, finalPages);
    }
    await supabase
      .from('books')
      .update({ status: 'completed', read_at: now, updated_at: now })
      .eq('id', book.id);
    const updated: Book = {
      ...book,
      status: 'completed',
      read_at: now,
      read_pages: finalPages,
    };
    setBook(updated);
    onUpdateBook(updated);
  };

  const handleStatusChange = async (newStatus: Book['status']) => {
    if (book.status === newStatus) return;
    if (newStatus === 'completed') {
      await handleMarkAsFinished();
      return;
    }
    const now = new Date().toISOString();
    // Se si riporta un libro da 'completed' a 'reading' o 'want', pulisce la data di completamento
    if (book.status === 'completed') {
      await syncBookDateToSupabase(book.id, null);
    }
    await supabase
      .from('books')
      .update({
        status: newStatus,
        read_at: book.status === 'completed' ? null : book.read_at,
        updated_at: now,
      })
      .eq('id', book.id);
    const updated: Book = {
      ...book,
      status: newStatus,
      read_at: book.status === 'completed' ? null : book.read_at,
      updated_at: now,
    };
    setBook(updated);
    onUpdateBook(updated);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-detail-title"
        className="fixed inset-0 bg-stone-950/85 light:bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2.5 sm:p-5"
        onClick={onClose}
      >
        <div
          className="bg-stone-900 light:bg-white rounded-3xl border border-stone-800 light:border-stone-200 max-w-xl w-full max-h-[90dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in my-auto overscroll-contain"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Editoriale della Scheda Libro */}
          <div className="relative p-4 sm:p-6 border-b border-stone-800 light:border-stone-200 shrink-0 bg-stone-900 light:bg-white overflow-hidden">
            {/* Sfondo atmosferico sfumato derivato dalla copertina */}
            {book.cover_url && (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-15 light:opacity-10 blur-2xl scale-125 pointer-events-none"
                style={{ backgroundImage: `url(${book.cover_url})` }}
              />
            )}

            {/* Top Bar della Scheda: Badge "Scheda Libro" + Pulsante Chiudi */}
            <div className="relative z-10 flex items-center justify-between mb-3.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 text-[11px] font-sans font-bold uppercase tracking-wider text-amber-400 light:text-amber-800">
                <BookOpen size={12} />
                <span>Scheda Libro</span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-stone-400 light:text-stone-500 hover:text-stone-100 light:hover:text-stone-900 hover:bg-stone-800 light:hover:bg-stone-100 transition-colors shrink-0 cursor-pointer"
                aria-label="Chiudi scheda libro"
              >
                <X size={19} />
              </button>
            </div>

            {/* Copertina 3D + Info Principali */}
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-20 sm:w-24 aspect-[2/3] rounded-xl bg-stone-800 light:bg-stone-100 border border-stone-700 light:border-stone-300 overflow-hidden shrink-0 shadow-xl relative book-spine-effect">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-stone-850 light:bg-stone-100">
                    <BookMarked size={22} className="text-stone-500 mb-1" />
                    <span className="text-[10px] text-stone-400 leading-tight">
                      Nessuna copertina
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <h3
                  id="book-detail-title"
                  className="font-serif font-bold text-lg sm:text-xl text-stone-100 light:text-stone-900 leading-snug"
                >
                  {book.title}
                </h3>
                {bookDetails?.subtitle && (
                  <p className="text-xs text-stone-400 light:text-stone-500 italic line-clamp-1">
                    {bookDetails.subtitle}
                  </p>
                )}
                <p className="text-sm font-semibold text-amber-400 light:text-amber-700">
                  {book.author}
                </p>

                {/* Metadati editoriali (Pagine, Anno, Editore, ISBN) */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  {(book.pages || bookDetails?.pageCount) && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-800/90 light:bg-stone-100 text-stone-300 light:text-stone-700 border border-stone-700/80 light:border-stone-200 tabular-nums">
                      <Layers size={11} className="text-amber-400 light:text-amber-600" />
                      <span>{book.pages || bookDetails?.pageCount} pag.</span>
                    </span>
                  )}

                  {bookDetails?.publishedDate && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-800/90 light:bg-stone-100 text-stone-300 light:text-stone-700 border border-stone-700/80 light:border-stone-200 tabular-nums">
                      <Calendar size={11} className="text-amber-400 light:text-amber-600" />
                      <span>{bookDetails.publishedDate}</span>
                    </span>
                  )}

                  {bookDetails?.publisher && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-800/90 light:bg-stone-100 text-stone-300 light:text-stone-700 border border-stone-700/80 light:border-stone-200 max-w-[160px] truncate">
                      <Building2 size={11} className="text-amber-400 light:text-amber-600 shrink-0" />
                      <span className="truncate">{bookDetails.publisher}</span>
                    </span>
                  )}

                  {bookDetails?.isbn && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-800/60 light:bg-stone-100 text-stone-400 light:text-stone-500 border border-stone-700/60 light:border-stone-200 tabular-nums">
                      <Hash size={10} />
                      <span>{bookDetails.isbn}</span>
                    </span>
                  )}
                </div>

                {/* Categorie / Generi letterari in italiano */}
                {bookDetails?.categories && bookDetails.categories.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                    {bookDetails.categories.map((cat, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 light:bg-amber-50 text-amber-300 light:text-amber-800 border border-amber-500/25 light:border-amber-200"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contenuto scrollabile della Scheda Libro */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
            {/* 1. SEZIONE TRAMA E SINOSSI (SOLO IN ITALIANO) */}
            <div className="bg-stone-850/90 light:bg-stone-50/90 border border-stone-800 light:border-stone-200/90 rounded-2xl p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700">
                    <FileText size={13} />
                  </div>
                  <h4 className="font-serif font-bold text-sm sm:text-base text-stone-100 light:text-stone-900">
                    Trama del libro
                  </h4>
                </div>

                <div className="flex items-center gap-1.5">
                  {bookDetails?.source && bookDetails.description && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-800 light:bg-stone-200/80 text-stone-400 light:text-stone-600 border border-stone-700 light:border-stone-300">
                      da {bookDetails.source}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleRefreshDetails}
                    disabled={loadingDetails}
                    className="p-1 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 light:hover:bg-stone-200/70 transition-colors cursor-pointer disabled:opacity-40"
                    title="Aggiorna trama dal catalogo online"
                    aria-label="Aggiorna trama dal catalogo online"
                  >
                    <RefreshCw
                      size={13}
                      className={loadingDetails ? 'animate-spin text-amber-400' : ''}
                    />
                  </button>
                </div>
              </div>

              {loadingDetails ? (
                <div className="py-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-amber-400 light:text-amber-700 font-medium">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Ricerca della trama in italiano...</span>
                  </div>
                  <div className="space-y-2 animate-pulse">
                    <div className="h-3 bg-stone-800 light:bg-stone-200 rounded w-full" />
                    <div className="h-3 bg-stone-800 light:bg-stone-200 rounded w-11/12" />
                    <div className="h-3 bg-stone-800 light:bg-stone-200 rounded w-4/5" />
                  </div>
                </div>
              ) : bookDetails?.description ? (
                <div>
                  <p
                    className={`text-xs sm:text-sm text-stone-200 light:text-stone-700 leading-relaxed whitespace-pre-line ${
                      !plotExpanded && bookDetails.description.length > 360 ? 'line-clamp-5' : ''
                    }`}
                  >
                    {bookDetails.description}
                  </p>
                  {bookDetails.description.length > 360 && (
                    <button
                      type="button"
                      onClick={() => setPlotExpanded((prev) => !prev)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-400 light:text-amber-700 hover:text-amber-300 cursor-pointer"
                    >
                      {plotExpanded ? (
                        <>
                          <span>Mostra meno</span>
                          <ChevronUp size={14} />
                        </>
                      ) : (
                        <>
                          <span>Leggi tutta la trama</span>
                          <ChevronDown size={14} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="py-2 text-xs text-stone-400 light:text-stone-500 flex items-center justify-between gap-2">
                  <span>
                    Trama in italiano non trovata nei cataloghi per questo titolo. Verifica che titolo e autore siano scritti correttamente.
                  </span>
                  <button
                    type="button"
                    onClick={handleRefreshDetails}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 light:bg-stone-200 text-stone-200 light:text-stone-800 font-medium hover:bg-stone-750 cursor-pointer"
                  >
                    <Sparkles size={11} className="text-amber-400" />
                    <span>Riprova</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. STATO DI LETTURA E VALUTAZIONE PERSONALE */}
            <div className="bg-stone-850/60 light:bg-stone-50/70 border border-stone-800 light:border-stone-200 rounded-2xl p-4 space-y-3.5">
              <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-3 border-b border-stone-800/80 light:border-stone-200/80">
                <span className="text-xs font-semibold text-stone-300 light:text-stone-700">
                  Stato nella tua libreria:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { value: 'want', label: 'Da leggere' },
                      { value: 'reading', label: 'In lettura' },
                      { value: 'completed', label: 'Completato' },
                    ] as const
                  ).map((opt) => {
                    const active = book.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleStatusChange(opt.value)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                          active
                            ? opt.value === 'reading'
                              ? 'bg-amber-500/20 light:bg-amber-100 text-amber-300 light:text-amber-800 border-amber-500/40'
                              : opt.value === 'completed'
                                ? 'bg-emerald-500/20 light:bg-emerald-100 text-emerald-300 light:text-emerald-800 border-emerald-500/40'
                                : 'bg-sky-500/20 light:bg-sky-100 text-sky-300 light:text-sky-800 border-sky-500/40'
                            : 'bg-stone-900/70 light:bg-white text-stone-400 light:text-stone-600 border-stone-750 light:border-stone-200 hover:text-stone-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Valutazione con stelle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-300 light:text-stone-700 font-semibold">
                  La tua valutazione:
                </span>
                <StarRating
                  value={book.rating}
                  onChange={async (newRating) => {
                    const updated = { ...book, rating: newRating };
                    setBook(updated);
                    onUpdateBook(updated);
                    await supabase
                      .from('books')
                      .update({ rating: newRating, updated_at: new Date().toISOString() })
                      .eq('id', book.id);
                  }}
                  size={20}
                />
              </div>
            </div>

            {/* 3. SEZIONE AVANZAMENTO SE IN LETTURA */}
            {book.status === 'reading' && (
              <div className="bg-amber-500/10 light:bg-amber-50 border border-amber-500/20 light:border-amber-200 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-300 light:text-amber-800 flex items-center gap-1">
                    <Flame size={14} />
                    Progresso di lettura:
                  </span>
                  <span className="font-bold text-amber-300 light:text-amber-800 tabular-nums">
                    {book.read_pages || 0}
                    {book.pages ? ` / ${book.pages} pag.` : ' pag.'}
                  </span>
                </div>

                {book.pages && book.pages > 0 && (
                  <div className="w-full bg-stone-800 light:bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((book.read_pages || 0) / book.pages) * 100)}%`,
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-stone-400 light:text-stone-600">Avanza:</span>
                    {[10, 25, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleQuickAddPages(num)}
                        className="text-xs px-2.5 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 light:text-amber-800 font-semibold border border-amber-500/30 cursor-pointer active:scale-95 tabular-nums"
                      >
                        +{num}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleMarkAsFinished}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-400 light:text-emerald-700 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-3 py-1 rounded-lg transition-colors cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 size={13} />
                    <span>Segna come Finito</span>
                  </button>
                </div>
              </div>
            )}

            {/* Data di lettura se completato */}
            {book.status === 'completed' && book.read_at && (
              <div className="flex items-center gap-2 text-xs text-stone-400 light:text-stone-500 bg-stone-850/50 light:bg-stone-100/70 p-3 rounded-xl border border-stone-800 light:border-stone-200">
                <Calendar size={14} className="text-emerald-400 light:text-emerald-600 shrink-0" />
                <span>
                  Completato il{' '}
                  <strong className="text-stone-200 light:text-stone-800">
                    {new Date(book.read_at).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Footer con azioni del libro: Note, Modifica, Elimina */}
          <div className="flex items-center justify-between gap-2 p-4 sm:p-5 border-t border-stone-800 light:border-stone-200 shrink-0 bg-stone-900 light:bg-white">
            <button
              type="button"
              onClick={() => setNotesModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/15 light:bg-amber-50 hover:bg-amber-500/25 light:hover:bg-amber-100 text-amber-300 light:text-amber-800 text-xs font-semibold border border-amber-500/30 light:border-amber-300 transition-colors cursor-pointer shadow-xs active:scale-95"
            >
              <StickyNote size={14} className="text-amber-400 light:text-amber-600" />
              <span>Note e Citazioni ({book.notes_count || 0})</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onEditBook(book);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-stone-300 light:text-stone-700 hover:text-amber-400 light:hover:text-amber-700 bg-stone-800/80 light:bg-stone-100 hover:bg-stone-800 light:hover:bg-stone-200 border border-stone-700/70 light:border-stone-300 transition-colors cursor-pointer"
                title="Modifica libro"
              >
                <Pencil size={14} />
                <span>Modifica</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteBook(book.id);
                  onClose();
                }}
                className="p-2 rounded-xl text-stone-400 hover:text-red-400 hover:bg-stone-800 light:hover:bg-stone-100 transition-colors cursor-pointer"
                title="Elimina libro"
                aria-label="Elimina libro"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {notesModalOpen && (
        <BookNotesModal
          book={book}
          onClose={() => setNotesModalOpen(false)}
          onUpdateBook={(updated) => {
            setBook(updated);
            onUpdateBook(updated);
          }}
        />
      )}
    </>,
    document.body
  );
}

