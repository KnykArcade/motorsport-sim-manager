import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { activeDriversForTeam, currentRace } from '../game/careerState';
import { lastBreakdowns } from '../game/gameReducer';
import { getTrackById } from '../data';
import { qualifyingRunPlans } from '../data/decisions/qualifyingRunPlans';
import { raceStrategies } from '../data/decisions/raceStrategies';
import { driverInstructions } from '../data/decisions/driverInstructions';
import { autoSetupsForTrack } from '../sim/autoSetup';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import {
  weekendSessionKinds,
  defaultAssignments,
  PROGRAM_LABELS,
  SESSION_LABELS,
  ALL_PROGRAMS,
  PROGRAM_META,
} from '../sim/practiceProgramEngine';
import type {
  PracticeProgram,
  PracticeSession,
  PracticeSessionKind,
  PracticeAssignment,
  FeedbackSentiment,
} from '../types/practiceTypes';
import { weekendForecast, type WeekendForecast } from '../sim/weatherEngine';
import {
  recommendedQualiRunPlan,
  recommendedRaceStrategy,
  recommendedInstruction,
} from '../sim/weekendAdvisorEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { TrackDemandBars } from '../components/TrackDemandBars';
import { SetupWorkshop } from '../components/SetupWorkshop';
import type { Driver, Track, StandingsEntry } from '../types/gameTypes';
import type { WeatherState } from '../types/liveTypes';
import type { CarSetup } from '../types/setupTypes';
import type { QualifyingDecision, RaceDecision } from '../types/simTypes';

type Phase =
  | 'hub'
  | 'briefing'
  | 'practice'
  | 'setup'
  | 'quali-run'
  | 'quali-review'
  | 'race-strategy'
  | 'race-instructions';

const PHASE_ORDER: { id: Phase; label: string }[] = [
  { id: 'hub', label: 'Weekend Hub' },
  { id: 'briefing', label: 'Track Briefing' },
  { id: 'practice', label: 'Practice' },
  { id: 'setup', label: 'Car Setup' },
  { id: 'quali-run', label: 'Qualifying Run Strategy' },
  { id: 'quali-review', label: 'Qualifying Review' },
  { id: 'race-strategy', label: 'Pre-Race Strategy' },
  { id: 'race-instructions', label: 'Driver Instructions' },
];

export function RaceWeekend() {
  const { state, dispatch, settings } = useGame();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('hub');

  const race = state ? currentRace(state) : undefined;
  const track = race ? getTrackById(race.trackId) : undefined;
  const forecast = useMemo(
    () => (track && state && race ? weekendForecast(track, `${state.randomSeed}-r${race.round}`) : undefined),
    [track, state, race],
  );
  const playerDrivers = useMemo(
    () => (state ? activeDriversForTeam(state, state.selectedTeamId) : []),
    [state],
  );

  const autoSetups = useMemo(
    () => (track ? autoSetupsForTrack(track) : undefined),
    [track],
  );

  // The player tunes the base engineering setup in the Car Setup phase; the team
  // still derives a distinct qualifying trim (Saturday) and race trim (Sunday)
  // automatically. For run plan / strategy / instructions we store overrides.
  const [qualiOverrides, setQualiOverrides] = useState<Record<string, Partial<QualifyingDecision>>>({});
  const [raceOverrides, setRaceOverrides] = useState<Record<string, Partial<RaceDecision>>>({});

  // Unsaved edits made in the Car Setup phase, layered over the committed setups
  // in game state. Resolved into a complete per-driver map for the children.
  const [setupDraft, setSetupDraft] = useState<Record<string, CarSetup>>({});
  const resolvedSetups = useMemo(() => {
    const m: Record<string, CarSetup> = {};
    for (const d of playerDrivers) {
      m[d.id] = setupDraft[d.id] ?? state?.carSetups?.[d.id] ?? { ...BALANCED_SETUP };
    }
    return m;
  }, [playerDrivers, setupDraft, state]);

  const commitSetups = () => {
    for (const d of playerDrivers) {
      dispatch({ type: 'SET_CAR_SETUP', driverId: d.id, setup: resolvedSetups[d.id] });
    }
  };

  const qualiFor = (driverId: string): QualifyingDecision => {
    const o = qualiOverrides[driverId] ?? {};
    return {
      driverId,
      setupId: autoSetups?.qualifying.id ?? '',
      runPlanId: o.runPlanId ?? 'StandardPush',
    };
  };
  const raceFor = (driverId: string): RaceDecision => {
    const o = raceOverrides[driverId] ?? {};
    return {
      driverId,
      setupId: autoSetups?.race.id ?? '',
      strategyId: o.strategyId ?? 'BalancedOneStop',
      instructionId: o.instructionId ?? 'Balanced',
    };
  };

  if (!state || !race || !track || !autoSetups) return null;

  const qualifyingResults = state.qualifyingResults[race.id];

  const runQualifying = () => {
    dispatch({ type: 'RUN_QUALIFYING', decisions: playerDrivers.map((d) => qualiFor(d.id)) });
    setPhase('quali-review');
  };

  const startLiveRace = () => {
    navigate(`/live-race/${race.id}`, {
      state: { decisions: playerDrivers.map((d) => raceFor(d.id)) },
    });
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

      {forecast && phase !== 'hub' && (
        <ForecastBanner
          forecast={forecast}
          highlight={
            phase === 'practice' || phase === 'setup'
              ? 'Practice'
              : phase === 'quali-run' || phase === 'quali-review'
              ? 'Qualifying'
              : 'Race'
          }
        />
      )}

      {phase === 'hub' && forecast && (
        <WeekendHub
          state={state}
          race={race}
          track={track}
          forecast={forecast}
          onNext={() => setPhase('briefing')}
        />
      )}

      {phase === 'briefing' && (
        <Briefing track={track} race={race} onNext={() => setPhase('practice')} />
      )}

      {phase === 'practice' && (
        <PracticePhase
          state={state}
          dispatch={dispatch}
          track={track}
          onBack={() => setPhase('briefing')}
          onNext={() => setPhase('setup')}
        />
      )}

      {phase === 'setup' && (
        <div className="space-y-4">
          <SetupWorkshop
            track={track}
            drivers={playerDrivers}
            setups={resolvedSetups}
            onChangeParam={(driverId, key, value) =>
              setSetupDraft((p) => ({ ...p, [driverId]: { ...p[driverId], [key]: value } }))
            }
            onApplySetup={(driverId, setup) =>
              setSetupDraft((p) => ({ ...p, [driverId]: setup }))
            }
            onCopy={(fromId, toId) =>
              setSetupDraft((p) => ({ ...p, [toId]: { ...p[fromId] } }))
            }
          />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => { commitSetups(); setPhase('practice'); }}>
              ← Back to Practice
            </Button>
            <Button variant="primary" onClick={() => { commitSetups(); setPhase('quali-run'); }}>
              Confirm Setup →
            </Button>
          </div>
        </div>
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
          recommendedId={recommendedQualiRunPlan(track, forecast?.Qualifying).optionId}
          recommendedReason={recommendedQualiRunPlan(track, forecast?.Qualifying).reason}
          onBack={() => setPhase('setup')}
          onNext={runQualifying}
          nextLabel="Simulate Qualifying →"
        />
      )}

      {phase === 'quali-review' && qualifyingResults && (
        <QualifyingReview
          state={state}
          raceId={race.id}
          debug={settings.debugMode}
          onNext={() => setPhase('race-strategy')}
        />
      )}

      {phase === 'race-strategy' && (
        <DecisionPhase
          title="Pre-Race Strategy Selection"
          subtitle="The grid is set. Pick a pit/tyre strategy for each driver — you can still adapt live during the race."
          drivers={playerDrivers}
          options={raceStrategies.map((s) => ({ id: s.id, name: s.name, description: s.description }))}
          valueFor={(id) => raceFor(id).strategyId}
          onSelect={(driverId, optId) =>
            setRaceOverrides((p) => ({ ...p, [driverId]: { ...p[driverId], strategyId: optId as RaceDecision['strategyId'] } }))
          }
          recommendedId={recommendedRaceStrategy(track, forecast?.Race).optionId}
          recommendedReason={recommendedRaceStrategy(track, forecast?.Race).reason}
          onBack={() => setPhase('quali-review')}
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
          recommendedId={recommendedInstruction(track, forecast?.Race).optionId}
          recommendedReason={recommendedInstruction(track, forecast?.Race).reason}
          onBack={() => setPhase('race-strategy')}
          onNext={startLiveRace}
          nextLabel="Start Live Race →"
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

const SENTIMENT_STYLE: Record<FeedbackSentiment, string> = {
  Positive: 'text-emerald-400',
  Neutral: 'text-neutral-400',
  Concern: 'text-amber-400',
  Warning: 'text-red-400',
};

function PracticePhase({
  state,
  dispatch,
  onBack,
  onNext,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  dispatch: ReturnType<typeof useGame>['dispatch'];
  track: Track;
  onBack: () => void;
  onNext: () => void;
}) {
  const race = currentRace(state)!;
  const players = useMemo(
    () => activeDriversForTeam(state, state.selectedTeamId),
    [state],
  );
  const kinds = useMemo(
    () => weekendSessionKinds(state.seasonYear, state.series),
    [state.seasonYear, state.series],
  );

  const wp =
    state.weekendPractice && state.weekendPractice.raceId === race.id
      ? state.weekendPractice
      : undefined;
  const completedByKind = useMemo(() => {
    const m: Record<string, PracticeSession> = {};
    for (const s of wp?.sessions ?? []) if (s.completed) m[s.kind] = s;
    return m;
  }, [wp]);

  // Local per-session program selections, defaulted to a sensible spread.
  const [assignments, setAssignments] = useState<Record<string, Record<string, PracticeProgram>>>(
    () => {
      const init: Record<string, Record<string, PracticeProgram>> = {};
      for (const k of kinds) {
        init[k] = {};
        for (const a of defaultAssignments(players.map((d) => d.id), k)) {
          init[k][a.driverId] = a.program;
        }
      }
      return init;
    },
  );

  const setProgram = (kind: string, driverId: string, program: PracticeProgram) =>
    setAssignments((prev) => ({ ...prev, [kind]: { ...prev[kind], [driverId]: program } }));

  const runSession = (kind: PracticeSessionKind) => {
    const sel = assignments[kind] ?? {};
    const list: PracticeAssignment[] = players.map((d) => {
      const program = sel[d.id] ?? 'SetupExploration';
      return { driverId: d.id, program, lapsPlanned: PROGRAM_META[program].defaultLaps };
    });
    dispatch({ type: 'RUN_PRACTICE_SESSION', raceId: race.id, kind, assignments: list });
  };

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const driverNumber = (id: string) => state.drivers.find((d) => d.id === id)?.number ?? '';

  const allRun = kinds.every((k) => completedByKind[k]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">Practice</h2>
        <p className="text-sm text-neutral-400">
          Assign a program to each driver and run the session. Practice builds setup, tyre and
          reliability knowledge plus driver confidence — it gives directional feedback, never the
          perfect setup. Carry what you learn into the Car Setup workshop next.
        </p>
      </div>

      {players.map((d) => {
        const k = wp?.knowledge;
        const conf = state.drivers.find((x) => x.id === d.id)?.confidence ?? d.confidence;
        const delta = k?.confidenceDelta[d.id] ?? 0;
        return (
          <Panel key={d.id} title={`#${driverNumber(d.id)} ${driverName(d.id)} — Weekend Knowledge`}>
            <div className="grid gap-3 sm:grid-cols-4">
              <KnowledgeBar label="Setup" value={k?.setupKnowledge[d.id] ?? 0} />
              <KnowledgeBar label="Tyres" value={k?.tireKnowledge[d.id] ?? 0} />
              <KnowledgeBar label="Reliability" value={k?.reliabilityKnowledge[d.id] ?? 0} />
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-neutral-500">Confidence</div>
                <div className="font-semibold text-neutral-100">
                  {conf}
                  {delta ? (
                    <span className={delta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {' '}({delta > 0 ? '+' : ''}{delta.toFixed(1)})
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </Panel>
        );
      })}

      {kinds.map((kind) => {
        const done = completedByKind[kind];
        return (
          <Panel key={kind} title={SESSION_LABELS[kind]}>
            {done ? (
              <div className="space-y-3">
                {(done.results ?? []).map((r) => (
                  <div key={r.driverId} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-neutral-100">
                        #{driverNumber(r.driverId)} {driverName(r.driverId)}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {PROGRAM_LABELS[r.program]} · {r.lapsCompleted} laps
                        {r.incident ? ' · incident' : ''}
                      </span>
                    </div>
                    <ul className="space-y-0.5 text-sm">
                      {r.feedback.map((f) => (
                        <li key={f.id} className={SENTIMENT_STYLE[f.sentiment]}>
                          • {f.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {players.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-200">
                      #{driverNumber(d.id)} {driverName(d.id)}
                    </span>
                    <select
                      className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
                      value={assignments[kind]?.[d.id] ?? 'SetupExploration'}
                      onChange={(e) => setProgram(kind, d.id, e.target.value as PracticeProgram)}
                    >
                      {ALL_PROGRAMS.map((p) => (
                        <option key={p} value={p}>
                          {PROGRAM_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button variant="primary" onClick={() => runSession(kind)}>
                    Run {SESSION_LABELS[kind]}
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        );
      })}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button variant="primary" onClick={onNext}>
          {allRun ? 'Car Setup →' : 'Skip to Car Setup →'}
        </Button>
      </div>
    </div>
  );
}

function KnowledgeBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-neutral-500">
        <span>{label}</span>
        <span className="text-neutral-300">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-neutral-800">
        <div className="h-full rounded bg-sky-500" style={{ width: `${pct}%` }} />
      </div>
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
  recommendedReason,
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
  recommendedReason?: string;
}) {
  const recommendedName = options.find((o) => o.id === recommendedId)?.name;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
        <p className="text-sm text-neutral-400">{subtitle}</p>
        {recommendedName && recommendedReason && (
          <p className="mt-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300">
            <span className="font-semibold">Engineer recommends {recommendedName}:</span> {recommendedReason}
          </p>
        )}
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

const WEATHER_TONE: Record<string, string> = {
  Dry: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
  Cloudy: 'text-neutral-300 border-neutral-600 bg-neutral-800/60',
  Drying: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  Changeable: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  LightRain: 'text-blue-300 border-blue-500/30 bg-blue-500/10',
  HeavyRain: 'text-blue-200 border-blue-400/40 bg-blue-500/20',
};

function WeatherChip({ weather }: { weather: WeatherState }) {
  const tone = WEATHER_TONE[weather.condition] ?? WEATHER_TONE.Cloudy;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs ${tone}`}>
      {weather.label}
      {weather.changingSoon && <span className="text-[10px] uppercase opacity-80">· changing</span>}
    </span>
  );
}

function ForecastBanner({
  forecast,
  highlight,
}: {
  forecast: WeekendForecast;
  highlight: 'Practice' | 'Qualifying' | 'Race';
}) {
  const sessions: ('Practice' | 'Qualifying' | 'Race')[] = ['Practice', 'Qualifying', 'Race'];
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">Forecast</span>
      {sessions.map((s) => (
        <div
          key={s}
          className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 ${
            s === highlight ? 'bg-neutral-800/80' : ''
          }`}
        >
          <span className={`text-xs ${s === highlight ? 'font-semibold text-neutral-200' : 'text-neutral-500'}`}>
            {s}
          </span>
          <WeatherChip weather={forecast[s]} />
        </div>
      ))}
    </div>
  );
}

function WeekendHub({
  state,
  race,
  track,
  forecast,
  onNext,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  race: { gpName: string; trackName: string; round: number; laps: number; distanceKm?: number };
  track: Track;
  forecast: WeekendForecast;
  onNext: () => void;
}) {
  const calendarLength = state.calendar.length;
  const completed = state.calendar.filter((r) => r.completed).length;
  const players = activeDriversForTeam(state, state.selectedTeamId);

  const standingsPos = (list: StandingsEntry[], id: string) => {
    const idx = list.findIndex((s) => s.entityId === id);
    return idx >= 0 ? { pos: idx + 1, entry: list[idx] } : undefined;
  };
  const teamStanding = standingsPos(state.constructorStandings, state.selectedTeamId);
  const leaderPoints = state.constructorStandings[0]?.points ?? 0;
  const wet = forecast.Race.wet;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="This Weekend">
          <div className="text-xl font-bold text-neutral-100">{race.gpName}</div>
          <div className="text-sm text-neutral-400">{track.name}</div>
          <div className="mt-2 inline-block rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
            {track.archetype}
          </div>
          <div className="mt-3 text-xs text-neutral-500">
            Round {race.round} of {calendarLength} · {race.laps} laps
          </div>
          {wet && (
            <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-200">
              Rain forecast for race day — plan a wet-weather setup and strategy.
            </div>
          )}
        </Panel>

        <Panel title="Forecast">
          <div className="space-y-2">
            {(['Practice', 'Qualifying', 'Race'] as const).map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span className="text-sm text-neutral-300">{s}</span>
                <WeatherChip weather={forecast[s]} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-neutral-500">
            The forecast is the team's best read — conditions can still shift live during the race.
          </p>
        </Panel>

        <Panel title="Championship Stakes">
          {teamStanding ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Constructors</span>
                <span className="font-semibold text-neutral-100">P{teamStanding.pos}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Points</span>
                <span className="text-neutral-200">{teamStanding.entry.points}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Gap to leader</span>
                <span className="text-neutral-200">
                  {teamStanding.pos === 1 ? '— (leading)' : `${leaderPoints - teamStanding.entry.points} pts`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Wins / Podiums</span>
                <span className="text-neutral-200">
                  {teamStanding.entry.wins} / {teamStanding.entry.podiums}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Standings open once the season is under way.</p>
          )}
        </Panel>
      </div>

      <Panel title="Your Drivers">
        <div className="grid gap-3 sm:grid-cols-2">
          {players.map((d) => {
            const ds = standingsPos(state.driverStandings, d.id);
            return (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
                <span className="text-sm text-neutral-100">#{d.number} {d.name}</span>
                <span className="text-xs text-neutral-400">
                  {ds ? `P${ds.pos} · ${ds.entry.points} pts` : 'Unranked'}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-500">{completed} of {calendarLength} rounds completed this season.</div>
        <Button variant="primary" onClick={onNext}>Enter Race Weekend →</Button>
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

  const dnqCount = results.filter((r) => r.dnq).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">Qualifying Review</h2>
        <p className="text-sm text-neutral-400">Review the grid, then choose your race strategy in response.</p>
        {dnqCount > 0 && (
          <p className="mt-1 text-sm text-red-400">
            {dnqCount} car{dnqCount > 1 ? 's' : ''} did not qualify — only the fastest{' '}
            {results.length - dnqCount} start the race.
          </p>
        )}
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
            {results.map((r, idx) => {
              const bd = lastBreakdowns.qualifying[r.driverId];
              const firstDnq = r.dnq && !results[idx - 1]?.dnq;
              return (
                <tr
                  key={r.driverId}
                  className={`border-t ${firstDnq ? 'border-red-600/70' : 'border-neutral-800/60'} ${
                    r.dnq ? 'bg-red-950/30 text-neutral-500' : isPlayer(r.teamId) ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <td className="px-3 py-1.5 font-semibold tabular-nums text-neutral-200">{r.position}</td>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-1 rounded-sm" style={{ backgroundColor: teamColor(r.teamId) }} />
                      {driverName(r.driverId)}
                      {r.dnq && (
                        <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-300">
                          DNQ
                        </span>
                      )}
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
