// Derive the session SetupOption (the flat package the simulation consumes)
// from a tuned CarSetup. Cars still automatically run a distinct qualifying trim
// on Saturday and a race trim on Sunday — those trims are produced here from the
// same player-tuned base, so good engineering setup is rewarded in both sessions
// while the player never picks "trim" manually.

import type { Driver, SetupOption, Track } from '../types/gameTypes';
import type { CarSetup } from '../types/setupTypes';
import { calculateSetupFit } from './setupFitEngine';

export type SetupTrim = 'qualifying' | 'race';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function deriveSetupOption(
  setup: CarSetup,
  track: Track,
  driver: Driver | undefined,
  trim: SetupTrim,
): SetupOption {
  const fit = calculateSetupFit(setup, track, driver);
  const conf = fit.confidence;

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

  const confDelta = (conf - 62) / 12; // ~ -5 .. +3
  let qualifyingBoost = confDelta;
  let racePaceBoost = confDelta * 0.85;
  let tirePreservation = (11 - setup.tyreUsage) * 0.7 + conf / 30;
  let reliabilityProtection = setup.engineCooling * 0.6 + conf / 40;
  let riskModifier = (62 - conf) / 14 + (setup.tyreUsage - 5) * 0.15;

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
    tirePreservation: clamp(Math.round(tirePreservation), 1, 10),
    reliabilityProtection: clamp(Math.round(reliabilityProtection), 1, 10),
    qualifyingBoost: clamp(Math.round(qualifyingBoost), -5, 5),
    racePaceBoost: clamp(Math.round(racePaceBoost), -5, 5),
    riskModifier: clamp(Math.round(riskModifier), -3, 5),
  };
}
