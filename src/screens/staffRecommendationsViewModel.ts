import { getStaffPool } from '../data';
import type { GameState } from '../game/careerState';
import { staffEmployer } from '../sim/aiStaffRosterEngine';
import { staffExtensionSigningFee, staffRatingOutOfTen } from '../sim/staffEngine';
import type { StaffMember, StaffRole } from '../types/staffTypes';

export type StaffRecommendationKind = 'recruitment' | 'contract';
export type StaffRecommendationConfidence = 'Low' | 'Normal' | 'High';

export type StaffRecommendation = {
  id: string;
  kind: StaffRecommendationKind;
  responsibility: 'staff-recruitment' | 'staff-contracts';
  owner: string;
  target: string;
  role: StaffRole;
  rating: number;
  confidence: StaffRecommendationConfidence;
  recommendation: string;
  whyItMatters: string;
  expectedBenefit: string;
  consequence: string;
  route: string;
  routeLabel: string;
};

function confidenceFor(rating: number): StaffRecommendationConfidence {
  const normalized = staffRatingOutOfTen(rating);
  return normalized < 5 ? 'Low' : normalized >= 8 ? 'High' : 'Normal';
}

function confidenceReason(confidence: StaffRecommendationConfidence): string {
  return confidence === 'High'
    ? 'Strong specialist rating makes this a high-confidence recommendation.'
    : confidence === 'Normal'
      ? 'The specialist is a solid fit, but review the details before committing.'
      : 'The specialist is below the normal quality threshold; compare alternatives before acting.';
}

function availableCandidates(state: GameState, role: StaffRole): StaffMember[] {
  const hired = new Set((state.staff ?? []).map((member) => member.id));
  return getStaffPool(state.seasonYear, state.series)
    .filter((member) => member.role === role && !hired.has(member.id) && !staffEmployer(state.aiStaff, member.id))
    .sort((a, b) => b.rating - a.rating);
}

function recruitmentRecommendations(state: GameState): StaffRecommendation[] {
  if (state.staffResponsibilityPolicies?.['staff-recruitment'] !== 'staff_advisory') return [];
  const hiredRoles = new Set((state.staff ?? []).map((member) => member.role));
  const recommendations: StaffRecommendation[] = [];
  for (const role of ['Technical Director', 'Race Engineer', 'Pit Crew Chief', 'Strategist'] as StaffRole[]) {
    if (hiredRoles.has(role)) continue;
    const candidate = availableCandidates(state, role)[0];
    if (!candidate) continue;
    const confidence = confidenceFor(candidate.rating);
    recommendations.push({
      id: `staff-recruitment-${role.toLowerCase().replaceAll(' ', '-')}`,
      kind: 'recruitment',
      responsibility: 'staff-recruitment',
      owner: 'People operations desk',
      target: `${candidate.name} · ${staffRatingOutOfTen(candidate.rating).toFixed(1)}/10`,
      role,
      rating: staffRatingOutOfTen(candidate.rating),
      confidence,
      recommendation: `Review ${candidate.name} as the leading ${role} candidate.`,
      whyItMatters: `The ${role} vacancy leaves this part of the operation without a named owner.`,
      expectedBenefit: `Hiring would add the existing ${role} gameplay effect to the team.`,
      consequence: `${confidenceReason(confidence)} Hiring and the offer remain your decision.`,
      route: `/staff?tab=market&role=${encodeURIComponent(role)}&staffId=${encodeURIComponent(candidate.id)}`,
      routeLabel: 'Review Candidate',
    });
  }
  return recommendations;
}

function contractRecommendations(state: GameState): StaffRecommendation[] {
  if (state.staffResponsibilityPolicies?.['staff-contracts'] !== 'staff_advisory') return [];
  const racesRemaining = Math.max(1, state.calendar.length - state.currentRaceIndex);
  return (state.staff ?? [])
    .filter((member) => (member.contractYearsRemaining ?? 99) <= 1)
    .sort((a, b) => staffRatingOutOfTen(b.rating) - staffRatingOutOfTen(a.rating))
    .map((member) => {
      const confidence = confidenceFor(member.rating);
      const fee = staffExtensionSigningFee(member, 1, racesRemaining, state.calendar.length);
      return {
        id: `staff-contract-${member.id}`,
        kind: 'contract',
        responsibility: 'staff-contracts',
        owner: 'People operations desk',
        target: `${member.name} · ${staffRatingOutOfTen(member.rating).toFixed(1)}/10`,
        role: member.role,
        rating: staffRatingOutOfTen(member.rating),
        confidence,
        recommendation: `Prioritize a renewal review for ${member.name}.`,
        whyItMatters: `${member.role} coverage could become a vacancy after this season.`,
        expectedBenefit: `A one-year extension currently starts around $${Math.round(fee / 1000)}k in signing cost before any offer adjustment.`,
        consequence: `${confidenceReason(confidence)} Renewal terms, release, and salary remain your decision.`,
        route: `/staff?tab=contracts&staffId=${encodeURIComponent(member.id)}`,
        routeLabel: 'Review Contract',
      };
    });
}

export function staffRecommendations(state: GameState): StaffRecommendation[] {
  return [...recruitmentRecommendations(state), ...contractRecommendations(state)];
}
