import { useState } from 'react';
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
import { ratingColor } from '../components/ui';
import { Button } from '../components/Button';
import { TechnicalTable, TechnicalTableCell, TechnicalTableHead, TechnicalTableRow } from '../components/TechnicalTable';
import type { EngineState, EngineSupplierDeal } from '../types/engineTypes';
import {
  ENGINE_WORKSPACE_TABS,
  engineCashMovementNow,
  groupEngineOffers,
  type EngineWorkspaceTab,
} from './engineSupplierViewModel';
import {
  WorkspaceBody,
  WorkspaceTabs,
} from '../components/workspace/Workspace';

function moneyMillions(value: number): string {
  return `$${value.toFixed(value % 1 === 0 ? 0 : 2)}M`;
}

export function EngineSupplierBody() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<EngineWorkspaceTab>('package');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  if (!state) return null;

  const team = teamById(state, state.selectedTeamId);
  const engine = state.engine;
  if (!engine || !team) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-neutral-100">Engine Supplier</h1>
        <Panel title="Engine Supplier">
          <p className="text-sm text-neutral-400">Engine deals are available in Career Mode.</p>
        </Panel>
      </div>
    );
  }

  const current = engine.currentDeal;
  const pending = engine.pendingDeal;
  const offers = availableEngineOffers(engine, team);
  const supplierGroups = groupEngineOffers(offers);
  const filteredSupplierGroups = supplierGroups.filter((group) => group.supplierName.toLowerCase().includes(supplierFilter.toLowerCase()));
  const selectedGroup = filteredSupplierGroups.find((group) => group.supplierName === selectedSupplier)
    ?? filteredSupplierGroups[0];

  return (
    <div className="space-y-4">
      <WorkspaceTabs
        items={ENGINE_WORKSPACE_TABS.map((workspace) => ({ id: workspace.id, label: `${workspace.label}${workspace.id === 'market' ? ` (${supplierGroups.length})` : ''}` }))}
        active={tab}
        onChange={setTab}
        ariaLabel="Engine workspaces"
      />
      <WorkspaceBody className="space-y-4">
      {tab === 'package' && <CurrentPackagePanel current={current} pending={pending} pendingFee={engine.pendingDealFee} />}
      {tab === 'manufacturer' && <ManufacturerPanel engine={engine} />}
      {tab === 'market' && (
        <SupplierMarket
          current={current}
          pending={pending}
          pendingFee={engine.pendingDealFee ?? 0}
          budget={team.budget}
          inPreseasonSetup={state.careerPhase?.currentPhase === 'pre_season_setup'}
          singleSeason={state.gameMode === 'SingleSeason'}
          visibleSuppliers={filteredSupplierGroups}
          selectedGroup={selectedGroup}
          selectedSupplier={selectedSupplier}
          totalSuppliers={filteredSupplierGroups.length}
          supplierFilter={supplierFilter}
          onSupplierFilter={setSupplierFilter}
          onSelectSupplier={setSelectedSupplier}
          onSign={(offer) => dispatch({ type: 'SIGN_ENGINE_DEAL', supplierId: offer.supplier.id, dealType: offer.dealType })}
        />
      )}
      </WorkspaceBody>
    </div>
  );
}

export function EngineSupplier() {
  return <EngineSupplierBody />;
}

function CurrentPackagePanel({
  current,
  pending,
  pendingFee,
}: {
  current?: EngineSupplierDeal;
  pending?: EngineSupplierDeal;
  pendingFee?: number;
}) {
  return (
    <Panel title="Power Unit Plan" actions={<span className="text-xs text-neutral-500">Current season → next season</span>}>
      {!current ? <p className="text-sm text-neutral-400">No active engine deal.</p> : (
        <div className="grid gap-4 xl:grid-cols-2">
          <DealSummary label="Running This Season" deal={current} />
          {pending ? (
            <DealSummary label="Signed For Next Season" deal={pending} pending fee={pendingFee} />
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-950/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Next Season</div>
              <div className="mt-2 text-lg font-bold text-neutral-100">No change queued</div>
              <p className="mt-2 text-sm text-neutral-400">
                The current agreement continues. Open Supplier Market to compare available packages.
              </p>
              <div className="mt-4 rounded-lg bg-neutral-900/70 p-3 text-xs text-neutral-500">
                Annual supply costs are charged at rollover. Switching during the season also requires an immediate contract buyout.
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function DealSummary({
  label,
  deal,
  pending = false,
  fee = 0,
}: {
  label: string;
  deal: EngineSupplierDeal;
  pending?: boolean;
  fee?: number;
}) {
  const spec = ENGINE_DEAL_SPECS[deal.dealType];
  return (
    <div className={`rounded-xl border p-4 ${pending ? 'border-[var(--era-accent)] bg-[var(--era-accent-soft)]' : 'border-neutral-800 bg-neutral-900/40'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
          <div className="mt-1 text-xl font-bold text-neutral-100">{deal.supplierName}</div>
          <div className={pending ? 'text-sm text-[var(--era-accent-strong)]' : 'text-sm text-amber-300'}>{spec.label}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-neutral-100">{moneyMillions(deal.annualCost)}</div>
          <div className="text-[10px] text-neutral-500">per season</div>
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">{spec.description}</p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <Metric label="Power" value={deal.powerRating.toFixed(1)} />
        <Metric label="Reliability" value={deal.reliabilityRating.toFixed(1)} />
        <Metric label="Upgrades" value={`${deal.upgradeFrequency}/yr`} />
        <Metric label="Influence" value={String(deal.politicalInfluence)} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{deal.contractYearsRemaining} year{deal.contractYearsRemaining === 1 ? '' : 's'} remaining{deal.exclusivity ? ' · exclusive supply' : ''}</span>
        {pending && <span className="text-[var(--era-accent-strong)]">{fee > 0 ? `${moneyMillions(fee)} buyout paid` : 'No buyout charged'}</span>}
      </div>
    </div>
  );
}

function SupplierMarket({
  current,
  pending,
  pendingFee,
  budget,
  inPreseasonSetup,
  singleSeason,
  visibleSuppliers,
  selectedGroup,
  selectedSupplier,
  totalSuppliers,
  supplierFilter,
  onSupplierFilter,
  onSelectSupplier,
  onSign,
}: {
  current?: EngineSupplierDeal;
  pending?: EngineSupplierDeal;
  pendingFee: number;
  budget: number;
  inPreseasonSetup: boolean;
  singleSeason: boolean;
  visibleSuppliers: ReturnType<typeof groupEngineOffers>;
  selectedGroup?: ReturnType<typeof groupEngineOffers>[number];
  selectedSupplier: string;
  totalSuppliers: number;
  supplierFilter: string;
  onSupplierFilter: (value: string) => void;
  onSelectSupplier: (supplierName: string) => void;
  onSign: (offer: EngineOffer) => void;
}) {
  return (
    <Panel
      title="Supplier Market"
      actions={<span className="text-xs text-neutral-500">Choose a supplier, then compare every tier you qualify for</span>}
    >
      {singleSeason && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Engine negotiations are disabled in Single Season mode because agreements begin next season.
        </div>
      )}
      <label className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
        Filter suppliers
        <input value={supplierFilter} onChange={(event) => onSupplierFilter(event.target.value)} placeholder="Search supplier…" className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200 placeholder:text-neutral-600" />
      </label>
      <TechnicalTable>
        <TechnicalTableHead><TechnicalTableRow><TechnicalTableCell header>Supplier</TechnicalTableCell><TechnicalTableCell header>Base power</TechnicalTableCell><TechnicalTableCell header>Reliability</TechnicalTableCell><TechnicalTableCell header>Prestige</TechnicalTableCell><TechnicalTableCell header>Tiers</TechnicalTableCell><TechnicalTableCell header>Compare</TechnicalTableCell></TechnicalTableRow></TechnicalTableHead>
        <tbody>
        {visibleSuppliers.map((group) => {
          const supplier = group.offers[0]?.supplier;
          const active = (selectedSupplier || visibleSuppliers[0]?.supplierName) === group.supplierName;
          return <TechnicalTableRow key={group.supplierName} className={active ? 'bg-sky-500/10' : ''}><TechnicalTableCell className="font-bold text-neutral-100">{group.supplierName}</TechnicalTableCell><TechnicalTableCell>{supplier?.basePower}</TechnicalTableCell><TechnicalTableCell>{supplier?.baseReliability}</TechnicalTableCell><TechnicalTableCell>{supplier?.prestige}</TechnicalTableCell><TechnicalTableCell>{group.offers.length}</TechnicalTableCell><TechnicalTableCell><Button className="px-2 py-1 text-xs" variant={active ? 'primary' : 'secondary'} onClick={() => onSelectSupplier(group.supplierName)}>{active ? 'Selected' : 'Compare tiers'}</Button></TechnicalTableCell></TechnicalTableRow>;
        })}
        </tbody>
      </TechnicalTable>

      {selectedGroup ? (
        <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          {selectedGroup.offers.map((offer) => (
            <EngineOfferCard
              key={offer.dealType}
              offer={offer}
              current={current}
              pending={pending}
              pendingFee={pendingFee}
              budget={budget}
              inPreseasonSetup={inPreseasonSetup}
              singleSeason={singleSeason}
              onSign={() => onSign(offer)}
            />
          ))}
        </div>
      ) : <p className="mt-3 text-sm text-neutral-500">No engine offers are available.</p>}

      <div className="mt-2 text-xs text-neutral-500">{totalSuppliers} suppliers available · select a row to compare deal tiers.</div>
    </Panel>
  );
}

function EngineOfferCard({
  offer,
  current,
  pending,
  pendingFee,
  budget,
  inPreseasonSetup,
  singleSeason,
  onSign,
}: {
  offer: EngineOffer;
  current?: EngineSupplierDeal;
  pending?: EngineSupplierDeal;
  pendingFee: number;
  budget: number;
  inPreseasonSetup: boolean;
  singleSeason: boolean;
  onSign: () => void;
}) {
  const isCurrent = current?.supplierName === offer.supplier.name && current.dealType === offer.dealType;
  const isPending = pending?.supplierName === offer.supplier.name && pending.dealType === offer.dealType;
  const fee = inPreseasonSetup ? 0 : engineSwitchFee(current, offer);
  const affordable = toMoney(fee) <= budget + toMoney(pendingFee);
  const cashMovement = engineCashMovementNow(fee, pendingFee);
  const finalPower = offer.supplier.basePower + offer.bonus.power;
  const finalReliability = offer.supplier.baseReliability + offer.bonus.reliability;

  return (
    <div className={`rounded-lg border p-3 ${isPending ? 'border-[var(--era-accent)] bg-[var(--era-accent-soft)]' : isCurrent ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-neutral-800 bg-neutral-900/40'}`}>
      <div className="text-sm font-bold text-neutral-100">{ENGINE_DEAL_SPECS[offer.dealType].label}</div>
      <div className="text-xs font-semibold text-amber-300">{moneyMillions(offer.annualCost)} / season</div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
        <OfferStat label="Power" value={finalPower.toFixed(1)} />
        <OfferStat label="Reliability" value={finalReliability.toFixed(1)} />
        <OfferStat label="Upgrades" value={`${offer.upgradeFrequency}/yr`} />
        <OfferStat label="Influence" value={String(offer.politicalInfluence)} />
      </div>
      <div className="mt-2 min-h-8 text-[10px] text-neutral-500">
        {cashMovement === 0
          ? 'No cash due now.'
          : cashMovement > 0
            ? `${moneyMillions(cashMovement)} net refund now.`
            : `${moneyMillions(Math.abs(cashMovement))} net cash due now.`}
        {' '}Annual cost is billed next season.
      </div>
      <div className="mt-2">
        {isCurrent && !pending ? (
          <StatusLabel tone="current">Current agreement</StatusLabel>
        ) : isPending ? (
          <StatusLabel tone="pending">Signed for next season</StatusLabel>
        ) : isCurrent && pending ? (
          <Button variant="secondary" className="w-full px-2 py-1 text-xs" disabled={singleSeason} onClick={onSign}>Keep current · refund {moneyMillions(pendingFee)}</Button>
        ) : (
          <Button variant="primary" className="w-full px-2 py-1 text-xs" disabled={singleSeason || !affordable} onClick={onSign}>
            {!affordable ? 'Insufficient budget' : fee > 0 ? `Sign · ${moneyMillions(fee)} buyout` : 'Sign for next season'}
          </Button>
        )}
      </div>
    </div>
  );
}

function ManufacturerPanel({ engine }: { engine: EngineState }) {
  const confidence = engine.manufacturerConfidence;
  const objective = engine.manufacturerObjective;
  if (confidence === undefined || !objective) {
    return (
      <Panel title="Manufacturer Relationship">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Relationship status</div>
            <div className="mt-2 text-xl font-bold text-neutral-100">Customer supply</div>
            <p className="mt-2 text-sm text-neutral-400">
              Customer agreements provide engines without a factory performance target or confidence review.
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-950/30 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">How to unlock</div>
            <div className="mt-2 text-lg font-bold text-neutral-100">Secure works or factory backing</div>
            <p className="mt-2 text-sm text-neutral-400">
              A manufacturer partnership brings targets and pressure. Success can upgrade support; missed targets can reduce your deal tier.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  const reviews = [...(engine.manufacturerReviews ?? [])].slice(-3).reverse();
  const color = ratingColor(confidence);
  return (
    <Panel title="Manufacturer Relationship" actions={<span className="text-xs font-bold" style={{ color }}>Confidence {confidence} / 100</span>}>
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 xl:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Factory target</div>
          <div className="mt-2 text-lg font-bold text-neutral-100">{objective.description}</div>
          <div className="mt-4 h-2 overflow-hidden rounded bg-neutral-800">
            <div className="h-full" style={{ width: `${confidence}%`, backgroundColor: color }} />
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Meeting the target raises confidence and can improve support. A confidence collapse can scale the agreement back one tier.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 xl:col-span-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Recent factory reviews</div>
          {reviews.length === 0 ? <p className="mt-3 text-sm text-neutral-500">The first review arrives at season end.</p> : (
            <div className="mt-3 grid gap-2">
              {reviews.map((review) => (
                <div key={`${review.seasonYear}-${review.summary}`} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-xs">
                  <span className={review.met ? 'text-emerald-400' : 'text-red-400'}>{review.met ? '▲' : '▼'}</span>
                  <span className="font-semibold text-neutral-500">{review.seasonYear}</span>
                  <span className="flex-1 text-neutral-300">{review.summary}</span>
                  <span className={review.confidenceDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}>{review.confidenceDelta > 0 ? '+' : ''}{review.confidenceDelta}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-2">
      <div className="text-[9px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-base font-bold text-neutral-100">{value}</div>
    </div>
  );
}

function OfferStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-neutral-800/60 px-2 py-1">
      <div className="text-[9px] uppercase text-neutral-500">{label}</div>
      <div className="font-semibold text-neutral-200">{value}</div>
    </div>
  );
}

function StatusLabel({ children, tone }: { children: React.ReactNode; tone: 'current' | 'pending' }) {
  return (
    <div className={`rounded px-2 py-1.5 text-center text-xs font-semibold ${tone === 'current' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-[var(--era-accent-soft)] text-[var(--era-accent-strong)]'}`}>
      {children}
    </div>
  );
}
