import { useState } from 'react';
import {
  BookOpen,
  Mail,
  Lock,
  AlertCircle,
  Sun,
  Moon,
  Sparkles,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'update-password';

interface AuthScreenProps {
  initialMode?: AuthMode;
}

function calculatePasswordStrength(pass: string): { score: number; label: string; color: string } {
  if (!pass) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pass.length >= 6) score += 1;
  if (pass.length >= 8) score += 1;
  if (/[0-9]/.test(pass)) score += 1;
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  if (score <= 1) return { score: 1, label: 'Debole', color: 'bg-rose-500' };
  if (score === 2 || score === 3) return { score: 2, label: 'Media', color: 'bg-amber-400' };
  return { score: 3, label: 'Forte', color: 'bg-emerald-400' };
}

export function AuthScreen({ initialMode = 'signin' }: AuthScreenProps) {
  const { signIn, signUp, resetPassword, updatePassword, clearPasswordRecovery } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSupabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    !import.meta.env.VITE_SUPABASE_URL.includes('placeholder') &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('placeholder')
  );

  const strength = calculatePasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error: err } = await signIn(email, password);
        if (err) setError(err);
      } else if (mode === 'signup') {
        const { error: err } = await signUp(email, password);
        if (err) {
          setError(err);
        } else {
          setSuccessMessage(
            'Account creato con successo! Se la verifica email è attiva sul tuo progetto Supabase, controlla la tua casella di posta.'
          );
        }
      } else if (mode === 'forgot') {
        const { error: err } = await resetPassword(email);
        if (err) {
          setError(err);
        } else {
          setSuccessMessage(
            `Link di recupero inviato a ${email}. Apri l'email e clicca sul link per scegliere una nuova password.`
          );
        }
      } else if (mode === 'update-password') {
        if (password.length < 6) {
          setError('La password deve contenere almeno 6 caratteri.');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Le due password non corrispondono.');
          setLoading(false);
          return;
        }
        const { error: err } = await updatePassword(password);
        if (err) {
          setError(err);
        } else {
          setSuccessMessage('Password aggiornata con successo! Accesso in corso...');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-stone-950 light:bg-[#faf7f2] flex items-center justify-center p-4 sm:p-6 overflow-hidden transition-colors duration-300">
      {/* Elementi di luce e atmosfera soffusa */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full bg-amber-500/10 light:bg-amber-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-amber-600/10 light:bg-orange-300/20 blur-3xl" />

      {/* Selettore Tema chiaro/scuro in alto a destra */}
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 p-2.5 rounded-2xl bg-stone-900/80 light:bg-white/90 border border-stone-800 light:border-stone-200 text-stone-300 light:text-stone-700 hover:text-amber-400 light:hover:text-amber-600 shadow-md backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95"
        title={theme === 'dark' ? 'Passa alla modalità chiara' : 'Passa alla modalità scura'}
        aria-label="Cambia tema"
      >
        {theme === 'dark' ? (
          <Sun size={19} className="text-amber-400 hover:rotate-45 transition-transform" />
        ) : (
          <Moon size={19} className="text-amber-600 hover:-rotate-12 transition-transform" />
        )}
      </button>

      <div className="relative w-full max-w-md my-auto animate-fade-up">
        {/* Intestazione Brand */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-600/5 light:from-amber-100 light:to-amber-50 border border-amber-500/30 light:border-amber-300 mb-3.5 shadow-lg shadow-amber-500/10">
            {mode === 'update-password' || mode === 'forgot' ? (
              <KeyRound size={28} className="text-amber-400 light:text-amber-600" />
            ) : (
              <BookOpen size={30} className="text-amber-400 light:text-amber-600" />
            )}
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 light:bg-amber-500 animate-pulse" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-100 light:text-stone-900 tracking-tight">
            Bookshelf
          </h1>
          <p className="text-stone-400 light:text-stone-600 text-sm mt-1.5 font-normal">
            {mode === 'forgot'
              ? 'Recupera la password del tuo account'
              : mode === 'update-password'
                ? 'Imposta una nuova password sicura'
                : 'La tua libreria personale, sfide di lettura e note'}
          </p>
        </div>

        {/* Card di Autenticazione */}
        <div className="relative bg-stone-900/85 light:bg-white/95 backdrop-blur-xl rounded-3xl border border-stone-800/90 light:border-stone-200/90 p-7 sm:p-8 shadow-2xl light:shadow-stone-900/10">
          {!isSupabaseConfigured && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-400 text-sm">
                <AlertCircle size={17} className="flex-shrink-0" />
                <span>Configurazione Supabase mancante</span>
              </div>
              <p className="text-stone-300 leading-relaxed">
                Il file <code className="bg-stone-950 px-1.5 py-0.5 rounded text-amber-300 font-mono">.env</code> non è configurato. Inserisci l'URL e la Anon Key di Supabase:
              </p>
              <div className="bg-stone-950/90 p-3 rounded-xl font-mono text-[11px] text-stone-300 border border-stone-800 select-all space-y-1">
                <div className="text-stone-500"># Inserisci nel file .env:</div>
                <div className="text-amber-300">VITE_SUPABASE_URL=https://xyz.supabase.co</div>
                <div className="text-amber-300">VITE_SUPABASE_ANON_KEY=eyJhbG...</div>
              </div>
            </div>
          )}

          {/* Segmented Switcher Accedi / Registrati (solo quando non siamo in recovery) */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="flex gap-1.5 mb-6 p-1.5 bg-stone-950/60 light:bg-stone-100 rounded-2xl border border-stone-800/60 light:border-stone-200/60">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/15'
                    : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                }`}
              >
                Accedi
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/15'
                    : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                }`}
              >
                Crea account
              </button>
            </div>
          )}

          {/* Torna indietro da "Password dimenticata" */}
          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
                setSuccessMessage(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-stone-400 light:text-stone-600 hover:text-amber-400 light:hover:text-amber-700 font-medium mb-4 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Torna all'accesso</span>
            </button>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Email (signin, signup, forgot) */}
            {mode !== 'update-password' && (
              <div>
                <label className="block text-xs font-semibold text-stone-300 light:text-stone-700 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400 pointer-events-none"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-950/50 light:bg-stone-50/80 border border-stone-800 light:border-stone-300/80 rounded-xl text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-medium"
                    placeholder="nome@esempio.it"
                  />
                </div>
              </div>
            )}

            {/* Campo Password (signin, signup, update-password) */}
            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-stone-300 light:text-stone-700 uppercase tracking-wider">
                    {mode === 'update-password' ? 'Nuova password' : 'Password'}
                  </label>

                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs text-amber-400/90 light:text-amber-700 hover:text-amber-300 light:hover:text-amber-800 hover:underline cursor-pointer transition-colors"
                    >
                      Password dimenticata?
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Lock
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400 pointer-events-none"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-stone-950/50 light:bg-stone-50/80 border border-stone-800 light:border-stone-300/80 rounded-xl text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-medium"
                    placeholder="Minimo 6 caratteri"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 light:hover:text-stone-700 p-1 cursor-pointer transition-colors"
                    title={showPassword ? 'Nascondi password' : 'Mostra password'}
                    aria-label="Mostra o nascondi password"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Indicatore di forza password in tempo reale (signup e update-password) */}
                {(mode === 'signup' || mode === 'update-password') && password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-400 light:text-stone-500">Sicurezza:</span>
                      <span className="font-semibold text-stone-300 light:text-stone-700">{strength.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 h-1 w-full bg-stone-800 light:bg-stone-200 rounded-full overflow-hidden">
                      <div className={`h-full ${strength.score >= 1 ? strength.color : 'opacity-20'}`} />
                      <div className={`h-full ${strength.score >= 2 ? strength.color : 'opacity-20'}`} />
                      <div className={`h-full ${strength.score >= 3 ? strength.color : 'opacity-20'}`} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Campo Conferma Password (solo per update-password) */}
            {mode === 'update-password' && (
              <div>
                <label className="block text-xs font-semibold text-stone-300 light:text-stone-700 uppercase tracking-wider mb-1.5">
                  Conferma nuova password
                </label>
                <div className="relative">
                  <Lock
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 light:text-stone-400 pointer-events-none"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-950/50 light:bg-stone-50/80 border border-stone-800 light:border-stone-300/80 rounded-xl text-stone-100 light:text-stone-900 placeholder-stone-500 light:placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all text-sm font-medium"
                    placeholder="Ripeti la password"
                  />
                </div>
              </div>
            )}

            {/* Avviso di errore */}
            {error && (
              <div className="flex items-start gap-2 text-xs text-red-400 light:text-red-700 bg-red-500/10 light:bg-red-50 border border-red-500/20 light:border-red-200 rounded-xl p-3 animate-fade-up">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Messaggio di successo (es. link inviato) */}
            {successMessage && (
              <div className="flex items-start gap-2 text-xs text-emerald-400 light:text-emerald-800 bg-emerald-500/10 light:bg-emerald-50 border border-emerald-500/25 light:border-emerald-200 rounded-xl p-3.5 animate-fade-up">
                <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5 text-emerald-400 light:text-emerald-700" />
                <span className="leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* Pulsante di invio principale */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-450 hover:from-amber-450 hover:to-amber-400 active:scale-98 disabled:opacity-50 text-stone-950 font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-stone-950" />
                  <span>Elaborazione in corso...</span>
                </>
              ) : mode === 'signin' ? (
                <>
                  <span>Entra nella libreria</span>
                  <ArrowRight size={17} />
                </>
              ) : mode === 'signup' ? (
                <>
                  <span>Registrati e inizia</span>
                  <Sparkles size={17} />
                </>
              ) : mode === 'forgot' ? (
                <>
                  <span>Invia link di recupero</span>
                  <Mail size={17} />
                </>
              ) : (
                <>
                  <span>Salva nuova password</span>
                  <ShieldCheck size={17} />
                </>
              )}
            </button>

            {/* Annulla recovery se in update-password */}
            {mode === 'update-password' && (
              <button
                type="button"
                onClick={() => {
                  clearPasswordRecovery();
                  setMode('signin');
                }}
                className="w-full text-center text-xs text-stone-400 hover:text-stone-200 light:hover:text-stone-800 py-1 transition-colors cursor-pointer"
              >
                Annulla e torna al login
              </button>
            )}
          </form>

          {/* Dettaglio di stile decorativo */}
          <div className="mt-6 pt-5 border-t border-stone-800/60 light:border-stone-200/60 text-center">
            <p className="font-serif italic text-xs text-stone-400 light:text-stone-600">
              «Un lettore vive mille vite prima di morire.»
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
