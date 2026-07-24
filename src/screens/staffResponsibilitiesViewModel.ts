import { staffByRole, staffRatingOutOfTen } from '../sim/staffEngine';
import type { GameState } from '../game/careerState';
import { ROLE_EFFECT, STAFF_ROLES, type StaffRole } from '../types/staffTypes';

export type StaffResponsibility = {
  id: string;
  area: string;
  role: StaffRole;
  owner: string;
  status: string;
  effect: string;
  detail: string;
  policy: 'player';
  policyLabel: string;
  approvalBoundary: string;
  route: string;
  routeLabel: string;
};

const DEPARTMENT_IDS: Record<StaffRole, string> = {
  'Technical Director': 'technical',
  'Race Engineer': 'race-engineering',
  'Pit Crew Chief': 'pit-operations',
  Strategist: 'race-strategy',
};

const DEPARTMENT_AREAS: Record<StaffRole, string> = {
  'Technical Director': 'Technical programme',
  'Race Engineer': 'Race preparation',
  'Pit Crew Chief': 'Pit operations',
  Strategist: 'Race strategy',
};

export function staffResponsibilities(state: GameState): StaffResponsibility[] {
  const owners = staffByRole(state.staff ?? []);
  return STAFF_ROLES.map((role) => {
    const rating = departmentRating(owners[role]?.rating);
    return {
      id: DEPARTMENT_IDS[role],
      area: DEPARTMENT_AREAS[role],
      role,
      owner: `${role} department`,
      status: `Level ${Math.max(1, Math.ceil(rating / 10))} · ${rating}/100`,
      effect: ROLE_EFFECT[role],
      detail: 'Permanent department rating improved with Principal Points.',
      policy: 'player',
      policyLabel: 'Player-led',
      approvalBoundary: 'You set the department level and retain final control.',
      route: '/staff',
      routeLabel: 'Open Departments',
    };
  });
}

function departmentRating(value: number | undefined): number {
  return Math.round(staffRatingOutOfTen(value ?? 5) * 10);
}
