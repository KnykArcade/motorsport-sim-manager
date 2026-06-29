import { ratingColor } from './ui';

type Props = {
  value: number;
  max?: number;
  label?: string;
};

// A small colored pill showing a numeric rating.
export function RatingBadge({ value, max = 10, label }: Props) {
  const color = ratingColor((value / max) * 10);
  return (
    <span className="inline-flex items-center gap-1">
      {label && <span className="text-xs text-neutral-400">{label}</span>}
      <span
        className="inline-flex min-w-[2.25rem] justify-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums"
        style={{ backgroundColor: `${color}22`, color }}
      >
        {value.toFixed(1)}
      </span>
    </span>
  );
}
