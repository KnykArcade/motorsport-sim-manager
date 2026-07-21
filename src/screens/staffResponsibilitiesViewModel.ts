import { staffByRole, staffRatingOutOfTen } from '../sim/staffEngine';
import type { GameState } from '../game/careerState';
import {
  ROLE_EFFECT,
  type StaffMember,
  type StaffResponsibilityId,
  type StaffResponsibilityPolicy,
  type StaffRole,
} from '../types/staffTypes';

export type StaffResponsibility = {
  id: string;
  area: string;
  role: StaffRole;
  owner: string;
  status: string;
  effect: string;
  detail: string;
  policy: StaffResponsibilityPolicy;
  policyLabel: string;
  approvalBoundary: string;
  route: string;
  routeLabel: string;
};

export function staffResponsibilities(state: GameState): StaffResponsibility[] {
  const owners = staffByRole(state.staff ?? []);
  const mode = state.technicalManagementMode
    ?? ((state.partsAutomation?.autoRepair && state.partsAutomation.autoRestock && state.partsAutomation.autoFit) ? 'assisted' : 'player_led');
  const priority = state.technicalAdvisorPriority ?? 'balanced';

  return [
    {
      id: 'technical',
      area: 'Technical programme',
      role: 'Technical Director',
      owner: ownerLabel(owners['Technical Director'], 'No Technical Director hired'),
      status: mode === 'assisted' ? 'Assisted factory' : 'Player-led factory',
      effect: ROLE_EFFECT['Technical Director'],
      detail: `TD recommendations are advisory · ${priorityLabel(priority)} priority`,
      ...policyDetails('technical', state),
      route: '/technical',
      routeLabel: 'Open Technical Center',
    },
    responsibility(
      'race-engineering',
      'Race preparation',
      'Race Engineer',
      owners['Race Engineer'],
      'Weekend recommendations remain advisory',
      ROLE_EFFECT['Race Engineer'],
      'Practice setup confidence and weekend guidance',
      state,
      '/weekend',
      'Open Race Weekend',
    ),
    responsibility(
      'pit-operations',
      'Pit operations',
      'Pit Crew Chief',
      owners['Pit Crew Chief'],
      'Execution support active',
      ROLE_EFFECT['Pit Crew Chief'],
      'Pit-stop execution is influenced by this role',
      state,
      '/staff',
      'Open Staff',
    ),
    responsibility(
      'race-strategy',
      'Race strategy',
      'Strategist',
      owners.Strategist,
      'Strategy calls remain player-controlled',
      ROLE_EFFECT.Strategist,
      'In-race strategy support and recommendation quality',
      state,
      '/weekend',
      'Open Race Weekend',
    ),
  ];
}

function responsibility(
  id: StaffResponsibilityId,
  area: string,
  role: StaffRole,
  owner: StaffMember | undefined,
  status: string,
  effect: string,
  detail: string,
  state: GameState,
  route: string,
  routeLabel: string,
): StaffResponsibility {
  return {
    id,
    area,
    role,
    owner: ownerLabel(owner, `No ${role} hired`),
    status,
    effect,
    detail,
    ...policyDetails(id, state),
    route,
    routeLabel,
  };
}

function policyDetails(id: StaffResponsibilityId, state: GameState): {
  policy: StaffResponsibilityPolicy;
  policyLabel: string;
  approvalBoundary: string;
} {
  const policy = state.staffResponsibilityPolicies?.[id] ?? 'player';
  return {
    policy,
    policyLabel: {
      player: 'Player-led',
      staff_advisory: 'Staff advisory',
      staff_prepare_player_approval: 'Staff-prepared · player approval',
      staff_execute_routine: 'Staff executes routine work',
    }[policy],
    approvalBoundary: policy === 'staff_prepare_player_approval'
      ? 'Staff prepares the recommendation; you approve the decision.'
      : policy === 'staff_execute_routine'
        ? 'Routine work is delegated; consequential decisions remain yours.'
        : policy === 'staff_advisory'
          ? 'Staff advises; you choose and apply the action.'
          : 'You retain preparation and final control.',
  };
}

function ownerLabel(owner: StaffMember | undefined, vacantLabel: string): string {
  return owner ? `${owner.name} · ${staffRatingOutOfTen(owner.rating).toFixed(1)}/10` : vacantLabel;
}

function priorityLabel(priority: string): string {
  return {
    balanced: 'Balanced',
    performance: 'Performance push',
    reliability: 'Reliability first',
    factory: 'Factory resilience',
  }[priority] ?? 'Balanced';
}
