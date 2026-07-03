import { describe, it, expect } from 'vitest';
import { teams1995 } from '../data/teams/teams1995';
import {
  buildTeamReputation,
  buildTeamExpectations,
  buildTeamExpectation,
  reviewExpectation,
  applyPatience,
} from './expectationEngine';

const williams = teams1995.find((t) => t.id === 't-williams')!; // top team
const weakest = [...teams1995].sort((a, b) => a.reputation - b.reputation)[0];

describe('expectationEngine', () => {
  it('derives a reputation profile from the team', () => {
    const rep = buildTeamReputation(williams);
    expect(rep.teamId).toBe(williams.id);
    expect(rep.reputation).toBe(williams.reputation);
    expect(rep.ownerPatience).toBeGreaterThanOrEqual(0);
    expect(rep.ownerPatience).toBeLessThanOrEqual(100);
  });

  it('sets tougher objectives for stronger teams', () => {
    const top = buildTeamExpectation(williams, teams1995.length, 1995);
    const back = buildTeamExpectation(weakest, teams1995.length, 1995);
    expect(top.requiredWins ?? 0).toBeGreaterThan(back.requiredWins ?? 0);
    // The strong team must finish higher up (smaller minimum position) than the weak one.
    const topMin = top.minimumConstructorPosition ?? teams1995.length;
    const backMin = back.minimumConstructorPosition ?? teams1995.length;
    expect(topMin).toBeLessThanOrEqual(backMin);
  });

  it('builds expectations for every team', () => {
    const all = buildTeamExpectations(teams1995, 1995);
    expect(Object.keys(all).length).toBe(teams1995.length);
  });

  it('reviews over- and under-performance against expectations', () => {
    const exp = buildTeamExpectation(williams, teams1995.length, 1995);
    const great = reviewExpectation(exp, { constructorPosition: 1, points: 200, wins: 8 });
    expect(great.primaryObjectiveMet).toBe(true);
    expect(great.score).toBeGreaterThan(0);
    expect(great.patienceDelta).toBeGreaterThan(0);

    const poor = reviewExpectation(exp, { constructorPosition: teams1995.length, points: 0, wins: 0 });
    expect(poor.primaryObjectiveMet).toBe(false);
    expect(poor.score).toBeLessThan(0);
    expect(poor.patienceDelta).toBeLessThan(0);
  });

  it('moves owner patience by the review delta, clamped to 0-100', () => {
    const exp = buildTeamExpectation(williams, teams1995.length, 1995);
    const rep = buildTeamReputation(williams);
    const poor = reviewExpectation(exp, { constructorPosition: teams1995.length, points: 0, wins: 0 });
    const after = applyPatience(rep, exp, poor);
    expect(after.ownerPatience).toBeLessThan(rep.ownerPatience);
    expect(after.ownerPatience).toBeGreaterThanOrEqual(0);
  });
});
