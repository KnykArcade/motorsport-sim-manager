import { ratingColor } from './ui';

type Props = {
  label: string;
  value: number; // 0-max
  max?: number;
  showValue?: boolean;
};

// A horizontal labelled rating bar.
export function StatBar({ label, value, max = 10, showValue = true }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = ratingColor((value / max) * 10);
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-neutral-400">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {showValue && (
        <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color }}>
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
