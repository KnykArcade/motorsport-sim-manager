import type { CharacterInteractionTargetType } from '../../types/characterInteractionTypes';
import type {
  RelationshipActionWindow,
  RelationshipAttentionProfile,
  RelationshipAttentionStatus,
} from '../../sim/relationshipAttentionEngine';

export type RelationshipHierarchyRow = {
  rank: string;
  title: string;
  motivation: string;
  coverage: string;
};

export const RELATIONSHIP_HIERARCHY: RelationshipHierarchyRow[] = [
  {
    rank: '1',
    title: 'Owner',
    motivation: 'Controls your position. Results matter, but alignment with the owner’s personality and expectations can buy or cost time.',
    coverage: 'Live character profile',
  },
  {
    rank: '2–3',
    title: 'Race drivers',
    motivation: 'Core sporting assets. Confidence, status, promises, and exceptional star power can make one driver your immediate priority.',
    coverage: 'Live character profiles',
  },
  {
    rank: '4',
    title: 'Team and departments',
    motivation: 'Staff trust and department mood affect how reliably the organization delivers your plans.',
    coverage: 'Characters plus department systems',
  },
  {
    rank: '5',
    title: 'Commercial partners and supporters',
    motivation: 'Sponsors, commercial goals, and fan expectations shape resources and public standing without demanding constant interaction.',
    coverage: 'Collective team systems',
  },
  {
    rank: '6',
    title: 'Other team owners',
    motivation: 'Your reputation with potential future employers matters most when your position or ambition changes.',
    coverage: 'Live career-market standing',
  },
  {
    rank: '7',
    title: 'Rival principals',
    motivation: 'Respect, alliances, protests, and paddock identity matter—but only active tension should outrank an internal relationship.',
    coverage: 'Live profiles and rival matrix',
  },
  {
    rank: '8',
    title: 'External talent',
    motivation: 'Other drivers and staff become priorities when scouting, recruiting, or entering contract negotiations.',
    coverage: 'Live recruitment context',
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
