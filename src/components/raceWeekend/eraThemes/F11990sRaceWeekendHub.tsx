import type { CSSProperties } from 'react';
import { garageThemeForTeam } from '../../../data/teamGarageThemes';
import { F11990sGarageHotspot } from './F11990sGarageHotspot';
import { RaceWeekendScheduleCard } from './RaceWeekendScheduleCard';
import { TrackInfoCard } from './TrackInfoCard';
import { TeamMessagesCard } from './TeamMessagesCard';
import { CarStatusCard } from './CarStatusCard';
import { WeatherForecastCard } from './WeatherForecastCard';
import {
  buildCarStatus,
  buildF11990sGarageHotspots,
  buildGarageTaskBoard,
  buildNextSessionAction,
  buildQuickActions,
  buildRaceWeekendSchedule,
  buildStandingsRows,
  buildTeamMessages,
  countryCode,
  executeRaceWeekendHubAction,
  refuelingDisplay,
  regulationForState,
  selectedTeam,
  setupConfidenceLabel,
  topBarMetrics,
} from './raceWeekendHubData';
import type { QuickAction, RaceWeekendHubCallbacks, RaceWeekendHubProps } from './types';
import type { GarageTaskBoardItem } from './types';

export function F11990sRaceWeekendHub({
  state,
  race,
  track,
  forecast,
  isMinPackage,
  hasQualifyingResults,
  activePhase = 'hub',
  moduleTitle,
  moduleContent,
  onPhase,
  onRoute,
  onExit,
}: RaceWeekendHubProps) {
  const regulation = regulationForState(state);
  const team = selectedTeam(state);
  const schedule = buildRaceWeekendSchedule(state, race, isMinPackage, hasQualifyingResults);
  const next = buildNextSessionAction(state, race, isMinPackage, hasQualifyingResults);
  const callbacks: RaceWeekendHubCallbacks = { onPhase, onRoute, onExit };
  const hotspots = buildF11990sGarageHotspots({ state, race, isMinPackage, hasQualifyingResults });
  const taskBoard = buildGarageTaskBoard(state, race, isMinPackage, hasQualifyingResults);
  const quickActions = buildQuickActions(state);
  const standingsRows = buildStandingsRows(state);
  const metrics = topBarMetrics(state, race);
  const showingModule = activePhase !== 'hub' && !!moduleContent;
  const garageTheme = garageThemeForTeam(team);
  const garageThemeStyle = {
    '--garage-scene-image': `url(${garageTheme.garageImage})`,
    '--garage-primary': garageTheme.primary,
    '--garage-secondary': garageTheme.secondary,
    '--garage-trim': garageTheme.trim,
  } as CSSProperties;

  return (
    <div
      className="f1-1990s-hub min-h-full rounded border border-neutral-800 bg-neutral-950 text-neutral-100"
      data-testid="f1-1990s-race-weekend-hub"
    >
      <header className="grid gap-3 border-b border-amber-500/20 bg-black/50 p-3 lg:grid-cols-[minmax(260px,360px)_1fr_minmax(360px,520px)]">
        <div className="f1-1990s-header-block">
          <div className="text-2xl font-bold uppercase text-amber-300">{state.seasonYear} Season</div>
          <div className="mt-1 text-xl font-semibold uppercase text-neutral-100">{race.gpName}</div>
          <div className="mt-1 flex items-center gap-2 text-xs uppercase text-neutral-300">
            <span>Round {race.round} of {state.calendar.length}</span>
            <span>-</span>
            <span>{track.name}</span>
            <span className="rounded border border-amber-400/40 px-1.5 py-0.5 text-amber-200">{countryCode(track.country)}</span>
          </div>
        </div>

        <div className="f1-1990s-header-block">
          <div className="text-3xl font-black uppercase text-neutral-100">
            <span className="text-amber-300">Race</span> Weekend Hub
          </div>
          <div className="mt-1 text-sm text-amber-200">Click highlighted garage items to manage the active weekend.</div>
          {team && <div className="mt-2 text-xs uppercase text-neutral-400">{team.name} garage command center</div>}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <HeaderMetric label="Funds" value={metrics.funds} />
          <HeaderMetric label="Team Morale" value={metrics.morale} tone="lime" />
          <HeaderMetric label="Team Rating" value={metrics.rating} />
          <HeaderMetric label="Next Race" value={metrics.nextRace} />
        </div>
      </header>

      <div className="grid gap-3 p-3 xl:grid-cols-[280px_minmax(620px,1fr)]">
        <aside className="space-y-3">
          <RaceWeekendScheduleCard
            items={schedule}
            onOpenItem={(item) => executeRaceWeekendHubAction(item.action, callbacks)}
          />
          <TrackInfoCard
            race={race}
            track={track}
            regulation={regulation}
            onOpenTrackData={() => onPhase('briefing')}
          />
          <section className="f1-1990s-panel" aria-label="Next session">
            <header className="f1-1990s-panel-title">Next Session</header>
            <div className="text-2xl font-bold uppercase text-amber-300">{next.sessionName}</div>
            <div className="mt-1 text-xs text-neutral-400">{next.detail}</div>
            <div className="mt-3 border-t border-neutral-800 pt-3">
              <div className="text-[10px] uppercase text-neutral-500">Race rule note</div>
              <div className="text-sm text-neutral-200">{refuelingDisplay(regulation)}</div>
            </div>
            <button
              type="button"
              className="f1-1990s-primary-button mt-4 w-full"
              disabled={!next.action}
              title={next.disabledReason}
              onClick={() => executeRaceWeekendHubAction(next.action, callbacks)}
            >
              {next.primaryLabel}
            </button>
          </section>
        </aside>

        <main>
          <section
            className="f1-1990s-garage-scene min-h-[660px]"
            style={garageThemeStyle}
            aria-label="Interactive 1990s Formula 1 garage"
          >
            <div className="f1-1990s-garage-door" aria-hidden="true" />
            <div className="f1-1990s-garage-floor" aria-hidden="true" />
            <div className="f1-1990s-monitor-wall" aria-hidden="true">
              <span className="f1-1990s-monitor-title">Pit Wall Telemetry</span>
              <span className="f1-1990s-monitor-screen f1-1990s-monitor-screen-a" />
              <span className="f1-1990s-monitor-screen f1-1990s-monitor-screen-b" />
              <span className="f1-1990s-monitor-screen f1-1990s-monitor-screen-c" />
            </div>
            <div className="f1-1990s-pit-wall" aria-hidden="true">
              <span className="f1-1990s-pit-wall-label">Timing Stand</span>
              <span className="f1-1990s-pit-wall-row" />
              <span className="f1-1990s-pit-wall-row" />
              <span className="f1-1990s-pit-wall-row" />
            </div>
            <div className="f1-1990s-toolbox" aria-hidden="true">
              <span>Parts Rack</span>
            </div>
            <div className="f1-1990s-workbench" aria-hidden="true">
              <span>Engineering Bench</span>
            </div>
            <div className="f1-1990s-car-shape" aria-hidden="true">
              <span className="f1-1990s-car-rear-wing" />
              <span className="f1-1990s-car-front-wing" />
              <span className="f1-1990s-car-nose" />
              <span className="f1-1990s-car-cockpit" />
              <span className="f1-1990s-car-sidepod f1-1990s-car-sidepod-left" />
              <span className="f1-1990s-car-sidepod f1-1990s-car-sidepod-right" />
              <span className="f1-1990s-car-wheel f1-1990s-car-wheel-left" />
              <span className="f1-1990s-car-wheel f1-1990s-car-wheel-right" />
            </div>
            {hotspots.map((hotspot) => (
              <F11990sGarageHotspot key={hotspot.id} hotspot={hotspot} callbacks={callbacks} />
            ))}
            {showingModule && (
              <div className="f1-1990s-module-signal" aria-hidden="true">
                <span>{moduleTitle ?? 'Garage Module'} open</span>
              </div>
            )}
          </section>

          {showingModule && (
            <div className="f1-1990s-module-overlay" role="dialog" aria-modal="true" aria-label={moduleTitle ?? 'Garage module'}>
              <div className="f1-1990s-module-backdrop" onClick={() => onPhase('hub')} aria-hidden="true" />
              <section className="f1-1990s-module-window">
                <header className="flex items-center justify-between gap-3 border-b border-amber-500/25 px-4 py-3">
                  <div>
                    <div className="text-lg font-black uppercase text-amber-300">{moduleTitle ?? 'Garage Module'}</div>
                    <div className="text-[10px] uppercase text-neutral-500">1990-94 garage overlay - Hub remains active behind this task</div>
                  </div>
                  <button type="button" className="f1-1990s-secondary-button" onClick={() => onPhase('hub')}>
                    Garage Overview
                  </button>
                </header>
                <GarageTaskRail tasks={taskBoard} activePhase={activePhase} callbacks={callbacks} />
                <div className="f1-1990s-module-content">
                  {moduleContent}
                </div>
              </section>
            </div>
          )}

        </main>
      </div>

      <section className="f1-1990s-status-deck mx-3 mb-3" aria-label="Garage status deck">
        <TeamMessagesCard messages={buildTeamMessages(state, race)} onOpenMessages={() => onRoute('/news')} />
        <CarStatusCard
          rows={buildCarStatus(state)}
          setupConfidence={setupConfidenceLabel(state, race)}
          onOpenCarStats={() => onPhase(isMinPackage ? 'quali-run' : 'setup')}
        />
        <WeatherForecastCard forecast={forecast} onOpenForecast={() => onPhase('briefing')} />
        <StandingsCard rows={standingsRows} onOpenStandings={() => onRoute('/standings')} />
        <QuickActionsCard actions={quickActions} callbacks={callbacks} />
      </section>

      <footer className="mx-3 mb-3 grid gap-3 rounded border border-neutral-700/70 bg-black/50 px-4 py-3 text-sm text-neutral-300 lg:grid-cols-[260px_1fr_auto]">
        <div>
          <div className="font-bold uppercase text-amber-300">1990s F1 Era Mode</div>
          <div className="text-xs text-neutral-400">Authentic {state.seasonYear} weekend presentation</div>
        </div>
        <div className="flex items-center text-neutral-300">
          Click any highlighted item in the garage to manage that area or view details.
        </div>
        <button type="button" className="f1-1990s-secondary-button" onClick={onExit}>
          Exit Hub
        </button>
      </footer>
    </div>
  );
}

function GarageTaskRail({
  tasks,
  activePhase,
  callbacks,
}: {
  tasks: GarageTaskBoardItem[];
  activePhase: RaceWeekendHubProps['activePhase'];
  callbacks: RaceWeekendHubCallbacks;
}) {
  return (
    <nav className="f1-1990s-task-rail" aria-label="Task switchboard">
      <div className="mr-1 shrink-0 text-[10px] font-black uppercase tracking-wide text-amber-300">Task Switchboard</div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {tasks.map((task) => (
          <GarageTaskButton
            key={task.id}
            task={task}
            active={activePhase === task.id}
            compact
            callbacks={callbacks}
          />
        ))}
      </div>
    </nav>
  );
}

function GarageTaskButton({
  task,
  active,
  compact,
  callbacks,
}: {
  task: GarageTaskBoardItem;
  active: boolean;
  compact: boolean;
  callbacks: RaceWeekendHubCallbacks;
}) {
  const disabled = !task.action || task.status === 'locked';
  const statusClass =
    task.status === 'completed'
      ? 'border-lime-500/30 bg-lime-500/10 text-lime-100'
    : task.status === 'current'
      ? 'border-amber-400/70 bg-amber-500/20 text-amber-100'
      : task.status === 'locked'
      ? 'border-neutral-800 bg-black/30 text-neutral-500'
      : 'border-neutral-700/70 bg-black/42 text-neutral-300';
  const activeClass = active ? 'ring-1 ring-amber-300/80' : '';

  return (
    <button
      type="button"
      disabled={disabled}
      title={task.lockedReason ?? task.detail}
      onClick={() => executeRaceWeekendHubAction(task.action, callbacks)}
      className={`min-w-0 rounded border text-left transition hover:border-amber-300 hover:bg-amber-500/12 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:hover:border-neutral-800 disabled:hover:bg-black/30 ${
        compact ? 'px-2 py-1' : 'px-2.5 py-2'
      } ${statusClass} ${activeClass}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={`truncate font-bold uppercase ${compact ? 'text-[10px]' : 'text-[11px]'}`}>{task.label}</span>
        <span className="shrink-0 text-[9px] uppercase text-neutral-500">{task.status}</span>
      </span>
      {!compact && <span className="mt-1 block truncate text-[10px] text-neutral-400">{task.detail}</span>}
    </button>
  );
}

function HeaderMetric({ label, value, tone }: { label: string; value: string; tone?: 'lime' }) {
  return (
    <div className="border-l border-neutral-700/80 px-3 py-2">
      <div className="text-[10px] uppercase text-neutral-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${tone === 'lime' ? 'text-lime-300' : 'text-neutral-100'}`}>{value}</div>
    </div>
  );
}

function StandingsCard({
  rows,
  onOpenStandings,
}: {
  rows: Array<{ position: number; name: string; points: number; highlight: boolean }>;
  onOpenStandings: () => void;
}) {
  return (
    <section className="f1-1990s-panel min-h-[204px]" aria-label="Standings">
      <header className="f1-1990s-panel-title">Standings</header>
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-400">Standings open once race results are recorded.</p>
      ) : (
        <div className="space-y-1 text-xs">
          {rows.map((row) => (
            <div
              key={`${row.position}-${row.name}`}
              className={`grid grid-cols-[24px_1fr_auto] gap-2 rounded px-2 py-1 ${
                row.highlight ? 'bg-amber-500/20 text-amber-100' : 'text-neutral-300'
              }`}
            >
              <span className="font-mono">{row.position}</span>
              <span className="truncate">{row.name}</span>
              <span className="font-mono">{row.points}</span>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="f1-1990s-secondary-button mt-3 w-full" onClick={onOpenStandings}>
        Full Standings
      </button>
    </section>
  );
}

function QuickActionsCard({ actions, callbacks }: { actions: QuickAction[]; callbacks: RaceWeekendHubCallbacks }) {
  return (
    <section className="f1-1990s-panel min-h-[204px]" aria-label="Quick actions">
      <header className="f1-1990s-panel-title">Quick Actions</header>
      <div className="space-y-1">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-neutral-300 hover:bg-amber-500/10 hover:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300"
            onClick={() => executeRaceWeekendHubAction(action.action, callbacks)}
          >
            <span>{action.label}</span>
            {action.count != null && (
              <span className="rounded border border-amber-400/40 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">
                {action.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
