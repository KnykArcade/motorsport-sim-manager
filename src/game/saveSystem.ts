// localStorage-based save/load. A single active save slot for the MVP, plus a
// settings blob. Designed so a backend can replace this later.

import type { GameState } from './careerState';

const SAVE_KEY = 'msm:save:v1';
const SETTINGS_KEY = 'msm:settings:v1';

// Bumped when the GameState shape gains fields that need migration. The Living
// Universe systems were all added as optional fields, so a v1 save loads under
// v2 unchanged; `migrateSave` backfills any defaults future phases require.
export const CURRENT_SAVE_VERSION = 2;

export type GameSettings = {
  debugMode: boolean;
};

export const defaultSettings: GameSettings = {
  debugMode: false,
};

// The persisted envelope: the game state plus the save-format version it was
// written with, so loads can be migrated forward. Older v1 saves were stored as
// a bare GameState (no version key); loadGame treats those as version 1.
type SaveEnvelope = { saveVersion: number; state: GameState };

// Bring a loaded state up to the current save version. All Living Universe
// systems are optional fields, so this is currently a structural passthrough;
// future phases add real backfills here keyed off `fromVersion`.
export function migrateSave(state: GameState, fromVersion: number): GameState {
  let migrated = state;
  if (fromVersion < 2) {
    // v1 -> v2: Living Universe systems introduced as optional fields. Nothing
    // to backfill (absence is the valid "not yet configured" state), but this
    // is where defaults would be seeded if a field becomes required.
    migrated = { ...migrated };
  }
  return migrated;
}

export function saveGame(state: GameState): void {
  const toStore: GameState = { ...state, updatedAt: new Date().toISOString() };
  const envelope: SaveEnvelope = {
    saveVersion: CURRENT_SAVE_VERSION,
    state: toStore,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
  } catch (err) {
    console.error('Failed to save game', err);
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveEnvelope | GameState;
    // New envelope format carries an explicit version; legacy saves are a bare
    // GameState and are treated as version 1.
    if (parsed && typeof parsed === 'object' && 'saveVersion' in parsed && 'state' in parsed) {
      const env = parsed as SaveEnvelope;
      return migrateSave(env.state, env.saveVersion);
    }
    return migrateSave(parsed as GameState, 1);
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
