import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/home/ubuntu/motorsport-sim-manager';
const CACHE_DIR = path.join(ROOT, 'src/data/weather/cache');

const PILOT = [
  {
    raceId: '2024-F1-Australian-Grand-Prix',
    raceName: 'Australian Grand Prix',
    trackQuery: 'Albert Park Circuit, Melbourne, Australia',
    geocodeQuery: 'Albert Park, Melbourne, Australia',
    countryCode: 'AU',
    date: '2024-03-24',
    localStartTime: '15:00',
    series: 'F1',
    year: 2024,
    timezone: 'Australia/Melbourne',
    startTimeSource: 'embedded',
  },
  {
    raceId: '2005-Champ-Car-Long-Beach',
    raceName: 'Toyota Grand Prix of Long Beach',
    trackQuery: 'Long Beach Street Circuit, Long Beach, California, United States',
    geocodeQuery: 'Long Beach, California, United States',
    countryCode: 'US',
    date: '2005-04-10',
    localStartTime: '13:00',
    series: 'Champ Car',
    year: 2005,
    timezone: 'America/Los_Angeles',
    startTimeSource: 'series-default',
  },
  {
    raceId: '2024-IndyCar-Indianapolis-500',
    raceName: 'Indianapolis 500',
    trackQuery: 'Indianapolis Motor Speedway, Speedway, Indiana, United States',
    geocodeQuery: 'Indianapolis Motor Speedway, Speedway, Indiana, United States',
    countryCode: 'US',
    date: '2024-05-26',
    localStartTime: '13:00',
    series: 'IndyCar',
    year: 2024,
    timezone: 'America/Indiana/Indianapolis',
    startTimeSource: 'series-default',
  },
];

const WEATHER_LABELS = {
  Dry: 'Dry',
  Cloudy: 'Cloudy',
  LightRain: 'Light Rain',
  HeavyRain: 'Heavy Rain',
  Drying: 'Drying',
  Changeable: 'Changeable',
};

function mapWmoCodeToWeatherCondition(code) {
  if (code === 0) return 'Dry';
  if ([1, 2, 3, 45, 48].includes(code)) return 'Cloudy';
  if ([51, 53, 55, 56, 57, 61, 63, 80, 81].includes(code)) return 'LightRain';
  if ([65, 66, 67, 71, 73, 75, 77, 82, 85, 86, 95, 96, 99].includes(code)) return 'HeavyRain';
  return code >= 50 && code < 80 ? 'Changeable' : 'Cloudy';
}

function weatherStateFromWmoCode(code, changingSoon = false) {
  const condition = mapWmoCodeToWeatherCondition(code);
  return {
    condition,
    gripLevel:
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
                : 0.5,
    wet: condition === 'LightRain' || condition === 'HeavyRain',
    changingSoon,
    label: WEATHER_LABELS[condition],
  };
}

function offsetLocalTime(date, localTime, minutesOffset) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = localTime.split(':').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  base.setUTCMinutes(base.getUTCMinutes() + minutesOffset);
  const yyyy = base.getUTCFullYear();
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(base.getUTCDate()).padStart(2, '0');
  const hh = String(base.getUTCHours()).padStart(2, '0');
  const min = String(base.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function buildTimeline(anchor, hourly, windowMinutes = 180, resolutionMinutes = 15) {
  const samples = [];
  const sampleCount = Math.max(1, Math.ceil(windowMinutes / resolutionMinutes));
  for (let index = 0; index < sampleCount; index += 1) {
    const minutesFromStart = index * resolutionMinutes;
    const hourIndex = Math.min(hourly.length - 1, Math.max(0, Math.floor(minutesFromStart / 60)));
    const current = hourly[hourIndex];
    const next = hourly[Math.min(hourIndex + 1, hourly.length - 1)];
    samples.push({
      time: offsetLocalTime(anchor.date, anchor.localStartTime, minutesFromStart),
      weatherCode: current.weatherCode,
      condition: mapWmoCodeToWeatherCondition(current.weatherCode),
      state: weatherStateFromWmoCode(current.weatherCode, Boolean(next) && next.weatherCode !== current.weatherCode && minutesFromStart % 60 >= 30),
      precipitationMm: current.precipitationMm,
      rainMm: current.rainMm,
      cloudCover: current.cloudCover,
    });
  }
  return samples;
}

async function geocode(query, countryCode) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'en');
  if (countryCode) url.searchParams.set('countryCode', countryCode);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed for ${query}: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const match = data.results?.[0];
  if (!match) throw new Error(`No geocoding results for ${query}`);
  return {
    latitude: match.latitude,
    longitude: match.longitude,
    timezone: match.timezone ?? 'UTC',
    name: match.name,
    country: match.country,
  };
}

async function geocodeWithFallbacks(primaryQuery, fallbacks = []) {
  const attempts = [primaryQuery, ...fallbacks].filter(Boolean);
  let lastError = null;
  for (const query of attempts) {
    try {
      return await geocode(query);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`No geocoding results for ${primaryQuery}`);
}

async function fetchArchive({ latitude, longitude, date, timezone }) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('start_date', date);
  url.searchParams.set('end_date', date);
  url.searchParams.set('timezone', timezone);
  url.searchParams.set('hourly', 'weather_code,precipitation,rain,cloud_cover');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('precipitation_unit', 'mm');
  url.searchParams.set('timeformat', 'iso8601');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Archive fetch failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const summary = [];

  for (const pilot of PILOT) {
    const fallbacks = [pilot.geocodeQuery, pilot.trackQuery.split(',')[0], pilot.trackQuery.replace(/ Circuit/i, '').replace(/ Speedway/i, '').replace(/ Street/i, '')];
    const geo = await geocodeWithFallbacks(pilot.geocodeQuery ?? pilot.trackQuery, fallbacks, pilot.countryCode);
    const archive = await fetchArchive({
      latitude: geo.latitude,
      longitude: geo.longitude,
      date: pilot.date,
      timezone: pilot.timezone || geo.timezone || 'UTC',
    });

    const hourly = archive.hourly?.time?.map((time, index) => ({
      time,
      weatherCode: archive.hourly.weather_code[index],
      precipitationMm: archive.hourly.precipitation?.[index],
      rainMm: archive.hourly.rain?.[index],
      cloudCover: archive.hourly.cloud_cover?.[index],
    })) ?? [];

    const anchor = {
      raceId: pilot.raceId,
      raceName: pilot.raceName,
      trackId: pilot.trackQuery,
      trackName: pilot.trackQuery,
      year: pilot.year,
      series: pilot.series,
      date: pilot.date,
      localStartTime: pilot.localStartTime,
      timezone: pilot.timezone || geo.timezone || 'UTC',
      latitude: geo.latitude,
      longitude: geo.longitude,
      coordinateSource: 'geocoded',
      startTimeSource: pilot.startTimeSource,
    };

    const timeline = {
      anchor,
      source: 'open-meteo-archive',
      resolutionMinutes: 15,
      assumptions: pilot.startTimeSource === 'series-default' ? [`Default local start time used: ${pilot.localStartTime}`] : [],
      hourly,
      samples: buildTimeline(anchor, hourly, 180, 15),
    };

    const file = path.join(CACHE_DIR, `${pilot.raceId}.json`);
    await writeFile(file, `${JSON.stringify(timeline, null, 2)}\n`, 'utf8');

    const realSample = timeline.samples.filter((sample) => sample.condition !== 'Dry').length;
    summary.push({
      raceId: pilot.raceId,
      raceName: pilot.raceName,
      date: pilot.date,
      timezone: anchor.timezone,
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      samples: timeline.samples.length,
      nonDrySamples: realSample,
      assumptions: timeline.assumptions,
      file,
    });
  }

  await writeFile(path.join(CACHE_DIR, 'pilot-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
