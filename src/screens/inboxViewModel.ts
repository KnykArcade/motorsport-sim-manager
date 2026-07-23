// FM24/OOTP-style inbox: one chronological feed combining action items that
// need the player's decision with racing news/stories that give the world
// depth. Pure projection of existing state — no new simulation mechanics.

import type { GameState } from '../game/careerState';
import { activeDriversForTeam, currentRace } from '../game/careerState';
import { developmentSlots } from '../sim/facilityEngine';
import { technicalDirectorProposals } from '../sim/technicalAdvisorEngine';
import { technicalStateForTeam } from '../sim/technicalAdapters';
import type { NewsItem } from '../types/gameTypes';
import { STAFF_ROLES } from '../types/staffTypes';
import { currentRelationshipCommandSnapshot } from './relationships/relationshipCommandViewModel';
import { relationshipInboxMessage } from './relationshipInboxViewModel';
import { paddockEventDestination } from './paddockAgendaViewModel';
import { staffRecommendations } from './staffRecommendationsViewModel';
import { newsTriage } from './newsTriageViewModel';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { getStaffPool } from '../data';
import { effectiveAccuracy } from '../sim/scoutingEngine';

export type InboxSeverity = 'critical' | 'action' | 'info';

export type InboxCategory =
  | 'technical'
  | 'paddock'
  | 'people'
  | 'business'
  | 'news';

export type InboxMessageKind = 'must_respond' | 'recommended' | 'news';
export type InboxTiming = 'due_this_week' | 'before_next_race' | 'season_end' | 'monitor';

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
  /** Whether this item blocks the current phase from advancing. */
  blocking?: boolean;
  /** High-level work classification used by the Manager Office sections. */
  kind?: InboxMessageKind;
  /** Owning department or source of the item. */
  source?: string;
  /** Short explanation of the strategic relevance of the item. */
  whyItMatters?: string;
  /** Sort key within a severity band: newer first. Round-based where known. */
  round?: number;
  timestamp?: string;
  timing?: InboxTiming;
};

const SEVERITY_ORDER: Record<InboxSeverity, number> = { critical: 0, action: 1, info: 2 };
const SOURCE_LABELS: Record<InboxCategory, string> = {
  technical: 'Technical team',
  paddock: 'Paddock',
  people: 'People',
  business: 'Team leadership',
  news: 'Motorsport world',
};

const WHY_IT_MATTERS: Record<InboxCategory, string> = {
  technical: 'Technical choices can change pace, reliability, and future capacity.',
  paddock: 'Paddock decisions can change morale, trust, finances, and the next race.',
  people: 'People decisions can change performance, stability, and future options.',
  business: 'Business decisions can change cash flow, objectives, and team security.',
  news: 'This story gives context for the world around your team.',
};

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
      route: '/technical?section=parts',
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
      route: '/technical?section=development',
      routeLabel: 'Open Technical Center',
      actionable: false,
    });
  }
  return messages;
}

function paddockMessages(state: GameState): InboxMessage[] {
  const messages: InboxMessage[] = [];
  for (const session of (state.media?.sessions ?? []).filter((entry) => entry.status === 'Pending')) {
    const crisis = session.type === 'Crisis';
    messages.push({
      id: `inbox-${session.id}`,
      severity: crisis ? 'critical' : 'action',
      category: 'paddock',
      title: crisis ? `Crisis media response: ${session.title}` : `Media availability: ${session.title}`,
      body: `${session.questions.length - session.answers.length} question${session.questions.length - session.answers.length === 1 ? '' : 's'} remain. You may answer or decline the session.`,
      route: '/news?tab=media',
      routeLabel: 'Open Media Session',
      actionable: true,
      blocking: false,
      kind: 'recommended',
      source: 'Communications team',
      whyItMatters: 'Your response can change driver trust, owner patience, sponsor confidence, rival respect, team culture, and public standing.',
      round: session.round,
      timing: crisis ? 'due_this_week' : 'before_next_race',
    });
  }
  const unresolved = (state.careerPhase?.paddockEvents ?? []).filter((event) => !event.resolvedOptionId && (event.options?.length ?? 0) > 0);
  for (const event of unresolved) {
    const destination = paddockEventDestination(event);
    messages.push({
      id: `inbox-paddock-${event.id}`,
      severity: event.isRequiredDecision ? 'critical' : 'action',
      category: 'paddock',
      title: event.title,
      body: event.description,
      route: destination.route,
      routeLabel: destination.routeLabel,
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

  const scouting = state.scouting;
  if (scouting) {
    const bundle = careerMarketBundle(state);
    const targetNames = new Map([
      ...(bundle?.drivers ?? []).map((driver) => [driver.id, driver.name] as const),
      ...(bundle?.youth ?? []).map((prospect) => [prospect.id, prospect.name] as const),
    ]);
    const activeAssignments = scouting.activeAssignments ?? [];
    const shortlisted = scouting.shortlist ?? [];

    for (const assignment of activeAssignments) {
      const report = scouting.reports[assignment.entityId];
      if (!report) continue;
      const name = targetNames.get(assignment.entityId) ?? assignment.entityId;
      const tab = assignment.entityType === 'YouthProspect' ? 'youth' : 'senior';
      const knowledge = Math.round(effectiveAccuracy(report.scoutingLevel, scouting.networkAccuracy) * 100);
      messages.push({
        id: `inbox-scouting-assignment-${assignment.entityType}-${assignment.entityId}`,
        severity: 'action',
        category: 'paddock',
        title: `Scouting assignment in progress: ${name}`,
        body: `${report.scoutingLevel}% coverage · ${knowledge}% estimated knowledge. The report advances after each race.`,
        route: `/scouting?tab=${tab}&target=${encodeURIComponent(assignment.entityId)}`,
        routeLabel: 'Review Scouting',
        actionable: true,
        source: 'Scouting department',
        whyItMatters: 'Building knowledge narrows uncertainty before you commit recruitment budget or a seat.',
      });
    }

    for (const entry of shortlisted) {
      const name = targetNames.get(entry.entityId) ?? entry.entityId;
      const route = entry.entityType === 'Driver'
        ? `/market?target=${encodeURIComponent(entry.entityId)}`
        : `/scouting?tab=youth&target=${encodeURIComponent(entry.entityId)}`;
      messages.push({
        id: `inbox-scouting-shortlist-${entry.entityType}-${entry.entityId}`,
        severity: 'action',
        category: 'people',
        title: `Shortlisted recruitment target: ${name}`,
        body: entry.entityType === 'Driver'
          ? 'Compare the target with the live market before deciding whether to approach.'
          : 'Review the youth report and decide whether this prospect belongs in your academy plan.',
        route,
        routeLabel: entry.entityType === 'Driver' ? 'Review Market Target' : 'Review Youth Target',
        actionable: true,
        source: 'Recruitment desk',
        whyItMatters: 'A shortlist is your staff-approved watchlist; the next decision is still yours.',
      });
    }

  }
  return messages;
}

function peopleMessages(state: GameState): InboxMessage[] {
  const messages: InboxMessage[] = [];
  const currentRound = state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1;
  const recruitmentNames = new Map([
    ...state.drivers.map((driver) => [driver.id, driver.name] as const),
    ...careerMarketBundle(state).drivers.map((driver) => [driver.id, driver.name] as const),
    ...careerMarketBundle(state).youth.map((prospect) => [prospect.id, prospect.name] as const),
    ...getStaffPool(state.seasonYear, state.series).map((staff) => [staff.id, staff.name] as const),
  ]);
  for (const report of Object.values(state.scouting?.reports ?? {}).filter((entry) => entry.scoutingLevel >= 100)) {
    const tab = report.entityType === 'YouthProspect' ? 'youth' : report.entityType === 'Staff' ? 'staff' : 'senior';
    messages.push({
      id: `inbox-scouting-complete-${report.entityType}-${report.entityId}`,
      severity: 'action', category: 'people',
      title: `Scouting report complete: ${recruitmentNames.get(report.entityId) ?? report.entityId}`,
      body: `${report.entityType} report has reached the best available knowledge. Review, compare, shortlist, or open negotiations.`,
      route: `/scouting?tab=${tab}&target=${encodeURIComponent(report.entityId)}`,
      routeLabel: 'Open Scouting Report',
      actionable: true,
      round: currentRound,
    });
  }
  const marketStories = state.transferCalendar?.stories ?? [];
  const pendingMarketIds = new Set(
    (state.pendingSignings ?? [])
      .filter((signing) => signing.source === 'market')
      .map((signing) => signing.sourceId),
  );
  for (const story of marketStories.filter((entry) =>
    entry.targetType === 'MarketDriver' && (entry.stage === 'Offer' || entry.stage === 'Contested'),
  )) {
    const contested = story.stage === 'Contested' || pendingMarketIds.has(story.targetId);
    messages.push({
      id: `inbox-market-outcome-${story.id}`,
      severity: contested ? 'critical' : 'action',
      category: 'people',
      title: contested ? `Contested signing: ${story.targetName}` : `Rival offer for ${story.targetName}`,
      body: contested
        ? `${story.targetName} is attracting a rival bid. Review your queued offer before the deadline.`
        : `${story.destinationTeamName} has opened an offer before your recruitment decision is locked.`,
      route: `/market?target=${encodeURIComponent(story.targetId)}`,
      routeLabel: contested ? 'Review Contested Bid' : 'Review Rival Offer',
      actionable: true,
      blocking: false,
      kind: 'must_respond',
      source: 'Transfer desk',
      whyItMatters: 'Market availability can change before you reach the next meaningful recruitment decision.',
      round: story.deadlineRound,
      timing: 'before_next_race',
    });
  }
  for (const signing of (state.pendingSignings ?? []).filter((entry) => entry.source === 'market')) {
    messages.push({
      id: `inbox-market-signing-${signing.sourceId}`,
      severity: 'action',
      category: 'people',
      title: `Queued signing: ${signing.name}`,
      body: 'The driver is queued for the next season. Review the lineup before confirming the rollover.',
      route: '/offseason',
      routeLabel: 'Confirm Lineup',
      actionable: true,
      kind: 'recommended',
      source: 'Recruitment desk',
      whyItMatters: 'Queued signings affect next season’s seats and can still be cancelled before rollover.',
      timing: 'season_end',
    });
  }
  const staff = state.staff ?? [];
  const recommendations = staffRecommendations(state);
  const recommendedRecruitmentRoles = new Set(
    recommendations.filter((item) => item.kind === 'recruitment').map((item) => item.role),
  );
  const recommendedContractIds = new Set(
    recommendations.filter((item) => item.kind === 'contract').map((item) => item.id.replace('staff-contract-', '')),
  );
  const hiredRoles = new Set(staff.map((member) => member.role));
  const vacantRoles = STAFF_ROLES.filter((role) => !hiredRoles.has(role));
  vacantRoles.forEach((role) => {
    if (recommendedRecruitmentRoles.has(role)) return;
    messages.push({
      id: `inbox-staff-vacancy-${role.toLowerCase().replaceAll(' ', '-')}`,
      severity: 'action',
      category: 'people',
      title: `${role} position vacant`,
      body: 'Recruitment is available before the next race phase.',
      route: `/staff?tab=market&role=${encodeURIComponent(role)}`,
      routeLabel: 'Open Recruitment',
      actionable: true,
    });
  });

  const race = currentRace(state);
  const raceEngineer = staff.find((member) => member.role === 'Race Engineer');
  if (race && !race.completed && raceEngineer && state.staffResponsibilityPolicies?.['race-engineering'] === 'staff_prepare_player_approval') {
    messages.push({
      id: `inbox-weekend-plan-${race.id}`,
      severity: 'action',
      category: 'people',
      title: `${raceEngineer.name} prepared the weekend plan`,
      body: 'Review the staff recommendation before approving qualifying and race decisions.',
      route: '/weekend',
      routeLabel: 'Open Weekend Plan',
      actionable: true,
      source: 'Race engineering',
      whyItMatters: 'A prepared recommendation reduces routine workload without taking away your consequential race decisions.',
      round: race.round,
    });
  }

  for (const recommendation of recommendations) {
    messages.push({
      id: `inbox-${recommendation.id}`,
      severity: 'action',
      category: 'people',
      title: recommendation.recommendation,
      body: `${recommendation.target} · ${recommendation.expectedBenefit}`,
      route: recommendation.route,
      routeLabel: recommendation.routeLabel,
      actionable: true,
      source: recommendation.owner,
      whyItMatters: `${recommendation.whyItMatters} ${recommendation.consequence}`,
      round: currentRound,
    });
  }

  const expiringStaff = staff.filter((member) => (member.contractYearsRemaining ?? 99) <= 1);
  expiringStaff.forEach((member) => {
    if (recommendedContractIds.has(member.id)) return;
    messages.push({
      id: `inbox-staff-contract-${member.id}`,
      severity: 'action',
      category: 'people',
      title: `${member.name}'s contract expires after this season`,
      body: `${member.role} · Review renewal terms before the next season.`,
      route: `/staff?tab=contracts&staffId=${encodeURIComponent(member.id)}`,
      routeLabel: 'Open Contracts',
      actionable: true,
    });
  });

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

  const activeNegotiation = state.contractNegotiation
    && state.contractNegotiation.response !== 'demand'
    && state.contractNegotiation.response !== 'editing'
    ? state.contractNegotiation
    : undefined;
  const negotiationDriver = activeNegotiation
    ? state.drivers.find((driver) => driver.id === activeNegotiation.driverId && driver.teamId === state.selectedTeamId)
    : undefined;
  if (negotiationDriver && activeNegotiation && state.gameMode !== 'SingleSeason' && !state.seasonComplete) {
    const countered = activeNegotiation.response === 'countered';
    messages.push({
      id: `inbox-driver-contract-response-${negotiationDriver.id}`,
      severity: 'action',
      category: 'people',
      title: countered
        ? `Counter from ${negotiationDriver.name} needs your response`
        : `${negotiationDriver.name} rejected the extension offer`,
      body: countered
        ? `The driver will continue talks at $${activeNegotiation.counterSalary?.toFixed(1) ?? activeNegotiation.askingSalary.toFixed(1)}M per year.`
        : 'Improve the package or decide whether to move on before the current contract window closes.',
      route: `/drivers/${encodeURIComponent(negotiationDriver.id)}/negotiate`,
      routeLabel: countered ? 'Review Counter' : 'Improve Offer',
      actionable: true,
    });
  }

  if (state.marketContractNegotiation?.response === 'countered' || state.marketContractNegotiation?.response === 'refused') {
    const negotiation = state.marketContractNegotiation;
    messages.push({
      id: `inbox-market-negotiation-${negotiation.marketId}`,
      severity: 'action', category: 'people',
      title: negotiation.response === 'countered' ? 'Agent counter requires a response' : 'External driver offer was rejected',
      body: `${negotiation.attemptsRemaining} negotiation attempt${negotiation.attemptsRemaining === 1 ? '' : 's'} remaining.`,
      route: `/market/${encodeURIComponent(negotiation.marketId)}/negotiate/${encodeURIComponent(negotiation.seatDriverId)}`,
      routeLabel: negotiation.response === 'countered' ? 'Review Counter' : 'Improve Offer', actionable: true,
      round: currentRound,
    });
  }

  if (state.staffContractNegotiation?.response === 'countered' || state.staffContractNegotiation?.response === 'refused') {
    const negotiation = state.staffContractNegotiation;
    messages.push({
      id: `inbox-staff-negotiation-${negotiation.staffId}`,
      severity: 'action', category: 'people',
      title: negotiation.response === 'countered' ? 'Staff representative counter requires a response' : 'Staff offer was rejected',
      body: `${negotiation.attemptsRemaining} negotiation attempt${negotiation.attemptsRemaining === 1 ? '' : 's'} remaining.`,
      route: `/staff/${encodeURIComponent(negotiation.staffId)}/negotiate`,
      routeLabel: negotiation.response === 'countered' ? 'Review Counter' : 'Improve Offer', actionable: true,
      round: currentRound,
    });
  }

  const expiring = activeDriversForTeam(state, state.selectedTeamId)
    .filter((driver) => (driver.contractYearsRemaining ?? 99) <= 1);
  expiring.forEach((driver) => {
    const canNegotiate = state.gameMode !== 'SingleSeason' && !state.seasonComplete;
    if (negotiationDriver?.id === driver.id) return;
    messages.push({
      id: `inbox-driver-contract-${driver.id}`,
      severity: 'action',
      category: 'people',
      title: `${driver.name}'s contract needs attention`,
      body: `Current term: ${driver.contractYearsRemaining ?? 1} year${(driver.contractYearsRemaining ?? 1) === 1 ? '' : 's'} remaining.`,
      route: canNegotiate ? `/drivers/${encodeURIComponent(driver.id)}/negotiate` : '/drivers',
      routeLabel: canNegotiate ? 'Open Negotiation' : 'Open Drivers',
      actionable: true,
    });
  });

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
  const endangeredSponsors = (state.commercial?.sponsors ?? []).filter((sponsor) =>
    sponsor.relationshipStatus === 'Warning' || sponsor.relationshipStatus === 'Breach' || sponsor.confidence <= 40,
  );
  if (endangeredSponsors.length > 0) {
    messages.push({
      id: 'inbox-sponsor-relationships-at-risk',
      severity: endangeredSponsors.some((sponsor) => sponsor.relationshipStatus === 'Breach' || sponsor.confidence <= 20) ? 'critical' : 'action',
      category: 'business',
      title: `${endangeredSponsors.length} sponsor relationship${endangeredSponsors.length === 1 ? '' : 's'} at risk`,
      body: endangeredSponsors.map((sponsor) => `${sponsor.name}: ${sponsor.relationshipStatus ?? 'Warning'}`).join(' · '),
      route: '/sponsors?tab=objectives',
      routeLabel: 'Review Sponsor Objectives',
      actionable: true,
    });
  }
  const expiringSponsors = (state.commercial?.sponsors ?? []).filter((sponsor) => sponsor.contractYearsRemaining <= 1);
  if (expiringSponsors.length > 0) {
    messages.push({
      id: 'inbox-sponsor-contracts-expiring',
      severity: 'action',
      category: 'business',
      title: `${expiringSponsors.length} sponsor contract${expiringSponsors.length === 1 ? '' : 's'} entering final season`,
      body: expiringSponsors.map((sponsor) => sponsor.name).join(' · '),
      route: '/sponsors?tab=portfolio',
      routeLabel: 'Review Sponsor Portfolio',
      actionable: true,
    });
  }
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
  return state.news.slice(0, 40).map((item) => {
    const triage = newsTriage(state, item);
    const transferStory = state.transferCalendar?.stories.find((story) => item.id.endsWith(story.id));
    const transferRoute = transferStory?.targetType === 'MarketDriver'
      ? `/market?target=${encodeURIComponent(transferStory.targetId)}`
      : undefined;
    return {
      id: `inbox-news-${item.id}`,
      severity: newsSeverity(item),
      category: 'news' as const,
      title: item.headline,
      body: triage ? `${triage.recommendation}${item.body ? ` ${item.body}` : ''}` : item.body,
      route: transferRoute ?? triage?.route ?? '/news',
      routeLabel: transferRoute ? 'Review Market Outcome' : triage?.routeLabel ?? 'Open News Center',
      actionable: Boolean(triage),
      source: triage?.owner,
      whyItMatters: triage ? `${triage.whyItMatters} ${triage.consequence}` : undefined,
      round: item.round,
      timestamp: item.timestamp,
    };
  });
}

function withTaskSemantics(message: InboxMessage): InboxMessage {
  const kind: InboxMessageKind = message.category === 'news'
    ? message.actionable ? 'recommended' : 'news'
    : message.kind
      ? message.kind
    : message.id.startsWith('inbox-paddock-') && message.severity === 'critical'
      ? 'must_respond'
      : message.actionable
        ? 'recommended'
        : 'news';

  return {
    ...message,
    kind,
    blocking: kind === 'must_respond',
    source: message.source ?? SOURCE_LABELS[message.category],
    whyItMatters: message.whyItMatters ?? WHY_IT_MATTERS[message.category],
  };
}

export function inboxTimingLabel(timing: InboxTiming): string {
  switch (timing) {
    case 'due_this_week':
      return 'Due this week';
    case 'before_next_race':
      return 'Before next race';
    case 'season_end':
      return 'Season end';
    case 'monitor':
      return 'Monitor';
  }
}

export function inboxTimingForMessage(state: GameState, message: InboxMessage): InboxTiming {
  const text = `${message.title} ${message.body ?? ''}`.toLowerCase();
  if (message.blocking) return 'due_this_week';
  if (message.timing) return message.timing;
  if (text.includes('after this season') || text.includes('season end') || text.includes('expiring')) {
    return 'season_end';
  }
  if (!message.actionable || message.kind === 'news') return 'monitor';
  const currentRound = state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1;
  return message.round !== undefined && message.round <= currentRound + 1
    ? 'before_next_race'
    : 'due_this_week';
}

/**
 * The full inbox feed: pinned action items first (critical, then action),
 * then the news/stories stream, newest first within each band.
 */
export function inboxMessages(state: GameState): InboxMessage[] {
  const people = peopleMessages(state);
  const relationship = relationshipInboxMessage(currentRelationshipCommandSnapshot(state).summary, {
    duePromise: people.some((message) => message.id.startsWith('inbox-promise-')),
    jobOpportunity: people.some((message) => message.id.startsWith('inbox-job-')),
  });
  const actionItems = [
    ...technicalMessages(state),
    ...paddockMessages(state),
    ...people,
    ...(relationship ? [relationship] : []),
    ...businessMessages(state),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (b.round ?? 0) - (a.round ?? 0) || a.id.localeCompare(b.id));
  const dismissed = new Set(state.inboxDismissed ?? []);
  return [...actionItems, ...newsMessages(state)]
    .map(withTaskSemantics)
    .map((message) => ({ ...message, timing: inboxTimingForMessage(state, message) }))
    .filter((message) => message.blocking || !dismissed.has(message.id))
    .sort((a, b) =>
      Number(b.actionable) - Number(a.actionable)
      || SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      || (b.round ?? 0) - (a.round ?? 0)
      || a.id.localeCompare(b.id));
}

export function unreadInboxCount(state: GameState): number {
  const read = new Set(state.inboxRead ?? []);
  return inboxMessages(state).filter((message) => !read.has(message.id)).length;
}

export function actionableInboxCount(state: GameState): number {
  return inboxMessages(state).filter((message) => message.actionable).length;
}

export function mustRespondInboxCount(state: GameState): number {
  return inboxMessages(state).filter((message) => message.kind === 'must_respond').length;
}

export function recommendedInboxCount(state: GameState): number {
  return inboxMessages(state).filter((message) => message.kind === 'recommended').length;
}
