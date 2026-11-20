import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_BOOKSHELF_CUSTOMIZATION,
  type BookshelfCustomization,
} from '@/components/BookshelfCustomizationModal';

export type ShelfStyle = 'mixed' | 'spines' | 'covers';
export type BookshelfSyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface BookshelfSettings {
  shelfStyle: ShelfStyle;
  customization: BookshelfCustomization;
  /**
   * Per ogni sezione personalizzata manualmente (es. 'want', 'reading', 'completed-2026'),
   * contiene SOLO gli ID dei libri esposti frontalmente con la copertina.
   * Formato compatto per restare leggerissimo nei metadati Supabase e identico su mobile e desktop.
   */
  faceOutSections: Record<string, string[]>;
  /** Timestamp dell'ultima modifica locale/remota per evitare che letture vecchie sovrascrivano modifiche recenti */
  updatedAt: number;
}

const STYLE_KEY = 'bookshelf_shelf_style_v2';
const CUSTOMIZATION_KEY = 'bookapp_bookshelf_customization_v3';
const HOLIDAY_KEY = 'bookapp_bookshelf_holiday';
const FACEOUT_SECTIONS_KEY = 'bookapp_faceout_sections_v3';
const LEGACY_FACEOUT_KEY = 'bookapp_faceout_overrides_v2';
const UPDATED_AT_KEY = 'bookapp_bookshelf_settings_updated_at';
const SYNC_COOLDOWN_MS = 15 * 1000;
const PUSH_DEBOUNCE_MS = 450;

/** Converte il vecchio formato verboso ("sectionId::bookId": boolean) nel nuovo formato compatto */
function migrateLegacyOverrides(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const bySection: Record<string, Set<string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const sepIdx = key.indexOf('::');
    if (sepIdx <= 0) continue;
    const sectionId = key.slice(0, sepIdx);
    const bookId = key.slice(sepIdx + 2);
    if (!sectionId || !bookId) continue;
    if (!bySection[sectionId]) bySection[sectionId] = new Set<string>();
    if (value === true) {
      bySection[sectionId].add(bookId);
    }
  }
  const result: Record<string, string[]> = {};
  for (const [sectionId, set] of Object.entries(bySection)) {
    result[sectionId] = Array.from(set);
  }
  return result;
}

function normalizeFaceOutSections(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, string[]> = {};
  for (const [sectionId, ids] of Object.entries(raw as Record<string, unknown>)) {
    if (!sectionId || !Array.isArray(ids)) continue;
    const unique = Array.from(
      new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))
    );
    result[sectionId] = unique;
  }
  return result;
}

function readLocalSettings(): BookshelfSettings {
  let shelfStyle: ShelfStyle = 'mixed';
  try {
    const saved = localStorage.getItem(STYLE_KEY);
    if (saved === 'mixed' || saved === 'spines' || saved === 'covers') {
      shelfStyle = saved;
    }
  } catch {
    // ignore
  }

  let customization: BookshelfCustomization = DEFAULT_BOOKSHELF_CUSTOMIZATION;
  try {
    const saved = localStorage.getItem(CUSTOMIZATION_KEY);
    if (saved) {
      customization = {
        ...DEFAULT_BOOKSHELF_CUSTOMIZATION,
        ...JSON.parse(saved),
      };
    }
  } catch {
    // ignore
  }

  let faceOutSections: Record<string, string[]> = {};
  try {
    const savedV3 = localStorage.getItem(FACEOUT_SECTIONS_KEY);
    if (savedV3) {
      faceOutSections = normalizeFaceOutSections(JSON.parse(savedV3));
    } else {
      const legacy = localStorage.getItem(LEGACY_FACEOUT_KEY);
      if (legacy) {
        faceOutSections = migrateLegacyOverrides(JSON.parse(legacy));
      }
    }
  } catch {
    // ignore
  }

  let updatedAt = 0;
  try {
    const rawTs = localStorage.getItem(UPDATED_AT_KEY);
    if (rawTs) {
      const parsed = Number(rawTs);
      if (Number.isFinite(parsed) && parsed > 0) updatedAt = parsed;
    }
  } catch {
    // ignore
  }

  return { shelfStyle, customization, faceOutSections, updatedAt };
}

function writeLocalSettings(settings: BookshelfSettings) {
  try {
    localStorage.setItem(STYLE_KEY, settings.shelfStyle);
    localStorage.setItem(CUSTOMIZATION_KEY, JSON.stringify(settings.customization));
    localStorage.setItem(HOLIDAY_KEY, settings.customization.holiday);
    if (Object.keys(settings.faceOutSections).length > 0) {
      localStorage.setItem(FACEOUT_SECTIONS_KEY, JSON.stringify(settings.faceOutSections));
    } else {
      localStorage.removeItem(FACEOUT_SECTIONS_KEY);
    }
    localStorage.removeItem(LEGACY_FACEOUT_KEY);
    if (settings.updatedAt > 0) {
      localStorage.setItem(UPDATED_AT_KEY, String(settings.updatedAt));
    }
  } catch (e) {
    console.warn('Impossibile salvare impostazioni scaffale in localStorage:', e);
  }
}

function normalizeRemoteSettings(raw: unknown): BookshelfSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<BookshelfSettings> & { faceOutOverrides?: unknown };

  const shelfStyle: ShelfStyle =
    obj.shelfStyle === 'mixed' || obj.shelfStyle === 'spines' || obj.shelfStyle === 'covers'
      ? obj.shelfStyle
      : 'mixed';

  const customization: BookshelfCustomization = {
    ...DEFAULT_BOOKSHELF_CUSTOMIZATION,
    ...(obj.customization && typeof obj.customization === 'object' ? obj.customization : {}),
  };

  const hasV3 = obj.faceOutSections && typeof obj.faceOutSections === 'object' && !Array.isArray(obj.faceOutSections);
  const faceOutSections = hasV3
    ? normalizeFaceOutSections(obj.faceOutSections)
    : migrateLegacyOverrides(obj.faceOutOverrides);

  const updatedAt =
    typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : 0;

  return { shelfStyle, customization, faceOutSections, updatedAt };
}

function hasCustomLocalSettings(settings: BookshelfSettings): boolean {
  if (settings.shelfStyle !== 'mixed') return true;
  if (Object.keys(settings.faceOutSections).length > 0) return true;
  return JSON.stringify(settings.customization) !== JSON.stringify(DEFAULT_BOOKSHELF_CUSTOMIZATION);
}

function areSettingsEqual(a: BookshelfSettings, b: BookshelfSettings): boolean {
  return (
    a.shelfStyle === b.shelfStyle &&
    JSON.stringify(a.customization) === JSON.stringify(b.customization) &&
    JSON.stringify(a.faceOutSections) === JSON.stringify(b.faceOutSections)
  );
}

/**
 * Impostazioni visive dello scaffale (stile viste, personalizzazione legno/decorazioni,
 * scelta manuale delle copertine frontali).
 * Sincronizzate nei metadati Supabase in formato compatto con coda serializzata e debounce
 * per garantire il salvataggio affidabile tra tutti i dispositivi senza race condition.
 */
export function useBookshelfSettings() {
  const { user, authReady } = useAuth();
  const [settings, setSettings] = useState<BookshelfSettings>(() => readLocalSettings());
  const [syncStatus, setSyncStatus] = useState<BookshelfSyncStatus>('idle');

  const settingsRef = useRef<BookshelfSettings>(settings);
  const lastRefreshRef = useRef<number>(0);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushInFlightRef = useRef<boolean>(false);
  const dirtyPendingRef = useRef<boolean>(false);
  const savedBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executePush = useCallback(async () => {
    if (pushInFlightRef.current) {
      dirtyPendingRef.current = true;
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      dirtyPendingRef.current = true;
      setSyncStatus('error');
      return;
    }

    pushInFlightRef.current = true;
    dirtyPendingRef.current = false;
    setSyncStatus('saving');

    const snapshot = settingsRef.current;
    try {
      // Salviamo anche `faceOutOverrides: null` così eventuali vecchi dati voluminosi nei metadati vengono ripuliti
      const payload = {
        shelfStyle: snapshot.shelfStyle,
        customization: snapshot.customization,
        faceOutSections: snapshot.faceOutSections,
        updatedAt: snapshot.updatedAt,
      };
      const { error } = await supabase.auth.updateUser({
        data: { bookshelf_settings: payload },
      });
      if (error) throw error;

      setSyncStatus('saved');
      if (savedBadgeTimerRef.current) clearTimeout(savedBadgeTimerRef.current);
      savedBadgeTimerRef.current = setTimeout(() => {
        setSyncStatus((cur) => (cur === 'saved' ? 'idle' : cur));
      }, 2400);
    } catch (err) {
      console.error('Errore salvataggio impostazioni scaffale su Supabase:', err);
      dirtyPendingRef.current = true;
      setSyncStatus('error');
    } finally {
      pushInFlightRef.current = false;
      // Se l'utente ha fatto altre modifiche mentre il salvataggio era in volo, invia subito l'ultima versione
      if (dirtyPendingRef.current && (typeof navigator === 'undefined' || navigator.onLine)) {
        if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(() => {
          pushTimerRef.current = null;
          void executePush();
        }, 350);
      }
    }
  }, []);

  const schedulePush = useCallback(
    (immediate = false) => {
      dirtyPendingRef.current = true;
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
      if (immediate) {
        void executePush();
      } else {
        setSyncStatus('saving');
        pushTimerRef.current = setTimeout(() => {
          pushTimerRef.current = null;
          void executePush();
        }, PUSH_DEBOUNCE_MS);
      }
    },
    [executePush]
  );

  const flushSync = useCallback(() => {
    if (dirtyPendingRef.current || pushTimerRef.current) {
      schedulePush(true);
    }
  }, [schedulePush]);

  const applyRemoteIfNewer = useCallback(
    (remote: BookshelfSettings | null) => {
      // Non sovrascrivere mai modifiche locali ancora in attesa di salvataggio sul cloud
      if (dirtyPendingRef.current || pushInFlightRef.current || pushTimerRef.current) {
        return;
      }
      const local = settingsRef.current;
      if (!remote) {
        if (hasCustomLocalSettings(local)) {
          schedulePush(true);
        }
        return;
      }

      // Se la versione locale ha un timestamp più recente, la promuoviamo sul cloud
      if (local.updatedAt > 0 && remote.updatedAt > 0 && local.updatedAt > remote.updatedAt) {
        if (!areSettingsEqual(local, remote)) {
          schedulePush(true);
        }
        return;
      }

      // Altrimenti il cloud è la fonte di verità (es. modifiche fatte su un altro dispositivo)
      if (!areSettingsEqual(local, remote) || remote.updatedAt !== local.updatedAt) {
        settingsRef.current = remote;
        writeLocalSettings(remote);
        setSettings(remote);
      }
    },
    [schedulePush]
  );

  const refreshSettings = useCallback(
    async (force = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (dirtyPendingRef.current || pushInFlightRef.current || pushTimerRef.current) {
        // Se ci sono modifiche locali non ancora inviate, prova prima a salvarle
        if (force) void executePush();
        return;
      }
      if (!force && Date.now() - lastRefreshRef.current < SYNC_COOLDOWN_MS) {
        return;
      }
      lastRefreshRef.current = Date.now();
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return;
        const remote = normalizeRemoteSettings(data.user.user_metadata?.bookshelf_settings);
        applyRemoteIfNewer(remote);
      } catch (err) {
        console.warn('Errore recupero impostazioni scaffale da Supabase:', err);
      }
    },
    [applyRemoteIfNewer, executePush]
  );

  // Idratazione immediata dai metadati dell'utente quando la sessione è pronta
  useEffect(() => {
    if (!authReady || !user) return;
    const metaRemote = normalizeRemoteSettings(user.user_metadata?.bookshelf_settings);
    if (metaRemote) {
      applyRemoteIfNewer(metaRemote);
    }
    // Scarica sempre la versione più aggiornata dal server (superando eventuale JWT locale non ancora rinfrescato)
    void refreshSettings(true);
  }, [authReady, user?.id, applyRemoteIfNewer, refreshSettings]);

  // Listener per risveglio scheda, ritorno online e pulsante "Sincronizza" della Dashboard
  useEffect(() => {
    if (!authReady || !user) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSync();
      } else if (document.visibilityState === 'visible') {
        if (dirtyPendingRef.current) {
          flushSync();
        } else {
          void refreshSettings(false);
        }
      }
    };

    const onOnline = () => {
      if (dirtyPendingRef.current) {
        flushSync();
      } else {
        void refreshSettings(true);
      }
    };

    const onPageHide = () => {
      flushSync();
    };

    const onManualSync = () => {
      if (dirtyPendingRef.current) {
        flushSync();
      } else {
        void refreshSettings(true);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('bookapp:sync-now', onManualSync);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('bookapp:sync-now', onManualSync);
    };
  }, [authReady, user?.id, flushSync, refreshSettings]);

  // Pulizia timer e flush finale se il componente si smonta mentre ci sono modifiche in coda
  useEffect(() => {
    return () => {
      if (savedBadgeTimerRef.current) clearTimeout(savedBadgeTimerRef.current);
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
        if (dirtyPendingRef.current) {
          void executePush();
        }
      }
    };
  }, [executePush]);

  const updateSettings = useCallback(
    (updater: (prev: BookshelfSettings) => Omit<BookshelfSettings, 'updatedAt'>, immediate = false) => {
      const nextBody = updater(settingsRef.current);
      const next: BookshelfSettings = {
        ...nextBody,
        updatedAt: Date.now(),
      };
      settingsRef.current = next;
      writeLocalSettings(next);
      setSettings(next);
      schedulePush(immediate);
    },
    [schedulePush]
  );

  const setShelfStyle = useCallback(
    (shelfStyle: ShelfStyle) => {
      updateSettings((prev) => ({ ...prev, shelfStyle }), true);
    },
    [updateSettings]
  );

  const setCustomization = useCallback(
    (customization: BookshelfCustomization) => {
      updateSettings((prev) => ({ ...prev, customization }), true);
    },
    [updateSettings]
  );

  const toggleFaceOut = useCallback(
    (
      sectionId: string,
      bookId: string,
      currentlyFaceOut: boolean,
      currentSectionState: Record<string, boolean>
    ) => {
      updateSettings((prev) => {
        // Parti dai libri attualmente esposti frontalmente nella sezione e aggiungi/rimuovi il libro cliccato
        const existing = prev.faceOutSections[sectionId];
        const nextSet = new Set<string>(
          existing !== undefined
            ? existing
            : Object.entries(currentSectionState)
                .filter(([, isFo]) => isFo)
                .map(([bId]) => bId)
        );
        if (currentlyFaceOut) {
          nextSet.delete(bookId);
        } else {
          nextSet.add(bookId);
        }
        return {
          ...prev,
          shelfStyle: prev.shelfStyle !== 'mixed' ? 'mixed' : prev.shelfStyle,
          faceOutSections: {
            ...prev.faceOutSections,
            [sectionId]: Array.from(nextSet),
          },
        };
      }, false);
    },
    [updateSettings]
  );

  const resetFaceOutOverrides = useCallback(() => {
    updateSettings((prev) => ({ ...prev, faceOutSections: {} }), true);
  }, [updateSettings]);

  return {
    shelfStyle: settings.shelfStyle,
    customization: settings.customization,
    faceOutSections: settings.faceOutSections,
    syncStatus,
    setShelfStyle,
    setCustomization,
    toggleFaceOut,
    resetFaceOutOverrides,
    flushSync,
  };
}
