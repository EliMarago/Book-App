import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  LogOut,
  Library,
  Search,
  Loader2,
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
  Database,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase, type Book } from '@/lib/supabase';
import { getStoredDates, removeBookDate, getStoredPages, removeBookPages, getStoredReadPages, removeBookReadPages, fetchNotesMetadataFromSupabase } from '@/lib/bookDates';
import { checkForAppUpdate } from '@/lib/pwaUpdater';
import { BookCard } from './BookCard';
import { AddBookModal } from './AddBookModal';
import { ReadBooksByYear } from './ReadBooksByYear';
import { ReadingChallenge } from './ReadingChallenge';
import { BackupManager } from './BackupManager';
import { useReadingGoals } from '@/hooks/useReadingGoals';

type ViewTab = 'all' | 'reading' | 'completed' | 'want' | 'backup';

export function Dashboard() {
  const { signOut, user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [search, setSearch] = useState('');
  const { goals, setGoal, refreshGoals } = useReadingGoals();

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

  const handleDeleteBook = (id: string) => {
    removeBookDate(id);
    removeBookPages(id);
    removeBookReadPages(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
  };

  // Libri filtrati per ricerca globale
  const searchFilter = (b: Book) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
  };

  // Suddivisione dei libri per stato (filtrati anche per ricerca)
  const readingBooks = useMemo(
    () => books.filter((b) => b.status === 'reading' && searchFilter(b)),
    [books, search]
  );

  const wantBooks = useMemo(
    () => books.filter((b) => b.status === 'want' && searchFilter(b)),
    [books, search]
  );

  const completedBooks = useMemo(
    () => books.filter((b) => b.status === 'completed' && searchFilter(b)),
    [books, search]
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
              Esci
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Obiettivo di lettura annuale */}
        <ReadingChallenge books={books} goals={goals} onSetGoal={setGoal} />

        {/* Statistiche cliccabili che attivano direttamente le sezioni corrispondenti */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`border rounded-xl p-3 text-center transition-all cursor-pointer shadow-xs ${
              activeTab === 'all'
                ? 'border-amber-500/50 light:border-amber-500/60 ring-1 ring-amber-500/30 bg-amber-500/10 light:bg-amber-50/90 light:shadow-sm'
                : 'bg-stone-850/60 light:bg-white border-stone-700/80 light:border-stone-200 hover:bg-stone-800/80 light:hover:bg-stone-50'
            }`}
          >
            <div className="text-2xl font-bold text-stone-100 light:text-stone-900">{stats.total}</div>
            <div className="text-xs text-stone-400 light:text-stone-500 mt-0.5">Tutti i libri</div>
          </button>

          <button
            onClick={() => setActiveTab('reading')}
            className={`border rounded-xl p-3 text-center transition-all cursor-pointer shadow-xs ${
              activeTab === 'reading'
                ? 'border-amber-500/50 light:border-amber-500/60 ring-1 ring-amber-500/30 bg-amber-500/10 light:bg-amber-50/90 light:shadow-sm'
                : 'bg-stone-850/60 light:bg-white border-stone-700/80 light:border-stone-200 hover:bg-stone-800/80 light:hover:bg-stone-50'
            }`}
          >
            <div className="text-2xl font-bold text-amber-400 light:text-amber-700 flex items-center justify-center gap-1">
              <span>{stats.reading}</span>
              <Flame size={16} className="text-amber-400 light:text-amber-600 inline" />
            </div>
            <div className="text-xs text-stone-400 light:text-stone-500 mt-0.5">In lettura</div>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`border rounded-xl p-3 text-center transition-all cursor-pointer shadow-xs ${
              activeTab === 'completed'
                ? 'border-emerald-500/50 light:border-emerald-500/60 ring-1 ring-emerald-500/30 bg-emerald-950/25 light:bg-emerald-50/90 light:shadow-sm'
                : 'bg-stone-850/60 light:bg-white border-stone-700/80 light:border-stone-200 hover:bg-stone-800/80 light:hover:bg-stone-50'
            }`}
          >
            <div className="text-2xl font-bold text-emerald-400 light:text-emerald-700 flex items-center justify-center gap-1">
              <span>{stats.completed}</span>
              <Trophy size={16} className="text-emerald-400 light:text-emerald-600 inline" />
            </div>
            <div className="text-xs text-stone-400 light:text-stone-500 mt-0.5">Completati (per anno)</div>
          </button>

          <button
            onClick={() => setActiveTab('want')}
            className={`border rounded-xl p-3 text-center transition-all cursor-pointer shadow-xs ${
              activeTab === 'want'
                ? 'border-sky-500/50 light:border-sky-500/60 ring-1 ring-sky-500/30 bg-sky-950/25 light:bg-sky-50/90 light:shadow-sm'
                : 'bg-stone-850/60 light:bg-white border-stone-700/80 light:border-stone-200 hover:bg-stone-800/80 light:hover:bg-stone-50'
            }`}
          >
            <div className="text-2xl font-bold text-sky-400 light:text-sky-700">{stats.want}</div>
            <div className="text-xs text-stone-400 light:text-stone-500 mt-0.5">Da leggere</div>
          </button>
        </div>

        {/* Barra Ricerca e Azione Aggiungi Libro */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per titolo o autore..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-850/70 light:bg-white border border-stone-700 light:border-stone-300 rounded-lg text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors shadow-xs"
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
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-5 bg-amber-500 hover:bg-amber-400 active:scale-98 text-stone-900 font-semibold rounded-lg transition-all whitespace-nowrap shadow-md shadow-amber-500/10 cursor-pointer"
          >
            <Plus size={20} />
            Aggiungi libro
          </button>
        </div>

        {/* Tab di Navigazione tra Sezioni */}
        <div className="flex items-center gap-2 border-b border-stone-800 light:border-stone-200 mb-7 pb-2 overflow-x-auto scrollbar-thin">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm'
                : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 hover:bg-stone-800/60 light:hover:bg-stone-200/60'
            }`}
          >
            <BookOpen size={16} />
            <span>Tutti i libri</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'all'
                  ? 'bg-stone-900/30 text-stone-950 font-bold'
                  : 'bg-stone-800 light:bg-stone-200 text-stone-400 light:text-stone-700'
              }`}
            >
              {stats.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reading')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'reading'
                ? 'bg-amber-500/20 light:bg-amber-100 text-amber-300 light:text-amber-800 border border-amber-500/40 light:border-amber-400 shadow-sm'
                : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 hover:bg-stone-800/60 light:hover:bg-stone-200/60'
            }`}
          >
            <Flame size={16} className="text-amber-400 light:text-amber-600" />
            <span>In lettura</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'reading'
                  ? 'bg-amber-500/30 light:bg-amber-200/80 text-amber-200 light:text-amber-900'
                  : 'bg-stone-800 light:bg-stone-200 text-stone-400 light:text-stone-700'
              }`}
            >
              {stats.reading}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-emerald-500/20 light:bg-emerald-100 text-emerald-300 light:text-emerald-800 border border-emerald-500/40 light:border-emerald-400 shadow-sm'
                : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 hover:bg-stone-800/60 light:hover:bg-stone-200/60'
            }`}
          >
            <Trophy size={16} className="text-emerald-400 light:text-emerald-600" />
            <span>Letti per anno</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'completed'
                  ? 'bg-emerald-500/30 light:bg-emerald-200/80 text-emerald-200 light:text-emerald-900'
                  : 'bg-stone-800 light:bg-stone-200 text-stone-400 light:text-stone-700'
              }`}
            >
              {stats.completed}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('want')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'want'
                ? 'bg-sky-500/20 light:bg-sky-100 text-sky-300 light:text-sky-800 border border-sky-500/40 light:border-sky-400 shadow-sm'
                : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 hover:bg-stone-800/60 light:hover:bg-stone-200/60'
            }`}
          >
            <Bookmark size={16} className="text-sky-400 light:text-sky-600" />
            <span>Da leggere</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'want'
                  ? 'bg-sky-500/30 light:bg-sky-200/80 text-sky-200 light:text-sky-900'
                  : 'bg-stone-800 light:bg-stone-200 text-stone-400 light:text-stone-700'
              }`}
            >
              {stats.want}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-amber-500/20 light:bg-amber-100 text-amber-300 light:text-amber-800 border border-amber-500/40 light:border-amber-400 shadow-sm'
                : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 hover:bg-stone-800/60 light:hover:bg-stone-200/60'
            }`}
          >
            <Database size={16} className="text-amber-400 light:text-amber-600" />
            <span>Backup e Dati</span>
          </button>
        </div>

        {/* Contenuto dinamico in base al tab selezionato */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-stone-500">
            <Loader2 size={36} className="animate-spin mb-3 text-amber-400" />
            <p>Caricamento della tua libreria...</p>
          </div>
        ) : activeTab === 'backup' ? (
          /* VISTA: Sezione Backup e Dati */
          <div className="space-y-4">
            <BackupManager
              books={books}
              goals={goals}
              onRestoreCompleted={() => {
                loadBooks(true);
                refreshGoals();
              }}
            />
          </div>
        ) : activeTab === 'completed' ? (
          /* VISTA: Libri Letti suddivisi e raggruppati per Anno */
          <ReadBooksByYear
            books={completedBooks}
            onUpdate={handleUpdateBook}
            onDelete={handleDeleteBook}
            onEdit={handleOpenEditBook}
            searchQuery={search}
            goals={goals}
          />
        ) : activeTab === 'reading' ? (
          /* VISTA: Solo libri In Lettura (In Evidenza) */
          <div className="space-y-4">
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
          <div className="space-y-4">
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
          <div className="space-y-10">
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
                  <section className="space-y-4">
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
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 light:bg-amber-50 text-amber-400 light:text-amber-700 border border-amber-500/20 light:border-amber-300/60">
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
                  <section className="space-y-4">
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

                {/* 3. SEZIONE COMPLETATI (GIÀ LETTI) - VISIBILE QUANDO CLICCHI 'TUTTI I LIBRI' */}
                {completedBooks.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 light:border-emerald-300/40 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 light:bg-emerald-100 border border-emerald-500/30 light:border-emerald-300 flex items-center justify-center text-emerald-400 light:text-emerald-700">
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-serif text-xl font-bold text-stone-100 light:text-stone-900">
                              Già Letti (Completati)
                            </h2>
                            <button
                              onClick={() => setActiveTab('completed')}
                              className="text-[11px] font-medium text-emerald-400 light:text-emerald-700 hover:text-emerald-300 light:hover:text-emerald-800 flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <span>Vedi divisi per anno</span>
                              <ArrowRight size={12} />
                            </button>
                          </div>
                          <p className="text-xs text-stone-400 light:text-stone-500">
                            I libri che hai terminato di leggere
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 light:bg-emerald-50 text-emerald-400 light:text-emerald-700 border border-emerald-500/20 light:border-emerald-300/60">
                        {completedBooks.length} {completedBooks.length === 1 ? 'libro' : 'libri'}
                      </span>
                    </div>

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

      </main>

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
    </div>
  );
}
