import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  /** Testo del pulsante azione (es. "Annulla") */
  actionLabel?: string;
  onAction?: () => void;
  /** Durata in ms (default 4000) */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, 'message' | 'type' | 'duration'>> {
  id: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const STYLES: Record<ToastType, { icon: ReactNode; bar: string; ring: string }> = {
  success: {
    icon: <CheckCircle2 size={18} className="text-emerald-400 light:text-emerald-600" />,
    bar: 'bg-emerald-400',
    ring: 'border-emerald-500/30 light:border-emerald-300',
  },
  error: {
    icon: <AlertCircle size={18} className="text-red-400 light:text-red-600" />,
    bar: 'bg-red-400',
    ring: 'border-red-500/30 light:border-red-300',
  },
  info: {
    icon: <Info size={18} className="text-amber-400 light:text-amber-600" />,
    bar: 'bg-amber-400',
    ring: 'border-amber-500/30 light:border-amber-300',
  },
};

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const style = STYLES[item.type];

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(t);
  }, [paused, item.id, item.duration, onDismiss]);

  return (
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`relative overflow-hidden pointer-events-auto w-full max-w-sm flex items-center gap-3 pl-3.5 pr-2 py-3 rounded-xl border bg-stone-900/95 light:bg-white/95 backdrop-blur-md shadow-xl shadow-black/30 light:shadow-stone-400/30 animate-toast-in ${style.ring}`}
    >
      <span className="shrink-0">{style.icon}</span>
      <p className="flex-1 min-w-0 text-sm text-stone-100 light:text-stone-900 leading-snug">{item.message}</p>
      {item.actionLabel && (
        <button
          type="button"
          onClick={() => {
            item.onAction?.();
            onDismiss(item.id);
          }}
          className="shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg text-amber-300 light:text-amber-800 bg-amber-500/15 light:bg-amber-100 hover:bg-amber-500/25 light:hover:bg-amber-200 transition-colors cursor-pointer active:scale-95"
        >
          {item.actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 p-1 rounded-md text-stone-500 hover:text-stone-200 light:hover:text-stone-800 transition-colors cursor-pointer"
        aria-label="Chiudi notifica"
      >
        <X size={14} />
      </button>
      {/* Barra del tempo residuo */}
      <span
        className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${style.bar} opacity-70`}
        style={{
          animation: `toast-progress ${item.duration}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    const item: ToastItem = {
      id,
      message: options.message,
      type: options.type ?? 'success',
      duration: options.duration ?? 4000,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    };
    // Massimo 3 notifiche contemporanee
    setItems((prev) => [...prev.slice(-2), item]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed inset-x-0 bottom-20 sm:bottom-0 z-[60] flex flex-col items-center gap-2 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
      >
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
