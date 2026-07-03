import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { deleteSave, hasSave } from '../game/saveSystem';

export function Settings() {
  const { state, dispatch, settings, setSettings } = useGame();
  const navigate = useNavigate();

  const mobilityMode = state?.careerMobilityMode ?? 'StandardCareer';

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-100">Settings</h1>
        <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
      </div>

      <Panel title="Gameplay">
        <label className="flex items-center justify-between">
          <div>
            <div className="font-medium text-neutral-100">Debug / Developer Mode</div>
            <div className="text-xs text-neutral-500">
              Show simulation score breakdowns (track fit, setup fit, risks, variance) in the race weekend.
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.debugMode}
            onChange={(e) => setSettings({ ...settings, debugMode: e.target.checked })}
            className="h-5 w-5 accent-amber-500"
          />
        </label>
      </Panel>

      {state && (
        <Panel title="Career Mobility">
          <div className="space-y-3">
            <div className="text-xs text-neutral-500">
              Controls whether you can be fired or forced to move teams during your career.
            </div>
            <div className="space-y-2">
              {([
                { mode: 'StandardCareer', label: 'Standard Career', desc: 'You can be fired for poor performance or financial distress. Other teams may approach you with job offers.' },
                { mode: 'TeamLock', label: 'Team Lock', desc: 'You cannot be fired from your current team. Voluntary job moves are still allowed.' },
                { mode: 'Sandbox', label: 'Sandbox', desc: 'No firing, no pressure. Pure management freedom.' },
              ] as const).map(({ mode, label, desc }) => (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    mobilityMode === mode
                      ? 'border-blue-600 bg-blue-900/20'
                      : 'border-neutral-800 hover:bg-neutral-900/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="mobility"
                    checked={mobilityMode === mode}
                    onChange={() => dispatch({ type: 'SET_CAREER_MOBILITY', mode })}
                    className="mt-1 accent-blue-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-neutral-100">{label}</div>
                    <div className="text-xs text-neutral-500">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Save Data">
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-400">
            {hasSave() ? 'A save exists in this browser.' : 'No save found.'}
          </div>
          <Button
            variant="danger"
            disabled={!hasSave()}
            onClick={() => {
              if (confirm('Delete your save permanently?')) {
                deleteSave();
                navigate('/');
              }
            }}
          >
            Delete Save
          </Button>
        </div>
      </Panel>
    </div>
  );
}
