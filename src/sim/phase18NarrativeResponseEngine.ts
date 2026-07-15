import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventCategory, PaddockEventOption } from '../types/careerPhaseTypes';
import type { ContractBreachResponse, NarrativeStory } from '../types/phase18Types';
import { makeTransaction } from './financeEngine';
import { respondToContractBreach } from './phase18ContractClauseEngine';
import { investigateFailure, respondToFailure } from './phase18FailureInvestigationEngine';
import { addRivalRelationshipEvent, takeRivalAction } from './phase18RivalRelationshipEngine';

const urgencyRank: Record<NarrativeStory['urgency'], number> = { Background: 0, Developing: 1, Important: 2, Critical: 3 };

function clamp(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }
function roundOf(state: GameState): number { return state.careerPhase?.currentRound ?? state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1; }

function eventCategory(story: NarrativeStory): PaddockEventCategory {
  if (story.category === 'Driver') return 'driver_morale';
  if (story.category === 'Staff') return 'staff';
  if (story.category === 'Financial') return 'finance';
  if (story.category === 'Political' || story.category === 'Rivalry') return 'regulation';
  return 'development';
}

function option(id: string, label: string, description: string, risk = 0): PaddockEventOption {
  return { id, label, description, risk };
}

function responseOptions(state: GameState, story: NarrativeStory): PaddockEventOption[] {
  if (story.category === 'Technical') {
    const failure = state.phase18?.failureInvestigations?.cases.find((item) => story.sourceEventIds.includes(item.id));
    return failure?.status === 'FindingsReady'
      ? [
          option('repair-properly', 'Repair properly', 'Commit resources to correct the confirmed weakness.'),
          option('replace-part', 'Replace the suspect part', 'Spend more to remove the immediate technical risk.'),
          option('detune-package', 'Detune the package', 'Protect reliability by accepting a performance compromise.'),
        ]
      : [
          option('quick-review', 'Run a quick review', 'Limit cost and time, but accept lower confidence in the findings.', 1),
          option('standard-investigation', 'Order a standard investigation', 'Balance cost, speed, and confidence.'),
          option('full-investigation', 'Launch a full investigation', 'Use the most complete review to identify the real cause.'),
        ];
  }
  if (story.category === 'Rivalry') return [
    option('open-dialogue', 'Open direct dialogue', 'Try to reduce tension and rebuild professional trust.'),
    option('scout-personnel', 'Apply market pressure', 'Monitor rival personnel and accept a sharper confrontation.', 1),
    option('file-protest', 'Escalate formally', 'Use the regulations to challenge the rival at significant cost and risk.', 2),
  ];
  if (story.threadId?.startsWith('contract-')) return [
    option('open-talks', 'Open corrective talks', 'Acknowledge the issue and try to stabilize the relationship.'),
    option('make-concession', 'Make a concrete concession', 'Spend political or financial capital to settle the immediate dispute.'),
    option('hold-position', 'Hold the team position', 'Refuse concessions and accept greater retention and trust risk.', 2),
  ];
  if (story.category === 'Driver') return [
    option('private-meeting', 'Hold a private meeting', 'Listen, explain the team position, and rebuild trust.'),
    option('commit-support', 'Commit additional support', 'Back the driver visibly, improving morale but raising expectations.'),
    option('firm-line', 'Set a firm boundary', 'Protect team authority while risking further frustration.', 1),
  ];
  if (story.category === 'Staff') return [
    option('hear-department', 'Hear the department out', 'Address the conflict directly and rebuild alignment.'),
    option('resource-support', 'Provide additional support', 'Commit $500K to workload relief and operational support.'),
    option('enforce-direction', 'Enforce the current direction', 'Prioritize discipline and delivery over consensus.', 1),
  ];
  if (story.category === 'Financial') return [
    option('cost-controls', 'Impose cost controls', 'Reduce owner pressure and stabilize operations at a morale cost.'),
    option('owner-backing', 'Seek owner backing', 'Trade owner patience for immediate breathing room and confidence.'),
    option('stay-course', 'Stay the course', 'Avoid disruption now, but accept increasing owner pressure.', 2),
  ];
  if (story.category === 'Political') return [
    option('build-coalition', 'Build a coalition', 'Use political influence to move undecided and opposing teams.'),
    option('seek-compromise', 'Seek a compromise', 'Reduce polarization without fully abandoning the team position.'),
    option('hold-line', 'Hold the line', 'Preserve the public position and accept deeper factional opposition.', 1),
  ];
  return [option('monitor', 'Monitor the situation', 'Keep the story under observation without intervening immediately.')];
}

export function narrativeResponseEvents(state: GameState): PaddockEvent[] {
  const phase = state.careerPhase;
  if (!phase) return [];
  const weekId = phase.paddockWeekId ?? `pw-${state.seasonYear}-${phase.currentRound}`;
  return (state.phase18?.narratives ?? [])
    .filter((story) => story.status === 'Active' && story.responseStatus === 'AwaitingResponse' && urgencyRank[story.urgency] >= urgencyRank.Important)
    .sort((a, b) => urgencyRank[b.urgency] - urgencyRank[a.urgency] || (b.updatedRound ?? 0) - (a.updatedRound ?? 0))
    .slice(0, 3)
    .map((story, index) => {
      const category = eventCategory(story);
      return {
      id: `pe-${weekId}-${category}-narrative-${index}`,
      weekId,
      season: state.seasonYear,
      series: state.series,
      round: phase.currentRound,
      category,
      title: `Story response: ${story.headline}`,
      description: `${story.summary} ${story.consequenceSummary ?? ''}`.trim(),
      severity: story.urgency === 'Critical' ? 'critical' : 'major',
      isRequiredDecision: false,
      options: responseOptions(state, story),
      effectsApplied: false,
      createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, phase.currentRound + 1))).toISOString(),
      narrativeStoryId: story.id,
    }; });
}

function updateDriverStory(state: GameState, story: NarrativeStory, responseId: string): { state: GameState; consequence: string } {
  const driverId = story.linkedDriverIds[0];
  const relationship = driverId ? state.driverRelationships?.[driverId] : undefined;
  if (!driverId || !relationship) return { state, consequence: 'Management recorded its position, but no active driver relationship was available.' };
  const delta = responseId === 'private-meeting'
    ? { trust: 6, morale: 4, frustration: -7 }
    : responseId === 'commit-support'
      ? { trust: 4, morale: 7, frustration: -5 }
      : { trust: -4, morale: -2, frustration: 6 };
  const updated = { ...relationship, trustInPrincipal: clamp(relationship.trustInPrincipal + delta.trust), trustInTeam: clamp(relationship.trustInTeam + Math.sign(delta.trust) * 2), morale: clamp(relationship.morale + delta.morale), frustration: clamp(relationship.frustration + delta.frustration) };
  return {
    state: { ...state, driverRelationships: { ...state.driverRelationships, [driverId]: updated }, drivers: state.drivers.map((driver) => driver.id === driverId ? { ...driver, morale: clamp(driver.morale + delta.morale) } : driver) },
    consequence: responseId === 'firm-line' ? 'Team authority was reinforced, but driver trust and morale declined.' : 'The intervention improved driver trust and reduced immediate frustration.',
  };
}

function updateDepartmentStory(state: GameState, story: NarrativeStory, responseId: string): { state: GameState; consequence: string } {
  const departmentId = story.threadId?.replace('department-', '');
  const departments = state.phase18?.departmentMoods[state.selectedTeamId];
  const mood = departmentId && departments ? departments[departmentId as keyof typeof departments] : undefined;
  if (!departmentId || !departments || !mood) return { state, consequence: 'Management addressed the staff concern through the existing contract and personnel process.' };
  const cost = responseId === 'resource-support' ? 500_000 : 0;
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  if (cost && (team?.budget ?? 0) < cost) return { state, consequence: 'The proposed support package could not be funded; the department remains unsettled.' };
  const delta = responseId === 'hear-department' ? { trust: 6, morale: 4, align: 5, workload: -2 }
    : responseId === 'resource-support' ? { trust: 4, morale: 7, align: 3, workload: -8 }
      : { trust: -5, morale: -4, align: 2, workload: 2 };
  const updated = { ...mood, trustInPrincipal: clamp(mood.trustInPrincipal + delta.trust), morale: clamp(mood.morale + delta.morale), strategicAlignment: clamp(mood.strategicAlignment + delta.align), workload: clamp(mood.workload + delta.workload), conflictReasons: responseId === 'enforce-direction' ? [...mood.conflictReasons, 'Management enforced its direction despite department objections.'].slice(-8) : mood.conflictReasons.slice(0, -1) };
  return {
    state: { ...state, teams: cost ? state.teams.map((entry) => entry.id === state.selectedTeamId ? { ...entry, budget: entry.budget - cost } : entry) : state.teams, finance: cost ? [...(state.finance ?? []), makeTransaction(state.seasonYear, 'Operations', `${departmentId} workload support`, -cost, roundOf(state))] : state.finance, phase18: { ...state.phase18!, departmentMoods: { ...state.phase18!.departmentMoods, [state.selectedTeamId]: { ...departments, [departmentId]: updated } } } },
    consequence: responseId === 'enforce-direction' ? 'Alignment improved slightly, but trust and morale fell.' : 'Department trust, morale, and alignment improved.',
  };
}

function updateContractStory(state: GameState, story: NarrativeStory, responseId: string): { state: GameState; consequence: string } {
  const clause = state.phase18?.contractClauses.find((entry) => story.sourceEventIds.includes(entry.id));
  if (!clause) return { state, consequence: 'Management opened a general contract review.' };
  if (clause.status === 'Breached') {
    const response: ContractBreachResponse = responseId === 'make-concession' ? 'Compensate' : responseId === 'open-talks' ? 'Apologize' : 'AcceptDamage';
    return { state: respondToContractBreach(state, clause.id, response), consequence: response === 'Compensate' ? 'The team paid to settle the breach and waived the immediate dispute.' : response === 'Apologize' ? 'Management apologized and recovered some trust.' : 'Management accepted the relationship damage without offering a concession.' };
  }
  const cost = responseId === 'make-concession' ? clause.renegotiationCost ?? 0 : 0;
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  if (cost > (team?.budget ?? 0)) return { state, consequence: 'The team could not afford the proposed concession.' };
  const risk = responseId === 'make-concession' ? 'Secure' as const : responseId === 'open-talks' ? 'Watch' as const : 'Triggered' as const;
  const updated = { ...clause, risk, status: responseId === 'make-concession' ? 'Waived' as const : clause.status, resolutionNote: `Narrative response: ${responseId}.` };
  return { state: { ...state, teams: cost ? state.teams.map((entry) => entry.id === state.selectedTeamId ? { ...entry, budget: entry.budget - cost } : entry) : state.teams, finance: cost ? [...(state.finance ?? []), makeTransaction(state.seasonYear, 'Operations', `Contract concession: ${clause.description}`, -cost, roundOf(state))] : state.finance, phase18: { ...state.phase18!, contractClauses: state.phase18!.contractClauses.map((entry) => entry.id === clause.id ? updated : entry) } }, consequence: responseId === 'hold-position' ? 'The team held its position and the clause risk escalated.' : 'Management reduced the immediate contractual risk.' };
}

function updateFinancialStory(state: GameState, responseId: string): { state: GameState; consequence: string } {
  const distress = state.financialDistress?.[state.selectedTeamId];
  if (!distress) return { state, consequence: 'Management reviewed the financial position.' };
  const pressure = responseId === 'cost-controls' ? -8 : responseId === 'owner-backing' ? -12 : 6;
  const morale = responseId === 'cost-controls' ? -3 : responseId === 'owner-backing' ? 2 : 0;
  const reputation = state.teamReputations?.[state.selectedTeamId];
  return { state: { ...state, financialDistress: { ...state.financialDistress, [state.selectedTeamId]: { ...distress, ownerPressure: clamp(distress.ownerPressure + pressure), consecutiveNegativeCashRaces: responseId === 'cost-controls' ? Math.max(0, distress.consecutiveNegativeCashRaces - 1) : distress.consecutiveNegativeCashRaces } }, teams: state.teams.map((team) => team.id === state.selectedTeamId ? { ...team, morale: clamp(team.morale + morale) } : team), teamReputations: reputation && responseId === 'owner-backing' ? { ...state.teamReputations, [state.selectedTeamId]: { ...reputation, ownerPatience: clamp(reputation.ownerPatience - 5) } } : state.teamReputations }, consequence: responseId === 'stay-course' ? 'Avoiding intervention increased owner pressure.' : responseId === 'owner-backing' ? 'Owner pressure eased, but the team spent some of its long-term owner patience.' : 'Cost controls reduced financial pressure but hurt morale.' };
}

function updatePoliticalStory(state: GameState, story: NarrativeStory, responseId: string): { state: GameState; consequence: string } {
  const proposal = state.regulationProposals?.find((entry) => story.sourceEventIds.includes(entry.id));
  if (!proposal || !proposal.playerVote || proposal.playerVote === 'Abstain') return { state, consequence: 'The team recorded its political position.' };
  const direction = proposal.playerVote === 'Support' ? 1 : -1;
  const amount = responseId === 'build-coalition' ? 8 : responseId === 'seek-compromise' ? 4 : -3;
  const supportByTeam = Object.fromEntries(Object.entries(proposal.supportByTeam).map(([teamId, value]) => teamId === state.selectedTeamId ? [teamId, value] : [teamId, clampPolitical(value + direction * amount)]));
  return { state: { ...state, regulationProposals: state.regulationProposals!.map((entry) => entry.id === proposal.id ? { ...entry, supportByTeam } : entry) }, consequence: responseId === 'hold-line' ? 'The public position hardened and opposing teams became more entrenched.' : 'Political outreach moved the paddock closer to the team position.' };
}

function clampPolitical(value: number): number { return Math.max(-100, Math.min(100, Math.round(value))); }

export function resolveNarrativeResponse(state: GameState, storyId: string, responseId: string): GameState {
  const story = state.phase18?.narratives.find((entry) => entry.id === storyId);
  if (!story || story.responseStatus === 'Responded') return state;
  let result: { state: GameState; consequence: string };
  if (story.category === 'Technical') {
    const failure = state.phase18?.failureInvestigations?.cases.find((item) => story.sourceEventIds.includes(item.id));
    if (!failure) result = { state, consequence: 'The technical concern was reviewed, but no open investigation remained.' };
    else if (responseId === 'quick-review') result = { state: investigateFailure(state, failure.id, 'QuickReview'), consequence: 'A quick review delivered an early assessment with limited confidence.' };
    else if (responseId === 'standard-investigation') result = { state: investigateFailure(state, failure.id, 'StandardInvestigation'), consequence: 'A standard investigation balanced cost with confidence.' };
    else if (responseId === 'full-investigation') result = { state: investigateFailure(state, failure.id, 'FullTechnicalInvestigation'), consequence: 'A full investigation produced the strongest available technical finding.' };
    else if (responseId === 'replace-part') result = { state: respondToFailure(state, failure.id, 'ReplacePart'), consequence: 'The suspect component was replaced and immediate technical risk was cleared.' };
    else if (responseId === 'detune-package') result = { state: respondToFailure(state, failure.id, 'DetunePackage'), consequence: 'The team protected reliability by accepting a performance compromise.' };
    else result = { state: respondToFailure(state, failure.id, 'RepairProperly'), consequence: 'The team committed to a proper repair and reduced repeat-failure risk.' };
  } else if (story.category === 'Rivalry') {
    const rivalId = story.linkedTeamIds.find((id) => id !== state.selectedTeamId);
    if (!rivalId) result = { state, consequence: 'No active rival could be identified.' };
    else if (responseId === 'open-dialogue') result = { state: takeRivalAction(state, rivalId, 'OpenDialogue'), consequence: 'Direct dialogue reduced hostility and technical suspicion.' };
    else if (responseId === 'file-protest') result = { state: takeRivalAction(state, rivalId, 'FileProtest'), consequence: 'The dispute moved into a formal regulatory confrontation.' };
    else result = { state: takeRivalAction(state, rivalId, 'ScoutPersonnel'), consequence: 'The team increased market pressure and intensified the rivalry.' };
  } else if (story.threadId?.startsWith('contract-')) result = updateContractStory(state, story, responseId);
  else if (story.category === 'Driver') result = updateDriverStory(state, story, responseId);
  else if (story.category === 'Staff') result = updateDepartmentStory(state, story, responseId);
  else if (story.category === 'Financial') result = updateFinancialStory(state, responseId);
  else if (story.category === 'Political') result = updatePoliticalStory(state, story, responseId);
  else result = { state, consequence: 'Management chose to monitor the story.' };

  const label = responseOptions(state, story).find((entry) => entry.id === responseId)?.label ?? responseId;
  const round = roundOf(result.state);
  const responseRecord = { id: `${story.id}-response-${state.seasonYear}-${round}-${(story.responseHistory?.length ?? 0) + 1}`, seasonYear: state.seasonYear, round, responseId, responseLabel: label, consequence: result.consequence };
  return { ...result.state, phase18: { ...result.state.phase18!, narratives: result.state.phase18!.narratives.map((entry) => entry.id === story.id ? { ...entry, responseStatus: 'Responded' as const, lastResponseId: responseId, lastResponseSummary: result.consequence, responseHistory: [...(entry.responseHistory ?? []), responseRecord].slice(-20), updatedSeasonYear: state.seasonYear, updatedRound: round } : entry) } };
}

export function applyNarrativeAIReactions(state: GameState): GameState {
  const round = roundOf(state);
  const active = (state.phase18?.narratives ?? []).filter((story) => story.status === 'Active' && !!story.aiReaction && (story.lastAIReactionSeasonYear !== state.seasonYear || story.lastAIReactionRound !== round)).sort((a, b) => urgencyRank[b.urgency] - urgencyRank[a.urgency]).slice(0, 3);
  let next = state;
  for (const story of active) {
    if (story.category === 'Rivalry') {
      const rivalId = story.linkedTeamIds.find((id) => id !== next.selectedTeamId);
      if (rivalId) next = addRivalRelationshipEvent(next, next.selectedTeamId, rivalId, { round, amount: -2, suspicionDelta: 2, trustDelta: -1, reason: 'Rival leadership increased scrutiny while the public storyline remained active.', category: 'Political' });
    } else if (story.category === 'Driver') {
      const driverId = story.linkedDriverIds[0];
      const relationship = driverId ? next.driverRelationships?.[driverId] : undefined;
      if (driverId && relationship) next = { ...next, driverRelationships: { ...next.driverRelationships, [driverId]: { ...relationship, frustration: clamp(relationship.frustration + 2), trustInTeam: clamp(relationship.trustInTeam - 1) } } };
    } else if (story.category === 'Financial') {
      const distress = next.financialDistress?.[next.selectedTeamId];
      if (distress) next = { ...next, financialDistress: { ...next.financialDistress, [next.selectedTeamId]: { ...distress, ownerPressure: clamp(distress.ownerPressure + 2) } } };
    } else if (story.category === 'Staff' && story.threadId?.startsWith('department-')) {
      const departmentId = story.threadId.replace('department-', '');
      const departments = next.phase18?.departmentMoods[next.selectedTeamId];
      const mood = departments?.[departmentId as keyof typeof departments];
      if (departments && mood) next = { ...next, phase18: { ...next.phase18!, departmentMoods: { ...next.phase18!.departmentMoods, [next.selectedTeamId]: { ...departments, [departmentId]: { ...mood, morale: clamp(mood.morale - 2) } } } } };
    }
    next = { ...next, phase18: { ...next.phase18!, narratives: next.phase18!.narratives.map((entry) => entry.id === story.id ? { ...entry, lastAIReactionSeasonYear: state.seasonYear, lastAIReactionRound: round } : entry) } };
  }
  return next;
}
