import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { advanceSeason } from './seasonRollover';
import {
  progressAcademyMember,
  signProspectToAcademy,
  synthesizeDriverRatings,
} from '../sim/driverMarketEngine';
import { driverMarket1995, youthProspects1995 } from '../data';
import { bidToWin, competingBidFor } from '../sim/driverBiddingEngine';
import { activeDriversForTeam, isReserveContract, type GameState } from './careerState';
import type { AcademyMember } from '../types/marketTypes';

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
    const member = signProspectToAcademy(youthProspects1995[0], 1995, 't-williams');
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
        // A generous bid guarantees the contested signing is won.
        {
          seatDriverId: seat.id,
          source: 'market',
          sourceId: incoming.id,
          name: incoming.name,
          bid: incoming.buyoutCost * 5,
        },
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

  it('drops a market signing when the bid loses, leaving the seat unchanged', () => {
    const base = newOffseasonState();
    const seat = base.drivers.find((d) => d.teamId === base.selectedTeamId)!;
    // Pick a driver that draws a competing bid so a tiny offer loses.
    const incoming = driverMarket1995.find(
      (d) => competingBidFor(d, base.randomSeed) > 0,
    )!;
    const state: GameState = {
      ...base,
      pendingSignings: [
        {
          seatDriverId: seat.id,
          source: 'market',
          sourceId: incoming.id,
          name: incoming.name,
          bid: 0.01, // far below the competing bid
        },
      ],
    };

    const next = advanceSeason(state);

    // Seat keeps its original driver; no new driver and no charge applied.
    expect(next.drivers.find((d) => d.id === seat.id)).toBeDefined();
    expect(next.drivers.find((d) => d.id === `d-${incoming.id}`)).toBeUndefined();
    expect((next.finance ?? []).some((t) => t.label.includes(incoming.name))).toBe(false);
  });

  it('applies a market signing when the bid wins', () => {
    const base = newOffseasonState();
    const seat = base.drivers.find((d) => d.teamId === base.selectedTeamId)!;
    const incoming = driverMarket1995[0];
    const overall = base.teamOrgRatings?.[base.selectedTeamId]?.overallTeamRating ?? 50;
    const winning = bidToWin(incoming, overall, base.randomSeed);
    const state: GameState = {
      ...base,
      pendingSignings: [
        {
          seatDriverId: seat.id,
          source: 'market',
          sourceId: incoming.id,
          name: incoming.name,
          bid: winning,
        },
      ],
    };

    const next = advanceSeason(state);
    expect(next.drivers.find((d) => d.id === `d-${incoming.id}`)).toBeDefined();
    expect((next.finance ?? []).some((t) => t.label.includes(incoming.name))).toBe(true);
  });

  it('progresses academy members across the rollover', () => {
    const base = newOffseasonState();
    const member = signProspectToAcademy(youthProspects1995[0], 1995, base?.selectedTeamId ?? 't-williams');
    const state: GameState = { ...base, academy: [member] };
    const next = advanceSeason(state);
    expect(next.academy).toHaveLength(1);
    expect(next.academy![0].overall).toBeGreaterThanOrEqual(member.overall);
    expect(next.academy![0].yearsUntilF1Ready).toBe(
      Math.max(0, member.yearsUntilF1Ready - 1),
    );
  });
});

// An academy member who turns 18 in the next season (1996), signed to the
// player's team, ready to race.
function eighteenNextYear(teamId: string): AcademyMember {
  return {
    id: 'aca-first-option',
    prospectId: 'reg-fo',
    name: 'Marco Bellini',
    nationality: '—',
    birthYear: 1978, // age 18 in 1996
    academyTeamId: teamId,
    skills: { ...synthesizeDriverRatings(driverMarket1995[0].skills, 7) },
    overall: 7,
    potential: 8.5,
    developmentRate: 2,
    yearsUntilF1Ready: 0,
    signedYear: 1994,
  };
}

describe('Academy Rights / First Option at rollover', () => {
  it('marks an undecided 18-year-old academy driver promotion eligible and keeps rights', () => {
    const base = newOffseasonState();
    const member = eighteenNextYear(base.selectedTeamId);
    const next = advanceSeason({ ...base, academy: [member] });
    expect(next.academy).toHaveLength(1);
    expect(next.academy![0].promotionEligible).toBe(true);
    expect(next.academy![0].firstOptionStatus).toBe('pending_team_decision');
    expect(next.offseasonHistory.at(-1)!.notes.some((n) => n.includes('promotion eligible'))).toBe(true);
  });

  it('promotes a first-option driver into a race seat', () => {
    const base = newOffseasonState();
    const member = eighteenNextYear(base.selectedTeamId);
    const seat = activeDriversForTeam(base, base.selectedTeamId)[0];
    const next = advanceSeason({
      ...base,
      academy: [member],
      academyDecisions: [{ academyId: member.id, decision: 'race_seat', seatDriverId: seat.id }],
    });
    expect(next.academy).toHaveLength(0); // left the academy
    const promoted = next.drivers.find((d) => d.id === `d-${member.id}`);
    expect(promoted).toBeDefined();
    expect(promoted!.teamId).toBe(base.selectedTeamId);
    expect(next.drivers.find((d) => d.id === seat.id)).toBeUndefined(); // seat driver replaced
  });

  it('signs a first-option driver as a reserve (non-racing) driver', () => {
    const base = newOffseasonState();
    const member = eighteenNextYear(base.selectedTeamId);
    const next = advanceSeason({
      ...base,
      academy: [member],
      academyDecisions: [{ academyId: member.id, decision: 'reserve' }],
    });
    expect(next.academy).toHaveLength(0);
    const reserve = next.drivers.find((d) => d.id === `d-${member.id}`);
    expect(reserve).toBeDefined();
    expect(reserve!.contractType).toBe('reserve');
    expect(isReserveContract(reserve!)).toBe(true);
    // Reserve sits behind the two race seats, not in an active seat.
    const active = activeDriversForTeam(next, base.selectedTeamId).map((d) => d.id);
    expect(active).not.toContain(reserve!.id);
  });

  it('releases a first-option driver out of the academy', () => {
    const base = newOffseasonState();
    const member = eighteenNextYear(base.selectedTeamId);
    const next = advanceSeason({
      ...base,
      academy: [member],
      academyDecisions: [{ academyId: member.id, decision: 'release' }],
    });
    expect(next.academy).toHaveLength(0);
    expect(next.drivers.find((d) => d.id === `d-${member.id}`)).toBeUndefined();
    expect(next.offseasonHistory.at(-1)!.notes.some((n) => n.includes('Released'))).toBe(true);
  });

  it('extends development rights, keeping the driver in the academy', () => {
    const base = newOffseasonState();
    const member = eighteenNextYear(base.selectedTeamId);
    const next = advanceSeason({
      ...base,
      academy: [member],
      academyDecisions: [{ academyId: member.id, decision: 'extend' }],
    });
    expect(next.academy).toHaveLength(1);
    expect(next.academy![0].firstOptionStatus).toBe('extended_development_rights');
    // Decisions are consumed at the rollover.
    expect(next.academyDecisions).toEqual([]);
  });
});
