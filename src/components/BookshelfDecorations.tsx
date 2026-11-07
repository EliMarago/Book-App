import React from 'react';

export type BookshelfHoliday = 'none' | 'christmas' | 'halloween' | 'easter' | 'autumn' | 'auto';

export function getAutoHoliday(date = new Date()): 'none' | 'christmas' | 'halloween' | 'easter' | 'autumn' {
  const month = date.getMonth(); // 0 = Jan ... 11 = Dec
  const day = date.getDate();

  // Natale & Capodanno: 1 Dicembre - 6 Gennaio
  if ((month === 11 && day >= 1) || (month === 0 && day <= 6)) {
    return 'christmas';
  }
  // Halloween: 18 Ottobre - 3 Novembre
  if ((month === 9 && day >= 18) || (month === 10 && day <= 3)) {
    return 'halloween';
  }
  // Pasqua / Primavera: 20 Marzo - 25 Aprile
  if ((month === 2 && day >= 20) || (month === 3 && day <= 25)) {
    return 'easter';
  }
  // Autunno: Settembre - Novembre
  if ((month === 8 && day >= 21) || month === 9 || month === 10) {
    return 'autumn';
  }
  return 'none';
}

export interface BookshelfHolidayPropProps {
  holiday?: 'none' | 'christmas' | 'halloween' | 'easter' | 'autumn';
  shelfIndex?: number;
  className?: string;
}

/* =========================================================================
   1. PIANTE & DECORAZIONI PER TEMA NORMALE (Variazione per ripiano)
   ========================================================================= */

/** Ripiano 0: Piantina classica in terracotta con foglia ricurva */
export function BookshelfPlant({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Piantina in terracotta">
      <svg width="76" height="84" viewBox="0 0 76 84" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="38" cy="80" rx="20" ry="3.5" fill="rgba(0,0,0,0.45)" />
        <g id="terracotta-pot">
          <path d="M23 48 L27 77 C27.5 78.5 29 79.5 31 79.5 L45 79.5 C47 79.5 48.5 78.5 49 77 L53 48 Z" fill="#c85e34" />
          <path d="M27 49 L30 77 L33 77 L30 49 Z" fill="rgba(255,255,255,0.25)" />
          <path d="M47 49 L44 77 L48 77 L51 49 Z" fill="rgba(0,0,0,0.18)" />
          <rect x="20" y="44" width="36" height="7" rx="2" fill="#d2663b" />
          <rect x="22" y="45" width="32" height="1.5" fill="rgba(255,255,255,0.3)" />
          <ellipse cx="38" cy="45" rx="16" ry="2.5" fill="#2d1b13" />
        </g>
        <g id="houseplant-stems-leaves">
          <path d="M38 46 L38 20" stroke="#2d6e3c" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 36 Q30 32 24 24" stroke="#2d6e3c" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M38 32 Q46 28 52 20" stroke="#2d6e3c" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M38 40 Q28 40 20 35" stroke="#2d6e3c" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M38 38 Q48 38 56 34" stroke="#2d6e3c" strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* Fogliolina ricurva che scende dal bordo */}
          <path d="M47 49 Q54 52 53 62" stroke="#2d6e3c" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <g transform="translate(53, 56) rotate(35)">
            <ellipse cx="0" cy="0" rx="3.5" ry="6" fill="#439857" />
            <line x1="0" y1="-5" x2="0" y2="5" stroke="#7ac98d" strokeWidth="0.8" />
          </g>
          <g transform="translate(38, 12)">
            <ellipse cx="0" cy="0" rx="5" ry="9" fill="#3f9153" />
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#75c789" strokeWidth="1" />
          </g>
          <g transform="translate(23, 21) rotate(-35)">
            <ellipse cx="0" cy="0" rx="5" ry="8.5" fill="#439857" />
            <line x1="0" y1="-7.5" x2="0" y2="7.5" stroke="#7ac98d" strokeWidth="1" />
          </g>
          <g transform="translate(53, 17) rotate(35)">
            <ellipse cx="0" cy="0" rx="5" ry="8.5" fill="#439857" />
            <line x1="0" y1="-7.5" x2="0" y2="7.5" stroke="#7ac98d" strokeWidth="1" />
          </g>
          <g transform="translate(17, 34) rotate(-55)">
            <ellipse cx="0" cy="0" rx="4.8" ry="8" fill="#439857" />
            <line x1="0" y1="-7" x2="0" y2="7" stroke="#7ac98d" strokeWidth="1" />
          </g>
          <g transform="translate(58, 33) rotate(55)">
            <ellipse cx="0" cy="0" rx="4.8" ry="8" fill="#439857" />
            <line x1="0" y1="-7" x2="0" y2="7" stroke="#7ac98d" strokeWidth="1" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 1: Succulenta geometrica in vaso bianco */
export function SucculentPotProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Succulenta in vaso bianco">
      <svg width="76" height="84" viewBox="0 0 76 84" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="38" cy="80" rx="19" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Vaso bianco geometrico */}
        <polygon points="24,52 30,78 46,78 52,52" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
        <polygon points="24,52 38,52 38,78 30,78" fill="rgba(255,255,255,0.4)" />
        <polygon points="38,52 52,52 46,78 38,78" fill="rgba(203,213,225,0.35)" />
        <ellipse cx="38" cy="52" rx="14" ry="2" fill="#334155" />
        {/* Rosetta succulenta carnosa */}
        <g transform="translate(38, 48)">
          <path d="M-14 -4 C-10 -14 -4 -16 0 -12 C-4 -8 -8 -2 -14 -4 Z" fill="#34d399" />
          <path d="M14 -4 C10 -14 4 -16 0 -12 C4 -8 8 -2 14 -4 Z" fill="#10b981" />
          <path d="M-8 -12 C-4 -22 4 -22 8 -12 C4 -10 -4 -10 -8 -12 Z" fill="#6ee7b7" />
          {/* Punte rosate */}
          <circle cx="0" cy="-21" r="1.5" fill="#f43f5e" />
          <circle cx="-13" cy="-14" r="1.5" fill="#f43f5e" />
          <circle cx="13" cy="-14" r="1.5" fill="#f43f5e" />
          {/* Centro */}
          <ellipse cx="0" cy="-6" rx="5" ry="7" fill="#059669" />
          <circle cx="0" cy="-7" r="2.5" fill="#34d399" />
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 2: Pothos rigoglioso in vaso smaltato blu */
export function PothosPotProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Pothos in vaso blu">
      <svg width="78" height="86" viewBox="0 0 78 86" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="82" rx="19" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Vaso smaltato blu intenso */}
        <path d="M26 54 C26 76 30 80 39 80 C48 80 52 76 52 54 Z" fill="#1e3a8a" stroke="#1d4ed8" strokeWidth="0.8" />
        <ellipse cx="39" cy="54" rx="13" ry="2.5" fill="#0f172a" />
        <ellipse cx="33" cy="67" rx="3" ry="8" fill="rgba(255,255,255,0.25)" />
        {/* Tralci cascanti di pothos */}
        <g id="pothos-vines">
          <path d="M30 52 Q 16 62 18 78" stroke="#15803d" strokeWidth="1.8" fill="none" />
          <path d="M46 52 Q 62 60 58 76" stroke="#15803d" strokeWidth="1.8" fill="none" />
          {/* Foglie cuoriformi */}
          <g transform="translate(18, 70) rotate(-25)">
            <ellipse cx="0" cy="0" rx="5" ry="7" fill="#22c55e" />
            <path d="M0 -6 Q 2 0 0 6" stroke="#bbf7d0" strokeWidth="0.8" />
          </g>
          <g transform="translate(24, 58) rotate(-40)">
            <ellipse cx="0" cy="0" rx="4.5" ry="6.5" fill="#16a34a" />
          </g>
          <g transform="translate(56, 68) rotate(30)">
            <ellipse cx="0" cy="0" rx="5" ry="7" fill="#22c55e" />
            <path d="M0 -6 Q -2 0 0 6" stroke="#bbf7d0" strokeWidth="0.8" />
          </g>
          <g transform="translate(48, 56) rotate(35)">
            <ellipse cx="0" cy="0" rx="4.5" ry="6.5" fill="#16a34a" />
          </g>
          {/* Fogliame superiore */}
          <ellipse cx="39" cy="45" rx="7" ry="10" fill="#22c55e" />
          <ellipse cx="33" cy="40" rx="6" ry="8" fill="#16a34a" />
          <ellipse cx="45" cy="41" rx="6" ry="8" fill="#4ade80" />
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 3: Vaso rustico di lavanda essiccata */
export function LavenderPotProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Lavanda in vasetto ambrato">
      <svg width="76" height="88" viewBox="0 0 76 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="38" cy="84" rx="18" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Vasetto in vetro ambrato da farmacia */}
        <rect x="26" y="56" width="24" height="26" rx="3" fill="#92400e" stroke="#78350f" strokeWidth="1" />
        <rect x="29" y="52" width="18" height="4" rx="1" fill="#78350f" />
        <rect x="30" y="62" width="16" height="12" fill="#fef3c7" rx="1" />
        <line x1="33" y1="66" x2="43" y2="66" stroke="#92400e" strokeWidth="1" />
        <line x1="33" y1="70" x2="41" y2="70" stroke="#92400e" strokeWidth="0.8" />
        {/* Spighe di lavanda viola slanciate */}
        <g id="lavender-stems">
          <line x1="38" y1="52" x2="38" y2="16" stroke="#4ade80" strokeWidth="1.5" />
          <line x1="35" y1="52" x2="30" y2="22" stroke="#4ade80" strokeWidth="1.3" />
          <line x1="41" y1="52" x2="46" y2="20" stroke="#4ade80" strokeWidth="1.3" />
          {/* Fiori di lavanda */}
          <g transform="translate(38, 18)">
            <ellipse cx="-2" cy="0" rx="2" ry="3" fill="#a855f7" />
            <ellipse cx="2" cy="2" rx="2" ry="3" fill="#9333ea" />
            <ellipse cx="-1" cy="6" rx="2" ry="3" fill="#a855f7" />
            <ellipse cx="2" cy="8" rx="2" ry="3" fill="#c084fc" />
            <ellipse cx="0" cy="12" rx="2" ry="3" fill="#9333ea" />
          </g>
          <g transform="translate(30, 24)">
            <ellipse cx="-1" cy="0" rx="1.8" ry="2.5" fill="#a855f7" />
            <ellipse cx="1" cy="3" rx="1.8" ry="2.5" fill="#9333ea" />
            <ellipse cx="0" cy="7" rx="1.8" ry="2.5" fill="#c084fc" />
          </g>
          <g transform="translate(46, 22)">
            <ellipse cx="1" cy="0" rx="1.8" ry="2.5" fill="#a855f7" />
            <ellipse cx="-1" cy="3" rx="1.8" ry="2.5" fill="#9333ea" />
            <ellipse cx="0" cy="7" rx="1.8" ry="2.5" fill="#c084fc" />
          </g>
        </g>
      </svg>
    </div>
  );
}

/* =========================================================================
   2. OGGETTI PER IL TEMA NATALE (Albero, Pupazzo di Neve, Globo, Candela)
   ========================================================================= */

/** Ripiano 0: Albero di Natale addobbato */
export function ChristmasTreeProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Albero di Natale addobbato">
      <svg width="78" height="96" viewBox="0 0 78 96" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="92" rx="22" ry="3.5" fill="rgba(0,0,0,0.45)" />
        <g id="tree-pot">
          <path d="M28 72 L31 91 C31.5 92 33 92.5 35 92.5 L43 92.5 C45 92.5 46.5 92 47 91 L50 72 Z" fill="#6d4223" />
          <path d="M28 77 L50 77" stroke="#b47a3e" strokeWidth="1.5" />
          <path d="M30 86 L48 86" stroke="#b47a3e" strokeWidth="1.5" />
          <ellipse cx="39" cy="72" rx="11" ry="2" fill="#2d1a0e" />
        </g>
        <rect x="36.5" y="66" width="5" height="7" rx="1" fill="#4a2c16" />
        {/* Pacchetto regalo rosso con nastro dorato */}
        <g id="gift-box" transform="translate(13, 75)">
          <rect x="0" y="4" width="14" height="13" rx="1.5" fill="#dc2626" />
          <rect x="5.5" y="4" width="3" height="13" fill="#fbbf24" />
          <rect x="0" y="9" width="14" height="3" fill="#fbbf24" />
          <circle cx="5" cy="3" r="2" fill="#f59e0b" />
          <circle cx="9" cy="3" r="2" fill="#f59e0b" />
          <circle cx="7" cy="4" r="1.5" fill="#fde68a" />
        </g>
        {/* Rami abete */}
        <path d="M12 70 C16 67 22 66 26 68 L24 62 C29 60 35 59 39 61 C43 59 49 60 54 62 L52 68 C56 66 62 67 66 70 C65 67 60 56 49 53 C52 52 56 52 58 50 L39 34 L20 50 C22 52 26 52 29 53 C18 56 13 67 12 70 Z" fill="#144622" />
        <path d="M14 69 Q 39 52 64 69 L 55 58 Q 39 48 23 58 Z" fill="#1c5d2e" />
        <path d="M18 53 C22 50 27 49 31 51 L29 45 C33 43 36 43 39 44 C42 43 45 43 49 45 L47 51 C51 49 56 50 60 53 C59 50 55 42 47 39 C49 38 52 38 54 36 L39 22 L24 36 C26 38 29 38 31 39 C23 42 19 50 18 53 Z" fill="#18562b" />
        <path d="M20 52 Q 39 38 58 52 L 51 42 Q 39 34 27 42 Z" fill="#23743a" />
        <path d="M26 38 C30 35 34 35 37 36 L35 31 C37 30 39 30 41 31 L39 36 C42 35 46 35 50 38 C48 34 44 24 39 15 C34 24 30 34 26 38 Z" fill="#1f6934" />
        <path d="M28 37 Q 39 25 48 37 L 44 28 Q 39 21 34 28 Z" fill="#2d8745" />
        {/* Palline */}
        <circle cx="34" cy="27" r="2.2" fill="#fbbf24" />
        <circle cx="43" cy="33" r="2" fill="#ef4444" />
        <circle cx="28" cy="42" r="2.3" fill="#38bdf8" />
        <circle cx="38" cy="46" r="2.5" fill="#fbbf24" />
        <circle cx="48" cy="43" r="2.2" fill="#ef4444" />
        <circle cx="22" cy="58" r="2.5" fill="#f59e0b" />
        <circle cx="33" cy="62" r="2.4" fill="#ec4899" />
        <circle cx="45" cy="64" r="2.6" fill="#fbbf24" />
        <circle cx="56" cy="59" r="2.3" fill="#38bdf8" />
        {/* Stella in cima */}
        <g transform="translate(39, 13)">
          <path d="M0 -7 L1.8 -2 L6.5 -2 L2.8 1 L4.2 5.5 L0 2.8 L-4.2 5.5 L-2.8 1 L-6.5 -2 L-1.8 -2 Z" fill="#fde047" stroke="#eab308" strokeWidth="0.8" />
          <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 1: Pupazzo di neve con cappello a cilindro e sciarpa */
export function SnowmanProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Pupazzo di neve natalizio">
      <svg width="78" height="92" viewBox="0 0 78 92" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="86" rx="20" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Palla inferiore */}
        <ellipse cx="39" cy="66" rx="19" ry="17" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
        {/* Palla testa */}
        <circle cx="39" cy="40" r="13" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
        {/* Braccia di rametti */}
        <line x1="22" y1="58" x2="8" y2="48" stroke="#78350f" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="12" y1="51" x2="8" y2="44" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="56" y1="58" x2="70" y2="48" stroke="#78350f" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="66" y1="51" x2="70" y2="44" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
        {/* Sciarpa rossa */}
        <path d="M26 48 Q39 53 52 48 Q39 45 26 48 Z" fill="#dc2626" />
        <path d="M44 49 L46 68 L53 67 L49 48 Z" fill="#b91c1c" />
        <line x1="46" y1="68" x2="53" y2="67" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
        {/* Occhi e sorriso di carbone */}
        <circle cx="34" cy="36" r="1.5" fill="#0f172a" />
        <circle cx="44" cy="36" r="1.5" fill="#0f172a" />
        <circle cx="34" cy="44" r="0.8" fill="#0f172a" />
        <circle cx="37" cy="46" r="0.8" fill="#0f172a" />
        <circle cx="41" cy="46" r="0.8" fill="#0f172a" />
        <circle cx="44" cy="44" r="0.8" fill="#0f172a" />
        {/* Naso carota */}
        <polygon points="38,38 48,40 38,42" fill="#ea580c" />
        {/* Bottoni sul corpo */}
        <circle cx="39" cy="58" r="1.5" fill="#0f172a" />
        <circle cx="39" cy="66" r="1.5" fill="#0f172a" />
        <circle cx="39" cy="74" r="1.5" fill="#0f172a" />
        {/* Cilindro nero con fascia rossa */}
        <g id="top-hat">
          <ellipse cx="39" cy="30" rx="16" ry="3.5" fill="#0f172a" />
          <rect x="29" y="14" width="20" height="15" rx="1.5" fill="#1e293b" />
          <ellipse cx="39" cy="14" rx="10" ry="2.5" fill="#334155" />
          <rect x="29" y="25" width="20" height="3" fill="#dc2626" />
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 2: Globo di neve magico con casetta e abete */
export function SnowGlobeProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Globo di neve con casetta">
      <svg width="78" height="92" viewBox="0 0 78 92" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="87" rx="22" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Base in legno tornito */}
        <path d="M23 74 L26 86 L52 86 L55 74 Z" fill="#582f16" stroke="#3b1d0c" strokeWidth="0.8" />
        <rect x="21" y="84" width="36" height="4" rx="1" fill="#3b1d0c" />
        <rect x="33" y="78" width="12" height="4" rx="0.8" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
        {/* Sfera di vetro */}
        <circle cx="39" cy="47" r="26" fill="rgba(224,242,254,0.3)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
        <ellipse cx="39" cy="68" rx="20" ry="4" fill="#ffffff" />
        {/* Casetta rossa innevata */}
        <rect x="33" y="52" width="14" height="12" fill="#dc2626" />
        <polygon points="31,52 40,42 49,52" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.8" />
        <rect x="38" y="56" width="4" height="4" fill="#fef08a" />
        {/* Alberello innevato */}
        <polygon points="24,64 27,56 30,64" fill="#15803d" />
        <polygon points="25,58 27,52 29,58" fill="#ffffff" />
        {/* Fiocchi di neve */}
        <circle cx="28" cy="40" r="1" fill="#ffffff" />
        <circle cx="48" cy="38" r="1.2" fill="#ffffff" />
        <circle cx="34" cy="35" r="0.8" fill="#ffffff" />
        <circle cx="44" cy="46" r="1" fill="#ffffff" />
        {/* Riflesso luce sul vetro */}
        <path d="M22 36 A 23 23 0 0 1 34 25" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

/** Ripiano 3: Candela natalizia accesa con rami di vischio e bacche */
export function ChristmasCandleProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Candela natalizia con vischio">
      <svg width="78" height="90" viewBox="0 0 78 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="84" rx="22" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Portacandela in ottone dorato */}
        <ellipse cx="39" cy="78" rx="18" ry="4" fill="#d97706" />
        <ellipse cx="39" cy="77" rx="16" ry="3" fill="#fbbf24" />
        {/* Rami di pino e vischio alla base */}
        <path d="M22 78 C26 73 34 76 38 78 C42 76 50 73 54 78 Z" fill="#15803d" />
        {/* Bacche rosse */}
        <circle cx="36" cy="77" r="2.2" fill="#dc2626" />
        <circle cx="42" cy="77" r="2.2" fill="#dc2626" />
        <circle cx="39" cy="74" r="2.5" fill="#ef4444" />
        {/* Fusto candela rossa */}
        <rect x="34" y="38" width="10" height="38" rx="1.5" fill="#dc2626" stroke="#b91c1c" strokeWidth="0.6" />
        {/* Cera colata morbida */}
        <path d="M34 42 C35 46 36 46 37 42 C38 48 39 48 40 42 C41 47 43 47 44 42 Z" fill="#ef4444" />
        {/* Stoppino e fiamma */}
        <line x1="39" y1="38" x2="39" y2="30" stroke="#334155" strokeWidth="1.2" />
        <circle cx="39" cy="22" r="10" fill="rgba(251,191,36,0.3)" />
        <path d="M39 16 C36 22 36 28 39 28 C42 28 42 22 39 16 Z" fill="#f59e0b" />
        <path d="M39 20 C38 23 38 26 39 26 C40 26 40 23 39 20 Z" fill="#fef08a" />
      </svg>
    </div>
  );
}

/* =========================================================================
   3. OGGETTI PER IL TEMA HALLOWEEN (Zucca, Calderone, Fantasmino, Gattino)
   ========================================================================= */

/** Ripiano 0: Zucca Jack-o'-Lantern con cappello da strega */
export function HalloweenPumpkinProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Zucca di Halloween Jack-o'-Lantern">
      <svg width="78" height="88" viewBox="0 0 78 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="83" rx="24" ry="4" fill="rgba(0,0,0,0.45)" />
        <g id="pumpkin-body">
          <ellipse cx="23" cy="58" rx="14" ry="19" fill="#c2410c" />
          <ellipse cx="55" cy="58" rx="14" ry="19" fill="#c2410c" />
          <ellipse cx="29" cy="59" rx="14" ry="21" fill="#ea580c" />
          <ellipse cx="49" cy="59" rx="14" ry="21" fill="#ea580c" />
          <ellipse cx="39" cy="60" rx="15" ry="22" fill="#f97316" />
          <ellipse cx="33" cy="54" rx="4" ry="12" fill="rgba(255,255,255,0.18)" />
          <ellipse cx="45" cy="55" rx="3.5" ry="11" fill="rgba(255,255,255,0.12)" />
        </g>
        <path d="M37 39 C37 34 39 30 44 28 C43 32 41 35 41 40 Z" fill="#365314" stroke="#4d7c0f" strokeWidth="0.8" />
        <g id="witch-hat" transform="translate(39, 38) rotate(-14)">
          <ellipse cx="0" cy="0" rx="24" ry="5.5" fill="#18181b" stroke="#27272a" strokeWidth="0.8" />
          <path d="M-12 -1 C-6 -10 2 -24 9 -28 C6 -20 8 -9 12 -1 Z" fill="#27272a" />
          <path d="M-11 -1 C-4 -3 4 -3 11 -1 L10 2 C4 0 -4 0 -10 2 Z" fill="#9333ea" />
          <rect x="-3" y="-1.5" width="6" height="4" rx="1" fill="#fbbf24" stroke="#d97706" strokeWidth="0.6" />
        </g>
        <g id="jack-o-lantern-face">
          <ellipse cx="39" cy="64" rx="18" ry="12" fill="rgba(254,240,138,0.2)" />
          <polygon points="26,53 33,55 29,61" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.8" />
          <polygon points="52,53 45,55 49,61" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.8" />
          <polygon points="39,59 36,65 42,65" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.8" />
          <path d="M24 68 L28 72 L32 68 L36 73 L42 73 L46 68 L50 72 L54 68 L51 75 L45 77 L39 78 L33 77 L27 75 Z" fill="#fef08a" stroke="#ca8a04" strokeWidth="0.8" />
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 1: Calderone magico con pozione fumante */
export function WitchCauldronProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Calderone magico fumante">
      <svg width="78" height="88" viewBox="0 0 78 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="84" rx="22" ry="4" fill="rgba(0,0,0,0.45)" />
        {/* Piedini calderone */}
        <polygon points="24,78 20,84 27,84" fill="#18181b" />
        <polygon points="54,78 58,84 51,84" fill="#18181b" />
        {/* Pancia calderone */}
        <ellipse cx="39" cy="62" rx="22" ry="19" fill="#1c1917" stroke="#292524" strokeWidth="1" />
        <ellipse cx="39" cy="46" rx="20" ry="5.5" fill="#0c0a09" />
        {/* Pozione verde brillante */}
        <ellipse cx="39" cy="46" rx="17" ry="4.5" fill="#84cc16" />
        {/* Bolle che salgono */}
        <circle cx="34" cy="44" r="2.5" fill="#bef264" />
        <circle cx="44" cy="45" r="2" fill="#bef264" />
        <circle cx="38" cy="37" r="2.8" fill="#84cc16" opacity="0.85" />
        <circle cx="46" cy="30" r="2.2" fill="#a3e635" opacity="0.8" />
        {/* Volute di fumo viola */}
        <path d="M30 40 Q 24 28 32 18 Q 38 12 34 4" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.75" />
        <path d="M48 40 Q 56 26 46 16" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.7" />
      </svg>
    </div>
  );
}

/** Ripiano 2: Fantasmino amichevole con lanterna */
export function FriendlyGhostProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Fantasmino amichevole con lanterna">
      <svg width="78" height="88" viewBox="0 0 78 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="84" rx="18" ry="3" fill="rgba(0,0,0,0.35)" />
        {/* Corpo fluttuante bianco */}
        <path d="M24 80 C20 60 22 34 38 34 C54 34 56 60 52 80 C48 76 44 80 40 76 C36 80 32 76 28 80 C26 78 24 80 24 80 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
        {/* Occhi grandi teneri */}
        <ellipse cx="34" cy="46" rx="2.5" ry="3.5" fill="#0f172a" />
        <ellipse cx="44" cy="46" rx="2.5" ry="3.5" fill="#0f172a" />
        <circle cx="35" cy="45" r="1" fill="#ffffff" />
        <circle cx="45" cy="45" r="1" fill="#ffffff" />
        {/* Sorrisino */}
        <ellipse cx="39" cy="54" rx="2.5" ry="3" fill="#0f172a" />
        {/* Lanterna tenuta in mano */}
        <g transform="translate(48, 54)">
          <line x1="0" y1="0" x2="6" y2="8" stroke="#78350f" strokeWidth="1.2" />
          <rect x="2" y="8" width="10" height="14" rx="2" fill="#78350f" stroke="#451a03" strokeWidth="0.8" />
          <rect x="4" y="10" width="6" height="10" fill="#fef08a" />
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 3: Gattino nero che spunta da una zucca */
export function BlackCatPumpkinProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Gattino nero con zucca">
      <svg width="78" height="88" viewBox="0 0 78 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="83" rx="22" ry="4" fill="rgba(0,0,0,0.45)" />
        {/* Zucca arancione alla base */}
        <ellipse cx="39" cy="67" rx="19" ry="15" fill="#ea580c" />
        <ellipse cx="39" cy="67" rx="10" ry="15" fill="#f97316" />
        {/* Gattino nero seduto */}
        <g id="black-cat">
          <ellipse cx="39" cy="46" rx="11" ry="10" fill="#18181b" />
          {/* Orecchie a punta */}
          <polygon points="30,42 27,29 35,36" fill="#18181b" />
          <polygon points="30,40 28,31 34,36" fill="#f43f5e" />
          <polygon points="48,42 51,29 43,36" fill="#18181b" />
          <polygon points="48,40 50,31 44,36" fill="#f43f5e" />
          {/* Occhi ambrati */}
          <ellipse cx="34" cy="45" rx="2.5" ry="3" fill="#fde047" />
          <line x1="34" y1="42.5" x2="34" y2="47.5" stroke="#18181b" strokeWidth="1.2" />
          <ellipse cx="44" cy="45" rx="2.5" ry="3" fill="#fde047" />
          <line x1="44" y1="42.5" x2="44" y2="47.5" stroke="#18181b" strokeWidth="1.2" />
          {/* Nasino rosa */}
          <polygon points="38,48 40,48 39,49.5" fill="#f472b6" />
        </g>
      </svg>
    </div>
  );
}

/* =========================================================================
   4. OGGETTI PER IL TEMA PASQUA (Cestino, Coniglietto, Tulipani, Campana)
   ========================================================================= */

/** Ripiano 0: Cestino di Pasqua con ovetti decorati */
export function EasterBasketProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Cestino di Pasqua con uova decorate">
      <svg width="78" height="90" viewBox="0 0 78 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="84" rx="22" ry="3.5" fill="rgba(0,0,0,0.45)" />
        <path d="M19 60 C18 25 60 25 59 60" stroke="#a16207" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M19 60 C18 25 60 25 59 60" stroke="#ca8a04" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" fill="none" />
        <g transform="translate(39, 28)">
          <ellipse cx="-5" cy="0" rx="4.5" ry="3" fill="#f472b6" stroke="#db2777" strokeWidth="0.6" />
          <ellipse cx="5" cy="0" rx="4.5" ry="3" fill="#f472b6" stroke="#db2777" strokeWidth="0.6" />
          <circle cx="0" cy="0" r="2.2" fill="#fbcfe8" />
          <path d="M-1 2 L-4 8 M1 2 L4 8" stroke="#f472b6" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <g id="bunny-ears" transform="translate(32, 28)">
          <path d="M3 14 C1 7 4 0 7 0 C10 0 13 7 11 14 Z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.8" />
          <path d="M5 12 C4 7 5 3 7 3 C9 3 10 7 9 12 Z" fill="#fbcfe8" />
        </g>
        <g id="bunny-ears-right" transform="translate(42, 29) rotate(12)">
          <path d="M3 14 C1 7 4 0 7 0 C10 0 13 7 11 14 Z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.8" />
          <path d="M5 12 C4 7 5 3 7 3 C9 3 10 7 9 12 Z" fill="#fbcfe8" />
        </g>
        <path d="M16 60 Q 20 48 24 54 Q 30 46 36 52 Q 44 47 48 53 Q 54 48 62 60 Z" fill="#4ade80" />
        <g transform="translate(23, 52) rotate(-18)">
          <ellipse cx="8" cy="11" rx="8" ry="11" fill="#38bdf8" />
          <circle cx="5" cy="8" r="1.3" fill="#ffffff" />
          <circle cx="11" cy="7" r="1.3" fill="#ffffff" />
        </g>
        <g transform="translate(44, 52) rotate(16)">
          <ellipse cx="8" cy="11" rx="8" ry="11" fill="#fde047" />
          <path d="M2 9 Q 8 6 14 9" stroke="#f59e0b" strokeWidth="1.2" fill="none" />
        </g>
        <g transform="translate(32, 47)">
          <ellipse cx="8" cy="12" rx="8.5" ry="12" fill="#c084fc" />
          <path d="M1 12 Q 8 15 15 12" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="2 1.5" fill="none" />
        </g>
        <g id="basket-body">
          <path d="M16 58 L20 81 C20.5 82.5 22 83.5 24 83.5 L54 83.5 C56 83.5 57.5 82.5 58 81 L62 58 Z" fill="#b47a3e" />
          <path d="M16 63 L62 63 M18 70 L60 70 M20 77 L58 77" stroke="#784b1d" strokeWidth="1.2" />
          <rect x="14" y="56" width="50" height="5" rx="2.5" fill="#ca8a04" stroke="#a16207" strokeWidth="0.8" />
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 1: Coniglietto pasquale seduto con carota */
export function EasterBunnyProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Coniglietto pasquale con carota">
      <svg width="78" height="92" viewBox="0 0 78 92" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="86" rx="20" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Corpo coniglietto */}
        <ellipse cx="39" cy="68" rx="16" ry="15" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
        {/* Testa */}
        <circle cx="39" cy="46" r="12" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
        {/* Orecchie lunghe */}
        <g transform="translate(30, 14)">
          <path d="M4 26 C1 12 5 0 9 0 C13 0 17 12 14 26 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
          <path d="M6 22 C4 12 6 4 9 4 C12 4 14 12 12 22 Z" fill="#fbcfe8" />
        </g>
        <g transform="translate(42, 15) rotate(15)">
          <path d="M4 26 C1 12 5 0 9 0 C13 0 17 12 14 26 Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.8" />
          <path d="M6 22 C4 12 6 4 9 4 C12 4 14 12 12 22 Z" fill="#fbcfe8" />
        </g>
        {/* Occhi e musetto */}
        <circle cx="35" cy="44" r="1.5" fill="#0f172a" />
        <circle cx="43" cy="44" r="1.5" fill="#0f172a" />
        <polygon points="38,48 40,48 39,49.5" fill="#f472b6" />
        <path d="M37 50 Q 39 52 41 50" stroke="#0f172a" strokeWidth="0.8" fill="none" />
        {/* Carota tenuta tra le zampine */}
        <g transform="translate(35, 60) rotate(25)">
          <polygon points="0,0 8,-3 4,18" fill="#ea580c" />
          <path d="M2,-3 L0,-8 M4,-3 L4,-9 M6,-3 L8,-7" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 2: Vaso di tulipani primaverili */
export function SpringTulipsProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Vaso di tulipani primaverili">
      <svg width="78" height="90" viewBox="0 0 78 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="84" rx="19" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Vaso in ceramica menta */}
        <path d="M26 54 L29 80 C29.5 82 31 82 39 82 C47 82 48.5 82 49 80 L52 54 Z" fill="#a7f3d0" stroke="#6ee7b7" strokeWidth="1" />
        {/* Steli e foglie tulipani */}
        <line x1="39" y1="54" x2="39" y2="28" stroke="#16a34a" strokeWidth="2" />
        <line x1="36" y1="54" x2="28" y2="34" stroke="#16a34a" strokeWidth="2" />
        <line x1="42" y1="54" x2="50" y2="34" stroke="#16a34a" strokeWidth="2" />
        {/* Foglie */}
        <path d="M32 50 Q 20 40 24 30" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M46 50 Q 58 40 54 30" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Tulipano centrale (Rosa corallo) */}
        <g transform="translate(39, 24)">
          <path d="M-6 8 C-7 0 0 -8 0 -8 C0 -8 7 0 6 8 Z" fill="#fb7185" />
          <path d="M-3 8 C-3 2 0 -2 0 -2 C0 -2 3 2 3 8 Z" fill="#f43f5e" />
        </g>
        {/* Tulipano sinistro (Giallo sole) */}
        <g transform="translate(28, 30)">
          <path d="M-5 7 C-6 0 0 -7 0 -7 C0 -7 6 0 5 7 Z" fill="#fde047" />
          <path d="M-2 7 C-2 2 0 -1 0 -1 C0 -1 2 2 2 7 Z" fill="#f59e0b" />
        </g>
        {/* Tulipano destro (Lilla) */}
        <g transform="translate(50, 30)">
          <path d="M-5 7 C-6 0 0 -7 0 -7 C0 -7 6 0 5 7 Z" fill="#c084fc" />
          <path d="M-2 7 C-2 2 0 -1 0 -1 C0 -1 2 2 2 7 Z" fill="#9333ea" />
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 3: Campana pasquale dorata con fiocco celeste */
export function EasterBellProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Campana pasquale dorata">
      <svg width="78" height="90" viewBox="0 0 78 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="84" rx="20" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Batacchio */}
        <circle cx="39" cy="80" r="3" fill="#b45309" />
        {/* Campana dorata lucente */}
        <path d="M30 46 C30 30 34 26 39 26 C44 26 48 30 48 46 C48 64 56 70 56 76 L22 76 C22 70 30 64 30 46 Z" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
        <ellipse cx="39" cy="76" rx="17" ry="3.5" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8" />
        <ellipse cx="34" cy="52" rx="3" ry="12" fill="rgba(255,255,255,0.3)" />
        {/* Fiocco celeste in cima */}
        <g transform="translate(39, 24)">
          <ellipse cx="-6" cy="0" rx="5" ry="3.5" fill="#38bdf8" />
          <ellipse cx="6" cy="0" rx="5" ry="3.5" fill="#38bdf8" />
          <circle cx="0" cy="0" r="2.5" fill="#bae6fd" />
          <path d="M-2 2 L-6 10 M2 2 L6 10" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

/* =========================================================================
   5. OGGETTI PER IL TEMA AUTUNNO (Zucca crema, Tazza cozy, Lanterna, Funghi)
   ========================================================================= */

/** Ripiano 0: Composizione zucca crema e candela in vasetto */
export function AutumnDecorProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Composizione autunnale">
      <svg width="84" height="88" viewBox="0 0 84 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="44" cy="82" rx="28" ry="4" fill="rgba(0,0,0,0.45)" />
        <g transform="translate(4, 62) rotate(-15)">
          <path d="M12 22 L8 16 C5 17 2 15 0 12 C3 10 3 6 1 4 C5 4 8 7 10 5 C11 2 13 0 16 1 C17 4 19 6 22 5 C21 9 23 12 26 13 C23 15 22 18 20 22 Z" fill="#b91c1c" />
        </g>
        <g transform="translate(52, 64) rotate(22)">
          <path d="M10 20 L7 14 C4 15 2 13 0 10 C3 8 3 5 1 3 C5 3 7 6 9 4 C10 1 12 0 14 1 C15 3 17 5 20 4 C19 7 20 10 23 11 C20 13 19 16 17 20 Z" fill="#d97706" />
        </g>
        {/* Vasetto di vetro con candela accesa */}
        <g id="candle-jar" transform="translate(14, 46)">
          <circle cx="11" cy="4" r="10" fill="rgba(251,191,36,0.3)" />
          <rect x="2" y="14" width="18" height="22" rx="3" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
          <rect x="3.5" y="21" width="15" height="13" rx="1.5" fill="#fde047" fillOpacity="0.75" />
          <line x1="11" y1="21" x2="11" y2="15" stroke="#475569" strokeWidth="1.2" />
          <path d="M11 6 C9 10 9 15 11 15 C13 15 13 10 11 6 Z" fill="#f59e0b" />
        </g>
        {/* Zucca Baby Boo color crema */}
        <g id="cream-pumpkin" transform="translate(34, 44)">
          <ellipse cx="14" cy="24" rx="11" ry="14" fill="#e2d8ce" />
          <ellipse cx="36" cy="24" rx="11" ry="14" fill="#e2d8ce" />
          <ellipse cx="19" cy="25" rx="11" ry="15" fill="#f3ece4" />
          <ellipse cx="31" cy="25" rx="11" ry="15" fill="#f3ece4" />
          <ellipse cx="25" cy="25" rx="12" ry="16" fill="#faf6f0" stroke="#e7dfd5" strokeWidth="0.6" />
          <path d="M24 10 C24 6 27 3 31 1 C29 4 28 7 27 11 Z" fill="#78350f" stroke="#92400e" strokeWidth="0.6" />
        </g>
      </svg>
    </div>
  );
}

/** Ripiano 1: Tazza autunnale fumante pumpkin spice */
export function CozyAutumnMugProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Tazza autunnale speziata">
      <svg width="78" height="88" viewBox="0 0 78 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="83" rx="20" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Manico della tazza */}
        <path d="M48 50 C58 50 62 68 50 72" stroke="#c2410c" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        {/* Corpo tazza in ceramica terracotta */}
        <rect x="22" y="44" width="30" height="34" rx="5" fill="#ea580c" stroke="#c2410c" strokeWidth="1" />
        {/* Cuoricino inciso */}
        <path d="M37 60 C37 57 34 56 32 58 C30 56 27 57 27 60 C27 64 32 68 32 68 C32 68 37 64 37 60 Z" fill="#fed7aa" />
        {/* Panna montata */}
        <ellipse cx="37" cy="44" rx="14" ry="5" fill="#fff7ed" />
        <path d="M28 44 C28 36 34 34 37 34 C40 34 46 36 46 44 Z" fill="#ffffff" />
        {/* Stecca di cannella */}
        <line x1="42" y1="46" x2="52" y2="28" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
        {/* Volute di vapore caldo */}
        <path d="M32 30 Q 30 20 34 14 Q 38 8 35 2" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

/** Ripiano 2: Lanterna rustica con candela */
export function RusticLanternProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Lanterna rustica con candela">
      <svg width="78" height="92" viewBox="0 0 78 92" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="86" rx="20" ry="3.5" fill="rgba(0,0,0,0.45)" />
        {/* Base lanterna */}
        <rect x="24" y="78" width="30" height="5" rx="1" fill="#292524" />
        {/* Vetri e montanti */}
        <rect x="26" y="40" width="26" height="38" fill="rgba(254,240,138,0.2)" stroke="#292524" strokeWidth="1.5" />
        <line x1="26" y1="40" x2="52" y2="78" stroke="#292524" strokeWidth="1" />
        <line x1="52" y1="40" x2="26" y2="78" stroke="#292524" strokeWidth="1" />
        {/* Tetto piramidale e anello */}
        <polygon points="23,40 39,26 55,40" fill="#1c1917" />
        <circle cx="39" cy="22" r="4.5" stroke="#44403c" strokeWidth="1.8" fill="none" />
        {/* Candela interna accesa */}
        <rect x="36" y="56" width="6" height="18" fill="#fef08a" />
        <circle cx="39" cy="50" r="6" fill="rgba(251,191,36,0.5)" />
        <path d="M39 46 C38 49 38 52 39 52 C40 52 40 49 39 46 Z" fill="#f97316" />
      </svg>
    </div>
  );
}

/** Ripiano 3: Composizione con funghetto porcino e ghiande */
export function MushroomHarvestProp({ className = '' }: { className?: string }) {
  return (
    <div className={`relative select-none pointer-events-none shrink-0 ${className}`} title="Composizione funghi e ghiande">
      <svg width="78" height="88" viewBox="0 0 78 88" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <ellipse cx="39" cy="83" rx="22" ry="4" fill="rgba(0,0,0,0.45)" />
        {/* Muschio alla base */}
        <ellipse cx="39" cy="78" rx="18" ry="4" fill="#3f6212" />
        {/* Fungo grande porcino */}
        <path d="M33 76 C32 64 34 50 37 50 C40 50 42 64 41 76 Z" fill="#fef3c7" stroke="#fde68a" strokeWidth="0.8" />
        <path d="M22 52 C22 36 37 32 37 32 C37 32 52 36 52 52 Z" fill="#78350f" stroke="#451a03" strokeWidth="1" />
        <ellipse cx="37" cy="52" rx="15" ry="3.5" fill="#92400e" />
        {/* Funghetto piccolo */}
        <g transform="translate(18, 56)">
          <path d="M8 20 C8 14 9 9 11 9 C13 9 14 14 14 20 Z" fill="#fef3c7" />
          <path d="M3 11 C3 4 11 3 11 3 C11 3 19 4 19 11 Z" fill="#b45309" />
        </g>
        {/* Ghianda a destra */}
        <g transform="translate(48, 68) rotate(30)">
          <ellipse cx="4" cy="7" rx="3.5" ry="5" fill="#92400e" />
          <path d="M0 4 Q 4 1 8 4 Z" fill="#451a03" stroke="#78350f" strokeWidth="0.6" />
        </g>
      </svg>
    </div>
  );
}

/* =========================================================================
   6. COMPONENTE UNIFICATO: CAMBIA OGGETTO PER OGNI RIPIANO!
   ========================================================================= */

export function BookshelfDecoration({
  holiday = 'none',
  shelfIndex = 0,
  className = '',
}: BookshelfHolidayPropProps) {
  const index = Math.abs(shelfIndex) % 4;

  if (holiday === 'christmas') {
    switch (index) {
      case 0:
        return <ChristmasTreeProp className={className} />;
      case 1:
        return <SnowmanProp className={className} />;
      case 2:
        return <SnowGlobeProp className={className} />;
      case 3:
      default:
        return <ChristmasCandleProp className={className} />;
    }
  }

  if (holiday === 'halloween') {
    switch (index) {
      case 0:
        return <HalloweenPumpkinProp className={className} />;
      case 1:
        return <WitchCauldronProp className={className} />;
      case 2:
        return <FriendlyGhostProp className={className} />;
      case 3:
      default:
        return <BlackCatPumpkinProp className={className} />;
    }
  }

  if (holiday === 'easter') {
    switch (index) {
      case 0:
        return <EasterBasketProp className={className} />;
      case 1:
        return <EasterBunnyProp className={className} />;
      case 2:
        return <SpringTulipsProp className={className} />;
      case 3:
      default:
        return <EasterBellProp className={className} />;
    }
  }

  if (holiday === 'autumn') {
    switch (index) {
      case 0:
        return <AutumnDecorProp className={className} />;
      case 1:
        return <CozyAutumnMugProp className={className} />;
      case 2:
        return <RusticLanternProp className={className} />;
      case 3:
      default:
        return <MushroomHarvestProp className={className} />;
    }
  }

  // Stile normale: 4 piante / decorazioni da loft differenti
  switch (index) {
    case 0:
      return <BookshelfPlant className={className} />;
    case 1:
      return <SucculentPotProp className={className} />;
    case 2:
      return <PothosPotProp className={className} />;
    case 3:
    default:
      return <LavenderPotProp className={className} />;
  }
}

/* =========================================================================
   7. LUCINE FESTIVE DI NATALE (FESTONE A MICRO-LED ANIMATO)
   ========================================================================= */

export function ChristmasShelfLights({ animated = true }: { animated?: boolean }) {
  const bulbs = [
    { x: '3%', color: '#fbbf24', halo: 'rgba(251,191,36,0.9)', delay: '0s' },
    { x: '12%', color: '#ef4444', halo: 'rgba(239,68,68,0.85)', delay: '0.5s' },
    { x: '22%', color: '#22c55e', halo: 'rgba(34,197,94,0.85)', delay: '1s' },
    { x: '32%', color: '#fbbf24', halo: 'rgba(251,191,36,0.9)', delay: '0.3s' },
    { x: '42%', color: '#38bdf8', halo: 'rgba(56,189,248,0.85)', delay: '0.8s' },
    { x: '52%', color: '#fbbf24', halo: 'rgba(251,191,36,0.9)', delay: '1.4s' },
    { x: '62%', color: '#ef4444', halo: 'rgba(239,68,68,0.85)', delay: '0.2s' },
    { x: '72%', color: '#22c55e', halo: 'rgba(34,197,94,0.85)', delay: '0.9s' },
    { x: '82%', color: '#fbbf24', halo: 'rgba(251,191,36,0.9)', delay: '0.6s' },
    { x: '92%', color: '#ec4899', halo: 'rgba(236,72,153,0.85)', delay: '1.2s' },
    { x: '97%', color: '#fbbf24', halo: 'rgba(251,191,36,0.9)', delay: '0.4s' },
  ];

  return (
    <div className="w-full h-8 relative select-none pointer-events-none overflow-visible">
      {/* Cavo verde festonato ondulato */}
      <svg className="w-full h-5 overflow-visible" preserveAspectRatio="none" viewBox="0 0 1000 20" fill="none">
        <path
          d="M0 2 Q 50 14, 100 4 T 200 4 T 300 5 T 400 4 T 500 5 T 600 4 T 700 5 T 800 4 T 900 5 T 1000 3"
          stroke="#162e1e"
          strokeWidth="1.8"
          fill="none"
        />
      </svg>
      {/* Bulbi a micro-LED con riflesso e alone caldo */}
      {bulbs.map((b, i) => (
        <div key={i} className="absolute -top-1" style={{ left: b.x, transform: 'translateX(-50%)' }}>
          <div className="w-1.5 h-1.5 mx-auto bg-stone-900 rounded-t-xs" />
          <div
            className={`w-2.5 h-3.5 rounded-full ${animated ? 'animate-pulse' : ''}`}
            style={{
              backgroundColor: b.color,
              boxShadow: `0 0 10px 3px ${b.halo}, inset 0 1px 1px rgba(255,255,255,0.85)`,
              animationDuration: '2.2s',
              animationDelay: b.delay,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/* =========================================================================
   8. PULSANTE DROPDOWN TEMA A PARTE (Nasconde le categorie in un pulsante compatto)
   ========================================================================= */

export interface HolidayOption {
  id: BookshelfHoliday;
  label: string;
  icon: string;
  desc: string;
}

export const HOLIDAY_OPTIONS: HolidayOption[] = [
  { id: 'auto', label: 'Auto', icon: '✨', desc: 'Rileva automaticamente la stagione' },
  { id: 'none', label: 'Piante', icon: '🌱', desc: 'Piante, succulente, pothos e lavanda' },
  { id: 'christmas', label: 'Natale', icon: '🎄', desc: 'Albero, pupazzo, globo e lucine' },
  { id: 'halloween', label: 'Halloween', icon: '🎃', desc: 'Zucche, calderone e fantasmini' },
  { id: 'easter', label: 'Pasqua', icon: '🌸', desc: 'Cestino, coniglietto e tulipani' },
  { id: 'autumn', label: 'Autunno', icon: '🍂', desc: 'Zucca crema, candela e tazza' },
];

interface HolidayDropdownProps {
  currentHoliday: BookshelfHoliday;
  onSelectHoliday: (holiday: BookshelfHoliday) => void;
}

export function HolidayDropdown({ currentHoliday, onSelectHoliday }: HolidayDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentOption = HOLIDAY_OPTIONS.find((o) => o.id === currentHoliday) || HOLIDAY_OPTIONS[0];

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
          currentHoliday !== 'none'
            ? 'bg-amber-500/15 light:bg-amber-100 text-amber-400 light:text-amber-800 border-amber-500/40 light:border-amber-300 hover:bg-amber-500/25'
            : 'bg-stone-900/90 light:bg-stone-100 text-stone-300 light:text-stone-700 border-stone-800 light:border-stone-300 hover:text-white light:hover:text-stone-950'
        }`}
        title="Scegli il tema dello scaffale"
      >
        <span className="text-sm leading-none">{currentOption.icon}</span>
        <span className="hidden xs:inline">{currentOption.label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 xs:left-auto xs:right-0 top-full mt-1.5 w-60 sm:w-64 max-w-[calc(100vw-2rem)] p-1.5 rounded-2xl bg-stone-900/95 light:bg-white border border-stone-750 light:border-stone-200 shadow-2xl z-50 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 mb-1 border-b border-stone-800 light:border-stone-100 flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-stone-400 light:text-stone-500 font-sans">
              Tema dello Scaffale
            </span>
            <span className="text-[10px] text-amber-400 light:text-amber-600 font-medium">
              {currentOption.label}
            </span>
          </div>

          <div className="space-y-1">
            {HOLIDAY_OPTIONS.map((opt) => {
              const isSelected = currentHoliday === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelectHoliday(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                      : 'text-stone-200 light:text-stone-800 hover:bg-stone-800/80 light:hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base leading-none">{opt.icon}</span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{opt.label}</div>
                      <div
                        className={`text-[10px] truncate ${
                          isSelected ? 'text-stone-900/80' : 'text-stone-400 light:text-stone-500'
                        }`}
                      >
                        {opt.desc}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   9. TOOLBAR SELETTORE TEMI (PER RETROCOMPATIBILITÀ)
   ========================================================================= */

interface HolidayBarProps {
  currentHoliday: BookshelfHoliday;
  onSelectHoliday: (holiday: BookshelfHoliday) => void;
}

export function HolidayBar({ currentHoliday, onSelectHoliday }: HolidayBarProps) {
  return <HolidayDropdown currentHoliday={currentHoliday} onSelectHoliday={onSelectHoliday} />;
}
