import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { activeDriversForTeam } from '../game/careerState';
import { buildLiveRaceMeta, buildLiveRaceOptions, buildRaceContext } from '../game/raceSetup';
import { createLiveRace, finalizeResults } from '../sim/liveRaceEngine';
import {
  applyRecommendationAction,
  cancelPlayerPitRequest,
  expireRecommendation,
  ignoreRecommendation,
  requestPlayerPit,
  resolvePrompt,
  resolveRecommendationExternally,
  setPlayerPaceMode,
  stepLiveRaceToEnd,
  stepLiveSector,
} from '../sim/raceTickEngine';
import { requiresDecision, DECISION_COUNTDOWN_SECONDS } from '../sim/analyticsEngine';
import { buildAnalyticsMonitor } from '../sim/analyticsMonitor';
import { orderCardsBySeat } from '../sim/liveRaceCardOrder';
import { applyTeamOrderToLive, recordTeamOrder, TEAM_ORDER_SPECS } from '../sim/relationshipEngine';
import { Button } from '../components/Button';
import { getCarDamagePercent } from '../components/raceMarkerAssets';
import type { TrackDot } from '../components/RaceTrack2D';
import type { AnalyticsRecommendation, LiveRaceState, PaceMode, PitIntensity, RecAction } from '../types/liveTypes';
import type { RaceResult } from '../types/gameTypes';
import type { RaceDecision } from '../types/simTypes';
import type { TeamOrder, TeamOrderDecision } from '../types/relationshipTypes';
import { TopStatusBar } from './liveRace/TopStatusBar';
import { TimingTower } from './liveRace/TimingTower';
import { TrackMapPanel } from './liveRace/TrackMapPanel';
import { EventLogPanel } from './liveRace/EventLogPanel';
import { PitWallCard } from './liveRace/PitWallCard';
import { RecommendationsPanel } from './liveRace/RecommendationsPanel';
import { BottomRow } from './liveRace/BottomPanels';
import { buildForecast } from './liveRace/forecast';
import { FullEventLogModal, StrategyModal, TeamOrdersModal } from './liveRace/modals';
import { F11990sLiveRaceScreen } from './liveRace/eraThemes/F11990sLiveRaceScreen';
import { getLiveRaceEraTheme, shouldUseF11990sLiveRaceScreen } from './liveRace/eraThemes/getLiveRaceEraTheme';
import { CrashZoomOverlay } from './liveRace/CrashZoomOverlay';

type Speed = 1 | 5 | 15 | 30;

type DnfAlert = {
  lap: number;
  entries: Array<{ driverId: string; cause: string; isPlayer?: boolean }>;
};

export function LiveRace() {
  const { raceId } = useParams();
  const { state, dispatch, settings } = useGame();
  const navigate = useNavigate();
  const location = useLocation();

  // Build the deterministic live-race engine once on mount.
  const [engine] = useState(() => {
    if (!state) return null;
    const navState = location.state as { decisions?: RaceDecision[] } | null;
    const decisions = navState?.decisions ?? [];
    const built = buildRaceContext(state, decisions);
    if (!built) return null;
    const meta = buildLiveRaceMeta(state, built.track);
    const options = buildLiveRaceOptions(state, built.context, built.raceId, built.totalLaps, {
      damageSettings: {
        damageFrequency: settings.damageFrequency,
        damageSeverity: settings.damageSeverity,
        repairTimeMultiplier: settings.repairTimeMultiplier,
        reliabilityStrictness: settings.reliabilityStrictness,
      },
      teamOrgRatings: state.teamOrgRatings,
    });
    return { context: built.context, meta, initial: createLiveRace(built.context, options) };
  });

  const [live, setLive] = useState<LiveRaceState | null>(() => engine?.initial ?? null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [trackAnimationTick, setTrackAnimationTick] = useState(0);
  const [modal, setModal] = useState<'log' | 'strategy' | 'orders' | null>(null);
  const [ordersFocusDriverId, setOrdersFocusDriverId] = useState<string | null>(null);
  const [podium, setPodium] = useState<PodiumSnapshot | null>(null);
  const [dnfAlert, setDnfAlert] = useState<DnfAlert | null>(null);
  const [aiDnfFlash, setAiDnfFlash] = useState<DnfAlert | null>(null);
  const [decisionSecondsLeft, setDecisionSecondsLeft] = useState<number | null>(null);
  const dismissCrash = useCallback(
    () => setLive((s) => (s ? { ...s, lastIncident: undefined } : s)),
    [],
  );
  const committed = useRef(false);
  // Team orders called during the race, resolved into relationships at the flag.
  const teamOrders = useRef<TeamOrderDecision[]>([]);
  const blockingPrompt = !!live?.pendingPrompt && !live?.safetyCar.active;

  // Fixed team-order for the player's drivers (seat #1 first, #2 second). The
  // right-side pit-wall cards keep this order for the whole race so they do not
  // jump around as track positions swap — only the numbers inside update.
  const seatOrderIds = useMemo(
    () => (state ? activeDriversForTeam(state, state.selectedTeamId).map((d) => d.id) : []),
    [state],
  );

  // Recommendations that pause the race and run a decision countdown.
  const decisionRecs = live ? live.recommendations.filter((r) => requiresDecision(r)) : [];
  const needsDecision = !!live && live.phase !== 'finished' && decisionRecs.length > 0;
  // Stable key so the countdown resets only when the pending decision set changes.
  const decisionKey = decisionRecs
    .map((r) => r.id)
    .sort()
    .join(',');

  const advanceLiveSector = useCallback(
    (s: LiveRaceState): LiveRaceState => {
      const next = stepLiveSector(s, engine!.meta);
      const alert = dnfAlertFromTransition(s, next);
      if (alert) {
        const playerEntries = alert.entries.filter((entry) => entry.isPlayer);
        const aiEntries = alert.entries.filter((entry) => !entry.isPlayer);
        if (playerEntries.length > 0) {
          setPlaying(false);
          setDnfAlert({ lap: alert.lap, entries: playerEntries });
        }
        if (aiEntries.length > 0) {
          setAiDnfFlash({ lap: alert.lap, entries: aiEntries });
        }
      }
      return next;
    },
    [engine],
  );

  // Playback loop — steps a sector on an interval while playing, paused on prompts
  // or while a high/urgent recommendation is awaiting a decision.
  useEffect(() => {
    if (!engine || !live) return;
    if (!playing || dnfAlert || blockingPrompt || live.phase === 'finished' || needsDecision) return;
    const useRealLapPacing = shouldUseF11990sLiveRaceScreen(state?.series, state?.seasonYear);
    const leaderForPacing = live.cars.find((c) => c.position === 1 && c.running);
    const liveLapTime =
      leaderForPacing?.lastLapTime && leaderForPacing.lastLapTime > 0
        ? leaderForPacing.lastLapTime
        : leaderForPacing?.bestLap && leaderForPacing.bestLap > 0
          ? leaderForPacing.bestLap
          : 85;
    const intervalMs = useRealLapPacing
      ? Math.max(15_000, Math.min(120_000, liveLapTime * 1000)) / speed / 3
      : 950 / speed / 3;
    const id = setInterval(() => {
      setLive((s) => (s && (!s.pendingPrompt || s.safetyCar.active) && s.phase !== 'finished' ? advanceLiveSector(s) : s));
    }, intervalMs);
    return () => clearInterval(id);
  }, [advanceLiveSector, engine, live, playing, speed, needsDecision, dnfAlert, blockingPrompt, state?.series, state?.seasonYear]);

  // Reset the intra-sector animation whenever a new sector begins.
  useEffect(() => {
    const id = setTimeout(() => setTrackAnimationTick(0), 0);
    return () => clearTimeout(id);
  }, [live?.currentLap, live?.sector]);

  // Smoothly advance the sub-lap marker position for each of the three sectors.
  useEffect(() => {
    if (!engine || !live) return;
    if (!playing || blockingPrompt || live.phase === 'finished' || needsDecision) return;
    const useRealLapPacing = shouldUseF11990sLiveRaceScreen(state?.series, state?.seasonYear);
    const leaderForPacing = live.cars.find((c) => c.position === 1 && c.running);
    const liveLapTime =
      leaderForPacing?.lastLapTime && leaderForPacing.lastLapTime > 0
        ? leaderForPacing.lastLapTime
        : leaderForPacing?.bestLap && leaderForPacing.bestLap > 0
          ? leaderForPacing.bestLap
          : 85;
    const intervalMs = useRealLapPacing
      ? Math.max(15_000, Math.min(120_000, liveLapTime * 1000)) / speed / 3
      : 950 / speed / 3;
    const id = setInterval(() => setTrackAnimationTick((tick) => tick + 1), Math.max(80, intervalMs / 12));
    return () => clearInterval(id);
  }, [engine, live, playing, speed, needsDecision, dnfAlert, blockingPrompt, state?.series, state?.seasonYear]);

  useEffect(() => {
    if (!aiDnfFlash) return;
    const id = setTimeout(() => setAiDnfFlash(null), 8000);
    return () => clearTimeout(id);
  }, [aiDnfFlash]);

  // Decision countdown: while a high/urgent decision is pending, tick a ~10s
  // clock and, on timeout, auto-expire (ignore) the outstanding recommendations
  // so the race resumes. The deadline lives in a ref and every state write
  // happens inside the interval callback (never synchronously in the effect).
  useEffect(() => {
    if (!decisionKey || !engine) return;
    const deadline = Date.now() + DECISION_COUNTDOWN_SECONDS * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (left <= 0) {
        setLive((s) =>
          s
            ? s.recommendations
                .filter((r) => requiresDecision(r))
                .reduce((acc, r) => expireRecommendation(acc, r.id, engine.meta), s)
            : s,
        );
      } else {
        setDecisionSecondsLeft(left);
      }
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [decisionKey, engine]);

  if (!state || !engine || !live) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#0a0e17] text-slate-300">
        <p className="text-sm">No live race in progress.</p>
        <Button variant="primary" onClick={() => navigate('/weekend')}>
          Back to Weekend
        </Button>
      </div>
    );
  }

  const race = state.calendar.find((r) => r.id === raceId);
  const team = state.teams.find((t) => t.id === state.selectedTeamId);
  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const driverNumber = (id: string) => state.drivers.find((d) => d.id === id)?.number ?? '';
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color ?? '#888';

  const step = () => setLive((s) => (s && (!s.pendingPrompt || s.safetyCar.active) ? advanceLiveSector(s) : s));
  const skipToEnd = () => {
    setPlaying(false);
    setLive((s) => (s ? stepLiveRaceToEnd(s, engine.meta) : s));
  };
  const chooseOption = (optionId: string) =>
    setLive((s) => (s ? resolvePrompt(s, optionId, engine.meta) : s));
  const pitNow = (driverId: string, decision?: { intensity?: PitIntensity; exitMode?: PaceMode }) =>
    setLive((s) => {
      if (!s) return s;
      const car = s.cars.find((c) => c.driverId === driverId);
      return car?.pit.pitRequested
        ? cancelPlayerPitRequest(s, driverId)
        : requestPlayerPit(s, driverId, decision);
    });
  const setMode = (driverId: string, mode: PaceMode) =>
    setLive((s) => (s ? setPlayerPaceMode(s, driverId, mode) : s));

  // Apply a team order to the live state and record it for post-race resolution.
  const applyOrder = (s: LiveRaceState | null, order: TeamOrder, favoredDriverId?: string): LiveRaceState | null => {
    if (!s) return s;
    const label = teamOrderLabel(order);
    const favoredName = favoredDriverId ? driverName(favoredDriverId) : undefined;
    const receivedEvent = {
      lap: s.currentLap,
      text: `Team order received: ${label}${favoredName ? ` for ${favoredName}` : ''}.`,
    };
    const applied = applyTeamOrderToLive(s, order, favoredDriverId, driverName);
    if (!applied) {
      return {
        ...s,
        events: [
          ...s.events,
          receivedEvent,
          {
            lap: s.currentLap,
            text: `Team order not carried out: ${label} unavailable with the current cars/order.`,
          },
        ],
      };
    }
    const activeIds = s.cars.filter((c) => c.isPlayer).map((c) => c.driverId);
    teamOrders.current.push(recordTeamOrder(s.raceId, order, favoredDriverId, activeIds, s.currentLap));
    return {
      ...applied.state,
      events: [
        ...s.events,
        receivedEvent,
        ...applied.state.events.slice(s.events.length),
        { lap: s.currentLap, text: `Team order completed: ${applied.note}` },
      ],
    };
  };

  const issueOrder = (order: TeamOrder, favoredDriverId?: string) =>
    setLive((s) => applyOrder(s, order, favoredDriverId));

  // Resolve one recommendation with a concrete action. Mode/pit actions run
  // through the tick engine; team-order actions apply the on-track order via the
  // relationship engine, then remove + log the recommendation. Pure over state so
  // it can be folded across both player drivers for the group shortcuts.
  const resolveRec = (
    s: LiveRaceState,
    rec: AnalyticsRecommendation,
    action: RecAction,
    verb: 'accepted' | 'modified',
  ): LiveRaceState => {
    if (action.teamOrder) {
      const order: TeamOrder = action.teamOrder === 'SwapPositions' ? 'SwapPositions' : 'LetThemRace';
      const teammate = s.cars.find((c) => c.isPlayer && c.driverId !== rec.driverId && c.running)?.driverId;
      const withOrder = applyOrder(s, order, teammate) ?? s;
      return resolveRecommendationExternally(withOrder, rec.id, action.label, verb, engine.meta);
    }
    return applyRecommendationAction(s, rec.id, action, engine.meta, verb);
  };

  const onAccept = (rec: AnalyticsRecommendation, actionOverride?: RecAction) =>
    setLive((s) => (s ? resolveRec(s, rec, actionOverride ?? rec.action, 'accepted') : s));
  const onModify = (rec: AnalyticsRecommendation, action: RecAction) =>
    setLive((s) => (s ? resolveRec(s, rec, action, 'modified') : s));
  const onIgnore = (rec: AnalyticsRecommendation) =>
    setLive((s) => (s ? ignoreRecommendation(s, rec.id, engine.meta) : s));
  // "Let Crew Decide" defers to the analytics call — apply the recommended action.
  const onLetCrewDecide = (rec: AnalyticsRecommendation) =>
    setLive((s) => (s ? resolveRec(s, rec, rec.action, 'accepted') : s));

  const pendingRecs = (s: LiveRaceState) => s.recommendations.filter((r) => r.status === 'pending');
  // Group shortcuts for simultaneous decisions: each driver keeps its own
  // recommended action (Accept All) or has its recommendation dismissed (Ignore All).
  const onAcceptAll = () =>
    setLive((s) => (s ? pendingRecs(s).reduce((acc, r) => resolveRec(acc, r, r.action, 'accepted'), s) : s));
  const onIgnoreAll = () =>
    setLive((s) => (s ? pendingRecs(s).reduce((acc, r) => ignoreRecommendation(acc, r.id, engine.meta), s) : s));

  const finishRace = () => {
    if (podium) {
      setPodium(null);
      navigate(`/post-race/${raceId}`);
      return;
    }
    if (committed.current) {
      navigate(`/post-race/${raceId}`);
      return;
    }
    const { results, events, breakdowns } = finalizeResults(live, engine.context);
    committed.current = true;
    dispatch({ type: 'COMMIT_LIVE_RACE', results, events, breakdowns, teamOrders: teamOrders.current });
    const podiumSnapshot = buildPodiumSnapshot(results, state.selectedTeamId, driverName, teamColor);
    if (podiumSnapshot.hasPlayerDriver) {
      setPodium(podiumSnapshot);
      return;
    }
    navigate(`/post-race/${raceId}`);
  };

  const finished = live.phase === 'finished';
  const leader = live.cars.find((c) => c.position === 1 && c.running);
  const representativeLapTime =
    leader?.lastLapTime && leader.lastLapTime > 0
      ? leader.lastLapTime
      : leader?.bestLap && leader.bestLap > 0
        ? leader.bestLap
        : live.cars
              .filter((c) => c.running && c.lastLapTime > 0)
              .reduce((sum, c, _, cars) => sum + c.lastLapTime / cars.length, 0) || 85;
  const sectorProgress = Math.min(1, trackAnimationTick / 12);
  const rotation = ((live.currentLap + ((live.sector ?? 0) + sectorProgress) / 3) % 1 + 1) % 1;
  const dots: TrackDot[] = live.cars.map((c) => ({
    driverId: c.driverId,
    label: String(driverNumber(c.driverId) || ''),
    color: teamColor(c.teamId),
    accentColor: '#f7f7f7',
    series: state.series,
    isPlayer: c.isPlayer,
    running: c.running,
    retired: c.status === 'DNF' && !c.running,
    inPit: c.pit.inPitThisLap,
    pitRequested: c.pit.pitRequested,
    rank: c.position ?? 99,
    trackProgress: c.retiredTrackProgress ?? normalizeTrackProgress(rotation - c.gapToLeader / representativeLapTime),
    gapToLeader: c.gapToLeader,
    interval: c.interval,
    damagePercent: getCarDamagePercent(c),
  }));
  // Locked to team seat order (not live position) so the cards never reorder.
  const playerCars = orderCardsBySeat(
    live.cars.filter((c) => c.isPlayer),
    seatOrderIds,
  );
  const forecast = buildForecast(live, engine.context.track);
  const activeRecs = finished ? [] : live.recommendations;
  const monitor = buildAnalyticsMonitor(live, seatOrderIds);
  const useF11990sLiveRace = shouldUseF11990sLiveRaceScreen(state.series, state.seasonYear);
  const eraTheme = getLiveRaceEraTheme(state.series, state.seasonYear);

  const crashOverlay = live.lastIncident && (
    <CrashZoomOverlay
      dots={dots}
      lastIncident={live.lastIncident}
      safetyCar={live.safetyCar}
      series={state.series}
      year={state.seasonYear}
      trackId={race?.trackId ?? live.trackId}
      trackName={race?.trackName}
      nameOf={driverName}
      onDismiss={dismissCrash}
    />
  );

  const controls = (
    <div className="flex items-center gap-1.5">
      {!finished ? (
        <>
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={blockingPrompt || needsDecision || !!dnfAlert}
            className={`rounded px-3 py-1 text-xs font-bold ${
              playing ? 'bg-slate-700 text-slate-100' : 'bg-emerald-600 text-white'
            } disabled:opacity-40`}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button
            onClick={step}
            disabled={playing || blockingPrompt || needsDecision || !!dnfAlert}
            className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            +1
          </button>
          <div className="flex items-center gap-0.5">
            {([1, 5, 15, 30] as Speed[]).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-1.5 py-1 text-[10px] font-bold ${
                  speed === s ? 'bg-amber-500 text-neutral-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
          <button
            onClick={skipToEnd}
            disabled={blockingPrompt || needsDecision || !!dnfAlert}
            className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            ⏩
          </button>
          <button
            onClick={() => setModal('orders')}
            disabled={!playerCars.some((c) => c.running)}
            className="rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            Orders
          </button>
        </>
      ) : (
        <button
          onClick={finishRace}
          className="rounded bg-amber-500 px-3 py-1 text-xs font-bold text-neutral-950 hover:bg-amber-400"
        >
          Post-Race Report →
        </button>
      )}
    </div>
  );

  if (useF11990sLiveRace) {
    return (
      <>
        <F11990sLiveRaceScreen
          state={state}
          race={race}
          live={live}
          dots={dots}
          rotation={rotation}
          playerCars={playerCars}
          forecast={forecast}
          monitor={monitor}
          activeRecs={activeRecs}
          needsDecision={needsDecision}
          pausedByDnf={!!dnfAlert}
          aiDnfFlash={aiDnfFlash}
          decisionSecondsLeft={needsDecision ? decisionSecondsLeft ?? DECISION_COUNTDOWN_SECONDS : null}
          playing={playing}
          speed={speed}
          nameOf={driverName}
          teamNameOf={(teamId) => state.teams.find((t) => t.id === teamId)?.name ?? teamId}
          colorOf={teamColor}
          onTogglePlay={() => setPlaying((p) => !p)}
          onStep={step}
          onSpeed={setSpeed}
          onSkipToEnd={skipToEnd}
          onOpenOrders={(driverId) => {
            setOrdersFocusDriverId(driverId ?? null);
            setModal('orders');
          }}
          onOpenStrategy={() => setModal('strategy')}
          onOpenLog={() => setModal('log')}
          onExit={() => navigate('/hq')}
          onFinishRace={finishRace}
          onPit={pitNow}
          onMode={setMode}
          onAccept={onAccept}
          onModify={onModify}
          onIgnore={onIgnore}
          onLetCrewDecide={onLetCrewDecide}
          onAcceptAll={onAcceptAll}
          onIgnoreAll={onIgnoreAll}
          crashOverlay={crashOverlay}
        />

        {blockingPrompt && live.pendingPrompt && (
          <PromptOverlay
            title={live.pendingPrompt.title}
            driver={driverName(live.pendingPrompt.driverId)}
            description={live.pendingPrompt.description}
            options={live.pendingPrompt.options.map((o) => ({ id: o.id, label: o.label, detail: o.detail }))}
            onChoose={chooseOption}
          />
        )}
        {dnfAlert && <DnfOverlay alert={dnfAlert} nameOf={driverName} onClose={() => setDnfAlert(null)} />}
        {modal === 'log' && <FullEventLogModal events={live.events} onClose={() => setModal(null)} />}
        {modal === 'strategy' && (
          <StrategyModal
            playerCars={playerCars}
            currentLap={live.currentLap}
            finished={finished}
            nameOf={driverName}
            onPit={pitNow}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'orders' && (
          <TeamOrdersModal
            playerCars={playerCars}
            focusDriverId={ordersFocusDriverId ?? undefined}
            nameOf={driverName}
            onOrder={issueOrder}
            onClose={() => {
              setOrdersFocusDriverId(null);
              setModal(null);
            }}
          />
        )}
        {podium && <PodiumOverlay podium={podium} onContinue={finishRace} />}
      </>
    );
  }

  return (
    <div className="era-app era-live-race flex h-screen w-screen flex-col overflow-hidden bg-[#0a0e17] text-slate-200" data-era={eraTheme}>
      <TopStatusBar
        raceName={race?.gpName ?? 'Live Race'}
        trackName={race?.trackName ?? ''}
        live={live}
        fieldSize={live.cars.length}
        season={state.seasonYear}
        round={race?.round ?? state.currentRaceIndex + 1}
        roundTotal={state.calendar.length}
        budget={team?.budget ?? 0}
        controls={controls}
        onExit={() => navigate('/hq')}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[minmax(280px,0.95fr)_minmax(320px,1.15fr)_minmax(320px,1fr)]">
        {/* Left — timing tower */}
        <TimingTower cars={live.cars} nameOf={driverName} colorOf={teamColor} />

        {/* Center — large track map (fills) + compact event log (fixed height) */}
        <div className="relative flex min-h-0 flex-col gap-2 overflow-hidden">
          <TrackMapPanel live={live} dots={dots} rotation={rotation} className="min-h-0 flex-1" />
          {crashOverlay}
          <EventLogPanel
            events={live.events}
            onOpenFull={() => setModal('log')}
            className="h-[172px] shrink-0"
          />
        </div>

        {/* Right — a fixed rail: a fixed-height Data Analytics slot on top of a
            driver-card slot that fills the remaining space and splits it evenly
            between the two cards. The analytics panel height never changes with
            decision count, the cards never get pushed down, and nothing scrolls. */}
        <div className="grid min-h-0 grid-rows-[auto_1fr] gap-2 overflow-hidden">
          {!finished && (
            <RecommendationsPanel
              recs={activeRecs}
              monitor={monitor}
              currentLap={live.currentLap}
              decisionSecondsLeft={needsDecision ? decisionSecondsLeft ?? DECISION_COUNTDOWN_SECONDS : null}
              nameOf={driverName}
              onAccept={onAccept}
              onModify={onModify}
              onIgnore={onIgnore}
              onLetCrewDecide={onLetCrewDecide}
              onAcceptAll={onAcceptAll}
              onIgnoreAll={onIgnoreAll}
              className="h-[clamp(150px,23vh,190px)]"
            />
          )}
          <div className="grid min-h-0 auto-rows-fr gap-2 overflow-hidden">
            {playerCars.length === 0 ? (
              <div className="rounded-lg border border-slate-700/60 bg-[#111725] p-4 text-sm text-slate-500">
                No player cars in this race.
              </div>
            ) : (
              playerCars.map((c) => (
                <PitWallCard
                  key={c.driverId}
                  car={c}
                  name={driverName(c.driverId)}
                  teamColor={teamColor(c.teamId)}
                  finished={finished}
                  onMode={(m) => setMode(c.driverId, m)}
                  onPit={(decision) => pitNow(c.driverId, decision)}
                  className="min-h-0"
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="shrink-0 px-2 pb-2">
        <BottomRow
          live={live}
          playerCars={playerCars}
          nameOf={driverName}
          forecast={forecast}
          distanceKm={race?.distanceKm}
          fieldSize={live.cars.length}
          onEditStrategy={() => setModal('strategy')}
        />
      </div>

      {/* Decision prompt overlay */}
      {blockingPrompt && live.pendingPrompt && (
        <PromptOverlay
          title={live.pendingPrompt.title}
          driver={driverName(live.pendingPrompt.driverId)}
          description={live.pendingPrompt.description}
          options={live.pendingPrompt.options.map((o) => ({ id: o.id, label: o.label, detail: o.detail }))}
          onChoose={chooseOption}
        />
      )}
      {dnfAlert && <DnfOverlay alert={dnfAlert} nameOf={driverName} onClose={() => setDnfAlert(null)} />}

      {crashOverlay}

      {/* Modals */}
      {modal === 'log' && <FullEventLogModal events={live.events} onClose={() => setModal(null)} />}
      {modal === 'strategy' && (
        <StrategyModal
          playerCars={playerCars}
          currentLap={live.currentLap}
          finished={finished}
          nameOf={driverName}
          onPit={pitNow}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'orders' && (
        <TeamOrdersModal
          playerCars={playerCars}
          nameOf={driverName}
          onOrder={issueOrder}
          onClose={() => setModal(null)}
        />
      )}
      {podium && <PodiumOverlay podium={podium} onContinue={finishRace} />}
    </div>
  );
}

type PodiumSnapshot = {
  hasPlayerDriver: boolean;
  podium: Array<{ position: number; driver: string; teamColor: string; isPlayer: boolean }>;
};

function dnfAlertFromTransition(previous: LiveRaceState, next: LiveRaceState): DnfAlert | null {
  const previousRunning = new Map(previous.cars.map((car) => [car.driverId, car.running]));
  const entries = next.cars
    .filter((car) => previousRunning.get(car.driverId) && !car.running && car.status === 'DNF')
    .map((car) => ({ driverId: car.driverId, cause: car.lastIncident ?? 'Retired', isPlayer: car.isPlayer }));
  if (entries.length === 0) return null;
  return { lap: next.currentLap, entries };
}

function buildPodiumSnapshot(
  results: RaceResult[],
  playerTeamId: string,
  nameOf: (driverId: string) => string,
  colorOf: (teamId: string) => string,
): PodiumSnapshot {
  const podium = results
    .filter((r) => r.position != null && r.position <= 3)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .map((r) => ({
      position: r.position ?? 99,
      driver: nameOf(r.driverId),
      teamColor: colorOf(r.teamId),
      isPlayer: r.teamId === playerTeamId,
    }));
  return { podium, hasPlayerDriver: podium.some((r) => r.isPlayer) };
}

function PodiumOverlay({ podium, onContinue }: { podium: PodiumSnapshot; onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-amber-400/50 bg-neutral-950 shadow-2xl">
        <div className="border-b border-amber-500/25 px-5 py-4">
          <div className="text-xs font-bold uppercase tracking-wide text-amber-300">Podium Ceremony</div>
          <div className="mt-1 text-2xl font-black uppercase text-neutral-100">Top Three Finish</div>
        </div>
        <div className="grid items-end gap-3 px-5 py-6 sm:grid-cols-3">
          {[2, 1, 3].map((position) => {
            const entry = podium.podium.find((p) => p.position === position);
            const height = position === 1 ? 'h-40' : position === 2 ? 'h-32' : 'h-24';
            return (
              <div key={position} className="flex flex-col items-center gap-2">
                <div className={`flex w-full flex-col items-center justify-center rounded-t border border-neutral-700 bg-neutral-900 ${height}`}>
                  <div className="text-3xl font-black text-amber-300">P{position}</div>
                  <div className={`mt-2 h-2 w-16 rounded ${entry ? '' : 'bg-neutral-800'}`} style={{ backgroundColor: entry?.teamColor }} />
                  <div className={`mt-3 max-w-full px-2 text-center text-sm font-bold ${entry?.isPlayer ? 'text-amber-200' : 'text-neutral-200'}`}>
                    {entry?.driver ?? '-'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end border-t border-neutral-800 px-5 py-4">
          <button onClick={onContinue} className="rounded bg-amber-500 px-4 py-2 text-sm font-bold uppercase text-neutral-950 hover:bg-amber-400">
            Post-Race Report
          </button>
        </div>
      </div>
    </div>
  );
}

function DnfOverlay({
  alert,
  nameOf,
  onClose,
}: {
  alert: DnfAlert;
  nameOf: (driverId: string) => string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border-2 border-red-500/70 bg-[#141018] p-5 shadow-2xl">
        <div className="text-xs font-black uppercase tracking-wide text-red-300">Race Paused - DNF</div>
        <h3 className="mt-1 text-xl font-black text-slate-100">Driver Retired on Lap {alert.lap}</h3>
        <div className="mt-4 space-y-2">
          {alert.entries.map((entry) => (
            <div key={entry.driverId} className="rounded-lg border border-red-500/35 bg-red-950/30 px-3 py-2">
              <div className="font-bold text-slate-100">{nameOf(entry.driverId)}</div>
              <div className="text-sm text-red-200">{entry.cause}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded bg-red-500 px-4 py-2 text-sm font-bold uppercase text-white hover:bg-red-400">
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeTrackProgress(value: number): number {
  return ((value % 1) + 1) % 1;
}

function teamOrderLabel(order: TeamOrder): string {
  return TEAM_ORDER_SPECS.find((spec) => spec.order === order)?.label ?? order;
}

function PromptOverlay({
  title,
  driver,
  description,
  options,
  onChoose,
}: {
  title: string;
  driver: string;
  description: string;
  options: { id: string; label: string; detail: string }[];
  onChoose: (id: string) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-3">
      <div className="w-full max-w-3xl rounded-xl border-2 border-amber-500/60 bg-[#141a28] p-4 shadow-2xl">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">Decision · {driver}</div>
        <h3 className="text-base font-bold text-slate-100">{title}</h3>
        <p className="mb-3 text-sm text-slate-300">{description}</p>
        <div className="grid gap-2 md:grid-cols-3">
          {options.map((o) => (
            <button
              key={o.id}
              onClick={() => onChoose(o.id)}
              className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-left transition-colors hover:border-amber-500 hover:bg-amber-500/10"
            >
              <div className="text-sm font-semibold text-slate-100">{o.label}</div>
              <div className="mt-0.5 text-xs text-slate-400">{o.detail}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
