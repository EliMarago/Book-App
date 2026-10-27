import { useState, useEffect, useRef } from 'react';
import {
  X,
  Loader2,
  BookMarked,
  BookPlus,
  Link2,
  ImageOff,
  Sparkles,
  Check,
  RefreshCw,
  Layers,
  Flame,
} from 'lucide-react';
import { supabase, type Book } from '@/lib/supabase';
import { syncBookDateToSupabase, syncBookPagesToSupabase, syncBookReadPagesToSupabase } from '@/lib/bookDates';
import { fetchBookCover, searchAlternativeCovers, fetchBookPageCount } from '@/lib/bookCoverApi';

export function AddBookModal({
  onClose,
  onAdd,
  onUpdate,
  book,
  initialValues,
}: {
  onClose: () => void;
  onAdd?: (book: Book) => void;
  onUpdate?: (book: Book) => void;
  book?: Book | null;
  initialValues?: { title?: string; author?: string; status?: Book['status'] };
}) {
  const isEditing = Boolean(book);
  const [title, setTitle] = useState(book?.title ?? initialValues?.title ?? '');
  const [author, setAuthor] = useState(book?.author ?? initialValues?.author ?? '');
  const [pages, setPages] = useState(book?.pages !== undefined && book?.pages !== null ? String(book.pages) : '');
  const [readPages, setReadPages] = useState(book?.read_pages !== undefined && book?.read_pages !== null ? String(book.read_pages) : '');
  const [autoDetectedPages, setAutoDetectedPages] = useState<number | null>(null);
  const [status, setStatus] = useState<Book['status']>(
    book?.status ?? initialValues?.status ?? 'want'
  );
  const [readAt, setReadAt] = useState(
    book?.read_at ? new Date(book.read_at).toISOString().split('T')[0] : ''
  );
  const [coverUrl, setCoverUrl] = useState(book?.cover_url ?? '');
  const [coverSource, setCoverSource] = useState<'auto' | 'manual' | null>(
    book?.cover_url ? 'manual' : null
  );
  const [searchingCover, setSearchingCover] = useState(false);
  const [alternativeCovers, setAlternativeCovers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tiene traccia dell'ultima query cercata per evitare ricerche identiche
  const lastSearchedRef = useRef<string>('');

  // Ricerca automatica della copertina quando l'utente digita titolo e autore
  useEffect(() => {
    // Non sovrascrivere se l'utente ha modificato manualmente o se sta modificando un libro esistente
    if (isEditing && book?.cover_url) return;
    if (coverSource === 'manual' && coverUrl.trim()) return;

    const cleanTitle = title.trim();
    const cleanAuthor = author.trim();

    if (!cleanTitle || cleanTitle.length < 2) return;

    const queryKey = `${cleanTitle.toLowerCase()}::${cleanAuthor.toLowerCase()}`;
    if (lastSearchedRef.current === queryKey) return;

    const timer = setTimeout(async () => {
      lastSearchedRef.current = queryKey;
      setSearchingCover(true);
      try {
        const [foundCover, foundPages] = await Promise.allSettled([
          fetchBookCover(cleanTitle, cleanAuthor),
          fetchBookPageCount(cleanTitle, cleanAuthor),
        ]);

        if (foundCover.status === 'fulfilled' && foundCover.value) {
          setCoverUrl(foundCover.value);
          setCoverSource('auto');
        }

        if (foundPages.status === 'fulfilled' && foundPages.value && (!pages || pages === '')) {
          setPages(String(foundPages.value));
          setAutoDetectedPages(foundPages.value);
        }
      } catch (err) {
        console.error('Errore caricamento automatico:', err);
      } finally {
        setSearchingCover(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [title, author, isEditing, book?.cover_url, coverSource, coverUrl, pages]);

  // Cerca manualmente la copertina e le eventuali alternative
  const handleManualSearchCover = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setSearchingCover(true);
    try {
      const [foundCover, alternatives, foundPages] = await Promise.all([
        fetchBookCover(cleanTitle, author.trim()),
        searchAlternativeCovers(cleanTitle, author.trim()),
        fetchBookPageCount(cleanTitle, author.trim()),
      ]);

      if (foundCover) {
        setCoverUrl(foundCover);
        setCoverSource('auto');
      }
      setAlternativeCovers(alternatives);
      if (foundPages && (!pages || pages === '')) {
        setPages(String(foundPages));
        setAutoDetectedPages(foundPages);
      }
    } catch (err) {
      console.error('Errore ricerca copertina:', err);
    } finally {
      setSearchingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    setLoading(true);
    setError(null);

    let finalCoverUrl: string | null = coverUrl.trim() || null;

    // Se l'utente non ha specificato la copertina, proviamo un ultimo recupero rapido
    if (!finalCoverUrl) {
      try {
        finalCoverUrl = await fetchBookCover(title.trim(), author.trim());
      } catch {
        finalCoverUrl = null;
      }
    }

    const computedReadAt = readAt
      ? new Date(`${readAt}T12:00:00`).toISOString()
      : null;

    const parsedPages = pages.trim() ? parseInt(pages.trim(), 10) : null;
    const validPages = parsedPages && !isNaN(parsedPages) && parsedPages > 0 ? parsedPages : null;

    const parsedReadPages = readPages.trim() ? parseInt(readPages.trim(), 10) : null;
    let validReadPages = parsedReadPages !== null && !isNaN(parsedReadPages) && parsedReadPages >= 0 ? parsedReadPages : null;
    if (status === 'completed' && validPages && (validReadPages === null || validReadPages < validPages)) {
      validReadPages = validPages;
    }

    const basePayload = {
      title: title.trim(),
      author: author.trim(),
      cover_url: finalCoverUrl,
      status,
      rating: book?.rating ?? 0,
      pages: validPages,
      read_pages: validReadPages,
    };

    if (isEditing && book) {
      const updatedAt = new Date().toISOString();
      const updatePayload = {
        ...basePayload,
        updated_at: updatedAt,
      };

      let updateData: any = null;
      let updateError: any = null;

      const res = await supabase
        .from('books')
        .update(updatePayload)
        .eq('id', book.id)
        .select()
        .single();

      if (res.error && (res.error.message?.includes('pages') || res.error.message?.includes('read_pages'))) {
        // Fallback nel caso le colonne 'pages' o 'read_pages' non siano ancora presenti nel DB remoto
        const { pages: _p, read_pages: _rp, ...fallbackPayload } = updatePayload;
        const retry = await supabase
          .from('books')
          .update(fallbackPayload)
          .eq('id', book.id)
          .select()
          .single();
        updateData = retry.data;
        updateError = retry.error;
      } else {
        updateData = res.data;
        updateError = res.error;
      }

      setLoading(false);

      if (updateError) {
        console.error('Errore update libro:', updateError);
        setError(`Errore aggiornamento: ${updateError.message}`);
        return;
      }

      await Promise.all([
        syncBookDateToSupabase(book.id, computedReadAt),
        syncBookPagesToSupabase(book.id, validPages),
        syncBookReadPagesToSupabase(book.id, validReadPages),
      ]);

      const baseBook = updateData ?? book;
      const mergedData = {
        ...baseBook,
        notes_count: book.notes_count ?? 0,
        title: title.trim(),
        author: author.trim(),
        cover_url: finalCoverUrl,
        status,
        read_at: computedReadAt,
        pages: validPages,
        read_pages: validReadPages,
        updated_at: updatedAt,
      };
      onUpdate?.(mergedData);
      onClose();
      return;
    }

    let insertData: any = null;
    let insertError: any = null;

    const res = await supabase
      .from('books')
      .insert(basePayload)
      .select()
      .single();

    if (res.error && (res.error.message?.includes('pages') || res.error.message?.includes('read_pages'))) {
      // Fallback nel caso le colonne 'pages' o 'read_pages' non siano ancora presenti nel DB remoto
      const { pages: _p, read_pages: _rp, ...fallbackPayload } = basePayload;
      const retry = await supabase
        .from('books')
        .insert(fallbackPayload)
        .select()
        .single();
      insertData = retry.data;
      insertError = retry.error;
    } else {
      insertData = res.data;
      insertError = res.error;
    }

    setLoading(false);

    if (insertError) {
      console.error('Errore insert libro:', insertError);
      setError(`Errore salvataggio: ${insertError.message}`);
      return;
    }

    if (insertData) {
      await Promise.all([
        syncBookDateToSupabase(insertData.id, computedReadAt),
        syncBookPagesToSupabase(insertData.id, validPages),
        syncBookReadPagesToSupabase(insertData.id, validReadPages),
      ]);

      const mergedInsertData = {
        ...insertData,
        notes_count: 0,
        title: title.trim(),
        author: author.trim(),
        cover_url: finalCoverUrl,
        status,
        read_at: computedReadAt,
        pages: validPages,
        read_pages: validReadPages,
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
        className="bg-stone-800 light:bg-white rounded-2xl border border-stone-700 light:border-stone-200 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-stone-700 light:border-stone-200 sticky top-0 bg-stone-800 light:bg-white z-10">
          <div className="flex items-center gap-2">
            <BookPlus size={22} className="text-amber-400 light:text-amber-600" />
            <h2 className="font-serif text-xl font-semibold text-stone-100 light:text-stone-900">
              {isEditing ? 'Modifica libro' : 'Aggiungi libro'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-500 light:text-stone-400 hover:text-stone-300 light:hover:text-stone-700 transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex gap-4 items-start">
            {/* Box Anteprima Copertina */}
            <div className="relative flex-shrink-0 w-24 h-36 rounded-lg overflow-hidden bg-stone-900 light:bg-stone-100 flex flex-col items-center justify-center shadow-lg border border-stone-700 light:border-stone-200 group">
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
                <div className="flex flex-col items-center justify-center p-2 text-center">
                  <BookMarked size={32} className="text-stone-600 light:text-stone-400 mb-1" />
                  <span className="text-[10px] text-stone-500 light:text-stone-500 leading-tight">
                    Nessuna copertina
                  </span>
                </div>
              )}
              <ImageOff size={28} className="text-stone-600 light:text-stone-400 hidden" />

              {/* Indicatore di caricamento in sovrimpressione */}
              {searchingCover && (
                <div className="absolute inset-0 bg-stone-950/80 light:bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center animate-in fade-in">
                  <Loader2 size={24} className="animate-spin text-amber-400 light:text-amber-600 mb-1" />
                  <span className="text-[10px] text-amber-300 light:text-amber-700 font-medium">
                    Cerco copertina...
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-sm font-medium text-stone-300 light:text-stone-700 mb-1">
                  Titolo *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900/60 light:bg-stone-50 border border-stone-700 light:border-stone-300 rounded-lg text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors text-sm"
                  placeholder="Es. Il nome della rosa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-300 light:text-stone-700 mb-1">
                  Autore *
                </label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900/60 light:bg-stone-50 border border-stone-700 light:border-stone-300 rounded-lg text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors text-sm"
                  placeholder="Es. Umberto Eco"
                />
              </div>

              {coverSource === 'auto' && coverUrl && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 light:text-emerald-700 font-medium">
                  <Sparkles size={13} />
                  <span>Copertina caricata in automatico!</span>
                </div>
              )}
            </div>
          </div>

          {/* Sezione URL / Ricerca Copertina */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-stone-300 light:text-stone-700">
                Copertina (automatica o personalizzata)
              </label>

              <button
                type="button"
                onClick={handleManualSearchCover}
                disabled={searchingCover || !title.trim()}
                className="flex items-center gap-1 text-xs text-amber-400 light:text-amber-700 hover:text-amber-300 light:hover:text-amber-800 disabled:opacity-40 font-medium px-2 py-0.5 rounded bg-amber-500/10 light:bg-amber-50 hover:bg-amber-500/20 light:hover:bg-amber-100 border border-amber-500/30 light:border-amber-300 transition-colors cursor-pointer"
                title="Cerca copertina tenendo conto del titolo e dell'autore"
              >
                {searchingCover ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                <span>{searchingCover ? 'Ricerca...' : 'Cerca copertina'}</span>
              </button>
            </div>

            <div className="relative">
              <Link2
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400"
              />
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => {
                  setCoverUrl(e.target.value);
                  setCoverSource('manual');
                }}
                className="w-full pl-9 pr-4 py-2 bg-stone-900/60 light:bg-stone-50 border border-stone-700 light:border-stone-300 rounded-lg text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors text-xs"
                placeholder="URL copertina (rilevata in automatico o incolla URL)"
              />
            </div>

            {/* Copertine alternative selezionabili */}
            {alternativeCovers.length > 1 && (
              <div className="pt-1">
                <span className="text-[11px] text-stone-400 light:text-stone-600 block mb-1">
                  Altre copertine trovate (clicca per cambiare):
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {alternativeCovers.map((altUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCoverUrl(altUrl);
                        setCoverSource('manual');
                      }}
                      className={`relative w-11 h-15 rounded-md overflow-hidden border transition-all shrink-0 cursor-pointer ${
                        coverUrl === altUrl
                          ? 'border-amber-400 ring-2 ring-amber-400/50'
                          : 'border-stone-700 light:border-stone-300 opacity-60 hover:opacity-100'
                      }`}
                      title="Seleziona questa copertina"
                    >
                      <img
                        src={altUrl}
                        alt="Opzione copertina"
                        className="w-full h-full object-cover"
                      />
                      {coverUrl === altUrl && (
                        <div className="absolute top-0.5 right-0.5 bg-amber-500 text-stone-950 rounded-full p-0.5">
                          <Check size={8} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Campo Numero di Pagine */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-stone-300 light:text-stone-700">
                <Layers size={15} className="text-amber-400 light:text-amber-600" />
                <span>Numero di pagine</span>
                <span className="text-xs text-stone-500 light:text-stone-400 font-normal">(opzionale)</span>
              </label>
              {autoDetectedPages && (
                <span className="text-[11px] text-emerald-400 light:text-emerald-700 font-medium flex items-center gap-1 bg-emerald-500/10 light:bg-emerald-50 px-2 py-0.5 rounded border border-emerald-500/20 light:border-emerald-200">
                  <Sparkles size={11} />
                  {autoDetectedPages} rilevate online
                </span>
              )}
            </div>
            <input
              type="number"
              min="1"
              step="1"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-900/60 light:bg-stone-50 border border-stone-700 light:border-stone-300 rounded-lg text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors text-sm"
              placeholder="Es. 384"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-300 light:text-stone-700 mb-1.5">Stato</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'reading', label: 'In lettura' },
                  { value: 'completed', label: 'Completato' },
                  { value: 'want', label: 'Da leggere' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    status === opt.value
                      ? 'bg-amber-500/20 light:bg-amber-100 text-amber-300 light:text-amber-800 border-amber-500/40 light:border-amber-300 font-semibold'
                      : 'bg-stone-900/40 light:bg-stone-50 text-stone-400 light:text-stone-700 border-stone-700 light:border-stone-200 hover:text-stone-200 light:hover:text-stone-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {status === 'reading' && (
            <div className="bg-amber-500/10 light:bg-amber-50/80 p-3.5 rounded-xl border border-amber-500/25 light:border-amber-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-amber-300 light:text-amber-900">
                  <Flame size={15} className="text-amber-400 light:text-amber-600" />
                  <span>Pagine lette finora</span>
                </label>
                {pages && readPages && Number(pages) > 0 && Number(readPages) > 0 && (
                  <span className="text-xs font-semibold text-amber-400 light:text-amber-800">
                    {Math.min(100, Math.round((Number(readPages) / Number(pages)) * 100))}%
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                max={pages ? Number(pages) : undefined}
                value={readPages}
                onChange={(e) => setReadPages(e.target.value)}
                className="w-full px-3 py-2 bg-stone-900/80 light:bg-white border border-amber-500/30 light:border-amber-300 rounded-lg text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors text-sm"
                placeholder={pages ? `Es. 120 su ${pages} pagine` : 'Es. 120'}
              />
              {pages && readPages && Number(pages) > 0 && (
                <div className="w-full bg-stone-800 light:bg-stone-200 h-1.5 rounded-full overflow-hidden mt-2.5">
                  <div
                    className="bg-amber-400 light:bg-amber-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, (Number(readPages) / Number(pages)) * 100))}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {status === 'completed' && (
            <div>
              <label className="block text-sm font-medium text-stone-300 light:text-stone-700 mb-1.5">
                Data di completamento (opzionale)
              </label>
              <input
                type="date"
                value={readAt}
                onChange={(e) => setReadAt(e.target.value)}
                className="w-full px-3 py-2.5 bg-stone-900/60 light:bg-stone-50 border border-stone-700 light:border-stone-300 rounded-lg text-stone-100 light:text-stone-900 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
              />
            </div>
          )}

          {error && <div className="text-red-400 text-xs py-1">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-stone-700 light:bg-stone-200 hover:bg-stone-600 light:hover:bg-stone-300 text-stone-300 light:text-stone-700 font-medium rounded-lg transition-colors cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !author.trim()}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {isEditing ? 'Salva modifiche' : 'Aggiungi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
