import { staffByRole, staffRatingOutOfTen } from '../sim/staffEngine';
import type { GameState } from '../game/careerState';
import type {
  StaffResponsibilityId,
  StaffResponsibilityPolicy,
  StaffRole,
} from '../types/staffTypes';

export type StaffResponsibilityConfidence = 'Low' | 'Normal' | 'High';

export type StaffResponsibility = {
  id: StaffResponsibilityId;
  area: string;
  role: StaffRole;
  owner: string;
  status: string;
  effect: string;
  detail: string;
  rating: number;
  confidence: number;
  confidenceLabel: StaffResponsibilityConfidence;
  confidenceReason: string;
  policy: StaffResponsibilityPolicy;
  policyLabel: string;
  policyDetail: string;
  staffCanDo: readonly string[];
  approvalBoundary: readonly string[];
  route: string;
  routeLabel: string;
};

export type StaffResponsibilityPolicyOption = {
  id: StaffResponsibilityPolicy;
  label: string;
  detail: string;
};

export const STAFF_RESPONSIBILITY_POLICY_OPTIONS: readonly StaffResponsibilityPolicyOption[] = [
  {
    id: 'player',
    label: 'You Handle',
    detail: 'Every task reaches you and no work is completed without your action.',
  },
  {
    id: 'staff_advisory',
    label: 'Staff Advises',
    detail: 'Staff adds recommendations and confidence, but you still complete the work.',
  },
  {
    id: 'staff_prepare_player_approval',
    label: 'Staff Prepares, You Approve',
    detail: 'Staff prepares routine work and presents the proposed outcome for your approval.',
  },
  {
    id: 'staff_execute_routine',
    label: 'Staff Handles Routine Work',
    detail: 'Confident routine work is handled automatically; protected decisions still reach you.',
  },
] as const;

type ResponsibilityDefinition = {
  id: StaffResponsibilityId;
  area: string;
  role: StaffRole;
  effect: string;
  staffCanDo: readonly string[];
  approvalBoundary: readonly string[];
};

const RESPONSIBILITY_DEFINITIONS: readonly ResponsibilityDefinition[] = [
  {
    id: 'technical',
    area: 'Technical programme',
    role: 'Technical Director',
    effect: 'Coordinates development evidence, component risk, and technical recommendations.',
    staffCanDo: ['Prepare technical proposals', 'Triage component warnings', 'Summarize development capacity'],
    approvalBoundary: ['Major spending', 'Starting or rushing projects', 'Engine and facility commitments'],
  },
  {
    id: 'race-engineering',
    area: 'Race engineering',
    role: 'Race Engineer',
    effect: 'Prepares the weekend from practice knowledge, weather, and driver feedback.',
    staffCanDo: ['Prepare weekend recommendations', 'Prioritize knowledge gaps', 'Summarize setup evidence'],
    approvalBoundary: ['Final setup confirmation', 'Qualifying plan', 'Driver promises and relationship choices'],
  },
  {
    id: 'pit-operations',
    area: 'Pit operations',
    role: 'Pit Crew Chief',
    effect: 'Owns routine pit readiness, execution evidence, and operational warnings.',
    staffCanDo: ['Review pit readiness', 'Summarize execution risk', 'Prepare routine operating guidance'],
    approvalBoundary: ['Major spending', 'High-risk operational changes', 'Consequential live-race calls'],
  },
  {
    id: 'race-strategy',
    area: 'Race strategy',
    role: 'Strategist',
    effect: 'Turns forecast, tyre, fuel, and race-state evidence into strategy advice.',
    staffCanDo: ['Prepare strategy options', 'Explain expected trade-offs', 'Flag low-confidence assumptions'],
    approvalBoundary: ['Final race plan', 'Team orders', 'Consequential live-race overrides'],
  },
  {
    id: 'staff-recruitment',
    area: 'Staff recruitment',
    role: 'Technical Director',
    effect: 'Organizes staff-market intelligence and routine candidate monitoring.',
    staffCanDo: ['Maintain candidate watchlists', 'Monitor scouting coverage', 'Prepare recruitment comparisons'],
    approvalBoundary: ['Hiring or releasing staff', 'Contract offers', 'Material signing costs'],
  },
  {
    id: 'staff-contracts',
    area: 'Staff contracts',
    role: 'Technical Director',
    effect: 'Tracks staff contract timing and prepares renewal information.',
    staffCanDo: ['Track expiry dates', 'Prepare renewal context', 'Flag continuity risks'],
    approvalBoundary: ['Every contract offer', 'Every release decision', 'All compensation and signing costs'],
  },
  {
    id: 'driver-development',
    area: 'Driver development',
    role: 'Race Engineer',
    effect: 'Organizes development evidence and routine progress reporting.',
    staffCanDo: ['Prepare progress reports', 'Recommend development focus', 'Flag readiness or regression'],
    approvalBoundary: ['Seat and promotion decisions', 'Driver contracts', 'Promises and relationship choices'],
  },
] as const;

const POLICY_LABELS = Object.fromEntries(
  STAFF_RESPONSIBILITY_POLICY_OPTIONS.map((option) => [option.id, option.label]),
) as Record<StaffResponsibilityPolicy, string>;

const POLICY_DETAILS = Object.fromEntries(
  STAFF_RESPONSIBILITY_POLICY_OPTIONS.map((option) => [option.id, option.detail]),
) as Record<StaffResponsibilityPolicy, string>;

export function staffResponsibilityPolicy(
  state: Pick<GameState, 'staffResponsibilityPolicies'>,
  responsibility: StaffResponsibilityId,
): StaffResponsibilityPolicy {
  return state.staffResponsibilityPolicies?.[responsibility] ?? 'player';
}

export function staffResponsibilityConfidence(rating: number): {
  value: number;
  label: StaffResponsibilityConfidence;
} {
  const value = Math.round(Math.max(0, Math.min(100, 50 + rating / 2)));
  return {
    value,
    label: value >= 85 ? 'High' : value >= 65 ? 'Normal' : 'Low',
  };
}

export function staffResponsibilities(state: GameState): StaffResponsibility[] {
  const owners = staffByRole(state.staff ?? []);
  return RESPONSIBILITY_DEFINITIONS.map((definition) => {
    const member = owners[definition.role];
    const rating = departmentRating(member?.rating);
    const confidence = staffResponsibilityConfidence(rating);
    const policy = staffResponsibilityPolicy(state, definition.id);
    return {
      ...definition,
      owner: member?.name ?? `${definition.role} department`,
      status: `Level ${Math.max(1, Math.ceil(rating / 10))} · ${rating}/100`,
      detail: member
        ? `${member.name}'s current ability determines how much routine work can safely stay delegated.`
        : 'Permanent department rating determines how much routine work can safely stay delegated.',
      rating,
      confidence: confidence.value,
      confidenceLabel: confidence.label,
      confidenceReason: confidence.label === 'Low'
        ? 'Low-confidence work always returns to Must Respond, even when routine work is delegated.'
        : `${confidence.label}-confidence routine work can follow the selected responsibility policy.`,
      policy,
      policyLabel: POLICY_LABELS[policy],
      policyDetail: POLICY_DETAILS[policy],
      route: '/staff',
      routeLabel: 'Open Staff Responsibilities',
    };
  });
}

function departmentRating(value: number | undefined): number {
  return Math.round(staffRatingOutOfTen(value ?? 5) * 10);
}
