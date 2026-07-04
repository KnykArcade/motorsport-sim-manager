// Right-side pit-wall card for a single player driver. Shows position, live
// pace, large colour-coded reliability/crash risk chips, tyre + fuel + component
// health, and strategy-mode buttons. Data Analytics recommendations live in the
// grouped RecommendationsPanel above the cards, not inside each card.

import type { LiveCarState, PaceMode } from '../../types/liveTypes';
import { SELECTABLE_MODES, modeSpec } from '../../sim/liveRacePace';
import { DeltaTag, Gauge } from './dashboardUi';
import { fmtLap, ordinal, tyreLetter, RISK_STYLE } from './dashboardFormat';
import type { RiskLevel } from '../../types/liveTypes';

const PACE_LABEL: Record<PaceMode, string> = {
  Conservative: 'Cons',
  Balanced: 'Bal',
  Push: 'Push',
  Attack: 'Attack',
  Defend: 'Defend',
  ProtectEngine: 'Protect',
};

export function PitWallCard({
  car,
  name,
  teamColor,
  finished,
  onMode,
  onPit,
  className = '',
}: {
  car: LiveCarState;
  name: string;
  teamColor: string;
  finished: boolean;
  onMode: (mode: PaceMode) => void;
  onPit: () => void;
  className?: string;
}) {
  const finishedRace = car.status === 'Finished';
  const dnf = !car.running && !finishedRace;
  const wear = Math.round(car.tire.wear);
  const life = Math.max(0, 100 - wear);
  const tyre = tyreLetter(car.tire.compound);
  const canPit = car.running && !car.pit.inPitThisLap && !finished;
  const highRisk =
    car.reliabilityRiskLevel === 'High' ||
    car.reliabilityRiskLevel === 'Critical' ||
    car.crashRiskLevel === 'High' ||
    car.crashRiskLevel === 'Critical';
  const pitWindow = pitWindowText(car);
  const aeroHealth = car.aeroHealth ?? (car.damaged ? 72 : 100);

  if (dnf) {
    return (
      <div className={`overflow-hidden rounded-lg border border-red-500/40 bg-red-950/20 p-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
            <span className="h-3 w-1 rounded-sm" style={{ backgroundColor: teamColor }} />
            {name}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
            OUT — {car.lastIncident ?? 'Retired'}
            <DeltaTag grid={car.grid} position={car.position} muted className="text-[11px]" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border bg-[#111725] p-1.5 ${
        highRisk
          ? 'border-orange-500/60 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
          : 'border-slate-700/60'
      } ${className}`}
      style={{ borderLeft: `3px solid ${teamColor}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 truncate text-sm font-bold text-slate-100">{name}</span>
          {(car.damaged || car.reliabilityIssue) && (
            <span
              title={car.reliabilityIssue ? car.reliabilityIssue.label : 'Car damaged'}
              className="min-w-0 truncate rounded bg-amber-500/15 px-1 text-[9px] font-semibold text-amber-300"
            >
              ⚠ {car.reliabilityIssue ? car.reliabilityIssue.label : 'Damaged'}
            </span>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="text-base font-bold tabular-nums text-slate-100">
            {car.pit.inPitThisLap ? 'PIT' : ordinal(car.position)}
          </span>
          <DeltaTag grid={car.grid} position={car.position} className="ml-1 text-[11px]" />
        </div>
      </div>

      {/* Key telemetry row */}
      <div className="mt-0.5 grid grid-cols-4 gap-1 text-center">
        <Metric label="Gap Ldr" value={car.position === 1 ? 'LEAD' : `+${car.gapToLeader.toFixed(1)}`} />
        <Metric label="Last Lap" value={car.lastLapTime > 0 ? fmtLap(car.lastLapTime) : '—'} />
        <Metric label="Pace" value={car.liveRacePace.toFixed(1)} accent />
        <Metric label={`Tyre ${tyre.letter}`} value={`${life}%`} />
      </div>

      <div className="mt-0.5 grid grid-cols-2 gap-1 text-center">
        <Metric label="Next Stop" value={nextStopText(car)} />
        <Metric label="Last Stop" value={car.pit.lastPitStopTime != null ? `${car.pit.lastPitStopTime.toFixed(1)}s` : car.pit.lastPitLap != null ? `L${car.pit.lastPitLap}` : 'none'} />
      </div>
      <div className="mt-0.5 rounded bg-slate-800/45 px-2 py-1 text-[10px] text-slate-300">
        <span className="text-slate-500">Estimated Pit Window: </span>
        <span className="font-semibold tabular-nums text-amber-300">{pitWindow}</span>
      </div>

      {/* Risk row (single-line compact chips) */}
      <div className="mt-0.5 grid grid-cols-2 gap-1.5">
        <RiskInline kind="R" level={car.reliabilityRiskLevel} />
        <RiskInline kind="C" level={car.crashRiskLevel} />
      </div>

      {/* Strategy mode buttons */}
      {!finished && car.running && (
        <div className="mt-1">
          <div className="mb-0.5 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wide text-slate-500">Strategy Mode</span>
            <button
              onClick={onPit}
              disabled={!canPit}
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                canPit ? (car.pit.pitRequested ? 'bg-amber-600 text-white hover:bg-amber-500' : 'bg-sky-600 text-white hover:bg-sky-500') : 'bg-slate-800 text-slate-600'
              }`}
            >
              {car.pit.pitRequested ? 'Cancel Pit' : 'Pit'}
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {SELECTABLE_MODES.map((m) => {
              const active = car.paceMode === m;
              const laps = car.strategyStint.consecutiveLaps;
              return (
                <button
                  key={m}
                  onClick={() => onMode(m)}
                  title={
                    active
                      ? `${modeSpec(m).blurb} — ${laps} consecutive lap${laps === 1 ? '' : 's'} in this mode`
                      : modeSpec(m).blurb
                  }
                  className={`flex items-center justify-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold ${
                    active
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {PACE_LABEL[m]}
                  {active && (
                    <span className="rounded bg-neutral-950/25 px-1 text-[9px] font-bold tabular-nums">
                      {laps}L
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1 rounded border border-slate-700/50 bg-slate-950/35 p-1">
            <div className="mb-0.5 text-[9px] uppercase tracking-wide text-slate-500">Car Reliability</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              <Gauge label="Engine" value={car.engineHealth} tone="health" />
              <Gauge label="Brakes" value={car.brakeHealth} tone="health" />
              <Gauge label="Gearbox" value={car.gearboxHealth} tone="health" />
              <Gauge label="Aero" value={aeroHealth} tone="health" />
              <Gauge label="Fuel" value={car.fuel} tone="fuel" />
              <Gauge label="Overall" value={overallHealth(car)} tone="health" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded bg-slate-800/50 px-1 py-0.5">
      <div className="truncate text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-xs font-bold tabular-nums ${accent ? 'text-amber-300' : 'text-slate-100'}`}>{value}</div>
    </div>
  );
}

function nextStopText(car: LiveCarState): string {
  const stopsLeft = car.pit.plannedStops - car.pit.stopsMade;
  if (stopsLeft <= 0) return 'none';
  if (car.pit.window) return `L${car.pit.window.open}-${car.pit.window.close}`;
  const next = car.pit.scheduledLaps.find((lap) => lap > car.lapsCompleted);
  return next != null ? `L${next}` : 'TBD';
}

function pitWindowText(car: LiveCarState): string {
  const stopsLeft = car.pit.plannedStops - car.pit.stopsMade;
  if (stopsLeft <= 0) return 'No planned stops';
  const w = car.pit.window;
  if (w) {
    if (car.lapsCompleted < w.open) return `L${w.open}-${w.close} (ideal L${w.ideal})`;
    if (car.lapsCompleted <= w.close) return `OPEN to L${w.close}`;
    return `Late - ideal was L${w.ideal}`;
  }
  const next = car.pit.scheduledLaps.find((lap) => lap > car.lapsCompleted);
  return next != null ? `Around L${next}` : 'TBD';
}

function overallHealth(car: LiveCarState): number {
  return Math.min(car.engineHealth, car.brakeHealth, car.gearboxHealth, car.aeroHealth ?? (car.damaged ? 72 : 100));
}

// Single-line reliability/crash risk chip (keeps the pit-wall card compact).
function RiskInline({ kind, level }: { kind: 'R' | 'C'; level: RiskLevel }) {
  const s = RISK_STYLE[level];
  return (
    <div className={`flex items-center justify-between rounded-md border px-2 py-0.5 ${s.chip}`}>
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-80">
        {kind === 'R' ? 'Reliability' : 'Crash'}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wide">{s.label}</span>
    </div>
  );
}

