import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import { personnelCareerFor, reconcilePersonnelCareerLedger } from './personnelCareerLedgerEngine';

describe('personnel career ledger', () => {
  it('seeds current principals and named staff as active tenures', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'personnel-ledger-seed' });
    const active = state.personnelCareerHistory?.filter((tenure) => tenure.endedSeason == null) ?? [];
    expect(active.some((tenure) => tenure.kind === 'TeamPrincipal' && tenure.personId === state.principal?.id)).toBe(true);
    expect(active.filter((tenure) => tenure.kind === 'TeamPrincipal')).toHaveLength(state.teams.length);
    expect(active.filter((tenure) => tenure.kind === 'Staff')).toHaveLength(Object.values(state.aiStaff ?? {}).flat().length);
  });

  it('closes the old tenure and opens a new one without changing a principal identity', () => {
    const before = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'personnel-ledger-move' });
    const [sourceId, destinationId] = before.teams.filter((team) => team.id !== before.selectedTeamId).slice(0, 2).map((team) => team.id);
    const principal = before.aiPrincipals![sourceId];
    const after = {
      ...before,
      aiPrincipals: {
        ...before.aiPrincipals,
        [sourceId]: { ...before.aiPrincipals![destinationId], principalId: `replacement-${sourceId}` },
        [destinationId]: principal,
      },
    };
    const reconciled = reconcilePersonnelCareerLedger(before, after, 1996, 'Season rollover');
    const career = personnelCareerFor(reconciled, 'TeamPrincipal', principal.principalId);
    expect(career).toHaveLength(2);
    expect(career[0]).toMatchObject({ teamId: destinationId, startedSeason: 1996 });
    expect(career[1]).toMatchObject({ teamId: sourceId, endedSeason: 1996 });
  });
});
