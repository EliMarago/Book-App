import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
import { Dashboard } from '@/components/Dashboard';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';
import { ToastProvider } from '@/components/Toast';

const AuthScreen = lazy(() =>
  import('@/components/AuthScreen').then((m) => ({ default: m.AuthScreen }))
);

function AppSplash({ fading = false }: { fading?: boolean }) {
  return (
    <div
      className={`app-boot-splash${fading ? ' is-fading' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Caricamento Bookshelf"
    >
      <div className="app-boot-emblem" aria-hidden="true">
        <svg
          width="38"
          height="38"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 7v14" />
          <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
        </svg>
      </div>
      <p className="app-boot-title">Bookshelf</p>
      <p className="app-boot-sub">Apro la tua libreria…</p>
      <div className="app-boot-bar" aria-hidden="true" />
    </div>
  );
}

function AppContent() {
  const { session, loading, isPasswordRecovery } = useAuth();
  const [bootFading, setBootFading] = useState(false);
  const [bootRemoved, setBootRemoved] = useState(false);

  // Mantiene la splash screen coordinata sopra l'app per ~520ms (attende font + layout stabilizzato,
  // poi dissolve dolcemente e si smonta completamente dal DOM a consumo zero)
  useEffect(() => {
    if (loading || bootRemoved) return;
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let removeTimer: ReturnType<typeof setTimeout> | null = null;

    const minDelay = new Promise<void>((res) => {
      fadeTimer = setTimeout(res, 520);
    });
    const fontsReady =
      typeof document !== 'undefined' && document.fonts?.ready
        ? Promise.race([
            document.fonts.ready.then(() => undefined),
            new Promise<void>((res) => setTimeout(res, 680)),
          ])
        : Promise.resolve();

    Promise.all([minDelay, fontsReady]).then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        setBootFading(true);
        removeTimer = setTimeout(() => {
          if (!cancelled) setBootRemoved(true);
        }, 230);
      });
    });

    return () => {
      cancelled = true;
      if (fadeTimer) clearTimeout(fadeTimer);
      if (removeTimer) clearTimeout(removeTimer);
    };
  }, [loading, bootRemoved]);

  const mainView = loading ? null : isPasswordRecovery ? (
    <Suspense fallback={null}>
      <AuthScreen initialMode="update-password" />
      <PwaUpdateBanner />
    </Suspense>
  ) : session ? (
    <>
      <Dashboard />
      <PwaUpdateBanner />
    </>
  ) : (
    <Suspense fallback={null}>
      <AuthScreen />
      <PwaUpdateBanner />
    </Suspense>
  );

  return (
    <>
      {mainView}
      {!bootRemoved && <AppSplash fading={bootFading} />}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
