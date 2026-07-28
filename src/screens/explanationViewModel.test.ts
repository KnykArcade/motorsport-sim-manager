import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { getTrackById } from '../data';
import { createNewGame } from '../game/initialCareer';
import {
  driverConfidenceExplanation,
  driverMoraleExplanation,
  driverTrustExplanation,
  intelligenceExplanation,
  scoutingUncertaintyExplanation,
  setupConfidenceExplanation,
  teamMoraleExplanation,
  teamReputationExplanation,
} from './explanationViewModel';

describe('Phase 20 explanation models', () => {
  it('uses recorded numeric interaction evidence for previous/current driver values', () => {
    const base = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'explanation-driver' });
    const driver = base.drivers.find((entry) => entry.teamId === base.selectedTeamId)!;
    const relationship = base.driverRelationships![driver.id];
    const state = {
      ...base,
      characterInteractions: {
        ...base.characterInteractions!,
        history: [{
          id: 'interaction-test',
          targetType: 'Driver' as const,
          targetId: driver.id,
          targetName: driver.name,
          teamId: driver.teamId,
          action: 'PraisePerformance' as const,
          actionLabel: 'Praise performance',
          seasonYear: base.seasonYear,
          round: 2,
          outcome: 'The driver responded well.',
          tone: 'Positive' as const,
          effects: ['+4 confidence', '+3 morale', '+1 principal trust'],
        }],
      },
    };

    const confidence = driverConfidenceExplanation(state, driver);
    const morale = driverMoraleExplanation(state, driver);
    const trust = driverTrustExplanation(state, driver);
    expect(confidence.previousValue).toBe(relationship.selfConfidence - 4);
    expect(morale.previousValue).toBe(relationship.morale - 3);
    expect(trust.previousValue).toBe(relationship.trustInPrincipal - 1);
    expect(confidence.downstreamEffects.join(' ')).toContain('multiplier');
    expect(trust.causes[0]).toMatchObject({ source: 'Recorded interaction · Round 2' });
  });

  it('labels absent prior values instead of manufacturing history', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'explanation-honesty' });
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const explanation = driverConfidenceExplanation({ ...state, characterInteractions: undefined, completedRaceResults: {} }, driver);
    expect(explanation.previousValue).toBeUndefined();
    expect(explanation.previousValueReason).toContain('not reconstructed');
    expect(explanation.causes[0].tone).toBe('uncertain');
  });

  it('reports deterministic setup effects and presentation-safe organizational context', () => {
    const state = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'explanation-setup' });
    const driver = state.drivers.find((entry) => entry.teamId === state.selectedTeamId)!;
    const race = state.calendar[0];
    const track = getTrackById(race.trackId)!;
    const before = JSON.stringify(state);
    const setup = setupConfidenceExplanation(state, driver, track);
    const morale = teamMoraleExplanation(state);
    const reputation = teamReputationExplanation(state);
    const scouting = scoutingUncertaintyExplanation(state);

    expect(setup.currentValue).toBeGreaterThanOrEqual(0);
    expect(setup.currentValue).toBeLessThanOrEqual(100);
    expect(setup.downstreamEffects.join(' ')).toContain('Race pace effect');
    expect(morale.currentValue).toBe(state.teams.find((team) => team.id === state.selectedTeamId)!.morale);
    expect(reputation.confidence).not.toBe('Unavailable');
    expect(scouting.summary).toContain('network baseline');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('separates intelligence confidence from confirmed fact', () => {
    const base = createNewGame({ gameMode: 'Career', seasonYear: 1995, series: 'F1', teamId: 't-benetton', seed: 'explanation-intel' });
    const report = {
      id: 'report-test',
      subjectType: 'Research' as const,
      subjectId: 'rival-project',
      targetTeamId: base.teams.find((team) => team.id !== base.selectedTeamId)!.id,
      title: 'Rival development direction',
      summary: 'A paddock source reports a possible aero programme.',
      source: 'PaddockRumor' as const,
      confidence: 52,
      reliability: 44,
      assessment: 'Plausible' as const,
      status: 'Active' as const,
      discoveredSeasonYear: base.seasonYear,
      discoveredRound: 1,
      expiresSeasonYear: base.seasonYear,
      expiresRound: 4,
    };
    const state = {
      ...base,
      phase18: {
        ...base.phase18!,
        intelligenceReports: [report],
      },
    };
    const explanation = intelligenceExplanation(state, report.id)!;
    expect(explanation.confidence).toBe('Low');
    expect(explanation.summary).toContain('Plausible intelligence');
    expect(explanation.downstreamEffects.join(' ')).toContain('not hidden rival-state disclosure');
  });
});
