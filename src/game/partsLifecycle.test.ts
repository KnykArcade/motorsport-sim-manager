import { describe, expect, it } from 'vitest';
import { activeDriversForTeam } from './careerState';
import { gameReducer } from './gameReducer';
import { createNewGame } from './initialCareer';
import { fittedPartsForDriver } from '../sim/partsEngine';

function career() {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'parts-reducer',
  });
}

describe('parts lifecycle reducer integration', () => {
  it('initializes a parts inventory for every team', () => {
    const state = career();
    expect(Object.keys(state.teamParts ?? {})).toHaveLength(state.teams.length);
    const playerParts = state.teamParts?.[state.selectedTeamId];
    expect(playerParts?.inventory.length).toBeGreaterThan(0);
    expect(playerParts?.manufacturingQueue).toEqual([]);
  });

  it('charges the team and records a factory manufacturing order', () => {
    const state = career();
    const budget = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const next = gameReducer(state, { type: 'START_PART_MANUFACTURING', partType: 'aero' })!;
    expect(next.teamParts?.[state.selectedTeamId].manufacturingQueue).toHaveLength(1);
    expect(next.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBeLessThan(budget);
    expect(next.finance?.at(-1)?.label).toContain('aero manufacturing');
  });

  it('fits the best available spare to a driver and returns the previous component to inventory', () => {
    const state = career();
    const driver = activeDriversForTeam(state, state.selectedTeamId)[0];
    const parts = state.teamParts![state.selectedTeamId];
    const original = fittedPartsForDriver(parts, driver.id).find((part) => part.type === 'gearbox')!;
    const spare = parts.inventory.find((part) => part.type === 'gearbox' && part.status === 'spare')!;
    const next = gameReducer(state, { type: 'FIT_PART', partId: spare.id, driverId: driver.id })!;
    const updated = next.teamParts![state.selectedTeamId];
    expect(updated.inventory.find((part) => part.id === spare.id)?.fittedDriverId).toBe(driver.id);
    expect(updated.inventory.find((part) => part.id === original.id)?.status).toBe('spare');
  });

  it('charges for repairs and prevents retiring a fitted component', () => {
    const state = career();
    const parts = state.teamParts![state.selectedTeamId];
    const spare = parts.inventory.find((part) => part.type === 'brakes' && part.status === 'spare')!;
    const wornState = {
      ...state,
      teamParts: {
        ...state.teamParts,
        [state.selectedTeamId]: {
          ...parts,
          inventory: parts.inventory.map((part) => part.id === spare.id ? { ...part, condition: 40 } : part),
        },
      },
    };
    const repairing = gameReducer(wornState, { type: 'REPAIR_PART', partId: spare.id })!;
    expect(repairing.teamParts![state.selectedTeamId].inventory.find((part) => part.id === spare.id)?.status).toBe('repairing');

    const driver = activeDriversForTeam(state, state.selectedTeamId)[0];
    const fitted = fittedPartsForDriver(parts, driver.id)[0];
    const unchanged = gameReducer(state, { type: 'RETIRE_PART', partId: fitted.id })!;
    expect(unchanged).toBe(state);
  });
});
