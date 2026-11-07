import React, { useEffect } from 'react';
import { X, RotateCcw, Check, Palette, Sparkles, Eye, SunMedium } from 'lucide-react';
import {
  type BookshelfHoliday,
  HOLIDAY_OPTIONS,
  BookshelfDecoration,
  ChristmasShelfLights,
  getAutoHoliday,
} from './BookshelfDecorations';

export type ShelfWoodType = 'walnut' | 'oak' | 'cherry' | 'white' | 'ebony';
export type ShelfWallBackground = 'clean' | 'brick' | 'boiserie' | 'plaster';
export type LightsSetting = 'auto' | 'always' | 'off';

export interface BookshelfCustomization {
  wood: ShelfWoodType;
  background: ShelfWallBackground;
  holiday: BookshelfHoliday;
  showDecorations: boolean;
  lights: LightsSetting;
  showShelfLabels: boolean;
}

export const DEFAULT_BOOKSHELF_CUSTOMIZATION: BookshelfCustomization = {
  wood: 'walnut',
  background: 'clean',
  holiday: 'auto',
  showDecorations: true,
  lights: 'auto',
  showShelfLabels: true,
};

const WOOD_OPTIONS: { id: ShelfWoodType; label: string; desc: string; sampleGradient: string }[] = [
  {
    id: 'walnut',
    label: 'Noce Scuro',
    desc: 'Caldo, classico e profondo',
    sampleGradient: 'from-[#4a2918] via-[#633720] to-[#2c140a]',
  },
  {
    id: 'oak',
    label: 'Rovere Chiaro',
    desc: 'Luminoso, naturale e moderno',
    sampleGradient: 'from-[#deb078] via-[#af7c40] to-[#5a3812]',
  },
  {
    id: 'cherry',
    label: 'Ciliegio Caldo',
    desc: 'Sfumature rossastre eleganti',
    sampleGradient: 'from-[#a33b3b] via-[#661e1e] to-[#240808]',
  },
  {
    id: 'white',
    label: 'Frassino Bianco',
    desc: 'Stile nordico minimale',
    sampleGradient: 'from-[#ffffff] via-[#e2e8f0] to-[#94a3b8]',
  },
  {
    id: 'ebony',
    label: 'Ebano Nero',
    desc: 'Nero industriale contemporaneo',
    sampleGradient: 'from-[#3f3f46] via-[#18181b] to-[#09090b]',
  },
];

const BACKGROUND_OPTIONS: {
  id: ShelfWallBackground;
  label: string;
  desc: string;
  previewClass: string;
}[] = [
  {
    id: 'clean',
    label: 'Pulito / Trasparente',
    desc: 'Nessun pattern, risalto assoluto per i libri',
    previewClass: 'bg-stone-900 border border-stone-750 light:bg-stone-100 light:border-stone-300',
  },
  {
    id: 'brick',
    label: 'Mattoncini Loft',
    desc: 'Mattoni a vista stile appartamento newyorkese',
    previewClass: 'bookshelf-brick-wall border border-amber-900/40',
  },
  {
    id: 'boiserie',
    label: 'Boiserie a Doghe',
    desc: 'Pannelli di legno scuro da biblioteca signorile',
    previewClass: 'bookshelf-wall-boiserie border border-amber-950/60',
  },
  {
    id: 'plaster',
    label: 'Intonaco Vellutato',
    desc: 'Luce morbida e texture calda soffusa',
    previewClass: 'bookshelf-wall-plaster border border-stone-800',
  },
];

interface BookshelfCustomizationModalProps {
  customization: BookshelfCustomization;
  onChange: (customization: BookshelfCustomization) => void;
  onClose: () => void;
}

export function BookshelfCustomizationModal({
  customization,
  onChange,
  onClose,
}: BookshelfCustomizationModalProps) {
  // Chiudi con il tasto ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const update = <K extends keyof BookshelfCustomization>(key: K, value: BookshelfCustomization[K]) => {
    onChange({
      ...customization,
      [key]: value,
    });
  };

  const handleReset = () => {
    onChange(DEFAULT_BOOKSHELF_CUSTOMIZATION);
  };

  const wallBgClass =
    customization.background === 'brick'
      ? 'bookshelf-brick-wall'
      : customization.background === 'boiserie'
        ? 'bookshelf-wall-boiserie'
        : customization.background === 'plaster'
          ? 'bookshelf-wall-plaster'
          : 'bg-stone-950/40 light:bg-stone-100/60 border border-stone-800/80 light:border-stone-200/80';

  const effectiveHoliday =
    customization.holiday === 'auto' ? getAutoHoliday() : customization.holiday;
  const showPreviewLights =
    customization.lights === 'always' ||
    (customization.lights === 'auto' && effectiveHoliday === 'christmas');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click fuori per chiudere */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Contenitore Modal / Bottom Sheet */}
      <div className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-stone-900 light:bg-white border-t sm:border border-stone-750 light:border-stone-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Barra di trascinamento / handle per mobile */}
        <div className="sm:hidden w-12 h-1.5 mx-auto mt-2.5 -mb-1 bg-stone-700 light:bg-stone-300 rounded-full shrink-0" />

        {/* Intestazione */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-stone-800 light:border-stone-200 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700 shrink-0">
              <Palette size={16} />
            </div>
            <div>
              <h2 className="font-serif font-bold text-sm sm:text-base text-stone-100 light:text-stone-900 truncate">
                Personalizza Libreria
              </h2>
              <p className="text-[11px] text-stone-400 light:text-stone-500">
                Scegli essenza legno, parete, luci e addobbi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-200 light:text-stone-500 light:hover:text-stone-900 hover:bg-stone-800 light:hover:bg-stone-100 transition-colors cursor-pointer"
            title="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo scorrevole */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin">
          {/* 1. ANTEPRIMA DAL VIVO (Live Preview) */}
          <div className="rounded-2xl p-3 border border-stone-800 light:border-stone-200 bg-stone-950/60 light:bg-stone-50">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-stone-400 light:text-stone-500 font-sans flex items-center gap-1">
                <Eye size={12} className="text-amber-400" />
                Anteprima
              </span>
              <span className="text-[11px] text-stone-500 light:text-stone-400">
                Aggiornata in tempo reale
              </span>
            </div>

            {/* Scenetta di anteprima con lo sfondo e la mensola scelti */}
            <div className={`rounded-xl p-3 sm:p-4 overflow-hidden relative ${wallBgClass}`}>
              {/* Lucine se attive */}
              {showPreviewLights ? (
                <div className="relative -mt-2 -mb-2 pointer-events-none">
                  <ChristmasShelfLights />
                </div>
              ) : null}

              <div className="flex items-end justify-between min-h-[90px] px-2 sm:px-4">
                {/* 2 Libri d'anteprima */}
                <div className="flex items-end gap-1.5 pb-0.5">
                  <div className="w-8 h-20 rounded-t-xs bg-gradient-to-r from-red-800 to-red-950 border-t border-red-500/30 shadow-md flex items-center justify-center">
                    <span className="writing-vertical-rl text-[9px] text-red-200 font-serif font-bold truncate max-h-14">
                      Classic
                    </span>
                  </div>
                  <div className="w-10 h-24 rounded-t-xs bg-gradient-to-r from-amber-700 to-amber-900 border-t border-amber-500/30 shadow-md flex items-center justify-center">
                    <span className="writing-vertical-rl text-[9px] text-amber-200 font-serif font-bold truncate max-h-16">
                      Stories
                    </span>
                  </div>
                </div>

                {/* Oggetto decorativo d'anteprima */}
                {customization.showDecorations && (
                  <div className="pb-0.5 scale-90 origin-bottom-right">
                    <BookshelfDecoration holiday={effectiveHoliday} shelfIndex={0} />
                  </div>
                )}
              </div>

              {/* Mensola in legno dell'anteprima */}
              <div className={`floating-wood-shelf w-full wood-${customization.wood} relative z-10`}>
                <div className="floating-wood-shelf-top w-full rounded-t-xs" />
                <div className="floating-wood-shelf-front w-full flex items-center justify-between px-3">
                  <span className="font-serif text-[10px] font-semibold tracking-wider uppercase truncate">
                    {customization.showShelfLabels ? 'La tua Libreria' : ''}
                  </span>
                  <span className="text-[9.5px] opacity-70">
                    {customization.showShelfLabels ? '2 volumi' : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. FINITURA LEGNO DELLE MENSOLE */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-300 light:text-stone-700 mb-2 font-sans">
              1. Finitura del Legno
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WOOD_OPTIONS.map((w) => {
                const isSelected = customization.wood === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => update('wood', w.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 light:bg-amber-50/80 ring-1 ring-amber-400'
                        : 'border-stone-800 light:border-stone-200 bg-stone-850/60 light:bg-stone-100 hover:border-stone-700'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg bg-gradient-to-br ${w.sampleGradient} border border-white/20 shrink-0 shadow-inner flex items-center justify-center text-white`}
                    >
                      {isSelected && <Check size={14} className="stroke-[3]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-stone-200 light:text-stone-900 truncate">
                        {w.label}
                      </div>
                      <div className="text-[10px] text-stone-400 light:text-stone-500 truncate">
                        {w.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. SFONDO DELLA LIBRERIA */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-300 light:text-stone-700 mb-2 font-sans">
              2. Sfondo Parete
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BACKGROUND_OPTIONS.map((bg) => {
                const isSelected = customization.background === bg.id;
                return (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => update('background', bg.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 light:bg-amber-50/80 ring-1 ring-amber-400'
                        : 'border-stone-800 light:border-stone-200 bg-stone-850/60 light:bg-stone-100 hover:border-stone-700'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg ${bg.previewClass} shrink-0 flex items-center justify-center text-amber-400 shadow-xs`}
                    >
                      {isSelected && <Check size={14} className="stroke-[3]" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-stone-200 light:text-stone-900 truncate">
                        {bg.label}
                      </div>
                      <div className="text-[10px] text-stone-400 light:text-stone-500 truncate">
                        {bg.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. FESTIVITÀ & STAGIONE */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-300 light:text-stone-700 mb-2 font-sans">
              3. Tema Festivo & Stagionale
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {HOLIDAY_OPTIONS.map((h) => {
                const isSelected = customization.holiday === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => update('holiday', h.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 light:bg-amber-50/80 ring-1 ring-amber-400'
                        : 'border-stone-800 light:border-stone-200 bg-stone-850/60 light:bg-stone-100 hover:border-stone-700'
                    }`}
                  >
                    <span className="text-xl leading-none">{h.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-stone-200 light:text-stone-900 truncate">
                        {h.label}
                      </div>
                      <div className="text-[10px] text-stone-400 light:text-stone-500 truncate">
                        {h.desc}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. DETTAGLI & LUCINE */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-300 light:text-stone-700 mb-2 font-sans">
              4. Dettagli & Atmosfera
            </label>
            <div className="space-y-2.5">
              {/* Toggle Decorazioni */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-850/60 light:bg-stone-100 border border-stone-800 light:border-stone-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 light:bg-emerald-100 border border-emerald-500/30 light:border-emerald-300 flex items-center justify-center text-emerald-400 light:text-emerald-700">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-200 light:text-stone-900">
                      Oggetti Decorativi
                    </div>
                    <div className="text-[10px] text-stone-400 light:text-stone-500">
                      Piantine, zucche, alberelli e addobbi a fine mensola (vista dorsi)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('showDecorations', !customization.showDecorations)}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative ${
                    customization.showDecorations
                      ? 'bg-amber-500'
                      : 'bg-stone-700 light:bg-stone-300'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      customization.showDecorations ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle Nomi Sezioni incisi */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-stone-850/60 light:bg-stone-100 border border-stone-800 light:border-stone-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700">
                    <span className="font-serif font-black text-xs">Ab</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-200 light:text-stone-900">
                      Incisione sul Legno
                    </div>
                    <div className="text-[10px] text-stone-400 light:text-stone-500">
                      Mostra titolo sezione e conteggio volumi sul bordo frontale
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update('showShelfLabels', !customization.showShelfLabels)}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative ${
                    customization.showShelfLabels
                      ? 'bg-amber-500'
                      : 'bg-stone-700 light:bg-stone-300'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      customization.showShelfLabels ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Selettore Lucine Fairy Lights */}
              <div className="p-3 rounded-xl bg-stone-850/60 light:bg-stone-100 border border-stone-800 light:border-stone-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 light:bg-amber-100 border border-amber-500/30 light:border-amber-300 flex items-center justify-center text-amber-400 light:text-amber-700">
                      <SunMedium size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-stone-200 light:text-stone-900">
                        Lucine LED Natalizie
                      </div>
                      <div className="text-[10px] text-stone-400 light:text-stone-500">
                        Ghirlanda di micro-led sopra i libri
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(
                    [
                      { id: 'auto', label: 'Solo a Natale' },
                      { id: 'always', label: 'Sempre Accese' },
                      { id: 'off', label: 'Spente' },
                    ] as const
                  ).map((opt) => {
                    const isSelected = customization.lights === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => update('lights', opt.id)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-xs'
                            : 'bg-stone-900/60 light:bg-stone-200/70 text-stone-300 light:text-stone-700 border-stone-750 light:border-stone-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferiore */}
        <div className="flex items-center justify-between p-3.5 sm:px-6 border-t border-stone-800 light:border-stone-200 bg-stone-950/70 light:bg-stone-50/80 shrink-0 safe-area-pb">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-400 hover:text-stone-200 light:text-stone-600 light:hover:text-stone-900 hover:bg-stone-800/60 light:hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Ripristina default</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
          >
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
}
