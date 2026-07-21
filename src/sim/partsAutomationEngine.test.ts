import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import { activeDriversForTeam } from '../game/careerState';
import { runPartsAutomation } from './partsAutomationEngine';
import { availableSpareParts, fittedPartsForDriver } from './partsEngine';
import type { TeamPartsState } from '../types/partsTypes';

function newState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'automation-test',
  });
}

function playerParts(state: GameState): TeamPartsState {
  const parts = state.teamParts?.[state.selectedTeamId];
  if (!parts) throw new Error('missing player parts');
  return parts;
}

function run(state: GameState, parts: TeamPartsState, settings: { autoRepair?: boolean; autoRestock?: boolean; autoFit?: boolean }, budget = 100_000_000) {
  return runPartsAutomation({
    settings: { autoRepair: false, autoRestock: false, autoFit: false, ...settings },
    parts,
    drivers: activeDriversForTeam(state, state.selectedTeamId),
    technical: state.teamTechnical?.[state.selectedTeamId],
    budget,
    seasonYear: state.seasonYear,
    round: 3,
  });
}

function withCondition(parts: TeamPartsState, partId: string, condition: number): TeamPartsState {
  return {
    ...parts,
    inventory: parts.inventory.map((part) => part.id === partId ? { ...part, condition } : part),
  };
}

describe('runPartsAutomation', () => {
  it('does nothing when all toggles are off', () => {
    const state = newState();
    const parts = playerParts(state);
    const result = run(state, parts, {});
    expect(result.parts).toBe(parts);
    expect(result.spend).toBe(0);
    expect(result.decisions).toEqual([]);
  });

  it('auto-repairs spares below the condition threshold, respecting budget', () => {
    const state = newState();
    const base = playerParts(state);
    const spare = base.inventory.find((part) => part.status === 'spare');
    expect(spare).toBeDefined();
    const parts = withCondition(base, spare!.id, 20);

    const repaired = run(state, parts, { autoRepair: true });
    expect(repaired.spend).toBeGreaterThan(0);
    expect(repaired.parts.inventory.find((part) => part.id === spare!.id)?.status).toBe('repairing');
    expect(repaired.decisions.some((line) => line.startsWith('Auto-repair'))).toBe(true);

    const broke = run(state, parts, { autoRepair: true }, 0);
    expect(broke.spend).toBe(0);
    expect(broke.parts.inventory.find((part) => part.id === spare!.id)?.status).toBe('spare');
  });

  it('defers paid routine work when the automation ceiling is reached', () => {
    const state = newState();
    const base = playerParts(state);
    const spare = base.inventory.find((part) => part.status === 'spare');
    expect(spare).toBeDefined();
    const parts = withCondition(base, spare!.id, 20);

    const result = runPartsAutomation({
      settings: { autoRepair: true, autoRestock: false, autoFit: false, budgetCap: 0 },
      parts,
      drivers: activeDriversForTeam(state, state.selectedTeamId),
      technical: state.teamTechnical?.[state.selectedTeamId],
      budget: 100_000_000,
      seasonYear: state.seasonYear,
      round: 3,
    });

    expect(result.spend).toBe(0);
    expect(result.parts.inventory.find((part) => part.id === spare!.id)?.status).toBe('spare');
    expect(result.decisions).toContain('Routine factory work deferred at the $0k automation ceiling.');
  });

  it('auto-fits a fresher spare over a worn fitted part', () => {
    const state = newState();
    const base = playerParts(state);
    const fitted = base.inventory.find(
      (part) => part.status === 'fitted' && part.fittedDriverId
        && base.inventory.some((candidate) => candidate.status === 'spare' && candidate.type === part.type),
    );
    expect(fitted).toBeDefined();
    const parts = withCondition(base, fitted!.id, 20);

    const result = run(state, parts, { autoFit: true });
    expect(result.spend).toBe(0);
    const nowFitted = fittedPartsForDriver(result.parts, fitted!.fittedDriverId!).find((part) => part.type === fitted!.type);
    expect(nowFitted?.id).not.toBe(fitted!.id);
    expect(result.parts.inventory.find((part) => part.id === fitted!.id)?.status).toBe('spare');
  });

  it('auto-restocks part types with no spares, respecting the queue limit', () => {
    const state = newState();
    const base = playerParts(state);
    // Remove all spares of one type present in the initial inventory.
    const spare = base.inventory.find((part) => part.status === 'spare');
    expect(spare).toBeDefined();
    const parts: TeamPartsState = {
      ...base,
      inventory: base.inventory.filter((part) => !(part.status === 'spare' && part.type === spare!.type)),
    };
    expect(availableSpareParts(parts, spare!.type)).toEqual([]);

    const result = run(state, parts, { autoRestock: true });
    expect(result.parts.manufacturingQueue.some((order) => order.type === spare!.type)).toBe(true);
    expect(result.spend).toBeGreaterThan(0);

    const again = run(state, result.parts, { autoRestock: true });
    expect(again.parts.manufacturingQueue.filter((order) => order.type === spare!.type)).toHaveLength(1);
  });
});
