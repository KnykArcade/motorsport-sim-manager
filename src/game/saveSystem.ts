// localStorage-based save/load. A single active save slot for the MVP, plus a
// settings blob. Designed so a backend can replace this later.

import type { GameState } from './careerState';

const SAVE_KEY = 'msm:save:v1';
const SETTINGS_KEY = 'msm:settings:v1';

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
    return JSON.parse(raw) as GameState;
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
