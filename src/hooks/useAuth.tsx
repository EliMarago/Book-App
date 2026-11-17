import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  isRememberMeEnabled,
  setRememberMePreference,
  setExplicitSignOut,
  clearAuthBackup,
  clearUserLocalCaches,
  safeRefreshSession,
  SESSION_BACKUP_KEY,
} from '@/lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  authReady: boolean;
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

function isSessionExpired(session: Session | null, bufferSeconds = 45): boolean {
  if (!session?.expires_at) return true;
  return Date.now() / 1000 >= session.expires_at - bufferSeconds;
}

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
  const [authReady, setAuthReady] = useState(() => {
    const backup = getBackupSessionObject();
    if (!backup) return false;
    return !navigator.onLine || !isSessionExpired(backup, 60);
  });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const explicitSignOutRef = useRef(false);
  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;

  useEffect(() => {
    let cancelled = false;

    const ensureFreshSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        if (data.session) {
          if (isSessionExpired(data.session, 60) && navigator.onLine) {
            const { session: refreshed, permanentInvalid } = await safeRefreshSession();
            if (cancelled) return;
            if (refreshed) {
              setSession(refreshed);
            } else if (permanentInvalid) {
              clearAuthBackup();
              setSession(null);
            } else {
              setSession(data.session);
            }
          } else {
            setSession(data.session);
          }
          setLoading(false);
          setAuthReady(true);
          return;
        }

        // Se "Ricordami" è attivo e la sessione primaria non è stata trovata (es. risveglio da standby),
        // usiamo safeRefreshSession (mai setSession concurrent) così non consumiamo due volte lo stesso refresh token.
        const backup = getBackupSessionObject();
        if (backup && !explicitSignOutRef.current) {
          if (navigator.onLine) {
            const { session: refreshed, permanentInvalid } = await safeRefreshSession(true);
            if (cancelled) return;
            if (refreshed) {
              setSession(refreshed);
            } else if (permanentInvalid) {
              clearAuthBackup();
              setSession(null);
            } else {
              setSession(backup);
            }
          } else {
            setSession(backup);
          }
          if (!cancelled) {
            setLoading(false);
            setAuthReady(true);
          }
          return;
        }

        if (!cancelled) {
          setSession(null);
          setLoading(false);
          setAuthReady(true);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setAuthReady(true);
        }
      }
    };

    ensureFreshSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        setSession(newSession);
        setAuthReady(true);
      } else if (explicitSignOutRef.current || !isRememberMeEnabled()) {
        setSession(null);
        setAuthReady(true);
      } else if (event === 'SIGNED_OUT') {
        // Non buttare fuori subito l'utente su un evento SIGNED_OUT spurio (es. race tra tab/auto-refresh):
        // verifica prima tramite safeRefreshSession se esiste un token valido o se è davvero revocato.
        const backup = getBackupSessionObject();
        if (!backup) {
          setSession(null);
          setAuthReady(true);
        } else if (navigator.onLine) {
          safeRefreshSession()
            .then(({ session: recovered, permanentInvalid }) => {
              if (cancelled) return;
              if (recovered) {
                setSession(recovered);
              } else if (permanentInvalid) {
                clearAuthBackup();
                setSession(null);
              } else {
                setSession(backup);
              }
              setAuthReady(true);
            })
            .catch(() => {
              if (!cancelled) setSession(backup);
            });
        } else {
          setSession(backup);
          setAuthReady(true);
        }
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

    // Quando la PWA torna in primo piano o torna online, rinfresca in modo serializzato se vicino alla scadenza
    const refreshOnWake = () => {
      if (
        document.visibilityState === 'visible' &&
        navigator.onLine &&
        sessionRef.current &&
        isSessionExpired(sessionRef.current, 120)
      ) {
        safeRefreshSession()
          .then(({ session: refreshed, permanentInvalid }) => {
            if (cancelled) return;
            if (refreshed) {
              setSession(refreshed);
            } else if (permanentInvalid) {
              clearAuthBackup();
              setSession(null);
            }
          })
          .catch(() => {});
      }
    };

    // Sincronizza la sessione se un'altra scheda del browser ha appena rinfrescato i token in localStorage
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === SESSION_BACKUP_KEY && e.newValue && isRememberMeEnabled()) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.access_token && parsed?.refresh_token && parsed?.user) {
            setSession(parsed as Session);
          }
        } catch {
          // ignore
        }
      }
    };

    document.addEventListener('visibilitychange', refreshOnWake);
    window.addEventListener('online', refreshOnWake);
    window.addEventListener('storage', handleStorageSync);

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
      cancelled = true;
      listener.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', refreshOnWake);
      window.removeEventListener('online', refreshOnWake);
      window.removeEventListener('storage', handleStorageSync);
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
    const currentUserId = sessionRef.current?.user?.id;
    explicitSignOutRef.current = true;
    setExplicitSignOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore network error on signout
    }
    clearAuthBackup();
    clearUserLocalCaches(currentUserId);
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
        authReady,
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
