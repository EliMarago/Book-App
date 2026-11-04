import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  recoveryError: string | null;
  clearRecoveryError: () => void;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  clearPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
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
    const { error } = await supabase.auth.signUp({ email, password });
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

  const signIn = async (email: string, password: string) => {
    if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
      return {
        error:
          'Variabili di ambiente mancanti: crea il file .env con VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY per connetterti al database.',
      };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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

  const verifyRecoveryOtp = async (email: string, token: string) => {
    if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder')) {
      return { error: 'Configurazione Supabase mancante nel file .env.' };
    }
    const cleanToken = token.trim();
    if (!cleanToken) {
      return { error: 'Inserisci il codice di verifica a 6 cifre.' };
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: cleanToken,
      type: 'recovery',
    });

    if (error) {
      return { error: error.message };
    }

    if (data?.session) {
      setSession(data.session);
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
    await supabase.auth.signOut();
    setIsPasswordRecovery(false);
    setRecoveryError(null);
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
