import { describe, it, expect } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { normalizeName, getMasterRegistry } from '../data';
import { getSeasonBundle } from '../data/seasonData';
import type { MasterDriverEntry, RegistryBaseRatings } from '../types/registryTypes';
import type { Series } from '../types/gameTypes';
import {
  SERIES_PRESTIGE,
  seriesPrestige,
  refinedWillingness,
  crossSeriesInterest,
  willingToSign,
  crossSeriesCandidates,
  type SeriesOffer,
} from './crossSeriesEngine';

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
  const eligible: Series[] = over.eligibleSeries ?? ['F1'];
  return {
    driverId: 'test-driver',
    canonicalName: 'test driver',
    displayName: 'Test Driver',
    nationality: 'GBR',
    birthYear: 1985,
    preferredSeries: 'F1',
    secondarySeriesInterest: [],
    seriesExperience: { F1: 3 },
    willingnessToSwitchSeries: 50,
    careerStatus: 'adult_free_agent',
    marketEntryYear: 2005,
    potential: 8,
    baseRatingsByYear: [],
    traits: [],
    sponsorBacking: 0,
    payDriverFunding: 0,
    marketValue: 4,
    salaryDemand: 3,
    sourceIds: ['s-1'],
    firstSeenYear: 2005,
    lastSeenYear: 2005,
    ...over,
    eligibleSeries: eligible,
    baseRatings: baseRatings(over.baseRatings?.overall ?? 7),
  };
}

function offer(over: Partial<SeriesOffer> = {}): SeriesOffer {
  return {
    series: 'IndyCar',
    teamReputation: 60,
    carCompetitiveness: 6,
    salary: 3,
    contractYears: 3,
    ...over,
  };
}

describe('series prestige', () => {
  it('ranks F1 above IndyCar', () => {
    expect(SERIES_PRESTIGE.F1).toBeGreaterThan(SERIES_PRESTIGE.IndyCar);
    expect(seriesPrestige('F1')).toBe(100);
  });
});

describe('refinedWillingness', () => {
  it('is higher without a seat than with one', () => {
    const e = entry();
    expect(refinedWillingness(e, 2010, false)).toBeGreaterThan(refinedWillingness(e, 2010, true));
  });
});

describe('crossSeriesInterest', () => {
  const year = 2010;

  it('increases with salary', () => {
    const e = entry();
    const low = crossSeriesInterest(e, year, false, offer({ salary: 1 }));
    const high = crossSeriesInterest(e, year, false, offer({ salary: 8 }));
    expect(high).toBeGreaterThan(low);
  });

  it('increases with a stronger, more competitive team', () => {
    const e = entry();
    const weak = crossSeriesInterest(e, year, false, offer({ teamReputation: 20, carCompetitiveness: 2 }));
    const strong = crossSeriesInterest(e, year, false, offer({ teamReputation: 95, carCompetitiveness: 9 }));
    expect(strong).toBeGreaterThan(weak);
  });

  it('a seatless driver is more open to a foreign switch than a seated one', () => {
    const e = entry();
    const seatless = crossSeriesInterest(e, year, false, offer());
    const seated = crossSeriesInterest(e, year, true, offer());
    expect(seatless).toBeGreaterThan(seated);
  });

  it('a top driver rarely joins a weak foreign team; a journeyman is keener', () => {
    const elite = entry({ baseRatings: baseRatings(9.5) });
    const journeyman = entry({ baseRatings: baseRatings(6.2) });
    const weakOffer = offer({ series: 'IndyCar', teamReputation: 25, carCompetitiveness: 2, salary: 2 });
    const eliteInterest = crossSeriesInterest(elite, year, true, weakOffer);
    const journeymanInterest = crossSeriesInterest(journeyman, year, true, weakOffer);
    expect(eliteInterest).toBeLessThan(journeymanInterest);
    expect(willingToSign(elite, year, true, weakOffer)).toBe(false);
  });

  it('an offer in the preferred series scores higher than a foreign one', () => {
    const e = entry({ preferredSeries: 'F1', eligibleSeries: ['F1'] });
    const home = crossSeriesInterest(e, year, false, offer({ series: 'F1' }));
    const foreign = crossSeriesInterest(e, year, false, offer({ series: 'IndyCar' }));
    expect(home).toBeGreaterThan(foreign);
  });

  it('stays within 0-100', () => {
    const e = entry();
    const v = crossSeriesInterest(e, year, false, offer({ salary: 100, teamReputation: 100, carCompetitiveness: 10 }));
    expect(v).toBeLessThanOrEqual(100);
    expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe('crossSeriesCandidates (real career)', () => {
  it('surfaces foreign-series drivers open to switching, tagged and de-conflicted', () => {
    const teamId = getSeasonBundle(2026, 'F1')!.teams[0].id;
    const real = createNewGame({
      gameMode: 'Career',
      seasonYear: 2026,
      series: 'F1',
      teamId,
      seed: 'cross-seed',
    });
    const cands = crossSeriesCandidates(real);
    expect(cands.length).toBeGreaterThan(0);
    const gridNames = new Set(real.drivers.map((d) => normalizeName(d.name)));
    for (const c of cands) {
      expect(c.marketPool).toBe('crossSeries');
      // Not already racing in this career.
      expect(gridNames.has(normalizeName(c.name))).toBe(false);
      // Not eligible for this series in the registry (those are in the normal market).
      const e = getMasterRegistry().byId[c.id.replace(/^reg-/, '')];
      expect(e?.eligibleSeries.includes('F1')).toBe(false);
    }
  });
});
