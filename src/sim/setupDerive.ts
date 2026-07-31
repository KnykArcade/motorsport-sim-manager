// Derive the session SetupOption (the flat package the simulation consumes)
// from a tuned CarSetup. The adapter selects the qualifying or race operating
// envelope from one physical snapshot; it does not add a magical session bonus.
//
// Two separate inputs shape the result:
//   * Objective Setup Quality (engineering fit vs track + car) drives the pace
//     ceiling, tyre wear and reliability protection.
//   * Driver Setup Comfort (the driver's feel for the setup) drives execution,
//     consistency and mistake risk.
// A driver can therefore be faster in a slightly worse setup they are
// comfortable in than in a theoretically better setup they do not trust.

import type { Car, Driver, SetupOption, Track } from '../types/gameTypes';
import type { CarSetup, DriverComfort, ObjectiveSetupQuality } from '../types/setupTypes';
import { objectiveSetupQuality } from './setupFitEngine';

export type SetupTrim = 'qualifying' | 'race';

export type DeriveOptions = {
  car?: Car;
  quality?: ObjectiveSetupQuality;
  comfort?: DriverComfort;
  // Staff / facilities / practice knowledge improves confidence in extracting
  // the setup. It never changes the physical performance snapshot.
  confidenceBonus?: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function deriveSetupOption(
  setup: CarSetup,
  track: Track,
  driver: Driver | undefined,
  trim: SetupTrim,
  opts: DeriveOptions = {},
): SetupOption {
  const quality = opts.quality ?? objectiveSetupQuality(setup, track, opts.car);
  const comfort = opts.comfort;
  const confidenceBonus = opts.confidenceBonus ?? 0;

  const downforce = clamp(Math.round((setup.frontWing + setup.rearWing) / 2), 1, 10);
  const topSpeed = clamp(Math.round(((11 - downforce) + setup.gearing) / 2), 1, 10);
  const mechanicalGrip = clamp(
    Math.round((11 - setup.suspensionStiffness) * 0.4 + (11 - setup.rideHeight) * 0.3 + setup.differential * 0.3),
    1,
    10,
  );
  const brakingStability = clamp(
    Math.round(setup.brakeCooling * 0.5 + (10 - Math.abs(setup.brakeBias - 5)) * 0.5),
    1,
    10,
  );

  // The authoritative surface produces only losses from car potential. Manual
  // ObjectiveSetupQuality fixtures and older adapters fall back to the same
  // non-positive loss convention until they carry a snapshot.
  const fallbackPhysicalLoss = -Math.max(0, 100 - quality.quality) / 7.5;
  const qualifyingPhysical = quality.snapshot
    ? quality.snapshot.sessions.qualifying.paceDelta
    : Math.min(quality.effects.qualifyingPaceCeiling, fallbackPhysicalLoss);
  const racePhysical = quality.snapshot
    ? quality.snapshot.sessions.raceStint.paceDelta
    : Math.min(quality.effects.racePaceCeiling, fallbackPhysicalLoss);
  const activeEnvelope = trim === 'qualifying'
    ? quality.snapshot?.sessions.qualifying
    : quality.snapshot?.sessions.raceStint;
  const confidenceExtraction = clamp(confidenceBonus / 20, -1, 1);
  const exec = (comfort ? comfort.effects.execution : -0.4) + confidenceExtraction * 0.25;
  const consistency = (comfort ? comfort.effects.consistency : -0.4) + confidenceExtraction * 0.2;
  const mistake = comfort ? comfort.effects.mistakeRisk : 0.6;
  const tyreMgmt = comfort ? comfort.effects.tyreManagement : 0;

  // Comfort can help a driver get closer to the ceiling, but can never turn a
  // physical setup loss into a positive setup boost.
  const qualifyingBoost = Math.min(0, qualifyingPhysical + exec * 0.45);
  const racePaceBoost = Math.min(0, racePhysical + consistency * 0.8);
  const surfaceTyreWear = activeEnvelope?.tyreWearDelta ?? quality.effects.tyreWear;
  const surfaceReliability = activeEnvelope?.reliabilityRisk ?? quality.effects.reliabilityRisk;
  const surfaceHeat = activeEnvelope?.overheatingRisk ?? quality.effects.overheatingRisk;
  const surfaceMistake = activeEnvelope?.mistakePressure ?? 0;
  const tirePreservation =
    (11 - setup.tyreUsage) * 0.72 + 2.2 + tyreMgmt * 1.2 - surfaceTyreWear * 1.35;
  const reliabilityProtection =
    setup.engineCooling * 0.55 + 3.1 - surfaceReliability * 1.1 - surfaceHeat * 0.7;
  const riskModifier =
    surfaceMistake * 1.25 +
    mistake * 3.4 +
    (setup.tyreUsage - 5) * 0.18 +
    Math.max(0, 5 - setup.brakeCooling) * 0.18 -
    confidenceExtraction * 0.35;

  const trimLabel = trim === 'qualifying' ? 'Qualifying Trim' : 'Race Trim';
  return {
    id: `tuned-${trim}-${driver?.id ?? 'car'}`,
    name: `Tuned Setup — ${trimLabel}`,
    description:
      trim === 'qualifying'
        ? 'Player-tuned engineering setup in a low-fuel qualifying trim.'
        : 'Player-tuned engineering setup in a long-run race trim.',
    downforce,
    topSpeed,
    mechanicalGrip,
    brakingStability,
    tirePreservation: clamp(round1(tirePreservation), 1, 10),
    reliabilityProtection: clamp(round1(reliabilityProtection), 1, 10),
    qualifyingBoost: clamp(round1(qualifyingBoost), -10, 0),
    racePaceBoost: clamp(round1(racePaceBoost), -10, 0),
    riskModifier: clamp(round1(riskModifier), -4, 7),
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
