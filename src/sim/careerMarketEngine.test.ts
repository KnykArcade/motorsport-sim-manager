import { describe, it, expect } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { getMarketBundle, normalizeName } from '../data';
import type { MasterDriverEntry, RegistryBaseRatings } from '../types/registryTypes';
import type { Series } from '../types/gameTypes';
import {
  ageInYear,
  isRetiredByAge,
  isAdultAvailable,
  isYouthAvailable,
  careerMarketBundle,
  marketRolloverChanges,
  entryToMarketDriver,
  entryToYouthProspect,
  RETIRE_AGE,
} from './careerMarketEngine';

function baseRatings(v: number): RegistryBaseRatings {
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
    overall: v,
    potential: v + 1,
  };
}

function entry(over: Partial<MasterDriverEntry> = {}): MasterDriverEntry {
  const series: Series[] = over.eligibleSeries ?? ['F1'];
  return {
    driverId: over.driverId ?? 'test-driver',
    canonicalName: over.canonicalName ?? 'test driver',
    displayName: over.displayName ?? 'Test Driver',
    nationality: 'GBR',
    birthYear: over.birthYear,
    startingAge: over.startingAge,
    preferredSeries: 'F1',
    eligibleSeries: series,
    secondarySeriesInterest: [],
    seriesExperience: { F1: 1 },
    willingnessToSwitchSeries: 50,
    careerStatus: over.careerStatus ?? 'adult_free_agent',
    academyEligibleYear: over.academyEligibleYear,
    adultEligibleYear: over.adultEligibleYear,
    marketEntryYear: over.marketEntryYear ?? 2000,
    potential: 70,
    baseRatings: baseRatings(60),
    baseRatingsByYear: [],
    traits: [],
    sponsorBacking: 0,
    payDriverFunding: 0,
    marketValue: 3,
    salaryDemand: 2,
    sourceIds: ['s-1'],
    firstSeenYear: over.firstSeenYear ?? 2000,
    lastSeenYear: over.lastSeenYear ?? 2000,
    ...over,
  };
}

describe('age + retirement', () => {
  it('derives age from birth year or starting age', () => {
    expect(ageInYear(entry({ birthYear: 1980 }), 2005)).toBe(25);
    expect(ageInYear(entry({ birthYear: undefined, startingAge: 22, firstSeenYear: 2000 }), 2005)).toBe(27);
    expect(ageInYear(entry({ birthYear: undefined, startingAge: undefined }), 2005)).toBeUndefined();
  });

  it('retires drivers past the retirement age', () => {
    expect(isRetiredByAge(entry({ birthYear: 2000 }), 2000 + RETIRE_AGE)).toBe(false);
    expect(isRetiredByAge(entry({ birthYear: 2000 }), 2000 + RETIRE_AGE + 1)).toBe(true);
    expect(isRetiredByAge(entry({ retirementYear: 2010 }), 2011)).toBe(true);
  });
});

describe('availability windows', () => {
  it('makes adult drivers available universe-wide after market entry', () => {
    const e = entry({ marketEntryYear: 2005, birthYear: 1985 }); // age 20 in 2005
    expect(isAdultAvailable(e, 2004, 'F1')).toBe(false); // before entry
    expect(isAdultAvailable(e, 2005, 'F1')).toBe(true);
    expect(isAdultAvailable(e, 2005, 'IndyCar')).toBe(true); // preference affects interest, not eligibility
  });

  it('youth available within the academy window, then ages out', () => {
    const e = entry({
      careerStatus: 'youth_pool',
      academyEligibleYear: 2000,
      adultEligibleYear: 2003,
      birthYear: 1985,
      marketEntryYear: 2003,
    });
    expect(isYouthAvailable(e, 1999, 'F1')).toBe(false); // before academy year
    expect(isYouthAvailable(e, 2001, 'F1')).toBe(true);
    expect(isYouthAvailable(e, 2003, 'F1')).toBe(false); // aged into adult market
    expect(isAdultAvailable(e, 2003, 'F1')).toBe(true);
  });

  it('hides under-12 prospects from the youth pool', () => {
    // academy-eligible early but only 10/11 years old — not yet in any market.
    const e = entry({
      careerStatus: 'youth_pool',
      academyEligibleYear: 1995,
      adultEligibleYear: 2003,
      birthYear: 1985,
      marketEntryYear: 2003,
    });
    expect(isYouthAvailable(e, 1995, 'F1')).toBe(false); // age 10
    expect(isYouthAvailable(e, 1996, 'F1')).toBe(false); // age 11
    expect(isYouthAvailable(e, 1997, 'F1')).toBe(true); // age 12
  });
});

describe('entry → market/youth shapes', () => {
  it('produces stable reg- prefixed ids', () => {
    const e = entry({ driverId: 'ayrton-senna', birthYear: 1980 });
    expect(entryToMarketDriver(e, 2005).id).toBe('reg-ayrton-senna');
    expect(entryToYouthProspect(e, 1996).id).toBe('reg-ayrton-senna');
  });
});

describe('careerMarketBundle (real career state)', () => {
  const state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'mkt-seed',
  });

  it('keeps the curated season pool and adds registry free agents', () => {
    const staticBundle = getMarketBundle(1995, 'F1')!;
    const living = careerMarketBundle(state);
    // The adult pool never shrinks below the curated drivers (youth are
    // normalized by age, so under-12 curated youth are hidden).
    expect(living.drivers.length).toBeGreaterThanOrEqual(staticBundle.drivers.length);
    expect(living.youth.length).toBeGreaterThan(0);
    // Some registry-sourced entries were added.
    expect(living.drivers.some((d) => d.id.startsWith('reg-'))).toBe(true);
  });

  it('never lists a driver already racing on the grid', () => {
    const living = careerMarketBundle(state);
    const gridNames = new Set(state.drivers.map((d) => normalizeName(d.name)));
    for (const d of living.drivers) {
      expect(gridNames.has(normalizeName(d.name))).toBe(false);
    }
  });

  it('has unique ids in the living pool', () => {
    const living = careerMarketBundle(state);
    const ids = living.drivers.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never reintroduces generated market fillers through the registry', () => {
    const living = careerMarketBundle(state);
    expect([...living.drivers, ...living.youth].every(
      (entry) => !/generated|synthetic|filler|placeholder/i.test(`${entry.name} ${entry.notes ?? ''}`),
    )).toBe(true);
    expect(living.youth.some((entry) => entry.id.startsWith('gen-yth-'))).toBe(false);
  });

  it('only lists youth aged 12–17 and never in both youth and adult pools', () => {
    const living = careerMarketBundle(state);
    for (const y of living.youth) {
      const age = 1995 - y.birthYear;
      expect(age).toBeGreaterThanOrEqual(12);
      expect(age).toBeLessThanOrEqual(17);
    }
    // No prospect appears in both the youth and adult market simultaneously.
    const youthNames = new Set(living.youth.map((y) => normalizeName(y.name)));
    for (const d of living.drivers) {
      expect(youthNames.has(normalizeName(d.name))).toBe(false);
    }
  });
});

describe('marketRolloverChanges', () => {
  const state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'roll-seed',
  });

  it('reports market movement across the rollover deterministically', () => {
    const a = marketRolloverChanges(state, 1996);
    const b = marketRolloverChanges(state, 1996);
    expect(a.newAdults.map((e) => e.driverId)).toEqual(b.newAdults.map((e) => e.driverId));
    // The four buckets are disjoint sets of driver ids.
    const all = [
      ...a.newAdults,
      ...a.newYouth,
      ...a.promotedYouth,
      ...a.retirements,
    ].map((e) => e.driverId);
    expect(new Set(all).size).toBe(all.length);
  });
});
