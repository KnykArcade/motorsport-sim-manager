// Setup fit: how well a chosen setup package matches a track's profile.
// Returns roughly [-3, 3]; positive means the setup suits the circuit.

import type { SetupOption, Track } from '../types/gameTypes';

export function calculateSetupFit(setup: SetupOption, track: Track): number {
  const p = track.setupProfile;

  // Match each setup axis against the relevant track demand. The closer the
  // setup choice is to what the track wants, the higher the fit.
  const aeroMatch = matchAxis(setup.downforce, p.aeroDemand);
  const powerMatch = matchAxis(setup.topSpeed, p.powerDemand);
  const mechMatch = matchAxis(setup.mechanicalGrip, p.mechanicalDemand);
  const brakeMatch = matchAxis(setup.brakingStability, p.brakeDemand);

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
