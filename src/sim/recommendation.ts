// Setup recommendation used both as a UI hint and for AI opponents.

import type { SetupOption, Track } from '../types/gameTypes';
import { calculateSetupFit } from './setupEngine';

// Pick the setup option with the best fit for the track.
export function recommendSetup(track: Track, options: SetupOption[]): SetupOption {
  let best = options[0];
  let bestFit = -Infinity;
  for (const opt of options) {
    const fit = calculateSetupFit(opt, track);
    if (fit > bestFit) {
      bestFit = fit;
      best = opt;
    }
  }
  return best;
}
