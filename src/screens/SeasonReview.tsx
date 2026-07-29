import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../game/GameContext';
import { SeasonWorkflowRail } from '../components/workspace/SeasonWorkflowRail';
import { Button } from '../components/Button';
import { StandingsTable } from '../components/StandingsTable';
import { CompactPagination } from '../components/CompactPagination';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  FmDecisionBar,
  FmKeyValue,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import { isSingleSeasonMode } from '../game/modeRestrictions';
import { ARCHETYPE_SPECS, TRAIT_LABELS } from '../sim/aiTeamEngine';
import {
  RESULT_PAGE_SIZE,
  SEASON_REVIEW_TABS,
  transitionPage,
  transitionPageCount,
  type SeasonReviewTab,
} from './raceTransitionViewModel';

export function SeasonReview() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SeasonReviewTab>('honours');
  const [page, setPage] = useState(0);
  if (!state) return null;

  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((team) => team.id === id)?.color;
  const teamOfDriver = (id: string) => teamName(state.drivers.find((driver) => driver.id === id)?.teamId ?? '');
  const champion = state.driverStandings[0];
  const constructorChampion = state.constructorStandings[0];
  const playerStanding = state.constructorStandings.find((entry) => entry.entityId === state.selectedTeamId);
  const playerTeamPosition = state.constructorStandings.findIndex((entry) => entry.entityId === state.selectedTeamId) + 1;
  const aiTeamStates = state.aiTeamStates;
  const activeStandings = tab === 'drivers'
    ? state.driverStandings
    : tab === 'constructors'
      ? state.constructorStandings
      : [];
  const pageCount = transitionPageCount(activeStandings.length, RESULT_PAGE_SIZE);
  const safePage = Math.min(page, pageCount - 1);

  const replaySeason = () => {
    dispatch({
      type: 'NEW_GAME',
      options: {
        gameMode: state.gameMode,
        seasonYear: state.seasonYear,
        series: state.series,
        teamId: state.selectedTeamId,
      },
    });
    navigate('/hq');
  };

  function selectTab(nextTab: SeasonReviewTab) {
    setTab(nextTab);
    setPage(0);
  }

  return (
    <WorkspaceScreen className="era-feature-screen era-season-review-screen">
      <WorkspaceHeader
        eyebrow="Season complete"
        title={`${state.seasonYear} ${state.series} Final Review`}
        subtitle="Honours, final classifications, team outcome, and the route into next season"
        actions={<Button variant="ghost" onClick={() => navigate('/')}>Main Menu</Button>}
      />
      <MetricStrip>
        <WorkspaceMetric label="World champion" value={champion ? driverName(champion.entityId) : '—'} detail={champion ? `${champion.points} pts · ${champion.wins} wins` : undefined} />
        <WorkspaceMetric label="Constructors' champion" value={constructorChampion ? teamName(constructorChampion.entityId) : '—'} detail={constructorChampion ? `${constructorChampion.points} pts · ${constructorChampion.wins} wins` : undefined} />
        <WorkspaceMetric label="Your team" value={playerTeamPosition > 0 ? `P${playerTeamPosition}` : '—'} detail={`${playerStanding?.points ?? 0} championship points`} />
        <WorkspaceMetric label="Season record" value={`${state.calendar.length} rounds`} detail={`${state.driverStandings.length} drivers classified`} />
      </MetricStrip>
      <SeasonWorkflowRail active="season" context={`${state.seasonYear} ${state.series} championship complete`} />
      <WorkspaceTabs items={SEASON_REVIEW_TABS} active={tab} onChange={selectTab} ariaLabel="Season review sections" />
      <WorkspaceBody className="ui-phase14-workspace">

      {tab === 'honours' && (
        <FmWorkspaceGrid className="ui-season-review-grid">
          <FmPane>
            <FmPaneHeader title="World champion" meta="Drivers' championship" />
            <FmPaneBody className="ui-phase14-hero-pane">
              <span>Champion</span>
              <strong>{champion ? driverName(champion.entityId) : '—'}</strong>
              <small>{champion ? `${champion.points} pts · ${champion.wins} wins · ${champion.podiums} podiums` : ''}</small>
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Constructors' champion" meta="Team honours" />
            <FmPaneBody className="ui-phase14-hero-pane">
              <span>Champion team</span>
              <strong>{constructorChampion ? teamName(constructorChampion.entityId) : '—'}</strong>
              <small>{constructorChampion ? `${constructorChampion.points} pts · ${constructorChampion.wins} wins` : ''}</small>
              <ChampionIdentity teamId={constructorChampion?.entityId} />
            </FmPaneBody>
          </FmPane>
          <FmPane>
            <FmPaneHeader title="Your season" meta={teamName(state.selectedTeamId)} />
            <FmPaneBody className="ui-phase14-pane-body">
              <div className="ui-phase14-dossier">
                <section>
                  <h3>Final outcome</h3>
                  <FmKeyValue label="Position" value={`P${playerTeamPosition}`} />
                  <FmKeyValue label="Points" value={playerStanding?.points ?? 0} />
                  <FmKeyValue label="Rounds" value={state.calendar.length} />
                </section>
                <section>
                  <h3>Assessment</h3>
                  <p>{teamName(state.selectedTeamId)} finished P{playerTeamPosition} in the Constructors’ Championship with {playerStanding?.points ?? 0} points.</p>
                </section>
              </div>
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      )}

      {tab === 'drivers' && (
        <FmPane>
          <FmPaneHeader title="Final drivers' standings" meta={`${state.driverStandings.length} classified`} />
          <FmPaneBody className="overflow-auto">
            <StandingsTable
              title="Final Drivers’ Standings"
              entries={transitionPage(state.driverStandings, safePage)}
              nameOf={driverName}
              subtitleOf={teamOfDriver}
              positionOffset={safePage * RESULT_PAGE_SIZE}
            />
          </FmPaneBody>
        </FmPane>
      )}

      {tab === 'constructors' && (
        <FmPane>
          <FmPaneHeader title="Final constructors' standings" meta={`${state.constructorStandings.length} classified`} />
          <FmPaneBody className="overflow-auto">
            <StandingsTable
              title="Final Constructors’ Standings"
              entries={transitionPage(state.constructorStandings, safePage)}
              nameOf={teamName}
              colorOf={teamColor}
              highlightId={state.selectedTeamId}
              positionOffset={safePage * RESULT_PAGE_SIZE}
            />
          </FmPaneBody>
        </FmPane>
      )}

      {tab === 'next' && (
        <div className="ui-phase14-decision-workspace">
          <FmPane>
            <FmPaneHeader title="Season transition" meta={state.gameMode} />
            <FmPaneBody className="ui-phase14-pane-body">
              <div className="ui-phase14-dossier">
                <section>
                  <h3>{state.gameMode === 'Career' ? 'Continue the career' : 'Choose the next save path'}</h3>
                  <p>{state.gameMode === 'Career'
                    ? 'The offseason processes driver movement, technical carryover, commercial reviews, and the next championship.'
                    : 'Single Season saves can finish here or replay the same historical year.'}</p>
                </section>
                {isSingleSeasonMode(state.gameMode) && (
                  <section className="is-warning">
                    <h3>Single Season boundary</h3>
                    <p>Offseason, multi-year development, and season advance are not part of this historical replay mode.</p>
                  </section>
                )}
              </div>
            </FmPaneBody>
          </FmPane>
          <FmDecisionBar actions={state.gameMode === 'Career' ? (
            <>
              <Button onClick={() => navigate('/')}>Main Menu</Button>
              <Button variant="primary" onClick={() => navigate('/offseason')}>Enter Offseason →</Button>
            </>
          ) : (
            <>
              <Button onClick={() => navigate('/')}>Main Menu</Button>
              <Button variant="primary" onClick={replaySeason}>Replay Season</Button>
            </>
          )}>
            <strong className="text-neutral-200">Next meaningful step:</strong>{' '}
            {state.gameMode === 'Career' ? 'review the transition into next season.' : 'choose whether this save ends or replays.'}
          </FmDecisionBar>
        </div>
      )}

      {activeStandings.length > 0 && (
        <CompactPagination
          noun="standings entries"
          total={activeStandings.length}
          page={safePage}
          pageCount={pageCount}
          pageSize={RESULT_PAGE_SIZE}
          onPage={setPage}
        />
      )}
      </WorkspaceBody>
    </WorkspaceScreen>
  );

  function ChampionIdentity({ teamId }: { teamId?: string }) {
    const ai = teamId ? aiTeamStates?.[teamId] : undefined;
    if (!ai) return null;
    const spec = ARCHETYPE_SPECS[ai.archetype];
    return (
      <div className="ui-season-champion-identity">
        {spec && <div className="text-xs text-neutral-400"><span className="font-semibold text-neutral-300">{spec.label}</span> — {spec.description}</div>}
        {ai.philosophy && <div className="mt-2 flex flex-wrap gap-1">{ai.philosophy.traits.map((trait) => <span key={trait} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">{TRAIT_LABELS[trait]}</span>)}</div>}
      </div>
    );
  }
}
