// Deterministic rival-team engineering for an active race weekend.
//
// AI teams begin from a coarse track/car baseline, learn through an abstract
// practice programme, then make imperfect adjustments. Staff, facilities,
// operations, package choice, finances, driver feedback and weather determine
// how much uncertainty they remove. The hidden physical optimum is used only
// to generate noisy directional observations; it is never returned to the AI,
// and a non-zero observation floor prevents a solved perfect setup.

import { selectRaceRuleProfile } from '../data/rules/raceRuleProfiles';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import type {
  AIEngineeringDriverPlan,
  AIEngineeringPhilosophy,
  AIEngineeringWeekendPlan,
} from '../types/aiSetupTypes';
import type { AITeamArchetype, TeamPhilosophyTrait } from '../types/aiTeamTypes';
import type { Car, Driver, Series, Team, Track } from '../types/gameTypes';
import type { PracticeProgram } from '../types/practiceTypes';
import type {
  FinancialDistressState,
  RaceWeekendPackageSelection,
  RaceWeekendPackageType,
} from '../types/raceWeekendPackageTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import type { RaceEngineerProfile, StaffMember } from '../types/staffTypes';
import type { CarSetup, SetupParamKey } from '../types/setupTypes';
import { driverSetupComfort } from './driverComfortEngine';
import { effectiveCarRatings } from './trackFitEngine';
import { initialBaselineSetup, idealSetup, objectiveSetupQuality } from './setupFitEngine';
import { setupLockStatus, validateSetupChange } from './setupLockEngine';
import { buildTunedSetupSimulationProfile } from './setupSimulationProfile';
import { createSeededRandom, deriveSeed, type Rng } from './random';
import { practiceLapBudgetPerCar, weekendSessionKinds } from './practiceProgramEngine';
import { toLegacyRating } from './ratingScale';
import { weekendForecast } from './weatherEngine';
import {
  deriveRaceEngineerProfile,
  engineeringKnowledgeExtraction,
  raceEngineerTrackRating,
} from './raceEngineerEngine';

export type AIEngineeringPlanInput = {
  seed: string;
  raceId: string;
  raceRound: number;
  seasonYear: number;
  series: Series;
  track: Track;
  team: Team;
  car: Car;
  drivers: Driver[];
  organization?: TeamOrganizationRatings;
  packageSelection?: RaceWeekendPackageSelection;
  financialDistress?: FinancialDistressState;
  archetype?: AITeamArchetype;
  philosophyTraits?: TeamPhilosophyTrait[];
  championshipPosition?: number;
  teamCount?: number;
  totalRounds?: number;
  raceEngineer?: StaffMember;
};

export type AIEngineeringRuntime = {
  setup: CarSetup;
  quality: ReturnType<typeof objectiveSetupQuality>;
  comfort: ReturnType<typeof driverSetupComfort>;
  profile: ReturnType<typeof buildTunedSetupSimulationProfile>;
  confidenceBonus: number;
};

const PARAMS = Object.keys(BALANCED_SETUP) as SetupParamKey[];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function round(value: number, places = 3): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function sanitize(setup: CarSetup): CarSetup {
  const out = {} as CarSetup;
  for (const key of PARAMS) out[key] = round(clamp(setup[key], 1, 10));
  return out;
}

function rating01(value: number | undefined, fallback = 50): number {
  const resolved = value ?? fallback;
  return clamp01((resolved <= 10 ? resolved * 10 : resolved) / 100);
}

function trackDemand(value: number): number {
  return rating01(value);
}

function packagePreparation(type: RaceWeekendPackageType | undefined): number {
  switch (type) {
    case 'FullAttack': return 1.12;
    case 'Conservative': return 0.92;
    case 'Budget': return 0.68;
    case 'DevelopmentTest': return 0.88;
    case 'StartAndPark': return 0.28;
    case 'SkipRace': return 0.08;
    case 'MandatoryMinimum': return 0.14;
    default: return 1;
  }
}

function distressPenalty(state: FinancialDistressState | undefined): number {
  switch (state?.level) {
    case 'Tight': return 5;
    case 'AtRisk': return 11;
    case 'Critical': return 19;
    case 'Administration': return 25;
    case 'ClosureRisk': return 31;
    default: return 0;
  }
}

function archetypeRisk(archetype: AITeamArchetype | undefined): number {
  switch (archetype) {
    case 'ChampionshipContender': return 0.68;
    case 'AmbitiousBuilder': return 0.62;
    case 'DevelopmentFocused': return 0.48;
    case 'AggressiveSpender': return 0.82;
    case 'YouthFocused': return 0.5;
    case 'PayDriverReliant': return 0.56;
    case 'SurvivalMode': return 0.18;
    default: return 0.3;
  }
}

function teamPreparation(input: AIEngineeringPlanInput, rng: Rng): number {
  const org = input.organization;
  const engineerProfile = input.raceEngineer
    ? deriveRaceEngineerProfile(input.raceEngineer)
    : undefined;
  const engineer = engineerProfile
    ? raceEngineerTrackRating(engineerProfile, input.track, input.series) / 100
    : rating01(org?.staffQuality);
  const organizational =
    rating01(org?.staffQuality) * 0.12
    + rating01(org?.operations) * 0.15
    + rating01(org?.facilities) * 0.12
    + rating01(org?.research) * 0.1
    + rating01(org?.reliabilityDepartment) * 0.08
    + rating01(input.team.raceOperations) * 0.17
    + engineer * 0.26;
  const packageFactor = packagePreparation(input.packageSelection?.packageType);
  const packagePoints = (packageFactor - 1) * 40;
  const processTrait = input.philosophyTraits?.includes('DataDriven') ? 4
    : input.philosophyTraits?.includes('Disciplined') ? 2
      : input.philosophyTraits?.includes('Maverick') ? -2
        : 0;
  const score = organizational * 100
    + packagePoints
    + processTrait
    - distressPenalty(input.financialDistress)
    + rng.variance(8);
  if (input.packageSelection?.packageType === 'MandatoryMinimum') {
    return round(clamp(score, 7, 18), 1);
  }
  return round(clamp(score, 12, 96), 1);
}

function selectPhilosophy(
  input: AIEngineeringPlanInput,
  preparationScore: number,
  rng: Rng,
): AIEngineeringPhilosophy {
  const car = effectiveCarRatings(input.car);
  const reliability = rating01(car.reliability);
  const risk = archetypeRisk(input.archetype);
  const packageType = input.packageSelection?.packageType;
  const forecast = weekendForecast(input.track, `${input.seed}-r${input.raceRound}`);
  const wetForecast = Object.values(forecast).some((session) => session.wet)
    ? 1
    : Object.values(forecast).some((session) => session.changingSoon)
      ? 0.65
      : 0;
  const championshipPosition = input.championshipPosition ?? input.teamCount ?? 10;
  const lateSeason = input.raceRound > (input.totalRounds ?? 20) * 0.7;
  const titlePressure = championshipPosition <= 3 && lateSeason ? 10 : 0;
  const powerDemand = Math.max(
    trackDemand(input.track.setupProfile.powerDemand),
    trackDemand(input.track.attributes.straights),
  );
  const tyreDemand = trackDemand(input.track.attributes.enduranceConsistency);
  const trafficDemand = input.series === 'NASCAR' || input.series === 'IndyCar' || input.series === 'CART'
    ? 0.72
    : 0.35;
  const research = rating01(input.organization?.research);
  const scores: Record<AIEngineeringPhilosophy, number> = {
    BalancedWeekend: 38 + preparationScore * 0.08,
    QualifyingAttack: 20 + risk * 22 + titlePressure + (packageType === 'FullAttack' ? 18 : 0),
    LongRunPreservation: 19 + tyreDemand * 28 + (1 - risk) * 8,
    ReliabilityProtection: 16 + (1 - reliability) * 39 + (1 - risk) * 8
      + (packageType === 'Conservative' ? 12 : 0),
    WetWeatherPreparation: 11 + wetForecast * 38,
    StraightLineEfficiency: 16 + powerDemand * 27,
    TrafficOvertaking: 15 + trafficDemand * 24,
    ExperimentalDevelopment: 8 + research * 17
      + (packageType === 'DevelopmentTest' ? 30 : 0)
      + (input.philosophyTraits?.includes('TechnicalInnovator') ? 8 : 0),
  };
  if (packageType === 'MandatoryMinimum') {
    scores.ReliabilityProtection += 16;
    scores.QualifyingAttack -= 14;
    scores.ExperimentalDevelopment -= 18;
  }
  let best: AIEngineeringPhilosophy = 'BalancedWeekend';
  let bestScore = -Infinity;
  for (const philosophy of Object.keys(scores) as AIEngineeringPhilosophy[]) {
    const score = scores[philosophy] + rng.variance(5);
    if (score > bestScore) {
      best = philosophy;
      bestScore = score;
    }
  }
  return best;
}

function practiceProgramsFor(
  input: AIEngineeringPlanInput,
  philosophy: AIEngineeringPhilosophy,
): PracticeProgram[] {
  if (
    input.packageSelection?.packageType === 'MandatoryMinimum'
    || input.packageSelection?.packageType === 'StartAndPark'
    || input.packageSelection?.packageType === 'SkipRace'
  ) return [];

  const sessionCount = weekendSessionKinds(input.seasonYear, input.series).length;
  const priority: PracticeProgram[] = ['SetupExploration'];
  const add = (program: PracticeProgram) => {
    if (!priority.includes(program)) priority.push(program);
  };
  switch (philosophy) {
    case 'QualifyingAttack': add('QualifyingSimulation'); add('BrakeTemperatureTest'); break;
    case 'LongRunPreservation': add('RacePaceRun'); add('TireWearAnalysis'); break;
    case 'ReliabilityProtection': add('ReliabilityShakedown'); add('FuelLoadTest'); break;
    case 'WetWeatherPreparation': add('WetWeatherPreparation'); add('RacePaceRun'); break;
    case 'StraightLineEfficiency': add('QualifyingSimulation'); add('FuelLoadTest'); break;
    case 'TrafficOvertaking': add('RacePaceRun'); add('BrakeTemperatureTest'); break;
    case 'ExperimentalDevelopment': add('SetupExploration'); add('RacePaceRun'); break;
    default: add('QualifyingSimulation'); add('RacePaceRun'); break;
  }
  const forecast = weekendForecast(input.track, `${input.seed}-r${input.raceRound}`);
  if (Object.values(forecast).some((session) => session.wet || session.changingSoon)) {
    add('WetWeatherPreparation');
  }
  if (trackDemand(input.track.setupProfile.reliabilityRiskFocus) >= 0.7) add('ReliabilityShakedown');
  return priority.slice(0, Math.max(1, sessionCount));
}

function applyPhilosophy(
  setup: CarSetup,
  philosophy: AIEngineeringPhilosophy,
  trim: 'qualifying' | 'race',
  rng: Rng,
): CarSetup {
  const next = { ...setup };
  const race = trim === 'race';
  switch (philosophy) {
    case 'QualifyingAttack':
      next.frontWing += 0.25;
      next.differential += 0.35;
      next.tyreUsage += race ? 0.45 : 0.9;
      next.engineCooling -= race ? 0.15 : 0.4;
      break;
    case 'LongRunPreservation':
      next.rearWing += 0.25;
      next.differential -= 0.25;
      next.tyreUsage -= race ? 0.9 : 0.35;
      next.engineCooling += 0.25;
      break;
    case 'ReliabilityProtection':
      next.engineCooling += race ? 1.05 : 0.7;
      next.brakeCooling += race ? 0.65 : 0.35;
      next.differential -= 0.35;
      next.tyreUsage -= 0.55;
      break;
    case 'WetWeatherPreparation':
      next.frontWing += 0.55;
      next.rearWing += 0.7;
      next.suspensionStiffness -= 0.5;
      next.rideHeight += 0.35;
      next.differential -= 0.65;
      next.tyreUsage -= 0.25;
      break;
    case 'StraightLineEfficiency':
      next.frontWing -= 0.55;
      next.rearWing -= 0.7;
      next.gearing += 0.55;
      next.engineCooling -= 0.15;
      break;
    case 'TrafficOvertaking':
      next.frontWing += 0.2;
      next.rearWing += 0.15;
      next.brakeCooling += 0.55;
      next.engineCooling += 0.65;
      next.gearing += 0.2;
      break;
    case 'ExperimentalDevelopment': {
      const direction = rng.chance(0.5) ? 1 : -1;
      next.frontWing += direction * 0.45;
      next.suspensionStiffness -= direction * 0.4;
      next.differential += rng.variance(0.65);
      next.tyreUsage += rng.variance(0.55);
      break;
    }
    default:
      next.tyreUsage += race ? -0.25 : 0.3;
      next.engineCooling += race ? 0.2 : 0;
      break;
  }
  return sanitize(next);
}

function setupDistance(a: CarSetup, b: CarSetup): number {
  return PARAMS.reduce((sum, key) => sum + Math.abs(a[key] - b[key]), 0) / PARAMS.length;
}

function imperfectSharedEstimate(
  input: AIEngineeringPlanInput,
  knowledge: number,
  uncertainty: number,
  rng: Rng,
): CarSetup {
  const baseline = initialBaselineSetup(input.track, input.car);
  const physicalTarget = idealSetup(input.track, undefined, input.car);
  const out = {} as CarSetup;
  const discovery = clamp(0.22 + knowledge * 0.7 + rng.variance(0.08), 0.16, 0.91);
  for (const key of PARAMS) {
    const observationNoise = rng.variance(0.12 + uncertainty * 2.65);
    out[key] = baseline[key] + (physicalTarget[key] - baseline[key]) * discovery + observationNoise;
  }
  let estimate = sanitize(out);
  // Even an elite team retains a small observation floor. This protects the
  // imperfect-knowledge contract and stops the engine from handing out the
  // exact hidden target through rounding coincidence.
  if (setupDistance(estimate, physicalTarget) < 0.08) {
    estimate = sanitize({ ...estimate, brakeBias: estimate.brakeBias + 0.12 });
  }
  return estimate;
}

function driverSpecificEstimate(
  shared: CarSetup,
  driver: Driver,
  uncertainty: number,
  rng: Rng,
  engineerProfile?: RaceEngineerProfile,
): CarSetup {
  const technical = rating01(driver.ratings.technical);
  const adaptability = rating01(driver.ratings.adaptability);
  const confidence = rating01(driver.confidence);
  const aggression = (toLegacyRating(driver.ratings.aggression, 'Driver aggression') - 5.5) / 4.5;
  const interpretation = engineerProfile
    ? engineeringKnowledgeExtraction(engineerProfile, driver.ratings.technical, 50)
    : 1;
  const feedbackNoise = uncertainty * (1.15 - technical * 0.55 - adaptability * 0.2) / interpretation;
  const next = { ...shared };
  for (const key of PARAMS) next[key] += rng.variance(feedbackNoise * 0.8);
  next.frontWing += aggression * 0.22;
  next.differential += aggression * 0.42;
  next.tyreUsage += aggression * 0.24;
  next.rearWing += (0.5 - confidence) * 0.5;
  next.differential -= Math.max(0, 0.5 - confidence) * 0.65;
  return sanitize(next);
}

function constrainRaceSetup(
  qualifying: CarSetup,
  requestedRace: CarSetup,
  input: AIEngineeringPlanInput,
): CarSetup {
  const rules = selectRaceRuleProfile(input.series, input.seasonYear, input.track);
  const status = setupLockStatus(rules, 'AfterQualifying');
  if (!status.active) return requestedRace;

  const allowed = new Set(status.allowedParams);
  const maxDelta = status.rule.maxPostQualifyingDelta;
  const constrained = { ...requestedRace };
  for (const key of PARAMS) {
    if (!allowed.has(key)) constrained[key] = qualifying[key];
    else if (maxDelta != null) {
      constrained[key] = clamp(
        constrained[key],
        qualifying[key] - maxDelta,
        qualifying[key] + maxDelta,
      );
    }
  }
  const sanitized = sanitize(constrained);
  return validateSetupChange(rules, 'AfterQualifying', qualifying, sanitized).allowed
    ? sanitized
    : qualifying;
}

function lockedWeekendCompromise(
  qualifying: CarSetup,
  race: CarSetup,
  input: AIEngineeringPlanInput,
): { qualifying: CarSetup; race: CarSetup } {
  const rules = selectRaceRuleProfile(input.series, input.seasonYear, input.track);
  if (!setupLockStatus(rules, 'AfterQualifying').active) return { qualifying, race };
  const compromise = {} as CarSetup;
  for (const key of PARAMS) compromise[key] = qualifying[key] * 0.44 + race[key] * 0.56;
  const lockedQualifying = sanitize(compromise);
  return {
    qualifying: lockedQualifying,
    race: constrainRaceSetup(lockedQualifying, race, input),
  };
}

export function buildAIEngineeringWeekendPlan(input: AIEngineeringPlanInput): AIEngineeringWeekendPlan {
  const rng = createSeededRandom(deriveSeed(
    input.seed,
    'ai-engineering',
    input.seasonYear,
    input.raceId,
    input.team.id,
  ));
  const preparationScore = teamPreparation(input, rng);
  const philosophy = selectPhilosophy(input, preparationScore, rng);
  const practicePrograms = practiceProgramsFor(input, philosophy);
  const packageFactor = packagePreparation(input.packageSelection?.packageType);
  const sessionCount = weekendSessionKinds(input.seasonYear, input.series).length;
  const practiceOpportunity = practicePrograms.length / Math.max(1, sessionCount);
  const engineerProfile = input.raceEngineer
    ? deriveRaceEngineerProfile(input.raceEngineer)
    : undefined;
  const averageTechnical = input.drivers.length > 0
    ? input.drivers.reduce((sum, driver) => sum + rating01(driver.ratings.technical) * 100, 0) / input.drivers.length
    : 50;
  const extraction = engineerProfile
    ? engineeringKnowledgeExtraction(engineerProfile, averageTechnical, 50)
    : 1;
  const sharedKnowledge = input.packageSelection?.packageType === 'MandatoryMinimum'
    ? round(clamp(0.05 + preparationScore / 500, 0.05, 0.1))
    : round(clamp(
      0.12 + preparationScore / 145 + practiceOpportunity * 0.12
        + (packageFactor - 1) * 0.18 + (extraction - 1) * 0.16,
      0.08,
      0.9,
    ));
  const uncertainty = round(clamp(
    0.94 - sharedKnowledge * 0.82 + rng.variance(0.08),
    0.1,
    0.92,
  ));
  const sharedEstimate = imperfectSharedEstimate(input, sharedKnowledge, uncertainty, rng);
  const drivers: Record<string, AIEngineeringDriverPlan> = {};
  const baseLaps = practicePrograms.length === 0
    ? 0
    : practiceLapBudgetPerCar(input.seasonYear, input.series)
      * practiceOpportunity
      * clamp(0.45 + preparationScore / 140, 0.35, 1.05)
      * packageFactor;

  for (const driver of input.drivers) {
    const driverRng = createSeededRandom(deriveSeed(
      input.seed,
      'ai-engineering-driver',
      input.seasonYear,
      input.raceId,
      input.team.id,
      driver.id,
    ));
    const driverBase = driverSpecificEstimate(sharedEstimate, driver, uncertainty, driverRng, engineerProfile);
    const requestedQualifying = applyPhilosophy(driverBase, philosophy, 'qualifying', driverRng);
    const requestedRace = applyPhilosophy(driverBase, philosophy, 'race', driverRng);
    const finalSetups = lockedWeekendCompromise(requestedQualifying, requestedRace, input);
    const technical = rating01(driver.ratings.technical);
    const incidentLoss = driverRng.chance(clamp(0.13 - preparationScore / 1000, 0.025, 0.12))
      ? driverRng.range(0.12, 0.35)
      : 0;
    const driverKnowledge = round(clamp01(sharedKnowledge + (technical - 0.5) * 0.16 - incidentLoss));
    const practiceLaps = Math.max(0, Math.round(baseLaps * driverRng.range(0.82, 1.03)));
    drivers[driver.id] = {
      driverId: driver.id,
      practicedSetup: driverBase,
      qualifyingSetup: finalSetups.qualifying,
      raceSetup: finalSetups.race,
      practiceLaps,
      setupKnowledge: driverKnowledge,
      ranQualifyingSimulation: practicePrograms.includes('QualifyingSimulation'),
      ranRacePace: practicePrograms.includes('RacePaceRun') || practicePrograms.includes('FuelLoadTest'),
      ranWetPreparation: practicePrograms.includes('WetWeatherPreparation'),
    };
  }

  const rules = selectRaceRuleProfile(input.series, input.seasonYear, input.track);
  return {
    raceId: input.raceId,
    teamId: input.team.id,
    philosophy,
    preparationScore,
    sharedKnowledge,
    uncertainty,
    practicePrograms,
    setupLockMode: rules.setupLock.mode,
    drivers,
  };
}

export function buildAIEngineeringRuntime(
  plan: AIEngineeringWeekendPlan,
  driver: Driver,
  car: Car,
  track: Track,
  trim: 'qualifying' | 'race',
  raceWet: boolean,
): AIEngineeringRuntime | undefined {
  const driverPlan = plan.drivers[driver.id];
  if (!driverPlan) return undefined;
  const setup = trim === 'qualifying' ? driverPlan.qualifyingSetup : driverPlan.raceSetup;
  const quality = objectiveSetupQuality(setup, track, car);
  const comfort = driverSetupComfort({
    driver,
    currentSetup: setup,
    practicedSetup: driverPlan.practicedSetup,
    practiceLaps: driverPlan.practiceLaps,
    setupKnowledge: driverPlan.setupKnowledge,
    ranQualiSim: driverPlan.ranQualifyingSimulation,
    ranRacePace: driverPlan.ranRacePace,
    ranWetPrep: driverPlan.ranWetPreparation,
    raceWet,
  });
  const confidenceBonus = (driverPlan.setupKnowledge - 0.5) * 12;
  return {
    setup,
    quality,
    comfort,
    confidenceBonus,
    profile: buildTunedSetupSimulationProfile(setup, track, car, {
      ...(quality.snapshot ? { snapshot: quality.snapshot } : {}),
      comfort,
      confidenceBonus,
    }),
  };
}
