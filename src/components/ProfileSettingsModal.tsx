import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User as UserIcon,
  Sun,
  Moon,
  SunMoon,
  LayoutGrid,
  Library,
  Database,
  RefreshCw,
  Lock,
  LogOut,
  Check,
  Loader2,
  BookOpen,
  Trophy,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { supabase, type Book } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, type ThemePreference } from '@/hooks/useTheme';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { checkForAppUpdate, usePwaUpdate } from '@/lib/pwaUpdater';
import { useToast } from './Toast';
import { APP_VERSION_LABEL } from '@/version';

const PROFILE_AVATAR_KEY = 'bookshelf_profile_avatar';

export const READER_AVATARS = [
  { id: 'initial', label: 'Iniziale', emoji: '' },
  { id: 'books', label: 'Libri', emoji: '📚' },
  { id: 'coffee', label: 'Caffè', emoji: '☕' },
  { id: 'moon', label: 'Notturno', emoji: '🌙' },
  { id: 'quill', label: 'Penna', emoji: '🪶' },
  { id: 'sparkles', label: 'Magia', emoji: '✨' },
  { id: 'leaf', label: 'Natura', emoji: '🌿' },
  { id: 'crown', label: 'Reale', emoji: '👑' },
] as const;

export function getStoredProfileAvatar(metaAvatar?: string | null): string {
  try {
    const saved = localStorage.getItem(PROFILE_AVATAR_KEY);
    if (saved) return saved;
  } catch {
    // ignore
  }
  if (metaAvatar) return metaAvatar;
  return 'initial';
}

interface ProfileSettingsModalProps {
  books: Book[];
  viewMode: 'grid' | 'shelf';
  onViewModeChange: (mode: 'grid' | 'shelf') => void;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  onSyncNow: () => void;
  onOpenBackup: () => void;
  onProfileUpdated: (avatar: string) => void;
  onClose: () => void;
}

export function ProfileSettingsModal({
  books,
  viewMode,
  onViewModeChange,
  isSyncing,
  lastSyncedAt,
  onSyncNow,
  onOpenBackup,
  onProfileUpdated,
  onClose,
}: ProfileSettingsModalProps) {
  useBodyScrollLock();
  const { user, updatePassword, signOut } = useAuth();
  const { themePreference, setTheme } = useTheme();
  const { toast } = useToast();
  const { needRefresh, applyUpdate } = usePwaUpdate();

  const metaAvatar = (user?.user_metadata?.avatar_icon as string | undefined) ?? null;
  const [avatarId, setAvatarId] = useState(() => getStoredProfileAvatar(metaAvatar));

  // Stato cambio password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassText, setShowPassText] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Stato controllo aggiornamenti
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Stato conferma logout
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPasswordForm) {
          setShowPasswordForm(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, showPasswordForm]);

  const stats = useMemo(() => {
    const completed = books.filter((b) => b.status === 'completed');
    const reading = books.filter((b) => b.status === 'reading');
    const pagesFromCompleted = completed.reduce((acc, b) => acc + (b.pages || b.read_pages || 0), 0);
    const pagesFromReading = reading.reduce((acc, b) => acc + (b.read_pages || 0), 0);
    return {
      total: books.length,
      completed: completed.length,
      reading: reading.length,
      totalPages: pagesFromCompleted + pagesFromReading,
    };
  }, [books]);

  const selectedAvatarObj = READER_AVATARS.find((a) => a.id === avatarId) ?? READER_AVATARS[0];
  const initialLetter = (user?.email || 'L').trim().charAt(0).toUpperCase();

  const handleSelectAvatar = async (nextAvatarId: string) => {
    try {
      localStorage.setItem(PROFILE_AVATAR_KEY, nextAvatarId);
    } catch {
      // ignore
    }
    setAvatarId(nextAvatarId);
    onProfileUpdated(nextAvatarId);

    try {
      await supabase.auth.updateUser({
        data: {
          avatar_icon: nextAvatarId,
        },
      });
    } catch {
      // ignore offline error, saved locally
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ message: 'La nuova password deve avere almeno 8 caratteri.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ message: 'Le due password non coincidono.', type: 'error' });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast({ message: `Errore: ${error}`, type: 'error' });
      } else {
        toast({ message: 'Password aggiornata con successo!', type: 'success' });
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordForm(false);
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      if (needRefresh) {
        await applyUpdate();
        return;
      }
      const found = await checkForAppUpdate();
      if (found) {
        toast({ message: 'Nuova versione trovata! Clicca "Aggiorna ora" nel banner.', type: 'info' });
      } else {
        toast({ message: `L'app è già aggiornata all'ultima versione (${APP_VERSION_LABEL}).`, type: 'success' });
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const themeOptions: Array<{ id: ThemePreference; label: string; icon: typeof Sun }> = [
    { id: 'system', label: 'Automatico', icon: SunMoon },
    { id: 'dark', label: 'Scuro', icon: Moon },
    { id: 'light', label: 'Chiaro', icon: Sun },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profilo e Impostazioni"
      className="fixed inset-0 bg-stone-950/80 light:bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-up"
      onClick={onClose}
    >
      <div
        className="bg-stone-900 light:bg-white rounded-t-3xl sm:rounded-3xl border-t sm:border border-stone-800 light:border-stone-200 max-w-lg w-full h-[94dvh] sm:h-auto sm:max-h-[88dvh] flex flex-col shadow-2xl overflow-hidden overscroll-contain modal-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Maniglia mobile */}
        <div className="w-10 h-1 rounded-full bg-stone-700 light:bg-stone-300 mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-stone-800 light:border-stone-200 shrink-0 bg-stone-900 light:bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700 shrink-0">
              <UserIcon size={18} />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-100 light:text-stone-900 leading-tight">
                Profilo e Impostazioni
              </h2>
              <p className="text-xs text-stone-400 light:text-stone-500">
                Personalizza il tuo account e le preferenze della libreria
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-800/90 light:bg-stone-100 border border-stone-700 light:border-stone-300 flex items-center justify-center text-stone-200 light:text-stone-700 hover:text-stone-100 light:hover:text-stone-950 hover:bg-stone-750 light:hover:bg-stone-200 transition-colors cursor-pointer shrink-0 active:scale-95"
            aria-label="Chiudi profilo e impostazioni"
          >
            <X size={18} />
          </button>
        </div>

        {/* CORPO SCORREVOLE */}
        <div className="p-4 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] sm:pb-6 overflow-y-auto flex-1 space-y-5 scrollbar-thin">
          {/* 1. SCHEDA PROFILO LETTORE */}
          <div className="rounded-2xl border border-amber-500/25 light:border-amber-300/80 bg-gradient-to-br from-amber-950/25 via-stone-850/90 to-stone-900 light:from-amber-50/80 light:via-white light:to-amber-50/30 p-4 space-y-4 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-stone-950 font-serif font-bold text-xl flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0 select-none">
                {selectedAvatarObj.emoji ? (
                  <span className="text-xl leading-none">{selectedAvatarObj.emoji}</span>
                ) : (
                  initialLetter
                )}
              </div>

              <div className="flex-1 min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-amber-400/90 light:text-amber-700">
                  Account collegato
                </span>
                <p className="text-sm sm:text-base font-semibold text-stone-100 light:text-stone-900 truncate mt-0.5">
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Selettore Avatar rapido */}
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400 light:text-stone-500 mb-2">
                Icona profilo
              </span>
              <div className="grid grid-cols-8 gap-1.5">
                {READER_AVATARS.map((av) => {
                  const isSelected = avatarId === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => handleSelectAvatar(av.id)}
                      title={av.label}
                      className={`h-9 rounded-xl border flex items-center justify-center text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-amber-500/25 light:bg-amber-100 border-amber-400 text-amber-300 light:text-amber-900 ring-1 ring-amber-400/50'
                          : 'bg-stone-900/70 light:bg-white border-stone-800 light:border-stone-200 text-stone-300 light:text-stone-700 hover:border-stone-700'
                      }`}
                    >
                      {av.emoji || initialLetter}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Statistiche rapide del lettore */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-500/15 light:border-amber-200/70">
              <div className="rounded-xl bg-stone-900/70 light:bg-white/90 border border-stone-800/80 light:border-stone-200/80 p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-amber-400 light:text-amber-600 text-sm sm:text-base font-serif font-bold tabular-nums">
                  <BookOpen size={14} />
                  <span>{stats.total}</span>
                </div>
                <div className="text-[11px] text-stone-400 light:text-stone-500 mt-0.5">Libri totali</div>
              </div>

              <div className="rounded-xl bg-stone-900/70 light:bg-white/90 border border-stone-800/80 light:border-stone-200/80 p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-400 light:text-emerald-700 text-sm sm:text-base font-serif font-bold tabular-nums">
                  <Trophy size={14} />
                  <span>{stats.completed}</span>
                </div>
                <div className="text-[11px] text-stone-400 light:text-stone-500 mt-0.5">Libri letti</div>
              </div>

              <div className="rounded-xl bg-stone-900/70 light:bg-white/90 border border-stone-800/80 light:border-stone-200/80 p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-sky-400 light:text-sky-700 text-sm sm:text-base font-serif font-bold tabular-nums">
                  <Layers size={14} />
                  <span>{stats.totalPages.toLocaleString('it-IT')}</span>
                </div>
                <div className="text-[11px] text-stone-400 light:text-stone-500 mt-0.5">Pagine lette</div>
              </div>
            </div>
          </div>

          {/* 2. PREFERENZE & ASPETTO */}
          <div className="rounded-2xl border border-stone-800 light:border-stone-200 bg-stone-850/70 light:bg-stone-50/80 p-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 light:text-stone-500">
              Aspetto e Preferenze
            </h4>

            {/* Selettore Tema */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-stone-200 light:text-stone-800">
                Tema dell'applicazione
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-stone-900 light:bg-stone-200/70 border border-stone-800 light:border-stone-300/80">
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const active = themePreference === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme(opt.id)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        active
                          ? 'btn-amber text-stone-950 shadow-xs'
                          : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selettore Vista Libreria */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-stone-200 light:text-stone-800">
                Vista libreria attiva
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-stone-900 light:bg-stone-200/70 border border-stone-800 light:border-stone-300/80">
                <button
                  type="button"
                  onClick={() => onViewModeChange('grid')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'grid'
                      ? 'btn-amber text-stone-950 shadow-xs'
                      : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                  }`}
                >
                  <LayoutGrid size={14} />
                  <span>Schede dettagliate</span>
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange('shelf')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    viewMode === 'shelf'
                      ? 'btn-amber text-stone-950 shadow-xs'
                      : 'text-stone-400 light:text-stone-600 hover:text-stone-200 light:hover:text-stone-900'
                  }`}
                >
                  <Library size={14} />
                  <span>Scaffale 3D</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. DATI, BACKUP E AGGIORNAMENTI */}
          <div className="rounded-2xl border border-stone-800 light:border-stone-200 bg-stone-850/70 light:bg-stone-50/80 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 light:text-stone-500">
              Dati, Cloud e Applicazione
            </h4>

            {/* Riga Sincronizzazione Cloud */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-900/70 light:bg-white border border-stone-800/80 light:border-stone-200/90">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-stone-200 light:text-stone-800">
                  Sincronizzazione Cloud
                </div>
                <div className="text-[11px] text-stone-400 light:text-stone-500 leading-snug mt-0.5">
                  {lastSyncedAt
                    ? `Ultimo sync: ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : 'Dati sincronizzati con Supabase'}
                </div>
              </div>
              <button
                type="button"
                onClick={onSyncNow}
                disabled={isSyncing}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200 text-stone-200 light:text-stone-800 border border-stone-700 light:border-stone-300 text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={13} className={`text-amber-400 light:text-amber-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizzo...' : 'Sincronizza'}</span>
              </button>
            </div>

            {/* Riga Backup JSON */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-900/70 light:bg-white border border-stone-800/80 light:border-stone-200/90">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-stone-200 light:text-stone-800">
                  Backup e Ripristino JSON
                </div>
                <div className="text-[11px] text-stone-400 light:text-stone-500 leading-snug mt-0.5">
                  Esporta o importa copia di sicurezza ({stats.total} {stats.total === 1 ? 'libro' : 'libri'})
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBackup();
                }}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200 text-stone-200 light:text-stone-800 border border-stone-700 light:border-stone-300 text-xs font-semibold transition-all cursor-pointer active:scale-95"
              >
                <Database size={13} className="text-amber-400 light:text-amber-600" />
                <span>Gestisci</span>
              </button>
            </div>

            {/* Riga Versione App */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-900/70 light:bg-white border border-stone-800/80 light:border-stone-200/90">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-stone-200 light:text-stone-800">
                  Versione Bookshelf
                </div>
                <div className="text-[11px] font-mono text-stone-400 light:text-stone-500 mt-0.5">
                  {APP_VERSION_LABEL} {needRefresh ? '· Aggiornamento pronto!' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                  needRefresh
                    ? 'btn-amber text-stone-950'
                    : 'bg-stone-800 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200 text-stone-200 light:text-stone-800 border border-stone-700 light:border-stone-300'
                }`}
              >
                {checkingUpdate ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} className={needRefresh ? 'text-stone-950' : 'text-amber-400 light:text-amber-600'} />
                )}
                <span>{needRefresh ? 'Aggiorna ora' : 'Verifica update'}</span>
              </button>
            </div>
          </div>

          {/* 4. ACCOUNT & SICUREZZA */}
          <div className="rounded-2xl border border-stone-800 light:border-stone-200 bg-stone-850/70 light:bg-stone-50/80 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 light:text-stone-500">
              Account e Sicurezza
            </h4>

            {/* Cambio Password */}
            <div className="rounded-xl bg-stone-900/70 light:bg-white border border-stone-800/80 light:border-stone-200/90 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Lock size={14} className="text-amber-400 light:text-amber-600 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-stone-200 light:text-stone-800">
                      Password di accesso
                    </div>
                    <div className="text-[11px] text-stone-400 light:text-stone-500">
                      Aggiorna la password del tuo account
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordForm((v) => !v)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-stone-800 light:bg-stone-100 hover:bg-stone-750 light:hover:bg-stone-200 text-stone-200 light:text-stone-800 border border-stone-700 light:border-stone-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  {showPasswordForm ? 'Annulla' : 'Cambia'}
                </button>
              </div>

              {showPasswordForm && (
                <form onSubmit={handlePasswordSubmit} className="mt-3 pt-3 border-t border-stone-800 light:border-stone-200 space-y-2.5 animate-fade-up">
                  <div className="relative">
                    <input
                      type={showPassText ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                      placeholder="Nuova password (min. 8 caratteri)"
                      className="w-full pl-3 pr-9 py-2 bg-stone-950/70 light:bg-stone-50 border border-stone-700 light:border-stone-300 rounded-xl text-base sm:text-xs text-stone-100 light:text-stone-900 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassText((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-1 cursor-pointer"
                      aria-label="Mostra o nascondi password"
                    >
                      {showPassText ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <input
                    type={showPassText ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                    placeholder="Conferma nuova password"
                    className="w-full px-3 py-2 bg-stone-950/70 light:bg-stone-50 border border-stone-700 light:border-stone-300 rounded-xl text-base sm:text-xs text-stone-100 light:text-stone-900 focus:outline-none focus:border-amber-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingPassword || !newPassword || !confirmPassword}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-amber text-stone-950 text-xs font-bold cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {savingPassword ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      <span>Salva nuova password</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Disconnessione / Esci */}
            {confirmingSignOut ? (
              <div className="p-3 rounded-xl bg-red-500/10 light:bg-red-50 border border-red-500/30 light:border-red-200 flex items-center justify-between gap-2 animate-fade-up">
                <span className="text-xs text-red-300 light:text-red-800 font-medium">
                  Confermi l'uscita dall'account?
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmingSignOut(false)}
                    className="px-3 py-1.5 rounded-lg bg-stone-800 light:bg-white text-stone-200 light:text-stone-700 border border-stone-700 light:border-stone-300 text-xs font-semibold cursor-pointer"
                  >
                    Resta
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      signOut();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold cursor-pointer active:scale-95"
                  >
                    Esci ora
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingSignOut(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900/80 light:bg-white hover:bg-red-500/10 light:hover:bg-red-50 text-stone-300 light:text-stone-700 hover:text-red-400 light:hover:text-red-600 border border-stone-800 light:border-stone-200/90 hover:border-red-500/30 text-xs font-semibold transition-all cursor-pointer active:scale-98"
              >
                <LogOut size={15} />
                <span>Esci dall'account</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

