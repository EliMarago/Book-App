import { useState } from 'react';
import { Coffee, Flame, Loader2, Plus, Search } from 'lucide-react';
import type { Book } from '@/lib/supabase';
import { CoverImage } from './CoverImage';

type EmptyReadingShelfProps = {
  /** Libri "Da leggere" già ordinati per priorità */
  nextBooks: Book[];
  searchQuery?: string;
  onStartReading?: (book: Book) => Promise<void> | void;
  onAddBook: () => void;
  onOpenBook?: (book: Book) => void;
};

/**
 * Ripiano "In lettura" vuoto: invece di un mobile spoglio propone
 * le prossime letture della lista, ognuna avviabile con un tocco.
 */
export function EmptyReadingShelf({ nextBooks, searchQuery, onStartReading, onAddBook, onOpenBook }: EmptyReadingShelfProps) {
  const [startingId, setStartingId] = useState<string | null>(null);
  const suggestions = nextBooks.slice(0, 3);

  if (searchQuery?.trim()) {
    return (
      <div className="py-12 text-center">
        <Search size={26} className="mx-auto mb-2 text-stone-500" />
        <p className="text-sm text-stone-400 light:text-stone-600">
          Nessun libro in lettura corrisponde a «{searchQuery.trim()}».
        </p>
      </div>
    );
  }

  const start = async (book: Book) => {
    if (!onStartReading) return;
    setStartingId(book.id);
    try {
      await onStartReading(book);
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="px-1 sm:px-2 pt-5 pb-3 animate-fade-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 light:bg-amber-100 border border-amber-500/25 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700 shrink-0">
          <Coffee size={19} />
        </div>
        <div className="min-w-0">
          <p className="font-serif text-base sm:text-lg font-bold text-stone-100 light:text-stone-900 leading-tight">
            Il comodino è libero
          </p>
          <p className="text-xs sm:text-sm text-stone-400 light:text-stone-600">
            {suggestions.length > 0
              ? 'Nessun libro in lettura. Scegli la prossima avventura:'
              : 'Nessun libro in lettura e la lista dei desideri è vuota.'}
          </p>
        </div>
      </div>

      {suggestions.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:gap-6 max-w-xl mx-auto sm:mx-0">
          {suggestions.map((book, idx) => (
            <div key={book.id} className="flex flex-col items-center text-center min-w-0">
              <button
                type="button"
                onClick={() => onOpenBook?.(book)}
                className="relative w-full max-w-[120px] aspect-[2/3] rounded-r-md rounded-l-xs overflow-hidden shadow-xl shadow-black/50 light:shadow-stone-400/50 bg-stone-800 light:bg-stone-200 transition-transform duration-200 hover:-translate-y-1 cursor-pointer"
                title={`${book.title} — apri la Scheda Libro`}
              >
                {book.cover_url ? (
                  <CoverImage src={book.cover_url} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center p-2 font-serif text-[11px] text-stone-300">
                    {book.title}
                  </span>
                )}
                <span
                  className={`absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    idx === 0 ? 'bg-amber-400 text-stone-950' : 'bg-stone-950/75 text-sky-300'
                  }`}
                >
                  {idx === 0 ? '★ #1' : `#${idx + 1}`}
                </span>
              </button>
              <div className="w-4/5 h-1.5 bg-black/60 rounded-full mt-1 opacity-70" aria-hidden="true" />
              <p className="mt-2 w-full min-h-[2.5em] font-serif text-[11px] sm:text-sm font-semibold text-stone-200 light:text-stone-800 line-clamp-2 leading-tight" title={book.title}>
                {book.title}
              </p>
              <p className="w-full text-[11px] sm:text-xs text-stone-500 light:text-stone-500 truncate" title={book.author}>
                {book.author}
              </p>
              {onStartReading && (
                <button
                  type="button"
                  onClick={() => start(book)}
                  disabled={startingId !== null}
                  className={`mt-2 inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-60 ${
                    idx === 0
                      ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/20'
                      : 'border border-stone-700 light:border-stone-300 text-stone-300 light:text-stone-700 hover:border-amber-500/50 hover:text-amber-300 light:hover:text-amber-700'
                  }`}
                >
                  {startingId === book.id ? <Loader2 size={12} className="animate-spin" /> : <Flame size={12} />}
                  Inizia
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={onAddBook}
          className="inline-flex items-center gap-2 py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95"
        >
          <Plus size={18} />
          Aggiungi un libro
        </button>
      )}
    </div>
  );
}

