import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  isRememberMeEnabled,
  setRememberMePreference,
  setExplicitSignOut,
  SESSION_BACKUP_KEY,
} from '@/lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  recoveryError: string | null;
  clearRecoveryError: () => void;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  clearPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getBackupSessionObject(): Session | null {
  try {
    if (!isRememberMeEnabled()) return null;
    const raw = localStorage.getItem(SESSION_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.access_token && parsed.refresh_token && parsed.user) {
      return parsed as Session;
    }
    return null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => getBackupSessionObject());
  const [loading, setLoading] = useState(() => !getBackupSessionObject());
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const explicitSignOutRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session);
        setLoading(false);
        return;
      }

      // Se "Ricordami" è attivo e la sessione primaria non è stata trovata (es. risveglio da standby),
      // proviamo a ripristinarla dal backup locale senza disconnettere l'utente.
      const backup = getBackupSessionObject();
      if (backup && !explicitSignOutRef.current) {
        setSession(backup);
        setLoading(false);
        if (navigator.onLine) {
          supabase.auth
            .setSession({
              access_token: backup.access_token,
              refresh_token: backup.refresh_token,
            })
            .then(({ data: restored }) => {
              if (restored.session) {
                setSession(restored.session);
              }
            })
            .catch(() => {});
        }
        return;
      }

      setSession(null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        setSession(newSession);
      } else if (explicitSignOutRef.current || !isRememberMeEnabled()) {
        setSession(null);
      } else {
        // Evita che uno sbalzo temporaneo di rete durante il refresh del token butti fuori l'utente
        const backup = getBackupSessionObject();
        if (backup) {
          setSession(backup);
        } else {
          setSession(null);
        }
      }

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setRecoveryError(null);
      }
      setLoading(false);
    });

    // 1. Controlla se l'URL contiene un errore restituito da Supabase (da query o hash)
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    );

    const urlError =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error');

    if (urlError) {
      console.warn('Errore URL autenticazione Supabase:', urlError);
      const isExpiredOrInvalid =
        urlError.toLowerCase().includes('expired') ||
        urlError.toLowerCase().includes('invalid') ||
        urlError.toLowerCase().includes('otp');
      const friendly = isExpiredOrInvalid
        ? 'Il link di recupero non è valido o è già stato consumato. I link via email sono monouso: se il client email scansiona i link automaticamente con antivirus, il link scade. Puoi inserire qui il codice OTP a 6 cifre ricevuto via email oppure richiedere un nuovo link.'
        : `Errore recupero password: ${urlError}`;
      setRecoveryError(friendly);

      if (window.location.hash || window.location.search) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    // 2. Controlla se c'è un codice di scambio PKCE (?code=...)
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (!error && data?.session) {
          setSession(data.session);
          setIsPasswordRecovery(true);
          setRecoveryError(null);
        } else if (error) {
          console.warn('Errore scambio codice PKCE:', error.message);
          setRecoveryError(`Impossibile verificare il link: ${error.message}`);
        }
        if (window.location.search) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      });
    }

    // 3. Controlla se l'URL contiene frammenti di recupero password (#type=recovery o ?type=recovery)
    if (
      window.location.hash.includes('type=recovery') ||
      searchParams.get('type') === 'recovery' ||
      hashParams.get('type') === 'recovery'
    ) {
      setIsPasswordRecovery(true);
      setRecoveryError(null);
    }

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
      return {
        error:
          'Variabili di ambiente mancanti: crea il file .env con VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
      };
    }
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      if (error.message.includes('Failed to fetch')) {
        return {
          error:
            'Impossibile connettersi a Supabase (Failed to fetch). Verifica che il progetto Supabase non sia in pausa e che le credenziali nel file .env siano corrette.',
        };
      }
      return { error: error.message };
    }
    return { error: null };
  };

  const signIn = async (email: string, password: string, rememberMe = true) => {
    if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
      return {
        error:
          'Variabili di ambiente mancanti: crea il file .env con VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY per connetterti al database.',
      };
    }
    explicitSignOutRef.current = false;
    setExplicitSignOut(false);
    setRememberMePreference(rememberMe, email);

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (error.message.includes('Failed to fetch')) {
        return {
          error:
            'Impossibile connettersi a Supabase (Failed to fetch). Verifica che il progetto su app.supabase.com non sia in pausa (Restore project) e che le credenziali nel file .env siano corrette.',
        };
      }
      return { error: error.message };
    }
    return { error: null };
  };

  const resetPassword = async (email: string) => {
    if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
      return { error: 'Configurazione Supabase mancante nel file .env.' };
    }
    const cleanOrigin = window.location.origin.replace(/\/+$/, '');
    const cleanPath = window.location.pathname.replace(/\/+$/, '');
    const redirectTo = `${cleanOrigin}${cleanPath}/`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) {
      return { error: error.message };
    }
    setRecoveryError(null);
    return { error: null };
  };

  const verifyRecoveryOtp = async (email: string, rawInput: string) => {
    if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
      return { error: 'Configurazione Supabase mancante nel file .env.' };
    }
    let token = rawInput.trim();
    if (!token) {
      return { error: 'Inserisci il link o il codice ricevuto via email.' };
    }

    // Se l'utente ha incollato l'intero URL dell'email o un frammento contenente "token="
    if (token.includes('token=')) {
      try {
        const url = new URL(token);
        const extracted = url.searchParams.get('token');
        if (extracted) token = extracted;
      } catch {
        const match = token.match(/token=([a-zA-Z0-9_-]+)/);
        if (match) token = match[1];
      }
    }

    // Tentativo 1: Se è un hash lungo (> 20 caratteri, come quello del link), verificalo come token_hash
    if (token.length > 20) {
      const resHash = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery',
      });
      if (!resHash.error && resHash.data?.session) {
        setSession(resHash.data.session);
        setIsPasswordRecovery(true);
        setRecoveryError(null);
        return { error: null };
      }
      if (resHash.error && !resHash.error.message.includes('fetch')) {
        // Se l'hash è fallito, prova comunque il fallback successivo o restituisci l'errore chiaro
        console.warn('Verifica token_hash fallita:', resHash.error.message);
      }
    }

    // Tentativo 2: Prova con email e codice OTP
    const resEmail = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'recovery',
    });

    if (resEmail.error) {
      return { error: resEmail.error.message };
    }

    if (resEmail.data?.session) {
      setSession(resEmail.data.session);
    }
    setIsPasswordRecovery(true);
    setRecoveryError(null);
    return { error: null };
  };

  const clearRecoveryError = () => {
    setRecoveryError(null);
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { error: error.message };
    }
    setIsPasswordRecovery(false);
    setRecoveryError(null);
    // Rimuove eventuali hash o parametri residui dall'URL
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    return { error: null };
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
    setRecoveryError(null);
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const signOut = async () => {
    explicitSignOutRef.current = true;
    setExplicitSignOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore network error on signout
    }
    try {
      const sensitiveKeys = [
        SESSION_BACKUP_KEY,
        'books_read_at',
        'books_pages',
        'books_read_pages',
        'books_plots',
        'books_tags',
        'reading_goals',
        'books_want_priority',
        'books_best_order',
        'bookshelf_book_details_it_v10',
      ];
      for (const k of sensitiveKeys) {
        localStorage.removeItem(k);
      }
    } catch {
      // ignore storage errors
    }
    setSession(null);
    setIsPasswordRecovery(false);
    setRecoveryError(null);
    setExplicitSignOut(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isPasswordRecovery,
        recoveryError,
        clearRecoveryError,
        signUp,
        signIn,
        signOut,
        resetPassword,
        verifyRecoveryOtp,
        updatePassword,
        clearPasswordRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
