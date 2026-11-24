import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
import { Dashboard } from '@/components/Dashboard';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';
import { ToastProvider } from '@/components/Toast';

const AuthScreen = lazy(() =>
  import('@/components/AuthScreen').then((m) => ({ default: m.AuthScreen }))
);

function AppSplash() {
  return (
    <div
      className="app-boot-splash"
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

  if (loading) {
    return <AppSplash />;
  }

  if (isPasswordRecovery) {
    return (
      <Suspense fallback={<AppSplash />}>
        <AuthScreen initialMode="update-password" />
        <PwaUpdateBanner />
      </Suspense>
    );
  }

  return (
    <>
      {session ? (
        <Dashboard />
      ) : (
        <Suspense fallback={<AppSplash />}>
          <AuthScreen />
        </Suspense>
      )}
      <PwaUpdateBanner />
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
