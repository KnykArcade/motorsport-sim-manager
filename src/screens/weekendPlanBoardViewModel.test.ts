import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { getTrackById } from '../data';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { activeDriversForTeam } from '../game/careerState';
import { weekendForecast } from '../sim/weatherEngine';
import type { QualifyingResult } from '../types/gameTypes';
import type { QualifyingDecision, RaceDecision } from '../types/simTypes';
import { buildWeekendPlanBoard } from './weekendPlanBoardViewModel';

describe('weekend plan board view model', () => {
  it('consolidates the existing weekend decisions into one confirmable snapshot', () => {
    const base = createNewGame({
      gameMode: 'Career',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: 'weekend-board-test',
    });
    const race = base.calendar[0];
    const track = getTrackById(race.trackId)!;
    const drivers = activeDriversForTeam(base, base.selectedTeamId);
    const qualifying = drivers.map((driver, index) => ({
      driverId: driver.id,
      teamId: driver.teamId,
      position: index + 1,
      gapText: index === 0 ? 'POLE' : '+0.100',
      qualifyingScore: 100 - index,
      segment: 'Single',
      dnq: false,
    } as QualifyingResult));
    const state = {
      ...base,
      careerPhase: {
        ...base.careerPhase!,
        currentPhase: 'race_weekend' as const,
        racePrepFocus: 'balanced',
        racePrepFocusConfirmed: true,
      },
      raceWeekendPackage: {
        raceId: race.id,
        packageType: 'Standard' as const,
        gpName: race.gpName,
        cost: 1_000_000,
        teamScale: 1,
        trackModifier: 1,
        packageModifier: 1,
        damageReserve: 0,
      },
      qualifyingResults: { ...base.qualifyingResults, [race.id]: qualifying },
      carSetups: Object.fromEntries(drivers.map((driver) => [driver.id, BALANCED_SETUP])),
    };
    const qualifyingDecisions: QualifyingDecision[] = drivers.map((driver) => ({
      driverId: driver.id,
      setupId: 'auto',
      runPlanId: 'StandardPush',
      runs: 2,
      tyreApproach: 'Standard',
    }));
    const raceDecisions: RaceDecision[] = drivers.map((driver) => ({
      driverId: driver.id,
      setupId: 'auto',
      strategyId: 'BalancedOneStop',
      instructionId: 'Balanced',
    }));
    const board = buildWeekendPlanBoard({
      state,
      forecast: weekendForecast(track, `${state.randomSeed}-r${race.round}`),
      setups: state.carSetups,
      qualifyingDecisions,
      raceDecisions,
    });

    expect(board.canConfirm).toBe(true);
    expect(board.drivers).toHaveLength(drivers.length);
    expect(board.snapshot?.raceId).toBe(race.id);
    expect(board.snapshot?.drivers.every((driver) => driver.raceStrategyId === 'BalancedOneStop')).toBe(true);
    expect(board.preparation.map((item) => item.label)).toContain('Race weather');
  });

  it('explains the real blocker when qualifying is not complete', () => {
    const state = createNewGame({
      gameMode: 'SingleSeason',
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: 'weekend-board-blocked',
    });
    const race = state.calendar[0];
    const track = getTrackById(race.trackId)!;
    const board = buildWeekendPlanBoard({
      state: {
        ...state,
        raceWeekendPackage: {
          raceId: race.id,
          packageType: 'Standard',
          gpName: race.gpName,
          cost: 1_000_000,
          teamScale: 1,
          trackModifier: 1,
          packageModifier: 1,
          damageReserve: 0,
        },
      },
      forecast: weekendForecast(track, `${state.randomSeed}-r${race.round}`),
      setups: {},
      qualifyingDecisions: [],
      raceDecisions: [],
    });

    expect(board.canConfirm).toBe(false);
    expect(board.blockedReason).toBe('Qualifying must be completed');
  });
});
