// localStorage-based save/load. A single active save slot for the MVP, plus a
// settings blob. Designed so a backend can replace this later.
//
// The persisted format is the bare GameState — there is no save-version envelope
// or migration layer. This is a prototype build: the data model is authoritative
// and saves written by an older build are not expected to load.

import type { GameState } from './careerState';
import type { DriverRelationship } from '../types/relationshipTypes';

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
      ego: rel.ego ?? 50,
      personalityTraits: rel.personalityTraits ?? [],
      wants: rel.wants ?? [],
    };
  }
  return migrated;
}

function migrateGameState(state: GameState): GameState {
  const patched: Partial<GameState> = { ...state };
  if (patched.driverRelationships) {
    patched.driverRelationships = migrateRelationships(patched.driverRelationships);
  }
  if (!patched.driverPromises) {
    patched.driverPromises = [];
  }
  return patched as GameState;
}

export type GameSettings = {
  debugMode: boolean;
};

export const defaultSettings: GameSettings = {
  debugMode: false,
};

export function saveGame(state: GameState): void {
  const toStore: GameState = { ...state, updatedAt: new Date().toISOString() };
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
