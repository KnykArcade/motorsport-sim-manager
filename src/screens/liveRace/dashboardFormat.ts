// Non-component helpers for the Live Race dashboard: the risk colour language
// and small formatting utilities. Kept separate from the component atoms so the
// component file only exports components (react-refresh friendly).

import type { RiskLevel } from '../../types/liveTypes';

export type RiskStyle = { chip: string; dot: string; text: string; label: string };

export const RISK_STYLE: Record<RiskLevel, RiskStyle> = {
  Low: {
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    label: 'LOW',
  },
  Medium: {
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    label: 'MEDIUM',
  },
  Elevated: {
    chip: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    dot: 'bg-orange-400',
    text: 'text-orange-300',
    label: 'ELEVATED',
  },
  High: {
    chip: 'bg-red-600/20 text-red-200 border-red-500/55',
    dot: 'bg-red-500',
    text: 'text-red-300',
    label: 'HIGH',
  },
  Critical: {
    chip: 'bg-red-600/25 text-red-200 border-red-500/60',
    dot: 'bg-red-500',
    text: 'text-red-300',
    label: 'CRITICAL',
  },
};

// Format a lap time in seconds as M:SS.mmm (or SS.mmm under a minute).
export function fmtLap(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  if (seconds < 60) return seconds.toFixed(3);
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function fmtSector(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  return seconds.toFixed(3);
}

export function ordinal(pos: number | null): string {
  return pos == null ? 'OUT' : `P${pos}`;
}

// Standardized position-delta (grid movement) display used across the Live Race
// UI. `delta = startingGrid - currentPosition` (positive = gained). A null delta
// (driver not classified) renders as a muted em dash.
//   > 0  ▲{n}  green
//   = 0  ━0    neutral gray
//   < 0  ▼{n}  red
export type DeltaTone = 'up' | 'flat' | 'down' | 'none';

export function deltaDisplay(delta: number | null): {
  text: string;
  tone: DeltaTone;
  className: string;
} {
  if (delta == null) return { text: '—', tone: 'none', className: 'text-slate-600' };
  if (delta > 0) return { text: `▲${delta}`, tone: 'up', className: 'text-emerald-400' };
  if (delta < 0) return { text: `▼${-delta}`, tone: 'down', className: 'text-red-400' };
  return { text: '━0', tone: 'flat', className: 'text-slate-400' };
}

// Tyre compound letter + colour (the sim models Dry/Wet only).
export function tyreLetter(compound: string): { letter: string; className: string } {
  if (compound === 'Wet') return { letter: 'W', className: 'bg-sky-500 text-white' };
  return { letter: 'D', className: 'bg-slate-200 text-slate-900' };
}
