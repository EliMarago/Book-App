import { useEffect } from 'react';

// Contatore condiviso: più fogli/modali aperti insieme non si pestano i piedi
// e lo scroll della pagina torna normale solo quando si chiude l'ultimo.
let lockCount = 0;
let originalOverflow = '';

/**
 * Blocca lo scroll della pagina sotto un modale/foglio finché `active` è true.
 * Evita che su mobile scorra la libreria dietro il foglio quando si trascina.
 */
export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow;
      }
    };
  }, [active]);
}

