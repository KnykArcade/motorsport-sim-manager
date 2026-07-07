import type { Series } from '../../types/gameTypes';

export type HistoricalWeatherRaceMeta = {
  raceId: string;
  seasonYear: number;
  series: Series;
  sourceSeries: Series;
  round: number;
  trackId: string;
  trackName: string;
  date: string;
  localStartTime: string;
  timezone: string;
  latitude: number;
  longitude: number;
  coordinateSource: 'workbook' | 'embedded' | 'geocoded' | 'assumed';
  startTimeSource: 'series-default' | 'workbook-estimate';
  startTimeConfidence?: 'High' | 'Medium' | 'Low';
  startTimeMethod?: string;
  assumptions: string[];
};

export type HistoricalWeatherTrackCoordinate = {
  trackId: string;
  latitude: number;
  longitude: number;
  sourceRaceId: string;
};
