import '../testDataSetup';
import { describe, it, expect } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { advanceSeason } from '../game/seasonRollover';
import type { GameState } from '../game/careerState';
import {
  buildTeamOverview,
  buildTeamOverviewDetail,
  HEALTH_ORDER,
} from './teamOverviewEngine';

function newGame(seed = 'overview-seed'): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed,
  });
}

const RATING_KEYS = [
  'financeRating',
  'carRating',
  'developmentRating',
  'facilitiesRating',
  'staffRating',
  'engineRating',
  'driverRating',
  'academyRating',
  'raceOpsRating',
  'pitCrewRating',
  'reliabilityRating',
  'reputationRating',
  'sponsorRating',
  'overallRating',
] as const;

describe('buildTeamOverview', () => {
  it('returns one row per team', () => {
    const s = newGame();
    const rows = buildTeamOverview(s);
    expect(rows.length).toBe(s.teams.length);
    const ids = new Set(rows.map((r) => r.teamId));
    expect(ids.size).toBe(s.teams.length);
  });

  it('keeps every rating within the 1-100 scale', () => {
    const rows = buildTeamOverview(newGame());
    for (const row of rows) {
      for (const key of RATING_KEYS) {
        expect(row[key]).toBeGreaterThanOrEqual(1);
        expect(row[key]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('marks exactly one player team and gives AI teams a management archetype', () => {
    const s = newGame();
    const rows = buildTeamOverview(s);
    const players = rows.filter((r) => r.isPlayer);
    expect(players.length).toBe(1);
    expect(players[0].teamId).toBe(s.selectedTeamId);
    expect(players[0].archetypeLabel).toBeUndefined();
    for (const r of rows.filter((x) => !x.isPlayer)) {
      expect(typeof r.archetypeLabel).toBe('string');
      expect(typeof r.goalLabel).toBe('string');
    }
  });

  it('assigns a valid financial health to every team', () => {
    const rows = buildTeamOverview(newGame());
    for (const r of rows) expect(HEALTH_ORDER).toContain(r.financialHealth);
  });

  it('orders by championship position once a season has been contested', () => {
    let s = newGame();
    // Fabricate final constructor standings so positions exist.
    s = {
      ...s,
      constructorStandings: s.teams.map((t, i) => ({
        entityId: t.id,
        points: (s.teams.length - i) * 10,
        wins: i === 0 ? 5 : 0,
        podiums: 0,
        dnfs: 0,
      })),
    };
    const rows = buildTeamOverview(s);
    expect(rows[0].championshipPosition).toBe(1);
    expect(rows[0].points).toBeGreaterThan(rows[rows.length - 1].points);
  });

  it('is deterministic', () => {
    const s = newGame('det');
    expect(buildTeamOverview(s)).toEqual(buildTeamOverview(s));
  });

  it('reflects AI moves after a season rollover (overview still valid)', () => {
    let s = newGame('rollover');
    s = advanceSeason(s);
    const rows = buildTeamOverview(s);
    expect(rows.length).toBe(s.teams.length);
    for (const r of rows) {
      expect(r.overallRating).toBeGreaterThanOrEqual(1);
      expect(r.overallRating).toBeLessThanOrEqual(100);
    }
  });
});

describe('buildTeamOverviewDetail', () => {
  it('returns lineup, strengths/weaknesses and academy info for a team', () => {
    const s = newGame();
    const detail = buildTeamOverviewDetail(s, s.selectedTeamId);
    expect(detail).toBeDefined();
    expect(detail!.row.teamId).toBe(s.selectedTeamId);
    expect(detail!.raceDrivers.length).toBeGreaterThanOrEqual(1);
    expect(detail!.strengths.length).toBe(3);
    expect(detail!.weaknesses.length).toBe(3);
    // Strengths are ranked at least as high as weaknesses.
    expect(detail!.strengths[0].value).toBeGreaterThanOrEqual(detail!.weaknesses[0].value);
  });

  it('returns undefined for an unknown team', () => {
    expect(buildTeamOverviewDetail(newGame(), 't-nope')).toBeUndefined();
  });
});
