import { useMemo, useState, useEffect } from 'react';
import { Target, ChevronLeft, ChevronRight, Pencil, Check, X, PartyPopper, TrendingUp, TrendingDown } from 'lucide-react';
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

export function ReadingChallenge({ books, goals, onSetGoal }: ReadingChallengeProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  const goal = goals[String(year)] ?? 0;
  const read = useMemo(() => countCompletedInYear(books, year), [books, year]);
  const percent = goal > 0 ? Math.min(100, Math.round((read / goal) * 100)) : 0;
  const remaining = Math.max(0, goal - read);
  const completed = goal > 0 && read >= goal;

  // Coriandoli al raggiungimento dell'obiettivo: massimo due volte, poi basta
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

  // Ritmo: quanti libri "dovresti" aver letto a oggi (solo per l'anno in corso)
  const pace = useMemo(() => {
    if (goal <= 0 || year !== currentYear) return null;
    const now = new Date();
    const start = new Date(year, 0, 1).getTime();
    const end = new Date(year + 1, 0, 1).getTime();
    const fraction = (now.getTime() - start) / (end - start);
    const expected = goal * fraction;
    const diff = Math.round(read - expected);
    const daysLeft = Math.ceil((end - now.getTime()) / 86400000);
    return { diff, daysLeft };
  }, [goal, year, currentYear, read]);

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
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <section
      aria-labelledby="reading-challenge-title"
      className="relative overflow-hidden mb-6 rounded-2xl border border-amber-500/25 light:border-amber-300/70 bg-gradient-to-br from-amber-950/40 via-stone-850 to-stone-900 light:from-amber-50 light:via-white light:to-orange-50/40 p-4 sm:p-5 shadow-sm"
    >
      {/* Bagliore decorativo */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-500/10 light:bg-amber-300/20 blur-3xl" />

      <div className="relative flex items-center gap-4 sm:gap-5">
        {/* Anello progresso */}
        <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7" className="stroke-stone-700/60 light:stroke-stone-200" />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={goal > 0 ? offset : circumference}
              className={`transition-all duration-700 ease-out ${completed ? 'stroke-emerald-400 light:stroke-emerald-500' : 'stroke-amber-400 light:stroke-amber-500'}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {goal > 0 ? (
              <>
                <span className="text-lg sm:text-xl font-bold tabular-nums text-stone-100 light:text-stone-900 leading-none">{percent}%</span>
                <span className="text-[9px] sm:text-[10px] text-stone-400 light:text-stone-500 mt-0.5">completato</span>
              </>
            ) : (
              <Target size={26} className="text-amber-400/70 light:text-amber-600/70" />
            )}
          </div>
        </div>

        {/* Dettagli */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 id="reading-challenge-title" className="font-serif text-base sm:text-lg font-bold text-stone-100 light:text-stone-900 truncate">
              Sfida di Lettura {year}
            </h2>
            <div className="flex items-center shrink-0 -mr-1">
              <button
                id="challenge-prev-year"
                onClick={() => { setYear((y) => y - 1); setEditing(false); }}
                className="p-1 rounded-md text-stone-400 light:text-stone-500 hover:text-amber-300 light:hover:text-amber-700 hover:bg-stone-700/40 light:hover:bg-amber-100/60 transition-colors cursor-pointer"
                aria-label="Anno precedente"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                id="challenge-next-year"
                onClick={() => { setYear((y) => y + 1); setEditing(false); }}
                disabled={year >= currentYear + 1}
                className="p-1 rounded-md text-stone-400 light:text-stone-500 hover:text-amber-300 light:hover:text-amber-700 hover:bg-stone-700/40 light:hover:bg-amber-100/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Anno successivo"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {editing ? (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-stone-400 light:text-stone-600">Voglio leggere</span>
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
                placeholder="24"
                className="w-16 px-2 py-1 bg-stone-900 light:bg-white border border-amber-500/50 rounded-md text-sm text-stone-100 light:text-stone-900 outline-none focus:ring-1 focus:ring-amber-500"
              />
              <span className="text-xs text-stone-400 light:text-stone-600">libri</span>
              <button
                id="challenge-goal-save"
                onClick={save}
                className="p-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-stone-900 transition-colors cursor-pointer active:scale-95"
                aria-label="Salva obiettivo"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1.5 rounded-md text-stone-400 hover:text-stone-200 light:hover:text-stone-800 transition-colors cursor-pointer"
                aria-label="Annulla"
              >
                <X size={14} />
              </button>
            </div>
          ) : goal > 0 ? (
            <>
              <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                <span className="text-2xl font-bold text-amber-300 light:text-amber-700 leading-none">{read}</span>
                <span className="text-sm text-stone-400 light:text-stone-600">di {goal} libri</span>
                <button
                  id="challenge-goal-edit"
                  onClick={startEditing}
                  className="ml-1 p-1 rounded-md text-stone-500 hover:text-amber-300 light:hover:text-amber-700 hover:bg-stone-700/40 light:hover:bg-amber-100/60 transition-colors cursor-pointer self-center"
                  aria-label="Modifica obiettivo"
                  title="Modifica obiettivo"
                >
                  <Pencil size={12} />
                </button>
              </div>

              {/* Barra lineare */}
              <div className="mt-2 w-full h-1.5 rounded-full bg-stone-700/60 light:bg-stone-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${completed ? 'bg-emerald-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[11px] sm:text-xs">
                {completed ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 light:text-emerald-700">
                      <PartyPopper size={13} /> Obiettivo raggiunto!
                    </span>
                    {read > goal && (
                      <span className="text-emerald-400 light:text-emerald-700 font-medium">
                        (+{read - goal} in più)
                      </span>
                    )}
                    {pace && (
                      <span className="text-stone-400 light:text-stone-600">
                        {pace.daysLeft} {pace.daysLeft === 1 ? 'giorno rimasto' : 'giorni rimasti'}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-stone-400 light:text-stone-600">
                    Ancora <strong className="text-stone-200 light:text-stone-800">{remaining}</strong> {remaining === 1 ? 'libro' : 'libri'}
                    {pace && ` · ${pace.daysLeft} ${pace.daysLeft === 1 ? 'giorno rimasto' : 'giorni rimasti'}`}
                  </span>
                )}
                {pace && !completed && (
                  pace.diff >= 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 light:bg-emerald-50 text-emerald-400 light:text-emerald-700 border border-emerald-500/30 light:border-emerald-300 font-medium">
                      <TrendingUp size={11} />
                      {pace.diff === 0 ? 'In linea' : `${pace.diff} in anticipo`}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 light:bg-rose-50 text-rose-400 light:text-rose-700 border border-rose-500/30 light:border-rose-300 font-medium">
                      <TrendingDown size={11} />
                      {Math.abs(pace.diff)} in ritardo
                    </span>
                  )
                )}
              </div>
            </>
          ) : (
            <div className="mt-1.5">
              <p className="text-xs sm:text-sm text-stone-400 light:text-stone-600">
                {read > 0
                  ? `Hai letto ${read} ${read === 1 ? 'libro' : 'libri'} nel ${year}. Imposta un obiettivo!`
                  : `Quanti libri vuoi leggere nel ${year}?`}
              </p>
              <button
                id="challenge-goal-set"
                onClick={startEditing}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-900 transition-all cursor-pointer active:scale-95 shadow-sm shadow-amber-500/20"
              >
                <Target size={13} />
                Imposta obiettivo
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
