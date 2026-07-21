import type {
  RelationshipActionWindow,
  RelationshipAttentionProfile,
  RelationshipAttentionStatus,
} from '../../sim/relationshipAttentionEngine';
import type { PotentialEmployerStanding } from './relationshipEmployerViewModel';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import type { ExternalTalentContext } from './relationshipTalentViewModel';
import type { GameState } from '../../game/careerState';
import { currentRelationshipAttention } from '../../sim/relationshipAttentionEngine';
import { currentPotentialEmployerStanding } from './relationshipEmployerViewModel';
import { currentCollectiveStakeholders } from './relationshipStakeholderViewModel';
import { currentExternalTalentContext } from './relationshipTalentViewModel';

export type RelationshipDeskSignal = {
  id: string;
  status: RelationshipAttentionStatus;
  actionWindow: RelationshipActionWindow;
  rank: number;
  title: string;
  reason: string;
  influence: number;
  managementRead?: RelationshipManagementRead;
};

export type RelationshipManagementRead = {
  posture: string;
  read: string;
  caution: string;
  watch: string;
};

export type RelationshipCommandSummary = {
  mustActNow: number;
  watchClosely: number;
  active: number;
  stable: number;
  total: number;
  topSignal?: RelationshipDeskSignal;
};

export type RelationshipCommandSnapshot = {
  characterProfiles: RelationshipAttentionProfile[];
  collectiveProfiles: CollectiveStakeholderProfile[];
  employerStanding?: PotentialEmployerStanding;
  externalTalent: ExternalTalentContext;
  summary: RelationshipCommandSummary;
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

const snapshotCache = new WeakMap<GameState, RelationshipCommandSnapshot>();

function inferredActionWindow(
  status: RelationshipAttentionStatus,
  reasons: string[],
): RelationshipActionWindow {
  if (status === 'MustActNow') return 'Immediate';
  if (status === 'Stable') return 'Background';
  if (/due within 1 round|critical|must be filled before|firm offer/i.test(reasons.join(' '))) return 'NextRound';
  return 'Soon';
}

function relationshipManagementRead(signal: Omit<RelationshipDeskSignal, 'managementRead'>): RelationshipManagementRead {
  const urgentPrefix = signal.status === 'MustActNow' ? 'Likely needs visible attention now' : 'May reward a measured check-in';

  if (signal.id.startsWith('Owner:')) {
    return {
      posture: 'Protect the mandate',
      read: `${urgentPrefix}; ownership usually wants to see control before patience frays.`,
      caution: 'A heavy-handed response could still unsettle drivers or staff if it looks purely political.',
      watch: 'Owner confidence, board patience, and whether the next result changes the room.',
    };
  }
  if (signal.id.startsWith('Driver:')) {
    return {
      posture: 'Reassure the driver',
      read: `${urgentPrefix}; a clear message may steady confidence without promising too much.`,
      caution: 'Too much favoritism can create noise with the other side of the garage.',
      watch: 'Driver trust, promise pressure, and any signs the teammate dynamic is heating up.',
    };
  }
  if (signal.id.startsWith('Staff:') || signal.id === 'Collective:Departments') {
    return {
      posture: 'Ease operational pressure',
      read: `${urgentPrefix}; the group may respond better to relief and clarity than a grand speech.`,
      caution: 'Pushing harder could work short term, but it may store up fatigue or resentment.',
      watch: 'Department workload, staff trust, and whether small issues start repeating.',
    };
  }
  if (signal.id.startsWith('RivalPrincipal:')) {
    return {
      posture: 'Manage the politics',
      read: `${urgentPrefix}; a careful public stance may cool the paddock narrative.`,
      caution: 'Escalating the tone could make the rivalry useful, or turn it into a distraction.',
      watch: 'Media temperature, rival reactions, and whether sponsors enjoy or dislike the noise.',
    };
  }
  if (signal.id === 'Collective:Commercial') {
    return {
      posture: 'Reassure commercial partners',
      read: `${urgentPrefix}; sponsors tend to value a calm plan more than exact guarantees.`,
      caution: 'Over-selling the response may backfire if the next race weekend is messy.',
      watch: 'Sponsor confidence, supporter patience, and how results shape the story.',
    };
  }
  if (signal.id === 'PotentialEmployers') {
    return {
      posture: 'Keep career leverage alive',
      read: `${urgentPrefix}; the market may stay warmer if you look composed and selective.`,
      caution: 'Chasing every rumor could make the current team question your focus.',
      watch: 'Firm offers, owner mood, and whether rival interest keeps building.',
    };
  }
  if (signal.id === 'ExternalTalent') {
    return {
      posture: 'Read the market',
      read: `${urgentPrefix}; early movement may keep options open before the market tightens.`,
      caution: 'Moving too early can commit resources before the right target is clear.',
      watch: 'Open seats, staff vacancies, and whether preferred targets start disappearing.',
    };
  }

  return {
    posture: 'Take the temperature',
    read: `${urgentPrefix}; this relationship looks worth checking before it becomes louder.`,
    caution: 'The signal may be noise, but ignoring it could let the mood drift.',
    watch: 'Tone, timing, and whether the same concern appears again next round.',
  };
}

export function relationshipCommandSummary({
  characterProfiles,
  collectiveProfiles,
  employerStanding,
  externalTalent,
}: RelationshipCommandInput): RelationshipCommandSummary {
  const signals = [
    ...characterProfiles.map((profile) => ({
      id: `${profile.target.type}:${profile.target.id}`,
      status: profile.status,
      actionWindow: profile.actionWindow,
      rank: profile.authorityRank,
      title: profile.target.name,
      reason: profile.reasons[0],
      influence: profile.influence,
    })),
    ...collectiveProfiles.map((profile) => ({
      id: `Collective:${profile.id}`,
      status: profile.status,
      actionWindow: inferredActionWindow(profile.status, profile.reasons),
      rank: profile.authorityRank,
      title: profile.title,
      reason: profile.reasons[0],
      influence: profile.health,
    })),
    ...(employerStanding ? [{
      id: 'PotentialEmployers',
      status: employerStanding.status,
      actionWindow: inferredActionWindow(employerStanding.status, employerStanding.reasons),
      rank: employerStanding.authorityRank,
      title: 'Potential employers',
      reason: employerStanding.reasons[0],
      influence: employerStanding.marketStanding,
    }] : []),
    {
      id: 'ExternalTalent',
      status: externalTalent.status,
      actionWindow: inferredActionWindow(externalTalent.status, externalTalent.reasons),
      rank: externalTalent.authorityRank,
      title: 'External talent',
      reason: externalTalent.reasons[0],
      influence: externalTalent.targets.length,
    },
  ].map((signal) => ({
    ...signal,
    managementRead: relationshipManagementRead(signal),
  })).sort((a, b) => ATTENTION_ORDER[a.status] - ATTENTION_ORDER[b.status]
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

export function currentRelationshipCommandSnapshot(state: GameState): RelationshipCommandSnapshot {
  const cached = snapshotCache.get(state);
  if (cached) return cached;
  const characterProfiles = currentRelationshipAttention(state);
  const collectiveProfiles = currentCollectiveStakeholders(state);
  const employerStanding = currentPotentialEmployerStanding(state);
  const externalTalent = currentExternalTalentContext(state);
  const snapshot = {
    characterProfiles,
    collectiveProfiles,
    employerStanding,
    externalTalent,
    summary: relationshipCommandSummary({
      characterProfiles,
      collectiveProfiles,
      employerStanding,
      externalTalent,
    }),
  };
  snapshotCache.set(state, snapshot);
  return snapshot;
}
