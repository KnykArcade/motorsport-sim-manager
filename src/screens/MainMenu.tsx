import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { loadSavedGame } from '../game/GameContext';
import { hasSave } from '../game/saveSystem';
import { initializeMasterRegistry } from '../data';
import { ensureMotorsportUniverse } from '../sim/motorsportUniverseEngine';

export function MainMenu() {
  const navigate = useNavigate();
  const { dispatch } = useGame();
  const saveExists = hasSave();

  const onContinue = async () => {
    const saved = loadSavedGame();
    if (saved) {
      // Load full season data for the master registry (career market engine).
      await initializeMasterRegistry(saved.seasonYear, saved.series);
      dispatch({ type: 'LOAD_GAME', state: ensureMotorsportUniverse(saved) });
      navigate('/hq');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0c10] px-4">
      <div className="mb-12 text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">Motorsport</div>
        <h1 className="mt-1 text-5xl font-black tracking-tight text-neutral-50">History Manager</h1>
        <p className="mt-3 max-w-md text-neutral-400">
          A team principal simulation. Pick a season, replay it, and build your own
          alternate history — season after season, series after series.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <MenuButton primary onClick={() => navigate('/new')}>
          New Game
        </MenuButton>
        <MenuButton onClick={onContinue} disabled={!saveExists}>
          Continue {saveExists ? '' : '(no save)'}
        </MenuButton>
        <MenuButton onClick={() => navigate('/data')}>Data Viewer</MenuButton>
        <MenuButton onClick={() => navigate('/settings')}>Settings</MenuButton>
      </div>

      <p className="mt-12 text-xs text-neutral-600">Multi-series motorsport management · Deterministic simulation</p>
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-lg px-5 py-3.5 text-left text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? 'bg-amber-500 text-neutral-950 hover:bg-amber-400'
          : 'border border-neutral-800 bg-neutral-900/60 text-neutral-200 hover:border-neutral-700 hover:bg-neutral-800/60'
      }`}
    >
      {children}
    </button>
  );
}
