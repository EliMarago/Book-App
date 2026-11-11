import { useMemo, useState, useEffect, useId } from 'react';
import {
  Target,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  X,
  PartyPopper,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  Gauge,
  BookOpen,
} from 'lucide-react';
import type { Book } from '@/lib/supabase';
import type { ReadingGoals } from '@/hooks/useReadingGoals';
import { fireDoubleConfetti } from './Confetti';

interface ReadingChallengeProps {
  books: Book[];
  goals: ReadingGoals;
  onSetGoal: (year: number, target: number | null) => void;
}

function countCompletedInYear(books: Book[], year: number) {
  return books.filter((b) => {
    if (b.status !== 'completed' || !b.read_at) return false;
    const d = new Date(b.read_at);
    return !isNaN(d.getTime()) && d.getFullYear() === year;
  }).length;
}

/** Primo anno disponibile per la sfida: l'app è nata nel 2026 */
const FIRST_CHALLENGE_YEAR = 2026;

/** Ciclo compatto di altezze per le costole dei libri sulla mensola */
const SPINE_HEIGHT_CYCLE = [11, 16, 13, 17, 14, 16, 12, 15, 13, 16, 12, 15];

export function ReadingChallenge({ books, goals, onSetGoal }: ReadingChallengeProps) {
  const currentYear = new Date().getFullYear();
  const hasYearNavigation = currentYear > FIRST_CHALLENGE_YEAR;
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const gradientId = useId().replace(/:/g, '');

  const goal = goals[String(year)] ?? 0;
  const read = useMemo(() => countCompletedInYear(books, year), [books, year]);
  const percent = goal > 0 ? Math.min(100, Math.round((read / goal) * 100)) : 0;
  const remaining = Math.max(0, goal - read);
  const extra = Math.max(0, read - goal);
  const completed = goal > 0 && read >= goal;

  // Coriandoli al raggiungimento dell'obiettivo
  useEffect(() => {
    if (!completed || goal <= 0) return;
    const storageKey = `bookapp_rc_celebrated_${year}_${goal}`;
    try {
      const times = parseInt(localStorage.getItem(storageKey) || '0', 10);
      if (times < 2) {
        localStorage.setItem(storageKey, String(times + 1));
        fireDoubleConfetti();
      }
    } catch {
      // ignore
    }
  }, [completed, year, goal]);

  // Giorni rimasti alla fine dell'anno
  const daysLeft = useMemo(() => {
    if (year !== currentYear) return 0;
    const now = new Date();
    const end = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
    return Math.max(0, Math.ceil((end - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [year, currentYear]);

  // Ritmo
  const pace = useMemo(() => {
    if (goal <= 0 || year !== currentYear) return null;
    const now = new Date();
    const start = new Date(year, 0, 1).getTime();
    const end = new Date(year + 1, 0, 1).getTime();
    const fraction = (now.getTime() - start) / (end - start);
    const expected = goal * fraction;
    const diff = Math.round(read - expected);
    return { diff };
  }, [goal, year, currentYear, read]);

  // Media libri al mese
  const mediaPerMonth = useMemo(() => {
    if (read <= 0) return '0,0';
    const now = new Date();
    if (year === currentYear) {
      const elapsedMonths = Math.max(0.5, now.getMonth() + now.getDate() / 30);
      const avg = read / elapsedMonths;
      return avg.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    const avg = read / 12;
    return avg.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }, [read, year, currentYear]);

  // Costole mini dei libri renderizzate sulla mensola
  const spines = useMemo(() => {
    if (goal <= 0) return [];
    const maxSpines = 16;
    const count = Math.min(goal, maxSpines);
    const items: { filled: boolean; height: number }[] = [];
    for (let i = 0; i < count; i++) {
      const isFilled = goal <= maxSpines ? i < read : (i + 1) / count <= read / goal;
      const h = SPINE_HEIGHT_CYCLE[i % SPINE_HEIGHT_CYCLE.length];
      items.push({ filled: isFilled, height: h });
    }
    return items;
  }, [goal, read]);

  const startEditing = () => {
    setInput(goal > 0 ? String(goal) : '');
    setEditing(true);
  };

  const save = () => {
    const n = parseInt(input, 10);
    onSetGoal(year, !isNaN(n) && n > 0 ? n : null);
    setEditing(false);
  };

  // Anello di progresso SVG
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <section
      aria-labelledby="reading-challenge-title"
      className="relative overflow-hidden mb-3.5 sm:mb-4 rounded-2xl border border-emerald-900/40 light:border-emerald-200/80 bg-gradient-to-br from-[#121c16] via-[#0f1712] to-[#0a100c] light:from-white light:via-emerald-50/40 light:to-stone-50 shadow-md light:shadow-emerald-950/5 p-3.5 sm:p-4 transition-all"
    >
      {/* Bagliori soffusi d'atmosfera smeraldo */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-500/10 light:bg-emerald-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-emerald-600/10 light:bg-emerald-200/20 blur-2xl" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/30 light:via-emerald-400/50 to-transparent" />

      {/* Blocco Superiore: Rotella a sinistra, Info al centro, e su Desktop le 3 card a destra */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-5">
        <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
          {/* Anello Circolare ad alto contrasto */}
          <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
            <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90 overflow-visible">
              <defs>
                <linearGradient id={`rc-ring-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>

              {/* Traccia di fondo */}
              <circle
                cx="38"
                cy="38"
                r={radius}
                fill="none"
                strokeWidth="5"
                className="stroke-[#192b20] light:stroke-emerald-100"
              />

              {/* Arco smeraldo brillante */}
              <circle
                cx="38"
                cy="38"
                r={radius}
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                stroke={`url(#rc-ring-${gradientId})`}
                strokeDasharray={circumference}
                strokeDashoffset={goal > 0 ? offset : circumference}
                className="transition-[stroke-dashoffset] duration-700 ease-out drop-shadow-[0_0_6px_rgba(52,211,153,0.35)]"
              />
            </svg>

            {/* Testo proporzionato perfettamente centrato dentro al cerchio */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none p-1">
              {goal > 0 ? (
                <>
                  <span className="font-sans text-xs sm:text-base font-black tracking-tight tabular-nums text-stone-100 light:text-stone-900 leading-none">
                    {percent}%
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-bold text-stone-400 light:text-stone-500 uppercase tracking-widest mt-0.5">
                    {completed ? 'FATTO' : 'IN CORSO'}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-sans text-xs sm:text-base font-bold tabular-nums text-stone-400 light:text-stone-500 leading-none">
                    0%
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-bold text-stone-400 light:text-stone-500 uppercase tracking-widest mt-0.5">
                    IMPOSTA
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Centro: 3 righe ben distinte, ordinate e ariose */}
          <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
            {/* Riga 1: Titolo Sfida + frecce anno */}
            <div className="flex items-center justify-between gap-2">
              <h2
                id="reading-challenge-title"
                className="font-serif text-sm sm:text-base font-bold text-stone-100 light:text-stone-900 tracking-tight truncate"
              >
                Sfida di Lettura {year}
              </h2>

              {hasYearNavigation && (
                <div className="flex items-center shrink-0 -mr-1">
                  <button
                    id="challenge-prev-year"
                    onClick={() => {
                      setYear((y) => Math.max(FIRST_CHALLENGE_YEAR, y - 1));
                      setEditing(false);
                    }}
                    disabled={year <= FIRST_CHALLENGE_YEAR}
                    className="p-0.5 rounded text-stone-400 light:text-stone-500 hover:text-stone-200 light:hover:text-stone-900 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Anno precedente"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    id="challenge-next-year"
                    onClick={() => {
                      setYear((y) => Math.min(currentYear, y + 1));
                      setEditing(false);
                    }}
                    disabled={year >= currentYear}
                    className="p-0.5 rounded text-stone-400 light:text-stone-500 hover:text-stone-200 light:hover:text-stone-900 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Anno successivo"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              /* Modalità modifica obiettivo */
              <div className="flex items-center gap-1.5 flex-wrap py-0.5">
                <span className="text-xs text-stone-300 light:text-stone-700 font-medium">
                  Voglio leggere
                </span>
                <input
                  id="challenge-goal-input"
                  type="number"
                  min="1"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') save();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  autoFocus
                  placeholder="12"
                  className="w-16 px-2 py-0.5 bg-stone-900 light:bg-white border border-emerald-500/60 rounded-md font-serif font-bold text-xs text-stone-100 light:text-stone-900 outline-none focus:ring-1 focus:ring-emerald-500 text-center tabular-nums"
                />
                <span className="text-xs text-stone-300 light:text-stone-700 font-medium">
                  libri
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    id="challenge-goal-save"
                    onClick={save}
                    className="px-2.5 py-0.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-stone-950 font-bold text-[11px] transition-colors cursor-pointer active:scale-95 flex items-center gap-1 shadow-xs"
                    aria-label="Salva obiettivo"
                  >
                    <Check size={11} className="stroke-[2.5]" />
                    <span>Salva</span>
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="p-1 rounded text-stone-400 hover:text-stone-200 light:hover:text-stone-800 transition-colors cursor-pointer"
                    aria-label="Annulla"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ) : goal > 0 ? (
              <>
                {/* Riga 2: Conteggio grande + su X libri + matita + badge stato (ordinati sulla loro riga) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-serif text-lg sm:text-xl font-extrabold text-emerald-400 light:text-emerald-600 leading-none tabular-nums">
                    {read}
                  </span>
                  <span className="text-stone-400 light:text-stone-500 text-xs font-medium">
                    su {goal} {goal === 1 ? 'libro' : 'libri'}
                  </span>
                  <button
                    id="challenge-goal-edit"
                    onClick={startEditing}
                    className="p-0.5 rounded text-stone-500 hover:text-stone-300 light:hover:text-stone-800 transition-colors cursor-pointer self-center"
                    aria-label="Modifica obiettivo"
                    title="Modifica traguardo libri"
                  >
                    <Pencil size={11} />
                  </button>

                  {completed ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-semibold text-emerald-400 light:text-emerald-700 ml-auto xs:ml-1 whitespace-nowrap">
                      <PartyPopper size={12} className="shrink-0" />
                      <span>
                        <span className="hidden xs:inline">Obiettivo </span>raggiunto (+{extra})
                      </span>
                    </span>
                  ) : pace ? (
                    pace.diff > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-semibold text-emerald-400 light:text-emerald-700 ml-auto xs:ml-1 whitespace-nowrap">
                        <TrendingUp size={11} className="shrink-0 stroke-[2.5]" />
                        <span>+{pace.diff} anticipo</span>
                      </span>
                    ) : pace.diff < 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-semibold text-rose-400 light:text-rose-700 ml-auto xs:ml-1 whitespace-nowrap">
                        <TrendingDown size={11} className="shrink-0 stroke-[2.5]" />
                        <span>{Math.abs(pace.diff)} ritardo</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] font-semibold text-sky-400 light:text-sky-700 ml-auto xs:ml-1 whitespace-nowrap">
                        <Clock size={11} className="shrink-0" />
                        <span>In linea</span>
                      </span>
                    )
                  ) : null}
                </div>

                {/* Riga 3: Mensolina con costole dei libri SU UNA RIGA DEDICATA (non più schiacciata sul testo!) */}
                <div className="pt-0.5 flex items-end">
                  <div className="flex items-end gap-[3px] shrink-0">
                    {spines.map((spine, idx) => (
                      <div
                        key={idx}
                        style={{ height: `${spine.height}px` }}
                        className={`w-2 sm:w-2.5 rounded-t-[2px] transition-all duration-300 ${
                          spine.filled
                            ? 'bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 border-t border-x border-emerald-300/40 shadow-xs'
                            : 'bg-stone-800/40 light:bg-stone-200/60 border border-dashed border-stone-700/70 light:border-stone-300'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Linea orizzontale della mensola che si estende a destra */}
                  <div className="flex-1 min-w-[14px] h-[1.5px] bg-stone-700/60 light:bg-stone-300 mb-[1px]" />

                  {/* Etichetta extra o mancanti */}
                  {completed && extra > 0 ? (
                    <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-400/90 light:text-emerald-700 shrink-0 ml-1.5 mb-[1px]">
                      +{extra} extra
                    </span>
                  ) : remaining > 0 ? (
                    <span className="text-[10px] sm:text-[11px] font-medium text-stone-400 light:text-stone-500 shrink-0 ml-1.5 mb-[1px]">
                      {remaining} mancanti
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              /* Nessun obiettivo impostato */
              <div className="flex items-center gap-2">
                <p className="text-xs text-stone-300 light:text-stone-600 truncate">
                  {read > 0 ? `Hai letto ${read} libri nel ${year}.` : `Quanti libri vuoi leggere nel ${year}?`}
                </p>
                <button
                  id="challenge-goal-set"
                  onClick={startEditing}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-stone-950 transition-all cursor-pointer active:scale-95 shadow-xs"
                >
                  <Target size={11} />
                  Imposta
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Su desktop (md+): Le 3 card metriche orizzontali compatte sulla destra */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          {/* Card 1: RIMASTI */}
          <div className="bg-[#121c16]/80 light:bg-white border border-emerald-950/70 light:border-emerald-200/80 rounded-lg px-2.5 py-1 flex flex-col justify-center shadow-xs min-w-[84px]">
            <div className="flex items-center gap-1 text-[8.5px] font-bold text-stone-400 light:text-stone-500 uppercase tracking-wider">
              <Calendar size={10} className="shrink-0 text-stone-400 light:text-stone-500" />
              <span>Rimasti</span>
            </div>
            <div className="mt-0.5 flex items-baseline">
              <span className="text-xs sm:text-sm font-bold font-serif text-stone-100 light:text-stone-900 tabular-nums">
                {daysLeft}
              </span>
              <span className="text-[10px] text-stone-400 light:text-stone-500 ml-0.5 font-medium">
                {daysLeft === 1 ? 'giorno' : 'giorni'}
              </span>
            </div>
          </div>

          {/* Card 2: RITMO */}
          <div className="bg-[#121c16]/80 light:bg-white border border-emerald-950/70 light:border-emerald-200/80 rounded-lg px-2.5 py-1 flex flex-col justify-center shadow-xs min-w-[90px]">
            <div className="flex items-center gap-1 text-[8.5px] font-bold text-stone-400 light:text-stone-500 uppercase tracking-wider">
              <Gauge size={10} className="shrink-0 text-stone-400 light:text-stone-500" />
              <span>Ritmo</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              {completed ? (
                <>
                  <TrendingUp size={11} className="text-emerald-400 light:text-emerald-600 stroke-[2.5]" />
                  <span className="text-xs font-bold text-emerald-400 light:text-emerald-600 whitespace-nowrap">
                    {extra > 0 ? `+${extra} anticipo` : 'Completato'}
                  </span>
                </>
              ) : goal <= 0 ? (
                <span className="text-xs font-medium text-stone-500">—</span>
              ) : pace ? (
                pace.diff > 0 ? (
                  <>
                    <TrendingUp size={11} className="text-emerald-400 light:text-emerald-600 stroke-[2.5]" />
                    <span className="text-xs font-bold text-emerald-400 light:text-emerald-600 whitespace-nowrap">
                      +{pace.diff} anticipo
                    </span>
                  </>
                ) : pace.diff < 0 ? (
                  <>
                    <TrendingDown size={11} className="text-rose-400 light:text-rose-600 stroke-[2.5]" />
                    <span className="text-xs font-bold text-rose-400 light:text-rose-600 whitespace-nowrap">
                      {Math.abs(pace.diff)} ritardo
                    </span>
                  </>
                ) : (
                  <>
                    <Clock size={11} className="text-sky-400 light:text-sky-600" />
                    <span className="text-xs font-bold text-sky-400 light:text-sky-600">
                      In linea
                    </span>
                  </>
                )
              ) : (
                <span className="text-xs font-medium text-stone-500">—</span>
              )}
            </div>
          </div>

          {/* Card 3: MEDIA */}
          <div className="bg-[#121c16]/80 light:bg-white border border-emerald-950/70 light:border-emerald-200/80 rounded-lg px-2.5 py-1 flex flex-col justify-center shadow-xs min-w-[84px]">
            <div className="flex items-center gap-1 text-[8.5px] font-bold text-stone-400 light:text-stone-500 uppercase tracking-wider">
              <BookOpen size={10} className="shrink-0 text-stone-400 light:text-stone-500" />
              <span>Media</span>
            </div>
            <div className="mt-0.5 flex items-baseline">
              <span className="text-xs sm:text-sm font-bold font-serif text-stone-100 light:text-stone-900 tabular-nums">
                {mediaPerMonth}
              </span>
              <span className="text-[10px] text-stone-400 light:text-stone-500 ml-0.5 font-medium">
                libri/mese
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Su mobile (< md): le 3 card metriche hanno una riga dedicata e ariosa */}
      <div className="grid grid-cols-3 gap-2 mt-2.5 md:hidden">
        {/* Card 1: RIMASTI */}
        <div className="bg-[#121c16]/80 light:bg-white border border-emerald-950/70 light:border-emerald-200/80 rounded-lg px-2 py-1.5 flex flex-col justify-center shadow-xs">
          <div className="flex items-center gap-1 text-[8.5px] font-bold text-stone-400 light:text-stone-500 uppercase tracking-wider">
            <Calendar size={10} className="shrink-0 text-stone-400 light:text-stone-500" />
            <span>Rimasti</span>
          </div>
          <div className="mt-0.5 flex items-baseline">
            <span className="text-xs sm:text-sm font-bold font-serif text-stone-100 light:text-stone-900 tabular-nums">
              {daysLeft}
            </span>
            <span className="text-[10px] text-stone-400 light:text-stone-500 ml-0.5 font-medium">
              {daysLeft === 1 ? 'giorno' : 'giorni'}
            </span>
          </div>
        </div>

        {/* Card 2: RITMO */}
        <div className="bg-[#121c16]/80 light:bg-white border border-emerald-950/70 light:border-emerald-200/80 rounded-lg px-1.5 sm:px-2 py-1.5 flex flex-col justify-center shadow-xs">
          <div className="flex items-center gap-1 text-[8.5px] font-bold text-stone-400 light:text-stone-500 uppercase tracking-wider">
            <Gauge size={10} className="shrink-0 text-stone-400 light:text-stone-500" />
            <span>Ritmo</span>
          </div>
          <div className="mt-0.5 flex items-center gap-0.5">
            {completed ? (
              <>
                <TrendingUp size={11} className="text-emerald-400 light:text-emerald-600 stroke-[2.5] shrink-0" />
                <span className="text-[10px] sm:text-xs font-bold text-emerald-400 light:text-emerald-600 tracking-tight whitespace-nowrap">
                  {extra > 0 ? `+${extra} anticipo` : 'Completato'}
                </span>
              </>
            ) : goal <= 0 ? (
              <span className="text-xs font-medium text-stone-500">—</span>
            ) : pace ? (
              pace.diff > 0 ? (
                <>
                  <TrendingUp size={11} className="text-emerald-400 light:text-emerald-600 stroke-[2.5] shrink-0" />
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-400 light:text-emerald-600 tracking-tight whitespace-nowrap">
                    +{pace.diff} anticipo
                  </span>
                </>
              ) : pace.diff < 0 ? (
                <>
                  <TrendingDown size={11} className="text-rose-400 light:text-rose-600 stroke-[2.5] shrink-0" />
                  <span className="text-[10px] sm:text-xs font-bold text-rose-400 light:text-rose-600 tracking-tight whitespace-nowrap">
                    {Math.abs(pace.diff)} ritardo
                  </span>
                </>
              ) : (
                <>
                  <Clock size={11} className="text-sky-400 light:text-sky-600 shrink-0" />
                  <span className="text-[10px] sm:text-xs font-bold text-sky-400 light:text-sky-600 tracking-tight whitespace-nowrap">
                    In linea
                  </span>
                </>
              )
            ) : (
              <span className="text-xs font-medium text-stone-500">—</span>
            )}
          </div>
        </div>

        {/* Card 3: MEDIA */}
        <div className="bg-[#121c16]/80 light:bg-white border border-emerald-950/70 light:border-emerald-200/80 rounded-lg px-2 py-1.5 flex flex-col justify-center shadow-xs">
          <div className="flex items-center gap-1 text-[8.5px] font-bold text-stone-400 light:text-stone-500 uppercase tracking-wider">
            <BookOpen size={10} className="shrink-0 text-stone-400 light:text-stone-500" />
            <span>Media</span>
          </div>
          <div className="mt-0.5 flex items-baseline">
            <span className="text-xs sm:text-sm font-bold font-serif text-stone-100 light:text-stone-900 tabular-nums">
              {mediaPerMonth}
            </span>
            <span className="text-[10px] text-stone-400 light:text-stone-500 ml-0.5 font-medium">
              libri/mese
            </span>
          </div>
        </div>
      </div>

      {/* Barra Azione e Messaggio Motivazionale: ben distanziata e bilanciata sia su mobile che desktop */}
      <div className="mt-2.5 pt-2 border-t border-emerald-950/60 light:border-emerald-100 flex items-center justify-between gap-2.5">
        <p className="text-[11px] sm:text-xs text-stone-300 light:text-stone-600 font-medium leading-snug flex-1 pr-1">
          {completed
            ? "Hai superato l'obiettivo! Vuoi alzare l'asticella?"
            : goal > 0
            ? `Continua così! Mancano ancora ${remaining} ${remaining === 1 ? 'libro' : 'libri'}.`
            : `Quanti libri vuoi leggere nel ${year}?`}
        </p>

        {completed ? (
          <button
            type="button"
            onClick={() => {
              const nextTarget = Math.max(read + 1, Math.ceil((read + 5) / 5) * 5);
              setInput(String(nextTarget));
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-stone-950 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <TrendingUp size={12} className="stroke-[2.5]" />
            <span>Alza l'obiettivo</span>
          </button>
        ) : goal > 0 ? (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-400 hover:bg-emerald-300 text-stone-950 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Pencil size={11} />
            <span>Modifica obiettivo</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-400 hover:bg-emerald-300 text-stone-950 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Target size={12} />
            <span>Imposta obiettivo</span>
          </button>
        )}
      </div>
    </section>
  );
}
