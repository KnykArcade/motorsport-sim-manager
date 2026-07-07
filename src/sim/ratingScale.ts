export const RATING_SCALE = 100;
export const LEGACY_RATING_SCALE = 10;
export const RATING_MIDPOINT = 50;
export const LEGACY_RATING_MIDPOINT = 5;

export function toLegacyRating(rating: number): number {
  return rating / (RATING_SCALE / LEGACY_RATING_SCALE);
}

export function toGameRating(legacyRating: number): number {
  return legacyRating * (RATING_SCALE / LEGACY_RATING_SCALE);
}

export function clampRating100(value: number): number {
  return Math.max(1, Math.min(RATING_SCALE, Math.round(value)));
}
