import type { GameState } from '../../game/careerState';
import type { Driver } from '../../types/gameTypes';
import type { MarketSkillRatings } from '../../types/marketTypes';
import type { ScoutedEntityType, VisibleRating } from '../../types/scoutingTypes';
import { driverScoutTarget, fogView, type FogView, type ScoutTarget } from '../../sim/scoutingEngine';

export type RatingReadout = {
  label: string;
  value: number | null;
  range?: [number, number];
  exact: boolean;
};

export function formatVisibleRating(value: VisibleRating): string {
  if (value === 'Unknown') return '??';
  if (Array.isArray(value)) return `${value[0].toFixed(1)}-${value[1].toFixed(1)}`;
  return value.toFixed(1);
}

export function visibleRatingMidpoint(value: VisibleRating): number | null {
  if (value === 'Unknown') return null;
  if (Array.isArray(value)) return (value[0] + value[1]) / 2;
  return value;
}

export function rangeLabel(range: [number, number]): string {
  return `${range[0].toFixed(1)}-${range[1].toFixed(1)}`;
}

export function isPlayerSignedDriver(state: GameState, driver: Driver): boolean {
  return driver.teamId === state.selectedTeamId;
}

export function fogForTarget(state: GameState, target: ScoutTarget, entityType: ScoutedEntityType = 'Driver'): FogView | null {
  const scouting = state.scouting;
  if (!scouting) return null;
  return fogView(target, scouting.reports[target.id], scouting.networkAccuracy, state.randomSeed, entityType);
}

export function readoutForDriverRating(
  state: GameState,
  driver: Driver,
  key: keyof Driver['ratings'],
): RatingReadout {
  if (isPlayerSignedDriver(state, driver)) {
    const exact = driver.ratings[key];
    return { label: exact.toFixed(1), value: exact, exact: true };
  }
  const view = fogForTarget(state, driverScoutTarget(driver));
  if (!view) return broadReadout(driver.ratings[key]);
  if (key === 'overall') return { label: rangeLabel(view.potential.range), value: midpoint(view.potential.range), range: view.potential.range, exact: false };
  const visible = view.skills[driverRatingToMarketSkill(key)];
  return visibleReadout(visible);
}

export function readoutForMarketSkill(
  state: GameState,
  id: string,
  skills: MarketSkillRatings,
  potential: number,
  key: keyof MarketSkillRatings,
  entityType: ScoutedEntityType = 'Driver',
): RatingReadout {
  const view = fogForTarget(state, { id, skills, potential }, entityType);
  if (!view) return broadReadout(skills[key]);
  return visibleReadout(view.skills[key]);
}

export function readoutForMarketOverall(
  state: GameState,
  id: string,
  skills: MarketSkillRatings,
  potential: number,
  fallbackOverall: number,
  entityType: ScoutedEntityType = 'Driver',
): RatingReadout {
  const view = fogForTarget(state, { id, skills, potential }, entityType);
  if (!view) return broadReadout(fallbackOverall);
  const known = Object.values(view.skills).map(visibleRatingMidpoint).filter((v): v is number => v != null);
  if (known.length === 0) return { label: '??', value: null, exact: false };
  const avg = known.reduce((sum, v) => sum + v, 0) / known.length;
  const uncertainty = Math.max(0.4, (1 - view.accuracy) * 2.2);
  const range: [number, number] = [round1(clampRating(avg - uncertainty)), round1(clampRating(avg + uncertainty))];
  return { label: rangeLabel(range), value: midpoint(range), range, exact: false };
}

export function readoutForPotential(
  state: GameState,
  id: string,
  skills: MarketSkillRatings,
  potential: number,
  entityType: ScoutedEntityType = 'Driver',
): RatingReadout {
  const view = fogForTarget(state, { id, skills, potential }, entityType);
  if (!view) return broadReadout(potential);
  return { label: rangeLabel(view.potential.range), value: midpoint(view.potential.range), range: view.potential.range, exact: false };
}

function visibleReadout(value: VisibleRating): RatingReadout {
  if (value === 'Unknown') return { label: '??', value: null, exact: false };
  if (Array.isArray(value)) return { label: rangeLabel(value), value: midpoint(value), range: value, exact: false };
  return broadReadout(value);
}

function broadReadout(value: number): RatingReadout {
  const spread = 1.2;
  const range: [number, number] = [round1(clampRating(value - spread)), round1(clampRating(value + spread))];
  return { label: rangeLabel(range), value: midpoint(range), range, exact: false };
}

function driverRatingToMarketSkill(key: keyof Driver['ratings']): keyof MarketSkillRatings {
  if (key === 'overall') return 'cornering';
  if (key === 'qualifying' || key === 'racePace' || key === 'aggression' || key === 'composure') {
    return key === 'qualifying' ? 'technical' : key === 'racePace' ? 'enduranceConsistency' : key === 'aggression' ? 'overtakingRacecraft' : 'riskManagement';
  }
  return key as keyof MarketSkillRatings;
}

function midpoint(range: [number, number]): number {
  return (range[0] + range[1]) / 2;
}

function clampRating(n: number): number {
  return Math.max(1, Math.min(10, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
