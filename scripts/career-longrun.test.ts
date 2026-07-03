// Long-run Career-Mode invariants — start an F1 1990 career and advance 20
// seasons of offseason rollover (driver market, youth academy, retirements, AI
// offseason, finances), asserting the universe stays self-consistent the whole
// way. Complements the Practice ↔ Setup work by guarding the surrounding career
// systems those setups run inside.

import { describe, it, expect } from 'vitest';

import { createNewGame } from '../src/game/initialCareer';
import { advanceSeason } from '../src/game/seasonRollover';
import { activeDriversForTeam } from '../src/game/careerState';
import type { GameState } from '../src/game/careerState';
import { careerMarketBundle, youthProspectAge, YOUTH_MAX_AGE } from '../src/sim/careerMarketEngine';
import { canonicalNameOf } from '../src/data/registry/masterRegistry';

const MARKET_TAGS = [
  'contract watch',
  'silly season',
  'transfer target',
  'contract target',
  'watch list',
  'rumour',
  'rumor',
  'free agent',
];

function hasMarketTag(name: string): boolean {
  const n = canonicalNameOf(name);
  return MARKET_TAGS.some((t) => n.includes(t));
}

function firstPlayerTeamId(state: GameState): string {
  return state.selectedTeamId;
}

describe('Career long-run — F1 1990, 20 seasons of rollover', () => {
  // Build one 20-season career deterministically and assert invariants each year.
  const seasons: GameState[] = [];
  let state = createNewGame({
    gameMode: 'Career',
    seasonYear: 1990,
    series: 'F1',
    teamId: 't-mclaren',
    seed: 'longrun-1990',
  });
  // t-mclaren may not exist in the 1990 bundle; fall back to the first team.
  if (!state.teams.some((t) => t.id === state.selectedTeamId)) {
    state = createNewGame({
      gameMode: 'Career',
      seasonYear: 1990,
      series: 'F1',
      teamId: state.teams[0].id,
      seed: 'longrun-1990',
    });
  }

  for (let i = 0; i < 20; i++) {
    state = advanceSeason({ ...state, seasonComplete: true });
    seasons.push(state);
  }

  it('advances a full 20 seasons without throwing', () => {
    expect(seasons).toHaveLength(20);
    expect(seasons[seasons.length - 1].seasonYear).toBe(1990 + 20);
  });

  it('has no duplicate canonical driver names on the grid in any season', () => {
    for (const s of seasons) {
      const names = s.drivers.map((d) => canonicalNameOf(d.name));
      const dup = names.filter((n, idx) => names.indexOf(n) !== idx);
      expect({ year: s.seasonYear, dup }).toEqual({ year: s.seasonYear, dup: [] });
    }
  });

  it('gives every team exactly two active race-seat drivers', () => {
    for (const s of seasons) {
      for (const team of s.teams) {
        const active = activeDriversForTeam(s, team.id);
        expect({ year: s.seasonYear, team: team.id, n: active.length }).toEqual({
          year: s.seasonYear,
          team: team.id,
          n: 2,
        });
      }
    }
  });

  it('never fields a test/reserve/third driver as an active race driver', () => {
    for (const s of seasons) {
      for (const team of s.teams) {
        for (const d of activeDriversForTeam(s, team.id)) {
          expect(['seat', undefined]).toContain(d.contractType);
        }
      }
    }
  });

  it('never lets a market label leak into a driver name', () => {
    for (const s of seasons) {
      for (const d of s.drivers) expect(hasMarketTag(d.name)).toBe(false);
      const bundle = careerMarketBundle(s);
      for (const m of bundle.drivers) expect(hasMarketTag(m.name)).toBe(false);
      for (const y of bundle.youth) expect(hasMarketTag(y.name)).toBe(false);
    }
  });

  it('keeps no 18+ driver in the youth signing pool', () => {
    for (const s of seasons) {
      const bundle = careerMarketBundle(s);
      for (const y of bundle.youth) {
        expect(youthProspectAge(y, s.seasonYear)).toBeLessThanOrEqual(YOUTH_MAX_AGE);
      }
    }
  });

  it('keeps AI team budgets within a sane range (no runaway ballooning)', () => {
    const playerId = firstPlayerTeamId(seasons[0]);
    for (const s of seasons) {
      for (const team of s.teams) {
        if (team.id === playerId) continue;
        // Raw dollars. Real 1990s F1 budgets are tens to low hundreds of $M;
        // allow generous head-room but forbid billions of runaway cash / debt.
        expect(team.budget).toBeGreaterThan(-300_000_000);
        expect(team.budget).toBeLessThan(1_500_000_000);
      }
    }
  });
}, 300_000);
