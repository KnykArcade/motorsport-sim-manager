import { describe, expect, it } from 'vitest';
import { tracks1995 } from '../data/tracks/tracks1995';
import { selectRaceRuleProfile } from '../data/rules/raceRuleProfiles';
import { initialSafetyCar, stepSafetyCar } from './safetyCarEngine';
import type { RaceControlMode } from '../types/raceRulesTypes';

const track = tracks1995[0];
const weather = { condition: 'Dry' as const, label: 'Dry', wet: false, gripLevel: 1, changingSoon: false };
const incident = { incidentThisLap: true, incidentSeverity: 1 };

describe('safety car rule-profile integration', () => {
  it('blocks late deployment when the selected profile prohibits it', () => {
    const base = selectRaceRuleProfile('F1', 1995, track);
    const profile = { ...base, raceControl: { ...base.raceControl, lateRaceCautionsAllowed: false } };
    const results = Array.from({ length: 20 }, (_, index) =>
      stepSafetyCar(initialSafetyCar(), track, weather, incident, `late-block-${index}`, 19, 20, profile),
    );
    expect(results.every((result) => !result.justDeployed)).toBe(true);
  });

  it('allows a supported late-race neutralisation to be evaluated', () => {
    const profile = selectRaceRuleProfile('F1', 1995, track);
    const results = Array.from({ length: 20 }, (_, index) =>
      stepSafetyCar(initialSafetyCar(), track, weather, incident, `late-allow-${index}`, 19, 20, profile),
    );
    expect(results.some((result) => result.justDeployed)).toBe(true);
  });

  it('does not deploy when the profile supports no full-course mode', () => {
    const base = selectRaceRuleProfile('F1', 1995, track);
    const profile = { ...base, raceControl: { ...base.raceControl, supportedModes: ['LocalYellow'] as RaceControlMode[] } };
    const results = Array.from({ length: 20 }, (_, index) =>
      stepSafetyCar(initialSafetyCar(), track, weather, incident, `mode-block-${index}`, 5, 20, profile),
    );
    expect(results.every((result) => !result.justDeployed)).toBe(true);
  });
});
