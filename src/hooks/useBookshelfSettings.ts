import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_BOOKSHELF_CUSTOMIZATION,
  type BookshelfCustomization,
} from '@/components/BookshelfCustomizationModal';

export type ShelfStyle = 'mixed' | 'spines' | 'covers';

export interface BookshelfSettings {
  shelfStyle: ShelfStyle;
  customization: BookshelfCustomization;
  faceOutOverrides: Record<string, boolean>;
}

const STYLE_KEY = 'bookshelf_shelf_style_v2';
const CUSTOMIZATION_KEY = 'bookapp_bookshelf_customization_v3';
const HOLIDAY_KEY = 'bookapp_bookshelf_holiday';
const FACEOUT_KEY = 'bookapp_faceout_overrides_v2';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

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

  let faceOutOverrides: Record<string, boolean> = {};
  try {
    const saved = localStorage.getItem(FACEOUT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        faceOutOverrides = parsed;
      }
    }
  } catch {
    // ignore
  }

  return { shelfStyle, customization, faceOutOverrides };
}

function writeLocalSettings(settings: BookshelfSettings) {
  try {
    localStorage.setItem(STYLE_KEY, settings.shelfStyle);
    localStorage.setItem(CUSTOMIZATION_KEY, JSON.stringify(settings.customization));
    localStorage.setItem(HOLIDAY_KEY, settings.customization.holiday);
    if (Object.keys(settings.faceOutOverrides).length > 0) {
      localStorage.setItem(FACEOUT_KEY, JSON.stringify(settings.faceOutOverrides));
    } else {
      localStorage.removeItem(FACEOUT_KEY);
    }
  } catch (e) {
    console.warn('Impossibile salvare impostazioni scaffale in localStorage:', e);
  }
}

function normalizeRemoteSettings(raw: unknown): BookshelfSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<BookshelfSettings>;

  const shelfStyle: ShelfStyle =
    obj.shelfStyle === 'mixed' || obj.shelfStyle === 'spines' || obj.shelfStyle === 'covers'
      ? obj.shelfStyle
      : 'mixed';

  const customization: BookshelfCustomization = {
    ...DEFAULT_BOOKSHELF_CUSTOMIZATION,
    ...(obj.customization && typeof obj.customization === 'object' ? obj.customization : {}),
  };

  const faceOutOverrides: Record<string, boolean> =
    obj.faceOutOverrides && typeof obj.faceOutOverrides === 'object' && !Array.isArray(obj.faceOutOverrides)
      ? obj.faceOutOverrides
      : {};

  return { shelfStyle, customization, faceOutOverrides };
}

function hasCustomLocalSettings(settings: BookshelfSettings): boolean {
  if (settings.shelfStyle !== 'mixed') return true;
  if (Object.keys(settings.faceOutOverrides).length > 0) return true;
  return JSON.stringify(settings.customization) !== JSON.stringify(DEFAULT_BOOKSHELF_CUSTOMIZATION);
}

/**
 * Impostazioni visive dello scaffale (stile viste, personalizzazione legno/decorazioni,
 * scelta manuale delle copertine frontali).
 * Sincronizzate nei metadati Supabase per mantenere lo stesso scaffale su tutti i dispositivi,
 * con copia in localStorage per caricamento immediato offline.
 */
export function useBookshelfSettings() {
  const [settings, setSettings] = useState<BookshelfSettings>(() => readLocalSettings());
  const settingsRef = useRef<BookshelfSettings>(settings);
  const lastRefreshRef = useRef<number>(0);

  const pushToSupabase = useCallback(async (next: BookshelfSettings) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { bookshelf_settings: next },
      });
      if (error) throw error;
    } catch (err) {
      console.error('Errore salvataggio impostazioni scaffale su Supabase:', err);
    }
  }, []);

  const refreshSettings = useCallback(
    async (force = false) => {
      if (!force && Date.now() - lastRefreshRef.current < SYNC_COOLDOWN_MS) {
        return;
      }
      lastRefreshRef.current = Date.now();
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return;
        const remote = normalizeRemoteSettings(data.user.user_metadata?.bookshelf_settings);
        if (remote) {
          settingsRef.current = remote;
          writeLocalSettings(remote);
          setSettings(remote);
        } else if (hasCustomLocalSettings(settingsRef.current)) {
          // Migra automaticamente eventuali impostazioni locali già presenti su questo dispositivo
          await pushToSupabase(settingsRef.current);
        }
      } catch (err) {
        console.warn('Errore recupero impostazioni scaffale da Supabase:', err);
      }
    },
    [pushToSupabase]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const remote = normalizeRemoteSettings(data.session?.user?.user_metadata?.bookshelf_settings);
      if (remote) {
        settingsRef.current = remote;
        writeLocalSettings(remote);
        setSettings(remote);
      }
    });

    const timer = setTimeout(() => {
      refreshSettings(true);
    }, 1500);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSettings(false);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshSettings]);

  const updateSettings = useCallback(
    (updater: (prev: BookshelfSettings) => BookshelfSettings) => {
      const next = updater(settingsRef.current);
      settingsRef.current = next;
      writeLocalSettings(next);
      setSettings(next);
      void pushToSupabase(next);
    },
    [pushToSupabase]
  );

  const setShelfStyle = useCallback(
    (shelfStyle: ShelfStyle) => {
      updateSettings((prev) => ({ ...prev, shelfStyle }));
    },
    [updateSettings]
  );

  const setCustomization = useCallback(
    (customization: BookshelfCustomization) => {
      updateSettings((prev) => ({ ...prev, customization }));
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
        const nextOverrides = { ...prev.faceOutOverrides };
        for (const [bId, state] of Object.entries(currentSectionState)) {
          nextOverrides[`${sectionId}::${bId}`] = state;
        }
        nextOverrides[`${sectionId}::${bookId}`] = !currentlyFaceOut;
        return {
          ...prev,
          shelfStyle: prev.shelfStyle !== 'mixed' ? 'mixed' : prev.shelfStyle,
          faceOutOverrides: nextOverrides,
        };
      });
    },
    [updateSettings]
  );

  const resetFaceOutOverrides = useCallback(() => {
    updateSettings((prev) => ({ ...prev, faceOutOverrides: {} }));
  }, [updateSettings]);

  return {
    shelfStyle: settings.shelfStyle,
    customization: settings.customization,
    faceOutOverrides: settings.faceOutOverrides,
    setShelfStyle,
    setCustomization,
    toggleFaceOut,
    resetFaceOutOverrides,
  };
}

