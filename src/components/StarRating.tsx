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

  const handleClick = (e: React.MouseEvent, index: number) => {
    if (readOnly || !onChange) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;

    const newValue = isLeftHalf ? index - 0.5 : index;
    onChange(newValue);
  };

  const handleMouseEnter = (e: React.MouseEvent, index: number) => {
    if (readOnly) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - rect.left < rect.width / 2;

    setHoverValue(isLeftHalf ? index - 0.5 : index);
  };

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHoverValue(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFull = displayValue >= star;
        const isHalf = !isFull && displayValue >= star - 0.5;

        return (
          <div
            key={star}
            className={`relative ${readOnly ? '' : 'cursor-pointer'}`}
            onMouseMove={(e) => handleMouseEnter(e, star)}
            onClick={(e) => handleClick(e, star)}
          >
            <Star size={size} className="text-stone-300" fill="currentColor" strokeWidth={0} />
            {(isFull || isHalf) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: isHalf ? '50%' : '100%' }}
              >
                <Star
                  size={size}
                  className="text-amber-400"
                  fill="currentColor"
                  strokeWidth={0}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
