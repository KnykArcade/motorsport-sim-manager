import { useMemo, useState } from 'react';
import type { Car, Driver, Series, Track } from '../types/gameTypes';
import type { CarSetup, Estimate, SetupComponentKey, SetupParamKey } from '../types/setupTypes';
import {
  SETUP_COMPONENTS,
  SETUP_PARAMS,
  SETUP_PRESETS,
} from '../data/setup/setupComponents';
import { generateSetupFeedback, objectiveSetupQuality } from '../sim/setupFitEngine';
import { driverSetupComfort } from '../sim/driverComfortEngine';
import { formatSetupRange, formatSetupScore, safeScore, sanitizeSetupProfile } from '../sim/setupSanitize';
import type { DriverPracticeSummary } from '../sim/practiceProgramEngine';
import type { StaffMember } from '../types/staffTypes';
import { buildSetupEngineeringRecommendation } from '../sim/raceEngineerEngine';
import {
  canRevealComponentFit,
  componentFitEstimate,
  reliabilityWarningConfidence,
  setupQualityEstimate,
  stintWindowEstimate,
  tyreStrategyConfidence,
} from '../sim/setupUncertaintyEngine';
import { Button } from './Button';
import { TrackDemandBars } from './TrackDemandBars';
import { ratingColor } from './ui';
import {
  changedSetupComponentCount,
  changedSetupParameters,
  formatSetupDelta,
  setupDraftStatus,
  setupParameterChange,
} from '../screens/setupWorkspaceViewModel';

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
  series?: Series;
  drivers: Driver[];
  setups: Record<string, CarSetup>;
  baselineSetups?: Record<string, CarSetup>;
  car?: Car;
  practice?: WorkshopPractice;
  engineer?: StaffMember;
  engineerChemistryByDriver?: Record<string, number>;
  engineeringSupport?: {
    facilities?: number;
    operations?: number;
    packagePreparation?: number;
  };
  onChangeParam: (driverId: string, key: SetupParamKey, value: number) => void;
  onApplySetup: (driverId: string, setup: CarSetup) => void;
  onCopy: (fromId: string, toId: string) => void;
  // Reset the driver back to the setup family they actually ran in practice.
  onResetDriver?: (driverId: string) => void;
  setupLock?: {
    active: boolean;
    label: string;
    description: string;
    allowedParams: readonly SetupParamKey[];
  };
  // Fixed-action-bar navigation (rendered inside the workshop so the buttons are
  // always visible without page scroll).
  onBack?: () => void;
  onConfirm?: () => void;
  stage?: 'Initial' | 'PostQualifying';
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

function qualityReadout(e: Estimate, setupKnowledge: number): { label: string; detail: string } {
  if (e.exact != null) return { label: formatSetupRange(e.exact, e.exact), detail: '/ 100' };
  const center = (e.low + e.high) / 2;
  const band =
    center >= 82 ? 'Promising window' :
    center >= 68 ? 'Workable window' :
    center >= 54 ? 'Unsettled window' :
    'Poor read';
  if (setupKnowledge < 0.5) return { label: band, detail: 'Low certainty' };
  if (setupKnowledge < 0.75) return { label: `${band} (${Math.round(e.low / 10) * 10}s)`, detail: 'Medium certainty' };
  return { label: estimateText(e), detail: 'High certainty' };
}

function fitReadout(e: Estimate, setupKnowledge: number): string {
  if (e.exact != null) return formatSetupRange(e.exact, e.exact);
  const center = (e.low + e.high) / 2;
  if (setupKnowledge < 0.5) return center >= 76 ? 'Promising' : center >= 58 ? 'Mixed' : 'Poor';
  if (setupKnowledge < 0.75) return center >= 76 ? 'Likely strong' : center >= 58 ? 'Needs work' : 'Likely weak';
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
  series,
  drivers,
  setups,
  baselineSetups,
  car,
  practice,
  engineer,
  engineerChemistryByDriver,
  engineeringSupport,
  onChangeParam,
  onApplySetup,
  onCopy,
  onResetDriver,
  setupLock,
  onBack,
  onConfirm,
  stage = 'Initial',
}: Props) {
  const [activeId, setActiveId] = useState(drivers[0]?.id ?? '');
  const [activeComp, setActiveComp] = useState(SETUP_COMPONENTS[0]?.key ?? '');
  const [lastChange, setLastChange] = useState<{
    driverId: string;
    key: SetupParamKey;
    previous: number;
    current: number;
  }>();
  const driver = drivers.find((d) => d.id === activeId) ?? drivers[0];
  // Defensive: always work from a complete, numeric setup so the score maths
  // never see undefined fields (which produced "NaN–NaN"). The parent already
  // sanitizes, but this keeps the workshop robust standalone.
  const setup = useMemo(
    () => (driver ? sanitizeSetupProfile(setups[driver.id]) : undefined),
    [driver, setups],
  );
  const baseline = useMemo(
    () => (driver ? sanitizeSetupProfile(baselineSetups?.[driver.id] ?? setups[driver.id]) : undefined),
    [baselineSetups, driver, setups],
  );
  const practiced = useMemo(
    () => (driver && practice?.practicedSetupByDriver[driver.id]
      ? sanitizeSetupProfile(practice.practicedSetupByDriver[driver.id])
      : undefined),
    [driver, practice],
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
  const teammateDisagreement = useMemo(() => {
    if (!driver || !other || !practice) return false;
    const first = practice.practicedSetupByDriver[driver.id];
    const second = practice.practicedSetupByDriver[other.id];
    if (!first || !second) return false;
    const keys = Object.keys(first) as SetupParamKey[];
    return keys.reduce((sum, key) => sum + Math.abs(first[key] - second[key]), 0) / keys.length >= 1.1;
  }, [driver, other, practice]);
  const recommendation = useMemo(() => {
    if (!setup || !driver) return undefined;
    return buildSetupEngineeringRecommendation({
      seed: `setup-workshop-${track.id}`,
      engineer,
      driver,
      setup,
      practicedSetup: practiced,
      track,
      series,
      car,
      evidence: {
        setupKnowledge,
        tyreKnowledge,
        reliabilityKnowledge,
        practiceLaps: practice?.practiceLapsByDriver[driver.id] ?? 0,
        driverTechnical: driver.ratings.technical,
        engineerChemistry: engineerChemistryByDriver?.[driver.id],
        facilities: engineeringSupport?.facilities,
        operations: engineeringSupport?.operations,
        packagePreparation: engineeringSupport?.packagePreparation,
        teammateDisagreement,
      },
      lockActive: setupLock?.active,
      allowedParams: setupLock?.allowedParams,
      lockDescription: setupLock?.description,
    });
  }, [
    setup,
    driver,
    track,
    series,
    engineer,
    practiced,
    car,
    setupKnowledge,
    tyreKnowledge,
    reliabilityKnowledge,
    practice,
    engineerChemistryByDriver,
    engineeringSupport,
    teammateDisagreement,
    setupLock,
  ]);

  if (!driver || !setup || !baseline || !quality || !comfort || !feedback || !recommendation) return null;

  const componentFit = (key: string) => quality.components.find((c) => c.component === key)?.fit ?? 0;
  const qualityEstimate = setupQualityEstimate(quality.quality, setupKnowledge);
  const qualityDisplay = qualityReadout(qualityEstimate, setupKnowledge);
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
  const lockedParam = (key: SetupParamKey): boolean =>
    !!setupLock?.active && !setupLock.allowedParams.includes(key);
  const changedParams = changedSetupParameters(baseline, setup);
  const baselineQuality = objectiveSetupQuality(baseline, track, car);
  const draftStatus = setupDraftStatus({
    changedCount: changedParams.length,
    postQualifying: stage === 'PostQualifying',
    locked: !!setupLock?.active,
  });
  const changeParam = (key: SetupParamKey, value: number) => {
    const current = setup[key];
    const next = Math.max(1, Math.min(10, Number(value.toFixed(1))));
    if (next === current || lockedParam(key)) return;
    setLastChange({ driverId: driver.id, key, previous: current, current: next });
    onChangeParam(driver.id, key, next);
  };
  const revertComponent = (component: SetupComponentKey) => {
    const metadata = SETUP_COMPONENTS.find((item) => item.key === component);
    metadata?.params.forEach((key) => {
      if (!lockedParam(key)) onChangeParam(driver.id, key, baseline[key]);
    });
    setLastChange(undefined);
  };

  return (
    <div className="ui-setup-workspace flex h-full min-h-0 flex-col gap-2" data-testid="setup-workshop">
      <header className="ui-setup-toolbar flex shrink-0 flex-wrap items-center justify-between gap-3 rounded border border-sky-500/25 bg-neutral-950/80 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-300">
            {stage === 'PostQualifying' ? 'Post-qualifying setup review' : 'Engineering setup workspace'}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <strong className="text-neutral-100">{track.name}</strong>
            <span className="text-neutral-600">|</span>
            <span className="text-neutral-400">{draftStatus}</span>
            <span className="text-neutral-600">|</span>
            <span className={practiced ? 'text-emerald-300' : 'text-neutral-500'}>
              {practiced ? 'Practised baseline available' : 'No practised baseline'}
            </span>
            {setupLock?.active && (
              <>
                <span className="text-neutral-600">|</span>
                <span className="font-semibold text-orange-300">{setupLock.label}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded border border-neutral-800 bg-neutral-900/80 p-1" role="tablist" aria-label="Cars">
            {drivers.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === driver.id}
                onClick={() => {
                  setActiveId(item.id);
                  setLastChange(undefined);
                }}
                className={`rounded px-3 py-1 text-xs font-semibold ${
                  item.id === driver.id
                    ? 'bg-sky-500 text-neutral-950'
                    : 'text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                #{item.number} {item.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="ui-setup-grid grid min-h-0 flex-1 gap-2 overflow-x-auto">
        <aside className="ui-setup-components flex min-h-0 flex-col overflow-y-auto rounded border border-neutral-800 bg-neutral-950/55 p-2">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Components</div>
          <div className="space-y-1" role="tablist" aria-label="Setup components">
            {SETUP_COMPONENTS.map((item) => {
              const count = changedSetupComponentCount(baseline, setup, item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={item.key === comp.key}
                  onClick={() => setActiveComp(item.key)}
                  className={`w-full rounded border px-2.5 py-2 text-left ${
                    item.key === comp.key
                      ? 'border-sky-500/50 bg-sky-500/10 text-sky-100'
                      : 'border-transparent text-neutral-400 hover:border-neutral-700 hover:bg-neutral-900/70'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold leading-tight">{item.name}</span>
                    <span className="flex items-center gap-1.5">
                      {count > 0 && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                          {count} changed
                        </span>
                      )}
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: fitBand(tabDotFit(item.key)) }} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-neutral-800 pt-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Quick presets</div>
            <div className="space-y-1">
              {SETUP_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.description}
                  disabled={setupLock?.active}
                  onClick={() => {
                    onApplySetup(driver.id, { ...preset.setup });
                    setLastChange(undefined);
                  }}
                  className="w-full rounded border border-neutral-800 bg-neutral-900/55 px-2.5 py-1.5 text-left text-[11px] text-neutral-300 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 border-t border-neutral-800 pt-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Track demands</div>
            <TrackDemandBars track={track} />
          </div>
        </aside>

        <main className="ui-setup-adjustments flex min-h-0 min-w-0 flex-col overflow-hidden rounded border border-neutral-800 bg-neutral-950/35">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-800 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-neutral-100">{comp.name}</h2>
                <span className="rounded bg-neutral-900 px-2 py-0.5 text-[10px] text-neutral-400">
                  {revealComponents
                    ? `${Math.round(componentFit(comp.key))}% fit`
                    : fitReadout(componentFitEstimate(componentFit(comp.key), setupKnowledge), setupKnowledge)}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-neutral-400">{comp.description}</p>
            </div>
            <Button
              variant="ghost"
              className="shrink-0 px-2.5 py-1 text-[10px]"
              disabled={changedSetupComponentCount(baseline, setup, comp.key) === 0}
              onClick={() => revertComponent(comp.key)}
            >
              Revert component
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="space-y-3">
              {comp.params.map((key) => {
                const meta = SETUP_PARAMS[key];
                const disabled = lockedParam(key);
                const change = setupParameterChange(baseline, setup, key);
                const justChanged = lastChange?.driverId === driver.id && lastChange.key === key;
                return (
                  <section
                    key={key}
                    data-testid={`setup-param-${key}`}
                    className={`rounded border p-3 transition-colors ${
                      justChanged
                        ? 'border-sky-400/70 bg-sky-500/10'
                        : change.changed
                          ? 'border-amber-500/35 bg-amber-500/5'
                          : 'border-neutral-800 bg-neutral-900/45'
                    } ${disabled ? 'opacity-55' : ''}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-neutral-100">{meta.label}</h3>
                          {disabled && (
                            <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-300">
                              Locked
                            </span>
                          )}
                          {justChanged && (
                            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-200">
                              Latest adjustment
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">{meta.description}</p>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="text-lg font-black text-neutral-100">{setup[key].toFixed(1)}</div>
                        <div className={`text-[10px] font-semibold ${change.changed ? 'text-amber-300' : 'text-neutral-500'}`}>
                          {change.previous.toFixed(1)} → {change.current.toFixed(1)} ({formatSetupDelta(change.delta)})
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease ${meta.label}`}
                        disabled={disabled || setup[key] <= 1}
                        onClick={() => changeParam(key, setup[key] - 0.5)}
                        className="h-9 rounded border border-neutral-700 bg-neutral-950 text-lg font-bold text-neutral-200 hover:border-sky-500 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        −
                      </button>
                      <input
                        aria-label={meta.label}
                        type="range"
                        min={1}
                        max={10}
                        step={0.5}
                        value={setup[key]}
                        disabled={disabled}
                        onChange={(event) => changeParam(key, Number(event.target.value))}
                        className="h-2 w-full accent-sky-500 disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        aria-label={`Increase ${meta.label}`}
                        disabled={disabled || setup[key] >= 10}
                        onClick={() => changeParam(key, setup[key] + 0.5)}
                        className="h-9 rounded border border-neutral-700 bg-neutral-950 text-lg font-bold text-neutral-200 hover:border-sky-500 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        +
                      </button>
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      <span>{meta.lowLabel}</span>
                      <span>{meta.highLabel}</span>
                    </div>
                    {disabled && setupLock && (
                      <p className="mt-2 text-[10px] text-orange-200/75">{setupLock.description}</p>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </main>

        <aside className="ui-setup-analysis min-h-0 overflow-y-auto rounded border border-neutral-800 bg-neutral-950/60 p-3">
          <section>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Live analysis</div>
                <div className="mt-1 text-2xl font-black tabular-nums" style={{ color: ratingColor(safeScore(quality.quality)) }}>
                  {qualityDisplay.label}
                </div>
                <div className="text-[10px] text-neutral-500">
                  Objective quality · {engineerConfidenceLabel(setupKnowledge)} confidence
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-neutral-500">Driver comfort</div>
                <div className="mt-1 text-xl font-black" style={{ color: ratingColor(safeScore(comfort.comfort)) }}>
                  {comfort.label === 'Unknown' ? 'Unknown' : formatSetupScore(comfort.comfort)}
                </div>
                <div className="text-[10px] text-neutral-500">{comfort.label}</div>
              </div>
            </div>

            {revealEffects ? (
              <div className="mt-3 space-y-1 text-[11px]">
                <EffectComparison
                  label="Qualifying pace"
                  current={quality.effects.qualifyingPaceCeiling}
                  previous={baselineQuality.effects.qualifyingPaceCeiling}
                  goodHigh
                />
                <EffectComparison
                  label="Race pace"
                  current={quality.effects.racePaceCeiling}
                  previous={baselineQuality.effects.racePaceCeiling}
                  goodHigh
                />
                <EffectComparison
                  label="Tyre wear"
                  current={quality.effects.tyreWear}
                  previous={baselineQuality.effects.tyreWear}
                  goodHigh={false}
                />
                <EffectComparison
                  label="Reliability risk"
                  current={quality.effects.reliabilityRisk}
                  previous={baselineQuality.effects.reliabilityRisk}
                  goodHigh={false}
                />
                <EffectComparison
                  label="Overheating"
                  current={quality.effects.overheatingRisk}
                  previous={baselineQuality.effects.overheatingRisk}
                  goodHigh={false}
                />
                <Effect label="Driver consistency" value={comfort.effects.consistency} goodHigh />
                <Effect label="Mistake risk" value={comfort.effects.mistakeRisk} goodHigh={false} />
              </div>
            ) : (
              <p className="mt-3 rounded bg-neutral-900/70 px-2 py-2 text-[11px] text-neutral-500">
                Run more practice to reveal qualifying, race, tyre, and reliability impacts.
              </p>
            )}
          </section>

          <section className="mt-3 border-t border-neutral-800 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Setup profile</div>
            <SetupRadar data={radar} />
          </section>

          <section className="mt-3 border-t border-neutral-800 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Practice certainty</div>
            <div className="mt-2 space-y-1.5">
              <MiniBar label="Setup knowledge" value={setupKnowledge} />
              <MiniBar label="Tyre knowledge" value={tyreKnowledge} />
              <MiniBar label="Reliability knowledge" value={reliabilityKnowledge} />
            </div>
            <dl className="mt-2 space-y-1 text-[11px]">
              <SetupFact label="Stint window" value={`Lap ${stint.low}–${stint.high}`} />
              <SetupFact label="Tyre confidence" value={tyreStrategyConfidence(tyreKnowledge)} />
              <SetupFact label="Reliability read" value={reliabilityWarningConfidence(reliabilityKnowledge)} />
              <SetupFact label="Change severity" value={changeSeverityLabel(comfort.changeDelta)} />
              <SetupFact label="Data relevance" value={relevanceLabel(comfort.relevance)} />
            </dl>
          </section>

          <section className="mt-3 border-t border-neutral-800 pt-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Driver and engineer</div>
            <ul className="mt-2 space-y-2 text-[11px] leading-4 text-neutral-300">
              {feedback.driverFeedback.map((item) => <li key={item}>&ldquo;{item}&rdquo;</li>)}
            </ul>
            <div className="mt-2 rounded border border-sky-500/25 bg-sky-500/5 p-2 text-[10px] leading-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sky-200">{recommendation.engineerName}</strong>
                <span className="text-neutral-500">{recommendation.specialty}</span>
              </div>
              <p className="mt-1 text-neutral-200">{recommendation.diagnosis}</p>
              <p className="mt-1 text-neutral-400">Tradeoff: {recommendation.tradeoff}</p>
              <dl className="mt-2 space-y-1 border-t border-sky-500/15 pt-2 text-neutral-400">
                <SetupFact label="Relevant specialty" value={recommendation.relevantAttributeLabel} />
                <SetupFact label="Engineer confidence" value={`${recommendation.confidenceLabel} · ${recommendation.confidence}%`} />
                <SetupFact label="Evidence quality" value={`${recommendation.evidenceLabel} · ${recommendation.evidenceQuality}%`} />
                <SetupFact label="Supporting driver" value={recommendation.sourceDriverName} />
              </dl>
              {recommendation.teammateDisagreement && (
                <p className="mt-2 text-amber-200">The two drivers are supplying conflicting evidence; treat this direction cautiously.</p>
              )}
              {recommendation.invalidatesPracticeData && (
                <p className="mt-2 text-amber-200">This change moves beyond the practised window and will reduce data relevance.</p>
              )}
              {recommendation.lockedReason && recommendation.direction === 'Unavailable' && (
                <p className="mt-2 text-orange-200">{recommendation.lockedReason}</p>
              )}
            </div>
            {(comfort.stale || comfort.notes.length > 0) && (
              <ul className="mt-2 space-y-1 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] text-amber-200">
                {comfort.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            )}
            {revealWarnings && quality.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 rounded border border-orange-500/30 bg-orange-500/10 p-2 text-[10px] text-orange-200">
                {quality.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <footer className="ui-setup-actions flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-2">
        <div>
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              {stage === 'PostQualifying' ? 'Back to qualifying review' : 'Back to practice'}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            disabled={changedParams.length === 0}
            onClick={() => {
              onApplySetup(driver.id, { ...baseline });
              setLastChange(undefined);
            }}
          >
            Revert driver
          </Button>
          {practiced && onResetDriver && (
            <Button
              variant="ghost"
              disabled={setupLock?.active}
              onClick={() => {
                onResetDriver(driver.id);
                setLastChange(undefined);
              }}
            >
              Return to practised
            </Button>
          )}
          {other && (
            <Button variant="ghost" disabled={setupLock?.active} onClick={() => onCopy(driver.id, other.id)}>
              Copy to {other.name}
            </Button>
          )}
          {onConfirm && <Button variant="primary" onClick={onConfirm}>Confirm setup</Button>}
        </div>
      </footer>
    </div>
  );
}

// A green/yellow/red band colour for a 0-100 component-fit value.
function fitBand(fit: number): string {
  return ratingColor(fit);
}

// A compact SVG radar/spider chart of the per-component setup fit (0-100), with a
// dashed "target" ring so the profile reads as tuning against a window, not a
// single number.
function SetupRadar({ data }: { data: { label: string; value: number }[] }) {
  const n = data.length;
  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 26;
  const target = 0.7; // 70/100 reference ring
  const pointAt = (i: number, frac: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(ang) * r * frac, cy + Math.sin(ang) * r * frac] as const;
  };
  const poly = data.map((d, i) => pointAt(i, Math.max(0, Math.min(1, d.value / 100)))).map((p) => p.join(',')).join(' ');
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
  const color = ratingColor(pct);
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px]">
        <span className="text-neutral-400">{label}</span>
        <span className="tabular-nums" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
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

function EffectComparison({
  label,
  current,
  previous,
  goodHigh,
}: {
  label: string;
  current: number;
  previous: number;
  goodHigh: boolean;
}) {
  const delta = current - previous;
  const neutral = Math.abs(delta) < 0.05;
  const improved = goodHigh ? delta > 0 : delta < 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded bg-neutral-900/70 px-2 py-1.5">
      <span className="truncate text-neutral-400">{label}</span>
      <span className="tabular-nums text-neutral-300">{fmtDelta(current)}</span>
      <span className={neutral ? 'text-neutral-600' : improved ? 'text-emerald-300' : 'text-red-300'}>
        {neutral ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
      </span>
    </div>
  );
}

function SetupFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-300">{value}</dd>
    </div>
  );
}
