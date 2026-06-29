// Automatic, track-appropriate setup packages (professional team preparation).
//
// The player no longer picks setup trim. Instead the team prepares one
// track-appropriate base aero/mechanical package, then derives two DISTINCT
// trims from it: a low-fuel, aggressive QUALIFYING trim run on Saturday and a
// long-run, consistency-focused RACE trim run on Sunday. The two trims share
// the base downforce profile (so the car suits the circuit) but differ in
// qualifying/race pace bias, tyre preservation, reliability protection and risk.

import type { SetupOption, Track } from '../types/gameTypes';
import { setupOptions } from '../data/setupOptions/setupOptions';
import { calculateSetupFit } from './setupEngine';

// The session-specific trim packages are excluded from base selection — the
// base is purely an aero/mechanical profile, and the trims are derived here.
const TRIM_EXCLUDE = new Set(['setup-quali-trim', 'setup-race-trim']);

function baseSetup(track: Track): SetupOption {
  let best = setupOptions[0];
  let bestFit = -Infinity;
  for (const opt of setupOptions) {
    if (TRIM_EXCLUDE.has(opt.id)) continue;
    const fit = calculateSetupFit(opt, track);
    if (fit > bestFit) {
      bestFit = fit;
      best = opt;
    }
  }
  return best;
}

export type AutoSetups = {
  base: SetupOption;
  qualifying: SetupOption;
  race: SetupOption;
};

export function autoSetupsForTrack(track: Track): AutoSetups {
  const base = baseSetup(track);

  const qualifying: SetupOption = {
    ...base,
    id: `auto-quali-${track.id}`,
    name: `${base.name} — Qualifying Trim`,
    description: 'Low-fuel, aggressive trim for maximum one-lap pace.',
    tirePreservation: clamp(base.tirePreservation - 2, 1, 10),
    reliabilityProtection: clamp(base.reliabilityProtection - 2, 1, 10),
    qualifyingBoost: base.qualifyingBoost + 3,
    racePaceBoost: base.racePaceBoost - 1,
    riskModifier: base.riskModifier + 2,
  };

  const race: SetupOption = {
    ...base,
    id: `auto-race-${track.id}`,
    name: `${base.name} — Race Trim`,
    description: 'Long-run trim tuned for tyre life and consistency.',
    tirePreservation: clamp(base.tirePreservation + 2, 1, 10),
    reliabilityProtection: clamp(base.reliabilityProtection + 1, 1, 10),
    qualifyingBoost: base.qualifyingBoost - 1,
    racePaceBoost: base.racePaceBoost + 2,
    riskModifier: base.riskModifier - 1,
  };

  return { base, qualifying, race };
}

// Derived setups use track-specific ids that are not in the static
// setupOptions table, so engines must be given this overlay to resolve them.
export function autoSetupOptionsForTrack(track: Track): Record<string, SetupOption> {
  const { qualifying, race } = autoSetupsForTrack(track);
  return { [qualifying.id]: qualifying, [race.id]: race };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
