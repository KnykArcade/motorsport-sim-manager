import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { loadSavedGame } from '../game/GameContext';
import { hasSave } from '../game/saveSystem';
import { initializeMasterRegistry } from '../data';
import { ensureMotorsportUniverse } from '../sim/motorsportUniverseEngine';
import { resumeDestination } from '../components/layoutWorkflow';
import { savedCareerSummary } from './entryRacePresentationViewModel';

export function MainMenu() {
  const navigate = useNavigate();
  const { dispatch } = useGame();
  const saveExists = hasSave();
  const [savedCareer] = useState(() => loadSavedGame());
  const careerSummary = savedCareer ? savedCareerSummary(savedCareer) : null;

  const onContinue = async () => {
    const saved = savedCareer ?? loadSavedGame();
    if (saved) {
      // Load full season data for the master registry (career market engine).
      await initializeMasterRegistry(saved.seasonYear, saved.series);
      dispatch({ type: 'LOAD_GAME', state: ensureMotorsportUniverse(saved) });
      navigate(resumeDestination(saved));
    }
  };

  return (
    <div className="ui-menu-shell min-h-screen px-4 py-6 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col">
        <header className="ui-menu-brand flex items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">Motorsport</div>
            <div className="mt-1 text-lg font-black tracking-tight text-neutral-50">History Manager</div>
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">Team Principal Simulation</div>
            <div className="mt-1 text-xs text-neutral-400">Build an alternate history, one decision at a time.</div>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <section className="ui-menu-command-copy flex min-h-0 flex-col justify-between">
            <div>
            <div className="ui-menu-kicker">The paddock is waiting</div>
            <h1 className="mt-3 max-w-2xl text-5xl font-black tracking-[-0.04em] text-neutral-50 sm:text-7xl">
              Run the whole paddock.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-neutral-400 sm:text-lg">
              Take control of a team, shape your organisation, and replay motorsport history
              across F1, IndyCar, CART, and NASCAR.
            </p>
            <div className="mt-8 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
              <span className="ui-menu-chip">37 F1 seasons</span>
              <span className="ui-menu-chip">19 IndyCar seasons</span>
              <span className="ui-menu-chip">Deterministic simulation</span>
            </div>
            </div>
            <div className="ui-menu-operating-note">
              <span>Manager command</span>
              <strong>Build the organisation, prepare each weekend, and call every race from the pit wall.</strong>
            </div>
          </section>

          <section className="ui-menu-actions flex min-h-0 flex-col">
            <div className="ui-menu-panel-label">Career command</div>
            <div className="mt-3 grid gap-2">
              <MenuButton primary onClick={() => navigate('/new')}>
                <span>New Game</span>
                <span className="text-xs opacity-70">Create a new motorsport universe</span>
              </MenuButton>
              <MenuButton onClick={onContinue} disabled={!saveExists}>
                <span>Continue</span>
                <span className="text-xs opacity-60">{careerSummary?.nextAction ?? 'No saved career available'}</span>
              </MenuButton>
            </div>
            <div className={`ui-menu-save-dossier mt-3 ${careerSummary ? '' : 'is-empty'}`}>
              <div className="ui-menu-save-heading">
                <span>Active save</span>
                <small>{careerSummary?.updated ?? 'No career stored'}</small>
              </div>
              {careerSummary ? (
                <div className="ui-menu-save-grid">
                  <SaveMetric label="Competition" value={careerSummary.title} />
                  <SaveMetric label="Team" value={careerSummary.team} />
                  <SaveMetric label="Current round" value={careerSummary.round} />
                  <SaveMetric label="Workflow" value={careerSummary.stage} />
                </div>
              ) : (
                <p>Start a new game to create the active career slot.</p>
              )}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <MenuButton compact onClick={() => navigate('/data')}>Data Viewer</MenuButton>
              <MenuButton compact onClick={() => navigate('/settings')}>Settings</MenuButton>
            </div>
            <div className="mt-5 border-t pt-4 text-xs leading-5 text-neutral-500">
              Your decisions affect race pace, morale, reputation, finances, development, and
              the behaviour of every rival team in the shared universe.
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-[10px] uppercase tracking-[0.12em] text-neutral-600">
          <span>Multi-series motorsport management</span>
          <span>Local save · No backend required</span>
        </footer>
      </div>
    </div>
  );
}

function SaveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  primary,
  disabled,
  compact,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`ui-menu-button flex w-full items-center justify-between gap-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${compact ? 'px-4 py-3 text-sm' : 'px-5 py-4 text-base'} ${
        primary
          ? 'ui-menu-button-primary'
          : 'ui-menu-button-secondary'
      }`}
    >
      {children}
    </button>
  );
}
