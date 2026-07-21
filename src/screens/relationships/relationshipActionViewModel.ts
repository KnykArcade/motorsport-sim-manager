import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import type { PotentialEmployerStanding } from './relationshipEmployerViewModel';
import type { ExternalTalentContext } from './relationshipTalentViewModel';

export type RelationshipManagementMove = {
  title: string;
  priorityLabel: string;
  rationale: string;
  expectedEffect: string;
  preview: {
    target: string;
    expectedChange: string;
    relationshipEffect: string;
    tradeoff: string;
    bestUse: string;
    constraint: string;
  };
};

function stableMove(title: string, expectedEffect: string, target = 'Stable relationship'): RelationshipManagementMove {
  return {
    title,
    priorityLabel: 'Background cadence',
    rationale: 'No active relationship problem needs immediate intervention.',
    expectedEffect,
    preview: {
      target,
      expectedChange: 'Maintenance only; prevents avoidable relationship noise.',
      relationshipEffect: 'No immediate swing; protects current trust and cadence.',
      tradeoff: 'Spends attention without creating a major new benefit.',
      bestUse: 'Use when the relationship is stable but important enough to keep visible.',
      constraint: 'No urgent action required.',
    },
  };
}

function activeMovePriority(status: 'MustActNow' | 'WatchClosely'): string {
  return status === 'MustActNow' ? 'Immediate action' : 'Next management window';
}

export function characterManagementMove(profile: RelationshipAttentionProfile): RelationshipManagementMove {
  const reason = profile.reasons[0] ?? 'This relationship is active.';
  if (profile.status === 'Stable') {
    return stableMove('Maintain rhythm', 'Keeps the relationship from becoming weekly management noise.', profile.target.name);
  }

  if (profile.target.type === 'Owner') {
    return {
      title: profile.status === 'MustActNow' ? 'Hold an owner review before the next race' : 'Prepare an owner confidence update',
      priorityLabel: activeMovePriority(profile.status),
      rationale: reason,
      expectedEffect: 'Protects job security, patience, and budget confidence.',
      preview: {
        target: profile.target.name,
        expectedChange: 'Owner confidence and patience pressure should stabilize.',
        relationshipEffect: 'Owner patience protected; job-security pressure should stop worsening.',
        tradeoff: 'May require a conservative promise, budget explanation, or less aggressive public stance.',
        bestUse: 'Use when owner confidence is slipping, patience is low, or results need political cover.',
        constraint: 'Does not replace the need for on-track results.',
      },
    };
  }
  if (profile.target.type === 'Driver') {
    const promiseRelated = /promise|commitment|due/i.test(profile.reasons.join(' '));
    return {
      title: promiseRelated ? 'Resolve the driver commitment' : 'Open the driver relationship file',
      priorityLabel: activeMovePriority(profile.status),
      rationale: reason,
      expectedEffect: promiseRelated
        ? 'Protects morale, trust in principal, and contract leverage.'
        : 'Protects confidence, retention risk, and race-week focus.',
      preview: {
        target: profile.target.name,
        expectedChange: promiseRelated
          ? 'Trust/morale fallout from the commitment is reduced.'
          : 'Confidence and retention pressure should stabilize.',
        relationshipEffect: promiseRelated
          ? 'Trust in principal and morale are protected from promise fallout.'
          : 'Confidence, morale, and retention posture should become easier to manage.',
        tradeoff: promiseRelated
          ? 'May force a sporting compromise, team-order restraint, or development fairness concession.'
          : 'Can create favoritism perception if the teammate reads the attention as unequal treatment.',
        bestUse: promiseRelated
          ? 'Use when a promise, clause, or visible commitment is close to becoming a breach.'
          : 'Use when driver confidence is fragile before a race, negotiation, or teammate flashpoint.',
        constraint: 'Driver personality and performance context still matter.',
      },
    };
  }
  if (profile.target.type === 'Staff') {
    return {
      title: 'Stabilize the staff relationship',
      priorityLabel: activeMovePriority(profile.status),
      rationale: reason,
      expectedEffect: 'Protects department morale, delivery trust, and future staff retention.',
      preview: {
        target: profile.target.name,
        expectedChange: 'Staff trust and department alignment pressure should ease.',
        relationshipEffect: 'Staff trust, morale, and operational alignment should stabilize.',
        tradeoff: 'Can cost budget, management attention, or create workload pressure elsewhere.',
        bestUse: 'Use when a key staff member or department signal is dragging execution.',
        constraint: 'Does not alter car development priorities directly.',
      },
    };
  }
  if (profile.target.type === 'RivalPrincipal') {
    return {
      title: 'Choose a paddock posture',
      priorityLabel: activeMovePriority(profile.status),
      rationale: reason,
      expectedEffect: 'Protects protest risk, political alignment, and rival escalation control.',
      preview: {
        target: profile.target.name,
        expectedChange: 'Escalation risk and paddock friction should be easier to control.',
        relationshipEffect: 'Rival tension, protest risk, or political isolation should become clearer to manage.',
        tradeoff: 'A conciliatory move may reduce villain leverage; an aggressive posture may invite retaliation.',
        bestUse: 'Use when you need to choose respect, neutrality, or paddock villain positioning deliberately.',
        constraint: 'A hostile stance can still be a valid strategic choice.',
      },
    };
  }
  return {
    title: 'Convert interest into a recruiting step',
    priorityLabel: activeMovePriority(profile.status),
    rationale: reason,
    expectedEffect: 'Protects shortlist momentum and signing leverage.',
    preview: {
      target: profile.target.name,
      expectedChange: 'Recruiting interest should stay warm.',
      relationshipEffect: 'Candidate interest and shortlist momentum should remain alive.',
      tradeoff: 'Can distract from current-team relationships if pursued too visibly.',
      bestUse: 'Use when a live target, vacancy, or negotiation window is starting to cool.',
      constraint: 'No signing is guaranteed until contract terms are resolved.',
    },
  };
}

export function collectiveManagementMove(profile: CollectiveStakeholderProfile): RelationshipManagementMove {
  if (profile.status === 'Stable') {
    return stableMove('Keep the operating cadence', 'Protects steady delivery without adding committee micromanagement.', profile.title);
  }
  if (profile.id === 'Departments') {
    return {
      title: profile.status === 'MustActNow' ? 'Rebalance department workload now' : 'Review department trust signals',
      priorityLabel: activeMovePriority(profile.status),
      rationale: profile.reasons[0] ?? 'Department alignment is under pressure.',
      expectedEffect: 'Protects productivity, upgrade delivery, and staff confidence.',
      preview: {
        target: profile.title,
        expectedChange: 'Workload, trust, or alignment pressure should improve.',
        relationshipEffect: 'Department trust, morale, or workload pressure should stabilize.',
        tradeoff: 'Usually costs budget, attention, or prioritization flexibility.',
        bestUse: 'Use when departments are overloaded or delivery confidence is deteriorating.',
        constraint: 'Committee action availability and budget still apply.',
      },
    };
  }
  return {
    title: profile.status === 'MustActNow' ? 'Address sponsor confidence now' : 'Review commercial expectations',
    priorityLabel: activeMovePriority(profile.status),
    rationale: profile.reasons[0] ?? 'Commercial confidence is under pressure.',
    expectedEffect: 'Protects sponsorship income, fan support, and future partner offers.',
    preview: {
      target: profile.title,
      expectedChange: 'Sponsor confidence, fan support, or commercial reputation should improve.',
      relationshipEffect: 'Sponsor confidence, fan patience, and commercial alignment should stabilize.',
      tradeoff: 'May require conservative messaging, budget focus, or objectives that compete with sporting purity.',
      bestUse: 'Use when commercial pressure is visible but should not outrank owner/driver fires.',
      constraint: 'Cannot fully offset missed objectives or poor results.',
    },
  };
}

export function employerManagementMove(standing: PotentialEmployerStanding): RelationshipManagementMove {
  if (standing.status === 'Stable') {
    return stableMove('Keep career leverage in the background', 'Keeps rival owners visible without distracting from current-team authority.', 'Potential employers');
  }
  return {
    title: standing.firmOffers > 0 ? 'Review active job offer leverage' : 'Monitor rival-owner interest',
    priorityLabel: activeMovePriority(standing.status),
    rationale: standing.reasons[0] ?? 'A rival owner is monitoring your standing.',
    expectedEffect: 'Protects career options without treating other owners as current-team bosses.',
    preview: {
      target: 'Potential employers',
      expectedChange: 'Market leverage and offer credibility should be protected.',
      relationshipEffect: 'Rival-owner interest and career leverage should stay credible.',
      tradeoff: 'Pushing too hard can look disloyal if current-team authority relationships are fragile.',
      bestUse: 'Use when an offer, rumor, or expiring deal creates a real career-market decision.',
      constraint: 'Current owner relationship remains the higher authority.',
    },
  };
}

export function externalTalentManagementMove(context: ExternalTalentContext): RelationshipManagementMove {
  if (context.status === 'Stable') {
    return stableMove('Keep scouting context warm', 'Keeps external talent low priority until a seat, vacancy, or target becomes active.', 'External talent');
  }
  if (context.openRaceSeats > 0) {
    return {
      title: context.status === 'MustActNow' ? 'Fill the open race seat' : 'Shortlist race-seat candidates',
      priorityLabel: activeMovePriority(context.status),
      rationale: context.reasons[0] ?? 'A race seat needs attention.',
      expectedEffect: 'Protects lineup completeness and preseason readiness.',
      preview: {
        target: 'Open race seat',
        expectedChange: 'Lineup completeness and negotiation urgency should improve.',
        relationshipEffect: 'Candidate interest and seat-filling confidence should stabilize.',
        tradeoff: 'May require budget, role promises, or commitment before the ideal market option appears.',
        bestUse: 'Use when an open race seat creates immediate credibility or preseason readiness risk.',
        constraint: 'Candidate availability and contract demands still apply.',
      },
    };
  }
  if (context.staffVacancies > 0) {
    return {
      title: 'Prioritize specialist hiring',
      priorityLabel: activeMovePriority(context.status),
      rationale: context.reasons[0] ?? 'A specialist role is vacant.',
      expectedEffect: 'Protects staff coverage and department execution.',
      preview: {
        target: 'Specialist vacancy',
        expectedChange: 'Operational coverage pressure should ease.',
        relationshipEffect: 'Staff-market momentum and department confidence should stabilize.',
        tradeoff: 'May consume budget or settle for a specialist who is available rather than ideal.',
        bestUse: 'Use when a staff vacancy is visibly hurting operations or department trust.',
        constraint: 'Hiring still depends on available staff and budget.',
      },
    };
  }
  return {
    title: 'Advance the live recruiting target',
    priorityLabel: activeMovePriority(context.status),
    rationale: context.reasons[0] ?? 'A recruiting target is active.',
    expectedEffect: 'Protects market timing and negotiation leverage.',
    preview: {
      target: 'Live recruiting target',
      expectedChange: 'Shortlist momentum and target interest should stay warm.',
      relationshipEffect: 'Target interest and negotiation leverage should remain active.',
      tradeoff: 'Can alert rivals or create internal noise if the current lineup/staff sees the move.',
      bestUse: 'Use when a live target needs contact before rival teams move first.',
      constraint: 'Rivals can still move first if negotiations stall.',
    },
  };
}
