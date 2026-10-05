import { useState } from 'react';
import { X, Loader2, Search, BookMarked, BookPlus, Link2, ImageOff } from 'lucide-react';
import { supabase, type Book } from '@/lib/supabase';
import { syncBookDateToSupabase } from '@/lib/bookDates';

async function fetchBookCover(title: string, author: string): Promise<string | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = `${supabaseUrl}/functions/v1/book-cover`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ title, author }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;
    if (data.cover_url) return data.cover_url as string;
    return null;
  } catch {
    return null;
  }
}

export function AddBookModal({
  onClose,
  onAdd,
  onUpdate,
  book,
}: {
  onClose: () => void;
  onAdd?: (book: Book) => void;
  onUpdate?: (book: Book) => void;
  book?: Book | null;
}) {
  const isEditing = Boolean(book);
  const [title, setTitle] = useState(book?.title ?? '');
  const [author, setAuthor] = useState(book?.author ?? '');
  const [status, setStatus] = useState<Book['status']>(book?.status ?? 'want');
  const [readAt, setReadAt] = useState(
    book?.read_at ? new Date(book.read_at).toISOString().split('T')[0] : ''
  );
  const [coverUrl, setCoverUrl] = useState(book?.cover_url ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    setLoading(true);
    setError(null);

    let finalCoverUrl: string | null = coverUrl.trim() || null;

    if (!finalCoverUrl) {
      finalCoverUrl = await fetchBookCover(title.trim(), author.trim());
    }

    const computedReadAt = readAt
      ? new Date(`${readAt}T12:00:00`).toISOString()
      : null;

    const basePayload = {
      title: title.trim(),
      author: author.trim(),
      cover_url: finalCoverUrl,
      status,
      rating: book?.rating ?? 0,
    };

    if (isEditing && book) {
      const updatedAt = new Date().toISOString();
      const updatePayload = {
        ...basePayload,
        updated_at: updatedAt,
      };

      const { data, error: updateError } = await supabase
        .from('books')
        .update(updatePayload)
        .eq('id', book.id)
        .select()
        .single();

      let finalData = data;
      let finalUpdateError = updateError;



      setLoading(false);

      if (finalUpdateError) {
        console.error('Errore update libro:', finalUpdateError);
        setError(`Errore aggiornamento: ${finalUpdateError.message}`);
        return;
      }

      await syncBookDateToSupabase(book.id, computedReadAt);

      const baseBook = data ?? book;
      const mergedData = {
        ...baseBook,
        title: title.trim(),
        author: author.trim(),
        cover_url: finalCoverUrl,
        status,
        read_at: computedReadAt,
        updated_at: updatedAt,
      };
      onUpdate?.(mergedData);
      onClose();
      return;
    }

    const { data, error: insertError } = await supabase
      .from('books')
      .insert(basePayload)
      .select()
      .single();

    setLoading(false);

    if (insertError) {
      console.error('Errore insert libro:', insertError);
      setError(`Errore salvataggio: ${insertError.message}`);
      return;
    }

    if (data) {
      await syncBookDateToSupabase(data.id, computedReadAt);

      const mergedInsertData = {
        ...data,
        title: title.trim(),
        author: author.trim(),
        cover_url: finalCoverUrl,
        status,
        read_at: computedReadAt,
      };
      onAdd?.(mergedInsertData);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-stone-800 rounded-2xl border border-stone-700 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-stone-700 sticky top-0 bg-stone-800 z-10">
          <div className="flex items-center gap-2">
            <BookPlus size={22} className="text-amber-400" />
            <h2 className="font-serif text-xl font-semibold text-stone-100">
              {isEditing ? 'Modifica libro' : 'Aggiungi libro'}
            </h2>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-24 h-36 rounded-lg overflow-hidden bg-stone-900 flex items-center justify-center shadow-lg border border-stone-700">
              {coverUrl.trim() ? (
                <img
                  src={coverUrl.trim()}
                  alt="Anteprima copertina"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : (
                <BookMarked size={32} className="text-stone-600" />
              )}
              <ImageOff size={28} className="text-stone-600 hidden" />
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1.5">Titolo</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-900/60 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
                  placeholder="Es. Il nome della rosa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1.5">Autore</label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-900/60 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
                  placeholder="Es. Umberto Eco"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1.5">
              URL copertina (opzionale)
            </label>
            <div className="relative">
              <Link2
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
              />
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-900/60 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
                placeholder="https://... (incolla qui l'URL dell'immagine)"
              />
            </div>
            <p className="text-xs text-stone-500 mt-1.5">
              Incolla l'URL diretto di un'immagine. Se lo lasci vuoto, la copertina viene cercata
              automaticamente.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1.5">Stato</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'want', label: 'Da leggere' },
                  { value: 'reading', label: 'In lettura' },
                  { value: 'completed', label: 'Completato' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`py-2 px-2 rounded-lg text-sm font-medium transition-colors border ${
                    status === opt.value
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                      : 'bg-stone-900/40 text-stone-400 border-stone-700 hover:border-stone-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-300 mb-1.5">Data di lettura</label>
            <input
              type="date"
              value={readAt}
              onChange={(e) => setReadAt(e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-900/60 border border-stone-700 rounded-lg text-stone-100 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
            />
          </div>

          {!coverUrl.trim() && (
            <div className="flex items-center gap-2 text-xs text-stone-500 bg-stone-900/40 rounded-lg p-2.5 border border-stone-700">
              <Search size={14} className="flex-shrink-0" />
              <span>
                Senza URL, la copertina verrà cercata automaticamente in base a titolo e autore.
              </span>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <BookMarked size={18} />
                {isEditing ? 'Salva modifiche' : 'Aggiungi al scaffale'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
