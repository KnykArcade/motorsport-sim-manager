import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { deleteSave, hasSave } from '../game/saveSystem';

export function Settings() {
  const { settings, setSettings } = useGame();
  const navigate = useNavigate();

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
