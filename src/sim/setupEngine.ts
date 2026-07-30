// Setup fit: how well a chosen setup package matches a track's profile.
// Returns roughly [-3, 3]; positive means the setup suits the circuit.

import type { SetupOption, Track } from '../types/gameTypes';
import { assertLegacyRating, toLegacyRating } from './ratingScale';

export function calculateSetupFit(setup: SetupOption, track: Track): number {
  const p = track.setupProfile;
  const profileValues = [p.aeroDemand, p.powerDemand, p.mechanicalDemand, p.brakeDemand];
  const legacyProfile = profileValues.every((value) => value <= 10);
  const demand = (value: number, label: string) => legacyProfile
    ? assertLegacyRating(value, label)
    : toLegacyRating(value, label);

  // Match each setup axis against the relevant track demand. The closer the
  // setup choice is to what the track wants, the higher the fit.
  const aeroMatch = matchAxis(setup.downforce, demand(p.aeroDemand, 'Track aero demand'));
  const powerMatch = matchAxis(setup.topSpeed, demand(p.powerDemand, 'Track power demand'));
  const mechMatch = matchAxis(setup.mechanicalGrip, demand(p.mechanicalDemand, 'Track mechanical demand'));
  const brakeMatch = matchAxis(setup.brakingStability, demand(p.brakeDemand, 'Track brake demand'));

  // Average the matches; downforce/power are the dominant trade-off so weight them.
  const fit =
    aeroMatch * 0.3 +
    powerMatch * 0.3 +
    mechMatch * 0.25 +
    brakeMatch * 0.15;

  return fit;
}

// Both inputs on a 1-10 scale. Returns ~[-3, 3]: small penalty grows with the
// gap between what the setup provides and what the track demands.
function matchAxis(setupValue: number, trackDemand: number): number {
  const gap = Math.abs(setupValue - trackDemand);
  // 0 gap => +3 (perfect), ~10 gap => -3.
  return 3 - (gap / 10) * 6;
}
