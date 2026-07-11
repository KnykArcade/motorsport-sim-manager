import { describe, expect, it } from 'vitest';
import {
  DAMAGE_RANGES,
  damageColorForState,
  damageStateFromPercent,
  seriesToAssetId,
} from './raceMarkerAssets';

describe('raceMarkerAssets', () => {
  it('maps every supported series and season year to the locked era marker IDs', () => {
    expect(seriesToAssetId('NASCAR', 1995)).toBe('nascar_1990s');
    expect(seriesToAssetId('nascar', 2008)).toBe('nascar_2000s');
    expect(seriesToAssetId('NASCAR', 2017)).toBe('nascar_2010s');
    expect(seriesToAssetId('NASCAR', 2026)).toBe('nascar_2020s');
    expect(seriesToAssetId('F1', 1992)).toBe('f1_1990s');
    expect(seriesToAssetId('formula 1', 2006)).toBe('f1_2000s');
    expect(seriesToAssetId('F1', 2018)).toBe('f1_2010s');
    expect(seriesToAssetId('F1', 2026)).toBe('f1_2020s');
    expect(seriesToAssetId('IndyCar', 1997)).toBe('indycar_1990s');
    expect(seriesToAssetId('indycar', 2007)).toBe('indycar_2000s');
    expect(seriesToAssetId('IndyCar', 2018)).toBe('indycar_2010s');
    expect(seriesToAssetId('IndyCar', 2025)).toBe('indycar_2020s');
    expect(seriesToAssetId('CART', 1998)).toBe('cart_1990s');
    expect(seriesToAssetId('champ car', 2003)).toBe('cart_2000s');
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
