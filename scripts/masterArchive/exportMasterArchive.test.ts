import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  availableSeasons,
  getPointsSystem,
  getRegulationSet,
  initializeMasterRegistry,
  loadSeasonBundle,
  preloadMarketBundle,
} from '../../src/data';
import { getMarketBundle } from '../../src/data/market';
import { canonicalNameOf, getMasterRegistry, registryList } from '../../src/data/registry/masterRegistry';
import type { Series } from '../../src/types/gameTypes';
import type { MarketSkillRatings, SeriesPreference } from '../../src/types/marketTypes';
import baseline from './baseline.json';

type RecordType = 'Active roster' | 'Adult market' | 'Youth market';

type DriverHistoryRow = {
  driverId?: string;
  year: number;
  series: Series | '';
  recordType: RecordType;
  sourceId: string;
  name: string;
  nationality: string;
  age: number | null;
  birthYear: number | null;
  team: string;
  carNumber: number | null;
  context: string;
  seriesPreferences: SeriesPreference[];
  overall: number;
  potential: number;
  salary: number | null;
  marketValue: number | null;
  skills: MarketSkillRatings;
  notes: string;
};

type SeasonArchiveRow = {
  year: number;
  series: Series;
  label: string;
  seasonId: string;
  seasonName: string;
  generated: boolean;
  rounds: number;
  teams: number;
  drivers: number;
  cars: number;
  firstRaceDate: string;
  lastRaceDate: string;
  pointsSystemId: string;
  pointsSystemName: string;
  regulationSetId: string;
  eraLabel: string;
  qualifyingFormat: string;
  raceWeekendFormat: string;
  refuelingAllowed: boolean;
  drsEnabled: boolean;
  sprintSupport: boolean;
  pushToPass: boolean;
  budgetCap: number | null;
};

type DriverAccumulator = {
  driverId: string;
  displayName: string;
  canonicalName: string;
  nationality: string;
  birthYear: number | null;
  firstSeenYear: number | null;
  lastSeenYear: number | null;
  firstActiveYear: number | null;
  lastActiveYear: number | null;
  firstAdultMarketYear: number | null;
  lastAdultMarketYear: number | null;
  firstYouthMarketYear: number | null;
  lastYouthMarketYear: number | null;
  roles: Set<RecordType>;
  preferences: Map<Series, number>;
  seriesYears: Map<Series, Set<number>>;
  latestOverall: number | null;
  maximumPotential: number | null;
  switchWillingness: number | null;
  latestSalary: number | null;
  latestMarketValue: number | null;
  latestSkills: MarketSkillRatings | null;
  ratingYear: number;
  ratingPriority: number;
  sourceIds: Set<string>;
};

type MasterDriverRow = {
  driverId: string;
  displayName: string;
  canonicalName: string;
  nationality: string;
  birthYear: number | null;
  firstSeenYear: number | null;
  lastSeenYear: number | null;
  firstActiveYear: number | null;
  lastActiveYear: number | null;
  firstAdultMarketYear: number | null;
  lastAdultMarketYear: number | null;
  firstYouthMarketYear: number | null;
  lastYouthMarketYear: number | null;
  roles: string;
  preferredSeries: Series | '';
  seriesInterests: string;
  f1Seasons: number;
  cartSeasons: number;
  champCarSeasons: number;
  indyCarSeasons: number;
  nascarSeasons: number;
  latestOverall: number | null;
  maximumPotential: number | null;
  switchWillingness: number | null;
  latestSalary: number | null;
  latestMarketValue: number | null;
  cornering: number | null;
  braking: number | null;
  straights: number | null;
  tractionAcceleration: number | null;
  elevationBlindCorners: number | null;
  technical: number | null;
  overtakingRacecraft: number | null;
  surfaceGripBumpiness: number | null;
  riskManagement: number | null;
  enduranceConsistency: number | null;
  uniqueSourceIds: number;
};

type IntegrityReport = {
  duplicateDriverIds: string[];
  invalidIdentityCollisions: Array<[string, string, number | null, number | null]>;
  generatedHistoryRecords: Array<[number, RecordType, string]>;
  duplicateSeasonKeys: string[];
  orphanHistoryRecords: string[];
};

const generatedMarker = /generated|synthetic|filler|placeholder|gen-(?:drv|yth)|reserve [a-e]$|prospect [a-e]$/i;
const outputDir = path.resolve(process.env.MASTER_ARCHIVE_OUTPUT_DIR ?? 'artifacts/master-archive/current');

function emptyDriver(driverId: string, displayName: string, canonicalName: string, birthYear: number | null): DriverAccumulator {
  return {
    driverId,
    displayName,
    canonicalName,
    nationality: '',
    birthYear,
    firstSeenYear: null,
    lastSeenYear: null,
    firstActiveYear: null,
    lastActiveYear: null,
    firstAdultMarketYear: null,
    lastAdultMarketYear: null,
    firstYouthMarketYear: null,
    lastYouthMarketYear: null,
    roles: new Set(),
    preferences: new Map(),
    seriesYears: new Map(),
    latestOverall: null,
    maximumPotential: null,
    switchWillingness: null,
    latestSalary: null,
    latestMarketValue: null,
    latestSkills: null,
    ratingYear: -Infinity,
    ratingPriority: 0,
    sourceIds: new Set(),
  };
}

function slugify(name: string): string {
  return canonicalNameOf(name).replace(/ /g, '-');
}

function minYear(current: number | null, year: number): number {
  return current == null ? year : Math.min(current, year);
}

function maxYear(current: number | null, year: number): number {
  return current == null ? year : Math.max(current, year);
}

function preferredSeries(driver: DriverAccumulator): Series | '' {
  return [...driver.preferences.entries()]
    .sort((left, right) =>
      right[1] - left[1]
      || (driver.seriesYears.get(right[0])?.size ?? 0) - (driver.seriesYears.get(left[0])?.size ?? 0)
      || left[0].localeCompare(right[0]))[0]?.[0] ?? '';
}

function csvCell(value: unknown): string {
  if (value == null) return '';
  const text = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvFromObjects<T extends object>(rows: T[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((header) => csvCell((row as Record<string, unknown>)[header])).join(','));
  return `${headers.join(',')}\n${body.join('\n')}\n`;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function collectArchive(): Promise<{
  masterDrivers: MasterDriverRow[];
  driverHistory: Array<DriverHistoryRow & { driverId: string }>;
  seasons: SeasonArchiveRow[];
  integrity: IntegrityReport;
}> {
  await initializeMasterRegistry(1990, 'F1');
  const seasons: SeasonArchiveRow[] = [];
  const rawHistory: DriverHistoryRow[] = [];

  for (const catalogEntry of availableSeasons) {
    const bundle = await loadSeasonBundle(catalogEntry.year, catalogEntry.series);
    if (!bundle) throw new Error(`Missing season bundle: ${catalogEntry.year} ${catalogEntry.series}`);
    const points = getPointsSystem(bundle.season.pointsSystemId);
    const regulations = getRegulationSet(bundle.season.regulationSetId);
    const teamById = new Map(bundle.teams.map((team) => [team.id, team]));
    const dates = bundle.season.calendar.map((race) => race.date).filter((date): date is string => Boolean(date)).sort();

    seasons.push({
      year: catalogEntry.year,
      series: catalogEntry.series,
      label: catalogEntry.label,
      seasonId: bundle.season.id,
      seasonName: bundle.season.name,
      generated: Boolean(bundle.season.generated),
      rounds: bundle.season.calendar.length,
      teams: bundle.teams.length,
      drivers: bundle.drivers.length,
      cars: bundle.cars.length,
      firstRaceDate: dates[0] ?? '',
      lastRaceDate: dates.at(-1) ?? '',
      pointsSystemId: bundle.season.pointsSystemId,
      pointsSystemName: points.name,
      regulationSetId: bundle.season.regulationSetId,
      eraLabel: regulations?.eraLabel ?? '',
      qualifyingFormat: regulations?.qualifyingFormat ?? '',
      raceWeekendFormat: regulations?.raceWeekendFormat ?? '',
      refuelingAllowed: regulations?.refuelingAllowed ?? false,
      drsEnabled: regulations?.drsEnabled ?? false,
      sprintSupport: regulations?.sprintSupport ?? false,
      pushToPass: regulations?.pushToPass ?? false,
      budgetCap: regulations?.budgetCap ?? null,
    });

    for (const driver of bundle.drivers) {
      rawHistory.push({
        year: catalogEntry.year,
        series: catalogEntry.series,
        recordType: 'Active roster',
        sourceId: driver.id,
        name: driver.name,
        nationality: driver.nationality ?? '',
        age: driver.age ?? null,
        birthYear: driver.age == null ? null : catalogEntry.year - driver.age,
        team: teamById.get(driver.teamId)?.name ?? '',
        carNumber: driver.number,
        context: '',
        seriesPreferences: [{ series: catalogEntry.series, weight: 100 }],
        overall: driver.ratings.overall,
        potential: driver.ratings.overall,
        salary: driver.salary ?? null,
        marketValue: null,
        skills: {
          cornering: driver.ratings.cornering,
          braking: driver.ratings.braking,
          straights: driver.ratings.straights,
          tractionAcceleration: driver.ratings.tractionAcceleration,
          elevationBlindCorners: driver.ratings.elevationBlindCorners,
          technical: driver.ratings.technical,
          overtakingRacecraft: driver.ratings.overtakingRacecraft,
          surfaceGripBumpiness: driver.ratings.surfaceGripBumpiness,
          riskManagement: driver.ratings.riskManagement,
          enduranceConsistency: driver.ratings.enduranceConsistency,
        },
        notes: (driver.traits ?? []).join('; '),
      });
    }
  }

  for (let year = baseline.yearRange.first; year <= baseline.yearRange.last; year += 1) {
    await preloadMarketBundle(year, 'F1');
    const market = getMarketBundle(year, 'F1');
    if (!market) throw new Error(`Missing shared market bundle: ${year}`);
    for (const driver of market.drivers) {
      rawHistory.push({
        year,
        series: '',
        recordType: 'Adult market',
        sourceId: driver.id,
        name: driver.name,
        nationality: driver.nationality,
        age: driver.age,
        birthYear: driver.age > 0 ? year - driver.age : null,
        team: '',
        carNumber: null,
        context: driver.context,
        seriesPreferences: driver.seriesPreferences ?? [],
        overall: driver.overall,
        potential: driver.potential,
        salary: driver.salary,
        marketValue: driver.buyoutCost,
        skills: driver.skills,
        notes: driver.notes,
      });
    }
    for (const driver of market.youth) {
      rawHistory.push({
        year,
        series: '',
        recordType: 'Youth market',
        sourceId: driver.id,
        name: driver.name,
        nationality: driver.nationality,
        age: driver.age,
        birthYear: driver.birthYear,
        team: '',
        carNumber: null,
        context: driver.currentLevel,
        seriesPreferences: driver.seriesPreferences ?? [],
        overall: driver.overall,
        potential: driver.potential,
        salary: null,
        marketValue: driver.signingCost,
        skills: driver.skills,
        notes: driver.notes,
      });
    }
  }

  const drivers: DriverAccumulator[] = [];
  const byCanonical = new Map<string, DriverAccumulator[]>();
  const register = (driver: DriverAccumulator) => {
    drivers.push(driver);
    const bucket = byCanonical.get(driver.canonicalName) ?? [];
    bucket.push(driver);
    byCanonical.set(driver.canonicalName, bucket);
  };

  for (const entry of registryList(getMasterRegistry())) {
    const driver = emptyDriver(entry.driverId, entry.displayName, entry.canonicalName, entry.birthYear ?? null);
    driver.nationality = entry.nationality ?? '';
    driver.firstSeenYear = entry.firstSeenYear;
    driver.lastSeenYear = entry.lastSeenYear;
    driver.latestOverall = entry.baseRatings.overall;
    driver.maximumPotential = entry.potential;
    driver.switchWillingness = entry.willingnessToSwitchSeries;
    driver.latestSalary = entry.salaryDemand;
    driver.latestMarketValue = entry.marketValue;
    driver.latestSkills = entry.baseRatings;
    driver.ratingYear = entry.lastSeenYear;
    for (const sourceId of entry.sourceIds) driver.sourceIds.add(sourceId);
    driver.preferences.set(entry.preferredSeries, 100);
    entry.secondarySeriesInterest.forEach((series, index) => driver.preferences.set(series, Math.max(55, 80 - index * 10)));
    if (entry.activeSeatsByYear?.length) driver.roles.add('Active roster');
    register(driver);
  }

  const findDriver = (row: DriverHistoryRow): DriverAccumulator => {
    const canonical = canonicalNameOf(row.name);
    const candidates = byCanonical.get(canonical) ?? [];
    if (row.birthYear != null) {
      const close = candidates.find((driver) => driver.birthYear != null && Math.abs(driver.birthYear - row.birthYear!) <= 2);
      if (close) return close;
      const unknown = candidates.find((driver) => driver.birthYear == null);
      if (unknown) return unknown;
    } else {
      if (candidates.length === 1) return candidates[0];
      const unknown = candidates.find((driver) => driver.birthYear == null);
      if (unknown) return unknown;
    }

    let driverId = slugify(row.name) || `driver-${drivers.length + 1}`;
    if (drivers.some((driver) => driver.driverId === driverId)) {
      let suffix = 2;
      while (drivers.some((driver) => driver.driverId === `${driverId}-${suffix}`)) suffix += 1;
      driverId = `${driverId}-${suffix}`;
    }
    const created = emptyDriver(driverId, row.name, canonical, row.birthYear);
    register(created);
    return created;
  };

  const driverHistory = rawHistory.map((row) => {
    const driver = findDriver(row);
    driver.nationality ||= row.nationality;
    driver.birthYear ??= row.birthYear;
    driver.firstSeenYear = minYear(driver.firstSeenYear, row.year);
    driver.lastSeenYear = maxYear(driver.lastSeenYear, row.year);
    driver.roles.add(row.recordType);
    driver.sourceIds.add(row.sourceId);
    if (row.recordType === 'Active roster') {
      driver.firstActiveYear = minYear(driver.firstActiveYear, row.year);
      driver.lastActiveYear = maxYear(driver.lastActiveYear, row.year);
      if (row.series) {
        const years = driver.seriesYears.get(row.series) ?? new Set<number>();
        years.add(row.year);
        driver.seriesYears.set(row.series, years);
      }
    } else if (row.recordType === 'Adult market') {
      driver.firstAdultMarketYear = minYear(driver.firstAdultMarketYear, row.year);
      driver.lastAdultMarketYear = maxYear(driver.lastAdultMarketYear, row.year);
    } else {
      driver.firstYouthMarketYear = minYear(driver.firstYouthMarketYear, row.year);
      driver.lastYouthMarketYear = maxYear(driver.lastYouthMarketYear, row.year);
    }
    for (const preference of row.seriesPreferences) {
      driver.preferences.set(preference.series, Math.max(driver.preferences.get(preference.series) ?? 0, preference.weight));
    }
    if (row.series) driver.preferences.set(row.series, Math.max(driver.preferences.get(row.series) ?? 0, 100));
    const priority = row.recordType === 'Active roster' ? 3 : row.recordType === 'Adult market' ? 2 : 1;
    if (row.year > driver.ratingYear || (row.year === driver.ratingYear && priority >= driver.ratingPriority)) {
      driver.ratingYear = row.year;
      driver.ratingPriority = priority;
      driver.latestOverall = row.overall;
      driver.latestSkills = row.skills;
      driver.latestSalary = row.salary ?? driver.latestSalary;
      driver.latestMarketValue = row.marketValue ?? driver.latestMarketValue;
    }
    driver.maximumPotential = driver.maximumPotential == null ? row.potential : Math.max(driver.maximumPotential, row.potential);
    return { ...row, driverId: driver.driverId };
  }).sort((left, right) => left.year - right.year || left.name.localeCompare(right.name) || left.recordType.localeCompare(right.recordType));

  drivers.sort((left, right) => left.displayName.localeCompare(right.displayName) || left.driverId.localeCompare(right.driverId));
  const masterDrivers: MasterDriverRow[] = drivers.map((driver) => ({
    driverId: driver.driverId,
    displayName: driver.displayName,
    canonicalName: driver.canonicalName,
    nationality: driver.nationality,
    birthYear: driver.birthYear,
    firstSeenYear: driver.firstSeenYear,
    lastSeenYear: driver.lastSeenYear,
    firstActiveYear: driver.firstActiveYear,
    lastActiveYear: driver.lastActiveYear,
    firstAdultMarketYear: driver.firstAdultMarketYear,
    lastAdultMarketYear: driver.lastAdultMarketYear,
    firstYouthMarketYear: driver.firstYouthMarketYear,
    lastYouthMarketYear: driver.lastYouthMarketYear,
    roles: [...driver.roles].sort().join('; '),
    preferredSeries: preferredSeries(driver),
    seriesInterests: [...driver.preferences.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([series, weight]) => `${series} (${weight})`).join('; '),
    f1Seasons: driver.seriesYears.get('F1')?.size ?? 0,
    cartSeasons: driver.seriesYears.get('CART')?.size ?? 0,
    champCarSeasons: driver.seriesYears.get('Champ Car')?.size ?? 0,
    indyCarSeasons: driver.seriesYears.get('IndyCar')?.size ?? 0,
    nascarSeasons: driver.seriesYears.get('NASCAR')?.size ?? 0,
    latestOverall: driver.latestOverall,
    maximumPotential: driver.maximumPotential,
    switchWillingness: driver.switchWillingness,
    latestSalary: driver.latestSalary,
    latestMarketValue: driver.latestMarketValue,
    cornering: driver.latestSkills?.cornering ?? null,
    braking: driver.latestSkills?.braking ?? null,
    straights: driver.latestSkills?.straights ?? null,
    tractionAcceleration: driver.latestSkills?.tractionAcceleration ?? null,
    elevationBlindCorners: driver.latestSkills?.elevationBlindCorners ?? null,
    technical: driver.latestSkills?.technical ?? null,
    overtakingRacecraft: driver.latestSkills?.overtakingRacecraft ?? null,
    surfaceGripBumpiness: driver.latestSkills?.surfaceGripBumpiness ?? null,
    riskManagement: driver.latestSkills?.riskManagement ?? null,
    enduranceConsistency: driver.latestSkills?.enduranceConsistency ?? null,
    uniqueSourceIds: driver.sourceIds.size,
  }));

  const duplicateDriverIds = masterDrivers.map((driver) => driver.driverId)
    .filter((driverId, index, all) => all.indexOf(driverId) !== index);
  const invalidIdentityCollisions: IntegrityReport['invalidIdentityCollisions'] = [];
  for (const bucket of byCanonical.values()) {
    for (let leftIndex = 0; leftIndex < bucket.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < bucket.length; rightIndex += 1) {
        const left = bucket[leftIndex];
        const right = bucket[rightIndex];
        if (left.birthYear == null || right.birthYear == null || Math.abs(left.birthYear - right.birthYear) <= 2) {
          invalidIdentityCollisions.push([left.driverId, right.driverId, left.birthYear, right.birthYear]);
        }
      }
    }
  }
  const seasonKeys = seasons.map((season) => `${season.year}-${season.series}`);
  const driverIds = new Set(masterDrivers.map((driver) => driver.driverId));
  const integrity: IntegrityReport = {
    duplicateDriverIds,
    invalidIdentityCollisions,
    generatedHistoryRecords: driverHistory
      .filter((row) => generatedMarker.test(`${row.sourceId} ${row.name} ${row.notes}`))
      .map((row) => [row.year, row.recordType, row.name]),
    duplicateSeasonKeys: seasonKeys.filter((key, index) => seasonKeys.indexOf(key) !== index),
    orphanHistoryRecords: driverHistory.filter((row) => !driverIds.has(row.driverId)).map((row) => row.sourceId),
  };
  seasons.sort((left, right) => left.year - right.year || left.series.localeCompare(right.series));
  return { masterDrivers, driverHistory, seasons, integrity };
}

describe('final master-data archive', () => {
  it('regenerates portable backups and enforces the preservation baseline', async () => {
    const archive = await collectArchive();
    const recordCounts = {
      activeRosterRecords: archive.driverHistory.filter((row) => row.recordType === 'Active roster').length,
      adultMarketRecords: archive.driverHistory.filter((row) => row.recordType === 'Adult market').length,
      youthMarketRecords: archive.driverHistory.filter((row) => row.recordType === 'Youth market').length,
    };
    const seriesCounts = Object.fromEntries(
      ['F1', 'CART', 'Champ Car', 'IndyCar', 'NASCAR'].map((series) => [series, archive.seasons.filter((season) => season.series === series).length]),
    );

    expect(archive.masterDrivers.length).toBeGreaterThanOrEqual(baseline.minimumCounts.masterDrivers);
    expect(archive.driverHistory.length).toBeGreaterThanOrEqual(baseline.minimumCounts.driverHistory);
    expect(recordCounts.activeRosterRecords).toBeGreaterThanOrEqual(baseline.minimumCounts.activeRosterRecords);
    expect(recordCounts.adultMarketRecords).toBeGreaterThanOrEqual(baseline.minimumCounts.adultMarketRecords);
    expect(recordCounts.youthMarketRecords).toBeGreaterThanOrEqual(baseline.minimumCounts.youthMarketRecords);
    expect(archive.seasons.length).toBe(baseline.exactSeasonCounts.total);
    expect(seriesCounts).toEqual({
      F1: baseline.exactSeasonCounts.F1,
      CART: baseline.exactSeasonCounts.CART,
      'Champ Car': baseline.exactSeasonCounts['Champ Car'],
      IndyCar: baseline.exactSeasonCounts.IndyCar,
      NASCAR: baseline.exactSeasonCounts.NASCAR,
    });
    expect(Math.min(...archive.seasons.map((season) => season.year))).toBe(baseline.yearRange.first);
    expect(Math.max(...archive.seasons.map((season) => season.year))).toBe(baseline.yearRange.last);
    expect(archive.integrity).toEqual({
      duplicateDriverIds: [],
      invalidIdentityCollisions: [],
      generatedHistoryRecords: [],
      duplicateSeasonKeys: [],
      orphanHistoryRecords: [],
    });

    const json = `${JSON.stringify({
      schemaVersion: baseline.schemaVersion,
      sourceCommit: process.env.GITHUB_SHA ?? process.env.MASTER_ARCHIVE_SOURCE_COMMIT ?? 'local-working-tree',
      masterDrivers: archive.masterDrivers,
      driverHistory: archive.driverHistory,
      seasons: archive.seasons,
    }, null, 2)}\n`;
    const files = {
      'master-archive.json': json,
      'master-drivers.csv': csvFromObjects(archive.masterDrivers),
      'driver-history.csv': csvFromObjects(archive.driverHistory.map((row) => ({
        ...row,
        seriesPreferences: row.seriesPreferences.map((preference) => `${preference.series} (${preference.weight})`).join('; '),
        skills: JSON.stringify(row.skills),
      }))),
      'master-seasons.csv': csvFromObjects(archive.seasons),
    };
    const manifest = {
      schemaVersion: baseline.schemaVersion,
      sourceCommit: process.env.GITHUB_SHA ?? process.env.MASTER_ARCHIVE_SOURCE_COMMIT ?? 'local-working-tree',
      counts: {
        masterDrivers: archive.masterDrivers.length,
        driverHistory: archive.driverHistory.length,
        seasons: archive.seasons.length,
        ...recordCounts,
        seasonsBySeries: seriesCounts,
      },
      yearRange: baseline.yearRange,
      integrity: archive.integrity,
      sha256: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, sha256(content)])),
    };
    await mkdir(outputDir, { recursive: true });
    await Promise.all([
      ...Object.entries(files).map(([name, content]) => writeFile(path.join(outputDir, name), content)),
      writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
    ]);

    const writtenManifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8')) as typeof manifest;
    expect(writtenManifest.counts.masterDrivers).toBe(archive.masterDrivers.length);
    expect(writtenManifest.sha256['master-archive.json']).toBe(sha256(await readFile(path.join(outputDir, 'master-archive.json'), 'utf8')));
  });
});
