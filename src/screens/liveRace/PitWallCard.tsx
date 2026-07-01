// Right-side pit-wall card for a single player driver. Shows position, live
// pace, large colour-coded reliability/crash risk chips, tyre + fuel + component
// health, strategy-mode buttons, and — when the analytics engine has flagged an
// issue — the Data Analytics Recommendation panel with Accept / Modify / Ignore.

import { useState } from 'react';
import type { AnalyticsRecommendation, LiveCarState, PaceMode, RecAction } from '../../types/liveTypes';
import { SELECTABLE_MODES, modeSpec } from '../../sim/liveRacePace';
import { Gauge, RiskChip } from './dashboardUi';
import { fmtLap, ordinal, tyreLetter } from './dashboardFormat';

const PACE_LABEL: Record<PaceMode, string> = {
  Conservative: 'Cons',
  Balanced: 'Bal',
  Push: 'Push',
  Attack: 'Attack',
  Defend: 'Defend',
  ProtectEngine: 'Protect',
};

const PRIORITY_STYLE: Record<AnalyticsRecommendation['priority'], string> = {
  low: 'border-slate-600 bg-slate-800/40',
  medium: 'border-amber-500/50 bg-amber-500/10',
  high: 'border-orange-500/60 bg-orange-500/10',
  urgent: 'border-red-500/70 bg-red-500/10',
};

export function PitWallCard({
  car,
  name,
  teamColor,
  finished,
  rec,
  onMode,
  onPit,
  onAccept,
  onModify,
  onIgnore,
}: {
  car: LiveCarState;
  name: string;
  teamColor: string;
  finished: boolean;
  rec?: AnalyticsRecommendation;
  onMode: (mode: PaceMode) => void;
  onPit: () => void;
  onAccept: (rec: AnalyticsRecommendation) => void;
  onModify: (rec: AnalyticsRecommendation, action: RecAction) => void;
  onIgnore: (rec: AnalyticsRecommendation) => void;
}) {
  const finishedRace = car.status === 'Finished';
  const dnf = !car.running && !finishedRace;
  const wear = Math.round(car.tire.wear);
  const life = Math.max(0, 100 - wear);
  const tyre = tyreLetter(car.tire.compound);
  const gridDelta = car.position != null ? car.grid - car.position : 0;
  const canPit = car.running && !car.pit.pitRequested && !finished;

  if (dnf) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-2.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-200">
            <span className="h-3 w-1 rounded-sm" style={{ backgroundColor: teamColor }} />
            {name}
          </span>
          <span className="text-xs font-semibold text-red-400">OUT — {car.lastIncident ?? 'Retired'}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border bg-[#111725] p-2.5 ${
        rec && (rec.priority === 'high' || rec.priority === 'urgent')
          ? 'border-orange-500/60 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
          : 'border-slate-700/60'
      }`}
      style={{ borderLeft: `3px solid ${teamColor}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-100">{name}</div>
          <div className="text-[10px] text-slate-500">{car.statusMessage}</div>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold tabular-nums text-slate-100">
            {car.pit.inPitThisLap ? 'PIT' : ordinal(car.position)}
          </span>
          {gridDelta !== 0 && (
            <span className={`ml-1 text-[11px] ${gridDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {gridDelta > 0 ? `▲${gridDelta}` : `▼${-gridDelta}`}
            </span>
          )}
        </div>
      </div>

      {/* Key telemetry row */}
      <div className="mt-2 grid grid-cols-4 gap-1 text-center">
        <Metric label="Gap Ldr" value={car.position === 1 ? 'LEAD' : `+${car.gapToLeader.toFixed(1)}`} />
        <Metric label="Last Lap" value={car.lastLapTime > 0 ? fmtLap(car.lastLapTime) : '—'} />
        <Metric label="Pace" value={car.liveRacePace.toFixed(1)} accent />
        <Metric label={`Tyre ${tyre.letter}`} value={`${life}%`} />
      </div>

      {/* Large risk chips */}
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <RiskChip kind="R" level={car.reliabilityRiskLevel} />
        <RiskChip kind="C" level={car.crashRiskLevel} />
      </div>

      {/* Fuel + component health */}
      <div className="mt-2 space-y-1">
        <Gauge label="Fuel" value={car.fuel} tone="fuel" />
        <Gauge label="Engine" value={car.engineHealth} tone="health" />
        <Gauge label="Gearbox" value={car.gearboxHealth} tone="health" />
        <Gauge label="Brakes" value={car.brakeHealth} tone="health" />
      </div>

      {(car.damaged || car.reliabilityIssue) && (
        <p className="mt-1.5 text-[11px] font-medium text-amber-300">
          ⚠ {car.reliabilityIssue ? car.reliabilityIssue.label : 'Car damaged'}
        </p>
      )}

      {/* Strategy mode buttons */}
      {!finished && car.running && (
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-wide text-slate-500">Strategy Mode</span>
            <button
              onClick={onPit}
              disabled={!canPit}
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                canPit ? 'bg-sky-600 text-white hover:bg-sky-500' : 'bg-slate-800 text-slate-600'
              }`}
            >
              {car.pit.pitRequested ? 'BOXING…' : '🔧 PIT'}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {SELECTABLE_MODES.map((m) => (
              <button
                key={m}
                onClick={() => onMode(m)}
                title={modeSpec(m).blurb}
                className={`rounded px-1 py-1 text-[10px] font-semibold ${
                  car.paceMode === m
                    ? 'bg-amber-500 text-neutral-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {PACE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Data analytics recommendation */}
      {!finished && car.running && rec && (
        <RecommendationPanel
          rec={rec}
          onAccept={() => onAccept(rec)}
          onModify={(action) => onModify(rec, action)}
          onIgnore={() => onIgnore(rec)}
        />
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded bg-slate-800/50 px-1 py-1">
      <div className="truncate text-[9px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-xs font-bold tabular-nums ${accent ? 'text-amber-300' : 'text-slate-100'}`}>{value}</div>
    </div>
  );
}

function RecommendationPanel({
  rec,
  onAccept,
  onModify,
  onIgnore,
}: {
  rec: AnalyticsRecommendation;
  onAccept: () => void;
  onModify: (action: RecAction) => void;
  onIgnore: () => void;
}) {
  const [modifying, setModifying] = useState(false);
  return (
    <div className={`mt-2 rounded-md border p-2 ${PRIORITY_STYLE[rec.priority]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">
          ⬡ Data Analytics · {rec.priority}
        </span>
        <span className="text-[10px] font-bold tabular-nums text-slate-300">{rec.confidence}%</span>
      </div>
      <p className="mt-1 text-[11px] font-medium text-slate-100">{rec.issue}</p>
      <p className="mt-0.5 text-[11px] text-slate-300">
        ▸ {rec.recommendedAction}
        {rec.suggestedDuration ? ` (${rec.suggestedDuration})` : ''}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-400">Impact: {rec.expectedImpact}</p>

      {!modifying ? (
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          <button
            onClick={onAccept}
            className="rounded bg-emerald-600 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
          >
            Accept
          </button>
          <button
            onClick={() => setModifying(true)}
            className="rounded bg-slate-700 py-1 text-[10px] font-bold text-slate-100 hover:bg-slate-600"
          >
            Modify
          </button>
          <button
            onClick={onIgnore}
            className="rounded bg-slate-800 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-700"
          >
            Ignore
          </button>
        </div>
      ) : (
        <div className="mt-1.5 space-y-1">
          <div className="text-[9px] uppercase tracking-wide text-slate-500">Alternative actions</div>
          {[rec.action, ...rec.alternatives].map((a) => (
            <button
              key={a.type}
              onClick={() => {
                onModify(a);
                setModifying(false);
              }}
              className="w-full rounded bg-slate-800 px-2 py-1 text-left text-[10px] font-semibold text-slate-200 hover:bg-slate-700"
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={() => setModifying(false)}
            className="w-full rounded py-0.5 text-[10px] text-slate-500 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
