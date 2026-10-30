import { useState } from 'react';
import { Star } from 'lucide-react';

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
};

export function StarRating({ value, onChange, size = 24, readOnly = false }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue ?? value;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
    if (readOnly || !onChange) return;

    const rect = e.currentTarget.getBoundingClientRect();
    // Se l'evento proviene da tastiera (clientX === 0), usa la stella intera
    const isKeyboard = e.clientX === 0 && e.clientY === 0;
    const isLeftHalf = !isKeyboard && e.clientX - rect.left < rect.width / 2;

    const newValue = isLeftHalf ? index - 0.5 : index;
    // Se l'utente riclicca esattamente lo stesso voto, azzera la valutazione a 0
    onChange(newValue === value ? 0 : newValue);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
    if (readOnly) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;

    setHoverValue(isLeftHalf ? index - 0.5 : index);
  };

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role="group"
      aria-label={`Valutazione: ${value} su 5 stelle`}
      onMouseLeave={() => setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isFull = displayValue >= star;
        const isHalf = !isFull && displayValue >= star - 0.5;

        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            aria-label={
              value === star
                ? `Rimuovi valutazione (${star} stelle)`
                : `Valuta ${star} ${star === 1 ? 'stella' : 'stelle'}`
            }
            title={
              readOnly
                ? undefined
                : value === star || value === star - 0.5
                  ? 'Clicca di nuovo per azzerare il voto'
                  : `${star} ${star === 1 ? 'stella' : 'stelle'}`
            }
            className={`relative p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              readOnly ? 'cursor-default' : 'cursor-pointer active:scale-90 transition-transform'
            }`}
            onMouseMove={(e) => handleMouseEnter(e, star)}
            onClick={(e) => handleClick(e, star)}
          >
            <Star
              size={size}
              className="text-stone-700 light:text-stone-300 transition-colors"
              fill="currentColor"
              strokeWidth={0}
            />
            {(isFull || isHalf) && (
              <div
                className="absolute inset-0.5 overflow-hidden pointer-events-none"
                style={{ width: isHalf ? `calc(50% - 2px)` : `calc(100% - 4px)` }}
              >
                <Star
                  size={size}
                  className="text-amber-400"
                  fill="currentColor"
                  strokeWidth={0}
                />
              </div>
            )}
          </button>
        );
      })}
      {displayValue > 0 && (
        <span className="ml-1 text-[11px] font-sans font-semibold text-amber-400/90 light:text-amber-700 tabular-nums">
          {displayValue % 1 === 0 ? displayValue : displayValue.toFixed(1)}
        </span>
      )}
    </div>
  );
}
