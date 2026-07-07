import type { Series } from '../types/gameTypes';
import type { WeatherCondition, WeatherState } from '../types/liveTypes';

export type HistoricalWeatherSample = {
  time: string;
  weatherCode: number;
  condition: WeatherCondition;
  state: WeatherState;
  precipitationMm?: number;
  rainMm?: number;
  cloudCover?: number;
  temperature2m?: number;
  windSpeed10m?: number;
};

export type HistoricalWeatherHourlyPoint = {
  time: string;
  weatherCode: number;
  precipitationMm?: number;
  rainMm?: number;
  cloudCover?: number;
  temperature2m?: number;
  windSpeed10m?: number;
};

export type HistoricalWeatherAnchor = {
  raceId: string;
  raceName: string;
  trackId: string;
  trackName: string;
  year: number;
  series: Series;
  date: string;
  localStartTime: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  coordinateSource?: 'embedded' | 'geocoded' | 'assumed' | 'workbook';
  startTimeSource?: 'embedded' | 'series-default' | 'workbook-estimate';
  startTimeConfidence?: 'High' | 'Medium' | 'Low';
  startTimeMethod?: string;
};

export type HistoricalWeatherTimeline = {
  anchor: HistoricalWeatherAnchor;
  source: 'open-meteo-archive';
  resolutionMinutes: number;
  assumptions: string[];
  hourly?: HistoricalWeatherHourlyPoint[];
  samples: HistoricalWeatherSample[];
};

export type HistoricalWeatherQuery = {
  latitude: number;
  longitude: number;
  date: string;
  timezone: string;
};

const DRY_CONDITIONS = new Set([0]);
const CLOUDY_CONDITIONS = new Set([1, 2, 3, 45, 48]);
const LIGHT_RAIN_CONDITIONS = new Set([51, 53, 55, 56, 57, 61, 63, 80, 81]);
const HEAVY_RAIN_CONDITIONS = new Set([65, 66, 67, 71, 73, 75, 77, 82, 85, 86, 95, 96, 99]);

export function mapWmoCodeToWeatherCondition(code: number): WeatherCondition {
  if (DRY_CONDITIONS.has(code)) return 'Dry';
  if (CLOUDY_CONDITIONS.has(code)) return 'Cloudy';
  if (LIGHT_RAIN_CONDITIONS.has(code)) return 'LightRain';
  if (HEAVY_RAIN_CONDITIONS.has(code)) return 'HeavyRain';
  return code >= 50 && code < 80 ? 'Changeable' : 'Cloudy';
}

export function weatherStateFromWmoCode(code: number, changingSoon = false): WeatherState {
  const condition = mapWmoCodeToWeatherCondition(code);
  const wet = condition === 'LightRain' || condition === 'HeavyRain';
  const gripLevel =
    condition === 'Dry'
      ? 1
      : condition === 'Cloudy'
        ? 0.97
        : condition === 'Drying'
          ? 0.85
          : condition === 'Changeable'
            ? 0.8
            : condition === 'LightRain'
              ? 0.72
              : 0.5;
  return {
    condition,
    gripLevel,
    wet,
    changingSoon,
    label:
      condition === 'LightRain'
        ? 'Light Rain'
        : condition === 'HeavyRain'
          ? 'Heavy Rain'
          : condition === 'Drying'
            ? 'Drying'
            : condition === 'Changeable'
              ? 'Changeable'
              : condition,
  };
}

export function defaultLocalStartTime(series: Series, year: number): string {
  if (series === 'F1') return '14:00';
  if (series === 'Champ Car') return year >= 2004 ? '14:00' : '13:00';
  return year >= 2008 ? '13:30' : '13:00';
}

export function createHistoricalWeatherTimeline(
  anchor: HistoricalWeatherAnchor,
  hourly: HistoricalWeatherHourlyPoint[],
  options?: {
    raceWindowMinutes?: number;
    resolutionMinutes?: number;
  },
): HistoricalWeatherTimeline {
  const resolutionMinutes = options?.resolutionMinutes ?? 15;
  const raceWindowMinutes = options?.raceWindowMinutes ?? 180;
  if (hourly.length === 0) {
    return {
      anchor,
      source: 'open-meteo-archive',
      resolutionMinutes,
      assumptions: ['No hourly weather points available'],
      hourly,
      samples: [],
    };
  }
  const samples: HistoricalWeatherSample[] = [];
  const sampleCount = Math.max(1, Math.ceil(raceWindowMinutes / resolutionMinutes));

  for (let index = 0; index < sampleCount; index += 1) {
    const minutesFromStart = index * resolutionMinutes;
    const hourIndex = Math.min(hourly.length - 1, Math.max(0, Math.floor(minutesFromStart / 60)));
    const current = hourly[hourIndex];
    const next = hourly[Math.min(hourIndex + 1, hourly.length - 1)];
    const changingSoon =
      Boolean(next) && next.weatherCode !== current.weatherCode && minutesFromStart % 60 >= 30;
    samples.push({
      time: offsetLocalTime(anchor.date, anchor.localStartTime, minutesFromStart),
      weatherCode: current.weatherCode,
      condition: mapWmoCodeToWeatherCondition(current.weatherCode),
      state: weatherStateFromWmoCode(current.weatherCode, changingSoon),
      precipitationMm: current.precipitationMm,
      rainMm: current.rainMm,
      cloudCover: current.cloudCover,
      temperature2m: current.temperature2m,
      windSpeed10m: current.windSpeed10m,
    });
  }

  return {
    anchor,
    source: 'open-meteo-archive',
    resolutionMinutes,
    assumptions: [],
    hourly,
    samples,
  };
}

export function offsetLocalTime(date: string, localTime: string, minutesOffset: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(localTime);
  if (!match || !timeMatch) return `${date}T${localTime}`;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  const base = new Date(Date.UTC(year, month, day, hour, minute, 0));
  base.setUTCMinutes(base.getUTCMinutes() + minutesOffset);

  const yyyy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  const hh = String(base.getUTCHours()).padStart(2, '0');
  const min = String(base.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}
