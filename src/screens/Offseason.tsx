import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';

// Offseason placeholder. The data models (OffseasonBudgetPlan, RegulationSet,
// carryover) exist and the carryover/regulation engines are implemented; the
// deep interactive offseason UI is a future milestone.
const PHASES = [
  'Season Review',
  'Prize Money / Sponsor Review',
  'Driver Contract Decisions',
  'Staff Decisions',
  'Regulation Change Announcement',
  'New Car Design',
  'Budget Allocation',
  'Research & Development Planning',
  'Testing Program',
  'Preseason Expectations',
  'Advance to Next Season',
];

export function Offseason() {
  const { state } = useGame();
  const navigate = useNavigate();
  if (!state) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-100">Offseason</h1>
        <Button variant="ghost" onClick={() => navigate('/')}>Main Menu</Button>
      </div>

      <Panel title="Multi-Season Progression — Coming Soon">
        <p className="text-sm text-neutral-300">
          The full offseason flow (budget allocation, regulation changes, driver market, and
          development carryover into a generated next season) is designed and partially implemented
          in the simulation layer. The interactive offseason UI is the next milestone.
        </p>
        <p className="mt-3 text-sm text-neutral-400">
          Under the hood, the game already supports: development horizons & carryover rates, a
          regulation model with carryover modifiers, and an offseason carryover function that
          produces next season's car baseline.
        </p>
      </Panel>

      <Panel title="Planned Offseason Phases">
        <ol className="space-y-1.5">
          {PHASES.map((p, i) => (
            <li key={p} className="flex items-center gap-3 text-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-xs font-bold text-neutral-400">
                {i + 1}
              </span>
              <span className="text-neutral-300">{p}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
