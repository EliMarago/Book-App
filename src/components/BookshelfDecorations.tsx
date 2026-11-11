import React from 'react';

export type BookshelfHoliday = 'auto' | 'none' | 'christmas' | 'halloween' | 'easter' | 'autumn';

export const HOLIDAY_OPTIONS: {
  id: BookshelfHoliday;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    id: 'auto',
    label: 'Auto',
    icon: '✨',
    desc: 'Rileva automaticamente la stagione',
  },
  {
    id: 'none',
    label: 'Piante & Oggetti',
    icon: '🪴',
    desc: 'Monstera, bonsai, clessidra e globo',
  },
  {
    id: 'christmas',
    label: 'Natale',
    icon: '🎄',
    desc: 'Albero, gattino, pupazzo di neve e globo',
  },
  {
    id: 'halloween',
    label: 'Halloween',
    icon: '🎃',
    desc: 'Zucche intagliate, pozioni e candele',
  },
  {
    id: 'easter',
    label: 'Pasqua',
    icon: '🌷',
    desc: 'Tulipani in vaso, uova dipinte e nido',
  },
  {
    id: 'autumn',
    label: 'Autunno',
    icon: '🍁',
    desc: 'Zucca in velluto, infuso caldo e lanterne',
  },
];

export function getAutoHoliday(date = new Date()): Exclude<BookshelfHoliday, 'auto'> {
  const month = date.getMonth() + 1; // 1..12
  const day = date.getDate();

  if ((month === 11 && day >= 25) || month === 12 || (month === 1 && day <= 6)) {
    return 'christmas';
  }
  if (month === 10 && day >= 15) {
    return 'halloween';
  }
  if ((month === 3 && day >= 20) || (month === 4 && day <= 22)) {
    return 'easter';
  }
  if (month === 9 || month === 10 || month === 11) {
    return 'autumn';
  }
  return 'none';
}

/**
 * LUCINE FESTIVE DI NATALE (FESTONE APPESO ALLA MENSOLA IN STILE BOOKTOK TUTTE COLORATE)
 */
export function ChristmasShelfLights({ animated = true }: { animated?: boolean }) {
  const bulbs = [
    { x: '7.5%', color: '#ff4757', core: '#ffe0e3', halo: 'rgba(255, 71, 87, 0.85)', softHalo: 'rgba(255, 71, 87, 0.35)', delay: '0s' },
    { x: '19.5%', color: '#facc15', core: '#fef9c3', halo: 'rgba(250, 204, 21, 0.85)', softHalo: 'rgba(250, 204, 21, 0.35)', delay: '0.4s' },
    { x: '31.5%', color: '#4ade80', core: '#dcfce7', halo: 'rgba(74, 222, 128, 0.85)', softHalo: 'rgba(74, 222, 128, 0.35)', delay: '0.9s' },
    { x: '43.5%', color: '#60a5fa', core: '#dbeafe', halo: 'rgba(96, 165, 250, 0.85)', softHalo: 'rgba(96, 165, 250, 0.35)', delay: '0.2s' },
    { x: '55.5%', color: '#f472b6', core: '#fce7f3', halo: 'rgba(244, 114, 182, 0.85)', softHalo: 'rgba(244, 114, 182, 0.35)', delay: '0.7s' },
    { x: '67.5%', color: '#ff4757', core: '#ffe0e3', halo: 'rgba(255, 71, 87, 0.85)', softHalo: 'rgba(255, 71, 87, 0.35)', delay: '1.1s' },
    { x: '79.5%', color: '#facc15', core: '#fef9c3', halo: 'rgba(250, 204, 21, 0.85)', softHalo: 'rgba(250, 204, 21, 0.35)', delay: '0.5s' },
    { x: '91.5%', color: '#4ade80', core: '#dcfce7', halo: 'rgba(74, 222, 128, 0.85)', softHalo: 'rgba(74, 222, 128, 0.35)', delay: '0.8s' },
  ];

  return (
    <div className="w-full h-7 relative select-none pointer-events-none overflow-visible">
      {/* Cavo argentato/grigio chiaro festonato lungo il bordo della mensola */}
      <svg
        className="w-full h-5 overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 1000 22"
        fill="none"
      >
        {/* Ombra del cavo sul legno */}
        <path
          d="M 0 3 Q 38 14, 75 13 Q 135 1, 195 13 Q 255 1, 315 13 Q 375 1, 435 13 Q 495 1, 555 13 Q 615 1, 675 13 Q 735 1, 795 13 Q 855 1, 915 13 Q 958 14, 1000 3"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth="2.4"
          fill="none"
        />
        {/* Cavo argentato principale */}
        <path
          d="M 0 2 Q 38 13, 75 12 Q 135 0, 195 12 Q 255 0, 315 12 Q 375 0, 435 12 Q 495 0, 555 12 Q 615 0, 675 12 Q 735 0, 795 12 Q 855 0, 915 12 Q 958 13, 1000 2"
          stroke="#b8b3ad"
          strokeWidth="1.6"
          fill="none"
        />
      </svg>

      {/* Bulbi luminosi pendenti sotto il bordo della mensola */}
      {bulbs.map((b, i) => (
        <div
          key={i}
          className="absolute top-[8px] flex flex-col items-center"
          style={{ left: b.x, transform: 'translateX(-50%)' }}
        >
          {/* Portalampada */}
          <div className="w-[5px] h-[3.5px] bg-stone-500 border border-stone-700 rounded-t-[1px] z-10" />
          {/* Bulbo LED con bagliore morbido diffuso */}
          <div
            className={`w-[9px] h-[11px] sm:w-[10px] sm:h-[12px] rounded-full -mt-[0.5px] ${
              animated ? 'animate-pulse' : ''
            }`}
            style={{
              background: `radial-gradient(circle at 38% 35%, ${b.core} 0%, ${b.color} 55%, ${b.color} 100%)`,
              boxShadow: `0 2px 10px 3px ${b.halo}, 0 4px 20px 7px ${b.softHalo}`,
              animationDuration: '2.6s',
              animationDelay: b.delay,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* ============================================================================
   TEMA NATALIZIO (Christmas) — Albero di Natale realistico + Oggetti variati
   ============================================================================ */

/** 1. Albero di Natale 3D realistico in vaso di legno con palline di vetro, ghirlanda dorata e stella luminosa */
function ChristmasTreeProp() {
  return (
    <div className="relative w-[84px] sm:w-[96px] h-[108px] sm:h-[122px] select-none pointer-events-none flex items-end justify-center">
      {/* Alone caldo soffuso delle lucine */}
      <div className="absolute inset-x-2 top-2 bottom-4 rounded-full bg-amber-400/15 blur-xl" />
      <svg viewBox="0 0 110 136" className="w-full h-full overflow-visible drop-shadow-[0_10px_14px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="xmasPotGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8c3b2b" />
            <stop offset="30%" stopColor="#b8523e" />
            <stop offset="70%" stopColor="#7a2f20" />
            <stop offset="100%" stopColor="#4a1910" />
          </linearGradient>
          <linearGradient id="xmasPotRim" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a34836" />
            <stop offset="35%" stopColor="#d46853" />
            <stop offset="100%" stopColor="#5c2116" />
          </linearGradient>
          <linearGradient id="pineLayerDark" x1="20%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="#1f6f43" />
            <stop offset="55%" stopColor="#145331" />
            <stop offset="100%" stopColor="#092e1a" />
          </linearGradient>
          <linearGradient id="pineLayerMid" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="#2d8a56" />
            <stop offset="50%" stopColor="#1b683d" />
            <stop offset="100%" stopColor="#0d3d22" />
          </linearGradient>
          <linearGradient id="pineLayerTop" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="#3ca369" />
            <stop offset="55%" stopColor="#217848" />
            <stop offset="100%" stopColor="#114a2b" />
          </linearGradient>
          <radialGradient id="redBauble" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="30%" stopColor="#ef4444" />
            <stop offset="75%" stopColor="#b91c1c" />
            <stop offset="100%" stopColor="#690b0b" />
          </radialGradient>
          <radialGradient id="goldBauble" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="35%" stopColor="#facc15" />
            <stop offset="75%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#713f12" />
          </radialGradient>
          <radialGradient id="starGlow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>

        {/* Ombra di contatto sulla mensola */}
        <ellipse cx="55" cy="131" rx="38" ry="5.5" fill="rgba(0,0,0,0.65)" />

        {/* Pacchettino regalo poggiato ai piedi dell'albero a sinistra */}
        <g transform="translate(10, 107)">
          <rect x="0" y="6" width="20" height="17" rx="2" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="0.8" />
          <rect x="0" y="6" width="7" height="17" rx="1" fill="rgba(255,255,255,0.14)" />
          <rect x="-1" y="4" width="22" height="4" rx="1" fill="#dc2626" />
          <rect x="8.5" y="4" width="3" height="19" fill="#fbbf24" />
          <rect x="0" y="12" width="20" height="2.8" fill="#fbbf24" />
          <path d="M10 4 C6 0, 3 2, 6 4 C3 5, 7 6, 10 4 Z" fill="#f59e0b" />
          <path d="M10 4 C14 0, 17 2, 14 4 C17 5, 13 6, 10 4 Z" fill="#fbbf24" />
        </g>

        {/* Vaso artigianale in terracotta / legno cerchiato oro */}
        <path d="M37 104 L73 104 L68 129 C67 131 43 131 42 129 Z" fill="url(#xmasPotGrad)" />
        <rect x="34" y="100" width="42" height="6" rx="2.5" fill="url(#xmasPotRim)" />
        {/* Fascia dorata decorativa sul vaso */}
        <path d="M39 114 Q55 116 71 114" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.75" />
        {/* Riflesso verticale sul vaso */}
        <path d="M41 107 L44 127" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" />

        {/* Tronco in legno */}
        <rect x="50" y="92" width="10" height="11" rx="1.5" fill="#4a2816" />
        <rect x="52" y="92" width="3" height="11" fill="#6b3d24" />

        {/* 1° Palco inferiore di rami d'abete frastagliati 3D */}
        <path
          d="M55 54 L14 96 C20 99, 27 97, 31 94 C35 99, 43 99, 47 95 C52 100, 58 100, 63 95 C67 99, 75 99, 79 94 C83 97, 90 99, 96 96 Z"
          fill="url(#pineLayerDark)"
        />
        {/* 2° Palco intermedio basso */}
        <path
          d="M55 39 L20 79 C26 82, 32 80, 36 77 C40 81, 47 81, 51 77 C55 82, 60 81, 64 77 C68 81, 74 81, 78 77 C82 80, 86 81, 90 79 Z"
          fill="url(#pineLayerMid)"
        />
        {/* 3° Palco intermedio alto */}
        <path
          d="M55 25 L27 61 C32 63, 37 62, 41 59 C45 63, 50 63, 55 59 C60 63, 65 63, 69 59 C73 62, 78 63, 83 61 Z"
          fill="url(#pineLayerTop)"
        />
        {/* 4° Cima dell'abete */}
        <path
          d="M55 13 L35 43 C40 45, 45 44, 48 41 C52 45, 58 45, 62 41 C65 44, 70 45, 75 43 Z"
          fill="url(#pineLayerTop)"
        />

        {/* Ciuffi di neve soffice sulle punte dei rami */}
        <path d="M20 79 Q26 76 31 78 M79 77 Q85 75 90 79 M27 61 Q33 58 38 60 M72 60 Q78 58 83 61 M35 43 Q40 41 44 42 M66 42 Q71 41 75 43" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Ghirlanda di perline dorate drappeggiata tra i rami */}
        <path
          d="M36 42 Q55 51 73 41 M28 60 Q55 72 81 59 M21 78 Q55 92 88 76"
          fill="none"
          stroke="#fde047"
          strokeWidth="1.6"
          strokeDasharray="2 3.5"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Palline di vetro 3D con riflesso speculare */}
        <circle cx="43" cy="52" r="4.8" fill="url(#redBauble)" />
        <circle cx="41.5" cy="50.5" r="1.2" fill="rgba(255,255,255,0.75)" />

        <circle cx="66" cy="55" r="4.5" fill="url(#goldBauble)" />
        <circle cx="64.5" cy="53.5" r="1.1" fill="rgba(255,255,255,0.8)" />

        <circle cx="34" cy="72" r="5" fill="url(#goldBauble)" />
        <circle cx="32.5" cy="70.5" r="1.2" fill="rgba(255,255,255,0.8)" />

        <circle cx="56" cy="69" r="5.2" fill="url(#redBauble)" />
        <circle cx="54.2" cy="67.2" r="1.3" fill="rgba(255,255,255,0.75)" />

        <circle cx="75" cy="74" r="4.8" fill="url(#redBauble)" />
        <circle cx="73.5" cy="72.5" r="1.2" fill="rgba(255,255,255,0.75)" />

        <circle cx="29" cy="89" r="5" fill="url(#redBauble)" />
        <circle cx="27.5" cy="87.5" r="1.2" fill="rgba(255,255,255,0.75)" />

        <circle cx="48" cy="88" r="4.8" fill="url(#goldBauble)" />
        <circle cx="46.5" cy="86.5" r="1.2" fill="rgba(255,255,255,0.8)" />

        <circle cx="68" cy="90" r="5.2" fill="url(#redBauble)" />
        <circle cx="66.3" cy="88.3" r="1.3" fill="rgba(255,255,255,0.75)" />

        <circle cx="83" cy="88" r="4.5" fill="url(#goldBauble)" />
        <circle cx="81.6" cy="86.6" r="1.1" fill="rgba(255,255,255,0.8)" />

        {/* Micro-LED colorati luminosi sull'albero */}
        <circle cx="53" cy="36" r="2.2" fill="#60a5fa" className="animate-pulse" />
        <circle cx="46" cy="64" r="2.2" fill="#4ade80" className="animate-pulse" />
        <circle cx="63" cy="78" r="2.2" fill="#f472b6" className="animate-pulse" />
        <circle cx="38" cy="85" r="2.2" fill="#facc15" className="animate-pulse" />

        {/* Puntale a Stella Dorata 3D in cima */}
        <circle cx="55" cy="12" r="9" fill="rgba(250, 204, 21, 0.3)" />
        <polygon
          points="55,2 58.2,8.8 65.6,9.7 60.1,14.8 61.5,22 55,18.4 48.5,22 49.9,14.8 44.4,9.7 51.8,8.8"
          fill="url(#starGlow)"
          stroke="#b45309"
          strokeWidth="0.7"
        />
      </svg>
    </div>
  );
}

/** 2. Gattino tigrato / argentato acciambellato che dorme con cappello di Babbo Natale */
function SleepingSantaCatProp() {
  return (
    <div className="relative w-[92px] sm:w-[104px] h-[64px] sm:h-[72px] select-none pointer-events-none flex items-end justify-center">
      <svg
        viewBox="0 0 114 68"
        className="w-full h-full overflow-visible drop-shadow-[0_8px_12px_rgba(0,0,0,0.6)]"
      >
        <defs>
          <linearGradient id="catFurBody" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#9ca3af" />
            <stop offset="45%" stopColor="#6b7280" />
            <stop offset="85%" stopColor="#4b5563" />
            <stop offset="100%" stopColor="#374151" />
          </linearGradient>
          <linearGradient id="santaRedHat" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <radialGradient id="catFluff" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#f3f4f6" />
            <stop offset="100%" stopColor="#d1d5db" />
          </radialGradient>
        </defs>

        {/* Ombra di contatto scura sul ripiano in legno */}
        <ellipse cx="58" cy="63" rx="46" ry="4.5" fill="rgba(0,0,0,0.65)" />

        {/* Corpo acciambellato morbido */}
        <path
          d="M28 59 C24 39 42 27 68 28 C92 29 104 40 104 53 C104 58 98 61 90 61 L32 61 C29 61 28 60 28 59 Z"
          fill="url(#catFurBody)"
        />
        {/* Pancia inferiore in ombra */}
        <path
          d="M32 54 C45 58 78 58 102 52 C103 57 99 61 90 61 L32 61 Z"
          fill="#374151"
          opacity="0.6"
        />

        {/* Strisce tabby sfumate realistiche sulla schiena */}
        <path d="M54 29 C56.5 35 56.5 42 54 48" stroke="#374151" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M64 28.5 C66.5 35 66.5 43 64 49" stroke="#374151" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M74 29.5 C77 36 77 44 74 50" stroke="#374151" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M84 32 C87 38 87 45 84 50" stroke="#374151" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M92 37 C94.5 41 94.5 46 92.5 50" stroke="#374151" strokeWidth="2.8" strokeLinecap="round" />

        {/* Coda avvolta che circonda il corpo */}
        <path
          d="M100 51 C107 53 107 60 98 61.5 L66 61.5 C61 61.5 60 56 65 55.5 L93 55"
          fill="#4b5563"
          stroke="#374151"
          strokeWidth="0.8"
        />
        {/* Punta bianca della coda */}
        <path d="M66 61.5 C61 61.5 60 56 65 55.5 L73 55.5 L72 61.5 Z" fill="#f9fafb" />
        {/* Strisce sulla coda */}
        <path d="M77 56 L78 61" stroke="#1f2937" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M84 56 L85 61" stroke="#1f2937" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M91 56 L92 61" stroke="#1f2937" strokeWidth="2.2" strokeLinecap="round" />

        {/* Zampine anteriori bianche e paffute */}
        <ellipse cx="22" cy="57.5" rx="7.5" ry="4" fill="url(#catFluff)" stroke="#9ca3af" strokeWidth="0.5" />
        <line x1="19" y1="57" x2="19" y2="60.5" stroke="#9ca3af" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="22" y1="57" x2="22" y2="60.5" stroke="#9ca3af" strokeWidth="0.8" strokeLinecap="round" />

        <ellipse cx="45" cy="58" rx="7.5" ry="4" fill="url(#catFluff)" stroke="#9ca3af" strokeWidth="0.5" />
        <line x1="43" y1="58" x2="43" y2="61" stroke="#9ca3af" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="46" y1="58" x2="46" y2="61" stroke="#9ca3af" strokeWidth="0.8" strokeLinecap="round" />

        {/* Orecchie feline con interno rosa */}
        <path d="M18 39 L14 26 L26 31 Z" fill="#4b5563" />
        <path d="M18.5 37 L15.5 28.5 L24 32 Z" fill="#f472b6" opacity="0.6" />
        <path d="M48 39 L52 26 L40 31 Z" fill="#4b5563" />
        <path d="M47.5 37 L50.5 28.5 L42 32 Z" fill="#f472b6" opacity="0.6" />

        {/* Testa tonda del gattino */}
        <ellipse cx="33" cy="44" rx="17.5" ry="14" fill="url(#catFurBody)" />

        {/* Musetto bianco soffice inferiore */}
        <path
          d="M17.5 46 C18 54.5 25 57 33 57 C41 57 48 54.5 48.5 46 C44 49 39 49.5 33 49.5 C27 49.5 22 49 17.5 46 Z"
          fill="url(#catFluff)"
        />

        {/* Strisce delicate sulla fronte */}
        <path d="M30.5 33 L30.5 38" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M33 32 L33 38.5" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M35.5 33 L35.5 38" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" />

        {/* Occhietti chiusi che dormono sereni */}
        <path
          d="M21.5 44 Q25.5 47.5 29.5 44"
          stroke="#1f2937"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M36.5 44 Q40.5 47.5 44.5 44"
          stroke="#1f2937"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />

        {/* Nasino rosa a triangolino e boccuccia */}
        <polygon points="33,47.5 31.2,45.8 34.8,45.8" fill="#fb7185" />
        <path
          d="M30.5 50 Q31.8 51.5 33 49.5 Q34.2 51.5 35.5 50"
          stroke="#4b5563"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
        />

        {/* Baffetti sottili con riflesso */}
        <line x1="17" y1="48" x2="6" y2="46.5" stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="17" y1="50" x2="5" y2="51" stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="49" y1="48" x2="60" y2="46.5" stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="49" y1="50" x2="61" y2="51" stroke="rgba(255,255,255,0.85)" strokeWidth="0.8" strokeLinecap="round" />

        {/* Cappellino di Babbo Natale rosso di velluto piegato di lato */}
        <g id="santa-cat-hat">
          <path
            d="M18 31 C22 17 36 12 55 19 C48 23 45 27 45 31 Z"
            fill="url(#santaRedHat)"
          />
          {/* Bordo di pelliccia bianca soffice */}
          <path
            d="M16 32 C23 28.5 40 28.5 48 32 C49.5 33 49 36 47 36 C39 33.5 25 33.5 17 36 C15 36 14.5 33 16 32 Z"
            fill="url(#catFluff)"
            stroke="#e5e7eb"
            strokeWidth="0.5"
          />
          {/* Pompon bianco soffice */}
          <circle cx="56" cy="20" r="5" fill="url(#catFluff)" stroke="#e5e7eb" strokeWidth="0.4" />
          <circle cx="55" cy="19" r="2.5" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}

/** 3. Pupazzo di neve natalizio 3D con cilindro, sciarpa a maglia e naso a carota */
function SnowmanProp() {
  return (
    <div className="relative w-[78px] sm:w-[88px] h-[94px] sm:h-[106px] select-none pointer-events-none flex items-end justify-center">
      <svg
        viewBox="0 0 96 112"
        className="w-full h-full overflow-visible drop-shadow-[0_9px_12px_rgba(0,0,0,0.6)]"
      >
        <defs>
          <radialGradient id="snowBallBottom" cx="35%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f1f5f9" />
            <stop offset="85%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>
          <radialGradient id="snowBallHead" cx="35%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f8fafc" />
            <stop offset="85%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </radialGradient>
          <linearGradient id="topHatGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="35%" stopColor="#334155" />
            <stop offset="70%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="scarfRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="60%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <linearGradient id="carrotGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="50%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#9a3412" />
          </linearGradient>
        </defs>

        {/* Ombra sulla mensola in legno */}
        <ellipse cx="48" cy="107" rx="32" ry="5" fill="rgba(0,0,0,0.65)" />

        {/* Braccia di rametti di legno naturale che spuntano dai fianchi */}
        <g stroke="#78350f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Braccio sinistro alzato che saluta */}
          <path d="M26 70 L10 57 L4 63" />
          <path d="M10 57 L7 50" />

          {/* Braccio destro */}
          <path d="M70 70 L86 59 L92 64" />
          <path d="M86 59 L88 51" />
        </g>

        {/* Sfera di neve inferiore (pancia) */}
        <circle cx="48" cy="78" r="26" fill="url(#snowBallBottom)" stroke="#cbd5e1" strokeWidth="0.8" />

        {/* Bottoni di carbone lucido sulla pancia */}
        <circle cx="46" cy="69" r="2.4" fill="#0f172a" />
        <circle cx="45.2" cy="68.2" r="0.7" fill="#ffffff" />

        <circle cx="47" cy="78" r="2.5" fill="#0f172a" />
        <circle cx="46.2" cy="77.2" r="0.7" fill="#ffffff" />

        <circle cx="48" cy="88" r="2.6" fill="#0f172a" />
        <circle cx="47.2" cy="87.2" r="0.7" fill="#ffffff" />

        {/* Sfera di neve superiore (testa) */}
        <circle cx="48" cy="45" r="18" fill="url(#snowBallHead)" stroke="#cbd5e1" strokeWidth="0.8" />

        {/* Occhi di carbone lucidi */}
        <circle cx="41" cy="40" r="2" fill="#0f172a" />
        <circle cx="40.3" cy="39.3" r="0.6" fill="#ffffff" />

        <circle cx="53" cy="40" r="2" fill="#0f172a" />
        <circle cx="52.3" cy="39.3" r="0.6" fill="#ffffff" />

        {/* Naso a carota 3D sporgente a destra */}
        <polygon points="46,44 65,47 46,49" fill="url(#carrotGrad)" />
        <line x1="51" y1="45" x2="51" y2="48" stroke="#9a3412" strokeWidth="0.8" opacity="0.7" />
        <line x1="57" y1="46" x2="57" y2="48" stroke="#9a3412" strokeWidth="0.8" opacity="0.7" />

        {/* Sorriso di piccoli pezzetti di carbone */}
        <circle cx="40" cy="51" r="1.1" fill="#0f172a" />
        <circle cx="43" cy="53" r="1.1" fill="#0f172a" />
        <circle cx="47" cy="54" r="1.1" fill="#0f172a" />
        <circle cx="51" cy="53.5" r="1.1" fill="#0f172a" />
        <circle cx="54" cy="51.5" r="1.1" fill="#0f172a" />

        {/* Sciarpa calda a maglia rossa e oro con frange */}
        <path
          d="M31 56 C37 62, 59 62, 65 56 C67 61, 62 65, 48 65 C34 65, 29 61, 31 56 Z"
          fill="url(#scarfRedGrad)"
        />
        {/* Lembo di sciarpa che scende sul petto */}
        <path d="M52 61 L55 83 L63 82 L59 60 Z" fill="url(#scarfRedGrad)" />
        {/* Strisce dorate sulla sciarpa */}
        <path d="M53 68 L60 67" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
        <path d="M54 75 L62 74" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
        {/* Frange terminali della sciarpa */}
        <line x1="55" y1="83" x2="63" y2="82" stroke="#facc15" strokeWidth="2" strokeDasharray="1.5 1.5" />

        {/* Cappello a cilindro nero da nobiluomo */}
        <ellipse cx="48" cy="30" rx="20" ry="4.5" fill="url(#topHatGrad)" stroke="#0f172a" strokeWidth="0.8" />
        <path d="M35 12 L61 12 L59 30 L37 30 Z" fill="url(#topHatGrad)" />
        <ellipse cx="48" cy="12" rx="13" ry="3.2" fill="#475569" />
        {/* Nastro rosso del cilindro con bacche di vischio */}
        <path d="M36.5 24 L59.5 24 L59 29.5 L37 29.5 Z" fill="#dc2626" />
        <circle cx="53" cy="27" r="1.8" fill="#ef4444" />
        <circle cx="56" cy="27.5" r="1.8" fill="#dc2626" />
        <path d="M53 25 C51 22, 55 21, 54 24" fill="#15803d" />
      </svg>
    </div>
  );
}

/** 4. Globo di Neve di Cristallo (Snow Globe) con baita illuminata, abete e base in mogano e ottone */
function SnowGlobeProp() {
  return (
    <div className="relative w-[78px] sm:w-[88px] h-[90px] sm:h-[100px] select-none pointer-events-none flex items-end justify-center">
      <svg viewBox="0 0 96 108" className="w-full h-full overflow-visible drop-shadow-[0_9px_12px_rgba(0,0,0,0.6)]">
        <defs>
          <radialGradient id="globeGlass" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.38)" />
            <stop offset="45%" stopColor="rgba(186,230,253,0.16)" />
            <stop offset="82%" stopColor="rgba(56,189,248,0.22)" />
            <stop offset="100%" stopColor="rgba(14,116,144,0.45)" />
          </radialGradient>
          <linearGradient id="globeWoodBase" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b1d0e" />
            <stop offset="30%" stopColor="#6e381d" />
            <stop offset="55%" stopColor="#854627" />
            <stop offset="85%" stopColor="#4a2210" />
            <stop offset="100%" stopColor="#291106" />
          </linearGradient>
          <linearGradient id="brassPlaque" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="50%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#92400e" />
          </linearGradient>
        </defs>

        {/* Ombra di contatto */}
        <ellipse cx="48" cy="103" rx="34" ry="5" fill="rgba(0,0,0,0.65)" />

        {/* Sfera interna scura notturna */}
        <circle cx="48" cy="52" r="35" fill="#0f2942" />

        {/* Paesaggio innevato interno: collinetta, abete e baita con finestra calda */}
        <g>
          {/* Abete innevato dentro la sfera */}
          <polygon points="33,44 24,66 42,66" fill="#15803d" />
          <polygon points="33,35 26,53 40,53" fill="#16a34a" />
          <polygon points="33,28 28,42 38,42" fill="#22c55e" />
          <path d="M28 42 Q33 40 38 42 M26 53 Q33 51 40 53" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" />

          {/* Piccola baita in legno */}
          <rect x="46" y="52" width="18" height="14" fill="#7c2d12" />
          <polygon points="43,53 55,42 67,53" fill="#991b1b" />
          <path d="M43 53 L55 42 L67 53" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* Finestra illuminata */}
          <rect x="52" y="56" width="6" height="6" rx="1" fill="#fef08a" />
          <line x1="55" y1="56" x2="55" y2="62" stroke="#7c2d12" strokeWidth="0.9" />
          <line x1="52" y1="59" x2="58" y2="59" stroke="#7c2d12" strokeWidth="0.9" />

          {/* Manto di neve soffice sul fondo della sfera */}
          <path d="M16 66 Q32 61 48 65 Q64 69 80 65 C76 78 63 86 48 86 C33 86 20 78 16 66 Z" fill="#f1f5f9" />
          <path d="M18 68 Q34 64 48 67 Q64 70 78 67" stroke="#ffffff" strokeWidth="2" fill="none" />

          {/* Fiocchi di neve sospesi */}
          <circle cx="30" cy="34" r="1.4" fill="#ffffff" opacity="0.9" />
          <circle cx="45" cy="27" r="1.7" fill="#ffffff" opacity="0.85" />
          <circle cx="60" cy="33" r="1.3" fill="#ffffff" opacity="0.9" />
          <circle cx="69" cy="46" r="1.5" fill="#ffffff" opacity="0.8" />
          <circle cx="23" cy="50" r="1.3" fill="#ffffff" opacity="0.75" />
          <circle cx="48" cy="38" r="1.2" fill="#ffffff" opacity="0.9" />
        </g>

        {/* Cupola di cristallo con riflessi realistici */}
        <circle cx="48" cy="52" r="35" fill="url(#globeGlass)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" />
        {/* Riflesso curvo del vetro a sinistra */}
        <path
          d="M22 42 A 29 29 0 0 1 42 22"
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M72 64 A 28 28 0 0 1 60 76"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Ghiera in ottone e base tornita in mogano */}
        <rect x="23" y="79" width="50" height="4.5" rx="2" fill="url(#brassPlaque)" />
        <path d="M20 83 L76 83 L81 99 C81 101 15 101 15 99 Z" fill="url(#globeWoodBase)" />
        <rect x="14" y="98" width="68" height="4.5" rx="2" fill="#291106" stroke="#5c2b14" strokeWidth="0.6" />
        {/* Targhetta in ottone incisa */}
        <rect x="36" y="88" width="24" height="6" rx="1.5" fill="url(#brassPlaque)" stroke="#78350f" strokeWidth="0.6" />
        <circle cx="38.5" cy="91" r="0.7" fill="#78350f" />
        <circle cx="57.5" cy="91" r="0.7" fill="#78350f" />
      </svg>
    </div>
  );
}

/** 3. Lanterna Natalizia in Ottone e Vetro con Candela Accesa, Agrifoglio e Bacche Rosse */
function ChristmasLanternProp() {
  return (
    <div className="relative w-[74px] sm:w-[84px] h-[94px] sm:h-[106px] select-none pointer-events-none flex items-end justify-center">
      <div className="absolute inset-x-3 top-6 bottom-4 rounded-full bg-amber-400/20 blur-xl" />
      <svg viewBox="0 0 92 112" className="w-full h-full overflow-visible drop-shadow-[0_9px_12px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="lanternMetal" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7f1d1d" />
            <stop offset="30%" stopColor="#b91c1c" />
            <stop offset="70%" stopColor="#991b1b" />
            <stop offset="100%" stopColor="#450a0a" />
          </linearGradient>
          <radialGradient id="lanternWarmGlow" cx="50%" cy="55%" r="55%">
            <stop offset="0%" stopColor="rgba(254, 240, 138, 0.85)" />
            <stop offset="55%" stopColor="rgba(245, 158, 11, 0.35)" />
            <stop offset="100%" stopColor="rgba(245, 158, 11, 0)" />
          </radialGradient>
        </defs>

        {/* Ombra di contatto */}
        <ellipse cx="46" cy="107" rx="32" ry="5" fill="rgba(0,0,0,0.65)" />

        {/* Anello superiore in ottone */}
        <circle cx="46" cy="12" r="6" fill="none" stroke="#f59e0b" strokeWidth="2.2" />
        {/* Cupola superiore della lanterna */}
        <path d="M34 24 L46 15 L58 24 Z" fill="url(#lanternMetal)" />
        <rect x="29" y="23" width="34" height="4.5" rx="2" fill="#f59e0b" />
        <path d="M24 33 L30 27 L62 27 L68 33 Z" fill="url(#lanternMetal)" />

        {/* Corpo vetrato della lanterna */}
        <rect x="26" y="33" width="40" height="58" rx="2" fill="rgba(255, 248, 220, 0.14)" stroke="url(#lanternMetal)" strokeWidth="3.2" />
        {/* Bagliore interno */}
        <circle cx="46" cy="64" r="24" fill="url(#lanternWarmGlow)" />

        {/* Candela in cera avorio all'interno */}
        <rect x="39" y="58" width="14" height="31" rx="2" fill="#fef3c7" stroke="#fde68a" strokeWidth="0.6" />
        <path d="M39 62 Q43 66 45 61 Q49 67 53 61" fill="none" stroke="#fffbeb" strokeWidth="2" strokeLinecap="round" />
        {/* Stoppino e fiamma viva */}
        <line x1="46" y1="54" x2="46" y2="58" stroke="#292524" strokeWidth="1.2" />
        <path
          d="M46 41 C41 48, 41 54, 46 55 C51 54, 51 48, 46 41 Z"
          fill="#f59e0b"
          className="animate-pulse"
        />
        <path d="M46 45 C43.5 49, 43.5 53, 46 54 C48.5 53, 48.5 49, 46 45 Z" fill="#fef08a" />

        {/* Montanti incrociati e riflesso del vetro */}
        <line x1="27" y1="34" x2="36" y2="89" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
        <line x1="26" y1="33" x2="26" y2="91" stroke="#7f1d1d" strokeWidth="3" />
        <line x1="66" y1="33" x2="66" y2="91" stroke="#450a0a" strokeWidth="3" />

        {/* Base della lanterna */}
        <rect x="22" y="90" width="48" height="6" rx="2" fill="url(#lanternMetal)" />
        <rect x="19" y="96" width="54" height="9" rx="2.5" fill="url(#lanternMetal)" stroke="#f59e0b" strokeWidth="0.8" />

        {/* Decorazione di agrifoglio, pino e bacche rosse alla base */}
        <path d="M24 92 C16 88, 14 96, 23 98 C18 102, 26 105, 32 97 Z" fill="#15803d" stroke="#14532d" strokeWidth="0.7" />
        <path d="M68 92 C76 88, 78 96, 69 98 C74 102, 66 105, 60 97 Z" fill="#166534" stroke="#14532d" strokeWidth="0.7" />
        <circle cx="31" cy="94" r="3" fill="#dc2626" />
        <circle cx="35" cy="97" r="2.8" fill="#ef4444" />
        <circle cx="28" cy="98" r="2.6" fill="#b91c1c" />
      </svg>
    </div>
  );
}

/** 4. Schiaccianoci & Tazza di Cioccolata Calda con Bastoncino di Zucchero e Cannella */
function ChristmasCocoaAndNutcrackerProp() {
  return (
    <div className="relative w-[80px] sm:w-[90px] h-[86px] sm:h-[96px] select-none pointer-events-none flex items-end justify-center">
      <svg viewBox="0 0 100 102" className="w-full h-full overflow-visible drop-shadow-[0_8px_12px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="xmasMugGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#991b1b" />
            <stop offset="30%" stopColor="#dc2626" />
            <stop offset="75%" stopColor="#b91c1c" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
        </defs>

        {/* Ombra sulla mensola */}
        <ellipse cx="52" cy="97" rx="36" ry="5" fill="rgba(0,0,0,0.6)" />

        {/* Vapore profumato */}
        <path d="M38 30 Q34 21 40 14 Q45 7 40 1" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" />
        <path d="M52 28 Q48 19 54 12 Q59 5 54 0" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" />

        {/* Manico della tazza */}
        <path d="M68 54 C83 54, 83 82, 68 82" fill="none" stroke="url(#xmasMugGrad)" strokeWidth="6.5" strokeLinecap="round" />
        <path d="M68 54 C80 54, 80 82, 68 82" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />

        {/* Bastoncino di zucchero (Candy Cane) e stecca di cannella */}
        <path d="M34 45 L28 24 C26 16, 16 18, 18 26" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
        <path d="M34 45 L28 24 C26 16, 16 18, 18 26" fill="none" stroke="#ef4444" strokeWidth="5" strokeDasharray="4 4" strokeLinecap="round" />
        {/* Stecca di cannella */}
        <rect x="54" y="24" width="5.5" height="24" rx="2" transform="rotate(16 54 24)" fill="#78350f" stroke="#451a03" strokeWidth="0.8" />

        {/* Panna montata soffice e marshmallows */}
        <path d="M22 46 C22 36, 33 34, 38 38 C43 31, 55 32, 58 39 C64 36, 70 41, 68 47 Z" fill="#fffbeb" stroke="#fde68a" strokeWidth="0.8" />
        <rect x="33" y="36" width="8" height="6" rx="2" fill="#ffffff" stroke="#e7e5e4" strokeWidth="0.6" transform="rotate(-8 33 36)" />
        <rect x="46" y="35" width="8" height="6" rx="2" fill="#ffffff" stroke="#e7e5e4" strokeWidth="0.6" transform="rotate(10 46 35)" />

        {/* Corpo della tazza in ceramica rossa smaltata */}
        <path d="M20 45 L70 45 L66 90 C65 95, 25 95, 24 90 Z" fill="url(#xmasMugGrad)" />
        {/* Fascia nordica con fiocco di neve dipinto */}
        <path d="M21.5 62 L68.5 62 L67.5 74 L22.5 74 Z" fill="rgba(255,255,255,0.16)" />
        <path d="M45 63 L45 73 M40 68 L50 68 M41.5 64.5 L48.5 71.5 M48.5 64.5 L41.5 71.5" stroke="#fffbeb" strokeWidth="1.5" strokeLinecap="round" />
        {/* Riflesso verticale smaltato */}
        <path d="M26 50 L28 86" stroke="rgba(255,255,255,0.32)" strokeWidth="2.8" strokeLinecap="round" />

        {/* Biscottino pan di zenzero a stella poggiato accanto */}
        <polygon
          points="80,78 83,84 90,85 85,90 86,97 80,93 74,97 75,90 70,85 77,84"
          fill="#b45309"
          stroke="#fde68a"
          strokeWidth="1.2"
        />
        <circle cx="80" cy="88" r="1.5" fill="#ef4444" />
      </svg>
    </div>
  );
}

/* ============================================================================
   TEMA PIANTE & OGGETTI DA STUDIO (Default / 'none') — Più realistici e variati
   ============================================================================ */

/** 1. Vaso in Terracotta con Monstera Deliciosa & Foglie Tropicali 3D */
function MonsteraPlantProp() {
  return (
    <div className="relative w-[82px] sm:w-[92px] h-[96px] sm:h-[108px] select-none pointer-events-none flex items-end justify-center">
      <svg viewBox="0 0 104 116" className="w-full h-full overflow-visible drop-shadow-[0_9px_12px_rgba(0,0,0,0.58)]">
        <defs>
          <linearGradient id="terraPot" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9a4424" />
            <stop offset="32%" stopColor="#c8643c" />
            <stop offset="72%" stopColor="#8c3b1e" />
            <stop offset="100%" stopColor="#59220e" />
          </linearGradient>
          <linearGradient id="leafLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="50%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
          <linearGradient id="leafDeep" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="60%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#052e16" />
          </linearGradient>
        </defs>

        {/* Ombra */}
        <ellipse cx="52" cy="111" rx="30" ry="4.5" fill="rgba(0,0,0,0.6)" />

        {/* Steli */}
        <path d="M52 74 Q36 56 26 38" fill="none" stroke="#14532d" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M52 74 Q52 46 50 22" fill="none" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
        <path d="M52 74 Q68 54 78 36" fill="none" stroke="#14532d" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M52 76 Q30 70 16 62" fill="none" stroke="#15803d" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M52 76 Q74 68 88 60" fill="none" stroke="#15803d" strokeWidth="2.4" strokeLinecap="round" />

        {/* Foglia Monstera sinistra posteriore */}
        <path
          d="M26 38 C14 32, 8 46, 18 56 C22 52, 26 54, 23 59 C32 64, 42 54, 38 42 C34 38, 30 39, 26 38 Z"
          fill="url(#leafDeep)"
        />
        <path d="M20 42 L35 55" stroke="#4ade80" strokeWidth="1" opacity="0.55" />

        {/* Foglia Monstera destra posteriore */}
        <path
          d="M78 36 C90 30, 96 44, 86 55 C82 51, 78 53, 81 58 C72 63, 62 53, 66 40 C70 36, 74 37, 78 36 Z"
          fill="url(#leafDeep)"
        />
        <path d="M84 40 L69 54" stroke="#4ade80" strokeWidth="1" opacity="0.55" />

        {/* Foglie basse laterali */}
        <ellipse cx="21" cy="63" rx="12" ry="7" transform="rotate(-22 21 63)" fill="url(#leafLight)" />
        <ellipse cx="83" cy="61" rx="12" ry="7" transform="rotate(22 83 61)" fill="url(#leafLight)" />

        {/* Grande Foglia Monstera Centrale Fenestrata */}
        <path
          d="M50 12 C34 14, 28 30, 36 42 C41 40, 44 42, 38 46 C42 54, 48 58, 52 60 C56 58, 62 54, 65 46 C59 42, 62 40, 67 42 C75 30, 66 14, 50 12 Z"
          fill="url(#leafLight)"
        />
        {/* Nervatura centrale e laterali */}
        <path d="M50 15 L52 58 M50 26 L41 22 M51 35 L40 32 M51 28 L61 24 M51 37 L62 34" stroke="#bbf7d0" strokeWidth="1.1" strokeLinecap="round" opacity="0.65" />

        {/* Sottovaso e Vaso in Terracotta */}
        <ellipse cx="52" cy="74" rx="21" ry="4" fill="#29150c" />
        <path d="M31 74 L73 74 L67 107 C66 110, 38 110, 37 107 Z" fill="url(#terraPot)" />
        <rect x="28" y="70" width="48" height="6.5" rx="2.5" fill="url(#terraPot)" stroke="#7c2d12" strokeWidth="0.6" />
        <ellipse cx="52" cy="109" rx="18" ry="3.5" fill="#7c2d12" />
        {/* Riflesso sul vaso */}
        <path d="M35 79 L39 104" stroke="rgba(255,255,255,0.22)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** 2. Mappamondo Antico da Scrivania in Ottone e Pergamena (Vintage Library Globe) */
function VintageGlobeProp() {
  return (
    <div className="relative w-[76px] sm:w-[86px] h-[94px] sm:h-[106px] select-none pointer-events-none flex items-end justify-center">
      <svg viewBox="0 0 96 112" className="w-full h-full overflow-visible drop-shadow-[0_9px_12px_rgba(0,0,0,0.6)]">
        <defs>
          <radialGradient id="parchmentGlobe" cx="35%" cy="30%" r="68%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="40%" stopColor="#e6c280" />
            <stop offset="78%" stopColor="#b88642" />
            <stop offset="100%" stopColor="#6b4419" />
          </radialGradient>
          <linearGradient id="brassArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="50%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
        </defs>

        {/* Ombra */}
        <ellipse cx="48" cy="107" rx="28" ry="4.5" fill="rgba(0,0,0,0.65)" />

        {/* Base tornita in ottone e noce */}
        <path d="M26 105 C28 97, 68 97, 70 105 Z" fill="url(#brassArc)" />
        <rect x="24" y="104" width="48" height="3.5" rx="1.5" fill="#451a03" />
        <rect x="45" y="84" width="6" height="16" rx="2" fill="url(#brassArc)" />
        <ellipse cx="48" cy="92" rx="7" ry="2.5" fill="#b45309" />

        {/* Meridiano graduato in ottone */}
        <path
          d="M48 14 A 35 35 0 0 1 48 84"
          fill="none"
          stroke="url(#brassArc)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Asse inclinato */}
        <line x1="34" y1="16" x2="62" y2="82" stroke="#b45309" strokeWidth="2.5" strokeLinecap="round" />

        {/* Sfera del mappamondo antico */}
        <circle cx="46" cy="49" r="28" fill="url(#parchmentGlobe)" stroke="#92400e" strokeWidth="0.9" />

        {/* Continenti stilizzati color seppia/oliva */}
        <path
          d="M32 35 C37 31, 44 33, 46 39 C48 44, 42 50, 39 55 C35 52, 30 43, 32 35 Z"
          fill="#854d0e"
          opacity="0.55"
        />
        <path
          d="M52 32 C58 30, 66 36, 65 45 C63 53, 56 58, 52 52 C49 46, 50 37, 52 32 Z"
          fill="#713f12"
          opacity="0.5"
        />

        {/* Linee dei paralleli e dell'equatore */}
        <ellipse cx="46" cy="49" rx="28" ry="9" transform="rotate(-22 46 49)" fill="none" stroke="rgba(120,53,15,0.45)" strokeWidth="1" />
        <ellipse cx="46" cy="49" rx="14" ry="28" transform="rotate(-22 46 49)" fill="none" stroke="rgba(120,53,15,0.35)" strokeWidth="0.9" />

        {/* Riflesso lucido sulla sfera */}
        <path d="M27 36 A 21 21 0 0 1 43 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** 3. Clessidra di Vetro Soffiato e Ottone + Taccuino rilegato in pelle */
function HourglassAndJournalProp() {
  return (
    <div className="relative w-[78px] sm:w-[88px] h-[90px] sm:h-[100px] select-none pointer-events-none flex items-end justify-center">
      <svg viewBox="0 0 98 104" className="w-full h-full overflow-visible drop-shadow-[0_8px_12px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="brassFrame" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#92400e" />
            <stop offset="45%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <linearGradient id="sandGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>

        {/* Ombra */}
        <ellipse cx="49" cy="99" rx="36" ry="4.5" fill="rgba(0,0,0,0.6)" />

        {/* Libro/Taccuino orizzontale in pelle bordeaux su cui poggia la clessidra */}
        <rect x="14" y="86" width="70" height="12" rx="2.5" fill="#7f1d1d" stroke="#450a0a" strokeWidth="1" />
        <rect x="17" y="88" width="65" height="8" rx="1" fill="#fef3c7" />
        <line x1="18" y1="90.5" x2="81" y2="90.5" stroke="#d6d3d1" strokeWidth="0.7" />
        <line x1="18" y1="93.5" x2="81" y2="93.5" stroke="#d6d3d1" strokeWidth="0.7" />
        {/* Nastro segnalibro dorato che scende */}
        <path d="M36 94 L33 103 L37 101 L40 103 L39 94 Z" fill="#f59e0b" />

        {/* Colonnine laterali in ottone della clessidra */}
        <rect x="29" y="21" width="3" height="62" fill="url(#brassFrame)" />
        <rect x="66" y="21" width="3" height="62" fill="url(#brassFrame)" />

        {/* Basi superiore e inferiore in ottone e legno */}
        <rect x="25" y="17" width="48" height="5" rx="2" fill="url(#brassFrame)" />
        <rect x="25" y="81" width="48" height="5" rx="2" fill="url(#brassFrame)" />

        {/* Ampolle di vetro della clessidra */}
        <path
          d="M34 22 C34 40, 46 46, 47 51 C46 56, 34 62, 34 81 L64 81 C64 62, 52 56, 51 51 C52 46, 64 40, 64 22 Z"
          fill="rgba(255,255,255,0.14)"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.3"
        />

        {/* Sabbia dorata nell'ampolla superiore */}
        <path d="M38 35 C40 43, 46 47, 49 50 C52 47, 58 43, 60 35 Q49 38 38 35 Z" fill="url(#sandGold)" />
        {/* Filo di sabbia che scorre */}
        <line x1="49" y1="50" x2="49" y2="75" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="2 1.5" />
        {/* Cumulo di sabbia dorata nell'ampolla inferiore */}
        <path d="M35 80 Q49 64 63 80 Z" fill="url(#sandGold)" />

        {/* Riflessi sul vetro */}
        <path d="M37 26 C37 36, 43 42, 45 46" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
        <path d="M37 76 C37 66, 43 60, 45 56" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** 4. Bonsai / Piantina di Giada & Pothos Ricadente in Ceramica Smaltata */
function CeramicBonsaiProp() {
  return (
    <div className="relative w-[80px] sm:w-[90px] h-[90px] sm:h-[100px] select-none pointer-events-none flex items-end justify-center">
      <svg viewBox="0 0 100 106" className="w-full h-full overflow-visible drop-shadow-[0_8px_12px_rgba(0,0,0,0.58)]">
        <defs>
          <linearGradient id="ceramicPot" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="35%" stopColor="#f8fafc" />
            <stop offset="80%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>

        <ellipse cx="50" cy="101" rx="32" ry="4.5" fill="rgba(0,0,0,0.6)" />

        {/* Tronco sinuoso del bonsai */}
        <path
          d="M46 76 C44 64, 54 56, 48 42 C45 36, 36 34, 32 36 M48 46 C56 42, 64 42, 68 44"
          fill="none"
          stroke="#5c3a21"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path
          d="M46 76 C44 64, 54 56, 48 42"
          fill="none"
          stroke="#855836"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Chiome di foglioline verdi stratificate 3D */}
        <ellipse cx="32" cy="34" rx="18" ry="10" fill="#14532d" />
        <ellipse cx="31" cy="32" rx="16" ry="8.5" fill="#16a34a" />
        <ellipse cx="29" cy="30" rx="11" ry="5.5" fill="#4ade80" opacity="0.7" />

        <ellipse cx="66" cy="42" rx="17" ry="9.5" fill="#14532d" />
        <ellipse cx="65" cy="40" rx="15" ry="8" fill="#15803d" />
        <ellipse cx="63" cy="38" rx="10" ry="5" fill="#22c55e" opacity="0.8" />

        <ellipse cx="49" cy="22" rx="20" ry="11" fill="#14532d" />
        <ellipse cx="48" cy="20" rx="18" ry="9.5" fill="#16a34a" />
        <ellipse cx="46" cy="18" rx="12" ry="6" fill="#4ade80" opacity="0.8" />

        {/* Vaso basso orientale in ceramica smaltata con piedini in legno */}
        <rect x="28" y="95" width="8" height="5" rx="1.5" fill="#451a03" />
        <rect x="64" y="95" width="8" height="5" rx="1.5" fill="#451a03" />
        <path d="M20 74 L80 74 L74 96 C73 98, 27 98, 26 96 Z" fill="url(#ceramicPot)" />
        <rect x="18" y="71" width="64" height="5" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.7" />
        {/* Decorazione blu cobalto sul vaso */}
        <path d="M24 83 Q50 86 76 83" fill="none" stroke="#1d4ed8" strokeWidth="2" opacity="0.65" />
      </svg>
    </div>
  );
}

/* ============================================================================
   TEMA AUTUNNALE (Autumn) — Zucche realistiche, candela in vetro ambrato e tazza
   ============================================================================ */

function AutumnHarvestProp() {
  return (
    <div className="relative w-[82px] sm:w-[92px] h-[86px] sm:h-[96px] select-none pointer-events-none flex items-end justify-center">
      <svg viewBox="0 0 104 100" className="w-full h-full overflow-visible drop-shadow-[0_8px_12px_rgba(0,0,0,0.6)]">
        <defs>
          <radialGradient id="pumpkinOrange" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fdba74" />
            <stop offset="40%" stopColor="#ea580c" />
            <stop offset="85%" stopColor="#9a3412" />
            <stop offset="100%" stopColor="#431407" />
          </radialGradient>
          <radialGradient id="pumpkinCream" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="50%" stopColor="#fde68a" />
            <stop offset="90%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </radialGradient>
        </defs>

        <ellipse cx="52" cy="95" rx="38" ry="5" fill="rgba(0,0,0,0.6)" />

        {/* Foglie d'acero autunnali sul ripiano */}
        <path d="M12 88 C6 82, 14 74, 22 82 C18 88, 15 90, 12 88 Z" fill="#dc2626" />
        <path d="M88 89 C95 83, 89 75, 80 83 C84 89, 86 90, 88 89 Z" fill="#d97706" />

        {/* Grande Zucca Arancione 3D a spicchi */}
        <path d="M39 50 C37 40, 44 36, 46 38 L44 52 Z" fill="#3f6212" />
        <ellipse cx="26" cy="72" rx="13" ry="19" fill="url(#pumpkinOrange)" />
        <ellipse cx="54" cy="72" rx="13" ry="19" fill="url(#pumpkinOrange)" />
        <ellipse cx="33" cy="73" rx="13" ry="20" fill="url(#pumpkinOrange)" />
        <ellipse cx="47" cy="73" rx="13" ry="20" fill="url(#pumpkinOrange)" />
        <ellipse cx="40" cy="74" rx="11" ry="20.5" fill="url(#pumpkinOrange)" />

        {/* Piccola Zucca Crema accanto a destra */}
        <path d="M73 62 C72 55, 77 53, 78 55 L76 64 Z" fill="#4d7c0f" />
        <ellipse cx="65" cy="80" rx="10" ry="13" fill="url(#pumpkinCream)" />
        <ellipse cx="81" cy="80" rx="10" ry="13" fill="url(#pumpkinCream)" />
        <ellipse cx="73" cy="81" rx="10" ry="14" fill="url(#pumpkinCream)" />
      </svg>
    </div>
  );
}

function AutumnCandleAndAcornProp() {
  return (
    <div className="relative w-[76px] sm:w-[86px] h-[88px] sm:h-[98px] select-none pointer-events-none flex items-end justify-center">
      <div className="absolute inset-x-4 top-4 bottom-4 rounded-full bg-amber-500/20 blur-xl" />
      <svg viewBox="0 0 96 102" className="w-full h-full overflow-visible drop-shadow-[0_8px_12px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="amberGlassJar" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(180, 83, 9, 0.85)" />
            <stop offset="35%" stopColor="rgba(245, 158, 11, 0.7)" />
            <stop offset="75%" stopColor="rgba(146, 64, 14, 0.85)" />
            <stop offset="100%" stopColor="rgba(69, 26, 3, 0.92)" />
          </linearGradient>
        </defs>

        <ellipse cx="48" cy="97" rx="32" ry="4.5" fill="rgba(0,0,0,0.6)" />

        {/* Fiamma calda */}
        <path d="M44 26 C39 34, 39 40, 44 42 C49 40, 49 34, 44 26 Z" fill="#f59e0b" className="animate-pulse" />
        <path d="M44 30 C41.5 35, 41.5 39, 44 40 C46.5 39, 46.5 35, 44 30 Z" fill="#fef08a" />
        <line x1="44" y1="41" x2="44" y2="46" stroke="#292524" strokeWidth="1.4" />

        {/* Vasetto in vetro ambrato da farmacia con etichetta */}
        <rect x="24" y="45" width="40" height="49" rx="5" fill="url(#amberGlassJar)" stroke="rgba(253, 224, 71, 0.4)" strokeWidth="1" />
        <rect x="22" y="42" width="44" height="5" rx="2" fill="#78350f" />
        {/* Etichetta vintage in carta pergamena */}
        <rect x="30" y="58" width="28" height="22" rx="1.5" fill="#fef3c7" stroke="#b45309" strokeWidth="0.8" />
        <line x1="35" y1="65" x2="53" y2="65" stroke="#78350f" strokeWidth="1.2" />
        <line x1="37" y1="70" x2="51" y2="70" stroke="#92400e" strokeWidth="0.9" />
        <line x1="39" y1="74" x2="49" y2="74" stroke="#92400e" strokeWidth="0.9" />
        {/* Riflesso sul vetro */}
        <line x1="28" y1="50" x2="28" y2="88" stroke="rgba(255,255,255,0.35)" strokeWidth="2.2" strokeLinecap="round" />

        {/* Ghianda realistica poggiata accanto */}
        <ellipse cx="75" cy="88" rx="7" ry="8.5" fill="#9a3412" />
        <path d="M67 84 C67 78, 83 78, 83 84 Z" fill="#451a03" />
        <path d="M75 76 L77 73" stroke="#451a03" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ============================================================================
   TEMA HALLOWEEN — Zucca Jack-o'-Lantern illuminata & Pozione Alchemica
   ============================================================================ */

function HalloweenJackOLanternProp() {
  return (
    <div className="relative w-[80px] sm:w-[90px] h-[88px] sm:h-[98px] select-none pointer-events-none flex items-end justify-center">
      <div className="absolute inset-x-3 top-6 bottom-3 rounded-full bg-orange-500/20 blur-xl" />
      <svg viewBox="0 0 100 102" className="w-full h-full overflow-visible drop-shadow-[0_9px_12px_rgba(0,0,0,0.65)]">
        <ellipse cx="50" cy="96" rx="34" ry="5" fill="rgba(0,0,0,0.65)" />

        {/* Picciolo contorto */}
        <path d="M47 42 C44 30, 54 24, 58 28 C54 32, 53 36, 54 43 Z" fill="#365314" />

        {/* Corpo della Zucca 3D */}
        <ellipse cx="32" cy="70" rx="16" ry="23" fill="#c2410c" />
        <ellipse cx="68" cy="70" rx="16" ry="23" fill="#9a3412" />
        <ellipse cx="41" cy="71" rx="16" ry="24" fill="#ea580c" />
        <ellipse cx="59" cy="71" rx="16" ry="24" fill="#c2410c" />
        <ellipse cx="50" cy="72" rx="14" ry="24.5" fill="#f97316" />

        {/* Occhi e bocca intagliati con bagliore interno giallo vivo */}
        <polygon points="34,63 42,54 45,65" fill="#fef08a" stroke="#7c2d12" strokeWidth="1" />
        <polygon points="66,63 58,54 55,65" fill="#fef08a" stroke="#7c2d12" strokeWidth="1" />
        <polygon points="50,65 47,71 53,71" fill="#fde047" />
        <path
          d="M32 76 L38 81 L43 77 L48 82 L52 77 L57 82 L62 77 L68 76 L63 86 L56 84 L50 88 L44 84 L37 86 Z"
          fill="#fef08a"
          stroke="#7c2d12"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

function HalloweenPotionAndCandlesProp() {
  return (
    <div className="relative w-[78px] sm:w-[88px] h-[92px] sm:h-[102px] select-none pointer-events-none flex items-end justify-center">
      <div className="absolute inset-x-3 top-6 bottom-3 rounded-full bg-purple-500/20 blur-xl" />
      <svg viewBox="0 0 98 106" className="w-full h-full overflow-visible drop-shadow-[0_9px_12px_rgba(0,0,0,0.65)]">
        <defs>
          <radialGradient id="potionPurple" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#e879f9" />
            <stop offset="45%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#3b0764" />
          </radialGradient>
        </defs>

        <ellipse cx="49" cy="101" rx="34" ry="4.5" fill="rgba(0,0,0,0.65)" />

        {/* Ampolla alchemica in vetro con tappo di sughero */}
        <rect x="37" y="25" width="12" height="9" rx="2" fill="#a16207" stroke="#713f12" strokeWidth="0.8" />
        <rect x="35" y="33" width="16" height="4" rx="1.5" fill="rgba(255,255,255,0.45)" />
        <rect x="38" y="37" width="10" height="16" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
        <circle cx="43" cy="74" r="23" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" />
        {/* Liquido magico viola */}
        <path d="M22 72 Q43 67 64 72 A 21 21 0 0 1 22 72 Z" fill="url(#potionPurple)" />
        <circle cx="36" cy="80" r="2.2" fill="#f0abfc" className="animate-pulse" />
        <circle cx="48" cy="84" r="1.6" fill="#f0abfc" />
        <circle cx="43" cy="74" r="1.8" fill="#f0abfc" />
        <path d="M27 65 A 17 17 0 0 1 36 56" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.2" strokeLinecap="round" />

        {/* Candela nera gocciolante accanto */}
        <rect x="70" y="56" width="12" height="41" rx="2" fill="#1c1917" stroke="#44403c" strokeWidth="0.8" />
        <path d="M70 58 Q74 66 75 60 Q79 68 82 59" fill="none" stroke="#57534e" strokeWidth="2" strokeLinecap="round" />
        <path d="M76 42 C72 48, 72 53, 76 55 C80 53, 80 48, 76 42 Z" fill="#f59e0b" className="animate-pulse" />
        <path d="M76 46 C74 50, 74 52, 76 53 C78 52, 78 50, 76 46 Z" fill="#fef08a" />
      </svg>
    </div>
  );
}

/* ============================================================================
   TEMA PASQUALE & PRIMAVERILE (Easter) — Tulipani in vaso e Nido con uova dipinte
   ============================================================================ */

function EasterTulipsVaseProp() {
  return (
    <div className="relative w-[78px] sm:w-[88px] h-[96px] sm:h-[108px] select-none pointer-events-none flex items-end justify-center">
      <svg viewBox="0 0 98 114" className="w-full h-full overflow-visible drop-shadow-[0_8px_12px_rgba(0,0,0,0.58)]">
        <defs>
          <linearGradient id="pastelPitcher" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="40%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
        </defs>

        <ellipse cx="49" cy="109" rx="28" ry="4.5" fill="rgba(0,0,0,0.58)" />

        {/* Steli e foglie lunghe di tulipano */}
        <path d="M48 64 Q38 44 32 28" fill="none" stroke="#15803d" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M49 64 Q49 40 49 20" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
        <path d="M50 64 Q60 44 66 28" fill="none" stroke="#15803d" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M42 64 C30 52, 26 38, 36 44 C40 50, 43 58, 42 64 Z" fill="#22c55e" />
        <path d="M56 64 C68 52, 72 38, 62 44 C58 50, 55 58, 56 64 Z" fill="#16a34a" />

        {/* 3 Boccioli di Tulipano (Rosa, Giallo, Lilla) */}
        <g transform="translate(24, 14)">
          <path d="M8 18 C1 18, 0 6, 5 2 C7 6, 9 6, 8 0 C11 6, 13 6, 14 2 C18 6, 16 18, 8 18 Z" fill="#f43f5e" />
          <path d="M8 18 C4 16, 4 8, 8 3 C12 8, 12 16, 8 18 Z" fill="#fb7185" />
        </g>
        <g transform="translate(41, 6)">
          <path d="M8 18 C1 18, 0 6, 5 2 C7 6, 9 6, 8 0 C11 6, 13 6, 14 2 C18 6, 16 18, 8 18 Z" fill="#eab308" />
          <path d="M8 18 C4 16, 4 8, 8 3 C12 8, 12 16, 8 18 Z" fill="#fde047" />
        </g>
        <g transform="translate(58, 14)">
          <path d="M8 18 C1 18, 0 6, 5 2 C7 6, 9 6, 8 0 C11 6, 13 6, 14 2 C18 6, 16 18, 8 18 Z" fill="#a855f7" />
          <path d="M8 18 C4 16, 4 8, 8 3 C12 8, 12 16, 8 18 Z" fill="#c084fc" />
        </g>

        {/* Brocca in ceramica crema */}
        <path d="M62 68 C74 68, 74 92, 62 92" fill="none" stroke="#fde68a" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M34 60 L64 60 C68 74, 70 94, 62 106 L36 106 C28 94, 30 74, 34 60 Z"
          fill="url(#pastelPitcher)"
          stroke="#fcd34d"
          strokeWidth="0.9"
        />
        <path d="M36 66 L34 98" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function EasterNestAndEggsProp() {
  return (
    <div className="relative w-[80px] sm:w-[90px] h-[82px] sm:h-[90px] select-none pointer-events-none flex items-end justify-center">
      <svg viewBox="0 0 100 92" className="w-full h-full overflow-visible drop-shadow-[0_8px_12px_rgba(0,0,0,0.58)]">
        <ellipse cx="50" cy="87" rx="36" ry="4.5" fill="rgba(0,0,0,0.58)" />

        {/* Uova pasquali dipinte a mano nel nido */}
        <ellipse cx="36" cy="58" rx="11" ry="15" transform="rotate(-14 36 58)" fill="#f472b6" stroke="#db2777" strokeWidth="0.8" />
        <path d="M27 56 Q36 52 45 56" fill="none" stroke="#fdf2f8" strokeWidth="1.8" />

        <ellipse cx="64" cy="58" rx="11" ry="15" transform="rotate(14 64 58)" fill="#38bdf8" stroke="#0284c7" strokeWidth="0.8" />
        <circle cx="62" cy="53" r="1.8" fill="#fef08a" />
        <circle cx="67" cy="58" r="1.8" fill="#fef08a" />

        <ellipse cx="50" cy="55" rx="12" ry="16" fill="#fde047" stroke="#ca8a04" strokeWidth="0.8" />
        <path d="M39 54 L44 50 L49 54 L54 50 L59 54" fill="none" stroke="#ec4899" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {/* Nido intrecciato in rametti */}
        <path
          d="M16 62 C16 82, 84 82, 84 62 C76 68, 24 68, 16 62 Z"
          fill="#78350f"
          stroke="#451a03"
          strokeWidth="1.2"
        />
        <path d="M20 66 Q50 76 80 66 M24 72 Q50 82 76 72" fill="none" stroke="#a16207" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * Seleziona la decorazione realistica in base al tema scelto e all'indice della mensola,
 * variando gli oggetti da un ripiano all'altro.
 */
export function BookshelfDecoration({
  holiday,
  shelfIndex = 0,
}: {
  holiday: BookshelfHoliday;
  shelfIndex?: number;
}): React.ReactElement | null {
  const effectiveHoliday = holiday === 'auto' ? getAutoHoliday() : holiday;

  switch (effectiveHoliday) {
    case 'christmas': {
      const idx = shelfIndex % 6;
      if (idx === 0) return <ChristmasTreeProp />;
      if (idx === 1) return <SleepingSantaCatProp />;
      if (idx === 2) return <SnowmanProp />;
      if (idx === 3) return <SnowGlobeProp />;
      if (idx === 4) return <ChristmasLanternProp />;
      return <ChristmasCocoaAndNutcrackerProp />;
    }

    case 'halloween': {
      const idx = shelfIndex % 2;
      if (idx === 0) return <HalloweenJackOLanternProp />;
      return <HalloweenPotionAndCandlesProp />;
    }

    case 'easter': {
      const idx = shelfIndex % 2;
      if (idx === 0) return <EasterTulipsVaseProp />;
      return <EasterNestAndEggsProp />;
    }

    case 'autumn': {
      const idx = shelfIndex % 2;
      if (idx === 0) return <AutumnHarvestProp />;
      return <AutumnCandleAndAcornProp />;
    }

    case 'none':
    default: {
      const idx = shelfIndex % 4;
      if (idx === 0) return <MonsteraPlantProp />;
      if (idx === 1) return <VintageGlobeProp />;
      if (idx === 2) return <HourglassAndJournalProp />;
      return <CeramicBonsaiProp />;
    }
  }
}
