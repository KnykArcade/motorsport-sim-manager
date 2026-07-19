import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventOption } from '../types/careerPhaseTypes';
import type { RacePrepFocusEffect } from '../types/simTypes';
import type { AITeamArchetype } from '../types/aiTeamTypes';
import {
  DEPARTMENT_IDS,
  PRINCIPAL_IDENTITIES,
  TEAM_CULTURE_AXES,
  type DepartmentId,
  type PrincipalIdentity,
  type TeamCultureAxis,
  type TeamCultureState,
  type TeamCultureTag,
} from '../types/phase18Types';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { advisorPreparationEffectMultiplier } from './phase18AdvisorEngine';
import { departmentPreparationMultiplier } from './relationshipGameplayEffectEngine';

export const PRINCIPAL_IDENTITY_LABELS: Record<PrincipalIdentity, string> = {
  BalancedLeader: 'Balanced Leader',
  TechnicalVisionary: 'Technical Visionary',
  PeopleManager: 'People Manager',
  PoliticalOperator: 'Political Operator',
  CommercialStrategist: 'Commercial Strategist',
  MediaFigure: 'Media Figure',
  RiskTakingInnovator: 'Risk-Taking Innovator',
};

export const PRINCIPAL_IDENTITY_DESCRIPTIONS: Record<PrincipalIdentity, string> = {
  BalancedLeader: 'Builds alignment by balancing performance, people, risk, and finances.',
  TechnicalVisionary: 'Earns authority through engineering direction and technical investment.',
  PeopleManager: 'Prioritizes morale, trust, development, and long-term relationships.',
  PoliticalOperator: 'Uses alliances, influence, and regulation strategy to create advantages.',
  CommercialStrategist: 'Protects the organization through disciplined financial and sponsor decisions.',
  MediaFigure: 'Shapes the public narrative and turns visibility into organizational influence.',
  RiskTakingInnovator: 'Accepts volatility to pursue unconventional performance breakthroughs.',
};

type DecisionProfile = {
  identity: PrincipalIdentity;
  xp: number;
  culture: Partial<Record<TeamCultureAxis, number>>;
  cohesion: number;
  stability: number;
  departments: DepartmentId[];
  trust: number;
  alignment: number;
  workload: number;
};

export type LeadershipGameplayModifiers = {
  developmentSuccessBonus: number;
  moraleEffectMultiplier: number;
  preparationEffectMultiplier: number;
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function profileForDecision(event: PaddockEvent, option: PaddockEventOption): DecisionProfile {
  const base: DecisionProfile = {
    identity: 'BalancedLeader',
    xp: 3,
    culture: { Discipline: 1 },
    cohesion: 1,
    stability: 1,
    departments: ['RaceOperations'],
    trust: 1,
    alignment: 2,
    workload: 0,
  };

  if (event.category === 'general_team' && event.title.startsWith('Select race preparation focus')) {
    switch (option.id) {
      case 'qualifying':
        return { ...base, identity: 'RiskTakingInnovator', culture: { Innovation: 2, RiskAppetite: 2 }, stability: -1, departments: ['Aerodynamics', 'Engineering', 'RaceOperations'], workload: 2 };
      case 'race':
        return { ...base, identity: 'TechnicalVisionary', culture: { Discipline: 2, PeopleFocus: 1 }, departments: ['Engineering', 'RaceOperations'], trust: 2 };
      case 'reliability':
        return { ...base, identity: 'TechnicalVisionary', xp: 4, culture: { Discipline: 2, RiskAppetite: -1 }, stability: 2, departments: ['Technical', 'Engineering'], trust: 2 };
      case 'power':
        return { ...base, identity: 'RiskTakingInnovator', xp: 4, culture: { Innovation: 2, RiskAppetite: 3 }, stability: -2, departments: ['Technical', 'Engineering'], workload: 3 };
      case 'budget':
        return { ...base, identity: 'CommercialStrategist', xp: 4, culture: { CommercialFocus: 3, PeopleFocus: -1, RiskAppetite: -1 }, cohesion: -1, departments: ['Commercial', 'RaceOperations'], trust: -1, workload: 2 };
      case 'balanced':
      default:
        return base;
    }
  }

  if (event.category === 'development' || option.carStatChange || option.reliabilityChange) {
    return { ...base, identity: option.risk ? 'RiskTakingInnovator' : 'TechnicalVisionary', culture: { Innovation: 2, RiskAppetite: option.risk ? 2 : 0 }, departments: ['Technical', 'Aerodynamics', 'Engineering'], workload: option.risk ? 2 : 1 };
  }
  if (event.category === 'driver_morale' || option.moraleChange) {
    return { ...base, identity: 'PeopleManager', culture: { PeopleFocus: 2 }, cohesion: 2, departments: ['DriverManagement'], trust: 2 };
  }
  if (event.category === 'finance' || event.category === 'sponsor' || option.budgetChange) {
    return { ...base, identity: 'CommercialStrategist', culture: { CommercialFocus: 2, Discipline: 1 }, departments: ['Commercial'], trust: 1 };
  }
  if (event.category === 'regulation') {
    return { ...base, identity: 'PoliticalOperator', culture: { PoliticalFocus: 2 }, departments: ['PoliticalLegal'], alignment: 3 };
  }
  if (event.category === 'staff' || event.category === 'facility') {
    return { ...base, identity: 'PeopleManager', culture: { PeopleFocus: 1, Discipline: 1 }, departments: ['Technical', 'Engineering'], trust: 2 };
  }
  return base;
}

export function leadershipDecisionPreview(event: PaddockEvent, option: PaddockEventOption): {
  identityLabel: string;
  xp: number;
  cultureChanges: string[];
} {
  const profile = profileForDecision(event, option);
  return {
    identityLabel: PRINCIPAL_IDENTITY_LABELS[profile.identity],
    xp: profile.xp,
    cultureChanges: Object.entries(profile.culture)
      .filter(([, amount]) => amount !== 0)
      .map(([axis, amount]) => `${amount! > 0 ? '+' : ''}${amount} ${axis.replace(/([a-z])([A-Z])/g, '$1 $2')}`),
  };
}

function rankedIdentities(scores: Record<PrincipalIdentity, number>): PrincipalIdentity[] {
  return [...PRINCIPAL_IDENTITIES].sort((a, b) => scores[b] - scores[a] || a.localeCompare(b));
}

function cultureTags(culture: TeamCultureState): TeamCultureTag[] {
  const tags = new Set<TeamCultureTag>();
  const { axes } = culture;
  if (axes.Innovation >= 65 && axes.Discipline >= 55) tags.add('DevelopmentFactory');
  if (axes.Innovation >= 68) tags.add('AeroInnovator');
  if (axes.Discipline >= 68) tags.add('StrategyTeam');
  if (axes.PeopleFocus >= 68) tags.add('DriverAcademy');
  if (axes.PoliticalFocus >= 68) tags.add('PoliticalOperator');
  if (axes.CommercialFocus >= 68) tags.add('CommercialMachine');
  if (axes.Innovation <= 35 && axes.RiskAppetite <= 35) tags.add('Traditionalist');
  if (culture.cohesion <= 35 || culture.stability <= 35) tags.add('Chaotic');
  return [...tags];
}

export function applyLeadershipDecision(
  state: GameState,
  event: PaddockEvent,
  option: PaddockEventOption,
): GameState {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const profile = profileForDecision(event, option);
  const round = state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
  const identity = phase18.principalIdentity;
  const scores = { ...identity.scores, [profile.identity]: identity.scores[profile.identity] + profile.xp };
  const ranked = rankedIdentities(scores);
  const identityEventId = `identity-${state.seasonYear}-${round}-${event.id}-${option.id}`;

  const teamCulture = phase18.teamCultures[state.selectedTeamId];
  const axes = { ...teamCulture.axes };
  const driftHistory = [...teamCulture.driftHistory];
  for (const axis of TEAM_CULTURE_AXES) {
    const amount = profile.culture[axis] ?? 0;
    if (!amount) continue;
    axes[axis] = clamp(axes[axis] + amount);
    driftHistory.push({
      id: `culture-${state.seasonYear}-${round}-${event.id}-${option.id}-${axis}`,
      seasonYear: state.seasonYear,
      round,
      axis,
      amount,
      reason: `${event.title}: ${option.label}`,
    });
  }
  const evolvedCulture: TeamCultureState = {
    ...teamCulture,
    axes,
    cohesion: clamp(teamCulture.cohesion + profile.cohesion),
    stability: clamp(teamCulture.stability + profile.stability),
    driftHistory: driftHistory.slice(-120),
    tags: [],
  };
  evolvedCulture.tags = cultureTags(evolvedCulture);

  const departmentMoods = { ...phase18.departmentMoods };
  const teamDepartments = { ...departmentMoods[state.selectedTeamId] };
  for (const departmentId of DEPARTMENT_IDS) {
    const mood = teamDepartments[departmentId];
    if (!profile.departments.includes(departmentId)) continue;
    teamDepartments[departmentId] = {
      ...mood,
      morale: clamp(mood.morale + Math.sign(profile.trust || profile.alignment)),
      trustInPrincipal: clamp(mood.trustInPrincipal + profile.trust),
      strategicAlignment: clamp(mood.strategicAlignment + profile.alignment),
      workload: clamp(mood.workload + profile.workload),
      preferredPriority: option.label,
      conflictReasons: profile.trust < 0
        ? [...mood.conflictReasons, `${event.title}: ${option.label}`].slice(-5)
        : mood.conflictReasons,
      lastUpdatedSeasonYear: state.seasonYear,
      lastUpdatedRound: round,
    };
  }
  departmentMoods[state.selectedTeamId] = teamDepartments;

  return {
    ...state,
    phase18: {
      ...phase18,
      principalIdentity: {
        ...identity,
        scores,
        dominantIdentity: ranked[0],
        secondaryIdentity: scores[ranked[1]] > 0 ? ranked[1] : undefined,
        totalIdentityXp: identity.totalIdentityXp + profile.xp,
        history: [...identity.history, {
          id: identityEventId,
          seasonYear: state.seasonYear,
          round,
          identity: profile.identity,
          amount: profile.xp,
          reason: `${event.title}: ${option.label}`,
        }].slice(-100),
      },
      teamCultures: { ...phase18.teamCultures, [state.selectedTeamId]: evolvedCulture },
      departmentMoods,
    },
  };
}

export function leadershipGameplayModifiers(
  state: Pick<GameState, 'phase18' | 'selectedTeamId'>,
): LeadershipGameplayModifiers {
  const identity = state.phase18?.principalIdentity;
  const culture = state.phase18?.teamCultures[state.selectedTeamId];
  if (!identity || !culture) {
    return { developmentSuccessBonus: 0, moraleEffectMultiplier: 1, preparationEffectMultiplier: 1 };
  }

  const technicalXp = identity.scores.TechnicalVisionary + identity.scores.RiskTakingInnovator * 0.5;
  const peopleXp = identity.scores.PeopleManager + identity.scores.BalancedLeader * 0.35;
  const developmentSuccessBonus = clamp(
    (culture.axes.Innovation - 50) / 500
      + (culture.cohesion - 50) / 1_000
      + technicalXp / 1_000,
    -0.08,
    0.08,
  );
  const moraleEffectMultiplier = clamp(
    1 + (culture.axes.PeopleFocus - 50) / 250 + (culture.cohesion - 50) / 500 + peopleXp / 500,
    0.8,
    1.2,
  );
  const preparationEffectMultiplier = clamp(
    1 + (culture.axes.Discipline - 50) / 500 + (culture.stability - 50) / 1_000,
    0.9,
    1.1,
  );
  return {
    developmentSuccessBonus: round3(developmentSuccessBonus),
    moraleEffectMultiplier: round3(moraleEffectMultiplier),
    preparationEffectMultiplier: round3(preparationEffectMultiplier),
  };
}

export function cultureDescriptor(culture: TeamCultureState): string {
  const strongest = [...TEAM_CULTURE_AXES].sort((a, b) => culture.axes[b] - culture.axes[a])[0];
  if (culture.tags.length > 0) return culture.tags.join(' · ');
  return `${strongest} led`;
}

export function applyLeadershipPreparationModifier(
  state: Pick<GameState, 'phase18' | 'selectedTeamId' | 'careerPhase'>,
  effect: RacePrepFocusEffect,
): RacePrepFocusEffect {
  const multiplier = leadershipGameplayModifiers(state).preparationEffectMultiplier
    * advisorPreparationEffectMultiplier(state)
    * departmentPreparationMultiplier(state);
  return {
    ...effect,
    paceModifier: effect.paceModifier * multiplier,
    reliabilityModifier: effect.reliabilityModifier * multiplier,
    qualifyingModifier: effect.qualifyingModifier * multiplier,
    mistakeRiskMultiplier: 1 + (effect.mistakeRiskMultiplier - 1) * multiplier,
    setupConfidencePenalty: effect.setupConfidencePenalty == null
      ? undefined
      : effect.setupConfidencePenalty * multiplier,
    pitStopPenalty: effect.pitStopPenalty == null ? undefined : effect.pitStopPenalty * multiplier,
    strategyPenalty: effect.strategyPenalty == null ? undefined : effect.strategyPenalty * multiplier,
  };
}

export function applyAILeadershipDirection(
  state: GameState,
  teamId: string,
  archetype: AITeamArchetype,
  round: number,
): GameState {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const identity = phase18.aiPrincipalIdentities[teamId];
  const culture = phase18.teamCultures[teamId];
  if (!identity || !culture) return state;

  const directions: Record<AITeamArchetype, {
    identity: PrincipalIdentity;
    culture: Partial<Record<TeamCultureAxis, number>>;
    cohesion: number;
    stability: number;
  }> = {
    ChampionshipContender: { identity: 'BalancedLeader', culture: { Discipline: 1 }, cohesion: 1, stability: 1 },
    AmbitiousBuilder: { identity: 'RiskTakingInnovator', culture: { Innovation: 1, RiskAppetite: 1 }, cohesion: 0, stability: 0 },
    DevelopmentFocused: { identity: 'TechnicalVisionary', culture: { Innovation: 1 }, cohesion: 0, stability: 1 },
    FinanciallyConservative: { identity: 'CommercialStrategist', culture: { CommercialFocus: 1, RiskAppetite: -1 }, cohesion: 0, stability: 1 },
    PayDriverReliant: { identity: 'CommercialStrategist', culture: { CommercialFocus: 1, PeopleFocus: -1 }, cohesion: -1, stability: 0 },
    AggressiveSpender: { identity: 'RiskTakingInnovator', culture: { Innovation: 1, RiskAppetite: 2 }, cohesion: 0, stability: -1 },
    YouthFocused: { identity: 'PeopleManager', culture: { PeopleFocus: 1 }, cohesion: 1, stability: 0 },
    SurvivalMode: { identity: 'CommercialStrategist', culture: { Discipline: 1, RiskAppetite: -1 }, cohesion: -1, stability: 1 },
  };
  const direction = directions[archetype];
  const scores = { ...identity.scores, [direction.identity]: identity.scores[direction.identity] + 1 };
  const ranked = rankedIdentities(scores);
  const axes = { ...culture.axes };
  const driftHistory = [...culture.driftHistory];
  for (const [axis, amount] of Object.entries(direction.culture) as [TeamCultureAxis, number][]) {
    axes[axis] = clamp(axes[axis] + amount);
    driftHistory.push({
      id: `ai-culture-${state.seasonYear}-${round}-${teamId}-${axis}`,
      seasonYear: state.seasonYear,
      round,
      axis,
      amount,
      reason: `${archetype} management direction`,
    });
  }
  const evolvedCulture: TeamCultureState = {
    ...culture,
    axes,
    cohesion: clamp(culture.cohesion + direction.cohesion),
    stability: clamp(culture.stability + direction.stability),
    driftHistory: driftHistory.slice(-120),
    tags: [],
  };
  evolvedCulture.tags = cultureTags(evolvedCulture);

  return {
    ...state,
    phase18: {
      ...phase18,
      aiPrincipalIdentities: {
        ...phase18.aiPrincipalIdentities,
        [teamId]: {
          ...identity,
          scores,
          dominantIdentity: ranked[0],
          secondaryIdentity: scores[ranked[1]] > 0 ? ranked[1] : undefined,
          totalIdentityXp: identity.totalIdentityXp + 1,
          history: [...identity.history, {
            id: `ai-identity-${state.seasonYear}-${round}-${teamId}`,
            seasonYear: state.seasonYear,
            round,
            identity: direction.identity,
            amount: 1,
            reason: `${archetype} management direction`,
          }].slice(-100),
        },
      },
      teamCultures: { ...phase18.teamCultures, [teamId]: evolvedCulture },
    },
  };
}
