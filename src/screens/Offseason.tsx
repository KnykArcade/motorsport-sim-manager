import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';

export function Offseason() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  if (!state) return null;

  const nextYear = state.seasonYear + 1;
  const signings = state.pendingSignings ?? [];
  const academy = state.academy ?? [];
  const driverName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;

  const advance = () => {
    dispatch({ type: 'ADVANCE_SEASON' });
    navigate('/hq');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Offseason</h1>
          <p className="text-sm text-neutral-400">
            Prepare for {nextYear}. Confirm your driver line-up, then advance the season.
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>Main Menu</Button>
      </div>

      <Panel title={`Driver Line-up for ${nextYear}`}>
        {signings.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No seat changes queued — you keep your current drivers. Visit the{' '}
            <button className="text-amber-400 hover:underline" onClick={() => navigate('/market')}>
              Driver Market
            </button>{' '}
            to sign a new driver or promote an academy talent.
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {signings.map((s) => (
              <li key={s.seatDriverId} className="flex items-center justify-between">
                <span className="text-neutral-200">
                  <span className="font-semibold">{s.name}</span>{' '}
                  <span className="text-neutral-500">replaces {driverName(s.seatDriverId)}</span>
                  {s.source === 'academy' && (
                    <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300">
                      academy promotion
                    </span>
                  )}
                </span>
                <button
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => dispatch({ type: 'RELEASE_SIGNING', seatDriverId: s.seatDriverId })}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Academy (${academy.length})`}>
        {academy.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No academy drivers. Sign youth prospects in the Driver Market — they develop each
            offseason toward F1-readiness.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {academy.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-neutral-300">
                <span>
                  {a.name}{' '}
                  <span className="text-neutral-500">
                    ({a.overall.toFixed(1)} → {a.potential.toFixed(1)} pot)
                  </span>
                </span>
                <span className="text-xs text-neutral-500">
                  {a.yearsUntilF1Ready <= 0 ? 'F1-ready' : `~${a.yearsUntilF1Ready}y to F1`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-neutral-500">
          Academy drivers gain ratings when you advance the season.
        </p>
      </Panel>

      <Panel title="Advance the Season">
        <p className="text-sm text-neutral-300">
          Advancing rolls the team into {nextYear}: queued signings take their seats, academy drivers
          develop, your car's progress carries over, and a fresh championship begins.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary" onClick={advance} disabled={!state.seasonComplete}>
            Advance to {nextYear} Season →
          </Button>
          {!state.seasonComplete && (
            <span className="self-center text-xs text-neutral-500">
              Finish the current season first.
            </span>
          )}
        </div>
      </Panel>

      <Panel title="Coming in Later Phases">
        <p className="text-sm text-neutral-400">
          Budget allocation, regulation changes, staff decisions, new car design and AI driver-market
          activity arrive with the management systems (Phase D) and multi-year data (Phase E).
        </p>
      </Panel>
    </div>
  );
}
