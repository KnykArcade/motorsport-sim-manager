import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { getTrackById } from '../data';
import { SeasonWorkflowRail } from '../components/workspace/SeasonWorkflowRail';
import { Button } from '../components/Button';
import { RaceResultTable } from '../components/RaceResultTable';
import { NewsFeed } from '../components/NewsFeed';
import { StandingsTable } from '../components/StandingsTable';
import { CompactPagination } from '../components/CompactPagination';
import {
  EVENT_PAGE_SIZE,
  RACE_RESULTS_TABS,
  RESULT_PAGE_SIZE,
  transitionPage,
  transitionPageCount,
  type RaceResultsTab,
} from './raceTransitionViewModel';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  FmKeyValue,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';

export function RaceResults() {
  const { raceId } = useParams();
  const { state } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<RaceResultsTab>('summary');
  const [page, setPage] = useState(0);
  const [championship, setChampionship] = useState<'drivers' | 'constructors'>('drivers');
  if (!state || !raceId) return null;

  const race = state.calendar.find((entry) => entry.id === raceId);
  const results = [...(state.completedRaceResults[raceId] ?? [])]
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  const events = state.raceEvents[raceId] ?? [];
  const track = race ? getTrackById(race.trackId) : undefined;
  if (!race || results.length === 0) return null;

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((team) => team.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((driver) => driver.id === id)?.teamId ?? '');
  const playerResults = results.filter((result) => result.teamId === state.selectedTeamId);
  const winner = results[0];
  const activeStandings = championship === 'drivers' ? state.driverStandings : state.constructorStandings;
  const activeEntries = tab === 'classification'
    ? results
    : tab === 'story'
      ? events
      : tab === 'championships'
        ? activeStandings
        : [];
  const pageSize = tab === 'story' ? EVENT_PAGE_SIZE : RESULT_PAGE_SIZE;
  const pageCount = transitionPageCount(activeEntries.length, pageSize);
  const safePage = Math.min(page, pageCount - 1);
  const trackImpact = track
    ? `${race.trackName} rewarded ${topDemand(track)}. ${track.setupProfile.strategyNotes}`
    : '';

  function selectTab(nextTab: RaceResultsTab) {
    setTab(nextTab);
    setPage(0);
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-race-results-screen">
      <WorkspaceHeader
        eyebrow="Race archive"
        title={`${race.gpName} Result`}
        subtitle={`${race.trackName} · Round ${race.round} of ${state.calendar.length}`}
        actions={state.seasonComplete ? (
          <Button variant="primary" onClick={() => navigate('/season-review')}>Season Review →</Button>
        ) : (
          <Button variant="primary" onClick={() => navigate('/hq')}>Back to HQ →</Button>
        )}
      />
      <MetricStrip>
        <WorkspaceMetric label="Winner" value={winner ? driverName(winner.driverId) : '—'} detail={winner ? teamName(winner.teamId) : undefined} />
        <WorkspaceMetric label="Winning team" value={winner ? teamName(winner.teamId) : '—'} detail={winner ? `${winner.points} points scored` : undefined} />
        <WorkspaceMetric
          label="Your best finish"
          value={playerResults[0]?.position ? `P${playerResults[0].position}` : 'No classified finish'}
          detail={playerResults[0] ? driverName(playerResults[0].driverId) : 'No team result recorded'}
        />
        <WorkspaceMetric label="Race story" value={events.length} detail={events.length === 1 ? 'Recorded event' : 'Recorded events'} />
      </MetricStrip>
      <SeasonWorkflowRail active="review" context={`${race.gpName} · Result recorded`} />
      <WorkspaceTabs items={RACE_RESULTS_TABS} active={tab} onChange={selectTab} ariaLabel="Race result sections" />
      <WorkspaceBody className="ui-phase14-workspace">
      {tab === 'summary' && (
        <FmWorkspaceGrid className="ui-race-review-grid">
          <FmPane>
            <FmPaneHeader title="Your team" meta={`${playerResults.length} classified entries`} />
            <FmPaneBody className="ui-phase14-pane-body">
            {playerResults.length === 0 ? <Empty>No team result was recorded.</Empty> : (
              <div className="ui-result-team-list">
                {playerResults.map((result) => (
                  <article key={result.driverId} className="ui-result-driver-row">
                    <span>{driverName(result.driverId)}</span>
                    <strong>{result.position ? `P${result.position}` : result.status}</strong>
                    <small>Started P{result.gridPosition} · {result.points} pts</small>
                  </article>
                ))}
              </div>
            )}
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Race headlines" meta={`${state.news.filter((item) => item.round === race.round).length} reports`} />
            <FmPaneBody className="ui-phase14-pane-body">
              <NewsFeed items={state.news.filter((item) => item.round === race.round)} />
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Result context" meta={race.trackName} />
            <FmPaneBody className="ui-phase14-pane-body">
              <div className="ui-phase14-dossier">
                <section>
                  <h3>Track impact</h3>
                  <p>{trackImpact}</p>
                </section>
                <section>
                  <h3>Winning entry</h3>
                  <FmKeyValue label="Driver" value={winner ? driverName(winner.driverId) : '—'} />
                  <FmKeyValue label="Team" value={winner ? teamName(winner.teamId) : '—'} />
                  <FmKeyValue label="Points" value={winner?.points ?? 0} />
                </section>
                <section>
                  <h3>Your outcome</h3>
                  <FmKeyValue label="Best finish" value={playerResults[0]?.position ? `P${playerResults[0].position}` : 'No classified finish'} />
                  <FmKeyValue label="Team points" value={playerResults.reduce((total, result) => total + result.points, 0)} />
                </section>
              </div>
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      )}

      {tab === 'classification' && (
        <FmWorkspaceGrid columns="two" className="ui-race-classification-grid">
          <FmPane>
            <FmPaneHeader title="Race classification" meta={`${results.length} entries`} />
            <FmPaneBody className="overflow-auto">
              <RaceResultTable
                results={transitionPage(results, safePage)}
                nameOf={driverName}
                teamNameOf={teamName}
                colorOf={teamColor}
                highlightTeamId={state.selectedTeamId}
              />
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Classification context" meta="Selected team result" />
            <FmPaneBody className="ui-phase14-pane-body">
              <div className="ui-phase14-dossier">
                {playerResults.map((result) => (
                  <section key={result.driverId}>
                    <h3>{driverName(result.driverId)}</h3>
                    <FmKeyValue label="Finish" value={result.position ? `P${result.position}` : result.status} />
                    <FmKeyValue label="Grid" value={`P${result.gridPosition}`} />
                    <FmKeyValue label="Points" value={result.points} />
                  </section>
                ))}
              </div>
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      )}

      {tab === 'story' && (
        <FmWorkspaceGrid columns="two" className="ui-race-story-grid">
          <FmPane>
            <FmPaneHeader title="Race event log" meta={`${events.length} recorded events`} />
            <FmPaneBody className="overflow-auto">
              {events.length === 0 ? <div className="ui-phase14-pane-body"><Empty>Quiet race — no major incidents.</Empty></div> : (
                <div className="ui-race-event-list">
                  {transitionPage(events, safePage, EVENT_PAGE_SIZE).map((event, index) => (
                    <article key={`${event.lap}-${index}-${event.text}`}>
                      <strong>Lap {event.lap}</strong>
                      <span>{event.text}</span>
                    </article>
                  ))}
                </div>
              )}
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Story context" meta="Race record" />
            <FmPaneBody className="ui-phase14-pane-body">
              <div className="ui-phase14-dossier">
                <section><h3>Event volume</h3><FmKeyValue label="Recorded" value={events.length} /><FmKeyValue label="Round" value={race.round} /></section>
                <section><h3>Track influence</h3><p>{trackImpact}</p></section>
              </div>
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      )}

      {tab === 'championships' && (
        <FmWorkspaceGrid columns="two" className="ui-race-championship-grid">
          <FmPane>
            <FmPaneHeader title={championship === 'drivers' ? "Drivers' championship" : "Constructors' championship"} meta={`After round ${race.round}`} />
            <FmPaneBody className="overflow-auto">
              <StandingsTable
                title={championship === 'drivers' ? "Drivers' Championship" : "Constructors' Championship"}
                entries={transitionPage(activeStandings, safePage)}
                nameOf={championship === 'drivers' ? driverName : teamName}
                subtitleOf={championship === 'drivers' ? teamOfDriver : undefined}
                colorOf={championship === 'constructors' ? teamColor : undefined}
                highlightId={championship === 'constructors' ? state.selectedTeamId : undefined}
                positionOffset={safePage * RESULT_PAGE_SIZE}
              />
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Championship view" meta="Choose classification" />
            <FmPaneBody>
              <SubTab active={championship === 'drivers'} onClick={() => { setChampionship('drivers'); setPage(0); }}>Drivers</SubTab>
              <SubTab active={championship === 'constructors'} onClick={() => { setChampionship('constructors'); setPage(0); }}>Constructors</SubTab>
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      )}

      {activeEntries.length > 0 && (
        <CompactPagination
          noun={tab === 'story' ? 'events' : tab === 'classification' ? 'finishers' : 'standings entries'}
          total={activeEntries.length}
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          onPage={setPage}
        />
      )}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function SubTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`ui-phase14-choice ${active ? 'is-active' : ''}`}>{children}</button>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}

function topDemand(track: ReturnType<typeof getTrackById>): string {
  if (!track) return 'a balanced approach';
  const demands: [string, number][] = [
    ['engine power', track.setupProfile.powerDemand],
    ['aero efficiency', track.setupProfile.aeroDemand],
    ['mechanical grip', track.setupProfile.mechanicalDemand],
  ];
  demands.sort((a, b) => b[1] - a[1]);
  return `${demands[0][0]} and ${demands[1][0]}`;
}
