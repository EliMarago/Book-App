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
import {
  fetchBookCover,
  searchAlternativeCovers,
  fetchBookPageCount,
  searchBookSuggestions,
  type BookSuggestion,
} from '@/lib/bookCoverApi';

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
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tiene traccia dell'ultima query cercata per evitare ricerche identiche
  const lastSearchedRef = useRef<string>('');
  const justSelectedSuggestionRef = useRef(false);

  // Blocca lo scroll del body e gestisce il tasto Escape quando la modale è aperta
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Autocompletamento suggerimenti libri mentre l'utente digita il titolo
  useEffect(() => {
    if (isEditing) return;
    if (justSelectedSuggestionRef.current) {
      justSelectedSuggestionRef.current = false;
      return;
    }

    const q = title.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const results = await searchBookSuggestions(q);
        if (isMounted) {
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        }
      } catch {
        if (isMounted) setSuggestions([]);
      }
    }, 320);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [title, isEditing]);

  const handleSelectSuggestion = (item: BookSuggestion) => {
    justSelectedSuggestionRef.current = true;
    setTitle(item.title);
    if (item.author) setAuthor(item.author);
    if (item.pages && item.pages > 0) {
      setPages(String(item.pages));
      setAutoDetectedPages(item.pages);
    }
    if (item.coverUrl) {
      setCoverUrl(item.coverUrl);
      setCoverSource('auto');
      lastSearchedRef.current = `${item.title.toLowerCase()}::${item.author.toLowerCase()}`;
    }
    setShowSuggestions(false);
  };

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

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

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
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Modifica libro' : 'Aggiungi libro'}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-up"
      onClick={onClose}
    >
      <div
        className="bg-stone-900 light:bg-white rounded-3xl border border-stone-800/90 light:border-stone-200 max-w-lg w-full shadow-2xl max-h-[88dvh] sm:max-h-[92vh] flex flex-col overflow-hidden overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-stone-800 light:border-stone-200 shrink-0 bg-stone-900 light:bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-600">
              <BookPlus size={20} />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-stone-100 light:text-stone-900 leading-tight">
                {isEditing ? 'Modifica libro' : 'Aggiungi libro'}
              </h2>
              <p className="text-xs text-stone-400 light:text-stone-500">
                {isEditing ? 'Aggiorna i dettagli della scheda' : 'Inserisci titolo e autore nella tua libreria'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 light:text-stone-500 hover:text-stone-100 light:hover:text-stone-900 p-1.5 rounded-lg hover:bg-stone-800 light:hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Chiudi finestra"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4.5 overflow-y-auto flex-1">
          <div className="flex gap-4 items-start">
            {/* Box Anteprima Copertina */}
            <div className="relative shrink-0 w-24 h-36 rounded-xl overflow-hidden bg-stone-950 light:bg-stone-100 flex flex-col items-center justify-center shadow-lg border border-stone-800 light:border-stone-200 book-spine-effect group">
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
                  <BookMarked size={30} className="text-stone-600 light:text-stone-400 mb-1" />
                  <span className="text-[10px] text-stone-500 light:text-stone-400 leading-tight">
                    Nessuna copertina
                  </span>
                </div>
              )}
              <ImageOff size={28} className="text-stone-600 light:text-stone-400 hidden" />

              {/* Indicatore di caricamento in sovrimpressione */}
              {searchingCover && (
                <div className="absolute inset-0 bg-stone-950/85 light:bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center">
                  <Loader2 size={22} className="animate-spin text-amber-400 light:text-amber-600 mb-1" />
                  <span className="text-[10px] text-amber-300 light:text-amber-700 font-medium">
                    Cerco...
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3 min-w-0">
              <div className="relative">
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 light:text-stone-700 mb-1">
                  Titolo *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={() => {
                    if (!isEditing && suggestions.length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 180);
                  }}
                  className="w-full px-3.5 py-2.5 bg-stone-950/50 light:bg-stone-50 border border-stone-800 light:border-stone-300 rounded-xl text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-medium"
                  placeholder="Es. Il nome della rosa"
                />

                {/* Menu a tendina suggerimenti rapidi in tempo reale */}
                {!isEditing && showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-stone-900 light:bg-white border border-stone-700 light:border-stone-200 rounded-2xl shadow-2xl overflow-hidden divide-y divide-stone-800/80 light:divide-stone-100 max-h-60 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-stone-850/90 light:bg-stone-50 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-amber-400 light:text-amber-700">
                      <span className="flex items-center gap-1">
                        <Sparkles size={10} />
                        Suggerimenti dal catalogo
                      </span>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowSuggestions(false);
                        }}
                        className="text-stone-400 hover:text-stone-200 light:hover:text-stone-800 cursor-pointer"
                      >
                        Chiudi
                      </button>
                    </div>
                    {suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(item);
                        }}
                        className="w-full flex items-center gap-2.5 p-2.5 text-left hover:bg-stone-800/90 light:hover:bg-amber-50/70 transition-colors cursor-pointer"
                      >
                        <div className="w-8 h-12 rounded bg-stone-800 light:bg-stone-100 border border-stone-700 light:border-stone-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {item.coverUrl ? (
                            <img src={item.coverUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <BookMarked size={13} className="text-stone-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-serif font-semibold text-xs sm:text-sm text-stone-100 light:text-stone-900 truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-stone-400 light:text-stone-600 truncate">
                            {item.author || 'Autore sconosciuto'}
                            {item.publishedYear ? ` · ${item.publishedYear}` : ''}
                            {item.pages ? ` · ${item.pages} pag.` : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 light:text-stone-700 mb-1">
                  Autore *
                </label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-950/50 light:bg-stone-50 border border-stone-800 light:border-stone-300 rounded-xl text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-medium"
                  placeholder="Es. Umberto Eco"
                />
              </div>

              {coverSource === 'auto' && coverUrl && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 light:text-emerald-700 font-medium">
                  <Sparkles size={13} />
                  <span>Copertina trovata in automatico!</span>
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
                className="flex items-center gap-1 text-xs text-amber-400 light:text-amber-700 hover:text-amber-300 light:hover:text-amber-800 disabled:opacity-40 font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 light:bg-amber-50 hover:bg-amber-500/20 light:hover:bg-amber-100 border border-amber-500/30 light:border-amber-300 transition-colors cursor-pointer"
                title="Cerca copertina online"
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
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400 pointer-events-none"
              />
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => {
                  setCoverUrl(e.target.value);
                  setCoverSource('manual');
                }}
                className="w-full pl-9 pr-4 py-2 bg-stone-950/50 light:bg-stone-50 border border-stone-800 light:border-stone-300 rounded-xl text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors text-xs"
                placeholder="Incolla URL copertina personalizzato..."
              />
            </div>

            {/* Copertine alternative selezionabili */}
            {alternativeCovers.length > 1 && (
              <div className="pt-1">
                <span className="text-[11px] text-stone-400 light:text-stone-600 block mb-1 font-medium">
                  Altre copertine trovate:
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
                      className={`relative w-12 h-16 rounded-lg overflow-hidden border transition-all shrink-0 cursor-pointer ${
                        coverUrl === altUrl
                          ? 'border-amber-400 ring-2 ring-amber-400/50'
                          : 'border-stone-800 light:border-stone-300 opacity-60 hover:opacity-100'
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
                          <Check size={9} strokeWidth={3} />
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
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-300 light:text-stone-700">
                <Layers size={14} className="text-amber-400 light:text-amber-600" />
                <span>Numero di pagine</span>
                <span className="text-[11px] text-stone-500 font-normal normal-case">(opzionale)</span>
              </label>
              {autoDetectedPages && (
                <span className="text-[11px] text-emerald-400 light:text-emerald-700 font-medium flex items-center gap-1 bg-emerald-500/10 light:bg-emerald-50 px-2 py-0.5 rounded border border-emerald-500/20 light:border-emerald-200">
                  <Sparkles size={11} />
                  {autoDetectedPages} pagine rilevate
                </span>
              )}
            </div>
            <input
              type="number"
              min="1"
              step="1"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-950/50 light:bg-stone-50 border border-stone-800 light:border-stone-300 rounded-xl text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-medium"
              placeholder="Es. 384"
            />
          </div>

          {/* Scelta Stato di Lettura */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 light:text-stone-700 mb-1.5">
              Stato
            </label>
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
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    status === opt.value
                      ? opt.value === 'reading'
                        ? 'bg-amber-500/20 light:bg-amber-100 text-amber-300 light:text-amber-800 border-amber-500/50 ring-1 ring-amber-500/30'
                        : opt.value === 'completed'
                          ? 'bg-emerald-500/20 light:bg-emerald-100 text-emerald-400 light:text-emerald-800 border-emerald-500/50 ring-1 ring-emerald-500/30'
                          : 'bg-sky-500/20 light:bg-sky-100 text-sky-400 light:text-sky-800 border-sky-500/50 ring-1 ring-sky-500/30'
                      : 'bg-stone-950/40 light:bg-stone-50 text-stone-400 light:text-stone-600 border-stone-800 light:border-stone-200 hover:text-stone-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {status === 'reading' && (
            <div className="bg-amber-500/10 light:bg-amber-50/80 p-4 rounded-2xl border border-amber-500/25 light:border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300 light:text-amber-900">
                  <Flame size={15} className="text-amber-400 light:text-amber-600" />
                  <span>Pagine lette finora</span>
                </label>
                {pages && readPages && Number(pages) > 0 && Number(readPages) > 0 && (
                  <span className="text-xs font-bold text-amber-400 light:text-amber-800">
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
                className="w-full px-3.5 py-2.5 bg-stone-950/80 light:bg-white border border-amber-500/40 light:border-amber-300 rounded-xl text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-medium"
                placeholder={pages ? `Es. 120 su ${pages} pagine` : 'Es. 120'}
              />
              {pages && readPages && Number(pages) > 0 && (
                <div className="w-full bg-stone-900 light:bg-stone-200 h-1.5 rounded-full overflow-hidden mt-1">
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-300 light:text-stone-700 mb-1.5">
                Data di completamento (opzionale)
              </label>
              <input
                type="date"
                value={readAt}
                onChange={(e) => setReadAt(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-950/50 light:bg-stone-50 border border-stone-800 light:border-stone-300 rounded-xl text-stone-100 light:text-stone-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm"
              />
            </div>
          )}

          {error && (
            <div className="text-red-400 light:text-red-700 text-xs py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-3 border-t border-stone-800 light:border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-stone-800 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200 text-stone-300 light:text-stone-700 font-semibold rounded-xl transition-all cursor-pointer text-sm"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim() || !author.trim()}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-450 hover:from-amber-450 hover:to-amber-400 text-stone-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-98 text-sm"
            >
              {loading && <Loader2 size={16} className="animate-spin text-stone-950" />}
              {isEditing ? 'Salva modifiche' : 'Aggiungi libro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
