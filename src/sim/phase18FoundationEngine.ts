import type { GameState } from '../game/careerState';
import {
  DEPARTMENT_IDS,
  PHASE_18_FOUNDATION_VERSION,
  PRINCIPAL_IDENTITIES,
  TEAM_CULTURE_AXES,
  type DepartmentId,
  type DepartmentMood,
  type Phase18FoundationState,
  type PrincipalIdentity,
  type PrincipalIdentityState,
  type TeamCultureAxis,
  type TeamCultureState,
} from '../types/phase18Types';

type FoundationContext = Pick<
  GameState,
  'teams' | 'selectedTeamId' | 'seasonYear' | 'principal' | 'aiPrincipals'
>;

function identityScores(existing?: Partial<Record<PrincipalIdentity, number>>): Record<PrincipalIdentity, number> {
  return Object.fromEntries(
    PRINCIPAL_IDENTITIES.map((identity) => [identity, existing?.[identity] ?? 0]),
  ) as Record<PrincipalIdentity, number>;
}

function dominantIdentity(scores: Record<PrincipalIdentity, number>): PrincipalIdentity {
  return [...PRINCIPAL_IDENTITIES]
    .sort((a, b) => scores[b] - scores[a] || a.localeCompare(b))[0];
}

function ensurePrincipalIdentity(
  principalId: string,
  existing?: Partial<PrincipalIdentityState>,
): PrincipalIdentityState {
  // Identity belongs to the principal, not the seat. A new person taking over
  // a team starts a fresh profile instead of inheriting the predecessor's arc.
  const retained = existing?.principalId === principalId ? existing : undefined;
  const scores = identityScores(retained?.scores);
  const ranked = [...PRINCIPAL_IDENTITIES]
    .sort((a, b) => scores[b] - scores[a] || a.localeCompare(b));
  return {
    principalId,
    scores,
    dominantIdentity: retained?.dominantIdentity ?? dominantIdentity(scores),
    secondaryIdentity: retained?.secondaryIdentity ?? (scores[ranked[1]] > 0 ? ranked[1] : undefined),
    totalIdentityXp: retained?.totalIdentityXp ?? Object.values(scores).reduce((sum, value) => sum + value, 0),
    history: retained?.history ?? [],
  };
}

function cultureAxes(existing?: Partial<Record<TeamCultureAxis, number>>): Record<TeamCultureAxis, number> {
  return Object.fromEntries(
    TEAM_CULTURE_AXES.map((axis) => [axis, existing?.[axis] ?? 50]),
  ) as Record<TeamCultureAxis, number>;
}

function ensureTeamCulture(teamId: string, existing?: Partial<TeamCultureState>): TeamCultureState {
  return {
    teamId,
    axes: cultureAxes(existing?.axes),
    tags: existing?.tags ?? [],
    cohesion: existing?.cohesion ?? 50,
    stability: existing?.stability ?? 50,
    driftHistory: existing?.driftHistory ?? [],
  };
}

function ensureDepartmentMood(
  departmentId: DepartmentId,
  seasonYear: number,
  existing?: Partial<DepartmentMood>,
): DepartmentMood {
  return {
    departmentId,
    morale: existing?.morale ?? 50,
    trustInPrincipal: existing?.trustInPrincipal ?? 50,
    strategicAlignment: existing?.strategicAlignment ?? 50,
    workload: existing?.workload ?? 50,
    preferredPriority: existing?.preferredPriority,
    conflictReasons: existing?.conflictReasons ?? [],
    lastUpdatedSeasonYear: existing?.lastUpdatedSeasonYear ?? seasonYear,
    lastUpdatedRound: existing?.lastUpdatedRound,
  };
}

function ensureTeamDepartments(
  seasonYear: number,
  existing?: Partial<Record<DepartmentId, DepartmentMood>>,
): Record<DepartmentId, DepartmentMood> {
  return Object.fromEntries(DEPARTMENT_IDS.map((departmentId) => [
    departmentId,
    ensureDepartmentMood(departmentId, seasonYear, existing?.[departmentId]),
  ])) as Record<DepartmentId, DepartmentMood>;
}

export function rivalRelationshipId(teamAId: string, teamBId: string): string {
  return [teamAId, teamBId].sort().join('::');
}

export function ensurePhase18FoundationState(
  existing: Phase18FoundationState | undefined,
  context: FoundationContext,
): Phase18FoundationState {
  const playerPrincipalId = context.principal?.id ?? `principal-${context.selectedTeamId}`;
  const aiPrincipalIdentities = { ...(existing?.aiPrincipalIdentities ?? {}) };
  delete aiPrincipalIdentities[context.selectedTeamId];
  for (const team of context.teams) {
    if (team.id === context.selectedTeamId) continue;
    const principalId = context.aiPrincipals?.[team.id]?.principalId ?? `ai-principal-${team.id}`;
    aiPrincipalIdentities[team.id] = ensurePrincipalIdentity(principalId, aiPrincipalIdentities[team.id]);
  }

  const departmentMoods = { ...(existing?.departmentMoods ?? {}) };
  const teamCultures = { ...(existing?.teamCultures ?? {}) };
  for (const team of context.teams) {
    departmentMoods[team.id] = ensureTeamDepartments(context.seasonYear, departmentMoods[team.id]);
    teamCultures[team.id] = ensureTeamCulture(team.id, teamCultures[team.id]);
  }

  return {
    version: PHASE_18_FOUNDATION_VERSION,
    principalIdentity: ensurePrincipalIdentity(playerPrincipalId, existing?.principalIdentity),
    aiPrincipalIdentities,
    advisorRecommendations: existing?.advisorRecommendations ?? [],
    departmentMoods,
    intelligenceReports: existing?.intelligenceReports ?? [],
    contractClauses: existing?.contractClauses ?? [],
    teamCultures,
    rivalRelationships: existing?.rivalRelationships ?? {},
    legacy: {
      score: existing?.legacy?.score ?? 0,
      milestones: existing?.legacy?.milestones ?? [],
      hallOfFame: existing?.legacy?.hallOfFame ?? [],
      alternateHistory: existing?.legacy?.alternateHistory ?? [],
    },
    narratives: existing?.narratives ?? [],
  };
}

export function createInitialPhase18FoundationState(context: FoundationContext): Phase18FoundationState {
  return ensurePhase18FoundationState(undefined, context);
}
