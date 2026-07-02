import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { activeDriversForTeam } from '../game/careerState';
import { buildLiveRaceMeta, buildLiveRaceOptions, buildRaceContext } from '../game/raceSetup';
import { createLiveRace, finalizeResults } from '../sim/liveRaceEngine';
import {
  applyRecommendationAction,
  expireRecommendation,
  ignoreRecommendation,
  requestPlayerPit,
  resolvePrompt,
  resolveRecommendationExternally,
  setPlayerPaceMode,
  stepLiveRace,
  stepLiveRaceToEnd,
} from '../sim/raceTickEngine';
import { requiresDecision, DECISION_COUNTDOWN_SECONDS } from '../sim/analyticsEngine';
import { buildAnalyticsMonitor } from '../sim/analyticsMonitor';
import { orderCardsBySeat } from '../sim/liveRaceCardOrder';
import { applyTeamOrderToLive, recordTeamOrder } from '../sim/relationshipEngine';
import { Button } from '../components/Button';
import type { TrackDot } from '../components/RaceTrack2D';
import type { AnalyticsRecommendation, LiveRaceState, PaceMode, RecAction } from '../types/liveTypes';
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

type Speed = 1 | 2 | 4;

export function LiveRace() {
  const { raceId } = useParams();
  const { state, dispatch } = useGame();
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
    const options = buildLiveRaceOptions(state, built.context, built.raceId, built.totalLaps);
    return { context: built.context, meta, initial: createLiveRace(built.context, options) };
  });

  const [live, setLive] = useState<LiveRaceState | null>(() => engine?.initial ?? null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [modal, setModal] = useState<'log' | 'strategy' | 'orders' | null>(null);
  const [decisionSecondsLeft, setDecisionSecondsLeft] = useState<number | null>(null);
  const committed = useRef(false);
  // Team orders called during the race, resolved into relationships at the flag.
  const teamOrders = useRef<TeamOrderDecision[]>([]);

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

  // Playback loop — steps a lap on an interval while playing, paused on prompts
  // or while a high/urgent recommendation is awaiting a decision.
  useEffect(() => {
    if (!engine || !live) return;
    if (!playing || live.pendingPrompt || live.phase === 'finished' || needsDecision) return;
    const id = setInterval(() => {
      setLive((s) => (s && !s.pendingPrompt && s.phase !== 'finished' ? stepLiveRace(s, engine.meta) : s));
    }, 950 / speed);
    return () => clearInterval(id);
  }, [engine, live, playing, speed, needsDecision]);

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

  const step = () => setLive((s) => (s ? stepLiveRace(s, engine.meta) : s));
  const skipToEnd = () => {
    setPlaying(false);
    setLive((s) => (s ? stepLiveRaceToEnd(s, engine.meta) : s));
  };
  const chooseOption = (optionId: string) =>
    setLive((s) => (s ? resolvePrompt(s, optionId, engine.meta) : s));
  const pitNow = (driverId: string) => setLive((s) => (s ? requestPlayerPit(s, driverId) : s));
  const setMode = (driverId: string, mode: PaceMode) =>
    setLive((s) => (s ? setPlayerPaceMode(s, driverId, mode) : s));

  // Apply a team order to the live state and record it for post-race resolution.
  const applyOrder = (s: LiveRaceState | null, order: TeamOrder, favoredDriverId?: string): LiveRaceState | null => {
    if (!s) return s;
    const applied = applyTeamOrderToLive(s, order, favoredDriverId, driverName);
    if (!applied) return s;
    const activeIds = s.cars.filter((c) => c.isPlayer).map((c) => c.driverId);
    teamOrders.current.push(recordTeamOrder(s.raceId, order, favoredDriverId, activeIds, s.currentLap));
    return applied.state;
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

  const onAccept = (rec: AnalyticsRecommendation) =>
    setLive((s) => (s ? resolveRec(s, rec, rec.action, 'accepted') : s));
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
    if (committed.current) {
      navigate(`/post-race/${raceId}`);
      return;
    }
    const { results, events, breakdowns } = finalizeResults(live, engine.context);
    committed.current = true;
    dispatch({ type: 'COMMIT_LIVE_RACE', results, events, breakdowns, teamOrders: teamOrders.current });
    navigate(`/post-race/${raceId}`);
  };

  const finished = live.phase === 'finished';
  const dots: TrackDot[] = live.cars.map((c) => ({
    driverId: c.driverId,
    label: String(driverNumber(c.driverId) || ''),
    color: teamColor(c.teamId),
    isPlayer: c.isPlayer,
    running: c.running,
    inPit: c.pit.inPitThisLap,
    rank: c.position ?? 99,
  }));
  const rotation = (live.currentLap / 5) % 1;
  // Locked to team seat order (not live position) so the cards never reorder.
  const playerCars = orderCardsBySeat(
    live.cars.filter((c) => c.isPlayer),
    seatOrderIds,
  );
  const forecast = buildForecast(live, engine.context.track);
  const activeRecs = finished ? [] : live.recommendations;
  const monitor = buildAnalyticsMonitor(live, seatOrderIds);

  const controls = (
    <div className="flex items-center gap-1.5">
      {!finished ? (
        <>
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={!!live.pendingPrompt || needsDecision}
            className={`rounded px-3 py-1 text-xs font-bold ${
              playing ? 'bg-slate-700 text-slate-100' : 'bg-emerald-600 text-white'
            } disabled:opacity-40`}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button
            onClick={step}
            disabled={playing || !!live.pendingPrompt || needsDecision}
            className="rounded bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
          >
            +1
          </button>
          <div className="flex items-center gap-0.5">
            {([1, 2, 4] as Speed[]).map((s) => (
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
            disabled={!!live.pendingPrompt || needsDecision}
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0a0e17] text-slate-200">
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
        <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
          <TrackMapPanel live={live} dots={dots} rotation={rotation} className="min-h-0 flex-1" />
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
                  onPit={() => pitNow(c.driverId)}
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
      {live.pendingPrompt && (
        <PromptOverlay
          title={live.pendingPrompt.title}
          driver={driverName(live.pendingPrompt.driverId)}
          description={live.pendingPrompt.description}
          options={live.pendingPrompt.options.map((o) => ({ id: o.id, label: o.label, detail: o.detail }))}
          onChoose={chooseOption}
        />
      )}

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
    </div>
  );
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
