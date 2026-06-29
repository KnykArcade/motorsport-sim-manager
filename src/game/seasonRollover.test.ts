import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { advanceSeason } from './seasonRollover';
import {
  progressAcademyMember,
  signProspectToAcademy,
  synthesizeDriverRatings,
} from '../sim/driverMarketEngine';
import { driverMarket1995, youthProspects1995 } from '../data';
import type { GameState } from './careerState';

function newOffseasonState(): GameState {
  const teamId = 't-benetton';
  const state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId,
    seed: 'test-seed',
  });
  return { ...state, seasonComplete: true };
}

describe('synthesizeDriverRatings', () => {
  it('keeps all ratings in 1-10 range and preserves overall', () => {
    const m = driverMarket1995[0];
    const r = synthesizeDriverRatings(m.skills, m.overall);
    for (const v of Object.values(r)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    }
    expect(r.overall).toBeCloseTo(m.overall, 5);
  });
});

describe('academy progression', () => {
  it('moves overall toward potential and counts down readiness, deterministically', () => {
    const member = signProspectToAcademy(youthProspects1995[0], 1995);
    const a = progressAcademyMember(member);
    const b = progressAcademyMember(member);
    expect(a).toEqual(b); // deterministic
    expect(a.overall).toBeGreaterThanOrEqual(member.overall);
    expect(a.overall).toBeLessThanOrEqual(a.potential + 1e-9);
    expect(a.yearsUntilF1Ready).toBe(Math.max(0, member.yearsUntilF1Ready - 1));
  });
});

describe('advanceSeason', () => {
  it('applies a market signing, increments the year, and resets the season', () => {
    const base = newOffseasonState();
    const seat = base.drivers.find((d) => d.teamId === base.selectedTeamId)!;
    const incoming = driverMarket1995[0];
    const state: GameState = {
      ...base,
      pendingSignings: [
        { seatDriverId: seat.id, source: 'market', sourceId: incoming.id, name: incoming.name },
      ],
    };

    const next = advanceSeason(state);

    expect(next.seasonYear).toBe(base.seasonYear + 1);
    expect(next.seasonComplete).toBe(false);
    expect(next.currentRaceIndex).toBe(0);
    expect(next.pendingSignings).toEqual([]);
    // Old seat driver replaced; new driver present on the same team & number.
    expect(next.drivers.find((d) => d.id === seat.id)).toBeUndefined();
    const signed = next.drivers.find((d) => d.id === `d-${incoming.id}`);
    expect(signed).toBeDefined();
    expect(signed?.teamId).toBe(seat.teamId);
    expect(signed?.number).toBe(seat.number);
    expect(next.signedMarketIds).toContain(incoming.id);
    // Calendar reset to uncompleted.
    expect(next.calendar.every((r) => !r.completed)).toBe(true);
  });

  it('progresses academy members across the rollover', () => {
    const base = newOffseasonState();
    const member = signProspectToAcademy(youthProspects1995[0], 1995);
    const state: GameState = { ...base, academy: [member] };
    const next = advanceSeason(state);
    expect(next.academy).toHaveLength(1);
    expect(next.academy![0].overall).toBeGreaterThanOrEqual(member.overall);
    expect(next.academy![0].yearsUntilF1Ready).toBe(
      Math.max(0, member.yearsUntilF1Ready - 1),
    );
  });
});
