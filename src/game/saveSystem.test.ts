import { beforeEach, describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import type { GameState } from './careerState';
import type { CommercialState } from '../types/sponsorTypes';
import { deleteSave, loadGame, migrateGameState, saveGame } from './saveSystem';
import { CURRENT_SAVE_SCHEMA_VERSION } from './saveSchema';

function freshState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'save-test',
  });
}

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    },
  });
});

describe('save model', () => {
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
    // Phase 7: driver relationships are seeded on a new career.
    expect(s.driverRelationships).toBeDefined();
    // Phase 11: universe history / records is seeded on a new career.
    expect(s.universeHistory).toBeDefined();
    // R&D foundation: every team owns its own research state and TPP ledger.
    expect(Object.keys(s.teamResearch ?? {})).toHaveLength(s.teams.length);
    expect(s.teamResearch?.[s.selectedTeamId].tpp.balance).toBe(30);
    // Parts lifecycle: fitted components and factory inventory are persisted.
    expect(Object.keys(s.teamParts ?? {})).toHaveLength(s.teams.length);
    expect(s.teamParts?.[s.selectedTeamId].inventory.length).toBeGreaterThan(0);
    // Phase 18A: the living-paddock schema is present before any feature engine
    // begins evolving identity, culture, advice, intelligence, or rivalries.
    expect(s.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(s.phase18).toBeDefined();
    expect(Object.keys(s.phase18?.teamCultures ?? {})).toHaveLength(s.teams.length);
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
    expect(cloned.commercial?.commercialReputation).toBe(60);
    expect(cloned.teamParts?.[cloned.selectedTeamId].inventory).toEqual(
      withSystems.teamParts?.[withSystems.selectedTeamId].inventory,
    );
    expect(cloned.phase18).toEqual(withSystems.phase18);
    expect(cloned.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it('migrates a pre-versioned save into the Phase 18 schema without losing existing state', () => {
    const current = freshState();
    const legacy = structuredClone(current);
    delete legacy.saveSchemaVersion;
    delete legacy.phase18;
    const migrated = migrateGameState(legacy);

    expect(migrated.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(migrated.phase18?.principalIdentity.principalId).toBe(current.principal?.id);
    expect(Object.keys(migrated.phase18?.departmentMoods ?? {})).toHaveLength(current.teams.length);
    expect(migrated.teamResearch).toEqual(current.teamResearch);
    expect(migrated.teamParts).toEqual(current.teamParts);
  });

  it('round-trips Phase 18 state through the real save slot', () => {
    const state = freshState();
    state.phase18!.legacy.score = 101;
    state.phase18!.teamCultures[state.selectedTeamId].tags = ['AeroInnovator'];
    saveGame(state);
    const restored = loadGame();
    deleteSave();

    expect(restored?.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    expect(restored?.phase18?.legacy.score).toBe(101);
    expect(restored?.phase18?.teamCultures[state.selectedTeamId].tags).toEqual(['AeroInnovator']);
  });
});
