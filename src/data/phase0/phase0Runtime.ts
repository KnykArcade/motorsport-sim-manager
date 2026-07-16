import type { Car, Driver, Phase0SeasonBundle, Series, Team, TeamPrincipal, Track } from '../../types/gameTypes';
import type { MarketDriver } from '../../types/marketTypes';
import type { SeasonBundle } from '../seasonCatalog';
import { availableSeasons } from '../seasonCatalog';
import { globalCarsPhase0 } from './generated/globalCars';
import { globalDriversPhase0 } from './generated/globalDrivers';
import { globalTeamsPhase0 } from './generated/globalTeams';
import { globalTracksPhase0 } from './generated/globalTracks';
import { historicalWeatherRaceMeta } from '../weather/generated/raceMeta';
import { historicalWeatherTrackCoordinates } from '../weather/generated/trackCoordinates';
import { seedReleasedMarketDrivers } from '../market';

type Phase0TrackSource = {
  name?: string;
  facility?: string;
  locationDisplay?: string;
  lengthKm?: number;
  seasonsUsed?: Array<{ year: number; series: Series }>;
  aliases?: string[];
  country: string;
  category: string;
  subcategory: string;
  configNote?: string;
  attributes: Track['attributes'];
  demandProfile: {
    downforceDemand: number;
    powerDemand: number;
    mechanicalDemand: number;
    brakeDemand: number;
    riskDemand: number;
  };
};

type Phase0DriverSource = {
  driverId: string;
  name?: string;
  nationality?: string;
  birthYear?: number;
  startingAge?: number;
  firstSeenYear?: number;
  cornering?: number;
  braking?: number;
  straights?: number;
  tractionAcceleration?: number;
  elevationBlindCorners?: number;
  technical?: number;
  overtakingRacecraft?: number;
  surfaceGripBumpiness?: number;
  riskManagement?: number;
  enduranceConsistency?: number;
  qualifying?: number;
  racePace?: number;
  adaptability?: number;
  aggression?: number;
  composure?: number;
  overall?: number;
  potential?: number;
  marketValue?: number;
  developmentRate?: number;
  f1Readiness?: number;
  sponsorBacking?: number;
  morale?: number;
  trust?: number;
  contract?: {
    salary?: number;
    yearsLeft?: number;
  };
  traits?: string[];
};

type Phase0TeamSource = {
  teamLineageId: string;
  canonicalName?: string;
  namePerPeriod?: Array<{ fromYear: number; toYear: number; name?: string }>;
  budget?: number;
  reputation?: number;
  raceOperations?: number;
  financeHealth?: number;
};

type Phase0CarSource = {
  carId?: string;
  teamId: string;
  seasonYear: number;
  series: Series;
  enginePower: number;
  downforce: number;
  mechanicalGrip: number;
  reliability: number;
  setupWindow: number;
};

const allGlobalCars: Phase0CarSource[] = [...(globalCarsPhase0 as unknown as Phase0CarSource[])];

const allGlobalDrivers: Phase0DriverSource[] = [...(globalDriversPhase0 as unknown as Phase0DriverSource[])];

const allGlobalTeams: Phase0TeamSource[] = [...(globalTeamsPhase0 as unknown as Phase0TeamSource[])];

const allGlobalTracks: Phase0TrackSource[] = [...(globalTracksPhase0 as unknown as Phase0TrackSource[])];

const registeredGlobalModules = new WeakSet<object>();

export function registerPhase0GlobalModule(module: Record<string, unknown>): void {
  if (registeredGlobalModules.has(module)) return;
  registeredGlobalModules.add(module);
  for (const [key, value] of Object.entries(module)) {
    if (!Array.isArray(value)) continue;
    if (key.endsWith('Cars')) allGlobalCars.push(...(value as Phase0CarSource[]));
    else if (key.endsWith('Drivers')) allGlobalDrivers.push(...(value as Phase0DriverSource[]));
    else if (key.endsWith('Teams')) allGlobalTeams.push(...(value as Phase0TeamSource[]));
    else if (key.endsWith('Tracks')) allGlobalTracks.push(...(value as Phase0TrackSource[]));
  }
}

type LegacyTeamSource = {
  id: string;
  name: string;
  shortName: string;
  carId: string;
  driverIds: string[];
  budget: number;
  reputation: number;
  raceOperations: number;
  morale: number;
  expectedStanding?: number;
  difficulty?: Team['difficulty'];
  color: string;
  country?: string;
};

type LegacyDriverSource = {
  id: string;
  name: string;
  number: number;
  teamId: string;
};

const historicalWeatherRaceMetaMap = historicalWeatherRaceMeta as Record<string, { date?: string; latitude?: number; longitude?: number }>;
const historicalWeatherTrackCoordinatesMap = historicalWeatherTrackCoordinates as Record<string, { latitude: number; longitude: number }>;

type LegacyCarSource = {
  id: string;
  teamId: string;
  seasonYear: number;
};

type LegacySeasonContext = {
  legacyTeams: LegacyTeamSource[];
  legacyDrivers: LegacyDriverSource[];
  legacyCars: LegacyCarSource[];
  legacyTeamToSourceTeamId: Map<string, string>;
};

type ResolvedLegacyDriver = {
  legacy: LegacyDriverSource;
  source?: Phase0DriverSource;
  canonicalId: string;
};

const legacyTeamModules: Record<string, Record<string, unknown>> = {};
const legacyDriverModules: Record<string, Record<string, unknown>> = {};
const legacyCarModules: Record<string, Record<string, unknown>> = {};

export function registerLegacyModule(
  kind: 'teams' | 'drivers' | 'cars',
  path: string,
  module: Record<string, unknown>,
): void {
  const target = kind === 'teams' ? legacyTeamModules : kind === 'drivers' ? legacyDriverModules : legacyCarModules;
  target[path] = module;
}

export function registerLegacySeasonModule(
  kind: 'teams' | 'drivers' | 'cars',
  year: number,
  series: Series,
  module: Record<string, unknown>,
): void {
  registerLegacyModule(kind, legacyModuleKey(kind, year, series), module);
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeDriverIdentity(value: string): string {
  return normalizeKey(value).replace(/\s+/g, '-');
}

function seriesToken(series: Series): string {
  return series === 'Champ Car' ? 'ChampCar' : series;
}

export function seasonExportKey(year: number, series: Series): string {
  return `season${year}${seriesToken(series)}Phase0`;
}

export function seasonImportPath(year: number, series: Series): string {
  return `./phase0/generated/season${year}${seriesToken(series)}.ts`;
}

function seasonLabel(year: number, series: Series): string {
  return availableSeasons.find((entry) => entry.year === year && entry.series === series)?.label ?? `${year} ${series}`;
}

function getSeasonRuleIds(year: number, series: Series): { pointsSystemId: string; regulationSetId: string } {
  if (series === 'F1') {
    if (year <= 1993) return { pointsSystemId: 'pts-1990', regulationSetId: 'reg-f1-1990-1993' };
    if (year <= 2002) return { pointsSystemId: 'pts-1995', regulationSetId: 'reg-f1-1996-2002' };
    if (year <= 2004) return { pointsSystemId: 'pts-2003', regulationSetId: 'reg-f1-2003-2004' };
    if (year === 2005) return { pointsSystemId: 'pts-2003', regulationSetId: 'reg-f1-2005' };
    if (year <= 2009) return { pointsSystemId: 'pts-2003', regulationSetId: 'reg-f1-2006-2009' };
    if (year === 2010) return { pointsSystemId: 'pts-modern', regulationSetId: 'reg-f1-2010' };
    if (year <= 2013) return { pointsSystemId: 'pts-modern', regulationSetId: 'reg-f1-2011-2013' };
    if (year <= 2020) return { pointsSystemId: 'pts-modern', regulationSetId: 'reg-f1-2014-2020' };
    if (year === 2021) return { pointsSystemId: 'pts-modern', regulationSetId: 'reg-f1-2021' };
    if (year <= 2025) return { pointsSystemId: 'pts-modern', regulationSetId: 'reg-f1-2022-2025' };
    return { pointsSystemId: 'pts-modern', regulationSetId: 'reg-f1-2026' };
  }

  if (series === 'CART') {
    return year <= 2001
      ? { pointsSystemId: 'pts-cart-1990-2001', regulationSetId: 'reg-cart-1990-2001' }
      : { pointsSystemId: 'pts-cart-2002-2003', regulationSetId: 'reg-cart-2002-2003' };
  }

  if (series === 'Champ Car') {
    return year <= 2006
      ? { pointsSystemId: 'pts-champcar-2004-2006', regulationSetId: 'reg-champcar-2004-2006' }
      : { pointsSystemId: 'pts-champcar-2007', regulationSetId: 'reg-champcar-2007' };
  }

  if (series === 'NASCAR') {
    const rulesYear = year <= 1999 ? 1990 : year <= 2009 ? 2000 : year <= 2016 ? 2010 : 2026;
    return { pointsSystemId: `pts-nascar-${rulesYear}`, regulationSetId: `reg-nascar-${rulesYear}` };
  }

  if (year === 1996) return { pointsSystemId: 'pts-indycar-1996', regulationSetId: 'reg-indycar-1996' };
  if (year === 1997) return { pointsSystemId: 'pts-indycar-1997', regulationSetId: 'reg-indycar-1997-1999' };
  if (year <= 2000) return { pointsSystemId: 'pts-indycar-1998-2000', regulationSetId: 'reg-indycar-1997-1999' };
  if (year <= 2002) return { pointsSystemId: 'pts-indycar-2001-2003', regulationSetId: 'reg-indycar-2000-2002' };
  if (year === 2003) return { pointsSystemId: 'pts-indycar-2001-2003', regulationSetId: 'reg-indycar-2003' };
  if (year <= 2007) return { pointsSystemId: 'pts-indycar-2004-2007', regulationSetId: 'reg-indycar-2004-2006' };
  if (year <= 2011) return { pointsSystemId: `pts-indycar-${year}`, regulationSetId: 'reg-indycar-2008-2011' };
  if (year <= 2017) return { pointsSystemId: `pts-indycar-${year}`, regulationSetId: 'reg-indycar-2012-2017' };
  if (year <= 2023) return { pointsSystemId: `pts-indycar-${year}`, regulationSetId: 'reg-indycar-2018-2023' };
  return { pointsSystemId: `pts-indycar-${year}`, regulationSetId: 'reg-indycar-2024-2026' };
}

function mapAttributes(source: Phase0TrackSource): Track['attributes'] {
  return {
    corners: source.attributes.corners,
    braking: source.attributes.braking,
    straights: source.attributes.straights,
    tractionAcceleration: source.attributes.tractionAcceleration,
    elevationBlindCorners: source.attributes.elevationBlindCorners,
    technical: source.attributes.technical,
    overtakingRacecraft: source.attributes.overtakingRacecraft,
    surfaceGripBumpiness: source.attributes.surfaceGripBumpiness,
    riskWallProximity: source.attributes.riskWallProximity,
    enduranceConsistency: source.attributes.enduranceConsistency,
  };
}

function mapSetupProfile(source: Phase0TrackSource): Track['setupProfile'] {
  return {
    primarySetupProfile: source.subcategory,
    downforceLevel: source.category,
    topSpeedEmphasis: source.demandProfile.powerDemand,
    mechanicalGripEmphasis: source.demandProfile.mechanicalDemand,
    brakeDemand: source.demandProfile.brakeDemand,
    reliabilityRiskFocus: source.demandProfile.riskDemand,
    strategyNotes: source.configNote || source.locationDisplay || source.name || 'Imported track',
    aeroDemand: source.demandProfile.downforceDemand,
    powerDemand: source.demandProfile.powerDemand,
    mechanicalDemand: source.demandProfile.mechanicalDemand,
    riskDemand: source.demandProfile.riskDemand,
  };
}

function scoreTrackMatch(
  source: Phase0TrackSource,
  seasonYear: number,
  series: Series,
  requestedLabel: string,
  lapLengthKm?: number,
): number {
  let score = 0;
  const label = normalizeKey(requestedLabel);
  const name = normalizeKey(source?.name ?? '');
  const facility = normalizeKey(source?.facility ?? '');
  const location = normalizeKey(source?.locationDisplay ?? '');

  if (source.seasonsUsed?.some((entry) => entry.year === seasonYear && entry.series === series)) score += 50;
  if (label === name) score += 40;
  if (label === facility) score += 35;
  if (label === location) score += 25;
  if (name.includes(label) || label.includes(name)) score += 20;
  if (facility.includes(label) || label.includes(facility)) score += 15;
  if (typeof lapLengthKm === 'number' && typeof source.lengthKm === 'number') {
    const diff = Math.abs(source.lengthKm - lapLengthKm);
    if (diff <= 0.05) score += 60;
    else if (diff <= 0.15) score += 35;
    else if (diff <= 0.3) score += 15;
  }
  for (const alias of source.aliases ?? []) {
    const normalizedAlias = normalizeKey(alias);
    if (normalizedAlias === label) score += 30;
    if (normalizedAlias.includes(label) || label.includes(normalizedAlias)) score += 10;
  }
  return score;
}

function resolveTrackSource(
  seasonYear: number,
  series: Series,
  trackId: string,
  trackName: string,
  lapLengthKm?: number,
): Phase0TrackSource | undefined {
  const requested = normalizeKey(trackName || trackId);
  let best: { score: number; track: Phase0TrackSource } | undefined;
  for (const track of allGlobalTracks) {
    const score = scoreTrackMatch(track, seasonYear, series, requested, lapLengthKm);
    if (!best || score > best.score) best = { score, track };
  }
  return best?.track;
}

function trackDisplayName(source: Phase0TrackSource, trackName: string): string {
  return trackName || source.facility || source.name || 'Imported Track';
}

function buildTrack(trackId: string, trackName: string, source: Phase0TrackSource): Track {
  const coords = historicalWeatherTrackCoordinatesMap[trackId];
  const displayName = trackDisplayName(source, trackName);
  return {
    id: trackId,
    name: displayName,
    gpName: displayName,
    country: source.country,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    archetype: source.category,
    attributes: mapAttributes(source),
    setupProfile: mapSetupProfile(source),
    ratingNotes: `${source.subcategory} · ${source.locationDisplay}`,
  };
}

function deriveTeamDifficulty(rank: number, teamCount: number): Team['difficulty'] {
  const pct = rank / Math.max(1, teamCount);
  if (pct <= 0.25) return 'Easy';
  if (pct <= 0.5) return 'Medium';
  if (pct <= 0.75) return 'Hard';
  return 'Very Hard';
}

function hashColor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const palette = ['#2dd4bf', '#60a5fa', '#f472b6', '#f59e0b', '#a78bfa', '#34d399', '#fb7185', '#38bdf8'];
  return palette[h % palette.length];
}

function teamShortName(name: string): string {
  const parts = name.split(/\s+/);
  return parts.length <= 2 ? name : `${parts[0]} ${parts[parts.length - 1]}`;
}

function seasonCarId(seasonYear: number, teamId: string, sourceCar?: Phase0CarSource): string {
  return sourceCar?.carId ? `${sourceCar.carId}-${teamId}` : `car-${seasonYear}-${teamId.toLowerCase()}`;
}

function legacySeriesSuffix(series: Series): string {
  if (series === 'F1') return '';
  if (series === 'IndyCar') return 'IndyCar';
  if (series === 'NASCAR') return 'NASCAR';
  return 'CART';
}

function legacyModuleKey(kind: 'teams' | 'drivers' | 'cars', year: number, series: Series): string {
  return `../${kind}/${kind}${year}${legacySeriesSuffix(series)}.ts`;
}

function legacyExportName(kind: 'teams' | 'drivers' | 'cars', year: number, series: Series): string {
  return `${kind}${year}${legacySeriesSuffix(series)}`;
}

function legacyEntries<T>(
  modules: Record<string, Record<string, unknown>>,
  kind: 'teams' | 'drivers' | 'cars',
  year: number,
  series: Series,
): T[] {
  const module = modules[legacyModuleKey(kind, year, series)];
  if (!module) return [];
  return (module[legacyExportName(kind, year, series)] as T[] | undefined) ?? [];
}

function driverRatingsFromSource(source: Phase0DriverSource | undefined): Driver['ratings'] {
  return {
    cornering: source?.cornering ?? 50,
    braking: source?.braking ?? 50,
    straights: source?.straights ?? 50,
    tractionAcceleration: source?.tractionAcceleration ?? 50,
    elevationBlindCorners: source?.elevationBlindCorners ?? 50,
    technical: source?.technical ?? 50,
    overtakingRacecraft: source?.overtakingRacecraft ?? 50,
    surfaceGripBumpiness: source?.surfaceGripBumpiness ?? 50,
    riskManagement: source?.riskManagement ?? 50,
    enduranceConsistency: source?.enduranceConsistency ?? 50,
    qualifying: source?.qualifying ?? source?.overall ?? 50,
    racePace: source?.racePace ?? source?.overall ?? 50,
    adaptability: source?.adaptability ?? source?.overall ?? 50,
    aggression: source?.aggression ?? source?.overall ?? 50,
    composure: source?.composure ?? source?.overall ?? 50,
    overall: source?.overall ?? 50,
  };
}

function marketSkillsFromSource(source: Phase0DriverSource | undefined): MarketDriver['skills'] {
  return {
    cornering: source?.cornering ?? 50,
    braking: source?.braking ?? 50,
    straights: source?.straights ?? 50,
    tractionAcceleration: source?.tractionAcceleration ?? 50,
    elevationBlindCorners: source?.elevationBlindCorners ?? 50,
    technical: source?.technical ?? 50,
    overtakingRacecraft: source?.overtakingRacecraft ?? 50,
    surfaceGripBumpiness: source?.surfaceGripBumpiness ?? 50,
    riskManagement: source?.riskManagement ?? 50,
    enduranceConsistency: source?.enduranceConsistency ?? 50,
  };
}

function resolveDriverSource(
  legacyDriver: LegacyDriverSource,
  sourceById: Map<string, Phase0DriverSource>,
  sourceByName: Map<string, Phase0DriverSource[]>,
  teamEntry?: { driverId: string },
): Phase0DriverSource | undefined {
  if (teamEntry) {
    const byId = sourceById.get(teamEntry.driverId);
    if (byId) return byId;
  }
  const byLegacyName = sourceByName.get(normalizeKey(legacyDriver.name));
  if (byLegacyName?.length === 1) return byLegacyName[0];
  return byLegacyName?.[0];
}

function sourceToMarketDriver(source: Phase0DriverSource | undefined, year: number, series: Series, teamName: string): MarketDriver {
  const age = source?.birthYear != null ? year - source.birthYear : source?.startingAge != null ? source.startingAge + Math.max(0, year - (source.firstSeenYear ?? year)) : 25;
  const overall = source?.overall ?? 50;
  const potential = source?.potential ?? overall;
  const marketValue = source?.marketValue ?? Math.max(55, overall);
  return {
    id: source?.driverId ?? `driver-${normalizeDriverIdentity(teamName)}-${year}`,
    name: source?.name ?? teamName,
    age,
    nationality: source?.nationality ?? 'International',
    context: `${series} ${year} roster release`,
    marketPool: `${series} roster release`,
    marketStatus: 'Available',
    primaryRole: 'Race Driver',
    immediateF1Eligible: true,
    skills: marketSkillsFromSource(source),
    overall,
    potential,
    potentialDelta: Math.max(0, potential - overall),
    developmentRate: source?.developmentRate ?? Math.max(6, Math.min(18, Math.round((potential - overall) / 4) + 8)),
    f1Readiness: source?.f1Readiness ?? Math.max(50, overall),
    salary: Math.max(0.3, Math.round((marketValue / 100) * 10) / 10),
    sponsorValue: Math.max(0, Math.round(((source?.sponsorBacking ?? 0) / 100) * 10) / 10),
    buyoutCost: Math.max(0.3, Math.round((marketValue / 100) * 10) / 10),
    negotiationDifficulty: 'Medium',
    suggestedUse: 'Race Driver',
    notes: 'Released from season roster normalization.',
  };
}

function sourceToDriver(
  source: Phase0DriverSource | undefined,
  legacyDriver: LegacyDriverSource,
  teamId: string,
  seasonYear: number,
): Driver {
  return {
    id: source?.driverId ?? `driver-${normalizeDriverIdentity(legacyDriver.name)}`,
    name: source?.name ?? legacyDriver.name,
    number: legacyDriver.number,
    nationality: source?.nationality,
    age: source?.birthYear ? seasonYear - source.birthYear : undefined,
    teamId,
    ratings: driverRatingsFromSource(source),
    morale: source?.morale ?? 65,
    confidence: source?.trust ?? source?.morale ?? 65,
    contractYearsRemaining: source?.contract?.yearsLeft,
    salary: source?.contract?.salary != null ? source.contract.salary / 10 : undefined,
    traits: source?.traits ?? [],
  };
}

function matchTeamSource(sourceTeams: Phase0TeamSource[], team: LegacyTeamSource, year: number): Phase0TeamSource | undefined {
  const requested = normalizeKey(team.name);
  const requestedShort = normalizeKey(team.shortName);
  let best: { score: number; team: Phase0TeamSource } | undefined;
  for (const source of sourceTeams) {
    let score = 0;
    if (normalizeKey(source.canonicalName ?? '') === requested) score += 35;
    if (normalizeKey(source.canonicalName ?? '') === requestedShort) score += 10;
    for (const period of source.namePerPeriod ?? []) {
      if (year >= period.fromYear && year <= period.toYear) {
        const periodName = normalizeKey(period.name ?? '');
        if (periodName === requested) score += 120;
        if (periodName === requestedShort) score += 80;
        if (periodName.includes(requested) || requested.includes(periodName)) score += 20;
      }
    }
    if (normalizeKey(source.canonicalName ?? '').includes(requested) || requested.includes(normalizeKey(source.canonicalName ?? ''))) {
      score += 15;
    }
    if (!best || score > best.score) best = { score, team: source };
  }
  return best?.score ? best.team : undefined;
}

function buildLegacyContext(phase0Season: Phase0SeasonBundle): LegacySeasonContext {
  const legacyTeams = legacyEntries<LegacyTeamSource>(legacyTeamModules, 'teams', phase0Season.season, phase0Season.series);
  const legacyDrivers = legacyEntries<LegacyDriverSource>(legacyDriverModules, 'drivers', phase0Season.season, phase0Season.series);
  const legacyCars = legacyEntries<LegacyCarSource>(legacyCarModules, 'cars', phase0Season.season, phase0Season.series);
  const sourceTeams = allGlobalTeams;
  const legacyTeamToSourceTeamId = new Map<string, string>();
  for (const team of legacyTeams) {
    const source = matchTeamSource(sourceTeams, team, phase0Season.season);
    if (source) legacyTeamToSourceTeamId.set(team.id, source.teamLineageId);
  }
  return { legacyTeams, legacyDrivers, legacyCars, legacyTeamToSourceTeamId };
}

function buildRosterPlan(phase0Season: Phase0SeasonBundle, ctx: LegacySeasonContext): {
  teams: Team[];
  drivers: Driver[];
  releasedDrivers: MarketDriver[];
} {
  const sourceTeams = allGlobalTeams;
  const sourceDrivers = allGlobalDrivers;
  const sourceById = new Map<string, Phase0TeamSource>(sourceTeams.map((team) => [team.teamLineageId, team] as [string, Phase0TeamSource]));
  const sourceByDriverId = new Map<string, Phase0DriverSource>(sourceDrivers.map((driver) => [driver.driverId, driver] as [string, Phase0DriverSource]));
  const sourceByName = new Map<string, Phase0DriverSource[]>();
  for (const source of sourceDrivers) {
    const key = normalizeKey(source.name ?? '');
    const list = sourceByName.get(key);
    if (list) list.push(source);
    else sourceByName.set(key, [source]);
  }
  const sourceEntriesByLegacyKey = new Map<string, (typeof phase0Season.teamEntries)[number]>();
  for (const entry of phase0Season.teamEntries) {
    const legacyTeamId = [...ctx.legacyTeamToSourceTeamId.entries()].find(([, sourceId]) => sourceId === entry.teamId)?.[0];
    if (!legacyTeamId) continue;
    sourceEntriesByLegacyKey.set(`${legacyTeamId}::${entry.carNumber}`, entry);
  }
  const claimedCanonicalIds = new Set<string>();
  const claimedCanonicalNames = new Set<string>();
  const releasedById = new Map<string, MarketDriver>();
  const teams: Team[] = [];
  const drivers: Driver[] = [];

  for (const [idx, legacyTeam] of ctx.legacyTeams.entries()) {
    const sourceId = ctx.legacyTeamToSourceTeamId.get(legacyTeam.id);
    const source = sourceId ? sourceById.get(sourceId) : undefined;
    const name = legacyTeam.name || source?.namePerPeriod?.find((period) => phase0Season.season >= period.fromYear && phase0Season.season <= period.toYear)?.name || source?.canonicalName || legacyTeam.id;
    const car = allGlobalCars.find(
      (entry) => entry.teamId === sourceId && entry.seasonYear === phase0Season.season && entry.series === phase0Season.series,
    );

    const resolved: ResolvedLegacyDriver[] = [];
    for (const legacyDriver of ctx.legacyDrivers.filter((d) => d.teamId === legacyTeam.id)) {
      const rosterEntry = sourceEntriesByLegacyKey.get(`${legacyDriver.teamId}::${legacyDriver.number}`);
      const sourceDriver = resolveDriverSource(legacyDriver, sourceByDriverId, sourceByName, rosterEntry);
      resolved.push({
        legacy: legacyDriver,
        source: sourceDriver,
        canonicalId: sourceDriver?.driverId ?? `driver-${normalizeDriverIdentity(legacyDriver.name)}`,
      });
    }

    const teamSeen = new Set<string>();
    const teamSeenNames = new Set<string>();
    const activeDrivers: ResolvedLegacyDriver[] = [];
    for (const driver of resolved) {
      const canonicalName = normalizeKey(driver.source?.name ?? driver.legacy.name);
      if (teamSeen.has(driver.canonicalId) || teamSeenNames.has(canonicalName)) continue;
      teamSeen.add(driver.canonicalId);
      teamSeenNames.add(canonicalName);
      if (claimedCanonicalIds.has(driver.canonicalId) || claimedCanonicalNames.has(canonicalName)) continue;
      if (activeDrivers.length < 2) {
        activeDrivers.push(driver);
        claimedCanonicalIds.add(driver.canonicalId);
        claimedCanonicalNames.add(canonicalName);
      } else {
        const marketDriver = sourceToMarketDriver(driver.source, phase0Season.season, phase0Season.series, name);
        releasedById.set(marketDriver.id, marketDriver);
      }
    }

    const driverIds = activeDrivers.map((driver) => driver.canonicalId);
    teams.push({
      id: legacyTeam.id,
      name,
      shortName: legacyTeam.shortName || teamShortName(name),
      carId: legacyTeam.carId || seasonCarId(phase0Season.season, legacyTeam.id, car),
      driverIds,
      budget: source?.budget ?? legacyTeam.budget ?? 0,
      reputation: source?.reputation ?? legacyTeam.reputation ?? 50,
      raceOperations: source?.raceOperations ?? legacyTeam.raceOperations ?? 50,
      morale: source?.financeHealth ?? legacyTeam.morale ?? 65,
      expectedStanding: legacyTeam.expectedStanding ?? idx + 1,
      difficulty: legacyTeam.difficulty ?? deriveTeamDifficulty(idx + 1, ctx.legacyTeams.length),
      color: legacyTeam.color || hashColor(legacyTeam.id),
    });

    for (const driver of activeDrivers) {
      drivers.push(sourceToDriver(driver.source, driver.legacy, legacyTeam.id, phase0Season.season));
    }
  }

  return { teams, drivers, releasedDrivers: [...releasedById.values()] };
}

function buildCars(phase0Season: Phase0SeasonBundle, ctx: LegacySeasonContext, teamIds: string[]): Car[] {
  const sourceCars = allGlobalCars.filter(
    (car) => car.seasonYear === phase0Season.season && car.series === phase0Season.series,
  );
  const sourceByTeamId = new Map<string, Phase0CarSource>();
  for (const car of sourceCars) {
    if (!sourceByTeamId.has(car.teamId)) sourceByTeamId.set(car.teamId, car);
  }

  return teamIds.map((teamId) => {
    const sourceTeamId = ctx.legacyTeamToSourceTeamId.get(teamId) ?? teamId;
    const legacyCar = ctx.legacyCars.find((car) => car.teamId === teamId);
    const source = sourceByTeamId.get(sourceTeamId) ?? sourceCars.find((entry) => entry.teamId === sourceTeamId) ?? sourceCars[0];
    if (!source) {
      return {
        id: legacyCar?.id ?? `car-${phase0Season.season}-${teamId.toLowerCase()}`,
        teamId,
        seasonYear: phase0Season.season,
        ratings: {
          enginePower: 50,
          aeroEfficiency: 50,
          mechanicalGrip: 50,
          reliability: 50,
          pitCrewOperations: 50,
        },
        condition: 100,
        developmentLevel: { enginePower: 0, aeroEfficiency: 0, mechanicalGrip: 0, reliability: 0, pitCrewOperations: 0 },
      };
    }
    return {
      id: legacyCar?.id ?? source.carId ?? `car-${phase0Season.season}-${teamId.toLowerCase()}`,
      teamId,
      seasonYear: source.seasonYear,
      ratings: {
        enginePower: source.enginePower,
        aeroEfficiency: source.downforce,
        mechanicalGrip: source.mechanicalGrip,
        reliability: source.reliability,
        pitCrewOperations: source.setupWindow,
      },
      condition: 100,
      developmentLevel: { enginePower: 0, aeroEfficiency: 0, mechanicalGrip: 0, reliability: 0, pitCrewOperations: 0 },
    };
  });
}

function buildTracks(phase0Season: Phase0SeasonBundle): Track[] {
  const tracks = new Map<string, Track>();
  for (const race of phase0Season.calendar) {
    const lapLengthKm = race.distanceKm ? race.distanceKm / race.laps : undefined;
    const source = resolveTrackSource(phase0Season.season, phase0Season.series, race.trackId, race.trackName, lapLengthKm);
    if (!source) continue;
    tracks.set(race.trackId, buildTrack(race.trackId, race.trackName, source));
  }
  return [...tracks.values()];
}

function isoDateOrUndefined(value?: string): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export function buildPhase0SeasonBundle(
  phase0Season: Phase0SeasonBundle,
  principalSources: readonly TeamPrincipal[] = [],
): {
  bundle: SeasonBundle;
  tracks: Track[];
} {
  const seasonRules = getSeasonRuleIds(phase0Season.season, phase0Season.series);
  const ctx = buildLegacyContext(phase0Season);
  const rosterPlan = buildRosterPlan(phase0Season, ctx);
  const sourceToLegacyTeamId = new Map(
    [...ctx.legacyTeamToSourceTeamId.entries()].map(([legacyId, sourceId]) => [sourceId, legacyId]),
  );
  seedReleasedMarketDrivers(phase0Season.season, phase0Season.series, rosterPlan.releasedDrivers);
  const bundle: SeasonBundle = {
    season: {
      id: phase0Season.seasonId,
      year: phase0Season.season,
      name: seasonLabel(phase0Season.season, phase0Season.series),
      series: phase0Season.series,
      calendar: phase0Season.calendar.map((race) => ({
        id: `${phase0Season.season}-${phase0Season.series}-${race.round}`,
        round: race.round,
        gpName: race.raceName,
        trackId: race.trackId,
        trackName: race.trackName,
        date: isoDateOrUndefined(historicalWeatherRaceMetaMap[`${phase0Season.season}-${phase0Season.series}-${race.round}`]?.date),
        laps: race.laps,
        distanceKm: race.distanceKm,
        pointsMultiplier: race.pointsMultiplier ?? 1,
        completed: false,
      })),
      pointsSystemId: seasonRules.pointsSystemId,
      regulationSetId: seasonRules.regulationSetId,
    },
    teams: rosterPlan.teams,
    drivers: rosterPlan.drivers,
    cars: buildCars(phase0Season, ctx, rosterPlan.teams.map((team) => team.id)),
    principals: principalSources
      .filter((principal) => principal.careerTimeline.some((entry) =>
        entry.year === phase0Season.season
        && entry.series === phase0Season.series
        && sourceToLegacyTeamId.has(entry.teamId),
      ))
      .map((principal) => ({
        ...principal,
        careerTimeline: principal.careerTimeline.map((entry) => ({
          ...entry,
          teamId: sourceToLegacyTeamId.get(entry.teamId) ?? entry.teamId,
        })),
        contract: principal.contract ? {
          ...principal.contract,
          teamId: sourceToLegacyTeamId.get(principal.contract.teamId) ?? principal.contract.teamId,
        } : undefined,
      })),
  };

  return { bundle, tracks: buildTracks(phase0Season) };
}
