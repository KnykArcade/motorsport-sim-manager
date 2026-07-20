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
      constraint: 'Rivals can still move first if negotiations stall.',
    },
  };
}
