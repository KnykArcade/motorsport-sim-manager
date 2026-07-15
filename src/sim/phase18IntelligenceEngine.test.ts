import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import type { IntelligenceReport } from '../types/phase18Types';
import {
  INTELLIGENCE_INVESTIGATION_COST,
  generatePaddockIntelligence,
  resolveIntelligenceAction,
  rolloverIntelligenceReports,
} from './phase18IntelligenceEngine';

function freshState(seed = 'phase18-intelligence'): GameState {
  return createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed });
}

function plantedReport(state: GameState, truth: IntelligenceReport['hiddenTruth']): IntelligenceReport {
  return {
    id: `planted-${truth}`,
    subjectType: 'Part', subjectId: 'rival-part', targetTeamId: state.teams.find((team) => team.id !== state.selectedTeamId)!.id,
    title: 'Suspicious rival package', summary: 'A paddock source claims the rival package may be legality-sensitive.',
    source: 'PaddockRumor', confidence: 80, reliability: 55, assessment: 'Likely', status: 'Active',
    hiddenTruth: truth, category: 'Development', detailLevel: 'Briefing', gameplayRelevance: 'High', visibility: 'Private',
    possibleActions: ['Investigate', 'AskAdvisor', 'Monitor', 'Ignore'], actionHistory: [],
    discoveredSeasonYear: state.seasonYear, discoveredRound: 1, expiresSeasonYear: state.seasonYear, expiresRound: 4,
  };
}

describe('Phase 18 paddock intelligence', () => {
  it('generates deterministic, idempotent reports from paddock state', () => {
    const first = generatePaddockIntelligence(freshState('intel-deterministic'));
    const second = generatePaddockIntelligence(freshState('intel-deterministic'));
    expect(first.phase18!.intelligenceReports).toEqual(second.phase18!.intelligenceReports);
    expect(first.phase18!.intelligenceReports).toHaveLength(2);
    expect(generatePaddockIntelligence(first).phase18!.intelligenceReports).toEqual(first.phase18!.intelligenceReports);
    expect(first.phase18!.intelligenceReports.every((report) => report.targetTeamId !== first.selectedTeamId)).toBe(true);
  });

  it('charges for investigation and exposes a false report without leaking truth beforehand', () => {
    const base = freshState('intel-false');
    const report = plantedReport(base, 'False');
    const state = { ...base, phase18: { ...base.phase18!, intelligenceReports: [report] } };
    const budget = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const investigated = resolveIntelligenceAction(state, report.id, 'Investigate');
    const resolved = investigated.phase18!.intelligenceReports[0];
    expect(resolved.assessment).toBe('Disproven');
    expect(resolved.status).toBe('Resolved');
    expect(resolved.revealedOutcome).toContain('false');
    expect(investigated.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(budget - INTELLIGENCE_INVESTIGATION_COST);
    expect(investigated.finance?.at(-1)?.category).toBe('Scouting');
  });

  it('supports advisor review and monitoring without spending cash', () => {
    const base = freshState('intel-actions');
    const report = { ...plantedReport(base, 'Mixed'), confidence: 40, assessment: 'Unverified' as const };
    const state = { ...base, phase18: { ...base.phase18!, intelligenceReports: [report] } };
    const budget = state.teams.find((team) => team.id === state.selectedTeamId)!.budget;
    const advised = resolveIntelligenceAction(state, report.id, 'AskAdvisor');
    expect(advised.phase18!.intelligenceReports[0].confidence).toBeGreaterThan(report.confidence);
    expect(advised.phase18!.intelligenceReports[0].actionHistory?.at(-1)?.action).toBe('AskAdvisor');
    expect(advised.teams.find((team) => team.id === state.selectedTeamId)!.budget).toBe(budget);
  });

  it('reveals unresolved reports at season rollover and survives JSON persistence', () => {
    const base = freshState('intel-rollover');
    const report = plantedReport(base, 'Mixed');
    const rolled = rolloverIntelligenceReports({ ...base, phase18: { ...base.phase18!, intelligenceReports: [report] } });
    expect(rolled.phase18!.intelligenceReports[0].status).toBe('Expired');
    expect(rolled.phase18!.intelligenceReports[0].assessment).toBe('Plausible');
    expect(JSON.parse(JSON.stringify(rolled)).phase18.intelligenceReports[0].revealedOutcome).toContain('misleading');
  });
});
