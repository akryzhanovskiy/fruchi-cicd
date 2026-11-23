import { MinusIcon, PlusIcon } from './Icons';
import styles from './QtyStepper.module.css';

interface Props {
  value: number;
  max: number;
  onChange: (value: number) => void;
  /** Lowest value the minus button can reach (0 lets it remove the item). */
  min?: number;
  size?: 'sm' | 'md' | 'lg';
  decreaseLabel?: string;
  increaseLabel?: string;
  className?: string;
}

export function QtyStepper({
  value,
  max,
  onChange,
  min = 1,
  size = 'lg',
  decreaseLabel = 'Менше',
  increaseLabel = 'Більше',
  className,
}: Props) {
  const iconSize = size === 'sm' ? 18 : 20;
  return (
    <div className={`${styles.stepper} ${styles[size]} ${className ?? ''}`}>
      <button
        type="button"
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon size={iconSize} />
      </button>
      <span aria-live="polite" aria-label={`Кількість: ${value}`}>
        {value}
      </span>
      <button
        type="button"
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon size={iconSize} />
      </button>
    </div>
  );
}
