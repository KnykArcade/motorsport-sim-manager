import { describe, expect, it } from 'vitest';
import { getTrackById } from '../data';
import { createNewGame } from '../game/initialCareer';
import { activeDriversForTeam, carForTeam } from '../game/careerState';
import {
  carWithFittedParts,
  createInitialTeamPartsState,
  fitPart,
  fittedPartsForDriver,
  latestPartDesign,
  manufacturingQuote,
  progressPartsAfterRace,
  repairQuote,
  retirePart,
  startPartManufacturing,
  startPartRepair,
} from './partsEngine';
import { createInitialTeamResearch } from './rdEngine';
import { effectiveCarRatings } from './trackFitEngine';

function career() {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'parts-engine',
  });
}

describe('parts inventory and lifecycle', () => {
  it('seeds a complete fitted set for each active driver plus one spare of every type', () => {
    const state = career();
    const team = state.teams.find((candidate) => candidate.id === state.selectedTeamId)!;
    const drivers = activeDriversForTeam(state, team.id);
    const parts = createInitialTeamPartsState(team, state.drivers, state.seasonYear);

    for (const driver of drivers) expect(fittedPartsForDriver(parts, driver.id)).toHaveLength(5);
    expect(parts.inventory.filter((part) => part.status === 'spare')).toHaveLength(5);
  });

  it('uses completed R&D tiers for newly manufactured specifications', () => {
    const state = career();
    const research = createInitialTeamResearch(state.selectedTeamId, state.seasonYear);
    research.completedNodes.push({
      nodeId: 'engine:E3', teamId: state.selectedTeamId, completedSeasonYear: 1995,
      completedRound: 2, branchId: 'engine', tier: 3,
    });
    const design = latestPartDesign('power_unit', research);
    expect(design.designGeneration).toBe(3);
    expect(design.sourceNodeIds).toContain('engine:E3');
    expect(design.ratingDeltas.enginePower).toBeGreaterThan(0);
  });

  it('completes factory orders after their deterministic round duration', () => {
    const state = career();
    const parts = state.teamParts![state.selectedTeamId];
    const order = manufacturingQuote(parts, 'power_unit', 1, state.teamResearch?.[state.selectedTeamId], 1995, 1);
    let working = startPartManufacturing(parts, order);
    const track = getTrackById(state.calendar[0].trackId)!;
    for (let round = 1; round <= order.totalRounds; round += 1) {
      working = progressPartsAfterRace(working, [], track, 1995, round).state;
    }
    expect(working.manufacturingQueue).toHaveLength(0);
    expect(working.inventory.filter((part) => part.type === 'power_unit')).toHaveLength(
      parts.inventory.filter((part) => part.type === 'power_unit').length + 1,
    );
  });

  it('swaps fitted spares, repairs worn parts, and blocks retirement while fitted', () => {
    const state = career();
    const driver = activeDriversForTeam(state, state.selectedTeamId)[0];
    let parts = state.teamParts![state.selectedTeamId];
    const original = fittedPartsForDriver(parts, driver.id).find((part) => part.type === 'aero')!;
    const spare = parts.inventory.find((part) => part.type === 'aero' && part.status === 'spare')!;
    parts = fitPart(parts, spare.id, driver.id, 1995, 1);
    expect(parts.inventory.find((part) => part.id === spare.id)?.status).toBe('fitted');
    expect(parts.inventory.find((part) => part.id === original.id)?.status).toBe('spare');
    expect(retirePart(parts, spare.id, 1995, 1)).toBe(parts);

    parts = {
      ...parts,
      inventory: parts.inventory.map((part) => part.id === original.id ? { ...part, condition: 35 } : part),
    };
    const quote = repairQuote(parts.inventory.find((part) => part.id === original.id)!);
    parts = startPartRepair(parts, original.id);
    expect(parts.inventory.find((part) => part.id === original.id)?.status).toBe('repairing');
    const track = getTrackById(state.calendar[0].trackId)!;
    for (let round = 1; round <= quote.rounds; round += 1) {
      parts = progressPartsAfterRace(parts, [], track, 1995, round).state;
    }
    const repaired = parts.inventory.find((part) => part.id === original.id)!;
    expect(repaired.status).toBe('spare');
    expect(repaired.condition).toBe(repaired.maximumCondition);
    expect(repaired.maximumCondition).toBeLessThan(100);
  });

  it('applies post-race wear and turns worn component condition into pace and reliability penalties', () => {
    const state = career();
    const driver = activeDriversForTeam(state, state.selectedTeamId)[0];
    const parts = state.teamParts![state.selectedTeamId];
    const track = getTrackById(state.calendar[0].trackId)!;
    const worn = progressPartsAfterRace(parts, [{
      position: 3, driverId: driver.id, teamId: state.selectedTeamId, gridPosition: 5,
      status: 'Finished', lapsCompleted: state.calendar[0].laps, points: 4, raceScore: 80,
      gapText: '+5s', incidents: [],
    }], track, 1995, 1).state;
    expect(fittedPartsForDriver(worn, driver.id).every((part) => part.condition < 100)).toBe(true);

    const critical = {
      ...worn,
      inventory: worn.inventory.map((part) => part.fittedDriverId === driver.id ? { ...part, condition: 20 } : part),
    };
    const car = carForTeam(state, state.selectedTeamId)!;
    const freshRatings = effectiveCarRatings(carWithFittedParts(car, parts, driver.id));
    const criticalCar = carWithFittedParts(car, critical, driver.id);
    const wornRatings = effectiveCarRatings(criticalCar);
    expect(wornRatings.reliability).toBeLessThan(freshRatings.reliability);
    expect(wornRatings.aeroEfficiency).toBeLessThan(freshRatings.aeroEfficiency);
    expect(criticalCar.componentCondition?.powerUnit).toBe(20);
  });
});
