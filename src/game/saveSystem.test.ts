import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { migrateSave, CURRENT_SAVE_VERSION } from './saveSystem';
import type { GameState } from './careerState';
import type { CommercialState } from '../types/sponsorTypes';

function freshState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'save-test',
  });
}

describe('save model', () => {
  it('exposes a current save version of at least 2', () => {
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('populates the implemented systems and leaves unbuilt ones unset', () => {
    const s = freshState();
    // Phase 3: commercial + owner expectations are seeded on a new career.
    expect(s.commercial).toBeDefined();
    expect(s.teamExpectations).toBeDefined();
    expect(s.teamReputations).toBeDefined();
    // Phase 4: facilities are seeded on a new career.
    expect(s.facilities).toBeDefined();
    // Phase 5: engine supplier deals are seeded on a new career.
    expect(s.engine).toBeDefined();
    // Phase 6: the Team Principal profile + job market are seeded on a new career.
    expect(s.principal).toBeDefined();
    expect(s.jobOffers).toBeDefined();
    // Systems from later phases remain unset.
    expect(s.universeHistory).toBeUndefined();
  });

  it('migrates a legacy (v1) save forward without dropping data', () => {
    const legacy = freshState();
    const migrated = migrateSave(legacy, 1);
    expect(migrated.id).toBe(legacy.id);
    expect(migrated.teams.length).toBe(legacy.teams.length);
    expect(migrated.drivers.length).toBe(legacy.drivers.length);
  });

  it('round-trips the new optional systems through JSON', () => {
    const commercial: CommercialState = {
      teamId: 't-benetton',
      commercialReputation: 60,
      sponsors: [
        {
          id: 'spo-1',
          name: 'Test Co',
          type: 'Title',
          annualValue: 25,
          bonusTerms: [],
          objectives: [],
          confidence: 70,
          contractYearsRemaining: 2,
          renewalChance: 0.6,
        },
      ],
    };
    const withSystems: GameState = { ...freshState(), commercial };
    const cloned = JSON.parse(JSON.stringify(withSystems)) as GameState;
    expect(cloned.commercial?.sponsors[0].name).toBe('Test Co');
    expect(migrateSave(cloned, CURRENT_SAVE_VERSION).commercial?.commercialReputation).toBe(60);
  });
});
