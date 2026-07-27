import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import type { LiveCarState, LiveRaceState } from '../types/liveTypes';
import {
  entryStepState,
  filterRaceStory,
  raceControlPresentation,
  savedCareerSummary,
  selectedLiveCar,
} from './entryRacePresentationViewModel';

describe('entry and race presentation view model', () => {
  it('marks completed, active, and upcoming entry stages', () => {
    expect(entryStepState('mode', 'team')).toBe('complete');
    expect(entryStepState('team', 'team')).toBe('active');
    expect(entryStepState('principal', 'team')).toBe('upcoming');
  });

  it('builds a state-backed saved-career summary', () => {
    const state = {
      gameMode: 'Career',
      seasonYear: 1995,
      series: 'F1',
      selectedTeamId: 'williams',
      currentRaceIndex: 1,
      updatedAt: '2026-07-27T12:00:00.000Z',
      teams: [{ id: 'williams', name: 'Williams Renault' }],
      calendar: [
        { id: 'r1', round: 1, gpName: 'Brazilian Grand Prix', completed: true },
        { id: 'r2', round: 2, gpName: 'Argentine Grand Prix', completed: false },
      ],
      careerPhase: { currentPhase: 'race_weekend' },
    } as unknown as GameState;

    expect(savedCareerSummary(state)).toMatchObject({
      title: '1995 F1 · Career',
      team: 'Williams Renault',
      round: 'Round 2/2 · Argentine Grand Prix',
      stage: 'Race weekend',
      nextAction: 'Continue Race Weekend',
    });
  });

  it('presents green, controlled, red, and finished race-control states', () => {
    const base = {
      phase: 'racing',
      safetyCar: { active: false, reason: null },
    } as LiveRaceState;
    expect(raceControlPresentation(base).label).toBe('Green Flag');
    expect(raceControlPresentation({
      ...base,
      safetyCar: { active: true, reason: 'Debris' },
    } as LiveRaceState)).toMatchObject({ label: 'Safety Car', tone: 'yellow', detail: 'Debris' });
    expect(raceControlPresentation({
      ...base,
      raceControl: { mode: 'RedFlag', reason: 'Blocked circuit', pitLaneOpen: false },
    } as LiveRaceState)).toMatchObject({ label: 'Red Flag', tone: 'red', pitLane: 'Closed' });
    expect(raceControlPresentation({ ...base, phase: 'finished' } as LiveRaceState).tone).toBe('finished');
  });

  it('falls back from an unavailable driver to a player car and then the leader', () => {
    const cars = [
      { driverId: 'leader', position: 1, isPlayer: false },
      { driverId: 'player', position: 4, isPlayer: true },
    ] as LiveCarState[];
    expect(selectedLiveCar(cars, 'missing', ['player'])?.driverId).toBe('player');
    expect(selectedLiveCar(cars, 'missing')?.driverId).toBe('leader');
    expect(selectedLiveCar([], 'missing')).toBeUndefined();
  });

  it('filters the race story without inventing events', () => {
    const events = [
      { lap: 3, text: 'Rain has started', category: 'weather' },
      { lap: 4, text: 'Driver pits for tyres', category: 'strategy' },
      { lap: 5, text: 'Contact at turn one', category: 'incident' },
      { lap: 6, text: 'Driver completes a pass', category: 'battle' },
    ] as const;
    expect(filterRaceStory(events, 'priority').map((event) => event.lap)).toEqual([3, 5]);
    expect(filterRaceStory(events, 'strategy').map((event) => event.lap)).toEqual([4]);
    expect(filterRaceStory(events, 'battles').map((event) => event.lap)).toEqual([6]);
    expect(filterRaceStory(events, 'all')).toEqual(events);
  });
});
