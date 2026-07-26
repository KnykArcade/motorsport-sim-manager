import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import {
  FmDecisionBar,
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import { Panel } from '../components/Panel';
import { RegulationPanel } from '../components/RegulationPanel';
import { StandingsTable } from '../components/StandingsTable';
import { StatBar } from '../components/StatBar';
import { TrackDemandBars } from '../components/TrackDemandBars';
import { workflowDestination } from '../components/layoutWorkflow';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import { ratingColor } from '../components/ui';
import { getRegulationSet, getTrackById } from '../data';
import {
  BACKGROUNDS,
  MANAGEMENT_STYLES,
  STRENGTHS,
  optionById,
  type PrincipalOption,
} from '../data/principal/principalOptions';
import {
  activeDriversForTeam,
  carForTeam,
  currentRace,
  driversForTeam,
  minRaceDriversForSeries,
  teamById,
} from '../game/careerState';
import { useGame } from '../game/GameContext';
import { getGameModeLabel, isSingleSeasonMode } from '../game/modeRestrictions';
import { activeUpgradePrograms } from '../sim/technicalAdapters';
import { calculateAcademyCapacity } from '../sim/teamRatingsEngine';
import { effectiveCarRatings } from '../sim/trackFitEngine';
import type { TeamPrincipal } from '../types/principalTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import { commandAgenda, type CommandAgendaItem } from './commandAgendaViewModel';
import { actionableInboxCount, unreadInboxCount } from './inboxViewModel';
import { staffRecommendations } from './staffRecommendationsViewModel';
import { staffResponsibilities } from './staffResponsibilitiesViewModel';
import { TEAM_HQ_TABS, type TeamHQTab } from './teamHQViewModel';
import { aroundTheWorldEntries, canViewWorldStandings } from './worldStandingsViewModel';

export function TeamHQ() {
  const { state } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TeamHQTab>('race');
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const car = carForTeam(state, state.selectedTeamId);
  const drivers = driversForTeam(state, state.selectedTeamId);
  const race = currentRace(state);
  const track = race ? getTrackById(race.trackId) : undefined;
  const ratings = car ? effectiveCarRatings(car) : null;
  const principal = state.teamPrincipal;
  const orgRatings = state.teamOrgRatings?.[state.selectedTeamId];
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const minDrivers = minRaceDriversForSeries(state.series);
  const hasEnoughDrivers = activeDrivers.length >= minDrivers;
  const workflow = workflowDestination(state);
  const inboxUnread = unreadInboxCount(state);
  const inboxActionable = actionableInboxCount(state);
  const responsibilities = staffResponsibilities(state);
  const recommendations = staffRecommendations(state);
  const agenda = commandAgenda(state);
  const worldEntries = canViewWorldStandings(state.gameMode)
    ? aroundTheWorldEntries(state.series, state.motorsportUniverse)
    : [];

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((candidate) => candidate.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((candidate) => candidate.id === id)?.color;

  const primaryAction = state.seasonComplete
    ? { label: 'Season Review', route: '/season-review' }
    : hasEnoughDrivers
      ? { label: `Open ${workflow.context}`, route: workflow.to }
      : { label: `Fill Race Seats (${activeDrivers.length}/${minDrivers})`, route: '/market' };

  return (
    <WorkspaceScreen className="era-feature-screen era-team-hq ui-phase2-home">
      <WorkspaceHeader
        eyebrow="Manager home"
        title={team?.name ?? 'Team'}
        subtitle={`${state.seasonYear} ${state.series} · ${getGameModeLabel(state.gameMode)}${race ? ` · Round ${race.round} of ${state.calendar.length}` : ''}`}
        actions={<Button variant="primary" onClick={() => navigate(primaryAction.route)}>{primaryAction.label} →</Button>}
      />
      <WorkspaceTabs items={TEAM_HQ_TABS} active={tab} onChange={setTab} ariaLabel="Team HQ command center" />
      <WorkspaceBody>
        {tab === 'race' && (
          <FmWorkspaceGrid>
            <FmPane>
              <FmPaneHeader title="Weekly agenda" meta={`${inboxActionable} must respond · ${inboxUnread} unread`} />
              <FmPaneBody>
                {agenda.nextAction && (
                  <AgendaListItem item={agenda.nextAction} active onOpen={() => navigate(agenda.nextAction!.route)} />
                )}
                {agenda.dueThisWeek.map((item) => (
                  <AgendaListItem key={item.id} item={item} onOpen={() => navigate(item.route)} />
                ))}
                {!agenda.nextAction && agenda.dueThisWeek.length === 0 && (
                  <div className="ui-inbox-empty">No unresolved management action is waiting.</div>
                )}
                <FmListButton onClick={() => navigate('/inbox')}>
                  <span className="ui-news-list-source">Inbox</span>
                  <strong>Open all messages</strong>
                  <span>{inboxUnread} unread · {inboxActionable} actionable</span>
                </FmListButton>
              </FmPaneBody>
            </FmPane>

            <FmPane>
              <FmPaneHeader title={agenda.headline} meta={agenda.subheadline} />
              <FmPaneBody className="ui-home-center">
                {race && track && !state.seasonComplete ? (
                  <section className="ui-home-next-race">
                    <div>
                      <span className="ui-fm-section-label">Next event · Round {race.round}</span>
                      <h2>{race.gpName}</h2>
                      <p>{race.trackName} · {track.archetype} · {race.laps} laps · {race.distanceKm ?? '—'} km</p>
                      {!hasEnoughDrivers && <strong>Race entry blocked: {activeDrivers.length}/{minDrivers} seats filled.</strong>}
                    </div>
                    <TrackDemandBars track={track} />
                  </section>
                ) : (
                  <section className="ui-home-next-race">
                    <div>
                      <span className="ui-fm-section-label">Season status</span>
                      <h2>Season complete</h2>
                      <p>Review the completed season and prepare the next chapter.</p>
                    </div>
                  </section>
                )}

                {agenda.weeklyStory && (
                  <section className="ui-home-development">
                    <span className="ui-fm-section-label">Returned from last race</span>
                    <h3>{agenda.weeklyStory.headline}</h3>
                    <p>{agenda.weeklyStory.summary}</p>
                    <div>
                      {agenda.weeklyStory.groups.flatMap((group) => group.items.slice(0, 2).map((item) => (
                        <button key={item.id} type="button" onClick={() => navigate(item.route)}>
                          <strong>{item.title}</strong>
                          <span>{item.reason}</span>
                          <small>{item.routeLabel} →</small>
                        </button>
                      )))}
                    </div>
                  </section>
                )}

                <section className="ui-home-development">
                  <span className="ui-fm-section-label">Recent developments</span>
                  <div>
                    {agenda.recentChanges.map((change) => (
                      <button key={change.id} type="button" onClick={() => navigate(change.route)}>
                        <strong>{change.title}</strong>
                        <span>{change.detail}</span>
                        <small>{change.routeLabel} →</small>
                      </button>
                    ))}
                    {agenda.recentChanges.length === 0 && <p>No new changes have been added to the manager home.</p>}
                  </div>
                </section>

                <section className="ui-home-development">
                  <span className="ui-fm-section-label">Department responsibilities</span>
                  <div>
                    {responsibilities.slice(0, 4).map((responsibility) => (
                      <button key={responsibility.id} type="button" onClick={() => navigate(responsibility.route)}>
                        <strong>{responsibility.area} · {responsibility.owner}</strong>
                        <span>{responsibility.status} — {responsibility.effect}</span>
                        <small>{responsibility.routeLabel} →</small>
                      </button>
                    ))}
                  </div>
                </section>
              </FmPaneBody>
            </FmPane>

            <FmPane>
              <FmPaneHeader title="Team context" meta={race?.gpName ?? 'Season complete'} />
              <FmPaneBody className="ui-news-context-pane">
                <section>
                  <h3>Current status</h3>
                  <FmKeyValue label="Next event" value={agenda.nextEvent.label} />
                  <FmKeyValue label="Budget" value={team ? formatBudget(team.budget) : '—'} />
                  <FmKeyValue label="Morale" value={`${Math.round(team?.morale ?? 0)}%`} />
                  <FmKeyValue label="Car condition" value={`${Math.round(car?.condition ?? 0)}%`} />
                  <FmKeyValue label="Active projects" value={activeUpgradePrograms(state).length} />
                  <FmKeyValue label="Race seats" value={`${activeDrivers.length}/${minDrivers}`} />
                </section>
                <section>
                  <h3>Department advice</h3>
                  {recommendations.slice(0, 3).map((recommendation) => (
                    <button key={recommendation.id} type="button" className="ui-home-context-link" onClick={() => navigate(recommendation.route)}>
                      <strong>{recommendation.target}</strong>
                      <span>{recommendation.recommendation}</span>
                    </button>
                  ))}
                  {recommendations.length === 0 && <p>No staff recommendation is waiting.</p>}
                </section>
                <section>
                  <h3>Championship snapshot</h3>
                  {state.constructorStandings.slice(0, 5).map((entry, index) => (
                    <FmKeyValue key={entry.entityId} label={`${index + 1}. ${teamName(entry.entityId)}`} value={Math.round(entry.points)} />
                  ))}
                </section>
                {worldEntries.length > 0 && (
                  <section>
                    <h3>Around the world</h3>
                    {worldEntries.slice(0, 3).map((entry) => (
                      <div key={entry.series} className="ui-home-world-row">
                        <strong>{entry.series}</strong>
                        <span>{entry.completedRaces > 0 ? `${entry.liveLeaderName ?? '—'} · ${Math.round(entry.liveLeaderPoints ?? 0)} pts` : entry.championName ?? 'Season opening'}</span>
                      </div>
                    ))}
                  </section>
                )}
              </FmPaneBody>
            </FmPane>
          </FmWorkspaceGrid>
        )}

        {tab !== 'race' && (
          <div className="ui-fm-scroll-column">
            {tab === 'car' && ratings && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Car Performance">
                  <div className="grid gap-2 md:grid-cols-2">
                    <StatBar label="Engine Power" value={ratings.enginePower} max={100} />
                    <StatBar label="Aero Efficiency" value={ratings.aeroEfficiency} max={100} />
                    <StatBar label="Mechanical Grip" value={ratings.mechanicalGrip} max={100} />
                    <StatBar label="Reliability" value={ratings.reliability} max={100} />
                    <StatBar label="Pit Crew Ops" value={ratings.pitCrewOperations} max={100} />
                    <StatBar label="Condition" value={car?.condition ?? 0} max={100} />
                  </div>
                </Panel>
                {(() => {
                  const regulationSet = getRegulationSet(state.regulationSetId);
                  return regulationSet ? (
                    <RegulationPanel regulationSet={regulationSet} seasonYear={state.seasonYear} locked={isSingleSeasonMode(state.gameMode)} compact />
                  ) : null;
                })()}
              </div>
            )}
            {tab === 'organization' && orgRatings && <TeamRatingsPanel ratings={orgRatings} academyUsed={(state.academy ?? []).length} />}
            {tab === 'personnel' && (
              <div className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr]">
                <Panel title="Drivers">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {drivers.map((driver) => (
                      <div key={driver.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-neutral-100">#{driver.number} {driver.name}</span>
                          <DriverDossierButton state={state} subject={{ type: 'driver', driver }} context="Team HQ" focus="relationship" />
                        </div>
                        <div className="mt-2 space-y-1">
                          <StatBar label="Morale" value={driver.morale} max={100} />
                          <StatBar label="Confidence" value={driver.confidence} max={100} />
                          <StatBar label="Qualifying" value={driver.ratings.qualifying} max={100} />
                          <StatBar label="Race Pace" value={driver.ratings.racePace} max={100} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
                {principal && <PrincipalPanel principal={principal} />}
              </div>
            )}
            {tab === 'news' && (
              <Panel title="Top Team Stories">
                <div className="grid gap-2 lg:grid-cols-2">
                  <div>
                    <NewsList items={state.news.slice(0, 8)} />
                  </div>
                  <div className="border-l border-neutral-800 pl-3">
                    <NewsList items={state.news.filter((item) => item.teamId === state.selectedTeamId).slice(0, 8)} />
                  </div>
                </div>
              </Panel>
            )}
            {tab === 'standings' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <StandingsTable
                  title="Drivers' Championship"
                  entries={state.driverStandings.slice(0, 8)}
                  nameOf={driverName}
                  subtitleOf={(id) => teamName(state.drivers.find((driver) => driver.id === id)?.teamId ?? '')}
                  highlightId={drivers[0]?.id}
                />
                <StandingsTable
                  title="Constructors' Championship"
                  entries={state.constructorStandings.slice(0, 8)}
                  nameOf={teamName}
                  colorOf={teamColor}
                  highlightId={state.selectedTeamId}
                />
              </div>
            )}
          </div>
        )}
      </WorkspaceBody>
      {tab === 'race' && (
        <FmDecisionBar
          actions={<Button variant="primary" onClick={() => navigate(agenda.continueAction.route)} disabled={agenda.continueAction.disabled} title={agenda.continueAction.disabledReason}>{agenda.continueAction.label} →</Button>}
        >
          <strong className="text-neutral-200">Next event: {agenda.nextEvent.label}</strong> · {agenda.nextEvent.detail}
        </FmDecisionBar>
      )}
    </WorkspaceScreen>
  );
}

function AgendaListItem({ item, active = false, onOpen }: { item: CommandAgendaItem; active?: boolean; onOpen: () => void }) {
  return (
    <FmListButton active={active} urgent={item.blocking} onClick={onOpen}>
      <span className="ui-news-list-source">{item.owner} · {item.timingLabel}</span>
      <strong>{item.title}</strong>
      <span>{item.whyNow}</span>
      <small>{item.routeLabel} →</small>
    </FmListButton>
  );
}

function PrincipalPanel({ principal }: { principal: TeamPrincipal }) {
  const labelOf = (list: PrincipalOption[], id: string) => optionById(list, id)?.label ?? id;
  return (
    <Panel title="Team Principal">
      <div className="text-lg font-bold text-neutral-100">{principal.name}</div>
      <div className="mt-1 text-xs text-neutral-500">
        {labelOf(BACKGROUNDS, principal.background)}
        {principal.nationality ? ` · ${principal.nationality}` : ''}
        {principal.age ? ` · ${principal.age}` : ''}
      </div>
      <div className="mt-3 space-y-1 text-xs">
        <Row label="Management" value={labelOf(MANAGEMENT_STYLES, principal.managementStyle)} />
        <Row label="Strength" value={labelOf(STRENGTHS, principal.primaryStrength)} />
        <Row label="Weakness" value={labelOf(STRENGTHS, principal.weakness)} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat label="Reputation" value={principal.reputation} />
        <MiniStat label="Driver Mgmt" value={principal.driverManagement} />
        <MiniStat label="Development" value={principal.developmentFocus} />
        <MiniStat label="Strategy" value={principal.raceStrategy} />
        <MiniStat label="Commercial" value={principal.commercialSkill} />
        <MiniStat label="Risk" value={principal.riskTolerance} />
      </div>
    </Panel>
  );
}

function TeamRatingsPanel({ ratings, academyUsed }: { ratings: TeamOrganizationRatings; academyUsed: number }) {
  const capacity = calculateAcademyCapacity(ratings);
  const rows: { label: string; value: number }[] = [
    { label: 'Car Performance', value: ratings.carPerformance },
    { label: 'Research', value: ratings.research },
    { label: 'Facilities', value: ratings.facilities },
    { label: 'Financial Stability', value: ratings.financialStability },
    { label: 'Staff Quality', value: ratings.staffQuality },
    { label: 'Driver Appeal', value: ratings.driverAppeal },
    { label: 'Sponsor Appeal', value: ratings.sponsorAppeal },
    { label: 'Operations', value: ratings.operations },
    { label: 'Reliability Dept', value: ratings.reliabilityDepartment },
    { label: 'Pit Crew', value: ratings.pitCrew },
    { label: 'Marketing', value: ratings.marketing },
    { label: 'Fan Support', value: ratings.fanSupport },
    { label: 'Media Reach', value: ratings.mediaReach },
    { label: 'Scouting', value: ratings.scouting },
    { label: 'Youth Academy', value: ratings.youthAcademy },
  ];
  return (
    <Panel title="Team Rating" actions={<strong className="text-xl text-amber-400">{ratings.overallTeamRating}/100</strong>}>
      <div className="mb-3 text-sm text-neutral-400">Academy capacity: <strong className="text-neutral-100">{academyUsed}/{capacity}</strong></div>
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-xs">
            <span className="w-28 shrink-0 text-neutral-400">{row.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full" style={{ width: `${row.value}%`, backgroundColor: ratingColor(row.value) }} />
            </div>
            <span className="w-6 text-right tabular-nums text-neutral-300">{row.value}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function NewsList({ items }: { items: Array<{ id: string; headline: string; body?: string }> }) {
  if (items.length === 0) return <p className="text-sm text-neutral-500">No team news yet.</p>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <article key={item.id} className="border-b border-neutral-800 pb-2">
          <strong className="text-xs text-neutral-200">{item.headline}</strong>
          {item.body && <p className="mt-1 text-[11px] text-neutral-500">{item.body}</p>}
        </article>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-neutral-500">{label}</span><span className="truncate font-medium text-neutral-200">{value}</span></div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded border border-neutral-800 bg-neutral-900/40 px-2 py-1 text-center"><div className="text-sm font-bold text-neutral-100">{value}</div><div className="text-[9px] uppercase tracking-wide text-neutral-500">{label}</div></div>;
}

function formatBudget(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
