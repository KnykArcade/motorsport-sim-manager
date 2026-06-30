// Weekend advisor: pure, deterministic engineering recommendations for the
// weekend decision screens. Given the track character and the forecast weather
// for the relevant session, suggest a qualifying run plan, race strategy and
// driver instruction — surfaced as a "Recommended" badge with a short reason.

import type { Track } from '../types/gameTypes';
import type { WeatherState } from '../types/liveTypes';

export type WeekendRecommendation = { optionId: string; reason: string };

function isWet(w?: WeatherState): boolean {
  return !!w && (w.condition === 'LightRain' || w.condition === 'HeavyRain');
}

function isUncertain(w?: WeatherState): boolean {
  return (
    !!w &&
    (w.changingSoon ||
      w.condition === 'Cloudy' ||
      w.condition === 'Drying' ||
      w.condition === 'Changeable')
  );
}

export function recommendedQualiRunPlan(track: Track, weather?: WeatherState): WeekendRecommendation {
  if (isWet(weather)) {
    return { optionId: 'ConservativeCleanLap', reason: 'Wet track — banking a clean lap beats chasing the limit.' };
  }
  if (isUncertain(weather)) {
    return { optionId: 'BankerLapFirst', reason: 'Changeable skies — set a banker lap before conditions shift.' };
  }
  if (track.archetype === 'Street Circuit' || track.attributes.surfaceGripBumpiness >= 7) {
    return { optionId: 'LateTrackEvolution', reason: 'Grip builds through the session here — run late.' };
  }
  return { optionId: 'StandardPush', reason: 'Dry and stable — a standard push lap maximises the result.' };
}

export function recommendedRaceStrategy(track: Track, weather?: WeatherState): WeekendRecommendation {
  if (isWet(weather)) {
    return { optionId: 'ReactiveStrategy', reason: 'Wet race — stay reactive to the crossover and safety cars.' };
  }
  if (isUncertain(weather)) {
    return { optionId: 'ReactiveStrategy', reason: 'Forecast is unstable — keep your options open.' };
  }
  if (track.archetype === 'Street Circuit' || track.attributes.overtakingRacecraft <= 3) {
    return { optionId: 'TrackPositionFocus', reason: 'Overtaking is hard here — protect track position.' };
  }
  if (track.attributes.enduranceConsistency >= 7 || track.attributes.tractionAcceleration >= 8) {
    return { optionId: 'AggressiveTwoStop', reason: 'High tyre wear rewards an extra stop.' };
  }
  return { optionId: 'BalancedOneStop', reason: 'A balanced one-stop fits this circuit.' };
}

export function recommendedInstruction(track: Track, weather?: WeatherState): WeekendRecommendation {
  if (isWet(weather)) {
    return { optionId: 'ProtectCar', reason: 'Wet and risky — protect the car and bring it home.' };
  }
  if (track.archetype === 'High-Risk Circuit' || track.attributes.riskWallProximity >= 7) {
    return { optionId: 'Conservative', reason: 'Walls are close — a mistake is costly.' };
  }
  if (track.attributes.enduranceConsistency >= 7) {
    return { optionId: 'ProtectCar', reason: 'Hard on the car — manage it to the finish.' };
  }
  return { optionId: 'Balanced', reason: 'Balanced pace suits these conditions.' };
}
