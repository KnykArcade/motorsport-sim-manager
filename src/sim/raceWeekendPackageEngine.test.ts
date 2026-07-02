import { describe, it, expect } from 'vitest';

import type { Team, Track } from '../types/gameTypes';
import type { AIPackageContext, RaceWeekendPackageType } from '../types/raceWeekendPackageTypes';
import {
  RACE_WEEKEND_PACKAGES,
  SERIES_PACKAGE_RULES,
  availablePackagesForSeries,
  isPackageAvailable,
  computeRaceWeekendPackageCost,
  computeAllPackageCosts,
  packageEffects,
  packageOpsFormBonus,
  teamScaleTier,
  teamScaleModifier,
  trackCostClass,
  trackCostModifier,
  damageReserve,
  aiSelectPackage,
  formatPackageCost,
} from './raceWeekendPackageEngine';
import { MILLION } from './financeEngine';

// --- Fixtures ---

const eliteTeam: Team = {
  id: 'ferrari',
  name: 'Ferrari',
  shortName: 'FER',
  carId: 'ferrari-car',
  driverIds: ['a', 'b'],
  budget: 50 * MILLION,
  reputation: 90,
  raceOperations: 8,
  morale: 75,
  color: '#dc0000',
};

const backmarkerTeam: Team = {
  id: 'minardi',
  name: 'Minardi',
  shortName: 'MIN',
  carId: 'minardi-car',
  driverIds: ['c', 'd'],
  budget: 5 * MILLION,
  reputation: 25,
  raceOperations: 4,
  morale: 50,
  color: '#0066cc',
};

const normalTrack: Track = {
  id: 'monza',
  name: 'Monza',
  gpName: 'Italian GP',
  archetype: 'High-Speed Circuit',
  attributes: {
    corners: 5,
    braking: 7,
    straights: 9,
    tractionAcceleration: 4,
    elevationBlindCorners: 2,
    technical: 3,
    overtakingRacecraft: 8,
    surfaceGripBumpiness: 3,
    riskWallProximity: 5,
    enduranceConsistency: 5,
  },
  setupProfile: {
    primarySetupProfile: 'low-wing',
    downforceLevel: 'low',
    topSpeedEmphasis: 9,
    mechanicalGripEmphasis: 3,
    brakeDemand: 6,
    reliabilityRiskFocus: 4,
    strategyNotes: 'Flat out',
    aeroDemand: 2,
    powerDemand: 9,
    mechanicalDemand: 3,
    riskDemand: 5,
  },
  ratingNotes: 'Temple of Speed',
};

const streetTrack: Track = {
  id: 'monaco',
  name: 'Monaco',
  gpName: 'Monaco GP',
  archetype: 'Street Circuit',
  attributes: {
    corners: 9,
    braking: 6,
    straights: 2,
    tractionAcceleration: 8,
    elevationBlindCorners: 5,
    technical: 9,
    overtakingRacecraft: 2,
    surfaceGripBumpiness: 7,
    riskWallProximity: 9,
    enduranceConsistency: 4,
  },
  setupProfile: {
    primarySetupProfile: 'high-wing',
    downforceLevel: 'high',
    topSpeedEmphasis: 2,
    mechanicalGripEmphasis: 8,
    brakeDemand: 7,
    reliabilityRiskFocus: 3,
    strategyNotes: 'Tight and twisty',
    aeroDemand: 9,
    powerDemand: 2,
    mechanicalDemand: 8,
    riskDemand: 9,
  },
  ratingNotes: 'The jewel in the crown',
};

const highRiskTrack: Track = {
  id: 'spa',
  name: 'Spa-Francorchamps',
  gpName: 'Belgian GP',
  archetype: 'High-Risk Circuit',
  attributes: {
    corners: 7,
    braking: 5,
    straights: 6,
    tractionAcceleration: 7,
    elevationBlindCorners: 9,
    technical: 7,
    overtakingRacecraft: 6,
    surfaceGripBumpiness: 4,
    riskWallProximity: 8,
    enduranceConsistency: 8,
  },
  setupProfile: {
    primarySetupProfile: 'balanced',
    downforceLevel: 'medium',
    topSpeedEmphasis: 6,
    mechanicalGripEmphasis: 6,
    brakeDemand: 5,
    reliabilityRiskFocus: 6,
    strategyNotes: 'Eau Rouge is flat',
    aeroDemand: 6,
    powerDemand: 7,
    mechanicalDemand: 6,
    riskDemand: 8,
  },
  ratingNotes: 'Ardennes rollercoaster',
};

// --- Tests ---

describe('Race Weekend Package — package definitions', () => {
  it('all package types have definitions', () => {
    const allTypes: RaceWeekendPackageType[] = [
      'FullAttack', 'Standard', 'Conservative', 'Budget',
      'DevelopmentTest', 'StartAndPark', 'SkipRace',
    ];
    for (const t of allTypes) {
      expect(RACE_WEEKEND_PACKAGES[t]).toBeDefined();
      expect(RACE_WEEKEND_PACKAGES[t].type).toBe(t);
      expect(RACE_WEEKEND_PACKAGES[t].label).toBeTruthy();
      expect(RACE_WEEKEND_PACKAGES[t].description).toBeTruthy();
    }
  });

  it('Standard package has neutral effects', () => {
    const e = packageEffects('Standard');
    expect(e.paceModifier).toBe(0);
    expect(e.reliabilityPrep).toBe(0);
    expect(e.pitCrewPrep).toBe(0);
    expect(e.sponsorSatisfaction).toBe(0);
    expect(e.driverMorale).toBe(0);
  });

  it('FullAttack has positive pace and prep', () => {
    const e = packageEffects('FullAttack');
    expect(e.paceModifier).toBeGreaterThan(0);
    expect(e.reliabilityPrep).toBeGreaterThan(0);
    expect(e.pitCrewPrep).toBeGreaterThan(0);
    expect(e.sponsorSatisfaction).toBeGreaterThan(0);
  });

  it('Budget has negative pace and prep', () => {
    const e = packageEffects('Budget');
    expect(e.paceModifier).toBeLessThan(0);
    expect(e.reliabilityPrep).toBeLessThan(0);
    expect(e.pitCrewPrep).toBeLessThan(0);
    expect(e.sponsorSatisfaction).toBeLessThan(0);
  });

  it('Conservative reduces crash risk', () => {
    const e = packageEffects('Conservative');
    expect(e.crashRiskMultiplier).toBeLessThan(1);
    expect(e.paceModifier).toBeLessThan(0);
  });

  it('DevelopmentTest has higher data gain', () => {
    const e = packageEffects('DevelopmentTest');
    expect(e.developmentDataGain).toBeGreaterThan(1);
  });

  it('SkipRace has zero cost modifier and major penalties', () => {
    const def = RACE_WEEKEND_PACKAGES['SkipRace'];
    expect(def.costModifier).toBe(0);
    expect(def.effects.sponsorSatisfaction).toBeLessThan(-20);
    expect(def.effects.driverMorale).toBeLessThan(-10);
  });

  it('packageOpsFormBonus averages reliability and pit crew prep', () => {
    expect(packageOpsFormBonus('Standard')).toBe(0);
    expect(packageOpsFormBonus('FullAttack')).toBeCloseTo(
      (packageEffects('FullAttack').reliabilityPrep + packageEffects('FullAttack').pitCrewPrep) / 2,
    );
  });
});

describe('Race Weekend Package — series rules', () => {
  it('F1 allows core packages but not StartAndPark or SkipRace', () => {
    const available = availablePackagesForSeries('F1');
    expect(available).toContain('FullAttack');
    expect(available).toContain('Standard');
    expect(available).toContain('Conservative');
    expect(available).toContain('Budget');
    expect(available).toContain('DevelopmentTest');
    expect(available).not.toContain('StartAndPark');
    expect(available).not.toContain('SkipRace');
  });

  it('IndyCar allows core packages but not StartAndPark or SkipRace', () => {
    const available = availablePackagesForSeries('IndyCar');
    expect(available).toContain('FullAttack');
    expect(available).toContain('Standard');
    expect(available).not.toContain('StartAndPark');
    expect(available).not.toContain('SkipRace');
  });

  it('isPackageAvailable checks correctly', () => {
    expect(isPackageAvailable('FullAttack', 'F1')).toBe(true);
    expect(isPackageAvailable('SkipRace', 'F1')).toBe(false);
    expect(isPackageAvailable('StartAndPark', 'F1')).toBe(false);
  });

  it('F1 has higher base cost than IndyCar', () => {
    expect(SERIES_PACKAGE_RULES.F1.baseWeekendCost).toBeGreaterThan(
      SERIES_PACKAGE_RULES.IndyCar.baseWeekendCost,
    );
  });
});

describe('Race Weekend Package — team scale', () => {
  it('elite team gets Elite tier', () => {
    expect(teamScaleTier(eliteTeam)).toBe('Elite');
  });

  it('backmarker team gets Backmarker tier', () => {
    expect(teamScaleTier(backmarkerTeam)).toBe('Backmarker');
  });

  it('elite team scale modifier is higher than backmarker', () => {
    expect(teamScaleModifier(eliteTeam)).toBeGreaterThan(teamScaleModifier(backmarkerTeam));
  });
});

describe('Race Weekend Package — track cost class', () => {
  it('normal track is Normal class', () => {
    expect(trackCostClass(normalTrack)).toBe('Normal');
  });

  it('street circuit is Street class', () => {
    expect(trackCostClass(streetTrack)).toBe('Street');
  });

  it('high-risk circuit is HighDamageRisk class', () => {
    expect(trackCostClass(highRiskTrack)).toBe('HighDamageRisk');
  });

  it('street track has higher cost modifier than normal', () => {
    expect(trackCostModifier(streetTrack)).toBeGreaterThan(trackCostModifier(normalTrack));
  });
});

describe('Race Weekend Package — cost formula', () => {
  it('Standard package cost = base × teamScale × trackMod × 1.0 + damageReserve', () => {
    const result = computeRaceWeekendPackageCost('F1', eliteTeam, normalTrack, 'Standard');
    const expectedBase = 2.5 * MILLION;
    const expectedCost = Math.round(
      expectedBase * teamScaleModifier(eliteTeam) * trackCostModifier(normalTrack) * 1.0 +
      damageReserve('F1', normalTrack, 'Standard'),
    );
    expect(result.cost).toBe(expectedCost);
  });

  it('FullAttack costs more than Standard', () => {
    const standard = computeRaceWeekendPackageCost('F1', eliteTeam, normalTrack, 'Standard');
    const fullAttack = computeRaceWeekendPackageCost('F1', eliteTeam, normalTrack, 'FullAttack');
    expect(fullAttack.cost).toBeGreaterThan(standard.cost);
  });

  it('Budget costs less than Standard', () => {
    const standard = computeRaceWeekendPackageCost('F1', eliteTeam, normalTrack, 'Standard');
    const budget = computeRaceWeekendPackageCost('F1', eliteTeam, normalTrack, 'Budget');
    expect(budget.cost).toBeLessThan(standard.cost);
  });

  it('Elite team pays more than backmarker for same package', () => {
    const elite = computeRaceWeekendPackageCost('F1', eliteTeam, normalTrack, 'Standard');
    const backmarker = computeRaceWeekendPackageCost('F1', backmarkerTeam, normalTrack, 'Standard');
    expect(elite.cost).toBeGreaterThan(backmarker.cost);
  });

  it('Street track costs more than normal track', () => {
    const normal = computeRaceWeekendPackageCost('F1', eliteTeam, normalTrack, 'Standard');
    const street = computeRaceWeekendPackageCost('F1', eliteTeam, streetTrack, 'Standard');
    expect(street.cost).toBeGreaterThan(normal.cost);
  });

  it('SkipRace costs zero', () => {
    const result = computeRaceWeekendPackageCost('F1', eliteTeam, normalTrack, 'SkipRace');
    expect(result.cost).toBe(0);
  });

  it('damage reserve is zero for SkipRace', () => {
    expect(damageReserve('F1', normalTrack, 'SkipRace')).toBe(0);
  });

  it('damage reserve is higher for FullAttack than Budget', () => {
    const faReserve = damageReserve('F1', normalTrack, 'FullAttack');
    const budgetReserve = damageReserve('F1', normalTrack, 'Budget');
    expect(faReserve).toBeGreaterThan(budgetReserve);
  });

  it('damage reserve is higher for street track than normal track', () => {
    const streetReserve = damageReserve('F1', streetTrack, 'Standard');
    const normalReserve = damageReserve('F1', normalTrack, 'Standard');
    expect(streetReserve).toBeGreaterThan(normalReserve);
  });

  it('computeAllPackageCosts returns costs for all available packages', () => {
    const allCosts = computeAllPackageCosts('F1', eliteTeam, normalTrack);
    const available = availablePackagesForSeries('F1');
    for (const pkg of available) {
      expect(allCosts[pkg]).toBeDefined();
      expect(allCosts[pkg].cost).toBeGreaterThan(0);
    }
  });
});

describe('Race Weekend Package — AI selection', () => {
  const baseCtx: AIPackageContext = {
    teamBudget: 20 * MILLION,
    financialHealth: 'Stable',
    archetype: 'AmbitiousBuilder',
    risk: 0.6,
    championshipPosition: 3,
    teamCount: 12,
    carReliability: 7,
    raceImportance: 0.5,
    isLateSeason: false,
    damageRiskTrack: false,
  };

  it('returns a valid package type for F1', () => {
    const pkg = aiSelectPackage(baseCtx, 'F1', 'test-seed', 'ferrari', 1);
    expect(availablePackagesForSeries('F1')).toContain(pkg);
  });

  it('deterministic for the same seed and context', () => {
    const a = aiSelectPackage(baseCtx, 'F1', 'test-seed', 'ferrari', 1);
    const b = aiSelectPackage(baseCtx, 'F1', 'test-seed', 'ferrari', 1);
    expect(a).toBe(b);
  });

  it('different seed produces potentially different results', () => {
    // Run many seeds and check we get variety
    const results = new Set<RaceWeekendPackageType>();
    for (let i = 0; i < 100; i++) {
      results.add(aiSelectPackage(baseCtx, 'F1', `seed-${i}`, 'ferrari', 1));
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it('critical financial health pushes toward Budget/Conservative', () => {
    const criticalCtx: AIPackageContext = {
      ...baseCtx,
      financialHealth: 'Critical',
      teamBudget: 1 * MILLION,
    };
    const results: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const pkg = aiSelectPackage(criticalCtx, 'F1', `seed-${i}`, 'minardi', 1);
      results[pkg] = (results[pkg] ?? 0) + 1;
    }
    // Budget should be selected more often than FullAttack
    expect((results['Budget'] ?? 0)).toBeGreaterThan((results['FullAttack'] ?? 0));
  });

  it('championship contender with high race importance favors FullAttack', () => {
    const contenderCtx: AIPackageContext = {
      ...baseCtx,
      championshipPosition: 1,
      raceImportance: 0.9,
      risk: 0.8,
      financialHealth: 'Excellent',
    };
    const results: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const pkg = aiSelectPackage(contenderCtx, 'F1', `seed-${i}`, 'ferrari', 1);
      results[pkg] = (results[pkg] ?? 0) + 1;
    }
    // FullAttack should be the most common
    expect((results['FullAttack'] ?? 0)).toBeGreaterThan((results['Budget'] ?? 0));
  });

  it('survival mode archetype favors Budget', () => {
    const survivalCtx: AIPackageContext = {
      ...baseCtx,
      archetype: 'SurvivalMode',
      financialHealth: 'AtRisk',
      teamBudget: 2 * MILLION,
      championshipPosition: 10,
    };
    const results: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const pkg = aiSelectPackage(survivalCtx, 'F1', `seed-${i}`, 'minardi', 1);
      results[pkg] = (results[pkg] ?? 0) + 1;
    }
    expect((results['Budget'] ?? 0)).toBeGreaterThan((results['FullAttack'] ?? 0));
  });

  it('development-focused archetype at non-key race favors DevelopmentTest', () => {
    const devCtx: AIPackageContext = {
      ...baseCtx,
      archetype: 'DevelopmentFocused',
      raceImportance: 0.2,
      championshipPosition: 8,
    };
    const results: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const pkg = aiSelectPackage(devCtx, 'F1', `seed-${i}`, 'team-dev', 1);
      results[pkg] = (results[pkg] ?? 0) + 1;
    }
    expect((results['DevelopmentTest'] ?? 0)).toBeGreaterThan((results['FullAttack'] ?? 0));
  });

  it('low car reliability leans Conservative', () => {
    const fragileCtx: AIPackageContext = {
      ...baseCtx,
      carReliability: 3,
    };
    const results: Record<string, number> = {};
    for (let i = 0; i < 200; i++) {
      const pkg = aiSelectPackage(fragileCtx, 'F1', `seed-${i}`, 'fragile-team', 1);
      results[pkg] = (results[pkg] ?? 0) + 1;
    }
    // Conservative should be selected more than FullAttack
    expect((results['Conservative'] ?? 0)).toBeGreaterThan((results['FullAttack'] ?? 0));
  });
});

describe('Race Weekend Package — formatting', () => {
  it('formatPackageCost formats in $M', () => {
    expect(formatPackageCost(2.5 * MILLION)).toBe('$2.50M');
    expect(formatPackageCost(0)).toBe('$0.00M');
    expect(formatPackageCost(1_250_000)).toBe('$1.25M');
  });
});
