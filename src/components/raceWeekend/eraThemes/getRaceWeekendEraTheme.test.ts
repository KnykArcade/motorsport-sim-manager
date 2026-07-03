import { describe, expect, it } from 'vitest';
import { getRaceWeekendEraTheme } from './getRaceWeekendEraTheme';

describe('getRaceWeekendEraTheme', () => {
  it('routes F1 1990 to the 1990s F1 theme', () => {
    expect(getRaceWeekendEraTheme('F1', 1990)).toBe('f1-1990s');
  });

  it('routes F1 1995 to the 1990s F1 theme', () => {
    expect(getRaceWeekendEraTheme('F1', 1995)).toBe('f1-1990s');
  });

  it('routes F1 1999 to the 1990s F1 theme', () => {
    expect(getRaceWeekendEraTheme('F1', 1999)).toBe('f1-1990s');
  });

  it('does not apply the 1990s F1 theme to F1 2000', () => {
    expect(getRaceWeekendEraTheme('F1', 2000)).toBe('f1-2000s');
  });

  it('does not apply the 1990s F1 theme to F1 2026', () => {
    expect(getRaceWeekendEraTheme('F1', 2026)).toBe('f1-2020s');
  });

  it('does not apply the 1990s F1 theme to IndyCar 2008', () => {
    expect(getRaceWeekendEraTheme('IndyCar', 2008)).toBe('indycar-2008-2011');
  });

  it('falls back safely when the year is missing or unknown', () => {
    expect(getRaceWeekendEraTheme('F1', undefined)).toBe('fallback');
    expect(getRaceWeekendEraTheme(undefined, 1995)).toBe('fallback');
    expect(getRaceWeekendEraTheme('F1', 1989)).toBe('fallback');
  });
});
