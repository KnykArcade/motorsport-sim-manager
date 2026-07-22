import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import { commandLoopGuide } from './commandLoopGuideViewModel';

function newState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'command-loop-guide',
  });
}

describe('commandLoopGuideViewModel', () => {
  it('projects the first-week guide without adding save state', () => {
    const guide = commandLoopGuide(newState());
    expect(guide?.title).toBe('Your first management week');
    expect(guide?.steps.map((step) => step.title)).toEqual([
      'Start at Manager Office',
      'Triage the Inbox',
      'Use Continue for the next action',
      'Return to the agenda',
    ]);
  });

  it('hides the guide after a race has been completed', () => {
    const base = newState();
    const state: GameState = {
      ...base,
      completedRaceResults: { [base.calendar[0].id]: [] },
    };
    expect(commandLoopGuide(state)).toBeNull();
  });
});
