import type { GameState } from '../../game/careerState';
import type { RelationshipAttentionStatus } from '../../sim/relationshipAttentionEngine';
import type { DepartmentId, DepartmentMood } from '../../types/phase18Types';
import {
  departmentPreparationMultiplierFromMoods,
  signedRelationshipEffectPercent,
} from '../../sim/relationshipGameplayEffectEngine';
import { sponsorRenewalProbability } from '../../sim/commercialEngine';

export type CollectiveStakeholderKind = 'Departments' | 'Commercial';

export type CollectiveStakeholderMetric = {
  label: string;
  value: string;
};

export type CollectiveStakeholderProfile = {
  id: CollectiveStakeholderKind;
  title: string;
  authorityRank: 4 | 5;
  authorityLabel: string;
  status: RelationshipAttentionStatus;
  health: number;
  reasons: string[];
  metrics: CollectiveStakeholderMetric[];
  gameplayEffect: {
    label: string;
    value: string;
    detail: string;
  };
  actionLabel: string;
};

const STATUS_ORDER: Record<RelationshipAttentionStatus, number> = {
  MustActNow: 0,
  WatchClosely: 1,
  Stable: 2,
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function departmentLabel(id: DepartmentId): string {
  return id.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function departmentConcern(mood: DepartmentMood): 0 | 1 | 2 {
  if (mood.morale <= 20 || mood.trustInPrincipal <= 20 || mood.strategicAlignment <= 20 || mood.workload >= 90) return 2;
  if (mood.morale <= 40 || mood.trustInPrincipal <= 40 || mood.strategicAlignment <= 40 || mood.workload >= 75 || mood.conflictReasons.length > 0) return 1;
  return 0;
}

function departmentReason(mood: DepartmentMood): string {
  const signals: string[] = [];
  if (mood.trustInPrincipal <= 40) signals.push(`trust ${mood.trustInPrincipal}`);
  if (mood.morale <= 40) signals.push(`morale ${mood.morale}`);
  if (mood.strategicAlignment <= 40) signals.push(`alignment ${mood.strategicAlignment}`);
  if (mood.workload >= 75) signals.push(`workload ${mood.workload}`);
  if (signals.length === 0 && mood.conflictReasons.length > 0) signals.push(mood.conflictReasons.at(-1)!);
  return `${departmentLabel(mood.departmentId)}: ${signals.join(', ')}.`;
}

export function departmentStakeholderProfile(
  departments: Record<DepartmentId, DepartmentMood> | undefined,
): CollectiveStakeholderProfile | undefined {
  const moods = Object.values(departments ?? {});
  if (moods.length === 0) return undefined;

  const trust = average(moods.map((mood) => mood.trustInPrincipal));
  const morale = average(moods.map((mood) => mood.morale));
  const alignment = average(moods.map((mood) => mood.strategicAlignment));
  const averageWorkload = average(moods.map((mood) => mood.workload));
  const peakWorkload = Math.max(...moods.map((mood) => mood.workload));
  const health = clamp(average([trust, morale, alignment, 100 - averageWorkload]));
  const concerns = moods
    .map((mood) => ({ mood, concern: departmentConcern(mood) }))
    .filter((entry) => entry.concern > 0)
    .sort((a, b) => b.concern - a.concern
      || Math.min(a.mood.trustInPrincipal, a.mood.morale, a.mood.strategicAlignment)
        - Math.min(b.mood.trustInPrincipal, b.mood.morale, b.mood.strategicAlignment));
  const status: RelationshipAttentionStatus = concerns.some((entry) => entry.concern === 2)
    ? 'MustActNow'
    : concerns.length > 0 ? 'WatchClosely' : 'Stable';
  const reasons = concerns.length > 0
    ? concerns.slice(0, 3).map((entry) => departmentReason(entry.mood))
    : [`All ${moods.length} department committees are aligned; average trust ${trust} and morale ${morale}.`];

  return {
    id: 'Departments',
    title: 'Team & departments',
    authorityRank: 4,
    authorityLabel: 'Internal committees — deliver your sporting and operational plans',
    status,
    health,
    reasons,
    metrics: [
      { label: 'Trust', value: `${trust}` },
      { label: 'Morale', value: `${morale}` },
      { label: 'Alignment', value: `${alignment}` },
      { label: 'Peak workload', value: `${peakWorkload}` },
    ],
    gameplayEffect: {
      label: 'Race preparation execution',
      value: signedRelationshipEffectPercent(departmentPreparationMultiplierFromMoods(departments)),
      detail: 'A small modifier from Technical, Engineering, Race Operations, and Driver Management trust, morale, alignment, and overload.',
    },
    actionLabel: 'Review staff & departments',
  };
}

export function commercialStakeholderProfile(
  state: Pick<GameState, 'commercial' | 'teamOrgRatings' | 'selectedTeamId'>,
): CollectiveStakeholderProfile | undefined {
  const commercial = state.commercial;
  const organization = state.teamOrgRatings?.[state.selectedTeamId];
  if (!commercial && !organization) return undefined;

  const sponsors = commercial?.sponsors ?? [];
  const confidence = sponsors.length > 0 ? average(sponsors.map((sponsor) => sponsor.confidence)) : 0;
  const lowestSponsor = sponsors.slice().sort((a, b) => a.confidence - b.confidence)[0];
  const reputation = commercial?.commercialReputation ?? organization?.sponsorAppeal ?? 50;
  const fanSupport = organization?.fanSupport ?? 50;
  const failedObjectives = sponsors.flatMap((sponsor) => sponsor.objectives)
    .filter((objective) => objective.status === 'Failed').length;
  const renewalOutlook = sponsors.length > 0
    ? Math.round((sponsors.reduce((sum, sponsor) => sum + sponsorRenewalProbability(sponsor), 0) / sponsors.length) * 100)
    : 0;
  const health = clamp(average([
    sponsors.length > 0 ? confidence : 35,
    reputation,
    fanSupport,
  ]));
  const mustAct = sponsors.length > 0
    && (confidence <= 25 || (lowestSponsor?.confidence ?? 100) <= 15);
  const watch = sponsors.length === 0
    || confidence <= 45
    || (lowestSponsor?.confidence ?? 100) <= 30
    || reputation <= 40
    || failedObjectives > 0;
  const status: RelationshipAttentionStatus = mustAct
    ? 'MustActNow'
    : watch ? 'WatchClosely' : 'Stable';
  const reasons: string[] = [];

  if (sponsors.length === 0) reasons.push('No active sponsor relationships are supporting the team.');
  else if (confidence <= 45) reasons.push(`Average sponsor confidence is ${confidence}/100.`);
  if (lowestSponsor && lowestSponsor.confidence <= 30) reasons.push(`${lowestSponsor.name} confidence is ${lowestSponsor.confidence}/100.`);
  if (reputation <= 40) reasons.push(`Commercial reputation is ${reputation}/100, limiting partner confidence and future offers.`);
  if (failedObjectives > 0) reasons.push(`${failedObjectives} sponsor objective${failedObjectives === 1 ? ' has' : 's have'} failed.`);
  if (reasons.length === 0) reasons.push('Sponsor confidence and commercial standing are stable; supporters do not require direct intervention.');

  return {
    id: 'Commercial',
    title: 'Commercial partners & supporters',
    authorityRank: 5,
    authorityLabel: 'Collective stakeholders — protect resources and public standing',
    status,
    health,
    reasons: reasons.slice(0, 3),
    metrics: [
      { label: 'Sponsors', value: `${sponsors.length}` },
      { label: 'Confidence', value: sponsors.length > 0 ? `${confidence}` : '—' },
      { label: 'Reputation', value: `${reputation}` },
      { label: 'Fan support', value: `${fanSupport}` },
    ],
    gameplayEffect: {
      label: 'Average renewal outlook',
      value: sponsors.length > 0 ? `${renewalOutlook}%` : 'No active deal',
      detail: 'Sponsor confidence directly affects each expiring partner’s renewal probability at season rollover.',
    },
    actionLabel: 'Review sponsors & commercial',
  };
}

export function currentCollectiveStakeholders(
  state: Pick<GameState, 'phase18' | 'commercial' | 'teamOrgRatings' | 'selectedTeamId'>,
): CollectiveStakeholderProfile[] {
  const profiles = [
    departmentStakeholderProfile(state.phase18?.departmentMoods[state.selectedTeamId]),
    commercialStakeholderProfile(state),
  ].filter((profile): profile is CollectiveStakeholderProfile => !!profile);

  return profiles.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    || a.authorityRank - b.authorityRank);
}

export function collectiveStakeholderAttentionCount(profiles: CollectiveStakeholderProfile[]): {
  mustActNow: number;
  watchClosely: number;
} {
  return {
    mustActNow: profiles.filter((profile) => profile.status === 'MustActNow').length,
    watchClosely: profiles.filter((profile) => profile.status === 'WatchClosely').length,
  };
}
