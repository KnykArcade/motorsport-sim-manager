// React context bridging the pure reducer to the UI, with autosave.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

import { gameReducer, type GameAction } from './gameReducer';
import type { GameState } from './careerState';
import {
  loadGame,
  loadSettings,
  saveGame,
  saveSettings,
  type GameSettings,
} from './saveSystem';

type GameContextValue = {
  state: GameState | null;
  dispatch: (action: GameAction) => void;
  settings: GameSettings;
  setSettings: (settings: GameSettings) => void;
  saveNow: () => void;
};

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, null);
  const [settings, setSettingsState] = useState<GameSettings>(() => loadSettings());

  // Autosave whenever state changes.
  useEffect(() => {
    if (state) saveGame(state);
  }, [state]);

  const setSettings = useCallback((next: GameSettings) => {
    setSettingsState(next);
    saveSettings(next);
  }, []);

  const saveNow = useCallback(() => {
    if (state) saveGame(state);
  }, [state]);

  const value = useMemo(
    () => ({ state, dispatch, settings, setSettings, saveNow }),
    [state, settings, setSettings, saveNow],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components
export function loadSavedGame(): GameState | null {
  return loadGame();
}
