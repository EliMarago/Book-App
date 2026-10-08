import { useState, useMemo } from 'react';
import {
  Calendar,
  Trophy,
  ChevronDown,
  ChevronUp,
  Star,
  BookCheck,
  Search,
  Sparkles,
} from 'lucide-react';
import type { Book } from '@/lib/supabase';
import { BookCard } from './BookCard';

interface ReadBooksByYearProps {
  books: Book[];
  onUpdate: (book: Book) => void;
  onDelete: (id: string) => void;
  onEdit: (book: Book) => void;
  searchQuery?: string;
}

export function ReadBooksByYear({
  books,
  onUpdate,
  onDelete,
  onEdit,
  searchQuery = '',
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

    // Ordina i libri all'interno di ogni anno dal più recente al meno recente
    Object.keys(groups).forEach((year) => {
      groups[year].sort((a, b) => {
        const dateA = a.read_at ? new Date(a.read_at).getTime() : new Date(a.created_at).getTime();
        const dateB = b.read_at ? new Date(b.read_at).getTime() : new Date(b.created_at).getTime();
        return dateB - dateA;
      });
    });

    // Ordina gli anni numerici in ordine decrescente, posizionando 'Senza data' alla fine
    const sortedYears = Object.keys(groups).sort((a, b) => {
      if (a === 'Senza data') return 1;
      if (b === 'Senza data') return -1;
      return Number(b) - Number(a);
    });

    return { groups, sortedYears };
  }, [filteredBooks]);

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

  // Se non ci sono libri completati
  if (books.length === 0) {
    return (
      <div className="bg-stone-850/60 border border-stone-800 rounded-2xl p-10 text-center max-w-lg mx-auto my-8">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-emerald-400">
          <BookCheck size={32} />
        </div>
        <h3 className="font-serif text-xl font-bold text-stone-200 mb-2">
          Nessun libro completato
        </h3>
        <p className="text-sm text-stone-400 leading-relaxed">
          I libri che segni come completati verranno automaticamente archiviati qui, suddivisi per
          anno di lettura.
        </p>
      </div>
    );
  }

  // Se il filtro di ricerca non ha prodotto risultati
  if (filteredBooks.length === 0) {
    return (
      <div className="text-center py-16 text-stone-400">
        <Search size={40} className="mx-auto mb-3 text-stone-600" />
        <p className="font-medium text-stone-300">Nessun libro letto trovato</p>
        <p className="text-xs text-stone-500 mt-1">
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
      <div className="bg-gradient-to-r from-emerald-950/30 via-stone-850 to-stone-900 border border-emerald-500/20 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Trophy size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-stone-100">
                  Libri Letti
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {filteredBooks.length} {filteredBooks.length === 1 ? 'libro' : 'libri'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
                Archivio cronologico suddiviso per anno di completamento
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
            <button
              onClick={expandAll}
              className="text-stone-400 hover:text-stone-200 px-2.5 py-1 rounded-md hover:bg-stone-800 transition-colors"
            >
              Espandi tutti
            </button>
            <span className="text-stone-700">|</span>
            <button
              onClick={collapseAll}
              className="text-stone-400 hover:text-stone-200 px-2.5 py-1 rounded-md hover:bg-stone-800 transition-colors"
            >
              Comprimi tutti
            </button>
          </div>
        </div>

        {/* Categorie / Filtro rapido per Anno */}
        <div className="mt-5 pt-4 border-t border-stone-800 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <span className="text-xs font-medium text-stone-400 flex items-center gap-1.5 mr-1 flex-shrink-0">
            <Calendar size={13} className="text-emerald-400" />
            Filtra anno:
          </span>
          <button
            onClick={() => setSelectedYear('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
              selectedYear === 'all'
                ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-semibold shadow-sm'
                : 'bg-stone-800/80 text-stone-400 border-stone-700 hover:text-stone-200 hover:border-stone-600'
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
                    : 'bg-stone-800/80 text-stone-400 border-stone-700 hover:text-stone-200 hover:border-stone-600'
                }`}
              >
                <span>{year}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-stone-900/30 text-stone-950' : 'bg-stone-700/60 text-stone-300'
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

          // Calcola media voto per questo anno
          const ratedBooks = yearBooks.filter((b) => b.rating > 0);
          const avgRating =
            ratedBooks.length > 0
              ? (ratedBooks.reduce((acc, b) => acc + b.rating, 0) / ratedBooks.length).toFixed(1)
              : null;

          return (
            <div
              key={year}
              className="bg-stone-850/40 border border-stone-800 rounded-2xl overflow-hidden transition-all shadow-sm"
            >
              {/* Barra intestazione dell'anno */}
              <div
                onClick={() => toggleYearCollapse(year)}
                className="w-full px-5 py-4 flex items-center justify-between bg-stone-800/50 hover:bg-stone-800/70 border-b border-stone-800/80 cursor-pointer transition-colors select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    {year === 'Senza data' ? '?' : year.slice(-2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-serif text-lg font-bold text-stone-100">
                        {year === 'Senza data' ? 'Anno non specificato' : `Anno ${year}`}
                      </h3>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-700/60 text-stone-300 border border-stone-600/50 font-medium">
                        {yearBooks.length} {yearBooks.length === 1 ? 'libro' : 'libri'}
                      </span>
                    </div>
                    {year === 'Senza data' && (
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Imposta la data di lettura modificando il libro per inserirlo nel rispettivo anno
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {avgRating && (
                    <div className="hidden sm:flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-medium">
                      <Star size={13} className="fill-amber-400" />
                      <span>{avgRating} media</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-stone-700/50 transition-colors"
                    aria-label={isCollapsed ? 'Espandi anno' : 'Comprimi anno'}
                  >
                    {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  </button>
                </div>
              </div>

              {/* Griglia libri dell'anno */}
              {!isCollapsed && (
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {yearBooks.map((book) => (
                      <BookCard
                        key={book.id}
                        book={book}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                        onEdit={onEdit}
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
