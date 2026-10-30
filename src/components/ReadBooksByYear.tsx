import { useState, useMemo } from 'react';
import {
  Calendar,
  Trophy,
  ChevronDown,
  ChevronUp,
  Star,
  BookCheck,
  Search,
  Layers,
  Target,
} from 'lucide-react';
import type { Book } from '@/lib/supabase';
import type { ReadingGoals } from '@/hooks/useReadingGoals';
import { BookCard } from './BookCard';
import { sortBooks, type SortKey } from '@/lib/sortBooks';

interface ReadBooksByYearProps {
  books: Book[];
  onUpdate: (book: Book) => void;
  onDelete: (id: string) => void;
  onEdit: (book: Book) => void;
  onInspect?: (book: Book) => void;
  searchQuery?: string;
  goals?: ReadingGoals;
  sortBy?: SortKey;
}

export function ReadBooksByYear({
  books,
  onUpdate,
  onDelete,
  onEdit,
  onInspect,
  searchQuery = '',
  goals = {},
  sortBy = 'recent',
}: ReadBooksByYearProps) {
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [collapsedYears, setCollapsedYears] = useState<Record<string, boolean>>({});

  // Filtra per ricerca su titolo e autore
  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q)
    );
  }, [books, searchQuery]);

  // Raggruppa i libri per anno (in base a read_at oppure 'Senza data')
  const groupedData = useMemo(() => {
    const groups: Record<string, Book[]> = {};

    filteredBooks.forEach((book) => {
      let yearKey = 'Senza data';
      if (book.read_at) {
        const d = new Date(book.read_at);
        if (!isNaN(d.getTime())) {
          yearKey = String(d.getFullYear());
        }
      }
      if (!groups[yearKey]) {
        groups[yearKey] = [];
      }
      groups[yearKey].push(book);
    });

    // Ordina i libri all'interno di ogni anno secondo il criterio scelto (default: dal più recente)
    Object.keys(groups).forEach((year) => {
      groups[year] = sortBooks(groups[year], sortBy);
    });

    // Ordina gli anni numerici in ordine decrescente, posizionando 'Senza data' alla fine
    const sortedYears = Object.keys(groups).sort((a, b) => {
      if (a === 'Senza data') return 1;
      if (b === 'Senza data') return -1;
      return Number(b) - Number(a);
    });

    return { groups, sortedYears };
  }, [filteredBooks, sortBy]);

  const toggleYearCollapse = (year: string) => {
    setCollapsedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };

  const expandAll = () => setCollapsedYears({});
  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    groupedData.sortedYears.forEach((y) => {
      allCollapsed[y] = true;
    });
    setCollapsedYears(allCollapsed);
  };

  // Calcolo totale pagine lette tra i libri completati
  const totalCompletedPages = useMemo(
    () => filteredBooks.reduce((acc, b) => acc + (b.pages || 0), 0),
    [filteredBooks]
  );

  // Se non ci sono libri completati
  if (books.length === 0) {
    return (
      <div className="bg-stone-850/60 light:bg-white border border-stone-800 light:border-stone-200 rounded-2xl p-10 text-center max-w-lg mx-auto my-8 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 light:bg-emerald-50 border border-emerald-500/20 light:border-emerald-200 flex items-center justify-center mx-auto mb-4 text-emerald-400 light:text-emerald-600">
          <BookCheck size={32} />
        </div>
        <h3 className="font-serif text-xl font-bold text-stone-200 light:text-stone-900 mb-2">
          Nessun libro completato
        </h3>
        <p className="text-sm text-stone-400 light:text-stone-600 leading-relaxed">
          I libri che segni come completati verranno automaticamente archiviati qui, suddivisi per
          anno di lettura.
        </p>
      </div>
    );
  }

  // Se il filtro di ricerca non ha prodotto risultati
  if (filteredBooks.length === 0) {
    return (
      <div className="text-center py-16 text-stone-400 light:text-stone-500">
        <Search size={40} className="mx-auto mb-3 text-stone-600 light:text-stone-400" />
        <p className="font-medium text-stone-300 light:text-stone-700">Nessun libro letto trovato</p>
        <p className="text-xs text-stone-500 light:text-stone-400 mt-1">
          Nessun libro tra quelli letti corrisponde a "{searchQuery}"
        </p>
      </div>
    );
  }

  // Anni da visualizzare in base al selettore anno
  const yearsToRender =
    selectedYear === 'all'
      ? groupedData.sortedYears
      : groupedData.sortedYears.filter((y) => y === selectedYear);

  return (
    <div className="space-y-6">
      {/* Intestazione Sezione Libri Letti */}
      <div className="bg-gradient-to-r from-emerald-950/30 via-stone-850 to-stone-900 light:from-emerald-50 light:via-stone-50 light:to-white border border-emerald-500/20 light:border-emerald-200/90 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 light:bg-emerald-100 border border-emerald-500/30 light:border-emerald-300 flex items-center justify-center text-emerald-400 light:text-emerald-700 shadow-inner">
              <Trophy size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-100 light:text-stone-900">
                  Libri Letti
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 light:bg-emerald-100 text-emerald-400 light:text-emerald-700 border border-emerald-500/30 light:border-emerald-300 whitespace-nowrap shrink-0">
                  {filteredBooks.length} {filteredBooks.length === 1 ? 'libro' : 'libri'}
                </span>
                {totalCompletedPages > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 light:bg-amber-100 text-amber-400 light:text-amber-800 border border-amber-500/30 light:border-amber-300 flex items-center gap-1 whitespace-nowrap shrink-0">
                    <Layers size={11} />
                    {totalCompletedPages.toLocaleString('it-IT')} pagine complessive
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-stone-400 light:text-stone-600 mt-0.5">
                Archivio cronologico suddiviso per anno di completamento
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
            <button
              onClick={expandAll}
              className="text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 px-2.5 py-1 rounded-md hover:bg-stone-800 light:hover:bg-stone-200/60 transition-colors"
            >
              Espandi tutti
            </button>
            <span className="text-stone-700 light:text-stone-300">|</span>
            <button
              onClick={collapseAll}
              className="text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900 px-2.5 py-1 rounded-md hover:bg-stone-800 light:hover:bg-stone-200/60 transition-colors"
            >
              Comprimi tutti
            </button>
          </div>
        </div>

        {/* Categorie / Filtro rapido per Anno */}
        <div className="mt-5 pt-4 border-t border-stone-800 light:border-stone-200 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-xs font-medium text-stone-400 light:text-stone-600 flex items-center gap-1.5 mr-1 flex-shrink-0">
            <Calendar size={13} className="text-emerald-400 light:text-emerald-600" />
            Filtra anno:
          </span>
          <button
            onClick={() => setSelectedYear('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
              selectedYear === 'all'
                ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-semibold shadow-sm'
                : 'bg-stone-850/80 light:bg-white text-stone-400 light:text-stone-700 border-stone-700 light:border-stone-200 hover:text-stone-200 light:hover:text-stone-900 hover:border-stone-600 light:hover:border-stone-300'
            }`}
          >
            Tutti gli anni ({filteredBooks.length})
          </button>
          {groupedData.sortedYears.map((year) => {
            const count = groupedData.groups[year].length;
            const isSelected = selectedYear === year;
            return (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-semibold shadow-sm'
                    : 'bg-stone-850/80 light:bg-white text-stone-400 light:text-stone-700 border-stone-700 light:border-stone-200 hover:text-stone-200 light:hover:text-stone-900 hover:border-stone-600 light:hover:border-stone-300'
                }`}
              >
                <span>{year}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-stone-900/30 text-stone-950'
                      : 'bg-stone-700/60 light:bg-stone-100 text-stone-300 light:text-stone-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Raggruppamento effettivo per Anno */}
      <div className="space-y-6">
        {yearsToRender.map((year) => {
          const yearBooks = groupedData.groups[year];
          const isCollapsed = Boolean(collapsedYears[year]);
          const yearPages = yearBooks.reduce((acc, b) => acc + (b.pages || 0), 0);

          // Calcola media voto per questo anno
          const ratedBooks = yearBooks.filter((b) => b.rating > 0);
          const avgRating =
            ratedBooks.length > 0
              ? (ratedBooks.reduce((acc, b) => acc + b.rating, 0) / ratedBooks.length).toFixed(1)
              : null;

          return (
            <div
              key={year}
              className="bg-stone-850/40 light:bg-white border border-stone-800 light:border-stone-200/90 rounded-2xl overflow-hidden transition-all shadow-sm"
            >
              {/* Barra intestazione dell'anno */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                onClick={() => toggleYearCollapse(year)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleYearCollapse(year);
                  }
                }}
                className="w-full px-5 py-4 flex items-center justify-between bg-stone-800/50 light:bg-stone-50/90 hover:bg-stone-800/70 light:hover:bg-stone-100/90 border-b border-stone-800/80 light:border-stone-200 cursor-pointer transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 light:bg-emerald-50 border border-emerald-500/20 light:border-emerald-200 flex items-center justify-center text-emerald-400 light:text-emerald-700 font-bold text-sm">
                    {year === 'Senza data' ? '?' : year.slice(-2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-serif text-lg font-bold text-stone-100 light:text-stone-900">
                        {year === 'Senza data' ? 'Anno non specificato' : `Anno ${year}`}
                      </h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-700/60 light:bg-stone-100 text-stone-300 light:text-stone-700 border border-stone-600/50 light:border-stone-200 font-medium whitespace-nowrap shrink-0">
                        {yearBooks.length} {yearBooks.length === 1 ? 'libro' : 'libri'}
                      </span>
                      {yearPages > 0 && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 light:bg-emerald-50 text-emerald-400 light:text-emerald-700 border border-emerald-500/20 light:border-emerald-200 font-medium flex items-center gap-1 whitespace-nowrap shrink-0">
                          <Layers size={11} />
                          {yearPages.toLocaleString('it-IT')} pag.
                        </span>
                      )}
                      {goals[year] > 0 && (
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 border whitespace-nowrap shrink-0 ${
                            yearBooks.length >= goals[year]
                              ? 'bg-emerald-500/15 light:bg-emerald-50 text-emerald-400 light:text-emerald-700 border-emerald-500/30 light:border-emerald-300'
                              : 'bg-amber-500/15 light:bg-amber-50 text-amber-400 light:text-amber-700 border-amber-500/30 light:border-amber-300'
                          }`}
                          title="Obiettivo di lettura"
                        >
                          <Target size={11} />
                          {yearBooks.length}/{goals[year]} obiettivo
                          {yearBooks.length >= goals[year] && ' ✓'}
                        </span>
                      )}
                    </div>
                    {year === 'Senza data' && (
                      <p className="text-[11px] text-stone-500 light:text-stone-400 mt-0.5">
                        Imposta la data di lettura modificando il libro per inserirlo nel rispettivo anno
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {avgRating && (
                    <div className="hidden sm:flex items-center gap-1 text-xs text-amber-400 light:text-amber-700 bg-amber-500/10 light:bg-amber-50 px-2.5 py-1 rounded-full border border-amber-500/20 light:border-amber-200 font-medium">
                      <Star size={13} className="fill-amber-400 light:fill-amber-500" />
                      <span>{avgRating} media</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="text-stone-400 light:text-stone-500 hover:text-stone-200 light:hover:text-stone-800 p-1 rounded-lg hover:bg-stone-700/50 light:hover:bg-stone-200/60 transition-colors"
                    aria-label={isCollapsed ? 'Espandi anno' : 'Comprimi anno'}
                  >
                    {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  </button>
                </div>
              </div>

              {/* Griglia libri dell'anno */}
              {!isCollapsed && (
                <div className="p-2.5 sm:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {yearBooks.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onInspect={onInspect}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
