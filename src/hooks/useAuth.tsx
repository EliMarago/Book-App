import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signUp, signIn, signOut }}
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
