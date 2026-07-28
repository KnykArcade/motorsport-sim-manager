import type { ReactNode } from 'react';
import type { AnalyticsMonitor } from '../../sim/analyticsMonitor';
import { kindLabel } from '../../sim/analyticsMonitor';
import { PIT_INTENSITY_ORDER } from '../../sim/pitIntensityData';
import type {
  AnalyticsRecommendation,
  LiveCarState,
  LiveRaceState,
  PaceMode,
  PitIntensity,
} from '../../types/liveTypes';
import type {
  LiveRaceDelegationProfile,
  LiveRacePanelId,
  LiveRaceWorkspacePreferences,
} from './liveRaceWorkspaceModel';
import {
  LIVE_RACE_PANEL_LABELS,
  buildEngineerCheckpointSummary,
  buildLiveRaceStrategyProjection,
  moveLiveRacePanel,
} from './liveRaceWorkspaceModel';

type SetPreferences = (
  update: LiveRaceWorkspacePreferences
    | ((current: LiveRaceWorkspacePreferences) => LiveRaceWorkspacePreferences),
) => void;

export function LiveRaceWorkspaceToolbar({
  preferences,
  delegation,
  autoPauseNotice,
  onPreferences,
  onReset,
}: {
  preferences: LiveRaceWorkspacePreferences;
  delegation: LiveRaceDelegationProfile;
  autoPauseNotice: string | null;
  onPreferences: SetPreferences;
  onReset: () => void;
}) {
  return (
    <div className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-500/25 bg-black/88 px-3 py-1.5 text-[10px]">
      <div className="flex items-center gap-1">
        <span className="mr-1 font-black uppercase tracking-[0.16em] text-zinc-500">Race workspace</span>
        {(['track', 'data'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onPreferences((current) => ({ ...current, viewMode: mode }))}
            aria-pressed={preferences.viewMode === mode}
            className={`rounded border px-2 py-1 font-black uppercase ${
              preferences.viewMode === mode
                ? 'border-amber-400 bg-amber-400 text-black'
                : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-amber-400'
            }`}
          >
            {mode === 'track' ? 'Track View' : 'Data View'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPreferences((current) => ({
            ...current,
            strategyDrawerOpen: !current.strategyDrawerOpen,
          }))}
          aria-expanded={preferences.strategyDrawerOpen}
          className="rounded border border-amber-500/55 bg-amber-500/10 px-2 py-1 font-black uppercase text-amber-200 hover:bg-amber-500/20"
        >
          Strategy Drawer
        </button>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        {autoPauseNotice && (
          <span className="truncate rounded border border-sky-500/45 bg-sky-500/10 px-2 py-1 font-semibold text-sky-200">
            {autoPauseNotice}
          </span>
        )}
        <span className={`rounded border px-2 py-1 ${
          delegation.policy === 'staff_execute_routine' && delegation.confidenceLabel !== 'Low'
            ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-200'
            : 'border-zinc-700 bg-zinc-900 text-zinc-400'
        }`}>
          {delegation.owner} · {delegation.confidenceLabel} confidence · {
            delegation.policy === 'staff_execute_routine' ? 'routine calls delegated' : 'calls escalated'
          }
        </span>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-black uppercase text-zinc-300 hover:border-amber-400">
            Customize
          </summary>
          <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded border border-amber-500/40 bg-[#0d0d0d] p-3 shadow-2xl">
            <div className="font-black uppercase tracking-wide text-amber-300">Automatic pauses</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([
                ['incidents', 'Incidents'],
                ['pitWindows', 'Pit windows'],
                ['weatherChanges', 'Weather'],
                ['mechanicalProblems', 'Mechanical'],
                ['engineerMessages', 'Engineer messages'],
              ] as const).map(([id, label]) => (
                <label key={id} className="flex items-center gap-2 text-zinc-300">
                  <input
                    type="checkbox"
                    checked={preferences.autoPause[id]}
                    onChange={(event) => onPreferences((current) => ({
                      ...current,
                      autoPause: { ...current.autoPause, [id]: event.target.checked },
                    }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-3 border-t border-zinc-800 pt-2 font-black uppercase tracking-wide text-amber-300">
              Data View panels
            </div>
            <div className="mt-1 space-y-1">
              {preferences.panelOrder.map((panel, index) => {
                const hidden = preferences.hiddenPanels.includes(panel);
                return (
                  <div key={panel} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-1 rounded bg-zinc-950 px-2 py-1">
                    <label className="flex items-center gap-2 text-zinc-300">
                      <input
                        type="checkbox"
                        checked={!hidden}
                        onChange={() => onPreferences((current) => ({
                          ...current,
                          hiddenPanels: hidden
                            ? current.hiddenPanels.filter((id) => id !== panel)
                            : [...current.hiddenPanels, panel],
                        }))}
                      />
                      {LIVE_RACE_PANEL_LABELS[panel]}
                    </label>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => onPreferences((current) => ({
                        ...current,
                        panelOrder: moveLiveRacePanel(current.panelOrder, panel, -1),
                      }))}
                      aria-label={`Move ${LIVE_RACE_PANEL_LABELS[panel]} earlier`}
                      className="px-1 text-zinc-400 disabled:opacity-25"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === preferences.panelOrder.length - 1}
                      onClick={() => onPreferences((current) => ({
                        ...current,
                        panelOrder: moveLiveRacePanel(current.panelOrder, panel, 1),
                      }))}
                      aria-label={`Move ${LIVE_RACE_PANEL_LABELS[panel]} later`}
                      className="px-1 text-zinc-400 disabled:opacity-25"
                    >
                      ↓
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={onReset}
              className="mt-3 w-full rounded border border-zinc-700 px-2 py-1 font-bold uppercase text-zinc-300 hover:border-amber-400"
            >
              Reset Live Race layout
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}

function TabletPanel({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-h-0 overflow-hidden rounded-md border border-amber-500/30 bg-black/76 ${className}`}>
      <div className="border-b border-zinc-800 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-amber-300">
        {title}
      </div>
      <div className="h-[calc(100%-35px)] overflow-auto p-2">{children}</div>
    </section>
  );
}

export function LiveRaceDataWorkspace({
  live,
  playerCars,
  monitor,
  activeRecs,
  preferences,
  nameOf,
  teamNameOf,
  onFocusDriver,
}: {
  live: LiveRaceState;
  playerCars: LiveCarState[];
  monitor: AnalyticsMonitor;
  activeRecs: AnalyticsRecommendation[];
  preferences: LiveRaceWorkspacePreferences;
  nameOf: (driverId: string) => string;
  teamNameOf: (teamId: string) => string;
  onFocusDriver: (driverId: string) => void;
}) {
  const visiblePanels = preferences.panelOrder.filter((panel) => !preferences.hiddenPanels.includes(panel));
  const summary = buildEngineerCheckpointSummary(live, playerCars);
  return (
    <main
      data-testid="live-race-data-view"
      className={`relative grid min-h-0 flex-1 gap-2 overflow-auto p-2 ${
        preferences.strategyDrawerOpen ? 'pr-[25rem]' : ''
      } md:grid-cols-2 xl:grid-cols-3`}
    >
      {visiblePanels.map((panel) => (
        <LiveRaceDataPanel
          key={panel}
          panel={panel}
          live={live}
          playerCars={playerCars}
          monitor={monitor}
          activeRecs={activeRecs}
          summary={summary}
          nameOf={nameOf}
          teamNameOf={teamNameOf}
          onFocusDriver={onFocusDriver}
        />
      ))}
      {visiblePanels.length === 0 && (
        <div className="col-span-full m-auto rounded border border-zinc-700 bg-black/70 p-6 text-sm text-zinc-400">
          All Data View panels are hidden. Open Customize to restore one or reset the layout.
        </div>
      )}
    </main>
  );
}

function LiveRaceDataPanel({
  panel,
  live,
  playerCars,
  monitor,
  activeRecs,
  summary,
  nameOf,
  teamNameOf,
  onFocusDriver,
}: {
  panel: LiveRacePanelId;
  live: LiveRaceState;
  playerCars: LiveCarState[];
  monitor: AnalyticsMonitor;
  activeRecs: AnalyticsRecommendation[];
  summary: ReturnType<typeof buildEngineerCheckpointSummary>;
  nameOf: (driverId: string) => string;
  teamNameOf: (teamId: string) => string;
  onFocusDriver: (driverId: string) => void;
}) {
  if (panel === 'timing') {
    return (
      <TabletPanel title="Live Timing">
        <div className="space-y-1 text-[11px]">
          {live.cars.map((car) => (
            <button
              key={car.driverId}
              type="button"
              onClick={() => onFocusDriver(car.driverId)}
              className={`grid w-full grid-cols-[30px_1fr_auto] gap-2 rounded px-2 py-1 text-left ${
                car.isPlayer ? 'bg-amber-500/12 text-amber-100' : 'bg-zinc-950/65 text-zinc-300'
              }`}
            >
              <strong>P{car.position ?? '-'}</strong>
              <span className="truncate">{nameOf(car.driverId)} · {teamNameOf(car.teamId)}</span>
              <span className="tabular-nums">{car.position === 1 ? 'Leader' : `+${car.gapToLeader.toFixed(1)}`}</span>
            </button>
          ))}
        </div>
      </TabletPanel>
    );
  }
  if (panel === 'analytics') {
    return (
      <TabletPanel title="Analytics & Recommendations">
        <div className="text-xs text-zinc-300">
          <div className="font-bold text-zinc-100">{monitor.headline}</div>
          <div className="mt-1 text-zinc-500">Evidence confidence {monitor.confidence}%</div>
          <div className="mt-3 space-y-2">
            {activeRecs.map((rec) => (
              <button
                key={rec.id}
                type="button"
                onClick={() => onFocusDriver(rec.driverId)}
                className="w-full rounded border border-amber-500/25 bg-amber-500/8 p-2 text-left"
              >
                <div className="font-black uppercase text-amber-300">{kindLabel(rec.kind)} · {rec.priority}</div>
                <div className="mt-1 text-zinc-200">{rec.issue}</div>
                <div className="mt-1 text-zinc-500">{rec.expectedImpact} · {rec.confidence}% confidence</div>
              </button>
            ))}
            {activeRecs.length === 0 && <div className="text-zinc-500">No active recommendation. Monitoring continues.</div>}
          </div>
        </div>
      </TabletPanel>
    );
  }
  if (panel === 'pit-wall') {
    return (
      <TabletPanel title="Pit Wall">
        <div className="space-y-2 text-xs">
          {playerCars.map((car) => (
            <button
              key={car.driverId}
              type="button"
              onClick={() => onFocusDriver(car.driverId)}
              className="w-full rounded border border-zinc-800 bg-zinc-950/60 p-2 text-left"
            >
              <div className="flex justify-between gap-2 text-zinc-100">
                <strong>{nameOf(car.driverId)}</strong>
                <span>P{car.position ?? '-'}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-zinc-400">
                <span>Fuel {Math.round(car.fuel)}%</span>
                <span>Tyre {Math.max(0, 100 - Math.round(car.tire.wear))}%</span>
                <span>{car.pit.window ? `Window L${car.pit.window.open}-${car.pit.window.close}` : 'No pit window'}</span>
                <span>{car.pit.pitRequested ? 'Box call active' : car.paceMode}</span>
              </div>
            </button>
          ))}
        </div>
      </TabletPanel>
    );
  }
  if (panel === 'events') {
    return (
      <TabletPanel title="Race Events">
        <div className="space-y-1 text-[11px] text-zinc-300">
          {live.events.slice(-30).reverse().map((event, index) => (
            <div key={`${event.lap}-${index}`} className="rounded bg-zinc-950/60 px-2 py-1">
              <strong className="text-amber-300">L{event.lap}</strong> {event.text}
            </div>
          ))}
          {live.events.length === 0 && <div className="text-zinc-500">No race events recorded yet.</div>}
        </div>
      </TabletPanel>
    );
  }
  if (panel === 'engineer-summary') {
    return (
      <TabletPanel title={`Engineer Summary · ${summary.checkpoint}`}>
        <div className="text-xs text-zinc-300">
          <div className="font-bold text-zinc-100">{summary.headline}</div>
          <ul className="mt-3 space-y-2">
            {summary.bullets.map((bullet) => <li key={bullet}>• {bullet}</li>)}
          </ul>
        </div>
      </TabletPanel>
    );
  }
  return (
    <TabletPanel title="Telemetry">
      <div className="grid gap-2 text-xs">
        {playerCars.map((car) => (
          <button
            key={car.driverId}
            type="button"
            onClick={() => onFocusDriver(car.driverId)}
            className="rounded border border-zinc-800 bg-zinc-950/60 p-2 text-left"
          >
            <strong className="text-zinc-100">{nameOf(car.driverId)}</strong>
            <div className="mt-2 grid grid-cols-2 gap-1 text-zinc-400">
              <span>Last {car.lastLapTime > 0 ? car.lastLapTime.toFixed(3) : '-'}</span>
              <span>Best {car.bestLap ? car.bestLap.toFixed(3) : '-'}</span>
              <span>Live pace {car.liveRacePace.toFixed(1)}</span>
              <span>Traffic {car.trafficStatus}</span>
            </div>
          </button>
        ))}
      </div>
    </TabletPanel>
  );
}

const MODES: PaceMode[] = ['ProtectEngine', 'Conservative', 'Balanced', 'Defend', 'Push', 'Attack'];

export function LiveRaceStrategyDrawer({
  open,
  live,
  playerCars,
  strategyByDriver,
  nameOf,
  onChange,
  onPit,
  onClose,
}: {
  open: boolean;
  live: LiveRaceState;
  playerCars: LiveCarState[];
  strategyByDriver: Record<string, { intensity: PitIntensity; exitMode: PaceMode }>;
  nameOf: (driverId: string) => string;
  onChange: (driverId: string, next: { intensity: PitIntensity; exitMode: PaceMode }) => void;
  onPit: (driverId: string, decision: { intensity: PitIntensity; exitMode: PaceMode }) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <aside
      data-testid="live-race-strategy-drawer"
      className="fixed bottom-0 right-0 top-[112px] z-40 flex w-[24rem] flex-col border-l-2 border-amber-500/50 bg-[#0b0b0b]/98 shadow-[-18px_0_45px_rgba(0,0,0,0.55)]"
    >
      <div className="flex items-center justify-between border-b border-amber-500/30 px-3 py-2">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide text-amber-300">Persistent Strategy Drawer</div>
          <div className="text-[10px] text-zinc-500">Review the projection, then apply the existing race action.</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close strategy drawer"
          className="rounded border border-zinc-700 px-2 py-1 text-[10px] font-bold uppercase text-zinc-300"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {playerCars.map((car) => {
          const strategy = strategyByDriver[car.driverId] ?? {
            intensity: car.pit.intensity ?? car.pit.intensityDefault ?? 'Standard',
            exitMode: car.pit.exitMode ?? car.paceMode,
          };
          const projection = buildLiveRaceStrategyProjection(car, live, strategy);
          const pitUnavailableReason = !car.running
            ? 'Pit controls are unavailable because this car is no longer running.'
            : live.phase === 'finished'
              ? 'Pit controls are unavailable because the race has finished.'
              : undefined;
          return (
            <section key={car.driverId} className="rounded border border-zinc-800 bg-zinc-950/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-zinc-100">{nameOf(car.driverId)}</div>
                  <div className="text-[10px] uppercase text-zinc-500">
                    Current {car.paceMode} · P{car.position ?? '-'} · tyre {Math.max(0, 100 - Math.round(car.tire.wear))}%
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!!pitUnavailableReason}
                  title={pitUnavailableReason}
                  aria-label={`${car.pit.pitRequested ? 'Cancel box' : 'Box this lap'} for ${nameOf(car.driverId)}${pitUnavailableReason ? `. ${pitUnavailableReason}` : ''}`}
                  onClick={() => onPit(car.driverId, strategy)}
                  className="rounded bg-amber-400 px-2 py-1 text-[10px] font-black uppercase text-black disabled:opacity-35"
                >
                  {car.pit.pitRequested ? 'Cancel box' : 'Box this lap'}
                </button>
              </div>
              <div className="mt-3 text-[9px] font-black uppercase text-zinc-500">Pit execution</div>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {PIT_INTENSITY_ORDER.map((intensity) => (
                  <button
                    key={intensity}
                    type="button"
                    onClick={() => onChange(car.driverId, { ...strategy, intensity })}
                    className={`rounded px-1 py-1 text-[9px] font-bold uppercase ${
                      strategy.intensity === intensity ? 'bg-amber-400 text-black' : 'bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {intensity}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-[9px] font-black uppercase text-zinc-500">Exit pace mode</div>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {MODES.map((exitMode) => (
                  <button
                    key={exitMode}
                    type="button"
                    onClick={() => onChange(car.driverId, { ...strategy, exitMode })}
                    className={`rounded px-1 py-1 text-[9px] font-bold uppercase ${
                      strategy.exitMode === exitMode ? 'bg-emerald-400 text-black' : 'bg-zinc-900 text-zinc-400'
                    }`}
                  >
                    {exitMode}
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded border border-zinc-800 bg-black/70 p-2 text-[10px]">
                <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1">
                  <span className="text-zinc-500">Pace</span><strong className="text-zinc-200">{projection.pace}</strong>
                  <span className="text-zinc-500">Fuel</span><strong className="text-zinc-200">{projection.fuel}</strong>
                  <span className="text-zinc-500">Tyres</span><strong className="text-zinc-200">{projection.tires}</strong>
                  <span className="text-zinc-500">Pit timing</span><strong className="text-zinc-200">{projection.pitTiming}</strong>
                  <span className="text-zinc-500">Risk</span><strong className="text-zinc-200">{projection.risk}</strong>
                </div>
                <p className="mt-2 border-t border-zinc-800 pt-2 text-zinc-500">{projection.confidence}</p>
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
