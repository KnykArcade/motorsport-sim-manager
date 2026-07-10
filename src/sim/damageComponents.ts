import type { Series } from '../types/gameTypes';
import type { DamageBalanceSettings, DamageComponentKind, DamageComponentSeverity, LiveCarState } from '../types/liveTypes';

type DamageSeries = Series | 'NASCAR';

export type DamageRepairMode = 'None' | 'Critical' | 'Full';
export type ReliabilityRecoveryOutcome = 'full' | 'partial' | 'none' | 'worse';

export type ReliabilityRecoveryRatings = {
  carReliability: number;
  teamReliabilityDepartment: number;
  teamRaceOperations: number;
  driverEnduranceConsistency: number;
  driverComposure: number;
  driverRiskManagement: number;
};

export type DamageProfile = {
  damageFrequency: number;
  damageSeverity: number;
  repairTimeMultiplier: number;
  reliabilityStrictness: number;
  physicalRepairAllowed: boolean;
  mechanicalRepairAllowed: boolean;
  criticalMechanicalRepairAllowed: boolean;
};

export type DamageDataOverrides = {
  profiles?: Partial<Record<string, Partial<DamageProfile>>>;
};

let overrides: DamageDataOverrides | null = null;

export function registerDamageDataOverrides(next: DamageDataOverrides | null): void {
  overrides = next;
}

export const DEFAULT_DAMAGE_SETTINGS: DamageBalanceSettings = {
  damageFrequency: 1,
  damageSeverity: 1,
  repairTimeMultiplier: 1,
  reliabilityStrictness: 1,
};

const BASE_REPAIR_SECONDS: Record<DamageComponentKind, Record<DamageComponentSeverity, number>> = {
  Aero: { none: 0, minor: 1.9, moderate: 4.8, severe: 9.5, terminal: 0 },
  Suspension: { none: 0, minor: 2.4, moderate: 5.8, severe: 11, terminal: 0 },
  Bodywork: { none: 0, minor: 1.2, moderate: 3.2, severe: 7.2, terminal: 0 },
  Engine: { none: 0, minor: 0, moderate: 5.2, severe: 12.5, terminal: 0 },
  Gearbox: { none: 0, minor: 0, moderate: 5.6, severe: 13, terminal: 0 },
  Brakes: { none: 0, minor: 0.8, moderate: 3.9, severe: 8.2, terminal: 0 },
  Cooling: { none: 0, minor: 0, moderate: 4.8, severe: 10.8, terminal: 0 },
  Hydraulics: { none: 0, minor: 0, moderate: 4.5, severe: 10.2, terminal: 0 },
  Electrical: { none: 0, minor: 0, moderate: 4.1, severe: 9.4, terminal: 0 },
};

const PROFILE_BY_SERIES_ERA: Array<{
  key: string;
  match: (series: DamageSeries, year: number) => boolean;
  profile: DamageProfile;
}> = [
  {
    key: 'F1:1990-1993',
    match: (series, year) => series === 'F1' && year <= 1993,
    profile: {
      damageFrequency: 1.18,
      damageSeverity: 1.15,
      repairTimeMultiplier: 0.82,
      reliabilityStrictness: 1.18,
      physicalRepairAllowed: true,
      mechanicalRepairAllowed: false,
      criticalMechanicalRepairAllowed: false,
    },
  },
  {
    key: 'F1:1994-2009',
    match: (series, year) => series === 'F1' && year <= 2009,
    profile: {
      damageFrequency: 1.05,
      damageSeverity: 1.05,
      repairTimeMultiplier: 0.92,
      reliabilityStrictness: 1.05,
      physicalRepairAllowed: true,
      mechanicalRepairAllowed: false,
      criticalMechanicalRepairAllowed: false,
    },
  },
  {
    key: 'F1:2010+',
    match: (series, year) => series === 'F1' && year >= 2010,
    profile: {
      damageFrequency: 0.82,
      damageSeverity: 0.9,
      repairTimeMultiplier: 0.96,
      reliabilityStrictness: 0.92,
      physicalRepairAllowed: true,
      mechanicalRepairAllowed: false,
      criticalMechanicalRepairAllowed: false,
    },
  },
  {
    key: 'IndyCar:any',
    match: (series) => series === 'IndyCar',
    profile: {
      damageFrequency: 0.98,
      damageSeverity: 1,
      repairTimeMultiplier: 1,
      reliabilityStrictness: 1,
      physicalRepairAllowed: true,
      mechanicalRepairAllowed: true,
      criticalMechanicalRepairAllowed: false,
    },
  },
  {
    key: 'CART:any',
    match: (series) => series === 'CART',
    profile: {
      damageFrequency: 1.05,
      damageSeverity: 1.02,
      repairTimeMultiplier: 1.04,
      reliabilityStrictness: 1.02,
      physicalRepairAllowed: true,
      mechanicalRepairAllowed: true,
      criticalMechanicalRepairAllowed: false,
    },
  },
  {
    key: 'Champ Car:any',
    match: (series) => series === 'Champ Car',
    profile: {
      damageFrequency: 1,
      damageSeverity: 1,
      repairTimeMultiplier: 1,
      reliabilityStrictness: 1,
      physicalRepairAllowed: true,
      mechanicalRepairAllowed: true,
      criticalMechanicalRepairAllowed: false,
    },
  },
  {
    key: 'NASCAR:1990-2010',
    match: (series, year) => series === 'NASCAR' && year <= 2010,
    profile: {
      damageFrequency: 1.12,
      damageSeverity: 1.08,
      repairTimeMultiplier: 1.12,
      reliabilityStrictness: 1.06,
      physicalRepairAllowed: true,
      mechanicalRepairAllowed: true,
      criticalMechanicalRepairAllowed: false,
    },
  },
  {
    key: 'NASCAR:2011+',
    match: (series, year) => series === 'NASCAR' && year >= 2011,
    profile: {
      damageFrequency: 0.88,
      damageSeverity: 0.9,
      repairTimeMultiplier: 0.94,
      reliabilityStrictness: 0.92,
      physicalRepairAllowed: true,
      mechanicalRepairAllowed: false,
      criticalMechanicalRepairAllowed: false,
    },
  },
];

export function resolveDamageProfile(series?: DamageSeries, year?: number): DamageProfile {
  const fallback: DamageProfile = {
    damageFrequency: 1,
    damageSeverity: 1,
    repairTimeMultiplier: 1,
    reliabilityStrictness: 1,
    physicalRepairAllowed: true,
    mechanicalRepairAllowed: false,
    criticalMechanicalRepairAllowed: false,
  };
  if (!series || year == null) return fallback;

  const found = PROFILE_BY_SERIES_ERA.find((entry) => entry.match(series, year));
  const base = found?.profile ?? fallback;
  const override = overrides?.profiles?.[`${series}:${year}`] ?? overrides?.profiles?.[found?.key ?? ''];
  return override ? { ...base, ...override } : base;
}

export type DamageComponent = {
  kind: DamageComponentKind;
  severity: DamageComponentSeverity;
  pacePenalty: number;
  riskType: 'crash' | 'failure';
  riskContribution: number;
  repairSeconds: number;
  repairableInRace: boolean;
  managed: boolean;
};

function severityRank(severity: DamageComponentSeverity): number {
  return { none: 0, minor: 1, moderate: 2, severe: 3, terminal: 4 }[severity];
}

function damagePenalty(kind: DamageComponentKind, severity: DamageComponentSeverity): number {
  if (severity === 'none') return 0;
  if (kind === 'Aero' || kind === 'Bodywork' || kind === 'Suspension') {
    return severity === 'minor' ? 0.12 : severity === 'moderate' ? 0.4 : severity === 'severe' ? 0.4 : 0.62;
  }
  return severity === 'minor'
    ? 0.05
    : severity === 'moderate'
      ? kind === 'Brakes'
        ? 0.25
        : 0.25
      : severity === 'severe'
        ? 0.5
        : 0.7;
}

function riskContribution(kind: DamageComponentKind, severity: DamageComponentSeverity): number {
  if (severity === 'none') return 0;
  const base = kind === 'Aero' || kind === 'Bodywork' || kind === 'Suspension' ? 'crash' : 'failure';
  const mult = base === 'crash'
    ? (severity === 'minor' ? 0.004 : severity === 'moderate' ? 0.01 : severity === 'severe' ? 0.02 : 0.035)
    : (severity === 'minor' ? 0.003 : severity === 'moderate' ? 0.01 : severity === 'severe' ? 0.02 : 0.04);
  return mult;
}

function repairSecondsFor(kind: DamageComponentKind, severity: DamageComponentSeverity, profile: DamageProfile): number {
  return round1(BASE_REPAIR_SECONDS[kind][severity] * profile.repairTimeMultiplier);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function severityFromHealth(health: number): DamageComponentSeverity {
  if (health <= 0) return 'terminal';
  if (health < 30) return 'severe';
  if (health < 60) return 'moderate';
  if (health < 80) return 'minor';
  return 'none';
}

function componentManaged(car: LiveCarState): boolean {
  return car.paceMode === 'Conservative' || car.paceMode === 'ProtectEngine';
}

function isMechanicalKind(kind: DamageComponentKind): boolean {
  return kind === 'Engine' || kind === 'Gearbox' || kind === 'Brakes' || kind === 'Cooling' || kind === 'Hydraulics' || kind === 'Electrical';
}

export function collectDamageComponents(
  car: LiveCarState,
  series?: DamageSeries,
  year?: number,
  settings: DamageBalanceSettings = DEFAULT_DAMAGE_SETTINGS,
): DamageComponent[] {
  const profile = resolveDamageProfile(series, year);
  const repairableInRace = {
    physical: profile.physicalRepairAllowed,
    mechanical: profile.mechanicalRepairAllowed,
  };
  const managed = componentManaged(car);
  const components: DamageComponent[] = [];
  const damageScale = settings.damageSeverity * profile.damageSeverity;

  if (car.damaged || (car.aeroHealth ?? 100) < 100) {
    const aeroHealth = car.aeroHealth ?? 100;
    const aeroSeverity = car.damaged
      ? aeroHealth <= 0
        ? 'terminal'
        : Math.min(aeroHealth, 82) < 45
          ? 'severe'
          : 'moderate'
      : severityFromHealth(aeroHealth);
    const severity = aeroSeverity === 'none' ? 'minor' : aeroSeverity;
    components.push({
      kind: 'Aero',
      severity,
      pacePenalty: round1(damagePenalty('Aero', severity) * damageScale),
      riskType: 'crash',
      riskContribution: round1(riskContribution('Aero', severity) * settings.damageFrequency),
      repairSeconds: repairSecondsFor('Aero', severity, profile),
      repairableInRace: repairableInRace.physical && severity !== 'terminal',
      managed,
    });
  }

  const issue = car.reliabilityIssue;
  if (issue) {
    const kind: DamageComponentKind =
      issue.type === 'EngineOverheating' || issue.type === 'CoolingProblem'
        ? 'Engine'
        : issue.type === 'GearboxWarning'
          ? 'Gearbox'
          : issue.type === 'BrakeIssue'
            ? 'Brakes'
            : issue.type === 'SuspensionConcern'
              ? 'Suspension'
              : issue.type === 'HydraulicLeak'
                ? 'Hydraulics'
                : issue.type === 'ElectricalGlitch'
                  ? 'Electrical'
                  : 'Engine';
    const severity: DamageComponentSeverity =
      issue.severity === 'Minor' ? 'minor' : issue.severity === 'Moderate' ? 'moderate' : 'severe';
    components.push({
      kind,
      severity,
      pacePenalty: round1(damagePenalty(kind, severity) * damageScale),
      riskType: 'failure',
      riskContribution: round1(issue.failureRisk * (issue.managed ? 0.3 : 1) * settings.reliabilityStrictness),
      repairSeconds: repairSecondsFor(kind, severity, profile),
      repairableInRace: (isMechanicalKind(kind) ? profile.mechanicalRepairAllowed : profile.physicalRepairAllowed) && severityRank(severity) < severityRank('terminal'),
      managed: issue.managed || managed,
    });
  }

  const healthKinds: Array<[DamageComponentKind, number]> = [
    ['Engine', car.engineHealth ?? 100],
    ['Gearbox', car.gearboxHealth ?? 100],
    ['Brakes', car.brakeHealth ?? 100],
  ];
  for (const [kind, health] of healthKinds) {
    if (issue && ((kind === 'Engine' && (issue.type === 'EngineOverheating' || issue.type === 'CoolingProblem')) || (kind === 'Gearbox' && issue.type === 'GearboxWarning') || (kind === 'Brakes' && issue.type === 'BrakeIssue'))) {
      continue;
    }
    const severity = severityFromHealth(health);
    if (severity === 'none') continue;
    components.push({
      kind,
      severity,
      pacePenalty: severity === 'minor' ? 0 : severity === 'moderate' ? 0.1 : severity === 'severe' ? 0.22 : 0.45,
      riskType: 'failure',
      riskContribution: round1((severity === 'minor' ? 0.001 : severity === 'moderate' ? 0.004 : severity === 'severe' ? 0.012 : 0.03) * settings.reliabilityStrictness),
      repairSeconds: repairSecondsFor(kind, severity, profile),
      repairableInRace: profile.mechanicalRepairAllowed && severity !== 'terminal',
      managed,
    });
  }

  return components;
}

export function damagePacePenalty(
  components: DamageComponent[],
): number {
  return round1(
    components.reduce(
      (sum, component) =>
        sum + (component.riskType === 'failure' && component.managed ? 0 : component.pacePenalty * (component.managed ? 0.7 : 1)),
      0,
    ),
  );
}

export function damageRiskContribution(components: DamageComponent[]): { crashRisk: number; failureRisk: number } {
  return components.reduce(
    (acc, component) => {
      const value = component.riskContribution * (component.managed ? (component.riskType === 'failure' ? 0.3 : 0.7) : 1);
      if (component.riskType === 'crash') acc.crashRisk += value;
      else acc.failureRisk += value;
      return acc;
    },
    { crashRisk: 0, failureRisk: 0 },
  );
}

export function damageRepairSeconds(components: DamageComponent[], mode: DamageRepairMode): number {
  if (mode === 'None') return 0;
  const severeRank = severityRank('severe');
  const terminalRank = severityRank('terminal');
  const selected = mode === 'Full' ? components : components.filter((c) => severityRank(c.severity) >= severeRank);
  return round1(
    selected.filter((c) => c.repairableInRace && severityRank(c.severity) < terminalRank).reduce((sum, c) => sum + c.repairSeconds, 0),
  );
}

export function hasTerminalDamage(components: DamageComponent[]): boolean {
  return components.some((c) => severityRank(c.severity) >= severityRank('terminal') && !c.repairableInRace);
}

export function hasForcedRepairNeed(components: DamageComponent[]): boolean {
  return components.some((c) => c.repairableInRace && severityRank(c.severity) >= severityRank('severe'));
}

export function repairModeForComponents(components: DamageComponent[]): DamageRepairMode {
  if (components.some((c) => severityRank(c.severity) >= severityRank('severe'))) return 'Critical';
  const hasPhysical = components.some((c) => c.kind === 'Aero' || c.kind === 'Suspension' || c.kind === 'Bodywork');
  const hasMechanical = components.some((c) => isMechanicalKind(c.kind));
  if (hasPhysical && !hasMechanical) return 'Full';
  if (components.length > 0) return 'Critical';
  return 'None';
}

export function damageComponentSummary(components: DamageComponent[]): string {
  if (components.length === 0) return 'No active damage';
  return components
    .map((c) => `${c.kind} ${c.severity}`)
    .join(' · ');
}

export function resolveReliabilityRecoveryOutcome(
  component: Pick<DamageComponent, 'kind' | 'severity' | 'managed'>,
  ratings: ReliabilityRecoveryRatings,
  roll: number,
): ReliabilityRecoveryOutcome {
  const ratingScore = clamp01(
    (ratings.carReliability +
      ratings.teamReliabilityDepartment +
      ratings.teamRaceOperations +
      ratings.driverEnduranceConsistency +
      ratings.driverComposure +
      ratings.driverRiskManagement) /
      600,
  );
  const severityWeight = severityRank(component.severity) / severityRank('terminal');
  const managedBonus = component.managed ? 0.08 : 0;
  const fullChance = clamp01(0.1 + ratingScore * 0.38 + managedBonus - severityWeight * 0.08);
  const partialChance = clamp01(0.18 + ratingScore * 0.22 - severityWeight * 0.05);
  const worseChance = clamp01(0.05 + severityWeight * 0.15 - ratingScore * 0.08);
  const noChangeChance = Math.max(0, 1 - fullChance - partialChance - worseChance);
  const r = clamp01(roll);
  if (r < fullChance) return 'full';
  if (r < fullChance + partialChance) return 'partial';
  if (r < fullChance + partialChance + noChangeChance) return 'none';
  return 'worse';
}

export function severityRankValue(severity: DamageComponentSeverity): number {
  return severityRank(severity);
}
