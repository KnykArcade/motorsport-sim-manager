import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { STAFF_ROLES } from '../types/staffTypes';
import { rolloverAIStaffRosters } from './aiStaffRosterEngine';
import { getCachedBundle } from '../data/seasonLoader';

describe('AI staff rosters', () => {
  it('seeds every AI team with one unique named specialist per role', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'ai-staff-rosters' });
    const rosters = state.aiStaff!;
    for (const team of state.teams.filter((entry) => entry.id !== state.selectedTeamId)) {
      expect(new Set((rosters[team.id] ?? []).map((member) => member.role))).toEqual(new Set(STAFF_ROLES));
    }
    const ids = Object.values(rosters).flat().map((member) => member.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(state.aiStaffInitialized).toBe(true);
  });

  it('ages contracts, replaces expiries, and keeps the player staff reserved', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'ai-staff-rollover' });
    const teamId = Object.keys(state.aiStaff!)[0];
    const expiring = state.aiStaff![teamId][0];
    const playerStaff = { ...state.aiStaff![teamId][1], contractYearsRemaining: 2 };
    const existing = {
      ...state.aiStaff,
      [teamId]: state.aiStaff![teamId].map((member) => member.id === expiring.id ? { ...member, contractYearsRemaining: 1 } : member),
    };
    const rolled = rolloverAIStaffRosters(existing, state.teams, state.selectedTeamId, 1996, state.series, [playerStaff]);
    expect(rolled[teamId].some((member) => member.id === expiring.id)).toBe(false);
    expect(Object.values(rolled).flat().some((member) => member.id === playerStaff.id)).toBe(false);
    expect(new Set(rolled[teamId].map((member) => member.role))).toEqual(new Set(STAFF_ROLES));
  });

  it('covers the largest NASCAR grid without duplicate or vacant AI roles', () => {
    const bundles = Array.from({ length: 37 }, (_, index) => getCachedBundle(1990 + index, 'NASCAR')).filter((bundle) => !!bundle);
    const largest = bundles.sort((a, b) => b.teams.length - a.teams.length)[0]!;
    const state = createNewGame({ gameMode: 'Career', seasonYear: largest.season.year, series: 'NASCAR', teamId: largest.teams[0].id, seed: 'largest-nascar-ai-staff' });
    const aiTeams = state.teams.filter((team) => team.id !== state.selectedTeamId);
    expect(aiTeams.length).toBeLessThan(128);
    expect(aiTeams.every((team) => new Set((state.aiStaff?.[team.id] ?? []).map((member) => member.role)).size === STAFF_ROLES.length)).toBe(true);
    const ids = Object.values(state.aiStaff ?? {}).flat().map((member) => member.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
