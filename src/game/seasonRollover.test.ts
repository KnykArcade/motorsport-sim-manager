import '../testDataSetup';
import {
  describe,
  expect,
  it } from 'vitest';
import { createNewGame } from './initialCareer';
import { advanceSeason } from './seasonRollover';
import {
  progressAcademyMember,
  signProspectToAcademy,
  synthesizeDriverRatings,
  } from '../sim/driverMarketEngine';
import { driverMarket1995 } from '../data/market/driverMarket1995';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { youthProspects1995 } from '../data/market/youthProspects1995';
import { bidToWin, competingBidFor } from '../sim/driverBiddingEngine';
import { activeDriversForTeam, isReserveContract, type GameState } from './careerState';
import type { AcademyMember } from '../types/marketTypes';
import { getStaffPool } from '../data';
import { gameReducer } from './gameReducer';

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
  it('keeps all ratings in 1-100 range and preserves overall', () => {
    const m = driverMarket1995[0];
    const r = synthesizeDriverRatings(m.skills, m.overall);
    for (const v of Object.values(r)) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
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
  it('ages retained staff contracts and pays only retained specialists', () => {
    const base = newOffseasonState();
    const candidate = getStaffPool(base.seasonYear, base.series)[0];
    const hired = gameReducer({ ...base, seasonComplete: false }, { type: 'HIRE_STAFF', staffId: candidate.id })!;
    const state: GameState = {
      ...hired,
      seasonComplete: true,
      drivers: hired.drivers.map((driver) => driver.teamId === hired.selectedTeamId ? { ...driver, contractYearsRemaining: 2 } : driver),
    };
    const next = advanceSeason(state);
    expect(next.staff![0].contractYearsRemaining).toBe(1);
    expect(next.finance?.some((entry) => entry.label.includes(`Salary: ${candidate.name}`))).toBe(true);
  });

  it('executes an expiring staff departure and leaves the role vacant', () => {
    const base = newOffseasonState();
    const candidate = getStaffPool(base.seasonYear, base.series)[0];
    const hired = gameReducer({ ...base, seasonComplete: false }, { type: 'HIRE_STAFF', staffId: candidate.id })!;
    const state: GameState = {
      ...hired,
      seasonComplete: true,
      staff: hired.staff!.map((member) => ({ ...member, contractYearsRemaining: 1 })),
      drivers: hired.drivers.map((driver) => driver.teamId === hired.selectedTeamId ? { ...driver, contractYearsRemaining: 2 } : driver),
      characterInteractions: {
        ...hired.characterInteractions!,
        futureIntentions: hired.characterInteractions!.futureIntentions.map((entry) => entry.target.type === 'Staff' && entry.target.id === candidate.id
          ? { ...entry, status: 'WantsExit' as const, negotiationModifier: -22 }
          : entry),
      },
    };
    const next = advanceSeason(state);
    expect(next.staff).toHaveLength(0);
    expect(next.offseasonHistory.at(-1)?.notes.some((note) => note.includes(candidate.name) && note.includes('wanted to leave'))).toBe(true);
    expect(next.news.some((item) => item.id.includes('staff-contract-expiry'))).toBe(true);
    expect(next.finance?.some((entry) => entry.season === next.seasonYear && entry.label.includes(`Salary: ${candidate.name}`))).toBe(false);
    expect(next.characterInteractions!.futureIntentions.some((entry) => entry.target.id === candidate.id)).toBe(false);
  });

  it('ages retained player contracts by one year at rollover', () => {
    const base = newOffseasonState();
    const driver = activeDriversForTeam(base, base.selectedTeamId)[0];
    const state: GameState = {
      ...base,
      drivers: base.drivers.map((entry) => entry.teamId === base.selectedTeamId
        ? { ...entry, contractYearsRemaining: entry.id === driver.id ? 2 : 3 }
        : entry),
    };
    const next = advanceSeason(state);
    expect(next.drivers.find((entry) => entry.id === driver.id)?.contractYearsRemaining).toBe(1);
  });

  it('releases an expired player driver, explains the intention, and preserves a legal lineup', () => {
    const base = newOffseasonState();
    const driver = activeDriversForTeam(base, base.selectedTeamId)[0];
    const state: GameState = {
      ...base,
      drivers: base.drivers.map((entry) => entry.teamId === base.selectedTeamId
        ? { ...entry, contractYearsRemaining: entry.id === driver.id ? 1 : 3 }
        : entry),
      characterInteractions: {
        ...base.characterInteractions!,
        futureIntentions: base.characterInteractions!.futureIntentions.map((entry) => entry.target.type === 'Driver' && entry.target.id === driver.id
          ? { ...entry, status: 'WantsExit' as const, negotiationModifier: -22 }
          : entry),
      },
    };
    const next = advanceSeason(state);
    expect(next.drivers.some((entry) => entry.id === driver.id && entry.teamId === base.selectedTeamId)).toBe(false);
    expect(activeDriversForTeam(next, base.selectedTeamId)).toHaveLength(2);
    expect(next.offseasonHistory.at(-1)?.notes.some((note) => note.includes(driver.name) && note.includes('wanted to leave'))).toBe(true);
    expect(next.news.some((item) => item.id.includes('contract-expiry') && item.driverId === driver.id)).toBe(true);
    expect(next.characterInteractions!.futureIntentions.some((entry) => entry.target.id === driver.id)).toBe(false);
  });

  it('starts the new season with fresh fitted components and preserves parts history', () => {
    const base = newOffseasonState();
    const playerParts = base.teamParts![base.selectedTeamId];
    const state: GameState = {
      ...base,
      teamParts: {
        ...base.teamParts,
        [base.selectedTeamId]: {
          ...playerParts,
          inventory: playerParts.inventory.map((part, index) => index === 0 ? { ...part, condition: 22 } : part),
          history: [{
            id: 'parts-history-test', seasonYear: base.seasonYear, round: 1,
            type: 'worn', description: 'Test component wear',
          }],
        },
      },
    };
    const next = advanceSeason(state);
    const nextParts = next.teamParts![base.selectedTeamId];
    expect(nextParts.inventory.filter((part) => part.status === 'fitted').every((part) => part.condition === 100)).toBe(true);
    expect(nextParts.manufacturingQueue).toEqual([]);
    expect(nextParts.history.some((entry) => entry.id === 'parts-history-test')).toBe(true);
  });

  it('applies a market signing, increments the year, and resets the season', () => {
    const base = newOffseasonState();
    const seat = base.drivers.find((d) => d.teamId === base.selectedTeamId)!;
    const incoming = careerMarketBundle(base).drivers.find(
      (d) => d.seriesPreferences?.some((preference) => preference.series === 'F1')
        && !base.drivers.some((s) => s.id === d.id || s.name === d.name),
    )!;
    const state: GameState = {
      ...base,
      drivers: base.drivers.map((driver) => driver.teamId === base.selectedTeamId ? { ...driver, contractYearsRemaining: 2 } : driver),
      pendingSignings: [
        // A generous bid guarantees the contested signing is won.
        {
          seatDriverId: seat.id,
          source: 'market',
          sourceId: incoming.id,
          name: incoming.name,
          bid: bidToWin(
            incoming,
            base.teamOrgRatings?.[base.selectedTeamId]?.overallTeamRating ?? 50,
            base.randomSeed,
          ),
        },
      ],
    };

    const next = advanceSeason(state);

    expect(next.seasonYear).toBe(base.seasonYear + 1);
    expect(next.seasonComplete).toBe(false);
    expect(next.currentRaceIndex).toBe(0);
    expect(next.pendingSignings).toEqual([]);
    const signed = next.drivers.find((d) => d.name === incoming.name);
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
    const incoming = careerMarketBundle(base).drivers.find(
      (d) =>
        competingBidFor(d, base.randomSeed) > 0 &&
        !base.drivers.some((s) => s.id === d.id || s.name === d.name),
    )!;
    const state: GameState = {
      ...base,
      drivers: base.drivers.map((driver) => driver.teamId === base.selectedTeamId ? { ...driver, contractYearsRemaining: 2 } : driver),
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
    expect(next.drivers.find((d) => d.name === incoming.name)).toBeUndefined();
    expect((next.finance ?? []).some((t) => t.label.includes(incoming.name))).toBe(false);
  });

  it('applies a market signing when the bid wins', () => {
    const base = newOffseasonState();
    const seat = base.drivers.find((d) => d.teamId === base.selectedTeamId)!;
    const incoming = careerMarketBundle(base).drivers.find(
      (d) => d.seriesPreferences?.some((preference) => preference.series === 'F1')
        && !base.drivers.some((s) => s.id === d.id || s.name === d.name),
    )!;
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
    expect(next.drivers.find((d) => d.name === incoming.name)).toBeDefined();
    expect((next.finance ?? []).some((t) => t.label.includes(incoming.name))).toBe(true);
  });

  it('evaluates unmet wants for AI-team drivers at rollover', () => {
    const base = newOffseasonState();
    const aiDriver = base.drivers.find((d) => d.teamId !== base.selectedTeamId)!;
    const aiTeamId = aiDriver.teamId;
    const relationships = base.driverRelationships ?? {};
    const rel = relationships[aiDriver.id];
    expect(rel).toBeDefined();
    const state: GameState = {
      ...base,
      cars: base.cars.map((car) =>
        car.teamId === aiTeamId
          ? { ...car, ratings: { ...car.ratings, reliability: 4 } }
          : car,
      ),
      driverRelationships: {
        ...relationships,
        [aiDriver.id]: {
          ...rel,
          morale: 70,
          trustInTeam: 70,
          trustInPrincipal: 70,
          frustration: 0,
          wants: ['better_reliability'],
        },
      },
    };

    const next = advanceSeason(state);
    const nextRel = next.driverRelationships?.[aiDriver.id];

    expect(nextRel).toBeDefined();
    expect(nextRel!.morale).toBeLessThan(70);
    expect(nextRel!.trustInTeam).toBeLessThan(70);
    expect(nextRel!.frustration).toBeGreaterThan(0);
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
    skills: { ...synthesizeDriverRatings(driverMarket1995[0].skills, 70) },
    overall: 70,
    potential: 85,
    developmentRate: 20,
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
      drivers: base.drivers.map((driver) => driver.teamId === base.selectedTeamId ? { ...driver, contractYearsRemaining: 2 } : driver),
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
      drivers: base.drivers.map((driver) => driver.teamId === base.selectedTeamId ? { ...driver, contractYearsRemaining: 2 } : driver),
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
