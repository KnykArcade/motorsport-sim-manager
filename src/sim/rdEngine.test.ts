import { describe, expect, it } from 'vitest';
import { rdFoundationProjectById } from '../data/rd/rdFoundationCatalog';
import {
  allocateSeasonTPP,
  canStartFoundationProject,
  createInitialTeamResearch,
  progressTeamResearch,
  selectResearchFocus,
  startFoundationProject,
} from './rdEngine';

describe('R&D foundation engine', () => {
  it('locks a selected focus for three seasons', () => {
    const initial = createInitialTeamResearch('team-a', 1998);
    const selected = selectResearchFocus(initial, 'engine', 1998);
    expect(selected.focus).toEqual({
      branchId: 'engine',
      selectedSeasonYear: 1998,
      lockedThroughSeasonYear: 2000,
    });
    expect(selectResearchFocus(selected, 'aero', 2000).focus?.branchId).toBe('engine');
    expect(selectResearchFocus(selected, 'aero', 2001).focus?.branchId).toBe('aero');
  });

  it('spends TPP, completes a foundation project, and emits a car modifier', () => {
    const definition = rdFoundationProjectById['engine:E1'];
    let research = selectResearchFocus(createInitialTeamResearch('team-a', 1998), 'engine', 1998);
    expect(canStartFoundationProject(research, definition.nodeId, 10_000_000, 1_000_000, 5)).toBe(true);
    research = startFoundationProject(research, definition, 1998, 1, 1_000_000, 2, 5);
    expect(research.tpp.balance).toBe(25);
    expect(research.tpp.ledger.at(-1)?.amount).toBe(-5);

    const first = progressTeamResearch(research, 1998, 1);
    expect(first.teamResearch.activeProjects[0].progressRounds).toBe(1);
    const second = progressTeamResearch(first.teamResearch, 1998, 2);
    expect(second.teamResearch.activeProjects).toHaveLength(0);
    expect(second.teamResearch.completedNodes[0].nodeId).toBe('engine:E1');
    expect(second.teamResearch.modifiers[0].target).toBe('enginePower');
    expect(second.carRatingDeltas.enginePower).toBe(0.35);
  });

  it('keeps research team-owned and adds the annual TPP allocation', () => {
    const research = selectResearchFocus(createInitialTeamResearch('team-a', 1998), 'chassis', 1998);
    const next = allocateSeasonTPP(research, 1999);
    expect(next.teamId).toBe('team-a');
    expect(next.focus?.branchId).toBe('chassis');
    expect(next.tpp.balance).toBe(50);
    expect(next.tpp.ledger.at(-1)?.reason).toBe('season_allocation');
  });
});
