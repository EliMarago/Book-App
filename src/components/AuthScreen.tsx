import { useState } from 'react';
import { BookOpen, Mail, Lock, AlertCircle, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSupabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    !import.meta.env.VITE_SUPABASE_URL.includes('placeholder') &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('placeholder')
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email, password);

    if (error) {
      setError(error);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 light:from-[#fcfbfa] light:via-[#f5f0e8] light:to-[#fcfbfa] flex items-center justify-center p-4 transition-colors">
      {/* Selettore Tema chiaro/scuro */}
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2.5 rounded-xl bg-stone-800/80 light:bg-white border border-stone-700 light:border-stone-200 text-stone-300 light:text-stone-700 hover:text-amber-400 light:hover:text-amber-600 shadow-md transition-all cursor-pointer"
        title={theme === 'dark' ? 'Passa alla modalità chiara' : 'Passa alla modalità scura'}
        aria-label="Cambia tema"
      >
        {theme === 'dark' ? (
          <Sun size={20} className="text-amber-400 hover:rotate-45 transition-transform" />
        ) : (
          <Moon size={20} className="text-stone-700 hover:-rotate-12 transition-transform" />
        )}
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 light:bg-amber-100 border border-amber-500/20 light:border-amber-300 mb-4 shadow-sm">
            <BookOpen size={32} className="text-amber-400 light:text-amber-600" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-100 light:text-stone-900">Bookshelf</h1>
          <p className="text-stone-400 light:text-stone-600 mt-2">Monitora i libri che leggi</p>
        </div>

        <div className="bg-stone-800/50 light:bg-white/90 backdrop-blur-sm rounded-2xl border border-stone-700 light:border-stone-200/90 p-8 shadow-2xl light:shadow-stone-900/5 transition-all">
          {!isSupabaseConfigured && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-400 text-sm">
                <AlertCircle size={17} className="flex-shrink-0" />
                <span>Configurazione Supabase mancante</span>
              </div>
              <p className="text-stone-300 leading-relaxed">
                Il file <code className="bg-stone-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">.env</code> non è configurato. Per effettuare l'accesso, inserisci l'URL e la Anon Key del tuo progetto Supabase:
              </p>
              <div className="bg-stone-900/90 p-3 rounded-lg font-mono text-[11px] text-stone-300 border border-stone-700/60 select-all space-y-1">
                <div className="text-stone-500"># Inserisci nel file .env:</div>
                <div className="text-amber-300">VITE_SUPABASE_URL=https://xyz.supabase.co</div>
                <div className="text-amber-300">VITE_SUPABASE_ANON_KEY=eyJhbG...</div>
              </div>
            </div>
          )}

          <div className="flex gap-2 mb-6 p-1 bg-stone-900/50 light:bg-stone-100 rounded-lg">
            <button
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                mode === 'signin'
                  ? 'bg-amber-500 text-stone-900 shadow-sm'
                  : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
              }`}
            >
              Accedi
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'bg-amber-500 text-stone-900 shadow-sm'
                  : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
              }`}
            >
              Registrati
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-300 light:text-stone-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-900/50 light:bg-stone-50 border border-stone-700 light:border-stone-300 rounded-lg text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
                  placeholder="tu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-300 light:text-stone-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-900/50 light:bg-stone-50 border border-stone-700 light:border-stone-300 rounded-lg text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-400 light:text-red-700 bg-red-500/10 light:bg-red-50 border border-red-500/20 light:border-red-200 rounded-lg p-3">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-900 font-semibold rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              {loading
                ? 'Caricamento...'
                : mode === 'signin'
                  ? 'Accedi'
                  : 'Crea account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
