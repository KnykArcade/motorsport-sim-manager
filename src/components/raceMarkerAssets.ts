import type { LiveCarState } from '../types/liveTypes';
import type { RaceSeries } from './seriesMarker';

/**
 * Static outline states from the approved track-marker specification.
 *
 * `none` intentionally has no coloured outline. The normal black/white marker
 * keyline remains visible in every state.
 */
export type DamageState = 'none' | 'light' | 'medium' | 'high';

export const DAMAGE_RANGES = {
  none: { min: 0, max: 9, color: 'transparent' },
  light: { min: 10, max: 39, color: '#FFD400' },
  medium: { min: 40, max: 74, color: '#FF7A00' },
  high: { min: 75, max: 100, color: '#FF2A2A' },
} as const;

export const F1_MARKER_ERAS = ['f1_1990s', 'f1_2000s', 'f1_2010s', 'f1_2020s'] as const;
export const NASCAR_MARKER_ERAS = ['nascar_1990s', 'nascar_2000s', 'nascar_2010s', 'nascar_2020s'] as const;
export const INDYCAR_MARKER_ERAS = ['indycar_1990s', 'indycar_2000s', 'indycar_2010s', 'indycar_2020s'] as const;
export const CART_MARKER_ERAS = ['cart_1990s', 'cart_2000s'] as const;

export type F1MarkerEra = (typeof F1_MARKER_ERAS)[number];
export type NascarMarkerEra = (typeof NASCAR_MARKER_ERAS)[number];
export type IndyCarMarkerEra = (typeof INDYCAR_MARKER_ERAS)[number];
export type CartMarkerEra = (typeof CART_MARKER_ERAS)[number];

export const MARKER_SERIES = [
  ...NASCAR_MARKER_ERAS,
  ...F1_MARKER_ERAS,
  ...INDYCAR_MARKER_ERAS,
  ...CART_MARKER_ERAS,
] as const;

export type MarkerAssetId = (typeof MARKER_SERIES)[number];

export function normalizeSeriesId(series: string | undefined): RaceSeries {
  const normalized = series?.toLowerCase().trim();
  if (normalized === 'nascar') return 'nascar';
  if (normalized === 'f1' || normalized === 'formula 1' || normalized === 'formula1') return 'f1';
  if (normalized === 'indycar') return 'indycar';
  if (normalized === 'cart' || normalized === 'champ car' || normalized === 'champcar') return 'cart';
  return 'f1';
}

export function f1MarkerEraFromYear(year: number | undefined): F1MarkerEra {
  if (year != null && year >= 2020) return 'f1_2020s';
  if (year != null && year >= 2010) return 'f1_2010s';
  if (year != null && year >= 2000) return 'f1_2000s';
  return 'f1_1990s';
}

export function nascarMarkerEraFromYear(year: number | undefined): NascarMarkerEra {
  if (year != null && year >= 2020) return 'nascar_2020s';
  if (year != null && year >= 2010) return 'nascar_2010s';
  if (year != null && year >= 2000) return 'nascar_2000s';
  return 'nascar_1990s';
}

export function indyCarMarkerEraFromYear(year: number | undefined): IndyCarMarkerEra {
  if (year != null && year >= 2020) return 'indycar_2020s';
  if (year != null && year >= 2010) return 'indycar_2010s';
  if (year != null && year >= 2000) return 'indycar_2000s';
  return 'indycar_1990s';
}

export function cartMarkerEraFromYear(year: number | undefined): CartMarkerEra {
  return year != null && year >= 2000 ? 'cart_2000s' : 'cart_1990s';
}

export function seriesToAssetId(series: string | undefined, year?: number): MarkerAssetId {
  switch (normalizeSeriesId(series)) {
    case 'nascar':
      return nascarMarkerEraFromYear(year);
    case 'f1':
      return f1MarkerEraFromYear(year);
    case 'indycar':
      return indyCarMarkerEraFromYear(year);
    case 'cart':
      return cartMarkerEraFromYear(year);
  }
}

export function damageStateFromPercent(percent: number | undefined): DamageState {
  const damage = Math.max(0, Math.min(100, percent ?? 0));
  if (damage <= DAMAGE_RANGES.none.max) return 'none';
  if (damage <= DAMAGE_RANGES.light.max) return 'light';
  if (damage <= DAMAGE_RANGES.medium.max) return 'medium';
  return 'high';
}

export function damageColorForState(state: DamageState): string | undefined {
  return state === 'none' ? undefined : DAMAGE_RANGES[state].color;
}

export function getCarDamagePercent(
  car: Pick<LiveCarState, 'engineHealth' | 'gearboxHealth' | 'brakeHealth' | 'aeroHealth'>,
): number {
  const health = Math.min(
    car.engineHealth ?? 100,
    car.gearboxHealth ?? 100,
    car.brakeHealth ?? 100,
    car.aeroHealth ?? 100,
  );
  return Math.max(0, Math.min(100, 100 - health));
}
