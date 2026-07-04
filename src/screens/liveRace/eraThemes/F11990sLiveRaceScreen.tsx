import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { TrackDot } from '../../../components/RaceTrack2D';
import { TrackMapAssetPanel } from '../../../components/TrackMapAssetPanel';
import { SELECTABLE_MODES, modeSpec } from '../../../sim/liveRacePace';
import type { AnalyticsMonitor } from '../../../sim/analyticsMonitor';
import type { AnalyticsRecommendation, LiveCarState, LiveRaceState, PaceMode, RecAction } from '../../../types/liveTypes';
import type { Race } from '../../../types/gameTypes';
import type { GameState } from '../../../game/careerState';
import { fmtLap, tyreLetter } from '../dashboardFormat';
import { RecommendationsPanel } from '../RecommendationsPanel';
import type { ForecastEntry } from '../forecast';

type Speed = 1 | 2 | 4;

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
  onOpenOrders: () => void;
  onOpenStrategy: () => void;
  onOpenLog: () => void;
  onExit: () => void;
  onFinishRace: () => void;
  onPit: (driverId: string) => void;
  onMode: (driverId: string, mode: PaceMode) => void;
  onAccept: (rec: AnalyticsRecommendation) => void;
  onModify: (rec: AnalyticsRecommendation, action: RecAction) => void;
  onIgnore: (rec: AnalyticsRecommendation) => void;
  onLetCrewDecide: (rec: AnalyticsRecommendation) => void;
  onAcceptAll: () => void;
  onIgnoreAll: () => void;
};

export function F11990sLiveRaceScreen({
  state,
  race,
  live,
  dots,
  rotation,
  playerCars,
  forecast,
  monitor,
  activeRecs,
  needsDecision,
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
  onOpenStrategy,
  onOpenLog,
  onExit,
  onFinishRace,
  onPit,
  onMode,
  onAccept,
  onModify,
  onIgnore,
  onLetCrewDecide,
  onAcceptAll,
  onIgnoreAll,
}: Props) {
  const finished = live.phase === 'finished';
  const focusCars = driverFocusCars(playerCars, live.cars);
  const leader = live.cars.find((c) => c.position === 1 && (c.running || c.status === 'Finished'));
  const raceTime = formatElapsed(leader?.totalTime ?? 0);
  const airTemp = forecast[0]?.temp ?? (live.weather.wet ? 18 : 22);
  const trackTemp = airTemp + (live.weather.wet ? 2 : 6);
  const canAdvance = !live.pendingPrompt && !needsDecision && !finished;
  const fuelWindow = playerCars[0]
    ? `Lap ${Math.max(1, live.currentLap)} - Lap ${Math.min(live.totalLaps, Math.ceil((playerCars[0].fuel / 100) * live.totalLaps))}`
    : 'N/A';
  const alert = raceAlert(live, forecast);

  return (
    <div
      data-testid="f1-1990s-live-race-screen"
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#080b0c] font-mono text-zinc-100"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(252,211,77,0.12),transparent_24%),linear-gradient(180deg,rgba(7,11,13,0.12),rgba(7,11,13,0.88))]" />
      <RetroTopBar
        season={state.seasonYear}
        raceName={race?.gpName ?? 'Live Race'}
        trackName={race?.trackName ?? live.trackId}
        lap={`${Math.min(live.currentLap, live.totalLaps)} / ${live.totalLaps}`}
        raceTime={raceTime}
        airTemp={airTemp}
        trackTemp={trackTemp}
        weather={live.weather.label}
      />

      <main className="relative grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[minmax(285px,0.84fr)_minmax(420px,1.8fr)_minmax(280px,0.82fr)]">
        <aside className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto_128px] gap-2">
          <RetroTimingTower cars={live.cars} nameOf={nameOf} colorOf={colorOf} />
          <div className="grid gap-2">
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
              onOpenOrders={onOpenOrders}
            />
            <CameraControls />
          </div>
          <RetroEventLog events={live.events} onOpenFull={onOpenLog} />
        </aside>

        <section className="relative min-h-[360px] overflow-hidden rounded-md border border-amber-500/35 bg-[#10140f] shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]">
          <ScenicTrack cars={live.cars} colorOf={colorOf} />
          <RetroTrackMap
            series={state.series}
            year={state.seasonYear}
            trackId={race?.trackId ?? live.trackId}
            trackName={race?.trackName ?? live.trackId}
            dots={dots}
            rotation={rotation}
          />
        </section>

        <aside className="grid min-h-0 grid-rows-[minmax(220px,260px)_minmax(104px,0.72fr)_minmax(104px,0.72fr)] gap-2 overflow-hidden">
          {!finished && (
            <RecommendationsPanel
              recs={activeRecs}
              monitor={monitor}
              currentLap={live.currentLap}
              decisionSecondsLeft={needsDecision ? decisionSecondsLeft : null}
              nameOf={nameOf}
              onAccept={onAccept}
              onModify={onModify}
              onIgnore={onIgnore}
              onLetCrewDecide={onLetCrewDecide}
              onAcceptAll={onAcceptAll}
              onIgnoreAll={onIgnoreAll}
              className="h-full min-h-0 rounded-md border-amber-500/35 bg-black/70"
            />
          )}
          {focusCars.map((car, index) => (
            <DriverFocus
              key={`${car.driverId}-${index}`}
              car={car}
              name={nameOf(car.driverId)}
              team={teamNameOf(car.teamId)}
              className="min-h-0"
              finished={finished}
              onPit={() => onPit(car.driverId)}
              onMode={(mode) => onMode(car.driverId, mode)}
            />
          ))}
        </aside>
      </main>

      <footer className="relative grid shrink-0 gap-2 px-2 pb-2 lg:grid-cols-[1.15fr_1fr_0.82fr_0.82fr]">
        <RetroPanel title={alert ? 'Track Alert' : 'Commentary'} className={alert ? 'animate-pulse border-yellow-300 bg-yellow-300 text-black' : ''}>
          <div className={`space-y-1 p-2 text-[12px] ${alert ? 'font-black uppercase text-black' : 'text-zinc-200'}`}>
            {alert && <p className="text-lg leading-tight">{alert}</p>}
            <p>{commentaryLine(live, nameOf)}</p>
            <p>{live.safetyCar.active ? `Safety car is out: ${live.safetyCar.reason ?? 'race control incident'}.` : 'Race control reports green running conditions.'}</p>
          </div>
        </RetroPanel>
        <RetroPanel title="Team Radio">
          <div className="space-y-1 p-2 text-[12px]">
            {playerCars.slice(0, 2).map((car) => (
              <div key={car.driverId}>
                <span className="text-amber-300">{shortName(nameOf(car.driverId)).toUpperCase()}:</span>{' '}
                <span className="text-zinc-200">"{radioLine(car)}"</span>
              </div>
            ))}
          </div>
        </RetroPanel>
        <RetroPanel title="Pit Window">
          <div className="p-2 text-[12px]">
            <div className="font-bold uppercase text-emerald-400">Monitoring</div>
            <div className="mt-1 space-y-1 text-zinc-200">
              {playerCars.map((car) => (
                <div key={car.driverId} className="flex items-center justify-between gap-2">
                  <span className="truncate">{shortName(nameOf(car.driverId)).toUpperCase()}</span>
                  <span className="shrink-0 tabular-nums">
                    Stops: {car.pit.stopsMade}/{car.pit.plannedStops}
                    {car.pit.lastPitLap != null ? ` (L${car.pit.lastPitLap})` : ''}
                  </span>
                </div>
              ))}
              {playerCars.length === 0 && <div>No planned stop</div>}
            </div>
            <button onClick={onOpenStrategy} className="mt-2 rounded border border-amber-500/50 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-500/10">
              Strategy Desk
            </button>
          </div>
        </RetroPanel>
        <RetroPanel title="Fuel Window">
          <div className="p-2 text-[12px] text-zinc-200">
            <div>{fuelWindow}</div>
            <div className="mt-2 text-[10px] uppercase text-zinc-500">{live.weather.wet ? 'Wet pace fuel map' : 'Dry pace fuel map'}</div>
            <button onClick={onExit} className="mt-2 rounded border border-zinc-600 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800">
              Exit Race
            </button>
          </div>
        </RetroPanel>
      </footer>

      <div className="sr-only" aria-live="polite">
        1990s F1 live race screen. Lap {live.currentLap} of {live.totalLaps}. {activeRecs.length} pit wall recommendations.
      </div>
    </div>
  );
}

function RetroTopBar({
  season,
  raceName,
  trackName,
  lap,
  raceTime,
  airTemp,
  trackTemp,
  weather,
}: {
  season: number;
  raceName: string;
  trackName: string;
  lap: string;
  raceTime: string;
  airTemp: number;
  trackTemp: number;
  weather: string;
}) {
  return (
    <header className="relative grid shrink-0 grid-cols-[1fr_1.35fr_auto_0.8fr_0.8fr_0.8fr_0.9fr] items-center overflow-hidden rounded-b-md border border-amber-500/25 bg-black/85 text-zinc-100 shadow-lg max-lg:grid-cols-2">
      <div className="border-r border-zinc-700/70 px-4 py-2">
        <div className="text-2xl font-black uppercase italic tracking-wide text-amber-400">1990s Era</div>
        <div className="text-sm font-bold text-amber-300">{season} Season</div>
      </div>
      <div className="border-r border-zinc-700/70 px-4 py-2">
        <div className="truncate text-lg font-bold uppercase tracking-wide">{raceName}</div>
        <div className="truncate text-sm uppercase text-zinc-300">{trackName}</div>
      </div>
      <div className="mx-3 rounded border border-amber-500 px-8 py-2 text-center text-2xl font-black uppercase text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.14)] max-lg:m-2">
        Lap {lap}
      </div>
      <TopMetric label="Race Time" value={raceTime} />
      <TopMetric label="Air Temp" value={`${airTemp}C`} />
      <TopMetric label="Track Temp" value={`${trackTemp}C`} />
      <TopMetric label="Weather" value={weather} />
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
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-md border border-amber-500/30 bg-black/72 shadow-[0_0_18px_rgba(0,0,0,0.38)] ${className}`}>
      <div className="border-b border-zinc-700/70 px-3 py-2 text-sm font-bold uppercase tracking-wide text-amber-300">
        {title}
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
  return (
    <RetroPanel title="Live Timing" className="min-h-0">
      <div className="grid grid-cols-[26px_1fr_50px_28px_52px] border-b border-zinc-800 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-300">
        <span>Pos</span>
        <span>Driver</span>
        <span className="text-right">Gap</span>
        <span className="text-right">Pits</span>
        <span className="text-right">Tyre</span>
      </div>
      <div className="max-h-full overflow-y-auto pb-1">
        {cars.map((car) => {
          const tyre = tyreLetter(car.tire.compound);
          const life = Math.max(0, 100 - Math.round(car.tire.wear));
          return (
            <div
              key={car.driverId}
              className={`grid grid-cols-[26px_1fr_50px_28px_52px] items-center px-2 py-[2px] text-[10px] leading-tight ${
                car.isPlayer ? 'bg-amber-500/22 text-amber-200' : 'text-zinc-100'
              } ${!car.running && car.status !== 'Finished' ? 'opacity-45' : ''}`}
            >
              <span className="tabular-nums">{car.position ?? '-'}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2.5 w-1 shrink-0 rounded-sm" style={{ backgroundColor: colorOf(car.teamId) }} />
                <span className="truncate">{shortName(nameOf(car.driverId)).toUpperCase()}</span>
              </span>
              <span className="text-right tabular-nums text-zinc-300">{car.position === 1 ? 'LEADER' : `+${car.gapToLeader.toFixed(1)}`}</span>
              <span className="text-right tabular-nums">{car.pit.stopsMade}</span>
              <span className="text-right font-bold tabular-nums text-amber-300">{tyre.letter} {life}%</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-zinc-800 px-3 py-1 text-[10px] uppercase text-zinc-300">
        D = Dry&nbsp;&nbsp;&nbsp; W = Wet&nbsp;&nbsp;&nbsp; % = Tyre life
      </div>
    </RetroPanel>
  );
}

function RetroEventLog({ events, onOpenFull }: { events: LiveRaceState['events']; onOpenFull: () => void }) {
  const [tab, setTab] = useState<'Incidents' | 'Battles' | 'Status'>('Incidents');
  const filtered = events.filter((event) => retroEventBucket(event) === tab).slice(-4);
  return (
    <RetroPanel title="Race Events" className="h-full min-h-0">
      <div className="flex border-b border-zinc-800 px-2 py-1">
        {(['Incidents', 'Battles', 'Status'] as const).map((item) => (
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
      <div className="space-y-0.5 p-2 text-[10px]">
        {filtered.slice().reverse().map((event, index) => (
          <div key={`${event.lap}-${index}`} className="flex gap-2">
            <span className="shrink-0 text-zinc-400">Lap {event.lap}</span>
            <span className="line-clamp-1 text-zinc-200">{event.text}</span>
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

function CameraControls() {
  return (
    <RetroPanel title="Camera Controls">
      <div className="grid grid-cols-[74px_1fr] gap-2 p-2 text-[10px] text-zinc-300">
        <div className="grid grid-cols-3 gap-1">
          {['', '^', '', '<', 'o', '>', '', 'v', ''].map((label, i) => (
            <span key={i} className="flex h-4 items-center justify-center rounded border border-zinc-700 bg-zinc-900/80 text-zinc-400">
              {label}
            </span>
          ))}
        </div>
        <div className="flex flex-col justify-center gap-2">
          <div className="uppercase">Rotate</div>
          <div className="uppercase">Zoom</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <span key={n} className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px]">{n}</span>
            ))}
          </div>
        </div>
      </div>
    </RetroPanel>
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
  onOpenOrders,
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
  onOpenOrders: () => void;
}) {
  return (
    <RetroPanel title="Real-Time Mode">
      <div className="p-2">
        {finished ? (
          <button onClick={onFinishRace} className="w-full rounded border border-amber-500 bg-amber-400 px-4 py-2 font-black uppercase text-black hover:bg-amber-300">
            Post-Race Report
          </button>
        ) : (
          <>
            <div className="grid grid-cols-6 gap-1">
              <button onClick={onTogglePlay} disabled={!canAdvance} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-base font-bold hover:border-amber-400 disabled:opacity-40">
                {playing ? 'II' : '>'}
              </button>
              <button onClick={onStep} disabled={!canAdvance || playing} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs font-bold hover:border-amber-400 disabled:opacity-40">
                +1
              </button>
              {([1, 2, 4] as Speed[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onSpeed(s)}
                  className={`rounded border px-2 py-1.5 text-xs font-bold ${speed === s ? 'border-amber-400 bg-amber-400/20 text-amber-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-amber-400'}`}
                >
                  {s}x
                </button>
              ))}
              <button onClick={onSkipToEnd} disabled={!canAdvance} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs font-bold hover:border-amber-400 disabled:opacity-40">
                End
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
              <span>1x = lap time pacing</span>
              <button onClick={onOpenOrders} className="text-amber-300 hover:text-amber-200">Team orders</button>
            </div>
          </>
        )}
      </div>
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
}: {
  series?: string;
  year?: number;
  trackId?: string;
  trackName?: string;
  dots: TrackDot[];
  rotation: number;
}) {
  return (
    <div className="absolute left-2 top-2 z-10 h-[330px] w-[520px] max-xl:h-[292px] max-xl:w-[462px] max-lg:hidden">
      <RetroPanel title="Track Map" className="h-full bg-black/78 backdrop-blur-[1px]">
        <div className="flex h-[calc(100%-37px)] flex-col">
          <div className="min-h-0 flex-1 px-2 py-1.5">
            <TrackMapAssetPanel
              series={series}
              year={year}
              trackId={trackId}
              trackName={trackName}
              dots={dots}
              rotation={rotation}
              eraTheme="f1-1990s"
              className="h-full w-full"
            />
          </div>
          <div className="grid grid-cols-3 border-t border-zinc-700/60 text-center text-[9px]">
            <LegendDot color="bg-yellow-400" label="Speed trap" />
            <LegendDot color="bg-sky-400" label="Split timing" />
            <LegendDot color="bg-red-500" label="Yellow zone" />
          </div>
        </div>
      </RetroPanel>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1 px-1 py-1 uppercase text-zinc-400">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function DriverFocus({
  car,
  name,
  team,
  finished,
  onPit,
  onMode,
  className = '',
}: {
  car: LiveCarState;
  name: string;
  team: string;
  finished: boolean;
  onPit: () => void;
  onMode: (mode: PaceMode) => void;
  className?: string;
}) {
  const tyre = tyreLetter(car.tire.compound);
  const canPit = car.running && !car.pit.pitRequested && !finished;
  return (
    <RetroPanel title={`Driver Focus ${car.isPlayer ? '- Player' : ''}`} className={`h-full overflow-hidden ${className}`}>
      <div className="p-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded border border-zinc-600 px-1.5 py-0.5 text-sm font-bold">{car.position ?? '-'}</span>
              <div>
                <div className="text-[12px] font-bold uppercase leading-tight">{shortName(name)}</div>
                <div className="text-[10px] uppercase leading-tight text-zinc-400">{team}</div>
              </div>
            </div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-amber-500/40 bg-[radial-gradient(circle_at_50%_35%,#facc15,#92400e_52%,#111827_53%)] text-[8px] font-black text-black">
            HELMET
          </div>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] leading-tight">
          <FocusLine label="Position" value={car.position ? ordinalText(car.position) : 'Out'} />
          <FocusLine label="Gap to leader" value={car.position === 1 ? 'Leader' : `+${car.gapToLeader.toFixed(2)}`} />
          <FocusLine label="Last lap" value={car.lastLapTime > 0 ? fmtLap(car.lastLapTime) : 'N/A'} />
          <FocusLine label="Best lap" value={car.bestLap ? fmtLap(car.bestLap) : 'N/A'} />
          <FocusLine label="Fuel left" value={`${Math.round(car.fuel)}%`} />
          <FocusLine label="Tyre" value={`${tyre.letter} ${Math.max(0, 100 - Math.round(car.tire.wear))}%`} />
        </div>
        {!finished && car.running && (
          <div className="mt-2 rounded border border-zinc-800 bg-zinc-950/55 p-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">Strategy Mode</span>
              <button
                onClick={onPit}
                disabled={!canPit}
                className="rounded border border-amber-500/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300 hover:bg-amber-500/10 disabled:border-zinc-800 disabled:text-zinc-600"
              >
                {car.pit.pitRequested ? 'Boxing' : 'Pit'}
              </button>
            </div>
            <div className="grid grid-cols-6 gap-0.5">
              {SELECTABLE_MODES.map((mode) => (
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
          </div>
        )}
      </div>
    </RetroPanel>
  );
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

function commentaryLine(live: LiveRaceState, nameOf: (driverId: string) => string): string {
  const leader = live.cars.find((c) => c.position === 1);
  const second = live.cars.find((c) => c.position === 2);
  if (!leader) return 'The field is forming up for the start.';
  if (!second) return `${shortName(nameOf(leader.driverId))} leads the field.`;
  return `${shortName(nameOf(leader.driverId))} leads ${shortName(nameOf(second.driverId))} by ${second.gapToLeader.toFixed(1)} seconds.`;
}

function raceAlert(live: LiveRaceState, forecast: ForecastEntry[]): string | null {
  if (live.safetyCar.active) return 'Safety Car';
  if (live.weather.wet) return live.weather.condition === 'HeavyRain' ? 'Heavy Rain' : 'Wet Track';
  if (live.weather.changingSoon || forecast.slice(0, 3).some((entry) => entry.wet)) return 'Rain Approaching';
  const urgent = live.recommendations.find((rec) => rec.status === 'pending' && rec.priority === 'urgent');
  if (urgent) return 'Pit Wall Alert';
  return null;
}

function radioLine(car: LiveCarState): string {
  if (!car.running && car.status !== 'Finished') return car.lastIncident ?? 'We are out of the race.';
  if (car.reliabilityIssue) return `${car.reliabilityIssue.label} warning. Manage the car.`;
  if (car.pit.window && car.pit.window.open <= car.lapsCompleted + 1) return 'Box this lap if traffic allows.';
  if (car.tire.wear > 65) return 'Rear tyres are starting to fade.';
  return 'Car is good. Balance is stable.';
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

function modeLabel(mode: PaceMode): string {
  switch (mode) {
    case 'Conservative':
      return 'Cons';
    case 'Balanced':
      return 'Bal';
    case 'ProtectEngine':
      return 'Eng';
    default:
      return mode.slice(0, 4);
  }
}

function formatElapsed(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
