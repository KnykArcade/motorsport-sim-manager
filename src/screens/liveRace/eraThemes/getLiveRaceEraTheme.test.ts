import { describe, expect, it } from 'vitest';
import { getLiveRaceEraTheme, shouldUseF11990sLiveRaceScreen } from './getLiveRaceEraTheme';

describe('getLiveRaceEraTheme', () => {
  it('uses the F1 1990s live race theme for 1990-1999 F1 seasons', () => {
    expect(getLiveRaceEraTheme('F1', 1990)).toBe('f1-1990s');
    expect(getLiveRaceEraTheme('F1', 1995)).toBe('f1-1990s');
    expect(getLiveRaceEraTheme('F1', 1999)).toBe('f1-1990s');
    expect(shouldUseF11990sLiveRaceScreen('F1', 1995)).toBe(true);
  });

  it('does not apply the 1990s F1 live race theme to other eras or series', () => {
    expect(getLiveRaceEraTheme('F1', 2000)).toBe('f1-2000s');
    expect(getLiveRaceEraTheme('F1', 2026)).toBe('f1-2020s');
    expect(getLiveRaceEraTheme('IndyCar', 2008)).toBe('indycar-2008-2011');
    expect(shouldUseF11990sLiveRaceScreen('IndyCar', 1995)).toBe(false);
  });

  it('falls back safely with missing season data', () => {
    expect(getLiveRaceEraTheme('F1', undefined)).toBe('fallback');
    expect(getLiveRaceEraTheme(undefined, 1995)).toBe('fallback');
  });
});
