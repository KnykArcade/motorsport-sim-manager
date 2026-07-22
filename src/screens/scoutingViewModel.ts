import type { FogView } from '../sim/scoutingEngine';
import { effectiveAccuracy } from '../sim/scoutingEngine';
import type { ScoutedEntityType, ScoutingReport, ScoutingTargetReference } from '../types/scoutingTypes';

export type ScoutingAbilitySummary = {
  currentRange?: [number, number];
  currentStars?: [number, number];
  potentialRange: [number, number];
  potentialStars: [number, number];
  knowledgePercentage: number;
};

export type ScoutingAssignment = {
  entityId: string;
  name: string;
  entityType: ScoutedEntityType;
  scoutingLevel: number;
  knowledgePercentage: number;
  freshness: 'Fresh' | 'Current' | 'Stale';
};

export function scoutingReportFreshness(lastUpdated: string, seasonYear: number, round: number): 'Fresh' | 'Current' | 'Stale' {
  const updated = Date.parse(lastUpdated);
  if (!Number.isFinite(updated)) return 'Stale';
  const current = Date.UTC(seasonYear, 0, Math.max(1, round));
  const ageInRounds = Math.max(0, Math.round((current - updated) / 86_400_000));
  return ageInRounds <= 2 ? 'Fresh' : ageInRounds <= 6 ? 'Current' : 'Stale';
}

export type ScoutingComparisonTarget = {
  entityId: string;
  name: string;
  entityType: ScoutedEntityType;
  view: FogView;
};

export type ScoutingComparisonRow = Omit<ScoutingComparisonTarget, 'view'> & ScoutingAbilitySummary;

function stars(rating: number): number {
  return Math.max(0.5, Math.min(5, Math.round((rating / 20) * 2) / 2));
}

export function scoutingAbilitySummary(view: FogView): ScoutingAbilitySummary {
  const ratings = Object.values(view.skills).filter((value): value is number | [number, number] => value !== 'Unknown');
  let currentRange: [number, number] | undefined;
  if (ratings.length > 0) {
    const lows = ratings.map((value) => Array.isArray(value) ? value[0] : value);
    const highs = ratings.map((value) => Array.isArray(value) ? value[1] : value);
    const lowAverage = lows.reduce((sum, value) => sum + value, 0) / lows.length;
    const highAverage = highs.reduce((sum, value) => sum + value, 0) / highs.length;
    const uncertainty = Math.max(4, (1 - view.accuracy) * 22);
    currentRange = [Math.max(1, lowAverage - uncertainty), Math.min(100, highAverage + uncertainty)];
  }
  return {
    currentRange,
    currentStars: currentRange ? [stars(currentRange[0]), stars(currentRange[1])] : undefined,
    potentialRange: view.potential.range,
    potentialStars: [stars(view.potential.range[0]), stars(view.potential.range[1])],
    knowledgePercentage: Math.round(view.accuracy * 100),
  };
}

export function scoutingAssignments(
  reports: Record<string, ScoutingReport>,
  networkAccuracy: number,
  names: Record<string, string>,
  entityType?: ScoutedEntityType,
  activeAssignments?: readonly ScoutingTargetReference[],
  seasonYear?: number,
  round = 1,
): ScoutingAssignment[] {
  return Object.values(reports)
    .filter((report) => report.scoutingLevel < 100
      && (!entityType || report.entityType === entityType)
      && (!activeAssignments || activeAssignments.some(
        (entry) => entry.entityId === report.entityId && entry.entityType === report.entityType,
      )))
    .map((report) => ({
      entityId: report.entityId,
      name: names[report.entityId] ?? report.entityId,
      entityType: report.entityType,
      scoutingLevel: report.scoutingLevel,
      knowledgePercentage: Math.round(effectiveAccuracy(report.scoutingLevel, networkAccuracy) * 100),
      freshness: seasonYear == null ? 'Current' : scoutingReportFreshness(report.lastUpdated, seasonYear, round),
    }))
    .sort((a, b) => b.scoutingLevel - a.scoutingLevel || a.name.localeCompare(b.name));
}

export function scoutingComparison(targets: readonly ScoutingComparisonTarget[]): ScoutingComparisonRow[] {
  return targets.slice(0, 3).map(({ view, ...target }) => ({
    ...target,
    ...scoutingAbilitySummary(view),
  }));
}
