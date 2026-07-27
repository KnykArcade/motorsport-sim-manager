import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import type { WeekendPlanBoard as WeekendPlanBoardModel } from './weekendPlanBoardViewModel';
import type { RaceWeekendPhase } from './raceTransitionViewModel';

export function WeekendPlanBoard({
  board,
  onEdit,
  onConfirm,
}: {
  board: WeekendPlanBoardModel;
  onEdit: (phase: RaceWeekendPhase) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4">
      <Panel
        title={board.title}
        actions={(
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={!board.canConfirm}
            title={board.blockedReason ?? 'Confirm the final plan and start the live race'}
          >
            Confirm Plan &amp; Start Race →
          </Button>
        )}
      >
        <p className={board.canConfirm ? 'text-sm text-neutral-300' : 'text-sm text-orange-300'}>
          {board.summary}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {board.preparation.map((item) => {
            const content = (
              <>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{item.label}</div>
              <div className="mt-1 text-sm font-semibold text-neutral-100">{item.value}</div>
              <div className="mt-1 text-[11px] text-neutral-500">{item.detail}</div>
              {item.reviewPhase && <div className="mt-2 text-[10px] font-semibold uppercase text-sky-300">Open source stage →</div>}
              </>
            );
            return item.reviewPhase ? (
              <button
                key={item.label}
                type="button"
                onClick={() => onEdit(item.reviewPhase as RaceWeekendPhase)}
                className="rounded border border-neutral-800 bg-neutral-950/35 p-3 text-left hover:border-neutral-600"
              >
                {content}
              </button>
            ) : (
              <div key={item.label} className="rounded border border-neutral-800 bg-neutral-950/35 p-3">
                {content}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Confirmed Race Entries">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-neutral-800 text-[10px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-2 py-2">Driver</th>
                <th className="px-2 py-2">Grid</th>
                <th className="px-2 py-2">Qualifying</th>
                <th className="px-2 py-2">Setup comfort</th>
                <th className="px-2 py-2">Parc fermé</th>
                <th className="px-2 py-2">Race strategy</th>
                <th className="px-2 py-2">Instruction</th>
              </tr>
            </thead>
            <tbody>
              {board.drivers.map((driver) => (
                <tr key={driver.driverId} className="border-b border-neutral-900 text-neutral-300">
                  <td className="px-2 py-3 font-semibold text-neutral-100">{driver.driverName}</td>
                  <td className="px-2 py-3">{driver.grid}</td>
                  <td className="px-2 py-3">{driver.qualifyingPlan}</td>
                  <td className="px-2 py-3">{driver.setupConfidence}%</td>
                  <td className="px-2 py-3">{driver.parcFerme}</td>
                  <td className="px-2 py-3">{driver.raceStrategy}</td>
                  <td className="px-2 py-3">{driver.instruction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => onEdit('quali-review')}>Review Grid</Button>
          <Button variant="ghost" onClick={() => onEdit('setup')}>Review Setups</Button>
          <Button variant="ghost" onClick={() => onEdit('race-strategy')}>Edit Strategies</Button>
          <Button variant="ghost" onClick={() => onEdit('race-instructions')}>Edit Instructions</Button>
        </div>
      </Panel>

      {(board.reserveDecision || board.warnings.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {board.reserveDecision && (
            <Panel title={board.reserveDecision.label}>
              <p className={board.reserveDecision.required ? 'text-sm text-orange-300' : 'text-sm text-neutral-300'}>
                {board.reserveDecision.detail}
              </p>
            </Panel>
          )}
          {board.warnings.length > 0 && (
            <Panel title={`Unresolved Warnings · ${board.warnings.length}`}>
              <ul className="space-y-2">
                {board.warnings.map((warning) => (
                  <li key={warning} className="rounded border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-xs text-orange-200">
                    {warning}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
