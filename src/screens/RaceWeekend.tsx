import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { currentRace, driversForTeam } from '../game/careerState';
import { lastBreakdowns } from '../game/gameReducer';
import { getTrackById, setupOptions } from '../data';
import { qualifyingRunPlans } from '../data/decisions/qualifyingRunPlans';
import { raceStrategies } from '../data/decisions/raceStrategies';
import { driverInstructions } from '../data/decisions/driverInstructions';
import { recommendSetup } from '../sim/recommendation';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { TrackDemandBars } from '../components/TrackDemandBars';
import type { Driver, Track } from '../types/gameTypes';
import type { QualifyingDecision, RaceDecision } from '../types/simTypes';

type Phase =
  | 'briefing'
  | 'quali-setup'
  | 'quali-run'
  | 'quali-review'
  | 'race-setup'
  | 'race-strategy'
  | 'race-instructions';

const PHASE_ORDER: { id: Phase; label: string }[] = [
  { id: 'briefing', label: 'Track Briefing' },
  { id: 'quali-setup', label: 'Qualifying Setup' },
  { id: 'quali-run', label: 'Qualifying Run Plan' },
  { id: 'quali-review', label: 'Qualifying Review' },
  { id: 'race-setup', label: 'Race Setup' },
  { id: 'race-strategy', label: 'Race Strategy' },
  { id: 'race-instructions', label: 'Driver Instructions' },
];

export function RaceWeekend() {
  const { state, dispatch, settings } = useGame();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('briefing');

  const race = state ? currentRace(state) : undefined;
  const track = race ? getTrackById(race.trackId) : undefined;
  const playerDrivers = useMemo(
    () => (state ? driversForTeam(state, state.selectedTeamId) : []),
    [state],
  );

  const recommended = useMemo(
    () => (track ? recommendSetup(track, setupOptions) : setupOptions[0]),
    [track],
  );

  // Only the player's deviations from the recommended defaults are stored; the
  // full decision is derived during render. This avoids setState-in-render.
  const [qualiOverrides, setQualiOverrides] = useState<Record<string, Partial<QualifyingDecision>>>({});
  const [raceOverrides, setRaceOverrides] = useState<Record<string, Partial<RaceDecision>>>({});

  const recommendedId = recommended.id;
  const qualiFor = (driverId: string): QualifyingDecision => {
    const o = qualiOverrides[driverId] ?? {};
    return { driverId, setupId: o.setupId ?? recommendedId, runPlanId: o.runPlanId ?? 'StandardPush' };
  };
  const raceFor = (driverId: string): RaceDecision => {
    const o = raceOverrides[driverId] ?? {};
    return {
      driverId,
      setupId: o.setupId ?? recommendedId,
      strategyId: o.strategyId ?? 'BalancedOneStop',
      instructionId: o.instructionId ?? 'Balanced',
    };
  };

  if (!state || !race || !track) return null;

  const qualifyingResults = state.qualifyingResults[race.id];

  const runQualifying = () => {
    dispatch({ type: 'RUN_QUALIFYING', decisions: playerDrivers.map((d) => qualiFor(d.id)) });
    setPhase('quali-review');
  };

  const runRace = () => {
    const raceId = race.id;
    dispatch({ type: 'RUN_RACE', decisions: playerDrivers.map((d) => raceFor(d.id)) });
    navigate(`/results/${raceId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">{race.gpName}</h1>
          <p className="text-sm text-neutral-400">{race.trackName} · Round {race.round}</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/hq')}>Exit to HQ</Button>
      </div>

      <PhaseStepper phase={phase} hasQuali={!!qualifyingResults} />

      {phase === 'briefing' && (
        <Briefing track={track} race={race} onNext={() => setPhase('quali-setup')} />
      )}

      {phase === 'quali-setup' && (
        <DecisionPhase
          title="Qualifying Setup Selection"
          subtitle="Choose a qualifying setup for each driver. This is independent from your race setup."
          drivers={playerDrivers}
          recommendedId={recommended.id}
          options={setupOptions.map((s) => ({ id: s.id, name: s.name, description: s.description }))}
          valueFor={(id) => qualiFor(id).setupId}
          onSelect={(driverId, optId) =>
            setQualiOverrides((p) => ({ ...p, [driverId]: { ...p[driverId], setupId: optId } }))
          }
          onBack={() => setPhase('briefing')}
          onNext={() => setPhase('quali-run')}
        />
      )}

      {phase === 'quali-run' && (
        <DecisionPhase
          title="Qualifying Run Plan"
          subtitle="How should each driver approach the session? Aggression here does NOT carry into the race."
          drivers={playerDrivers}
          options={qualifyingRunPlans.map((p) => ({ id: p.id, name: p.name, description: p.description }))}
          valueFor={(id) => qualiFor(id).runPlanId}
          onSelect={(driverId, optId) =>
            setQualiOverrides((p) => ({ ...p, [driverId]: { ...p[driverId], runPlanId: optId as QualifyingDecision['runPlanId'] } }))
          }
          onBack={() => setPhase('quali-setup')}
          onNext={runQualifying}
          nextLabel="Simulate Qualifying →"
        />
      )}

      {phase === 'quali-review' && qualifyingResults && (
        <QualifyingReview
          state={state}
          raceId={race.id}
          debug={settings.debugMode}
          onNext={() => setPhase('race-setup')}
        />
      )}

      {phase === 'race-setup' && (
        <DecisionPhase
          title="Race Setup Selection"
          subtitle="Now that the grid is set, choose your race-day setup. React to your qualifying result."
          drivers={playerDrivers}
          recommendedId={recommended.id}
          options={setupOptions.map((s) => ({ id: s.id, name: s.name, description: s.description }))}
          valueFor={(id) => raceFor(id).setupId}
          onSelect={(driverId, optId) =>
            setRaceOverrides((p) => ({ ...p, [driverId]: { ...p[driverId], setupId: optId } }))
          }
          onBack={() => setPhase('quali-review')}
          onNext={() => setPhase('race-strategy')}
        />
      )}

      {phase === 'race-strategy' && (
        <DecisionPhase
          title="Race Strategy Selection"
          subtitle="Pick a pit/tyre strategy for each driver."
          drivers={playerDrivers}
          options={raceStrategies.map((s) => ({ id: s.id, name: s.name, description: s.description }))}
          valueFor={(id) => raceFor(id).strategyId}
          onSelect={(driverId, optId) =>
            setRaceOverrides((p) => ({ ...p, [driverId]: { ...p[driverId], strategyId: optId as RaceDecision['strategyId'] } }))
          }
          onBack={() => setPhase('race-setup')}
          onNext={() => setPhase('race-instructions')}
        />
      )}

      {phase === 'race-instructions' && (
        <DecisionPhase
          title="Driver Race Instructions"
          subtitle="Set how hard each driver pushes during the race."
          drivers={playerDrivers}
          options={driverInstructions.map((s) => ({ id: s.id, name: s.name, description: s.description }))}
          valueFor={(id) => raceFor(id).instructionId}
          onSelect={(driverId, optId) =>
            setRaceOverrides((p) => ({ ...p, [driverId]: { ...p[driverId], instructionId: optId as RaceDecision['instructionId'] } }))
          }
          onBack={() => setPhase('race-strategy')}
          onNext={runRace}
          nextLabel="Simulate Race →"
        />
      )}
    </div>
  );
}

function PhaseStepper({ phase, hasQuali }: { phase: Phase; hasQuali: boolean }) {
  const currentIdx = PHASE_ORDER.findIndex((p) => p.id === phase);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {PHASE_ORDER.map((p, i) => {
        const done = i < currentIdx || (p.id === 'quali-review' && hasQuali && phase !== 'quali-review');
        const active = p.id === phase;
        return (
          <div key={p.id} className="flex items-center gap-1.5">
            <span
              className={`rounded px-2 py-1 ${
                active ? 'bg-amber-500 font-semibold text-neutral-950' : done ? 'bg-green-500/15 text-green-300' : 'bg-neutral-800 text-neutral-500'
              }`}
            >
              {i + 1}. {p.label}
            </span>
            {i < PHASE_ORDER.length - 1 && <span className="text-neutral-700">›</span>}
          </div>
        );
      })}
    </div>
  );
}

function Briefing({ track, race, onNext }: { track: Track; race: { laps: number; distanceKm?: number; gpName: string }; onNext: () => void }) {
  return (
    <Panel
      title="Track Briefing"
      actions={<Button variant="primary" onClick={onNext}>Begin Qualifying Prep →</Button>}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="text-xl font-bold text-neutral-100">{race.gpName}</div>
          <div className="text-sm text-neutral-400">{track.name}</div>
          <div className="mt-2 inline-block rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
            {track.archetype}
          </div>
          <div className="mt-3 text-xs text-neutral-500">{race.laps} laps · {race.distanceKm ?? '—'} km</div>

          <div className="mt-4 space-y-2 text-sm">
            <div>
              <span className="text-neutral-500">Recommended Setup: </span>
              <span className="text-neutral-200">{track.setupProfile.primarySetupProfile}</span>
            </div>
            <div>
              <span className="text-neutral-500">Downforce: </span>
              <span className="text-neutral-200">{track.setupProfile.downforceLevel}</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Key Demands</div>
            <TrackDemandBars track={track} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InfoBox label="Strategic Notes" text={track.setupProfile.strategyNotes} />
        <InfoBox label="Rating Notes" text={track.ratingNotes} />
      </div>
    </Panel>
  );
}

function InfoBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <p className="text-sm text-neutral-300">{text}</p>
    </div>
  );
}

type Option = { id: string; name: string; description: string };

function DecisionPhase({
  title,
  subtitle,
  drivers,
  options,
  valueFor,
  onSelect,
  onBack,
  onNext,
  nextLabel = 'Continue →',
  recommendedId,
}: {
  title: string;
  subtitle: string;
  drivers: Driver[];
  options: Option[];
  valueFor: (driverId: string) => string | undefined;
  onSelect: (driverId: string, optionId: string) => void;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  recommendedId?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
        <p className="text-sm text-neutral-400">{subtitle}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {drivers.map((d) => (
          <Panel key={d.id} title={`#${d.number} ${d.name}`}>
            <div className="space-y-2">
              {options.map((opt) => {
                const selected = valueFor(d.id) === opt.id;
                const recommended = recommendedId === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onSelect(d.id, opt.id)}
                    className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                      selected ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-100">{opt.name}</span>
                      {recommended && (
                        <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-green-300">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">{opt.description}</div>
                  </button>
                );
              })}
            </div>
          </Panel>
        ))}
      </div>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button variant="primary" onClick={onNext}>{nextLabel}</Button>
      </div>
    </div>
  );
}

function QualifyingReview({
  state,
  raceId,
  debug,
  onNext,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  raceId: string;
  debug: boolean;
  onNext: () => void;
}) {
  const results = state.qualifyingResults[raceId] ?? [];
  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color ?? '#666';
  const isPlayer = (teamId: string) => teamId === state.selectedTeamId;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">Qualifying Review</h2>
        <p className="text-sm text-neutral-400">Review the grid, then choose your race strategy in response.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900/40 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">Driver</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Gap</th>
              <th className="px-3 py-2">Run Plan</th>
              <th className="px-3 py-2">Notes</th>
              {debug && <th className="px-3 py-2">Score</th>}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const bd = lastBreakdowns.qualifying[r.driverId];
              return (
                <tr key={r.driverId} className={`border-t border-neutral-800/60 ${isPlayer(r.teamId) ? 'bg-amber-500/10' : ''}`}>
                  <td className="px-3 py-1.5 font-semibold tabular-nums text-neutral-200">{r.position}</td>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-1 rounded-sm" style={{ backgroundColor: teamColor(r.teamId) }} />
                      {driverName(r.driverId)}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-neutral-400">{teamName(r.teamId)}</td>
                  <td className="px-3 py-1.5 text-neutral-300">{r.gapText}</td>
                  <td className="px-3 py-1.5 text-neutral-500">{r.runPlan}</td>
                  <td className="px-3 py-1.5 text-xs text-neutral-400">
                    {r.incident?.type === 'Crash' && <span className="mr-1 text-red-400">CRASH</span>}
                    {r.notes.join(', ')}
                  </td>
                  {debug && (
                    <td className="px-3 py-1.5 text-xs tabular-nums text-neutral-500">
                      {bd ? `fit ${bd.trackFit.toFixed(1)} / set ${bd.setupFit.toFixed(1)} / var ${bd.variance.toFixed(1)} = ${bd.finalScore.toFixed(1)}` : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button variant="primary" onClick={onNext}>Choose Race Strategy →</Button>
      </div>
    </div>
  );
}
