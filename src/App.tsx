import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
import { AuthScreen } from '@/components/AuthScreen';
import { Dashboard } from '@/components/Dashboard';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 light:bg-[#faf8f5] flex items-center justify-center transition-colors">
        <Loader2 size={32} className="animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <>
      {session ? <Dashboard /> : <AuthScreen />}
      <PwaUpdateBanner />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

