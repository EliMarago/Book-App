import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ReadingGoals = Record<string, number>;

const STORAGE_KEY = 'reading_goals';
const GOALS_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

function getStoredGoals(): ReadingGoals {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function storeGoals(goals: ReadingGoals) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch (e) {
    console.error('Errore nel salvataggio degli obiettivi in localStorage:', e);
  }
}

/**
 * Obiettivi di lettura annuali (Reading Challenge).
 * Salvati nei metadati dell'utente Supabase (sincronizzati tra dispositivi, nessuna migrazione richiesta)
 * con una copia in localStorage per il caricamento immediato / offline.
 */
export function useReadingGoals() {
  const [goals, setGoals] = useState<ReadingGoals>(() => getStoredGoals());
  const goalsRef = useRef<ReadingGoals>(goals);

  const lastRefreshRef = useRef<number>(0);

  const refreshGoals = useCallback(async (force = false) => {
    if (!force && Date.now() - lastRefreshRef.current < GOALS_SYNC_COOLDOWN_MS) {
      return;
    }
    lastRefreshRef.current = Date.now();
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return;
      const remote = data.user.user_metadata?.reading_goals as ReadingGoals | undefined;
      if (!remote) return;
      // I dati remoti sono la fonte di verità (sincronizzati tra dispositivi)
      goalsRef.current = remote;
      storeGoals(remote);
      setGoals(remote);
    } catch (err) {
      console.error('Errore nel recupero degli obiettivi di lettura:', err);
    }
  }, []);

  useEffect(() => {
    // Legge subito dalla sessione locale senza bloccare la rete all'avvio,
    // poi sincronizza in background da Supabase dopo il primo render
    supabase.auth.getSession().then(({ data }) => {
      const localMeta = data.session?.user?.user_metadata?.reading_goals as ReadingGoals | undefined;
      if (localMeta && Object.keys(goalsRef.current).length === 0) {
        goalsRef.current = localMeta;
        storeGoals(localMeta);
        setGoals(localMeta);
      }
    });

    const timer = setTimeout(() => {
      refreshGoals(true);
    }, 1500);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshGoals(false);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshGoals]);

  const setGoal = useCallback(async (year: number | string, target: number | null) => {
    const key = String(year);
    const next: ReadingGoals = { ...goalsRef.current };
    if (target && target > 0) {
      next[key] = Math.round(target);
    } else {
      delete next[key];
    }
    goalsRef.current = next;
    storeGoals(next);
    setGoals(next);

    try {
      const { error } = await supabase.auth.updateUser({ data: { reading_goals: next } });
      if (error) throw error;
    } catch (err) {
      console.error("Errore nel salvataggio dell'obiettivo su Supabase:", err);
    }
  }, []);

  return { goals, setGoal, refreshGoals };
}
