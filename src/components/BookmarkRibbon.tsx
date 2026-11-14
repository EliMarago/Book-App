interface BookmarkRibbonProps {
  /** Classi di posizionamento (es. `right-[18%]`): il nastro e' `absolute`, il genitore deve essere `relative`. */
  className?: string;
  /** Larghezza del nastro in px. */
  width?: number;
  /** Quanto sporge sopra il taglio superiore del libro, in px. */
  up?: number;
  /** Quanto ricade sul fronte del libro sotto il taglio superiore: px (numero) o lunghezza CSS (es. `'72%'`). */
  down?: number | string;
  /**
   * `flat` (default): nastro piatto che esce dalle pagine e ricade sulla copertina.
   * `loop`: nastro che fa un'ansa arrotondata sopra la testa del libro e scende lungo il dorso,
   * con trama di raso a righine (per i dorsi).
   */
  variant?: 'flat' | 'loop';
}

const NOTCH = 6;

/** Poligono con cappa semicircolare in alto e coda di rondine in basso. */
function loopClipPath(width: number): string {
  const r = width / 2;
  const arc: string[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI; // da sinistra, passando per l'alto, a destra
    const x = r + r * Math.cos(a);
    const y = r + r * Math.sin(a);
    arc.push(`${x.toFixed(2)}px ${y.toFixed(2)}px`);
  }
  return `polygon(${arc.join(', ')}, 100% 100%, 50% calc(100% - ${NOTCH}px), 0 100%)`;
}

/**
 * Segnalibro a nastro per i libri in lettura.
 * Va reso come fratello del contenitore `overflow-hidden` del libro, dentro un genitore
 * `relative`, cosi' la parte che sporge resta visibile.
 */
export function BookmarkRibbon({
  className = '',
  width = 10,
  up = 10,
  down = 26,
  variant = 'flat',
}: BookmarkRibbonProps) {
  const isLoop = variant === 'loop';
  const downCss = typeof down === 'number' ? `${down}px` : down;
  return (
    <span
      aria-hidden="true"
      className={`bookmark-ribbon pointer-events-none absolute z-30 ${isLoop ? 'bookmark-ribbon--loop' : ''} ${className}`}
      style={{
        width,
        height: `calc(${up}px + ${downCss})`,
        top: -up,
        ['--ribbon-up' as string]: `${up}px`,
      }}
    >
      <span className="bookmark-ribbon-inner" style={isLoop ? { clipPath: loopClipPath(width) } : undefined} />
    </span>
  );
}

