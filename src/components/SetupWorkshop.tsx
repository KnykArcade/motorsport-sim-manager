import { useMemo, useState } from 'react';
import type { Car, Driver, Track } from '../types/gameTypes';
import type { CarSetup, Estimate, SetupParamKey } from '../types/setupTypes';
import {
  SETUP_COMPONENTS,
  SETUP_PARAMS,
  SETUP_PRESETS,
} from '../data/setup/setupComponents';
import { generateSetupFeedback, objectiveSetupQuality } from '../sim/setupFitEngine';
import { driverSetupComfort } from '../sim/driverComfortEngine';
import type { DriverPracticeSummary } from '../sim/practiceProgramEngine';
import {
  canRevealComponentFit,
  componentFitEstimate,
  reliabilityWarningConfidence,
  setupQualityEstimate,
  stintWindowEstimate,
  tyreStrategyConfidence,
} from '../sim/setupUncertaintyEngine';
import { Panel } from './Panel';
import { Button } from './Button';
import { TrackDemandBars } from './TrackDemandBars';
import { ratingColor } from './ui';

// Per-driver practice context the workshop needs to compute comfort and gate
// certainty. All optional — before practice the workshop shows wide ranges and
// an "Unknown" comfort.
export type WorkshopPractice = {
  setupKnowledge: Record<string, number>;
  tyreKnowledge: Record<string, number>;
  reliabilityKnowledge: Record<string, number>;
  practicedSetupByDriver: Record<string, CarSetup>;
  practiceLapsByDriver: Record<string, number>;
  summaryByDriver: Record<string, DriverPracticeSummary>;
  raceWet: boolean;
};

type Props = {
  track: Track;
  drivers: Driver[];
  setups: Record<string, CarSetup>;
  car?: Car;
  practice?: WorkshopPractice;
  onChangeParam: (driverId: string, key: SetupParamKey, value: number) => void;
  onApplySetup: (driverId: string, setup: CarSetup) => void;
  onCopy: (fromId: string, toId: string) => void;
};

function fmtDelta(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

function engineerConfidenceLabel(setupKnowledge: number): string {
  if (setupKnowledge >= 0.66) return 'High';
  if (setupKnowledge >= 0.33) return 'Medium';
  return 'Low';
}

function estimateText(e: Estimate): string {
  if (e.exact != null) return `${e.exact}`;
  return `${e.low}–${e.high}`;
}

export function SetupWorkshop({
  track,
  drivers,
  setups,
  car,
  practice,
  onChangeParam,
  onApplySetup,
  onCopy,
}: Props) {
  const [activeId, setActiveId] = useState(drivers[0]?.id ?? '');
  const driver = drivers.find((d) => d.id === activeId) ?? drivers[0];
  const setup = driver ? setups[driver.id] : undefined;
  const other = drivers.find((d) => d.id !== driver?.id);

  const setupKnowledge = driver ? practice?.setupKnowledge[driver.id] ?? 0 : 0;
  const tyreKnowledge = driver ? practice?.tyreKnowledge[driver.id] ?? 0 : 0;
  const reliabilityKnowledge = driver ? practice?.reliabilityKnowledge[driver.id] ?? 0 : 0;

  const quality = useMemo(
    () => (setup ? objectiveSetupQuality(setup, track, car) : undefined),
    [setup, track, car],
  );
  const comfort = useMemo(() => {
    if (!setup || !driver) return undefined;
    const s = practice?.summaryByDriver[driver.id];
    return driverSetupComfort({
      driver,
      currentSetup: setup,
      practicedSetup: practice?.practicedSetupByDriver[driver.id],
      practiceLaps: practice?.practiceLapsByDriver[driver.id] ?? 0,
      setupKnowledge,
      ranQualiSim: s?.ranQualiSim,
      ranRacePace: s?.ranRacePace,
      ranWetPrep: s?.ranWetPrep,
      raceWet: practice?.raceWet,
      hadIncident: s?.hadIncident,
    });
  }, [setup, driver, practice, setupKnowledge]);
  const feedback = useMemo(
    () => (setup && driver ? generateSetupFeedback(setup, track, driver) : undefined),
    [setup, track, driver],
  );

  if (!driver || !setup || !quality || !comfort || !feedback) return null;

  const componentFit = (key: string) => quality.components.find((c) => c.component === key)?.fit ?? 0;
  const qualityEstimate = setupQualityEstimate(quality.quality, setupKnowledge);
  const revealComponents = canRevealComponentFit(setupKnowledge);
  const stint = stintWindowEstimate(24, tyreKnowledge);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">Car Setup Workshop</h2>
        <p className="text-sm text-neutral-400">
          Tune the engineering setup for each driver. <span className="text-neutral-300">Objective
          Setup Quality</span> is how well the setup suits the track and this car; <span className="text-neutral-300">Driver
          Comfort</span> is how well the driver knows and trusts it from practice. Practice narrows
          the uncertainty — without it the numbers are only estimates.
        </p>
      </div>

      {drivers.length > 1 && (
        <div className="flex gap-2">
          {drivers.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveId(d.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                d.id === driver.id
                  ? 'bg-amber-500 font-semibold text-neutral-950'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {(comfort.stale || comfort.notes.length > 0) && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            comfort.stale
              ? 'border-amber-600/50 bg-amber-900/20 text-amber-200'
              : 'border-neutral-800 bg-neutral-900/40 text-neutral-300'
          }`}
        >
          {comfort.notes.map((note, i) => (
            <div key={i}>{comfort.stale && i === 0 ? '⚠ ' : ''}{note}</div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: controls */}
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Quick-Start Presets">
            <div className="flex flex-wrap gap-2">
              {SETUP_PRESETS.map((p) => (
                <button
                  key={p.id}
                  title={p.description}
                  onClick={() => onApplySetup(driver.id, { ...p.setup })}
                  className="rounded-md border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700"
                >
                  {p.name}
                </button>
              ))}
            </div>
            {other && (
              <div className="mt-3 border-t border-neutral-800 pt-3">
                <Button
                  variant="ghost"
                  onClick={() => onCopy(driver.id, other.id)}
                  className="text-xs"
                >
                  Copy {driver.name}&apos;s setup → {other.name}
                </Button>
              </div>
            )}
          </Panel>

          {SETUP_COMPONENTS.map((comp) => {
            const cf = componentFit(comp.key);
            const est = componentFitEstimate(cf, setupKnowledge);
            return (
              <Panel key={comp.key} title={comp.name}>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="text-xs text-neutral-400">{comp.description}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-neutral-500">Fit</span>
                    {revealComponents ? (
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: ratingColor(cf / 10) }}
                      >
                        {cf}
                      </span>
                    ) : (
                      <span
                        className="text-sm font-semibold tabular-nums text-neutral-400"
                        title="Run more practice to reveal exact component fit"
                      >
                        {est.low}–{est.high}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {comp.params.map((key) => {
                    const meta = SETUP_PARAMS[key];
                    return (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-neutral-200">{meta.label}</span>
                          <span className="tabular-nums text-neutral-400">{setup[key]}/10</span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={setup[key]}
                          onChange={(e) => onChangeParam(driver.id, key, Number(e.target.value))}
                          className="w-full accent-amber-500"
                        />
                        <div className="flex justify-between text-[10px] uppercase tracking-wide text-neutral-500">
                          <span>{meta.lowLabel}</span>
                          <span>{meta.highLabel}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-neutral-500">{meta.description}</p>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            );
          })}
        </div>

        {/* Right: readouts */}
        <div className="space-y-4">
          <Panel title="Objective Setup Quality">
            <div className="flex items-end gap-3">
              <span
                className="text-4xl font-bold tabular-nums"
                style={{ color: ratingColor(quality.quality / 10) }}
              >
                {estimateText(qualityEstimate)}
              </span>
              <span className="pb-1 text-sm text-neutral-400">/ 100</span>
            </div>
            <div className="mt-1 text-xs text-neutral-400">
              Engineer confidence:{' '}
              <span className="font-medium text-neutral-200">
                {engineerConfidenceLabel(setupKnowledge)}
              </span>
              {qualityEstimate.exact == null && (
                <span className="text-neutral-500"> · estimate narrows with practice</span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Effect label="Quali Ceiling" value={quality.effects.qualifyingPaceCeiling} goodHigh />
              <Effect label="Race Ceiling" value={quality.effects.racePaceCeiling} goodHigh />
              <Effect label="Tyre Wear" value={quality.effects.tyreWear} goodHigh={false} />
              <Effect label="Reliability Risk" value={quality.effects.reliabilityRisk} goodHigh={false} />
              <Effect label="Overheating Risk" value={quality.effects.overheatingRisk} goodHigh={false} />
            </div>
          </Panel>

          <Panel title="Driver Setup Comfort">
            <div className="flex items-end gap-3">
              <span
                className="text-4xl font-bold tabular-nums"
                style={{ color: ratingColor(comfort.comfort / 10) }}
              >
                {comfort.label === 'Unknown' ? '—' : comfort.comfort}
              </span>
              <span className="pb-1 text-sm font-medium text-neutral-300">{comfort.label}</span>
            </div>
            <div className="mt-3 space-y-1.5">
              <MiniBar label="Familiarity" value={comfort.familiarity} />
              <MiniBar label="Practice Relevance" value={comfort.relevance} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Effect label="Execution" value={comfort.effects.execution} goodHigh />
              <Effect label="Consistency" value={comfort.effects.consistency} goodHigh />
              <Effect label="Mistake Risk" value={comfort.effects.mistakeRisk} goodHigh={false} />
              <Effect label="Lockup/Spin" value={comfort.effects.lockupSpinRisk} goodHigh={false} />
              <Effect label="Tyre Mgmt" value={comfort.effects.tyreManagement} goodHigh />
            </div>
          </Panel>

          <Panel title="Practice Certainty">
            <div className="space-y-1.5">
              <MiniBar label="Setup Knowledge" value={setupKnowledge} />
              <MiniBar label="Tyre Knowledge" value={tyreKnowledge} />
              <MiniBar label="Reliability Knowledge" value={reliabilityKnowledge} />
            </div>
            <div className="mt-3 space-y-1 text-xs text-neutral-300">
              <div className="flex justify-between">
                <span className="text-neutral-500">Est. stint window</span>
                <span className="tabular-nums">Lap {stint.low}–{stint.high}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Tyre strategy confidence</span>
                <span>{tyreStrategyConfidence(tyreKnowledge)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Reliability warnings</span>
                <span>{reliabilityWarningConfidence(reliabilityKnowledge)}</span>
              </div>
            </div>
          </Panel>

          <Panel title="Track Demands">
            <TrackDemandBars track={track} />
          </Panel>

          <Panel title="Driver Feedback">
            <ul className="space-y-1.5 text-xs text-neutral-300">
              {feedback.driverFeedback.map((f, i) => (
                <li key={i}>“{f}”</li>
              ))}
            </ul>
          </Panel>

          {quality.warnings.length > 0 && (
            <Panel title="Warnings">
              <ul className="space-y-1.5 text-xs text-amber-300">
                {quality.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px]">
        <span className="text-neutral-400">{label}</span>
        <span className="tabular-nums text-neutral-500">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Effect({ label, value, goodHigh }: { label: string; value: number; goodHigh: boolean }) {
  const neutral = Math.abs(value) < 0.05;
  const good = goodHigh ? value > 0 : value < 0;
  const color = neutral ? '#a3a3a3' : good ? '#22c55e' : '#ef4444';
  return (
    <div className="flex items-center justify-between rounded bg-neutral-800/50 px-2 py-1">
      <span className="text-neutral-400">{label}</span>
      <span className="font-semibold tabular-nums" style={{ color }}>
        {fmtDelta(value)}
      </span>
    </div>
  );
}
