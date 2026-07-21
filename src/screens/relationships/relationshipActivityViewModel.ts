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
  style: {
    label: string;
    detail: string;
  };
  detail: string;
  stakes: {
    priority: string;
    riskIfIgnored: string;
    payoffIfHandled: string;
  };
  recommendedAction: {
    label: string;
    destination: string;
    route: string;
    rationale: string;
  };
};

function relationshipFollowUpStyle(
  item: Pick<RelationshipActivityItem, 'targetType' | 'tone' | 'effects' | 'source'> & { targetName?: string },
  cadence: RelationshipActivityFollowUp['cadence'],
): RelationshipActivityFollowUp['style'] {
  if (cadence === 'Background') {
    return {
      label: 'Maintenance',
      detail: 'Keep the outcome visible without forcing another management action.',
    };
  }
  if (item.targetType === 'Owner') {
    return cadence === 'Immediate'
      ? {
        label: 'Damage control',
        detail: 'Repair authority, patience, and board confidence before pressure escalates.',
      }
      : {
        label: 'Reassurance',
        detail: 'Bank confidence while keeping ownership aligned with the next visible result.',
      };
  }
  if (item.targetType === 'Driver') {
    const commitmentRelated = item.source === 'Commitment' || /promise|commitment|contract/i.test(item.effects.join(' '));
    return commitmentRelated
      ? {
        label: 'Negotiation',
        detail: 'Convert driver fallout into a clear sporting, promise, or contract compromise.',
      }
      : {
        label: 'Reassurance',
        detail: 'Stabilize confidence, morale, and race focus before the next flashpoint.',
      };
  }
  if (item.targetType === 'Staff' || item.targetType === 'Department') {
    return {
      label: 'Operational relief',
      detail: 'Translate the reaction into workload, trust, morale, or delivery follow-through.',
    };
  }
  if (item.targetType === 'Collective') {
    return item.targetName === 'Commercial partners & supporters'
      ? {
        label: 'Commercial reassurance',
        detail: 'Keep sponsor and fan confidence aligned without outranking sporting authority.',
      }
      : {
        label: 'Operational relief',
        detail: 'Turn committee pressure into practical workload, trust, or morale stabilization.',
      };
  }
  if (item.targetType === 'RivalPrincipal') {
    return {
      label: 'Political posture',
      detail: 'Choose whether to cool tension, hold neutral ground, or lean into rivalry.',
    };
  }
  if (item.targetType === 'StaffCandidate') {
    return cadence === 'Immediate' || cadence === 'NextRound'
      ? {
        label: 'Recruiting urgency',
        detail: 'Protect a live market opportunity before momentum or availability drops.',
      }
      : {
        label: 'Recruiting momentum',
        detail: 'Keep the external channel warm without overvaluing it above core relationships.',
      };
  }
  return {
    label: 'Relationship review',
    detail: 'Read the signal against hierarchy before committing more management attention.',
  };
}

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

function relationshipFollowUpStakes(
  targetType: RelationshipActivityItem['targetType'],
  cadence: RelationshipActivityFollowUp['cadence'],
): RelationshipActivityFollowUp['stakes'] {
  const urgency = cadence === 'Immediate'
    ? 'Act before the next race weekend'
    : cadence === 'NextRound'
      ? 'Review in the next management window'
      : cadence === 'Monitor'
        ? 'Track without forcing a new intervention'
        : 'Keep for context only';

  if (targetType === 'Owner') {
    return {
      priority: `${urgency} · hierarchy #1`,
      riskIfIgnored: 'Owner patience can slide into job-security pressure even when other relationships look healthy.',
      payoffIfHandled: 'A clean owner update buys time, budget confidence, and political cover for the next performance swing.',
    };
  }
  if (targetType === 'Driver') {
    return {
      priority: `${urgency} · hierarchy #2–3`,
      riskIfIgnored: 'Driver trust can leak into confidence, promise pressure, contract leverage, and race-week focus.',
      payoffIfHandled: 'A targeted check-in keeps confidence usable and makes promises or team orders feel explainable.',
    };
  }
  if (targetType === 'Staff' || targetType === 'Department') {
    return {
      priority: `${urgency} · hierarchy #4`,
      riskIfIgnored: 'Staff and department frustration can become workload drag, morale loss, or slower delivery.',
      payoffIfHandled: 'Clarifying priorities protects execution without turning every department signal into a crisis.',
    };
  }
  if (targetType === 'Collective') {
    return {
      priority: `${urgency} · hierarchy #4–5`,
      riskIfIgnored: 'Committee pressure can spread into operations, commercial confidence, or fan/sponsor expectations.',
      payoffIfHandled: 'A measured response keeps the wider organisation aligned while preserving the owner/driver hierarchy.',
    };
  }
  if (targetType === 'RivalPrincipal') {
    return {
      priority: `${urgency} · hierarchy #7`,
      riskIfIgnored: 'Paddock friction can harden into protest risk, political isolation, or avoidable escalation.',
      payoffIfHandled: 'A deliberate posture lets the player choose respect, neutrality, or villain energy with visible tradeoffs.',
    };
  }
  if (targetType === 'StaffCandidate') {
    return {
      priority: `${urgency} · hierarchy #8`,
      riskIfIgnored: 'Recruiting momentum can cool if a live candidate, vacancy, or shortlist is left unattended.',
      payoffIfHandled: 'A timely follow-up protects market leverage without making external talent more important than the core team.',
    };
  }
  return {
    priority: urgency,
    riskIfIgnored: 'The signal can become noise if it is not read against the current hierarchy.',
    payoffIfHandled: 'The player can respond proportionally instead of over-managing every relationship movement.',
  };
}

export function relationshipActivityFollowUp(
  item: Pick<RelationshipActivityItem, 'targetType' | 'tone' | 'opinionDelta' | 'effects' | 'source'> & { targetName?: string },
): RelationshipActivityFollowUp {
  const effectText = item.effects.join(' ');
  const hasSevereNegative = item.tone === 'Negative' || (item.opinionDelta ?? 0) <= -3;
  const hasPositive = item.tone === 'Positive' || (item.opinionDelta ?? 0) > 0 || /\+\d/.test(effectText);

  if (hasSevereNegative) {
    if (item.targetType === 'Owner') {
      return {
        cadence: 'Immediate',
        label: 'Repair before next race',
        style: relationshipFollowUpStyle(item, 'Immediate'),
        detail: 'Owner confidence damage can become job-security pressure if it is left unaddressed.',
        stakes: relationshipFollowUpStakes(item.targetType, 'Immediate'),
        recommendedAction: recommendedRelationshipAction(item.targetType, 'Immediate'),
      };
    }
    if (item.targetType === 'Driver') {
      return {
        cadence: 'Immediate',
        label: 'Recheck driver mood',
        style: relationshipFollowUpStyle(item, 'Immediate'),
        detail: 'Driver trust or morale fallout should be reviewed before it reaches performance or contract leverage.',
        stakes: relationshipFollowUpStakes(item.targetType, 'Immediate'),
        recommendedAction: recommendedRelationshipAction(item.targetType, 'Immediate'),
      };
    }
    if (item.targetType === 'Department' || item.targetType === 'Collective') {
      return {
        cadence: 'NextRound',
        label: 'Review department impact',
        style: relationshipFollowUpStyle(item, 'NextRound'),
        detail: 'Committee trust or workload damage should be checked next round before it becomes productivity loss.',
        stakes: relationshipFollowUpStakes(item.targetType, 'NextRound'),
        recommendedAction: recommendedRelationshipAction(item.targetType, 'NextRound'),
      };
    }
    return {
      cadence: 'NextRound',
      label: 'Control the fallout',
      style: relationshipFollowUpStyle(item, 'NextRound'),
      detail: 'Negative relationship movement should be monitored before it becomes a wider political or market problem.',
      stakes: relationshipFollowUpStakes(item.targetType, 'NextRound'),
      recommendedAction: recommendedRelationshipAction(item.targetType, 'NextRound'),
    };
  }

  if (item.tone === 'Mixed') {
    return {
      cadence: 'NextRound',
      label: 'Watch for second-order effects',
      style: relationshipFollowUpStyle(item, 'NextRound'),
      detail: 'Mixed reactions can still become useful if the next communication matches the character or committee agenda.',
      stakes: relationshipFollowUpStakes(item.targetType, 'NextRound'),
      recommendedAction: recommendedRelationshipAction(item.targetType, 'NextRound'),
    };
  }

  if (hasPositive) {
    if (item.targetType === 'Owner') {
      return {
        cadence: 'Monitor',
        label: 'Bank the confidence',
        style: relationshipFollowUpStyle(item, 'Monitor'),
        detail: 'This buys patience, but ownership will still judge the next visible result or financial signal.',
        stakes: relationshipFollowUpStakes(item.targetType, 'Monitor'),
        recommendedAction: recommendedRelationshipAction(item.targetType, 'Monitor'),
      };
    }
    if (item.targetType === 'Driver') {
      return {
        cadence: 'Monitor',
        label: 'Convert trust into performance',
        style: relationshipFollowUpStyle(item, 'Monitor'),
        detail: 'Positive driver movement should be protected through race-week focus and promise discipline.',
        stakes: relationshipFollowUpStakes(item.targetType, 'Monitor'),
        recommendedAction: recommendedRelationshipAction(item.targetType, 'Monitor'),
      };
    }
    if (item.targetType === 'Department' || item.targetType === 'Collective') {
      return {
        cadence: 'Monitor',
        label: 'Let the operating gain settle',
        style: relationshipFollowUpStyle(item, 'Monitor'),
        detail: 'The benefit should be allowed to show in morale, trust, workload, or commercial confidence before another intervention.',
        stakes: relationshipFollowUpStakes(item.targetType, 'Monitor'),
        recommendedAction: recommendedRelationshipAction(item.targetType, 'Monitor'),
      };
    }
    return {
      cadence: 'Monitor',
      label: 'Keep the channel warm',
      style: relationshipFollowUpStyle(item, 'Monitor'),
      detail: 'The relationship has moved in the right direction; avoid over-managing unless a new pressure appears.',
      stakes: relationshipFollowUpStakes(item.targetType, 'Monitor'),
      recommendedAction: recommendedRelationshipAction(item.targetType, 'Monitor'),
    };
  }

  if (item.source === 'AdvisorCouncil') {
    return {
      cadence: 'Monitor',
      label: 'Track advisor trust',
      style: relationshipFollowUpStyle(item, 'Monitor'),
      detail: 'No direct opinion swing was recorded, but the advice history still shapes future department confidence.',
      stakes: relationshipFollowUpStakes(item.targetType, 'Monitor'),
      recommendedAction: recommendedRelationshipAction(item.targetType, 'Monitor'),
    };
  }

  return {
    cadence: 'Background',
    label: 'No follow-up needed',
    style: relationshipFollowUpStyle(item, 'Background'),
    detail: 'This is recorded for context and does not require a dedicated management action.',
    stakes: relationshipFollowUpStakes(item.targetType, 'Background'),
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

function advisorTrustEffectRead(departmentId: string | undefined, trustChange: number): string {
  const department = departmentId ?? 'Department';
  if (trustChange >= 3) return `${department} trust may firm up`;
  if (trustChange > 0) return `${department} confidence may steady`;
  if (trustChange <= -3) return `${department} trust may need rebuilding`;
  if (trustChange < 0) return `${department} confidence may cool`;
  return `${department} reaction looks neutral`;
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
      targetName: memory.targetName,
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
      : [advisorTrustEffectRead(recommendation.departmentId, trustChange)];
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
        targetName: recommendation.advisorName ?? recommendation.advisorRole,
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
        targetName,
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
