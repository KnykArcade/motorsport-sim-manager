import { describe, it, expect } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { advanceSeason } from '../game/seasonRollover';
import { runAIOffseason, type AIOffseasonInput } from './aiOffseasonEngine';
import type { GameState } from '../game/careerState';
import type { Car, Driver, Team } from '../types/gameTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import type { AITeamState } from '../types/aiTeamTypes';
import type { AcademyMember, MarketDriver, MarketSkillRatings } from '../types/marketTypes';

const M = 1_000_000;

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

function team(over: Partial<Team> = {}): Team {
  return {
    id: 't-ai',
    name: 'AI Team',
    shortName: 'AIT',
    carId: 'c-ai',
    driverIds: [],
    budget: 60 * M,
    reputation: 55,
    raceOperations: 5,
    morale: 60,
    color: '#fff',
    ...over,
  };
}

function car(over: Partial<Car> = {}): Car {
  return {
    id: 'c-ai',
    teamId: 't-ai',
    seasonYear: 1996,
    ratings: {
      enginePower: 60,
      aeroEfficiency: 40, // weakest → development target
      mechanicalGrip: 60,
      reliability: 60,
      pitCrewOperations: 60,
    },
    condition: 100,
    developmentLevel: {
      enginePower: 0,
      aeroEfficiency: 0,
      mechanicalGrip: 0,
      reliability: 0,
      pitCrewOperations: 0,
    },
    ...over,
  };
}

function seatDriver(id: string, overall: number, over: Partial<Driver> = {}): Driver {
  return {
    id,
    name: id,
    number: Number(id.replace(/\D/g, '')) || 1,
    teamId: 't-ai',
    ratings: {
      cornering: overall,
      braking: overall,
      straights: overall,
      tractionAcceleration: overall,
      elevationBlindCorners: overall,
      technical: overall,
      overtakingRacecraft: overall,
      surfaceGripBumpiness: overall,
      riskManagement: overall,
      enduranceConsistency: overall,
      qualifying: overall,
      racePace: overall,
      adaptability: overall,
      aggression: overall,
      composure: overall,
      overall,
    },
    morale: 60,
    confidence: 60,
    contractYearsRemaining: 1,
    salary: 3,
    traits: [],
    ...over,
  };
}

function marketDriver(id: string, overall: number, over: Partial<MarketDriver> = {}): MarketDriver {
  return {
    id,
    name: id,
    age: 26,
    nationality: '—',
    context: 'Free agent',
    marketPool: 'registry',
    marketStatus: 'available',
    primaryRole: 'race',
    immediateF1Eligible: true,
    skills: skills(overall),
    overall,
    potential: overall,
    potentialDelta: 0,
    developmentRate: 1,
    f1Readiness: 100,
    salary: 3,
    sponsorValue: 0,
    buyoutCost: 1,
    negotiationDifficulty: 'medium',
    suggestedUse: 'race',
    notes: '',
    ...over,
  };
}

function budget(over: Partial<AITeamState['budget']> = {}): AITeamState['budget'] {
  return {
    startingCash: 60 * M,
    sponsorIncome: 40 * M,
    prizeMoney: 20 * M,
    driverSalaries: 6 * M,
    staffSalaries: 8 * M,
    developmentSpend: 15 * M,
    facilitySpend: 5 * M,
    engineCost: 6 * M,
    operatingCost: 8 * M,
    testingCost: 2 * M,
    academyCost: 1 * M,
    sponsorPenalty: 0,
    otherInvestment: 0,
    totalExpenses: 33 * M,
    netResult: 7 * M,
    projectedCash: 67 * M,
    reserveTarget: 10 * M,
    ...over,
  };
}

function aiState(over: Partial<AITeamState> = {}): AITeamState {
  return {
    teamId: 't-ai',
    archetype: 'AmbitiousBuilder',
    financialHealth: 'Stable',
    goal: 'MidfieldImprovement',
    budget: budget(),
    seasonsInTrouble: 0,
    ...over,
  };
}

function org(over: Partial<TeamOrganizationRatings> = {}): TeamOrganizationRatings {
  const base = 55;
  return {
    teamId: 't-ai',
    carPerformance: base,
    marketing: base,
    research: base,
    facilities: base,
    scouting: base,
    fanSupport: base,
    mediaReach: base,
    financialStability: base,
    staffQuality: base,
    driverAppeal: base,
    sponsorAppeal: base,
    operations: base,
    reliabilityDepartment: base,
    pitCrew: base,
    youthAcademy: base,
    overallTeamRating: base,
    ...over,
  };
}

function baseInput(over: Partial<AIOffseasonInput> = {}): AIOffseasonInput {
  return {
    nextYear: 1996,
    seed: 'test-seed',
    selectedTeamId: 't-player',
    teams: [team()],
    drivers: [seatDriver('d1', 6), seatDriver('d2', 6)],
    cars: [car()],
    engine: undefined,
    aiTeamStates: { 't-ai': aiState() },
    aiAcademies: {},
    orgRatings: { 't-ai': org() },
    market: { drivers: [], youth: [] },
    signedMarketIds: [],
    reservedNames: new Set(),
    constructorStandings: [],
    ...over,
  };
}

describe('runAIOffseason — driver market', () => {
  it('fills an empty race seat from the market', () => {
    const input = baseInput({
      drivers: [seatDriver('d1', 6)], // only one seat filled
      market: { drivers: [marketDriver('reg-x', 7)], youth: [] },
    });
    const result = runAIOffseason(input);
    const seats = result.drivers.filter((d) => d.teamId === 't-ai' && d.contractType !== 'reserve');
    expect(seats.length).toBe(2);
    expect(result.signedMarketIds).toContain('reg-x');
    expect(result.notes.some((n) => /fill an empty race seat/.test(n))).toBe(true);
  });

  it('never signs a player-reserved identity', () => {
    const input = baseInput({
      drivers: [seatDriver('d1', 6)],
      market: { drivers: [marketDriver('reg-star', 9, { name: 'Star Player' })], youth: [] },
      reservedNames: new Set(['star player']),
    });
    const result = runAIOffseason(input);
    expect(result.signedMarketIds).not.toContain('reg-star');
    expect(result.drivers.some((d) => d.name === 'Star Player')).toBe(false);
  });

  it('promotes an existing reserve before shopping the market for an empty seat', () => {
    const reserve = seatDriver('res1', 7, { contractType: 'reserve', number: 40 });
    const input = baseInput({
      drivers: [seatDriver('d1', 6), reserve],
      teams: [team({ driverIds: ['d1', 'res1'] })],
      market: { drivers: [marketDriver('reg-x', 9)], youth: [] },
    });
    const result = runAIOffseason(input);
    const promoted = result.drivers.find((d) => d.id === 'res1');
    expect(promoted?.contractType).toBe('seat');
    expect(result.signedMarketIds).not.toContain('reg-x');
  });
});

describe('runAIOffseason — development', () => {
  it('applies development to a car without decreasing any rating', () => {
    const input = baseInput({
      aiTeamStates: {
        't-ai': aiState({ archetype: 'AggressiveSpender', budget: budget({ developmentSpend: 30 * M }) }),
      },
    });
    const result = runAIOffseason(input);
    const c = result.cars[0];
    // Never regresses a rating; the weakest area (aero) is the dev target.
    expect(c.ratings.aeroEfficiency).toBeGreaterThanOrEqual(40);
    expect(c.ratings.enginePower).toBeGreaterThanOrEqual(59.5);
  });

  it('does no development when there is no development budget', () => {
    const input = baseInput({
      aiTeamStates: { 't-ai': aiState({ budget: budget({ developmentSpend: 0 }) }) },
    });
    const result = runAIOffseason(input);
    expect(result.cars[0].ratings.aeroEfficiency).toBeCloseTo(39.8, 1);
    expect(result.notes.some((n) => /development package/.test(n))).toBe(false);
  });
});

describe('runAIOffseason — youth academy & first option', () => {
  function member(over: Partial<AcademyMember> = {}): AcademyMember {
    return {
      id: 'aca-1',
      prospectId: 'p1',
      name: 'Young Gun',
      nationality: '—',
      birthYear: 1978, // age 18 in 1996
      academyTeamId: 't-ai',
      skills: skills(70),
      overall: 70,
      potential: 90,
      developmentRate: 1,
      yearsUntilF1Ready: 0,
      signedYear: 1994,
      ...over,
    };
  }

  it('promotes a ready, strong academy driver into a race seat at 18', () => {
    const input = baseInput({
      drivers: [seatDriver('d1', 6), seatDriver('d2', 5)],
      teams: [team({ driverIds: ['d1', 'd2'] })],
      aiAcademies: { 't-ai': [member({ overall: 80, yearsUntilF1Ready: 0 })] },
    });
    const result = runAIOffseason(input);
    // The weakest seat driver (d2) is replaced by the promoted academy driver.
    expect(result.drivers.some((d) => d.id === 'd2')).toBe(false);
    expect(result.drivers.some((d) => d.name === 'Young Gun' && d.teamId === 't-ai')).toBe(true);
    expect(result.notes.some((n) => /promotes academy driver Young Gun/.test(n))).toBe(true);
    // Promoted member leaves the academy pool.
    expect((result.aiAcademies['t-ai'] ?? []).some((a) => a.name === 'Young Gun')).toBe(false);
  });

  it('releases an academy driver the team cannot afford', () => {
    const input = baseInput({
      // No spendable cash: budget at the reserve target.
      teams: [team({ budget: 10 * M })],
      aiTeamStates: { 't-ai': aiState({ budget: budget({ reserveTarget: 10 * M }) }) },
      aiAcademies: { 't-ai': [member({ overall: 50, potential: 50 })] },
    });
    const result = runAIOffseason(input);
    expect(result.notes.some((n) => /releases academy driver Young Gun/.test(n))).toBe(true);
    expect((result.aiAcademies['t-ai'] ?? []).length).toBe(0);
  });

  it('keeps developing an under-18 academy member (no first option yet)', () => {
    const input = baseInput({
      aiTeamStates: { 't-ai': aiState({ archetype: 'FinanciallyConservative' }) },
      aiAcademies: { 't-ai': [member({ birthYear: 1982, yearsUntilF1Ready: 3 })] }, // age 14
    });
    const result = runAIOffseason(input);
    const kept = result.aiAcademies['t-ai'] ?? [];
    expect(kept.some((a) => a.name === 'Young Gun')).toBe(true);
    expect(result.notes.some((n) => /Young Gun/.test(n))).toBe(false);
  });
});

describe('runAIOffseason — determinism', () => {
  it('produces identical results for identical inputs', () => {
    const mk = () =>
      baseInput({
        drivers: [seatDriver('d1', 5)],
        aiTeamStates: {
          't-ai': aiState({ archetype: 'YouthFocused', goal: 'YouthDevelopment' }),
        },
        market: {
          drivers: [marketDriver('reg-a', 7), marketDriver('reg-b', 6)],
          youth: [],
        },
      });
    const a = runAIOffseason(mk());
    const b = runAIOffseason(mk());
    expect(a.notes).toEqual(b.notes);
    expect(a.signedMarketIds).toEqual(b.signedMarketIds);
    expect(a.drivers.map((d) => d.id).sort()).toEqual(b.drivers.map((d) => d.id).sort());
  });
});

describe('AI offseason — season rollover integration', () => {
  function newGame(seed: string): GameState {
    return createNewGame({
      gameMode: 'Career',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed,
    });
  }

  it('AI teams act, keep valid rosters, and populate academies over seasons', () => {
    let s = newGame('ai-offseason-int');
    let sawAiNote = false;
    for (let y = 0; y < 3; y++) {
      s = advanceSeason(s);
      // No duplicate driver ids anywhere on the grid.
      const ids = new Set<string>();
      for (const d of s.drivers) {
        expect(ids.has(d.id)).toBe(false);
        ids.add(d.id);
      }
      // Every non-player team still fields at least one race driver.
      for (const t of s.teams) {
        if (t.id === s.selectedTeamId) continue;
        const seats = s.drivers.filter(
          (d) => d.teamId === t.id && d.contractType !== 'reserve' && d.contractType !== 'third' && d.contractType !== 'test',
        );
        expect(seats.length).toBeGreaterThanOrEqual(1);
      }
      const summary = s.offseasonHistory[s.offseasonHistory.length - 1];
      if (summary.notes.some((n) => /development package|academy|secures a new sponsor|strengthens its/.test(n))) {
        sawAiNote = true;
      }
    }
    expect(sawAiNote).toBe(true);
    expect(s.aiAcademies).toBeDefined();
  });
});
