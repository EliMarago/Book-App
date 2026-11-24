import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, getFreshUserDeduped } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

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
  const { user, authReady } = useAuth();
  const [goals, setGoals] = useState<ReadingGoals>(() => getStoredGoals());
  const goalsRef = useRef<ReadingGoals>(goals);

  const lastRefreshRef = useRef<number>(0);

  const refreshGoals = useCallback(async (force = false) => {
    if (!force && Date.now() - lastRefreshRef.current < GOALS_SYNC_COOLDOWN_MS) {
      return;
    }
    try {
      const { data, error } = await getFreshUserDeduped(force);
      if (error || !data.user) return;
      lastRefreshRef.current = Date.now();
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

  // Identa subito dai metadati presenti nella sessione utente corrente (es. appena effettuato il login)
  useEffect(() => {
    const metaGoals = user?.user_metadata?.reading_goals as ReadingGoals | undefined;
    if (metaGoals && Object.keys(metaGoals).length > 0) {
      goalsRef.current = metaGoals;
      storeGoals(metaGoals);
      setGoals(metaGoals);
    }
  }, [user]);

  useEffect(() => {
    if (!authReady || !user) return;
    if (navigator.onLine) {
      refreshGoals(true);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) refreshGoals(false);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authReady, user?.id, refreshGoals]);

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
