import type { RelationshipAttentionProfile } from '../../sim/relationshipAttentionEngine';
import type { PotentialEmployerStanding } from './relationshipEmployerViewModel';
import type { CollectiveStakeholderProfile } from './relationshipStakeholderViewModel';
import type { ExternalTalentContext } from './relationshipTalentViewModel';

type RelationshipPrioritySource = {
  authorityRank: number;
  authorityLabel: string;
};

export function relationshipRiskPriorityContext(source: RelationshipPrioritySource): string {
  return `Authority #${source.authorityRank} · ${source.authorityLabel}`;
}

export function characterRiskIfIgnored(profile: RelationshipAttentionProfile): string | undefined {
  if (profile.status === 'Stable') return undefined;
  const reasons = profile.reasons.join(' ').toLowerCase();

  if (profile.target.type === 'Owner') {
    return profile.status === 'MustActNow'
      ? 'Ownership confidence can cross the dismissal threshold even if on-track results remain defensible.'
      : 'Job security and owner patience can deteriorate until the relationship becomes a direct threat to your position.';
  }
  if (profile.target.type === 'Driver') {
    if (/promise|commitment|due now|deadline/.test(reasons)) {
      return 'A missed commitment can damage trust and morale, increase frustration, and make an exit more likely.';
    }
    if (/breaking point|wants to leave|testing alternatives/.test(reasons)) {
      return 'The driver may commit to leaving or mentally disengage before the team can repair the relationship.';
    }
    return 'Confidence, trust, and cooperation can fall, affecting performance and increasing contract or exit pressure.';
  }
  if (profile.target.type === 'Staff') {
    return 'Resistance can spread through the department, lowering alignment and making delivery less reliable.';
  }
  if (profile.target.type === 'RivalPrincipal') {
    return 'Paddock tension can escalate into disputes, lost political cooperation, or harder supplier and market negotiations.';
  }
  return 'Recruitment interest can cool and the candidate may become more expensive or unavailable.';
}

export function collectiveRiskIfIgnored(profile: CollectiveStakeholderProfile): string | undefined {
  if (profile.status === 'Stable') return undefined;
  if (profile.id === 'Departments') {
    return 'Low trust, morale, or alignment can reduce departmental productivity and make plans less reliable to deliver.';
  }
  return 'Sponsor confidence and public standing can fall, putting objectives, renewals, and future commercial value at risk.';
}

export function employerRiskIfIgnored(standing: PotentialEmployerStanding): string | undefined {
  if (standing.status === 'Stable') return undefined;
  return standing.opportunities.some((opportunity) => opportunity.accepted)
    ? 'Poor transition handling can damage your standing with both the current owner and the employer expecting you next season.'
    : 'Interest can cool or offers can lapse, reducing your leverage if the current job becomes unstable.';
}

export function externalTalentRiskIfIgnored(context: ExternalTalentContext): string | undefined {
  if (context.status === 'Stable') return undefined;
  if (context.openRaceSeats > 0) {
    return context.status === 'MustActNow'
      ? 'The team can reach the season start without a complete race lineup, forcing immediate recruitment action.'
      : 'Leaving the seat open narrows the next signing window and lets rivals secure preferred targets first.';
  }
  if (context.staffVacancies > 0) {
    return 'Department capacity remains below plan while suitable development opportunities may move elsewhere.';
  }
  return 'Scouting knowledge and recruitment interest can lose value if a rival secures the target first.';
}
