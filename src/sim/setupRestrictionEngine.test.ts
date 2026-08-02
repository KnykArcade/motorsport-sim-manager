import { describe, expect, it } from 'vitest';
import { selectRaceRuleProfile } from '../data/rules/raceRuleProfiles';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import type { QualifyingResult } from '../types/gameTypes';
import {
  applySetupPenaltiesToGrid,
  beginSetupRestrictionWeekend,
  finalizeSetupRestrictionWeekend,
  recordSetupPenalty,
  setupPenaltyDelaySeconds,
} from './setupRestrictionEngine';

function qualifying(driverId: string, position: number): QualifyingResult {
  return {
    driverId,
    teamId: `team-${driverId}`,
    position,
    qualifyingScore: 100 - position,
    gapText: position === 1 ? 'POLE' : `+${position}s`,
    runPlan: 'StandardPush',
    setupChoice: 'Balanced',
    notes: [],
  };
}

describe('setupRestrictionEngine', () => {
  it('persists every weekend lock transition through race configuration finalization', () => {
    const profile = selectRaceRuleProfile('F1', 2026);
    const started = beginSetupRestrictionWeekend({
      raceId: 'race-1',
      profile,
      qualifyingConfigurationByDriver: { driver: BALANCED_SETUP },
    });
    const finalized = finalizeSetupRestrictionWeekend(started, { driver: { ...BALANCED_SETUP, frontWing: 5.5 } });

    expect(started.phase).toBe('QualifyingImpoundActive');
    expect(finalized.phase).toBe('RaceConfigurationFinalized');
    expect(finalized.phaseHistory).toEqual([
      'OpenPractice',
      'QualifyingConfigurationSubmitted',
      'QualifyingImpoundActive',
      'PreRaceGridRestrictions',
      'RaceConfigurationFinalized',
    ]);
    expect(finalized.qualifyingConfigurationByDriver.driver.frontWing).toBe(5);
    expect(finalized.finalRaceConfigurationByDriver.driver.frontWing).toBe(5.5);
  });

  it('moves penalized cars to the rear while preserving their relative order', () => {
    const profile = selectRaceRuleProfile('IndyCar', 2026);
    let weekend = beginSetupRestrictionWeekend({
      raceId: 'race-1', profile,
      qualifyingConfigurationByDriver: { a: BALANCED_SETUP, b: BALANCED_SETUP, c: BALANCED_SETUP },
    });
    weekend = recordSetupPenalty(weekend, {
      driverId: 'a', consequence: 'RearOfFieldAndDriveThrough', changedParams: ['rearWing'],
      authorized: false, reason: 'Unauthorized work', profile,
    });
    weekend = recordSetupPenalty(weekend, {
      driverId: 'b', consequence: 'RearOfField', changedParams: ['gearing'],
      authorized: true, reason: 'Authorized work', profile,
    });

    const grid = applySetupPenaltiesToGrid(
      [qualifying('a', 1), qualifying('b', 2), qualifying('c', 3)],
      weekend.penaltiesByDriver,
    );
    expect(grid.map((row) => [row.driverId, row.position])).toEqual([
      ['c', 1], ['a', 2], ['b', 3],
    ]);
    expect(setupPenaltyDelaySeconds('RearOfFieldAndDriveThrough')).toBe(24);
    expect(setupPenaltyDelaySeconds('RearOfField')).toBe(0);
  });
});
