import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/careerState';
import { activeDriversForTeam } from '../game/careerState';
import { gameReducer } from '../game/gameReducer';
import { createNewGame } from '../game/initialCareer';
import { migrateGameState } from '../game/saveSystem';
import type { CharacterInteractionTarget } from '../types/characterInteractionTypes';
import {
  atRiskFutureIntentions,
  characterFutureIntentLabel,
  driverFutureIntentContractModifier,
  futureIntentForTarget,
  generateCharacterFutureIntentEvents,
  generateExpiringDriverContractEvents,
  generateExpiringStaffContractEvents,
  refreshCharacterFutureIntentions,
} from './characterFutureIntentEngine';
import { characterOpinionKey, currentCharacterTargets } from './characterOpinionEngine';
import { getStaffPool } from '../data';

function freshState(): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'character-future-intent-test' });
}

function withOpinion(state: GameState, target: CharacterInteractionTarget, score: number): GameState {
  const key = characterOpinionKey(target);
  return {
    ...state,
    characterInteractions: {
      ...state.characterInteractions!,
      opinions: {
        ...state.characterInteractions!.opinions,
        [key]: { ...state.characterInteractions!.opinions[key], score, trust: Math.max(0, Math.min(100, score + 50)) },
      },
    },
  };
}

describe('character future intent engine', () => {
  it('creates a readable future intention for every current character', () => {
    const state = freshState();
    expect(state.characterInteractions!.futureIntentions).toHaveLength(currentCharacterTargets(state).length);
    expect(state.characterInteractions!.futureIntentions.every((entry) => entry.leverage >= 0 && entry.leverage <= 100)).toBe(true);
    const owner = state.characterInteractions!.futureIntentions.find((entry) => entry.target.type === 'Owner')!;
    expect(characterFutureIntentLabel(owner.target, owner.status).length).toBeGreaterThan(5);
  });

  it('moves a hostile driver toward the market and reports the change once', () => {
    const base = freshState();
    const target = currentCharacterTargets(base).find((entry) => entry.type === 'Driver')!;
    const changed = refreshCharacterFutureIntentions(withOpinion(base, target, -100));
    expect(futureIntentForTarget(changed, target)?.status).toBe('WantsExit');
    expect(atRiskFutureIntentions(changed).some((entry) => entry.target.id === target.id)).toBe(true);
    expect(generateCharacterFutureIntentEvents(changed)[0].title).toContain(target.name);
    expect(generateCharacterFutureIntentEvents(refreshCharacterFutureIntentions(changed))).toHaveLength(0);
  });

  it('turns intention into a transparent driver renewal modifier', () => {
    const base = freshState();
    const target = currentCharacterTargets(base).find((entry) => entry.type === 'Driver')!;
    const committed = refreshCharacterFutureIntentions(withOpinion(base, target, 100));
    const exiting = refreshCharacterFutureIntentions(withOpinion(base, target, -100));
    expect(driverFutureIntentContractModifier(committed, target.id)).toBe(8);
    expect(driverFutureIntentContractModifier(exiting, target.id)).toBe(-22);
  });

  it('warns about expiring player contracts during the final three races', () => {
    const base = freshState();
    const driver = activeDriversForTeam(base, base.selectedTeamId)[0];
    const finalStretch: GameState = {
      ...base,
      currentRaceIndex: base.calendar.length - 2,
      drivers: base.drivers.map((entry) => entry.id === driver.id ? { ...entry, contractYearsRemaining: 1 } : entry),
    };
    const events = generateExpiringDriverContractEvents(finalStretch);
    expect(events.some((event) => event.title.includes(driver.name))).toBe(true);
    expect(events.find((event) => event.title.includes(driver.name))?.description).toContain('expires at season rollover');
    expect(generateExpiringDriverContractEvents({ ...finalStretch, currentRaceIndex: 0 })).toHaveLength(0);
  });

  it('warns about expiring staff contracts during the final three races', () => {
    const base = freshState();
    const candidate = getStaffPool(base.seasonYear, base.series)[0];
    const hired = gameReducer(base, { type: 'HIRE_STAFF', staffId: candidate.id })!;
    const finalStretch: GameState = {
      ...hired,
      currentRaceIndex: hired.calendar.length - 2,
      staff: hired.staff!.map((member) => ({ ...member, contractYearsRemaining: 1 })),
    };
    const events = generateExpiringStaffContractEvents(finalStretch);
    expect(events.some((event) => event.title.includes(candidate.name))).toBe(true);
    expect(events[0].description).toContain('expires at season rollover');
    expect(generateExpiringStaffContractEvents({ ...finalStretch, currentRaceIndex: 0 })).toHaveLength(0);
  });

  it('lets the same standard renewal succeed or fail based on future intent leverage', () => {
    const base = freshState();
    const driver = activeDriversForTeam(base, base.selectedTeamId)[0];
    const neutralRelationship = {
      ...base.driverRelationships![driver.id],
      morale: 50,
      teamLoyalty: 50,
      trustInPrincipal: 50,
      frustration: 50,
    };
    const withIntent = (status: 'Committed' | 'WantsExit', modifier: number): GameState => ({
      ...base,
      drivers: base.drivers.map((entry) => entry.id === driver.id ? { ...entry, morale: 50, confidence: 50, contractYearsRemaining: 1 } : entry),
      driverRelationships: { ...base.driverRelationships!, [driver.id]: neutralRelationship },
      characterInteractions: {
        ...base.characterInteractions!,
        futureIntentions: base.characterInteractions!.futureIntentions.map((entry) => entry.target.type === 'Driver' && entry.target.id === driver.id ? { ...entry, status, negotiationModifier: modifier } : entry),
      },
    });
    const committed = gameReducer(withIntent('Committed', 8), { type: 'EXTEND_DRIVER_CONTRACT', driverId: driver.id, years: 1 })!;
    const exiting = gameReducer(withIntent('WantsExit', -22), { type: 'EXTEND_DRIVER_CONTRACT', driverId: driver.id, years: 1 })!;
    expect(committed.drivers.find((entry) => entry.id === driver.id)?.contractYearsRemaining).toBe(2);
    expect(exiting.drivers.find((entry) => entry.id === driver.id)?.contractYearsRemaining).toBe(1);
    expect(exiting.news[0].headline).toContain('turns down');
  });

  it('migrates older saves to version 12 without losing character history', () => {
    const legacy = structuredClone(freshState());
    delete (legacy.characterInteractions as Partial<typeof legacy.characterInteractions>)?.futureIntentions;
    const migrated = migrateGameState(legacy);
    expect(migrated.characterInteractions!.version).toBe(13);
    expect(migrated.characterInteractions!.futureIntentions.length).toBeGreaterThan(0);
  });

  it('backfills staff contract terms when loading an older save', () => {
    const base = freshState();
    const candidate = getStaffPool(base.seasonYear, base.series)[0];
    const hired = gameReducer(base, { type: 'HIRE_STAFF', staffId: candidate.id })!;
    const legacy = structuredClone(hired);
    delete legacy.staff![0].contractYearsRemaining;
    expect(migrateGameState(legacy).staff![0].contractYearsRemaining).toBe(2);
  });
});
