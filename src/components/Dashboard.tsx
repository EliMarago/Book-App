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
  Layers,
  ArrowUpDown,
  ChevronDown,
  Database,
  Calendar,
  X,
  LayoutGrid,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase, type Book } from '@/lib/supabase';
import { getStoredDates, removeBookDate, getStoredPages, removeBookPages, getStoredReadPages, removeBookReadPages, fetchNotesMetadataFromSupabase } from '@/lib/bookDates';
import { checkForAppUpdate } from '@/lib/pwaUpdater';
import { BookCard } from './BookCard';
import { BookshelfView } from './BookshelfView';
import { AddBookModal } from './AddBookModal';
import { ReadBooksByYear } from './ReadBooksByYear';
import { ReadingChallenge } from './ReadingChallenge';
import { BackupManager } from './BackupManager';
import { useReadingGoals } from '@/hooks/useReadingGoals';
import { useToast } from './Toast';
import { LibrarySkeleton } from './Skeletons';
import { SORT_OPTIONS, sortBooks, getStoredSort, storeSort, type SortKey } from '@/lib/sortBooks';

// Tempo a disposizione per annullare l'eliminazione di un libro
const UNDO_DELETE_MS = 6000;

type ViewTab = 'all' | 'reading' | 'completed' | 'want';

export function Dashboard() {
  const { signOut, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { toast } = useToast();
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
    const getTarget = (): HTMLElement | null => {
      if (tab === 'all') {
        return (
          document.getElementById('search-filter-bar') ||
          document.getElementById('section-all')
        );
      }
      return (
        document.getElementById(`section-${tab}`) ||
        document.getElementById(`section-${tab}-in-all`) ||
        document.getElementById('search-filter-bar')
      );
    };

    const doScroll = (element: HTMLElement) => {
      // Offset per tenere conto dell'header sticky (circa 58px) + margine visivo
      const headerOffset = 70;
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

  const handleSelectTab = useCallback(
    (tab: ViewTab, forceScroll = false) => {
      setActiveTab(tab);
      if (forceScroll || window.innerWidth < 640) {
        scrollToSection(tab);
      }
    },
    [scrollToSection]
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

      const [storedLocalDates, storedLocalPages, storedLocalReadPages, notesMeta] = await Promise.all([
        getStoredDates(),
        getStoredPages(),
        getStoredReadPages(),
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

  const handleOpenEditBook = (book: Book) => {
    setEditingBook(book);
    setShowAddModal(true);
  };

  const handleUpdateBook = (updated: Book) => {
    setBooks((prev) =>
      prev.map((b) =>
        b.id === updated.id
          ? { ...b, ...updated, notes_count: updated.notes_count ?? b.notes_count ?? 0 }
          : b
      )
    );
    setEditingBook(null);
    setShowAddModal(false);
  };

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
    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    setPendingDeleteIds((prev) => prev.filter((id) => id !== book.id));
  }, [toast]);

  const handleDeleteBook = (id: string) => {
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
  };

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

  // Libri filtrati per ricerca globale
  const searchFilter = (b: Book) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
  };

  // Suddivisione dei libri per stato (filtrati per ricerca e ordinati)
  const readingBooks = useMemo(
    () => sortBooks(books.filter((b) => b.status === 'reading' && searchFilter(b)), sortBy),
    [books, search, sortBy]
  );

  const wantBooks = useMemo(
    () => sortBooks(books.filter((b) => b.status === 'want' && searchFilter(b)), sortBy),
    [books, search, sortBy]
  );

  const completedBooks = useMemo(
    () => sortBooks(books.filter((b) => b.status === 'completed' && searchFilter(b)), sortBy),
    [books, search, sortBy]
  );


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

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 light:from-[#fcfbfa] light:via-[#f7f4ed] light:to-[#fcfbfa] text-stone-100 light:text-stone-900 transition-colors duration-200">
      {/* Header principale */}
      <header className="sticky top-0 z-30 bg-stone-900/80 light:bg-[#fcfbfa]/85 backdrop-blur-md border-b border-stone-800 light:border-stone-200/80 transition-colors duration-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 light:bg-amber-500/15 border border-amber-500/20 light:border-amber-500/30 text-amber-400 light:text-amber-600">
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold text-stone-100 light:text-stone-900 leading-none">Bookshelf</h1>
              <p className="text-xs text-stone-500 light:text-stone-500 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle Modalità Chiara / Scura */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-stone-300 light:text-stone-700 hover:text-stone-100 light:hover:text-stone-950 bg-stone-800/80 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200/80 border border-stone-700/80 light:border-stone-300/80 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs"
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
              className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-stone-300 light:text-stone-700 hover:text-stone-100 light:hover:text-stone-950 bg-stone-800/80 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200/80 border border-stone-700/80 light:border-stone-300/80 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-60 shadow-xs"
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

      <main className="max-w-5xl mx-auto px-4 py-6 pb-36 sm:pb-14">
        {/* Obiettivo di lettura annuale */}
        <ReadingChallenge books={books} goals={goals} onSetGoal={setGoal} />

        {/* Selettore Primario delle Sezioni (4 Card Statistiche Interattive e Unificate) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => handleSelectTab('all')}
            className={`border rounded-2xl p-3.5 sm:p-4 text-center transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-98 ${
              activeTab === 'all'
                ? 'border-amber-500/70 light:border-amber-500 ring-2 ring-amber-500/25 bg-amber-500/10 light:bg-amber-50/90 shadow-md shadow-amber-500/10'
                : 'bg-stone-850/80 light:bg-white border-stone-800/80 light:border-stone-200/90 hover:bg-stone-800/90 light:hover:bg-stone-50 shadow-xs'
            }`}
          >
            <div className="text-2xl sm:text-3xl font-bold font-serif text-stone-100 light:text-stone-900 flex items-center justify-center gap-1.5">
              <span>{stats.total}</span>
              <BookOpen size={18} className="text-amber-400 light:text-amber-600 inline opacity-85" />
            </div>
            <div className="text-xs sm:text-sm text-stone-300 light:text-stone-600 mt-1 font-semibold tracking-normal">Tutti i libri</div>
          </button>

          <button
            onClick={() => handleSelectTab('reading')}
            className={`border rounded-2xl p-3.5 sm:p-4 text-center transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-98 ${
              activeTab === 'reading'
                ? 'border-amber-500/70 light:border-amber-500 ring-2 ring-amber-500/25 bg-amber-500/10 light:bg-amber-50/90 shadow-md shadow-amber-500/10'
                : 'bg-stone-850/80 light:bg-white border-stone-800/80 light:border-stone-200/90 hover:bg-stone-800/90 light:hover:bg-stone-50 shadow-xs'
            }`}
          >
            <div className="text-2xl sm:text-3xl font-bold font-serif text-amber-400 light:text-amber-700 flex items-center justify-center gap-1.5">
              <span>{stats.reading}</span>
              <Flame size={19} className="text-amber-400 light:text-amber-600 inline" />
            </div>
            <div className="text-xs sm:text-sm text-stone-300 light:text-stone-600 mt-1 font-semibold tracking-normal">In lettura</div>
          </button>

          <button
            onClick={() => handleSelectTab('completed')}
            className={`border rounded-2xl p-3.5 sm:p-4 text-center transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-98 ${
              activeTab === 'completed'
                ? 'border-emerald-500/70 light:border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-950/30 light:bg-emerald-50/90 shadow-md shadow-emerald-500/10'
                : 'bg-stone-850/80 light:bg-white border-stone-800/80 light:border-stone-200/90 hover:bg-stone-800/90 light:hover:bg-stone-50 shadow-xs'
            }`}
          >
            <div className="text-2xl sm:text-3xl font-bold font-serif text-emerald-400 light:text-emerald-700 flex items-center justify-center gap-1.5">
              <span>{stats.completed}</span>
              <Trophy size={19} className="text-emerald-400 light:text-emerald-600 inline" />
            </div>
            <div className="text-xs sm:text-sm text-stone-300 light:text-stone-600 mt-1 font-semibold tracking-normal">Letti (per anno)</div>
          </button>

          <button
            onClick={() => handleSelectTab('want')}
            className={`border rounded-2xl p-3.5 sm:p-4 text-center transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-98 ${
              activeTab === 'want'
                ? 'border-sky-500/70 light:border-sky-500 ring-2 ring-sky-500/25 bg-sky-950/30 light:bg-sky-50/90 shadow-md shadow-sky-500/10'
                : 'bg-stone-850/80 light:bg-white border-stone-800/80 light:border-stone-200/90 hover:bg-stone-800/90 light:hover:bg-stone-50 shadow-xs'
            }`}
          >
            <div className="text-2xl sm:text-3xl font-bold font-serif text-sky-400 light:text-sky-700 flex items-center justify-center gap-1.5">
              <span>{stats.want}</span>
              <Bookmark size={18} className="text-sky-400 light:text-sky-600 inline opacity-85" />
            </div>
            <div className="text-xs sm:text-sm text-stone-300 light:text-stone-600 mt-1 font-semibold tracking-normal">Da leggere</div>
          </button>
        </div>

        {/* Barra Ricerca e Azione Aggiungi Libro */}
        <div id="search-filter-bar" className="flex flex-col sm:flex-row gap-3 mb-6 scroll-mt-20">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per titolo o autore..."
              className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-stone-850/70 light:bg-white border border-stone-700 light:border-stone-300 rounded-xl text-stone-100 light:text-stone-900 text-sm sm:text-base placeholder-stone-400 light:placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 light:text-stone-500 hover:text-stone-200 light:hover:text-stone-800"
              >
                Cancella
              </button>
            )}
          </div>
          <div className="relative sm:w-52">
            <ArrowUpDown
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 light:text-amber-600 pointer-events-none"
            />
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value as SortKey)}
              aria-label="Ordina libri"
              className="w-full appearance-none pl-9 pr-9 py-2.5 sm:py-3 bg-stone-850/70 light:bg-white border border-stone-700 light:border-stone-300 rounded-xl text-sm text-stone-100 light:text-stone-900 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors shadow-xs cursor-pointer"
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
          <div className="flex items-center bg-stone-850/70 light:bg-white border border-stone-700 light:border-stone-300 rounded-xl p-1 shrink-0 self-stretch sm:self-auto justify-center">
            <button
              type="button"
              onClick={() => handleViewModeChange('grid')}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex-1 sm:flex-initial ${
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
              className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex-1 sm:flex-initial ${
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
            className="flex items-center justify-center gap-2 py-2.5 px-5 bg-amber-500 hover:bg-amber-400 active:scale-98 text-stone-900 font-semibold rounded-lg transition-all whitespace-nowrap shadow-md shadow-amber-500/10 cursor-pointer"
          >
            <Plus size={20} />
            Aggiungi libro
          </button>
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
            onSelectTab={handleSelectTab}
          />
        ) : activeTab === 'completed' ? (
          /* VISTA: Libri Letti suddivisi e raggruppati per Anno */
          <div id="section-completed" className="scroll-mt-20">
            <ReadBooksByYear
              books={completedBooks}
              onUpdate={handleUpdateBook}
              onDelete={handleDeleteBook}
              onEdit={handleOpenEditBook}
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
              <div className="bg-stone-850/40 light:bg-white border border-stone-800 light:border-stone-200/90 rounded-xl p-8 text-center shadow-xs">
                <BookMarked size={36} className="mx-auto text-amber-500/40 light:text-amber-600/40 mb-2" />
                <p className="text-sm font-medium text-stone-300 light:text-stone-800">
                  Nessun libro attualmente in lettura
                </p>
                <p className="text-xs text-stone-500 light:text-stone-500 mt-1 mb-4">
                  Scegli un libro da "Da leggere" oppure aggiungine uno nuovo.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs py-2 px-3.5 bg-amber-500/20 light:bg-amber-100 hover:bg-amber-500/30 light:hover:bg-amber-200/80 text-amber-300 light:text-amber-800 border border-amber-500/30 light:border-amber-400/50 rounded-lg transition-colors font-medium cursor-pointer"
                >
                  <Plus size={15} />
                  Aggiungi libro in lettura
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {readingBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onUpdate={handleUpdateBook}
                    onDelete={handleDeleteBook}
                    onEdit={handleOpenEditBook}
                    highlight={true}
                  />
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'want' ? (
          /* VISTA: Solo libri Da Leggere */
          <div id="section-want" className="space-y-4 scroll-mt-20">
            <div className="flex items-center justify-between border-b border-stone-800 light:border-stone-200 pb-3">
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
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 light:bg-sky-50 text-sky-400 light:text-sky-700 border border-sky-500/20 light:border-sky-300/60">
                {wantBooks.length} {wantBooks.length === 1 ? 'libro' : 'libri'}
              </span>
            </div>

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
                {wantBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onUpdate={handleUpdateBook}
                    onDelete={handleDeleteBook}
                    onEdit={handleOpenEditBook}
                  />
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
                          highlight={true}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* 2. SEZIONE DA LEGGERE */}
                {wantBooks.length > 0 && (
                  <section id="section-want-in-all" className="space-y-4 scroll-mt-20">
                    <div className="flex items-center justify-between border-b border-stone-800 light:border-stone-200 pb-3">
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
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 light:bg-sky-50 text-sky-400 light:text-sky-700 border border-sky-500/20 light:border-sky-300/60 whitespace-nowrap shrink-0">
                        {wantBooks.length} {wantBooks.length === 1 ? 'libro' : 'libri'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {wantBooks.map((book) => (
                        <BookCard
                          key={book.id}
                          book={book}
                          onUpdate={handleUpdateBook}
                          onDelete={handleDeleteBook}
                          onEdit={handleOpenEditBook}
                        />
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
                            <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 light:bg-emerald-100 text-emerald-300 light:text-emerald-800 border border-emerald-500/30">
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
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-stone-400 light:text-stone-600">Bookshelf</span>
            <span>·</span>
            <span>{stats.total} {stats.total === 1 ? 'libro registrato' : 'libri registrati'}</span>
          </div>

          <button
            onClick={() => setShowBackupModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-850/80 light:bg-stone-100 hover:bg-stone-800 light:hover:bg-stone-200 text-stone-300 light:text-stone-700 border border-stone-700/70 light:border-stone-300/80 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Esporta o ripristina la libreria in formato JSON"
          >
            <Database size={13} className="text-amber-400 light:text-amber-600" />
            <span>Gestione Backup e Dati JSON</span>
          </button>
        </div>
      </main>

      {/* Barra di Navigazione Mobile Inferiore (Griglia a 5 colonne perfettamente centrata e protetta dallo swipe iPhone) */}
      <nav
        aria-label="Navigazione rapida mobile"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-900/95 light:bg-white/95 backdrop-blur-xl border-t border-stone-800/90 light:border-stone-200/90 px-2 pt-2 pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] light:shadow-[0_-8px_24px_rgba(0,0,0,0.06)]"
      >
        <div className="max-w-md mx-auto grid grid-cols-5 items-center">
          {/* Colonna 1: Tutti */}
          <button
            type="button"
            onClick={() => handleSelectTab('all', true)}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
              activeTab === 'all'
                ? 'text-amber-400 light:text-amber-600 font-bold'
                : 'text-stone-400 light:text-stone-500 hover:text-stone-200 light:hover:text-stone-900'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${activeTab === 'all' ? 'bg-amber-500/15 light:bg-amber-100/90 shadow-xs' : ''}`}>
              <BookOpen size={20} strokeWidth={activeTab === 'all' ? 2.4 : 2} />
            </div>
            <span className="text-[10.5px] leading-none font-medium whitespace-nowrap">Tutti</span>
          </button>

          {/* Colonna 2: In lettura */}
          <button
            type="button"
            onClick={() => handleSelectTab('reading', true)}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
              activeTab === 'reading'
                ? 'text-amber-400 light:text-amber-600 font-bold'
                : 'text-stone-400 light:text-stone-500 hover:text-stone-200 light:hover:text-stone-900'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${activeTab === 'reading' ? 'bg-amber-500/15 light:bg-amber-100/90 shadow-xs' : ''}`}>
              <Flame size={20} strokeWidth={activeTab === 'reading' ? 2.4 : 2} />
            </div>
            <span className="text-[10.5px] leading-none font-medium whitespace-nowrap">In lettura</span>
          </button>

          {/* Colonna 3: Tasto Aggiungi Libro perfettamente centrato ed elevato */}
          <div className="flex flex-col items-center justify-center relative">
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="-mt-7 w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-350 text-stone-950 flex items-center justify-center shadow-[0_8px_24px_rgba(245,158,11,0.45)] hover:shadow-[0_10px_30px_rgba(245,158,11,0.6)] active:scale-90 hover:scale-105 transition-all cursor-pointer border-[3.5px] border-stone-900 light:border-white ring-2 ring-amber-500/25"
              title="Aggiungi nuovo libro"
              aria-label="Aggiungi libro"
            >
              <Plus size={28} strokeWidth={2.8} />
            </button>
          </div>

          {/* Colonna 4: Letti */}
          <button
            type="button"
            onClick={() => handleSelectTab('completed', true)}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
              activeTab === 'completed'
                ? 'text-emerald-400 light:text-emerald-600 font-bold'
                : 'text-stone-400 light:text-stone-500 hover:text-stone-200 light:hover:text-stone-900'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${activeTab === 'completed' ? 'bg-emerald-500/15 light:bg-emerald-100/90 shadow-xs' : ''}`}>
              <Trophy size={20} strokeWidth={activeTab === 'completed' ? 2.4 : 2} />
            </div>
            <span className="text-[10.5px] leading-none font-medium whitespace-nowrap">Letti</span>
          </button>

          {/* Colonna 5: Da leggere */}
          <button
            type="button"
            onClick={() => handleSelectTab('want', true)}
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
              activeTab === 'want'
                ? 'text-sky-400 light:text-sky-600 font-bold'
                : 'text-stone-400 light:text-stone-500 hover:text-stone-200 light:hover:text-stone-900'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${activeTab === 'want' ? 'bg-sky-500/15 light:bg-sky-100/90 shadow-xs' : ''}`}>
              <Bookmark size={20} strokeWidth={activeTab === 'want' ? 2.4 : 2} />
            </div>
            <span className="text-[10.5px] leading-none font-medium whitespace-nowrap">Da leggere</span>
          </button>
        </div>
      </nav>

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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-up"
          onClick={() => setShowBackupModal(false)}
        >
          <div
            className="bg-stone-900 light:bg-white rounded-3xl border border-stone-800/90 light:border-stone-200 max-w-2xl w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-stone-800 light:border-stone-200 shrink-0 bg-stone-900 light:bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-600">
                  <Database size={20} />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-stone-100 light:text-stone-900 leading-tight">
                    Gestione Backup e Dati
                  </h2>
                  <p className="text-xs text-stone-400 light:text-stone-500">
                    Esporta o ripristina la tua libreria in formato JSON
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBackupModal(false)}
                className="text-stone-400 light:text-stone-500 hover:text-stone-100 light:hover:text-stone-900 p-1.5 rounded-lg hover:bg-stone-800 light:hover:bg-stone-100 transition-colors cursor-pointer"
                aria-label="Chiudi finestra"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5 sm:p-6 overflow-y-auto flex-1">
              <BackupManager
                books={books}
                goals={goals}
                onRestoreCompleted={() => {
                  loadBooks(true);
                  refreshGoals();
                  setShowBackupModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
