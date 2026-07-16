import { describe, it, expect } from 'vitest';
import {
  classifyDnfCause,
  pickDnfCause,
  eraDnfProfile,
  eraReliabilityScale,
  liveOtherRisk,
  liveRiskCalibration,
  type DnfCause,
} from './dnfModel';
import { createSeededRandom } from './random';

const rng = createSeededRandom('test');

describe('classifyDnfCause', () => {
  const cases: [string, DnfCause][] = [
    ['Engine failure', 'Mechanical'],
    ['Gearbox failure', 'Mechanical'],
    ['Transmission failure', 'Mechanical'],
    ['Clutch failure', 'Mechanical'],
    ['Hydraulics failure', 'Mechanical'],
    ['Electrical failure', 'Mechanical'],
    ['Electronics failure', 'Mechanical'],
    ['Cooling failure', 'Mechanical'],
    ['Overheating', 'Mechanical'],
    ['Oil pressure failure', 'Mechanical'],
    ['Oil leak', 'Mechanical'],
    ['Fuel pressure problem', 'Mechanical'],
    ['Fuel pump failure', 'Mechanical'],
    ['Suspension failure', 'Mechanical'],
    ['Brake failure', 'Mechanical'],
    ['Steering failure', 'Mechanical'],
    ['Driveshaft failure', 'Mechanical'],
    ['Differential failure', 'Mechanical'],
    ['Crashed out', 'Crash'],
    ['Spun off', 'Crash'],
    ['Spun into the barriers', 'Crash'],
    ['Collision, retired', 'Crash'],
    ['Contact damage, retired', 'Crash'],
    ['Lost it under braking', 'Crash'],
    ['First-lap collision', 'Crash'],
    ['Puncture', 'TyreDamage'],
    ['Tyre failure', 'TyreDamage'],
    ['Tyre delamination', 'TyreDamage'],
    ['Wheel rim failure', 'TyreDamage'],
    ['Wheel nut issue', 'TyreDamage'],
    ['Wheel bearing failure', 'TyreDamage'],
    ['Driver unwell', 'Other'],
    ['Debris damage', 'Other'],
    ['Refuelling issue', 'Other'],
    ['Stalled', 'Other'],
    ['Out of fuel', 'Other'],
    ['Fire', 'Other'],
    ['Retired by team', 'Other'],
    // Mixed mechanical-root-cause crash wording should classify by root cause.
    ['Brake failure — crashed out', 'Mechanical'],
    ['Suspension failure — hit the barriers', 'Mechanical'],
    ['Steering failure — spun off', 'Mechanical'],
    // 'Wheel not attached' is operational, not a tyre/wheel failure.
    ['Wheel not attached', 'Other'],
    // Generic fuel system is other; fuel pressure/pump is mechanical above.
    ['Fuel system', 'Other'],
  ];

  it.each(cases)('classifies "%s" as %s', (label, expected) => {
    expect(classifyDnfCause(label)).toBe(expected);
  });

  it('falls back to Other for empty/unknown labels', () => {
    expect(classifyDnfCause(undefined)).toBe('Other');
    expect(classifyDnfCause('')).toBe('Other');
    expect(classifyDnfCause('Mystery retirement')).toBe('Other');
  });
});

describe('pickDnfCause', () => {
  it('returns a valid cause and a label from the expanded arrays', () => {
    const result = pickDnfCause(1990, {
      carReliability: 65,
      aggression: 50,
      composure: 70,
      tyreWear: 50,
      wallProximity: 60,
      inTraffic: false,
    }, rng);

    expect(['Mechanical', 'Crash', 'TyreDamage', 'Other']).toContain(result.cause);
    expect(result.label).toBeTruthy();
  });

  it('respects era profiles', () => {
    const p1 = eraDnfProfile(1990);
    const p2 = eraDnfProfile(1996);
    const p3 = eraDnfProfile(2024);

    expect(p1.reliability + p1.crash + p1.tyre + p1.other).toBeCloseTo(1);
    expect(p2.reliability).toBeLessThan(p1.reliability);
    expect(p3.reliability).toBeLessThan(p2.reliability);
  });
});

describe('era calibration helpers', () => {
  it('eraReliabilityScale and liveRiskCalibration are defined for all eras', () => {
    expect(eraReliabilityScale(1990)).toBeGreaterThan(0);
    expect(eraReliabilityScale(2024)).toBeGreaterThan(0);
    expect(liveRiskCalibration(1990, 'F1').mech).toBeGreaterThan(0);
    expect(liveRiskCalibration(2024, 'F1').crash).toBeGreaterThan(0);
  });

  it('uses series-specific live risk calibration instead of applying F1 multipliers to oval series', () => {
    expect(liveRiskCalibration(1998, 'NASCAR')).not.toEqual(liveRiskCalibration(1998, 'F1'));
    expect(liveRiskCalibration(2008, 'IndyCar')).not.toEqual(liveRiskCalibration(2008, 'F1'));
    expect(liveRiskCalibration(2002, 'CART')).not.toEqual(liveRiskCalibration(2002, 'F1'));
    expect(liveRiskCalibration(1998, 'NASCAR').crash).toBeLessThan(liveRiskCalibration(1998, 'F1').crash);
  });

  it('derives other retirement risk from total exposure and the era target share', () => {
    const risk = liveOtherRisk(1996, 0.001, 0.0005, 0.0001);
    const total = 0.001 + 0.0005 + 0.0001 + risk;
    expect(risk / total).toBeCloseTo(eraDnfProfile(1996).other, 6);
  });

  it('scales with retirement exposure rather than an independent fixed chance', () => {
    const baseline = liveOtherRisk(2024, 0.0004, 0.0008, 0.0001);
    expect(liveOtherRisk(2024, 0.0008, 0.0016, 0.0002)).toBeCloseTo(baseline * 2, 10);
  });
});
