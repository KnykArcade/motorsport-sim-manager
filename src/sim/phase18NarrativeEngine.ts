import type { GameState } from '../game/careerState';
import type { NarrativeStory } from '../types/phase18Types';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';

type StoryCandidate = Omit<NarrativeStory, 'id' | 'createdSeasonYear' | 'createdRound' | 'updatedSeasonYear' | 'updatedRound'> & { threadId: string };
const urgencyRank: Record<NarrativeStory['urgency'], number> = { Background: 0, Developing: 1, Important: 2, Critical: 3 };

function roundOf(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1;
}

function stageFor(urgency: NarrativeStory['urgency'], status: NarrativeStory['status']): NarrativeStory['stage'] {
  if (status === 'Resolved' || status === 'Expired') return 'Resolved';
  if (urgency === 'Critical') return 'Flashpoint';
  if (urgency === 'Important') return 'Escalating';
  return 'Emerging';
}

function progressFor(urgency: NarrativeStory['urgency']): number {
  return urgency === 'Critical' ? 90 : urgency === 'Important' ? 65 : urgency === 'Developing' ? 40 : 20;
}

function candidateStories(state: GameState): StoryCandidate[] {
  const candidates: StoryCandidate[] = [];
  const phase18 = state.phase18 ?? ensurePhase18FoundationState(undefined, state);
  const teamName = (id: string) => state.teams.find((team) => team.id === id)?.name ?? id;
  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;

  for (const relation of Object.values(phase18.rivalRelationships).filter((entry) => (entry.teamAId === state.selectedTeamId || entry.teamBId === state.selectedTeamId) && entry.score <= -15)) {
    const rivalId = relation.teamAId === state.selectedTeamId ? relation.teamBId : relation.teamAId;
    const recent = relation.history.slice(-5);
    const urgency = relation.score <= -35 || relation.technicalSuspicion >= 75 ? 'Critical' : 'Important';
    candidates.push({ threadId: `rivalry-${rivalId}`, category: 'Rivalry', headline: `Tensions rise with ${teamName(rivalId)}`, summary: recent.at(-1)?.reason ?? `Relations with ${teamName(rivalId)} have become openly hostile.`, urgency, confidence: 100, status: 'Active', linkedTeamIds: [state.selectedTeamId, rivalId], linkedDriverIds: [], linkedStaffIds: [], actionRoute: '/rivals', sourceEventIds: recent.map((event) => event.id), consequenceSummary: 'Hostile relations increase protest, political, technical-scrutiny, and personnel-market risk.', aiReaction: `${teamName(rivalId)} leadership is treating your team as a direct paddock opponent.` });
  }

  for (const failure of phase18.failureInvestigations?.cases.filter((entry) => entry.status === 'AwaitingInvestigation' || entry.status === 'FindingsReady') ?? []) {
    const urgency = failure.unresolvedRisk >= 70 || failure.repeatedIssueCount >= 2 ? 'Critical' : 'Important';
    candidates.push({ threadId: `failure-${failure.id}`, category: 'Technical', headline: failure.repeatedIssueCount >= 2 ? 'Recurring technical failure threatens the programme' : 'Technical failure requires investigation', summary: failure.incidentSummary, urgency, confidence: failure.confidence, status: 'Active', linkedTeamIds: [failure.teamId], linkedDriverIds: failure.driverId ? [failure.driverId] : [], linkedStaffIds: [], actionRoute: '/development', sourceEventIds: [failure.id], consequenceSummary: `Unresolved risk is ${failure.unresolvedRisk}/100; the suspected cause is ${failure.suspectedCause}.`, aiReaction: 'Rival technical groups are monitoring whether the weakness persists.' });
  }

  for (const clause of phase18.contractClauses.filter((entry) => entry.status === 'Breached' || entry.risk === 'AtRisk' || entry.risk === 'Triggered')) {
    const partyName = clause.partyType === 'Driver' ? driverName(clause.partyId) : clause.partyType === 'TeamPrincipal' ? state.principal?.name ?? clause.partyId : clause.partyId;
    const urgency = clause.status === 'Breached' || clause.risk === 'Triggered' ? 'Critical' : 'Important';
    candidates.push({ threadId: `contract-${clause.id}`, category: clause.partyType === 'Driver' ? 'Driver' : 'Staff', headline: `${partyName} contract situation escalates`, summary: clause.resolutionNote ?? clause.description, urgency, confidence: 100, status: 'Active', linkedTeamIds: [clause.teamId], linkedDriverIds: clause.partyType === 'Driver' ? [clause.partyId] : [], linkedStaffIds: clause.partyType === 'Staff' ? [clause.partyId] : [], actionRoute: clause.partyType === 'Driver' ? '/relationships' : '/principal', sourceEventIds: [clause.id], consequenceSummary: clause.breachConsequence ?? 'Trust, retention, and future negotiations are at risk.', aiReaction: clause.aiRelevant ? 'Rival teams are aware of the contractual vulnerability.' : undefined });
  }

  for (const [departmentId, mood] of Object.entries(phase18.departmentMoods[state.selectedTeamId] ?? {}).filter(([, entry]) => entry.morale <= 35 || entry.trustInPrincipal <= 35)) {
    const urgency = mood.morale <= 20 || mood.trustInPrincipal <= 20 ? 'Critical' : 'Important';
    candidates.push({ threadId: `department-${departmentId}`, category: 'Staff', headline: `${departmentId.replace(/([A-Z])/g, ' $1').trim()} department unrest`, summary: mood.conflictReasons.at(-1) ?? 'Low morale and trust are disrupting the department.', urgency, confidence: 100, status: 'Active', linkedTeamIds: [state.selectedTeamId], linkedDriverIds: [], linkedStaffIds: [], actionRoute: '/principal', sourceEventIds: [], consequenceSummary: `Morale ${mood.morale}/100; trust in the principal ${mood.trustInPrincipal}/100.`, aiReaction: 'Rival teams may test the loyalty of unsettled personnel.' });
  }

  for (const relationship of Object.values(state.driverRelationships ?? {}).filter((entry) => entry.teamId === state.selectedTeamId && (entry.frustration >= 65 || entry.morale <= 35 || entry.trustInPrincipal <= 35))) {
    const urgency = relationship.frustration >= 80 || relationship.morale <= 20 ? 'Critical' : 'Important';
    candidates.push({ threadId: `driver-${relationship.driverId}`, category: 'Driver', headline: `${driverName(relationship.driverId)} relationship under strain`, summary: `${driverName(relationship.driverId)} is increasingly unhappy with the direction of the team.`, urgency, confidence: 100, status: 'Active', linkedTeamIds: [state.selectedTeamId], linkedDriverIds: [relationship.driverId], linkedStaffIds: [], actionRoute: '/relationships', sourceEventIds: (state.driverPromises ?? []).filter((promise) => promise.driverId === relationship.driverId && (promise.status === 'broken' || promise.status === 'expired')).map((promise) => promise.id), consequenceSummary: `Morale ${relationship.morale}/100, frustration ${relationship.frustration}/100, principal trust ${relationship.trustInPrincipal}/100.`, aiReaction: 'Driver representatives and rival teams may explore alternatives.' });
  }

  const distress = state.financialDistress?.[state.selectedTeamId];
  if (distress && distress.level !== 'Stable' && distress.level !== 'Tight') {
    const urgency = distress.level === 'Critical' || distress.level === 'Administration' || distress.level === 'ClosureRisk' ? 'Critical' : 'Important';
    candidates.push({ threadId: 'financial-distress', category: 'Financial', headline: `${teamName(state.selectedTeamId)} financial pressure intensifies`, summary: `The team is operating at ${distress.level} financial status.`, urgency, confidence: 100, status: 'Active', linkedTeamIds: [state.selectedTeamId], linkedDriverIds: [], linkedStaffIds: [], actionRoute: '/finance', sourceEventIds: [], consequenceSummary: `Owner pressure is ${distress.ownerPressure}/100 after ${distress.consecutiveNegativeCashRaces} negative-cash races.`, aiReaction: 'Competitors are monitoring vulnerable staff, drivers, and commercial partners.' });
  }

  for (const proposal of (state.regulationProposals ?? []).filter((entry) => entry.playerVote)) {
    const vote = proposal.playerVote;
    if (!vote) continue;
    const opponents = Object.values(proposal.supportByTeam).filter((value) => Math.sign(value) !== (vote === 'Support' ? 1 : -1) && Math.sign(value) !== 0).length;
    candidates.push({ threadId: `politics-${proposal.id}`, category: 'Political', headline: `Political battle: ${proposal.title}`, summary: proposal.description, urgency: opponents >= Math.max(2, state.teams.length / 2) ? 'Important' : 'Developing', confidence: 100, status: 'Active', linkedTeamIds: [state.selectedTeamId], linkedDriverIds: [], linkedStaffIds: [], actionRoute: '/politics', sourceEventIds: [proposal.id], consequenceSummary: `Your team is lobbying to ${vote.toLowerCase()} the proposal; ${opponents} teams currently lean the other way.`, aiReaction: 'AI principals are aligning into supporting and opposing blocs.' });
  }

  for (const outcome of phase18.legacy.alternateHistory.filter((entry) => entry.seasonYear === state.seasonYear)) {
    candidates.push({ threadId: `legacy-${outcome.id}`, category: 'Legacy', headline: outcome.category, summary: outcome.careerOutcome, urgency: outcome.significance >= 70 ? 'Important' : 'Developing', confidence: 100, status: 'Resolved', linkedTeamIds: [state.selectedTeamId], linkedDriverIds: [], linkedStaffIds: [], actionRoute: '/records', sourceEventIds: [outcome.id], consequenceSummary: `This outcome carries ${outcome.significance}/100 alternate-history significance.` });
  }
  return candidates;
}

export function syncNarratives(state: GameState): GameState {
  const phase18 = state.phase18 ?? ensurePhase18FoundationState(undefined, state);
  const round = roundOf(state);
  const candidates = candidateStories({ ...state, phase18 });
  const candidateIds = new Set(candidates.map((candidate) => `narrative-${state.seasonYear}-${candidate.threadId}`));
  let stories = phase18.narratives.map((story) => {
    if (story.status !== 'Active' || candidateIds.has(story.id)) return story;
    return { ...story, status: 'Resolved' as const, stage: 'Resolved' as const, updatedSeasonYear: state.seasonYear, updatedRound: round };
  });
  for (const candidate of candidates) {
    const id = `narrative-${state.seasonYear}-${candidate.threadId}`;
    const existing = stories.find((story) => story.id === id);
    const urgency = existing && urgencyRank[existing.urgency] > urgencyRank[candidate.urgency] ? existing.urgency : candidate.urgency;
    const story: NarrativeStory = {
      ...candidate,
      id,
      urgency,
      stage: stageFor(urgency, candidate.status),
      progress: candidate.status === 'Resolved' ? 100 : Math.max(existing?.progress ?? 0, progressFor(urgency)),
      createdSeasonYear: existing?.createdSeasonYear ?? state.seasonYear,
      createdRound: existing?.createdRound ?? round,
      updatedSeasonYear: state.seasonYear,
      updatedRound: round,
      sourceEventIds: [...new Set([...(existing?.sourceEventIds ?? []), ...candidate.sourceEventIds])].slice(-20),
    };
    stories = [...stories.filter((entry) => entry.id !== id), story];
  }
  stories = stories.sort((a, b) => b.updatedSeasonYear - a.updatedSeasonYear || (b.updatedRound ?? 0) - (a.updatedRound ?? 0)).slice(0, 150);
  return { ...state, phase18: { ...phase18, narratives: stories } };
}

export function rolloverNarratives(state: GameState, completedSeasonYear: number): GameState {
  const phase18 = state.phase18 ?? ensurePhase18FoundationState(undefined, state);
  const narratives = phase18.narratives.map((story) => story.status === 'Active' && story.createdSeasonYear <= completedSeasonYear ? { ...story, status: 'Resolved' as const, stage: 'Resolved' as const, progress: 100, updatedSeasonYear: completedSeasonYear } : story);
  return syncNarratives({ ...state, phase18: { ...phase18, narratives } });
}
