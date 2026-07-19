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
    next = {
      ...next,
      commercial: {
        ...commercial,
        commercialReputation: clamp(commercial.commercialReputation + 1),
        sponsors: commercial.sponsors.map((sponsor) => ({ ...sponsor, confidence: clamp(sponsor.confidence + 4) })),
      },
    };
    outcome = 'Active partners received a direct progress briefing and clearer expectations.';
    effects = ['Sponsor confidence +4', 'Commercial reputation +1'];
  } else {
    const commercial = state.commercial;
    const organization = state.teamOrgRatings?.[state.selectedTeamId];
    next = {
      ...next,
      commercial: commercial ? {
        ...commercial,
        commercialReputation: clamp(commercial.commercialReputation + 2),
        sponsors: commercial.sponsors.map((sponsor) => ({ ...sponsor, confidence: clamp(sponsor.confidence + 1) })),
      } : commercial,
      teamOrgRatings: organization ? {
        ...state.teamOrgRatings,
        [state.selectedTeamId]: { ...organization, fanSupport: clamp(organization.fanSupport + 5) },
      } : state.teamOrgRatings,
    };
    outcome = 'The supporter programme improved public connection and commercial visibility.';
    effects = [
      'Fan support +5',
      ...(commercial ? ['Commercial reputation +2'] : []),
      ...(commercial?.sponsors.length ? ['Sponsor confidence +1'] : []),
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
