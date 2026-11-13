import { useMemo, useState, useEffect, useId, type ReactNode } from 'react';
import {
  Target,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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

function getCompletedBooksInYear(books: Book[], year: number) {
  return books
    .filter((b) => {
      if (b.status !== 'completed' || !b.read_at) return false;
      const d = new Date(b.read_at);
      return !isNaN(d.getTime()) && d.getFullYear() === year;
    })
    .sort((a, b) => new Date(a.read_at!).getTime() - new Date(b.read_at!).getTime());
}

/** Primo anno disponibile per la sfida: l'app è nata nel 2026 */
const FIRST_CHALLENGE_YEAR = 2026;

/** Altezze variegate per le costole dei libri sulla mensola */
const SPINE_HEIGHT_CYCLE = [21, 25, 22, 26, 20, 24, 21, 25, 22, 26, 20, 24];

function MetricCard({
  icon,
  label,
  compact = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-stone-700/50 light:border-orange-200/80 bg-black/25 light:bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
        compact ? 'px-2 py-1.5' : 'px-3 py-1.5'
      }`}
    >
      <div className="flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-wider text-stone-400 light:text-stone-500 whitespace-nowrap">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1 min-w-0">{children}</div>
    </div>
  );
}

export function ReadingChallenge({ books, goals, onSetGoal }: ReadingChallengeProps) {
  const currentYear = new Date().getFullYear();
  const hasYearNavigation = currentYear > FIRST_CHALLENGE_YEAR;
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  // Su mobile (< md) parte chiuso a menu nascosto e scorre verso il basso quando cliccato; su desktop sempre aperto
  const [open, setOpen] = useState(false);

  const gradientId = useId().replace(/:/g, '');
  const panelId = useId().replace(/:/g, '');

  const goal = goals[String(year)] ?? 0;
  const completedInYear = useMemo(() => getCompletedBooksInYear(books, year), [books, year]);
  const read = completedInYear.length;
  const percent = goal > 0 ? Math.min(100, Math.round((read / goal) * 100)) : 0;
  const remaining = Math.max(0, goal - read);
  const extra = Math.max(0, read - goal);
  const completed = goal > 0 && read >= goal;

  // Data di raggiungimento dell'obiettivo (es. "25 luglio")
  const reachedDateLabel = useMemo(() => {
    if (!completed || goal <= 0 || completedInYear.length < goal) return null;
    const targetBook = completedInYear[goal - 1];
    if (!targetBook?.read_at) return null;
    const d = new Date(targetBook.read_at);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  }, [completed, goal, completedInYear]);

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

  // Costole mini dei libri sulla mensola
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
    setOpen(true);
  };

  const save = () => {
    const n = parseInt(input, 10);
    onSetGoal(year, !isNaN(n) && n > 0 ? n : null);
    setEditing(false);
  };

  // Anello SVG
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const renderSecondMetricCard = (compact = false) => {
    return (
      <MetricCard icon={<Gauge size={10} />} label="Ritmo" compact={compact}>
        {goal <= 0 || (!completed && !pace) ? (
          <span className="text-xs font-medium text-stone-500">—</span>
        ) : completed ? (
          <>
            <TrendingUp size={12} className="text-orange-400 light:text-orange-600 stroke-[2.5] shrink-0 self-center" />
            <span className="text-xs font-bold text-orange-400 light:text-orange-600 whitespace-nowrap">
              {extra > 0 ? `+${extra} avanti` : 'Completato'}
            </span>
          </>
        ) : pace!.diff > 0 ? (
          <>
            <TrendingUp size={12} className="text-emerald-400 light:text-emerald-600 stroke-[2.5] shrink-0 self-center" />
            <span className="text-xs font-bold text-emerald-400 light:text-emerald-600 tabular-nums">
              {pace!.diff}
            </span>
            <span className="text-[11px] text-stone-400 light:text-stone-500 font-medium">avanti</span>
          </>
        ) : pace!.diff < 0 ? (
          <>
            <TrendingDown size={12} className="text-rose-400 light:text-rose-600 stroke-[2.5] shrink-0 self-center" />
            <span className="text-xs font-bold text-rose-400 light:text-rose-600 tabular-nums">
              {Math.abs(pace!.diff)}
            </span>
            <span className="text-[11px] text-stone-400 light:text-stone-500 font-medium">indietro</span>
          </>
        ) : (
          <>
            <Clock size={12} className="text-sky-400 light:text-sky-600 shrink-0 self-center" />
            <span className="text-xs font-bold text-sky-400 light:text-sky-600">In linea</span>
          </>
        )}
      </MetricCard>
    );
  };

  const yearNav = hasYearNavigation ? (
    <div className="flex items-center shrink-0">
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
  ) : null;

  return (
    <section
      aria-labelledby="reading-challenge-title"
      className="relative overflow-hidden mb-3.5 sm:mb-4 rounded-2xl border border-orange-500/30 light:border-orange-300/80 bg-gradient-to-br from-orange-950/50 via-stone-900 to-stone-900 light:from-orange-50 light:via-white light:to-amber-50/60 shadow-lg shadow-orange-950/30 light:shadow-orange-200/40 transition-colors"
    >
      {/* Bagliori caldi d'atmosfera */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-52 h-52 rounded-full bg-orange-400/15 light:bg-orange-300/35 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-14 -left-12 w-52 h-52 rounded-full bg-amber-500/10 light:bg-amber-200/40 blur-2xl" />

      {/* RIGA COMPATTA SOLO MOBILE (< md): clicca per aprire/chiudere verso il basso */}
      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            if (o) setEditing(false);
            return !o;
          });
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className="md:hidden relative z-10 w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded-2xl"
      >
        <div className="relative shrink-0 w-11 h-11 flex items-center justify-center">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90 overflow-visible">
            <defs>
              <linearGradient id={`rc-ring-m-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f7a21b" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
            <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7" className="stroke-stone-800 light:stroke-stone-200" />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              stroke={`url(#rc-ring-m-${gradientId})`}
              strokeDasharray={circumference}
              strokeDashoffset={goal > 0 ? offset : circumference}
              className="transition-[stroke-dashoffset] duration-700 ease-out [filter:drop-shadow(0_0_4px_rgba(249,115,22,0.45))]"
            />
          </svg>
          <span className="absolute font-sans text-[10.5px] font-bold tabular-nums text-stone-100 light:text-stone-900">
            {goal > 0 ? `${percent}%` : <Target size={15} className="text-orange-400 light:text-orange-600" />}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-serif text-base font-bold text-stone-100 light:text-stone-900 truncate">
            Sfida di Lettura {year}
          </div>
          <div className="text-xs text-stone-400 light:text-stone-600 truncate mt-0.5">
            {goal > 0 ? (
              completed ? (
                <span className="text-orange-400 light:text-orange-700 font-semibold">
                  Obiettivo raggiunto: {read} su {goal} (+{extra})
                </span>
              ) : (
                <>
                  <b className="text-orange-400 light:text-orange-600">{read}</b> su {goal} libri · ne mancano{' '}
                  <b className="text-stone-200 light:text-stone-800">{remaining}</b>
                </>
              )
            ) : read > 0 ? (
              `${read} letti nel ${year} · tocca per fissare un obiettivo`
            ) : (
              'Tocca per impostare un obiettivo'
            )}
          </div>
        </div>

        <ChevronDown
          size={18}
          className={`shrink-0 text-stone-400 light:text-stone-500 transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* CORPO COMPLETO: su desktop sempre visibile identico allo screenshot; su mobile scorre verso il basso */}
      <div
        id={panelId}
        className={`relative z-10 grid transition-[grid-template-rows,opacity] duration-300 ease-out md:grid-rows-[1fr] md:opacity-100 ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-3.5 pt-1 md:px-6 md:pt-4 md:pb-3">
            {yearNav && <div className="md:hidden flex justify-end -mt-1 mb-1">{yearNav}</div>}

            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
              {/* ANELLO GRANDE (su desktop, identico allo screenshot) */}
              <div className="hidden md:flex relative shrink-0 w-[92px] h-[92px] items-center justify-center">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90 overflow-visible">
                  <defs>
                    <linearGradient id={`rc-ring-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f7a21b" />
                      <stop offset="100%" stopColor="#ea580c" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="none"
                    strokeWidth="6"
                    className="stroke-stone-800 light:stroke-stone-200/90"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r={radius}
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    stroke={`url(#rc-ring-${gradientId})`}
                    strokeDasharray={circumference}
                    strokeDashoffset={goal > 0 ? offset : circumference}
                    className="transition-[stroke-dashoffset] duration-700 ease-out [filter:drop-shadow(0_0_5px_rgba(249,115,22,0.5))]"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none px-2">
                  <span className="font-sans text-lg font-bold tracking-tight tabular-nums text-stone-100 light:text-stone-900 leading-none">
                    {goal > 0 ? `${percent}%` : '0%'}
                  </span>
                  <span className="text-[7.5px] font-bold text-stone-400 light:text-stone-500 uppercase tracking-[0.08em] mt-1 leading-none">
                    {completed ? 'FATTO' : goal > 0 ? 'IN CORSO' : 'IMPOSTA'}
                  </span>
                </div>
              </div>

              {/* CENTRO: Titolo, Conteggio, Dorsini + "+20 extra" + linea mensola */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="hidden md:flex items-center gap-2">
                  <h2
                    id="reading-challenge-title"
                    className="font-serif text-lg font-bold text-stone-100 light:text-stone-900 tracking-tight truncate"
                  >
                    Sfida di Lettura {year}
                  </h2>
                  {yearNav}
                </div>

                {editing ? (
                  <div className="flex items-center gap-1.5 flex-wrap py-1.5">
                    <span className="text-xs text-stone-300 light:text-stone-700 font-medium">Voglio leggere</span>
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
                      className="w-16 px-2 py-0.5 bg-stone-900 light:bg-white border border-orange-500/60 rounded-md font-serif font-bold text-xs text-stone-100 light:text-stone-900 outline-none focus:ring-1 focus:ring-orange-500 text-center tabular-nums"
                    />
                    <span className="text-xs text-stone-300 light:text-stone-700 font-medium">libri</span>
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        id="challenge-goal-save"
                        onClick={save}
                        className="px-2.5 py-1 rounded-lg btn-amber text-stone-950 font-semibold text-[11px] transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
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
                    {/* Riga conteggio */}
                    <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                      <span className="font-serif text-2xl sm:text-[26px] font-extrabold text-orange-400 light:text-orange-600 leading-none tabular-nums">
                        {read}
                      </span>
                      <span className="text-xs sm:text-[13px] text-stone-400 light:text-stone-500 font-medium">
                        su {goal} {goal === 1 ? 'libro' : 'libri'}
                      </span>
                      <button
                        id="challenge-goal-edit"
                        onClick={startEditing}
                        className="p-0.5 rounded text-stone-500 hover:text-orange-400 light:hover:text-orange-600 transition-colors cursor-pointer self-center"
                        aria-label="Modifica obiettivo"
                        title="Modifica traguardo libri"
                      >
                        <Pencil size={12} />
                      </button>

                      {completed ? (
                        <span className="inline-flex items-center gap-1 text-xs sm:text-[13px] text-orange-400 light:text-orange-600 font-semibold ml-0.5">
                          <PartyPopper size={13} className="shrink-0" />
                          <span>
                            Obiettivo raggiunto{reachedDateLabel ? ` il ${reachedDateLabel}` : ''}
                          </span>
                        </span>
                      ) : remaining > 0 ? (
                        <span className="text-xs sm:text-[13px] text-stone-400 light:text-stone-600 ml-0.5">
                          ne mancano <b className="text-stone-100 light:text-stone-900 font-bold">{remaining}</b>
                        </span>
                      ) : null}
                    </div>

                    {/* Dorsini + "+20 extra" appoggiati sulla linea mensola (sotto, lunga fino a destra) */}
                    <div className="mt-10 sm:mt-12 flex items-end border-b-2 border-stone-600/70 light:border-stone-300/90">
                      <div className="flex items-end gap-1 shrink-0">
                        {spines.map((spine, idx) => (
                          <div
                            key={idx}
                            style={{ height: `${spine.height}px` }}
                            className={`w-3 sm:w-[15px] rounded-t-[3px] transition-all duration-300 ${
                              spine.filled
                                ? 'spine-amber'
                                : 'bg-stone-800/50 light:bg-stone-200/75 border border-dashed border-stone-700/70 light:border-stone-300/90'
                            }`}
                          />
                        ))}
                      </div>

                      {completed && extra > 0 && (
                        <span className="text-[11px] font-bold text-orange-400 light:text-orange-600 shrink-0 ml-2.5 mb-[3px] whitespace-nowrap">
                          +{extra} extra
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
                    <p className="text-xs text-stone-400 light:text-stone-600">
                      {read > 0 ? `Hai letto ${read} libri nel ${year}.` : `Quanti libri vuoi leggere nel ${year}?`}
                    </p>
                    <button
                      id="challenge-goal-set"
                      onClick={startEditing}
                      className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl btn-amber text-stone-950 transition-all cursor-pointer active:scale-95"
                    >
                      <Target size={12} />
                      Imposta obiettivo
                    </button>
                  </div>
                )}
              </div>

              {/* DESTRA SU DESKTOP: 3 card impilate (RIMASTI / RAGGIUNTO IL o RITMO / MEDIA) */}
              <div className="hidden md:flex flex-col gap-1.5 w-[165px] shrink-0">
                <MetricCard icon={<Calendar size={10} />} label="Rimasti">
                  <span className="text-sm font-bold font-serif text-stone-100 light:text-stone-900 tabular-nums">
                    {daysLeft}
                  </span>
                  <span className="text-[11px] text-stone-400 light:text-stone-500 font-medium">
                    {daysLeft === 1 ? 'giorno' : 'giorni'}
                  </span>
                </MetricCard>

                {renderSecondMetricCard(false)}

                <MetricCard icon={<BookOpen size={10} />} label="Media">
                  <span className="text-sm font-bold font-serif text-stone-100 light:text-stone-900 tabular-nums">
                    {mediaPerMonth}
                  </span>
                  <span className="text-[11px] text-stone-400 light:text-stone-500 font-medium">libri/mese</span>
                </MetricCard>
              </div>

              {/* MOBILE (< md): 3 card affiancate */}
              <div className="grid grid-cols-3 gap-2 md:hidden">
                <MetricCard icon={<Calendar size={10} />} label="Rimasti" compact>
                  <span className="text-xs font-bold font-serif text-stone-100 light:text-stone-900 tabular-nums">
                    {daysLeft}
                  </span>
                  <span className="text-[10px] text-stone-400 light:text-stone-500 font-medium truncate">
                    {daysLeft === 1 ? 'g.' : 'giorni'}
                  </span>
                </MetricCard>

                {renderSecondMetricCard(true)}

                <MetricCard icon={<BookOpen size={10} />} label="Media" compact>
                  <span className="text-xs font-bold font-serif text-stone-100 light:text-stone-900 tabular-nums">
                    {mediaPerMonth}
                  </span>
                  <span className="text-[10px] text-stone-400 light:text-stone-500 font-medium truncate">
                    <span className="sm:hidden">/mese</span>
                    <span className="hidden sm:inline">libri/mese</span>
                  </span>
                </MetricCard>
              </div>
            </div>

            {/* FOOTER IDENTICO ALLO SCREENSHOT */}
            {goal > 0 && (
              <div className="mt-3 pt-2.5 border-t border-orange-300/20 light:border-orange-300/50 flex items-center justify-between gap-3">
                <p className="text-[11px] sm:text-xs text-stone-400 light:text-stone-600 font-medium leading-snug">
                  {completed
                    ? "Hai già superato l'obiettivo di quest'anno. Vuoi alzare l'asticella?"
                    : `Continua così! Ti mancano ancora ${remaining} ${remaining === 1 ? 'libro' : 'libri'} per completare la sfida.`}
                </p>

                {completed ? (
                  <button
                    type="button"
                    onClick={() => {
                      const nextTarget = Math.max(read + 1, Math.ceil((read + 5) / 5) * 5);
                      setInput(String(nextTarget));
                      setEditing(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl btn-amber text-stone-950 font-semibold text-[11px] sm:text-xs transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    <TrendingUp size={13} />
                    <span>Alza l'obiettivo</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl border border-orange-500/35 light:border-orange-300 text-orange-300 light:text-orange-700 hover:bg-orange-500/10 font-semibold text-[11px] transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    <Pencil size={11} />
                    <span>Modifica</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
