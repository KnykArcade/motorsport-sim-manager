// Center track map — the visual anchor. Reuses the simplified 2D oval, marks
// player cars, and shows a weather / track-condition strip beneath the map.

import { useState } from 'react';
import { IsometricTrackMap } from '../../components/IsometricTrackMap';
import { RaceTrack2D, type TrackDot } from '../../components/RaceTrack2D';
import { getTrackMapAsset } from '../../data/trackMaps/getTrackMapAsset';
import type { LiveRaceState } from '../../types/liveTypes';
import { DashPanel } from './dashboardUi';

export function TrackMapPanel({
  live,
  dots,
  rotation,
  series,
  year,
  className = '',
}: {
  live: LiveRaceState;
  dots: TrackDot[];
  rotation: number;
  series: string;
  year: number;
  className?: string;
}) {
  const [isIso, setIso] = useState(false);
  const wet = live.weather.wet;
  const sc = live.safetyCar.active;
  const trackMatch = getTrackMapAsset({ series, year, trackId: live.trackId });
  const canIso = isIso && trackMatch != null;

  return (
    <DashPanel
      title="Track Map"
      className={className}
      bodyClass="flex flex-col"
      right={
        trackMatch && (
          <button
            type="button"
            onClick={() => setIso((v) => !v)}
            className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
            aria-label={isIso ? 'Switch to 2D map' : 'Switch to isometric map'}
          >
            {isIso ? '2D' : 'ISO'}
          </button>
        )
      }
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-1">
        {canIso ? (
          <IsometricTrackMap
            geometry={trackMatch.geometry}
            dots={dots}
            rotation={rotation}
            className="mx-auto h-full max-h-full w-auto max-w-full"
          />
        ) : (
          <RaceTrack2D dots={dots} rotation={rotation} safetyCar={sc} className="mx-auto h-full max-h-full w-auto max-w-full" />
        )}
      </div>
      {/* Weather / track-condition strip */}
      <div className="grid shrink-0 grid-cols-4 gap-px border-t border-slate-700/50 bg-slate-800/40 text-center">
        <Strip label="Weather" value={live.weather.label} tone={wet ? 'warn' : 'good'} />
        <Strip label="Track" value={wet ? 'Wet' : 'Dry'} tone={wet ? 'warn' : 'good'} />
        <Strip
          label="Grip"
          value={`${Math.round(live.weather.gripLevel * 100)}%`}
          tone={live.weather.gripLevel < 0.85 ? 'warn' : 'good'}
        />
        <Strip
          label="Safety Car"
          value={sc ? `OUT ${live.safetyCar.lapsRemaining}` : 'No'}
          tone={sc ? 'crit' : 'good'}
        />
      </div>
    </DashPanel>
  );
}

function Strip({ label, value, tone }: { label: string; value: string; tone: 'good' | 'warn' | 'crit' }) {
  const color = tone === 'crit' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-emerald-300';
  return (
    <div className="bg-[#111725] px-1 py-1">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-[11px] font-semibold ${color}`}>{value}</div>
    </div>
  );
}
