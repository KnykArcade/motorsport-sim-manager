import { getTrackById } from '../data';
import { activeDriversForTeam, carForTeam, currentRace, type GameState } from '../game/careerState';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';
import { effectiveCarRatings } from './trackFitEngine';
import { recommendedInstruction, recommendedRaceStrategy } from './weekendAdvisorEngine';
import { staffRatingOutOfTen } from './staffEngine';
import { weekendForecast } from './weatherEngine';
import type { AdvisorRecommendation, AdvisorRole, DepartmentId } from '../types/phase18Types';
import type { StaffMember, StaffRole } from '../types/staffTypes';
import type {
  ConfirmedWeekendPlan,
  WeekendRecommendationResolution,
} from '../types/weekendLeadershipTypes';

type WeekendSeat = {
  role: StaffRole;
  advisorRole: AdvisorRole;
  departmentId: DepartmentId;
  fallbackName: string;
};

const WEEKEND_SEATS: WeekendSeat[] = [
  {
    role: 'Race Engineer',
    advisorRole: 'RaceEngineer',
    departmentId: 'Engineering',
    fallbackName: 'Race Engineering Group',
  },
  {
    role: 'Strategist',
    advisorRole: 'SportingDirector',
    departmentId: 'RaceOperations',
    fallbackName: 'Strategy Group',
  },
  {
    role: 'Technical Director',
    advisorRole: 'TechnicalDirector',
    departmentId: 'Technical',
    fallbackName: 'Technical Department',
  },
  {
    role: 'Pit Crew Chief',
    advisorRole: 'SportingDirector',
    departmentId: 'RaceOperations',
    fallbackName: 'Pit Operations Group',
  },
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function bestStaff(staff: StaffMember[], role: StaffRole): StaffMember | undefined {
  return staff
    .filter((member) => member.role === role)
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))[0];
}

function confidenceFor(
  state: GameState,
  seat: WeekendSeat,
  member: StaffMember | undefined,
): number {
  const mood = state.phase18?.departmentMoods?.[state.selectedTeamId]?.[seat.departmentId];
  const competence = member ? staffRatingOutOfTen(member.rating) * 6 : 30;
  return Math.round(clamp(
    competence
      + (mood?.trustInPrincipal ?? 50) * 0.18
      + (mood?.strategicAlignment ?? 50) * 0.12,
    35,
    95,
  ));
}

function recommendationBase(
  state: GameState,
  seat: WeekendSeat,
  member: StaffMember | undefined,
  suffix: string,
): Pick<
  AdvisorRecommendation,
  | 'id'
  | 'teamId'
  | 'advisorRole'
  | 'advisorId'
  | 'advisorName'
  | 'decisionType'
  | 'decisionId'
  | 'confidence'
  | 'urgency'
  | 'status'
  | 'createdSeasonYear'
  | 'createdRound'
  | 'expiresSeasonYear'
  | 'expiresRound'
  | 'departmentId'
> {
  const race = currentRace(state)!;
  return {
    id: `weekend-${race.id}-${suffix}`,
    teamId: state.selectedTeamId,
    advisorRole: seat.advisorRole,
    advisorId: member?.id,
    advisorName: member?.name ?? seat.fallbackName,
    decisionType: 'weekend-command',
    decisionId: race.id,
    confidence: confidenceFor(state, seat, member),
    urgency: 'Normal',
    status: 'Pending',
    createdSeasonYear: state.seasonYear,
    createdRound: race.round,
    expiresSeasonYear: state.seasonYear,
    expiresRound: race.round,
    departmentId: seat.departmentId,
  };
}

export function buildWeekendCommandRecommendations(state: GameState): AdvisorRecommendation[] {
  const race = currentRace(state);
  const track = race ? getTrackById(race.trackId) : undefined;
  if (!race || !track) return [];

  const staff = state.staff ?? [];
  const forecast = weekendForecast(track, `${state.randomSeed}-r${race.round}`);
  const practice = state.weekendPractice?.raceId === race.id ? state.weekendPractice : undefined;
  const activeDrivers = activeDriversForTeam(state, state.selectedTeamId);
  const setupKnowledge = activeDrivers.length > 0
    ? activeDrivers.reduce(
        (sum, driver) => sum + (practice?.knowledge.setupKnowledge[driver.id] ?? 0),
        0,
      ) / activeDrivers.length
    : 0;

  const engineerSeat = WEEKEND_SEATS[0];
  const engineer = bestStaff(staff, engineerSeat.role);
  const recommendations: AdvisorRecommendation[] = [{
    ...recommendationBase(state, engineerSeat, engineer, 'engineering'),
    recommendedOptionId: 'SetupExploration',
    recommendation: setupKnowledge < 0.55
      ? 'Prioritize setup exploration in the first available practice session'
      : 'Protect the current setup direction and validate it with a focused run',
    rationale: setupKnowledge < 0.55
      ? 'The team still lacks enough setup evidence to make a confident final adjustment.'
      : 'Existing setup knowledge is strong enough that a broad reset would create unnecessary uncertainty.',
    evidence: [
      `Average setup knowledge: ${Math.round(setupKnowledge * 100)}%`,
      `${activeDrivers.length} active race driver${activeDrivers.length === 1 ? '' : 's'}`,
      `${forecast.Practice.condition} practice forecast`,
    ],
    expectedBenefit: 'Improves the quality of the setup decision and driver comfort evidence.',
    risk: 'Using practice time here leaves fewer laps for tyre or reliability learning.',
    targetPhase: 'practice',
  }];

  const strategistSeat = WEEKEND_SEATS[1];
  const strategist = bestStaff(staff, strategistSeat.role);
  const strategy = recommendedRaceStrategy(track, forecast.Race);
  recommendations.push({
    ...recommendationBase(state, strategistSeat, strategist, 'strategy'),
    recommendedOptionId: strategy.optionId,
    recommendation: `Build the race plan around ${strategy.optionId.replace(/([A-Z])/g, ' $1').trim()}`,
    rationale: strategy.reason,
    evidence: [
      `${forecast.Race.condition} race forecast`,
      `${track.archetype} circuit`,
      `Overtaking demand: ${track.attributes.overtakingRacecraft}/100`,
    ],
    expectedBenefit: 'Aligns tyre and pit timing with the track and forecast.',
    risk: strategy.optionId === 'AggressiveTwoStop'
      ? 'An extra stop increases pit exposure and traffic sensitivity.'
      : 'A conservative baseline can surrender opportunities if the race changes quickly.',
    targetPhase: 'race-strategy',
  });

  const car = carForTeam(state, state.selectedTeamId);
  const reliability = car ? effectiveCarRatings(car).reliability : 50;
  const reliabilityPressure =
    reliability < 62
    || track.setupProfile.reliabilityRiskFocus >= 7
    || track.setupProfile.riskDemand >= 8;
  const finalSeat = reliabilityPressure ? WEEKEND_SEATS[2] : WEEKEND_SEATS[3];
  const finalStaff = bestStaff(staff, finalSeat.role);
  if (reliabilityPressure) {
    recommendations.push({
      ...recommendationBase(state, finalSeat, finalStaff, 'technical'),
      recommendedOptionId: 'ProtectCar',
      recommendation: 'Use Protect Car instructions where the reliability margin is weakest',
      rationale: 'The technical risk profile is more important than extracting the final fraction of race pace.',
      evidence: [
        `Car reliability: ${Math.round(reliability)}/100`,
        `Track reliability focus: ${track.setupProfile.reliabilityRiskFocus}/10`,
        `Track risk demand: ${track.setupProfile.riskDemand}/10`,
      ],
      expectedBenefit: 'Reduces mechanical stress and mistake exposure for the vulnerable entry.',
      risk: 'Protecting the car costs race pace and may make track position harder to recover.',
      targetPhase: 'race-instructions',
      urgency: reliability < 50 ? 'High' : 'Normal',
    });
  } else {
    const instruction = recommendedInstruction(track, forecast.Race);
    recommendations.push({
      ...recommendationBase(state, finalSeat, finalStaff, 'pit-operations'),
      recommendedOptionId: instruction.optionId,
      recommendation: `Keep pit execution compatible with ${instruction.optionId.replace(/([A-Z])/g, ' $1').trim()} instructions`,
      rationale: instruction.reason,
      evidence: [
        `Car reliability: ${Math.round(reliability)}/100`,
        `${forecast.Race.condition} race forecast`,
        `Pit crew rating: ${finalStaff ? staffRatingOutOfTen(finalStaff.rating).toFixed(1) : '5.0'}/10`,
      ],
      expectedBenefit: 'Keeps the race instruction and pit execution risk on the same operating plan.',
      risk: 'A measured instruction may leave short-term pace unused.',
      targetPhase: 'race-instructions',
    });
  }

  return recommendations.slice(0, 3);
}

export function ensureWeekendCommandRecommendations(state: GameState): GameState {
  const race = currentRace(state);
  if (!race) return state;
  const phase18 = ensurePhase18FoundationState(state.phase18, state);
  const existing = phase18.advisorRecommendations.filter(
    (recommendation) =>
      recommendation.decisionType === 'weekend-command'
      && recommendation.decisionId === race.id
      && recommendation.teamId === state.selectedTeamId,
  );
  if (existing.length > 0) {
    return state.phase18 === phase18 ? state : { ...state, phase18 };
  }
  return {
    ...state,
    phase18: {
      ...phase18,
      advisorRecommendations: [
        ...phase18.advisorRecommendations,
        ...buildWeekendCommandRecommendations({ ...state, phase18 }),
      ].slice(-180),
    },
  };
}

export function weekendCommandRecommendations(state: GameState): AdvisorRecommendation[] {
  const race = currentRace(state);
  if (!race) return [];
  const stored = (state.phase18?.advisorRecommendations ?? []).filter(
    (recommendation) =>
      recommendation.decisionType === 'weekend-command'
      && recommendation.decisionId === race.id
      && recommendation.teamId === state.selectedTeamId,
  );
  return stored.length > 0 ? stored : buildWeekendCommandRecommendations(state);
}

export function resolveWeekendCommandRecommendation(
  state: GameState,
  recommendationId: string,
  resolution: WeekendRecommendationResolution,
): GameState {
  const prepared = ensureWeekendCommandRecommendations(state);
  const phase18 = ensurePhase18FoundationState(prepared.phase18, prepared);
  const recommendation = phase18.advisorRecommendations.find(
    (candidate) =>
      candidate.id === recommendationId
      && candidate.decisionType === 'weekend-command'
      && candidate.status === 'Pending',
  );
  if (!recommendation) return state;

  const trustChange = resolution === 'Delegated'
    ? 2
    : resolution === 'Accepted'
      ? 1
      : resolution === 'Modified'
        ? recommendation.confidence >= 85 ? -1 : 0
        : recommendation.confidence >= 75 ? -2 : -1;
  const status: AdvisorRecommendation['status'] =
    resolution === 'Accepted' || resolution === 'Delegated'
      ? 'Accepted'
      : resolution === 'Modified'
        ? 'Overruled'
        : 'Rejected';
  const departmentMoods = { ...phase18.departmentMoods };
  if (recommendation.departmentId) {
    const teamMoods = { ...departmentMoods[prepared.selectedTeamId] };
    const mood = teamMoods[recommendation.departmentId];
    if (mood) {
      teamMoods[recommendation.departmentId] = {
        ...mood,
        morale: clamp(mood.morale + (trustChange > 0 ? 1 : trustChange < -1 ? -1 : 0)),
        trustInPrincipal: clamp(mood.trustInPrincipal + trustChange),
        strategicAlignment: clamp(
          mood.strategicAlignment
            + (resolution === 'Accepted' || resolution === 'Delegated' ? 1 : resolution === 'Declined' ? -1 : 0),
        ),
        conflictReasons: resolution === 'Declined' && recommendation.confidence >= 75
          ? [...mood.conflictReasons, `High-confidence weekend advice declined: ${recommendation.recommendation}`].slice(-5)
          : mood.conflictReasons,
        lastUpdatedSeasonYear: prepared.seasonYear,
        lastUpdatedRound: prepared.careerPhase?.currentRound,
      };
      departmentMoods[prepared.selectedTeamId] = teamMoods;
    }
  }

  return {
    ...prepared,
    phase18: {
      ...phase18,
      advisorRecommendations: phase18.advisorRecommendations.map((candidate) =>
        candidate.id === recommendationId
          ? {
              ...candidate,
              status,
              resolutionMode: resolution,
              resolvedOptionId: resolution === 'Accepted' || resolution === 'Delegated'
                ? candidate.recommendedOptionId
                : undefined,
              resolutionNote: resolution === 'Accepted'
                ? 'Recommendation accepted and applied to the working plan.'
                : resolution === 'Delegated'
                  ? 'Recommendation delegated to the responsible staff member and applied to the working plan.'
                  : resolution === 'Modified'
                    ? 'Recommendation acknowledged; the principal will set a modified plan in the relevant weekend stage.'
                    : 'Recommendation declined; the current working plan remains unchanged.',
              trustChange,
            }
          : candidate,
      ),
      departmentMoods,
    },
  };
}

export function confirmWeekendPlan(
  state: GameState,
  plan: ConfirmedWeekendPlan,
): GameState {
  const race = currentRace(state);
  if (
    !race
    || race.id !== plan.raceId
    || plan.teamId !== state.selectedTeamId
    || plan.seasonYear !== state.seasonYear
    || plan.round !== race.round
    || !state.qualifyingResults[race.id]
    || plan.drivers.length !== activeDriversForTeam(state, state.selectedTeamId).length
  ) {
    return state;
  }
  return {
    ...state,
    weekendPlans: [
      ...(state.weekendPlans ?? []).filter((candidate) => candidate.raceId !== race.id),
      plan,
    ].slice(-80),
  };
}
