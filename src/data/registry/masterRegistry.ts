// Master Driver Registry builder.
//
// Merges every season roster + market/youth bundle into one deterministic
// registry of canonical driver identities. Season files are the source of who
// exists; this layer unifies them under stable ids and adds the long-term
// availability + market metadata the career universe needs. It is pure and does
// not mutate any season data.
//
// Dedup strategy (season files do NOT share ids across years):
//   1. primary match by derived canonical driverId (slug of canonical name)
//   2. fallback match by canonicalName + birthYear when both are known
// The same real driver appearing in many seasons therefore collapses to a
// single entry, accumulating per-year rating snapshots and series experience.

import type { Driver, Series } from '../../types/gameTypes';
import type { MarketDriver, MarketSkillRatings, YouthProspect } from '../../types/marketTypes';
import type {
  CareerPhase,
  MasterDriverEntry,
  MasterDriverRegistry,
  RegistryBaseRatings,
  RegistryMergeResult,
  RegistryDriverStatus,
} from '../../types/registryTypes';
import type { SeasonBundle } from '../seasonCatalog';

// --- Canonical aliases ------------------------------------------------------

// Some season files (notably 1995) use abbreviated driver names (e.g. "M. Schumacher"
// instead of "Michael Schumacher"). This map resolves those abbreviations to the
// canonical full name so the registry merges them into a single identity.
// Keys are normalized (lowercase, no diacritics) abbreviated forms.
const CANONICAL_ALIASES: Record<string, string> = {
  'm schumacher': 'michael schumacher',
  'j herbert': 'johnny herbert',
  'm salo': 'mika salo',
  'u katayama': 'ukyo katayama',
  'd hill': 'damon hill',
};

// Resolve an abbreviated name to its canonical full form, if known.
export function resolveAlias(normalized: string): string {
  return CANONICAL_ALIASES[normalized] ?? normalized;
}

// Full canonical name resolution: normalize then resolve aliases.
export function canonicalNameOf(name: string): string {
  return resolveAlias(normalizeName(name));
}

// --- Name normalization -----------------------------------------------------

// Strip diacritics, punctuation and case so "Kimi Räikkönen" and
// "Kimi Raikkonen" collapse to one identity.
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function slugifyName(name: string): string {
  return normalizeName(name).replace(/ /g, '-');
}

// Market-status / rumour tags that some curated market entries append to the
// driver's name (e.g. "Jean Alesi Contract Watch"). These belong in the
// marketPool / context / notes, never in the driver's name.
const MARKET_NAME_TAGS = [
  'contract watch',
  'silly season',
  'transfer target',
  'contract target',
  'watch list',
  'rumour',
  'rumor',
];

// Strip trailing market tags (bracketed or dash/colon/space-separated) from a
// market driver's name so labels never become part of the identity. Falls back
// to the original name if stripping would empty it.
export function sanitizeMarketName(name: string): string {
  let out = name.trim();
  // Bracketed tag, e.g. "Jean Alesi (Contract Watch)".
  out = out.replace(/\s*[([][^)\]]*[)\]]\s*$/, '').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const tag of MARKET_NAME_TAGS) {
      const re = new RegExp(`[\\s\\-–—:|]+${tag}\\s*$`, 'i');
      if (re.test(out)) {
        out = out.replace(re, '').trim();
        changed = true;
      }
    }
  }
  return out || name.trim();
}

// --- Skill helpers ----------------------------------------------------------

const SKILL_KEYS: (keyof MarketSkillRatings)[] = [
  'cornering',
  'braking',
  'straights',
  'tractionAcceleration',
  'elevationBlindCorners',
  'technical',
  'overtakingRacecraft',
  'surfaceGripBumpiness',
  'riskManagement',
  'enduranceConsistency',
];

function skillsFromDriver(d: Driver): MarketSkillRatings {
  const r = d.ratings;
  return {
    cornering: r.cornering,
    braking: r.braking,
    straights: r.straights,
    tractionAcceleration: r.tractionAcceleration,
    elevationBlindCorners: r.elevationBlindCorners,
    technical: r.technical,
    overtakingRacecraft: r.overtakingRacecraft,
    surfaceGripBumpiness: r.surfaceGripBumpiness,
    riskManagement: r.riskManagement,
    enduranceConsistency: r.enduranceConsistency,
  };
}

function flatSkills(overall: number): MarketSkillRatings {
  return Object.fromEntries(SKILL_KEYS.map((k) => [k, overall])) as MarketSkillRatings;
}

// --- Career phase / willingness --------------------------------------------

export function careerPhaseForAge(age: number | undefined): CareerPhase {
  if (age == null) return 'peak';
  if (age < 18) return 'prospect';
  if (age < 23) return 'rising';
  if (age < 31) return 'peak';
  if (age < 36) return 'veteran';
  return 'twilight';
}

// Younger + seatless drivers are the most willing to switch series; established
// peak drivers with seats are the least. Baseline only — the career layer
// refines this against concrete offers (Phase 4).
function baseWillingness(age: number | undefined, status: RegistryDriverStatus): number {
  const phase = careerPhaseForAge(age);
  let w = 40;
  if (phase === 'prospect' || phase === 'rising') w = 65;
  else if (phase === 'peak') w = 35;
  else if (phase === 'veteran') w = 45;
  else if (phase === 'twilight') w = 55;
  if (status === 'adult_free_agent' || status === 'reserve_driver') w += 20;
  if (status === 'active_driver') w -= 10;
  return Math.max(0, Math.min(100, w));
}

// --- Source → partial entry -------------------------------------------------

type PartialFields = {
  displayName: string;
  nationality?: string;
  age?: number;
  birthYear?: number;
  baseRatings: RegistryBaseRatings;
  traits: string[];
  potential: number;
  sponsorBacking: number;
  payDriverFunding: number;
  marketValue: number;
  salaryDemand: number;
  sourceId: string;
  skills?: MarketSkillRatings;
  overall: number;
};

function baseRatingsFrom(skills: MarketSkillRatings, overall: number, potential: number): RegistryBaseRatings {
  return { ...skills, overall, potential };
}

// --- Registry accumulation --------------------------------------------------

function emptyRegistry(): MasterDriverRegistry {
  return { byId: {}, order: [] };
}

// The same real driver's age is recorded slightly inconsistently across season
// files (a driver listed as 24 in one year's grid and 26 two years later implies
// birth years a year apart). Birth years within this tolerance are treated as
// the same identity; only a larger gap indicates two genuinely different people
// who happen to share a name.
const BIRTH_YEAR_TOLERANCE = 2;

// Find an existing entry for this identity: by canonical id first, else by
// canonical name (+ birthYear when both sides know it).
function findMatch(
  reg: MasterDriverRegistry,
  driverId: string,
  canonicalName: string,
  birthYear: number | undefined,
): MasterDriverEntry | undefined {
  for (const id of reg.order) {
    const e = reg.byId[id];
    // Match by canonical id or canonical name (the derived id is a slug of the
    // name, so name equality subsumes the id check for the common case).
    if (e.driverId !== driverId && e.canonicalName !== canonicalName) continue;
    // Birth year disambiguates two distinct people who share a name, but must
    // tolerate the age-recording noise that otherwise splits one driver in two.
    if (
      birthYear != null &&
      e.birthYear != null &&
      Math.abs(e.birthYear - birthYear) > BIRTH_YEAR_TOLERANCE
    ) {
      continue;
    }
    return e;
  }
  return undefined;
}

// Merge one source record (already reduced to PartialFields) into the registry.
function mergeOne(
  reg: MasterDriverRegistry,
  fields: PartialFields,
  ctx: {
    year: number;
    series: Series;
    status: RegistryDriverStatus;
    academyEligibleYear?: number;
    adultEligibleYear?: number;
  },
  result: { created: string[]; merged: string[] },
): void {
  const rawName = normalizeName(fields.displayName);
  const canonicalName = resolveAlias(rawName);
  const derivedId = slugifyName(canonicalName === rawName ? fields.displayName : canonicalName);
  const existing = findMatch(reg, derivedId, canonicalName, fields.birthYear);

  const snapshot = {
    year: ctx.year,
    series: ctx.series,
    overall: fields.overall,
    potential: fields.potential,
    skills: fields.skills,
    sourceId: fields.sourceId,
  };

  if (existing) {
    // Idempotent: never re-add the same source id.
    if (!existing.sourceIds.includes(fields.sourceId)) {
      existing.sourceIds.push(fields.sourceId);
      existing.baseRatingsByYear.push(snapshot);
      existing.baseRatingsByYear.sort((a, b) => a.year - b.year || a.series.localeCompare(b.series));
    }
    existing.firstSeenYear = Math.min(existing.firstSeenYear, ctx.year);
    existing.lastSeenYear = Math.max(existing.lastSeenYear, ctx.year);
    existing.marketEntryYear = Math.min(existing.marketEntryYear, ctx.year);
    existing.nationality = existing.nationality ?? fields.nationality;
    existing.birthYear = existing.birthYear ?? fields.birthYear;
    existing.startingAge = existing.startingAge ?? fields.age;
    existing.seriesExperience[ctx.series] = (existing.seriesExperience[ctx.series] ?? 0) + 1;
    if (!existing.eligibleSeries.includes(ctx.series)) existing.eligibleSeries.push(ctx.series);
    // Prefer the most-recent, highest-fidelity ratings as the "base".
    if (ctx.year >= existing.lastSeenYear) {
      existing.baseRatings = fields.baseRatings;
      existing.potential = Math.max(existing.potential, fields.potential);
    }
    // A registered youth/free-agent who later appears as a grid driver upgrades
    // to the more "active" status; retired/active preference handled elsewhere.
    if (ctx.status === 'active_driver') existing.careerStatus = 'active_driver';
    existing.academyEligibleYear = existing.academyEligibleYear ?? ctx.academyEligibleYear;
    existing.adultEligibleYear = existing.adultEligibleYear ?? ctx.adultEligibleYear;
    result.merged.push(existing.driverId);
    return;
  }

  // Ensure the new id is unique even if two distinct people share a name with
  // no birth year to separate them.
  let driverId = derivedId;
  if (reg.byId[driverId]) {
    let n = 2;
    while (reg.byId[`${driverId}-${n}`]) n += 1;
    driverId = `${driverId}-${n}`;
  }

  const entry: MasterDriverEntry = {
    driverId,
    canonicalName,
    displayName: fields.displayName,
    nationality: fields.nationality,
    birthYear: fields.birthYear,
    startingAge: fields.age,
    preferredSeries: ctx.series,
    eligibleSeries: [ctx.series],
    secondarySeriesInterest: [],
    seriesExperience: { [ctx.series]: 1 },
    willingnessToSwitchSeries: baseWillingness(fields.age, ctx.status),
    careerStatus: ctx.status,
    academyEligibleYear: ctx.academyEligibleYear,
    adultEligibleYear: ctx.adultEligibleYear,
    marketEntryYear: ctx.year,
    historicalDebutYear: ctx.status === 'active_driver' ? ctx.year : undefined,
    retirementYear: undefined,
    potential: fields.potential,
    baseRatings: fields.baseRatings,
    baseRatingsByYear: [snapshot],
    traits: fields.traits,
    sponsorBacking: fields.sponsorBacking,
    payDriverFunding: fields.payDriverFunding,
    marketValue: fields.marketValue,
    salaryDemand: fields.salaryDemand,
    sourceIds: [fields.sourceId],
    firstSeenYear: ctx.year,
    lastSeenYear: ctx.year,
  };
  reg.byId[driverId] = entry;
  reg.order.push(driverId);
  result.created.push(driverId);
}

// --- Public import functions ------------------------------------------------

// Import one season's full grid roster (active drivers) into the registry.
export function importSeasonDrivers(
  registry: MasterDriverRegistry,
  drivers: Driver[],
  year: number,
  series: Series,
): RegistryMergeResult {
  const result = { created: [] as string[], merged: [] as string[] };
  for (const d of drivers) {
    const skills = skillsFromDriver(d);
    mergeOne(
      registry,
      {
        displayName: d.name,
        nationality: d.nationality,
        age: d.age,
        birthYear: d.age != null ? year - d.age : undefined,
        overall: d.ratings.overall,
        potential: d.ratings.overall, // grid files carry no separate potential
        skills,
        baseRatings: baseRatingsFrom(skills, d.ratings.overall, d.ratings.overall),
        traits: d.traits ?? [],
        sponsorBacking: 0,
        payDriverFunding: 0,
        marketValue: Math.max(0, (d.ratings.overall - 3) * 3),
        salaryDemand: d.salary ?? Math.max(0.2, (d.ratings.overall - 4) * 1.5),
        sourceId: d.id,
      },
      { year, series, status: 'active_driver' },
      result,
    );
  }
  return { registry, ...result };
}

// Import one season's adult market drivers.
export function importMarketDrivers(
  registry: MasterDriverRegistry,
  drivers: MarketDriver[],
  year: number,
  series: Series,
): RegistryMergeResult {
  const result = { created: [] as string[], merged: [] as string[] };
  for (const m of drivers) {
    mergeOne(
      registry,
      {
        displayName: sanitizeMarketName(m.name),
        nationality: m.nationality,
        age: m.age || undefined,
        birthYear: m.age > 0 ? year - m.age : undefined,
        overall: m.overall,
        potential: m.potential,
        skills: m.skills,
        baseRatings: baseRatingsFrom(m.skills, m.overall, m.potential),
        traits: [],
        sponsorBacking: m.sponsorValue,
        payDriverFunding: 0,
        marketValue: m.buyoutCost,
        salaryDemand: m.salary,
        sourceId: m.id,
      },
      { year, series, status: 'adult_free_agent' },
      result,
    );
  }
  return { registry, ...result };
}

// Import one season's youth prospects.
export function importYouthProspects(
  registry: MasterDriverRegistry,
  youth: YouthProspect[],
  year: number,
  series: Series,
): RegistryMergeResult {
  const result = { created: [] as string[], merged: [] as string[] };
  for (const y of youth) {
    const adultEligibleYear = (y.birthYear || year - y.age) + 18;
    mergeOne(
      registry,
      {
        displayName: sanitizeMarketName(y.name),
        nationality: y.nationality,
        age: y.age,
        birthYear: y.birthYear || year - y.age,
        overall: y.overall,
        potential: y.potential,
        skills: y.skills,
        baseRatings: baseRatingsFrom(y.skills, y.overall, y.potential),
        traits: [],
        sponsorBacking: 0,
        payDriverFunding: 0,
        marketValue: y.signingCost,
        salaryDemand: Math.max(0.1, y.potential / 10),
        sourceId: y.id,
      },
      {
        year,
        series,
        status: 'youth_pool',
        academyEligibleYear: y.earliestFullAcademyYear || year,
        adultEligibleYear,
      },
      result,
    );
  }
  return { registry, ...result };
}

// --- Full registry build ----------------------------------------------------

function overallFromSkills(skills: MarketSkillRatings): number {
  const vals = SKILL_KEYS.map((k) => skills[k]);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Parse a "YYYY-Series" bundle key.
export function parseBundleKey(key: string): { year: number; series: Series } {
  const idx = key.indexOf('-');
  return { year: Number(key.slice(0, idx)), series: key.slice(idx + 1) as Series };
}

// Build the complete Master Driver Registry from every registered season +
// market/youth bundle, deterministically. Season bundles are processed in
// chronological order so per-year snapshots sort naturally and the earliest
// appearance sets firstSeenYear / marketEntryYear.
export function buildMasterRegistry(): MasterDriverRegistry {
  const registry = emptyRegistry();
  const bundles = _seasonBundles ?? {};
  const keys = Object.keys(bundles).sort((a, b) => {
    const pa = parseBundleKey(a);
    const pb = parseBundleKey(b);
    return pa.year - pb.year || pa.series.localeCompare(pb.series);
  });
  for (const key of keys) {
    const { year, series } = parseBundleKey(key);
    const bundle = bundles[key];
    importSeasonDrivers(registry, bundle.drivers, year, series);
  }
  // Set series-specific ratings + secondary interest once all sources merged.
  for (const id of registry.order) {
    const e = registry.byId[id];
    e.secondarySeriesInterest = e.eligibleSeries.filter((s) => s !== e.preferredSeries);
    // Series-specific base ratings = latest snapshot per series.
    const bySeries: Partial<Record<Series, RegistryBaseRatings>> = {};
    for (const snap of e.baseRatingsByYear) {
      const skills = snap.skills ?? flatSkills(snap.overall);
      bySeries[snap.series] = baseRatingsFrom(
        skills,
        snap.overall || overallFromSkills(skills),
        snap.potential ?? snap.overall,
      );
    }
    if (Object.keys(bySeries).length > 1) e.seriesSpecificRatings = bySeries;
  }
  return registry;
}

// Provider pattern: season bundles are injected by seasonData.ts (tests)
// or dynamically imported at game start (production). This avoids pulling
// all 56 season bundles into the initial bundle via the import chain
// gameReducer → seasonRollover → careerMarketEngine → masterRegistry.
let _seasonBundles: Record<string, SeasonBundle> | null = null;

export function setSeasonBundles(bundles: Record<string, SeasonBundle>): void {
  _seasonBundles = bundles;
  cached = undefined; // invalidate memoized registry
}

// Memoized singleton — the registry is derived purely from static seed data.
let cached: MasterDriverRegistry | undefined;
export function getMasterRegistry(): MasterDriverRegistry {
  if (!cached) {
    if (!_seasonBundles) {
      throw new Error('Season bundles not initialized — call setSeasonBundles first');
    }
    cached = buildMasterRegistry();
  }
  return cached;
}

// Convenience list accessor in deterministic order.
export function registryList(reg: MasterDriverRegistry = getMasterRegistry()): MasterDriverEntry[] {
  return reg.order.map((id) => reg.byId[id]);
}
