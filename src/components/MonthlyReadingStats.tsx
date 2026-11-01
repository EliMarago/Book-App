import { useState, useMemo } from 'react';
import {
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  BookCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { Book } from '@/lib/supabase';

const MONTH_NAMES = [
  { short: 'Gen', full: 'Gennaio' },
  { short: 'Feb', full: 'Febbraio' },
  { short: 'Mar', full: 'Marzo' },
  { short: 'Apr', full: 'Aprile' },
  { short: 'Mag', full: 'Maggio' },
  { short: 'Giu', full: 'Giugno' },
  { short: 'Lug', full: 'Luglio' },
  { short: 'Ago', full: 'Agosto' },
  { short: 'Set', full: 'Settembre' },
  { short: 'Ott', full: 'Ottobre' },
  { short: 'Nov', full: 'Novembre' },
  { short: 'Dic', full: 'Dicembre' },
];

interface MonthlyReadingStatsProps {
  books: Book[];
  selectedYear: string;
  onSelectYear?: (year: string) => void;
  selectedMonth: number | null; // 0..11 o null se nessun filtro mensile attivo
  onSelectMonth: (month: number | null) => void;
  availableYears?: string[];
}

export function MonthlyReadingStats({
  books,
  selectedYear,
  onSelectYear,
  selectedMonth,
  onSelectMonth,
  availableYears = [],
}: MonthlyReadingStatsProps) {
  const now = new Date();
  const currentRealYear = now.getFullYear();
  const currentRealMonth = now.getMonth();

  // Menu a scomparsa / nascosto: aperto se l'utente lo espande o se c'è un filtro attivo
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(selectedMonth !== null);

  // Determina quale anno analizzare
  const activeYearNum = useMemo(() => {
    if (selectedYear && selectedYear !== 'all' && selectedYear !== 'Senza data') {
      const parsed = parseInt(selectedYear, 10);
      if (!isNaN(parsed)) return parsed;
    }
    const numericYears = availableYears
      .map((y) => parseInt(y, 10))
      .filter((y) => !isNaN(y))
      .sort((a, b) => b - a);

    if (numericYears.includes(currentRealYear)) return currentRealYear;
    return numericYears[0] || currentRealYear;
  }, [selectedYear, availableYears, currentRealYear]);

  // Calcola i libri letti per ciascun mese dell'anno attivo
  const monthlyData = useMemo(() => {
    const months = MONTH_NAMES.map((m, idx) => ({
      index: idx,
      shortName: m.short,
      fullName: m.full,
      books: [] as Book[],
      pages: 0,
    }));

    books.forEach((book) => {
      if (!book.read_at) return;
      const d = new Date(book.read_at);
      if (isNaN(d.getTime())) return;
      if (d.getFullYear() === activeYearNum) {
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          months[m].books.push(book);
          months[m].pages += book.pages || 0;
        }
      }
    });

    return months;
  }, [books, activeYearNum]);

  // Totali dell'anno
  const totalYearBooks = useMemo(
    () => monthlyData.reduce((acc, m) => acc + m.books.length, 0),
    [monthlyData]
  );

  // Mese con più libri letti
  const bestMonth = useMemo(() => {
    let best = monthlyData[0];
    monthlyData.forEach((m) => {
      if (m.books.length > best.books.length) {
        best = m;
      }
    });
    return best && best.books.length > 0 ? best : null;
  }, [monthlyData]);

  // Dati per il mese corrente
  const currentMonthData = monthlyData[currentRealMonth];
  const isSelectedActive = selectedMonth !== null;

  const handleMonthClick = (monthIndex: number | null) => {
    if (monthIndex === null || selectedMonth === monthIndex) {
      onSelectMonth(null);
    } else {
      onSelectMonth(monthIndex);
    }
  };

  return (
    <div className="bg-stone-850/60 light:bg-white border border-stone-800 light:border-stone-200/90 rounded-2xl p-3 sm:p-4 shadow-xs transition-all space-y-2.5">
      {/* Barra Compatta: Conteggio del Mese + Tasto Menu Nascosto / Scorrevole */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 light:bg-emerald-100 border border-emerald-500/30 light:border-emerald-300 flex items-center justify-center text-emerald-400 light:text-emerald-700 shrink-0">
            <BookCheck size={16} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold text-stone-100 light:text-stone-900">
                {isSelectedActive ? (
                  <>
                    Filtro:{' '}
                    <span className="text-emerald-400 light:text-emerald-700 font-bold">
                      {MONTH_NAMES[selectedMonth].full} {activeYearNum}
                    </span>
                  </>
                ) : (
                  <>
                    Questo Mese ({MONTH_NAMES[currentRealMonth].full}):{' '}
                    <span className="text-emerald-400 light:text-emerald-700 font-bold">
                      {currentMonthData.books.length}{' '}
                      {currentMonthData.books.length === 1 ? 'libro letto' : 'libri letti'}
                    </span>
                  </>
                )}
              </span>

              {/* Dettagli pagine e record compatti */}
              {!isSelectedActive && currentMonthData.pages > 0 && (
                <span className="hidden sm:inline-flex text-[11px] font-medium text-stone-400 light:text-stone-600 items-center gap-1">
                  • <Layers size={11} className="text-emerald-400" /> {currentMonthData.pages} pag.
                </span>
              )}

              {bestMonth && (
                <span className="hidden md:inline-flex text-[11px] font-medium text-amber-400/90 light:text-amber-700 items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 light:bg-amber-100 border border-amber-500/20">
                  <Sparkles size={11} /> Record: {bestMonth.shortName} ({bestMonth.books.length})
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-400 light:text-stone-500 truncate">
              {totalYearBooks} libri completati nel {activeYearNum}
            </p>
          </div>
        </div>

        {/* Pulsanti Azione: Rimuovi Filtro (se attivo) + Toggle Menu Scorrevole Nascosto */}
        <div className="flex items-center gap-2 shrink-0">
          {isSelectedActive && (
            <button
              type="button"
              onClick={() => onSelectMonth(null)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 light:text-emerald-800 bg-emerald-500/20 hover:bg-emerald-500/30 light:bg-emerald-100 light:hover:bg-emerald-200 border border-emerald-500/40 light:border-emerald-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer active:scale-95"
              title="Rimuovi filtro mensile"
            >
              <X size={12} />
              <span>Rimuovi filtro</span>
            </button>
          )}

          {/* Toggle Menu Nascosto / Scorrevole */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer active:scale-95 shadow-xs ${
              isMenuOpen
                ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-amber-500/20'
                : 'bg-stone-800 light:bg-stone-100 text-stone-300 light:text-stone-700 border-stone-700 light:border-stone-300 hover:text-stone-100 light:hover:text-stone-950'
            }`}
          >
            <Calendar size={13} />
            <span>{isMenuOpen ? 'Nascondi mesi' : 'Filtra per mese'}</span>
            {isMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Menu Scorrevole Orizzontale (A Scomparsa) */}
      {isMenuOpen && (
        <div className="pt-2 border-t border-stone-800/80 light:border-stone-200 animate-in fade-in slide-in-from-top-2 duration-200 space-y-2">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-[11px] font-medium text-stone-400 light:text-stone-600">
              Scorri orizzontalmente e tocca un mese per filtrare:
            </span>
            {availableYears.length > 1 && onSelectYear && (
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-stone-500">Anno:</span>
                {availableYears
                  .filter((y) => y !== 'Senza data')
                  .slice(0, 4)
                  .map((yr) => {
                    const isYrActive = String(activeYearNum) === yr;
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          onSelectYear(yr);
                          onSelectMonth(null);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                          isYrActive
                            ? 'bg-amber-500 text-stone-950 font-bold'
                            : 'text-stone-400 light:text-stone-600 hover:text-stone-200'
                        }`}
                      >
                        {yr}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Barra Scorrevole Orizzontale dei 12 Mesi */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-stone-700 -mx-1 px-1">
            {/* Pill 'Tutti i mesi' */}
            <button
              type="button"
              onClick={() => handleMonthClick(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all cursor-pointer shrink-0 active:scale-95 ${
                selectedMonth === null
                  ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-bold shadow-xs'
                  : 'bg-stone-800/80 light:bg-stone-100 text-stone-300 light:text-stone-700 border-stone-700/80 light:border-stone-300 hover:text-stone-100'
              }`}
            >
              Tutti i mesi ({totalYearBooks})
            </button>

            {/* Pill per ciascuno dei 12 mesi */}
            {monthlyData.map((m) => {
              const isSelected = selectedMonth === m.index;
              const isCurrent = activeYearNum === currentRealYear && m.index === currentRealMonth;
              const hasBooks = m.books.length > 0;

              return (
                <button
                  key={m.index}
                  type="button"
                  onClick={() => handleMonthClick(m.index)}
                  className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95 ${
                    isSelected
                      ? 'bg-emerald-500 text-stone-950 border-emerald-400 font-bold shadow-xs ring-1 ring-emerald-400/50'
                      : isCurrent
                      ? 'bg-amber-500/15 light:bg-amber-100 text-amber-300 light:text-amber-900 border-amber-500/40 light:border-amber-300 hover:bg-amber-500/25'
                      : hasBooks
                      ? 'bg-stone-800/80 light:bg-stone-100 text-stone-200 light:text-stone-800 border-stone-700/80 light:border-stone-300 hover:bg-stone-750 light:hover:bg-stone-200'
                      : 'bg-stone-900/40 light:bg-stone-50 text-stone-500 light:text-stone-400 border-stone-800/60 light:border-stone-200/60 hover:bg-stone-800/40'
                  }`}
                  title={`${m.fullName} ${activeYearNum}: ${m.books.length} libri, ${m.pages} pagine`}
                >
                  <span className="font-semibold">{m.shortName}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-bold ${
                      isSelected
                        ? 'bg-stone-950/25 text-stone-950'
                        : hasBooks
                        ? 'bg-stone-700/70 light:bg-stone-200 text-stone-200 light:text-stone-800'
                        : 'bg-stone-800/50 light:bg-stone-200/60 text-stone-500'
                    }`}
                  >
                    {m.books.length}
                  </span>
                  {hasBooks && m.pages > 0 && (
                    <span className={`text-[9px] ${isSelected ? 'text-stone-900' : 'text-stone-400 light:text-stone-500'}`}>
                      {m.pages}p
                    </span>
                  )}
                  {isCurrent && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 light:bg-amber-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Banner discreto di riepilogo se c'è un filtro attivo */}
          {isSelectedActive && (
            <div className="flex items-center justify-between gap-2 bg-emerald-500/10 light:bg-emerald-50 border border-emerald-500/20 light:border-emerald-200 px-3 py-1.5 rounded-xl text-xs text-emerald-300 light:text-emerald-800">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400 light:text-emerald-600" />
                Filtro attivo: visualizzazione limitata a <strong>{MONTH_NAMES[selectedMonth].full} {activeYearNum}</strong> ({monthlyData[selectedMonth].books.length} {monthlyData[selectedMonth].books.length === 1 ? 'libro' : 'libri'})
              </span>
              <button
                type="button"
                onClick={() => onSelectMonth(null)}
                className="text-[11px] font-semibold text-emerald-400 light:text-emerald-700 hover:underline cursor-pointer"
              >
                Annulla
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
