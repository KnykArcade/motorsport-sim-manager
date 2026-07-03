import { F11990sGarageHotspot } from './F11990sGarageHotspot';
import { RaceWeekendScheduleCard } from './RaceWeekendScheduleCard';
import { TrackInfoCard } from './TrackInfoCard';
import { TeamMessagesCard } from './TeamMessagesCard';
import { CarStatusCard } from './CarStatusCard';
import { WeatherForecastCard } from './WeatherForecastCard';
import {
  buildCarStatus,
  buildF11990sGarageHotspots,
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

export function F11990sRaceWeekendHub({
  state,
  race,
  track,
  forecast,
  isMinPackage,
  hasQualifyingResults,
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
  const quickActions = buildQuickActions(state);
  const standingsRows = buildStandingsRows(state);
  const metrics = topBarMetrics(state, race);

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

      <div className="grid gap-3 p-3 xl:grid-cols-[280px_minmax(520px,1fr)]">
        <aside className="space-y-3">
          <RaceWeekendScheduleCard items={schedule} />
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

        <main className="space-y-3">
          <section className="f1-1990s-garage-scene min-h-[520px]" aria-label="Interactive 1990s Formula 1 garage">
            <div className="f1-1990s-garage-door" aria-hidden="true" />
            <div className="f1-1990s-monitor-wall" aria-hidden="true" />
            <div className="f1-1990s-toolbox" aria-hidden="true" />
            <div className="f1-1990s-workbench" aria-hidden="true" />
            <div className="f1-1990s-car-shape" aria-hidden="true">
              <span className="f1-1990s-car-nose" />
              <span className="f1-1990s-car-cockpit" />
              <span className="f1-1990s-car-wheel f1-1990s-car-wheel-left" />
              <span className="f1-1990s-car-wheel f1-1990s-car-wheel-right" />
            </div>
            {hotspots.map((hotspot) => (
              <F11990sGarageHotspot key={hotspot.id} hotspot={hotspot} callbacks={callbacks} />
            ))}
          </section>

          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
            <TeamMessagesCard messages={buildTeamMessages(state, race)} onOpenMessages={() => onRoute('/news')} />
            <CarStatusCard
              rows={buildCarStatus(state)}
              setupConfidence={setupConfidenceLabel(state, race)}
              onOpenCarStats={() => onPhase(isMinPackage ? 'quali-run' : 'setup')}
            />
            <WeatherForecastCard forecast={forecast} onOpenForecast={() => onPhase('briefing')} />
            <StandingsCard rows={standingsRows} onOpenStandings={() => onRoute('/standings')} />
            <QuickActionsCard actions={quickActions} callbacks={callbacks} />
          </div>
        </main>
      </div>

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
