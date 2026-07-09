import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { TrackDot } from '../../../components/RaceTrack2D';
import { TrackMapAssetPanel } from '../../../components/TrackMapAssetPanel';
import { modeSpec } from '../../../sim/liveRacePace';
import { DECISION_COUNTDOWN_SECONDS } from '../../../sim/analyticsEngine';
import type { AnalyticsMonitor } from '../../../sim/analyticsMonitor';
import { kindLabel } from '../../../sim/analyticsMonitor';
import type { AnalyticsRecommendation, LiveCarState, LiveRaceState, PaceMode, PitIntensity, RecAction, ReliabilityIssueType } from '../../../types/liveTypes';
import type { Race } from '../../../types/gameTypes';
import type { GameState } from '../../../game/careerState';
import { overallConfidenceScore } from '../../../sim/driverConfidenceEngine';
import { fmtLap, fmtSector, tyreLetter } from '../dashboardFormat';
import type { ForecastEntry } from '../forecast';
import { PIT_INTENSITY_ORDER } from '../../../sim/pitIntensityData';
import { getEraTheme, getEraThemeConfig } from '../../../theme/eraTheme';

const SAFETY_CAR_PIT_LOSS_FACTOR = 0.4;

type Speed = 1 | 10 | 30 | 60;

type Props = {
  state: GameState;
  race?: Race;
  live: LiveRaceState;
  dots: TrackDot[];
  rotation: number;
  playerCars: LiveCarState[];
  forecast: ForecastEntry[];
  monitor: AnalyticsMonitor;
  activeRecs: AnalyticsRecommendation[];
  needsDecision: boolean;
  pausedByDnf?: boolean;
  aiDnfFlash?: { lap: number; entries: Array<{ driverId: string; cause: string }> } | null;
  decisionSecondsLeft: number | null;
  playing: boolean;
  speed: Speed;
  nameOf: (driverId: string) => string;
  teamNameOf: (teamId: string) => string;
  colorOf: (teamId: string) => string;
  onTogglePlay: () => void;
  onStep: () => void;
  onSpeed: Dispatch<SetStateAction<Speed>>;
  onSkipToEnd: () => void;
  onOpenOrders: (driverId?: string) => void;
  onOpenStrategy: () => void;
  onOpenLog: () => void;
  onExit: () => void;
  onFinishRace: () => void;
  onPit: (driverId: string, decision?: { intensity?: PitIntensity; exitMode?: PaceMode }) => void;
  onMode: (driverId: string, mode: PaceMode) => void;
  onAccept: (rec: AnalyticsRecommendation, actionOverride?: RecAction) => void;
  onModify: (rec: AnalyticsRecommendation, action: RecAction) => void;
  onIgnore: (rec: AnalyticsRecommendation) => void;
  onLetCrewDecide: (rec: AnalyticsRecommendation) => void;
  onAcceptAll: () => void;
  onIgnoreAll: () => void;
  crashOverlay?: ReactNode;
};

export function F11990sLiveRaceScreen({
  state,
  race,
  live,
  dots,
  rotation,
  playerCars,
  forecast,
  activeRecs,
  needsDecision,
  pausedByDnf = false,
  aiDnfFlash,
  decisionSecondsLeft,
  playing,
  speed,
  nameOf,
  teamNameOf,
  colorOf,
  onTogglePlay,
  onStep,
  onSpeed,
  onSkipToEnd,
  onOpenOrders,
  onOpenLog,
  onExit,
  onFinishRace,
  onPit,
  onMode,
  onAccept,
  onModify,
  onIgnore,
  onLetCrewDecide,
  crashOverlay,
}: Props) {
  const finished = live.phase === 'finished';
  const focusCars = driverFocusCars(playerCars, live.cars);
  const leader = live.cars.find((c) => c.position === 1 && (c.running || c.status === 'Finished'));
  const raceTime = formatElapsed(leader?.totalTime ?? 0);
  const airTemp = forecast[0]?.temp ?? (live.weather.wet ? 18 : 22);
  const trackTemp = airTemp + (live.weather.wet ? 2 : 6);
  const [strategyDeskOpen, setStrategyDeskOpen] = useState(false);
  const [pitStrategyByDriver, setPitStrategyByDriver] = useState<
    Record<string, { intensity: PitIntensity; exitMode: PaceMode }>
  >({});
  useEffect(() => {
    setPitStrategyByDriver((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const car of playerCars) {
        if (!next[car.driverId]) {
          next[car.driverId] = {
            intensity: car.pit.intensity ?? car.pit.intensityDefault ?? 'Standard',
            exitMode: car.pit.exitMode ?? 'Conservative',
          };
          changed = true;
        }
      }
      for (const driverId of Object.keys(next)) {
        if (!playerCars.some((car) => car.driverId === driverId)) {
          delete next[driverId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [playerCars]);
  const blockingPrompt = !!live.pendingPrompt && !live.safetyCar.active;
  const canAdvance = !blockingPrompt && !needsDecision && !pausedByDnf && !finished;
  const alert = raceAlert(live, forecast, focusCars[0] ?? null);
  const decisionRecs = live.safetyCar.active ? [] : activeRecs.filter((rec) => rec.status === 'pending' && rec.priority !== 'low');
  const lapHistory = useLapHistory(live.currentLap, focusCars);
  const { outcomes, recordOutcome } = useDecisionOutcomes(live.recommendations, live.currentLap);
  const handleAccept = (rec: AnalyticsRecommendation, actionOverride?: RecAction) => {
    const action = actionOverride ?? rec.action;
    recordOutcome(
      rec,
      `Request approved \u2014 ${action.label}${rec.suggestedDuration ? ` (${rec.suggestedDuration})` : ''}`,
    );
    onAccept(rec, actionOverride);
  };
  const handleModify = (rec: AnalyticsRecommendation, action: RecAction) => {
    recordOutcome(rec, `Modified \u2014 ${action.label}`);
    onModify(rec, action);
  };
  const handleIgnore = (rec: AnalyticsRecommendation) => {
    recordOutcome(
      rec,
      `Request denied \u2014 ${rec.action.label}${rec.suggestedDuration ? ` (${rec.suggestedDuration})` : ''} refused; no change`,
    );
    onIgnore(rec);
  };
  const handleCrew = (rec: AnalyticsRecommendation) => {
    recordOutcome(rec, `Crew call \u2014 ${rec.action.label}`);
    onLetCrewDecide(rec);
  };
  const eraLabel = getEraThemeConfig(getEraTheme(state.series, state.seasonYear)).label;

  return (
    <div
      data-testid="f1-1990s-live-race-screen"
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#080b0c] font-mono text-zinc-100"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(252,211,77,0.12),transparent_24%),linear-gradient(180deg,rgba(7,11,13,0.12),rgba(7,11,13,0.88))]" />
      <RetroTopBar
        season={state.seasonYear}
        eraLabel={eraLabel}
        round={race?.round ?? null}
        raceName={race?.gpName ?? 'Live Race'}
        trackName={race?.trackName ?? live.trackId}
        lap={`${Math.min(live.currentLap, live.totalLaps)} / ${live.totalLaps}`}
        raceTime={raceTime}
        airTemp={airTemp}
        trackTemp={trackTemp}
        weather={live.weather.label}
        weatherNext={forecast[1]?.condition ?? null}
        onExit={onExit}
      />

      <main className="relative grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[minmax(235px,0.68fr)_minmax(440px,1.58fr)_minmax(320px,1.02fr)]">
        <aside className="grid min-h-0 grid-rows-[minmax(0,1.6fr)_auto_minmax(0,1fr)] gap-2">
          <RetroTimingTower cars={live.cars} nameOf={nameOf} colorOf={colorOf} />
          <PlaybackPanel
            playing={playing}
            speed={speed}
            canAdvance={canAdvance}
            finished={finished}
            onTogglePlay={onTogglePlay}
            onStep={onStep}
            onSpeed={onSpeed}
            onSkipToEnd={onSkipToEnd}
            onFinishRace={onFinishRace}
          />
          <RetroEventLog events={live.events} onOpenFull={onOpenLog} alert={alert} aiDnfFlash={aiDnfFlash ?? null} nameOf={nameOf} />
        </aside>

        <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(126px,0.22fr)] gap-2">
          <div className="relative min-h-[300px] overflow-hidden rounded-md border border-amber-500/35 bg-[#050605] shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]">
            <ScenicTrack cars={live.cars} colorOf={colorOf} />
            <RetroTrackMap
              series={state.series}
              year={state.seasonYear}
              trackId={race?.trackId ?? live.trackId}
              trackName={race?.trackName ?? live.trackId}
              dots={dots}
              rotation={rotation}
              safetyCar={live.safetyCar.active}
            />
            {crashOverlay}
          </div>
          <div className="grid min-h-0 gap-2 lg:grid-cols-[0.95fr_0.88fr]">
            <RetroPanel title="Team Radio" className="min-h-0">
              <div className="h-[calc(100%-37px)] overflow-y-auto p-2 text-[12px]">
                <div className="text-zinc-500" />
              </div>
            </RetroPanel>
            <RetroPanel title="Pit Window" className="min-h-0">
              <div className="h-[calc(100%-37px)] overflow-y-auto p-2 text-[12px]">
                <div className="space-y-3 text-zinc-200">
                  {playerCars.map((car) => (
                    <div key={car.driverId} className="rounded border border-zinc-800/70 bg-zinc-950/35 px-1.5 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{shortName(nameOf(car.driverId)).toUpperCase()}</span>
                        <span className="shrink-0 tabular-nums text-amber-300">{pitWindowText(car)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                        <span>{pitWindowStatus(car)}</span>
                        <span className="tabular-nums">{lastStopText(car)}</span>
                      </div>
                    </div>
                  ))}
                  {playerCars.length === 0 && <div>No planned stop</div>}
                </div>
              </div>
            </RetroPanel>
          </div>
        </section>

        <aside className="grid min-h-0 grid-rows-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,0.4fr)] gap-2 overflow-hidden">
          {focusCars.map((car, index) => (
            <DriverFocus
              key={`${car.driverId}-${index}`}
              car={car}
              name={nameOf(car.driverId)}
              team={teamNameOf(car.teamId)}
              number={state.drivers?.find((d) => d.id === car.driverId)?.number ?? null}
              teammate={focusCars.find((other) => other.driverId !== car.driverId) ?? null}
              nameOf={nameOf}
              lapTimes={lapHistory[car.driverId] ?? []}
              trendColor={TREND_COLORS[index % TREND_COLORS.length]}
              className="min-h-0"
              finished={finished}
              rec={decisionRecs.find((r) => r.driverId === car.driverId) ?? null}
              bothDrivers={decisionRecs.length > 1 && decisionRecs.every((r) => r.kind === decisionRecs[0].kind)}
              decisionSecondsLeft={needsDecision ? decisionSecondsLeft : null}
              outcome={outcomes[car.driverId] ?? null}
              trust={driverTrustFor(state, car.driverId)}
              pitStrategy={pitStrategyFor(pitStrategyByDriver, car)}
              live={live}
              state={state}
              onPit={(decision) => onPit(car.driverId, decision ?? pitStrategyFor(pitStrategyByDriver, car))}
              onMode={(mode) => onMode(car.driverId, mode)}
              onOrders={() => onOpenOrders(car.driverId)}
              onStrategyDesk={() => setStrategyDeskOpen(true)}
              onAccept={handleAccept}
              onModify={handleModify}
              onIgnore={handleIgnore}
              onLetCrewDecide={handleCrew}
            />
          ))}
          <TelemetrySectorTimes cars={focusCars} nameOf={nameOf} />
        </aside>
      </main>

      {strategyDeskOpen && (
        <StrategyDeskModal
          playerCars={playerCars}
          strategyByDriver={pitStrategyByDriver}
          nameOf={nameOf}
          onClose={() => setStrategyDeskOpen(false)}
          onChange={(driverId, next) =>
            setPitStrategyByDriver((prev) => ({
              ...prev,
              [driverId]: next,
            }))
          }
        />
      )}

      <div className="sr-only" aria-live="polite">
        1990s F1 live race screen. Lap {live.currentLap} of {live.totalLaps}. {activeRecs.length} pit wall recommendations.
      </div>
    </div>
  );
}

function RetroTopBar({
  season,
  eraLabel,
  round,
  raceName,
  trackName,
  lap,
  raceTime,
  airTemp,
  trackTemp,
  weather,
  weatherNext,
  onExit,
}: {
  season: number;
  eraLabel: string;
  round: number | null;
  raceName: string;
  trackName: string;
  lap: string;
  raceTime: string;
  airTemp: number;
  trackTemp: number;
  weather: string;
  weatherNext: string | null;
  onExit: () => void;
}) {
  return (
    <header className="relative grid shrink-0 grid-cols-[1fr_1.35fr_auto_0.8fr_0.8fr_0.8fr_0.9fr_auto] items-center overflow-hidden rounded-b-md border border-amber-500/25 bg-black/85 text-zinc-100 shadow-lg max-lg:grid-cols-2">
      <div className="border-r border-zinc-700/70 px-4 py-2">
        <div className="text-2xl font-black uppercase italic tracking-wide text-amber-400">{eraLabel}</div>
        <div className="text-sm font-bold text-amber-300">
          {season} Season{round != null ? ` RD ${round}` : ''}
        </div>
      </div>
      <div className="border-r border-zinc-700/70 px-4 py-2">
        <div className="truncate text-lg font-bold uppercase tracking-wide">{raceName}</div>
        <div className="truncate text-sm uppercase text-zinc-300">{trackName}</div>
      </div>
      <div className="mx-3 rounded border border-amber-500 px-8 py-2 text-center text-2xl font-black uppercase text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.14)] max-lg:m-2">
        Lap {lap}
      </div>
      <TopMetric label="Race Time" value={raceTime} />
      <TopMetric label="Air Temp" value={`${airTemp}\u00B0C`} />
      <TopMetric label="Track Temp" value={`${trackTemp}\u00B0C`} />
      <div className="grid grid-cols-2 border-l border-zinc-700/70 py-2 text-center">
        <div className="border-r border-zinc-800 px-2">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Weather</div>
          <div className="mt-0.5 truncate text-base font-bold text-amber-300">{weather}</div>
        </div>
        <div className="px-2">
          <div className="text-xs uppercase tracking-wide text-zinc-400">+15 Min</div>
          <div className="mt-0.5 truncate text-base font-bold text-amber-300">{weatherNext ?? '-'}</div>
        </div>
      </div>
      <div className="flex h-full items-center border-l border-zinc-700/70 px-3">
        <button
          onClick={onExit}
          className="rounded border border-zinc-600 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-300 hover:border-amber-400 hover:text-amber-300"
        >
          Exit Race
        </button>
      </div>
    </header>
  );
}

function TopMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l border-zinc-700/70 px-4 py-2 text-center">
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums text-amber-300">{value}</div>
    </div>
  );
}

function RetroPanel({
  title,
  headerRight,
  children,
  className = '',
  compactHeader = false,
}: {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  compactHeader?: boolean;
}) {
  return (
    <section className={`overflow-hidden rounded-md border border-amber-500/30 bg-black/72 shadow-[0_0_18px_rgba(0,0,0,0.38)] ${className}`}>
      <div
        className={`flex items-center justify-between gap-2 border-b border-zinc-700/70 font-bold uppercase tracking-wide text-amber-300 ${
          compactHeader ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-2 text-sm'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <div className="shrink-0">{headerRight}</div>
      </div>
      {children}
    </section>
  );
}

function RetroTimingTower({
  cars,
  nameOf,
  colorOf,
}: {
  cars: LiveCarState[];
  nameOf: (driverId: string) => string;
  colorOf: (teamId: string) => string;
}) {
  const [tab, setTab] = useState<'Running Order' | 'Pit Stops' | 'Sectors' | 'Intervals'>('Running Order');
  return (
    <RetroPanel title="Live Timing" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 border-b border-zinc-800 px-2 py-1">
        {(['Running Order', 'Pit Stops', 'Sectors', 'Intervals'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
              tab === item ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div
        className={`grid shrink-0 border-b border-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-300 ${
          tab === 'Sectors' ? 'grid-cols-[26px_1fr_54px_54px_54px_70px]' : 'grid-cols-[26px_1fr_58px_36px_58px]'
        }`}
      >
        <span>Pos</span>
        <span>Driver</span>
        {tab === 'Pit Stops'
          ? <span className="text-right">Last</span>
          : tab === 'Intervals'
            ? <span className="text-right">Interval</span>
            : tab === 'Sectors'
              ? <span className="text-right">S1</span>
              : <span className="text-right">Gap</span>}
        {tab === 'Intervals'
          ? <span className="text-right">Ahead</span>
          : tab === 'Sectors'
            ? <span className="text-right">S2</span>
            : <span className="text-right">Pits</span>}
        {tab === 'Sectors' ? <span className="text-right">S3</span> : <span className="text-right">{tab === 'Pit Stops' ? 'Lap' : 'Tyre'}</span>}
        {tab === 'Sectors' && <span className="text-right">Lap</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-8">
        {cars.map((car) => {
          const tyre = tyreLetter(car.tire.compound);
          const life = Math.max(0, 100 - Math.round(car.tire.wear));
          const position = car.position ?? 0;
          const retired = !car.running && car.status !== 'Finished';
          const retiredNote = retired ? `Retired - ${car.lastIncident ?? 'DNF'}` : '';
          return (
            <div
              key={car.driverId}
              className={`grid items-center px-2 py-[2px] text-[10px] leading-tight ${
                tab === 'Sectors' ? 'grid-cols-[26px_1fr_54px_54px_54px_70px]' : 'grid-cols-[26px_1fr_58px_36px_58px]'
              } ${car.isPlayer ? 'bg-amber-500/22 text-amber-200' : 'text-zinc-100'} ${retired ? 'opacity-60' : ''}`}
            >
              <span className="tabular-nums">{car.position ?? '-'}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2.5 w-1 shrink-0 rounded-sm" style={{ backgroundColor: colorOf(car.teamId) }} />
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="truncate">{shortName(nameOf(car.driverId)).toUpperCase()}</span>
                    {!retired && car.position != null && <GridDelta grid={car.grid} position={car.position} />}
                  </span>
                  {retiredNote && <span className="block truncate text-[8px] uppercase text-red-300">{retiredNote}</span>}
                </span>
              </span>
              {tab === 'Pit Stops' ? (
                <>
                  <span className="text-right tabular-nums text-zinc-300">
                    {car.pit.lastPitStopTime != null ? `${car.pit.lastPitStopTime.toFixed(1)}s` : car.pit.lastPitLap != null ? `L${car.pit.lastPitLap}` : '-'}
                  </span>
                  <span className="text-right tabular-nums">{car.isPlayer ? `${car.pit.stopsMade}/${car.pit.plannedStops}` : car.pit.stopsMade}</span>
                  <span className="text-right tabular-nums text-zinc-300">
                    {car.pit.lastPitLap != null ? `L${car.pit.lastPitLap}` : '-'}
                  </span>
                </>
              ) : tab === 'Sectors' ? (
                <>
                  <span className="text-right tabular-nums text-zinc-300">{fmtSector(car.lastSectors?.[0])}</span>
                  <span className="text-right tabular-nums text-zinc-300">{fmtSector(car.lastSectors?.[1])}</span>
                  <span className="text-right tabular-nums text-zinc-300">{fmtSector(car.lastSectors?.[2])}</span>
                  <span className="text-right tabular-nums text-zinc-300">{car.lastLapTime > 0 ? fmtLap(car.lastLapTime) : '—'}</span>
                </>
              ) : tab === 'Intervals' ? (
                <>
                  <span className="text-right tabular-nums text-zinc-300">{position === 1 ? 'LEADER' : `+${car.interval.toFixed(1)}`}</span>
                  <span className="text-right tabular-nums text-zinc-300">{position === 1 ? '—' : `P${Math.max(1, position - 1)}`}</span>
                  <span className="text-right font-bold tabular-nums text-amber-300">{tyre.letter} {life}%</span>
                </>
              ) : (
                <>
                  <span className="text-right tabular-nums text-zinc-300">{car.position === 1 ? 'LEADER' : retired ? '-' : `+${car.gapToLeader.toFixed(1)}`}</span>
                  <span className="text-right tabular-nums">{car.pit.stopsMade}</span>
                  <span className="text-right font-bold tabular-nums text-amber-300">{tyre.letter} {life}%</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="shrink-0 border-t border-zinc-800 px-3 py-1 text-[10px] uppercase text-zinc-300">
        D = Dry&nbsp;&nbsp;&nbsp; W = Wet&nbsp;&nbsp;&nbsp; % = Tyre life
      </div>
    </RetroPanel>
  );
}

function GridDelta({ grid, position }: { grid: number; position: number }) {
  const delta = grid - position;
  if (delta === 0) return <span className="shrink-0 text-[9px] font-bold text-zinc-500">{'\u2013'}</span>;
  if (delta > 0) {
    return (
      <span className="shrink-0 text-[9px] font-bold tabular-nums text-emerald-400">
        {'\u25B2'}{delta}
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[9px] font-bold tabular-nums text-red-400">
      {'\u25BC'}{Math.abs(delta)}
    </span>
  );
}

function RetroEventLog({
  events,
  onOpenFull,
  alert,
  aiDnfFlash,
  nameOf,
}: {
  events: LiveRaceState['events'];
  onOpenFull: () => void;
  alert: string | null;
  aiDnfFlash: { lap: number; entries: Array<{ driverId: string; cause: string }> } | null;
  nameOf: (driverId: string) => string;
}) {
  type EventTab = 'Lap Log' | 'Incidents' | 'Battles' | 'Status';
  const [tab, setTab] = useState<EventTab>('Lap Log');
  const filtered = tab === 'Lap Log' ? events : events.filter((event) => retroEventBucket(event) === tab);
  return (
    <RetroPanel title="Race Events" className="flex h-full min-h-0 flex-col">
      <RaceEventAlerts alert={alert} aiDnfFlash={aiDnfFlash} nameOf={nameOf} />
      <div className="flex shrink-0 border-b border-zinc-800 px-2 py-1">
        {(['Lap Log', 'Incidents', 'Battles', 'Status'] as const).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`mr-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
              tab === item ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 text-[10px]">
        {filtered.slice().reverse().map((event, index) => (
          <div key={`${event.lap}-${index}`}>
            <span className="line-clamp-1 text-zinc-200">L{event.lap}: {event.text}</span>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-zinc-500">No {tab.toLowerCase()} updates yet.</div>}
        <button onClick={onOpenFull} className="text-[10px] uppercase text-amber-300 hover:text-amber-200">
          Full event log
        </button>
      </div>
    </RetroPanel>
  );
}

function RaceEventAlerts({
  alert,
  aiDnfFlash,
  nameOf,
}: {
  alert: string | null;
  aiDnfFlash: { lap: number; entries: Array<{ driverId: string; cause: string }> } | null;
  nameOf: (driverId: string) => string;
}) {
  if (!alert && !aiDnfFlash) return null;
  const safetyCar = !!alert?.startsWith('Safety Car');
  return (
    <div className="shrink-0 space-y-1 border-b border-zinc-800 p-1.5">
      {alert && (
        <div
          className={`animate-pulse rounded border-2 px-2 py-1 ${
            safetyCar ? 'border-yellow-300 bg-yellow-300 text-black' : 'border-blue-300 bg-blue-600/90 text-blue-50'
          }`}
        >
          <div className="text-[9px] font-black uppercase tracking-wide opacity-80">Race Alert</div>
          <div className="text-[11px] font-black uppercase leading-tight">{alert}</div>
        </div>
      )}
      {aiDnfFlash && (
        <div className="animate-pulse rounded border-2 border-red-600 bg-red-950/95 px-2 py-1 text-red-100">
          <div className="text-[9px] font-black uppercase tracking-wide text-red-300">Race Alert - Retirement (Lap {aiDnfFlash.lap})</div>
          {aiDnfFlash.entries.map((entry) => (
            <div key={entry.driverId} className="text-[10px] font-bold uppercase leading-tight">
              {shortName(nameOf(entry.driverId)).toUpperCase()} - {entry.cause}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function retroEventBucket(event: LiveRaceState['events'][number]): 'Incidents' | 'Battles' | 'Status' {
  if (event.category === 'incident') return 'Incidents';
  if (event.category === 'battle') return 'Battles';
  if (event.category === 'status' || event.category === 'weather' || event.category === 'race-control') return 'Status';
  const text = event.text.toLowerCase();
  if (/(retir|crash|contact|accident|puncture|damage|spin|collision|failure|dnf|safety car)/.test(text)) return 'Incidents';
  if (/(passes|overtak|defends|clears|battle|holds off|position)/.test(text)) return 'Battles';
  return 'Status';
}

function ScenicTrack({ cars, colorOf }: { cars: LiveCarState[]; colorOf: (teamId: string) => string }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#263526_0%,#537044_38%,#1c261c_100%)]" />
      <div className="absolute left-0 top-0 h-[28%] w-full bg-[linear-gradient(180deg,#a7c4d1_0%,#6f8a97_60%,transparent_100%)] opacity-70" />
      <div className="absolute left-0 top-[18%] h-[22%] w-full bg-[repeating-linear-gradient(90deg,rgba(22,31,26,.9)_0_30px,rgba(34,48,37,.9)_30px_52px)] opacity-60" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 720" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-120 690 C 220 560, 390 520, 520 438 C 720 312, 580 226, 840 202 C 1010 187, 1114 112, 1260 70" fill="none" stroke="#1f2322" strokeWidth="150" strokeLinecap="round" />
        <path d="M-120 690 C 220 560, 390 520, 520 438 C 720 312, 580 226, 840 202 C 1010 187, 1114 112, 1260 70" fill="none" stroke="#3b3d3b" strokeWidth="116" strokeLinecap="round" />
        <path d="M-120 690 C 220 560, 390 520, 520 438 C 720 312, 580 226, 840 202 C 1010 187, 1114 112, 1260 70" fill="none" stroke="#f4f4f5" strokeWidth="4" strokeDasharray="42 22" opacity="0.55" />
        {cars.slice(0, 8).map((car, index) => {
          const x = 330 + index * 78;
          const y = 560 - index * 48 + (index % 2) * 24;
          return (
            <g key={car.driverId} transform={`translate(${x} ${y}) rotate(-11)`}>
              <rect x="-24" y="-8" width="48" height="16" rx="3" fill={colorOf(car.teamId)} stroke="#111" strokeWidth="2" />
              <rect x="-5" y="-14" width="18" height="10" rx="3" fill="#111827" />
              <circle cx="-17" cy="10" r="6" fill="#050505" />
              <circle cx="17" cy="10" r="6" fill="#050505" />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.55),transparent_28%,transparent_66%,rgba(0,0,0,.48)),linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.58))]" />
    </div>
  );
}

function PlaybackPanel({
  playing,
  speed,
  canAdvance,
  finished,
  onTogglePlay,
  onStep,
  onSpeed,
  onSkipToEnd,
  onFinishRace,
}: {
  playing: boolean;
  speed: Speed;
  canAdvance: boolean;
  finished: boolean;
  onTogglePlay: () => void;
  onStep: () => void;
  onSpeed: Dispatch<SetStateAction<Speed>>;
  onSkipToEnd: () => void;
  onFinishRace: () => void;
}) {
  return (
    <RetroPanel
      title="Real-Time Mode"
      headerRight={
        finished ? (
          <button onClick={onFinishRace} className="rounded border border-amber-500 bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase text-black hover:bg-amber-300">
            Post-Race Report
          </button>
        ) : (
          <div className="flex shrink-0 gap-0.5">
            <button onClick={onTogglePlay} disabled={!canAdvance} className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300 hover:border-amber-400 disabled:opacity-40">
              {playing ? 'II' : '>'}
            </button>
            <button onClick={onStep} disabled={!canAdvance || playing} className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300 hover:border-amber-400 disabled:opacity-40">
              +1
            </button>
            {([1, 10, 30, 60] as Speed[]).map((s) => (
              <button
                key={s}
                onClick={() => onSpeed(s)}
                className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${speed === s ? 'border-amber-400 bg-amber-400/20 text-amber-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-amber-400'}`}
              >
                {s}x
              </button>
            ))}
            <button onClick={onSkipToEnd} disabled={!canAdvance} className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300 hover:border-amber-400 disabled:opacity-40">
              End
            </button>
          </div>
        )
      }
    >
      {!finished && (
        <div className="flex items-center justify-between px-2 py-1 text-[10px] text-zinc-400">
          <span>1x = lap time pacing</span>
          <span className="text-amber-300">+1 advances one lap</span>
        </div>
      )}
    </RetroPanel>
  );
}

function RetroTrackMap({
  series,
  year,
  trackId,
  trackName,
  dots,
  rotation,
  safetyCar = false,
}: {
  series?: string;
  year?: number;
  trackId?: string;
  trackName?: string;
  dots: TrackDot[];
  rotation: number;
  safetyCar?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-10 max-lg:hidden">
      <RetroPanel title="Track Map" className="h-full bg-black/78 backdrop-blur-[1px]">
        <div className="flex h-[calc(100%-37px)] flex-col">
          <div className="min-h-0 flex-1 p-1">
            <TrackMapAssetPanel
              series={series}
              year={year}
              trackId={trackId}
              trackName={trackName}
              dots={dots}
              rotation={rotation}
              eraTheme="f1-1990s"
              hideFooterLabel
              safetyCar={safetyCar}
              className="h-full w-full"
            />
          </div>
        </div>
      </RetroPanel>
    </div>
  );
}

function DriverFocus({
  car,
  name,
  team,
  number,
  teammate,
  nameOf,
  lapTimes,
  trendColor,
  finished,
  rec,
  bothDrivers,
  decisionSecondsLeft,
  outcome,
  trust,
  pitStrategy,
  live,
  state,
  onPit,
  onMode,
  onOrders,
  onStrategyDesk,
  onAccept,
  onModify,
  onIgnore,
  onLetCrewDecide,
  className = '',
}: {
  car: LiveCarState;
  name: string;
  team: string;
  number: number | null;
  teammate: LiveCarState | null;
  nameOf: (driverId: string) => string;
  lapTimes: number[];
  trendColor: string;
  finished: boolean;
  rec: AnalyticsRecommendation | null;
  bothDrivers: boolean;
  decisionSecondsLeft: number | null;
  outcome: string | null;
  trust: {
    driverTrust: number;
    teamTrust: number;
    carTrust: number;
    teamTrustInDriver: number;
  };
  pitStrategy: { intensity: PitIntensity; exitMode: PaceMode };
  live: LiveRaceState;
  state: GameState;
  onPit: (decision?: { intensity?: PitIntensity; exitMode?: PaceMode }) => void;
  onMode: (mode: PaceMode) => void;
  onOrders: () => void;
  onStrategyDesk: () => void;
  onAccept: (rec: AnalyticsRecommendation, actionOverride?: RecAction) => void;
  onModify: (rec: AnalyticsRecommendation, action: RecAction) => void;
  onIgnore: (rec: AnalyticsRecommendation) => void;
  onLetCrewDecide: (rec: AnalyticsRecommendation) => void;
  className?: string;
}) {
  const tyre = tyreLetter(car.tire.compound);
  const canPit = car.running && !car.pit.inPitThisLap && !finished;
  const gapToTeammate =
    teammate && teammate.running && car.running ? car.gapToLeader - teammate.gapToLeader : null;
  return (
    <RetroPanel
      title={`${number ?? car.position ?? '-'}  ${shortName(name)}  ${team}`}
      className={`h-full min-h-0 ${className}`}
      headerRight={
        car.isPlayer ? (
          <div className="flex gap-1">
            <button
              onClick={onOrders}
              disabled={!car.running || finished}
              className="rounded border border-amber-500/55 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-300 hover:bg-amber-500/20 disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600"
            >
              Team Orders
            </button>
            <button
              onClick={onStrategyDesk}
              disabled={!car.running || finished}
              className="rounded border border-amber-500/55 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-300 hover:bg-amber-500/20 disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-600"
            >
              Strategy Desk
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="relative flex h-[calc(100%-37px)] flex-col overflow-hidden px-2 py-1.5">
        {!finished && car.running && (
          <div className="flex items-center justify-end">
            <button
              onClick={() => onPit()}
              disabled={!canPit}
              className="shrink-0 rounded border border-amber-500/50 px-2 py-1 text-[9px] font-bold uppercase text-amber-300 hover:bg-amber-500/10 disabled:border-zinc-800 disabled:text-zinc-600"
            >
              {car.pit.pitRequested ? 'Cancel Pit' : 'Pit'}
            </button>
          </div>
        )}
        <div className="mt-1 flex items-stretch gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-2 gap-y-0.5 self-start text-[10px] leading-tight">
            <FocusLine label="Position" value={car.position ? ordinalText(car.position) : 'Out'} />
            <FocusLine label="Last lap" value={car.lastLapTime > 0 ? fmtLap(car.lastLapTime) : 'N/A'} />
            <FocusLine label="Gap to leader" value={car.position === 1 ? 'Leader' : `+${car.gapToLeader.toFixed(1)}`} />
            <FocusLine
              label={teammate ? `Gap to ${shortName(nameOf(teammate.driverId)).split(' ').pop()}` : 'Best lap'}
              value={
                teammate
                  ? gapToTeammate != null
                    ? `${gapToTeammate >= 0 ? '+' : '-'}${Math.abs(gapToTeammate).toFixed(1)}`
                    : 'N/A'
                  : car.bestLap
                    ? fmtLap(car.bestLap)
                    : 'N/A'
              }
            />
            <FocusLine label="Fuel left" value={`${Math.round(car.fuel)}%`} />
            <FocusLine label="Tyre life" value={`${tyre.letter} ${Math.max(0, 100 - Math.round(car.tire.wear))}%`} />
          </div>
          <DriverPaceTrend values={lapTimes} color={trendColor} />
        </div>
        <div className="mt-1 rounded border border-zinc-800 bg-zinc-950/55 p-1.5">
          <TrustReadout trust={trust} />
        </div>
        {!finished && car.running && (
          <div className="relative mt-1 flex min-h-0 flex-1 flex-col rounded border border-zinc-800 bg-zinc-950/55 p-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">Strategy Mode</span>
            </div>
            <div className="grid grid-cols-6 gap-0.5">
              {DISPLAY_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => onMode(mode)}
                  disabled={finished || !car.running}
                  title={modeSpec(mode).blurb}
                  className={`truncate rounded px-1 py-0.5 text-[8px] font-bold uppercase ${
                    car.paceMode === mode
                      ? 'bg-amber-400 text-black'
                      : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  } disabled:opacity-40`}
                >
                  {modeLabel(mode)}
                </button>
              ))}
            </div>
            <div className="mt-0.5 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-zinc-800 pt-0.5">
              <ConditionLine label="Engine" level={componentCondition(car, 'Engine')} />
              <ConditionLine label="Brakes" level={componentCondition(car, 'Brakes')} />
              <ConditionLine label="Gearbox" level={componentCondition(car, 'Gearbox')} />
              <ConditionLine label="Aero" level={componentCondition(car, 'Aero')} />
              <ConditionLine label="Overall" level={overallCondition(car)} />
              <ConditionLine label="Risk" level={riskCondition(car.reliabilityRiskLevel)} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {radioLines(car, live, state, nameOf).map((line, index) => (
                <div key={index} className="text-[10px] leading-tight text-zinc-300">
                  {line}
                </div>
              ))}
            </div>
            {rec ? (
              <div className="absolute inset-x-0 bottom-0 z-10 p-1">
                <DriverAlertCard
                  key={rec.id}
                  rec={rec}
                  bothDrivers={bothDrivers}
                  pitStrategy={pitStrategy}
                  decisionSecondsLeft={decisionSecondsLeft}
                  onAccept={onAccept}
                  onModify={onModify}
                  onIgnore={onIgnore}
                  onLetCrewDecide={onLetCrewDecide}
                />
              </div>
            ) : outcome ? (
              <div className="absolute inset-x-0 bottom-0 z-10 p-1">
                <div className="rounded border-2 border-amber-500/70 bg-black/90 px-1.5 py-1 shadow-[0_0_14px_rgba(245,158,11,0.3)]">
                  <span className="text-[10px] font-black uppercase tracking-wide text-amber-300">Pit Wall</span>{' '}
                  <span className="text-[10px] leading-tight text-zinc-200">{outcome}</span>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </RetroPanel>
  );
}

function DriverAlertCard({
  rec,
  bothDrivers,
  pitStrategy,
  decisionSecondsLeft,
  onAccept,
  onModify,
  onIgnore,
  onLetCrewDecide,
}: {
  rec: AnalyticsRecommendation;
  bothDrivers: boolean;
  pitStrategy: { intensity: PitIntensity; exitMode: PaceMode };
  decisionSecondsLeft: number | null;
  onAccept: (rec: AnalyticsRecommendation, actionOverride?: RecAction) => void;
  onModify: (rec: AnalyticsRecommendation, action: RecAction) => void;
  onIgnore: (rec: AnalyticsRecommendation) => void;
  onLetCrewDecide: (rec: AnalyticsRecommendation) => void;
}) {
  const [modifying, setModifying] = useState(false);
  const pitCall = /pit/i.test(rec.action.label);

  const pitActionOverride = pitCall
    ? { ...rec.action, pitIntensity: pitStrategy.intensity, pitExitMode: pitStrategy.exitMode }
    : undefined;
  return (
    <div className="z-10 mt-auto overflow-hidden rounded border-2 border-amber-400 bg-black/95 px-2 py-2 shadow-[0_0_20px_rgba(245,158,11,0.35)]">
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
        <span aria-hidden="true">{'\u26A0'}</span>
        <span className="truncate">{kindLabel(rec.kind)}{bothDrivers ? ' - Both Drivers' : ''}</span>
      </div>
      <p className="line-clamp-2 text-[10px] leading-tight text-zinc-300">{rec.issue}</p>
      <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-amber-200">
        {rec.recommendedAction}
        {rec.suggestedDuration ? ` (${rec.suggestedDuration})` : ''}
      </p>
      {decisionSecondsLeft != null && <CountdownBar secondsLeft={decisionSecondsLeft} className="mt-0.5" compact />}
      {modifying ? (
        <div className="mt-1 max-h-24 space-y-1 overflow-y-auto">
          {[rec.action, ...rec.alternatives].map((a) => (
            <button
              key={a.type}
              onClick={() => {
                onModify(rec, a);
                setModifying(false);
              }}
              className="w-full truncate rounded bg-zinc-800 px-2 py-1.5 text-left text-[10px] font-semibold text-zinc-200 hover:bg-zinc-700"
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={() => setModifying(false)}
            className="w-full rounded py-1 text-[9px] uppercase text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-1 space-y-1.5">
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => onAccept(rec, pitActionOverride)}
              className="rounded-sm bg-amber-400 py-1.5 text-[9px] font-black uppercase text-black hover:bg-amber-300"
            >
              {pitCall ? 'Pit Now' : 'Accept'}
            </button>
            <button
              onClick={() => setModifying(true)}
              className="rounded-sm border border-amber-500/60 py-1.5 text-[9px] font-bold uppercase text-amber-200 hover:bg-amber-500/15"
            >
              Modify
            </button>
            <button
              onClick={() => onLetCrewDecide(rec)}
              className="rounded-sm border border-amber-500/60 py-1.5 text-[9px] font-bold uppercase text-amber-200 hover:bg-amber-500/15"
            >
              Crew
            </button>
            <button
              onClick={() => onIgnore(rec)}
              className="rounded-sm border border-amber-500/60 py-1.5 text-[9px] font-bold uppercase text-amber-200 hover:bg-amber-500/15"
            >
              {pitCall ? 'Stay Out' : 'Ignore'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PitDecisionControls({
  intensity,
  exitMode,
  onIntensity,
  onExitMode,
}: {
  intensity: PitIntensity;
  exitMode: PaceMode;
  onIntensity: (value: PitIntensity) => void;
  onExitMode: (value: PaceMode) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 gap-1">
        {PIT_INTENSITY_ORDER.map((value) => (
          <button
            key={value}
            onClick={() => onIntensity(value)}
            className={`rounded-sm px-1 py-1.5 text-[9px] font-bold uppercase ${
              intensity === value ? 'bg-amber-300 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1">
        {DISPLAY_MODES.map((mode) => (
          <button
            key={mode}
            onClick={() => onExitMode(mode)}
            className={`rounded-sm px-1 py-1.5 text-[9px] font-bold uppercase ${
              exitMode === mode ? 'bg-emerald-300 text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            {modeLabel(mode)}
          </button>
        ))}
      </div>
    </div>
  );
}

function TrustReadout({
  trust,
}: {
  trust: {
    driverTrust: number;
    teamTrust: number;
    carTrust: number;
    teamTrustInDriver: number;
  };
}) {
  return (
    <div className="grid gap-1">
      <TrustBar label="Driver Trust" value={trust.driverTrust} accent="amber" />
      <div className="grid grid-cols-3 gap-1">
        <TrustBar label="Team Trust" value={trust.teamTrust} accent="emerald" compact />
        <TrustBar label="Car Trust" value={trust.carTrust} accent="sky" compact />
        <TrustBar label="Team→Driver" value={trust.teamTrustInDriver} accent="violet" compact />
      </div>
    </div>
  );
}

function TrustBar({
  label,
  value,
  accent,
  compact = false,
}: {
  label: string;
  value: number;
  accent: 'amber' | 'emerald' | 'sky' | 'violet';
  compact?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const fill =
    accent === 'amber'
      ? 'bg-amber-400'
      : accent === 'emerald'
        ? 'bg-emerald-400'
        : accent === 'sky'
          ? 'bg-sky-400'
          : 'bg-violet-400';
  return (
    <div className={compact ? 'text-[9px]' : 'text-[10px]'}>
      <div className="mb-0.5 flex items-center justify-between gap-1 text-zinc-400">
        <span className="truncate uppercase tracking-wide">{label}</span>
        <span className="tabular-nums text-zinc-200">{clamped}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function driverTrustFor(state: GameState, driverId: string) {
  const rel = state.driverRelationships?.[driverId];
  return rel
    ? {
        driverTrust: overallConfidenceScore(rel),
        teamTrust: rel.trustInTeam,
        carTrust: rel.trustInCar,
        teamTrustInDriver: rel.teamTrustInDriver,
      }
    : {
        driverTrust: 50,
        teamTrust: 50,
        carTrust: 50,
        teamTrustInDriver: 50,
      };
}

function driverFocusCars(playerCars: LiveCarState[], cars: LiveCarState[]): LiveCarState[] {
  const focus = [...playerCars];
  for (const car of cars) {
    if (focus.length >= 2) break;
    if (!focus.some((existing) => existing.driverId === car.driverId)) focus.push(car);
  }
  return focus.slice(0, 2);
}

function FocusLine({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="uppercase text-zinc-500">{label}</span>
      <span className="text-right font-bold tabular-nums text-zinc-100">{value}</span>
    </>
  );
}

function pitStrategyFor(
  strategyByDriver: Record<string, { intensity: PitIntensity; exitMode: PaceMode }>,
  car: LiveCarState,
): { intensity: PitIntensity; exitMode: PaceMode } {
  return (
    strategyByDriver[car.driverId] ?? {
      intensity: car.pit.intensity ?? car.pit.intensityDefault ?? 'Standard',
      exitMode: car.pit.exitMode ?? 'Conservative',
    }
  );
}

function raceAlert(live: LiveRaceState, forecast: ForecastEntry[], focusCar: LiveCarState | null): string | null {
  if (live.safetyCar.active) {
    const lapsLeft = Math.max(0, Math.ceil(live.safetyCar.lapsRemaining));
    const save = safetyCarPitSaving(focusCar);
    const saveText = Number.isInteger(save) ? `${save.toFixed(0)}` : save.toFixed(1);
    return `Safety Car — ${lapsLeft}L — ${saveText}s`;
  }
  if (live.weather.wet) return live.weather.condition === 'HeavyRain' ? 'Heavy Rain' : 'Wet Track';
  if (live.weather.changingSoon || forecast.slice(0, 3).some((entry) => entry.wet)) return 'Rain Approaching';
  return null;
}

function safetyCarPitSaving(car: LiveCarState | null): number {
  const greenLoss = car?.pitLossBase ?? 0;
  const scLoss = Math.round(Math.max(0, greenLoss * SAFETY_CAR_PIT_LOSS_FACTOR) * 10) / 10;
  return Math.round(Math.max(0, greenLoss - scLoss) * 10) / 10;
}

function StrategyDeskModal({
  playerCars,
  strategyByDriver,
  nameOf,
  onChange,
  onClose,
}: {
  playerCars: LiveCarState[];
  strategyByDriver: Record<string, { intensity: PitIntensity; exitMode: PaceMode }>;
  nameOf: (driverId: string) => string;
  onChange: (driverId: string, next: { intensity: PitIntensity; exitMode: PaceMode }) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl overflow-hidden rounded-xl border-2 border-amber-500/65 bg-[#14120f] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-amber-500/25 px-4 py-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wide text-amber-300">Strategy Desk</div>
            <div className="text-xs text-zinc-400">Queue pit intensity and exit mode here; the PIT button uses this selection.</div>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-bold uppercase text-zinc-300 hover:border-amber-400 hover:text-amber-200"
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {playerCars.map((car) => {
              const strategy = strategyByDriver[car.driverId] ?? {
                intensity: car.pit.intensity ?? car.pit.intensityDefault ?? 'Standard',
                exitMode: car.pit.exitMode ?? 'Conservative',
              };
              return (
                <div key={car.driverId} className="rounded-lg border border-zinc-800 bg-black/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-zinc-100">{nameOf(car.driverId)}</div>
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                        {strategy.intensity} · exits {strategy.exitMode}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        onChange(car.driverId, {
                          intensity: car.pit.intensity ?? car.pit.intensityDefault ?? 'Standard',
                          exitMode: car.pit.exitMode ?? 'Conservative',
                        })
                      }
                      className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-bold uppercase text-zinc-300 hover:border-amber-400 hover:text-amber-200"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-zinc-500">Pit intensity</div>
                    <PitDecisionControls
                      intensity={strategy.intensity}
                      exitMode={strategy.exitMode}
                      onIntensity={(value) => onChange(car.driverId, { ...strategy, intensity: value })}
                      onExitMode={(value) => onChange(car.driverId, { ...strategy, exitMode: value })}
                    />
                  </div>
                  <div className="mt-3 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-[10px] text-zinc-400">
                    Apply this with the driver box PIT button when you are ready to box.
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function radioLines(
  car: LiveCarState,
  live: LiveRaceState,
  state: GameState,
  nameOf: (driverId: string) => string,
): string[] {
  if (!car.running && car.status !== 'Finished') return [car.lastIncident ?? 'We are out of the race.'];

  const driver = state.drivers?.find((d) => d.id === car.driverId);
  const rel = state.driverRelationships?.[car.driverId];
  const messages: string[] = [];
  const pos = car.position ?? 99;
  const gained = car.grid - pos;
  const teammate = live.cars.find((c) => c.isPlayer && c.driverId !== car.driverId);

  if (live.safetyCar.active) {
    messages.push(`Safety Car pace confirmed. Holding Conserve until green, likely ${live.safetyCar.lapsRemaining}-${live.safetyCar.lapsRemaining + 1} laps.`);
  }
  if (car.pit.window && car.pit.stopsMade < car.pit.plannedStops) {
    if (live.currentLap < car.pit.window.open) messages.push(`Next stop target is L${car.pit.window.ideal}. Window opens L${car.pit.window.open}.`);
    else if (live.currentLap <= car.pit.window.close) messages.push(`Pit window is open now. Ideal stop is L${car.pit.window.ideal}.`);
    else messages.push(`We are late on the stop. Original ideal was L${car.pit.window.ideal}.`);
  }
  if (car.reliabilityIssue) messages.push(`${car.reliabilityIssue.label} warning. I can manage it if we stay calm.`);
  if ((car.aeroHealth ?? 100) < 82) messages.push('Aero balance is compromised. High-speed entries feel nervous.');
  if (car.brakeHealth < 70) messages.push('Brake pedal is getting longer. Need margin into heavy braking zones.');
  if (car.engineHealth < 70) messages.push('Engine temps are not comfortable. Less push on the straights would help.');
  if (car.tire.wear > 68) messages.push('Rear tyres are fading. Traction is getting messy on exits.');
  else if (car.tire.wear > 48) messages.push('Tyres are past their best but still manageable.');
  if (car.fuel < 18) messages.push('Fuel number is tight. Lift and coast if we need it.');
  if (gained >= 3) messages.push(`Good progress from the grid. Up ${gained} places and rhythm is strong.`);
  if (gained <= -3) messages.push(`We have lost ${Math.abs(gained)} places. Need a strategy reset.`);
  if (car.liveRacePace >= car.baseRacePace + 0.35) messages.push('Pace feels better than expected. Car is responding.');
  if (car.liveRacePace <= car.baseRacePace - 0.45) messages.push('I am struggling for pace compared with our target.');
  if (teammate && teammate.running && car.interval > 0 && car.interval < 1.2) {
    messages.push(`Close to ${shortName(nameOf(teammate.driverId))}. Confirm if we are racing or holding station.`);
  }
  if (driver && driver.confidence < 42) messages.push('Confidence is not high in the car right now. Talk me through the next call.');
  if (driver && driver.morale < 42) messages.push('This is not an easy stint. I need clear calls from the pit wall.');
  if (rel && rel.teammateRelationship < 35) messages.push('Traffic with the other car is tense. I want clear priority if we meet.');
  if (rel && rel.trustInCar < 40) messages.push('I still do not fully trust the car balance over a stint.');
  if (driver?.traits.includes('Risk Taker') && car.paceMode === 'Conservative' && !live.safetyCar.active) {
    messages.push('There is more pace here if you let me attack.');
  }
  if (driver?.traits.includes('Setup Focused') && car.statusMessage) messages.push(car.statusMessage);

  const fallback = [
    'Car balance is stable for now.',
    `Current mode ${modeLabel(car.paceMode)} is understood.`,
    car.gapToLeader > 0 ? `Gap ahead is ${car.interval.toFixed(1)} seconds.` : 'Clean air at the front.',
    car.tire.wear > 35 ? 'Tyre temperatures are moving, but still in range.' : 'Tyre temperatures look controlled.',
  ];
  while (messages.length < 2) {
    messages.push(fallback[Math.abs((live.currentLap + car.driverId.length + messages.length + pos) % fallback.length)]);
  }
  return messages.slice(0, 2);
}

function pitWindowText(car: LiveCarState): string {
  const stopsLeft = car.pit.plannedStops - car.pit.stopsMade;
  if (stopsLeft <= 0) return 'No planned stops';
  const w = car.pit.window;
  if (!w) return 'Window TBD';
  if (car.lapsCompleted < w.open) return `Window L${w.open}-${w.close}`;
  if (car.lapsCompleted <= w.close) return `OPEN to L${w.close}`;
  return `Late - was L${w.ideal}`;
}

function pitWindowStatus(car: LiveCarState): string {
  const stopsLeft = car.pit.plannedStops - car.pit.stopsMade;
  if (stopsLeft <= 0) return 'Plan complete';
  if (car.pit.pitRequested) return 'Box call accepted';
  const w = car.pit.window;
  if (!w) return 'Awaiting strategist window';
  if (car.lapsCompleted < w.open) return `Next planned stop: L${w.ideal}`;
  if (car.lapsCompleted <= w.close) return `Window open: ideal L${w.ideal}`;
  return `Late stop risk: ${Math.max(1, car.lapsCompleted - w.ideal)}L past ideal`;
}

function lastStopText(car: LiveCarState): string {
  if (car.pit.lastPitLap != null && car.pit.lastPitStopTime != null) return `Last L${car.pit.lastPitLap} - ${car.pit.lastPitStopTime.toFixed(1)}s`;
  if (car.pit.lastPitLap != null) return `Last L${car.pit.lastPitLap}`;
  if (car.pit.lastPitStopTime != null) return `Last ${car.pit.lastPitStopTime.toFixed(1)}s`;
  return 'No stop yet';
}

type ConditionLevel = 'None' | 'Low' | 'Medium' | 'Critical';
type ComponentKey = 'Engine' | 'Brakes' | 'Gearbox' | 'Aero';

const CONDITION_STYLE: Record<ConditionLevel, { bar: string; text: string; label: string }> = {
  None: { bar: 'bg-emerald-400', text: 'text-emerald-300', label: 'None' },
  Low: { bar: 'bg-sky-400', text: 'text-sky-300', label: 'Low' },
  Medium: { bar: 'bg-orange-400', text: 'text-orange-300', label: 'Medium' },
  Critical: { bar: 'bg-red-500', text: 'text-red-300', label: 'Critical' },
};

function ConditionLine({ label, level }: { label: string; level: ConditionLevel }) {
  const style = CONDITION_STYLE[level];
  return (
    <div className="flex items-center gap-1 text-[9px]">
      <span className="w-10 uppercase text-zinc-500">{label}</span>
      <span className="h-1 flex-1 overflow-hidden rounded bg-zinc-800">
        <span className={`block h-full ${style.bar}`} style={{ width: conditionWidth(level) }} />
      </span>
      <span className={`w-12 text-right font-bold uppercase tabular-nums ${style.text}`}>{style.label}</span>
    </div>
  );
}

function conditionWidth(level: ConditionLevel): string {
  if (level === 'Critical') return '100%';
  if (level === 'Medium') return '68%';
  if (level === 'Low') return '42%';
  return '18%';
}

function componentCondition(car: LiveCarState, component: ComponentKey): ConditionLevel {
  const health =
    component === 'Engine'
      ? car.engineHealth
      : component === 'Brakes'
        ? car.brakeHealth
        : component === 'Gearbox'
          ? car.gearboxHealth
          : car.aeroHealth ?? (car.damaged ? 72 : 100);
  return worseCondition(conditionFromHealth(health), conditionFromIssue(car.reliabilityIssue?.type, component, car.reliabilityIssue?.severity));
}

function overallCondition(car: LiveCarState): ConditionLevel {
  return (['Engine', 'Brakes', 'Gearbox', 'Aero'] as const)
    .map((component) => componentCondition(car, component))
    .reduce(worseCondition, 'None' as ConditionLevel);
}

function conditionFromHealth(health: number): ConditionLevel {
  if (health < 55) return 'Critical';
  if (health < 76) return 'Medium';
  if (health < 90) return 'Low';
  return 'None';
}

function conditionFromIssue(type: ReliabilityIssueType | undefined, component: ComponentKey, severity?: 'Minor' | 'Moderate' | 'Severe'): ConditionLevel {
  if (!type || !severity || !issueTouchesComponent(type, component)) return 'None';
  if (severity === 'Severe') return 'Critical';
  if (severity === 'Moderate') return 'Medium';
  return 'Low';
}

function issueTouchesComponent(type: ReliabilityIssueType, component: ComponentKey): boolean {
  if (component === 'Engine') return type === 'EngineOverheating' || type === 'CoolingProblem' || type === 'ElectricalGlitch';
  if (component === 'Brakes') return type === 'BrakeIssue' || type === 'HydraulicLeak';
  if (component === 'Gearbox') return type === 'GearboxWarning' || type === 'HydraulicLeak';
  return type === 'SuspensionConcern' || type === 'TireVibration';
}

function riskCondition(level: LiveCarState['reliabilityRiskLevel']): ConditionLevel {
  if (level === 'Critical' || level === 'High') return 'Critical';
  if (level === 'Medium' || level === 'Elevated') return 'Medium';
  if (level === 'Low') return 'Low';
  return 'None';
}

function worseCondition(a: ConditionLevel, b: ConditionLevel): ConditionLevel {
  const rank: Record<ConditionLevel, number> = { None: 0, Low: 1, Medium: 2, Critical: 3 };
  return rank[b] > rank[a] ? b : a;
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

function ordinalText(pos: number): string {
  const suffix = pos % 10 === 1 && pos % 100 !== 11 ? 'st' : pos % 10 === 2 && pos % 100 !== 12 ? 'nd' : pos % 10 === 3 && pos % 100 !== 13 ? 'rd' : 'th';
  return `${pos}${suffix}`;
}

// Player-selectable modes in the mockup's display order: REL first, ATTK last.
const DISPLAY_MODES: PaceMode[] = ['ProtectEngine', 'Conservative', 'Balanced', 'Defend', 'Push', 'Attack'];

function modeLabel(mode: PaceMode): string {
  switch (mode) {
    case 'ProtectEngine':
      return 'REL';
    case 'Conservative':
      return 'CON';
    case 'Balanced':
      return 'BAL';
    case 'Defend':
      return 'DEF';
    case 'Push':
      return 'PUSH';
    case 'Attack':
      return 'ATTK';
  }
}

function formatElapsed(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Per-driver decision-outcome notes for the Driver Focus strip. Notes are
// recorded by the decision button handlers (resolved recommendations are
// removed from state, so outcomes can't be read back from rec status). A
// pending recommendation that disappears without a recorded decision is an
// expired countdown. Each note stays visible for two laps.
function useDecisionOutcomes(
  recs: AnalyticsRecommendation[],
  currentLap: number,
): {
  outcomes: Record<string, string>;
  recordOutcome: (rec: AnalyticsRecommendation, text: string) => void;
} {
  const [notes, setNotes] = useState<Record<string, { text: string; lap: number }>>({});
  const [handledIds, setHandledIds] = useState<ReadonlySet<string>>(new Set());
  const [prevPending, setPrevPending] = useState<Array<{ id: string; driverId: string; label: string }>>([]);

  const pending = recs.filter((r) => r.status === 'pending' && r.priority !== 'low');
  const pendingKey = pending.map((r) => r.id).join('|');
  if (pendingKey !== prevPending.map((r) => r.id).join('|')) {
    const expired = prevPending.filter(
      (prev) => !pending.some((r) => r.id === prev.id) && !handledIds.has(prev.id),
    );
    if (expired.length > 0) {
      setNotes((n) => {
        const next = { ...n };
        for (const e of expired) next[e.driverId] = { text: `No response \u2014 ${e.label} request expired; no change`, lap: currentLap };
        return next;
      });
    }
    setPrevPending(pending.map((r) => ({ id: r.id, driverId: r.driverId, label: r.action.label })));
  }

  const recordOutcome = (rec: AnalyticsRecommendation, text: string) => {
    setHandledIds((ids) => new Set(ids).add(rec.id));
    setNotes((n) => ({ ...n, [rec.driverId]: { text, lap: currentLap } }));
  };

  const outcomes: Record<string, string> = {};
  for (const [driverId, note] of Object.entries(notes)) {
    if (currentLap <= note.lap + 2) outcomes[driverId] = note.text;
  }
  return { outcomes, recordOutcome };
}

// Rolling per-driver lap-time history used by the pace-trend sparklines.
// Uses the render-phase "adjust state when props change" pattern so a new
// sample is captured exactly once per lap.
function useLapHistory(currentLap: number, cars: LiveCarState[]): Record<string, number[]> {
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [prevLap, setPrevLap] = useState(currentLap);
  if (prevLap !== currentLap) {
    setPrevLap(currentLap);
    const next: Record<string, number[]> = { ...history };
    for (const car of cars) {
      if (car.lastLapTime > 0) {
        const arr = [...(next[car.driverId] ?? []), car.lastLapTime];
        next[car.driverId] = arr.slice(-5);
      }
    }
    setHistory(next);
    return next;
  }
  return history;
}

const TREND_COLORS = ['#00d078', '#ff4040'];

function TelemetrySectorTimes({
  cars,
  nameOf,
}: {
  cars: LiveCarState[];
  nameOf: (driverId: string) => string;
}) {
  return (
    <RetroPanel title="Telemetry / Sector Times" className="h-full min-h-0" compactHeader>
      <div className="h-[calc(100%-21px)] overflow-y-auto px-1.5 py-0.5 text-[10px] leading-tight">
        <div className="grid grid-cols-2 gap-1.5">
          {cars.map((car) => (
            <SectorTable
              key={car.driverId}
              car={car}
              other={cars.find((c) => c.driverId !== car.driverId) ?? null}
              name={shortName(nameOf(car.driverId)).toUpperCase()}
            />
          ))}
        </div>
      </div>
    </RetroPanel>
  );
}

function DriverPaceTrend({ values, color }: { values: number[]; color: string }) {
  const spread = values.length >= 2 ? Math.max(0.5, (Math.max(...values) - Math.min(...values)) / 2) : 0.5;
  return (
    <div className="w-[46%] shrink-0 rounded border border-zinc-800 bg-zinc-950/55 p-1">
      <div className="truncate text-[8px] font-bold uppercase tracking-wide text-amber-300">Pace Trend (Last 5 Laps)</div>
      <div className="mt-0.5 flex items-stretch gap-1">
        <div className="min-w-0 flex-1">
          <div className="pr-3">
            <Sparkline values={values} color={color} className="h-8 w-full" />
          </div>
        </div>
        <div className="flex shrink-0 flex-col justify-between border-l border-dashed border-zinc-600 py-0.5 pl-1 text-right text-[8px] tabular-nums text-zinc-300">
          <span>+{spread.toFixed(1)}s</span>
          <span>+{(spread / 2).toFixed(1)}s</span>
          <span>-{spread.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}

function SectorTable({ car, other, name }: { car: LiveCarState; other: LiveCarState | null; name: string }) {
  const sectors = car.lastSectors ?? [];
  const otherSectors = other?.lastSectors ?? [];
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/55 px-1 py-0.5">
      <div className="truncate text-[9px] font-bold uppercase text-amber-300">{name}</div>
      <table className="w-full text-[9px] leading-tight tabular-nums">
        <tbody>
          {[0, 1, 2].map((i) => {
            const time = sectors[i];
            const delta = time != null && otherSectors[i] != null ? time - otherSectors[i] : null;
            return (
              <tr key={i}>
                <td className="text-zinc-500">S{i + 1}</td>
                <td className="text-right text-zinc-200">{time != null ? time.toFixed(3) : '-'}</td>
                <td className={`text-right ${delta == null ? 'text-zinc-600' : delta <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}` : '-'}
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="text-zinc-500">BEST</td>
            <td colSpan={2} className="text-right text-emerald-400">{car.bestLap ? fmtLap(car.bestLap) : '-'}</td>
          </tr>
          <tr>
            <td className="text-zinc-500">LAST</td>
            <td colSpan={2} className="text-right text-zinc-200">{car.lastLapTime > 0 ? fmtLap(car.lastLapTime) : '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Sparkline({ values, color, className = 'h-5' }: { values: number[]; color: string; className?: string }) {
  const width = 220;
  const height = 24;
  let points: string;
  const verticals = values.map((_, i) => ({
    x: values.length < 2 ? width / 2 : (i / (values.length - 1)) * width,
  }));
  if (values.length < 2) {
    points = `0,${height / 2} ${width},${height / 2}`;
  } else {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 0.05);
    points = values
      .map((v, i) => `${(i / (values.length - 1)) * width},${4 + ((v - min) / range) * (height - 8)}`)
      .join(' ');
  }
  return (
    <svg className={`min-w-0 flex-1 ${className}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {verticals.map(({ x }, index) => (
        <line key={index} x1={x} y1={4} x2={x} y2={height - 4} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      ))}
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function CountdownBar({
  secondsLeft,
  className = '',
  compact = false,
}: {
  secondsLeft: number;
  className?: string;
  compact?: boolean;
}) {
  const frac = Math.max(0, Math.min(1, secondsLeft / DECISION_COUNTDOWN_SECONDS));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`relative min-w-0 flex-1 overflow-hidden rounded-sm bg-zinc-800 ${compact ? 'h-1.5' : 'h-2.5'}`}>
        <div
          className="h-full bg-amber-400 transition-[width] duration-1000 ease-linear"
          style={{ width: `${frac * 100}%` }}
        />
      </div>
      <span className={`shrink-0 font-bold tabular-nums text-amber-300 ${compact ? 'text-[9px]' : 'text-[11px]'}`}>{secondsLeft} s</span>
    </div>
  );
}
