import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  BookOpen,
  Plus,
  LogOut,
  Library,
  Search,
  BookMarked,
  Trophy,
  Bookmark,
  Flame,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Sun,
  Moon,
  ArrowUpDown,
  ChevronDown,
  Database,
  Calendar,
  X,
  LayoutGrid,
  Pencil,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase, type Book } from '@/lib/supabase';
import { matchesBookSearch } from '@/lib/bookSearch';
import {
  getStoredDates,
  removeBookDate,
  getStoredPages,
  removeBookPages,
  getStoredReadPages,
  removeBookReadPages,
  getStoredPlots,
  removeBookPlot,
  fetchNotesMetadataFromSupabase,
} from '@/lib/bookDates';
import { checkForAppUpdate } from '@/lib/pwaUpdater';
import { BookCard } from './BookCard';
import { EmptyReadingShelf } from './EmptyReadingShelf';
import { BookshelfView } from './BookshelfView';
import { BookDetailModal } from './BookDetailModal';
import { AddBookModal } from './AddBookModal';
import { ReadBooksByYear } from './ReadBooksByYear';
import { ReadingChallenge } from './ReadingChallenge';
import { BackupManager } from './BackupManager';
import { useReadingGoals } from '@/hooks/useReadingGoals';
import { useBookPriority } from '@/hooks/useBookPriority';
import { orderWantBooks } from '@/lib/bookPriority';
import { useToast } from './Toast';
import { LibrarySkeleton } from './Skeletons';
import { SORT_OPTIONS, sortBooks, getStoredSort, storeSort, type SortKey } from '@/lib/sortBooks';
import { APP_VERSION_LABEL } from '@/version';

// Tempo a disposizione per annullare l'eliminazione di un libro
const UNDO_DELETE_MS = 6000;

type ViewTab = 'all' | 'reading' | 'completed' | 'want';

export function Dashboard() {
  const { signOut, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { toast } = useToast();
  const {
    priorityOrder,
    setPriority,
    sortWantBooks,
    shiftBook,
    reorderOnDrop,
    bestBooksOrder,
    setBestBooksOrder,
  } = useBookPriority();
  const [isReorderingWantCards, setIsReorderingWantCards] = useState(false);
  const [draggedCardBookId, setDraggedCardBookId] = useState<string | null>(null);
  const [dragOverCardBookId, setDragOverCardBookId] = useState<string | null>(null);
  const [rawBooks, setBooks] = useState<Book[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const pendingDeletes = useRef<Map<string, { book: Book; timer: ReturnType<typeof setTimeout> }>>(new Map());
  const [sortBy, setSortBy] = useState<SortKey>(() => getStoredSort());
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [inspectingBook, setInspectingBook] = useState<Book | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'shelf'>(() => {
    try {
      const saved = localStorage.getItem('bookshelf_display_mode');
      return saved === 'shelf' ? 'shelf' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleViewModeChange = (mode: 'grid' | 'shelf') => {
    setViewMode(mode);
    try {
      localStorage.setItem('bookshelf_display_mode', mode);
    } catch {
      // ignore
    }
  };

  const { goals, setGoal, refreshGoals } = useReadingGoals();

  // Scorrimento fluido verso la sezione selezionata
  const scrollToSection = useCallback((tab: ViewTab) => {
    // Se l'utente seleziona "Tutti", riporta la vista in cima alla pagina principale
    if (tab === 'all') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
      return;
    }

    const getTarget = (): HTMLElement | null => {
      return (
        document.getElementById(`section-${tab}`) ||
        document.getElementById(`section-${tab}-in-all`) ||
        document.getElementById('search-filter-bar')
      );
    };

    const doScroll = (element: HTMLElement) => {
      // Header non-sticky a scorrimento naturale su tutti i dispositivi
      const headerOffset = 16;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth',
      });
    };

    // Se l'elemento esiste già nel DOM ed è già attivo il tab, scrolla subito
    const existing = getTarget();
    if (existing && activeTab === tab) {
      doScroll(existing);
      return;
    }

    // Se stiamo cambiando tab, attendiamo che React aggiorni il DOM
    setTimeout(() => {
      const el = getTarget();
      if (el) {
        doScroll(el);
      }
    }, 60);
  }, [activeTab]);

  // Feedback tattile stile Apple Taptic Engine su dispositivi supportati
  const triggerHaptic = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(8);
      }
    } catch {
      // Vibrazione non supportata: nessun problema
    }
  }, []);

  const handleSelectTab = useCallback(
    (tab: ViewTab, forceScroll = false) => {
      triggerHaptic();
      // Se l'utente clicca dalla barra di navigazione inferiore sul tab già attivo, torna sempre in cima alla pagina
      if (forceScroll && activeTab === tab) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setActiveTab(tab);

      // Scorrimento automatico solo se richiesto esplicitamente dalla barra inferiore
      if (forceScroll) {
        scrollToSection(tab);
      }
    },
    [activeTab, scrollToSection, triggerHaptic]
  );

  // I libri in attesa di eliminazione definitiva restano nascosti anche dopo una sincronizzazione
  const books = useMemo(
    () => (pendingDeleteIds.length ? rawBooks.filter((b) => !pendingDeleteIds.includes(b.id)) : rawBooks),
    [rawBooks, pendingDeleteIds]
  );

  const loadBooks = useCallback(async (showFullLoader = false) => {
    if (showFullLoader) {
      setLoading(true);
    }
    setIsSyncing(true);

    try {
      // Controlla anche se ci sono nuove versioni dell'app distribuite sul server
      checkForAppUpdate().catch(() => {});

      const { data } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false });

      const [storedLocalDates, storedLocalPages, storedLocalReadPages, storedLocalPlots, notesMeta] = await Promise.all([
        getStoredDates(),
        getStoredPages(),
        getStoredReadPages(),
        getStoredPlots(),
        fetchNotesMetadataFromSupabase(),
      ]);

      const booksWithDatesAndPages = (data ?? []).map((b) => ({
        ...b,
        read_at: b.read_at || notesMeta.dates[b.id] || storedLocalDates[b.id] || null,
        pages: b.pages !== undefined && b.pages !== null ? Number(b.pages) : (notesMeta.pages[b.id] || storedLocalPages[b.id] || null),
        read_pages: b.read_pages !== undefined && b.read_pages !== null
          ? Number(b.read_pages)
          : (notesMeta.readPages[b.id] !== undefined
              ? notesMeta.readPages[b.id]
              : (storedLocalReadPages[b.id] !== undefined
                  ? storedLocalReadPages[b.id]
                  : (b.status === 'completed' && b.pages ? Number(b.pages) : 0))),
        notes_count: notesMeta.counts[b.id] || 0,
        plot: b.plot || notesMeta.plots[b.id] || storedLocalPlots[b.id] || null,
      }));

      setBooks(booksWithDatesAndPages);
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Errore durante la sincronizzazione:', err);
    } finally {
      if (showFullLoader) {
        setLoading(false);
      }
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadBooks(true);

    // 1. Sincronizzazione Realtime via Supabase (modifiche istantanee da qualsiasi dispositivo)
    const channel = supabase
      .channel('books-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'books' },
        () => {
          loadBooks(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        () => {
          loadBooks(false);
        }
      )
      .subscribe();

    // 2. Ricarica quando l'utente rimette in primo piano l'app o il browser
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadBooks(false);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
    };
  }, [loadBooks]);

  const handleAddBook = (book: Book) => {
    setBooks((prev) => [{ ...book, notes_count: book.notes_count ?? 0 }, ...prev]);
    setShowAddModal(false);
    toast({ message: `"${book.title}" aggiunto alla libreria`, type: 'success' });
  };

  const handleOpenEditBook = useCallback((book: Book) => {
    setEditingBook(book);
    setShowAddModal(true);
  }, []);

  // Avvia la lettura del prossimo libro in lista (da "Da leggere" a "In lettura")
  const handleStartReading = async (book: Book) => {
    const { data, error } = await supabase
      .from('books')
      .update({ status: 'reading', updated_at: new Date().toISOString() })
      .eq('id', book.id)
      .select()
      .single();
    if (error || !data) {
      toast({ message: `Impossibile avviare "${book.title}". Riprova.`, type: 'error' });
      return;
    }
    setBooks((prev) =>
      prev.map((b) => (b.id === book.id ? { ...b, ...data, read_at: b.read_at, notes_count: b.notes_count } : b))
    );
    toast({ message: `Buona lettura con "${book.title}"! 📖`, type: 'success' });
  };

  const handleUpdateBook = useCallback((updated: Book) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === updated.id
          ? { ...b, ...updated, notes_count: updated.notes_count ?? b.notes_count ?? 0 }
          : b
      )
    );
    setEditingBook(null);
    setShowAddModal(false);
  }, []);

  // Eliminazione definitiva (dopo il periodo di "Annulla")
  const finalizeDelete = useCallback(async (book: Book) => {
    pendingDeletes.current.delete(book.id);
    const { error } = await supabase.from('books').delete().eq('id', book.id);
    if (error) {
      // Se fallisce, il libro torna visibile e avvisiamo l'utente
      setPendingDeleteIds((prev) => prev.filter((id) => id !== book.id));
      toast({ message: `Impossibile eliminare "${book.title}". Riprova.`, type: 'error' });
      return;
    }
    removeBookDate(book.id);
    removeBookPages(book.id);
    removeBookReadPages(book.id);
    removeBookPlot(book.id);
    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    setPendingDeleteIds((prev) => prev.filter((id) => id !== book.id));
  }, [toast]);

  const handleDeleteBook = useCallback((id: string) => {
    const book = rawBooks.find((b) => b.id === id);
    if (!book) return;

    // 1. Nasconde subito il libro
    setPendingDeleteIds((prev) => [...prev, id]);

    // 2. Pianifica l'eliminazione definitiva
    const timer = setTimeout(() => finalizeDelete(book), UNDO_DELETE_MS);
    pendingDeletes.current.set(id, { book, timer });

    // 3. Offre la possibilità di annullare
    toast({
      message: `"${book.title}" eliminato`,
      type: 'info',
      duration: UNDO_DELETE_MS,
      actionLabel: 'Annulla',
      onAction: () => {
        const pending = pendingDeletes.current.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          pendingDeletes.current.delete(id);
        }
        setPendingDeleteIds((prev) => prev.filter((x) => x !== id));
      },
    });
  }, [rawBooks, finalizeDelete, toast]);

  // Se l'utente esce dalla pagina o dalla Dashboard, conclude subito le eliminazioni in sospeso
  useEffect(() => {
    const flushPending = () => {
      pendingDeletes.current.forEach(({ book, timer }) => {
        clearTimeout(timer);
        finalizeDelete(book);
      });
    };
    window.addEventListener('pagehide', flushPending);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      flushPending();
    };
  }, [finalizeDelete]);

  const handleSortChange = (key: SortKey) => {
    setSortBy(key);
    storeSort(key);
  };

  // Libri filtrati per ricerca globale intelligente
  const searchFilter = (b: Book) => matchesBookSearch(b, search);

  // Suddivisione dei libri per stato (filtrati per ricerca e ordinati)
  const readingBooks = useMemo(
    () => sortBooks(books.filter((b) => b.status === 'reading' && searchFilter(b)), sortBy),
    [books, search, sortBy]
  );

  const wantBooks = useMemo(() => {
    const filtered = books.filter((b) => b.status === 'want' && searchFilter(b));
    if (sortBy === 'title' || sortBy === 'author' || sortBy === 'rating' || sortBy === 'oldest') {
      return sortBooks(filtered, sortBy, priorityOrder);
    }
    return orderWantBooks(filtered, priorityOrder);
  }, [books, search, sortBy, priorityOrder]);

  // Prossime 3 letture secondo la priorità (indipendenti da ricerca e ordinamento)
  const nextWantBooks = useMemo(
    () => orderWantBooks(books.filter((b) => b.status === 'want'), priorityOrder).slice(0, 3),
    [books, priorityOrder]
  );

  const handleCardDropReorder = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      reorderOnDrop(wantBooks, sourceId, targetId);
      if (sortBy !== 'priority') {
        setSortBy('priority');
        storeSort('priority');
      }
    },
    [reorderOnDrop, wantBooks, sortBy]
  );

  const completedBooks = useMemo(
    () => sortBooks(books.filter((b) => b.status === 'completed' && searchFilter(b)), sortBy),
    [books, search, sortBy]
  );

  const inspectingWantRank = useMemo(() => {
    if (!inspectingBook || inspectingBook.status !== 'want') return undefined;
    const sorted = sortWantBooks(rawBooks.filter((b) => b.status === 'want'));
    const idx = sorted.findIndex((b) => b.id === inspectingBook.id);
    return idx >= 0 ? idx + 1 : undefined;
  }, [inspectingBook, rawBooks, sortWantBooks]);


  const totalPagesReading = useMemo(
    () => books.filter((b) => b.status === 'reading').reduce((acc, b) => acc + (b.read_pages || 0), 0),
    [books]
  );

  const stats = {
    total: books.length,
    reading: books.filter((b) => b.status === 'reading').length,
    completed: books.filter((b) => b.status === 'completed').length,
    want: books.filter((b) => b.status === 'want').length,
  };

  // Sezione "In lettura" vuota: proposta delle prossime 3 letture per priorità
  const emptyReadingCard = (
    <div className="rounded-2xl border border-amber-500/20 light:border-amber-200 bg-gradient-to-b from-amber-500/[0.07] to-stone-850/40 light:from-amber-50/80 light:to-white px-4 sm:px-6 pb-5 shadow-xs">
      <EmptyReadingShelf
        nextBooks={nextWantBooks}
        searchQuery={search}
        onStartReading={handleStartReading}
        onAddBook={() => setShowAddModal(true)}
        onOpenBook={setInspectingBook}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-900 light:bg-[#fcfbfa] text-stone-100 light:text-stone-900 transition-colors duration-200">
      {/* Header principale solido, nitido e sticky: estende il colore solido sotto la Safe Area / Status Bar senza sfocature */}
      <header className="sticky top-0 z-40 bg-stone-900 light:bg-[#fcfbfa] border-b border-stone-800 light:border-stone-200/80 transition-colors duration-200 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/15 light:bg-amber-500/15 border border-amber-500/30 light:border-amber-500/30 text-amber-400 light:text-amber-600 shrink-0 shadow-xs">
              <BookOpen size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-lg font-bold text-stone-100 light:text-stone-900 leading-none tracking-tight select-none antialiased">
                Bookshelf
              </h1>
              <p className="text-xs text-stone-400 light:text-stone-500 mt-1 truncate max-w-[170px] xs:max-w-[240px] sm:max-w-xs font-sans">
                {user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle Modalità Chiara / Scura */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-stone-200 light:text-stone-750 hover:text-white light:hover:text-stone-950 bg-stone-800 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200 border border-stone-700 light:border-stone-300 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
              title={isDark ? 'Passa alla modalità chiara' : 'Passa alla modalità scura'}
              aria-label="Cambia tema"
            >
              {isDark ? (
                <Sun size={15} className="text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon size={15} className="text-amber-600 hover:-rotate-12 transition-transform" />
              )}
              <span className="hidden sm:inline">
                {isDark ? 'Chiaro' : 'Scuro'}
              </span>
            </button>

            <button
              onClick={() => loadBooks(false)}
              disabled={isSyncing}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-stone-200 light:text-stone-750 hover:text-white light:hover:text-stone-950 bg-stone-800 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200 border border-stone-700 light:border-stone-300 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-60 shadow-xs active:scale-95"
              title={
                lastSyncedAt
                  ? `Ultimo aggiornamento: ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}. Clicca per sincronizzare subito.`
                  : 'Sincronizza subito con tutti i dispositivi'
              }
            >
              <RefreshCw
                size={14}
                className={`text-amber-400 light:text-amber-600 ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">
                {isSyncing ? 'Sincronizzo...' : 'Sincronizza'}
              </span>
            </button>

            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-stone-400 light:text-stone-600 hover:text-stone-100 light:hover:text-stone-950 px-3 py-1.5 rounded-lg hover:bg-stone-800 light:hover:bg-stone-200/60 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-36 sm:pb-14">
        {/* Obiettivo di lettura annuale */}
        <ReadingChallenge books={books} goals={goals} onSetGoal={setGoal} />

        {/* Selettore Primario delle Sezioni (4 Card Statistiche Interattive e Unificate) */}
        <div className="hidden sm:grid grid-cols-4 gap-1.5 sm:gap-2.5 md:gap-3 mb-4 sm:mb-6">
          <button
            onClick={() => handleSelectTab('all')}
            className={`border rounded-xl sm:rounded-2xl px-1 py-2 sm:p-3 md:p-4 text-center transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-98 ${
              activeTab === 'all'
                ? 'border-amber-500/70 light:border-amber-500 ring-2 ring-amber-500/25 bg-amber-500/10 light:bg-amber-50/90 shadow-md shadow-amber-500/10'
                : 'bg-stone-850/80 light:bg-white border-stone-800/80 light:border-stone-200/90 hover:bg-stone-800/90 light:hover:bg-stone-50 shadow-xs'
            }`}
          >
            <div className="text-lg sm:text-2xl md:text-3xl font-bold font-serif tabular-nums text-stone-100 light:text-stone-900 flex items-center justify-center gap-1.5">
              <span>{stats.total}</span>
              <BookOpen size={17} className="text-amber-400 light:text-amber-600 hidden sm:inline opacity-85" />
            </div>
            <div className="text-[11px] sm:text-xs md:text-sm text-stone-300 light:text-stone-600 mt-0.5 sm:mt-1 font-semibold tracking-normal truncate">Tutti i libri</div>
          </button>

          <button
            onClick={() => handleSelectTab('reading')}
            className={`border rounded-xl sm:rounded-2xl px-1 py-2 sm:p-3 md:p-4 text-center transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-98 ${
              activeTab === 'reading'
                ? 'border-amber-500/70 light:border-amber-500 ring-2 ring-amber-500/25 bg-amber-500/10 light:bg-amber-50/90 shadow-md shadow-amber-500/10'
                : 'bg-stone-850/80 light:bg-white border-stone-800/80 light:border-stone-200/90 hover:bg-stone-800/90 light:hover:bg-stone-50 shadow-xs'
            }`}
          >
            <div className="text-lg sm:text-2xl md:text-3xl font-bold font-serif tabular-nums text-amber-400 light:text-amber-700 flex items-center justify-center gap-1.5">
              <span>{stats.reading}</span>
              <Flame size={18} className="text-amber-400 light:text-amber-600 hidden sm:inline" />
            </div>
            <div className="text-[11px] sm:text-xs md:text-sm text-stone-300 light:text-stone-600 mt-0.5 sm:mt-1 font-semibold tracking-normal truncate">In lettura</div>
          </button>

          <button
            onClick={() => handleSelectTab('completed')}
            className={`border rounded-xl sm:rounded-2xl px-1 py-2 sm:p-3 md:p-4 text-center transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-98 ${
              activeTab === 'completed'
                ? 'border-emerald-500/70 light:border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-950/30 light:bg-emerald-50/90 shadow-md shadow-emerald-500/10'
                : 'bg-stone-850/80 light:bg-white border-stone-800/80 light:border-stone-200/90 hover:bg-stone-800/90 light:hover:bg-stone-50 shadow-xs'
            }`}
          >
            <div className="text-lg sm:text-2xl md:text-3xl font-bold font-serif tabular-nums text-emerald-400 light:text-emerald-700 flex items-center justify-center gap-1.5">
              <span>{stats.completed}</span>
              <Trophy size={18} className="text-emerald-400 light:text-emerald-600 hidden sm:inline" />
            </div>
            <div className="text-[11px] sm:text-xs md:text-sm text-stone-300 light:text-stone-600 mt-0.5 sm:mt-1 font-semibold tracking-normal truncate">Letti<span className="hidden sm:inline"> (per anno)</span></div>
          </button>

          <button
            onClick={() => handleSelectTab('want')}
            className={`border rounded-xl sm:rounded-2xl px-1 py-2 sm:p-3 md:p-4 text-center transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-98 ${
              activeTab === 'want'
                ? 'border-sky-500/70 light:border-sky-500 ring-2 ring-sky-500/25 bg-sky-950/30 light:bg-sky-50/90 shadow-md shadow-sky-500/10'
                : 'bg-stone-850/80 light:bg-white border-stone-800/80 light:border-stone-200/90 hover:bg-stone-800/90 light:hover:bg-stone-50 shadow-xs'
            }`}
          >
            <div className="text-lg sm:text-2xl md:text-3xl font-bold font-serif tabular-nums text-sky-400 light:text-sky-700 flex items-center justify-center gap-1.5">
              <span>{stats.want}</span>
              <Bookmark size={17} className="text-sky-400 light:text-sky-600 hidden sm:inline opacity-85" />
            </div>
            <div className="text-[11px] sm:text-xs md:text-sm text-stone-300 light:text-stone-600 mt-0.5 sm:mt-1 font-semibold tracking-normal truncate">Da leggere</div>
          </button>
        </div>

        {/* Barra Ricerca, Ordinamento, Vista e Aggiungi Libro (responsive per mobile, tablet e desktop) */}
        <div id="search-filter-bar" className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 mb-5 sm:mb-6 scroll-mt-20">
          <div className="relative flex-1 min-w-0">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per titolo o autore..."
              className="w-full pl-10 pr-16 py-2.5 sm:py-3 bg-stone-850/70 light:bg-white border border-stone-700 light:border-stone-300 rounded-xl text-stone-100 light:text-stone-900 text-sm sm:text-base placeholder-stone-400 light:placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 light:text-stone-500 hover:text-stone-200 light:hover:text-stone-800 cursor-pointer"
              >
                Cancella
              </button>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5">
            <div className="relative flex-1 sm:flex-1 lg:w-52 min-w-[145px]">
              <ArrowUpDown
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 light:text-amber-600 pointer-events-none"
              />
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as SortKey)}
                aria-label="Ordina libri"
                className="w-full appearance-none pl-9 pr-8 py-2.5 sm:py-3 bg-stone-850/70 light:bg-white border border-stone-700 light:border-stone-300 rounded-xl text-xs sm:text-sm text-stone-100 light:text-stone-900 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors shadow-xs cursor-pointer truncate"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-stone-900 light:bg-white text-stone-100 light:text-stone-900">
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none"
              />
            </div>

            {/* Toggle Vista: Schede vs Scaffale */}
            <div className="flex items-center bg-stone-850/70 light:bg-white border border-stone-700 light:border-stone-300 rounded-xl p-1 shrink-0 justify-center">
              <button
                type="button"
                onClick={() => handleViewModeChange('grid')}
                className={`flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-amber-500 text-stone-900 font-semibold shadow-xs'
                    : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                }`}
                title="Vista a schede dettagliate"
              >
                <LayoutGrid size={15} />
                <span>Schede</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('shelf')}
                className={`flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  viewMode === 'shelf'
                    ? 'bg-amber-500 text-stone-900 font-semibold shadow-xs'
                    : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                }`}
                title="Vista libreria a scaffale con libri fisici"
              >
                <Library size={15} />
                <span>Scaffale</span>
              </button>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="hidden sm:flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 sm:px-5 bg-amber-500 hover:bg-amber-400 active:scale-98 text-stone-900 font-semibold rounded-xl transition-all whitespace-nowrap shadow-md shadow-amber-500/10 cursor-pointer shrink-0 text-sm"
            >
              <Plus size={19} />
              <span>Aggiungi libro</span>
            </button>
          </div>
        </div>

        {/* Contenuto dinamico in base alla modalità di visualizzazione (Schede vs Scaffale) e sezione */}
        {loading ? (
          <LibrarySkeleton />
        ) : viewMode === 'shelf' ? (
          <BookshelfView
            books={books}
            readingBooks={readingBooks}
            completedBooks={completedBooks}
            wantBooks={wantBooks}
            activeTab={activeTab}
            searchQuery={search}
            onUpdateBook={handleUpdateBook}
            onDeleteBook={handleDeleteBook}
            onEditBook={handleOpenEditBook}
            onAddBook={() => setShowAddModal(true)}
            onStartReading={handleStartReading}
            onSelectTab={handleSelectTab}
            priorityOrder={priorityOrder}
            onUpdatePriorityOrder={(newOrder) => {
              setPriority(newOrder);
              toast({ message: 'Ordine di lettura aggiornato', type: 'success' });
            }}
            bestBooksOrder={bestBooksOrder}
            onUpdateBestBooksOrder={(newOrder) => {
              setBestBooksOrder(newOrder);
              toast({ message: 'Classifica dei migliori libri aggiornata', type: 'success' });
            }}
          />
        ) : activeTab === 'completed' ? (
          /* VISTA: Libri Letti suddivisi e raggruppati per Anno */
          <div id="section-completed" className="scroll-mt-20">
            <ReadBooksByYear
              books={completedBooks}
              onUpdate={handleUpdateBook}
              onDelete={handleDeleteBook}
              onEdit={handleOpenEditBook}
              onInspect={setInspectingBook}
              searchQuery={search}
              goals={goals}
              sortBy={sortBy}
            />
          </div>
        ) : activeTab === 'reading' ? (
          /* VISTA: Solo libri In Lettura (In Evidenza) */
          <div id="section-reading" className="space-y-4 scroll-mt-20">
            <div className="flex items-center justify-between border-b border-amber-500/20 light:border-amber-300/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700">
                  <Flame size={18} />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-stone-100 light:text-stone-900">
                    Attualmente In Lettura
                  </h2>
                  <p className="text-xs text-stone-400 light:text-stone-500">I libri che stai leggendo adesso</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 light:bg-amber-50 text-amber-400 light:text-amber-700 border border-amber-500/20 light:border-amber-300/60">
                  {readingBooks.length} {readingBooks.length === 1 ? 'libro' : 'libri'}
                </span>
                {totalPagesReading > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 light:bg-amber-100 text-amber-400 light:text-amber-800 border border-amber-500/30 light:border-amber-300 flex items-center gap-1">
                    <Flame size={12} />
                    {totalPagesReading.toLocaleString('it-IT')} pag. lette finora
                  </span>
                )}
              </div>
            </div>

            {readingBooks.length === 0 ? (
              emptyReadingCard
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {readingBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onUpdate={handleUpdateBook}
                    onDelete={handleDeleteBook}
                    onEdit={handleOpenEditBook}
                    onInspect={setInspectingBook}
                    highlight={true}
                  />
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'want' ? (
          /* VISTA: Solo libri Da Leggere */
          <div id="section-want" className="space-y-4 scroll-mt-20">
            <div className="flex items-center justify-between border-b border-stone-800 light:border-stone-200 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 light:bg-sky-100 border border-sky-500/25 light:border-sky-300 flex items-center justify-center text-sky-400 light:text-sky-700">
                  <Bookmark size={18} />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-stone-100 light:text-stone-900">Da Leggere</h2>
                  <p className="text-xs text-stone-400 light:text-stone-500">
                    La tua lista dei desideri e prossime letture
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {wantBooks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setIsReorderingWantCards((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 ${
                      isReorderingWantCards
                        ? 'bg-sky-500 text-stone-950 font-bold shadow-xs ring-1 ring-sky-300'
                        : 'bg-stone-850 light:bg-white text-sky-400 light:text-sky-700 border border-sky-500/30 hover:border-sky-400 hover:bg-sky-500/10'
                    }`}
                    title="Modifica priorità di lettura tramite Drag and Drop"
                  >
                    <Pencil size={12} />
                    <span>{isReorderingWantCards ? 'Fine' : 'Modifica ordine'}</span>
                  </button>
                )}
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 light:bg-sky-50 text-sky-400 light:text-sky-700 border border-sky-500/20 light:border-sky-300/60">
                  {wantBooks.length} {wantBooks.length === 1 ? 'libro' : 'libri'}
                </span>
              </div>
            </div>

            {/* Messaggio guida quando la modalità riordino è attiva */}
            {isReorderingWantCards && wantBooks.length > 1 && (
              <div className="px-3.5 py-2.5 rounded-xl bg-sky-950/60 light:bg-sky-50 border border-sky-500/30 flex items-center justify-between gap-3 text-xs text-sky-200 light:text-sky-900 shadow-inner">
                <div className="flex items-center gap-2">
                  <Bookmark size={14} className="shrink-0 text-sky-400" />
                  <span>
                    <strong>Drag and Drop attivo:</strong> trascina una scheda sopra un'altra per posizionarla nell'ordine desiderato (il <strong>#1</strong> è il prossimo).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReorderingWantCards(false)}
                  className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-stone-950 font-bold text-[11px] shrink-0 cursor-pointer shadow-xs"
                >
                  Salva ordine
                </button>
              </div>
            )}

            {wantBooks.length === 0 ? (
              <div className="bg-stone-850/30 light:bg-white border border-stone-800/80 light:border-stone-200/90 rounded-xl p-8 text-center shadow-xs">
                <Library size={36} className="mx-auto text-stone-600 light:text-stone-400 mb-2" />
                <p className="text-sm font-medium text-stone-300 light:text-stone-800">
                  Nessun libro nella lista da leggere
                </p>
                <p className="text-xs text-stone-500 light:text-stone-500 mt-1 mb-4">
                  Aggiungi i libri che desideri leggere prossimamente.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs py-2 px-3.5 bg-stone-800 light:bg-stone-100 hover:bg-stone-700 light:hover:bg-stone-200 text-stone-200 light:text-stone-800 border border-stone-700 light:border-stone-300 rounded-lg transition-colors font-medium cursor-pointer"
                >
                  <Plus size={15} />
                  Aggiungi a "Da leggere"
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {wantBooks.map((book, idx) => (
                  <div
                    key={book.id}
                    draggable={isReorderingWantCards || wantBooks.length > 1}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', book.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedCardBookId(book.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverCardBookId !== book.id) {
                        setDragOverCardBookId(book.id);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (dragOverCardBookId === book.id) {
                        setDragOverCardBookId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const sourceId = e.dataTransfer.getData('text/plain') || draggedCardBookId;
                      if (sourceId && sourceId !== book.id) {
                        handleCardDropReorder(sourceId, book.id);
                      }
                      setDraggedCardBookId(null);
                      setDragOverCardBookId(null);
                    }}
                    className={`transition-all duration-200 rounded-2xl ${
                      draggedCardBookId === book.id ? 'opacity-40 scale-[0.98]' : ''
                    } ${
                      dragOverCardBookId === book.id
                        ? 'ring-2 ring-sky-400 border-sky-400 scale-[1.01] shadow-lg shadow-sky-500/20'
                        : ''
                    } ${
                      isReorderingWantCards ? 'cursor-grab active:cursor-grabbing' : ''
                    }`}
                  >
                    <BookCard
                      book={book}
                      priorityRank={idx + 1}
                      totalWantCount={wantBooks.length}
                      isDraggable={isReorderingWantCards}
                      onUpdate={handleUpdateBook}
                      onDelete={handleDeleteBook}
                      onEdit={handleOpenEditBook}
                      onInspect={setInspectingBook}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* VISTA: TUTTI I LIBRI (mostra tutti i libri: in lettura in evidenza + da leggere + completati) */
          <div id="section-all" className="space-y-10 scroll-mt-20">
            {books.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-stone-500 light:text-stone-400">
                <Library size={48} className="mb-4 text-stone-700 light:text-stone-300" />
                <h3 className="font-serif text-xl text-stone-300 light:text-stone-800 mb-1">Il tuo scaffale è vuoto</h3>
                <p className="text-sm text-stone-500 light:text-stone-500 mb-4">
                  Inizia aggiungendo il primo libro
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 py-2 px-4 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Plus size={18} />
                  Aggiungi libro
                </button>
              </div>
            ) : (
              <>
                {/* 0. NESSUN LIBRO IN LETTURA: proponi i prossimi 3 per priorità */}
                {stats.reading === 0 && !search && (
                  <section id="section-reading-in-all" className="space-y-4 scroll-mt-20">
                    <div className="flex items-center gap-2.5 border-b border-amber-500/20 light:border-amber-300/40 pb-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700">
                        <Flame size={18} />
                      </div>
                      <div>
                        <h2 className="font-serif text-xl font-bold text-stone-100 light:text-stone-900">In Lettura</h2>
                        <p className="text-xs text-stone-400 light:text-stone-500">Le prossime letture in ordine di priorità</p>
                      </div>
                    </div>
                    {emptyReadingCard}
                  </section>
                )}

                {/* 1. SEZIONE IN LETTURA (IN EVIDENZA) */}
                {readingBooks.length > 0 && (
                  <section id="section-reading-in-all" className="space-y-4 scroll-mt-20">
                    <div className="flex items-center justify-between border-b border-amber-500/20 light:border-amber-300/40 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700">
                          <Flame size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-serif text-xl font-bold text-stone-100 light:text-stone-900">
                              In Lettura
                            </h2>
                            <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded bg-amber-500/20 light:bg-amber-100 text-amber-300 light:text-amber-800 border border-amber-500/30 light:border-amber-300">
                              In Evidenza
                            </span>
                          </div>
                          <p className="text-xs text-stone-400 light:text-stone-500">
                            I libri che stai leggendo attualmente
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 light:bg-amber-50 text-amber-400 light:text-amber-700 border border-amber-500/20 light:border-amber-300/60 whitespace-nowrap shrink-0">
                        {readingBooks.length} {readingBooks.length === 1 ? 'libro' : 'libri'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {readingBooks.map((book) => (
                        <BookCard
                          key={book.id}
                          book={book}
                          onUpdate={handleUpdateBook}
                          onDelete={handleDeleteBook}
                          onEdit={handleOpenEditBook}
                          onInspect={setInspectingBook}
                          highlight={true}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* 2. SEZIONE DA LEGGERE */}
                {wantBooks.length > 0 && (
                  <section id="section-want-in-all" className="space-y-4 scroll-mt-20">
                    <div className="flex items-center justify-between border-b border-stone-800 light:border-stone-200 pb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/15 light:bg-sky-100 border border-sky-500/25 light:border-sky-300 flex items-center justify-center text-sky-400 light:text-sky-700">
                          <Bookmark size={18} />
                        </div>
                        <div>
                          <h2 className="font-serif text-xl font-bold text-stone-100 light:text-stone-900">Da Leggere</h2>
                          <p className="text-xs text-stone-400 light:text-stone-500">
                            La tua lista dei desideri e prossime letture
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {wantBooks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setIsReorderingWantCards((v) => !v)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 ${
                              isReorderingWantCards
                                ? 'bg-sky-500 text-stone-950 font-bold shadow-xs ring-1 ring-sky-300'
                                : 'bg-stone-850 light:bg-white text-sky-400 light:text-sky-700 border border-sky-500/30 hover:border-sky-400 hover:bg-sky-500/10'
                            }`}
                            title="Modifica priorità di lettura tramite Drag and Drop"
                          >
                            <Pencil size={12} />
                            <span>{isReorderingWantCards ? 'Fine' : 'Modifica ordine'}</span>
                          </button>
                        )}
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 light:bg-sky-50 text-sky-400 light:text-sky-700 border border-sky-500/20 light:border-sky-300/60 whitespace-nowrap shrink-0">
                          {wantBooks.length} {wantBooks.length === 1 ? 'libro' : 'libri'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {wantBooks.map((book, idx) => (
                        <div
                          key={book.id}
                          draggable={isReorderingWantCards || wantBooks.length > 1}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', book.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedCardBookId(book.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverCardBookId !== book.id) {
                              setDragOverCardBookId(book.id);
                            }
                          }}
                          onDragLeave={(e) => {
                            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                            if (dragOverCardBookId === book.id) {
                              setDragOverCardBookId(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const sourceId = e.dataTransfer.getData('text/plain') || draggedCardBookId;
                            if (sourceId && sourceId !== book.id) {
                              handleCardDropReorder(sourceId, book.id);
                            }
                            setDraggedCardBookId(null);
                            setDragOverCardBookId(null);
                          }}
                          className={`transition-all duration-200 rounded-2xl ${
                            draggedCardBookId === book.id ? 'opacity-40 scale-[0.98]' : ''
                          } ${
                            dragOverCardBookId === book.id
                              ? 'ring-2 ring-sky-400 border-sky-400 scale-[1.01] shadow-lg shadow-sky-500/20'
                              : ''
                          } ${
                            isReorderingWantCards ? 'cursor-grab active:cursor-grabbing' : ''
                          }`}
                        >
                          <BookCard
                            book={book}
                            priorityRank={idx + 1}
                            totalWantCount={wantBooks.length}
                            isDraggable={isReorderingWantCards}
                            onUpdate={handleUpdateBook}
                            onDelete={handleDeleteBook}
                            onEdit={handleOpenEditBook}
                            onInspect={setInspectingBook}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. SEZIONE GIÀ LETTI (COMPLETATI) - VISIBILE QUANDO CLICCHI 'TUTTI I LIBRI' */}
                {completedBooks.length > 0 && (
                  <section id="section-completed-in-all" className="space-y-4 scroll-mt-20">
                    {/* Intestazione Sezione Già Letti */}
                    <div className="flex items-center justify-between border-b border-emerald-500/20 light:border-emerald-300/40 pb-3 gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 light:bg-emerald-100 border border-emerald-500/30 light:border-emerald-300 flex items-center justify-center text-emerald-400 light:text-emerald-700 shrink-0">
                          <CheckCircle2 size={18} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-serif text-xl font-bold text-stone-100 light:text-stone-900 truncate">
                            Già Letti
                          </h2>
                          <p className="text-xs text-stone-400 light:text-stone-500 truncate">
                            I libri che hai terminato di leggere
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 light:bg-emerald-50 text-emerald-400 light:text-emerald-700 border border-emerald-500/20 light:border-emerald-300/60 whitespace-nowrap shrink-0">
                        {completedBooks.length} {completedBooks.length === 1 ? 'libro' : 'libri'}
                      </span>
                    </div>

                    {/* Banner Interattivo Elegante per accedere all'Archivio per Anno */}
                    <button
                      onClick={() => handleSelectTab('completed', true)}
                      className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-stone-850/80 to-stone-850/60 light:from-emerald-50/90 light:via-stone-50 light:to-white border border-emerald-500/25 light:border-emerald-200/90 hover:border-emerald-500/45 light:hover:border-emerald-400 transition-all text-left shadow-xs hover:shadow-md hover:shadow-emerald-500/5 active:scale-[0.99] cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 light:bg-emerald-100 border border-emerald-500/30 light:border-emerald-300 flex items-center justify-center text-emerald-400 light:text-emerald-700 shrink-0 group-hover:scale-105 transition-transform">
                          <Calendar size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-sm sm:text-base text-stone-100 light:text-stone-900">
                              Archivio Storico per Anno
                            </span>
                            <span className="hidden sm:inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 light:bg-emerald-100 text-emerald-300 light:text-emerald-800 border border-emerald-500/30">
                              Cronologia
                            </span>
                          </div>
                          <p className="text-xs text-stone-400 light:text-stone-500 mt-0.5 truncate">
                            Consulta tutti i libri suddivisi per anno di lettura e statistiche
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 light:text-emerald-700 bg-emerald-500/10 light:bg-emerald-100/90 px-3 py-1.5 rounded-xl border border-emerald-500/20 light:border-emerald-300/60 shrink-0 group-hover:bg-emerald-500/20 transition-all">
                        <span className="whitespace-nowrap">Apri archivio</span>
                        <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {completedBooks.map((book) => (
                        <BookCard
                          key={book.id}
                          book={book}
                          onUpdate={handleUpdateBook}
                          onDelete={handleDeleteBook}
                          onEdit={handleOpenEditBook}
                          onInspect={setInspectingBook}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Nessun risultato se la ricerca non trova nulla */}
                {search &&
                  readingBooks.length === 0 &&
                  wantBooks.length === 0 &&
                  completedBooks.length === 0 && (
                    <div className="text-center py-16 text-stone-400">
                      <BookMarked size={40} className="mx-auto mb-3 text-stone-600" />
                      <p className="font-medium text-stone-300">Nessun libro trovato</p>
                      <p className="text-xs text-stone-500 mt-1">
                        Nessun libro corrisponde a "{search}"
                      </p>
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        {/* Footer elegante con link per la gestione dati e backup */}
        <div className="mt-14 pt-6 border-t border-stone-800/80 light:border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 light:text-stone-400">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start text-stone-400 light:text-stone-500">
            <span className="font-serif italic font-medium text-stone-300 light:text-stone-700">Bookshelf</span>
            <span className="text-stone-600 light:text-stone-300">·</span>
            <span>{stats.total} {stats.total === 1 ? 'libro registrato' : 'libri registrati'}</span>
            <span className="text-stone-600 light:text-stone-300">·</span>
            <span className="font-mono text-[11px] text-stone-500 light:text-stone-400 select-none">
              {APP_VERSION_LABEL}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowBackupModal(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-850 light:bg-stone-100 hover:bg-stone-800 light:hover:bg-stone-200 text-stone-200 light:text-stone-800 border border-stone-750 light:border-stone-300 transition-all cursor-pointer shadow-xs active:scale-95 group font-medium"
            title="Esporta o ripristina la libreria in formato JSON"
          >
            <Database size={13} className="text-amber-400 light:text-amber-600 group-hover:scale-110 transition-transform" />
            <span>Gestione Backup e Dati JSON</span>
          </button>
        </div>
      </main>

      {/* Barra di Navigazione Mobile: capsula flottante con indicatore della sezione attiva e contatori */}
      <nav
        aria-label="Navigazione rapida mobile"
        className="sm:hidden fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(0.5rem,calc(env(safe-area-inset-bottom,0px)+0.25rem))] pointer-events-none"
      >
        <div className="pointer-events-auto max-w-lg mx-auto grid grid-cols-[1fr_1fr_64px_1fr_1fr] items-center h-[70px] px-1 rounded-[28px] border border-white/[0.07] light:border-stone-200/90 bg-stone-900/[0.94] light:bg-white/[0.95] backdrop-blur-md shadow-[0_10px_30px_-8px_rgba(0,0,0,0.65)] light:shadow-[0_10px_30px_-10px_rgba(120,90,60,0.35)]">
          {([
            { key: 'all', label: 'Tutti', Icon: BookOpen, count: 0 },
            { key: 'reading', label: 'In lettura', Icon: Flame, count: stats.reading },
            null,
            { key: 'completed', label: 'Letti', Icon: Trophy, count: 0 },
            { key: 'want', label: 'Da leggere', Icon: Bookmark, count: stats.want },
          ] as const).map((tab) => {
            if (!tab) {
              return (
                <div key="add" className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setShowAddModal(true);
                    }}
                    className="w-[52px] h-[52px] rounded-[19px] bg-gradient-to-b from-[#fbb034] to-[#e8890b] text-stone-950 flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(245,158,11,0.6),inset_0_1px_0_rgba(255,255,255,0.45)] active:scale-90 transition-transform duration-150 cursor-pointer"
                    title="Aggiungi nuovo libro"
                    aria-label="Aggiungi libro"
                  >
                    <Plus size={24} strokeWidth={2.6} />
                  </button>
                </div>
              );
            }
            const isActive = activeTab === tab.key;
            const { Icon } = tab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleSelectTab(tab.key, true)}
                aria-current={isActive ? 'page' : undefined}
                className={`group flex flex-col items-center justify-center gap-1 h-full min-w-0 cursor-pointer select-none transition-colors duration-200 ${
                  isActive
                    ? 'text-amber-400 light:text-amber-700'
                    : 'text-stone-400 light:text-stone-500 active:text-stone-200 light:active:text-stone-800'
                }`}
              >
                <span
                  className={`relative flex items-center justify-center w-14 h-8 rounded-full transition-[background-color,transform] duration-200 group-active:scale-90 ${
                    isActive ? 'bg-amber-500/15 light:bg-amber-100' : 'bg-transparent'
                  }`}
                >
                  <Icon size={21} strokeWidth={isActive ? 2.3 : 1.9} />
                  {tab.count > 0 && (
                    <span className="absolute -top-1 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-stone-950 text-[10px] font-bold leading-4 text-center tabular-nums ring-2 ring-stone-900 light:ring-white">
                      {tab.count > 99 ? '99+' : tab.count}
                    </span>
                  )}
                </span>
                <span className={`text-[11.5px] leading-none whitespace-nowrap tracking-[-0.01em] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Scheda Libro Completa (aperta dalla vista a schede) */}
      {inspectingBook && (
        <BookDetailModal
          book={inspectingBook}
          onClose={() => setInspectingBook(null)}
          onUpdateBook={(updated) => {
            handleUpdateBook(updated);
            setInspectingBook(updated);
          }}
          onEditBook={(book) => {
            setInspectingBook(null);
            handleOpenEditBook(book);
          }}
          onDeleteBook={(id) => {
            setInspectingBook(null);
            handleDeleteBook(id);
          }}
          priorityRank={inspectingWantRank}
          totalWantCount={wantBooks.length}
          onShiftPriority={
            inspectingBook.status === 'want'
              ? (direction) => {
                  shiftBook(wantBooks, inspectingBook.id, direction);
                  if (sortBy !== 'priority') {
                    setSortBy('priority');
                    storeSort('priority');
                  }
                }
              : undefined
          }
        />
      )}

      {/* Modale Aggiungi / Modifica Libro */}
      {showAddModal && (
        <AddBookModal
          book={editingBook}
          onClose={() => {
            setShowAddModal(false);
            setEditingBook(null);
          }}
          onAdd={handleAddBook}
          onUpdate={handleUpdateBook}
        />
      )}

      {/* Modale Backup e Dati */}
      {showBackupModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gestione Backup e Dati"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-up"
          onClick={() => setShowBackupModal(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowBackupModal(false);
          }}
        >
          <div
            className="bg-stone-900 light:bg-white rounded-t-3xl sm:rounded-3xl border-t sm:border border-stone-800/90 light:border-stone-200 max-w-2xl w-full shadow-2xl max-h-[82dvh] sm:max-h-[85dvh] flex flex-col overflow-hidden overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3.5 sm:p-6 border-b border-stone-800 light:border-stone-200 shrink-0 bg-stone-900 light:bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-600 shrink-0">
                  <Database size={20} />
                </div>
                <div>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-100 light:text-stone-900 leading-tight">
                    Gestione Backup e Dati
                  </h2>
                  <p className="text-xs text-stone-400 light:text-stone-500">
                    Esporta o ripristina la tua libreria in formato JSON
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBackupModal(false)}
                className="w-9 h-9 rounded-full bg-stone-800/90 light:bg-stone-100 border border-stone-700 light:border-stone-300 flex items-center justify-center text-stone-200 light:text-stone-700 hover:text-stone-100 light:hover:text-stone-900 hover:bg-stone-750 light:hover:bg-stone-200 transition-colors cursor-pointer shrink-0 active:scale-95"
                aria-label="Chiudi finestra"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] sm:pb-6 overflow-y-auto flex-1">
              <BackupManager
                books={books}
                goals={goals}
                onRestoreCompleted={() => {
                  loadBooks(true);
                  refreshGoals();
                  setShowBackupModal(false);
                  toast({ message: 'Backup ripristinato con successo! Libreria aggiornata. 📚', type: 'success' });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
