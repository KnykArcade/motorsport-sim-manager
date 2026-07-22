// Derive the session SetupOption (the flat package the simulation consumes)
// from a tuned CarSetup. Cars still automatically run a distinct qualifying trim
// on Saturday and a race trim on Sunday — those trims are produced here from the
// same player-tuned base, so good engineering setup is rewarded in both sessions
// while the player never picks "trim" manually.
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
  // A small confidence bonus (0-100 scale points) from staff / facilities /
  // practice-setup knowledge, folded into the effective quality.
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

  const qual = quality.quality;
  // Objective quality sets the pace ceiling; driver comfort sets how much of it
  // is actually extracted (execution / consistency) and the mistake risk. When
  // the driver has no practice comfort data, an untested setup carries a small
  // execution penalty and extra risk.
  const effectiveQuality = clamp(qual + confidenceBonus, 0, 100);
  const severeMissPenalty = Math.max(0, 50 - effectiveQuality) / 7;
  const hookedUpBonus = Math.max(0, effectiveQuality - 82) / 18;
  const qCeil = (effectiveQuality - 62) / 10 - severeMissPenalty + hookedUpBonus; // ~ -9 .. +5
  const exec = comfort ? comfort.effects.execution : -0.4;
  const consistency = comfort ? comfort.effects.consistency : -0.4;
  const mistake = comfort ? comfort.effects.mistakeRisk : 0.6;
  const tyreMgmt = comfort ? comfort.effects.tyreManagement : 0;

  let qualifyingBoost = qCeil * 1.15 + exec * 1.2;
  let racePaceBoost = qCeil + consistency * 1.15;
  let tirePreservation =
    (11 - setup.tyreUsage) * 0.75 + effectiveQuality / 26 + tyreMgmt * 1.2 - severeMissPenalty * 0.6;
  let reliabilityProtection =
    setup.engineCooling * 0.65 +
    effectiveQuality / 28 -
    quality.effects.reliabilityRisk -
    quality.effects.overheatingRisk * 0.45;
  let riskModifier =
    (62 - effectiveQuality) / 12 +
    severeMissPenalty * 1.2 +
    mistake * 3.4 +
    (setup.tyreUsage - 5) * 0.18 +
    Math.max(0, 5 - setup.brakeCooling) * 0.18;

  // Apply the automatic session trim bias on top of the tuned base.
  if (trim === 'qualifying') {
    tirePreservation -= 2;
    reliabilityProtection -= 2;
    qualifyingBoost += 3;
    racePaceBoost -= 1;
    riskModifier += 2;
  } else {
    tirePreservation += 2;
    reliabilityProtection += 1;
    qualifyingBoost -= 1;
    racePaceBoost += 2;
    riskModifier -= 1;
  }

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
    qualifyingBoost: clamp(round1(qualifyingBoost), -7, 6),
    racePaceBoost: clamp(round1(racePaceBoost), -7, 6),
    riskModifier: clamp(round1(riskModifier), -4, 7),
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
