import type { GameState } from '../game/careerState';
import { OWNER_PERSONALITY_LABELS } from '../types/expectationTypes';
import type {
  CharacterAgenda,
  CharacterInteractionState,
  CharacterInteractionTarget,
  CharacterMemory,
  CharacterOpinion,
} from '../types/characterInteractionTypes';
import type { DriverWant } from '../types/relationshipTypes';
import type { StaffRole } from '../types/staffTypes';
import type { DepartmentId, PrincipalIdentity } from '../types/phase18Types';
import { PRINCIPAL_IDENTITY_LABELS } from './phase18IdentityCultureEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { rivalRelationship } from './phase18RivalRelationshipEngine';

const STAFF_DEPARTMENT: Record<StaffRole, DepartmentId> = {
  'Technical Director': 'Technical',
  'Race Engineer': 'Engineering',
  'Pit Crew Chief': 'RaceOperations',
  Strategist: 'RaceOperations',
};

const AGENDA_LABELS: Record<CharacterAgenda, string> = {
  CompetitiveStatus: 'Competitive status',
  CareerSecurity: 'Career security',
  TeamHarmony: 'Team harmony',
  FinancialReward: 'Financial reward',
  Recognition: 'Recognition',
  TechnicalFreedom: 'Technical freedom',
  Resources: 'Resources',
  Stability: 'Stability',
  ImmediateResults: 'Immediate results',
  FinancialDiscipline: 'Financial discipline',
  LongTermGrowth: 'Long-term growth',
  Prestige: 'Prestige',
  Tradition: 'Tradition',
  Cooperation: 'Cooperation',
  PoliticalInfluence: 'Political influence',
  TechnicalAdvantage: 'Technical advantage',
  PublicStanding: 'Public standing',
};

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, Math.round(value)));
}

function roundOf(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

export function characterOpinionKey(target: Pick<CharacterInteractionTarget, 'type' | 'id'>): string {
  return `${target.type}:${target.id}`;
}

function interactionState(state?: CharacterInteractionState): CharacterInteractionState {
  return {
    version: 6,
    history: state?.history ?? [],
    lastInteractionByTarget: state?.lastInteractionByTarget ?? {},
    recruitmentInterest: state?.recruitmentInterest ?? {},
    requestHistory: state?.requestHistory ?? [],
    opinions: state?.opinions ?? {},
    memories: state?.memories ?? [],
    ambitions: state?.ambitions ?? [],
    connections: state?.connections ?? [],
    factions: state?.factions ?? [],
    disputes: state?.disputes ?? [],
  };
}

function driverAgenda(wants: DriverWant[]): CharacterAgenda {
  const want = wants[0];
  if (want === 'better_salary') return 'FinancialReward';
  if (want === 'contract_renewal' || want === 'race_seat_security' || want === 'team_stability') return 'CareerSecurity';
  if (want === 'equal_treatment' || want === 'better_teammate_treatment') return 'TeamHarmony';
  return 'CompetitiveStatus';
}

function staffAgenda(role: StaffRole, workload: number): CharacterAgenda {
  if (workload >= 65) return 'Resources';
  if (role === 'Technical Director' || role === 'Race Engineer') return 'TechnicalFreedom';
  return 'Recognition';
}

function rivalAgenda(identity: PrincipalIdentity): CharacterAgenda {
  if (identity === 'PoliticalOperator') return 'PoliticalInfluence';
  if (identity === 'TechnicalVisionary' || identity === 'RiskTakingInnovator') return 'TechnicalAdvantage';
  if (identity === 'CommercialStrategist' || identity === 'MediaFigure') return 'PublicStanding';
  return 'Cooperation';
}

function opinionBase(
  state: GameState,
  target: CharacterInteractionTarget,
): CharacterOpinion {
  const round = roundOf(state);
  if (target.type === 'Driver') {
    const relationship = state.driverRelationships?.[target.id];
    if (relationship) {
      return {
        targetType: target.type, targetId: target.id, targetName: target.name, teamId: target.teamId,
        score: clamp(relationship.trustInPrincipal - 50, -100, 100),
        trust: relationship.trustInPrincipal,
        respect: clamp((relationship.teamTrustInDriver + relationship.teamLoyalty) / 2, 0, 100),
        agenda: driverAgenda(relationship.wants), traits: [...relationship.personalityTraits],
        lastUpdatedSeason: state.seasonYear, lastUpdatedRound: round,
      };
    }
  }
  if (target.type === 'Staff') {
    const member = (state.staff ?? []).find((candidate) => candidate.id === target.id);
    if (member) {
      const phase18 = ensurePhase18FoundationState(state.phase18, state);
      const mood = phase18.departmentMoods[state.selectedTeamId][STAFF_DEPARTMENT[member.role]];
      return {
        targetType: target.type, targetId: target.id, targetName: target.name, teamId: target.teamId,
        score: clamp(mood.trustInPrincipal - 50, -100, 100), trust: mood.trustInPrincipal,
        respect: clamp((mood.strategicAlignment + member.rating * 10) / 2, 0, 100),
        agenda: staffAgenda(member.role, mood.workload), traits: [member.role, member.rating >= 8 ? 'Elite specialist' : 'Team specialist'],
        lastUpdatedSeason: state.seasonYear, lastUpdatedRound: round,
      };
    }
  }
  if (target.type === 'Owner') {
    const reputation = state.teamReputations?.[target.teamId ?? state.selectedTeamId];
    const personality = reputation?.ownerPersonality ?? 'PatientBuilder';
    const agenda: CharacterAgenda = personality === 'WinNowTycoon' ? 'ImmediateResults'
      : personality === 'BudgetHawk' ? 'FinancialDiscipline'
        : personality === 'Showman' ? 'Prestige'
          : personality === 'OldGuard' ? 'Tradition' : 'LongTermGrowth';
    const patience = reputation?.ownerPatience ?? 50;
    return {
      targetType: target.type, targetId: target.id, targetName: target.name, teamId: target.teamId,
      score: clamp(patience - 50, -100, 100), trust: patience,
      respect: state.principal?.attributes.boardConfidence ?? 50, agenda,
      traits: [OWNER_PERSONALITY_LABELS[personality]], lastUpdatedSeason: state.seasonYear, lastUpdatedRound: round,
    };
  }
  if (target.type === 'RivalPrincipal' && target.teamId) {
    const relationship = rivalRelationship(state, state.selectedTeamId, target.teamId);
    const identity = state.phase18?.aiPrincipalIdentities[target.teamId]?.dominantIdentity ?? 'BalancedLeader';
    return {
      targetType: target.type, targetId: target.id, targetName: target.name, teamId: target.teamId,
      score: relationship?.score ?? 0, trust: relationship?.commercialTrust ?? 50,
      respect: relationship?.sportingRespect ?? 50, agenda: rivalAgenda(identity),
      traits: [PRINCIPAL_IDENTITY_LABELS[identity]], lastUpdatedSeason: state.seasonYear, lastUpdatedRound: round,
    };
  }
  return {
    targetType: target.type, targetId: target.id, targetName: target.name, teamId: target.teamId,
    score: 0, trust: 50, respect: 50,
    agenda: target.type === 'StaffCandidate' ? 'CareerSecurity' : 'Stability',
    traits: target.type === 'StaffCandidate' ? ['Potential recruit'] : [],
    lastUpdatedSeason: state.seasonYear, lastUpdatedRound: round,
  };
}

export function currentCharacterTargets(state: GameState): CharacterInteractionTarget[] {
  const targets: CharacterInteractionTarget[] = [];
  for (const driver of state.drivers.filter((entry) => entry.teamId === state.selectedTeamId)) {
    targets.push({ type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId });
  }
  for (const member of state.staff ?? []) {
    targets.push({ type: 'Staff', id: member.id, name: member.name, teamId: state.selectedTeamId });
  }
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  if (team) targets.push({ type: 'Owner', id: `owner-${team.id}`, name: `${team.name} Ownership`, teamId: team.id });
  for (const rivalTeam of state.teams.filter((entry) => entry.id !== state.selectedTeamId)) {
    const principal = state.aiPrincipals?.[rivalTeam.id];
    targets.push({
      type: 'RivalPrincipal', id: principal?.principalId ?? `principal-${rivalTeam.id}`,
      name: principal?.name ?? `${rivalTeam.shortName} Team Principal`, teamId: rivalTeam.id,
    });
  }
  return targets;
}

export function ensureCharacterOpinions(state: GameState): GameState {
  const current = interactionState(state.characterInteractions);
  const opinions = { ...current.opinions };
  for (const target of currentCharacterTargets(state)) {
    const key = characterOpinionKey(target);
    if (!opinions[key]) opinions[key] = opinionBase(state, target);
  }
  return { ...state, characterInteractions: { ...current, opinions } };
}

export function characterOpinionFor(state: GameState, target: CharacterInteractionTarget): CharacterOpinion {
  return state.characterInteractions?.opinions?.[characterOpinionKey(target)] ?? opinionBase(state, target);
}

function reactionDelta(opinion: CharacterOpinion, tone: CharacterMemory['tone']): number {
  let delta = tone === 'Positive' ? 6 : tone === 'Mixed' ? 1 : tone === 'Negative' ? -7 : 0;
  if (tone === 'Positive' && opinion.traits.some((trait) => trait === 'Loyal' || trait === 'Confidence Driven' || trait === 'People Manager')) delta += 2;
  if (tone === 'Negative' && opinion.traits.includes('Resilient')) delta += 2;
  if (tone === 'Negative' && opinion.traits.some((trait) => trait === 'High Ego' || trait === 'Pressure Sensitive' || trait === 'Demanding')) delta -= 2;
  if (tone === 'Negative' && opinion.traits.includes('Win-Now Tycoon')) delta -= 2;
  if (tone === 'Negative' && opinion.traits.includes('Patient Builder')) delta += 2;
  if (tone === 'Negative' && opinion.traits.includes('Political Operator')) delta -= 1;
  return delta;
}

export function recordCharacterMemory(
  state: GameState,
  target: CharacterInteractionTarget,
  input: Pick<CharacterMemory, 'source' | 'label' | 'description' | 'tone' | 'effects'>,
): GameState {
  const seeded = ensureCharacterOpinions(state);
  const current = interactionState(seeded.characterInteractions);
  const key = characterOpinionKey(target);
  const opinion = current.opinions[key] ?? opinionBase(seeded, target);
  const opinionDelta = reactionDelta(opinion, input.tone);
  const strength = (input.tone === 'Negative' ? 4 : input.tone === 'Positive' ? 3 : input.tone === 'Mixed' ? 2 : 1) as CharacterMemory['strength'];
  const round = roundOf(state);
  const memory: CharacterMemory = {
    id: `memory-${state.seasonYear}-${round}-${target.type}-${target.id}-${current.memories.length + 1}`,
    targetType: target.type, targetId: target.id, targetName: target.name, teamId: target.teamId,
    seasonYear: state.seasonYear, round, source: input.source, label: input.label,
    description: input.description, tone: input.tone, strength, opinionDelta, effects: input.effects,
  };
  const updated: CharacterOpinion = {
    ...opinion,
    targetName: target.name,
    teamId: target.teamId,
    score: clamp(opinion.score + opinionDelta, -100, 100),
    trust: clamp(opinion.trust + Math.round(opinionDelta * 0.8), 0, 100),
    respect: clamp(opinion.respect + Math.round(opinionDelta * 0.45), 0, 100),
    lastUpdatedSeason: state.seasonYear,
    lastUpdatedRound: round,
  };
  return {
    ...seeded,
    characterInteractions: {
      ...current,
      opinions: { ...current.opinions, [key]: updated },
      memories: [...current.memories, memory].slice(-500),
    },
  };
}

export function characterMemoriesForTarget(state: GameState, target: CharacterInteractionTarget): CharacterMemory[] {
  return (state.characterInteractions?.memories ?? [])
    .filter((memory) => memory.targetType === target.type && memory.targetId === target.id)
    .reverse();
}

export function characterAgendaLabel(agenda: CharacterAgenda): string {
  return AGENDA_LABELS[agenda];
}

export function characterOpinionLabel(score: number): string {
  if (score >= 60) return 'Devoted';
  if (score >= 25) return 'Supportive';
  if (score > -25) return 'Neutral';
  if (score > -60) return 'Wary';
  return 'Hostile';
}
