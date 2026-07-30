export const RATING_SCALE = 100;
export const LEGACY_RATING_SCALE = 10;
export const RATING_MIDPOINT = 50;
export const LEGACY_RATING_MIDPOINT = 5;

function assertFiniteRating(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number; received ${String(value)}.`);
  }
}

export function assertRating100(value: number, label = 'Rating'): number {
  assertFiniteRating(value, label);
  if (value < 1 || value > RATING_SCALE) {
    throw new RangeError(`${label} must be on the 1-100 scale; received ${value}.`);
  }
  return value;
}

export function assertLegacyRating(value: number, label = 'Legacy rating'): number {
  assertFiniteRating(value, label);
  if (value < 1 || value > LEGACY_RATING_SCALE) {
    throw new RangeError(`${label} must be on the 1-10 scale; received ${value}.`);
  }
  return value;
}

export function toLegacyRating(rating: number, label = 'Rating'): number {
  return assertRating100(rating, label) / (RATING_SCALE / LEGACY_RATING_SCALE);
}

export function toGameRating(legacyRating: number, label = 'Legacy rating'): number {
  assertFiniteRating(legacyRating, label);
  if (Math.abs(legacyRating) > LEGACY_RATING_SCALE) {
    throw new RangeError(`${label} must be within the -10 to 10 legacy scale; received ${legacyRating}.`);
  }
  return legacyRating * (RATING_SCALE / LEGACY_RATING_SCALE);
}

// Curated historical modules pre-date the canonical 1-100 runtime model. This
// conversion belongs only at that explicit ingestion boundary; simulation code
// must not guess a rating's scale from an individual value.
export function historicalRatingToGameRating(value: number, label = 'Historical rating'): number {
  assertFiniteRating(value, label);
  return value <= LEGACY_RATING_SCALE
    ? toGameRating(assertLegacyRating(value, label), label)
    : assertRating100(value, label);
}

export function clampRating100(value: number): number {
  return Math.max(1, Math.min(RATING_SCALE, Math.round(value)));
}
