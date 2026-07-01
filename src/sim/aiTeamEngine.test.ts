import { describe, it, expect } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import {
  ARCHETYPE_SPECS,
  aiTeamGoal,
  assignArchetype,
  buildAllAITeamStates,
  estimateAIBudget,
  estimatePrizeMoney,
  evolveArchetype,
  financialHealth,
  rolloverAITeamStates,
} from './aiTeamEngine';
import { advanceSeason } from '../game/seasonRollover';
import type { GameState } from '../game/careerState';
import type { Car, Team } from '../types/gameTypes';
import type { TeamOrganizationRatings } from '../types/teamRatingsTypes';
import type { AITeamBudget } from '../types/aiTeamTypes';

function newGame(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'ai-seed',
  });
}

function team(over: Partial<Team> = {}): Team {
  return {
    id: 't-x',
    name: 'Test',
    shortName: 'TST',
    carId: 'c-x',
    driverIds: [],
    budget: 50_000_000,
    reputation: 55,
    raceOperations: 5,
    morale: 60,
    color: '#fff',
    ...over,
  };
}

function car(pace: number): Car {
  return {
    id: 'c-x',
    teamId: 't-x',
    seasonYear: 1995,
    ratings: {
      enginePower: pace,
      aeroEfficiency: pace,
      mechanicalGrip: pace,
      reliability: pace,
      pitCrewOperations: pace,
    },
    condition: 100,
    developmentLevel: {
      enginePower: 0,
      aeroEfficiency: 0,
      mechanicalGrip: 0,
      reliability: 0,
      pitCrewOperations: 0,
    },
  };
}

function org(over: Partial<TeamOrganizationRatings> = {}): TeamOrganizationRatings {
  const base = 50;
  return {
    teamId: 't-x',
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

describe('assignArchetype', () => {
  it('a strong, rich, high-rep team with a fast car is a Championship Contender', () => {
    const t = team({ reputation: 88, budget: 90_000_000 });
    expect(assignArchetype(t, org({ carPerformance: 90 }), car(8.5), 's')).toBe('ChampionshipContender');
  });

  it('a poor, low-rep team is in Survival Mode', () => {
    const t = team({ reputation: 30, budget: 20_000_000 });
    expect(assignArchetype(t, org(), car(3), 's')).toBe('SurvivalMode');
  });

  it('a low-rep team with strong commercial appeal leans Pay Driver Reliant', () => {
    const t = team({ reputation: 38, budget: 40_000_000 });
    expect(assignArchetype(t, org({ sponsorAppeal: 70 }), car(4), 's')).toBe('PayDriverReliant');
  });

  it('a strong youth academy produces a youth-oriented archetype', () => {
    const t = team({ reputation: 55, budget: 50_000_000 });
    expect(assignArchetype(t, org({ youthAcademy: 80 }), car(5), 's')).toBe('YouthFocused');
  });
});

describe('estimatePrizeMoney', () => {
  it('pays more for a higher finish and is monotonic', () => {
    const p1 = estimatePrizeMoney(1, 12);
    const p6 = estimatePrizeMoney(6, 12);
    const p12 = estimatePrizeMoney(12, 12);
    expect(p1).toBeGreaterThan(p6);
    expect(p6).toBeGreaterThan(p12);
    expect(p12).toBeGreaterThan(0);
  });
});

describe('financialHealth', () => {
  const b = (over: Partial<AITeamBudget>): AITeamBudget => ({
    startingCash: 0,
    sponsorIncome: 20_000_000,
    prizeMoney: 0,
    driverSalaries: 0,
    staffSalaries: 0,
    developmentSpend: 0,
    facilitySpend: 0,
    engineCost: 0,
    operatingCost: 0,
    totalExpenses: 0,
    netResult: 0,
    projectedCash: 0,
    reserveTarget: 10_000_000,
    ...over,
  });

  it('grades cash against the reserve target', () => {
    expect(financialHealth(b({ projectedCash: -1 }))).toBe('Critical');
    expect(financialHealth(b({ projectedCash: 2_000_000 }))).toBe('AtRisk');
    expect(financialHealth(b({ projectedCash: 8_000_000 }))).toBe('Tight');
    expect(financialHealth(b({ projectedCash: 20_000_000 }))).toBe('Stable');
    expect(financialHealth(b({ projectedCash: 40_000_000 }))).toBe('Excellent');
  });

  it('flags a big operating loss as At Risk even with cash', () => {
    expect(financialHealth(b({ projectedCash: 25_000_000, netResult: -12_000_000 }))).toBe('AtRisk');
  });
});

describe('aiTeamGoal', () => {
  it('maps position + health to a goal', () => {
    expect(aiTeamGoal('ChampionshipContender', 1, 12, 'Excellent')).toBe('TitleChallenge');
    expect(aiTeamGoal('AmbitiousBuilder', 4, 12, 'Stable')).toBe('Podiums');
    expect(aiTeamGoal('FinanciallyConservative', 7, 12, 'Stable')).toBe('PointsFinish');
    expect(aiTeamGoal('FinanciallyConservative', 11, 12, 'Stable')).toBe('MidfieldImprovement');
    expect(aiTeamGoal('YouthFocused', 6, 12, 'Stable')).toBe('YouthDevelopment');
    expect(aiTeamGoal('ChampionshipContender', 1, 12, 'Critical')).toBe('Survival');
  });
});

describe('evolveArchetype', () => {
  it('drifts into Survival Mode after sustained trouble', () => {
    expect(evolveArchetype('FinanciallyConservative', 'Critical', 0, 1)).toBe('SurvivalMode');
    expect(evolveArchetype('AmbitiousBuilder', 'AtRisk', 1, 1)).toBe('SurvivalMode');
  });

  it('recovers out of Survival Mode when finances stabilize', () => {
    expect(evolveArchetype('SurvivalMode', 'Stable', 0, 1)).toBe('FinanciallyConservative');
  });

  it('emboldens a stable team after a big cash injection', () => {
    expect(evolveArchetype('FinanciallyConservative', 'Excellent', 0, 1.8)).toBe('AmbitiousBuilder');
    expect(evolveArchetype('AmbitiousBuilder', 'Excellent', 0, 1.8)).toBe('AggressiveSpender');
  });

  it('keeps the archetype when nothing notable happens', () => {
    expect(evolveArchetype('ChampionshipContender', 'Stable', 0, 1.05)).toBe('ChampionshipContender');
  });
});

describe('estimateAIBudget', () => {
  it('produces a coherent breakdown that nets out', () => {
    const state = newGame();
    const t = state.teams.find((x) => x.id !== state.selectedTeamId)!;
    const budget = estimateAIBudget(state, t, state.teamOrgRatings?.[t.id], 'AmbitiousBuilder', 5);
    expect(budget.totalExpenses).toBe(
      budget.driverSalaries + budget.staffSalaries + budget.engineCost + budget.operatingCost +
        budget.developmentSpend + budget.facilitySpend,
    );
    expect(budget.netResult).toBe(budget.sponsorIncome - budget.totalExpenses);
    expect(budget.projectedCash).toBe(budget.startingCash + budget.netResult);
    expect(budget.reserveTarget).toBeGreaterThan(0);
  });

  it('an aggressive spender commits more to development than a survival team', () => {
    const state = newGame();
    const t = state.teams.find((x) => x.id !== state.selectedTeamId)!;
    const o = state.teamOrgRatings?.[t.id];
    const aggressive = estimateAIBudget(state, t, o, 'AggressiveSpender', 5);
    const survival = estimateAIBudget(state, t, o, 'SurvivalMode', 5);
    expect(aggressive.developmentSpend).toBeGreaterThan(survival.developmentSpend);
    expect(ARCHETYPE_SPECS.AggressiveSpender.devBias).toBeGreaterThan(
      ARCHETYPE_SPECS.SurvivalMode.devBias,
    );
  });
});

describe('buildAllAITeamStates', () => {
  it('builds a brain for every non-player team and excludes the player', () => {
    const state = newGame();
    const states = buildAllAITeamStates(state);
    expect(states[state.selectedTeamId]).toBeUndefined();
    const others = state.teams.filter((t) => t.id !== state.selectedTeamId);
    expect(Object.keys(states).length).toBe(others.length);
    for (const t of others) {
      const s = states[t.id];
      expect(s.teamId).toBe(t.id);
      expect(ARCHETYPE_SPECS[s.archetype]).toBeDefined();
    }
  });

  it('is deterministic for a given seed', () => {
    const a = buildAllAITeamStates(newGame());
    const b = buildAllAITeamStates(newGame());
    expect(a).toEqual(b);
  });
});

describe('rolloverAITeamStates + season rollover integration', () => {
  it('recomputes AI brains and moves AI team cash at the rollover', () => {
    const state = newGame();
    const result = rolloverAITeamStates(state);
    const others = state.teams.filter((t) => t.id !== state.selectedTeamId);
    expect(Object.keys(result.states).length).toBe(others.length);
    // Each AI team gets a cash delta entry.
    for (const t of others) {
      expect(result.budgetDeltaByTeam[t.id]).toBeTypeOf('number');
    }
  });

  it('advanceSeason persists AI team states for the new season', () => {
    const state = newGame();
    const next = advanceSeason(state);
    expect(next.aiTeamStates).toBeDefined();
    const others = next.teams.filter((t) => t.id !== next.selectedTeamId);
    for (const t of others) {
      expect(next.aiTeamStates![t.id]).toBeDefined();
      expect(next.aiTeamStates![t.id].goal).toBeDefined();
    }
  });
});
