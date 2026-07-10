// Shared visual atoms for the Live Race broadcast dashboard: risk chips/dots,
// compact panels, gauges and formatting helpers. All styling follows the dark
// broadcast/pit-wall style guide (charcoal background, navy panels, muted
// gray-blue borders, colour-coded status).

import type { ReactNode } from 'react';
import type { RiskLevel } from '../../types/liveTypes';
import { RISK_STYLE, deltaDisplay } from './dashboardFormat';
import { positionDeltaValue } from '../../sim/positionDelta';
import { ratingColor } from '../../components/ui';

// Standardized grid-movement tag (▲n / ━0 / ▼n) shown next to a driver's
// position across the timing tower and pit-wall cards. `grid`/`position` are the
// starting-grid and current positions; `muted` grays out an unclassified driver.
export function DeltaTag({
  grid,
  position,
  muted = false,
  className = '',
}: {
  grid: number;
  position: number | null;
  muted?: boolean;
  className?: string;
}) {
  const d = deltaDisplay(muted ? null : positionDeltaValue(grid, position));
  return (
    <span
      title="Change from starting grid position"
      className={`font-semibold tabular-nums ${d.className} ${className}`}
    >
      {d.text}
    </span>
  );
}

// A large colour-coded risk chip for the pit-wall driver cards.
export function RiskChip({ kind, level }: { kind: 'R' | 'C'; level: RiskLevel }) {
  const s = RISK_STYLE[level];
  return (
    <div className={`rounded-md border px-2 py-1 text-center ${s.chip}`}>
      <div className="text-[9px] font-semibold uppercase tracking-wide opacity-80">
        {kind === 'R' ? 'Reliability' : 'Crash'}
      </div>
      <div className="text-xs font-bold uppercase tracking-wide">{s.label}</div>
    </div>
  );
}

// A compact reliability/crash indicator for the timing tower (R / C letter dots).
export function RiskDot({ kind, level }: { kind: 'R' | 'C'; level: RiskLevel }) {
  const s = RISK_STYLE[level];
  return (
    <span
      title={`${kind === 'R' ? 'Reliability' : 'Crash'} risk: ${s.label}`}
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-neutral-950 ${s.dot}`}
    >
      {kind}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

// A compact dashboard panel with a small header. `bodyClass` controls the body
// (e.g. `overflow-y-auto` for scrollable panels, `min-h-0` for grid children).
export function DashPanel({
  title,
  right,
  children,
  className = '',
  bodyClass = '',
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700/60 bg-[#111725] ${className}`}
    >
      {title && (
        <div className="flex shrink-0 items-center justify-between border-b border-slate-700/50 px-3 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</span>
          {right}
        </div>
      )}
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gauges
// ---------------------------------------------------------------------------

// A thin labelled progress bar (component health, fuel, tyre life).
export function Gauge({
  label,
  value,
}: {
  label: string;
  value: number; // 0-100
}) {
  const pct = Math.max(0, Math.min(100, value));
  const color = ratingColor(pct);
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 shrink-0 text-[10px] text-slate-400">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <span className="block h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </span>
      <span className="w-8 shrink-0 text-right text-[10px] tabular-nums" style={{ color }}>{Math.round(pct)}%</span>
    </div>
  );
}
