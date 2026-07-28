import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { buildTeamPlanner, plannerHorizon } from './teamPlannerViewModel';

function career(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'phase-19-team-planner',
  });
}

describe('Motorsport Team Planner view model', () => {
  it('builds current, next, and season-after-next horizons from career state', () => {
    const planner = buildTeamPlanner(career());
    expect(planner.horizons.map((horizon) => [horizon.id, horizon.year])).toEqual([
      ['current', 1995],
      ['next', 1996],
      ['future', 1997],
    ]);
    expect(planner.horizons.every((horizon) => horizon.seats.some((seat) => seat.kind === 'race'))).toBe(true);
    expect(planner.horizons.every((horizon) => horizon.seats.some((seat) => seat.kind === 'reserve'))).toBe(true);
  });

  it('projects expiring contracts as future vacancies without mutating the career', () => {
    const state = career();
    const original = JSON.stringify(state);
    const playerDriver = state.drivers.find((driver) => driver.teamId === state.selectedTeamId)!;
    const prepared: GameState = {
      ...state,
      drivers: state.drivers.map((driver) =>
        driver.id === playerDriver.id ? { ...driver, contractYearsRemaining: 1 } : driver),
    };
    const planner = buildTeamPlanner(prepared);
    expect(plannerHorizon(planner, 'current').seats.find((seat) => seat.occupant?.id === playerDriver.id)).toBeDefined();
    expect(plannerHorizon(planner, 'next').seats.find((seat) => seat.occupant?.id === playerDriver.id)).toBeUndefined();
    expect(JSON.stringify(state)).toBe(original);
  });

  it('places an already negotiated signing into the next-season seat projection', () => {
    const state = career();
    const incumbent = state.drivers.find((driver) => driver.teamId === state.selectedTeamId)!;
    const prepared: GameState = {
      ...state,
      pendingSignings: [{
        seatDriverId: incumbent.id,
        source: 'market',
        sourceId: 'target-driver',
        name: 'Target Driver',
        offeredSalary: 4,
        contractYears: 2,
      }],
    };
    const next = plannerHorizon(buildTeamPlanner(prepared), 'next');
    expect(next.seats.find((seat) => seat.occupant?.name === 'Target Driver')?.occupant).toMatchObject({
      source: 'pending',
      annualCost: 4_000_000,
    });
  });

  it('surfaces academy and shortlisted drivers as knowledge-aware hypothetical candidates', () => {
    const state = career();
    const marketDriver = careerMarketBundle(state).drivers[0];
    expect(marketDriver).toBeDefined();
    const academyMember = {
      id: 'academy-plan',
      prospectId: 'academy-plan-source',
      name: 'Academy Prospect',
      nationality: 'GB',
      birthYear: 1978,
      academyTeamId: state.selectedTeamId,
      skills: {
        cornering: 70,
        braking: 70,
        straights: 70,
        tractionAcceleration: 70,
        elevationBlindCorners: 70,
        technical: 70,
        overtakingRacecraft: 70,
        surfaceGripBumpiness: 70,
        riskManagement: 70,
        enduranceConsistency: 70,
      },
      overall: 70,
      potential: 88,
      developmentRate: 2,
      yearsUntilF1Ready: 1,
      signedYear: 1995,
    };
    const prepared: GameState = {
      ...state,
      academy: [academyMember],
      scouting: {
        ...(state.scouting ?? {
          teamId: state.selectedTeamId,
          networkAccuracy: 0.7,
          reports: {},
        }),
        shortlist: [{ entityId: marketDriver.id, entityType: 'Driver' }],
        reports: {
          ...(state.scouting?.reports ?? {}),
          [marketDriver.id]: {
            entityId: marketDriver.id,
            entityType: 'Driver',
            scoutingLevel: 50,
            accuracy: 0.5,
            visibleRatings: {},
            notes: [],
            lastUpdated: '1995-01-01',
          },
        },
      },
    };
    const candidates = plannerHorizon(buildTeamPlanner(prepared), 'next').candidates;
    expect(candidates).toContainEqual(expect.objectContaining({
      id: 'academy:academy-plan',
      source: 'academy',
      name: 'Academy Prospect',
      potential: 88,
    }));
    expect(candidates).toContainEqual(expect.objectContaining({
      id: `shortlist:${marketDriver.id}`,
      source: 'shortlist',
      name: marketDriver.name,
    }));
  });

  it('combines recurring costs and income without treating technical carryover as a second charge', () => {
    const state = career();
    const current = plannerHorizon(buildTeamPlanner(state), 'current');
    expect(current.committedCosts).toBeGreaterThan(0);
    expect(current.committedIncome).toBeGreaterThanOrEqual(0);
    expect(current.projectedHeadroom).toBe(
      buildTeamPlanner(state).baseBudget + current.committedIncome - current.committedCosts,
    );
    expect(current.commitments.filter((entry) => entry.category === 'Technical').every((entry) => entry.annualAmount === 0)).toBe(true);
  });

  it('defaults malformed horizon requests to the current season', () => {
    const planner = buildTeamPlanner(career());
    expect(plannerHorizon(planner, 'not-a-horizon').id).toBe('current');
  });
});
