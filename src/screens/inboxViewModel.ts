// FM24/OOTP-style inbox: one chronological feed combining action items that
// need the player's decision with racing news/stories that give the world
// depth. Pure projection of existing state — no new simulation mechanics.

import type { GameState } from '../game/careerState';
import { activeDriversForTeam } from '../game/careerState';
import { developmentSlots } from '../sim/facilityEngine';
import { technicalDirectorProposals } from '../sim/technicalAdvisorEngine';
import { technicalStateForTeam } from '../sim/technicalAdapters';
import type { NewsItem } from '../types/gameTypes';

export type InboxSeverity = 'critical' | 'action' | 'info';

export type InboxCategory =
  | 'technical'
  | 'paddock'
  | 'people'
  | 'business'
  | 'news';

export type InboxMessage = {
  id: string;
  severity: InboxSeverity;
  category: InboxCategory;
  title: string;
  body?: string;
  /** Route to the screen that owns this item. */
  route: string;
  routeLabel: string;
  /** True while the underlying item still needs a decision; pinned on top. */
  actionable: boolean;
  /** Sort key within a severity band: newer first. Round-based where known. */
  round?: number;
  timestamp?: string;
};

const SEVERITY_ORDER: Record<InboxSeverity, number> = { critical: 0, action: 1, info: 2 };

function newsSeverity(item: NewsItem): InboxSeverity {
  if (item.priority === 'critical') return 'critical';
  if (item.priority === 'high') return 'action';
  return 'info';
}

function technicalMessages(state: GameState): InboxMessage[] {
  const messages: InboxMessage[] = [];
  const technical = technicalStateForTeam(state, state.selectedTeamId);
  const slots = developmentSlots(state.facilities);
  const active = technical?.activeProjects.length ?? 0;

  const proposals = technicalDirectorProposals(state);
  if (proposals.length > 0) {
    messages.push({
      id: 'inbox-td-briefing',
      severity: 'action',
      category: 'technical',
      title: `Technical Director's briefing: ${proposals.length} proposal${proposals.length === 1 ? '' : 's'} awaiting your decision`,
      body: proposals.map((proposal) => proposal.title).join(' · '),
      route: '/technical',
      routeLabel: 'Open Technical Center',
      actionable: true,
    });
  }

  const parts = state.teamParts?.[state.selectedTeamId];
  const criticalParts = (parts?.inventory ?? []).filter((part) => part.status === 'fitted' && part.condition < 25);
  if (criticalParts.length > 0) {
    messages.push({
      id: 'inbox-critical-parts',
      severity: 'critical',
      category: 'technical',
      title: `${criticalParts.length} fitted component${criticalParts.length === 1 ? ' is' : 's are'} at critical condition`,
      body: criticalParts.map((part) => `${part.name} (${Math.round(part.condition)}%)`).join(' · '),
      route: '/technical',
      routeLabel: 'Open Parts & Factory',
      actionable: true,
    });
  }

  if (slots > 0 && active >= slots) {
    messages.push({
      id: 'inbox-capacity-full',
      severity: 'info',
      category: 'technical',
      title: 'All technical capacity is committed',
      body: `${active}/${slots} development and research slots in use.`,
      route: '/technical',
      routeLabel: 'Open Technical Center',
      actionable: false,
    });
  }
  return messages;
}

function paddockMessages(state: GameState): InboxMessage[] {
  const messages: InboxMessage[] = [];
  const unresolved = (state.careerPhase?.paddockEvents ?? []).filter((event) => !event.resolvedOptionId && (event.options?.length ?? 0) > 0);
  for (const event of unresolved) {
    messages.push({
      id: `inbox-paddock-${event.id}`,
      severity: event.isRequiredDecision ? 'critical' : 'action',
      category: 'paddock',
      title: event.title,
      body: event.description,
      route: '/paddock',
      routeLabel: 'Open Paddock Week',
      actionable: true,
      round: event.round,
    });
  }

  const reports = (state.phase18?.intelligenceReports ?? []).filter(
    (report) => (report.status ?? 'Active') === 'Active'
      && !report.actionTaken
      && (report.gameplayRelevance === 'High' || report.gameplayRelevance === 'Critical'),
  );
  for (const report of reports) {
    messages.push({
      id: `inbox-intel-${report.id}`,
      severity: report.gameplayRelevance === 'Critical' ? 'critical' : 'action',
      category: 'paddock',
      title: `Intelligence: ${report.title}`,
      body: report.summary,
      route: '/scouting',
      routeLabel: 'Open Intelligence',
      actionable: true,
      round: report.discoveredRound,
    });
  }

  const cases = (state.phase18?.failureInvestigations?.cases ?? []).filter(
    (item) => item.status === 'AwaitingInvestigation' || item.status === 'FindingsReady',
  );
  for (const item of cases) {
    messages.push({
      id: `inbox-failure-${item.id}`,
      severity: 'action',
      category: 'paddock',
      title: item.status === 'FindingsReady' ? 'Failure investigation findings are ready' : 'A failure is awaiting investigation',
      body: item.incidentSummary,
      route: '/paddock',
      routeLabel: 'Open Paddock Week',
      actionable: true,
      round: item.round,
    });
  }
  return messages;
}

function peopleMessages(state: GameState): InboxMessage[] {
  const messages: InboxMessage[] = [];
  const currentRound = state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1;

  const duePromises = (state.driverPromises ?? []).filter((promise) =>
    promise.status === 'active'
    && promise.dueSeason !== undefined
    && (promise.dueSeason < state.seasonYear
      || (promise.dueSeason === state.seasonYear && (promise.dueRound === undefined || promise.dueRound <= currentRound + 2))));
  for (const promise of duePromises) {
    const driver = state.drivers.find((candidate) => candidate.id === promise.driverId);
    messages.push({
      id: `inbox-promise-${promise.id}`,
      severity: 'action',
      category: 'people',
      title: `Promise to ${driver?.name ?? 'a driver'} is coming due`,
      body: promise.notes ?? `Due ${promise.dueSeason}${promise.dueRound ? ` · R${promise.dueRound}` : ''}.`,
      route: '/relationships',
      routeLabel: 'Open Driver Relations',
      actionable: true,
      round: promise.dueRound,
    });
  }

  const expiring = activeDriversForTeam(state, state.selectedTeamId)
    .filter((driver) => (driver.contractYearsRemaining ?? 99) <= 1);
  if (expiring.length > 0) {
    messages.push({
      id: 'inbox-contracts-expiring',
      severity: 'action',
      category: 'people',
      title: `${expiring.length} driver contract${expiring.length === 1 ? '' : 's'} expiring after this season`,
      body: expiring.map((driver) => driver.name).join(' · '),
      route: '/drivers',
      routeLabel: 'Open Drivers',
      actionable: true,
    });
  }

  for (const offer of state.jobOffers ?? []) {
    const team = state.teams.find((candidate) => candidate.id === offer.teamId);
    messages.push({
      id: `inbox-job-${offer.id}`,
      severity: offer.kind === 'Offer' ? 'action' : 'info',
      category: 'people',
      title: offer.kind === 'Offer' ? `Job offer from ${team?.name ?? 'a rival team'}` : `${team?.name ?? 'A rival team'} is rumored to be interested in you`,
      body: `${offer.objective} · ${offer.contractYears}-year deal · ${offer.budgetTier} budget`,
      route: '/principal',
      routeLabel: 'Open Principal',
      actionable: offer.kind === 'Offer',
    });
  }
  return messages;
}

function businessMessages(state: GameState): InboxMessage[] {
  const messages: InboxMessage[] = [];
  const openVotes = (state.regulationProposals ?? []).filter((proposal) => proposal.playerVote === undefined);
  if (openVotes.length > 0) {
    messages.push({
      id: 'inbox-regulation-votes',
      severity: 'action',
      category: 'business',
      title: `${openVotes.length} regulation vote${openVotes.length === 1 ? '' : 's'} open`,
      body: openVotes.map((proposal) => proposal.title).join(' · '),
      route: '/politics',
      routeLabel: 'Open Regulations',
      actionable: true,
    });
  }

  const team = state.teams.find((candidate) => candidate.id === state.selectedTeamId);
  if (team && team.budget < 2_000_000) {
    messages.push({
      id: 'inbox-low-budget',
      severity: 'critical',
      category: 'business',
      title: 'Budget is critically low',
      body: `Only $${(team.budget / 1_000_000).toFixed(1)}M remaining — operations may stall.`,
      route: '/finance',
      routeLabel: 'Open Finance',
      actionable: true,
    });
  }
  return messages;
}

function newsMessages(state: GameState): InboxMessage[] {
  return state.news.slice(0, 40).map((item) => ({
    id: `inbox-news-${item.id}`,
    severity: newsSeverity(item),
    category: 'news' as const,
    title: item.headline,
    body: item.body,
    route: '/news',
    routeLabel: 'Open News Center',
    actionable: false,
    round: item.round,
    timestamp: item.timestamp,
  }));
}

/**
 * The full inbox feed: pinned action items first (critical, then action),
 * then the news/stories stream, newest first within each band.
 */
export function inboxMessages(state: GameState): InboxMessage[] {
  const actionItems = [
    ...technicalMessages(state),
    ...paddockMessages(state),
    ...peopleMessages(state),
    ...businessMessages(state),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (b.round ?? 0) - (a.round ?? 0) || a.id.localeCompare(b.id));
  return [...actionItems, ...newsMessages(state)];
}

export function unreadInboxCount(state: GameState): number {
  const read = new Set(state.inboxRead ?? []);
  return inboxMessages(state).filter((message) => !read.has(message.id)).length;
}

export function actionableInboxCount(state: GameState): number {
  return inboxMessages(state).filter((message) => message.actionable).length;
}
