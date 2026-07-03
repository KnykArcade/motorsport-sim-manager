import { describe, it, expect } from 'vitest';
import {
  generateConfidenceDramaNews,
  generateTrustInCarDramaNews,
  generateTrustInTeamDramaNews,
  generateEgoDramaNews,
  generatePromiseDramaNews,
  generateTeammateRivalryDramaNews,
  generateContractDramaNews,
  generateDriverDramaNews,
  type DramaNewsContext,
} from './driverDramaNewsEngine';
import type { DriverRelationship, DriverPromise } from '../types/relationshipTypes';
import type { ConfidenceUpdate, RaceEventContext, PromiseResolution } from './driverConfidenceEngine';

const ctx: DramaNewsContext = {
  season: 1995,
  round: 5,
  gpName: 'Monaco GP',
  driverNames: { d1: 'Michael Schumacher', d2: 'Damon Hill', d3: 'Gerhard Berger' },
  teamNames: { t1: 'Benetton', t2: 'Williams' },
};

function makeRel(overrides: Partial<DriverRelationship> = {}): DriverRelationship {
  return {
    driverId: 'd1',
    teamId: 't1',
    teammateId: 'd2',
    teamLoyalty: 60,
    engineerChemistry: 55,
    teammateRelationship: 50,
    morale: 60,
    frustration: 30,
    numberOneExpectation: false,
    selfConfidence: 55,
    trustInCar: 50,
    trustInTeam: 55,
    trustInPrincipal: 50,
    ego: 50,
    personalityTraits: [],
    wants: [],
    ...overrides,
  };
}

function makeRaceCtx(overrides: Partial<RaceEventContext> = {}): RaceEventContext {
  return {
    driverId: 'd1',
    finishingPosition: 3,
    totalDrivers: 20,
    qualifiedPosition: 2,
    dnf: false,
    teamOrderIssued: false,
    wasFavoredInOrders: false,
    wasDisadvantagedInOrders: false,
    carReliabilityDNF: false,
    strategyRiskLevel: 'balanced',
    pointsScored: 6,
    podium: true,
    win: false,
    ...overrides,
  };
}

describe('driverDramaNewsEngine', () => {
  describe('generateConfidenceDramaNews', () => {
    it('generates surge news for major confidence gain', () => {
      const prev = makeRel({ selfConfidence: 50 });
      const rel = makeRel({ selfConfidence: 65 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', selfConfidenceDelta: 10 }];
      const news = generateConfidenceDramaNews(ctx, rel, updates, prev);
      expect(news.some((n) => n.headline.includes('Riding High'))).toBe(true);
    });

    it('generates collapse news for major confidence loss', () => {
      const prev = makeRel({ selfConfidence: 60 });
      const rel = makeRel({ selfConfidence: 48 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', selfConfidenceDelta: -10 }];
      const news = generateConfidenceDramaNews(ctx, rel, updates, prev);
      expect(news.some((n) => n.headline.includes('Pressure Builds'))).toBe(true);
    });

    it('generates young belief news when crossing 60 threshold', () => {
      const prev = makeRel({ selfConfidence: 55 });
      const rel = makeRel({ selfConfidence: 62 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', selfConfidenceDelta: 7 }];
      const news = generateConfidenceDramaNews(ctx, rel, updates, prev);
      expect(news.some((n) => n.headline.includes('Finding Another Gear'))).toBe(true);
    });

    it('generates veteran frustration news for high frustration + low confidence', () => {
      const prev = makeRel({ frustration: 65, selfConfidence: 45 });
      const rel = makeRel({ frustration: 75, selfConfidence: 35 });
      const updates: ConfidenceUpdate[] = [
        { driverId: 'd1', frustrationDelta: 10, selfConfidenceDelta: -10 },
      ];
      const news = generateConfidenceDramaNews(ctx, rel, updates, prev);
      expect(news.some((n) => n.headline.includes('Visible Frustration'))).toBe(true);
    });

    it('generates morale win news after teammate comparison', () => {
      const prev = makeRel({ morale: 55 });
      const rel = makeRel({ morale: 62 });
      const updates: ConfidenceUpdate[] = [
        { driverId: 'd1', moraleDelta: 7, reason: 'beat teammate' },
      ];
      const news = generateConfidenceDramaNews(ctx, rel, updates, prev);
      expect(news.some((n) => n.headline.includes('Lifted By Getting The Better'))).toBe(true);
    });

    it('generates morale drop news for low morale after loss', () => {
      const prev = makeRel({ morale: 42 });
      const rel = makeRel({ morale: 35 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', moraleDelta: -7 }];
      const news = generateConfidenceDramaNews(ctx, rel, updates, prev);
      expect(news.some((n) => n.headline.includes('Feeling The Strain'))).toBe(true);
    });

    it('does not generate news for small confidence changes', () => {
      const prev = makeRel({ selfConfidence: 55 });
      const rel = makeRel({ selfConfidence: 57 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', selfConfidenceDelta: 2 }];
      const news = generateConfidenceDramaNews(ctx, rel, updates, prev);
      expect(news.length).toBe(0);
    });
  });

  describe('generateTrustInCarDramaNews', () => {
    it('generates DNF reliability news after car failure', () => {
      const rel = makeRel({ trustInCar: 40 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', trustInCarDelta: -8 }];
      const raceCtx = makeRaceCtx({ dnf: true, carReliabilityDNF: true, finishingPosition: 99 });
      const news = generateTrustInCarDramaNews(ctx, rel, updates, raceCtx);
      expect(news.some((n) => n.headline.includes('Questions Reliability'))).toBe(true);
    });

    it('generates breakthrough news for big trust gain', () => {
      const rel = makeRel({ trustInCar: 55 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', trustInCarDelta: 10 }];
      const news = generateTrustInCarDramaNews(ctx, rel, updates, makeRaceCtx());
      expect(news.some((n) => n.headline.includes('Finally Found Something'))).toBe(true);
    });

    it('generates questioning news for very low car trust and poor finish', () => {
      const rel = makeRel({ trustInCar: 25 });
      const updates: ConfidenceUpdate[] = [];
      const raceCtx = makeRaceCtx({ finishingPosition: 12 });
      const news = generateTrustInCarDramaNews(ctx, rel, updates, raceCtx);
      expect(news.some((n) => n.headline.includes("Can't Fight At The Sharp End") || n.headline.includes('Can Fight'))).toBe(true);
    });
  });

  describe('generateTrustInTeamDramaNews', () => {
    it('generates positive principal news after good strategy', () => {
      const rel = makeRel({ trustInPrincipal: 55 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', trustInPrincipalDelta: 6 }];
      const raceCtx = makeRaceCtx({ pointsScored: 10 });
      const news = generateTrustInTeamDramaNews(ctx, rel, updates, raceCtx);
      expect(news.some((n) => n.headline.includes('Credits Team Principal'))).toBe(true);
    });

    it('generates negative principal news after poor strategy', () => {
      const rel = makeRel({ trustInPrincipal: 45 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', trustInPrincipalDelta: -6 }];
      const news = generateTrustInTeamDramaNews(ctx, rel, updates, makeRaceCtx());
      expect(news.some((n) => n.headline.includes('Questions Strategy'))).toBe(true);
    });

    it('generates team orders negative news for disadvantaged driver', () => {
      const rel = makeRel({ trustInTeam: 50 });
      const updates: ConfidenceUpdate[] = [];
      const raceCtx = makeRaceCtx({ teamOrderIssued: true, wasDisadvantagedInOrders: true });
      const news = generateTrustInTeamDramaNews(ctx, rel, updates, raceCtx);
      expect(news.some((n) => n.headline.includes('Unhappy After Being Asked'))).toBe(true);
    });

    it('generates team orders positive news for favored driver', () => {
      const rel = makeRel({ trustInTeam: 55 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', trustInTeamDelta: 1 }];
      const raceCtx = makeRaceCtx({ teamOrderIssued: true, wasFavoredInOrders: true });
      const news = generateTrustInTeamDramaNews(ctx, rel, updates, raceCtx);
      expect(news.some((n) => n.headline.includes('Welcomes Team Support'))).toBe(true);
    });
  });

  describe('generateEgoDramaNews', () => {
    it('generates number-one demand for high-ego disadvantaged driver', () => {
      const rel = makeRel({ ego: 75, numberOneExpectation: true });
      const updates: ConfidenceUpdate[] = [];
      const raceCtx = makeRaceCtx({ teamOrderIssued: true, wasDisadvantagedInOrders: true });
      const news = generateEgoDramaNews(ctx, rel, updates, raceCtx);
      expect(news.some((n) => n.headline.includes('Number-One Status'))).toBe(true);
    });

    it('generates ego surge news after win', () => {
      const rel = makeRel({ ego: 60 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', egoDelta: 4 }];
      const raceCtx = makeRaceCtx({ win: true, finishingPosition: 1 });
      const news = generateEgoDramaNews(ctx, rel, updates, raceCtx);
      expect(news.some((n) => n.headline.includes('Confidence Soars'))).toBe(true);
    });
  });

  describe('generatePromiseDramaNews', () => {
    it('generates kept promise news', () => {
      const promise: DriverPromise = {
        id: 'p1',
        driverId: 'd1',
        promiseType: 'equal_treatment',
        dueSeason: 1995,
        dueRound: 5,
        status: 'active',
        madeSeason: 1995,
        madeRound: 3,
        trustImpact: 5,
        moraleImpact: 5,
      };
      const resolutions: PromiseResolution[] = [
        { promise, fulfilled: true, reason: 'Podium delivered' },
      ];
      const news = generatePromiseDramaNews(ctx, 'd1', 't1', resolutions, []);
      expect(news.some((n) => n.headline.includes('Praises Team After Promise'))).toBe(true);
    });

    it('generates broken promise news', () => {
      const promise: DriverPromise = {
        id: 'p2',
        driverId: 'd1',
        promiseType: 'equal_treatment',
        dueSeason: 1995,
        dueRound: 5,
        status: 'active',
        madeSeason: 1995,
        madeRound: 3,
        trustImpact: 5,
        moraleImpact: 5,
      };
      const resolutions: PromiseResolution[] = [
        { promise, fulfilled: false, reason: 'No podium' },
      ];
      const news = generatePromiseDramaNews(ctx, 'd1', 't1', resolutions, []);
      expect(news.some((n) => n.headline.includes('Broken Promise'))).toBe(true);
    });
  });

  describe('generateTeammateRivalryDramaNews', () => {
    it('generates tension news after team orders with low relationship', () => {
      const rel = makeRel({ teammateRelationship: 30 });
      const raceCtx = makeRaceCtx({ teamOrderIssued: true });
      const news = generateTeammateRivalryDramaNews(ctx, rel, raceCtx, []);
      expect(news.some((n) => n.headline.includes('Internal Tension'))).toBe(true);
    });

    it('generates clean teamwork news for high relationship and points', () => {
      const rel = makeRel({ teammateRelationship: 75 });
      const raceCtx = makeRaceCtx({ pointsScored: 6, teamOrderIssued: false });
      const news = generateTeammateRivalryDramaNews(ctx, rel, raceCtx, []);
      expect(news.some((n) => n.headline.includes('Praises Teammate'))).toBe(true);
    });
  });

  describe('generateContractDramaNews', () => {
    it('generates leaving news for very low trust and loyalty', () => {
      const rel = makeRel({ trustInTeam: 20, teamLoyalty: 25 });
      const news = generateContractDramaNews(ctx, rel);
      expect(news.some((n) => n.headline.includes("Exploring Options"))).toBe(true);
    });

    it('generates new deal news for high confidence and morale', () => {
      const rel = makeRel({ selfConfidence: 80, morale: 75, teamLoyalty: 65 });
      const news = generateContractDramaNews(ctx, rel);
      expect(news.some((n) => n.headline.includes('New Deal'))).toBe(true);
    });

    it('generates loyalty news for very high loyalty and trust', () => {
      const rel = makeRel({ teamLoyalty: 85, trustInPrincipal: 80 });
      const news = generateContractDramaNews(ctx, rel);
      expect(news.some((n) => n.headline.includes('Commits To Project'))).toBe(true);
    });
  });

  describe('generateDriverDramaNews (master)', () => {
    it('deduplicates news items by ID', () => {
      const prev = makeRel({ selfConfidence: 50 });
      const rel = makeRel({ selfConfidence: 65 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', selfConfidenceDelta: 10 }];
      const raceCtx = makeRaceCtx();

      const news = generateDriverDramaNews(ctx, {
        relationships: { d1: rel },
        prevRelationships: { d1: prev },
        confidenceUpdates: { d1: updates },
        raceContexts: { d1: raceCtx },
        promiseResolutions: {},
        expiredPromises: [],
        allPromises: [],
        teamOrderConsequences: [],
        teamOrders: [],
      });

      const ids = news.map((n) => n.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('returns empty array when no race contexts', () => {
      const rel = makeRel();
      const news = generateDriverDramaNews(ctx, {
        relationships: { d1: rel },
        prevRelationships: { d1: rel },
        confidenceUpdates: {},
        raceContexts: {},
        promiseResolutions: {},
        expiredPromises: [],
        allPromises: [],
        teamOrderConsequences: [],
        teamOrders: [],
      });
      expect(news.length).toBe(0);
    });

    it('all items have paddock category', () => {
      const prev = makeRel({ selfConfidence: 50 });
      const rel = makeRel({ selfConfidence: 65 });
      const updates: ConfidenceUpdate[] = [{ driverId: 'd1', selfConfidenceDelta: 10 }];
      const raceCtx = makeRaceCtx();

      const news = generateDriverDramaNews(ctx, {
        relationships: { d1: rel },
        prevRelationships: { d1: prev },
        confidenceUpdates: { d1: updates },
        raceContexts: { d1: raceCtx },
        promiseResolutions: {},
        expiredPromises: [],
        allPromises: [],
        teamOrderConsequences: [],
        teamOrders: [],
      });

      expect(news.every((n) => n.category === 'paddock')).toBe(true);
    });
  });
});
