import { createClient } from '@supabase/supabase-js';

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
};

export type Note = {
  id: string;
  book_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};
