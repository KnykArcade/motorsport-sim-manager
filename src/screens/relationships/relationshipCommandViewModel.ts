import type {
  RelationshipAttentionProfile,
  RelationshipAttentionStatus,
} from '../../sim/relationshipAttentionEngine';
import type { PotentialEmployerStanding } from './relationshipEmployerViewModel';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import type { ExternalTalentContext } from './relationshipTalentViewModel';

export type RelationshipDeskSignal = {
  id: string;
  status: RelationshipAttentionStatus;
  rank: number;
  title: string;
  reason: string;
  influence: number;
};

export type RelationshipCommandSummary = {
  mustActNow: number;
  watchClosely: number;
  active: number;
  stable: number;
  total: number;
  topSignal?: RelationshipDeskSignal;
};

type RelationshipCommandInput = {
  characterProfiles: RelationshipAttentionProfile[];
  collectiveProfiles: CollectiveStakeholderProfile[];
  employerStanding?: PotentialEmployerStanding;
  externalTalent: ExternalTalentContext;
};

const ATTENTION_ORDER: Record<RelationshipAttentionStatus, number> = {
  MustActNow: 0,
  WatchClosely: 1,
  Stable: 2,
};

export function relationshipCommandSummary({
  characterProfiles,
  collectiveProfiles,
  employerStanding,
  externalTalent,
}: RelationshipCommandInput): RelationshipCommandSummary {
  const signals: RelationshipDeskSignal[] = [
    ...characterProfiles.map((profile) => ({
      id: `${profile.target.type}:${profile.target.id}`,
      status: profile.status,
      rank: profile.authorityRank,
      title: profile.target.name,
      reason: profile.reasons[0],
      influence: profile.influence,
    })),
    ...collectiveProfiles.map((profile) => ({
      id: `Collective:${profile.id}`,
      status: profile.status,
      rank: profile.authorityRank,
      title: profile.title,
      reason: profile.reasons[0],
      influence: profile.health,
    })),
    ...(employerStanding ? [{
      id: 'PotentialEmployers',
      status: employerStanding.status,
      rank: employerStanding.authorityRank,
      title: 'Potential employers',
      reason: employerStanding.reasons[0],
      influence: employerStanding.marketStanding,
    }] : []),
    {
      id: 'ExternalTalent',
      status: externalTalent.status,
      rank: externalTalent.authorityRank,
      title: 'External talent',
      reason: externalTalent.reasons[0],
      influence: externalTalent.targets.length,
    },
  ].sort((a, b) => ATTENTION_ORDER[a.status] - ATTENTION_ORDER[b.status]
    || a.rank - b.rank
    || b.influence - a.influence
    || a.title.localeCompare(b.title));

  const mustActNow = signals.filter((signal) => signal.status === 'MustActNow').length;
  const watchClosely = signals.filter((signal) => signal.status === 'WatchClosely').length;
  const stable = signals.filter((signal) => signal.status === 'Stable').length;

  return {
    mustActNow,
    watchClosely,
    active: mustActNow + watchClosely,
    stable,
    total: signals.length,
    topSignal: signals[0],
  };
}
