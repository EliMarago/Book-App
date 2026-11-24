import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('VITE_SUPABASE_URL non trovata nelle variabili d environment.');
}

export const REMEMBER_ME_KEY = 'bookshelf_remember_me';
export const REMEMBERED_EMAIL_KEY = 'bookshelf_remembered_email';
export const SESSION_BACKUP_KEY = 'bookshelf_session_backup';

let explicitSignOutInProgress = false;

export function setExplicitSignOut(value: boolean) {
  explicitSignOutInProgress = value;
}

export function clearAuthBackup() {
  try {
    localStorage.removeItem(SESSION_BACKUP_KEY);
    // Rimuove anche eventuali chiavi sb-*-auth-token di Supabase scadute/revocate
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function clearUserLocalCaches(userId?: string | null) {
  try {
    const sensitiveKeys = [
      SESSION_BACKUP_KEY,
      'bookapp_cached_books_v1',
      'books_read_at',
      'books_started_reading_at',
      'books_pages',
      'books_read_pages',
      'books_plots',
      'books_tags',
      'books_characters',
      'reading_goals',
      'books_want_priority',
      'books_best_order',
      'bookshelf_book_details_it_v10',
    ];
    for (const k of sensitiveKeys) {
      localStorage.removeItem(k);
    }
    if (userId) {
      localStorage.removeItem(`bookapp_cached_books_v1_${userId}`);
    }
  } catch {
    // ignore storage errors
  }
}

export function isRememberMeEnabled(): boolean {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setRememberMePreference(remember: boolean, email?: string) {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');
    if (remember && email) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
    } else if (!remember) {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      localStorage.removeItem(SESSION_BACKUP_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function getRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

// Storage personalizzato resiliente:
// - Se "Ricordami" è attivo (default), salva la sessione in localStorage + copia di backup
//   per evitare disconnessioni improvvise quando il telefono si risveglia offline o con rete instabile.
// - Se "Ricordami" è disattivato, usa sessionStorage (la sessione dura solo finché l'app resta aperta).
const resilientAuthStorage = {
  getItem: (key: string): string | null => {
    try {
      if (!isRememberMeEnabled()) {
        return sessionStorage.getItem(key) ?? localStorage.getItem(key);
      }
      const primary = localStorage.getItem(key);
      if (primary) return primary;
      // Se Supabase ha rimosso la chiave primaria durante uno sbalzo di rete, ripristina dal backup
      const backup = localStorage.getItem(SESSION_BACKUP_KEY);
      if (backup) {
        localStorage.setItem(key, backup);
        return backup;
      }
      return null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (isRememberMeEnabled()) {
        localStorage.setItem(key, value);
        localStorage.setItem(SESSION_BACKUP_KEY, value);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
        localStorage.removeItem(SESSION_BACKUP_KEY);
      }
    } catch {
      // ignore storage errors
    }
  },
  removeItem: (key: string): void => {
    try {
      sessionStorage.removeItem(key);
      // Rimuove dal localStorage solo se l'utente ha premuto esplicitamente "Esci"
      // oppure se "Ricordami" non è attivo.
      if (explicitSignOutInProgress || !isRememberMeEnabled()) {
        localStorage.removeItem(key);
        localStorage.removeItem(SESSION_BACKUP_KEY);
      }
    } catch {
      // ignore storage errors
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: resilientAuthStorage,
  },
});

function isSessionFresh(session: Session | null, bufferSeconds = 60): boolean {
  if (!session?.expires_at) return false;
  return Date.now() / 1000 < session.expires_at - bufferSeconds;
}

function getBackupRefreshToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.refresh_token === 'string' ? parsed.refresh_token : null;
  } catch {
    return null;
  }
}

let inFlightRefresh: Promise<{ session: Session | null; permanentInvalid: boolean }> | null = null;

/**
 * Esegue al massimo un refresh alla volta per evitare race condition di Refresh Token Reuse
 * (quando autoRefreshToken, risveglio da standby e Dashboard si attivano insieme su mobile/multi-tab).
 */
export async function safeRefreshSession(forceRefresh = false): Promise<{
  session: Session | null;
  permanentInvalid: boolean;
}> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    try {
      const { data: current } = await supabase.auth.getSession();
      if (current?.session && !forceRefresh && isSessionFresh(current.session, 60)) {
        return { session: current.session, permanentInvalid: false };
      }

      if (!navigator.onLine) {
        return { session: current?.session ?? null, permanentInvalid: false };
      }

      const tokenBefore = current?.session?.refresh_token ?? getBackupRefreshToken();
      const { data: refreshed, error } = await supabase.auth.refreshSession();

      if (refreshed?.session) {
        return { session: refreshed.session, permanentInvalid: false };
      }

      // Se un altro tab o l'auto-refresh interno ha appena salvato un refresh_token più nuovo, usiamo quello!
      const tokenAfter = getBackupRefreshToken();
      if (tokenAfter && tokenBefore && tokenAfter !== tokenBefore) {
        const { data: latest } = await supabase.auth.getSession();
        if (latest?.session) {
          return { session: latest.session, permanentInvalid: false };
        }
      }

      const msg = (error?.message || '').toLowerCase();
      const isPermanent =
        msg.includes('refresh token not found') ||
        msg.includes('invalid refresh token') ||
        msg.includes('session_not_found') ||
        msg.includes('invalid_grant');

      // "Already Used" senza nuovo token in storage indica token revocato dal server
      const isAlreadyUsedWithoutUpdate = msg.includes('already used') && tokenAfter === tokenBefore;

      return {
        session: null,
        permanentInvalid: isPermanent || isAlreadyUsedWithoutUpdate,
      };
    } catch {
      return { session: null, permanentInvalid: false };
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

/**
 * Legge in modo sincrono (0ms) la sessione salvata localmente (sia dal backup sia dalle chiavi sb-*-auth-token)
 * per aprire immediatamente la Dashboard con i libri in cache senza attendere la rete.
 */
export function getInitialStoredSession(): Session | null {
  try {
    const parseCandidate = (raw: string | null): Session | null => {
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const candidate = parsed?.currentSession ?? parsed;
      if (candidate && candidate.access_token && candidate.refresh_token && candidate.user) {
        return candidate as Session;
      }
      return null;
    };

    if (isRememberMeEnabled()) {
      const fromBackup = parseCandidate(localStorage.getItem(SESSION_BACKUP_KEY));
      if (fromBackup) return fromBackup;
    }

    const storages = isRememberMeEnabled() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    for (const st of storages) {
      for (let i = 0; i < st.length; i++) {
        const k = st.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const found = parseCandidate(st.getItem(k));
          if (found) return found;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

let inFlightGetUser: Promise< Awaited<ReturnType<typeof supabase.auth.getUser>> > | null = null;
let cachedGetUserResult: {
  at: number;
  res: Awaited<ReturnType<typeof supabase.auth.getUser>>;
} | null = null;

/**
 * Deduplica chiamate concorrenti a `supabase.auth.getUser()` (es. impostazioni scaffale,
 * priorità libri e obiettivi di lettura all'avvio), evitando 3 richieste HTTP identiche simultanee.
 */
export async function getFreshUserDeduped(force = false) {
  const maxAgeMs = force ? 2000 : 10000;
  if (cachedGetUserResult && Date.now() - cachedGetUserResult.at < maxAgeMs) {
    return cachedGetUserResult.res;
  }
  if (inFlightGetUser) {
    return inFlightGetUser;
  }
  inFlightGetUser = supabase.auth
    .getUser()
    .then((res) => {
      if (!res.error && res.data.user) {
        cachedGetUserResult = { at: Date.now(), res };
      }
      return res;
    })
    .finally(() => {
      inFlightGetUser = null;
    });
  return inFlightGetUser;
}

export type Book = {
  id: string;
  user_id: string;
  title: string;
  author: string;
  cover_url: string | null;
  rating: number;
  status: 'reading' | 'completed' | 'want';
  read_at: string | null;
  started_at?: string | null;
  pages?: number | null;
  read_pages?: number | null;
  created_at: string;
  updated_at: string;
  notes_count?: number;
  plot?: string | null;
  tags?: string[];
  characters?: string | null;
};

export type Note = {
  id: string;
  book_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};
