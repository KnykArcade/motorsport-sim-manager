import { useState } from 'react';
import { Button } from '../Button';
import { Panel } from '../Panel';
import { formatMoney } from '../ui';
import { activeDriversForTeam, teamById } from '../../game/careerState';
import { useGame } from '../../game/GameContext';
import {
  availableSpareParts,
  createInitialTeamPartsState,
  fittedPartsForDriver,
  latestPartDesign,
  manufacturingQuote,
  partConditionLabel,
  PART_SPECS,
  repairQuote,
  seriesPartLabel,
} from '../../sim/partsEngine';
import { createInitialTeamResearch } from '../../sim/rdEngine';
import { PART_TYPES, type CarPart, type PartType } from '../../types/partsTypes';

const CONDITION_TONES = {
  Fresh: 'bg-emerald-500 text-emerald-300',
  Good: 'bg-blue-500 text-blue-300',
  Worn: 'bg-amber-500 text-amber-300',
  Critical: 'bg-red-500 text-red-300',
} as const;

export function PartsInventoryPanel() {
  const { state, dispatch } = useGame();
  const [view, setView] = useState<'fitted' | 'manufacturing' | 'spares'>('fitted');
  const [selectedDriverId, setSelectedDriverId] = useState<string>();
  const [sparePage, setSparePage] = useState(0);
  if (!state) return null;
  const team = teamById(state, state.selectedTeamId);
  if (!team) return null;
  const drivers = activeDriversForTeam(state, team.id);
  const parts = state.teamParts?.[team.id]
    ?? createInitialTeamPartsState(team, state.drivers, state.seasonYear);
  const research = state.teamResearch?.[team.id]
    ?? createInitialTeamResearch(team.id, state.seasonYear);
  const currentRound = state.calendar[state.currentRaceIndex]?.round ?? state.currentRaceIndex + 1;
  const fittedCount = parts.inventory.filter((part) => part.status === 'fitted').length;
  const spareCount = parts.inventory.filter((part) => part.status === 'spare').length;
  const repairCount = parts.inventory.filter((part) => part.status === 'repairing').length;
  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId) ?? drivers[0];
  const spareAndRepairParts = parts.inventory
    .filter((part) => part.status === 'spare' || part.status === 'repairing')
    .sort((a, b) => PART_TYPES.indexOf(a.type) - PART_TYPES.indexOf(b.type) || b.condition - a.condition);
  const sparePageCount = Math.max(1, Math.ceil(spareAndRepairParts.length / 4));
  const safeSparePage = Math.min(sparePage, sparePageCount - 1);
  const visibleSpareParts = spareAndRepairParts.slice(safeSparePage * 4, safeSparePage * 4 + 4);

  return (
    <Panel title="Parts Inventory & Component Lifecycle">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Fitted Components" value={`${fittedCount}/${drivers.length * PART_TYPES.length}`} />
        <Metric label="Usable Spares" value={String(spareCount)} />
        <Metric label="Under Repair" value={String(repairCount)} />
        <Metric label="Factory Queue" value={`${parts.manufacturingQueue.length}/3`} />
      </div>

      <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/40 p-3 text-xs leading-5 text-neutral-400">
        Components are fitted to each driver's car. Wear now affects pace and mechanical risk; demanding tracks,
        crashes, and mechanical retirements accelerate damage. Completed R&D tiers define the specification of newly manufactured parts.
      </div>

      <nav className="mt-4 grid grid-cols-3 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/60 p-1" aria-label="Parts inventory sections">
        {([
          ['fitted', 'Fitted Components'],
          ['manufacturing', `Manufacturing (${parts.manufacturingQueue.length})`],
          ['spares', `Spares & Repairs (${spareAndRepairParts.length})`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-current={view === id ? 'page' : undefined}
            className={`rounded px-3 py-2 text-xs font-semibold ${view === id ? 'bg-amber-600 text-black' : 'text-neutral-400 hover:bg-neutral-800'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === 'fitted' && selectedDriver && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {drivers.map((driver) => (
              <button
                key={driver.id}
                type="button"
                onClick={() => setSelectedDriverId(driver.id)}
                aria-current={selectedDriver.id === driver.id ? 'page' : undefined}
                className={`rounded px-3 py-1.5 text-xs font-semibold ${selectedDriver.id === driver.id ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
              >
                {driver.name} · Car #{driver.number}
              </button>
            ))}
          </div>
          <div className="grid gap-4">
            {[selectedDriver].map((driver) => (
              <div key={driver.id} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral-100">{driver.name}</div>
                <div className="text-xs text-neutral-500">Car #{driver.number} fitted components</div>
              </div>
              <div className="text-xs text-neutral-500">
                {fittedPartsForDriver(parts, driver.id).length}/{PART_TYPES.length} fitted
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {PART_TYPES.map((type) => {
                const fitted = fittedPartsForDriver(parts, driver.id).find((part) => part.type === type);
                const bestSpare = availableSpareParts(parts, type)[0];
                return (
                  <FittedPartRow
                    key={type}
                    type={type}
                    label={seriesPartLabel(type, state.series)}
                    part={fitted}
                    spare={bestSpare}
                    onFit={() => bestSpare && dispatch({ type: 'FIT_PART', partId: bestSpare.id, driverId: driver.id })}
                  />
                );
              })}
            </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'manufacturing' && (
        <div className="mt-5">
          <div className="mb-3 text-sm font-semibold text-neutral-200">Factory Manufacturing</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {PART_TYPES.map((type) => {
            const quote = manufacturingQuote(parts, type, 1, research, state.seasonYear, currentRound);
            const design = latestPartDesign(type, research);
            const disabled = parts.manufacturingQueue.length >= 3 || team.budget < quote.cost;
            return (
              <div key={type} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                <div className="text-sm font-semibold text-neutral-100">{seriesPartLabel(type, state.series)}</div>
                <div className="mt-1 text-xs text-neutral-500">
                  {design.designGeneration > 0 ? `Generation ${design.designGeneration} specification` : 'Baseline specification'}
                </div>
                <div className="mt-3 space-y-1 text-xs text-neutral-400">
                  <div className="flex justify-between"><span>Cost</span><span>{formatMoney(quote.cost)}</span></div>
                  <div className="flex justify-between"><span>Build time</span><span>{quote.totalRounds} round{quote.totalRounds === 1 ? '' : 's'}</span></div>
                </div>
                <Button
                  className="mt-3 w-full"
                  disabled={disabled}
                  onClick={() => dispatch({ type: 'START_PART_MANUFACTURING', partType: type })}
                >
                  Manufacture
                </Button>
              </div>
            );
          })}
        </div>
          </div>
      )}

      {view === 'manufacturing' && parts.manufacturingQueue.length > 0 && (
        <div className="mt-5 rounded-lg border border-blue-900/70 bg-blue-950/20 p-3">
          <div className="mb-2 text-sm font-semibold text-blue-200">Active Factory Orders</div>
          <div className="space-y-2">
            {parts.manufacturingQueue.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-300">
                <span>{order.quantity}x {seriesPartLabel(order.type, state.series)} · Generation {order.designGeneration}</span>
                <span>{order.roundsRemaining}/{order.totalRounds} rounds remaining</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'spares' && (
        <div className="mt-5">
          <div className="mb-3 text-sm font-semibold text-neutral-200">Spares & Repairs</div>
          {spareAndRepairParts.length === 0 ? (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-4 text-sm text-neutral-500">
              No spare or repairing components.
            </div>
          ) : (
            <>
              <div className="grid gap-2 lg:grid-cols-2">
                {visibleSpareParts.map((part) => {
              const quote = repairQuote(part);
              const canRepair = part.status === 'spare' && part.condition < part.maximumCondition - 1 && team.budget >= quote.cost;
              return (
                <div key={part.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/30 p-3">
                  <div className="min-w-0">
                    <div className="text-sm text-neutral-100">{part.name}</div>
                    <div className="text-xs text-neutral-500">
                      {seriesPartLabel(part.type, state.series)} · Generation {part.designGeneration} · {part.racesUsed} races · {Math.round(part.condition)}%
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {part.status === 'repairing' ? (
                      <span className="rounded bg-amber-950/50 px-2 py-1 text-xs text-amber-300">
                        Repair: {part.repairRoundsRemaining} round{part.repairRoundsRemaining === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <>
                        <Button
                          disabled={!canRepair}
                          onClick={() => dispatch({ type: 'REPAIR_PART', partId: part.id })}
                        >
                          Repair {formatMoney(quote.cost)}
                        </Button>
                        <Button variant="danger" onClick={() => dispatch({ type: 'RETIRE_PART', partId: part.id })}>
                          Retire
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2">
                <Button variant="secondary" disabled={safeSparePage === 0} onClick={() => setSparePage(Math.max(0, safeSparePage - 1))}>
                  Previous
                </Button>
                <span className="text-xs text-neutral-500">
                  Components {safeSparePage * 4 + 1}–{Math.min(spareAndRepairParts.length, safeSparePage * 4 + 4)} of {spareAndRepairParts.length} · Page {safeSparePage + 1} of {sparePageCount}
                </span>
                <Button variant="secondary" disabled={safeSparePage >= sparePageCount - 1} onClick={() => setSparePage(Math.min(sparePageCount - 1, safeSparePage + 1))}>
                  Next
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

function FittedPartRow({
  type,
  label,
  part,
  spare,
  onFit,
}: {
  type: PartType;
  label: string;
  part?: CarPart;
  spare?: CarPart;
  onFit: () => void;
}) {
  if (!part) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-red-900/60 bg-red-950/20 p-3">
        <div><div className="text-sm text-red-200">{label}</div><div className="text-xs text-red-400">No component fitted</div></div>
        <Button disabled={!spare} onClick={onFit}>Fit spare</Button>
      </div>
    );
  }
  const conditionLabel = partConditionLabel(part.condition);
  const tone = CONDITION_TONES[conditionLabel];
  const shouldReplace = part.condition < 60 && spare && spare.condition > part.condition + 5;
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm text-neutral-100">{label} · {part.name}</div>
          <div className={`text-xs ${tone.split(' ')[1]}`}>{conditionLabel} · {Math.round(part.condition)}% · Generation {part.designGeneration}</div>
        </div>
        {spare && (
          <Button className="shrink-0" variant={shouldReplace ? 'primary' : 'ghost'} onClick={onFit}>
            Fit {Math.round(spare.condition)}% spare
          </Button>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-neutral-800">
        <div className={`h-full ${tone.split(' ')[0]}`} style={{ width: `${part.condition}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-neutral-600">{PART_SPECS[type].label} · {part.racesUsed} races used</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-neutral-100">{value}</div>
    </div>
  );
}
