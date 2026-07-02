// Fixed top race status bar — always visible. Shows live race status, track,
// weather, lap count, cars running, season/round/budget, race name, the race
// playback controls, and the Exit to HQ button.

import type { ReactNode } from 'react';
import type { LiveRaceState } from '../../types/liveTypes';
import { formatMoney } from '../../components/ui';

export function TopStatusBar({
  raceName,
  trackName,
  live,
  fieldSize,
  season,
  round,
  roundTotal,
  budget,
  controls,
  onExit,
}: {
  raceName: string;
  trackName: string;
  live: LiveRaceState;
  fieldSize: number;
  season: number;
  round: number;
  roundTotal: number;
  budget: number;
  controls: ReactNode;
  onExit: () => void;
}) {
  const finished = live.phase === 'finished';
  const running = live.cars.filter((c) => c.running).length;
  const statusText = finished ? 'FINISHED' : live.safetyCar.active ? 'SAFETY CAR' : 'LIVE';
  const statusTone = finished
    ? 'bg-emerald-500/20 text-emerald-300'
    : live.safetyCar.active
    ? 'bg-amber-500/20 text-amber-300'
    : 'bg-red-500/20 text-red-300 animate-pulse';

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-slate-700/60 bg-[#0d1220] px-4 py-2">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest ${statusTone}`}>
          {statusText}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold leading-tight text-slate-100">{raceName}</div>
          <div className="truncate text-[10px] leading-tight text-slate-500">{trackName}</div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center gap-4 overflow-x-auto">
        <Metric label="Lap" value={`${Math.min(live.currentLap, live.totalLaps)}/${live.totalLaps}`} accent />
        <Metric label="Running" value={`${running}/${fieldSize}`} tone={running < fieldSize ? 'warn' : 'normal'} />
        <Metric label="Weather" value={live.weather.label} tone={live.weather.wet ? 'warn' : 'normal'} />
        <Metric label="Track" value={live.weather.wet ? 'Wet' : 'Dry'} tone={live.weather.wet ? 'warn' : 'good'} />
        <span className="h-6 w-px bg-slate-700" />
        <Metric label="Season" value={String(season)} />
        <Metric label="Round" value={`${round}/${roundTotal}`} />
        <Metric label="Budget" value={formatMoney(budget)} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {controls}
        <button
          onClick={onExit}
          className="rounded border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          Exit to HQ
        </button>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  tone = 'normal',
  accent,
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'warn' | 'good';
  accent?: boolean;
}) {
  const color = accent
    ? 'text-amber-300'
    : tone === 'warn'
    ? 'text-amber-300'
    : tone === 'good'
    ? 'text-emerald-300'
    : 'text-slate-100';
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
