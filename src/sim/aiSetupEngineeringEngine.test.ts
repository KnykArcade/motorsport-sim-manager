import { describe, expect, it } from 'vitest';

import { selectRaceRuleProfile } from '../data/rules/raceRuleProfiles';
import { cars1995 } from '../data/cars/cars1995';
import { drivers1995 } from '../data/drivers/drivers1995';
import { teams1995 } from '../data/teams/teams1995';
import { tracks1995 } from '../data/tracks/tracks1995';
import type { AIEngineeringPlanInput } from './aiSetupEngineeringEngine';
import type { RaceWeekendPackageType } from '../types/raceWeekendPackageTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import type { CarSetup } from '../types/setupTypes';
import { idealSetup, objectiveSetupQuality } from './setupFitEngine';
import { validateSetupChange } from './setupLockEngine';
import { weekendForecast } from './weatherEngine';
import {
  buildAIEngineeringRuntime,
  buildAIEngineeringWeekendPlan,
} from './aiSetupEngineeringEngine';

const team = teams1995[0];
const car = cars1995.find((candidate) => candidate.teamId === team.id)!;
const drivers = drivers1995.filter((driver) => driver.teamId === team.id);
const track = tracks1995.find((candidate) => /interlagos|jose carlos pace/i.test(candidate.name))
  ?? tracks1995[0];

function organization(rating: number): TeamOrganizationRatings {
  return {
    teamId: team.id,
    carPerformance: rating,
    marketing: rating,
    research: rating,
    facilities: rating,
    scouting: rating,
    fanSupport: rating,
    mediaReach: rating,
    financialStability: rating,
    staffQuality: rating,
    driverAppeal: rating,
    sponsorAppeal: rating,
    operations: rating,
    reliabilityDepartment: rating,
    pitCrew: rating,
    youthAcademy: rating,
    overallTeamRating: rating,
  };
}

function packageSelection(packageType: RaceWeekendPackageType) {
  return {
    packageType,
    raceId: 'race-1',
    gpName: track.gpName,
    cost: 1,
    teamScale: 1,
    trackModifier: 1,
    packageModifier: 1,
    damageReserve: 1,
  };
}

function input(
  seed = 'ai-engineering-test',
  overrides: Partial<AIEngineeringPlanInput> = {},
): AIEngineeringPlanInput {
  return {
    seed,
    raceId: 'race-1',
    raceRound: 12,
    seasonYear: 1995,
    series: 'F1',
    track,
    team,
    car,
    drivers,
    organization: organization(65),
    packageSelection: packageSelection('Standard'),
    archetype: 'AmbitiousBuilder',
    philosophyTraits: ['DataDriven', 'Disciplined'],
    championshipPosition: 3,
    teamCount: 12,
    totalRounds: 17,
    ...overrides,
  };
}

function distance(a: CarSetup, b: CarSetup): number {
  const keys = Object.keys(a) as (keyof CarSetup)[];
  return keys.reduce((sum, key) => sum + Math.abs(a[key] - b[key]), 0) / keys.length;
}

describe('AI setup engineering', () => {
  it('is deterministic for a fixed team, weekend and seed', () => {
    expect(buildAIEngineeringWeekendPlan(input())).toEqual(buildAIEngineeringWeekendPlan(input()));
  });

  it('creates a physical driver plan for every entrant', () => {
    const plan = buildAIEngineeringWeekendPlan(input());
    expect(Object.keys(plan.drivers).sort()).toEqual(drivers.map((driver) => driver.id).sort());
    for (const driverPlan of Object.values(plan.drivers)) {
      expect(Object.values(driverPlan.qualifyingSetup).every(Number.isFinite)).toBe(true);
      expect(Object.values(driverPlan.raceSetup).every((value) => value >= 1 && value <= 10)).toBe(true);
    }
  });

  it('keeps a non-zero knowledge error instead of returning the hidden perfect setup', () => {
    const elite = buildAIEngineeringWeekendPlan(input('elite', {
      team: { ...team, raceOperations: 100 },
      organization: organization(100),
      packageSelection: packageSelection('FullAttack'),
    }));
    const hiddenTarget = idealSetup(track, undefined, car);
    for (const driverPlan of Object.values(elite.drivers)) {
      expect(distance(driverPlan.practicedSetup, hiddenTarget)).toBeGreaterThan(0.05);
    }
  });

  it('shares team knowledge while allowing teammate setups to diverge', () => {
    const plan = buildAIEngineeringWeekendPlan(input());
    const [first, second] = drivers.map((driver) => plan.drivers[driver.id]);
    expect(first.setupKnowledge).toBeGreaterThan(0);
    expect(second.setupKnowledge).toBeGreaterThan(0);
    expect(first.qualifyingSetup).not.toEqual(second.qualifyingSetup);
    expect(distance(first.practicedSetup, second.practicedSetup)).toBeLessThan(1.25);
  });

  it('makes better engineering organizations statistically find better setups', () => {
    let eliteQuality = 0;
    let weakQuality = 0;
    let weakExcellentWeekends = 0;
    for (let index = 0; index < 48; index += 1) {
      const seed = `quality-${index}`;
      const elite = buildAIEngineeringWeekendPlan(input(seed, {
        team: { ...team, raceOperations: 94 },
        organization: organization(94),
      }));
      const weak = buildAIEngineeringWeekendPlan(input(seed, {
        team: { ...team, raceOperations: 22 },
        organization: organization(22),
      }));
      const eliteWeekend = objectiveSetupQuality(
        elite.drivers[drivers[0].id].raceSetup,
        track,
        car,
      ).quality;
      const weakWeekend = objectiveSetupQuality(
        weak.drivers[drivers[0].id].raceSetup,
        track,
        car,
      ).quality;
      eliteQuality += eliteWeekend;
      weakQuality += weakWeekend;
      if (weakWeekend >= 90) weakExcellentWeekends += 1;
    }
    expect(eliteQuality / 48).toBeGreaterThan(weakQuality / 48 + 0.6);
    expect(weakExcellentWeekends).toBeGreaterThan(0);
  });

  it('severely limits preparation for a mandatory-minimum package', () => {
    const normal = buildAIEngineeringWeekendPlan(input('package'));
    const minimum = buildAIEngineeringWeekendPlan(input('package', {
      packageSelection: packageSelection('MandatoryMinimum'),
    }));
    expect(minimum.practicePrograms).toEqual([]);
    expect(minimum.preparationScore).toBeLessThan(normal.preparationScore);
    expect(minimum.sharedKnowledge).toBeLessThan(normal.sharedKnowledge);
    expect(minimum.uncertainty).toBeGreaterThan(normal.uncertainty);
  });

  it('chooses a qualifying tradeoff when an attack plan wins the engineering brief', () => {
    const attack = Array.from({ length: 80 }, (_, index) => buildAIEngineeringWeekendPlan(input(
      `attack-${index}`,
      {
        raceRound: 16,
        championshipPosition: 1,
        archetype: 'AggressiveSpender',
        philosophyTraits: ['RiskTaker', 'TechnicalInnovator'],
        packageSelection: packageSelection('FullAttack'),
      },
    ))).find((plan) => plan.philosophy === 'QualifyingAttack');
    expect(attack).toBeDefined();
    const driverPlan = attack!.drivers[drivers[0].id];
    expect(driverPlan.qualifyingSetup.tyreUsage).toBeGreaterThan(driverPlan.raceSetup.tyreUsage);
    expect(driverPlan.qualifyingSetup.engineCooling).toBeLessThanOrEqual(driverPlan.raceSetup.engineCooling);
  });

  it('protects cooling and tyre usage when a fragile car drives a reliability brief', () => {
    const fragileCar = { ...car, ratings: { ...car.ratings, reliability: 1 } };
    const plan = buildAIEngineeringWeekendPlan(input('fragile', {
      car: fragileCar,
      archetype: 'SurvivalMode',
      packageSelection: packageSelection('Conservative'),
      championshipPosition: 12,
    }));
    expect(plan.philosophy).toBe('ReliabilityProtection');
    const driverPlan = plan.drivers[drivers[0].id];
    expect(driverPlan.raceSetup.engineCooling).toBeGreaterThan(driverPlan.practicedSetup.engineCooling);
    expect(driverPlan.raceSetup.tyreUsage).toBeLessThan(driverPlan.practicedSetup.tyreUsage);
  });

  it('adds wet preparation when the deterministic forecast warrants it', () => {
    const wetSeed = Array.from({ length: 500 }, (_, index) => `wet-${index}`).find((seed) =>
      Object.values(weekendForecast(track, `${seed}-r12`)).some(
        (session) => session.wet || session.changingSoon,
      ));
    expect(wetSeed).toBeDefined();
    const plan = buildAIEngineeringWeekendPlan(input(wetSeed!, {
      car: { ...car, ratings: { ...car.ratings, reliability: 100 } },
      organization: organization(80),
    }));
    expect(plan.practicePrograms).toContain('WetWeatherPreparation');
  });

  it('validates every parc-ferme race setup against the shared lock engine', () => {
    const modern = input('parc-ferme', { seasonYear: 2026 });
    const plan = buildAIEngineeringWeekendPlan(modern);
    const rules = selectRaceRuleProfile('F1', 2026, track);
    expect(plan.setupLockMode).toBe('ParcFerme');
    for (const driverPlan of Object.values(plan.drivers)) {
      expect(validateSetupChange(
        rules,
        'AfterQualifying',
        driverPlan.qualifyingSetup,
        driverPlan.raceSetup,
      ).allowed).toBe(true);
    }
  });

  it('validates impound-era adjustments without secretly replacing the race car', () => {
    const impound = input('impound', { series: 'NASCAR', seasonYear: 2005 });
    const plan = buildAIEngineeringWeekendPlan(impound);
    const rules = selectRaceRuleProfile('NASCAR', 2005, track);
    expect(plan.setupLockMode).toBe('Impound');
    for (const driverPlan of Object.values(plan.drivers)) {
      const validation = validateSetupChange(
        rules,
        'AfterQualifying',
        driverPlan.qualifyingSetup,
        driverPlan.raceSetup,
      );
      expect(validation.allowed).toBe(true);
      expect(validation.blockedParams).toEqual([]);
    }
  });

  it('builds authoritative profiles that can never add pace above car potential', () => {
    const plan = buildAIEngineeringWeekendPlan(input());
    for (const driver of drivers) {
      const runtime = buildAIEngineeringRuntime(plan, driver, car, track, 'race', false)!;
      expect(runtime.profile.source).toBe('tuned');
      for (const envelope of Object.values(runtime.profile.sessions)) {
        expect(envelope.physicalPaceDelta).toBeLessThanOrEqual(0);
        expect(envelope.driverExtractionDelta).toBeLessThanOrEqual(0);
        expect(envelope.paceDelta).toBeLessThanOrEqual(0);
      }
    }
  });
});
