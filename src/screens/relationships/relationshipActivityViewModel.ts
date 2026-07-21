import type { GameState } from '../../game/careerState';
import type {
  CharacterInteractionTargetType,
  CharacterMemory,
} from '../../types/characterInteractionTypes';
import type { AdvisorRecommendation, CollectiveStakeholderActionRecord } from '../../types/phase18Types';

export type RelationshipActivityTone = CharacterMemory['tone'];

export type RelationshipActivityItem = {
  id: string;
  seasonYear: number;
  round: number;
  targetName: string;
  targetType: CharacterInteractionTargetType | 'Department' | 'Collective';
  hierarchyRank: string;
  hierarchyLabel: string;
  source: CharacterMemory['source'] | 'AdvisorCouncil' | 'CommitteeAction';
  title: string;
  detail: string;
  tone: RelationshipActivityTone;
  effects: string[];
  opinionDelta?: number;
  followUp: RelationshipActivityFollowUp;
};

export type RelationshipActivitySummary = {
  total: number;
  positive: number;
  negative: number;
  mixed: number;
  informational: number;
  immediateFollowUps: number;
  nextRoundFollowUps: number;
  activeFollowUps: number;
  netOpinionDelta: number;
  latest?: RelationshipActivityItem;
};

export type RelationshipActivityFollowUp = {
  cadence: 'Immediate' | 'NextRound' | 'Monitor' | 'Background';
  label: string;
  detail: string;
  recommendedAction: {
    label: string;
    destination: string;
    route: string;
    rationale: string;
  };
};

function recommendedRelationshipAction(
  targetType: RelationshipActivityItem['targetType'],
  cadence: RelationshipActivityFollowUp['cadence'],
): RelationshipActivityFollowUp['recommendedAction'] {
  if (targetType === 'Owner') {
    return {
      label: cadence === 'Immediate' ? 'Open owner review' : 'Prepare owner update',
      destination: 'Team / owner screen',
      route: '/teams',
      rationale: 'Owner confidence is the highest authority relationship and can become job-security pressure.',
    };
  }
  if (targetType === 'Driver') {
    return {
      label: cadence === 'Immediate' ? 'Open driver relationship file' : 'Schedule driver check-in',
      destination: 'Driver relationship file',
      route: '/relationships',
      rationale: 'Driver fallout can affect confidence, promises, contract leverage, and race-week focus.',
    };
  }
  if (targetType === 'Staff' || targetType === 'Department') {
    return {
      label: cadence === 'Immediate' ? 'Stabilize staff pressure' : 'Review staff/department signals',
      destination: 'Staff & departments',
      route: '/staff',
      rationale: 'Staff and department reactions should be translated into workload, trust, morale, or delivery follow-through.',
    };
  }
  if (targetType === 'Collective') {
    return {
      label: cadence === 'Immediate' ? 'Stabilize committee pressure' : 'Review department/commercial signals',
      destination: 'Stakeholder board',
      route: '/relationships',
      rationale: 'Committee reactions should be translated into workload, trust, morale, or commercial follow-through.',
    };
  }
  if (targetType === 'RivalPrincipal') {
    return {
      label: 'Review paddock posture',
      destination: 'Rival matrix',
      route: '/rivals',
      rationale: 'Rival tension matters when it creates protest risk, political pressure, or escalation.',
    };
  }
  if (targetType === 'StaffCandidate') {
    return {
      label: 'Advance recruitment context',
      destination: 'Market / staff screen',
      route: '/market',
      rationale: 'External relationships matter when scouting, approaches, vacancies, or negotiations are live.',
    };
  }
  return {
    label: 'Review relationship context',
    destination: 'Relationship command center',
    route: '/relationships',
    rationale: 'Use the hierarchy and current signal before committing another management action.',
  };
}

export function relationshipActivityFollowUp(
  item: Pick<RelationshipActivityItem, 'targetType' | 'tone' | 'opinionDelta' | 'effects' | 'source'>,
): RelationshipActivityFollowUp {
  const effectText = item.effects.join(' ');
  const hasSevereNegative = item.tone === 'Negative' || (item.opinionDelta ?? 0) <= -3;
  const hasPositive = item.tone === 'Positive' || (item.opinionDelta ?? 0) > 0 || /\+\d/.test(effectText);

  if (hasSevereNegative) {
    if (item.targetType === 'Owner') {
      return {
        cadence: 'Immediate',
        label: 'Repair before next race',
        detail: 'Owner confidence damage can become job-security pressure if it is left unaddressed.',
        recommendedAction: recommendedRelationshipAction(item.targetType, 'Immediate'),
      };
    }
    if (item.targetType === 'Driver') {
      return {
        cadence: 'Immediate',
        label: 'Recheck driver mood',
        detail: 'Driver trust or morale fallout should be reviewed before it reaches performance or contract leverage.',
        recommendedAction: recommendedRelationshipAction(item.targetType, 'Immediate'),
      };
    }
    if (item.targetType === 'Department' || item.targetType === 'Collective') {
      return {
        cadence: 'NextRound',
        label: 'Review department impact',
        detail: 'Committee trust or workload damage should be checked next round before it becomes productivity loss.',
        recommendedAction: recommendedRelationshipAction(item.targetType, 'NextRound'),
      };
    }
    return {
      cadence: 'NextRound',
      label: 'Control the fallout',
      detail: 'Negative relationship movement should be monitored before it becomes a wider political or market problem.',
      recommendedAction: recommendedRelationshipAction(item.targetType, 'NextRound'),
    };
  }

  if (item.tone === 'Mixed') {
    return {
      cadence: 'NextRound',
      label: 'Watch for second-order effects',
      detail: 'Mixed reactions can still become useful if the next communication matches the character or committee agenda.',
      recommendedAction: recommendedRelationshipAction(item.targetType, 'NextRound'),
    };
  }

  if (hasPositive) {
    if (item.targetType === 'Owner') {
      return {
        cadence: 'Monitor',
        label: 'Bank the confidence',
        detail: 'This buys patience, but ownership will still judge the next visible result or financial signal.',
        recommendedAction: recommendedRelationshipAction(item.targetType, 'Monitor'),
      };
    }
    if (item.targetType === 'Driver') {
      return {
        cadence: 'Monitor',
        label: 'Convert trust into performance',
        detail: 'Positive driver movement should be protected through race-week focus and promise discipline.',
        recommendedAction: recommendedRelationshipAction(item.targetType, 'Monitor'),
      };
    }
    if (item.targetType === 'Department' || item.targetType === 'Collective') {
      return {
        cadence: 'Monitor',
        label: 'Let the operating gain settle',
        detail: 'The benefit should be allowed to show in morale, trust, workload, or commercial confidence before another intervention.',
        recommendedAction: recommendedRelationshipAction(item.targetType, 'Monitor'),
      };
    }
    return {
      cadence: 'Monitor',
      label: 'Keep the channel warm',
      detail: 'The relationship has moved in the right direction; avoid over-managing unless a new pressure appears.',
      recommendedAction: recommendedRelationshipAction(item.targetType, 'Monitor'),
    };
  }

  if (item.source === 'AdvisorCouncil') {
    return {
      cadence: 'Monitor',
      label: 'Track advisor trust',
      detail: 'No direct opinion swing was recorded, but the advice history still shapes future department confidence.',
      recommendedAction: recommendedRelationshipAction(item.targetType, 'Monitor'),
    };
  }

  return {
    cadence: 'Background',
    label: 'No follow-up needed',
    detail: 'This is recorded for context and does not require a dedicated management action.',
    recommendedAction: recommendedRelationshipAction(item.targetType, 'Background'),
  };
}

export function relationshipActivityHierarchy(
  targetType: RelationshipActivityItem['targetType'],
  targetName?: string,
): Pick<RelationshipActivityItem, 'hierarchyRank' | 'hierarchyLabel'> {
  if (targetType === 'Owner') return { hierarchyRank: '1', hierarchyLabel: 'Owner relationship' };
  if (targetType === 'Driver') return { hierarchyRank: '2–3', hierarchyLabel: 'Driver relationship' };
  if (targetType === 'Staff' || targetType === 'Department') return { hierarchyRank: '4', hierarchyLabel: 'Team & department relationship' };
  if (targetType === 'Collective') {
    return targetName === 'Commercial partners & supporters'
      ? { hierarchyRank: '5', hierarchyLabel: 'Commercial relationship' }
      : { hierarchyRank: '4', hierarchyLabel: 'Team & department relationship' };
  }
  if (targetType === 'RivalPrincipal') return { hierarchyRank: '7', hierarchyLabel: 'Rival principal relationship' };
  if (targetType === 'StaffCandidate') return { hierarchyRank: '8', hierarchyLabel: 'External talent relationship' };
  return { hierarchyRank: '4', hierarchyLabel: 'Team relationship' };
}

export function relationshipActivitySummary(
  activity: RelationshipActivityItem[],
): RelationshipActivitySummary {
  return activity.reduce<RelationshipActivitySummary>((summary, item, index) => {
    summary.total += 1;
    summary[item.tone === 'Positive'
      ? 'positive'
      : item.tone === 'Negative'
        ? 'negative'
        : item.tone === 'Mixed'
          ? 'mixed'
          : 'informational'] += 1;
    if (item.followUp.cadence === 'Immediate') summary.immediateFollowUps += 1;
    if (item.followUp.cadence === 'NextRound') summary.nextRoundFollowUps += 1;
    if (item.followUp.cadence === 'Immediate' || item.followUp.cadence === 'NextRound') summary.activeFollowUps += 1;
    summary.netOpinionDelta += item.opinionDelta ?? 0;
    if (index === 0) summary.latest = item;
    return summary;
  }, {
    total: 0,
    positive: 0,
    negative: 0,
    mixed: 0,
    informational: 0,
    immediateFollowUps: 0,
    nextRoundFollowUps: 0,
    activeFollowUps: 0,
    netOpinionDelta: 0,
  });
}

export function relationshipFollowUpAgenda(
  activity: RelationshipActivityItem[],
  limit = 3,
): RelationshipActivityItem[] {
  const cadenceOrder: Record<RelationshipActivityFollowUp['cadence'], number> = {
    Immediate: 0,
    NextRound: 1,
    Monitor: 2,
    Background: 3,
  };
  return activity
    .filter((item) => item.followUp.cadence === 'Immediate' || item.followUp.cadence === 'NextRound')
    .sort((a, b) =>
      cadenceOrder[a.followUp.cadence] - cadenceOrder[b.followUp.cadence]
        || b.seasonYear - a.seasonYear
        || b.round - a.round
        || b.id.localeCompare(a.id))
    .slice(0, limit);
}

export function relationshipActivityFromSources(
  memories: CharacterMemory[],
  recommendations: AdvisorRecommendation[],
  collectiveActions: CollectiveStakeholderActionRecord[],
  selectedTeamId: string,
): RelationshipActivityItem[] {
  const items = new Map<string, RelationshipActivityItem>();

  for (const memory of memories) {
    const hierarchy = relationshipActivityHierarchy(memory.targetType, memory.targetName);
    const activity = {
      targetType: memory.targetType,
      tone: memory.tone,
      opinionDelta: memory.opinionDelta,
      effects: memory.effects,
      source: memory.source,
    };
    items.set(`memory:${memory.id}`, {
      id: `memory:${memory.id}`,
      seasonYear: memory.seasonYear,
      round: memory.round,
      targetName: memory.targetName,
      targetType: memory.targetType,
      ...hierarchy,
      source: memory.source,
      title: memory.label,
      detail: memory.description,
      tone: memory.tone,
      effects: memory.effects,
      opinionDelta: memory.opinionDelta,
      followUp: relationshipActivityFollowUp(activity),
    });
  }

  for (const recommendation of recommendations) {
    if (recommendation.teamId !== selectedTeamId) continue;
    if (recommendation.status !== 'Accepted' && recommendation.status !== 'Overruled') continue;
    const trustChange = recommendation.trustChange ?? 0;
    const hierarchy = relationshipActivityHierarchy('Department');
    const tone = trustChange > 0 ? 'Positive' : trustChange < 0 ? 'Negative' : 'Informational';
    const effects = recommendation.trustChange == null
      ? []
      : [`${recommendation.departmentId ?? 'Department'} trust ${trustChange > 0 ? '+' : ''}${trustChange}`];
    items.set(`advisor:${recommendation.id}`, {
      id: `advisor:${recommendation.id}`,
      seasonYear: recommendation.createdSeasonYear,
      round: recommendation.createdRound ?? 0,
      targetName: recommendation.advisorName ?? recommendation.advisorRole,
      targetType: 'Department',
      ...hierarchy,
      source: 'AdvisorCouncil',
      title: recommendation.status === 'Accepted'
        ? `Advice followed: ${recommendation.recommendation}`
        : `Advice overruled: ${recommendation.recommendation}`,
      detail: recommendation.resolutionNote ?? recommendation.rationale,
      tone,
      effects,
      followUp: relationshipActivityFollowUp({
        targetType: 'Department',
        tone,
        effects,
        source: 'AdvisorCouncil',
      }),
    });
  }

  for (const action of collectiveActions) {
    const targetName = action.stakeholderId === 'Departments' ? 'Team & departments' : 'Commercial partners & supporters';
    const hierarchy = relationshipActivityHierarchy('Collective', targetName);
    const tone = 'Positive';
    items.set(`collective:${action.id}`, {
      id: `collective:${action.id}`,
      seasonYear: action.seasonYear,
      round: action.round,
      targetName,
      targetType: 'Collective',
      ...hierarchy,
      source: 'CommitteeAction',
      title: action.label,
      detail: action.outcome,
      tone,
      effects: action.effects,
      followUp: relationshipActivityFollowUp({
        targetType: 'Collective',
        tone,
        effects: action.effects,
        source: 'CommitteeAction',
      }),
    });
  }

  return [...items.values()].sort((a, b) =>
    b.seasonYear - a.seasonYear
      || b.round - a.round
      || b.id.localeCompare(a.id));
}

export function currentRelationshipActivity(
  state: Pick<GameState, 'selectedTeamId' | 'characterInteractions' | 'phase18'>,
): RelationshipActivityItem[] {
  return relationshipActivityFromSources(
    state.characterInteractions?.memories ?? [],
    state.phase18?.advisorRecommendations ?? [],
    state.phase18?.collectiveStakeholderActions ?? [],
    state.selectedTeamId,
  );
}
