import { useState } from 'react';
import { optimizeCoverUrl } from '@/lib/coverUrl';

type CoverImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  /** Larghezza della miniatura da richiedere al server (default 300px, adatta a schermi retina) */
  thumbWidth?: number;
};

/**
 * Copertina leggera e con caricamento morbido:
 * - chiede al server una miniatura ridimensionata (meno dati e meno lavoro di decodifica);
 * - se la miniatura non è disponibile ripiega sull'immagine originale;
 * - mentre l'immagine arriva mostra un segnaposto animato, poi la fa apparire in dissolvenza;
 * - se anche l'originale fallisce, il segnaposto sparisce e resta il fallback del componente padre.
 */
export function CoverImage({ src, thumbWidth = 300, className = '', onLoad, onError, ...props }: CoverImageProps) {
  const optimized = optimizeCoverUrl(src, thumbWidth);
  const [useOriginalFor, setUseOriginalFor] = useState<string | null>(null);
  const currentSrc = useOriginalFor === src ? src : optimized;

  const [settledSrc, setSettledSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const settled = settledSrc === currentSrc;
  const visible = settled && loaded;

  return (
    <>
      {!settled && (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-stone-800 via-stone-700/70 to-stone-800 light:from-stone-200 light:via-stone-100 light:to-stone-200"
        />
      )}
      <img
        {...props}
        src={currentSrc}
        ref={(el) => {
          // Immagini già in cache: possono risultare complete prima dell'evento onLoad
          if (el?.complete && el.naturalWidth > 0 && !settled) {
            setSettledSrc(currentSrc);
            setLoaded(true);
          }
        }}
        onLoad={(e) => {
          setSettledSrc(currentSrc);
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => {
          // La miniatura non esiste: riprova con l'URL originale prima di arrendersi
          if (currentSrc !== src) {
            setUseOriginalFor(src);
            return;
          }
          setSettledSrc(currentSrc);
          setLoaded(false);
          onError?.(e);
        }}
        className={`${className} transition-[opacity,transform] duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />
    </>
  );
}

