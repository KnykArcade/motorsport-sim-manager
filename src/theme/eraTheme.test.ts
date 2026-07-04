import { describe, expect, it } from 'vitest';
import { getEraTheme } from './eraTheme';

describe('getEraTheme', () => {
  it('resolves F1 decade themes', () => {
    expect(getEraTheme('F1', 1990)).toBe('f1-1990s');
    expect(getEraTheme('F1', 1999)).toBe('f1-1990s');
    expect(getEraTheme('F1', 2000)).toBe('f1-2000s');
    expect(getEraTheme('F1', 2009)).toBe('f1-2000s');
    expect(getEraTheme('F1', 2010)).toBe('f1-2010s');
    expect(getEraTheme('F1', 2019)).toBe('f1-2010s');
    expect(getEraTheme('F1', 2020)).toBe('f1-2020s');
    expect(getEraTheme('F1', 2026)).toBe('f1-2020s');
  });

  it('preserves IndyCar era buckets and fallback', () => {
    expect(getEraTheme('IndyCar', 2008)).toBe('indycar-2008-2011');
    expect(getEraTheme('IndyCar', 2015)).toBe('indycar-2012-2017');
    expect(getEraTheme('IndyCar', 2020)).toBe('indycar-2018-2023');
    expect(getEraTheme('IndyCar', 2026)).toBe('indycar-modern');
    expect(getEraTheme('F1', 1989)).toBe('fallback');
    expect(getEraTheme(undefined, 2020)).toBe('fallback');
  });
});
