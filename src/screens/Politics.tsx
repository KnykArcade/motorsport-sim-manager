import { useState } from 'react';
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
  resolveProposal,
} from '../sim/politicsEngine';
import type { RegulationProposal, RegulationVote } from '../types/politicsTypes';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';

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
  const [activeTab, setActiveTab] = useState<TabKey>('regulations');
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

  return (
    <WorkspaceScreen>
      <WorkspaceHeader
        eyebrow="Technical governance"
        title="Regulations & Politics"
        subtitle={`Lobby and vote on the rules taking effect in ${effectiveYear}; results settle at season rollover`}
      />
      <MetricStrip>
        <WorkspaceMetric label="Political influence" value={playerInfluence} detail={playerRank > 0 ? `Rank ${playerRank} of ${ranked.length}` : 'No grid rank'} />
        <WorkspaceMetric label="Open proposals" value={proposals.length} detail={`${votedCount} votes currently set`} />
        <WorkspaceMetric label="Effective season" value={effectiveYear} detail="Next regulation settlement" />
        <WorkspaceMetric label="Recorded votes" value={history.length} detail={`${history.filter((result) => result.passed).length} proposals passed`} />
      </MetricStrip>
      <WorkspaceTabs
        items={TABS.map((tab) => ({ id: tab.key, label: `${tab.label}${tab.key === 'proposals' ? ` (${proposals.length})` : ''}` }))}
        active={activeTab}
        onChange={setActiveTab}
        ariaLabel="Regulations and politics sections"
      />
      <WorkspaceBody className="space-y-4">

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
                        style={{ width: `${r.influence}%`, backgroundColor: r.teamId === playerId ? '#f59e0b' : ratingColor(r.influence) }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums" style={{ color: r.teamId === playerId ? '#f59e0b' : ratingColor(r.influence) }}>{r.influence}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      )}

      {activeTab === 'proposals' && (
        <Panel title={`Open Proposals — vote for ${effectiveYear}`}>
          {proposals.length === 0 ? (
            <p className="text-sm text-neutral-400">No proposals are on the table right now.</p>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  teamName={teamName}
                  influence={influence}
                  playerTeamId={playerId}
                  onVote={(vote) => dispatch({ type: 'SET_REGULATION_VOTE', proposalId: p.id, vote })}
                />
              ))}
            </div>
          )}
        </Panel>
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
}: {
  proposal: RegulationProposal;
  teamName: (id: string) => string;
  influence: Record<string, number>;
  playerTeamId: string;
  onVote: (vote: RegulationVote) => void;
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
    </div>
  );
}
