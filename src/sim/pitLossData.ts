import type { Series, Track } from '../types/gameTypes';

export type PitLossSeries = Series | 'NASCAR';

export type PitLossTrackOverride = {
  trackId: string;
  pitLaneDeltaSeconds: number;
  series?: PitLossSeries;
  eraStartYear?: number;
  eraEndYear?: number;
  source?: string;
};

export type PitLossSeriesEraOverride = {
  series: PitLossSeries;
  eraStartYear: number;
  eraEndYear: number;
  stationarySeconds: number;
  source?: string;
};

export type PitLossOverrides = {
  trackPitLaneDeltaSeconds?: PitLossTrackOverride[];
  seriesEraStationarySeconds?: PitLossSeriesEraOverride[];
};

const FALLBACK_PIT_LOSS = 22;

// Default, tunable placeholder data. These are intentionally simple so the
// workbook-backed data source can replace them later without any engine change.
const SERIES_ERA_STATIONARY_BASELINES: PitLossSeriesEraOverride[] = [
  { series: 'F1', eraStartYear: 1990, eraEndYear: 1993, stationarySeconds: 7.0, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'F1', eraStartYear: 1994, eraEndYear: 2009, stationarySeconds: 7.2, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'F1', eraStartYear: 2010, eraEndYear: 2013, stationarySeconds: 3.0, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'F1', eraStartYear: 2014, eraEndYear: 2026, stationarySeconds: 2.5, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'IndyCar', eraStartYear: 1990, eraEndYear: 2004, stationarySeconds: 8.4, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'IndyCar', eraStartYear: 2005, eraEndYear: 2019, stationarySeconds: 8.0, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'IndyCar', eraStartYear: 2020, eraEndYear: 2026, stationarySeconds: 7.6, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'CART', eraStartYear: 1990, eraEndYear: 2003, stationarySeconds: 8.2, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'Champ Car', eraStartYear: 2004, eraEndYear: 2007, stationarySeconds: 8.0, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'NASCAR', eraStartYear: 1990, eraEndYear: 2010, stationarySeconds: 18.0, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'NASCAR', eraStartYear: 2011, eraEndYear: 2017, stationarySeconds: 15.0, source: 'Placeholder baseline until workbook data lands.' },
  { series: 'NASCAR', eraStartYear: 2018, eraEndYear: 2026, stationarySeconds: 13.5, source: 'Placeholder baseline until workbook data lands.' },
];

const DEFAULT_TRACK_PIT_LANE_DELTA_SECONDS: ReadonlyArray<{ match: RegExp; seconds: number; source: string }> = [
  { match: /superspeedway/i, seconds: 19.5, source: 'Placeholder archetype default.' },
  { match: /speedway/i, seconds: 18.2, source: 'Placeholder archetype default.' },
  { match: /short oval/i, seconds: 16.8, source: 'Placeholder archetype default.' },
  { match: /oval/i, seconds: 17.4, source: 'Placeholder archetype default.' },
  { match: /street/i, seconds: 15.6, source: 'Placeholder archetype default.' },
  { match: /airport/i, seconds: 15.2, source: 'Placeholder archetype default.' },
  { match: /temporary/i, seconds: 15.4, source: 'Placeholder archetype default.' },
  { match: /mixed/i, seconds: 15.0, source: 'Placeholder archetype default.' },
  { match: /road/i, seconds: 14.8, source: 'Placeholder archetype default.' },
];

let overrides: PitLossOverrides | null = null;
// Workbook/data-loader seam: register exact track and series/era values here,
// and the live race will prefer them over the built-in placeholder defaults.

export type PitLossSeriesEraContext = {
  series: PitLossSeries;
  year: number;
};

export type PitLossTrackContext = PitLossSeriesEraContext & {
  track: Pick<Track, 'id' | 'archetype' | 'setupProfile' | 'attributes' | 'name' | 'gpName'>;
};

export function registerPitLossDataOverrides(next: PitLossOverrides | null): void {
  overrides = next;
}

export function pitLossBaseline(track?: Track, series?: PitLossSeries, year?: number): number {
  if (!track || !series || year == null) return FALLBACK_PIT_LOSS;
  return resolveTrackPitLaneDelta(track, series, year) + resolveSeriesEraStationaryBaseline(series, year);
}

export function resolveSeriesEraStationaryBaseline(series: PitLossSeries, year: number): number {
  const override = overrides?.seriesEraStationarySeconds?.find(
    (row) => row.series === series && year >= row.eraStartYear && year <= row.eraEndYear,
  );
  if (override) return override.stationarySeconds;

  const dataSourceOverride = SERIES_ERA_STATIONARY_BASELINES.find(
    (row) => row.series === series && year >= row.eraStartYear && year <= row.eraEndYear,
  );
  if (dataSourceOverride) return dataSourceOverride.stationarySeconds;

  return FALLBACK_PIT_LOSS;
}

export function resolveTrackPitLaneDelta(track: Track, series: PitLossSeries, year: number): number {
  const override = overrides?.trackPitLaneDeltaSeconds?.find((row) => {
    if (row.trackId !== track.id) return false;
    if (row.series && row.series !== series) return false;
    if (row.eraStartYear != null && year < row.eraStartYear) return false;
    if (row.eraEndYear != null && year > row.eraEndYear) return false;
    return true;
  });
  if (override) return override.pitLaneDeltaSeconds;

  const label = `${track.archetype} ${track.setupProfile.primarySetupProfile ?? ''} ${track.name ?? ''} ${track.gpName ?? ''}`.toLowerCase();
  const archetypeDefault =
    DEFAULT_TRACK_PIT_LANE_DELTA_SECONDS.find((entry) => entry.match.test(label))?.seconds ?? 15.2;
  const topSpeedBias = clamp((track.setupProfile.topSpeedEmphasis - 70) * 0.035, -1.1, 1.8);
  const straightsBias = clamp((track.attributes.straights - 70) * 0.02, -0.9, 1.2);
  const riskWallBias = clamp((track.attributes.riskWallProximity - 70) * -0.01, -0.6, 0.4);
  return round1(Math.max(8.5, archetypeDefault + topSpeedBias + straightsBias + riskWallBias));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
