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
  Pencil,
  Crown,
  Calendar,
  ArrowRight,
  Medal,
} from 'lucide-react';
import { type Book } from '@/lib/supabase';
import { BookDetailModal } from './BookDetailModal';
import { CoverImage } from './CoverImage';
import { EmptyReadingShelf } from './EmptyReadingShelf';
import { optimizeCoverUrl } from '@/lib/coverUrl';
import { orderWantBooks, orderBestBooks, reorderBookIds, shiftBookPosition } from '@/lib/bookPriority';

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
    // Raggruppa i ridisegni: un solo aggiornamento per frame invece di uno per ogni copertina caricata
    let rafId: number | null = null;
    const scheduleRender = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (isMounted) setTick((t) => t + 1);
      });
    };

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

            scheduleRender();
          }
        } catch {
          // Fallback se CORS è restrittivo: il fallback visivo CSS utilizzerà la texture sovrapposta
          coverColorCache.set(book.cover_url!, null);
        }
      };

      // Per campionare il colore basta una miniatura minuscola: se non esiste, ripiega sull'originale
      const thumbUrl = optimizeCoverUrl(book.cover_url, 60);
      img.onerror = () => {
        if (img.src !== book.cover_url && thumbUrl !== book.cover_url) {
          img.src = book.cover_url!;
          return;
        }
        coverColorCache.set(book.cover_url!, null);
      };

      img.src = thumbUrl;
    });

    return () => {
      isMounted = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
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
  /** Avvia la lettura di un libro "Da leggere" (usato dal ripiano "In lettura" vuoto) */
  onStartReading?: (book: Book) => Promise<void> | void;
  onSelectTab?: (tab: 'all' | 'reading' | 'completed' | 'want') => void;
  priorityOrder?: string[];
  onUpdatePriorityOrder?: (newOrder: string[]) => void;
  bestBooksOrder?: string[];
  onUpdateBestBooksOrder?: (newOrder: string[]) => void;
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
  onStartReading,
  onSelectTab,
  priorityOrder = [],
  onUpdatePriorityOrder,
  bestBooksOrder = [],
  onUpdateBestBooksOrder,
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

  // Stato per la modalità di riordino manuale e drag & drop libri da leggere
  const [isReorderingWant, setIsReorderingWant] = useState(false);
  const [draggedBookId, setDraggedBookId] = useState<string | null>(null);
  const [dragOverBookId, setDragOverBookId] = useState<string | null>(null);

  // Stato per la modalità di riordino manuale e drag & drop classifica migliori libri letti
  const [isReorderingBest, setIsReorderingBest] = useState(false);
  const [draggedBestBookId, setDraggedBestBookId] = useState<string | null>(null);
  const [dragOverBestBookId, setDragOverBestBookId] = useState<string | null>(null);

  // Anno solare corrente (es. 2026)
  const currentYear = useMemo(() => new Date().getFullYear().toString(), []);

  // Anni disponibili calcolati dinamicamente dai libri completati (ordinati decrescenti: il più recente in cima)
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    completedBooks.forEach((b) => {
      if (b.read_at) {
        const d = new Date(b.read_at);
        if (!isNaN(d.getTime())) yearsSet.add(d.getFullYear().toString());
      }
    });
    return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
  }, [completedBooks]);

  // Filtro rapido per anno nella visualizzazione dei libri completati:
  // Si imposta di default sull'anno più recente disponibile (es. 2026) per una vista ordinata e pulita
  const [selectedYear, setSelectedYear] = useState<string>('all');

  useEffect(() => {
    if (availableYears.length > 0 && selectedYear === 'all') {
      if (availableYears.includes(currentYear)) {
        setSelectedYear(currentYear);
      } else if (availableYears[0]) {
        setSelectedYear(availableYears[0]);
      }
    }
  }, [availableYears, currentYear]);

  // Libri "Da leggere" ordinati secondo la priorità personalizzata
  const orderedWantBooks = useMemo(() => {
    return orderWantBooks(wantBooks, priorityOrder);
  }, [wantBooks, priorityOrder]);

  // Libri completati ordinati per il ripiano d'onore "I Migliori Libri Letti"
  const orderedBestBooks = useMemo(() => {
    return orderBestBooks(completedBooks, bestBooksOrder);
  }, [completedBooks, bestBooksOrder]);

  // Gestione deterministica del drag & drop basata esattamente sui libri presenti a schermo
  const handleDropReorder = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const nextOrder = reorderBookIds(orderedWantBooks, sourceId, targetId);
    onUpdatePriorityOrder?.(nextOrder);
  };

  // Gestione deterministica drag & drop per la classifica dei migliori libri letti
  const handleBestDropReorder = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const nextOrder = reorderBookIds(orderedBestBooks, sourceId, targetId);
    onUpdateBestBooksOrder?.(nextOrder);
  };

  // Gestione spostamento rapido (frecce ‹ e ›)
  const handleShift = (bookId: string, direction: 'left' | 'right' | 'first' | 'last') => {
    const nextOrder = shiftBookPosition(orderedWantBooks, bookId, direction);
    onUpdatePriorityOrder?.(nextOrder);
  };

  // Posizione di priorità del libro attualmente ispezionato
  const inspectingRank = useMemo(() => {
    if (!inspectingBook || inspectingBook.status !== 'want') return undefined;
    const idx = orderedWantBooks.findIndex((b) => b.id === inspectingBook.id);
    return idx >= 0 ? idx + 1 : undefined;
  }, [inspectingBook, orderedWantBooks]);

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
          title: 'Da Leggere',
          icon: Bookmark,
          books: orderedWantBooks,
          accent: 'sky' as const,
        },
      ];
    }

    if (activeTab === 'completed') {
      const sections: Array<{
        id: string;
        shelfLabel: string;
        title: string;
        icon: typeof Flame;
        books: Book[];
        accent: 'amber' | 'sky' | 'emerald';
      }> = [];

      // Filtra i libri se è selezionato un anno specifico
      const activeCompleted =
        selectedYear === 'all'
          ? completedBooks
          : completedBooks.filter((b) => {
              if (!b.read_at) return selectedYear === 'Senza data';
              const d = new Date(b.read_at);
              return !isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear;
            });

      const yearOrderedBest = orderBestBooks(activeCompleted, bestBooksOrder);

      // Ripiano d'onore in cima con la classifica dei migliori libri letti ordinabili via Drag & Drop
      if (yearOrderedBest.length > 0) {
        sections.push({
          id: 'best-completed',
          shelfLabel: "Ripiano d'Onore",
          title:
            selectedYear === 'all'
              ? 'I Migliori Libri Letti'
              : `I Migliori del ${selectedYear}`,
          icon: Crown,
          books: yearOrderedBest,
          accent: 'amber',
        });
      }

      if (selectedYear !== 'all') {
        // Mostra tutti i libri letti di quest'anno specifico
        if (activeCompleted.length > 0) {
          sections.push({
            id: `completed-${selectedYear}`,
            shelfLabel: selectedYear === 'Senza data' ? 'Ripiano' : `Anno ${selectedYear}`,
            title: selectedYear === 'Senza data' ? 'Libri Senza Data' : `Libri del ${selectedYear}`,
            icon: Trophy,
            books: activeCompleted,
            accent: 'emerald',
          });
        }
      } else {
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

        sortedYears.forEach((year) => {
          sections.push({
            id: `completed-${year}`,
            shelfLabel: year === 'Senza data' ? 'Ripiano' : `Anno ${year}`,
            title: year === 'Senza data' ? 'Data non specificata' : `Libri del ${year}`,
            icon: Trophy,
            books: byYear[year],
            accent: 'emerald',
          });
        });
      }

      if (sections.length === 0) {
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

      return sections;
    }

    // Default: 'all' -> Vetrina curata e snella (In lettura, Da leggere, Podio d'onore e Ultime letture)
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
    if (orderedWantBooks.length > 0) {
      sections.push({
        id: 'want',
        shelfLabel: 'Ripiano II',
        title: 'Da Leggere',
        icon: Bookmark,
        books: orderedWantBooks,
        accent: 'sky',
      });
    }
    if (orderedBestBooks.length > 0) {
      sections.push({
        id: 'best-completed',
        shelfLabel: "Ripiano d'Onore",
        title: 'I Migliori Libri Letti',
        icon: Crown,
        books: orderedBestBooks.slice(0, 10),
        accent: 'amber',
      });
    }

    // Ultime letture completate (fino a 6 libri) per mantenere la vetrina piacevole e veloce
    const recentCompleted = [...completedBooks]
      .sort((a, b) => {
        const dateA = a.read_at ? new Date(a.read_at).getTime() : 0;
        const dateB = b.read_at ? new Date(b.read_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 6);

    if (recentCompleted.length > 0) {
      sections.push({
        id: 'recent-completed',
        shelfLabel: 'Ripiano Recenti',
        title: 'Ultime Letture',
        icon: Trophy,
        books: recentCompleted,
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
  }, [
    activeTab,
    books,
    readingBooks,
    completedBooks,
    orderedWantBooks,
    orderedBestBooks,
    searchQuery,
    selectedYear,
  ]);

  return (
    <div className="space-y-6">
      {/* BARRA CONTROLLI DELLO SCAFFALE */}
      <div className="flex flex-col gap-2.5 bg-stone-850/80 light:bg-white border border-stone-800 light:border-stone-200/90 rounded-2xl p-2.5 sm:px-4 sm:py-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700 shrink-0">
              <Library size={15} />
            </div>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="font-serif font-bold text-xs xs:text-sm sm:text-base text-stone-100 light:text-stone-900 truncate">
                Scaffale Virtuale
              </span>
              <span className="hidden xs:inline text-stone-500 light:text-stone-400 text-[11px] sm:text-xs shrink-0">
                · {books.length} {books.length === 1 ? 'libro' : 'libri'}
              </span>
            </div>
          </div>

          {/* Toggle Stile Scaffale: Copertine vs Dorsi */}
          <div className="flex items-center gap-1 bg-stone-900/90 light:bg-stone-100 p-0.5 sm:p-1 rounded-xl border border-stone-800 light:border-stone-200 text-xs shrink-0">
            <button
              type="button"
              onClick={() => handleShelfStyleChange('covers')}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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

        {/* Filtro Anno Dinamico nella vista Libri Letti: si aggiorna da solo ogni anno */}
        {activeTab === 'completed' && availableYears.length > 0 && (
          <div className="w-full flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin pt-2 border-t border-stone-800/60 light:border-stone-200/60 overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
            <span className="text-[11px] font-medium text-stone-400 light:text-stone-600 flex items-center gap-1 shrink-0 mr-1">
              <Calendar size={12} className="text-emerald-400 light:text-emerald-600" />
              Anno:
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear('all')}
              className={`px-2.5 py-0.5 sm:py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${
                selectedYear === 'all'
                  ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-semibold shadow-xs'
                  : 'bg-stone-900/80 light:bg-stone-100 text-stone-300 light:text-stone-700 border-stone-700/80 light:border-stone-300 hover:text-white light:hover:text-stone-950'
              }`}
            >
              Tutti ({completedBooks.length})
            </button>
            {availableYears.map((year) => {
              const count = completedBooks.filter(
                (b) => b.read_at && new Date(b.read_at).getFullYear().toString() === year
              ).length;
              const isSelected = selectedYear === year;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`px-2.5 py-0.5 sm:py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-semibold shadow-xs'
                      : 'bg-stone-900/80 light:bg-stone-100 text-stone-300 light:text-stone-700 border-stone-700/80 light:border-stone-300 hover:text-white light:hover:text-stone-950'
                  }`}
                >
                  <span>{year}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums ${
                      isSelected
                        ? 'bg-stone-950/20 text-stone-950'
                        : 'bg-stone-800 light:bg-stone-200 text-stone-300 light:text-stone-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
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
                  {/* Intestazione del ripiano con tipografia fluida e responsive per mobile */}
                  <div className="mb-3.5 sm:mb-4 px-1 sm:px-2 pb-2.5 border-b border-stone-800/80 light:border-stone-300/70">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center shrink-0 ${accentBadge}`}
                        >
                          <SectionIcon size={14} className="sm:w-[15px] sm:h-[15px]" />
                        </div>
                        <div className="flex flex-wrap sm:flex-nowrap items-baseline sm:items-center gap-1.5 sm:gap-2 min-w-0">
                          <span
                            className={`text-[10.5px] sm:text-[11px] font-sans font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md border shrink-0 ${accentBadge}`}
                          >
                            {section.shelfLabel}
                          </span>
                          <h3 className="font-serif text-xs xs:text-sm sm:text-base md:text-lg font-bold text-stone-100 light:text-stone-900 leading-snug line-clamp-1 sm:line-clamp-2 break-words">
                            {section.title}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {section.id === 'want' && section.books.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setIsReorderingWant((v) => !v)}
                            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                              isReorderingWant
                                ? 'bg-sky-500 text-stone-950 font-bold shadow-xs ring-1 ring-sky-300'
                                : 'bg-stone-850/80 light:bg-white text-sky-400 light:text-sky-700 border border-sky-500/30 hover:border-sky-400 hover:bg-sky-500/10'
                            }`}
                            title="Modifica priorità di lettura con Drag and Drop"
                          >
                            <Pencil size={12} />
                            <span>{isReorderingWant ? 'Fine' : 'Modifica ordine'}</span>
                          </button>
                        )}
                        {section.id === 'best-completed' && section.books.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setIsReorderingBest((v) => !v)}
                            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                              isReorderingBest
                                ? 'bg-amber-500 text-stone-950 font-bold shadow-xs ring-1 ring-amber-300'
                                : 'bg-stone-850/80 light:bg-white text-amber-400 light:text-amber-700 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/10'
                            }`}
                            title="Modifica classifica dei migliori libri con Drag and Drop"
                          >
                            <Crown size={12} />
                            <span>{isReorderingBest ? 'Fine' : 'Modifica classifica'}</span>
                          </button>
                        )}
                        <span className="text-[11px] sm:text-xs font-sans font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-stone-850/90 light:bg-white/90 text-stone-300 light:text-stone-700 border border-stone-700/70 light:border-stone-300/80 shrink-0 whitespace-nowrap">
                          {section.books.length} <span className="hidden xs:inline">{section.books.length === 1 ? 'volume' : 'volumi'}</span><span className="xs:hidden">vol.</span>
                        </span>
                      </div>
                    </div>

                    {/* Su mobile: pulsante di riordino su riga dedicata per evitare qualsiasi sovrapposizione o troncamento del titolo */}
                    {section.id === 'want' && section.books.length > 1 && (
                      <div className="sm:hidden flex items-center justify-between gap-2 mt-2 pt-2 border-t border-stone-800/40 light:border-stone-200/50">
                        <span className="text-[11px] text-sky-400 light:text-sky-700 font-medium flex items-center gap-1 truncate">
                          <Bookmark size={11} className="shrink-0" />
                          Priorità di lettura
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsReorderingWant((v) => !v)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                            isReorderingWant
                              ? 'bg-sky-500 text-stone-950 font-bold shadow-xs ring-1 ring-sky-300'
                              : 'bg-stone-850 light:bg-white text-sky-400 light:text-sky-700 border border-sky-500/30 hover:border-sky-400'
                          }`}
                        >
                          <Pencil size={11} />
                          <span>{isReorderingWant ? 'Fine' : 'Modifica ordine'}</span>
                        </button>
                      </div>
                    )}

                    {section.id === 'best-completed' && section.books.length > 1 && (
                      <div className="sm:hidden flex items-center justify-between gap-2 mt-2 pt-2 border-t border-stone-800/40 light:border-stone-200/50">
                        <span className="text-[11px] text-amber-400 light:text-amber-700 font-medium flex items-center gap-1 truncate">
                          <Crown size={11} className="shrink-0" />
                          Classifica personale
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsReorderingBest((v) => !v)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${
                            isReorderingBest
                              ? 'bg-amber-500 text-stone-950 font-bold shadow-xs ring-1 ring-amber-300'
                              : 'bg-stone-850 light:bg-white text-amber-400 light:text-amber-700 border border-amber-500/30 hover:border-amber-400'
                          }`}
                        >
                          <Crown size={11} />
                          <span>{isReorderingBest ? 'Fine' : 'Modifica classifica'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Messaggio guida quando la modalità riordino è attiva */}
                  {section.id === 'want' && isReorderingWant && (
                    <div className="mx-1 sm:mx-2 mb-3 p-2.5 sm:px-3 sm:py-2 rounded-xl bg-sky-950/60 light:bg-sky-50 border border-sky-500/30 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2.5 text-xs text-sky-200 light:text-sky-900 shadow-inner">
                      <div className="flex items-start gap-2 min-w-0">
                        <Bookmark size={14} className="shrink-0 text-sky-400 mt-0.5 xs:mt-0" />
                        <span className="text-[11px] sm:text-xs leading-snug">
                          <strong>Ordine di lettura:</strong> trascina i libri per posizionarli (★ <strong>#1</strong> è il prossimo).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsReorderingWant(false)}
                        className="w-full xs:w-auto px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-stone-950 font-bold text-[11px] shrink-0 cursor-pointer shadow-xs text-center"
                      >
                        Salva ordine
                      </button>
                    </div>
                  )}

                  {section.id === 'best-completed' && isReorderingBest && (
                    <div className="mx-1 sm:mx-2 mb-3 p-2.5 sm:px-3 sm:py-2 rounded-xl bg-amber-950/60 light:bg-amber-50 border border-amber-500/30 flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2.5 text-xs text-amber-200 light:text-amber-950 shadow-inner">
                      <div className="flex items-start gap-2 min-w-0">
                        <Crown size={14} className="shrink-0 text-amber-400 mt-0.5 xs:mt-0" />
                        <span className="text-[11px] sm:text-xs leading-snug">
                          <strong>Classifica Top:</strong> trascina i libri per decidere il podio (👑 <strong>#1</strong> è il preferito).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsReorderingBest(false)}
                        className="w-full xs:w-auto px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[11px] shrink-0 cursor-pointer shadow-xs text-center"
                      >
                        Salva classifica
                      </button>
                    </div>
                  )}

                  {/* LIBRI APPOGGIATI SUL RIPIANO */}
                  {section.id === 'reading' && section.books.length === 0 ? (
                    /* Ripiano "In lettura" vuoto: propone le prossime letture */
                    <EmptyReadingShelf
                      nextBooks={orderWantBooks(books.filter((b) => b.status === 'want'), priorityOrder)}
                      searchQuery={searchQuery}
                      onStartReading={onStartReading}
                      onAddBook={onAddBook}
                      onOpenBook={setInspectingBook}
                    />
                  ) : shelfStyle === 'covers' ? (
                    /* 1. VISTA COPERTINE FRONTALI CON PROFONDITÀ */
                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5 items-end px-2 pt-4 pb-2 min-h-[220px]">
                      {section.books.map((book, bookIdx) => {
                        const spine = getBookSpineStyle(book.id, book.title);
                        const isWantSection = section.id === 'want';
                        const isBestSection = section.id === 'best-completed';
                        const isDraggable =
                          (isWantSection && isReorderingWant) ||
                          (isBestSection && isReorderingBest);
                        const priorityRank = isWantSection ? bookIdx + 1 : null;
                        const bestRank = isBestSection ? bookIdx + 1 : null;

                        const isBeingDragged =
                          (isWantSection && draggedBookId === book.id) ||
                          (isBestSection && draggedBestBookId === book.id);
                        const isDragOver =
                          (isWantSection && dragOverBookId === book.id) ||
                          (isBestSection && dragOverBestBookId === book.id);

                        return (
                          <div
                            key={book.id}
                            role="button"
                            tabIndex={0}
                            draggable={isDraggable}
                            onDragStart={(e) => {
                              if (!isDraggable) return;
                              e.dataTransfer.setData('text/plain', book.id);
                              e.dataTransfer.effectAllowed = 'move';
                              if (isBestSection) setDraggedBestBookId(book.id);
                              else if (isWantSection) setDraggedBookId(book.id);
                            }}
                            onDragOver={(e) => {
                              if (!isDraggable) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (isBestSection) {
                                if (dragOverBestBookId !== book.id) setDragOverBestBookId(book.id);
                              } else if (isWantSection) {
                                if (dragOverBookId !== book.id) setDragOverBookId(book.id);
                              }
                            }}
                            onDragLeave={(e) => {
                              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                              if (isBestSection && dragOverBestBookId === book.id) setDragOverBestBookId(null);
                              else if (isWantSection && dragOverBookId === book.id) setDragOverBookId(null);
                            }}
                            onDrop={(e) => {
                              if (!isDraggable) return;
                              e.preventDefault();
                              e.stopPropagation();
                              const sourceId =
                                e.dataTransfer.getData('text/plain') ||
                                (isBestSection ? draggedBestBookId : draggedBookId);
                              if (sourceId && sourceId !== book.id) {
                                if (isBestSection) handleBestDropReorder(sourceId, book.id);
                                else if (isWantSection) handleDropReorder(sourceId, book.id);
                              }
                              setDraggedBookId(null);
                              setDragOverBookId(null);
                              setDraggedBestBookId(null);
                              setDragOverBestBookId(null);
                            }}
                            onDragEnd={() => {
                              setDraggedBookId(null);
                              setDragOverBookId(null);
                              setDraggedBestBookId(null);
                              setDragOverBestBookId(null);
                            }}
                            onClick={() => setInspectingBook(book)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setInspectingBook(book);
                              }
                            }}
                            className={`group relative flex flex-col items-center cursor-pointer transition-all duration-300 hover:-translate-y-3 active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl w-full max-w-[140px] xs:max-w-[150px] mx-auto ${
                              isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-amber-400' : ''
                            } ${
                              isDragOver
                                ? isBestSection
                                  ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.7)] -translate-y-2 scale-105'
                                  : 'ring-2 ring-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.7)] -translate-y-2 scale-105'
                                : ''
                            }`}
                            title={`${
                              isBestSection
                                ? `[👑 #${bestRank} Top Libro] `
                                : isWantSection
                                  ? `[Priorità #${priorityRank}] `
                                  : ''
                            }${book.title} — ${book.author}`}
                          >
                            {/* Libro appoggiato sullo scaffale */}
                            <div className="relative w-full aspect-[2/3] rounded-r-lg rounded-l-xs overflow-hidden shadow-2xl transition-all group-hover:shadow-[0_20px_25px_-5px_rgba(245,158,11,0.25)] border-r-2 border-stone-200/30">
                              {/* Effetto costa e piega copertina sinistra */}
                              <div className="absolute top-0 left-0 bottom-0 w-3 bg-gradient-to-r from-white/20 via-transparent to-black/40 z-20 pointer-events-none" />

                              {/* Bordo pagine a destra */}
                              <div className="absolute top-0 right-0 bottom-0 w-1 bg-gradient-to-l from-stone-200/80 via-stone-300 to-stone-400 z-20 pointer-events-none shadow-sm" />

                              {book.cover_url ? (
                                <CoverImage
                                  src={book.cover_url}
                                  alt={book.title}
                                  className="w-full h-full object-cover group-hover:scale-105"
                                  loading="lazy"
                                />
                              ) : (
                                /* Copertina telata classica per libri senza immagine */
                                <div
                                  className={`w-full h-full bg-gradient-to-br ${spine.bg} p-3 flex flex-col justify-between border ${spine.border} relative overflow-hidden`}
                                >
                                  <div className="text-[10px] uppercase tracking-widest text-amber-200/60 font-sans font-semibold">
                                    Bookshelf
                                  </div>
                                  <div className="my-auto text-center px-1">
                                    <h4 className="font-serif font-bold text-[10.5px] xs:text-[11px] sm:text-xs md:text-sm text-amber-100 leading-snug line-clamp-3 break-words">
                                      {book.title}
                                    </h4>
                                    <p className="text-[10.5px] text-amber-200/80 mt-1 font-sans truncate">
                                      {book.author}
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] font-sans text-amber-300/70 border-t border-amber-500/20 pt-1">
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
                                    clipPath: 'polygon(0 0, 100% 0, 100% 0 100%, 50% 75%, 0 100%)',
                                  }}
                                  title="In lettura"
                                />
                              )}

                              {/* Sigillo di completamento per i letti (se non nel ripiano classifica d'onore) */}
                              {book.status === 'completed' && !isBestSection && (
                                <div className="absolute top-1.5 left-2 z-30 pointer-events-none w-5 h-5 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-md">
                                  <Trophy size={11} />
                                </div>
                              )}

                              {/* Badge classifica ripiano d'onore dei migliori libri letti */}
                              {isBestSection && bestRank !== null && (
                                <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-30 pointer-events-none">
                                  {bestRank === 1 ? (
                                    <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-stone-950 shadow-lg ring-1 ring-amber-200 flex items-center gap-1 whitespace-nowrap">
                                      <Crown size={10} className="text-stone-950 fill-stone-950" />
                                      #1 Top
                                    </span>
                                  ) : bestRank === 2 ? (
                                    <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-gradient-to-r from-stone-100 to-stone-200 text-stone-900 border border-white shadow-md flex items-center gap-1 whitespace-nowrap">
                                      <Medal size={11} className="text-stone-700 fill-stone-400/40" />
                                      #2
                                    </span>
                                  ) : bestRank === 3 ? (
                                    <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 text-amber-100 border border-amber-500/60 shadow-md flex items-center gap-1 whitespace-nowrap">
                                      <Medal size={11} className="text-amber-300 fill-amber-400/40" />
                                      #3
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-stone-900/90 text-amber-300 border border-amber-500/40 shadow-md whitespace-nowrap">
                                      ⭐ #{bestRank}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Badge priorità sulla copertina se ripiano da leggere */}
                              {isWantSection && priorityRank !== null && (
                                <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-30 pointer-events-none">
                                  {priorityRank === 1 ? (
                                    <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[10.5px] sm:text-[11px] font-black bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 shadow-md ring-1 ring-amber-200 flex items-center gap-1">
                                      ★ #1 Prossimo
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-sky-950/85 text-sky-300 border border-sky-400/50 shadow-md">
                                      #{priorityRank}
                                    </span>
                                  )}
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
                                <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 z-30 pointer-events-none bg-stone-900/90 text-amber-300 border border-amber-500/40 rounded-full px-1.5 py-0.5 text-[11px] font-bold flex items-center gap-0.5 shadow-md">
                                  <StickyNote size={8} />
                                  <span>{book.notes_count}</span>
                                </div>
                              ) : null}
                            </div>

                            {/* Titolo e autore sotto la copertina con altezza uniforme per allineare perfettamente tutte le copertine */}
                            <div className="text-center mt-2 px-0.5 w-full h-[46px] xs:h-[50px] flex flex-col justify-start overflow-hidden">
                              <p className="font-serif text-[11px] xs:text-xs sm:text-sm font-semibold text-stone-200 light:text-stone-800 line-clamp-2 leading-tight group-hover:text-amber-400 transition-colors break-words">
                                {book.title}
                              </p>
                              <p className="font-sans text-[11px] text-stone-400 light:text-stone-500 truncate mt-0.5">
                                {book.author}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* 2. VISTA DORSI DEI LIBRI VERTICALI (LIBRERIA CLASSICA) */
                    <div className="flex items-end gap-1 sm:gap-2 px-2 sm:px-4 pt-6 pb-2 overflow-x-auto scrollbar-thin min-h-[240px] overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
                      {section.books.map((book, bookIdx) => {
                        const dynamicSpine = book.cover_url ? coverColors.get(book.cover_url) : null;
                        const spine = getBookSpineStyle(book.id, book.title);

                        const isWantSection = section.id === 'want';
                        const isBestSection = section.id === 'best-completed';
                        const isDraggable =
                          (isWantSection && isReorderingWant) ||
                          (isBestSection && isReorderingBest);
                        const priorityRank = isWantSection ? bookIdx + 1 : null;
                        const bestRank = isBestSection ? bookIdx + 1 : null;

                        const isBeingDragged =
                          (isWantSection && draggedBookId === book.id) ||
                          (isBestSection && draggedBestBookId === book.id);
                        const isDragOver =
                          (isWantSection && dragOverBookId === book.id) ||
                          (isBestSection && dragOverBestBookId === book.id);

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
                            draggable={isDraggable}
                            onDragStart={(e) => {
                              if (!isDraggable) return;
                              e.dataTransfer.setData('text/plain', book.id);
                              e.dataTransfer.effectAllowed = 'move';
                              if (isBestSection) setDraggedBestBookId(book.id);
                              else if (isWantSection) setDraggedBookId(book.id);
                            }}
                            onDragOver={(e) => {
                              if (!isDraggable) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (isBestSection) {
                                if (dragOverBestBookId !== book.id) setDragOverBestBookId(book.id);
                              } else if (isWantSection) {
                                if (dragOverBookId !== book.id) setDragOverBookId(book.id);
                              }
                            }}
                            onDragLeave={(e) => {
                              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                              if (isBestSection && dragOverBestBookId === book.id) setDragOverBestBookId(null);
                              else if (isWantSection && dragOverBookId === book.id) setDragOverBookId(null);
                            }}
                            onDrop={(e) => {
                              if (!isDraggable) return;
                              e.preventDefault();
                              e.stopPropagation();
                              const sourceId =
                                e.dataTransfer.getData('text/plain') ||
                                (isBestSection ? draggedBestBookId : draggedBookId);
                              if (sourceId && sourceId !== book.id) {
                                if (isBestSection) handleBestDropReorder(sourceId, book.id);
                                else if (isWantSection) handleDropReorder(sourceId, book.id);
                              }
                              setDraggedBookId(null);
                              setDragOverBookId(null);
                              setDraggedBestBookId(null);
                              setDragOverBestBookId(null);
                            }}
                            onDragEnd={() => {
                              setDraggedBookId(null);
                              setDragOverBookId(null);
                              setDraggedBestBookId(null);
                              setDragOverBestBookId(null);
                            }}
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
                              touchAction: isDraggable ? 'none' : 'pan-x pan-y',
                            }}
                            className={`group relative ${spineWidth} ${spineHeight} rounded-t-sm shrink-0 flex flex-col justify-between py-2 px-1 cursor-pointer transition-all duration-300 hover:-translate-y-4 hover:shadow-2xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                              dynamicSpine ? '' : `bg-gradient-to-r ${spine.bg} ${spine.border}`
                            } border-t border-b-2 shadow-lg select-none overflow-hidden ${
                              isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-amber-400' : ''
                            } ${
                              isDragOver
                                ? isBestSection
                                  ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.7)] -translate-y-2'
                                  : 'ring-2 ring-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.7)] -translate-y-2'
                                : ''
                            }`}
                            title={`${
                              isBestSection
                                ? `[👑 #${bestRank} Top Libro] `
                                : isWantSection
                                  ? `[Priorità #${priorityRank}] `
                                  : ''
                            }${book.title} — ${book.author}`}
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
                              className={`h-1 rounded-full mx-auto w-4/5 mb-0.5 z-10 ${
                                dynamicSpine?.isLight ? 'bg-stone-900/30' : 'bg-amber-100/40 opacity-70'
                              }`}
                            />

                            {/* Badge classifica ripiano d'onore per i migliori libri */}
                            {isBestSection && bestRank !== null && (
                              <div className="z-20 mx-auto my-0.5 flex flex-col items-center">
                                {bestRank === 1 ? (
                                  <span
                                    className="px-1 py-0.5 rounded text-[9.5px] font-black tracking-tight bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 shadow-md ring-1 ring-amber-200/80 flex items-center gap-0.5 whitespace-nowrap"
                                    title="Classifica #1: Il tuo miglior libro in assoluto!"
                                  >
                                    <Crown size={9} className="text-stone-950 fill-stone-950 shrink-0" />
                                    1°
                                  </span>
                                ) : bestRank === 2 ? (
                                  <span
                                    className="px-1 py-0.5 rounded text-[9px] font-bold tracking-tight bg-gradient-to-r from-stone-100 to-stone-200 text-stone-900 border border-white shadow-xs flex items-center gap-0.5 whitespace-nowrap"
                                    title="Classifica #2"
                                  >
                                    <Medal size={9} className="text-stone-700 fill-stone-400/40 shrink-0" />
                                    2°
                                  </span>
                                ) : bestRank === 3 ? (
                                  <span
                                    className="px-1 py-0.5 rounded text-[9px] font-bold tracking-tight bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 text-amber-100 border border-amber-500/60 shadow-xs ring-1 ring-amber-500/30 flex items-center gap-0.5 whitespace-nowrap"
                                    title="Classifica #3"
                                  >
                                    <Medal size={9} className="text-amber-300 fill-amber-300/40 shrink-0" />
                                    3°
                                  </span>
                                ) : (
                                  <span
                                    className="px-1 py-0.5 rounded text-[9px] font-bold tracking-tight bg-black/60 text-amber-300 border border-amber-400/40 shadow-xs whitespace-nowrap"
                                    title={`Classifica #${bestRank}`}
                                  >
                                    #{bestRank}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Badge priorità visibile sul dorso per i libri da leggere */}
                            {isWantSection && priorityRank !== null && (
                              <div className="z-20 mx-auto my-0.5 flex flex-col items-center">
                                {priorityRank === 1 ? (
                                  <span
                                    className="px-1 py-0.5 rounded text-[9.5px] font-black tracking-tight bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 shadow-md ring-1 ring-amber-200/80 flex items-center gap-0.5 whitespace-nowrap"
                                    title="Priorità #1: la prossima lettura da iniziare!"
                                  >
                                    ★ 1°
                                  </span>
                                ) : (
                                  <span
                                    className="px-1 py-0.5 rounded text-[9px] font-bold tracking-tight bg-black/60 text-sky-300 border border-sky-400/40 shadow-xs whitespace-nowrap"
                                    title={`Priorità #${priorityRank} da leggere`}
                                  >
                                    #{priorityRank}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Titolo e autore verticali lungo il dorso */}
                            <div className="flex-1 flex items-center justify-center overflow-hidden my-1 z-10">
                              <span
                                style={{
                                  textShadow: dynamicSpine ? dynamicSpine.textShadow : undefined,
                                }}
                                className={`writing-vertical-rl font-serif font-bold text-[11px] md:text-xs tracking-wide ${
                                  dynamicSpine ? dynamicSpine.textColor : spine.text
                                } truncate max-h-[130px] sm:max-h-[155px] drop-shadow-xs`}
                              >
                                {book.title}
                              </span>
                            </div>

                            {/* Parte inferiore: Sigillo o pagine */}
                            <div className="flex flex-col items-center gap-0.5 mt-auto z-10">
                              {book.status === 'completed' && (
                                <Trophy
                                  size={11}
                                  className={dynamicSpine?.isLight ? 'text-amber-800' : 'text-amber-300/80'}
                                />
                              )}
                              <span
                                className={`text-[10px] font-sans font-medium truncate max-w-full ${
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

      {/* Collegamento rapido all'Archivio Annuale completo quando ci si trova nella vista generale "Tutti" */}
      {activeTab === 'all' && completedBooks.length > 0 && onSelectTab && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-850/80 light:bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-800 light:border-stone-200 shadow-sm text-left animate-fade-up">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 light:bg-emerald-100 border border-emerald-500/30 light:border-emerald-300 flex items-center justify-center text-emerald-400 light:text-emerald-700 shrink-0">
              <Trophy size={18} />
            </div>
            <div className="min-w-0">
              <h4 className="font-serif font-bold text-xs xs:text-sm sm:text-base text-stone-100 light:text-stone-900 leading-snug line-clamp-1">
                Archivio Storico ({completedBooks.length} {completedBooks.length === 1 ? 'libro letto' : 'libri letti'})
              </h4>
              <p className="text-[11px] sm:text-xs text-stone-400 light:text-stone-600 mt-0.5 line-clamp-1 xs:line-clamp-2">
                Consulta lo scaffale diviso anno per anno con le classifiche dedicate.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('completed')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <span>Apri Archivio</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

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
          priorityRank={inspectingRank}
          totalWantCount={orderedWantBooks.length}
          onShiftPriority={
            inspectingBook.status === 'want'
              ? (dir) => handleShift(inspectingBook.id, dir)
              : undefined
          }
        />
      )}
    </div>
  );
}
