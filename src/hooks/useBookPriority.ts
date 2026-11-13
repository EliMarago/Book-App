import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, type Book } from '@/lib/supabase';
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

const PRIORITY_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

export function useBookPriority() {
  const [priorityOrder, setPriorityOrder] = useState<string[]>(() => getStoredWantPriority());
  const priorityRef = useRef<string[]>(priorityOrder);

  const [bestBooksOrder, setBestBooksOrderState] = useState<string[]>(() => getStoredBestBooksOrder());
  const bestBooksRef = useRef<string[]>(bestBooksOrder);
  const lastRefreshRef = useRef<number>(0);

  // Sincronizza con i metadati remoti su Supabase
  const refreshPriority = useCallback(async (force = false) => {
    if (!force && Date.now() - lastRefreshRef.current < PRIORITY_SYNC_COOLDOWN_MS) {
      return;
    }
    lastRefreshRef.current = Date.now();
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return;
      const remoteWant = data.user.user_metadata?.want_priority;
      if (Array.isArray(remoteWant) && remoteWant.length > 0) {
        priorityRef.current = remoteWant;
        saveStoredWantPriority(remoteWant);
        setPriorityOrder(remoteWant);
      }
      const remoteBest = data.user.user_metadata?.best_books_order;
      if (Array.isArray(remoteBest) && remoteBest.length > 0) {
        bestBooksRef.current = remoteBest;
        saveStoredBestBooksOrder(remoteBest);
        setBestBooksOrderState(remoteBest);
      }
    } catch (err) {
      console.warn('Errore refresh priorità/classifica da Supabase:', err);
    }
  }, []);

  useEffect(() => {
    // Legge subito i metadati dalla sessione locale in memoria (0ms) senza bloccare le query all'avvio
    supabase.auth.getSession().then(({ data }) => {
      const meta = data.session?.user?.user_metadata;
      if (!meta) return;
      if (Array.isArray(meta.want_priority) && meta.want_priority.length > 0 && priorityRef.current.length === 0) {
        priorityRef.current = meta.want_priority;
        saveStoredWantPriority(meta.want_priority);
        setPriorityOrder(meta.want_priority);
      }
      if (Array.isArray(meta.best_books_order) && meta.best_books_order.length > 0 && bestBooksRef.current.length === 0) {
        bestBooksRef.current = meta.best_books_order;
        saveStoredBestBooksOrder(meta.best_books_order);
        setBestBooksOrderState(meta.best_books_order);
      }
    });

    const timer = setTimeout(() => {
      refreshPriority(true);
    }, 1800);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshPriority(false);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshPriority]);

  // Aggiorna l'ordine locale dei libri da leggere e lo sincronizza in background
  const setPriority = useCallback(async (newOrder: string[]) => {
    priorityRef.current = newOrder;
    saveStoredWantPriority(newOrder);
    setPriorityOrder(newOrder);
    await syncWantPriorityToSupabase(newOrder);
  }, []);

  // Aggiorna l'ordine della classifica dei migliori libri letti e sincronizza su Supabase
  const setBestBooksOrder = useCallback(async (newOrder: string[]) => {
    bestBooksRef.current = newOrder;
    saveStoredBestBooksOrder(newOrder);
    setBestBooksOrderState(newOrder);
    await syncBestBooksOrderToSupabase(newOrder);
  }, []);

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

