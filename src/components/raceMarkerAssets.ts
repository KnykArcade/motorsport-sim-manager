import type { LiveCarState } from '../types/liveTypes';
import type { RaceSeries } from './seriesMarker';

export type DamageState = 'healthy' | 'light' | 'heavy' | 'critical';

export const DAMAGE_RANGES = {
  healthy: { min: 0, max: 9, color: 'transparent' },
  light: { min: 10, max: 39, color: '#FFD400' },
  heavy: { min: 40, max: 74, color: '#FF7A00' },
  critical: { min: 75, max: 100, color: '#FF2A2A' },
} as const;

export const MARKER_SIZES = [20, 40, 80, 128, 256] as const;

export const MARKER_SERIES = ['nascar_a', 'f1_a', 'indycar_b', 'cart_a'] as const;

export const CRITICAL_FRAME_COUNT = 4;

export const CRITICAL_FRAME_MS = 140;

export const PING_PONG_FRAMES = [0, 1, 2, 3, 2, 1] as const;

export function normalizeSeriesId(series: string | undefined): RaceSeries {
  const s = series?.toLowerCase().trim();
  if (s === 'nascar') return 'nascar';
  if (s === 'f1' || s === 'formula 1' || s === 'formula1') return 'f1';
  if (s === 'indycar') return 'indycar';
  if (s === 'cart' || s === 'champ car' || s === 'champcar') return 'cart';
  return 'f1';
}

export function seriesToAssetId(series: string | undefined): string {
  const s = normalizeSeriesId(series);
  switch (s) {
    case 'nascar':
      return 'nascar_a';
    case 'f1':
      return 'f1_a';
    case 'indycar':
      return 'indycar_b';
    case 'cart':
      return 'cart_a';
    default:
      return 'f1_a';
  }
}

export function damageStateFromPercent(percent: number | undefined): DamageState {
  const p = percent ?? 0;
  if (p <= DAMAGE_RANGES.healthy.max) return 'healthy';
  if (p <= DAMAGE_RANGES.light.max) return 'light';
  if (p <= DAMAGE_RANGES.heavy.max) return 'heavy';
  return 'critical';
}

export function pickMarkerSize(displaySize: number): number {
  for (const size of MARKER_SIZES) {
    if (size >= displaySize) return size;
  }
  return 256;
}

export function baseMarkerUrl(assetId: string, size: number): string {
  const sizeFolder = pickMarkerSize(size);
  if (sizeFolder === 256) {
    return `/assets/markers/base/256px/${assetId}_neutral.png`;
  }
  return `/assets/markers/base/${sizeFolder}px/${assetId}.png`;
}

export function damageOverlayUrl(assetId: string, state: DamageState, size: number): string {
  const sizeFolder = pickMarkerSize(size);
  return `/assets/markers/damage/${sizeFolder}px/${assetId}_${state}.png`;
}

export function criticalFrameUrl(assetId: string, frameIndex: number, size: number): string {
  const sizeFolder = pickMarkerSize(size);
  const frameNumber = String(frameIndex).padStart(2, '0');
  return `/assets/markers/critical/${sizeFolder}px/${assetId}_critical_frame_${frameNumber}.png`;
}

export function criticalFrameFromTick(frameIndex: number): number {
  return PING_PONG_FRAMES[frameIndex % PING_PONG_FRAMES.length] + 1;
}

export function getCarDamagePercent(car: Pick<LiveCarState, 'engineHealth' | 'gearboxHealth' | 'brakeHealth' | 'aeroHealth'>): number {
  const health = Math.min(
    car.engineHealth ?? 100,
    car.gearboxHealth ?? 100,
    car.brakeHealth ?? 100,
    car.aeroHealth ?? 100,
  );
  return Math.max(0, Math.min(100, 100 - health));
}
