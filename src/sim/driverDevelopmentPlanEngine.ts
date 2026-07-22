import type { GameState } from '../game/careerState';
import type { RaceResult } from '../types/gameTypes';
import type { DriverRelationship } from '../types/relationshipTypes';
import type {
  DriverDevelopmentFocus,
  DriverDevelopmentPlan,
  DriverDevelopmentStatus,
} from '../types/developmentCurveTypes';
import { facilityYouthDevelopmentBonus } from './facilityEngine';
import { staffByRole, staffRatingOutOfTen } from './staffEngine';

export const TOTAL_TESTING_ALLOCATION = 100;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function defaultDriverDevelopmentPlan(
  driverId: string,
  seasonYear: number,
  round = 0,
): DriverDevelopmentPlan {
  return {
    driverId,
    focus: 'Balanced',
    testingAllocation: 0,
    progress: 0,
    satisfaction: 60,
    status: 'Steady',
    assignedSeason: seasonYear,
    assignedRound: round,
    history: [],
  };
}

export function planForDriver(state: GameState, driverId: string): DriverDevelopmentPlan {
  return state.driverDevelopmentPlans?.[driverId]
    ?? defaultDriverDevelopmentPlan(driverId, state.seasonYear, state.currentRaceIndex + 1);
}

export function isPlayerDevelopmentSubject(state: GameState, driverId: string): boolean {
  return state.drivers.some((driver) => driver.id === driverId && driver.teamId === state.selectedTeamId)
    || (state.academy ?? []).some((member) => member.id === driverId && member.academyTeamId === state.selectedTeamId);
}

export function testingAllocationUsed(state: GameState, exceptDriverId?: string): number {
  return Object.values(state.driverDevelopmentPlans ?? {}).reduce(
    (sum, plan) => sum + (plan.driverId === exceptDriverId ? 0 : plan.testingAllocation),
    0,
  );
}

export function assignDevelopmentFocus(
  state: GameState,
  driverId: string,
  focus: DriverDevelopmentFocus,
): GameState {
  if (state.gameMode === 'SingleSeason' || !isPlayerDevelopmentSubject(state, driverId)) return state;
  const current = planForDriver(state, driverId);
  return {
    ...state,
    driverDevelopmentPlans: {
      ...(state.driverDevelopmentPlans ?? {}),
      [driverId]: {
        ...current,
        focus,
        assignedSeason: state.seasonYear,
        assignedRound: state.currentRaceIndex + 1,
        satisfaction: clamp(current.satisfaction + (current.focus === focus ? 0 : 2)),
      },
    },
  };
}

export function assignTestingAllocation(state: GameState, driverId: string, allocation: number): GameState {
  if (state.gameMode === 'SingleSeason' || !isPlayerDevelopmentSubject(state, driverId)) return state;
  const nextAllocation = clamp(allocation);
  if (testingAllocationUsed(state, driverId) + nextAllocation > TOTAL_TESTING_ALLOCATION) return state;
  const current = planForDriver(state, driverId);
  return {
    ...state,
    driverDevelopmentPlans: {
      ...(state.driverDevelopmentPlans ?? {}),
      [driverId]: { ...current, testingAllocation: nextAllocation },
    },
  };
}

export function mentorCandidates(state: GameState, menteeId: string) {
  const mentee = state.drivers.find((driver) => driver.id === menteeId);
  const menteeAge = mentee?.age ?? 18;
  return state.drivers.filter((driver) =>
    driver.teamId === state.selectedTeamId
    && driver.id !== menteeId
    && (driver.age ?? 0) >= 27
    && (driver.age ?? 0) >= menteeAge + 4
    && driver.ratings.overall >= 60,
  );
}

export function assignDevelopmentMentor(state: GameState, driverId: string, mentorId?: string): GameState {
  if (state.gameMode === 'SingleSeason' || !isPlayerDevelopmentSubject(state, driverId)) return state;
  if (mentorId && !mentorCandidates(state, driverId).some((driver) => driver.id === mentorId)) return state;
  const current = planForDriver(state, driverId);
  return {
    ...state,
    driverDevelopmentPlans: {
      ...(state.driverDevelopmentPlans ?? {}),
      [driverId]: { ...current, mentorId },
    },
  };
}

function planStatus(progressGain: number, satisfaction: number): DriverDevelopmentStatus {
  if (satisfaction < 35) return 'Frustrated';
  if (progressGain < 4) return 'Stalled';
  if (progressGain >= 10) return 'Progressing';
  return 'Steady';
}

export function progressDriverDevelopmentPlans(state: GameState, round: number, results: RaceResult[] = []): GameState {
  if (state.gameMode === 'SingleSeason') return state;
  const subjects = [
    ...state.drivers.filter((driver) => driver.teamId === state.selectedTeamId).map((driver) => driver.id),
    ...(state.academy ?? []).filter((member) => member.academyTeamId === state.selectedTeamId).map((member) => member.id),
  ];
  const staff = staffByRole(state.staff ?? []);
  const technicalSupport = staffRatingOutOfTen(staff['Technical Director']?.rating ?? 0);
  const engineeringSupport = staffRatingOutOfTen(staff['Race Engineer']?.rating ?? 0);
  const facilitySupport = facilityYouthDevelopmentBonus(state.facilities);
  const teamQuality = state.teamOrgRatings?.[state.selectedTeamId];
  const organizationSupport = ((teamQuality?.staffQuality ?? 50) + (teamQuality?.facilities ?? 50) + (teamQuality?.youthAcademy ?? 50) - 150) / 100;
  const plans = { ...(state.driverDevelopmentPlans ?? {}) };

  for (const driverId of subjects) {
    const current = plans[driverId] ?? defaultDriverDevelopmentPlan(driverId, state.seasonYear, round);
    const driver = state.drivers.find((entry) => entry.id === driverId);
    const relationship = state.driverRelationships?.[driverId];
    const morale = driver?.morale ?? relationship?.morale ?? 55;
    const confidence = relationship?.selfConfidence ?? driver?.confidence ?? 55;
    const mentorActive = !!current.mentorId && state.drivers.some((entry) => entry.id === current.mentorId && entry.teamId === state.selectedTeamId);
    const promisePriority = relationship?.wants.includes('development_priority') ?? false;
    const raced = results.some((result) => result.driverId === driverId);
    const isAcademy = !driver;
    const seatTime = raced ? 2 : isAcademy ? 0.5 : -0.5;
    const support = (technicalSupport + engineeringSupport) / 8 + facilitySupport * 5;
    const testing = current.testingAllocation / 12;
    const wellbeing = (morale + confidence - 100) / 35;
    const progressGain = Math.max(1, Math.min(16, 3 + support + organizationSupport + testing + wellbeing + seatTime + (mentorActive ? 2 : 0)));
    const neglect = promisePriority && current.testingAllocation < 15 ? -4 : 0;
    const satisfaction = clamp(current.satisfaction + Math.round((progressGain - 7) / 2) + neglect);
    plans[driverId] = {
      ...current,
      progress: clamp(current.progress + progressGain),
      satisfaction,
      status: planStatus(progressGain, satisfaction),
    };
  }
  return { ...state, driverDevelopmentPlans: plans };
}

export function developmentPlanEffect(plan: DriverDevelopmentPlan | undefined): number {
  if (!plan) return 0;
  const progress = (plan.progress - 50) / 250;
  const satisfaction = (plan.satisfaction - 50) / 500;
  const status = plan.status === 'Progressing' ? 0.05 : plan.status === 'Frustrated' ? -0.08 : plan.status === 'Stalled' ? -0.04 : 0;
  return Math.max(-0.15, Math.min(0.2, progress + satisfaction + status));
}

export function closeDevelopmentPlanSeason(
  plan: DriverDevelopmentPlan,
  seasonYear: number,
  overallBefore?: number,
  overallAfter?: number,
): DriverDevelopmentPlan {
  const result = overallBefore == null || overallAfter == null
    ? `${plan.status.toLowerCase()} year under the ${focusLabel(plan.focus).toLowerCase()} programme.`
    : `${plan.status} plan; overall moved from ${overallBefore.toFixed(1)} to ${overallAfter.toFixed(1)}.`;
  return {
    ...plan,
    progress: 0,
    assignedSeason: seasonYear,
    assignedRound: 0,
    history: [...plan.history, {
      seasonYear: seasonYear - 1,
      focus: plan.focus,
      status: plan.status,
      summary: result,
      overallBefore,
      overallAfter,
    }].slice(-8),
  };
}

export function developmentRecommendation(state: GameState, driverId: string): DriverDevelopmentFocus {
  const driver = state.drivers.find((entry) => entry.id === driverId);
  const academy = (state.academy ?? []).find((entry) => entry.id === driverId);
  const ratings = driver?.ratings;
  if (!ratings && academy) {
    const skills = academy.skills;
    const choices: Array<[DriverDevelopmentFocus, number]> = [
      ['Racecraft', skills.overtakingRacecraft],
      ['Consistency', (skills.enduranceConsistency + skills.riskManagement) / 2],
      ['TechnicalFeedback', skills.technical],
      ['QualifyingPace', (skills.cornering + skills.braking) / 2],
    ];
    return choices.sort((a, b) => a[1] - b[1])[0][0];
  }
  if (!ratings) return 'Balanced';
  const relationship = state.driverRelationships?.[driverId];
  if ((relationship?.selfConfidence ?? 100) < 45) return 'MentalResilience';
  const choices: Array<[DriverDevelopmentFocus, number]> = [
    ['QualifyingPace', ratings.qualifying],
    ['Racecraft', (ratings.racePace + ratings.overtakingRacecraft) / 2],
    ['Consistency', (ratings.enduranceConsistency + ratings.riskManagement) / 2],
    ['TechnicalFeedback', ratings.technical],
    ['WetWeather', ratings.adaptability],
    ['MentalResilience', ratings.composure],
  ];
  return choices.sort((a, b) => a[1] - b[1])[0][0];
}

export function focusLabel(focus: DriverDevelopmentFocus): string {
  return focus.replace(/([a-z])([A-Z])/g, '$1 $2');
}

// A resilience plan improves recovery after a clean finish; it never erases a
// crash consequence on the same weekend.
export function applyMentalResilienceRecovery(
  state: GameState,
  relationships: Record<string, DriverRelationship> | undefined,
  results: RaceResult[],
): Record<string, DriverRelationship> | undefined {
  if (!relationships) return relationships;
  const next = { ...relationships };
  for (const result of results) {
    const driver = state.drivers.find((entry) => entry.id === result.driverId);
    const plan = state.driverDevelopmentPlans?.[result.driverId];
    const rel = next[result.driverId];
    if (!driver || driver.teamId !== state.selectedTeamId || !rel || plan?.focus !== 'MentalResilience') continue;
    const crashed = result.status !== 'Finished' || result.incidents.some((incident) => /crash|collision|accident|spun|contact/i.test(incident));
    if (crashed) continue;
    const recovery = plan.status === 'Progressing' || plan.progress >= 65 ? 2 : 1;
    next[result.driverId] = {
      ...rel,
      selfConfidence: clamp(rel.selfConfidence + recovery),
      frustration: clamp(rel.frustration - 1),
    };
  }
  return next;
}
