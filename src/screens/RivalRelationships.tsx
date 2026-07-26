import { useState } from 'react';
import { formatMoney } from '../components/ui';
import {
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import { useGame } from '../game/GameContext';
import {
  RIVAL_ACTION_COST,
  rivalActionContext,
  rivalActionUsedThisRound,
  rivalRelationshipLabel,
} from '../sim/phase18RivalRelationshipEngine';
import type { RivalAction, RivalRelationship } from '../types/phase18Types';
import { RivalPrincipalBriefing } from './rivals/RivalPrincipalBriefing';
import { rivalPrincipalBrief } from './rivals/rivalPrincipalBriefViewModel';

type RivalTab = 'dossier' | 'actions' | 'activity';
const PAGE_SIZE = 8;

export function RivalRelationships() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<RivalTab>('dossier');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  if (!state) return null;

  const playerId = state.selectedTeamId;
  const relationships = Object.values(state.phase18?.rivalRelationships ?? {})
    .filter((item) => item.teamAId === playerId || item.teamBId === playerId)
    .sort((a, b) => a.score - b.score);
  const rivalIdOf = (item: RivalRelationship) => item.teamAId === playerId ? item.teamBId : item.teamAId;
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const selected = relationships.find((item) => rivalIdOf(item) === selectedId) ?? relationships[0];
  const selectedRivalId = selected ? rivalIdOf(selected) : undefined;
  const budget = state.teams.find((team) => team.id === playerId)?.budget ?? 0;
  const currentRound = state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
  const pageCount = Math.max(1, Math.ceil(relationships.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = relationships.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const activity = relationships
    .flatMap((relationship) => relationship.history.map((event) => ({ ...event, rivalId: rivalIdOf(relationship) })))
    .sort((a, b) => b.seasonYear - a.seasonYear || (b.round ?? 0) - (a.round ?? 0));
  const selectedActivity = selectedRivalId
    ? activity.filter((event) => event.rivalId === selectedRivalId).slice(0, 12)
    : [];
  const closestAlly = [...relationships].sort((a, b) => b.score - a.score)[0];
  const bitterestRival = relationships[0];
  const selectedBrief = selected && selectedRivalId
    ? rivalPrincipalBrief(state, selected, selectedRivalId)
    : undefined;

  return (
    <WorkspaceScreen className="ui-team-people-screen">
      <WorkspaceHeader
        eyebrow="People center"
        title="Rival Relationships"
        subtitle="Paddock dossiers, political posture, technical suspicion, and management actions"
      />
      <WorkspaceTabs
        items={[
          { id: 'dossier', label: 'Rival Dossier' },
          { id: 'actions', label: 'Management Actions' },
          { id: 'activity', label: `Activity (${activity.length})` },
        ]}
        active={tab}
        onChange={setTab}
        ariaLabel="Rival relationship sections"
      />
      <WorkspaceBody className="overflow-hidden">
        <FmWorkspaceGrid columns="three">
          <FmPane>
            <FmPaneHeader title="Paddock Relationships" meta={`${relationships.length} tracked teams`} />
            <FmPaneBody className="overflow-auto">
              {visible.map((relationship) => {
                const rivalId = rivalIdOf(relationship);
                return (
                  <FmListButton
                    key={relationship.id}
                    active={selectedRivalId === rivalId}
                    urgent={relationship.score <= -15}
                    onClick={() => setSelectedId(rivalId)}
                  >
                    <span className="ui-news-list-source">{rivalRelationshipLabel(relationship.score)}</span>
                    <strong>{teamName(rivalId)}</strong>
                    <span>{signed(relationship.score)} relationship · {relationship.sportingRespect} respect</span>
                    <small>{relationship.tags.slice(0, 2).map(splitLabel).join(' · ') || 'No defining tags'}</small>
                  </FmListButton>
                );
              })}
              {relationships.length === 0 && <div className="ui-inbox-empty">No rival relationships are currently tracked.</div>}
            </FmPaneBody>
            {pageCount > 1 && (
              <div className="ui-team-list-pagination">
                <button type="button" onClick={() => { setPage(Math.max(0, safePage - 1)); setSelectedId(undefined); }} disabled={safePage === 0}>Previous</button>
                <span>{safePage + 1} / {pageCount}</span>
                <button type="button" onClick={() => { setPage(Math.min(pageCount - 1, safePage + 1)); setSelectedId(undefined); }} disabled={safePage >= pageCount - 1}>Next</button>
              </div>
            )}
          </FmPane>

          <FmPane className="ui-rival-dossier-pane">
            {selected && selectedRivalId ? (
              <>
                <FmPaneHeader title={teamName(selectedRivalId)} meta={rivalRelationshipLabel(selected.score)} />
                <FmPaneBody className="ui-rival-dossier-body overflow-auto">
                  {tab === 'dossier' && (
                    <>
                      <section className="ui-rival-score-header">
                        <div><span>Overall relationship</span><strong>{signed(selected.score)}</strong></div>
                        <p>{selected.tags.length ? selected.tags.map(splitLabel).join(' · ') : 'No defining rivalry tags recorded.'}</p>
                      </section>
                      <section className="ui-rival-meter-grid">
                        <Meter label="Sporting respect" value={selected.sportingRespect} />
                        <Meter label="Political alignment" value={(selected.politicalAlignment + 100) / 2} display={selected.politicalAlignment} />
                        <Meter label="Commercial trust" value={selected.commercialTrust} />
                        <Meter label="Technical suspicion" value={selected.technicalSuspicion} danger />
                      </section>
                      {selectedBrief && <RivalPrincipalBriefing brief={selectedBrief} />}
                    </>
                  )}
                  {tab === 'actions' && (
                    <section>
                      <h3 className="ui-fm-section-label">Management actions</h3>
                      <p className="ui-fm-detail-copy">Each action can be used once per rival per round. The original cost, fit, and disabled-reason rules remain in force.</p>
                      <div className="ui-rival-action-grid">
                        {(['OpenDialogue', 'TechnicalExchange', 'ScoutPersonnel', 'FileProtest'] as RivalAction[]).map((action) => {
                          const used = rivalActionUsedThisRound(state, selectedRivalId, action);
                          const insufficientBudget = budget < RIVAL_ACTION_COST[action];
                          const context = rivalActionContext(state, selectedRivalId, action);
                          const disabledReason = used
                            ? `Already used against this rival in round ${currentRound}`
                            : insufficientBudget
                              ? 'Insufficient budget'
                              : undefined;
                          return (
                            <button
                              key={action}
                              type="button"
                              disabled={used || insufficientBudget}
                              title={disabledReason}
                              onClick={() => dispatch({ type: 'TAKE_RIVAL_ACTION', rivalTeamId: selectedRivalId, action })}
                            >
                              <span>{context?.fit ?? 'Neutral'}</span>
                              <strong>{splitLabel(action)}</strong>
                              <p>{actionDescription(action)}</p>
                              {context && <small>{context.effectPreview} {context.reason}</small>}
                              <em>
                                {used
                                  ? `Available round ${currentRound + 1}`
                                  : insufficientBudget
                                    ? `Needs ${formatMoney(RIVAL_ACTION_COST[action])}`
                                    : RIVAL_ACTION_COST[action]
                                      ? formatMoney(RIVAL_ACTION_COST[action])
                                      : 'No cost'}
                              </em>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {tab === 'activity' && (
                    <section className="ui-rival-activity">
                      <h3 className="ui-fm-section-label">Activity history</h3>
                      {selectedActivity.length
                        ? selectedActivity.map((event) => (
                          <article key={event.id}>
                            <span>{event.seasonYear}{event.round ? ` · Round ${event.round}` : ''} · {event.category}</span>
                            <strong>{event.reason}</strong>
                            <em>{signed(event.amount)} relationship</em>
                          </article>
                        ))
                        : <p className="ui-fm-detail-copy">No major relationship events have occurred with this team.</p>}
                    </section>
                  )}
                </FmPaneBody>
              </>
            ) : <FmPaneBody className="ui-inbox-empty">Select a rival team to open its dossier.</FmPaneBody>}
          </FmPane>

          <FmPane>
            <FmPaneHeader title="Paddock Context" meta={`Round ${currentRound}`} />
            <FmPaneBody className="ui-team-context-pane overflow-auto">
              <section>
                <h3>Relationship field</h3>
                <FmKeyValue label="Closest ally" value={closestAlly ? teamName(rivalIdOf(closestAlly)) : '—'} />
                <FmKeyValue label="Bitterest rival" value={bitterestRival ? teamName(rivalIdOf(bitterestRival)) : '—'} />
                <FmKeyValue label="Open tensions" value={relationships.filter((item) => item.score <= -15).length} />
                <FmKeyValue label="Action budget" value={formatMoney(budget)} />
              </section>
              {selected && (
                <>
                  <section>
                    <h3>Selected team</h3>
                    <FmKeyValue label="Relationship" value={signed(selected.score)} />
                    <FmKeyValue label="Respect" value={selected.sportingRespect} />
                    <FmKeyValue label="Politics" value={selected.politicalAlignment} />
                    <FmKeyValue label="Trust" value={selected.commercialTrust} />
                    <FmKeyValue label="Suspicion" value={selected.technicalSuspicion} />
                  </section>
                  <section>
                    <h3>Action rule</h3>
                    <p>Each action remains limited to once per rival in the current round. Disabled actions show the exact reason.</p>
                  </section>
                </>
              )}
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function splitLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').trim();
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

function actionDescription(action: RivalAction): string {
  if (action === 'OpenDialogue') return 'Lower tension and improve political alignment.';
  if (action === 'TechnicalExchange') return 'Build trust and reduce copying suspicion.';
  if (action === 'ScoutPersonnel') return 'Monitor staff and drivers, increasing market tension.';
  return 'Challenge suspected illegality; success depends on technical suspicion.';
}

function Meter({
  label,
  value,
  display,
  danger,
}: {
  label: string;
  value: number;
  display?: number;
  danger?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <span>{label}</span>
      <strong>{display ?? Math.round(value)}</strong>
      <i><b className={danger ? 'is-danger' : ''} style={{ width: `${pct}%` }} /></i>
    </div>
  );
}
