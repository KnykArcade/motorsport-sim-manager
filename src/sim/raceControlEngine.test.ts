import { describe, expect, it } from 'vitest';
import { selectRaceRuleProfile } from '../data/rules/raceRuleProfiles';
import { initialRaceControlState, stepRaceControlState } from './raceControlEngine';

describe('race control state engine', () => {
  it('uses SafetyCar for F1 and PaceCar for NASCAR', () => {
    const transition = { safetyCar: { active: true, lapsRemaining: 3, deployedOnLap: 5, reason: 'Incident', deployments: 1 }, justDeployed: true, justEnded: false };
    const f1 = selectRaceRuleProfile('F1', 1995);
    const nascar = selectRaceRuleProfile('NASCAR', 2026);
    expect(stepRaceControlState(initialRaceControlState(f1), transition, f1, 5).mode).toBe('SafetyCar');
    expect(stepRaceControlState(initialRaceControlState(nascar), transition, nascar, 5).mode).toBe('PaceCar');
  });

  it('moves through a restart state before returning green', () => {
    const profile = selectRaceRuleProfile('F1', 1995);
    const active = { ...initialRaceControlState(profile), mode: 'SafetyCar' as const };
    const ended = stepRaceControlState(active, { safetyCar: { active: false, lapsRemaining: 0, deployedOnLap: 4, reason: 'Incident', deployments: 1 }, justDeployed: false, justEnded: true }, profile, 7);
    expect(ended.mode).toBe('GreenFlagRestart');
    expect(stepRaceControlState(ended, { safetyCar: { active: false, lapsRemaining: 0, deployedOnLap: 4, reason: 'Incident', deployments: 1 }, justDeployed: false, justEnded: false }, profile, 8).mode).toBe('Green');
  });

  it('finishes explicitly', () => {
    const initial = initialRaceControlState();
    const transition = { safetyCar: { active: false, lapsRemaining: 0, deployedOnLap: null, reason: null, deployments: 0 }, justDeployed: false, justEnded: false };
    expect(stepRaceControlState(initial, transition, undefined, 10, true).mode).toBe('Finished');
  });
});
