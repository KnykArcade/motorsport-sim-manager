// localStorage-based save/load. A single active save slot for the MVP, plus a
// settings blob. The persisted format remains a bare GameState, but it now
// carries saveSchemaVersion and passes through a deterministic migration layer
// so older careers receive required subsystem defaults without losing history.

import type { GameState } from './careerState';
import type { DriverRelationship } from '../types/relationshipTypes';
import { ensureTeamResearchMap } from '../sim/rdEngine';
import { ensureTeamPartsMap } from '../sim/partsEngine';
import { ensurePhase18FoundationState } from '../sim/phase18FoundationEngine';
import { ensureContractClauses } from '../sim/phase18ContractClauseEngine';
import { ensurePreseasonHubState } from '../sim/phase18PreseasonEngine';
import { ensureFailureInvestigationState } from '../sim/phase18FailureInvestigationEngine';
import { ensureRivalRelationships } from '../sim/phase18RivalRelationshipEngine';
import { syncNarratives } from '../sim/phase18NarrativeEngine';
import { CURRENT_SAVE_SCHEMA_VERSION } from './saveSchema';
import { ensureCharacterInteractionState } from '../sim/characterInteractionEngine';

const SAVE_KEY = 'msm:save:v1';
const SETTINGS_KEY = 'msm:settings:v1';

function migrateRelationships(rels: Record<string, DriverRelationship>): Record<string, DriverRelationship> {
  const migrated: Record<string, DriverRelationship> = {};
  for (const [id, rel] of Object.entries(rels)) {
    migrated[id] = {
      ...rel,
      selfConfidence: rel.selfConfidence ?? 50,
      trustInCar: rel.trustInCar ?? 50,
      trustInTeam: rel.trustInTeam ?? 50,
      trustInPrincipal: rel.trustInPrincipal ?? 50,
      teamTrustInDriver: rel.teamTrustInDriver ?? 50,
      ego: rel.ego ?? 50,
      personalityTraits: rel.personalityTraits ?? [],
      wants: rel.wants ?? [],
    };
  }
  return migrated;
}

export function migrateGameState(state: GameState): GameState {
  const patched: Partial<GameState> = { ...state };
  if (patched.driverRelationships) {
    patched.driverRelationships = migrateRelationships(patched.driverRelationships);
  }
  if (!patched.driverPromises) {
    patched.driverPromises = [];
  }
  patched.teamResearch = ensureTeamResearchMap(
    patched.teamResearch,
    patched.teams ?? [],
    state.seasonYear,
  );
  patched.teamParts = ensureTeamPartsMap(
    patched.teamParts,
    patched.teams ?? [],
    patched.drivers ?? [],
    state.seasonYear,
  );
  patched.phase18 = ensurePhase18FoundationState(patched.phase18, {
    teams: patched.teams ?? [],
    selectedTeamId: patched.selectedTeamId ?? '',
    seasonYear: patched.seasonYear ?? state.seasonYear,
    principal: patched.principal,
    aiPrincipals: patched.aiPrincipals,
  });
  patched.characterInteractions = ensureCharacterInteractionState(patched.characterInteractions);
  patched.saveSchemaVersion = CURRENT_SAVE_SCHEMA_VERSION;
  return syncNarratives(ensureRivalRelationships(ensureFailureInvestigationState(ensurePreseasonHubState(ensureContractClauses(patched as GameState)))));
}

export type GameSettings = {
  debugMode: boolean;
  damageFrequency: number;
  damageSeverity: number;
  repairTimeMultiplier: number;
  reliabilityStrictness: number;
};

export const defaultSettings: GameSettings = {
  debugMode: false,
  damageFrequency: 1,
  damageSeverity: 1,
  repairTimeMultiplier: 1,
  reliabilityStrictness: 1,
};

export function saveGame(state: GameState): void {
  const toStore: GameState = {
    ...state,
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(toStore));
  } catch (err) {
    console.error('Failed to save game', err);
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    return migrateGameState(parsed);
  } catch (err) {
    console.error('Failed to load game', err);
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: GameSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
