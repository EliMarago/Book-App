import { useState, useMemo, useEffect, useRef } from 'react';
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
  SlidersHorizontal,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { type Book } from '@/lib/supabase';
import { matchesBookSearch } from '@/lib/bookSearch';
import { BookDetailModal } from './BookDetailModal';
import { CoverImage } from './CoverImage';
import { EmptyReadingShelf } from './EmptyReadingShelf';
import { RankSeal } from './RankSeal';
import { orderWantBooks, orderBestBooks, reorderBookIds, shiftBookPosition } from '@/lib/bookPriority';
import { formatReadingDuration } from '@/lib/bookDates';
import {
  extractSpinePaletteFromCoverUrl,
  getCachedCoverSpinePalette,
  isCoverSpineExtractionSkipped,
  type ExtractedSpinePalette,
} from '@/lib/spineColorExtractor';
import {
  BookshelfDecoration,
  ChristmasShelfLights,
  getAutoHoliday,
  type BookshelfHoliday,
} from './BookshelfDecorations';
import { BookshelfCustomizationModal } from './BookshelfCustomizationModal';
import { useBookshelfSettings } from '@/hooks/useBookshelfSettings';

// Palette curata in stile BookTok 3D opaco/vellutato (fedele allo screenshot di riferimento)
export interface SpinePaletteItem {
  baseColor: string;
  twoToneCap?: string;
  textColor: string;
  authorColor: string;
  diamond?: boolean;
  isLight: boolean;
  fromCoverImage?: boolean;
  // Classi di fallback per copertine telate senza immagine nella vista griglia
  bg: string;
  text: string;
  border: string;
  ribbon: string;
}

const SPINE_PALETTES: SpinePaletteItem[] = [
  // 1. Rosa antico cipria (es. "Terms and condi... - Asher" / "Rewind It Back - Tomforde")
  {
    baseColor: '#d59ea9',
    textColor: '#1f181a',
    authorColor: '#433236',
    diamond: false,
    isLight: true,
    bg: 'from-[#d59ea9] via-[#c48b97] to-[#a66e7a]',
    text: 'text-stone-900',
    border: 'border-[#e2b6bf]',
    ribbon: '#be185d',
  },
  // 2. Lilla pastello rosato con rombo ◇ (es. "Bet You ... - Cooper ◇")
  {
    baseColor: '#dfb5ce',
    textColor: '#22285e',
    authorColor: '#3b4278',
    diamond: true,
    isLight: true,
    bg: 'from-[#dfb5ce] via-[#cfa1bc] to-[#b3829f]',
    text: 'text-indigo-950',
    border: 'border-[#ebd0e0]',
    ribbon: '#4338ca',
  },
  // 3. Antracite opaco vellutato (es. "Crossroads - Perry")
  {
    baseColor: '#2d2d32',
    textColor: '#f4f2ee',
    authorColor: '#d6d3cd',
    diamond: false,
    isLight: false,
    bg: 'from-[#38383e] via-[#2d2d32] to-[#1c1c20]',
    text: 'text-stone-100',
    border: 'border-[#4a4a52]',
    ribbon: '#e5e5e5',
  },
  // 4. Blu ceruleo polvere (es. "Midnight Bl... - Shen")
  {
    baseColor: '#5c93ba',
    textColor: '#102542',
    authorColor: '#1d3961',
    diamond: false,
    isLight: true,
    bg: 'from-[#6ba2c9] via-[#5c93ba] to-[#427499]',
    text: 'text-slate-950',
    border: 'border-[#82b4d6]',
    ribbon: '#0284c7',
  },
  // 5. Bianco perla alabastro con rombo ◇ (es. "The fine print - Asher ◇")
  {
    baseColor: '#dcdedf',
    textColor: '#3a3f47',
    authorColor: '#555b66',
    diamond: true,
    isLight: true,
    bg: 'from-[#eceeef] via-[#dcdedf] to-[#bfc3c6]',
    text: 'text-stone-800',
    border: 'border-[#ffffff]',
    ribbon: '#475569',
  },
  // 6. Tortora scuro / Grigio caldo (es. "Sunlight - Perry")
  {
    baseColor: '#554f4b',
    textColor: '#f5f0eb',
    authorColor: '#dcd5cd',
    diamond: false,
    isLight: false,
    bg: 'from-[#665f5a] via-[#554f4b] to-[#3d3835]',
    text: 'text-stone-100',
    border: 'border-[#736b66]',
    ribbon: '#d6d3d1',
  },
  // 7. Lavanda pervinca (es. "Love Redesigned - Asher" / "Play Along - Tomforde ◇")
  {
    baseColor: '#a29ebc',
    textColor: '#221f4c',
    authorColor: '#39356b',
    diamond: true,
    isLight: true,
    bg: 'from-[#b3afd0] via-[#a29ebc] to-[#837fa1]',
    text: 'text-indigo-950',
    border: 'border-[#c5c2de]',
    ribbon: '#4f46e5',
  },
  // 8. Bicolore Crema & Terracotta antico (es. "First lady pe... - Kingsley")
  {
    baseColor: '#efeae4',
    twoToneCap: '#b07d75',
    textColor: '#7c241e',
    authorColor: '#913831',
    diamond: false,
    isLight: true,
    bg: 'from-[#efeae4] via-[#dfd7ce] to-[#b07d75]',
    text: 'text-red-900',
    border: 'border-[#c79890]',
    ribbon: '#991b1b',
  },
  // 9. Blu cobalto notte (es. "Fever Dream - Silver")
  {
    baseColor: '#364685',
    textColor: '#d0daf9',
    authorColor: '#aebde8',
    diamond: false,
    isLight: false,
    bg: 'from-[#43559e] via-[#364685] to-[#232f5e]',
    text: 'text-indigo-100',
    border: 'border-[#5569b5]',
    ribbon: '#818cf8',
  },
  // 10. Verde oliva muschio con scritte dorate (es. "Heart and blue ... - Sage")
  {
    baseColor: '#4c5c36',
    textColor: '#e8c56b',
    authorColor: '#d6b358',
    diamond: false,
    isLight: false,
    bg: 'from-[#5b6e41] via-[#4c5c36] to-[#344024]',
    text: 'text-amber-200',
    border: 'border-[#6b804e]',
    ribbon: '#eab308',
  },
];

// Proporzioni realistiche variate per creare lo skyline organico dello screenshot senza mai sovrapporre titolo e autore
const SPINE_DIMENSIONS = [
  { width: 'w-[35px] xs:w-[38px] sm:w-[45px]', height: 'h-[200px] xs:h-[212px] sm:h-[240px]', maxChars: 16, basePx: 35, xsPx: 38, smPx: 45 },
  { width: 'w-[32px] xs:w-[35px] sm:w-[41px]', height: 'h-[176px] xs:h-[186px] sm:h-[210px]', maxChars: 12, basePx: 32, xsPx: 35, smPx: 41 },
  { width: 'w-[33px] xs:w-[36px] sm:w-[42px]', height: 'h-[186px] xs:h-[196px] sm:h-[222px]', maxChars: 14, basePx: 33, xsPx: 36, smPx: 42 },
  { width: 'w-[32px] xs:w-[35px] sm:w-[41px]', height: 'h-[180px] xs:h-[190px] sm:h-[214px]', maxChars: 13, basePx: 32, xsPx: 35, smPx: 41 },
  { width: 'w-[35px] xs:w-[38px] sm:w-[45px]', height: 'h-[194px] xs:h-[204px] sm:h-[230px]', maxChars: 15, basePx: 35, xsPx: 38, smPx: 45 },
  { width: 'w-[32px] xs:w-[35px] sm:w-[40px]', height: 'h-[176px] xs:h-[186px] sm:h-[210px]', maxChars: 12, basePx: 32, xsPx: 35, smPx: 40 },
  { width: 'w-[36px] xs:w-[39px] sm:w-[46px]', height: 'h-[208px] xs:h-[220px] sm:h-[248px]', maxChars: 16, basePx: 36, xsPx: 39, smPx: 46 },
  { width: 'w-[35px] xs:w-[38px] sm:w-[44px]', height: 'h-[192px] xs:h-[202px] sm:h-[228px]', maxChars: 14, basePx: 35, xsPx: 38, smPx: 44 },
];

function getBookHash(id: string, title: string): number {
  let hash = 2166136261;
  const str = `${id}::${title}`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function getBookSpineStyle(
  id: string,
  title: string,
  extractedPalette?: ExtractedSpinePalette | null
): SpinePaletteItem {
  const hash = getBookHash(id, title);
  const fallback = SPINE_PALETTES[hash % SPINE_PALETTES.length];
  if (extractedPalette) {
    return {
      ...fallback,
      baseColor: extractedPalette.baseColor,
      twoToneCap: extractedPalette.twoToneCap,
      textColor: extractedPalette.textColor,
      authorColor: extractedPalette.authorColor,
      diamond: extractedPalette.diamond,
      isLight: extractedPalette.isLight,
      fromCoverImage: true,
    };
  }
  return fallback;
}

function getBookSpineDimension(book: Book) {
  const hash = getBookHash(book.id, book.title);
  // Se il libro ha il numero di pagine, adatta sottilmente anche l'altezza/spessore del dorso
  if (book.pages && book.pages >= 460) {
    const tallIndices = [0, 4, 6, 7];
    return SPINE_DIMENSIONS[tallIndices[hash % tallIndices.length]];
  }
  if (book.pages && book.pages > 0 && book.pages <= 260) {
    const compactIndices = [1, 2, 3, 5];
    return SPINE_DIMENSIONS[compactIndices[hash % compactIndices.length]];
  }
  return SPINE_DIMENSIONS[hash % SPINE_DIMENSIONS.length];
}

/** Estrae il cognome dell'autore per la parte alta del dorso (es. "Lauren Asher" -> "Asher") */
function getAuthorSurname(author?: string): string {
  if (!author) return '';
  const primary = author.split(/[,&/]/)[0].trim();
  if (!primary) return '';
  const parts = primary.split(/\s+/);
  const surname = parts[parts.length - 1];
  if (surname.length <= 9) return surname;
  return surname.slice(0, 8) + '...';
}

/** Tronca elegantemente il titolo sul dorso come nello screenshot ("Terms and condi...") */
function truncateSpineTitle(title: string, maxChars: number): string {
  const clean = title.split(/\s*[:(–—-]\s*/)[0].trim() || title.trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, Math.max(7, maxChars - 2)).trimEnd() + '...';
}

// Fiocchi di neve / particelle luminose soffuse sullo sfondo della libreria
const BOOKSHELF_SPARKLES = [
  { top: '6%', left: '39%', size: 4, opacity: 0.85 },
  { top: '8%', left: '80%', size: 4.5, opacity: 0.9 },
  { top: '18%', left: '14%', size: 3, opacity: 0.55 },
  { top: '26%', left: '66%', size: 3.5, opacity: 0.7 },
  { top: '42%', left: '85%', size: 4, opacity: 0.85 },
  { top: '44%', left: '97%', size: 3.5, opacity: 0.75 },
  { top: '49%', left: '45%', size: 5, opacity: 0.9 },
  { top: '49%', left: '62%', size: 4.5, opacity: 0.85 },
  { top: '64%', left: '22%', size: 3.5, opacity: 0.65 },
  { top: '76%', left: '74%', size: 4, opacity: 0.8 },
  { top: '88%', left: '35%', size: 4, opacity: 0.75 },
  { top: '92%', left: '88%', size: 3.5, opacity: 0.7 },
];

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
  // Impostazioni visive dello scaffale sincronizzate tra dispositivi (Supabase + cache localStorage)
  const {
    shelfStyle,
    customization,
    faceOutOverrides,
    setShelfStyle: handleShelfStyleChange,
    setCustomization: handleUpdateCustomization,
    toggleFaceOut: handleToggleFaceOut,
    resetFaceOutOverrides: handleResetFaceOutOverrides,
  } = useBookshelfSettings();

  const [isCustomizing, setIsCustomizing] = useState(false);

  const autoHoliday = useMemo(() => getAutoHoliday(), []);
  const activeHoliday = customization.holiday === 'auto' ? autoHoliday : customization.holiday;
  const showLights =
    customization.lights === 'always' ||
    (customization.lights === 'auto' && activeHoliday === 'christmas');

  // Libro attualmente selezionato per ispezione dettagliata
  const [inspectingBook, setInspectingBook] = useState<Book | null>(null);
  const [isSelectingFaceOut, setIsSelectingFaceOut] = useState(false);

  const hasCustomFaceOut = Object.keys(faceOutOverrides).length > 0;

  // Colori reali dei dorsi estratti dinamicamente dalle immagini di copertina (con cache in localStorage)
  const [coverSpinePalettes, setCoverSpinePalettes] = useState<Record<string, ExtractedSpinePalette>>(() => {
    const initial: Record<string, ExtractedSpinePalette> = {};
    for (const b of books) {
      if (b.cover_url) {
        const cached = getCachedCoverSpinePalette(b.cover_url);
        if (cached) initial[b.cover_url] = cached;
      }
    }
    return initial;
  });

  useEffect(() => {
    let cancelled = false;

    // Sincronizza subito eventuali colori già presenti nella cache in memoria (0ms)
    const newlyCached: Record<string, ExtractedSpinePalette> = {};
    for (const b of books) {
      if (b.cover_url && !coverSpinePalettes[b.cover_url]) {
        const cached = getCachedCoverSpinePalette(b.cover_url);
        if (cached) newlyCached[b.cover_url] = cached;
      }
    }
    if (Object.keys(newlyCached).length > 0) {
      setCoverSpinePalettes((prev) => ({ ...prev, ...newlyCached }));
    }

    const toExtract = books.filter(
      (b) =>
        b.cover_url &&
        !coverSpinePalettes[b.cover_url] &&
        !isCoverSpineExtractionSkipped(b.cover_url)
    );

    if (toExtract.length === 0) return;

    // Rimanda l'estrazione canvas dopo il primo render e processa a piccoli blocchi
    // per non rallentare l'apertura dello scaffale o il caricamento delle copertine frontali
    const timer = setTimeout(async () => {
      const updates: Record<string, ExtractedSpinePalette> = {};
      const BATCH_SIZE = 4;
      for (let i = 0; i < toExtract.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = toExtract.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (b) => {
            const url = b.cover_url!;
            const seed = getBookHash(b.id, b.title);
            const palette = await extractSpinePaletteFromCoverUrl(url, seed);
            return palette ? { url, palette } : null;
          })
        );
        for (const item of results) {
          if (item) updates[item.url] = item.palette;
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setCoverSpinePalettes((prev) => ({ ...prev, ...updates }));
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [books, coverSpinePalettes]);

  // Misurazione reattiva della larghezza reale dello scaffale per disporre i libri su un unico piano da Web
  // e andare a capo su più piani da Mobile solo quando il ripiano è effettivamente pieno
  const bookcaseRef = useRef<HTMLDivElement>(null);
  const [bookcaseWidth, setBookcaseWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.min(window.innerWidth - 24, 1280) : 1024
  );
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const el = bookcaseRef.current;
    const updateWidth = () => {
      if (typeof window !== 'undefined') {
        setViewportWidth(window.innerWidth);
      }
      if (el && el.clientWidth > 0) {
        setBookcaseWidth(el.clientWidth);
      } else if (typeof window !== 'undefined') {
        setBookcaseWidth(Math.min(window.innerWidth - 24, 1280));
      }
    };
    updateWidth();

    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateWidth);
      ro.observe(el);
    }
    window.addEventListener('resize', updateWidth);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

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

  // Unisce il nuovo ordine di una sotto-sezione (es. "I Migliori del 2026") nell'ordine globale dei migliori libri
  const mergeBestSectionOrder = (newSectionIds: string[]): string[] => {
    const sectionSet = new Set(newSectionIds);
    const fullIds = orderedBestBooks.map((b) => b.id);
    let ptr = 0;
    return fullIds.map((id) => (sectionSet.has(id) ? newSectionIds[ptr++] ?? id : id));
  };

  // Gestione deterministica del drag & drop basata esattamente sui libri presenti a schermo
  const handleDropReorder = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const nextOrder = reorderBookIds(orderedWantBooks, sourceId, targetId);
    onUpdatePriorityOrder?.(nextOrder);
  };

  // Gestione deterministica drag & drop per la classifica dei migliori libri letti
  const handleBestDropReorder = (sourceId: string, targetId: string, currentSectionBooks?: Book[]) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    if (currentSectionBooks && currentSectionBooks.length > 0) {
      const reorderedSection = reorderBookIds(currentSectionBooks, sourceId, targetId);
      const merged = mergeBestSectionOrder(reorderedSection);
      onUpdateBestBooksOrder?.(merged);
      return;
    }
    const nextOrder = reorderBookIds(orderedBestBooks, sourceId, targetId);
    onUpdateBestBooksOrder?.(nextOrder);
  };

  // Gestione spostamento rapido (frecce ‹ e ›) per Da Leggere
  const handleShift = (bookId: string, direction: 'left' | 'right' | 'first' | 'last') => {
    const nextOrder = shiftBookPosition(orderedWantBooks, bookId, direction);
    onUpdatePriorityOrder?.(nextOrder);
  };

  // Gestione spostamento rapido (frecce ‹ e ›) per la Classifica dei Migliori Libri
  const handleShiftBest = (
    bookId: string,
    direction: 'left' | 'right' | 'first' | 'last',
    currentSectionBooks?: Book[]
  ) => {
    const baseList =
      currentSectionBooks && currentSectionBooks.length > 0 ? currentSectionBooks : orderedBestBooks;
    const reorderedSection = shiftBookPosition(baseList, bookId, direction);
    const merged = mergeBestSectionOrder(reorderedSection);
    onUpdateBestBooksOrder?.(merged);
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
      const searchedBooks =
        activeTab === 'reading'
          ? readingBooks
          : activeTab === 'completed'
            ? completedBooks
            : activeTab === 'want'
              ? wantBooks
              : books.filter((b) => matchesBookSearch(b, searchQuery));

      return [
        {
          id: 'search-results',
          shelfLabel: 'Ricerca',
          title: `Risultati per "${searchQuery}"`,
          icon: Library,
          books: searchedBooks,
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

    // Ultime letture completate (fino a 10 libri) per mantenere la vetrina piacevole e veloce
    const recentCompleted = [...completedBooks]
      .sort((a, b) => {
        const dateA = a.read_at ? new Date(a.read_at).getTime() : 0;
        const dateB = b.read_at ? new Date(b.read_at).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10);

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
    wantBooks,
    orderedWantBooks,
    orderedBestBooks,
    searchQuery,
    selectedYear,
  ]);

  return (
    <div className="space-y-6">
      {/* BARRA CONTROLLI DELLO SCAFFALE */}
      <div className="flex flex-col gap-2.5 bg-stone-850/80 light:bg-white border border-stone-800 light:border-stone-200/90 rounded-2xl p-2.5 sm:px-4 sm:py-3 shadow-sm">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700 shrink-0">
              <Library size={15} />
            </div>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="font-serif font-bold text-xs xs:text-sm sm:text-base text-stone-100 light:text-stone-900 truncate">
                Scaffale Virtuale
              </span>
              <span className="text-stone-500 light:text-stone-400 text-[11px] sm:text-xs shrink-0">
                · {books.length} {books.length === 1 ? 'libro' : 'libri'}
              </span>
            </div>
          </div>

          {/* Controlli Scaffale: Esponi Copertine + Personalizza + Toggle Misto/Dorsi/Copertine */}
          <div className="flex flex-wrap items-center justify-between xs:justify-end gap-1.5 sm:gap-2 w-full xs:w-auto pt-1 xs:pt-0 border-t xs:border-t-0 border-stone-800/40 light:border-stone-200/50">
            {/* Pulsante Scelta Copertine in Mostra (Vetrina) */}
            {shelfStyle !== 'covers' && books.length > 0 && (
              <button
                type="button"
                onClick={() => setIsSelectingFaceOut((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 ${isSelectingFaceOut
                  ? 'bg-amber-500 text-stone-950 border-amber-300 font-bold ring-2 ring-amber-400/50'
                  : 'border-stone-800 light:border-stone-200 bg-stone-900/90 light:bg-stone-100 hover:border-amber-400/50 text-stone-300 light:text-stone-700 hover:text-white light:hover:text-stone-950'
                  }`}
                title="Scegli quali libri mostrare di fronte con la copertina sullo scaffale"
              >
                <Eye size={13} className={isSelectingFaceOut ? 'text-stone-950' : 'text-amber-400 light:text-amber-600'} />
                <span>{isSelectingFaceOut ? 'Fine vetrina' : 'Scegli copertine'}</span>
              </button>
            )}

            {/* Pulsante Personalizzazione Libreria (Legno, Parete, Tema, Luci, Dettagli) */}
            <button
              type="button"
              onClick={() => setIsCustomizing(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-stone-800 light:border-stone-200 bg-stone-900/90 light:bg-stone-100 hover:border-amber-400/50 text-stone-300 light:text-stone-700 hover:text-white light:hover:text-stone-950 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              title="Personalizza l'aspetto della libreria (legno, sfondo, decorazioni)"
            >
              <SlidersHorizontal size={13} className="text-amber-400 light:text-amber-600" />
              <span>Personalizza</span>
            </button>

            {/* Toggle Stile Scaffale: Misto BookTok vs Solo Dorsi vs Griglia Copertine */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-stone-900/90 light:bg-stone-100 p-0.5 sm:p-1 rounded-xl border border-stone-800 light:border-stone-200 text-xs shrink-0">
              <button
                type="button"
                onClick={() => handleShelfStyleChange('mixed')}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${shelfStyle === 'mixed'
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                  : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                  }`}
                title="Stile BookTok: dorsi 3D cilindrici alternati a copertine frontali su basetta"
              >
                <BookMarked size={13} />
                <span>Misto</span>
              </button>
              <button
                type="button"
                onClick={() => handleShelfStyleChange('spines')}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${shelfStyle === 'spines'
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                  : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                  }`}
                title="Mostra tutti i dorsi 3D cilindrici dei libri"
              >
                <Layers size={13} />
                <span>Dorsi</span>
              </button>
              <button
                type="button"
                onClick={() => handleShelfStyleChange('covers')}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${shelfStyle === 'covers'
                  ? 'bg-amber-500 text-stone-950 font-semibold shadow-xs'
                  : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                  }`}
                title="Mostra tutte le copertine frontali in griglia"
              >
                <BookOpen size={13} />
                <span>Copertine</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filtro Anno Dinamico nella vista Libri Letti: si aggiorna da solo ogni anno */}
        {activeTab === 'completed' && availableYears.length > 0 && (
          <div className="w-full flex items-center gap-1.5 overflow-x-auto overflow-y-hidden pb-0.5 scrollbar-thin pt-2 border-t border-stone-800/60 light:border-stone-200/60 touch-manipulation">
            <span className="text-[11px] font-medium text-stone-400 light:text-stone-600 flex items-center gap-1 shrink-0 mr-1">
              <Calendar size={12} className="text-emerald-400 light:text-emerald-600" />
              Anno:
            </span>
            <button
              type="button"
              onClick={() => setSelectedYear('all')}
              className={`px-2.5 py-0.5 sm:py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer border ${selectedYear === 'all'
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
                  className={`px-2.5 py-0.5 sm:py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer border flex items-center gap-1.5 ${isSelected
                    ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-semibold shadow-xs'
                    : 'bg-stone-900/80 light:bg-stone-100 text-stone-300 light:text-stone-700 border-stone-700/80 light:border-stone-300 hover:text-white light:hover:text-stone-950'
                    }`}
                >
                  <span>{year}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums ${isSelected
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

      {/* STRUTTURA DELLA LIBRERIA A MENSOLE SOSPESE IN LEGNO (SFONDO PERSONALIZZABILE) */}
      <div
        ref={bookcaseRef}
        className={
          customization.background === 'brick'
            ? 'bookshelf-brick-wall rounded-3xl p-3 sm:p-5 shadow-2xl transition-all duration-300 overflow-hidden'
            : customization.background === 'boiserie'
              ? 'bookshelf-wall-boiserie rounded-3xl p-3 sm:p-5 shadow-2xl transition-all duration-300 overflow-hidden'
              : customization.background === 'plaster'
                ? 'bookshelf-wall-plaster rounded-3xl p-3 sm:p-5 shadow-2xl transition-all duration-300 overflow-hidden'
                : 'relative'
        }
      >
        {/* Particelle di neve / bagliori soffusi sullo sfondo della boiserie */}
        {(showLights || activeHoliday === 'christmas') && customization.background !== 'clean' && (
          <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
            {BOOKSHELF_SPARKLES.map((sp, idx) => (
              <div
                key={idx}
                className="absolute rounded-full bg-white animate-pulse"
                style={{
                  top: sp.top,
                  left: sp.left,
                  width: `${sp.size}px`,
                  height: `${sp.size}px`,
                  opacity: sp.opacity,
                  boxShadow: '0 0 8px 2px rgba(255, 255, 255, 0.75)',
                  animationDuration: `${2.8 + (idx % 4) * 0.6}s`,
                  animationDelay: `${(idx % 5) * 0.4}s`,
                }}
              />
            ))}
          </div>
        )}

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
              className="inline-flex items-center gap-2 py-2.5 px-5 btn-amber text-stone-950 font-semibold rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <Plus size={18} />
              Aggiungi libro sullo scaffale
            </button>
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-9 relative z-10">
            {/* Banner guida interattivo quando si scelgono le copertine da mettere in mostra */}
            {isSelectingFaceOut && shelfStyle !== 'covers' && (
              <div className="p-3 sm:px-4 sm:py-3 rounded-2xl bg-stone-950/85 border border-amber-400/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-100 shadow-xl backdrop-blur-md">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                    <Eye size={14} />
                  </div>
                  <span className="text-[11.5px] sm:text-xs leading-snug">
                    <strong>Scegli copertine in mostra:</strong> tocca qualsiasi libro sullo scaffale per girarlo di{' '}
                    <strong className="text-amber-300">Copertina frontale</strong> o di{' '}
                    <strong className="text-amber-300">Dorso 3D</strong>.
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                  {hasCustomFaceOut && (
                    <button
                      type="button"
                      onClick={handleResetFaceOutOverrides}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 text-[11px] font-semibold cursor-pointer transition-colors"
                      title="Ripristina la disposizione automatica delle copertine"
                    >
                      <RotateCcw size={11} />
                      <span>Auto</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsSelectingFaceOut(false)}
                    className="px-3 py-1.5 rounded-lg btn-amber text-stone-950 font-semibold text-[11px] cursor-pointer"
                  >
                    Fatto
                  </button>
                </div>
              </div>
            )}

            {shelfSections.map((section, sectionIdx) => {
              const SectionIcon = section.icon;
              const isAlwaysDarkWall = customization.background === 'boiserie';
              const accentBadge =
                section.accent === 'emerald'
                  ? isAlwaysDarkWall
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 light:bg-emerald-100 light:text-emerald-900 light:border-emerald-300'
                  : section.accent === 'sky'
                    ? isAlwaysDarkWall
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                      : 'bg-sky-500/20 text-sky-300 border-sky-400/40 light:bg-sky-100 light:text-sky-950 light:border-sky-300'
                    : isAlwaysDarkWall
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/40 light:bg-amber-100 light:text-amber-950 light:border-amber-300';

              return (
                <div key={section.id} className="relative">
                  {/* Intestazione del ripiano pulita e ad alto contrasto sia in dark che light mode */}
                  <div
                    className={`mb-3 sm:mb-4 px-1 sm:px-2 pb-2.5 border-b ${isAlwaysDarkWall
                      ? 'border-amber-200/10'
                      : 'border-amber-200/10 light:border-stone-400/40'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg border flex items-center justify-center shrink-0 ${accentBadge}`}
                        >
                          <SectionIcon size={13} className="sm:w-[14px] sm:h-[14px]" />
                        </div>
                        <div className="flex flex-wrap sm:flex-nowrap items-baseline sm:items-center gap-1.5 sm:gap-2 min-w-0">
                          <span
                            className={`text-[10px] sm:text-[10.5px] font-sans font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${accentBadge}`}
                          >
                            {section.shelfLabel}
                          </span>
                          <h3
                            className={`font-serif text-xs xs:text-sm sm:text-base md:text-lg font-bold leading-snug line-clamp-1 sm:line-clamp-2 break-words ${isAlwaysDarkWall
                              ? 'text-amber-50/95 drop-shadow-xs'
                              : 'text-stone-100 light:text-stone-950 drop-shadow-xs light:drop-shadow-none'
                              }`}
                          >
                            {section.title}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {section.id === 'want' && section.books.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setIsReorderingWant((v) => !v)}
                            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isReorderingWant
                              ? 'bg-sky-500 text-stone-950 font-bold shadow-xs ring-1 ring-sky-300'
                              : isAlwaysDarkWall
                                ? 'bg-black/35 text-sky-300 border border-sky-400/30 hover:border-sky-300/60'
                                : 'bg-black/35 text-sky-300 border border-sky-400/30 hover:border-sky-300/60 light:bg-white light:text-sky-900 light:border-sky-300 hover:light:bg-sky-50'
                              }`}
                            title="Modifica priorità di lettura con Drag and Drop"
                          >
                            <Pencil size={11} />
                            <span>{isReorderingWant ? 'Fine' : 'Modifica ordine'}</span>
                          </button>
                        )}
                        {section.id === 'best-completed' && section.books.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setIsReorderingBest((v) => !v)}
                            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isReorderingBest
                              ? 'bg-amber-500 text-stone-950 font-bold shadow-xs ring-1 ring-amber-300'
                              : isAlwaysDarkWall
                                ? 'bg-black/35 text-amber-300 border border-amber-400/30 hover:border-amber-300/60'
                                : 'bg-black/35 text-amber-300 border border-amber-400/30 hover:border-amber-300/60 light:bg-white light:text-amber-950 light:border-amber-300 hover:light:bg-amber-50'
                              }`}
                            title="Modifica classifica dei migliori libri con Drag and Drop"
                          >
                            <Crown size={11} />
                            <span>{isReorderingBest ? 'Fine' : 'Modifica classifica'}</span>
                          </button>
                        )}
                        <span
                          className={`text-[11px] sm:text-xs font-sans font-medium px-2 py-0.5 rounded-md border shrink-0 whitespace-nowrap ${isAlwaysDarkWall
                            ? 'bg-black/30 text-amber-100/80 border-amber-200/15'
                            : 'bg-black/30 text-amber-100/80 border-amber-200/15 light:bg-white/95 light:text-stone-900 light:border-stone-300/90 light:shadow-xs'
                            }`}
                        >
                          {section.books.length} <span className="hidden xs:inline">{section.books.length === 1 ? 'volume' : 'volumi'}</span><span className="xs:hidden">vol.</span>
                        </span>
                      </div>
                    </div>

                    {/* Su mobile: pulsante di riordino su riga dedicata per evitare qualsiasi sovrapposizione o troncamento del titolo */}
                    {section.id === 'want' && section.books.length > 1 && (
                      <div
                        className={`sm:hidden flex items-center justify-between gap-2 mt-2 pt-2 border-t ${isAlwaysDarkWall ? 'border-amber-200/10' : 'border-amber-200/10 light:border-stone-300/60'
                          }`}
                      >
                        <span
                          className={`text-[11px] font-medium flex items-center gap-1 truncate ${isAlwaysDarkWall ? 'text-sky-300/90' : 'text-sky-300/90 light:text-sky-950'
                            }`}
                        >
                          <Bookmark size={11} className="shrink-0" />
                          Priorità di lettura
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsReorderingWant((v) => !v)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${isReorderingWant
                            ? 'bg-sky-500 text-stone-950 font-bold shadow-xs ring-1 ring-sky-300'
                            : isAlwaysDarkWall
                              ? 'bg-black/35 text-sky-300 border border-sky-400/30'
                              : 'bg-black/35 text-sky-300 border border-sky-400/30 light:bg-white light:text-sky-900 light:border-sky-300'
                            }`}
                        >
                          <Pencil size={10} />
                          <span>{isReorderingWant ? 'Fine' : 'Modifica ordine'}</span>
                        </button>
                      </div>
                    )}

                    {section.id === 'best-completed' && section.books.length > 1 && (
                      <div
                        className={`sm:hidden flex items-center justify-between gap-2 mt-2 pt-2 border-t ${isAlwaysDarkWall ? 'border-amber-200/10' : 'border-amber-200/10 light:border-stone-300/60'
                          }`}
                      >
                        <span
                          className={`text-[11px] font-medium flex items-center gap-1 truncate ${isAlwaysDarkWall ? 'text-amber-300/90' : 'text-amber-300/90 light:text-amber-950'
                            }`}
                        >
                          <Crown size={11} className="shrink-0" />
                          Classifica personale
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsReorderingBest((v) => !v)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0 ${isReorderingBest
                            ? 'bg-amber-500 text-stone-950 font-bold shadow-xs ring-1 ring-amber-300'
                            : isAlwaysDarkWall
                              ? 'bg-black/35 text-amber-300 border border-amber-400/30'
                              : 'bg-black/35 text-amber-300 border border-amber-400/30 light:bg-white light:text-amber-950 light:border-amber-300'
                            }`}
                        >
                          <Crown size={10} />
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
                          <strong>Ordine di lettura:</strong> trascina i libri per posizionarli (★ <strong>1°</strong> è il prossimo).
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
                          <strong>Classifica Top:</strong> trascina i libri per decidere il podio (👑 <strong>1°</strong> è il preferito).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsReorderingBest(false)}
                        className="w-full xs:w-auto px-2.5 py-1 rounded-lg btn-amber text-stone-950 font-semibold text-[11px] shrink-0 cursor-pointer text-center"
                      >
                        Salva classifica
                      </button>
                    </div>
                  )}

                  {/* LIBRI APPOGGIATI SUL RIPIANO */}
                  {section.id === 'reading' && section.books.length === 0 ? (
                    /* Ripiano "In lettura" vuoto: propone le prossime letture */
                    <>
                      <EmptyReadingShelf
                        nextBooks={orderWantBooks(books.filter((b) => b.status === 'want'), priorityOrder)}
                        searchQuery={searchQuery}
                        onStartReading={onStartReading}
                        onAddBook={onAddBook}
                        onOpenBook={setInspectingBook}
                        isAlwaysDarkWall={isAlwaysDarkWall}
                      />
                      <div className={`floating-wood-shelf w-full wood-${customization.wood} relative z-20 mb-3`}>
                        <div className="floating-wood-shelf-top w-full rounded-t-xs" />
                        <div className="floating-wood-shelf-front w-full flex items-center justify-between px-3 sm:px-5 relative">
                          <div className="h-4" />
                          {showLights && (
                            <div className="absolute inset-x-0 top-0 pointer-events-none z-30">
                              <ChristmasShelfLights />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : shelfStyle === 'covers' ? (
                    /* 1. VISTA COPERTINE FRONTALI CON PROFONDITÀ */
                    <>
                      <div className="rounded-2xl pt-4 pb-2 px-1 sm:px-3 mb-0.5 relative">
                        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-5 items-end px-1 sm:px-2 pt-2 pb-1 min-h-[200px]">
                          {section.books.map((book, bookIdx) => {
                            const spine = getBookSpineStyle(
                              book.id,
                              book.title,
                              book.cover_url
                                ? coverSpinePalettes[book.cover_url] ?? getCachedCoverSpinePalette(book.cover_url)
                                : null
                            );
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
                                    if (isBestSection) handleBestDropReorder(sourceId, book.id, section.books);
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
                                className={`group relative flex flex-col items-center cursor-pointer transition-[transform,box-shadow] duration-300 sm:hover:-translate-y-3 active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl w-full max-w-[140px] xs:max-w-[150px] mx-auto ${isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-amber-400' : ''
                                  } ${isDragOver
                                    ? isBestSection
                                      ? 'ring-2 ring-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.7)] -translate-y-2 scale-105'
                                      : 'ring-2 ring-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.7)] -translate-y-2 scale-105'
                                    : ''
                                  }`}
                                title={`${isBestSection
                                  ? `[👑 #${bestRank} Top Libro] `
                                  : isWantSection
                                    ? `[Priorità #${priorityRank}] `
                                    : book.status === 'reading'
                                      ? `[📖 ${formatReadingDuration(book.started_at || book.created_at, { short: true }) || 'In lettura'}] `
                                      : ''
                                  }${book.title} — ${book.author}`}
                              >
                                {/* Libro appoggiato sullo scaffale con struttura tridimensionale */}
                                <div className="relative w-full aspect-[2/3] rounded-r-md rounded-l-xs overflow-hidden book-3d-cover transition-all group-hover:scale-105 group-hover:shadow-[0_20px_28px_-4px_rgba(245,158,11,0.3)]">
                                  {/* Scanalatura e cerniera rilegatura copertina a sinistra */}
                                  <div className="absolute top-0 left-0 bottom-0 w-3 bg-gradient-to-r from-white/20 via-black/15 to-black/45 z-20 pointer-events-none" />
                                  <div className="absolute top-0 left-2.5 bottom-0 w-[1px] bg-black/40 z-20 pointer-events-none" />
                                  <div className="absolute top-0 left-[11px] bottom-0 w-[1px] bg-white/20 z-20 pointer-events-none" />

                                  {/* Taglio delle pagine di carta a destra e in alto */}
                                  <div className="absolute top-0 right-0 bottom-0 w-1.5 book-pages-right z-20 pointer-events-none shadow-xs" />
                                  <div className="absolute top-0 left-3 right-1.5 h-[2px] bg-[#f5ecdd] border-b border-stone-400/40 z-20 pointer-events-none" />

                                  {/* Riflesso plastificato diagonale realistico */}
                                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.07] to-transparent pointer-events-none z-10" />

                                  {book.cover_url ? (
                                    <CoverImage
                                      src={book.cover_url}
                                      alt={book.title}
                                      className="w-full h-full object-cover"
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

                                  {/* Sigillo di completamento per i letti (se non nel ripiano classifica d'onore) */}
                                  {book.status === 'completed' && !isBestSection && (
                                    <div className="absolute top-1.5 left-2 z-30 pointer-events-none w-5 h-5 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-md">
                                      <Trophy size={11} />
                                    </div>
                                  )}

                                  {/* Badge classifica ripiano d'onore dei migliori libri letti */}
                                  {isBestSection && bestRank !== null && (
                                    <div className="absolute top-1.5 left-4 sm:top-2 sm:left-4 z-30 pointer-events-none">
                                      <RankSeal rank={bestRank} kind="best" size="md" />
                                    </div>
                                  )}

                                  {/* Badge priorità sulla copertina se ripiano da leggere */}
                                  {isWantSection && priorityRank !== null && (
                                    <div className="absolute top-1.5 left-4 sm:top-2 sm:left-4 z-30 pointer-events-none">
                                      <RankSeal rank={priorityRank} kind="want" size="md" />
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

                                {/* Ombra di contatto realistica sul ripiano in legno */}
                                <div className="w-[85%] h-2 mx-auto -mt-1 bg-black/75 light:bg-stone-900/35 rounded-full blur-[3px] pointer-events-none transition-transform group-hover:scale-75 group-hover:opacity-30" />

                                {/* Titolo e autore sotto la copertina con altezza uniforme per allineare perfettamente tutte le copertine */}
                                <div className="text-center mt-2 px-0.5 w-full h-[46px] xs:h-[50px] flex flex-col justify-start overflow-hidden">
                                  <p className={`font-serif text-[11px] xs:text-xs sm:text-sm font-semibold line-clamp-2 leading-tight group-hover:text-amber-400 transition-colors break-words ${isAlwaysDarkWall ? 'text-amber-100' : 'text-stone-200 light:text-stone-900'}`}>
                                    {book.title}
                                  </p>
                                  <p className={`font-sans text-[11px] truncate mt-0.5 ${isAlwaysDarkWall ? 'text-amber-200/75' : 'text-stone-400 light:text-stone-600'}`}>
                                    {book.author}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* MENSOLA SOSPESA IN LEGNO MASSICCIO CON LUCINE APPESE SOTTO IL BORDO */}
                      <div className={`floating-wood-shelf w-full wood-${customization.wood} relative z-20 mb-3`}>
                        <div className="floating-wood-shelf-top w-full rounded-t-xs" />
                        <div className="floating-wood-shelf-front w-full flex items-center justify-between px-3 sm:px-5 relative">
                          {customization.showShelfLabels ? (
                            <>
                              <span className="font-serif text-[10.5px] sm:text-xs font-semibold tracking-wider uppercase text-amber-200/80 light:text-amber-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] truncate">
                                {section.title}
                              </span>
                              <span className="text-[10px] sm:text-[11px] font-sans font-medium text-amber-300/60 light:text-amber-200/70">
                                {section.books.length} {section.books.length === 1 ? 'volume' : 'volumi'}
                              </span>
                            </>
                          ) : (
                            <div className="h-4" />
                          )}
                          {showLights && (
                            <div className="absolute inset-x-0 top-0 pointer-events-none z-30">
                              <ChristmasShelfLights />
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* 2. VISTA LIBRERIA 3D BOOKTOK (MISTO DORSI + COPERTINE SU BASETTA OPPURE SOLO DORSI) */
                    (() => {
                      // Calcolo dinamico in pixel basato sulla larghezza reale dello scaffale e sui breakpoint Tailwind (xs: 420px, sm: 640px):
                      // 1. Misura al pixel ciascun dorso 3D (getBookSpineDimension) e copertina su basetta (108px / 118px / 158px)
                      // 2. Riempie ogni mensola fino alla sua reale capienza visiva (es. 6-7 libri in modalità Misto o 8-9 dorsi in modalità Solo Dorsi su mobile)
                      // 3. Ribilancia l'ultima fila se resterebbe con 1 solo libro orfano (o pochi dorsi)
                      // 4. Se un ripiano ha spazio extra su mobile, espone automaticamente una seconda copertina su basetta e/o la decorazione a destra
                      const isSm = viewportWidth >= 640;
                      const isXs = viewportWidth >= 420;
                      const isWeb = bookcaseWidth >= 640;

                      const horizontalPaddingPx =
                        (customization.background === 'clean' ? 0 : isSm ? 40 : 24) +
                        (isSm ? 32 : 12);
                      const availShelfPx = Math.max(250, bookcaseWidth - horizontalPaddingPx);

                      const gapPx = isSm ? 6 : isXs ? 3 : 2;
                      const faceOutWidthPx = isSm ? 158 : isXs ? 118 : 108;
                      const propWidthPx = isSm ? 96 : isXs ? 76 : 68;

                      const getSpinePx = (b: Book): number => {
                        const dim = getBookSpineDimension(b);
                        return isSm ? dim.smPx : isXs ? dim.xsPx : dim.basePx;
                      };

                      const isDefaultFaceOut = (b: Book, idxInRow: number): boolean => {
                        if (shelfStyle !== 'mixed' || !b.cover_url) return false;
                        const sectionBookKey = `${section.id}::${b.id}`;
                        if (faceOutOverrides[sectionBookKey] !== undefined) {
                          return faceOutOverrides[sectionBookKey];
                        }
                        return idxInRow === 0 || (isWeb && (idxInRow === 4 || idxInRow === 8));
                      };

                      const totalBooksInSection = section.books.length;
                      const currentSectionFaceOutMap: Record<string, boolean> = {};

                      // Fase 1: Impacchettamento greedy basato sulla larghezza reale in pixel di ogni libro
                      // Calcola per ogni fila sia la capienza massima senza decorazione (rowCounts) sia la capienza
                      // piena con decorazione a destra (rowCapWithProp), così un ripiano donatore può cedere libri
                      // all'ultimo ripiano inserendo al loro posto la decorazione e restando pieno al ~96-100%.
                      const rowCounts: number[] = [];
                      const rowCapWithProp: number[] = [];
                      let packCursor = 0;
                      while (packCursor < totalBooksInSection) {
                        let rowUsedPx = 0;
                        let count = 0;
                        let countWithProp = 0;
                        while (packCursor < totalBooksInSection) {
                          if (isWeb && shelfStyle === 'mixed' && count >= 16) break;
                          const candidate = section.books[packCursor];
                          const willBeFo = isDefaultFaceOut(candidate, count);
                          const itemPx = willBeFo ? faceOutWidthPx : getSpinePx(candidate);
                          const addPx = (count > 0 ? gapPx : 0) + itemPx;
                          if (count > 0 && rowUsedPx + addPx > availShelfPx) break;
                          rowUsedPx += addPx;
                          count += 1;
                          if (rowUsedPx + propWidthPx <= availShelfPx) {
                            countWithProp = count;
                          }
                          packCursor += 1;
                        }
                        rowCounts.push(count);
                        rowCapWithProp.push(Math.max(1, countWithProp));
                      }

                      // Fase 2: Ribilanciamento intelligente anti-orfano dell'ultimo ripiano
                      // 1) I ripiani superiori cedono i libri eccedenti la loro capienza "piena con decorazione" (rowCapWithProp),
                      //    così il ripiano superiore ospita la decorazione restando pieno al ~96% e l'ultimo ripiano si riempie!
                      // 2) Se l'ultimo ripiano ha ancora troppo pochi libri (es. < 2 in modalità Misto o < 4 in modalità Solo Dorsi),
                      //    prende ancora 1 volume dal ripiano precedente per garantire equilibrio visivo.
                      if (rowCounts.length > 1) {
                        const targetLast = customization.showDecorations
                          ? rowCapWithProp[0]
                          : Math.max(2, Math.floor(rowCounts[0] * 0.7));
                        let needed = Math.max(0, targetLast - rowCounts[rowCounts.length - 1]);
                        for (let i = rowCounts.length - 2; i >= 0 && needed > 0; i--) {
                          const minKeepFullWithProp = customization.showDecorations
                            ? rowCapWithProp[i]
                            : Math.max(3, rowCounts[i] - 2);
                          const canGive = Math.max(0, rowCounts[i] - minKeepFullWithProp);
                          const give = Math.min(needed, canGive);
                          rowCounts[i] -= give;
                          rowCounts[rowCounts.length - 1] += give;
                          needed -= give;
                        }

                        // Sicurezza aggiuntiva per non lasciare mai 1 solo libro o meno di 4 dorsi sottili sull'ultima fila
                        const strictMinLast =
                          shelfStyle === 'spines'
                            ? Math.min(4, Math.floor(totalBooksInSection / 2))
                            : 2;
                        if (rowCounts[rowCounts.length - 1] < strictMinLast) {
                          let extraNeeded = strictMinLast - rowCounts[rowCounts.length - 1];
                          for (let i = rowCounts.length - 2; i >= 0 && extraNeeded > 0; i--) {
                            const strictMinKeep = shelfStyle === 'spines' ? 5 : 3;
                            const canGive = Math.max(0, rowCounts[i] - strictMinKeep);
                            const give = Math.min(extraNeeded, canGive);
                            rowCounts[i] -= give;
                            rowCounts[rowCounts.length - 1] += give;
                            extraNeeded -= give;
                          }
                        }
                      }

                      // Fase 3: Costruzione delle file e riempimento visivo adattivo (seconda copertina + decorazione)
                      const rows: Array<{
                        items: Array<{ book: Book; globalIdx: number; isFaceOut: boolean }>;
                        showPropOnRight: boolean;
                        propShelfIndex: number;
                      }> = [];

                      let cursor = 0;
                      for (let rowIdx = 0; rowIdx < rowCounts.length; rowIdx++) {
                        const countForThisRow = rowCounts[rowIdx];
                        if (countForThisRow <= 0) continue;

                        const items: Array<{ book: Book; globalIdx: number; isFaceOut: boolean }> = [];
                        let usedPx = 0;

                        for (let idxInRow = 0; idxInRow < countForThisRow; idxInRow++) {
                          if (cursor >= totalBooksInSection) break;
                          const book = section.books[cursor];
                          const globalIdx = cursor;
                          const isFaceOut = isDefaultFaceOut(book, idxInRow);
                          const itemPx = isFaceOut ? faceOutWidthPx : getSpinePx(book);

                          items.push({ book, globalIdx, isFaceOut });
                          usedPx += (idxInRow > 0 ? gapPx : 0) + itemPx;
                          cursor += 1;
                        }

                        // Se su mobile un ripiano in modalità 'mixed' ha ancora spazio libero (es. 2, 3 o 4 libri),
                        // espone automaticamente un secondo libro con la copertina frontale su basetta per riempire con armonia la mensola
                        if (!isWeb && shelfStyle === 'mixed' && items.length >= 2) {
                          const widthWithProp =
                            usedPx + (customization.showDecorations ? propWidthPx : 0);
                          if (widthWithProp < availShelfPx * 0.82) {
                            for (let j = items.length - 1; j >= 1; j--) {
                              const candidate = items[j];
                              const key = `${section.id}::${candidate.book.id}`;
                              if (
                                !candidate.isFaceOut &&
                                Boolean(candidate.book.cover_url) &&
                                faceOutOverrides[key] === undefined
                              ) {
                                const extraPx = faceOutWidthPx - getSpinePx(candidate.book);
                                if (usedPx + extraPx <= availShelfPx) {
                                  candidate.isFaceOut = true;
                                  usedPx += extraPx;
                                }
                                break;
                              }
                            }
                          }
                        }

                        for (const item of items) {
                          currentSectionFaceOutMap[item.book.id] = item.isFaceOut;
                        }

                        // Mostra la decorazione a destra ogni volta che c'è spazio fisico sulla mensola
                        const showPropOnRight =
                          customization.showDecorations &&
                          (usedPx + propWidthPx <= availShelfPx || items.length === 1);

                        rows.push({
                          items,
                          showPropOnRight,
                          propShelfIndex: sectionIdx + rowIdx,
                        });
                      }

                      return (
                        <div className="space-y-6 sm:space-y-7">
                          {rows.map((row, rIdx) => (
                            <div key={`${section.id}-row-${rIdx}`} className="relative">
                              {/* Area libri sopra la mensola (no-scrollbar evita la barra grigia sopra la mensola in legno) */}
                              <div className="pt-1.5 sm:pt-2 px-0.5 sm:px-2">
                                <div className="flex items-end justify-between gap-1.5 sm:gap-2 px-1 sm:px-2 overflow-x-auto overflow-y-hidden no-scrollbar min-h-[196px] xs:min-h-[208px] sm:min-h-[234px] touch-manipulation">
                                  {/* Sequenza di libri (dorsi cilindrici 3D + eventuali copertine frontali su basetta) */}
                                  <div className="flex items-end gap-[2px] xs:gap-[3px] sm:gap-1.5 shrink-0">
                                    {row.items.map(({ book, globalIdx, isFaceOut }) => {
                                      const extractedCoverPalette = book.cover_url
                                        ? coverSpinePalettes[book.cover_url] ??
                                        getCachedCoverSpinePalette(book.cover_url)
                                        : null;
                                      const spine = getBookSpineStyle(
                                        book.id,
                                        book.title,
                                        extractedCoverPalette
                                      );
                                      const dim = getBookSpineDimension(book);
                                      const authorSurname = getAuthorSurname(book.author);

                                      const isWantSection = section.id === 'want';
                                      const isBestSection = section.id === 'best-completed';
                                      const isDraggable =
                                        !isSelectingFaceOut &&
                                        ((isWantSection && isReorderingWant) ||
                                          (isBestSection && isReorderingBest));
                                      const priorityRank = isWantSection ? globalIdx + 1 : null;
                                      const bestRank = isBestSection ? globalIdx + 1 : null;

                                      // Nella Classifica ("Ripiano d'Onore") mostra il numero di posizione (1°, 2°, 3°, 4°...) su tutti i libri;
                                      // in "Da Leggere" mostra la priorità sui primi 3 libri (e su tutti durante il riordino)
                                      const showSpineRankBadge =
                                        (isBestSection && bestRank !== null) ||
                                        (isWantSection &&
                                          priorityRank !== null &&
                                          (priorityRank <= 3 || isReorderingWant));

                                      // Riduce leggermente i caratteri massimi del titolo quando c'è il badge in testa per non toccare mai il cognome dell'autore
                                      const effectiveMaxChars = showSpineRankBadge
                                        ? Math.max(9, dim.maxChars - 3)
                                        : dim.maxChars;
                                      const spineTitle = truncateSpineTitle(book.title, effectiveMaxChars);

                                      const isBeingDragged =
                                        (isWantSection && draggedBookId === book.id) ||
                                        (isBestSection && draggedBestBookId === book.id);
                                      const isDragOver =
                                        (isWantSection && dragOverBookId === book.id) ||
                                        (isBestSection && dragOverBestBookId === book.id);

                                      const handleBookClick = () => {
                                        if (isSelectingFaceOut && book.cover_url) {
                                          handleToggleFaceOut(
                                            section.id,
                                            book.id,
                                            isFaceOut,
                                            currentSectionFaceOutMap
                                          );
                                          return;
                                        }
                                        setInspectingBook(book);
                                      };

                                      // A) LIBRO ESPOSTO FRONTALMENTE SU BASETTA IN LEGNO (come "Love Unwritten" e "Verity" nello screenshot)
                                      if (isFaceOut && book.cover_url) {
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
                                                if (isBestSection)
                                                  handleBestDropReorder(sourceId, book.id, section.books);
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
                                            onClick={handleBookClick}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleBookClick();
                                              }
                                            }}
                                            style={{
                                              touchAction: isDraggable ? 'none' : 'manipulation',
                                            }}
                                            className={`group relative flex flex-col items-center shrink-0 mx-0.5 sm:mx-1.5 cursor-pointer transition-transform duration-300 sm:hover:-translate-y-2.5 active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-amber-400' : ''
                                              } ${isDragOver
                                                ? isBestSection
                                                  ? 'ring-2 ring-amber-400 -translate-y-2'
                                                  : 'ring-2 ring-sky-400 -translate-y-2'
                                                : ''
                                              }`}
                                            title={
                                              isSelectingFaceOut
                                                ? `Tocca per girare "${book.title}" di dorso`
                                                : `${book.title} — ${book.author}`
                                            }
                                          >
                                            {/* Copertina frontale verticale */}
                                            <div
                                              className={`relative w-[96px] xs:w-[106px] sm:w-[136px] h-[152px] xs:h-[168px] sm:h-[210px] rounded-t-[3px] overflow-hidden shadow-[-4px_4px_12px_rgba(0,0,0,0.65),4px_4px_12px_rgba(0,0,0,0.55)] border ${isSelectingFaceOut
                                                ? 'border-amber-400 ring-2 ring-amber-400/70'
                                                : 'border-white/15'
                                                }`}
                                            >
                                              {/* Riflesso rilegatura sui bordi */}
                                              <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/35 via-white/20 to-transparent z-20 pointer-events-none" />
                                              <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-l from-black/45 to-transparent z-20 pointer-events-none" />

                                              <CoverImage
                                                src={book.cover_url}
                                                alt={book.title}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                              />

                                              {/* Badge classifica (1°, 2°, 3°, 4°...) o priorità (1°, 2°, 3°) coerente con i dorsi */}
                                              {isBestSection && bestRank !== null && (
                                                <div className="absolute top-1.5 left-2.5 z-30 pointer-events-none">
                                                  <RankSeal rank={bestRank} kind="best" size="md" />
                                                </div>
                                              )}
                                              {isWantSection &&
                                                priorityRank !== null &&
                                                (priorityRank <= 3 || isReorderingWant) && (
                                                  <div className="absolute top-1.5 left-2.5 z-30 pointer-events-none">
                                                    <RankSeal rank={priorityRank} kind="want" size="md" />
                                                  </div>
                                                )}

                                              {/* Frecce rapide ‹ / › per spostare il libro anche da smartphone durante "Modifica classifica / ordine" */}
                                              {isDraggable && (
                                                <div
                                                  className="absolute inset-x-1 bottom-1.5 z-30 flex items-center justify-between gap-1"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <button
                                                    type="button"
                                                    disabled={globalIdx === 0}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (isBestSection)
                                                        handleShiftBest(book.id, 'left', section.books);
                                                      else if (isWantSection) handleShift(book.id, 'left');
                                                    }}
                                                    className="w-6 h-6 rounded-full bg-black/85 text-amber-300 border border-amber-400/50 flex items-center justify-center text-xs font-black disabled:opacity-30 active:scale-90 cursor-pointer shadow-md"
                                                    title="Sposta prima"
                                                  >
                                                    ‹
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={globalIdx === section.books.length - 1}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      if (isBestSection)
                                                        handleShiftBest(book.id, 'right', section.books);
                                                      else if (isWantSection) handleShift(book.id, 'right');
                                                    }}
                                                    className="w-6 h-6 rounded-full bg-black/85 text-amber-300 border border-amber-400/50 flex items-center justify-center text-xs font-black disabled:opacity-30 active:scale-90 cursor-pointer shadow-md"
                                                    title="Sposta dopo"
                                                  >
                                                    ›
                                                  </button>
                                                </div>
                                              )}

                                              {/* Indicatore interattivo quando si scelgono le copertine da esporre */}
                                              {isSelectingFaceOut && (
                                                <div className="absolute inset-x-1 bottom-1.5 z-30 pointer-events-none flex justify-center">
                                                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-400 text-stone-950 shadow-md flex items-center gap-1">
                                                    <Eye size={10} />
                                                    In mostra
                                                  </span>
                                                </div>
                                              )}
                                            </div>

                                            {/* Basetta / supporto in legno su cui poggia la copertina (come nello screenshot) */}
                                            <div className="w-[104px] xs:w-[114px] sm:w-[146px] book-stand-ledge z-20" />
                                          </div>
                                        );
                                      }

                                      // B) DORSO CILINDRICO 3D OPACO CON NERVATURE INCISE, TITOLO IN BASSO E COGNOME AUTORE IN ALTO
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
                                              if (isBestSection)
                                                handleBestDropReorder(sourceId, book.id, section.books);
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
                                          onClick={handleBookClick}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              handleBookClick();
                                            }
                                          }}
                                          style={{
                                            backgroundColor: spine.baseColor,
                                            touchAction: isDraggable ? 'none' : 'manipulation',
                                          }}
                                          className={`group relative ${dim.width} ${dim.height} rounded-t-[4px] rounded-b-[1px] shrink-0 flex flex-col justify-between cursor-pointer transition-transform duration-300 sm:hover:-translate-y-3 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 book-spine-cylinder select-none overflow-hidden ${isSelectingFaceOut && book.cover_url
                                            ? 'ring-1 ring-amber-300/60 hover:ring-2 hover:ring-amber-400'
                                            : ''
                                            } ${isBeingDragged ? 'opacity-30 scale-95 ring-2 ring-amber-400' : ''
                                            } ${isDragOver
                                              ? isBestSection
                                                ? 'ring-2 ring-amber-400 -translate-y-2'
                                                : 'ring-2 ring-sky-400 -translate-y-2'
                                              : ''
                                            }`}
                                          title={
                                            isSelectingFaceOut
                                              ? book.cover_url
                                                ? `Tocca per esporre la copertina di "${book.title}"`
                                                : `"${book.title}" (nessuna immagine di copertina disponibile)`
                                              : `${isBestSection
                                                ? `[👑 ${bestRank}° Top Libro] `
                                                : isWantSection
                                                  ? `[Priorità ${priorityRank}°] `
                                                  : book.status === 'reading'
                                                    ? `[📖 ${formatReadingDuration(book.started_at || book.created_at, { short: true }) || 'In lettura'}] `
                                                    : ''
                                              }${book.title} — ${book.author}`
                                          }
                                        >
                                          {/* Copertina reale sfocata sul dorso 3D (miniatura piccola e caricamento lazy per restare leggeri) */}
                                          {book.cover_url ? (
                                            <div
                                              aria-hidden="true"
                                              className="absolute inset-0 overflow-hidden pointer-events-none z-0"
                                            >
                                              <CoverImage
                                                src={book.cover_url}
                                                alt=""
                                                thumbWidth={90}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover object-center scale-[1.28] blur-[3.5px] sm:blur-[2px] saturate-[1.18] brightness-[0.82] contrast-[1.05]"
                                              />
                                              {/* Velatura verticale morbida per garantire contrasto al titolo e profondità cilindrica */}
                                              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/60" />
                                            </div>
                                          ) : (
                                            spine.twoToneCap && (
                                              <>
                                                <div
                                                  className="absolute top-0 inset-x-0 h-[18px] sm:h-[21px] pointer-events-none z-0 opacity-90"
                                                  style={{ backgroundColor: spine.twoToneCap }}
                                                />
                                                <div
                                                  className="absolute bottom-0 inset-x-0 h-[18px] sm:h-[21px] pointer-events-none z-0 opacity-90"
                                                  style={{ backgroundColor: spine.twoToneCap }}
                                                />
                                              </>
                                            )
                                          )}

                                          {/* TESTA DEL DORSO: Doppia nervatura orizzontale incisa */}
                                          <div className="w-full pt-[9px] sm:pt-[11px] space-y-[3.5px] z-10 shrink-0">
                                            <div className="book-spine-ridge" />
                                            <div className="book-spine-ridge" />
                                          </div>

                                          {/* Badge classifica (1°, 2°, 3°, 4°...) / priorità di lettura (1°, 2°, 3°) */}
                                          {showSpineRankBadge ? (
                                            <div className="z-20 mx-auto mt-1 shrink-0 flex justify-center">
                                              {isBestSection && bestRank !== null ? (
                                                <RankSeal rank={bestRank} kind="best" size="sm" />
                                              ) : isWantSection && priorityRank !== null ? (
                                                <RankSeal rank={priorityRank} kind="want" size="sm" />
                                              ) : null}
                                            </div>
                                          ) : null}

                                          {/* Frecce rapide ‹ / › sul dorso quando si modifica la classifica o l'ordine */}
                                          {isDraggable && (
                                            <div
                                              className="z-30 mx-auto mt-0.5 flex items-center justify-center gap-0.5 shrink-0"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <button
                                                type="button"
                                                disabled={globalIdx === 0}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (isBestSection)
                                                    handleShiftBest(book.id, 'left', section.books);
                                                  else if (isWantSection) handleShift(book.id, 'left');
                                                }}
                                                className="w-4 h-4 rounded bg-black/85 text-amber-300 border border-amber-400/50 flex items-center justify-center text-[10px] font-black leading-none disabled:opacity-25 active:scale-90 cursor-pointer"
                                                title="Sposta prima"
                                              >
                                                ‹
                                              </button>
                                              <button
                                                type="button"
                                                disabled={globalIdx === section.books.length - 1}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (isBestSection)
                                                    handleShiftBest(book.id, 'right', section.books);
                                                  else if (isWantSection) handleShift(book.id, 'right');
                                                }}
                                                className="w-4 h-4 rounded bg-black/85 text-amber-300 border border-amber-400/50 flex items-center justify-center text-[10px] font-black leading-none disabled:opacity-25 active:scale-90 cursor-pointer"
                                                title="Sposta dopo"
                                              >
                                                ›
                                              </button>
                                            </div>
                                          )}

                                          {/* Badge selezione copertina quando la modalità vetrina è attiva */}
                                          {isSelectingFaceOut && book.cover_url && (
                                            <div className="z-20 mx-auto mt-0.5 shrink-0">
                                              <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-black/75 text-amber-300 border border-amber-400/50 block leading-tight">
                                                +Cop
                                              </span>
                                            </div>
                                          )}

                                          {/* CORPO CENTRALE DEL DORSO: Rombo ◇ + Cognome Autore in alto (corsivo) + Titolo in basso (grassetto) */}
                                          <div className="flex-1 flex flex-col items-center justify-between py-1.5 sm:py-2 px-0.5 overflow-hidden z-10 min-h-0 gap-2">
                                            {/* Parte superiore: eventuale piccolo rombo ornamentale ◇ + Cognome autore in Serif Italic */}
                                            <div className="flex flex-col items-center gap-1 shrink-0">
                                              {spine.diamond && !showSpineRankBadge && (
                                                <svg
                                                  width="10"
                                                  height="10"
                                                  viewBox="0 0 12 12"
                                                  fill="none"
                                                  className="shrink-0 opacity-90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
                                                >
                                                  <path
                                                    d="M6 1 L11 6 L6 11 L1 6 Z"
                                                    stroke={book.cover_url ? '#f5efe6' : spine.authorColor}
                                                    strokeWidth="1.2"
                                                  />
                                                </svg>
                                              )}
                                              {authorSurname && (
                                                <span
                                                  style={{
                                                    color: book.cover_url ? '#f5efe6' : spine.authorColor,
                                                    textShadow: book.cover_url
                                                      ? '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.85)'
                                                      : spine.isLight
                                                        ? '0 1px 1px rgba(255,255,255,0.45)'
                                                        : '0 1px 2px rgba(0,0,0,0.65)',
                                                  }}
                                                  className="writing-vertical-rl font-serif italic text-[9.5px] xs:text-[10px] sm:text-[11.5px] tracking-wide leading-none select-none whitespace-nowrap"
                                                >
                                                  {authorSurname}
                                                </span>
                                              )}
                                            </div>

                                            {/* Parte inferiore: Titolo del libro in Serif Bold orientato dal basso verso l'alto */}
                                            <div className="mt-auto flex items-center justify-start overflow-hidden pt-1">
                                              <span
                                                style={{
                                                  color: book.cover_url ? '#ffffff' : spine.textColor,
                                                  textShadow: book.cover_url
                                                    ? '0 1px 3px rgba(0,0,0,0.98), 0 0 7px rgba(0,0,0,0.9)'
                                                    : spine.isLight
                                                      ? '0 1px 1px rgba(255,255,255,0.5)'
                                                      : '0 1px 2px rgba(0,0,0,0.75)',
                                                }}
                                                className="writing-vertical-rl font-serif font-bold text-[10.5px] xs:text-[11px] sm:text-[13px] tracking-tight leading-none select-none whitespace-nowrap"
                                              >
                                                {spineTitle}
                                              </span>
                                            </div>
                                          </div>

                                          {/* PIEDE DEL DORSO: Doppia nervatura orizzontale incisa simmetrica */}
                                          <div className="w-full pb-[9px] sm:pb-[11px] space-y-[3.5px] z-10 shrink-0">
                                            <div className="book-spine-ridge" />
                                            <div className="book-spine-ridge" />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Decorazione / Gattino che dorme sul lato destro della mensola */}
                                  {row.showPropOnRight && (
                                    <div
                                      className="shrink-0 self-end ml-auto pl-0.5 xs:pl-1 sm:pl-3 pr-0.5 pb-0.5 scale-[0.88] xs:scale-95 sm:scale-100 origin-bottom-right pointer-events-none"
                                      title="Decorazione sul ripiano"
                                    >
                                      <BookshelfDecoration
                                        holiday={activeHoliday}
                                        shelfIndex={row.propShelfIndex}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* MENSOLA IN LEGNO MASSICCIO CON FILO E LUCINE APPESE LUNGO IL BORDO INFERIORE */}
                              <div
                                className={`floating-wood-shelf w-full wood-${customization.wood} relative z-20 mb-3`}
                              >
                                <div className="floating-wood-shelf-top w-full rounded-t-xs" />
                                <div className="floating-wood-shelf-front w-full flex items-center justify-between px-3 sm:px-5 relative">
                                  {customization.showShelfLabels && rIdx === 0 ? (
                                    <>
                                      <span className="font-serif text-[10.5px] sm:text-xs font-semibold tracking-wider uppercase text-amber-200/80 light:text-amber-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] truncate">
                                        {section.title}
                                      </span>
                                      <span className="text-[10px] sm:text-[11px] font-sans font-medium text-amber-300/60 light:text-amber-200/70">
                                        {section.books.length}{' '}
                                        {section.books.length === 1 ? 'volume' : 'volumi'}
                                      </span>
                                    </>
                                  ) : (
                                    <div className="h-4" />
                                  )}

                                  {/* Lucine natalizie montate lungo e sotto il bordo della mensola (come nello screenshot) */}
                                  {showLights && (
                                    <div className="absolute inset-x-0 top-0 pointer-events-none z-30">
                                      <ChristmasShelfLights />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
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

      {/* MODALE DI PERSONALIZZAZIONE DELLA LIBRERIA */}
      {isCustomizing && (
        <BookshelfCustomizationModal
          customization={customization}
          onChange={handleUpdateCustomization}
          onClose={() => setIsCustomizing(false)}
        />
      )}
    </div>
  );
}
