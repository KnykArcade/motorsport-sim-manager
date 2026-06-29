import { useMemo, useState } from 'react';
import type { Driver, Track } from '../types/gameTypes';
import type { CarSetup, SetupParamKey } from '../types/setupTypes';
import {
  SETUP_COMPONENTS,
  SETUP_PARAMS,
  SETUP_PRESETS,
} from '../data/setup/setupComponents';
import { calculateSetupFit, generateSetupFeedback } from '../sim/setupFitEngine';
import { Panel } from './Panel';
import { Button } from './Button';
import { StatBar } from './StatBar';
import { TrackDemandBars } from './TrackDemandBars';
import { ratingColor } from './ui';

type Props = {
  track: Track;
  drivers: Driver[];
  setups: Record<string, CarSetup>;
  onChangeParam: (driverId: string, key: SetupParamKey, value: number) => void;
  onApplySetup: (driverId: string, setup: CarSetup) => void;
  onCopy: (fromId: string, toId: string) => void;
};

function confidenceLabel(c: number): string {
  if (c >= 80) return 'Dialed In';
  if (c >= 64) return 'Comfortable';
  if (c >= 48) return 'Workable';
  return 'Struggling';
}

function fmtDelta(v: number): string {
  return v > 0 ? `+${v}` : `${v}`;
}

export function SetupWorkshop({
  track,
  drivers,
  setups,
  onChangeParam,
  onApplySetup,
  onCopy,
}: Props) {
  const [activeId, setActiveId] = useState(drivers[0]?.id ?? '');
  const driver = drivers.find((d) => d.id === activeId) ?? drivers[0];
  const setup = driver ? setups[driver.id] : undefined;
  const other = drivers.find((d) => d.id !== driver?.id);

  const fit = useMemo(
    () => (setup && driver ? calculateSetupFit(setup, track, driver) : undefined),
    [setup, track, driver],
  );
  const feedback = useMemo(
    () => (setup && driver ? generateSetupFeedback(setup, track, driver) : undefined),
    [setup, track, driver],
  );

  if (!driver || !setup || !fit || !feedback) return null;

  const componentFit = (key: string) => fit.components.find((c) => c.component === key)?.fit ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">Car Setup Workshop</h2>
        <p className="text-sm text-neutral-400">
          Tune the engineering setup for each driver. The team still runs an automatic qualifying
          trim and race trim from this base — you are dialling in the car, not picking trim.
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
            return (
              <Panel key={comp.key} title={comp.name}>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="text-xs text-neutral-400">{comp.description}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-neutral-500">Fit</span>
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: ratingColor(cf / 10) }}
                    >
                      {cf}
                    </span>
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
          <Panel title="Setup Confidence">
            <div className="flex items-end gap-3">
              <span
                className="text-4xl font-bold tabular-nums"
                style={{ color: ratingColor(fit.confidence / 10) }}
              >
                {fit.confidence}
              </span>
              <span className="pb-1 text-sm text-neutral-400">/ 100</span>
            </div>
            <div className="mt-1 text-sm font-medium text-neutral-300">
              {confidenceLabel(fit.confidence)}
            </div>
            <div className="mt-3 space-y-1.5">
              <StatBar label="Top Speed" value={fit.effects.topSpeed} />
              <StatBar label="Cornering" value={fit.effects.cornering} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Effect label="Quali Pace" value={fit.effects.qualifyingPace} goodHigh />
              <Effect label="Race Pace" value={fit.effects.racePace} goodHigh />
              <Effect label="Tyre Wear" value={fit.effects.tyreWear} goodHigh={false} />
              <Effect label="Reliability Risk" value={fit.effects.reliabilityRisk} goodHigh={false} />
              <Effect label="Mistake Risk" value={fit.effects.mistakeRisk} goodHigh={false} />
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

          <Panel title="Engineer Feedback">
            <ul className="space-y-1.5 text-xs text-neutral-300">
              {feedback.engineerFeedback.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </Panel>

          {fit.warnings.length > 0 && (
            <Panel title="Warnings">
              <ul className="space-y-1.5 text-xs text-amber-300">
                {fit.warnings.map((w, i) => (
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
