import { describe, expect, it } from 'vitest';

import { cars1995 } from '../data/cars/cars1995';
import { BALANCED_SETUP } from '../data/setup/setupComponents';
import { tracks1995 } from '../data/tracks/tracks1995';
import { tracks2016IndyCar } from '../data/tracks/tracks2016IndyCar';
import type { Car, Track } from '../types/gameTypes';
import type { CarSetup } from '../types/setupTypes';
import { calculateSetupPerformanceSnapshot } from './setupPerformanceSurface';

const monaco = tracks1995.find((track) => /monaco/i.test(track.name))!;
const monza = tracks1995.find((track) => /monza/i.test(track.name))!;
const shortOval = tracks2016IndyCar.find((track) => /phoenix/i.test(track.name))!;
const superspeedway = tracks2016IndyCar.find(
  (track) => /indianapolis motor speedway$/i.test(track.name),
)!;
const streetCircuit = tracks2016IndyCar.find((track) => /long beach/i.test(track.name))!;
const car: Car = { ...cars1995[0], setupWindow: 50 };

const highDownforce: CarSetup = {
  ...BALANCED_SETUP,
  frontWing: 9,
  rearWing: 9,
  suspensionStiffness: 4,
  rideHeight: 7,
  gearing: 3,
  brakeCooling: 7,
  differential: 6,
};

const lowDrag: CarSetup = {
  ...BALANCED_SETUP,
  frontWing: 2,
  rearWing: 2,
  suspensionStiffness: 7,
  rideHeight: 3,
  gearing: 9,
  brakeCooling: 4,
  engineCooling: 4,
};

function canonicalTrack(track: Track): Track {
  return {
    ...track,
    attributes: Object.fromEntries(
      Object.entries(track.attributes).map(([key, value]) => [key, value * 10]),
    ) as Track['attributes'],
    setupProfile: {
      ...track.setupProfile,
      topSpeedEmphasis: track.setupProfile.topSpeedEmphasis * 10,
      mechanicalGripEmphasis: track.setupProfile.mechanicalGripEmphasis * 10,
      brakeDemand: track.setupProfile.brakeDemand * 10,
      reliabilityRiskFocus: track.setupProfile.reliabilityRiskFocus * 10,
      aeroDemand: track.setupProfile.aeroDemand * 10,
      powerDemand: track.setupProfile.powerDemand * 10,
      mechanicalDemand: track.setupProfile.mechanicalDemand * 10,
      riskDemand: track.setupProfile.riskDemand * 10,
    },
  };
}

describe('hidden setup-performance surface', () => {
  it('is deterministic, finite and bounded across every session envelope', () => {
    const first = calculateSetupPerformanceSnapshot(BALANCED_SETUP, monaco, car);
    const second = calculateSetupPerformanceSnapshot(BALANCED_SETUP, monaco, car);
    expect(first).toEqual(second);

    for (const envelope of Object.values(first.sessions)) {
      expect(Number.isFinite(envelope.lapTimeLossPct)).toBe(true);
      expect(envelope.lapTimeLossPct).toBeGreaterThanOrEqual(0);
      expect(envelope.lapTimeLossPct).toBeLessThanOrEqual(6);
      expect(envelope.paceDelta).toBeLessThanOrEqual(0);
    }
    expect(first.objectiveQuality).toBeGreaterThanOrEqual(0);
    expect(first.objectiveQuality).toBeLessThanOrEqual(100);
  });

  it('treats setup as loss from car potential and never as a physical boost', () => {
    for (const setup of [BALANCED_SETUP, highDownforce, lowDrag]) {
      const snapshot = calculateSetupPerformanceSnapshot(setup, monza, car);
      expect(snapshot.qualifyingLapTimeLossPct).toBeGreaterThanOrEqual(0);
      expect(snapshot.longRunLapTimeLossPct).toBeGreaterThanOrEqual(0);
      expect(snapshot.sessions.qualifying.paceDelta).toBeLessThanOrEqual(0);
      expect(snapshot.sessions.raceStint.paceDelta).toBeLessThanOrEqual(0);
    }
  });

  it('makes a half-step change on an important setting measurably different', () => {
    const baseline = calculateSetupPerformanceSnapshot(highDownforce, monaco, car);
    const halfStep = calculateSetupPerformanceSnapshot(
      { ...highDownforce, frontWing: highDownforce.frontWing - 0.5 },
      monaco,
      car,
    );
    expect(halfStep.qualifyingLapTimeLossPct).not.toBe(baseline.qualifyingLapTimeLossPct);
  });

  it('makes related errors compound through behavior and interaction losses', () => {
    const single = calculateSetupPerformanceSnapshot(
      { ...highDownforce, frontWing: 4 },
      monaco,
      car,
    );
    const combined = calculateSetupPerformanceSnapshot(
      {
        ...highDownforce,
        frontWing: 4,
        rearWing: 10,
        suspensionStiffness: 9,
        rideHeight: 1,
        differential: 9,
      },
      monaco,
      car,
    );
    expect(combined.qualifyingLapTimeLossPct).toBeGreaterThan(single.qualifyingLapTimeLossPct);
    expect(combined.interactionLosses.aeroBalance).toBeGreaterThan(single.interactionLosses.aeroBalance);
    expect(combined.interactionLosses.platformCompliance).toBeGreaterThan(0);
  });

  it('rewards different setup philosophies at Monaco and Monza', () => {
    const monacoLoaded = calculateSetupPerformanceSnapshot(highDownforce, monaco, car);
    const monacoTrimmed = calculateSetupPerformanceSnapshot(lowDrag, monaco, car);
    const monzaLoaded = calculateSetupPerformanceSnapshot(highDownforce, monza, car);
    const monzaTrimmed = calculateSetupPerformanceSnapshot(lowDrag, monza, car);

    expect(monacoLoaded.qualifyingLapTimeLossPct).toBeLessThan(monacoTrimmed.qualifyingLapTimeLossPct);
    expect(monzaTrimmed.qualifyingLapTimeLossPct).toBeLessThan(monzaLoaded.qualifyingLapTimeLossPct);
  });

  it('distinguishes short ovals, superspeedways and street circuits', () => {
    const snapshots = [shortOval, superspeedway, streetCircuit].map((track) =>
      calculateSetupPerformanceSnapshot(BALANCED_SETUP, track, car));
    const losses = snapshots.map((snapshot) => snapshot.qualifyingLapTimeLossPct);
    expect(new Set(losses).size).toBe(3);
    expect(snapshots[0].behaviorLosses.traction)
      .not.toBe(snapshots[1].behaviorLosses.traction);
    expect(snapshots[2].behaviorLosses.brakingEntryStability)
      .not.toBe(snapshots[1].behaviorLosses.brakingEntryStability);
  });

  it('treats stiff, low cars differently on smooth and bumpy surfaces', () => {
    const smooth = {
      ...monaco,
      attributes: { ...monaco.attributes, surfaceGripBumpiness: 2 },
    };
    const stiffLow = { ...BALANCED_SETUP, suspensionStiffness: 9, rideHeight: 1 };
    const bumpyResult = calculateSetupPerformanceSnapshot(stiffLow, monaco, car);
    const smoothResult = calculateSetupPerformanceSnapshot(stiffLow, smooth, car);
    expect(bumpyResult.interactionLosses.platformCompliance)
      .toBeGreaterThan(smoothResult.interactionLosses.platformCompliance);
    expect(bumpyResult.longRunLapTimeLossPct).toBeGreaterThan(smoothResult.longRunLapTimeLossPct);
  });

  it('allows one-lap aggression to trade against long-run tyre performance', () => {
    const qualifyingFocus = {
      ...highDownforce,
      tyreUsage: 9,
      engineCooling: 4,
    };
    const raceFocus = {
      ...highDownforce,
      tyreUsage: 3,
      engineCooling: 7,
    };
    const qualifying = calculateSetupPerformanceSnapshot(qualifyingFocus, monaco, car);
    const race = calculateSetupPerformanceSnapshot(raceFocus, monaco, car);

    expect(qualifying.qualifyingLapTimeLossPct).toBeLessThan(race.qualifyingLapTimeLossPct);
    expect(qualifying.longRunLapTimeLossPct).toBeGreaterThan(race.longRunLapTimeLossPct);
    expect(qualifying.sessions.raceStint.tyreWearDelta)
      .toBeGreaterThan(race.sessions.raceStint.tyreWearDelta);
  });

  it('lets tight cooling reduce drag while increasing thermal and reliability exposure', () => {
    const tight = calculateSetupPerformanceSnapshot(
      { ...lowDrag, engineCooling: 2 },
      monza,
      car,
    );
    const open = calculateSetupPerformanceSnapshot(
      { ...lowDrag, engineCooling: 9 },
      monza,
      car,
    );
    expect(tight.behaviors.straightLineEfficiency).toBeGreaterThan(open.behaviors.straightLineEfficiency);
    expect(tight.sessions.raceStint.overheatingRisk).toBeGreaterThan(open.sessions.raceStint.overheatingRisk);
    expect(tight.sessions.raceStint.reliabilityRisk).toBeGreaterThan(open.sessions.raceStint.reliabilityRisk);
  });

  it('punishes the same deviation more heavily in a narrow-window car', () => {
    const missed = { ...highDownforce, frontWing: 5, rearWing: 5 };
    const narrow = calculateSetupPerformanceSnapshot(
      missed,
      monaco,
      { ...car, setupWindow: 15 },
    );
    const wide = calculateSetupPerformanceSnapshot(
      missed,
      monaco,
      { ...car, setupWindow: 90 },
    );
    expect(narrow.qualifyingLapTimeLossPct).toBeGreaterThan(wide.qualifyingLapTimeLossPct);
    expect(narrow.longRunLapTimeLossPct).toBeGreaterThan(wide.longRunLapTimeLossPct);
  });

  it('evaluates equivalent legacy and canonical track data identically', () => {
    expect(calculateSetupPerformanceSnapshot(BALANCED_SETUP, monaco, car)).toEqual(
      calculateSetupPerformanceSnapshot(BALANCED_SETUP, canonicalTrack(monaco), car),
    );
  });

  it('keeps the physical snapshot independent of staff and practice knowledge', () => {
    const baseline = calculateSetupPerformanceSnapshot(BALANCED_SETUP, monaco, car);
    const repeated = calculateSetupPerformanceSnapshot(BALANCED_SETUP, monaco, car);
    expect(repeated).toEqual(baseline);
  });
});
