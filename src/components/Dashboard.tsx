import { useEffect, useState } from 'react';
import { BookOpen, Plus, LogOut, Library, Search, Loader2, BookMarked } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase, type Book } from '@/lib/supabase';
import { getStoredDates, removeBookDate, fetchDatesFromSupabase } from '@/lib/bookDates';
import { BookCard } from './BookCard';
import { AddBookModal } from './AddBookModal';

type FilterType = 'all' | 'reading' | 'completed' | 'want';

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'reading', label: 'In lettura' },
  { value: 'completed', label: 'Completati' },
  { value: 'want', label: 'Da leggere' },
];

export function Dashboard() {
  const { signOut, user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
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

  const orderedBooks = [...books].sort((a, b) => {
    // I libri con data di lettura vengono prima, poi quelli senza
    if (a.read_at && !b.read_at) return -1;
    if (!a.read_at && b.read_at) return 1;
    // Tra libri dello stesso tipo, dal più recente al più vecchio
    const aDate = a.read_at ? new Date(a.read_at).getTime() : new Date(a.created_at).getTime();
    const bDate = b.read_at ? new Date(b.read_at).getTime() : new Date(b.created_at).getTime();
    return bDate - aDate;
  });

  const filteredBooks = orderedBooks.filter((b) => {
    const matchesFilter = filter === 'all' || b.status === filter;
    const matchesSearch =
      search === '' ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: books.length,
    reading: books.filter((b) => b.status === 'reading').length,
    completed: books.filter((b) => b.status === 'completed').length,
    want: books.filter((b) => b.status === 'want').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900">
      <header className="sticky top-0 z-30 bg-stone-900/80 backdrop-blur-md border-b border-stone-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <BookOpen size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold text-stone-100 leading-none">Bookshelf</h1>
              <p className="text-xs text-stone-500 mt-0.5">
                {user?.email}
              </p>
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
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Totale', value: stats.total, color: 'text-stone-100' },
            { label: 'In lettura', value: stats.reading, color: 'text-amber-400' },
            { label: 'Completati', value: stats.completed, color: 'text-emerald-400' },
            { label: 'Da leggere', value: stats.want, color: 'text-sky-400' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-stone-800/40 border border-stone-700 rounded-xl p-3 text-center"
            >
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-stone-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per titolo o autore..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-800/50 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus size={20} />
            Aggiungi libro
          </button>
        </div>

        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                filter === f.value
                  ? 'bg-amber-500 text-stone-900 border-amber-500'
                  : 'bg-stone-800/50 text-stone-400 border-stone-700 hover:border-stone-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-500">
            <Loader2 size={32} className="animate-spin mb-3" />
            <p>Caricamento libri...</p>
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-stone-500">
            {books.length === 0 ? (
              <>
                <Library size={48} className="mb-4 text-stone-700" />
                <h3 className="font-serif text-xl text-stone-300 mb-1">Il tuo scaffale è vuoto</h3>
                <p className="text-sm text-stone-500 mb-4">
                  Inizia aggiungendo il primo libro che stai leggendo
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 py-2 px-4 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors"
                >
                  <Plus size={18} />
                  Aggiungi libro
                </button>
              </>
            ) : (
              <>
                <BookMarked size={48} className="mb-4 text-stone-700" />
                <p className="text-sm">Nessun libro trovato con questi filtri.</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBooks.map((book) => (
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
      </main>

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
