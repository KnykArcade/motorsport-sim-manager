import { describe, expect, it } from 'vitest';

import { getCircuitSegmentsForRace } from '../data/circuits/circuitLookup';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { setupOptionsById } from '../data/setupOptions/setupOptions';
import { cars1995 } from '../data/cars/cars1995';
import { tracks1995 } from '../data/tracks/tracks1995';
import type { CarSetup } from '../types/setupTypes';
import { splitLapIntoCircuitSectorTimes } from './segmentPaceEngine';
import { calculateSetupPerformanceSnapshot } from './setupPerformanceSurface';
import {
  blendSetupEnvelopes,
  buildTunedSetupSimulationProfile,
  legacySetupToCarSetup,
  liveSetupEnvelope,
  qualifyingSetupEnvelope,
  quickRaceSetupEnvelope,
  resolveLegacySetupSimulationProfile,
  setupSectorLossWeights,
} from './setupSimulationProfile';

const track = tracks1995.find((candidate) => /monaco/i.test(candidate.name)) ?? tracks1995[0];
const car = cars1995[0];
const circuit = getCircuitSegmentsForRace({ track, year: 1995, series: 'F1', totalLaps: 60 });

const qualifyingFocus: CarSetup = {
  ...BALANCED_SETUP,
  frontWing: 9,
  rearWing: 9,
  suspensionStiffness: 4,
  rideHeight: 7,
  differential: 6,
  tyreUsage: 9,
  engineCooling: 3,
};

const raceFocus: CarSetup = {
  ...qualifyingFocus,
  tyreUsage: 2,
  engineCooling: 9,
  brakeCooling: 8,
};

function profile(setup: CarSetup) {
  return buildTunedSetupSimulationProfile(setup, track, car);
}

describe('authoritative setup simulation profile', () => {
  it('keeps every runtime pace effect non-positive', () => {
    for (const envelope of Object.values(profile(qualifyingFocus).sessions)) {
      expect(envelope.physicalPaceDelta).toBeLessThanOrEqual(0);
      expect(envelope.driverExtractionDelta).toBeLessThanOrEqual(0);
      expect(envelope.paceDelta).toBeLessThanOrEqual(0);
    }
  });

  it('does not consume positive legacy trim bonuses', () => {
    const base = setupOptionsById['setup-balanced'];
    const boosted = { ...base, qualifyingBoost: 99, racePaceBoost: 99 };
    const normalProfile = resolveLegacySetupSimulationProfile(base, track, car);
    const boostedProfile = resolveLegacySetupSimulationProfile(boosted, track, car);
    expect(boostedProfile).toEqual(normalProfile);
  });

  it('converts legacy packages into finite bounded physical profiles', () => {
    const converted = legacySetupToCarSetup(setupOptionsById['setup-quali-trim']);
    const resolved = resolveLegacySetupSimulationProfile(setupOptionsById['setup-quali-trim'], track, car);
    expect(Object.values(converted).every(Number.isFinite)).toBe(true);
    expect(resolved.sessions.qualifying.lapTimeLossPct).toBeGreaterThanOrEqual(0);
    expect(resolved.sessions.qualifying.lapTimeLossPct).toBeLessThanOrEqual(6);
  });

  it('blends qualifying toward the wet envelope as grip deteriorates', () => {
    const resolved = profile(qualifyingFocus);
    expect(qualifyingSetupEnvelope(resolved, 0)).toEqual(resolved.sessions.qualifying);
    expect(qualifyingSetupEnvelope(resolved, 1)).toEqual(resolved.sessions.wet);
    const halfWet = qualifyingSetupEnvelope(resolved, 0.5);
    expect(halfWet.paceDelta).toBeCloseTo(
      (resolved.sessions.qualifying.paceDelta + resolved.sessions.wet.paceDelta) / 2,
      3,
    );
  });

  it('uses a deterministic Quick Sim composite rather than one fixed race number', () => {
    const resolved = profile(qualifyingFocus);
    const first = quickRaceSetupEnvelope(resolved);
    const second = quickRaceSetupEnvelope(resolved);
    expect(second).toEqual(first);
    expect(first.paceDelta).toBeLessThanOrEqual(0);
    expect(first).not.toEqual(resolved.sessions.qualifying);
  });

  it('changes the live envelope between heavy fuel, late stint, traffic and wet running', () => {
    const resolved = profile(qualifyingFocus);
    const start = liveSetupEnvelope(resolved, { lap: 1, totalLaps: 60, wetness: 0, inTraffic: false });
    const late = liveSetupEnvelope(resolved, { lap: 55, totalLaps: 60, wetness: 0, inTraffic: false });
    const traffic = liveSetupEnvelope(resolved, { lap: 30, totalLaps: 60, wetness: 0, inTraffic: true });
    const wet = liveSetupEnvelope(resolved, { lap: 30, totalLaps: 60, wetness: 1, inTraffic: false });
    expect(start).toEqual(resolved.sessions.raceStart);
    expect(late).toEqual(resolved.sessions.lateStint);
    expect(traffic).not.toEqual(resolved.sessions.raceStint);
    expect(wet).toEqual(resolved.sessions.wet);
  });

  it('makes qualifying aggression trade against race tyre and thermal exposure', () => {
    const aggressive = quickRaceSetupEnvelope(profile(qualifyingFocus));
    const protectedRace = quickRaceSetupEnvelope(profile(raceFocus));
    expect(aggressive.tyreWearDelta).toBeGreaterThan(protectedRace.tyreWearDelta);
    expect(aggressive.overheatingRisk).toBeGreaterThan(protectedRace.overheatingRisk);
  });

  it('keeps blends bounded and deterministic', () => {
    const resolved = profile(qualifyingFocus);
    const blend = blendSetupEnvelopes(resolved.sessions.raceStart, resolved.sessions.wet, 0.4);
    expect(blend).toEqual(blendSetupEnvelopes(resolved.sessions.raceStart, resolved.sessions.wet, 0.4));
    expect(blend.paceDelta).toBeLessThanOrEqual(0);
    expect(blend.reliabilityRisk).toBeGreaterThanOrEqual(0);
  });

  it('places setup loss in physically sensitive sectors without changing total lap time', () => {
    const resolved = profile(qualifyingFocus);
    const weights = setupSectorLossWeights(resolved, circuit);
    const baseline = splitLapIntoCircuitSectorTimes(90, circuit);
    const distributed = splitLapIntoCircuitSectorTimes(90, circuit, weights);
    expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
    expect(distributed.reduce((sum, value) => sum + value, 0)).toBeCloseTo(90, 3);
    expect(distributed).not.toEqual(baseline);
  });

  it('changes sector emphasis when the physical setup philosophy changes', () => {
    const aggressiveWeights = setupSectorLossWeights(profile(qualifyingFocus), circuit);
    const raceWeights = setupSectorLossWeights(profile(raceFocus), circuit);
    expect(aggressiveWeights).not.toEqual(raceWeights);
  });

  it('uses the same snapshot data for qualifying, Quick Sim and Live Race', () => {
    const snapshot = calculateSetupPerformanceSnapshot(qualifyingFocus, track, car);
    const resolved = buildTunedSetupSimulationProfile(qualifyingFocus, track, car, { snapshot });
    expect(resolved.snapshot).toBe(snapshot);
    expect(qualifyingSetupEnvelope(resolved, 0).physicalPaceDelta)
      .toBe(snapshot.sessions.qualifying.paceDelta);
    expect(liveSetupEnvelope(resolved, { lap: 30, totalLaps: 60, wetness: 0, inTraffic: false }).physicalPaceDelta)
      .toBe(snapshot.sessions.raceStint.paceDelta);
    expect(quickRaceSetupEnvelope(resolved).physicalPaceDelta).toBeLessThanOrEqual(0);
  });
});
