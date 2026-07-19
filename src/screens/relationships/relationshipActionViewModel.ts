import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import type { PotentialEmployerStanding } from './relationshipEmployerViewModel';
import type { ExternalTalentContext } from './relationshipTalentViewModel';

export type RelationshipManagementMove = {
  title: string;
  rationale: string;
  expectedEffect: string;
};

function stableMove(title: string, expectedEffect: string): RelationshipManagementMove {
  return {
    title,
    rationale: 'No active relationship problem needs immediate intervention.',
    expectedEffect,
  };
}

export function characterManagementMove(profile: RelationshipAttentionProfile): RelationshipManagementMove {
  const reason = profile.reasons[0] ?? 'This relationship is active.';
  if (profile.status === 'Stable') {
    return stableMove('Maintain rhythm', 'Keeps the relationship from becoming weekly management noise.');
  }

  if (profile.target.type === 'Owner') {
    return {
      title: profile.status === 'MustActNow' ? 'Hold an owner review before the next race' : 'Prepare an owner confidence update',
      rationale: reason,
      expectedEffect: 'Protects job security, patience, and budget confidence.',
    };
  }
  if (profile.target.type === 'Driver') {
    const promiseRelated = /promise|commitment|due/i.test(profile.reasons.join(' '));
    return {
      title: promiseRelated ? 'Resolve the driver commitment' : 'Open the driver relationship file',
      rationale: reason,
      expectedEffect: promiseRelated
        ? 'Protects morale, trust in principal, and contract leverage.'
        : 'Protects confidence, retention risk, and race-week focus.',
    };
  }
  if (profile.target.type === 'Staff') {
    return {
      title: 'Stabilize the staff relationship',
      rationale: reason,
      expectedEffect: 'Protects department morale, delivery trust, and future staff retention.',
    };
  }
  if (profile.target.type === 'RivalPrincipal') {
    return {
      title: 'Choose a paddock posture',
      rationale: reason,
      expectedEffect: 'Protects protest risk, political alignment, and rival escalation control.',
    };
  }
  return {
    title: 'Convert interest into a recruiting step',
    rationale: reason,
    expectedEffect: 'Protects shortlist momentum and signing leverage.',
  };
}

export function collectiveManagementMove(profile: CollectiveStakeholderProfile): RelationshipManagementMove {
  if (profile.status === 'Stable') {
    return stableMove('Keep the operating cadence', 'Protects steady delivery without adding committee micromanagement.');
  }
  if (profile.id === 'Departments') {
    return {
      title: profile.status === 'MustActNow' ? 'Rebalance department workload now' : 'Review department trust signals',
      rationale: profile.reasons[0] ?? 'Department alignment is under pressure.',
      expectedEffect: 'Protects productivity, upgrade delivery, and staff confidence.',
    };
  }
  return {
    title: profile.status === 'MustActNow' ? 'Address sponsor confidence now' : 'Review commercial expectations',
    rationale: profile.reasons[0] ?? 'Commercial confidence is under pressure.',
    expectedEffect: 'Protects sponsorship income, fan support, and future partner offers.',
  };
}

export function employerManagementMove(standing: PotentialEmployerStanding): RelationshipManagementMove {
  if (standing.status === 'Stable') {
    return stableMove('Keep career leverage in the background', 'Keeps rival owners visible without distracting from current-team authority.');
  }
  return {
    title: standing.firmOffers > 0 ? 'Review active job offer leverage' : 'Monitor rival-owner interest',
    rationale: standing.reasons[0] ?? 'A rival owner is monitoring your standing.',
    expectedEffect: 'Protects career options without treating other owners as current-team bosses.',
  };
}

export function externalTalentManagementMove(context: ExternalTalentContext): RelationshipManagementMove {
  if (context.status === 'Stable') {
    return stableMove('Keep scouting context warm', 'Keeps external talent low priority until a seat, vacancy, or target becomes active.');
  }
  if (context.openRaceSeats > 0) {
    return {
      title: context.status === 'MustActNow' ? 'Fill the open race seat' : 'Shortlist race-seat candidates',
      rationale: context.reasons[0] ?? 'A race seat needs attention.',
      expectedEffect: 'Protects lineup completeness and preseason readiness.',
    };
  }
  if (context.staffVacancies > 0) {
    return {
      title: 'Prioritize specialist hiring',
      rationale: context.reasons[0] ?? 'A specialist role is vacant.',
      expectedEffect: 'Protects staff coverage and department execution.',
    };
  }
  return {
    title: 'Advance the live recruiting target',
    rationale: context.reasons[0] ?? 'A recruiting target is active.',
    expectedEffect: 'Protects market timing and negotiation leverage.',
  };
}
