import { useGame } from '../game/GameContext';
import { teamById } from '../game/careerState';
import {
  ENGINE_DEAL_SPECS,
  availableEngineOffers,
  engineSwitchFee,
  type EngineOffer,
} from '../sim/engineSupplierEngine';
import { toMoney } from '../sim/financeEngine';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import type { EngineState, EngineSupplierDeal } from '../types/engineTypes';

function signed(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;
}

export function EngineSupplier() {
  const { state, dispatch } = useGame();
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const engine = state.engine;

  if (!engine || !team) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-neutral-100">Engine Supplier</h1>
        <Panel title="Engine Supplier">
          <p className="text-sm text-neutral-400">Engine deals are available in Career Mode.</p>
        </Panel>
      </div>
    );
  }

  const current = engine.currentDeal;
  const pending = engine.pendingDeal;
  const budget = team.budget;
  const inPreseasonSetup = state.careerPhase?.currentPhase === 'pre_season_setup';
  const offers = availableEngineOffers(engine, team);
  const bySupplier = new Map<string, EngineOffer[]>();
  for (const o of offers) {
    const list = bySupplier.get(o.supplier.name) ?? [];
    list.push(o);
    bySupplier.set(o.supplier.name, list);
  }

  const isCurrent = (o: EngineOffer) =>
    current?.supplierName === o.supplier.name && current?.dealType === o.dealType;
  const isPending = (o: EngineOffer) =>
    pending?.supplierName === o.supplier.name && pending?.dealType === o.dealType;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Engine Supplier</h1>
        <p className="text-sm text-neutral-400">
          Your engine deal shapes power, reliability, upgrade cadence and political influence.
          Negotiating a new deal takes effect next season; the annual cost is billed at the rollover.
        </p>
      </div>

      <Panel title="Current Deal">
        {current ? <DealSummary deal={current} /> : <p className="text-sm text-neutral-400">No active deal.</p>}
        {pending && (
          <p className="mt-3 rounded-md bg-sky-950/40 px-3 py-2 text-xs text-sky-300">
            Signed for next season: {ENGINE_DEAL_SPECS[pending.dealType].label} with {pending.supplierName}
            {' '}(${pending.annualCost}M/yr)
            {engine.pendingDealFee ? ` · $${engine.pendingDealFee}M switch fee paid` : ''}.
            {' '}Cancel by re-signing your current deal{engine.pendingDealFee ? ' (fee refunded)' : ''}.
          </p>
        )}
      </Panel>

      <ManufacturerPanel engine={engine} />

      <Panel title="Negotiate">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...bySupplier.entries()].map(([supplierName, list]) => (
            <div key={supplierName} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-neutral-100">{supplierName}</span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                  Pwr {list[0].supplier.basePower} · Rel {list[0].supplier.baseReliability}
                </span>
              </div>
              <div className="space-y-2">
                {list.map((o) => {
                  const cur = isCurrent(o);
                  const pend = isPending(o);
                  const fee = inPreseasonSetup ? 0 : engineSwitchFee(current, o);
                  const affordable = toMoney(fee) <= budget + toMoney(engine.pendingDealFee ?? 0);
                  return (
                    <div key={o.dealType} className="rounded-md border border-neutral-800/80 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-neutral-200">
                          {ENGINE_DEAL_SPECS[o.dealType].label}
                        </span>
                        <span className="text-xs font-semibold text-amber-300">${o.annualCost}M/yr</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                        <Tag>Power {signed(o.bonus.power)}</Tag>
                        <Tag>Reliability {signed(o.bonus.reliability)}</Tag>
                        <Tag>{o.upgradeFrequency} upgrades/yr</Tag>
                        <Tag>Influence {o.politicalInfluence}</Tag>
                      </div>
                      <div className="mt-2">
                        {cur ? (
                          <div className="text-center text-[11px] text-green-400">Current deal</div>
                        ) : pend ? (
                          <div className="text-center text-[11px] text-sky-300">Signed for next season</div>
                        ) : (
                          <>
                            <Button
                              variant="primary"
                              className="w-full px-2 py-1 text-xs"
                              disabled={!affordable}
                              onClick={() =>
                                dispatch({ type: 'SIGN_ENGINE_DEAL', supplierId: o.supplier.id, dealType: o.dealType })
                              }
                            >
                              {fee > 0 ? `Sign - $${fee}M buyout` : 'Select for season'}
                            </Button>
                            {!affordable && (
                              <div className="mt-1 text-center text-[10px] text-red-400">Insufficient budget</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function DealSummary({ deal }: { deal: EngineSupplierDeal }) {
  const spec = ENGINE_DEAL_SPECS[deal.dealType];
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-neutral-100">{deal.supplierName}</div>
          <div className="text-sm text-amber-400">{spec.label}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-neutral-100">${deal.annualCost}M</div>
          <div className="text-xs text-neutral-500">per year</div>
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">{spec.description}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Engine Power" value={deal.powerRating.toFixed(1)} />
        <Metric label="Reliability" value={deal.reliabilityRating.toFixed(1)} />
        <Metric label="Upgrades / yr" value={String(deal.upgradeFrequency)} />
        <Metric label="Influence" value={String(deal.politicalInfluence)} />
      </div>
      <div className="mt-2 text-xs text-neutral-500">
        Contract: {deal.contractYearsRemaining} year{deal.contractYearsRemaining === 1 ? '' : 's'} remaining
        {deal.exclusivity ? ' · Exclusive works supply' : ''}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-neutral-100">{value}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-neutral-800/60 px-1.5 py-0.5 text-neutral-300">{children}</span>
  );
}

function ManufacturerPanel({ engine }: { engine: EngineState }) {
  const confidence = engine.manufacturerConfidence;
  const objective = engine.manufacturerObjective;
  if (confidence === undefined || !objective) {
    return (
      <Panel title="Manufacturer Relationship">
        <p className="text-sm text-neutral-400">
          Customer engine deals carry no manufacturer relationship. Sign a works or factory deal to take
          on a performance partnership.
        </p>
      </Panel>
    );
  }
  const reviews = [...(engine.manufacturerReviews ?? [])].slice(-3).reverse();
  const tone =
    confidence >= 70 ? 'text-green-400' : confidence >= 40 ? 'text-amber-400' : 'text-red-400';
  return (
    <Panel title="Manufacturer Relationship">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-300">
          Target: <span className="font-semibold text-neutral-100">{objective.description}</span>
        </div>
        <div className={`text-sm font-bold ${tone}`}>Confidence {confidence}</div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded bg-neutral-800">
        <div
          className={`h-full ${confidence >= 70 ? 'bg-green-500' : confidence >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        Meeting the target lifts confidence; missing it dents it. Strong confidence can earn a works
        upgrade, while a collapse scales the deal back a tier.
      </p>
      {reviews.length > 0 && (
        <ul className="mt-3 space-y-1">
          {reviews.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className={r.met ? 'text-green-400' : 'text-red-400'}>{r.met ? '▲' : '▼'}</span>
              <span className="text-neutral-500">{r.seasonYear}</span>
              <span className="text-neutral-300">{r.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

