import type { CSSProperties } from 'react';

/**
 * Sigillo numerato in stile "lamina metallica" (oro / argento / bronzo) per
 * la classifica dei migliori libri e la priorità di lettura sui dorsi e sulle copertine.
 * Sostituisce le vecchie etichette rettangolari colorate con un medaglione tondo,
 * più elegante e coerente con l'estetica da libreria.
 */
type SealTone = 'gold' | 'silver' | 'bronze' | 'ivory' | 'ink';

const TONES: Record<SealTone, { face: string; ring: string; text: string; shadow: string }> = {
  gold: {
    face: 'radial-gradient(circle at 32% 28%, #fff7d1 0%, #fcd34d 32%, #d99a1e 68%, #8a5a0c 100%)',
    ring: 'rgba(255, 240, 190, 0.85)',
    text: '#3a2305',
    shadow: '0 1px 0 rgba(255,250,225,0.6)',
  },
  silver: {
    face: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #e7e5e4 35%, #a8a29e 72%, #57534e 100%)',
    ring: 'rgba(255, 255, 255, 0.85)',
    text: '#1c1917',
    shadow: '0 1px 0 rgba(255,255,255,0.7)',
  },
  bronze: {
    face: 'radial-gradient(circle at 32% 28%, #ffe1c7 0%, #e09a63 34%, #a85a26 70%, #5c2a0b 100%)',
    ring: 'rgba(255, 220, 190, 0.75)',
    text: '#2b1204',
    shadow: '0 1px 0 rgba(255,225,200,0.5)',
  },
  ivory: {
    face: 'radial-gradient(circle at 32% 28%, #fffdf7 0%, #f3ead8 55%, #cdbd9c 100%)',
    ring: 'rgba(120, 90, 50, 0.45)',
    text: '#3b2a17',
    shadow: '0 1px 0 rgba(255,255,255,0.6)',
  },
  ink: {
    face: 'radial-gradient(circle at 32% 28%, #4a4038 0%, #241d18 60%, #120e0b 100%)',
    ring: 'rgba(252, 211, 77, 0.55)',
    text: '#fcd9a0',
    shadow: '0 1px 1px rgba(0,0,0,0.8)',
  },
};

function getTone(kind: 'best' | 'want', rank: number): SealTone {
  if (rank === 1) return 'gold';
  if (kind === 'best') {
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return 'ink';
  }
  return rank <= 3 ? 'ivory' : 'ink';
}

interface RankSealProps {
  rank: number;
  kind: 'best' | 'want';
  size?: 'sm' | 'md';
  className?: string;
}

export function RankSeal({ rank, kind, size = 'sm', className = '' }: RankSealProps) {
  const tone = TONES[getTone(kind, rank)];
  const px = size === 'md' ? 26 : 20;
  const fontSize = rank >= 10 ? (size === 'md' ? 11 : 9) : size === 'md' ? 13 : 10.5;

  const style: CSSProperties = {
    width: px,
    height: px,
    background: tone.face,
    color: tone.text,
    textShadow: tone.shadow,
    fontSize,
    boxShadow: `0 0 0 1px rgba(0,0,0,0.35), inset 0 0 0 1.5px ${tone.ring}, inset 0 -2px 3px rgba(0,0,0,0.25), 0 2px 5px rgba(0,0,0,0.55)`,
  };

  const label =
    kind === 'best'
      ? `${rank}° nella classifica dei migliori`
      : rank === 1
        ? 'Prossima lettura'
        : `${rank}° nella lista da leggere`;

  return (
    <span className={`relative inline-flex flex-col items-center ${className}`} title={label} aria-label={label}>
      {/* Coroncina per il 1° della classifica / stellina per la prossima lettura */}
      {rank === 1 && (
        <svg
          width={size === 'md' ? 14 : 11}
          height={size === 'md' ? 9 : 7}
          viewBox="0 0 14 9"
          className="-mb-[2px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]"
          aria-hidden="true"
        >
          {kind === 'best' ? (
            <path d="M1 8 L2 2 L5 5 L7 0.5 L9 5 L12 2 L13 8 Z" fill="#fcd34d" stroke="#8a5a0c" strokeWidth="0.8" strokeLinejoin="round" />
          ) : (
            <path d="M7 0.5 L8.6 3.4 L12 3.8 L9.5 6 L10.2 8.8 L7 7.3 L3.8 8.8 L4.5 6 L2 3.8 L5.4 3.4 Z" fill="#fcd34d" stroke="#8a5a0c" strokeWidth="0.7" strokeLinejoin="round" />
          )}
        </svg>
      )}
      <span
        className="rounded-full flex items-center justify-center font-serif font-bold leading-none tabular-nums select-none"
        style={style}
      >
        {rank}
      </span>
    </span>
  );
}

