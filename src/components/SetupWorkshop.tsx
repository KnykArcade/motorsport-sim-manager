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
import { formatSetupRange, formatSetupScore, safeScore, sanitizeSetupProfile } from '../sim/setupSanitize';
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
  // Reset the driver back to the setup family they actually ran in practice.
  onResetDriver?: (driverId: string) => void;
  // Fixed-action-bar navigation (rendered inside the workshop so the buttons are
  // always visible without page scroll).
  onBack?: () => void;
  onConfirm?: () => void;
};

function fmtDelta(v: number): string {
  const s = safeScore(v, 0);
  return s > 0 ? `+${s}` : `${s}`;
}

function engineerConfidenceLabel(setupKnowledge: number): string {
  if (setupKnowledge >= 0.66) return 'High';
  if (setupKnowledge >= 0.33) return 'Medium';
  return 'Low';
}

function estimateText(e: Estimate): string {
  if (e.exact != null) return formatSetupRange(e.exact, e.exact);
  return formatSetupRange(e.low, e.high);
}

// How far the current setup has drifted from the practised baseline (0-1).
function changeSeverityLabel(changeDelta: number): string {
  const d = safeScore(changeDelta, 0);
  if (d < 0.08) return 'None';
  if (d < 0.2) return 'Minor';
  if (d < 0.4) return 'Moderate';
  return 'Major';
}

// How relevant the practised data is to the current setup (0-1).
function relevanceLabel(relevance: number): string {
  const r = safeScore(relevance, 0);
  if (r >= 0.75) return 'Strong';
  if (r >= 0.4) return 'Partial';
  if (r > 0) return 'Weak';
  return 'None';
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
  onResetDriver,
  onBack,
  onConfirm,
}: Props) {
  const [activeId, setActiveId] = useState(drivers[0]?.id ?? '');
  const [activeComp, setActiveComp] = useState(SETUP_COMPONENTS[0]?.key ?? '');
  const driver = drivers.find((d) => d.id === activeId) ?? drivers[0];
  // Defensive: always work from a complete, numeric setup so the score maths
  // never see undefined fields (which produced "NaN–NaN"). The parent already
  // sanitizes, but this keeps the workshop robust standalone.
  const setup = useMemo(
    () => (driver ? sanitizeSetupProfile(setups[driver.id]) : undefined),
    [driver, setups],
  );
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
    () => (setup && driver ? generateSetupFeedback(setup, track, driver, car) : undefined),
    [setup, track, driver, car],
  );

  if (!driver || !setup || !quality || !comfort || !feedback) return null;

  const componentFit = (key: string) => quality.components.find((c) => c.component === key)?.fit ?? 0;
  const qualityEstimate = setupQualityEstimate(quality.quality, setupKnowledge);
  const revealComponents = canRevealComponentFit(setupKnowledge);
  const revealEffects = setupKnowledge >= 0.33;
  const revealWarnings = setupKnowledge >= 0.2;
  const stint = stintWindowEstimate(24, tyreKnowledge);
  const comp = SETUP_COMPONENTS.find((c) => c.key === activeComp) ?? SETUP_COMPONENTS[0];
  // Radar uses estimated values when components are not yet revealed, so the
  // shape is approximate rather than leaking exact fit per component.
  const radar = SETUP_COMPONENTS.map((c) => {
    const fit = componentFit(c.key);
    if (revealComponents) return { label: c.name, value: fit };
    const est = componentFitEstimate(fit, setupKnowledge);
    return { label: c.name, value: (est.low + est.high) / 2 };
  });
  // Tab dots use the same gated value so they don't leak exact fit colour.
  const tabDotFit = (key: string): number => {
    const fit = componentFit(key);
    if (revealComponents) return fit;
    const est = componentFitEstimate(fit, setupKnowledge);
    return (est.low + est.high) / 2;
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-testid="setup-workshop">
      {/* Engineering-bay header + driver tabs (each car is tuned separately). */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-500/20 bg-gradient-to-r from-neutral-900/80 to-neutral-900/30 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sky-400">⚙</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-100">Engineering Bay · Car Setup</h2>
            <p className="text-[11px] text-neutral-400">Tune the car against the circuit and each driver&apos;s feel.</p>
          </div>
        </div>
        {drivers.length > 1 && (
          <div className="flex gap-1 rounded-md bg-neutral-900/60 p-1" role="tablist">
            {drivers.map((d) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={d.id === driver.id}
                onClick={() => setActiveId(d.id)}
                className={`rounded px-3 py-1.5 text-sm font-semibold transition-colors ${
                  d.id === driver.id
                    ? 'bg-sky-500 text-neutral-950'
                    : 'text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Setup change warning banner (driver is drifting off their practised feel). */}
      {(comfort.stale || comfort.notes.length > 0) && (
        <div
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs ${
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

      {/* Main dashboard: left controls (internal scroll) + right readout (internal scroll). */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3">
        {/* Left/Middle: setup controls grouped into component tabs. */}
        <div className="flex min-h-0 flex-col lg:col-span-2">
          <div className="flex shrink-0 flex-wrap gap-1 rounded-t-lg border border-neutral-800 bg-neutral-900/40 p-1" role="tablist">
            {SETUP_COMPONENTS.map((c) => {
              return (
                <button
                  key={c.key}
                  role="tab"
                  aria-selected={c.key === comp.key}
                  onClick={() => setActiveComp(c.key)}
                  className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    c.key === comp.key
                      ? 'bg-sky-500/15 text-sky-300'
                      : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100'
                  }`}
                >
                  {c.name}
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: fitBand(tabDotFit(c.key)) }} />
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto border border-t-0 border-neutral-800 bg-neutral-900/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-xs text-neutral-400">{comp.description}</p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-neutral-500">Fit</span>
                {revealComponents ? (
                  <span className="text-sm font-semibold tabular-nums" style={{ color: ratingColor(componentFit(comp.key) / 10) }}>
                    {componentFit(comp.key)}
                  </span>
                ) : (
                  <span
                    className="text-sm font-semibold tabular-nums text-neutral-400"
                    title="Run more practice to reveal exact component fit"
                  >
                    {componentFitEstimate(componentFit(comp.key), setupKnowledge).low}–
                    {componentFitEstimate(componentFit(comp.key), setupKnowledge).high}
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
                      className="w-full accent-sky-500"
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
          </div>

          {/* Presets — below the sliders (shrink-0), apply to this driver or both. */}
          <div className="shrink-0 border border-t-0 border-neutral-800 bg-neutral-900/40 px-3 py-2">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-neutral-500">Quick-start presets</div>
            <div className="flex flex-wrap gap-1.5">
              {SETUP_PRESETS.map((p) => (
                <div key={p.id} className="flex overflow-hidden rounded-md border border-neutral-700">
                  <button
                    title={`Apply ${p.name} to ${driver.name}`}
                    onClick={() => onApplySetup(driver.id, { ...p.setup })}
                    className="bg-neutral-800/60 px-2.5 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
                  >
                    {p.name}
                  </button>
                  {drivers.length > 1 && (
                    <button
                      title={`Apply ${p.name} to both cars`}
                      onClick={() => drivers.forEach((d) => onApplySetup(d.id, { ...p.setup }))}
                      className="border-l border-neutral-700 bg-neutral-900/60 px-1.5 text-[10px] text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100"
                    >
                      ×2
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Core score cards under presets: Objective Quality + Driver Comfort. */}
          <div className="grid shrink-0 gap-2 rounded-b-lg border border-t-0 border-neutral-800 bg-neutral-900/20 p-3 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Objective Setup Quality</span>
                <span className="text-[10px] text-neutral-500">Conf: {engineerConfidenceLabel(setupKnowledge)}</span>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-2xl font-bold tabular-nums" style={{ color: ratingColor(safeScore(quality.quality) / 10) }}>
                  {estimateText(qualityEstimate)}
                </span>
                <span className="pb-0.5 text-[11px] text-neutral-500">/ 100</span>
              </div>
              {revealEffects ? (
                <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                  <Effect label="Quali Ceiling" value={quality.effects.qualifyingPaceCeiling} goodHigh />
                  <Effect label="Race Ceiling" value={quality.effects.racePaceCeiling} goodHigh />
                  <Effect label="Tyre Wear" value={quality.effects.tyreWear} goodHigh={false} />
                  <Effect label="Reliability" value={quality.effects.reliabilityRisk} goodHigh={false} />
                  <Effect label="Overheating" value={quality.effects.overheatingRisk} goodHigh={false} />
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-neutral-500">
                  Run practice to unlock setup effect breakdown.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Driver Setup Comfort</span>
                <span className="text-[10px] font-medium text-neutral-300">{comfort.label}</span>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-2xl font-bold tabular-nums" style={{ color: ratingColor(safeScore(comfort.comfort) / 10) }}>
                  {comfort.label === 'Unknown' ? '—' : formatSetupScore(comfort.comfort)}
                </span>
                <span className="pb-0.5 text-[11px] text-neutral-500">/ 100</span>
              </div>
              <div className="mt-1.5 space-y-1">
                <MiniBar label="Familiarity" value={comfort.familiarity} />
                <MiniBar label="Practice Relevance" value={comfort.relevance} />
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px]">
                <Effect label="Mistake Risk" value={comfort.effects.mistakeRisk} goodHigh={false} />
                <Effect label="Consistency" value={comfort.effects.consistency} goodHigh />
              </div>
            </div>
          </div>
        </div>

        {/* Right: analysis / insight column (internal scroll). */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <Panel title="Setup Profile">
            <SetupRadar data={radar} />
            <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-neutral-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#22c55e' }} /> Strong</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#eab308' }} /> Fair</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#ef4444' }} /> Weak</span>
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
              <div className="flex justify-between">
                <span className="text-neutral-500">Setup change</span>
                <span>{changeSeverityLabel(comfort.changeDelta)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Data relevance</span>
                <span>{relevanceLabel(comfort.relevance)}</span>
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

          {feedback.engineerFeedback.length > 0 && (
            <Panel title="Engineer Feedback">
              <ul className="space-y-1.5 text-xs text-neutral-300">
                {feedback.engineerFeedback.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </Panel>
          )}

          {revealWarnings && quality.warnings.length > 0 && (
            <Panel title="Engineer Warnings">
              <ul className="space-y-1.5 text-xs text-amber-300">
                {quality.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      {/* Fixed action bar — always visible, no page scroll to confirm. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" onClick={onBack}>← Back to Practice</Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {other && (
            <Button variant="ghost" onClick={() => onCopy(driver.id, other.id)} className="text-xs">
              Copy → {other.name}
            </Button>
          )}
          {onResetDriver && (
            <Button variant="ghost" onClick={() => onResetDriver(driver.id)} className="text-xs">
              Reset to practised
            </Button>
          )}
          {onConfirm && (
            <Button variant="primary" onClick={onConfirm}>Confirm Setup →</Button>
          )}
        </div>
      </div>
    </div>
  );
}

// A green/yellow/red band colour for a 0-10 component-fit value.
function fitBand(fit: number): string {
  if (fit >= 7) return '#22c55e';
  if (fit >= 4.5) return '#eab308';
  return '#ef4444';
}

// A compact SVG radar/spider chart of the per-component setup fit (0-10), with a
// dashed "target" ring so the profile reads as tuning against a window, not a
// single number.
function SetupRadar({ data }: { data: { label: string; value: number }[] }) {
  const n = data.length;
  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;
  const target = 0.7; // 7/10 reference ring
  const pointAt = (i: number, frac: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(ang) * r * frac, cy + Math.sin(ang) * r * frac] as const;
  };
  const poly = data.map((d, i) => pointAt(i, Math.max(0, Math.min(1, d.value / 10)))).map((p) => p.join(',')).join(' ');
  const targetPoly = data.map((_, i) => pointAt(i, target)).map((p) => p.join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block h-44 w-44">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={data.map((_, i) => pointAt(i, f)).map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="#404040"
          strokeWidth={0.5}
        />
      ))}
      <polygon points={targetPoly} fill="none" stroke="#38bdf8" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      <polygon points={poly} fill="rgba(56,189,248,0.18)" stroke="#38bdf8" strokeWidth={1.5} />
      {data.map((d, i) => {
        const [x, y] = pointAt(i, 1.16);
        return (
          <text key={d.label} x={x} y={y} fill="#a3a3a3" fontSize={6.5} textAnchor="middle" dominantBaseline="middle">
            {d.label.split(' ')[0]}
          </text>
        );
      })}
    </svg>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, safeScore(value, 0))) * 100);
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
