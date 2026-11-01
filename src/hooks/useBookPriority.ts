import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, type Book } from '@/lib/supabase';
import {
  getStoredWantPriority,
  saveStoredWantPriority,
  syncWantPriorityToSupabase,
  orderWantBooks,
  reorderBookIds,
  shiftBookPosition,
} from '@/lib/bookPriority';

export function useBookPriority() {
  const [priorityOrder, setPriorityOrder] = useState<string[]>(() => getStoredWantPriority());
  const priorityRef = useRef<string[]>(priorityOrder);

  // Sincronizza con i metadati remoti su Supabase
  const refreshPriority = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return;
      const remote = data.user.user_metadata?.want_priority;
      if (Array.isArray(remote) && remote.length > 0) {
        priorityRef.current = remote;
        saveStoredWantPriority(remote);
        setPriorityOrder(remote);
      }
    } catch (err) {
      console.warn('Errore refresh priorità da Supabase:', err);
    }
  }, []);

  useEffect(() => {
    refreshPriority();
    const onFocus = () => {
      if (document.visibilityState === 'visible') refreshPriority();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refreshPriority]);

  // Aggiorna l'ordine locale e lo sincronizza in background
  const setPriority = useCallback(async (newOrder: string[]) => {
    priorityRef.current = newOrder;
    saveStoredWantPriority(newOrder);
    setPriorityOrder(newOrder);
    await syncWantPriorityToSupabase(newOrder);
  }, []);

  // Sposta tramite drag & drop (sorgente su destinazione)
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

  return {
    priorityOrder,
    setPriority,
    reorderOnDrop,
    shiftBook,
    sortWantBooks,
    refreshPriority,
  };
}

