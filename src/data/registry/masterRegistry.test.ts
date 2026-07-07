import { describe, it, expect } from 'vitest';
import type { Driver, Series } from '../../types/gameTypes';
import type { MarketDriver, MarketSkillRatings, YouthProspect } from '../../types/marketTypes';
import {
  normalizeName,
  slugifyName,
  sanitizeMarketName,
  careerPhaseForAge,
  canonicalNameOf,
  importSeasonDrivers,
  importMarketDrivers,
  importYouthProspects,
  buildMasterRegistry,
  getMasterRegistry,
  registryList,
} from './masterRegistry';
import type { MasterDriverRegistry } from '../../types/registryTypes';

function skills(v: number): MarketSkillRatings {
  return {
    cornering: v,
    braking: v,
    straights: v,
    tractionAcceleration: v,
    elevationBlindCorners: v,
    technical: v,
    overtakingRacecraft: v,
    surfaceGripBumpiness: v,
    riskManagement: v,
    enduranceConsistency: v,
  };
}

function gridDriver(id: string, name: string, overall: number, extra: Partial<Driver> = {}): Driver {
  return {
    id,
    name,
    number: 1,
    nationality: 'GBR',
    teamId: 't-x',
    ratings: {
      ...skills(overall),
      qualifying: overall,
      racePace: overall,
      adaptability: overall,
      aggression: 5,
      composure: overall,
      overall,
    },
    morale: 65,
    confidence: 65,
    traits: [],
    ...extra,
  };
}

function marketDriver(id: string, name: string, o: Partial<MarketDriver> = {}): MarketDriver {
  return {
    id,
    name,
    age: 25,
    nationality: 'BRA',
    context: 'F3000',
    marketPool: 'senior',
    marketStatus: 'available',
    primaryRole: 'race',
    immediateF1Eligible: true,
    skills: skills(6),
    overall: 6,
    potential: 7,
    potentialDelta: 1,
    developmentRate: 1,
    f1Readiness: 80,
    salary: 2,
    sponsorValue: 1,
    buyoutCost: 3,
    negotiationDifficulty: 'medium',
    suggestedUse: 'race',
    notes: '',
    ...o,
  };
}

function youth(id: string, name: string, o: Partial<YouthProspect> = {}): YouthProspect {
  return {
    id,
    name,
    age: 16,
    birthYear: 1979,
    nationality: 'FIN',
    currentLevel: 'karting',
    marketPool: 'youth',
    marketStatus: 'available',
    academyEligibleNow: true,
    earliestFullAcademyYear: 1995,
    skills: skills(4),
    overall: 4,
    potential: 9,
    potentialDelta: 5,
    developmentRate: 2,
    yearsUntilF1Ready: 4,
    signingCost: 0.1,
    yearlyAcademyCost: 0.05,
    riskLevel: 'medium',
    suggestedPath: 'academy',
    notes: '',
    ...o,
  };
}

const empty = (): MasterDriverRegistry => ({ byId: {}, order: [] });

describe('name normalization', () => {
  it('strips diacritics, punctuation and case', () => {
    expect(normalizeName('Kimi Räikkönen')).toBe('kimi raikkonen');
    expect(normalizeName('Jean-Éric Vergne')).toBe('jean eric vergne');
    expect(slugifyName('Kimi Räikkönen')).toBe('kimi-raikkonen');
  });
});

describe('careerPhaseForAge', () => {
  it('buckets ages into phases', () => {
    expect(careerPhaseForAge(16)).toBe('prospect');
    expect(careerPhaseForAge(20)).toBe('rising');
    expect(careerPhaseForAge(27)).toBe('peak');
    expect(careerPhaseForAge(33)).toBe('veteran');
    expect(careerPhaseForAge(38)).toBe('twilight');
  });
});

describe('import + dedup', () => {
  it('creates a new entry for an unseen driver', () => {
    const reg = empty();
    const res = importSeasonDrivers(reg, [gridDriver('d-95-jb', 'Jenson Button', 6, { age: 20 })], 2000, 'F1');
    expect(res.created).toHaveLength(1);
    expect(res.merged).toHaveLength(0);
    const e = registryList(reg)[0];
    expect(e.driverId).toBe('jenson-button');
    expect(e.canonicalName).toBe('jenson button');
    expect(e.careerStatus).toBe('active_driver');
    expect(e.birthYear).toBe(1980);
  });

  it('merges the same real driver across seasons under one id (different source ids)', () => {
    const reg = empty();
    importSeasonDrivers(reg, [gridDriver('d-2000-jenson', 'Jenson Button', 6, { age: 20 })], 2000, 'F1');
    const res = importSeasonDrivers(reg, [gridDriver('d-2001-jenson', 'Jenson Button', 7, { age: 21 })], 2001, 'F1');
    expect(res.created).toHaveLength(0);
    expect(res.merged).toEqual(['jenson-button']);
    const list = registryList(reg);
    expect(list).toHaveLength(1);
    const e = list[0];
    expect(e.sourceIds).toEqual(['d-2000-jenson', 'd-2001-jenson']);
    expect(e.baseRatingsByYear.map((s) => s.year)).toEqual([2000, 2001]);
    expect(e.firstSeenYear).toBe(2000);
    expect(e.lastSeenYear).toBe(2001);
    expect(e.baseRatings.overall).toBe(7); // most-recent wins
  });

  it('re-importing the same source id is idempotent', () => {
    const reg = empty();
    const d = gridDriver('d-2000-jenson', 'Jenson Button', 6, { age: 20 });
    importSeasonDrivers(reg, [d], 2000, 'F1');
    importSeasonDrivers(reg, [d], 2000, 'F1');
    const e = registryList(reg)[0];
    expect(e.sourceIds).toEqual(['d-2000-jenson']);
    expect(e.baseRatingsByYear).toHaveLength(1);
  });

  it('merges a youth prospect and a later grid appearance into one identity', () => {
    const reg = empty();
    importYouthProspects(reg, [youth('yth-kimi', 'Kimi Räikkönen', { age: 16, birthYear: 1979 })], 1995, 'F1');
    const res = importSeasonDrivers(reg, [gridDriver('d-2001-kimi', 'Kimi Raikkonen', 8, { age: 22 })], 2001, 'F1');
    expect(res.merged).toEqual(['kimi-raikkonen']);
    const e = registryList(reg)[0];
    expect(e.careerStatus).toBe('active_driver'); // upgraded from youth_pool
    expect(e.academyEligibleYear).toBe(1995);
    expect(e.adultEligibleYear).toBe(1997); // 1979 + 18
    expect(e.birthYear).toBe(1979);
  });

  it('separates two distinct people who share a name via birth year', () => {
    const reg = empty();
    importMarketDrivers(reg, [marketDriver('m-a', 'John Smith', { age: 30 })], 2000, 'F1'); // born 1970
    importMarketDrivers(reg, [marketDriver('m-b', 'John Smith', { age: 20 })], 2000, 'F1'); // born 1980
    const list = registryList(reg);
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.driverId).sort()).toEqual(['john-smith', 'john-smith-2']);
  });

  it('tracks cross-series eligibility + experience', () => {
    const reg = empty();
    importSeasonDrivers(reg, [gridDriver('f1-x', 'Cross Driver', 7, { age: 26 })], 2026, 'F1');
    importSeasonDrivers(reg, [gridDriver('indy-x', 'Cross Driver', 7, { age: 26 })], 2026, 'IndyCar');
    const e = registryList(reg)[0];
    expect(e.eligibleSeries.sort()).toEqual(['F1', 'IndyCar'] as Series[]);
    expect(e.seriesExperience).toEqual({ F1: 1, IndyCar: 1 });
  });
});

describe('buildMasterRegistry (real seed data)', () => {
  const reg = buildMasterRegistry();
  const list = registryList(reg);

  it('produces a non-trivial, de-duplicated registry', () => {
    expect(list.length).toBeGreaterThan(100);
    const ids = new Set(list.map((e) => e.driverId));
    expect(ids.size).toBe(list.length); // ids unique
  });

  it('collapses a multi-season driver into one entry with many snapshots', () => {
    const schumi = reg.byId['michael-schumacher'];
    expect(schumi).toBeDefined();
    // Appears across many F1 seasons in the seed data.
    expect(schumi.baseRatingsByYear.length).toBeGreaterThan(1);
    expect(schumi.firstSeenYear).toBeLessThan(schumi.lastSeenYear);
  });

  it('is deterministic and memoized', () => {
    const a = getMasterRegistry();
    const b = getMasterRegistry();
    expect(a).toBe(b);
    const fresh = buildMasterRegistry();
    expect(registryList(fresh).map((e) => e.driverId)).toEqual(list.map((e) => e.driverId));
  });

  it('has no duplicate canonical names or name-suffixed ids', () => {
    const byName = new Map<string, number>();
    for (const e of list) byName.set(e.canonicalName, (byName.get(e.canonicalName) ?? 0) + 1);
    const dupNames = [...byName.entries()].filter(([, n]) => n > 1).map(([name]) => name);
    expect(dupNames).toEqual([]);
    // Age-recording noise used to split one driver across "-2"-suffixed ids.
    const suffixed = list.filter((e) => /-\d+$/.test(e.driverId)).map((e) => e.driverId);
    expect(suffixed).toEqual([]);
  });

  it('unifies drivers previously split by age-recording noise', () => {
    // These real drivers were each recorded with slightly inconsistent ages
    // across season files and used to appear twice in the registry.
    for (const id of [
      'nick-heidfeld',
      'fernando-alonso',
      'kimi-raikkonen',
      'mark-webber',
      'ralf-schumacher',
      'jarno-trulli',
      'juan-pablo-montoya',
    ]) {
      expect(list.filter((e) => e.driverId === id)).toHaveLength(1);
    }
  });
});

describe('sanitizeMarketName', () => {
  it('strips trailing market tags from a driver name', () => {
    expect(sanitizeMarketName('Jean Alesi Contract Watch')).toBe('Jean Alesi');
    expect(sanitizeMarketName('Gerhard Berger Contract Watch')).toBe('Gerhard Berger');
    expect(sanitizeMarketName('Damon Hill (Contract Watch)')).toBe('Damon Hill');
    expect(sanitizeMarketName('Mika Häkkinen - Silly Season')).toBe('Mika Häkkinen');
  });

  it('leaves a clean name untouched and never empties a name', () => {
    expect(sanitizeMarketName('Michael Schumacher')).toBe('Michael Schumacher');
    expect(sanitizeMarketName('Contract Watch')).toBe('Contract Watch');
  });
});

describe('canonical aliases', () => {
  it('resolves abbreviated names to their canonical full form', () => {
    expect(canonicalNameOf('M. Schumacher')).toBe('michael schumacher');
    expect(canonicalNameOf('J. Herbert')).toBe('johnny herbert');
    expect(canonicalNameOf('M. Salo')).toBe('mika salo');
    expect(canonicalNameOf('U. Katayama')).toBe('ukyo katayama');
    expect(canonicalNameOf('D Hill')).toBe('damon hill');
    expect(canonicalNameOf('D. Hill')).toBe('damon hill');
    expect(canonicalNameOf('d hill')).toBe('damon hill');
    expect(canonicalNameOf('d. hill')).toBe('damon hill');
  });

  it('leaves unabbreviated names unchanged', () => {
    expect(canonicalNameOf('Michael Schumacher')).toBe('michael schumacher');
    expect(canonicalNameOf('Johnny Herbert')).toBe('johnny herbert');
  });

  it('merges abbreviated and full-name entries into one registry identity', () => {
    const reg = empty();
    importSeasonDrivers(reg, [gridDriver('d-1994-ms', 'Michael Schumacher', 8, { age: 25 })], 1994, 'F1');
    importSeasonDrivers(reg, [gridDriver('d-1995-ms', 'M. Schumacher', 9, { age: 26 })], 1995, 'F1');
    const list = registryList(reg);
    expect(list).toHaveLength(1);
    expect(list[0].driverId).toBe('michael-schumacher');
    expect(list[0].sourceIds).toEqual(['d-1994-ms', 'd-1995-ms']);
    expect(list[0].baseRatingsByYear.map((s) => s.year)).toEqual([1994, 1995]);
  });

  it('real registry has no duplicate entries for aliased drivers', () => {
    const reg = buildMasterRegistry();
    const list = registryList(reg);
    // M. Schumacher (1995) should merge with Michael Schumacher.
    expect(list.filter((e) => e.driverId === 'michael-schumacher')).toHaveLength(1);
    const schumi = list.find((e) => e.driverId === 'michael-schumacher')!;
    expect(schumi.baseRatingsByYear.length).toBeGreaterThan(1);
    // J. Herbert (1995) should merge with Johnny Herbert.
    expect(list.filter((e) => e.driverId === 'johnny-herbert')).toHaveLength(1);
    // M. Salo (1995) should merge with Mika Salo.
    expect(list.filter((e) => e.driverId === 'mika-salo')).toHaveLength(1);
    // U. Katayama (1995) should merge with Ukyo Katayama.
    expect(list.filter((e) => e.driverId === 'ukyo-katayama')).toHaveLength(1);
    // D Hill / D. Hill should merge with Damon Hill.
    expect(list.filter((e) => e.driverId === 'damon-hill')).toHaveLength(1);
  });

  it('merges D Hill and Damon Hill into one registry identity', () => {
    const reg = empty();
    importSeasonDrivers(reg, [gridDriver('d-1994-dh', 'Damon Hill', 8, { age: 33 })], 1994, 'F1');
    importSeasonDrivers(reg, [gridDriver('d-1997-dh', 'D Hill', 7, { age: 36 })], 1997, 'F1');
    const list = registryList(reg);
    expect(list).toHaveLength(1);
    expect(list[0].driverId).toBe('damon-hill');
    expect(list[0].sourceIds).toEqual(['d-1994-dh', 'd-1997-dh']);
  });
});
