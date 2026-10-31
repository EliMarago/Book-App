import { useState, useMemo, useEffect } from 'react';
import {
  Library,
  BookOpen,
  Flame,
  Trophy,
  Bookmark,
  Plus,
  StickyNote,
  Layers,
  BookMarked,
} from 'lucide-react';
import { type Book } from '@/lib/supabase';
import { BookDetailModal } from './BookDetailModal';

// Palette predefinita per i dorsi dei libri quando non c'è una copertina
const SPINE_PALETTES = [
  { bg: 'from-[#5a1818] via-[#481111] to-[#2c0909]', text: 'text-amber-200', border: 'border-[#7a2222]', ribbon: '#f59e0b' },
  { bg: 'from-[#12284c] via-[#0d1d37] to-[#071120]', text: 'text-sky-200', border: 'border-[#1b3a6d]', ribbon: '#38bdf8' },
  { bg: 'from-[#18392b] via-[#11291f] to-[#0a1812]', text: 'text-emerald-200', border: 'border-[#24523e]', ribbon: '#34d399' },
  { bg: 'from-[#4a2e18] via-[#382211] to-[#201309]', text: 'text-amber-100', border: 'border-[#684122]', ribbon: '#d97706' },
  { bg: 'from-[#3b1d52] via-[#2c153e] to-[#1a0c24]', text: 'text-purple-200', border: 'border-[#552976]', ribbon: '#c084fc' },
  { bg: 'from-[#2b2b2b] via-[#1e1e1e] to-[#121212]', text: 'text-stone-200', border: 'border-[#3f3f3f]', ribbon: '#e5e5e5' },
  { bg: 'from-[#713f12] via-[#522e0d] to-[#301a07]', text: 'text-amber-200', border: 'border-[#8d4e17]', ribbon: '#fbbf24' },
  { bg: 'from-[#1e3a5f] via-[#152a45] to-[#0c1828]', text: 'text-teal-200', border: 'border-[#2a5185]', ribbon: '#2dd4bf' },
];

function getBookSpineStyle(id: string, title: string) {
  let hash = 0;
  const str = id + title;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SPINE_PALETTES.length;
  return SPINE_PALETTES[index];
}

interface CoverSpineStyle {
  bgGradient: string;
  border: string;
  textColor: string;
  textShadow: string;
  ribbonColor: string;
  isLight: boolean;
}

// In-memory cache globale per conservare i colori estratti delle copertine
const coverColorCache = new Map<string, CoverSpineStyle | null>();

/**
 * Hook che estrae dinamicamente la palette colore dominante dalla copertina di ogni libro.
 * Campiona la tonalità reale e genera una sfumatura cilindrica 3D con riflesso centrale.
 */
function useCoverSpineColors(books: Book[]) {
  const [, setTick] = useState(0);

  useEffect(() => {
    let isMounted = true;

    books.forEach((book) => {
      if (!book.cover_url || coverColorCache.has(book.cover_url)) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;

          canvas.width = 16;
          canvas.height = 24;
          ctx.drawImage(img, 0, 0, 16, 24);

          const imgData = ctx.getImageData(0, 0, 16, 24);
          const data = imgData.data;
          let rTot = 0, gTot = 0, bTot = 0, count = 0;

          for (let y = 0; y < 24; y++) {
            for (let x = 0; x < 16; x++) {
              const idx = (y * 16 + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];

              if (a > 120) {
                // Pondera maggiormente il terzo sinistro dell'immagine (la zona del dorso del libro)
                const weight = x < 5 ? 3.5 : 1.0;
                rTot += r * weight;
                gTot += g * weight;
                bTot += b * weight;
                count += weight;
              }
            }
          }

          if (count > 0 && isMounted) {
            const avgR = Math.round(rTot / count);
            const avgG = Math.round(gTot / count);
            const avgB = Math.round(bTot / count);

            // Bordo scuro (effetto ombra volumetrica sui lati del dorso)
            const dR = Math.round(avgR * 0.38);
            const dG = Math.round(avgG * 0.38);
            const dB = Math.round(avgB * 0.38);

            // Tonalità corpo
            const mR = Math.min(255, Math.round(avgR * 0.85));
            const mG = Math.min(255, Math.round(avgG * 0.85));
            const mB = Math.min(255, Math.round(avgB * 0.85));

            // Riflesso centrale luminoso
            const hR = Math.min(255, Math.round(avgR * 1.35 + 28));
            const hG = Math.min(255, Math.round(avgG * 1.35 + 28));
            const hB = Math.min(255, Math.round(avgB * 1.35 + 28));

            // Calcolo luminosità percepita per leggibilità del testo
            const lum = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
            const isLight = lum > 160;

            coverColorCache.set(book.cover_url!, {
              bgGradient: `linear-gradient(to right, rgb(${dR},${dG},${dB}) 0%, rgb(${mR},${mG},${mB}) 25%, rgb(${hR},${hG},${hB}) 50%, rgb(${mR},${mG},${mB}) 75%, rgb(${dR},${dG},${dB}) 100%)`,
              border: `rgba(${hR}, ${hG}, ${hB}, 0.4)`,
              textColor: isLight ? 'text-stone-900 font-bold' : 'text-amber-100',
              textShadow: isLight
                ? '0 1px 1px rgba(255,255,255,0.7)'
                : '0 1px 2px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.7)',
              ribbonColor: isLight ? `rgb(${dR},${dG},${dB})` : '#f59e0b',
              isLight,
            });

            setTick((t) => t + 1);
          }
        } catch {
          // Fallback se CORS è restrittivo: il fallback visivo CSS utilizzerà la texture sovrapposta
          coverColorCache.set(book.cover_url!, null);
        }
      };

      img.onerror = () => {
        coverColorCache.set(book.cover_url!, null);
      };

      img.src = book.cover_url;
    });

    return () => {
      isMounted = false;
    };
  }, [books]);

  return coverColorCache;
}

interface BookshelfViewProps {
  books: Book[];
  readingBooks: Book[];
  completedBooks: Book[];
  wantBooks: Book[];
  activeTab: 'all' | 'reading' | 'completed' | 'want';
  searchQuery?: string;
  onUpdateBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
  onEditBook: (book: Book) => void;
  onAddBook: () => void;
  onSelectTab: (tab: 'all' | 'reading' | 'completed' | 'want') => void;
}

export function BookshelfView({
  books,
  readingBooks,
  completedBooks,
  wantBooks,
  activeTab,
  searchQuery = '',
  onUpdateBook,
  onDeleteBook,
  onEditBook,
  onAddBook,
  onSelectTab,
}: BookshelfViewProps) {
  // Stile di visualizzazione dello scaffale: Copertine frontali o Dorsi verticali
  const [shelfStyle, setShelfStyle] = useState<'covers' | 'spines'>(() => {
    try {
      return (localStorage.getItem('bookshelf_shelf_style') as 'covers' | 'spines') || 'covers';
    } catch {
      return 'covers';
    }
  });

  const handleShelfStyleChange = (style: 'covers' | 'spines') => {
    setShelfStyle(style);
    try {
      localStorage.setItem('bookshelf_shelf_style', style);
    } catch {
      // ignore
    }
  };

  // Libro attualmente selezionato per ispezione dettagliata
  const [inspectingBook, setInspectingBook] = useState<Book | null>(null);

  // Palette dinamica estratta dalle copertine dei libri
  const coverColors = useCoverSpineColors(books);

  // Raggruppamento dei ripiani dello scaffale
  const shelfSections = useMemo(() => {
    // Se c'è una ricerca attiva, mostra un unico scaffale continuo con i risultati
    if (searchQuery.trim()) {
      return [
        {
          id: 'search-results',
          shelfLabel: 'Ricerca',
          title: `Risultati per "${searchQuery}"`,
          icon: Library,
          books,
          accent: 'amber' as const,
        },
      ];
    }

    if (activeTab === 'reading') {
      return [
        {
          id: 'reading',
          shelfLabel: 'Ripiano',
          title: 'Attualmente In Lettura',
          icon: Flame,
          books: readingBooks,
          accent: 'amber' as const,
        },
      ];
    }

    if (activeTab === 'want') {
      return [
        {
          id: 'want',
          shelfLabel: 'Ripiano',
          title: 'Prossime Letture (Da Leggere)',
          icon: Bookmark,
          books: wantBooks,
          accent: 'sky' as const,
        },
      ];
    }

    if (activeTab === 'completed') {
      // Raggruppa per anno
      const byYear: Record<string, Book[]> = {};
      completedBooks.forEach((b) => {
        const y = b.read_at ? new Date(b.read_at).getFullYear().toString() : 'Senza data';
        if (!byYear[y]) byYear[y] = [];
        byYear[y].push(b);
      });

      const sortedYears = Object.keys(byYear).sort((a, b) => {
        if (a === 'Senza data') return 1;
        if (b === 'Senza data') return -1;
        return Number(b) - Number(a);
      });

      if (sortedYears.length === 0) {
        return [
          {
            id: 'completed-empty',
            shelfLabel: 'Ripiano',
            title: 'Libri Già Letti',
            icon: Trophy,
            books: [],
            accent: 'emerald' as const,
          },
        ];
      }

      return sortedYears.map((year) => ({
        id: `completed-${year}`,
        shelfLabel: 'Ripiano',
        title: year === 'Senza data' ? 'Letti (Data non specificata)' : `Anno ${year}`,
        icon: Trophy,
        books: byYear[year],
        accent: 'emerald' as const,
      }));
    }

    // Default: 'all' -> mostra ripiani divisi per stato
    const sections: Array<{
      id: string;
      shelfLabel: string;
      title: string;
      icon: typeof Flame;
      books: Book[];
      accent: 'amber' | 'sky' | 'emerald';
    }> = [];
    if (readingBooks.length > 0) {
      sections.push({
        id: 'reading',
        shelfLabel: 'Ripiano I',
        title: 'Attualmente In Lettura',
        icon: Flame,
        books: readingBooks,
        accent: 'amber',
      });
    }
    if (wantBooks.length > 0) {
      sections.push({
        id: 'want',
        shelfLabel: 'Ripiano II',
        title: 'Prossime Letture',
        icon: Bookmark,
        books: wantBooks,
        accent: 'sky',
      });
    }
    if (completedBooks.length > 0) {
      sections.push({
        id: 'completed',
        shelfLabel: 'Ripiano III',
        title: 'Libri Completati',
        icon: Trophy,
        books: completedBooks,
        accent: 'emerald',
      });
    }

    if (sections.length === 0) {
      sections.push({
        id: 'empty-shelf',
        shelfLabel: 'Ripiano',
        title: 'La tua Libreria',
        icon: Library,
        books: [],
        accent: 'amber',
      });
    }

    return sections;
  }, [activeTab, books, readingBooks, completedBooks, wantBooks, searchQuery]);

  return (
    <div className="space-y-6">
      {/* BARRA CONTROLLI DELLO SCAFFALE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-850/80 light:bg-white border border-stone-800 light:border-stone-200/90 rounded-2xl p-3 sm:px-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-stone-300 light:text-stone-700">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700">
            <Library size={16} />
          </div>
          <div>
            <span className="font-serif font-bold text-stone-100 light:text-stone-900">
              Scaffale Virtuale
            </span>
            <span className="hidden xs:inline text-stone-500 light:text-stone-400 text-xs ml-2">
              · {books.length} {books.length === 1 ? 'libro disposto' : 'libri disposti'}
            </span>
          </div>
        </div>

        {/* Toggle Stile Scaffale: Copertine vs Dorsi */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-stone-900/90 light:bg-stone-100 p-1 rounded-xl border border-stone-800 light:border-stone-200 text-xs">
          <span className="text-[11px] text-stone-500 light:text-stone-400 font-medium px-1.5 hidden md:inline">
            Visualizza:
          </span>
          <button
            type="button"
            onClick={() => handleShelfStyleChange('covers')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              shelfStyle === 'covers'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
            }`}
            title="Mostra copertine frontali dei libri sullo scaffale"
          >
            <BookOpen size={13} />
            <span>Copertine</span>
          </button>
          <button
            type="button"
            onClick={() => handleShelfStyleChange('spines')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              shelfStyle === 'spines'
                ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
            }`}
            title="Mostra i dorsi dei libri come in una vera libreria fisica"
          >
            <Layers size={13} />
            <span>Dorsi</span>
          </button>
        </div>
      </div>

      {/* STRUTTURA DELLA LIBRERIA A SCAFFALI IN LEGNO */}
      <div className="bg-gradient-to-b from-[#1a120c] via-[#140e09] to-[#0e0a06] light:from-[#faf6f0] light:via-[#f5eee4] light:to-[#eee3d3] border-4 border-[#2d1b11] light:border-[#d4b595] rounded-3xl p-4 sm:p-7 shadow-2xl relative overflow-hidden">
        {/* Effetto luce ambientale calda dall'alto */}
        <div className="absolute top-0 left-1/4 right-1/4 h-28 bg-amber-500/10 light:bg-amber-400/15 blur-3xl pointer-events-none" />

        {books.length === 0 ? (
          /* Scaffale vuoto */
          <div className="py-20 text-center relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 light:bg-amber-100 border border-amber-500/20 light:border-amber-300 flex items-center justify-center mx-auto mb-4 text-amber-400 light:text-amber-700 shadow-inner">
              <Library size={32} />
            </div>
            <h3 className="font-serif text-xl font-bold text-stone-100 light:text-stone-900 mb-1">
              Lo scaffale è vuoto
            </h3>
            <p className="text-xs sm:text-sm text-stone-400 light:text-stone-600 max-w-sm mx-auto mb-5 leading-relaxed">
              Il mobile è pronto ad accogliere le tue letture. Inizia aggiungendo il primo libro!
            </p>
            <button
              onClick={onAddBook}
              className="inline-flex items-center gap-2 py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95"
            >
              <Plus size={18} />
              Aggiungi libro sullo scaffale
            </button>
          </div>
        ) : (
          <div className="space-y-12 sm:space-y-16 relative z-10">
            {shelfSections.map((section) => {
              const SectionIcon = section.icon;
              const accentBadge =
                section.accent === 'emerald'
                  ? 'bg-emerald-500/15 light:bg-emerald-100 text-emerald-400 light:text-emerald-700 border-emerald-500/30 light:border-emerald-300'
                  : section.accent === 'sky'
                    ? 'bg-sky-500/15 light:bg-sky-100 text-sky-400 light:text-sky-700 border-sky-500/30 light:border-sky-300'
                    : 'bg-amber-500/15 light:bg-amber-100 text-amber-400 light:text-amber-700 border-amber-500/30 light:border-amber-300';

              return (
                <div key={section.id} className="relative">
                  {/* Intestazione del ripiano coerente con i font e il design dell'app */}
                  <div className="flex items-center justify-between gap-2 mb-4 px-2 pb-2.5 border-b border-stone-800/80 light:border-stone-300/70">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${accentBadge}`}
                      >
                        <SectionIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${accentBadge}`}
                          >
                            {section.shelfLabel}
                          </span>
                          <h3 className="font-serif text-base sm:text-lg font-bold text-stone-100 light:text-stone-900 truncate">
                            {section.title}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-sans font-semibold px-2.5 py-1 rounded-full bg-stone-850/90 light:bg-white/90 text-stone-300 light:text-stone-700 border border-stone-700/70 light:border-stone-300/80 shrink-0 whitespace-nowrap">
                      {section.books.length} {section.books.length === 1 ? 'volume' : 'volumi'}
                    </span>
                  </div>

                  {/* LIBRI APPOGGIATI SUL RIPIANO */}
                  {shelfStyle === 'covers' ? (
                    /* 1. VISTA COPERTINE FRONTALI CON PROFONDITÀ */
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5 items-end px-2 pt-4 pb-2 min-h-[220px]">
                      {section.books.map((book) => {
                        const spine = getBookSpineStyle(book.id, book.title);

                        return (
                          <div
                            key={book.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setInspectingBook(book)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setInspectingBook(book);
                              }
                            }}
                            className="group relative flex flex-col items-center cursor-pointer transition-all duration-300 hover:-translate-y-3 active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl"
                            title={`${book.title} — ${book.author}`}
                          >
                            {/* Libro appoggiato sullo scaffale */}
                            <div className="relative w-full aspect-[2/3] max-w-[150px] rounded-r-lg rounded-l-xs overflow-hidden shadow-2xl transition-all group-hover:shadow-[0_20px_25px_-5px_rgba(245,158,11,0.25)] border-r-2 border-stone-200/30">
                              {/* Effetto costa e piega copertina sinistra */}
                              <div className="absolute top-0 left-0 bottom-0 w-3 bg-gradient-to-r from-white/20 via-transparent to-black/40 z-20 pointer-events-none" />

                              {/* Bordo pagine a destra */}
                              <div className="absolute top-0 right-0 bottom-0 w-1 bg-gradient-to-l from-stone-200/80 via-stone-300 to-stone-400 z-20 pointer-events-none shadow-sm" />

                              {book.cover_url ? (
                                <img
                                  src={book.cover_url}
                                  alt={book.title}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  loading="lazy"
                                />
                              ) : (
                                /* Copertina telata classica per libri senza immagine */
                                <div
                                  className={`w-full h-full bg-gradient-to-br ${spine.bg} p-3 flex flex-col justify-between border ${spine.border} relative overflow-hidden`}
                                >
                                  <div className="text-[9px] uppercase tracking-widest text-amber-200/60 font-sans font-semibold">
                                    Bookshelf
                                  </div>
                                  <div className="my-auto text-center px-1">
                                    <h4 className="font-serif font-bold text-xs sm:text-sm text-amber-100 leading-snug line-clamp-3">
                                      {book.title}
                                    </h4>
                                    <p className="text-[10px] text-amber-200/80 mt-1 font-sans truncate">
                                      {book.author}
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-between text-[9px] font-sans text-amber-300/70 border-t border-amber-500/20 pt-1">
                                    <BookMarked size={12} />
                                    {book.pages && <span>{book.pages}p</span>}
                                  </div>
                                </div>
                              )}

                              {/* Nastro segnalibro in alto a destra se in lettura */}
                              {book.status === 'reading' && (
                                <div
                                  className="absolute top-0 right-3 w-3 h-5 bg-amber-400 shadow-md z-30 pointer-events-none"
                                  style={{
                                    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)',
                                  }}
                                  title="In lettura"
                                />
                              )}

                              {/* Sigillo di completamento per i letti */}
                              {book.status === 'completed' && (
                                <div className="absolute top-1.5 left-2 z-30 pointer-events-none w-5 h-5 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-md">
                                  <Trophy size={11} />
                                </div>
                              )}

                              {/* Barra avanzamento pagine in basso se in lettura */}
                              {book.status === 'reading' && book.pages && book.pages > 0 && (
                                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60 backdrop-blur-xs z-30">
                                  <div
                                    className="h-full bg-amber-400"
                                    style={{
                                      width: `${Math.min(100, ((book.read_pages || 0) / book.pages) * 100)}%`,
                                    }}
                                  />
                                </div>
                              )}

                              {/* Badge note se presenti */}
                              {book.notes_count && book.notes_count > 0 ? (
                                <div className="absolute bottom-2 right-2 z-30 pointer-events-none bg-stone-900/90 text-amber-300 border border-amber-500/40 rounded-full px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-0.5 shadow-md">
                                  <StickyNote size={9} />
                                  <span>{book.notes_count}</span>
                                </div>
                              ) : null}
                            </div>

                            {/* Ombra di contatto sotto il libro appoggiato sullo scaffale */}
                            <div className="w-4/5 h-2 bg-black/80 blur-xs rounded-full mt-1.5 transition-all group-hover:scale-125 group-hover:opacity-40" />

                            {/* Titolo e autore sotto la copertina */}
                            <div className="text-center mt-2 px-1 w-full max-w-[160px]">
                              <p className="font-serif text-xs sm:text-sm font-semibold text-stone-200 light:text-stone-800 line-clamp-1 group-hover:text-amber-400 transition-colors">
                                {book.title}
                              </p>
                              <p className="font-sans text-[11px] sm:text-xs text-stone-400 light:text-stone-600 truncate mt-0.5">
                                {book.author}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* 2. VISTA DORSI DEI LIBRI VERTICALI (LIBRERIA CLASSICA) */
                    <div className="flex items-end gap-1 sm:gap-2 px-2 sm:px-4 pt-6 pb-2 overflow-x-auto scrollbar-thin min-h-[240px]">
                      {section.books.map((book) => {
                        const dynamicSpine = book.cover_url ? coverColors.get(book.cover_url) : null;
                        const spine = getBookSpineStyle(book.id, book.title);

                        // Calcola spessore del dorso in base alle pagine (classi valide Tailwind v3)
                        let spineWidth = 'w-10 sm:w-11';
                        if (book.pages && book.pages > 600) spineWidth = 'w-14 sm:w-16';
                        else if (book.pages && book.pages > 350) spineWidth = 'w-11 sm:w-12';
                        else if (book.pages && book.pages < 150) spineWidth = 'w-9 sm:w-10';

                        // Altezza variabile realistica ma uniforme (usando valori validi sia su mobile che desktop)
                        const heights = [
                          'h-52 sm:h-60',
                          'h-[200px] sm:h-[232px]',
                          'h-[214px] sm:h-[246px]',
                          'h-56 sm:h-64',
                        ];
                        const spineHeight = heights[Math.abs(book.id.charCodeAt(0)) % heights.length];

                        return (
                          <div
                            key={book.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setInspectingBook(book)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setInspectingBook(book);
                              }
                            }}
                            style={{
                              background: dynamicSpine ? dynamicSpine.bgGradient : undefined,
                              borderColor: dynamicSpine ? dynamicSpine.border : undefined,
                            }}
                            className={`group relative ${spineWidth} ${spineHeight} rounded-t-sm shrink-0 flex flex-col justify-between py-3 px-1 cursor-pointer transition-all duration-300 hover:-translate-y-4 hover:shadow-2xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                              dynamicSpine ? '' : `bg-gradient-to-r ${spine.bg} ${spine.border}`
                            } border-t border-b-2 shadow-lg select-none overflow-hidden`}
                            title={`${book.title} — ${book.author}`}
                          >
                            {/* Texture sfumata prelevata direttamente dalla copertina */}
                            {book.cover_url && (
                              <div
                                className="absolute inset-0 bg-cover pointer-events-none opacity-40 mix-blend-overlay filter blur-[0.5px]"
                                style={{
                                  backgroundImage: `url(${book.cover_url})`,
                                  backgroundPosition: 'left center',
                                  backgroundSize: '300% 100%',
                                }}
                              />
                            )}

                            {/* Segnalibro sporgente in alto */}
                            {book.status === 'reading' && (
                              <div
                                className="absolute -top-3 left-1/2 -translate-x-1/2 w-2.5 h-4 shadow-md z-20 pointer-events-none"
                                style={{
                                  backgroundColor: dynamicSpine ? dynamicSpine.ribbonColor : '#f59e0b',
                                  clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 70%, 0 100%)',
                                }}
                              />
                            )}

                            {/* Capitello superiore del libro */}
                            <div
                              className={`h-1 rounded-full mx-auto w-4/5 mb-1 z-10 ${
                                dynamicSpine?.isLight ? 'bg-stone-900/30' : 'bg-amber-100/40 opacity-70'
                              }`}
                            />

                            {/* Titolo e autore verticali lungo il dorso */}
                            <div className="flex-1 flex items-center justify-center overflow-hidden my-1 z-10">
                              <span
                                style={{
                                  textShadow: dynamicSpine ? dynamicSpine.textShadow : undefined,
                                }}
                                className={`writing-vertical-rl font-serif font-bold text-[11px] sm:text-xs tracking-wide ${
                                  dynamicSpine ? dynamicSpine.textColor : spine.text
                                } truncate max-h-[140px] drop-shadow-xs`}
                              >
                                {book.title}
                              </span>
                            </div>

                            {/* Parte inferiore: Sigillo o pagine */}
                            <div className="flex flex-col items-center gap-1 mt-auto z-10">
                              {book.status === 'completed' && (
                                <Trophy
                                  size={11}
                                  className={dynamicSpine?.isLight ? 'text-amber-800' : 'text-amber-300/80'}
                                />
                              )}
                              <span
                                className={`text-[9px] font-sans font-medium truncate max-w-full ${
                                  dynamicSpine?.isLight ? 'text-stone-700 font-semibold' : 'text-stone-300/80'
                                }`}
                              >
                                {book.pages ? `${book.pages}p` : '•'}
                              </span>
                            </div>

                            {/* Nervature orizzontali da legatoria classica */}
                            <div className="absolute top-8 left-0 right-0 h-0.5 bg-black/30 border-b border-white/20 pointer-events-none" />
                            <div className="absolute bottom-8 left-0 right-0 h-0.5 bg-black/30 border-b border-white/20 pointer-events-none" />

                            {/* Luce riflessa longitudinale sul dorso */}
                            <div className="absolute inset-y-0 left-0.5 w-1 bg-white/15 pointer-events-none z-10" />
                            <div className="absolute inset-y-0 right-0.5 w-1 bg-black/40 pointer-events-none z-10" />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ASSE IN LEGNO DEL RIPIANO (3D SHELF PLANK) */}
                  <div className="w-full">
                    <div className="bookshelf-ledge w-full" />
                    <div className="bookshelf-shelf w-full h-4 sm:h-5 rounded-b-md" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SCHEDA LIBRO COMPLETA (QUANDO SI APRE UN LIBRO DALLO SCAFFALE) */}
      {inspectingBook && (
        <BookDetailModal
          book={inspectingBook}
          onClose={() => setInspectingBook(null)}
          onUpdateBook={(updated) => {
            onUpdateBook(updated);
            setInspectingBook(updated);
          }}
          onEditBook={(book) => {
            onEditBook(book);
            setInspectingBook(null);
          }}
          onDeleteBook={(id) => {
            onDeleteBook(id);
            setInspectingBook(null);
          }}
        />
      )}
    </div>
  );
}
