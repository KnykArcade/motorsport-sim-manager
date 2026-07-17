import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { activeDriversForTeam, carForTeam, currentRace } from '../game/careerState';
import { lastBreakdowns } from '../game/gameReducer';
import { getTrackById } from '../data';
import { ratingColor } from '../components/ui';
import { qualifyingRunPlans } from '../data/decisions/qualifyingRunPlans';
import { raceStrategies } from '../data/decisions/raceStrategies';
import { driverInstructions } from '../data/decisions/driverInstructions';
import { autoSetupsForTrack } from '../sim/autoSetup';
import { qualifyingFormatFor } from '../sim/qualifyingEngine';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { sanitizeSetupProfile } from '../sim/setupSanitize';
import {
  weekendSessionKinds,
  PROGRAM_LABELS,
  SESSION_LABELS,
  ALL_PROGRAMS,
  PROGRAM_META,
  practiceLapBudget,
  sessionLapCost,
  teamKnowledgeGaps,
  recommendedPracticeProgram,
  driverPracticeSummary,
} from '../sim/practiceProgramEngine';
import type {
  PracticeProgram,
  PracticeSession,
  PracticeSessionKind,
  PracticeAssignment,
  PracticeRunResult,
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
import { SetupWorkshop, type WorkshopPractice } from '../components/SetupWorkshop';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  RACE_WEEKEND_PHASES,
  canOpenRaceWeekendPhase,
  raceWeekendPhaseIndex,
  visibleRaceWeekendPhases,
  type RaceWeekendPhase,
} from './raceTransitionViewModel';
import type { Driver, Track, StandingsEntry } from '../types/gameTypes';
import type { WeatherState } from '../types/liveTypes';
import type { CarSetup } from '../types/setupTypes';
import type { QualifyingDecision, QualifyingFormat, RaceDecision } from '../types/simTypes';

type Phase = RaceWeekendPhase;

const PHASE_ORDER = RACE_WEEKEND_PHASES;

export function RaceWeekend() {
  const { state, dispatch, settings } = useGame();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('hub');
  const [furthestPhase, setFurthestPhase] = useState<Phase>('hub');

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
  const qualifyingResults = state && race ? state.qualifyingResults[race.id] : undefined;

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
  // Always resolve to a COMPLETE, numeric setup per driver so the workshop and
  // its score maths never see undefined fields (which produced "NaN–NaN"). The
  // baseline exists from career start / rollover; sanitize is a final guard.
  const resolvedSetups = useMemo(() => {
    const m: Record<string, CarSetup> = {};
    for (const d of playerDrivers) {
      m[d.id] = sanitizeSetupProfile(setupDraft[d.id] ?? state?.carSetups?.[d.id] ?? BALANCED_SETUP);
    }
    return m;
  }, [playerDrivers, setupDraft, state]);

  const commitSetups = () => {
    for (const d of playerDrivers) {
      dispatch({ type: 'SET_CAR_SETUP', driverId: d.id, setup: resolvedSetups[d.id] });
    }
  };

  // Per-driver practice context for the setup workshop: knowledge (gates
  // certainty), the practised setup family + laps (drive comfort/familiarity),
  // and which programs were run.
  const workshopPractice = useMemo<WorkshopPractice | undefined>(() => {
    if (!state || !race) return undefined;
    const wp =
      state.weekendPractice && state.weekendPractice.raceId === race.id
        ? state.weekendPractice
        : undefined;
    const summaryByDriver: WorkshopPractice['summaryByDriver'] = {};
    for (const d of playerDrivers) summaryByDriver[d.id] = driverPracticeSummary(wp, d.id);
    return {
      setupKnowledge: wp?.knowledge.setupKnowledge ?? {},
      tyreKnowledge: wp?.knowledge.tireKnowledge ?? {},
      reliabilityKnowledge: wp?.knowledge.reliabilityKnowledge ?? {},
      practicedSetupByDriver: wp?.practicedSetupByDriver ?? {},
      practiceLapsByDriver: wp?.practiceLapsByDriver ?? {},
      summaryByDriver,
      raceWet: forecast?.Race.wet ?? false,
    };
  }, [state, race, playerDrivers, forecast]);

  const qualiFor = (driverId: string): QualifyingDecision => {
    const o = qualiOverrides[driverId] ?? {};
    return {
      driverId,
      setupId: autoSetups?.qualifying.id ?? '',
      runPlanId: o.runPlanId ?? 'StandardPush',
      runs: o.runs ?? 2,
      tyreApproach: o.tyreApproach ?? 'Standard',
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

  const isMinPackage = state.raceWeekendPackage?.packageType === 'MandatoryMinimum';
  const visiblePhases = visibleRaceWeekendPhases(isMinPackage);
  const unlockedPhase = qualifyingResults
    && raceWeekendPhaseIndex('quali-review', isMinPackage) > raceWeekendPhaseIndex(furthestPhase, isMinPackage)
    ? 'quali-review'
    : furthestPhase;
  const moveTo = (next: Phase) => {
    if (raceWeekendPhaseIndex(next, isMinPackage) < 0) return;
    setPhase(next);
    setFurthestPhase((current) => (
      raceWeekendPhaseIndex(next, isMinPackage) > raceWeekendPhaseIndex(current, isMinPackage)
        ? next
        : current
    ));
  };

  const runQualifying = () => {
    dispatch({ type: 'RUN_QUALIFYING', decisions: playerDrivers.map((d) => qualiFor(d.id)) });
    moveTo('quali-review');
  };

  const startLiveRace = () => {
    navigate(`/live-race/${race.id}`, {
      state: { decisions: playerDrivers.map((d) => raceFor(d.id)) },
    });
  };

  // Practice and Car Setup are laid out as full-height, no-page-scroll screens:
  // the header/stepper/forecast stay pinned and only the phase's own internal
  // panels scroll. Other phases flow normally inside the scroll wrapper.
  const fullHeightPhase = phase === 'practice' || phase === 'setup';
  const phaseTitle = PHASE_ORDER.find((p) => p.id === phase)?.label ?? 'Weekend Hub';
  const completedPracticeSessions = state.weekendPractice?.raceId === race.id
    ? state.weekendPractice.sessions.filter((session) => session.completed).length
    : 0;
  const totalPracticeSessions = isMinPackage ? 0 : weekendSessionKinds(state.seasonYear, state.series).length;
  const bestPlayerGrid = qualifyingResults
    ?.filter((result) => result.teamId === state.selectedTeamId)
    .reduce<number | undefined>((best, result) => best === undefined ? result.position : Math.min(best, result.position), undefined);
  const tabs = visiblePhases.map((item) => ({
    ...item,
    disabled: !canOpenRaceWeekendPhase(item.id, unlockedPhase, isMinPackage),
    disabledReason: `Complete ${phaseTitle} before opening this stage`,
  }));

  const advanceFromCurrent = () => {
    if (phase === 'hub') moveTo('briefing');
    else if (phase === 'briefing') moveTo(isMinPackage ? 'quali-run' : 'practice');
    else if (phase === 'practice') moveTo('setup');
    else if (phase === 'setup') {
      commitSetups();
      moveTo(qualifyingResults ? 'race-strategy' : 'quali-run');
    } else if (phase === 'quali-run') runQualifying();
    else if (phase === 'quali-review') moveTo(isMinPackage ? 'race-strategy' : 'setup');
    else if (phase === 'race-strategy') moveTo('race-instructions');
    else startLiveRace();
  };
  const advanceLabel = phase === 'hub' ? 'Open Briefing'
    : phase === 'briefing' ? (isMinPackage ? 'Prepare Qualifying' : 'Open Practice')
      : phase === 'practice' ? 'Open Car Setup'
        : phase === 'setup' ? (qualifyingResults ? 'Choose Strategy' : 'Plan Qualifying')
          : phase === 'quali-run' ? 'Simulate Qualifying'
            : phase === 'quali-review' ? (isMinPackage ? 'Choose Strategy' : 'Finalise Setup')
              : phase === 'race-strategy' ? 'Set Instructions'
                : 'Start Live Race';
  const phaseContent = (
    <>
      {phase === 'hub' && forecast && (
        <WeekendHub
          state={state}
          race={race}
          track={track}
          forecast={forecast}
          onNext={() => moveTo('briefing')}
        />
      )}

      {phase === 'briefing' && (
        <Briefing track={track} race={race} isMinPackage={isMinPackage} onNext={() => moveTo(isMinPackage ? 'quali-run' : 'practice')} />
      )}

      {phase === 'practice' && !isMinPackage && (
        <PracticePhase
          state={state}
          dispatch={dispatch}
          track={track}
          forecast={forecast}
          onBack={() => moveTo('briefing')}
          onNext={() => moveTo('setup')}
        />
      )}

      {phase === 'setup' && !isMinPackage && (
        <SetupWorkshop
          track={track}
          drivers={playerDrivers}
          setups={resolvedSetups}
          car={carForTeam(state, state.selectedTeamId)}
          practice={workshopPractice}
          onChangeParam={(driverId, key, value) =>
            setSetupDraft((p) => ({
              ...p,
              [driverId]: sanitizeSetupProfile({ ...resolvedSetups[driverId], [key]: value }),
            }))
          }
          onApplySetup={(driverId, setup) =>
            setSetupDraft((p) => ({ ...p, [driverId]: sanitizeSetupProfile(setup) }))
          }
          onCopy={(fromId, toId) =>
            setSetupDraft((p) => ({ ...p, [toId]: sanitizeSetupProfile(resolvedSetups[fromId]) }))
          }
          onResetDriver={(driverId) => {
            const practiced = workshopPractice?.practicedSetupByDriver?.[driverId];
            if (practiced) setSetupDraft((p) => ({ ...p, [driverId]: sanitizeSetupProfile(practiced) }));
          }}
          onBack={() => { commitSetups(); moveTo(qualifyingResults ? 'quali-review' : 'practice'); }}
          onConfirm={() => { commitSetups(); moveTo(qualifyingResults ? 'race-strategy' : 'quali-run'); }}
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
          recommendedId={recommendedQualiRunPlan(track, forecast?.Qualifying).optionId}
          recommendedReason={recommendedQualiRunPlan(track, forecast?.Qualifying).reason}
          headerExtra={
            <QualifyingSessionInfo
              format={qualifyingFormatFor(state.seasonYear, state.series)}
              weather={forecast?.Qualifying}
            />
          }
          extraControls={(driverId) => (
            <QualifyingRunControls
              decision={qualiFor(driverId)}
              onRuns={(runs) =>
                setQualiOverrides((p) => ({ ...p, [driverId]: { ...p[driverId], runs } }))
              }
              onTyre={(tyreApproach) =>
                setQualiOverrides((p) => ({ ...p, [driverId]: { ...p[driverId], tyreApproach } }))
              }
            />
          )}
          onBack={() => moveTo(isMinPackage ? 'briefing' : 'setup')}
          onNext={runQualifying}
          nextLabel="Simulate Qualifying ->"
        />
      )}

      {phase === 'quali-review' && qualifyingResults && (
        <QualifyingReview
          state={state}
          raceId={race.id}
          debug={settings.debugMode}
          weather={forecast?.Qualifying}
          onNext={() => moveTo(isMinPackage ? 'race-strategy' : 'setup')}
        />
      )}

      {phase === 'race-strategy' && (
        <DecisionPhase
          title="Pre-Race Strategy Selection"
          subtitle="The grid is set. Pick a pit/tyre strategy for each driver - you can still adapt live during the race."
          drivers={playerDrivers}
          options={raceStrategies.map((s) => ({ id: s.id, name: s.name, description: s.description }))}
          valueFor={(id) => raceFor(id).strategyId}
          onSelect={(driverId, optId) =>
            setRaceOverrides((p) => ({ ...p, [driverId]: { ...p[driverId], strategyId: optId as RaceDecision['strategyId'] } }))
          }
          recommendedId={recommendedRaceStrategy(track, forecast?.Race).optionId}
          recommendedReason={recommendedRaceStrategy(track, forecast?.Race).reason}
          onBack={() => moveTo('quali-review')}
          onNext={() => moveTo('race-instructions')}
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
          onBack={() => moveTo('race-strategy')}
          onNext={startLiveRace}
          nextLabel="Start Live Race ->"
        />
      )}
    </>
  );

  return (
    <WorkspaceScreen className="era-feature-screen era-race-weekend">
      <WorkspaceHeader
        eyebrow="Race operations"
        title={race.gpName}
        subtitle={`${race.trackName} · Round ${race.round} of ${state.calendar.length} · ${phaseTitle}`}
        actions={<>
          <Button variant="ghost" onClick={() => navigate('/hq')}>Exit to HQ</Button>
          <Button variant="primary" onClick={advanceFromCurrent}>{advanceLabel} →</Button>
        </>}
      />

      <MetricStrip>
        <WorkspaceMetric label="Weekend stage" value={`${raceWeekendPhaseIndex(phase, isMinPackage) + 1}/${visiblePhases.length}`} detail={phaseTitle} />
        <WorkspaceMetric label="Practice" value={isMinPackage ? 'Package skip' : `${completedPracticeSessions}/${totalPracticeSessions}`} detail={isMinPackage ? 'Baseline setup enforced' : 'Sessions completed'} />
        <WorkspaceMetric label="Qualifying" value={qualifyingResults ? 'Complete' : 'Pending'} detail={bestPlayerGrid ? `Best player car P${bestPlayerGrid}` : 'Grid not set'} />
        <WorkspaceMetric label="Race gate" value={phase === 'race-instructions' ? 'Ready' : 'In progress'} detail={state.raceWeekendPackage?.packageType ?? 'No package'} />
      </MetricStrip>

      <WorkspaceTabs
        items={tabs}
        active={phase}
        onChange={(next) => {
          if (canOpenRaceWeekendPhase(next, unlockedPhase, isMinPackage)) moveTo(next);
        }}
        ariaLabel="Race weekend stages"
      />

      {forecast && phase !== 'hub' && (
        <div className="shrink-0">
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
        </div>
      )}

      <WorkspaceBody className={fullHeightPhase ? 'flex flex-col' : 'space-y-4'}>
        {phaseContent}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function Briefing({ track, race, isMinPackage, onNext }: { track: Track; race: { laps: number; distanceKm?: number; gpName: string }; isMinPackage: boolean; onNext: () => void }) {
  const strategicNotes = briefingStrategicNotes(track);
  const ratingNotes = briefingRatingNotes(track);
  const nextLabel = isMinPackage ? 'Begin Qualifying Prep ->' : 'Begin Practice Prep ->';
  return (
    <Panel
      title="Track Briefing"
      actions={<Button variant="primary" onClick={onNext}>{nextLabel}</Button>}
    >
      {isMinPackage && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <span className="font-bold">Minimum Operations Package:</span> Practice sessions and car setup changes are disabled. The team will run with the baseline setup and no practice data.
        </div>
      )}
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
        <InfoBox label="Strategic Notes" text={strategicNotes} />
        <InfoBox label="Rating Notes" text={ratingNotes} />
      </div>
    </Panel>
  );
}

function briefingStrategicNotes(track: Track): string {
  if (track.setupProfile.strategyNotes?.trim()) return track.setupProfile.strategyNotes;

  const demands = track.setupProfile;
  const tyrePressure = demands.riskDemand >= 7
    ? 'High incident risk makes clean air and conservative stint timing valuable.'
    : 'Risk is manageable, so strategy can lean into pace if the tyres stay stable.';
  const aeroRead = demands.aeroDemand >= demands.powerDemand
    ? 'Aero balance and braking stability should drive the setup plan.'
    : 'Straight-line efficiency and power delivery should drive the setup plan.';

  return `${aeroRead} ${tyrePressure}`;
}

function briefingRatingNotes(track: Track): string {
  if (track.ratingNotes?.trim()) return track.ratingNotes;

  const demands = track.setupProfile;
  const strongest = [
    ['Aero', demands.aeroDemand],
    ['Power', demands.powerDemand],
    ['Mechanical', demands.mechanicalDemand],
    ['Risk', demands.riskDemand],
  ].sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] ?? 'Balance';

  return `${strongest} demand is the main performance read here. Expect driver confidence, car balance and reliability preparation to matter more as practice data improves.`;
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
  track,
  forecast,
  onBack,
  onNext,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  dispatch: ReturnType<typeof useGame>['dispatch'];
  track: Track;
  forecast?: WeekendForecast;
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

  const lapBudget = practiceLapBudget(state.seasonYear, state.series, players.length);
  const lapsUsed = wp?.lapsUsed ?? 0;
  const lapsRemaining = Math.max(0, lapBudget - lapsUsed);

  const gaps = useMemo(
    () => teamKnowledgeGaps(wp?.knowledge, players.map((d) => d.id)),
    [wp, players],
  );

  // The forecast session whose conditions are most relevant to a practice kind.
  const weatherForKind = (kind: PracticeSessionKind) => {
    if (!forecast) return undefined;
    if (kind === 'QualifyingPrep' || kind === 'Practice3') return forecast.Qualifying;
    if (kind === 'Warmup' || kind === 'RaceSimulation') return forecast.Race;
    return forecast.Practice;
  };

  // Local per-session program selections, defaulted to a sensible spread.
  const [assignments, setAssignments] = useState<Record<string, Record<string, PracticeProgram>>>(
    () => {
      const init: Record<string, Record<string, PracticeProgram>> = {};
      for (const k of kinds) {
        const rec = recommendedPracticeProgram(k, track, weatherForKind(k), gaps);
        init[k] = {};
        for (const d of players) init[k][d.id] = rec.program;
      }
      return init;
    },
  );

  const setProgram = (kind: string, driverId: string, program: PracticeProgram) =>
    setAssignments((prev) => ({ ...prev, [kind]: { ...prev[kind], [driverId]: program } }));

  const applyEngineerPlanToRemaining = () => {
    setAssignments((prev) => {
      const next = { ...prev };
      for (const kind of kinds) {
        if (completedByKind[kind]) continue;
        const rec = recommendedPracticeProgram(kind, track, weatherForKind(kind), gaps);
        next[kind] = { ...(next[kind] ?? {}) };
        for (const d of players) next[kind][d.id] = rec.program;
      }
      return next;
    });
  };

  // Which practice session tab is open. Sessions live in their own tab so the
  // player never scrolls through a long stack of P1/P2/Warmup sections.
  const [activeKind, setActiveKind] = useState<PracticeSessionKind>(kinds[0]);
  const [recentKind, setRecentKind] = useState<PracticeSessionKind | null>(null);

  const runSession = (kind: PracticeSessionKind) => {
    const sel = assignments[kind] ?? {};
    const list: PracticeAssignment[] = players.map((d) => {
      const program = sel[d.id] ?? 'SetupExploration';
      return { driverId: d.id, program, lapsPlanned: PROGRAM_META[program].defaultLaps };
    });
    dispatch({ type: 'RUN_PRACTICE_SESSION', raceId: race.id, kind, assignments: list });
    setRecentKind(kind);
    const nextKind = kinds.slice(kinds.indexOf(kind) + 1).find((k) => !completedByKind[k]);
    if (nextKind) setActiveKind(nextKind);
  };

  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const driverNumber = (id: string) => state.drivers.find((d) => d.id === id)?.number ?? '';

  const allRun = kinds.every((k) => completedByKind[k]);

  const k = wp?.knowledge;
  const active = activeKind;
  const activeDone = completedByKind[active];
  const activeRec = recommendedPracticeProgram(active, track, weatherForKind(active), gaps);
  const activeSel = assignments[active] ?? {};
  const activeCost = sessionLapCost(
    players.map((d) => ({
      driverId: d.id,
      program: activeSel[d.id] ?? 'SetupExploration',
      lapsPlanned: PROGRAM_META[activeSel[d.id] ?? 'SetupExploration'].defaultLaps,
    })),
  );
  const activeOverBudget = activeCost > lapsRemaining;
  const averageKnowledge = (source?: Record<string, number>) => {
    if (players.length === 0) return 0;
    const total = players.reduce((sum, d) => sum + (source?.[d.id] ?? 0), 0);
    return Math.round((total / players.length) * 100);
  };
  const setupKnowledgePct = averageKnowledge(k?.setupKnowledge);
  const tyreKnowledgePct = averageKnowledge(k?.tireKnowledge);
  const reliabilityKnowledgePct = averageKnowledge(k?.reliabilityKnowledge);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-testid="practice-screen">
      {/* Garage strip: session identity + lap-allocation (data-acquisition) meter. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-gradient-to-r from-neutral-900/80 to-neutral-900/30 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-amber-500">▦</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-100">Garage · Practice Session</h2>
            <p className="text-[11px] text-neutral-400">Gathering setup, tyre &amp; reliability data on track.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            <PracticeKnowledgeChip label="Setup" value={setupKnowledgePct} />
            <PracticeKnowledgeChip label="Tyres" value={tyreKnowledgePct} />
            <PracticeKnowledgeChip label="Reliability" value={reliabilityKnowledgePct} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">Lap allocation</span>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full"
                style={{
                  width: `${lapBudget > 0 ? (lapsUsed / lapBudget) * 100 : 0}%`,
                  backgroundColor: lapsRemaining <= 0 ? '#ef4444' : ratingColor(Math.max(0, 100 - (lapsUsed / lapBudget) * 100)),
                }}
              />
            </div>
            <span className={`text-sm font-semibold ${lapsRemaining <= 0 ? 'text-red-400' : 'text-neutral-100'}`}>
              {lapsRemaining}
            </span>
            <span className="text-xs text-neutral-500">/ {lapBudget} laps</span>
          </div>
          <Button variant="primary" onClick={onNext} className="px-3 py-1.5 text-xs">
            Car Setup
          </Button>
        </div>
      </div>

      {/* Weekend knowledge dashboard — both drivers, compact, always visible. */}
      <div className="hidden shrink-0 gap-2 sm:grid-cols-2">
        {players.map((d) => {
          const conf = state.drivers.find((x) => x.id === d.id)?.confidence ?? d.confidence;
          const delta = k?.confidenceDelta[d.id] ?? 0;
          return (
            <div key={d.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-100">
                  #{driverNumber(d.id)} {driverName(d.id)}
                </span>
                <span className="text-[10px] text-neutral-400">
                  Conf {conf}
                  {delta ? (
                    <span className={delta > 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {' '}({delta > 0 ? '+' : ''}{delta.toFixed(1)})
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <MiniGauge label="Setup" value={k?.setupKnowledge[d.id] ?? 0} />
                <MiniGauge label="Tyres" value={k?.tireKnowledge[d.id] ?? 0} />
                <MiniGauge label="Reliab." value={k?.reliabilityKnowledge[d.id] ?? 0} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Session tabs (P1/P2/Warmup) with status badges. */}
      <div className="flex shrink-0 gap-1 rounded-lg border border-neutral-800 bg-neutral-900/40 p-1" role="tablist">
        {kinds.map((kind) => {
          const isActive = kind === active;
          const status = completedByKind[kind] ? 'Complete' : 'Not Run';
          return (
            <button
              key={kind}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveKind(kind)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-100'
              }`}
            >
              {SESSION_LABELS[kind]}
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${
                  completedByKind[kind]
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {status}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active session — the only scrolling region. */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900/20 p-3" role="tabpanel">
        {activeDone ? (
          <div className="space-y-2">
            {(activeDone.results ?? []).map((r) => (
              <PracticeResultCard
                key={r.driverId}
                r={r}
                name={`#${driverNumber(r.driverId)} ${driverName(r.driverId)}`}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300">
              <span>
                <span className="font-semibold">Engineer recommends {PROGRAM_LABELS[activeRec.program]}:</span>{' '}
                {activeRec.reason}
              </span>
              <button
                className="rounded border border-green-500/40 px-2 py-0.5 font-semibold text-green-200 hover:bg-green-500/20"
                onClick={applyEngineerPlanToRemaining}
              >
                Use for all remaining practices
              </button>
            </div>
            {players.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2">
                <span className="text-sm text-neutral-200">
                  #{driverNumber(d.id)} {driverName(d.id)}
                </span>
                <select
                  className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
                  value={activeSel[d.id] ?? 'SetupExploration'}
                  onChange={(e) => setProgram(active, d.id, e.target.value as PracticeProgram)}
                >
                  {ALL_PROGRAMS.map((p) => (
                    <option key={p} value={p}>
                      {PROGRAM_LABELS[p]}
                      {p === activeRec.program ? ' (recommended)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {recentKind && completedByKind[recentKind] && recentKind !== active && (
              <div className="hidden rounded-md border border-amber-500/25 bg-amber-500/10 p-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  {SESSION_LABELS[recentKind]} feedback carried forward
                </div>
                <div className="space-y-1">
                  {(completedByKind[recentKind].results ?? []).map((r) => (
                    <PracticeResultCard
                      key={r.driverId}
                      r={r}
                      name={`#${driverNumber(r.driverId)} ${driverName(r.driverId)}`}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <span className={`text-xs ${activeOverBudget ? 'text-red-400' : 'text-neutral-500'}`}>
                {activeCost} laps {activeOverBudget ? `· over budget (${lapsRemaining} left)` : `· ${lapsRemaining} left`}
              </span>
              <Button variant="primary" disabled={activeOverBudget} onClick={() => runSession(active)}>
                Run {SESSION_LABELS[active]}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Fixed action bar — always visible, no page scroll needed. */}
      <div className="flex shrink-0 justify-between border-t border-neutral-800 pt-3">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button variant="primary" onClick={onNext}>
          {allRun ? 'Car Setup →' : 'Skip to Car Setup →'}
        </Button>
      </div>
    </div>
  );
}

// A compact, telemetry-style result card for one driver's practice run: the
// knowledge gains, confidence change, feedback quotes and any incident warning.
function PracticeResultCard({ r, name, compact = false }: { r: PracticeRunResult; name: string; compact?: boolean }) {
  const pct = (v: number) => `+${Math.round(v * 100)}%`;
  return (
    <div className={`rounded-lg border border-neutral-800 bg-neutral-900/50 ${compact ? 'p-2' : 'p-3'}`}>
      <div className={`${compact ? 'mb-1 text-xs' : 'mb-2 text-sm'} flex items-center justify-between`}>
        <span className="font-semibold text-neutral-100">{name}</span>
        <span className="text-xs text-neutral-400">
          {PROGRAM_LABELS[r.program]} · {r.lapsCompleted} laps
          {r.incident ? <span className="text-red-400"> · incident</span> : ''}
        </span>
      </div>
      <div className={`${compact ? 'mb-1 gap-1' : 'mb-2 gap-1.5'} grid grid-cols-4 text-center`}>
        <GainChip label="Setup" value={pct(r.setupKnowledgeGain)} on={r.setupKnowledgeGain > 0} />
        <GainChip label="Tyres" value={pct(r.tireKnowledgeGain)} on={r.tireKnowledgeGain > 0} />
        <GainChip label="Reliab." value={pct(r.reliabilityKnowledgeGain)} on={r.reliabilityKnowledgeGain > 0} />
        <GainChip
          label="Conf."
          value={`${r.confidenceGain >= 0 ? '+' : ''}${r.confidenceGain.toFixed(1)}`}
          on={r.confidenceGain > 0}
        />
      </div>
      <ul className={`space-y-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>
        {r.feedback.slice(0, compact ? 2 : undefined).map((f) => (
          <li key={f.id} className={SENTIMENT_STYLE[f.sentiment]}>
            • {f.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GainChip({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <div className={`rounded border px-1.5 py-1 ${on ? 'border-sky-500/30 bg-sky-500/10' : 'border-neutral-800 bg-neutral-900/40'}`}>
      <div className="text-[9px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`text-xs font-semibold ${on ? 'text-sky-300' : 'text-neutral-500'}`}>{value}</div>
    </div>
  );
}

function MiniGauge({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = ratingColor(pct);
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900/40 px-2 py-1">
      <div className="mb-0.5 flex items-center justify-between text-[9px] uppercase tracking-wide text-neutral-500">
        <span>{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-neutral-800">
        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function PracticeKnowledgeChip({ label, value }: { label: string; value: number }) {
  const color = ratingColor(value);
  return (
    <div className="rounded border border-neutral-700 bg-neutral-950/50 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-xs font-semibold tabular-nums" style={{ color }}>{value}%</div>
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
  headerExtra,
  extraControls,
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
  headerExtra?: ReactNode;
  extraControls?: (driverId: string) => ReactNode;
}) {
  const recommendedName = options.find((o) => o.id === recommendedId)?.name;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/35 p-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
          <p className="text-sm text-neutral-400">{subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={onBack} className="px-3 py-1.5 text-xs">Back</Button>
          <Button variant="primary" onClick={onNext} className="px-3 py-1.5 text-xs">{nextLabel}</Button>
        </div>
        {recommendedName && recommendedReason && (
          <p className="basis-full rounded-md border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs text-green-300">
            <span className="font-semibold">Engineer recommends {recommendedName}:</span> {recommendedReason}
          </p>
        )}
        {headerExtra && <div className="basis-full">{headerExtra}</div>}
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
              {extraControls?.(d.id)}
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

function QualifyingSessionInfo({
  format,
  weather,
}: {
  format: QualifyingFormat;
  weather?: WeatherState;
}) {
  const wet = weather?.wet || weather?.changingSoon;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
      <span className="inline-flex items-center gap-1 rounded border border-neutral-700 bg-neutral-800/60 px-2 py-0.5">
        Format:{' '}
        <span className="font-semibold text-neutral-200">
          {format === 'Knockout' ? 'Knockout (Q1 / Q2 / Q3)' : 'Single session'}
        </span>
      </span>
      {weather && (
        <span className="inline-flex items-center gap-1">
          Conditions: <WeatherChip weather={weather} />
        </span>
      )}
      {wet && (
        <span className="text-blue-300">
          Wet/changeable — rewards driver skill; Wet-Weather Prep practice pays off.
        </span>
      )}
    </div>
  );
}

function QualifyingRunControls({
  decision,
  onRuns,
  onTyre,
}: {
  decision: QualifyingDecision;
  onRuns: (runs: number) => void;
  onTyre: (tyreApproach: NonNullable<QualifyingDecision['tyreApproach']>) => void;
}) {
  const runs = decision.runs ?? 1;
  const tyre = decision.tyreApproach ?? 'Standard';
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-neutral-400">Timed runs</span>
        <div className="flex gap-1">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => onRuns(n)}
              className={`h-7 w-7 rounded border text-xs font-semibold transition-colors ${
                runs === n
                  ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                  : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-neutral-400">Tyre approach</span>
        <div className="flex gap-1">
          {(['Standard', 'Conserve'] as const).map((t) => (
            <button
              key={t}
              onClick={() => onTyre(t)}
              className={`rounded border px-2 py-1 text-xs font-medium transition-colors ${
                tyre === t
                  ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                  : 'border-neutral-700 text-neutral-300 hover:border-neutral-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] leading-tight text-neutral-500">
        More runs find pace but raise incident risk and tyre wear. Conserve protects tyres for the
        race at a small pace cost.
      </p>
    </div>
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

const SEGMENT_BADGE: Record<string, string> = {
  Q3: 'bg-amber-500/20 text-amber-300',
  Q2: 'bg-neutral-500/20 text-neutral-300',
  Q1: 'bg-neutral-700/40 text-neutral-400',
};

function QualifyingReview({
  state,
  raceId,
  debug,
  weather,
  onNext,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  raceId: string;
  debug: boolean;
  weather?: WeatherState;
  onNext: () => void;
}) {
  const results = state.qualifyingResults[raceId] ?? [];
  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color ?? '#666';
  const isPlayer = (teamId: string) => teamId === state.selectedTeamId;

  const dnqCount = results.filter((r) => r.dnq).length;
  const knockout = results.some((r) => r.segment && r.segment !== 'Single');

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/35 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-100">Qualifying Review</h2>
          {knockout && (
            <span className="rounded border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-xs text-neutral-300">
              Knockout · Q1 / Q2 / Q3
            </span>
          )}
          {weather && <WeatherChip weather={weather} />}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-neutral-400">Review the grid, then choose your race strategy in response.</p>
          <Button variant="primary" onClick={onNext} className="px-3 py-1.5 text-xs">Choose Race Strategy</Button>
        </div>
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
              {knockout && <th className="px-3 py-2">Out</th>}
              <th className="px-3 py-2">Run Plan</th>
              <th className="px-3 py-2">Notes</th>
              {debug && <th className="px-3 py-2">Score</th>}
            </tr>
          </thead>
          <tbody>
            {results.map((r, idx) => {
              const bd = lastBreakdowns.qualifying[r.driverId];
              const firstDnq = r.dnq && !results[idx - 1]?.dnq;
              // Divider when the knockout segment changes (Q3 -> Q2 -> Q1).
              const segmentBreak =
                knockout && idx > 0 && r.segment !== results[idx - 1]?.segment;
              return (
                <tr
                  key={r.driverId}
                  className={`border-t ${
                    firstDnq || segmentBreak ? 'border-neutral-600' : 'border-neutral-800/60'
                  } ${firstDnq ? 'border-red-600/70' : ''} ${
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
                  {knockout && (
                    <td className="px-3 py-1.5">
                      {r.segment && r.segment !== 'Single' && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            SEGMENT_BADGE[r.segment] ?? ''
                          }`}
                        >
                          {r.segment}
                        </span>
                      )}
                    </td>
                  )}
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
