import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
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
  Search,
  Check,
} from 'lucide-react';
import { supabase, type Book } from '@/lib/supabase';
import { StarRating } from './StarRating';
import { BookNotesModal } from './BookNotesModal';
import { useToast } from './Toast';
import {
  syncBookDateToSupabase,
  syncBookReadPagesToSupabase,
  syncBookPagesToSupabase,
  syncBookPlotToSupabase,
} from '@/lib/bookDates';
import {
  fetchBookDetails,
  searchBookPlotsOnline,
  saveManualBookPlot,
  clearCachedBookDetails,
  type BookDetails,
  type PlotSearchResult,
} from '@/lib/bookCoverApi';

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
  const [bookDetails, setBookDetails] = useState<BookDetails | null>(() => {
    if (initialBook.plot) {
      return {
        description: initialBook.plot,
        publisher: null,
        publishedDate: null,
        categories: [],
        pageCount: initialBook.pages || null,
        isbn: null,
        subtitle: null,
        source: 'Google Books',
      };
    }
    return null;
  });
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [plotExpanded, setPlotExpanded] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const touchStartYRef = useRef<number | null>(null);

  const { toast } = useToast();
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlotSearchResult[]>([]);
  const [searchingPlots, setSearchingPlots] = useState(false);
  const [hasSearchedPlots, setHasSearchedPlots] = useState(false);
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<'all' | 'Google Books' | 'Apple Books' | 'Wikipedia IT' | 'Open Library'>('all');
  const [selectedLangFilter, setSelectedLangFilter] = useState<'all' | 'it' | 'en'>('all');
  const [showEditPlotModal, setShowEditPlotModal] = useState(false);
  const [customPlotText, setCustomPlotText] = useState('');

  const handleOpenSearchModal = (presetQuery?: string) => {
    const q = (presetQuery ?? `${book.title} ${book.author || ''}`).trim();
    setSearchQuery(q);
    setSearchResults([]);
    setHasSearchedPlots(false);
    setSelectedSourceFilter('all');
    setShowSearchModal(true);
    if (q) {
      executePlotSearch(q);
    }
  };

  const executePlotSearch = async (queryToSearch: string) => {
    const q = queryToSearch.trim();
    if (!q) return;
    setSearchingPlots(true);
    setHasSearchedPlots(true);
    try {
      const results = await searchBookPlotsOnline(q, book.author);
      setSearchResults(results);
    } catch {
      toast({ message: 'Errore durante la ricerca online della trama', type: 'error' });
    } finally {
      setSearchingPlots(false);
    }
  };

  const handleApplyPlot = async (result: PlotSearchResult) => {
    if (!result.description) {
      toast({ message: 'Questa voce non include un testo di trama', type: 'info' });
      return;
    }
    const updated = saveManualBookPlot(book.title, book.author, result.description, {
      publisher: result.publisher || bookDetails?.publisher || null,
      publishedDate: result.publishedDate || bookDetails?.publishedDate || null,
      categories:
        result.categories.length > 0
          ? result.categories
          : bookDetails?.categories || [],
      pageCount: result.pageCount || bookDetails?.pageCount || null,
      isbn: result.isbn || bookDetails?.isbn || null,
      subtitle: result.subtitle || bookDetails?.subtitle || null,
      source: result.source,
    });
    setBookDetails(updated);

    await syncBookPlotToSupabase(book.id, result.description);

    let updatedPages = book.pages;
    if ((!book.pages || book.pages <= 0) && result.pageCount && result.pageCount > 0) {
      await syncBookPagesToSupabase(book.id, result.pageCount);
      updatedPages = result.pageCount;
    }

    const updatedBook = { ...book, plot: result.description, pages: updatedPages };
    setBook(updatedBook);
    onUpdateBook(updatedBook);

    setShowSearchModal(false);
    toast({ message: `Trama impostata con successo da ${result.source}!`, type: 'success' });
  };

  const handleOpenEditPlot = () => {
    setCustomPlotText(bookDetails?.description || book.plot || '');
    setShowEditPlotModal(true);
  };

  const handleSaveCustomPlot = async () => {
    const trimmed = customPlotText.trim();
    if (!trimmed) {
      toast({ message: 'Inserisci un testo per la trama', type: 'info' });
      return;
    }
    const updated = saveManualBookPlot(book.title, book.author, trimmed, {
      source: 'Google Books',
    });
    setBookDetails(updated);

    await syncBookPlotToSupabase(book.id, trimmed);
    const updatedBook = { ...book, plot: trimmed };
    setBook(updatedBook);
    onUpdateBook(updatedBook);

    setShowEditPlotModal(false);
    toast({ message: 'Trama salvata con successo!', type: 'success' });
  };

  const handleRemovePlot = async () => {
    try {
      await syncBookPlotToSupabase(book.id, null);
      clearCachedBookDetails(book.title, book.author);
      setBookDetails((prev) => (prev ? { ...prev, description: null } : null));
      const updatedBook = { ...book, plot: null };
      setBook(updatedBook);
      onUpdateBook(updatedBook);
      toast({ message: 'Trama rimossa con successo', type: 'info' });
    } catch {
      toast({ message: 'Impossibile rimuovere la trama', type: 'error' });
    }
  };

  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartYRef.current;
    const deltaY = endY - touchStartYRef.current;
    touchStartYRef.current = null;
    if (deltaY > 55) {
      onClose();
    }
  };

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

    fetchBookDetails(book.title, book.author, false, book.plot)
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
        className="fixed inset-0 bg-stone-950/85 light:bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-5"
        onClick={onClose}
      >
        <div
          className="bg-stone-900 light:bg-white rounded-t-3xl sm:rounded-3xl border-t sm:border border-stone-800 light:border-stone-200 max-w-xl w-full max-h-[82dvh] sm:max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden animate-scale-in overscroll-contain"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Editoriale Compatto della Scheda Libro (con supporto swipe-down da mobile) */}
          <div
            onTouchStart={handleHeaderTouchStart}
            onTouchEnd={handleHeaderTouchEnd}
            className="relative px-3.5 pt-2.5 pb-3.5 sm:p-5 border-b border-stone-800 light:border-stone-200 shrink-0 bg-stone-900 light:bg-white overflow-hidden"
          >
            {/* Indicatore visivo di trascinamento verso il basso su mobile */}
            <div className="w-10 h-1 rounded-full bg-stone-700 light:bg-stone-300 mx-auto mb-2.5 sm:hidden" />

            {/* Copertina 3D + Info Principali + Pulsante Chiudi prominente */}
            <div className="relative z-10 flex items-start gap-3 sm:gap-4">
              <div className="w-16 sm:w-20 md:w-24 aspect-[2/3] rounded-xl bg-stone-800 light:bg-stone-100 border border-stone-700 light:border-stone-300 overflow-hidden shrink-0 shadow-xl relative book-spine-effect">
                {book.cover_url ? (
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-1.5 text-center bg-stone-850 light:bg-stone-100">
                    <BookMarked size={18} className="text-stone-500 mb-0.5" />
                    <span className="text-[9px] text-stone-400 leading-tight">
                      No cover
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3
                      id="book-detail-title"
                      className="font-serif font-bold text-base sm:text-xl text-stone-100 light:text-stone-900 leading-snug line-clamp-2"
                    >
                      {book.title}
                    </h3>
                    {bookDetails?.subtitle && (
                      <p className="text-[11px] sm:text-xs text-stone-400 light:text-stone-500 italic line-clamp-1 mt-0.5">
                        {bookDetails.subtitle}
                      </p>
                    )}
                    <p className="text-xs sm:text-sm font-semibold text-amber-400 light:text-amber-700 mt-0.5 truncate">
                      {book.author}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-9 h-9 rounded-full bg-stone-800/90 light:bg-stone-100 border border-stone-700 light:border-stone-300 flex items-center justify-center text-stone-200 light:text-stone-700 hover:text-stone-100 light:hover:text-stone-950 hover:bg-stone-750 light:hover:bg-stone-200 transition-all shrink-0 cursor-pointer active:scale-95 shadow-sm"
                    aria-label="Chiudi scheda libro"
                    title="Chiudi scheda libro"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Metadati editoriali (Pagine, Anno, Editore, ISBN) */}
                <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                  {(book.pages || bookDetails?.pageCount) && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-stone-800/90 light:bg-stone-100 text-stone-300 light:text-stone-700 border border-stone-700/80 light:border-stone-200 tabular-nums">
                      <Layers size={10} className="text-amber-400 light:text-amber-600" />
                      <span>{book.pages || bookDetails?.pageCount} pag.</span>
                    </span>
                  )}

                  {bookDetails?.publishedDate && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-stone-800/90 light:bg-stone-100 text-stone-300 light:text-stone-700 border border-stone-700/80 light:border-stone-200 tabular-nums">
                      <Calendar size={10} className="text-amber-400 light:text-amber-600" />
                      <span>{bookDetails.publishedDate}</span>
                    </span>
                  )}

                  {bookDetails?.publisher && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-stone-800/90 light:bg-stone-100 text-stone-300 light:text-stone-700 border border-stone-700/80 light:border-stone-200 max-w-[140px] truncate">
                      <Building2 size={10} className="text-amber-400 light:text-amber-600 shrink-0" />
                      <span className="truncate">{bookDetails.publisher}</span>
                    </span>
                  )}

                  {bookDetails?.isbn && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-stone-800/60 light:bg-stone-100 text-stone-400 light:text-stone-500 border border-stone-700/60 light:border-stone-200 tabular-nums">
                      <Hash size={10} />
                      <span>{bookDetails.isbn}</span>
                    </span>
                  )}
                </div>

                {/* Categorie / Generi letterari in italiano */}
                {bookDetails?.categories && bookDetails.categories.length > 0 && (
                  <div className="flex items-center gap-1 pt-0.5 flex-wrap">
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
          <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 flex-1">
            {/* 1. SEZIONE AVANZAMENTO RAPIDO SE IN LETTURA */}
            {book.status === 'reading' && (
              <div className="bg-amber-500/10 light:bg-amber-50 border border-amber-500/20 light:border-amber-200 rounded-2xl p-3 sm:p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-300 light:text-amber-800 flex items-center gap-1">
                    <Flame size={13} />
                    Progresso di lettura:
                  </span>
                  <span className="font-bold text-amber-300 light:text-amber-800 tabular-nums">
                    {book.read_pages || 0}
                    {book.pages ? ` / ${book.pages} pag.` : ' pag.'}
                  </span>
                </div>

                {book.pages && book.pages > 0 && (
                  <div className="w-full bg-stone-800 light:bg-stone-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((book.read_pages || 0) / book.pages) * 100)}%`,
                      }}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-0.5 flex-wrap gap-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-stone-400 light:text-stone-600">Avanza:</span>
                    {[10, 25, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleQuickAddPages(num)}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 light:text-amber-800 font-semibold border border-amber-500/30 cursor-pointer active:scale-95 tabular-nums"
                      >
                        +{num}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleMarkAsFinished}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 light:text-emerald-700 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 size={12} />
                    <span>Finito</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. SEZIONE TRAMA E SINOSSI (VERIFICATA IN ITALIANO + RICERCA MULTI-FONTE) */}
            <div className="bg-stone-850/90 light:bg-stone-50/90 border border-stone-800 light:border-stone-200/90 rounded-2xl p-3.5 sm:p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700">
                    <FileText size={13} />
                  </div>
                  <h4 className="font-serif font-bold text-sm sm:text-base text-stone-100 light:text-stone-900">
                    Trama del libro
                  </h4>
                  {bookDetails?.source && bookDetails.description && (
                    <span className="hidden sm:inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-800 light:bg-stone-200/80 text-stone-400 light:text-stone-600 border border-stone-700 light:border-stone-300">
                      da {bookDetails.source}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Tasto Cerca Online (Google Books + Wikipedia IT + Open Library) */}
                  <button
                    type="button"
                    onClick={() => handleOpenSearchModal()}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-stone-800/90 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200 text-stone-300 light:text-stone-700 hover:text-amber-400 light:hover:text-amber-600 border border-stone-700/80 light:border-stone-300/80 transition-all cursor-pointer shadow-xs"
                    title="Cerca edizioni e trame verificate nei cataloghi online"
                  >
                    <Search size={12} className="text-amber-400 light:text-amber-600" />
                    <span>Cerca trama online</span>
                  </button>

                  {/* Tasto Modifica Manuale */}
                  <button
                    type="button"
                    onClick={handleOpenEditPlot}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-stone-800/90 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200 text-stone-300 light:text-stone-700 hover:text-amber-400 light:hover:text-amber-600 border border-stone-700/80 light:border-stone-300/80 transition-all cursor-pointer shadow-xs"
                    title="Modifica o scrivi la trama manualmente"
                  >
                    <Pencil size={12} />
                    <span className="hidden xs:inline">Modifica</span>
                  </button>

                  {/* Tasto Rimuovi Trama Errata (se presente) */}
                  {bookDetails?.description && (
                    <button
                      type="button"
                      onClick={handleRemovePlot}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-400 hover:bg-stone-800 light:hover:bg-stone-200/70 transition-colors cursor-pointer"
                      title="Rimuovi trama errata"
                      aria-label="Rimuovi trama errata"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}

                  {/* Tasto Ricarica Automatica */}
                  <button
                    type="button"
                    onClick={handleRefreshDetails}
                    disabled={loadingDetails}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-amber-400 hover:bg-stone-800 light:hover:bg-stone-200/70 transition-colors cursor-pointer disabled:opacity-40"
                    title="Ricarica trama automatica dai cataloghi"
                    aria-label="Ricarica trama automatica"
                  >
                    <RefreshCw
                      size={13}
                      className={loadingDetails ? 'animate-spin text-amber-400' : ''}
                    />
                  </button>
                </div>
              </div>

              {loadingDetails ? (
                <div className="py-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-amber-400 light:text-amber-700 font-medium">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Ricerca della trama in italiano...</span>
                  </div>
                  <div className="space-y-1.5 animate-pulse">
                    <div className="h-2.5 bg-stone-800 light:bg-stone-200 rounded w-full" />
                    <div className="h-2.5 bg-stone-800 light:bg-stone-200 rounded w-11/12" />
                    <div className="h-2.5 bg-stone-800 light:bg-stone-200 rounded w-4/5" />
                  </div>
                </div>
              ) : bookDetails?.description ? (
                <div>
                  <p
                    className={`text-xs sm:text-sm text-stone-200 light:text-stone-700 leading-relaxed whitespace-pre-line ${
                      !plotExpanded && bookDetails.description.length > 260
                        ? 'line-clamp-4 sm:line-clamp-5'
                        : ''
                    }`}
                  >
                    {bookDetails.description}
                  </p>
                  {bookDetails.description.length > 260 && (
                    <button
                      type="button"
                      onClick={() => setPlotExpanded((prev) => !prev)}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-400 light:text-amber-700 hover:text-amber-300 cursor-pointer"
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
                <div className="py-2 text-xs text-stone-300 light:text-stone-600 space-y-2.5">
                  <p>
                    Nessuna trama verificata trovata automaticamente per questo libro. Puoi cercarla tra le edizioni online o incollarla manualmente:
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleOpenSearchModal()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 light:bg-amber-100 text-amber-300 light:text-amber-800 border border-amber-500/35 hover:bg-amber-500/30 font-semibold cursor-pointer transition-all active:scale-95 shadow-xs"
                    >
                      <Search size={13} />
                      <span>Cerca trama online</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenEditPlot}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 light:bg-stone-200 text-stone-200 light:text-stone-800 border border-stone-700 light:border-stone-300 hover:bg-stone-750 font-medium cursor-pointer transition-all active:scale-95 shadow-xs"
                    >
                      <Pencil size={13} />
                      <span>Inserisci trama manualmente</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRefreshDetails}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-800/60 light:bg-stone-100 text-stone-400 light:text-stone-600 hover:text-stone-200 border border-stone-750 light:border-stone-300 font-medium cursor-pointer"
                      title="Riprova ricerca automatica"
                    >
                      <Sparkles size={12} className="text-amber-400" />
                      <span>Riprova auto</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. STATO DI LETTURA E VALUTAZIONE PERSONALE */}
            <div className="bg-stone-850/60 light:bg-stone-50/70 border border-stone-800 light:border-stone-200 rounded-2xl p-3 sm:p-4 space-y-2.5">
              <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 pb-2.5 border-b border-stone-800/80 light:border-stone-200/80">
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
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
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
                  size={19}
                />
              </div>
            </div>

            {/* Data di lettura se completato */}
            {book.status === 'completed' && book.read_at && (
              <div className="flex items-center gap-2 text-xs text-stone-400 light:text-stone-500 bg-stone-850/50 light:bg-stone-100/70 p-2.5 sm:p-3 rounded-xl border border-stone-800 light:border-stone-200">
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
          <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] sm:p-4 border-t border-stone-800 light:border-stone-200 shrink-0 bg-stone-900 light:bg-white">
            <button
              type="button"
              onClick={() => setNotesModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 light:bg-amber-50 hover:bg-amber-500/25 light:hover:bg-amber-100 text-amber-300 light:text-amber-800 text-xs font-semibold border border-amber-500/30 light:border-amber-300 transition-colors cursor-pointer shadow-xs active:scale-95"
            >
              <StickyNote size={14} className="text-amber-400 light:text-amber-600 shrink-0" />
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
                <Pencil size={13} />
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
                <Trash2 size={15} />
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

      {/* Modale Ricerca Multi-Fonte Trama (Google Books + Wikipedia IT + Open Library) */}
      {showSearchModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-stone-950/85 light:bg-stone-900/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-up"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            className="bg-stone-900 light:bg-white rounded-t-3xl sm:rounded-2xl border-t sm:border border-stone-800 light:border-stone-200 max-w-xl w-full max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="p-4 border-b border-stone-800 light:border-stone-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 flex items-center justify-center text-amber-400 light:text-amber-700 shrink-0">
                  <Search size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif font-bold text-base text-stone-100 light:text-stone-900 leading-tight">
                    Cerca Trama nei Cataloghi Online
                  </h3>
                  <p className="text-xs text-stone-400 light:text-stone-500 truncate">
                    Google Books • Wikipedia Italia • Open Library
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="w-8 h-8 rounded-full bg-stone-800 light:bg-stone-100 border border-stone-700 light:border-stone-300 flex items-center justify-center text-stone-300 light:text-stone-600 hover:text-stone-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Barra di ricerca */}
            <div className="p-3.5 bg-stone-850/60 light:bg-stone-50 border-b border-stone-800 light:border-stone-200 shrink-0 space-y-2.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executePlotSearch(searchQuery);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Titolo, autore o parole chiave..."
                    className="w-full pl-3 pr-8 py-2 bg-stone-800 light:bg-white border border-stone-700 light:border-stone-300 rounded-xl text-stone-100 light:text-stone-900 text-sm focus:outline-none focus:border-amber-500/60"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={searchingPlots || !searchQuery.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-semibold text-sm flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 shrink-0"
                >
                  {searchingPlots ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                  <span>Cerca</span>
                </button>
              </form>

              {/* Filtri per fonte e lingua */}
              <div className="flex flex-col gap-1.5 pt-0.5 text-[11px]">
                <div className="flex items-center justify-between gap-2 overflow-x-auto">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedSourceFilter('all')}
                      className={`px-2 py-0.5 rounded-lg font-medium transition-colors cursor-pointer ${
                        selectedSourceFilter === 'all'
                          ? 'bg-amber-500 text-stone-950 font-bold'
                          : 'bg-stone-800 light:bg-stone-200 text-stone-300 light:text-stone-700 hover:text-amber-400'
                      }`}
                    >
                      Tutti ({searchResults.length})
                    </button>
                    {(['Apple Books', 'Google Books', 'Wikipedia IT', 'Open Library'] as const).map((src) => {
                      const count = searchResults.filter((r) => r.source === src).length;
                      if (count === 0 && searchResults.length > 0) return null;
                      return (
                        <button
                          key={src}
                          type="button"
                          onClick={() => setSelectedSourceFilter(src)}
                          className={`px-2 py-0.5 rounded-lg font-medium transition-colors cursor-pointer ${
                            selectedSourceFilter === src
                              ? 'bg-amber-500 text-stone-950 font-bold'
                              : 'bg-stone-800 light:bg-stone-200 text-stone-300 light:text-stone-700 hover:text-amber-400'
                          }`}
                        >
                          {src} {count > 0 && `(${count})`}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedLangFilter('all')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                        selectedLangFilter === 'all'
                          ? 'bg-stone-700 light:bg-stone-300 text-amber-400 font-bold'
                          : 'bg-stone-800/80 light:bg-stone-200 text-stone-400 light:text-stone-600 hover:text-amber-400'
                      }`}
                    >
                      Tutte le lingue
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLangFilter('it')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                        selectedLangFilter === 'it'
                          ? 'bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40'
                          : 'bg-stone-800/80 light:bg-stone-200 text-stone-400 light:text-stone-600 hover:text-emerald-400'
                      }`}
                    >
                      Solo 🇮🇹 Italiano
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 text-[10px]">
                  <span className="text-stone-500">Query rapida:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const q = book.title.trim();
                      setSearchQuery(q);
                      executePlotSearch(q);
                    }}
                    className="px-1.5 py-0.5 rounded bg-stone-800/80 light:bg-stone-200 text-stone-400 light:text-stone-600 hover:text-amber-400 cursor-pointer"
                  >
                    Solo titolo
                  </button>
                  {book.author && (
                    <button
                      type="button"
                      onClick={() => {
                        const q = `${book.title} ${book.author}`.trim();
                        setSearchQuery(q);
                        executePlotSearch(q);
                      }}
                      className="px-1.5 py-0.5 rounded bg-stone-800/80 light:bg-stone-200 text-stone-400 light:text-stone-600 hover:text-amber-400 cursor-pointer"
                    >
                      Titolo + Autore
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lista dei risultati trovati */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {searchingPlots ? (
                <div className="py-14 flex flex-col items-center justify-center gap-3 text-stone-400 light:text-stone-500">
                  <Loader2 size={30} className="animate-spin text-amber-500" />
                  <span className="text-sm font-medium">Interrogazione in corso su Apple Books, Google Books, Wikipedia e Open Library...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults
                  .filter((res) => {
                    const matchSource = selectedSourceFilter === 'all' || res.source === selectedSourceFilter;
                    const matchLang = selectedLangFilter === 'all' || res.language === selectedLangFilter;
                    return matchSource && matchLang;
                  })
                  .map((res) => (
                    <div
                      key={res.id}
                      className="bg-stone-850/80 light:bg-stone-50 border border-stone-800 light:border-stone-200 rounded-2xl p-3.5 space-y-2.5 transition-all hover:border-amber-500/40"
                    >
                      <div className="flex items-start gap-3">
                        {res.coverUrl ? (
                          <img
                            src={res.coverUrl}
                            alt={res.title}
                            className="w-12 h-16 object-cover rounded-lg shrink-0 shadow-sm border border-stone-700/60 light:border-stone-300"
                          />
                        ) : (
                          <div className="w-12 h-16 rounded-lg bg-stone-800 light:bg-stone-200 flex items-center justify-center shrink-0 border border-stone-700/60 light:border-stone-300">
                            <BookMarked size={16} className="text-stone-500" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                res.source === 'Google Books'
                                  ? 'bg-amber-500/15 text-amber-300 light:text-amber-800 border-amber-500/30'
                                  : res.source === 'Apple Books'
                                  ? 'bg-rose-500/15 text-rose-300 light:text-rose-800 border-rose-500/30'
                                  : res.source === 'Wikipedia IT'
                                  ? 'bg-sky-500/15 text-sky-300 light:text-sky-800 border-sky-500/30'
                                  : 'bg-purple-500/15 text-purple-300 light:text-purple-800 border-purple-500/30'
                              }`}
                            >
                              {res.source}
                            </span>
                            {res.language === 'it' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 light:text-emerald-800 border border-emerald-500/30">
                                🇮🇹 Italiano
                              </span>
                            ) : res.language === 'en' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 light:text-indigo-800 border border-indigo-500/30">
                                🇬🇧 Lingua originale
                              </span>
                            ) : null}
                            {res.publishedDate && (
                              <span className="text-[10px] text-stone-400 light:text-stone-500">
                                • {res.publishedDate}
                              </span>
                            )}
                            {res.pageCount && (
                              <span className="text-[10px] text-stone-400 light:text-stone-500">
                                • {res.pageCount} pag.
                              </span>
                            )}
                          </div>

                          <h4 className="font-serif font-bold text-sm text-stone-100 light:text-stone-900 leading-snug mt-1">
                            {res.title}
                          </h4>
                          {res.authors.length > 0 && (
                            <p className="text-xs text-amber-400/90 light:text-amber-700 mt-0.5">
                              {res.authors.join(', ')}
                            </p>
                          )}
                          {res.publisher && (
                            <p className="text-[10px] text-stone-400 light:text-stone-500 mt-0.5 truncate">
                              Editore: {res.publisher}
                            </p>
                          )}
                        </div>
                      </div>

                      {res.description && (
                        <div className="space-y-2">
                          <p className="text-xs text-stone-300 light:text-stone-600 line-clamp-4 leading-relaxed bg-stone-900/60 light:bg-white p-2.5 rounded-xl border border-stone-800/80 light:border-stone-200/80">
                            {res.description}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleApplyPlot(res)}
                            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
                          >
                            <Check size={14} strokeWidth={2.5} />
                            <span>Usa questa trama</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              ) : hasSearchedPlots ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-sm text-stone-400 light:text-stone-500">
                    Nessuna trama trovata per "{searchQuery}".
                  </p>
                  <p className="text-xs text-stone-500">
                    Prova a cercare usando solo il titolo o a incollare il testo manualmente.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSearchModal(false);
                      handleOpenEditPlot();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 light:bg-stone-200 text-stone-200 light:text-stone-800 font-medium text-xs hover:bg-stone-750 cursor-pointer"
                  >
                    <Pencil size={12} />
                    <span>Scrivi la trama manualmente</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Modale Inserimento/Modifica Manuale Trama */}
      {showEditPlotModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-stone-950/85 light:bg-stone-900/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-up"
          onClick={() => setShowEditPlotModal(false)}
        >
          <div
            className="bg-stone-900 light:bg-white rounded-t-3xl sm:rounded-2xl border-t sm:border border-stone-800 light:border-stone-200 max-w-lg w-full flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-stone-800 light:border-stone-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 flex items-center justify-center text-amber-400 light:text-amber-700">
                  <Pencil size={15} />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base text-stone-100 light:text-stone-900">
                    Modifica Trama
                  </h3>
                  <p className="text-xs text-stone-400 light:text-stone-500">
                    {book.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditPlotModal(false)}
                className="w-8 h-8 rounded-full bg-stone-800 light:bg-stone-100 border border-stone-700 light:border-stone-300 flex items-center justify-center text-stone-300 light:text-stone-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-stone-400 light:text-stone-600">
                Puoi incollare la trama da un sito, riassunto o retro di copertina:
              </p>
              <textarea
                value={customPlotText}
                onChange={(e) => setCustomPlotText(e.target.value)}
                placeholder="Incolla o scrivi qui la trama del libro..."
                rows={8}
                className="w-full p-3 bg-stone-850 light:bg-stone-50 border border-stone-700 light:border-stone-300 rounded-xl text-stone-100 light:text-stone-900 text-sm leading-relaxed focus:outline-none focus:border-amber-500/60 resize-y"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEditPlotModal(false)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:text-stone-200 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomPlot}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  <Check size={14} />
                  <span>Salva Trama</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

