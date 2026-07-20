import type { GameState } from '../game/careerState';
import type { NewsItem } from '../types/gameTypes';
import type {
  CollectiveStakeholderAction,
  CollectiveStakeholderActionRecord,
  CollectiveStakeholderId,
  DepartmentId,
} from '../types/phase18Types';
import { makeTransaction } from './financeEngine';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';

export type CollectiveStakeholderActionSpec = {
  id: CollectiveStakeholderAction;
  stakeholderId: CollectiveStakeholderId;
  label: string;
  description: string;
  effectPreview: string;
  cost: number;
};

export type CollectiveStakeholderActionFit = {
  label: 'Favored' | 'Neutral' | 'Risky';
  reason: string;
  effectPreview: string;
};

export const COLLECTIVE_STAKEHOLDER_ACTIONS: readonly CollectiveStakeholderActionSpec[] = [
  {
    id: 'ReviewWorkload',
    stakeholderId: 'Departments',
    label: 'Review workload',
    description: 'Give the most stretched department immediate operating relief.',
    effectPreview: 'Reduces peak workload and improves that committee’s morale and trust.',
    cost: 200_000,
  },
  {
    id: 'ClarifyPriorities',
    stakeholderId: 'Departments',
    label: 'Clarify priorities',
    description: 'Meet the least-aligned department and reset what management expects.',
    effectPreview: 'Improves strategic alignment and trust without changing car development choices.',
    cost: 0,
  },
  {
    id: 'BriefSponsors',
    stakeholderId: 'Commercial',
    label: 'Brief sponsors',
    description: 'Give active partners a direct progress and expectations briefing.',
    effectPreview: 'Improves sponsor confidence and slightly strengthens commercial reputation.',
    cost: 100_000,
  },
  {
    id: 'EngageSupporters',
    stakeholderId: 'Commercial',
    label: 'Engage supporters',
    description: 'Run a focused supporter and media engagement programme.',
    effectPreview: 'Improves fan support, commercial reputation, and partner confidence.',
    cost: 250_000,
  },
] as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function currentRound(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

function departmentLabel(id: DepartmentId): string {
  return id.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function collectiveStakeholderActionUsedThisRound(
  state: GameState,
  stakeholderId: CollectiveStakeholderId,
): boolean {
  const round = currentRound(state);
  return (state.phase18?.collectiveStakeholderActions ?? []).some((record) =>
    record.stakeholderId === stakeholderId
      && record.seasonYear === state.seasonYear
      && record.round === round);
}

export function collectiveStakeholderActionUnavailableReason(
  state: GameState,
  spec: CollectiveStakeholderActionSpec,
): string | undefined {
  if (collectiveStakeholderActionUsedThisRound(state, spec.stakeholderId)) return 'Committee action already used this round';
  const budget = state.teams.find((team) => team.id === state.selectedTeamId)?.budget ?? 0;
  if (budget < spec.cost) return 'Insufficient budget';
  if (spec.id === 'BriefSponsors' && (state.commercial?.sponsors.length ?? 0) === 0) return 'No active sponsors to brief';
  return undefined;
}

export function collectiveStakeholderActionFit(
  state: GameState,
  spec: CollectiveStakeholderActionSpec,
): CollectiveStakeholderActionFit {
  const phase18 = ensurePhase18FoundationState(state.phase18, state);

  if (spec.id === 'ReviewWorkload' || spec.id === 'ClarifyPriorities') {
    const moods = Object.values(phase18.departmentMoods[state.selectedTeamId] ?? {});
    const peakWorkload = Math.max(0, ...moods.map((mood) => mood.workload));
    const lowestAlignment = Math.min(100, ...moods.map((mood) => mood.strategicAlignment));
    if (spec.id === 'ReviewWorkload') {
      if (peakWorkload >= 85) return { label: 'Favored', reason: `Peak workload is ${peakWorkload}/100.`, effectPreview: 'Large relief to the most overloaded committee.' };
      if (peakWorkload <= 55) return { label: 'Neutral', reason: `Peak workload is only ${peakWorkload}/100.`, effectPreview: 'Modest morale insurance; no urgent overload to solve.' };
      return { label: 'Favored', reason: `Peak workload is ${peakWorkload}/100.`, effectPreview: spec.effectPreview };
    }
    if (lowestAlignment <= 40) return { label: 'Favored', reason: `Lowest department alignment is ${lowestAlignment}/100.`, effectPreview: 'Best used to repair unclear or disputed priorities.' };
    return { label: 'Neutral', reason: `Lowest department alignment is ${lowestAlignment}/100.`, effectPreview: spec.effectPreview };
  }

  const commercial = state.commercial;
  const sponsors = commercial?.sponsors ?? [];
  const confidence = sponsors.length ? average(sponsors.map((sponsor) => sponsor.confidence)) : 0;
  const lowestSponsor = sponsors.length ? Math.min(...sponsors.map((sponsor) => sponsor.confidence)) : 0;
  const reputation = commercial?.commercialReputation ?? state.teamOrgRatings?.[state.selectedTeamId]?.sponsorAppeal ?? 50;
  const fanSupport = state.teamOrgRatings?.[state.selectedTeamId]?.fanSupport ?? 50;
  const failedObjectives = sponsors.flatMap((sponsor) => sponsor.objectives).filter((objective) => objective.status === 'Failed').length;

  if (spec.id === 'BriefSponsors') {
    if (sponsors.length === 0) return { label: 'Risky', reason: 'There are no active sponsor relationships.', effectPreview: 'Unavailable until the team has active partners.' };
    if (confidence <= 45 || lowestSponsor <= 30 || failedObjectives > 0) {
      return {
        label: 'Favored',
        reason: failedObjectives > 0
          ? `${failedObjectives} sponsor objective${failedObjectives === 1 ? ' has' : 's have'} failed.`
          : `Sponsor confidence is ${confidence}/100; weakest partner is ${lowestSponsor}/100.`,
        effectPreview: 'Stronger confidence recovery because partners need direct reassurance.',
      };
    }
    if (confidence >= 78 && reputation >= 70) return { label: 'Neutral', reason: 'Commercial relationships are already stable.', effectPreview: 'Small maintenance gain; stronger moves may be needed elsewhere.' };
    return { label: 'Neutral', reason: `Sponsor confidence is ${confidence}/100.`, effectPreview: spec.effectPreview };
  }

  if (fanSupport <= 45 || reputation <= 45) {
    return {
      label: 'Favored',
      reason: `Fan support is ${fanSupport}/100 and commercial reputation is ${reputation}/100.`,
      effectPreview: 'Stronger public-standing recovery because the team needs visibility.',
    };
  }
  if (sponsors.length > 0 && confidence <= 30 && fanSupport >= 65) {
    return {
      label: 'Risky',
      reason: `Sponsor confidence is ${confidence}/100 while supporter demand is already strong.`,
      effectPreview: 'Public activity helps fans, but sponsors may see it as avoiding partner issues.',
    };
  }
  return { label: 'Neutral', reason: `Fan support is ${fanSupport}/100.`, effectPreview: spec.effectPreview };
}

export function takeCollectiveStakeholderAction(
  state: GameState,
  action: CollectiveStakeholderAction,
): GameState {
  const spec = COLLECTIVE_STAKEHOLDER_ACTIONS.find((candidate) => candidate.id === action);
  if (!spec || collectiveStakeholderActionUnavailableReason(state, spec)) return state;

  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const round = currentRound(state);
  let next: GameState = { ...state, phase18 };
  let outcome: string;
  let effects: string[];

  if (action === 'ReviewWorkload' || action === 'ClarifyPriorities') {
    const departments = phase18.departmentMoods[state.selectedTeamId];
    const candidates = Object.values(departments);
    const target = [...candidates].sort((a, b) => action === 'ReviewWorkload'
      ? b.workload - a.workload
      : a.strategicAlignment - b.strategicAlignment)[0];
    if (!target) return state;
    const updated = action === 'ReviewWorkload'
      ? {
          ...target,
          workload: clamp(target.workload - 12),
          morale: clamp(target.morale + 4),
          trustInPrincipal: clamp(target.trustInPrincipal + 2),
          conflictReasons: target.conflictReasons.filter((reason) => !/workload|overload|capacity/i.test(reason)),
          lastUpdatedSeasonYear: state.seasonYear,
          lastUpdatedRound: round,
        }
      : {
          ...target,
          strategicAlignment: clamp(target.strategicAlignment + 7),
          trustInPrincipal: clamp(target.trustInPrincipal + 3),
          morale: clamp(target.morale + 1),
          lastUpdatedSeasonYear: state.seasonYear,
          lastUpdatedRound: round,
        };
    const name = departmentLabel(target.departmentId);
    outcome = action === 'ReviewWorkload'
      ? `${name} received immediate workload relief after the committee review.`
      : `${name} left the priority briefing with a clearer management mandate.`;
    effects = action === 'ReviewWorkload'
      ? [`${name} workload -12`, `${name} morale +4`, `${name} trust +2`]
      : [`${name} alignment +7`, `${name} trust +3`, `${name} morale +1`];
    next = {
      ...next,
      phase18: {
        ...phase18,
        departmentMoods: {
          ...phase18.departmentMoods,
          [state.selectedTeamId]: { ...departments, [target.departmentId]: updated },
        },
      },
    };
  } else if (action === 'BriefSponsors') {
    const commercial = state.commercial;
    if (!commercial) return state;
    const sponsorConfidence = commercial.sponsors.length ? average(commercial.sponsors.map((sponsor) => sponsor.confidence)) : 0;
    const lowestSponsor = commercial.sponsors.length ? Math.min(...commercial.sponsors.map((sponsor) => sponsor.confidence)) : 0;
    const failedObjectives = commercial.sponsors.flatMap((sponsor) => sponsor.objectives).filter((objective) => objective.status === 'Failed').length;
    const confidenceGain = failedObjectives > 0 || sponsorConfidence <= 45 || lowestSponsor <= 30 ? 6 : sponsorConfidence >= 78 ? 2 : 4;
    const reputationGain = commercial.commercialReputation <= 45 ? 2 : 1;
    next = {
      ...next,
      commercial: {
        ...commercial,
        commercialReputation: clamp(commercial.commercialReputation + reputationGain),
        sponsors: commercial.sponsors.map((sponsor) => ({ ...sponsor, confidence: clamp(sponsor.confidence + confidenceGain) })),
      },
    };
    outcome = confidenceGain >= 6
      ? 'Active partners received a direct recovery briefing after commercial pressure built up.'
      : 'Active partners received a direct progress briefing and clearer expectations.';
    effects = [`Sponsor confidence +${confidenceGain}`, `Commercial reputation +${reputationGain}`];
  } else {
    const commercial = state.commercial;
    const organization = state.teamOrgRatings?.[state.selectedTeamId];
    const fanSupport = organization?.fanSupport ?? 50;
    const reputation = commercial?.commercialReputation ?? organization?.sponsorAppeal ?? 50;
    const sponsorConfidence = commercial?.sponsors.length ? average(commercial.sponsors.map((sponsor) => sponsor.confidence)) : 0;
    const fanGain = fanSupport <= 40 ? 8 : fanSupport <= 60 ? 5 : 3;
    const reputationGain = reputation <= 45 ? 3 : 2;
    const sponsorGain = sponsorConfidence > 0 && sponsorConfidence <= 30 && fanSupport >= 65 ? 0 : sponsorConfidence <= 45 ? 2 : 1;
    next = {
      ...next,
      commercial: commercial ? {
        ...commercial,
        commercialReputation: clamp(commercial.commercialReputation + reputationGain),
        sponsors: commercial.sponsors.map((sponsor) => ({ ...sponsor, confidence: clamp(sponsor.confidence + sponsorGain) })),
      } : commercial,
      teamOrgRatings: organization ? {
        ...state.teamOrgRatings,
        [state.selectedTeamId]: { ...organization, fanSupport: clamp(organization.fanSupport + fanGain) },
      } : state.teamOrgRatings,
    };
    outcome = fanGain >= 8
      ? 'The supporter programme repaired weak public connection and raised commercial visibility.'
      : 'The supporter programme improved public connection and commercial visibility.';
    effects = [
      `Fan support +${fanGain}`,
      ...(commercial ? [`Commercial reputation +${reputationGain}`] : []),
      ...(commercial?.sponsors.length && sponsorGain > 0 ? [`Sponsor confidence +${sponsorGain}`] : []),
    ];
  }

  const record: CollectiveStakeholderActionRecord = {
    id: `collective-${state.seasonYear}-${round}-${spec.stakeholderId}`,
    stakeholderId: spec.stakeholderId,
    action,
    label: spec.label,
    outcome,
    seasonYear: state.seasonYear,
    round,
    cost: spec.cost,
    effects,
  };
  const nextPhase18 = next.phase18!;
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  const news: NewsItem = {
    id: `news-${record.id}`,
    headline: `${spec.stakeholderId} meeting: ${spec.label}`,
    body: outcome,
    timestamp: new Date().toISOString(),
    category: spec.stakeholderId === 'Commercial' ? 'sponsor' : 'paddock',
    priority: 'normal',
    careerPhase: state.careerPhase?.currentPhase,
    teamId: state.selectedTeamId,
  };

  return {
    ...next,
    teams: spec.cost && team
      ? next.teams.map((entry) => entry.id === team.id ? { ...entry, budget: entry.budget - spec.cost } : entry)
      : next.teams,
    finance: spec.cost
      ? [...(next.finance ?? []), makeTransaction(state.seasonYear, 'Operations', `${spec.label} — ${spec.stakeholderId}`, -spec.cost, round)]
      : next.finance,
    news: [news, ...next.news].slice(0, 80),
    phase18: {
      ...nextPhase18,
      collectiveStakeholderActions: [...(nextPhase18.collectiveStakeholderActions ?? []), record].slice(-80),
    },
  };
}
