import type { GameState } from '../game/careerState';
import type { PaddockEvent, PaddockEventCategory } from '../types/careerPhaseTypes';
import type {
  CharacterFutureIntent,
  CharacterFutureIntentStatus,
  CharacterInteractionTarget,
  CharacterStabilityProfile,
} from '../types/characterInteractionTypes';
import { ensureCharacterBreakingPoints, refreshCharacterStability } from './characterBreakingPointEngine';
import { characterOpinionKey, currentCharacterTargets } from './characterOpinionEngine';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundOf(state: GameState): number {
  return state.careerPhase?.currentRound ?? state.currentRaceIndex + 1;
}

function statusFor(profile: CharacterStabilityProfile): CharacterFutureIntentStatus {
  if (profile.score >= 65) return 'Committed';
  if (profile.score >= 45) return 'OpenToTalk';
  if (profile.score >= 25) return 'TestingMarket';
  return 'WantsExit';
}

function modifierFor(status: CharacterFutureIntentStatus): number {
  if (status === 'Committed') return 8;
  if (status === 'TestingMarket') return -10;
  if (status === 'WantsExit') return -22;
  return 0;
}

export function characterFutureIntentLabel(target: CharacterInteractionTarget, status: CharacterFutureIntentStatus): string {
  if (target.type === 'Owner') {
    if (status === 'Committed') return 'Firmly backing you';
    if (status === 'OpenToTalk') return 'Reviewing the direction';
    if (status === 'TestingMarket') return 'Exploring alternatives';
    return 'Preparing a replacement';
  }
  if (target.type === 'RivalPrincipal') {
    if (status === 'Committed') return 'Committed to cooperation';
    if (status === 'OpenToTalk') return 'Keeping talks open';
    if (status === 'TestingMarket') return 'Withholding cooperation';
    return 'Seeking confrontation';
  }
  if (target.type === 'Driver') {
    if (status === 'Committed') return 'Committed to the team';
    if (status === 'OpenToTalk') return 'Open to renewal talks';
    if (status === 'TestingMarket') return 'Testing the driver market';
    return 'Wants to leave';
  }
  if (status === 'Committed') return 'Committed to the project';
  if (status === 'OpenToTalk') return 'Open to future talks';
  if (status === 'TestingMarket') return 'Listening to outside offers';
  return 'Wants to leave';
}

function reasonFor(target: CharacterInteractionTarget, status: CharacterFutureIntentStatus, profile: CharacterStabilityProfile): string {
  const pressure = profile.reasons[0]?.toLowerCase() ?? 'the current relationship outlook';
  if (status === 'Committed') return `${target.name} sees enough stability to remain invested in the current project.`;
  if (status === 'OpenToTalk') return `${target.name} remains reachable, but expects clarity around ${pressure}.`;
  if (status === 'TestingMarket') return `${target.name} is considering alternatives because of ${pressure}.`;
  return `${target.name} no longer sees the current relationship as sustainable because of ${pressure}.`;
}

function calculateIntent(state: GameState, profile: CharacterStabilityProfile, prior?: CharacterFutureIntent): CharacterFutureIntent {
  const influence = state.characterInteractions!.influence.find((entry) => characterOpinionKey(entry.target) === characterOpinionKey(profile.target));
  const status = statusFor(profile);
  const leverage = clamp((influence?.power ?? 40) * 0.6 + (100 - profile.score) * 0.4);
  return {
    target: profile.target,
    status,
    leverage,
    reason: reasonFor(profile.target, status, profile),
    negotiationModifier: modifierFor(status),
    lastReportedStatus: prior?.status ?? status,
    lastUpdatedSeason: state.seasonYear,
    lastUpdatedRound: roundOf(state),
  };
}

export function ensureCharacterFutureIntentions(state: GameState): GameState {
  const seeded = ensureCharacterBreakingPoints(state);
  const current = seeded.characterInteractions!;
  const prior = new Map((current.futureIntentions ?? []).map((entry) => [characterOpinionKey(entry.target), entry]));
  const futureIntentions = currentCharacterTargets(seeded).map((target) => {
    const profile = current.stability.find((entry) => characterOpinionKey(entry.target) === characterOpinionKey(target))!;
    return prior.get(characterOpinionKey(target)) ?? calculateIntent(seeded, profile);
  });
  return { ...seeded, characterInteractions: { ...current, futureIntentions } };
}

export function refreshCharacterFutureIntentions(state: GameState): GameState {
  const stable = refreshCharacterStability(state);
  const seeded = ensureCharacterFutureIntentions(stable);
  const prior = new Map(seeded.characterInteractions!.futureIntentions.map((entry) => [characterOpinionKey(entry.target), entry]));
  const futureIntentions = seeded.characterInteractions!.stability.map((profile) => calculateIntent(seeded, profile, prior.get(characterOpinionKey(profile.target))));
  return { ...seeded, characterInteractions: { ...seeded.characterInteractions!, futureIntentions } };
}

function eventCategory(target: CharacterInteractionTarget): PaddockEventCategory {
  if (target.type === 'Driver') return 'driver_morale';
  if (target.type === 'Staff') return 'staff';
  if (target.type === 'Owner') return 'finance';
  return 'regulation';
}

export function generateCharacterFutureIntentEvents(state: GameState): PaddockEvent[] {
  const round = roundOf(state);
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  return (state.characterInteractions?.futureIntentions ?? [])
    .filter((entry) => entry.status !== entry.lastReportedStatus)
    .sort((a, b) => b.leverage - a.leverage || a.target.id.localeCompare(b.target.id))
    .slice(0, 4)
    .map((entry) => ({
      id: `pe-${weekId}-future-intent-${entry.target.type}-${entry.target.id}-${entry.status}`,
      weekId,
      season: state.seasonYear,
      series: state.series,
      round,
      category: eventCategory(entry.target),
      title: `${entry.target.name}: ${characterFutureIntentLabel(entry.target, entry.status)}`,
      description: `${entry.reason} Their future intention moved from ${characterFutureIntentLabel(entry.target, entry.lastReportedStatus).toLowerCase()} to ${characterFutureIntentLabel(entry.target, entry.status).toLowerCase()}.`,
      severity: entry.status === 'WantsExit' ? 'major' as const : entry.status === 'TestingMarket' ? 'minor' as const : 'info' as const,
      isRequiredDecision: false,
      effectsApplied: true,
      createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
    }));
}

export function generateExpiringDriverContractEvents(state: GameState): PaddockEvent[] {
  if (state.gameMode === 'SingleSeason') return [];
  const round = roundOf(state);
  const racesRemaining = Math.max(0, state.calendar.length - state.currentRaceIndex);
  if (racesRemaining > 3) return [];
  const weekId = state.careerPhase?.paddockWeekId ?? `pw-${state.seasonYear}-${round}`;
  return state.drivers
    .filter((driver) => driver.teamId === state.selectedTeamId && (driver.contractYearsRemaining ?? 1) <= 1)
    .map((driver) => {
      const intent = state.characterInteractions?.futureIntentions.find((entry) => entry.target.type === 'Driver' && entry.target.id === driver.id);
      const intentLabel = intent ? characterFutureIntentLabel(intent.target, intent.status) : 'Future undecided';
      return {
        id: `pe-${weekId}-expiring-contract-${driver.id}`,
        weekId,
        season: state.seasonYear,
        series: state.series,
        round,
        category: 'driver_morale' as const,
        title: `Contract decision required soon: ${driver.name}`,
        description: `${driver.name}'s deal expires at season rollover. Current intention: ${intentLabel}. Extend the contract before the season ends or prepare a replacement.`,
        severity: intent?.status === 'WantsExit' ? 'major' as const : 'minor' as const,
        isRequiredDecision: false,
        effectsApplied: true,
        createdAt: new Date(Date.UTC(state.seasonYear, 0, Math.max(1, round + 1))).toISOString(),
      };
    });
}

export function futureIntentForTarget(state: GameState, target: CharacterInteractionTarget): CharacterFutureIntent | undefined {
  return state.characterInteractions?.futureIntentions.find((entry) => characterOpinionKey(entry.target) === characterOpinionKey(target));
}

export function atRiskFutureIntentions(state: GameState): CharacterFutureIntent[] {
  return (state.characterInteractions?.futureIntentions ?? [])
    .filter((entry) => entry.status === 'TestingMarket' || entry.status === 'WantsExit')
    .sort((a, b) => b.leverage - a.leverage || a.target.id.localeCompare(b.target.id));
}

export function driverFutureIntentContractModifier(state: GameState, driverId: string): number {
  return state.characterInteractions?.futureIntentions.find((entry) => entry.target.type === 'Driver' && entry.target.id === driverId)?.negotiationModifier ?? 0;
}
