// Bottom dashboard row: Pit Strategy, Live Timing (fastest lap + best sectors),
// Race Info, and Weather Forecast. All compact and always visible.

import type { LiveCarState, LiveRaceState } from '../../types/liveTypes';
import { DashPanel } from './dashboardUi';
import { fmtLap, fmtSector } from './dashboardFormat';
import type { ForecastEntry } from './forecast';

export function BottomRow({
  live,
  playerCars,
  nameOf,
  forecast,
  distanceKm,
  fieldSize,
  onEditStrategy,
}: {
  live: LiveRaceState;
  playerCars: LiveCarState[];
  nameOf: (id: string) => string;
  forecast: ForecastEntry[];
  distanceKm?: number;
  fieldSize: number;
  onEditStrategy: () => void;
}) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
      <PitStrategyPanel
        live={live}
        playerCars={playerCars}
        nameOf={nameOf}
        fieldSize={fieldSize}
        onEdit={onEditStrategy}
      />
      <LiveTimingPanel live={live} nameOf={nameOf} />
      <RaceInfoPanel live={live} distanceKm={distanceKm} />
      <WeatherForecastPanel forecast={forecast} />
    </div>
  );
}

function PitStrategyPanel({
  live,
  playerCars,
  nameOf,
  fieldSize,
  onEdit,
}: {
  live: LiveRaceState;
  playerCars: LiveCarState[];
  nameOf: (id: string) => string;
  fieldSize: number;
  onEdit: () => void;
}) {
  const running = playerCars.filter((c) => c.running);
  return (
    <DashPanel
      title="Pit Strategy"
      right={
        <button
          onClick={onEdit}
          className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-700"
        >
          Edit
        </button>
      }
      bodyClass="overflow-y-auto"
    >
      <div className="space-y-1.5 p-2">
        {running.length === 0 ? (
          <p className="text-[11px] text-slate-500">No cars running.</p>
        ) : (
          running.map((c) => {
            const w = c.pit.window;
            const stopsLeft = c.pit.plannedStops - c.pit.stopsMade;
            const nextWindow =
              !w || stopsLeft <= 0
                ? '—'
                : live.currentLap < w.open
                ? `L${w.open}-${w.close}`
                : live.currentLap <= w.close
                ? `OPEN → L${w.close}`
                : 'overdue';
            const lo = Math.max(1, (c.position ?? fieldSize) - 1);
            const hi = Math.min(fieldSize, (c.position ?? 1) + 2);
            return (
              <div key={c.driverId} className="rounded border border-slate-700/50 bg-slate-800/30 px-2 py-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200">{nameOf(c.driverId)}</span>
                  <span className="tabular-nums text-slate-400">
                    Stops {c.pit.stopsMade}/{c.pit.plannedStops}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    Window: <span className="font-semibold text-slate-300">{nextWindow}</span>
                  </span>
                  <span>
                    Proj: <span className="font-semibold text-slate-300">P{lo}-P{hi}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashPanel>
  );
}

function LiveTimingPanel({ live, nameOf }: { live: LiveRaceState; nameOf: (id: string) => string }) {
  const fastest = live.cars.reduce<LiveCarState | null>(
    (best, c) => (c.bestLap != null && (best?.bestLap == null || c.bestLap < best.bestLap) ? c : best),
    null,
  );
  const bestSectors = computeBestSectors(live.cars);
  return (
    <DashPanel title="Live Timing" bodyClass="overflow-y-auto">
      <div className="space-y-1 p-2 text-[11px]">
        <Line
          label="Fastest Lap"
          value={fastest?.bestLap != null ? fmtLap(fastest.bestLap) : '—'}
          who={fastest?.bestLap != null ? nameOf(fastest.driverId) : ''}
          highlight
        />
        {(['S1', 'S2', 'S3'] as const).map((s, i) => (
          <Line
            key={s}
            label={`Sector ${i + 1}`}
            value={fmtSector(bestSectors[i]?.time)}
            who={bestSectors[i] ? nameOf(bestSectors[i]!.driverId) : ''}
          />
        ))}
      </div>
    </DashPanel>
  );
}

function Line({
  label,
  value,
  who,
  highlight,
}: {
  label: string;
  value: string;
  who: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="max-w-[90px] truncate text-[10px] text-slate-400">{who}</span>
        <span className={`tabular-nums font-bold ${highlight ? 'text-fuchsia-300' : 'text-slate-200'}`}>{value}</span>
      </span>
    </div>
  );
}

function RaceInfoPanel({ live, distanceKm }: { live: LiveRaceState; distanceKm?: number }) {
  const leader = live.cars.find((c) => c.position === 1 && (c.running || c.status === 'Finished'));
  const elapsed = leader ? leader.totalTime : 0;
  const lapsDone = Math.min(live.currentLap, live.totalLaps);
  const covered = distanceKm ? (distanceKm * lapsDone) / live.totalLaps : undefined;
  const avgSpeed = covered && elapsed > 0 ? (covered / (elapsed / 3600)).toFixed(0) : undefined;
  return (
    <DashPanel title="Race Info" bodyClass="overflow-y-auto">
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 p-2 text-[11px]">
        <Info label="Distance" value={distanceKm ? `${distanceKm} km` : `${live.totalLaps} laps`} />
        <Info label="Laps" value={`${lapsDone}/${live.totalLaps}`} />
        <Info label="Elapsed" value={fmtElapsed(elapsed)} />
        <Info label="Avg Speed" value={avgSpeed ? `${avgSpeed} km/h` : '—'} />
        <Info label="Safety Cars" value={String(live.safetyCar.deployments)} />
        <Info label="Retirements" value={String(live.retirements)} tone={live.retirements > 0 ? 'warn' : 'normal'} />
      </div>
    </DashPanel>
  );
}

function Info({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums font-semibold ${tone === 'warn' ? 'text-amber-300' : 'text-slate-200'}`}>
        {value}
      </span>
    </div>
  );
}

function WeatherForecastPanel({ forecast }: { forecast: ForecastEntry[] }) {
  return (
    <DashPanel title="Weather Forecast" bodyClass="overflow-y-auto">
      <div className="grid h-full grid-cols-5">
        {forecast.map((f) => (
          <div key={f.label} className="flex flex-col items-center justify-center gap-0.5 border-r border-slate-800/60 px-0.5 py-1 last:border-r-0">
            <span className="text-[9px] uppercase tracking-wide text-slate-500">{f.label}</span>
            <span className="text-base leading-none">{f.wet ? '🌧' : f.condition === 'Cloudy' ? '☁' : '☀'}</span>
            <span className={`text-center text-[9px] font-semibold ${f.wet ? 'text-sky-300' : 'text-slate-300'}`}>
              {f.condition}
            </span>
            <span className="text-[10px] tabular-nums text-slate-400">{f.temp}°</span>
          </div>
        ))}
      </div>
    </DashPanel>
  );
}

function computeBestSectors(cars: LiveCarState[]): ({ time: number; driverId: string } | null)[] {
  const best: ({ time: number; driverId: string } | null)[] = [null, null, null];
  for (const c of cars) {
    if (!c.bestSectors) continue;
    for (let i = 0; i < 3; i++) {
      const t = c.bestSectors[i];
      if (best[i] == null || t < best[i]!.time) best[i] = { time: t, driverId: c.driverId };
    }
  }
  return best;
}

function fmtElapsed(seconds: number): string {
  if (seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
