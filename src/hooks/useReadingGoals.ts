import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ReadingGoals = Record<string, number>;

const STORAGE_KEY = 'reading_goals';

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

  const refreshGoals = useCallback(async () => {
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
    refreshGoals();
    const onFocus = () => {
      if (document.visibilityState === 'visible') refreshGoals();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
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
