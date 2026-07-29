import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import { getRegulationSet } from '../data';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { RegulationPanel } from '../components/RegulationPanel';
import { ratingColor } from '../components/ui';
import {
  computePoliticalInfluence,
  influenceByTeam,
  regulationVotingLocked,
  resolveProposal,
  seasonMidpointRound,
} from '../sim/politicsEngine';
import type { RegulationProposal, RegulationVote } from '../types/politicsTypes';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
import {
  regulationVotingStatus,
  selectedTechnicalRecord,
} from './technicalCommercialViewModel';

const VOTES: RegulationVote[] = ['Support', 'Oppose', 'Abstain'];

type TabKey = 'regulations' | 'influence' | 'proposals' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'regulations', label: 'Season Regulations' },
  { key: 'influence', label: 'Your Political Influence' },
  { key: 'proposals', label: 'Open Proposals' },
  { key: 'history', label: 'Vote History' },
];

export function Politics() {
  const { state, dispatch } = useGame();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<TabKey>(
    requestedTab && TABS.some((tab) => tab.key === requestedTab) ? requestedTab as TabKey : 'regulations',
  );
  const [selectedProposalId, setSelectedProposalId] = useState<string | undefined>(searchParams.get('focus') ?? undefined);
  if (!state) return null;

  const proposals = state.regulationProposals ?? [];
  if (proposals.length === 0 && (state.regulationVoteHistory ?? []).length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-neutral-100">Regulations &amp; Politics</h1>
        <Panel title="Regulation Voting">
          <p className="text-sm text-neutral-400">Regulation voting is available in Career Mode.</p>
        </Panel>
      </div>
    );
  }

  const teamName = (id: string) => teamById(state, id)?.name ?? id;
  const influence = influenceByTeam(state.teams, state.teamReputations, state.engine);
  const ranked = computePoliticalInfluence(state.teams, state.teamReputations, state.engine).sort(
    (a, b) => b.influence - a.influence,
  );
  const playerId = state.selectedTeamId;
  const playerInfluence = influence[playerId] ?? 0;
  const playerRank = ranked.findIndex((r) => r.teamId === playerId) + 1;

  const effectiveYear = proposals[0]?.seasonYearEffective ?? state.seasonYear + 1;
  const history = (state.regulationVoteHistory ?? []).slice().reverse();

  const regSet = getRegulationSet(state.regulationSetId);
  const votedCount = proposals.filter((proposal) => proposal.playerVote).length;
  const unvotedCount = proposals.length - votedCount;
  const currentRound = state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
  const lockRound = seasonMidpointRound(state.calendar.length);
  const votingLocked = regulationVotingLocked(currentRound, state.calendar.length);
  const selectedProposal = selectedTechnicalRecord(proposals, selectedProposalId);

  return (
    <WorkspaceScreen>
      <WorkspaceHeader
        eyebrow="Technical governance"
        title="Regulations & Politics"
        subtitle={`Lobby and vote on the rules taking effect in ${effectiveYear}; results settle at season rollover`}
        actions={(
          <div className="ui-technical-header-readout">
            <span><strong>{playerInfluence}</strong> influence</span>
            <span><strong>#{playerRank > 0 ? playerRank : '—'}</strong> grid rank</span>
            <span><strong>{votedCount}/{proposals.length}</strong> votes set</span>
            <span><strong>{effectiveYear}</strong> effective season</span>
          </div>
        )}
      />
      <WorkspaceTabs
        items={TABS.map((tab) => ({ id: tab.key, label: `${tab.label}${tab.key === 'proposals' ? ` (${proposals.length})` : ''}` }))}
        active={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          const next = new URLSearchParams(searchParams);
          if (tab === 'regulations') next.delete('tab');
          else next.set('tab', tab);
          setSearchParams(next);
        }}
        ariaLabel="Regulations and politics sections"
      />
      <WorkspaceBody className="space-y-4">
      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="ui-decision-strip-pulse" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-neutral-100">Governance operations desk</div>
            <div className="truncate text-neutral-400">
              {regulationVotingStatus(votingLocked, unvotedCount, lockRound)}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {playerInfluence} influence · rank {playerRank > 0 ? playerRank : '—'}
        </span>
      </div>

      {activeTab === 'regulations' && regSet && (
        <RegulationPanel regulationSet={regSet} seasonYear={state.seasonYear} />
      )}

      {activeTab === 'influence' && (
        <Panel title="Your Political Influence">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-3xl font-bold text-neutral-100 tabular-nums">{playerInfluence}</div>
              <div className="text-xs text-neutral-500">
                {playerRank > 0 ? `Ranked #${playerRank} of ${ranked.length} on the grid` : ''}
              </div>
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="space-y-1.5">
                {ranked.slice(0, 6).map((r) => (
                  <div key={r.teamId} className="flex items-center gap-2 text-xs">
                    <span
                      className={`w-28 truncate ${r.teamId === playerId ? 'font-semibold text-amber-300' : 'text-neutral-400'}`}
                    >
                      {teamName(r.teamId)}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full"
                        style={{ width: `${r.influence}%`, backgroundColor: r.teamId === playerId ? 'var(--era-accent)' : ratingColor(r.influence) }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums" style={{ color: r.teamId === playerId ? 'var(--era-accent-strong)' : ratingColor(r.influence) }}>{r.influence}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {activeTab === 'proposals' && (
        <FmWorkspaceGrid columns="three" className="ui-politics-proposal-grid">
          <FmPane>
            <FmPaneHeader title="Open proposals" meta={`${unvotedCount} awaiting vote`} />
            <FmPaneBody className="overflow-auto">
              {proposals.map((proposal) => (
                <FmListButton
                  key={proposal.id}
                  active={selectedProposal?.id === proposal.id}
                  urgent={!proposal.playerVote && !votingLocked}
                  onClick={() => setSelectedProposalId(proposal.id)}
                >
                  <span>{proposal.category} · {proposal.playerVote ?? 'No vote set'}</span>
                  <strong>{proposal.title}</strong>
                  <small>Effective {proposal.seasonYearEffective}</small>
                </FmListButton>
              ))}
              {proposals.length === 0 && <p className="ui-technical-empty">No proposals are on the table right now.</p>}
            </FmPaneBody>
          </FmPane>
          <FmPane className="ui-politics-proposal-detail">
            <FmPaneHeader title={selectedProposal?.title ?? 'Proposal dossier'} meta={selectedProposal?.category} />
            <FmPaneBody className="overflow-auto">
              {selectedProposal && (
                <ProposalCard
                  proposal={selectedProposal}
                  teamName={teamName}
                  influence={influence}
                  playerTeamId={playerId}
                  onVote={(vote) => dispatch({ type: 'SET_REGULATION_VOTE', proposalId: selectedProposal.id, vote })}
                  votingLocked={votingLocked}
                />
              )}
            </FmPaneBody>
          </FmPane>
          <FmPane className="ui-politics-context-pane">
            <FmPaneHeader title="Voting context" meta={`Effective ${effectiveYear}`} />
            <FmPaneBody className="overflow-auto">
              <div className="ui-technical-dossier">
                <section>
                  <FmKeyValue label="Your influence" value={`${playerInfluence}`} />
                  <FmKeyValue label="Grid rank" value={playerRank > 0 ? `#${playerRank} of ${ranked.length}` : 'Unranked'} />
                  <FmKeyValue label="Vote lock" value={votingLocked ? `Locked after round ${lockRound}` : `Open through round ${lockRound}`} />
                  <FmKeyValue label="Recorded history" value={`${history.length} votes`} />
                </section>
                <section>
                  <h3>Settlement</h3>
                  <p>Projected blocs include each team’s political influence and current position. Recorded votes lock at midpoint and resolve at season rollover.</p>
                </section>
              </div>
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      )}

      {activeTab === 'history' && (
        <Panel title="Vote History">
          {history.length === 0 ? (
            <p className="text-sm text-neutral-400">No regulations have been voted on yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {history.map((r) => (
                <li key={r.proposalId} className="flex flex-wrap items-center gap-2 text-neutral-300">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                      r.passed ? 'bg-green-950/60 text-green-300' : 'bg-red-950/60 text-red-300'
                    }`}
                  >
                    {r.passed ? 'Passed' : 'Rejected'}
                  </span>
                  <span className="text-neutral-400">{r.seasonYearEffective}</span>
                  <span className="text-neutral-200">{proposalTitle(r.proposalId)}</span>
                  <span className="text-xs text-neutral-500">
                    for {r.supportWeight} · against {r.opposeWeight}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

// Reconstruct a readable title from the proposal id (reg-<year>-<key>).
function proposalTitle(proposalId: string): string {
  const key = proposalId.split('-').slice(2).join('-');
  return key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function ProposalCard({
  proposal,
  teamName,
  influence,
  playerTeamId,
  onVote,
  votingLocked,
}: {
  proposal: RegulationProposal;
  teamName: (id: string) => string;
  influence: Record<string, number>;
  playerTeamId: string;
  onVote: (vote: RegulationVote) => void;
  votingLocked: boolean;
}) {
  // Live projection with the player's current vote applied.
  const projected = resolveProposal(proposal, influence, playerTeamId);
  const total = projected.supportWeight + projected.opposeWeight || 1;
  const supportPct = Math.round((projected.supportWeight / total) * 100);

  // Notable backers/opponents among rivals (excluding the player).
  const rivals = Object.entries(proposal.supportByTeam).filter(([id]) => id !== playerTeamId);
  const backers = rivals
    .filter(([, s]) => s >= 25)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => teamName(id));
  const opponents = rivals
    .filter(([, s]) => s <= -25)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([id]) => teamName(id));

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-bold text-neutral-100">{proposal.title}</span>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
          {proposal.category}
        </span>
      </div>
      <p className="text-xs text-neutral-400">{proposal.description}</p>

      <div className="mt-3">
        <div className="mb-0.5 flex items-center justify-between text-[11px]">
          <span className={projected.passed ? 'text-green-400' : 'text-red-400'}>
            Projected: {projected.passed ? 'Likely to pass' : 'Likely to fail'}
          </span>
          <span className="text-neutral-500 tabular-nums">{supportPct}% support</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-800">
          <div className="h-full" style={{ width: `${supportPct}%`, backgroundColor: ratingColor(supportPct) }} />
          <div className="h-full bg-red-500" style={{ width: `${100 - supportPct}%` }} />
        </div>
      </div>

      {(backers.length > 0 || opponents.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {backers.length > 0 && (
            <span className="text-neutral-500">
              Backed by <span className="text-green-400">{backers.join(', ')}</span>
            </span>
          )}
          {opponents.length > 0 && (
            <span className="text-neutral-500">
              Opposed by <span className="text-red-400">{opponents.join(', ')}</span>
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {VOTES.map((vote) => {
          const active = proposal.playerVote === vote;
          return (
            <Button
              key={vote}
              variant={active ? 'primary' : 'secondary'}
              className="flex-1 px-2 py-1 text-xs"
              onClick={() => onVote(vote)}
              disabled={votingLocked}
            >
              {vote}
            </Button>
          );
        })}
      </div>
      {proposal.playerVote && (
        <p className="mt-1.5 text-[11px] text-neutral-500">
          You are voting <span className="text-neutral-300">{proposal.playerVote}</span>. Click again
          to clear.
        </p>
      )}
      {votingLocked && (
        <p className="mt-1.5 text-[11px] text-amber-300">Voting is locked after the season midpoint; this proposal will resolve at rollover.</p>
      )}
    </div>
  );
}
