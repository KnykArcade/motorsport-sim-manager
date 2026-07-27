import type { GameState } from '../game/careerState';
import type { StaffRole } from '../types/staffTypes';
import { carForTeam, currentRace, driversForTeam } from '../game/careerState';
import { staffDepartmentRows } from './staffDepartmentViewModel';

export type StaffRecommendationKind = 'department' | 'relationship' | 'technical';
export type StaffRecommendationConfidence = 'Low' | 'Normal' | 'High';

export type StaffRecommendation = {
  id: string;
  kind: StaffRecommendationKind;
  responsibility: 'technical' | 'race-engineering' | 'pit-operations' | 'race-strategy' | 'driver-development';
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

export function staffRecommendations(state: GameState): StaffRecommendation[] {
  const recommendations: Array<StaffRecommendation & { priority: number }> = [];
  const teamDrivers = driversForTeam(state, state.selectedTeamId);
  const currentRound = currentRace(state)?.round ?? state.currentRaceIndex + 1;
  const activePromises = (state.driverPromises ?? []).filter((promise) =>
    promise.status === 'active'
    && teamDrivers.some((driver) => driver.id === promise.driverId));

  for (const promise of activePromises) {
    const dueRound = promise.dueSeason === state.seasonYear ? promise.dueRound : undefined;
    if (promise.dueSeason !== undefined && promise.dueSeason < state.seasonYear) continue;
    if (dueRound !== undefined && dueRound > currentRound + 2) continue;
    const driver = teamDrivers.find((candidate) => candidate.id === promise.driverId);
    recommendations.push({
      id: `staff-advice-promise-${promise.id}`,
      kind: 'relationship',
      responsibility: 'race-engineering',
      owner: staffOwner(state, 'Race Engineer'),
      target: driver?.name ?? 'Driver commitment',
      role: 'Race Engineer',
      rating: departmentRating(state, 'Race Engineer'),
      confidence: 'High',
      recommendation: 'Review the active promise before the next race decision.',
      whyItMatters: promise.notes ?? `This commitment is due ${promise.dueRound ? `by round ${promise.dueRound}` : `in ${promise.dueSeason ?? state.seasonYear}`}.`,
      expectedBenefit: 'Clarifying the commitment protects driver trust and avoids an accidental breach.',
      consequence: 'Ignoring the deadline can damage trust and morale through the existing promise system.',
      route: '/relationships',
      routeLabel: 'Open Relationships',
      priority: 100,
    });
  }

  for (const driver of teamDrivers) {
    const relationship = state.driverRelationships?.[driver.id];
    if (!relationship || (relationship.trustInPrincipal >= 45 && relationship.frustration < 65)) continue;
    recommendations.push({
      id: `staff-advice-relationship-${driver.id}`,
      kind: 'relationship',
      responsibility: 'race-engineering',
      owner: staffOwner(state, 'Race Engineer'),
      target: driver.name,
      role: 'Race Engineer',
      rating: departmentRating(state, 'Race Engineer'),
      confidence: relationship.trustInPrincipal < 35 || relationship.frustration >= 80 ? 'High' : 'Normal',
      recommendation: 'Schedule a focused driver conversation.',
      whyItMatters: `Principal trust is ${Math.round(relationship.trustInPrincipal)}% and frustration is ${Math.round(relationship.frustration)}%.`,
      expectedBenefit: 'A well-chosen conversation can stabilize confidence and clarify the driver’s concern.',
      consequence: 'The recommendation itself has no effect; only the conversation choice changes the relationship.',
      route: '/relationships',
      routeLabel: 'Open Relationships',
      priority: 90 + Math.max(0, 45 - relationship.trustInPrincipal),
    });
  }

  const car = carForTeam(state, state.selectedTeamId);
  if (car && car.condition < 80) {
    recommendations.push({
      id: 'staff-advice-car-condition',
      kind: 'technical',
      responsibility: 'technical',
      owner: staffOwner(state, 'Technical Director'),
      target: 'Car condition',
      role: 'Technical Director',
      rating: departmentRating(state, 'Technical Director'),
      confidence: car.condition < 65 ? 'High' : 'Normal',
      recommendation: 'Review component condition before committing to the next event.',
      whyItMatters: `Overall car condition is ${Math.round(car.condition)}%.`,
      expectedBenefit: 'The Technical Center identifies the components and repair choices behind the current risk.',
      consequence: 'No repair is made from this card; all technical actions remain in the Technical Center.',
      route: '/technical',
      routeLabel: 'Open Technical Center',
      priority: 80 + Math.max(0, 80 - car.condition),
    });
  }

  const principalPoints = state.principal?.skillPoints ?? 0;
  if (principalPoints > 0) {
    const developmentPriorities = staffDepartmentRows(state.staff, principalPoints)
      .filter((department) => department.canImprove)
      .sort((a, b) => a.rating - b.rating)
      .slice(0, 2);
    for (const department of developmentPriorities) {
      recommendations.push({
        id: `staff-advice-department-${department.role}`,
        kind: 'department',
        responsibility: responsibilityFor(department.role),
        owner: staffOwner(state, department.role),
        target: department.role,
        role: department.role,
        rating: department.rating,
        confidence: department.rating < 60 ? 'High' : 'Normal',
        recommendation: `Consider investing one Principal Point in ${department.role}.`,
        whyItMatters: `${department.role} is the ${department.rating}/100 development priority among the permanent departments.`,
        expectedBenefit: department.effect,
        consequence: `You have ${principalPoints} unspent Principal Point${principalPoints === 1 ? '' : 's'}; spending remains optional.`,
        route: '/staff',
        routeLabel: 'Open Departments',
        priority: 60 + Math.max(0, 80 - department.rating),
      });
    }
  }

  return recommendations
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map(({ priority, ...recommendation }) => {
      void priority;
      return recommendation;
    });
}

function staffOwner(state: GameState, role: StaffRole): string {
  return state.staff?.find((member) => member.role === role)?.name ?? role;
}

function departmentRating(state: GameState, role: StaffRole): number {
  return staffDepartmentRows(state.staff, state.principal?.skillPoints ?? 0)
    .find((department) => department.role === role)?.rating ?? 50;
}

function responsibilityFor(role: StaffRole): StaffRecommendation['responsibility'] {
  if (role === 'Technical Director') return 'technical';
  if (role === 'Race Engineer') return 'race-engineering';
  if (role === 'Pit Crew Chief') return 'pit-operations';
  return 'race-strategy';
}
