import { useCallback, useEffect, useRef, useState } from 'react';
import { getFreshUserDeduped, type Book } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  getStoredWantPriority,
  saveStoredWantPriority,
  syncWantPriorityToSupabase,
  orderWantBooks,
  getStoredBestBooksOrder,
  saveStoredBestBooksOrder,
  syncBestBooksOrderToSupabase,
  orderBestBooks,
  reorderBookIds,
  shiftBookPosition,
} from '@/lib/bookPriority';

const PRIORITY_SYNC_COOLDOWN_MS = 2 * 60 * 1000;
const PUSH_DEBOUNCE_MS = 600;

export function useBookPriority() {
  const { user, authReady } = useAuth();
  const [priorityOrder, setPriorityOrder] = useState<string[]>(() => getStoredWantPriority());
  const priorityRef = useRef<string[]>(priorityOrder);

  const [bestBooksOrder, setBestBooksOrderState] = useState<string[]>(() => getStoredBestBooksOrder());
  const bestBooksRef = useRef<string[]>(bestBooksOrder);
  const lastRefreshRef = useRef<number>(0);

  // Stato coda per debounce e protezione da snap-back durante riordini rapidi
  const wantTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantPendingRef = useRef<boolean>(false);
  const bestPendingRef = useRef<boolean>(false);
  const wantInFlightRef = useRef<boolean>(false);
  const bestInFlightRef = useRef<boolean>(false);

  const flushWantPush = useCallback(async () => {
    if (wantTimerRef.current) {
      clearTimeout(wantTimerRef.current);
      wantTimerRef.current = null;
    }
    if (!wantPendingRef.current || wantInFlightRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    wantInFlightRef.current = true;
    wantPendingRef.current = false;
    try {
      await syncWantPriorityToSupabase(priorityRef.current);
    } finally {
      wantInFlightRef.current = false;
      if (wantPendingRef.current && (typeof navigator === 'undefined' || navigator.onLine)) {
        wantTimerRef.current = setTimeout(() => {
          wantTimerRef.current = null;
          void flushWantPush();
        }, 400);
      }
    }
  }, []);

  const flushBestPush = useCallback(async () => {
    if (bestTimerRef.current) {
      clearTimeout(bestTimerRef.current);
      bestTimerRef.current = null;
    }
    if (!bestPendingRef.current || bestInFlightRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    bestInFlightRef.current = true;
    bestPendingRef.current = false;
    try {
      await syncBestBooksOrderToSupabase(bestBooksRef.current);
    } finally {
      bestInFlightRef.current = false;
      if (bestPendingRef.current && (typeof navigator === 'undefined' || navigator.onLine)) {
        bestTimerRef.current = setTimeout(() => {
          bestTimerRef.current = null;
          void flushBestPush();
        }, 400);
      }
    }
  }, []);

  const scheduleWantPush = useCallback(() => {
    wantPendingRef.current = true;
    if (wantTimerRef.current) clearTimeout(wantTimerRef.current);
    wantTimerRef.current = setTimeout(() => {
      wantTimerRef.current = null;
      void flushWantPush();
    }, PUSH_DEBOUNCE_MS);
  }, [flushWantPush]);

  const scheduleBestPush = useCallback(() => {
    bestPendingRef.current = true;
    if (bestTimerRef.current) clearTimeout(bestTimerRef.current);
    bestTimerRef.current = setTimeout(() => {
      bestTimerRef.current = null;
      void flushBestPush();
    }, PUSH_DEBOUNCE_MS);
  }, [flushBestPush]);

  // Sincronizza con i metadati remoti su Supabase (senza sovrascrivere riordini locali in corso)
  const refreshPriority = useCallback(async (force = false) => {
    if (!force && Date.now() - lastRefreshRef.current < PRIORITY_SYNC_COOLDOWN_MS) {
      return;
    }
    try {
      const { data, error } = await getFreshUserDeduped(force);
      if (error || !data.user) return;
      lastRefreshRef.current = Date.now();
      const remoteWant = data.user.user_metadata?.want_priority;
      if (
        !wantPendingRef.current &&
        !wantInFlightRef.current &&
        Array.isArray(remoteWant) &&
        remoteWant.length > 0
      ) {
        priorityRef.current = remoteWant;
        saveStoredWantPriority(remoteWant);
        setPriorityOrder(remoteWant);
      }
      const remoteBest = data.user.user_metadata?.best_books_order;
      if (
        !bestPendingRef.current &&
        !bestInFlightRef.current &&
        Array.isArray(remoteBest) &&
        remoteBest.length > 0
      ) {
        bestBooksRef.current = remoteBest;
        saveStoredBestBooksOrder(remoteBest);
        setBestBooksOrderState(remoteBest);
      }
    } catch (err) {
      console.warn('Errore refresh priorità/classifica da Supabase:', err);
    }
  }, []);

  // Idrata dai metadati della sessione SOLO se non c'è un riordino locale in sospeso
  useEffect(() => {
    const meta = user?.user_metadata;
    if (!meta) return;
    if (
      !wantPendingRef.current &&
      !wantInFlightRef.current &&
      Array.isArray(meta.want_priority) &&
      meta.want_priority.length > 0
    ) {
      priorityRef.current = meta.want_priority;
      saveStoredWantPriority(meta.want_priority);
      setPriorityOrder(meta.want_priority);
    }
    if (
      !bestPendingRef.current &&
      !bestInFlightRef.current &&
      Array.isArray(meta.best_books_order) &&
      meta.best_books_order.length > 0
    ) {
      bestBooksRef.current = meta.best_books_order;
      saveStoredBestBooksOrder(meta.best_books_order);
      setBestBooksOrderState(meta.best_books_order);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!authReady || !user) return;
    if (navigator.onLine) {
      void refreshPriority(true);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flushWantPush();
        void flushBestPush();
      } else if (document.visibilityState === 'visible' && navigator.onLine) {
        void refreshPriority(false);
      }
    };
    const onPageHide = () => {
      void flushWantPush();
      void flushBestPush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [authReady, user?.id, refreshPriority, flushWantPush, flushBestPush]);

  useEffect(() => {
    return () => {
      if (wantTimerRef.current) {
        clearTimeout(wantTimerRef.current);
        wantTimerRef.current = null;
        if (wantPendingRef.current) void flushWantPush();
      }
      if (bestTimerRef.current) {
        clearTimeout(bestTimerRef.current);
        bestTimerRef.current = null;
        if (bestPendingRef.current) void flushBestPush();
      }
    };
  }, [flushWantPush, flushBestPush]);

  // Aggiorna l'ordine locale istantaneamente (0ms) e sincronizza su Supabase con debounce
  const setPriority = useCallback(
    (newOrder: string[]) => {
      priorityRef.current = newOrder;
      saveStoredWantPriority(newOrder);
      setPriorityOrder(newOrder);
      scheduleWantPush();
    },
    [scheduleWantPush]
  );

  // Aggiorna la classifica locale istantaneamente (0ms) e sincronizza su Supabase con debounce
  const setBestBooksOrder = useCallback(
    (newOrder: string[]) => {
      bestBooksRef.current = newOrder;
      saveStoredBestBooksOrder(newOrder);
      setBestBooksOrderState(newOrder);
      scheduleBestPush();
    },
    [scheduleBestPush]
  );

  // Sposta i migliori libri tramite drag & drop
  const reorderBestOnDrop = useCallback(
    (currentBooks: (Book | string)[], sourceId: string, targetId: string) => {
      const nextOrder = reorderBookIds(currentBooks, sourceId, targetId);
      setBestBooksOrder(nextOrder);
      return nextOrder;
    },
    [setBestBooksOrder]
  );

  // Sposta libri da leggere tramite drag & drop (sorgente su destinazione)
  const reorderOnDrop = useCallback(
    (currentBooks: (Book | string)[], sourceId: string, targetId: string) => {
      const nextOrder = reorderBookIds(currentBooks, sourceId, targetId);
      setPriority(nextOrder);
      return nextOrder;
    },
    [setPriority]
  );

  // Sposta a sinistra / destra / primo posto
  const shiftBook = useCallback(
    (currentBooks: (Book | string)[], bookId: string, direction: 'left' | 'right' | 'first' | 'last') => {
      const nextOrder = shiftBookPosition(currentBooks, bookId, direction);
      setPriority(nextOrder);
      return nextOrder;
    },
    [setPriority]
  );

  // Applica l'ordinamento a una lista di libri "Da leggere"
  const sortWantBooks = useCallback(
    (books: Book[]) => {
      return orderWantBooks(books, priorityOrder);
    },
    [priorityOrder]
  );

  // Applica l'ordinamento alla classifica dei migliori libri letti
  const sortBestBooks = useCallback(
    (books: Book[]) => {
      return orderBestBooks(books, bestBooksOrder);
    },
    [bestBooksOrder]
  );

  return {
    priorityOrder,
    setPriority,
    reorderOnDrop,
    shiftBook,
    sortWantBooks,
    bestBooksOrder,
    setBestBooksOrder,
    reorderBestOnDrop,
    sortBestBooks,
    refreshPriority,
  };
}
