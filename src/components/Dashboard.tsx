import { useEffect, useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase, type Book } from '@/lib/supabase';
import { getStoredDates, removeBookDate, fetchDatesFromSupabase } from '@/lib/bookDates';
import { BookCard } from './BookCard';
import { AddBookModal } from './AddBookModal';
import { ReadBooksByYear } from './ReadBooksByYear';

type ViewTab = 'all' | 'reading' | 'completed' | 'want';

export function Dashboard() {
  const { signOut, user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [search, setSearch] = useState('');

  const loadBooks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });

    const [storedLocalDates, supabaseDates] = await Promise.all([
      getStoredDates(),
      fetchDatesFromSupabase(),
    ]);

    const booksWithDates = (data ?? []).map((b) => ({
      ...b,
      read_at: b.read_at || supabaseDates[b.id] || storedLocalDates[b.id] || null,
    }));

    setBooks(booksWithDates);
    setLoading(false);
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleAddBook = (book: Book) => {
    setBooks((prev) => [book, ...prev]);
    setShowAddModal(false);
  };

  const handleOpenEditBook = (book: Book) => {
    setEditingBook(book);
    setShowAddModal(true);
  };

  const handleUpdateBook = (updated: Book) => {
    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setEditingBook(null);
    setShowAddModal(false);
  };

  const handleDeleteBook = (id: string) => {
    removeBookDate(id);
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

  const stats = {
    total: books.length,
    reading: books.filter((b) => b.status === 'reading').length,
    completed: books.filter((b) => b.status === 'completed').length,
    want: books.filter((b) => b.status === 'want').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 text-stone-100">
      {/* Header principale */}
      <header className="sticky top-0 z-30 bg-stone-900/80 backdrop-blur-md border-b border-stone-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <BookOpen size={20} />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold text-stone-100 leading-none">Bookshelf</h1>
              <p className="text-xs text-stone-500 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-100 px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <LogOut size={16} />
            Esci
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Statistiche cliccabili che attivano direttamente le sezioni corrispondenti */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`bg-stone-850/60 border rounded-xl p-3 text-center transition-all hover:bg-stone-800/80 cursor-pointer ${
              activeTab === 'all'
                ? 'border-amber-500/50 ring-1 ring-amber-500/30 bg-amber-500/10'
                : 'border-stone-700/80'
            }`}
          >
            <div className="text-2xl font-bold text-stone-100">{stats.total}</div>
            <div className="text-xs text-stone-400 mt-0.5">Tutti i libri</div>
          </button>

          <button
            onClick={() => setActiveTab('reading')}
            className={`bg-stone-850/60 border rounded-xl p-3 text-center transition-all hover:bg-stone-800/80 cursor-pointer ${
              activeTab === 'reading'
                ? 'border-amber-500/50 ring-1 ring-amber-500/30 bg-amber-500/10'
                : 'border-stone-700/80'
            }`}
          >
            <div className="text-2xl font-bold text-amber-400 flex items-center justify-center gap-1">
              <span>{stats.reading}</span>
              <Flame size={16} className="text-amber-400 inline" />
            </div>
            <div className="text-xs text-stone-400 mt-0.5">In lettura</div>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`bg-stone-850/60 border rounded-xl p-3 text-center transition-all hover:bg-stone-800/80 cursor-pointer ${
              activeTab === 'completed'
                ? 'border-emerald-500/50 ring-1 ring-emerald-500/30 bg-emerald-950/25'
                : 'border-stone-700/80'
            }`}
          >
            <div className="text-2xl font-bold text-emerald-400 flex items-center justify-center gap-1">
              <span>{stats.completed}</span>
              <Trophy size={16} className="text-emerald-400 inline" />
            </div>
            <div className="text-xs text-stone-400 mt-0.5">Completati (per anno)</div>
          </button>

          <button
            onClick={() => setActiveTab('want')}
            className={`bg-stone-850/60 border rounded-xl p-3 text-center transition-all hover:bg-stone-800/80 cursor-pointer ${
              activeTab === 'want'
                ? 'border-sky-500/50 ring-1 ring-sky-500/30 bg-sky-950/25'
                : 'border-stone-700/80'
            }`}
          >
            <div className="text-2xl font-bold text-sky-400">{stats.want}</div>
            <div className="text-xs text-stone-400 mt-0.5">Da leggere</div>
          </button>
        </div>

        {/* Barra Ricerca e Azione Aggiungi Libro */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per titolo o autore..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-850/70 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-200"
              >
                Cancella
              </button>
            )}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors whitespace-nowrap shadow-md shadow-amber-500/10 cursor-pointer"
          >
            <Plus size={20} />
            Aggiungi libro
          </button>
        </div>

        {/* Tab di Navigazione tra Sezioni */}
        <div className="flex items-center gap-2 border-b border-stone-800 mb-7 pb-2 overflow-x-auto scrollbar-thin">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <BookOpen size={16} />
            <span>Tutti i libri</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'all'
                  ? 'bg-stone-900/30 text-stone-950 font-bold'
                  : 'bg-stone-800 text-stone-400'
              }`}
            >
              {stats.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reading')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'reading'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <Flame size={16} className="text-amber-400" />
            <span>In lettura</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'reading'
                  ? 'bg-amber-500/30 text-amber-200'
                  : 'bg-stone-800 text-stone-400'
              }`}
            >
              {stats.reading}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <Trophy size={16} className="text-emerald-400" />
            <span>Letti per anno</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'completed'
                  ? 'bg-emerald-500/30 text-emerald-200'
                  : 'bg-stone-800 text-stone-400'
              }`}
            >
              {stats.completed}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('want')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'want'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
            }`}
          >
            <Bookmark size={16} className="text-sky-400" />
            <span>Da leggere</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === 'want'
                  ? 'bg-sky-500/30 text-sky-200'
                  : 'bg-stone-800 text-stone-400'
              }`}
            >
              {stats.want}
            </span>
          </button>
        </div>

        {/* Contenuto dinamico in base al tab selezionato */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-stone-500">
            <Loader2 size={36} className="animate-spin mb-3 text-amber-400" />
            <p>Caricamento della tua libreria...</p>
          </div>
        ) : activeTab === 'completed' ? (
          /* VISTA: Libri Letti suddivisi e raggruppati per Anno */
          <ReadBooksByYear
            books={completedBooks}
            onUpdate={handleUpdateBook}
            onDelete={handleDeleteBook}
            onEdit={handleOpenEditBook}
            searchQuery={search}
          />
        ) : activeTab === 'reading' ? (
          /* VISTA: Solo libri In Lettura (In Evidenza) */
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Flame size={18} />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-stone-100">
                    Attualmente In Lettura
                  </h2>
                  <p className="text-xs text-stone-400">I libri che stai leggendo adesso</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 text-amber-400 border border-amber-500/20">
                {readingBooks.length} {readingBooks.length === 1 ? 'libro' : 'libri'}
              </span>
            </div>

            {readingBooks.length === 0 ? (
              <div className="bg-stone-850/40 border border-stone-800 rounded-xl p-8 text-center">
                <BookMarked size={36} className="mx-auto text-amber-500/40 mb-2" />
                <p className="text-sm font-medium text-stone-300">
                  Nessun libro attualmente in lettura
                </p>
                <p className="text-xs text-stone-500 mt-1 mb-4">
                  Scegli un libro da "Da leggere" oppure aggiungine uno nuovo.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs py-2 px-3.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg transition-colors font-medium cursor-pointer"
                >
                  <Plus size={15} />
                  Aggiungi libro in lettura
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400">
                  <Bookmark size={18} />
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-stone-100">Da Leggere</h2>
                  <p className="text-xs text-stone-400">
                    La tua lista dei desideri e prossime letture
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 text-sky-400 border border-sky-500/20">
                {wantBooks.length} {wantBooks.length === 1 ? 'libro' : 'libri'}
              </span>
            </div>

            {wantBooks.length === 0 ? (
              <div className="bg-stone-850/30 border border-stone-800/80 rounded-xl p-8 text-center">
                <Library size={36} className="mx-auto text-stone-600 mb-2" />
                <p className="text-sm font-medium text-stone-300">
                  Nessun libro nella lista da leggere
                </p>
                <p className="text-xs text-stone-500 mt-1 mb-4">
                  Aggiungi i libri che desideri leggere prossimamente.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs py-2 px-3.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-lg transition-colors font-medium cursor-pointer"
                >
                  <Plus size={15} />
                  Aggiungi a "Da leggere"
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="flex flex-col items-center justify-center py-20 text-stone-500">
                <Library size={48} className="mb-4 text-stone-700" />
                <h3 className="font-serif text-xl text-stone-300 mb-1">Il tuo scaffale è vuoto</h3>
                <p className="text-sm text-stone-500 mb-4">
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
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                          <Flame size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-serif text-xl font-bold text-stone-100">
                              In Lettura
                            </h2>
                            <span className="text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              In Evidenza
                            </span>
                          </div>
                          <p className="text-xs text-stone-400">
                            I libri che stai leggendo attualmente
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 text-amber-400 border border-amber-500/20">
                        {readingBooks.length} {readingBooks.length === 1 ? 'libro' : 'libri'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center text-sky-400">
                          <Bookmark size={18} />
                        </div>
                        <div>
                          <h2 className="font-serif text-xl font-bold text-stone-100">Da Leggere</h2>
                          <p className="text-xs text-stone-400">
                            La tua lista dei desideri e prossime letture
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 text-sky-400 border border-sky-500/20">
                        {wantBooks.length} {wantBooks.length === 1 ? 'libro' : 'libri'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="font-serif text-xl font-bold text-stone-100">
                              Già Letti (Completati)
                            </h2>
                            <button
                              onClick={() => setActiveTab('completed')}
                              className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <span>Vedi divisi per anno</span>
                              <ArrowRight size={12} />
                            </button>
                          </div>
                          <p className="text-xs text-stone-400">
                            I libri che hai terminato di leggere
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-stone-800 text-emerald-400 border border-emerald-500/20">
                        {completedBooks.length} {completedBooks.length === 1 ? 'libro' : 'libri'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
