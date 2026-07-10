import { describe, expect, it } from 'vitest';
import {
  DAMAGE_RANGES,
  damageColorForState,
  damageStateFromPercent,
  seriesToAssetId,
} from './raceMarkerAssets';

describe('raceMarkerAssets', () => {
  it('maps series and F1 season year to the locked marker IDs', () => {
    expect(seriesToAssetId('NASCAR')).toBe('nascar_a');
    expect(seriesToAssetId('nascar')).toBe('nascar_a');
    expect(seriesToAssetId('F1', 1992)).toBe('f1_1990s');
    expect(seriesToAssetId('formula 1', 2006)).toBe('f1_2000s');
    expect(seriesToAssetId('F1', 2018)).toBe('f1_2010s');
    expect(seriesToAssetId('F1', 2026)).toBe('f1_2020s');
    expect(seriesToAssetId('IndyCar')).toBe('indycar_c');
    expect(seriesToAssetId('indycar')).toBe('indycar_c');
    expect(seriesToAssetId('CART')).toBe('cart_c');
    expect(seriesToAssetId('champ car')).toBe('cart_c');
    expect(seriesToAssetId('unknown')).toBe('f1_1990s');
    expect(seriesToAssetId(undefined)).toBe('f1_1990s');
  });

  it('maps damage percent to the approved static states', () => {
    expect(damageStateFromPercent(-5)).toBe('none');
    expect(damageStateFromPercent(0)).toBe('none');
    expect(damageStateFromPercent(9)).toBe('none');
    expect(damageStateFromPercent(10)).toBe('light');
    expect(damageStateFromPercent(39)).toBe('light');
    expect(damageStateFromPercent(40)).toBe('medium');
    expect(damageStateFromPercent(74)).toBe('medium');
    expect(damageStateFromPercent(75)).toBe('high');
    expect(damageStateFromPercent(100)).toBe('high');
    expect(damageStateFromPercent(500)).toBe('high');
    expect(damageStateFromPercent(undefined)).toBe('none');
  });

  it('uses the exact approved damage-outline colors', () => {
    expect(damageColorForState('none')).toBeUndefined();
    expect(damageColorForState('light')).toBe('#FFD400');
    expect(damageColorForState('medium')).toBe('#FF7A00');
    expect(damageColorForState('high')).toBe('#FF2A2A');
    expect(DAMAGE_RANGES.none.color).toBe('transparent');
  });
});
