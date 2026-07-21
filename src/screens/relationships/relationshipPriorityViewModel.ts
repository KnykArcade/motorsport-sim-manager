import type { CharacterInteractionTargetType } from '../../types/characterInteractionTypes';
import type {
  RelationshipActionWindow,
  RelationshipAttentionProfile,
  RelationshipAttentionStatus,
} from '../../sim/relationshipAttentionEngine';
import type { PotentialEmployerStanding } from './relationshipEmployerViewModel';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import type { ExternalTalentContext } from './relationshipTalentViewModel';

export type RelationshipHierarchyRow = {
  rank: string;
  title: string;
  motivation: string;
  coverage: string;
  jumpCondition: string;
};

export type RelationshipHierarchyDashboardRow = RelationshipHierarchyRow & {
  status: RelationshipAttentionStatus;
  activeCount: number;
  stableCount: number;
  totalCount: number;
  signal: string;
};

export const RELATIONSHIP_HIERARCHY: RelationshipHierarchyRow[] = [
  {
    rank: '1',
    title: 'Owner',
    motivation: 'Controls your position. Results matter, but alignment with the owner’s personality and expectations can buy or cost time.',
    coverage: 'Live character profile',
    jumpCondition: 'Always stays #1 unless a deadline elsewhere requires immediate action.',
  },
  {
    rank: '2–3',
    title: 'Race drivers',
    motivation: 'Core sporting assets. Confidence, status, promises, and exceptional star power can make one driver your immediate priority.',
    coverage: 'Live character profiles',
    jumpCondition: 'Jumps the queue when promises, confidence, contract leverage, or star influence threaten results.',
  },
  {
    rank: '4',
    title: 'Team and departments',
    motivation: 'Staff trust and department mood affect how reliably the organization delivers your plans.',
    coverage: 'Characters plus department systems',
    jumpCondition: 'Becomes urgent when delivery, morale, workload, or staff stability starts blocking the plan.',
  },
  {
    rank: '5',
    title: 'Commercial partners and supporters',
    motivation: 'Sponsors, commercial goals, and fan expectations shape resources and public standing without demanding constant interaction.',
    coverage: 'Collective team systems',
    jumpCondition: 'Moves up when sponsor confidence, renewals, failed objectives, or public support threaten resources.',
  },
  {
    rank: '6',
    title: 'Other team owners',
    motivation: 'Your reputation with potential future employers matters most when your position or ambition changes.',
    coverage: 'Live career-market standing',
    jumpCondition: 'Only becomes active when firm offers, accepted moves, or career leverage are in play.',
  },
  {
    rank: '7',
    title: 'Rival principals',
    motivation: 'Respect, alliances, protests, and paddock identity matter—but only active tension should outrank an internal relationship.',
    coverage: 'Live profiles and rival matrix',
    jumpCondition: 'Moves up when disputes, political pressure, protests, or active rival tension affect your agenda.',
  },
  {
    rank: '8',
    title: 'External talent',
    motivation: 'Other drivers and staff become priorities when scouting, recruiting, or entering contract negotiations.',
    coverage: 'Live recruitment context',
    jumpCondition: 'Only demands attention during vacancies, scouting pushes, approaches, or pending signings.',
  },
];

export type RelationshipPrioritySummary = {
  mustActNow: number;
  watchClosely: number;
  stable: number;
  total: number;
};

export function relationshipPrioritySummary(
  profiles: RelationshipAttentionProfile[],
): RelationshipPrioritySummary {
  return profiles.reduce<RelationshipPrioritySummary>((summary, profile) => {
    if (profile.status === 'MustActNow') summary.mustActNow += 1;
    else if (profile.status === 'WatchClosely') summary.watchClosely += 1;
    else summary.stable += 1;
    summary.total += 1;
    return summary;
  }, { mustActNow: 0, watchClosely: 0, stable: 0, total: 0 });
}

const INTERNAL_TYPES = new Set<CharacterInteractionTargetType>(['Owner', 'Driver', 'Staff']);

export function visibleRelationshipPriorities(
  profiles: RelationshipAttentionProfile[],
  limit = 8,
): RelationshipAttentionProfile[] {
  // Full-size priority cards are reserved for relationships that need attention.
  // Stable internal relationships are exposed separately as compact anchors.
  return profiles.filter((profile) => profile.status !== 'Stable').slice(0, limit);
}

export function stableInternalRelationships(
  profiles: RelationshipAttentionProfile[],
): RelationshipAttentionProfile[] {
  return profiles.filter((profile) =>
    profile.status === 'Stable' && INTERNAL_TYPES.has(profile.target.type));
}

const STATUS_WEIGHT: Record<RelationshipAttentionStatus, number> = {
  MustActNow: 0,
  WatchClosely: 1,
  Stable: 2,
};

type HierarchySignal = {
  status: RelationshipAttentionStatus;
  reason: string;
};

function strongestStatus(signals: HierarchySignal[]): RelationshipAttentionStatus {
  return signals
    .map((signal) => signal.status)
    .sort((a, b) => STATUS_WEIGHT[a] - STATUS_WEIGHT[b])[0] ?? 'Stable';
}

function firstActiveReason(signals: HierarchySignal[], fallback: string): string {
  return signals
    .filter((signal) => signal.status !== 'Stable')
    .sort((a, b) => STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status])[0]?.reason
    ?? fallback;
}

function characterSignals(
  profiles: RelationshipAttentionProfile[],
  predicate: (profile: RelationshipAttentionProfile) => boolean,
): HierarchySignal[] {
  return profiles.filter(predicate).map((profile) => ({
    status: profile.status,
    reason: `${profile.target.name}: ${profile.reasons[0]}`,
  }));
}

function collectiveSignals(
  profiles: CollectiveStakeholderProfile[],
  authorityRank: CollectiveStakeholderProfile['authorityRank'],
): HierarchySignal[] {
  return profiles.filter((profile) => profile.authorityRank === authorityRank).map((profile) => ({
    status: profile.status,
    reason: `${profile.title}: ${profile.reasons[0]}`,
  }));
}

export function relationshipHierarchyDashboard(
  profiles: RelationshipAttentionProfile[],
  collectiveProfiles: CollectiveStakeholderProfile[],
  employerStanding: PotentialEmployerStanding | undefined,
  externalTalent: ExternalTalentContext,
): RelationshipHierarchyDashboardRow[] {
  const signalsByRank: Record<string, HierarchySignal[]> = {
    '1': characterSignals(profiles, (profile) => profile.target.type === 'Owner'),
    '2–3': characterSignals(profiles, (profile) => profile.target.type === 'Driver'),
    '4': [
      ...characterSignals(profiles, (profile) => profile.target.type === 'Staff'),
      ...collectiveSignals(collectiveProfiles, 4),
    ],
    '5': collectiveSignals(collectiveProfiles, 5),
    '6': employerStanding ? [{ status: employerStanding.status, reason: employerStanding.reasons[0] }] : [],
    '7': characterSignals(profiles, (profile) => profile.target.type === 'RivalPrincipal'),
    '8': [
      ...characterSignals(profiles, (profile) => profile.target.type === 'StaffCandidate'),
      { status: externalTalent.status, reason: externalTalent.reasons[0] },
    ],
  };

  return RELATIONSHIP_HIERARCHY.map((row) => {
    const signals = signalsByRank[row.rank] ?? [];
    const status = strongestStatus(signals);
    const stableCount = signals.filter((signal) => signal.status === 'Stable').length;
    const activeCount = signals.length - stableCount;
    return {
      ...row,
      status,
      activeCount,
      stableCount,
      totalCount: signals.length,
      signal: firstActiveReason(signals, activeCount === 0 && signals.length > 0
        ? 'No active pressure in this tier.'
        : 'No live relationship source is currently active in this tier.'),
    };
  });
}

export function relationshipStatusLabel(status: RelationshipAttentionStatus): string {
  if (status === 'MustActNow') return 'Must act now';
  if (status === 'WatchClosely') return 'Watch closely';
  return 'Stable';
}

export function relationshipActionWindowLabel(window: RelationshipActionWindow): string {
  if (window === 'Immediate') return 'Act before advancing';
  if (window === 'NextRound') return 'Handle next round';
  if (window === 'Soon') return 'Plan within 2–3 rounds';
  return 'Background rhythm';
}

export function relationshipActionWindowDetail(window: RelationshipActionWindow): string {
  if (window === 'Immediate') return 'A decision, deadline, or crisis is already active.';
  if (window === 'NextRound') return 'Pressure is close enough that waiting risks escalation.';
  if (window === 'Soon') return 'Schedule attention soon, but do not let it override true emergencies.';
  return 'No active intervention needed unless strategy changes.';
}

export function relationshipTargetLabel(type: CharacterInteractionTargetType): string {
  if (type === 'RivalPrincipal') return 'Rival principal';
  if (type === 'StaffCandidate') return 'External candidate';
  return type;
}
