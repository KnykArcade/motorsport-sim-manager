import { staffByRole, staffRatingOutOfTen } from '../sim/staffEngine';
import type { GameState } from '../game/careerState';
import type { StaffMember, StaffRole } from '../types/staffTypes';

export type StaffResponsibility = {
  id: string;
  area: string;
  role: StaffRole;
  owner: string;
  status: string;
  detail: string;
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
      detail: `TD recommendations are advisory · ${priorityLabel(priority)} priority`,
      route: '/technical',
      routeLabel: 'Open Technical Center',
    },
    responsibility(
      'race-engineering',
      'Race preparation',
      'Race Engineer',
      owners['Race Engineer'],
      'Weekend recommendations remain advisory',
      'Practice setup confidence and weekend guidance',
      '/weekend',
      'Open Race Weekend',
    ),
    responsibility(
      'pit-operations',
      'Pit operations',
      'Pit Crew Chief',
      owners['Pit Crew Chief'],
      'Execution support active',
      'Pit-stop execution is influenced by this role',
      '/staff',
      'Open Staff',
    ),
    responsibility(
      'race-strategy',
      'Race strategy',
      'Strategist',
      owners.Strategist,
      'Strategy calls remain player-controlled',
      'In-race strategy support and recommendation quality',
      '/weekend',
      'Open Race Weekend',
    ),
  ];
}

function responsibility(
  id: string,
  area: string,
  role: StaffRole,
  owner: StaffMember | undefined,
  status: string,
  detail: string,
  route: string,
  routeLabel: string,
): StaffResponsibility {
  return {
    id,
    area,
    role,
    owner: ownerLabel(owner, `No ${role} hired`),
    status,
    detail,
    route,
    routeLabel,
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
