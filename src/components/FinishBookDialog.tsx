import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, X, Loader2 } from 'lucide-react';
import type { Book } from '@/lib/supabase';
import { StarRating } from './StarRating';
import { CoverImage } from './CoverImage';

type FinishBookDialogProps = {
  book: Book;
  /** Completa il libro con il voto scelto (0 = nessun voto) */
  onConfirm: (rating: number) => Promise<void> | void;
  onCancel: () => void;
};

const RATING_LABELS: Record<number, string> = {
  0.5: 'Da dimenticare',
  1: 'Non mi è piaciuto',
  1.5: 'Deludente',
  2: 'Così così',
  2.5: 'Carino',
  3: 'Mi è piaciuto',
  3.5: 'Bello',
  4: 'Molto bello',
  4.5: 'Bellissimo',
  5: 'Capolavoro! 💛',
};

/**
 * Finestra mostrata quando si segna un libro come finito:
 * chiede il voto in stelle e poi sposta il libro tra i "Letti".
 */
export function FinishBookDialog({ book, onConfirm, onCancel }: FinishBookDialogProps) {
  const [rating, setRating] = useState<number>(book.rating > 0 ? book.rating : 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // In cattura e con stopImmediatePropagation: Esc chiude solo questa finestra, non la Scheda Libro sotto
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      if (!saving) onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel, saving]);

  const confirm = async (value: number) => {
    setSaving(true);
    try {
      await onConfirm(value);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="finish-book-title"
      className="fixed inset-0 z-[70] bg-stone-950/80 light:bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-up"
      onClick={() => !saving && onCancel()}
    >
      <div
        className="relative w-full sm:max-w-sm bg-stone-900 light:bg-white border-t sm:border border-stone-800 light:border-stone-200 rounded-t-3xl sm:rounded-3xl shadow-2xl px-5 pt-6 pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+1rem))] sm:pb-6 text-center animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="absolute top-3 right-3 p-1.5 rounded-full text-stone-500 hover:text-stone-200 light:hover:text-stone-800 hover:bg-stone-800 light:hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Annulla"
        >
          <X size={18} />
        </button>

        {/* Copertina con coccarda */}
        <div className="relative mx-auto w-20 aspect-[2/3] rounded-lg overflow-hidden shadow-lg shadow-black/40 light:shadow-stone-400/40 bg-stone-800 light:bg-stone-100">
          {book.cover_url ? (
            <CoverImage src={book.cover_url} alt="" className="w-full h-full object-cover" />
          ) : null}
        </div>
        <div className="mx-auto -mt-3 relative w-8 h-8 rounded-full bg-emerald-500 text-stone-950 flex items-center justify-center ring-4 ring-stone-900 light:ring-white">
          <Trophy size={15} strokeWidth={2.4} />
        </div>

        <h2 id="finish-book-title" className="mt-3 font-serif text-xl font-bold text-stone-100 light:text-stone-900">
          Libro finito!
        </h2>
        <p className="mt-1 text-sm text-stone-400 light:text-stone-600 line-clamp-2">
          Com'è stato <span className="font-semibold text-stone-200 light:text-stone-800">{book.title}</span>?
        </p>

        {/* Voto */}
        <div className="mt-4 flex flex-col items-center">
          <StarRating value={rating} onChange={setRating} size={34} />
          <p className="mt-1.5 h-5 text-sm font-medium text-amber-400 light:text-amber-700">
            {rating > 0 ? RATING_LABELS[rating] ?? '' : (
              <span className="text-stone-500 font-normal">Tocca le stelle per votare (anche mezze)</span>
            )}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => confirm(rating)}
            disabled={saving || rating === 0}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 light:disabled:bg-stone-200 disabled:text-stone-500 text-stone-950 font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Trophy size={17} />}
            Salva voto e sposta in Letti
          </button>
          <button
            type="button"
            onClick={() => confirm(0)}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 hover:bg-stone-800/60 light:hover:bg-stone-100 transition-colors cursor-pointer"
          >
            Sposta in Letti senza voto
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

