import { describe, expect, it } from 'vitest';
import {
  baseMarkerUrl,
  criticalFrameFromTick,
  criticalFrameUrl,
  damageOverlayUrl,
  damageStateFromPercent,
  pickMarkerSize,
  seriesToAssetId,
} from './raceMarkerAssets';

describe('raceMarkerAssets', () => {
  it('maps series to the exact asset IDs from the manifest', () => {
    expect(seriesToAssetId('NASCAR')).toBe('nascar_a');
    expect(seriesToAssetId('nascar')).toBe('nascar_a');
    expect(seriesToAssetId('F1')).toBe('f1_a');
    expect(seriesToAssetId('formula 1')).toBe('f1_a');
    expect(seriesToAssetId('IndyCar')).toBe('indycar_b');
    expect(seriesToAssetId('indycar')).toBe('indycar_b');
    expect(seriesToAssetId('CART')).toBe('cart_a');
    expect(seriesToAssetId('cart')).toBe('cart_a');
    expect(seriesToAssetId('unknown')).toBe('f1_a');
    expect(seriesToAssetId(undefined)).toBe('f1_a');
  });

  it('maps damage percent to the correct visual state', () => {
    expect(damageStateFromPercent(0)).toBe('healthy');
    expect(damageStateFromPercent(9)).toBe('healthy');
    expect(damageStateFromPercent(10)).toBe('light');
    expect(damageStateFromPercent(39)).toBe('light');
    expect(damageStateFromPercent(40)).toBe('heavy');
    expect(damageStateFromPercent(74)).toBe('heavy');
    expect(damageStateFromPercent(75)).toBe('critical');
    expect(damageStateFromPercent(100)).toBe('critical');
    expect(damageStateFromPercent(undefined)).toBe('healthy');
    expect(damageStateFromPercent(-5)).toBe('healthy');
  });

  it('picks the smallest marker size that fits the display', () => {
    expect(pickMarkerSize(10)).toBe(20);
    expect(pickMarkerSize(20)).toBe(20);
    expect(pickMarkerSize(25)).toBe(40);
    expect(pickMarkerSize(40)).toBe(40);
    expect(pickMarkerSize(80)).toBe(80);
    expect(pickMarkerSize(128)).toBe(128);
    expect(pickMarkerSize(256)).toBe(256);
    expect(pickMarkerSize(300)).toBe(256);
  });

  it('resolves base marker URLs for every supplied size', () => {
    expect(baseMarkerUrl('f1_a', 20)).toBe('/assets/markers/base/20px/f1_a.png');
    expect(baseMarkerUrl('f1_a', 40)).toBe('/assets/markers/base/40px/f1_a.png');
    expect(baseMarkerUrl('nascar_a', 256)).toBe('/assets/markers/base/256px/nascar_a_neutral.png');
    expect(baseMarkerUrl('indycar_b', 50)).toBe('/assets/markers/base/80px/indycar_b.png');
  });

  it('resolves damage overlay URLs for every state', () => {
    expect(damageOverlayUrl('f1_a', 'healthy', 20)).toBe('/assets/markers/damage/20px/f1_a_healthy.png');
    expect(damageOverlayUrl('cart_a', 'critical', 80)).toBe('/assets/markers/damage/80px/cart_a_critical.png');
  });

  it('produces critical frame URLs with two-digit frame numbers', () => {
    expect(criticalFrameUrl('nascar_a', 1, 20)).toBe('/assets/markers/critical/20px/nascar_a_critical_frame_01.png');
    expect(criticalFrameUrl('nascar_a', 4, 128)).toBe('/assets/markers/critical/128px/nascar_a_critical_frame_04.png');
  });

  it('plays critical frames in ping-pong order (01→02→03→04→03→02)', () => {
    expect(criticalFrameFromTick(0)).toBe(1);
    expect(criticalFrameFromTick(1)).toBe(2);
    expect(criticalFrameFromTick(2)).toBe(3);
    expect(criticalFrameFromTick(3)).toBe(4);
    expect(criticalFrameFromTick(4)).toBe(3);
    expect(criticalFrameFromTick(5)).toBe(2);
    expect(criticalFrameFromTick(6)).toBe(1);
    expect(criticalFrameFromTick(7)).toBe(2);
  });
});
