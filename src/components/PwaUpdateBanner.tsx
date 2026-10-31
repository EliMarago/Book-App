import { useState } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { usePwaUpdate } from '@/lib/pwaUpdater';

export function PwaUpdateBanner() {
  const { needRefresh, applyUpdate } = usePwaUpdate();
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (!needRefresh || dismissed) {
    return null;
  }

  const handleUpdate = async () => {
    setUpdating(true);
    await applyUpdate();
  };

  return (
    <aside
      aria-label="Notifica di aggiornamento applicazione"
      className="fixed bottom-24 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-stone-900/95 backdrop-blur-md border border-amber-500/40 rounded-2xl p-4 shadow-2xl shadow-black/60 flex items-center justify-between gap-3 text-stone-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-100 leading-tight">
              Aggiornamento disponibile
            </p>
            <p className="text-xs text-stone-400 mt-0.5 truncate">
              Nuove modifiche pronte per l'uso
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleUpdate}
            disabled={updating}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-60 text-stone-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
          >
            <RefreshCw size={13} className={updating ? 'animate-spin' : ''} />
            <span>{updating ? 'Aggiorno...' : 'Aggiorna ora'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 text-stone-500 hover:text-stone-300 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            title="Ignora per ora"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
