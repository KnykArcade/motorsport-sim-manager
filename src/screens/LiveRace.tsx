import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import {
  buildLiveRaceMeta,
  buildLiveRaceOptions,
  buildRaceContext,
} from '../game/raceSetup';
import { createLiveRace, finalizeResults } from '../sim/liveRaceEngine';
import {
  requestPlayerPit,
  resolvePrompt,
  stepLiveRace,
  stepLiveRaceToEnd,
} from '../sim/raceTickEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RaceTrack2D, type TrackDot } from '../components/RaceTrack2D';
import type { LiveCarState, LiveRaceState, PaceMode } from '../types/liveTypes';
import type { RaceDecision } from '../types/simTypes';

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
  const committed = useRef(false);

  // Playback loop — steps a lap on an interval while playing, paused on prompts.
  useEffect(() => {
    if (!engine || !live) return;
    if (!playing || live.pendingPrompt || live.phase === 'finished') return;
    const id = setInterval(() => {
      setLive((s) => (s && !s.pendingPrompt && s.phase !== 'finished' ? stepLiveRace(s, engine.meta) : s));
    }, 950 / speed);
    return () => clearInterval(id);
  }, [engine, live, playing, speed]);

  if (!state || !engine || !live) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-400">No live race in progress.</p>
        <Button variant="primary" onClick={() => navigate('/weekend')}>Back to Weekend</Button>
      </div>
    );
  }

  const race = state.calendar.find((r) => r.id === raceId);
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
  const pitNow = (driverId: string) =>
    setLive((s) => (s ? requestPlayerPit(s, driverId) : s));

  const finishRace = () => {
    if (committed.current) {
      navigate(`/results/${raceId}`);
      return;
    }
    const { results, events, breakdowns } = finalizeResults(live, engine.context);
    committed.current = true;
    dispatch({ type: 'COMMIT_LIVE_RACE', results, events, breakdowns });
    navigate(`/results/${raceId}`);
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
  const playerCars = live.cars
    .filter((c) => c.isPlayer)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));

  // Race-wide analytics for the info strip.
  const leader = live.cars.find((c) => (c.running || c.status === 'Finished') && c.position === 1);
  const fastest = live.cars.reduce<LiveCarState | null>(
    (best, c) => (c.bestLap != null && (best?.bestLap == null || c.bestLap < best.bestLap) ? c : best),
    null,
  );
  const runningCount = live.cars.filter((c) => c.running).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">{race?.gpName ?? 'Live Race'}</h1>
          <p className="text-sm text-neutral-400">{race?.trackName} · Live Race</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/hq')}>Exit to HQ</Button>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Lap" value={`${Math.min(live.currentLap, live.totalLaps)} / ${live.totalLaps}`} />
        <Stat label="Status" value={finished ? 'Finished' : live.safetyCar.active ? 'Safety Car' : 'Racing'}
          tone={live.safetyCar.active ? 'warn' : finished ? 'good' : 'normal'} />
        <Stat label="Weather" value={live.weather.label} tone={live.weather.wet ? 'warn' : 'normal'} />
        <Stat label="Safety Car" value={live.safetyCar.active ? `Out (${live.safetyCar.lapsRemaining})` : 'No'}
          tone={live.safetyCar.active ? 'warn' : 'normal'} />
      </div>

      {/* Race analytics strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Leader" value={leader ? driverName(leader.driverId) : '—'} />
        <Stat
          label="Fastest Lap"
          value={fastest?.bestLap != null ? `${driverName(fastest.driverId)} ${fmtLap(fastest.bestLap)}` : '—'}
          tone={fastest?.isPlayer ? 'good' : 'normal'}
        />
        <Stat label="Cars Running" value={`${runningCount} / ${live.cars.length}`}
          tone={runningCount < live.cars.length ? 'warn' : 'normal'} />
        <Stat label="Track" value={live.weather.wet ? 'Wet' : 'Dry'} tone={live.weather.wet ? 'warn' : 'good'} />
      </div>

      {/* Your drivers' current race positions */}
      {playerCars.length > 0 && (
        <div className={`grid gap-3 grid-cols-1 ${playerCars.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {playerCars.map((c) => {
            const name = state.drivers.find((d) => d.id === c.driverId)?.name ?? c.driverId;
            const dnf = !c.running && c.status !== 'Finished';
            const posLabel = dnf
              ? 'OUT'
              : c.pit.inPitThisLap
              ? 'PIT'
              : ordinal(c.position);
            return (
              <Stat
                key={c.driverId}
                label={`${name} — Position`}
                value={posLabel}
                tone={dnf ? 'warn' : 'good'}
              />
            );
          })}
        </div>
      )}

      {/* Controls */}
      <Panel title="Race Control">
        <div className="flex flex-wrap items-center gap-2">
          {!finished ? (
            <>
              <Button variant={playing ? 'ghost' : 'primary'} onClick={() => setPlaying((p) => !p)} disabled={!!live.pendingPrompt}>
                {playing ? '❚❚ Pause' : '▶ Play'}
              </Button>
              <Button variant="ghost" onClick={step} disabled={playing || !!live.pendingPrompt}>⏭ Step Lap</Button>
              <div className="ml-2 flex items-center gap-1">
                {([1, 2, 4] as Speed[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`rounded px-2.5 py-1 text-xs font-semibold ${
                      speed === s ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
              <Button variant="ghost" onClick={skipToEnd} disabled={!!live.pendingPrompt}>⏩ Skip to End</Button>
            </>
          ) : (
            <Button variant="primary" onClick={finishRace}>Post-Race Report →</Button>
          )}
        </div>
        {live.pendingPrompt && (
          <p className="mt-2 text-xs font-semibold text-amber-300">Race paused — make a decision below.</p>
        )}
      </Panel>

      {/* Decision prompt */}
      {live.pendingPrompt && (
        <DecisionPanel
          title={live.pendingPrompt.title}
          driver={driverName(live.pendingPrompt.driverId)}
          description={live.pendingPrompt.description}
          options={live.pendingPrompt.options.map((o) => ({ id: o.id, label: o.label, detail: o.detail }))}
          onChoose={chooseOption}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Track Map">
            <RaceTrack2D dots={dots} rotation={rotation} />
            <p className="mt-1 text-center text-xs text-neutral-500">
              Player cars are outlined in white. Simplified layout — dots are ordered by race position.
            </p>
          </Panel>

          <Panel title="Running Order">
            <RunningOrder
              cars={live.cars}
              nameOf={driverName}
              colorOf={teamColor}
            />
          </Panel>
        </div>

        <div className="space-y-5">
          {playerCars.length > 0 && (
            <Panel title="Pit Wall — Telemetry">
              <div className="space-y-3">
                {playerCars.map((c) => (
                  <TelemetryCard key={c.driverId} car={c} name={driverName(c.driverId)} />
                ))}
              </div>
            </Panel>
          )}
          {playerCars.length > 0 && (
            <Panel title="Pit Strategy">
              <div className="space-y-3">
                {playerCars.map((c) => (
                  <PitStrategyCard
                    key={c.driverId}
                    car={c}
                    name={driverName(c.driverId)}
                    currentLap={live.currentLap}
                    finished={finished}
                    onPit={() => pitNow(c.driverId)}
                  />
                ))}
              </div>
            </Panel>
          )}
          <Panel title="Event Log">
            <EventLog events={live.events} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

// Format a lap time in seconds as M:SS.mmm (or SS.mmm under a minute).
function fmtLap(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function TelemetryCard({ car, name }: { car: LiveCarState; name: string }) {
  const finishedRace = car.status === 'Finished';
  const dnf = !car.running && !finishedRace;
  const wear = Math.round(car.tire.wear);
  const wearTone = wear > 80 ? 'text-red-300' : wear > 55 ? 'text-amber-300' : 'text-green-300';
  // Rough laps-to-cliff estimate from the per-lap degradation rate.
  const lapsLeft =
    car.tireDegRate > 0 ? Math.max(0, Math.round((90 - car.tire.wear) / car.tireDegRate)) : null;
  const relPct = Math.round(Math.min(1, car.reliabilityRisk * (car.lapsCompleted || 1)) * 100);
  const gridDelta = car.position != null ? car.grid - car.position : 0;

  if (dnf) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-100">{name}</span>
          <span className="text-xs font-medium text-red-400">{car.lastIncident ?? 'Out of the race'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-100">{name}</span>
        <span className="text-sm font-semibold tabular-nums text-neutral-100">
          {car.pit.inPitThisLap ? 'IN PIT' : ordinal(car.position)}
          {gridDelta !== 0 && (
            <span className={`ml-1.5 text-xs ${gridDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {gridDelta > 0 ? `▲${gridDelta}` : `▼${-gridDelta}`}
            </span>
          )}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Telem label="Gap to leader" value={car.position === 1 ? 'Leader' : `+${car.gapToLeader.toFixed(1)}s`} />
        <Telem label="Interval" value={car.position === 1 ? '—' : `+${car.interval.toFixed(1)}s`} />
        <Telem label="Last lap" value={car.lastLapTime > 0 ? fmtLap(car.lastLapTime) : '—'} />
        <Telem label="Best lap" value={car.bestLap != null ? fmtLap(car.bestLap) : '—'} />
        <Telem label="Tyre" value={`${car.tire.compound} · ${wear}%`} valueClass={wearTone} />
        <Telem label="Est. laps left" value={lapsLeft != null ? `~${lapsLeft}` : '—'} />
        <Telem label="Pace" value={PACE_LABEL[car.paceMode]} />
        <Telem
          label="Reliability risk"
          value={`${relPct}%`}
          valueClass={relPct > 50 ? 'text-red-300' : relPct > 25 ? 'text-amber-300' : 'text-green-300'}
        />
      </div>
      {car.reliabilityIssue && (
        <p className="mt-2 text-xs font-medium text-amber-300">⚠ {car.reliabilityIssue.label}</p>
      )}
      {car.damaged && !car.reliabilityIssue && (
        <p className="mt-2 text-xs font-medium text-amber-300">⚠ Car damaged</p>
      )}
    </div>
  );
}

function Telem({ label, value, valueClass = 'text-neutral-200' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={`tabular-nums font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

function PitStrategyCard({
  car,
  name,
  currentLap,
  finished,
  onPit,
}: {
  car: LiveCarState;
  name: string;
  currentLap: number;
  finished: boolean;
  onPit: () => void;
}) {
  const w = car.pit.window;
  const stopsLeft = car.pit.plannedStops - car.pit.stopsMade;
  const open = !!w && currentLap >= w.open && currentLap <= w.close;

  let status: { text: string; tone: 'normal' | 'warn' | 'good' };
  if (!car.running) status = { text: 'Out of the race', tone: 'warn' };
  else if (car.pit.pitRequested) status = { text: 'Box, box! Pitting this lap', tone: 'warn' };
  else if (!w || stopsLeft <= 0) status = { text: 'No more stops planned', tone: 'normal' };
  else if (currentLap < w.open) status = { text: `Window opens L${w.open} (in ${w.open - currentLap})`, tone: 'normal' };
  else if (open) status = { text: `WINDOW OPEN — box now (ideal L${w.ideal}, through L${w.close})`, tone: 'good' };
  else status = { text: 'Window closed — stop overdue', tone: 'warn' };

  const canPit = car.running && !car.pit.pitRequested && !finished;
  const toneColor =
    status.tone === 'good' ? 'text-green-300' : status.tone === 'warn' ? 'text-amber-300' : 'text-neutral-300';

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-100">{name}</span>
        <span className="text-xs text-neutral-400">
          Stops {car.pit.stopsMade}/{car.pit.plannedStops} · {car.tire.compound} · wear {Math.round(car.tire.wear)}%
        </span>
      </div>
      <p className={`mt-1 text-xs font-medium ${toneColor}`}>{status.text}</p>
      <Button
        variant={open ? 'primary' : 'ghost'}
        onClick={onPit}
        disabled={!canPit}
        className="mt-2 w-full"
      >
        {car.pit.pitRequested ? 'Boxing…' : '🔧 Pit Now'}
      </Button>
    </div>
  );
}

function Stat({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' | 'good' }) {
  const color = tone === 'warn' ? 'text-amber-300' : tone === 'good' ? 'text-green-300' : 'text-neutral-100';
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`font-semibold ${color}`}>{value}</div>
    </div>
  );
}

const PACE_LABEL: Record<PaceMode, string> = {
  Push: 'Push',
  Balanced: 'Balanced',
  Conserve: 'Conserve',
  Nurse: 'Nurse',
};

function RunningOrder({
  cars,
  nameOf,
  colorOf,
}: {
  cars: LiveCarState[];
  nameOf: (id: string) => string;
  colorOf: (id: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-2 py-1.5">Pos</th>
            <th className="px-2 py-1.5">Driver</th>
            <th className="px-2 py-1.5">Gap</th>
            <th className="px-2 py-1.5">Tyre</th>
            <th className="px-2 py-1.5">Pace</th>
            <th className="px-2 py-1.5">Pits</th>
            <th className="px-2 py-1.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((c, i) => {
            const wearPct = Math.round(c.tire.wear);
            const wearColor = wearPct > 80 ? 'bg-red-500' : wearPct > 55 ? 'bg-amber-500' : 'bg-green-500';
            const finishedRace = c.status === 'Finished';
            const dnf = !c.running && !finishedRace;
            const classified = c.running || finishedRace;
            return (
              <tr
                key={c.driverId}
                className={`border-t border-neutral-800/60 ${c.isPlayer ? 'bg-amber-500/10' : ''} ${dnf ? 'opacity-50' : ''}`}
              >
                <td className="px-2 py-1.5 font-semibold tabular-nums text-neutral-200">
                  {c.position ?? '—'}
                </td>
                <td className="px-2 py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-1 rounded-sm" style={{ backgroundColor: colorOf(c.teamId) }} />
                    {nameOf(c.driverId)}
                  </span>
                </td>
                <td className="px-2 py-1.5 tabular-nums text-neutral-300">
                  {!classified ? '—' : i === 0 ? 'Leader' : `+${c.gapToLeader.toFixed(1)}s`}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500">{c.tire.compound === 'Wet' ? 'W' : 'D'}</span>
                    <span className="h-1.5 w-12 overflow-hidden rounded bg-neutral-800">
                      <span className={`block h-full ${wearColor}`} style={{ width: `${wearPct}%` }} />
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-xs text-neutral-400">
                  {finishedRace ? 'Finished' : c.running ? PACE_LABEL[c.paceMode] : '—'}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-neutral-400">{c.pit.stopsMade}</td>
                <td className="px-2 py-1.5 text-xs">
                  {finishedRace && <span className="text-green-400">✓ Finished</span>}
                  {c.reliabilityIssue && c.running && (
                    <span className="text-amber-300" title={c.reliabilityIssue.label}>⚠ {c.reliabilityIssue.label}</span>
                  )}
                  {dnf && <span className="text-red-400">{c.lastIncident ?? 'DNF'}</span>}
                  {c.running && !c.reliabilityIssue && c.damaged && <span className="text-amber-300">Damaged</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ordinal(pos: number | null): string {
  return pos == null ? '—' : `P${pos}`;
}

function EventLog({ events }: { events: { lap: number; text: string }[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-neutral-500">Lights out — no incidents yet.</p>;
  }
  return (
    <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto">
      {[...events].reverse().map((e, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <span className="w-12 shrink-0 text-xs font-semibold text-neutral-500">L{e.lap}</span>
          <span className="text-neutral-300">{e.text}</span>
        </li>
      ))}
    </ul>
  );
}

function DecisionPanel({
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
    <div className="rounded-lg border-2 border-amber-500/60 bg-amber-500/5 p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">Decision · {driver}</div>
      <h3 className="text-lg font-bold text-neutral-100">{title}</h3>
      <p className="mb-3 text-sm text-neutral-300">{description}</p>
      <div className="grid gap-2 md:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChoose(o.id)}
            className="rounded-lg border border-neutral-700 bg-neutral-900/60 p-3 text-left transition-colors hover:border-amber-500 hover:bg-amber-500/10"
          >
            <div className="text-sm font-semibold text-neutral-100">{o.label}</div>
            <div className="mt-0.5 text-xs text-neutral-400">{o.detail}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
