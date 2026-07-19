import type { GameState } from '../game/careerState';
import type { DepartmentId, DepartmentMood } from '../types/phase18Types';

const PREPARATION_DEPARTMENTS: readonly DepartmentId[] = [
  'Technical',
  'Engineering',
  'RaceOperations',
  'DriverManagement',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 50;
}

function departmentExecutionScore(mood: DepartmentMood): number {
  const relationshipHealth = average([
    mood.morale,
    mood.trustInPrincipal,
    mood.strategicAlignment,
  ]);
  const overloadPenalty = Math.max(0, mood.workload - 60) * 0.5;
  return clamp(relationshipHealth - overloadPenalty, 0, 100);
}

export function departmentPreparationMultiplierFromMoods(
  departments: Record<DepartmentId, DepartmentMood> | undefined,
): number {
  if (!departments) return 1;
  const execution = average(PREPARATION_DEPARTMENTS.map((departmentId) =>
    departmentExecutionScore(departments[departmentId])));
  return Math.round(clamp(1 + (execution - 50) / 1_000, 0.96, 1.04) * 1_000) / 1_000;
}

export function departmentPreparationMultiplier(
  state: Pick<GameState, 'phase18' | 'selectedTeamId'>,
): number {
  return departmentPreparationMultiplierFromMoods(
    state.phase18?.departmentMoods[state.selectedTeamId],
  );
}

export function signedRelationshipEffectPercent(multiplier: number): string {
  const percent = Math.round((multiplier - 1) * 1_000) / 10;
  if (percent === 0) return 'Neutral';
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
}
