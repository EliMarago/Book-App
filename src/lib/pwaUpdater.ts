import { useState, useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

type UpdateCallback = () => void;
const listeners = new Set<UpdateCallback>();
let swRegistration: ServiceWorkerRegistration | undefined;
let needRefreshGlobal = false;

// Registra il Service Worker con auto-aggiornamento
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    needRefreshGlobal = true;
    listeners.forEach((listener) => listener());
  },
  onOfflineReady() {
    console.log('Bookshelf: App pronta per l\'uso offline');
  },
  onRegisteredSW(_swUrl, r) {
    swRegistration = r;

    if (r) {
      let lastSwCheck = Date.now();
      const SW_CHECK_COOLDOWN_MS = 10 * 60 * 1000;

      // Controlla aggiornamenti quando l'utente torna sull'app, al massimo una volta ogni 10 minuti
      const checkUpdate = () => {
        if (
          document.visibilityState === 'visible' &&
          navigator.onLine &&
          Date.now() - lastSwCheck >= SW_CHECK_COOLDOWN_MS
        ) {
          lastSwCheck = Date.now();
          r.update().catch((err) => {
            console.debug('Controllo aggiornamento SW non riuscito (normale se offline):', err);
          });
        }
      };

      document.addEventListener('visibilitychange', checkUpdate);
      window.addEventListener('online', checkUpdate);
    }
  },
  onRegisterError(error) {
    console.error('Errore registrazione Service Worker:', error);
  },
});

/**
 * Funzione per forzare il controllo immediato di una nuova versione sul server
 */
export async function checkForAppUpdate(): Promise<boolean> {
  if (!swRegistration) {
    try {
      swRegistration = await navigator.serviceWorker?.getRegistration();
    } catch {
      // ignore
    }
  }

  if (swRegistration) {
    try {
      await swRegistration.update();
      if (swRegistration.waiting) {
        needRefreshGlobal = true;
        listeners.forEach((listener) => listener());
        return true;
      }
    } catch (err) {
      console.debug('Errore update SW:', err);
    }
  }
  return false;
}

/**
 * Applica l'aggiornamento e ricarica immediatamente l'applicazione con i nuovi file
 */
export async function applyAppUpdate() {
  await updateSW(true);
}

/**
 * Hook React per monitorare la disponibilità di nuovi aggiornamenti dell'app
 */
export function usePwaUpdate() {
  const [needRefresh, setNeedRefresh] = useState(needRefreshGlobal);

  useEffect(() => {
    const handleChange = () => {
      setNeedRefresh(needRefreshGlobal);
    };

    listeners.add(handleChange);
    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  return {
    needRefresh,
    applyUpdate: applyAppUpdate,
    checkForUpdate: checkForAppUpdate,
  };
}
