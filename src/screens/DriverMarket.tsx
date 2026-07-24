import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { activeDriversForTeam, carForTeam, driversForTeam, teamById, maxRaceDriversForSeries } from '../game/careerState';
import { isPreseason } from '../game/rosterEnforcement';
import { isSingleSeasonMode } from '../game/modeRestrictions';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { marketDriverOfferInterest } from '../sim/crossSeriesEngine';
import { carPerformanceRating } from '../sim/trackFitEngine';
import { isAcademyReady } from '../sim/driverMarketEngine';
import { academyCapacityFor } from '../sim/teamRatingsEngine';
import { toMoney } from '../sim/financeEngine';
import { thirdDriverMidSeasonFee } from '../sim/contractEngine';
import { preferredSeries } from '../sim/seriesPreferenceEngine';
import { fogView, scoutingCost } from '../sim/scoutingEngine';
import { Panel } from '../components/Panel';
import { StatBar } from '../components/StatBar';
import { Button } from '../components/Button';
import {
  MetricStrip,
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceMetric,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import {
  readoutForMarketOverall,
  readoutForMarketSkill,
  readoutForPotential,
} from '../components/scouting/ratingDisplay';
import { formatMoney } from '../components/ui';
import type { ScoutedEntityType } from '../types/scoutingTypes';
import type {
  AcademyMember,
  MarketDriver,
  MarketSkillRatings,
  SeatSigning,
  YouthProspect,
} from '../types/marketTypes';
import type { Driver } from '../types/gameTypes';
import {
  MARKET_PAGE_SIZE,
  marketPage,
  marketPageCount,
} from './driverMarketViewModel';
import {
  DEFAULT_DRIVER_MARKET_FILTERS,
  DRIVER_MARKET_VIEWS,
  filterMarketDrivers,
  sortMarketDrivers,
  type DriverMarketFilters,
  type DriverMarketSort,
  type DriverMarketSortKey,
  type DriverMarketView,
} from './driverMarketListViewModel';
import { transferCalendarView } from './transferCalendarViewModel';
import { recruitmentDecisionDesk } from './recruitmentDecisionViewModel';
import { RecruitmentPipelineBoard } from '../components/RecruitmentPipelineBoard';

type Tab = 'senior' | 'youth';

export function DriverMarket() {
  const { state, dispatch } = useGame();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('senior');
  const [marketView, setMarketView] = useState<DriverMarketView>('overview');
  const [marketFilters, setMarketFilters] = useState<DriverMarketFilters>(DEFAULT_DRIVER_MARKET_FILTERS);
  const [marketSort, setMarketSort] = useState<DriverMarketSort>({ key: 'overall', direction: 'desc' });
  const approachedTargetId = searchParams.get('target');

  const bundle = useMemo(
    () => (state ? careerMarketBundle(state) : undefined),
    [state],
  );

  // One universe-wide senior market. Series preference changes interest and AI
  // decisions, but never moves a driver into a separate or hidden pool.
  const seniorDrivers = [...(bundle?.drivers ?? [])].sort((a, b) =>
    Number(b.id === approachedTargetId) - Number(a.id === approachedTargetId),
  );

  if (!state) return null;

  const singleSeason = isSingleSeasonMode(state.gameMode);
  const offseason = state.seasonComplete;
  const preseason = isPreseason(state);
  const budget = teamById(state, state.selectedTeamId)?.budget ?? 0;
  const orgOverall = state.teamOrgRatings?.[state.selectedTeamId]?.overallTeamRating ?? 50;
  const playerCar = carForTeam(state, state.selectedTeamId);
  const carOverall = playerCar ? carPerformanceRating(playerCar) : 50;
  const seats = activeDriversForTeam(state, state.selectedTeamId);
  const roster = driversForTeam(state, state.selectedTeamId);
  const openRaceSeats = maxRaceDriversForSeries(state.series) - seats.length;
  const hasThirdDriver = roster.some((d) => d.contractType === 'third');
  const canSignThird = !offseason && !hasThirdDriver && roster.length < 3;
  const canSignRaceDriver = preseason && openRaceSeats > 0 && roster.length < 3;
  const racesRemaining = Math.max(1, state.calendar.length - state.currentRaceIndex);
  const signings = state.pendingSignings ?? [];
  const academy = state.academy ?? [];
  const academyCapacity = academyCapacityFor(state.teamOrgRatings, state.selectedTeamId);
  const signedMarketIds = new Set(state.signedMarketIds ?? []);
  const signingBySource = new Map(signings.map((s) => [s.sourceId, s]));
  const seatName = (id: string) => state.drivers.find((d) => d.id === id)?.name ?? id;
  const marketTabs: Array<{ id: Tab; label: string }> = [
    { id: 'senior', label: `Senior Market (${seniorDrivers.length})` },
    ...(!singleSeason && bundle ? [{ id: 'youth' as const, label: `Youth Academy (${bundle.youth.length})` }] : []),
  ];
  const transferView = transferCalendarView(state);
  const approachedDecisionDesk = approachedTargetId ? recruitmentDecisionDesk(state, approachedTargetId) : null;
  const shortlistedIds = new Set(
    (state.scouting?.shortlist ?? [])
      .filter((entry) => entry.entityType === 'Driver')
      .map((entry) => entry.entityId),
  );
  const scoutedIds = new Set(
    Object.entries(state.scouting?.reports ?? {})
      .filter(([, report]) => report.scoutingLevel > 0)
      .map(([id]) => id),
  );
  const filteredSeniorDrivers = filterMarketDrivers(seniorDrivers, marketFilters, {
    budget,
    shortlistedIds,
    scoutedIds,
  });
  const sortedSeniorDrivers = sortMarketDrivers(filteredSeniorDrivers, marketSort, {
    overall: (driver) => readoutForMarketOverall(state, driver.id, driver.skills, driver.potential, driver.overall).value,
    potential: (driver) => readoutForPotential(state, driver.id, driver.skills, driver.potential).value,
    knowledge: (driver) => state.scouting?.reports?.[driver.id]?.scoutingLevel ?? 0,
  });
  const orderedSeniorDrivers = approachedTargetId
    ? [
        ...sortedSeniorDrivers.filter((driver) => driver.id === approachedTargetId),
        ...sortedSeniorDrivers.filter((driver) => driver.id !== approachedTargetId),
      ]
    : sortedSeniorDrivers;
  const marketStatuses = [...new Set(seniorDrivers.map((driver) => driver.marketStatus))].sort();
  const marketContexts = [...new Set(seniorDrivers.map((driver) => driver.context))].sort();

  const updateMarketFilter = <K extends keyof DriverMarketFilters>(key: K, value: DriverMarketFilters[K]) => {
    setMarketFilters((current) => ({ ...current, [key]: value }));
  };

  const updateMarketSort = (key: DriverMarketSortKey) => {
    setMarketSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Fogged potential label: scouting narrows the range without confirming truth.
  const potLabel = (id: string, skills: MarketSkillRatings, potential: number, entityType: ScoutedEntityType = 'Driver'): string =>
    readoutForPotential(state, id, skills, potential, entityType).label;

  return (
    <WorkspaceScreen className="era-feature-screen era-driver-market">
      <WorkspaceHeader
        eyebrow="Recruitment center"
        title="Driver Market"
        subtitle={singleSeason
          ? `Current-season driver management for ${state.seasonYear}.`
          : `One shared universe market · recruit for ${state.seasonYear + 1} and develop under-18 talent.`}
      />

      <MetricStrip>
        <WorkspaceMetric label="Available budget" value={formatMoney(budget)} detail="Team balance" />
        <WorkspaceMetric label="Open race seats" value={Math.max(0, openRaceSeats)} detail={preseason ? 'Preseason requirement' : 'Next signing window'} />
        <WorkspaceMetric label="Academy" value={`${academy.length} / ${academyCapacity}`} detail="Current prospects · capacity" />
        <WorkspaceMetric label="Scouting accuracy" value={`${Math.round((state.scouting?.networkAccuracy ?? 0) * 100)}%`} detail="Controls rating uncertainty" />
      </MetricStrip>

      <WorkspaceTabs items={marketTabs} active={tab} onChange={setTab} ariaLabel="Driver market sections" />

      <WorkspaceBody>
      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="ui-decision-strip-pulse" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-neutral-100">Recruitment operations desk</div>
            <div className="truncate text-neutral-400">
              {preseason && openRaceSeats > 0
                ? `${openRaceSeats} race seat${openRaceSeats === 1 ? '' : 's'} must be filled before Round 1.`
                : signings.length > 0
                  ? `${signings.length} pending signing${signings.length === 1 ? '' : 's'} await confirmation in Offseason.`
                  : 'Review senior targets, youth prospects, and scouting confidence before committing budget.'}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {formatMoney(budget)} available
        </span>
      </div>

      {approachedTargetId && (
        <Panel title="Recruitment decision desk">
          {approachedDecisionDesk ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-neutral-300"><span className="font-semibold">{approachedDecisionDesk.name}</span> is pinned first below.</p>
                <p className="mt-1 text-xs text-neutral-500">{approachedDecisionDesk.recommendation}</p>
                <p className="mt-1 text-xs text-neutral-500">Status: {approachedDecisionDesk.status} · Estimated knowledge: {approachedDecisionDesk.knowledgePercentage}%</p>
              </div>
              {approachedDecisionDesk.nextAction.route !== `/market?target=${encodeURIComponent(approachedTargetId)}` && (
                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => navigate(approachedDecisionDesk.nextAction.route)}>
                  {approachedDecisionDesk.nextAction.label} →
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-amber-300">This shortlisted target is no longer available in the current market.</p>
          )}
        </Panel>
      )}

      {!singleSeason && (
        <RecruitmentPipelineBoard state={state} />
      )}

      {!singleSeason && (
        <Panel title="Transfer & Contract Calendar">
          <div className="grid gap-3 md:grid-cols-3">
            <div><div className="text-[10px] font-black uppercase tracking-wide text-neutral-500">Expiring contracts</div><div className="mt-1 text-lg font-bold text-neutral-100">{transferView.expiringDrivers.length}</div><div className="text-xs text-neutral-500">Across the current grid</div></div>
            <div><div className="text-[10px] font-black uppercase tracking-wide text-neutral-500">Rival offers</div><div className="mt-1 text-lg font-bold text-amber-300">{transferView.rivalOffers.length}</div><div className="text-xs text-neutral-500">Active market deadlines</div></div>
            <div><div className="text-[10px] font-black uppercase tracking-wide text-neutral-500">Expected free agents</div><div className="mt-1 text-lg font-bold text-neutral-100">{transferView.availableDriverCount}</div><div className="text-xs text-neutral-500">State-backed release decisions</div></div>
          </div>
          {transferView.rivalOffers.length > 0 && <div className="mt-3 space-y-2 border-t border-neutral-800 pt-3">{transferView.rivalOffers.slice(0, 4).map((offer) => (
            <div key={offer.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-neutral-800 bg-neutral-950/40 p-2 text-xs">
              <span className="text-neutral-300"><strong>{offer.destinationTeamName}</strong> has offered for {offer.targetName} · deadline R{offer.deadlineRound}</span>
              {seats[0] && <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => navigate(`/market/${encodeURIComponent(offer.targetId)}/negotiate/${encodeURIComponent(seats[0].id)}`)}>Improve your offer</Button>}
            </div>
          ))}</div>}
          {transferView.recentStories.length > 0 && <div className="mt-3 text-xs text-neutral-500">Latest: {transferView.recentStories[0].targetName} · {transferView.recentStories[0].stage} · effective {state.seasonYear + 1}</div>}
        </Panel>
      )}

      <div
        className={`rounded-md border px-4 py-2 text-sm ${
          preseason && openRaceSeats > 0
            ? 'border-amber-600/50 bg-amber-900/20 text-amber-300'
            : offseason
            ? 'border-green-700/50 bg-green-500/10 text-green-300'
            : 'border-neutral-800 bg-neutral-900/40 text-neutral-400'
        }`}
      >
        {preseason && openRaceSeats > 0
          ? `Preseason — your team has ${openRaceSeats} open race seat${openRaceSeats === 1 ? '' : 's'}. Sign ${openRaceSeats === 1 ? 'a race driver' : 'race drivers'} before Round 1.`
          : offseason
          ? 'Offseason — you can sign drivers for next season. Confirm them in the Offseason screen.'
          : hasThirdDriver
            ? singleSeason
              ? 'You have a 3rd driver. Seat signings open in the offseason.'
              : 'You have a 3rd driver. Seat signings open in the offseason; you can still add youth prospects now.'
            : 'Seat signings open in the offseason, but you can sign one free agent now as a cheaper 3rd driver (a reserve you can swap into a race seat).'}
      </div>

      {signings.length > 0 && (
        <Panel title={`Pending Signings for ${state.seasonYear + 1}`}>
          <ul className="space-y-1.5 text-sm">
            {signings.map((s) => (
              <li key={s.seatDriverId} className="flex items-center justify-between">
                <span className="text-neutral-200">
                  <span className="font-semibold">{s.name}</span>{' '}
                  <span className="text-neutral-500">→ replaces {seatName(s.seatDriverId)}</span>
                  {s.source === 'academy' && (
                    <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300">
                      academy
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
        </Panel>
      )}

      {!bundle && (
        <Panel>
          <p className="text-sm text-neutral-400">
            No driver market data is available for the {state.seasonYear} {state.series} season yet.
          </p>
        </Panel>
      )}

      {bundle && tab === 'senior' && (
        <SeniorMarketList
          state={state}
          drivers={orderedSeniorDrivers}
          view={marketView}
          filters={marketFilters}
          marketStatuses={marketStatuses}
          marketContexts={marketContexts}
          sort={marketSort}
          affordableBudget={budget}
          shortlistedIds={shortlistedIds}
          scoutedIds={scoutedIds}
          signedMarketIds={signedMarketIds}
          pendingBySource={signingBySource}
          offseason={offseason}
          seats={seats}
          canSignThird={canSignThird}
          canSignRaceDriver={canSignRaceDriver}
          thirdFee={(driver) => thirdDriverMidSeasonFee(driver.salary, racesRemaining, state.calendar.length)}
          seatName={seatName}
          orgOverall={orgOverall}
          carOverall={carOverall}
          onViewChange={setMarketView}
          onFilterChange={updateMarketFilter}
          onSort={updateMarketSort}
          onNavigate={navigate}
          onScout={(marketId) => dispatch({ type: 'SCOUT_TARGET', entityId: marketId, entityType: 'Driver' })}
          onSignThird={(marketId) => dispatch({ type: 'SIGN_THIRD_DRIVER', marketId })}
          onSignRaceDriver={(marketId) => dispatch({ type: 'SIGN_RACE_DRIVER', marketId })}
          onRelease={(seatDriverId) => dispatch({ type: 'RELEASE_SIGNING', seatDriverId })}
        />
      )}

      {bundle && tab === 'youth' && !singleSeason && (
        <YouthTab
          prospects={bundle.youth}
          academy={academy}
          state={state}
          academyCapacity={academyCapacity}
          offseason={offseason}
          seats={seats}
          budget={budget}
          signingBySource={signingBySource}
          seatName={seatName}
          potLabel={potLabel}
          onSignYouth={(youthId) => dispatch({ type: 'SIGN_YOUTH', youthId })}
          onReleaseAcademy={(academyId) => dispatch({ type: 'RELEASE_ACADEMY', academyId })}
          onPromote={(academyId, seatDriverId) =>
            dispatch({ type: 'PROMOTE_ACADEMY', academyId, seatDriverId })
          }
          onReleaseSigning={(seatDriverId) =>
            dispatch({ type: 'RELEASE_SIGNING', seatDriverId })
          }
          onScoutYouth={(youthId) =>
            dispatch({ type: 'SCOUT_TARGET', entityId: youthId, entityType: 'YouthProspect' })
          }
        />
      )}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function SeniorMarketList({
  state,
  drivers,
  view,
  filters,
  marketStatuses,
  marketContexts,
  sort,
  affordableBudget,
  shortlistedIds,
  scoutedIds,
  signedMarketIds,
  pendingBySource,
  offseason,
  seats,
  canSignThird,
  canSignRaceDriver,
  thirdFee,
  seatName,
  orgOverall,
  carOverall,
  onViewChange,
  onFilterChange,
  onSort,
  onNavigate,
  onScout,
  onSignThird,
  onSignRaceDriver,
  onRelease,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  drivers: MarketDriver[];
  view: DriverMarketView;
  filters: DriverMarketFilters;
  marketStatuses: string[];
  marketContexts: string[];
  sort: DriverMarketSort;
  affordableBudget: number;
  shortlistedIds: Set<string>;
  scoutedIds: Set<string>;
  signedMarketIds: Set<string>;
  pendingBySource: Map<string, SeatSigning>;
  offseason: boolean;
  seats: Driver[];
  canSignThird: boolean;
  canSignRaceDriver: boolean;
  thirdFee: (driver: MarketDriver) => number;
  seatName: (id: string) => string;
  orgOverall: number;
  carOverall: number;
  onViewChange: (view: DriverMarketView) => void;
  onFilterChange: <K extends keyof DriverMarketFilters>(key: K, value: DriverMarketFilters[K]) => void;
  onSort: (key: DriverMarketSortKey) => void;
  onNavigate: (route: string) => void;
  onScout: (marketId: string) => void;
  onSignThird: (marketId: string) => void;
  onSignRaceDriver: (marketId: string) => void;
  onRelease: (seatDriverId: string) => void;
}) {
  const viewLabel: Record<DriverMarketView, string> = {
    overview: 'Overview',
    scouting: 'Scouting',
    contract: 'Contract',
  };

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-neutral-800 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">Senior scouting list</div>
            <div className="text-xs text-neutral-400">
              {drivers.length} targets · click a column to sort · select a name for the full dossier
            </div>
          </div>
          <div className="flex gap-1 rounded border border-neutral-800 bg-neutral-950/60 p-1" aria-label="Senior market views">
            {DRIVER_MARKET_VIEWS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => onViewChange(option)}
                className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  view === option ? 'bg-sky-500/15 text-sky-300' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {viewLabel[option]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={filters.query}
            onChange={(event) => onFilterChange('query', event.target.value)}
            placeholder="Search name, nationality, context"
            aria-label="Search senior market"
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600"
          />
          <select
            value={filters.marketStatus}
            onChange={(event) => onFilterChange('marketStatus', event.target.value)}
            aria-label="Market status filter"
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200"
          >
            <option>All</option>
            {marketStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
          <select
            value={filters.context}
            onChange={(event) => onFilterChange('context', event.target.value)}
            aria-label="Market context filter"
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200"
          >
            <option>All</option>
            {marketContexts.map((context) => <option key={context}>{context}</option>)}
          </select>
          <input
            value={filters.maxAge}
            onChange={(event) => onFilterChange('maxAge', event.target.value)}
            type="number"
            min="1"
            max="60"
            placeholder="Max age"
            aria-label="Maximum age filter"
            className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-400">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={filters.affordableOnly} onChange={(event) => onFilterChange('affordableOnly', event.target.checked)} />
            Affordable
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={filters.shortlistedOnly} onChange={(event) => onFilterChange('shortlistedOnly', event.target.checked)} />
            Shortlisted
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={filters.scoutedOnly} onChange={(event) => onFilterChange('scoutedOnly', event.target.checked)} />
            Scouted
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={filters.f1ReadyOnly} onChange={(event) => onFilterChange('f1ReadyOnly', event.target.checked)} />
            F1-ready
          </label>
          <span className="ml-auto text-[10px] text-neutral-600">Budget {formatMoney(affordableBudget)}</span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded border border-neutral-800">
        <table className="w-full min-w-[1080px] border-collapse text-xs">
          <thead className="bg-neutral-900/70 text-left text-[10px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-2 py-2">Driver</th>
              <SortableHeader label="Age" sortKey="age" sort={sort} onSort={onSort} />
              <th className="px-2 py-2">Context</th>
              <SortableHeader label="OVR" sortKey="overall" sort={sort} onSort={onSort} />
              <SortableHeader label="POT" sortKey="potential" sort={sort} onSort={onSort} />
              {view === 'scouting' && <SortableHeader label="Knowledge" sortKey="knowledge" sort={sort} onSort={onSort} />}
              {view !== 'contract' && <SortableHeader label="F1-ready" sortKey="f1Readiness" sort={sort} onSort={onSort} />}
              {view === 'contract' && (
                <>
                  <SortableHeader label="Salary" sortKey="salary" sort={sort} onSort={onSort} />
                  <SortableHeader label="Buyout" sortKey="buyout" sort={sort} onSort={onSort} />
                </>
              )}
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <SeniorMarketRow
                key={driver.id}
                state={state}
                driver={driver}
                view={view}
                shortlisted={shortlistedIds.has(driver.id)}
                scouted={scoutedIds.has(driver.id)}
                signed={signedMarketIds.has(driver.id)}
                pending={pendingBySource.get(driver.id)}
                offseason={offseason}
                seats={seats}
                canSignThird={canSignThird}
                canSignRaceDriver={canSignRaceDriver}
                thirdFee={thirdFee(driver)}
                seatName={seatName}
                orgOverall={orgOverall}
                carOverall={carOverall}
                onNavigate={onNavigate}
                onScout={() => onScout(driver.id)}
                onSignThird={() => onSignThird(driver.id)}
                onSignRaceDriver={() => onSignRaceDriver(driver.id)}
                onRelease={onRelease}
              />
            ))}
          </tbody>
        </table>
        {drivers.length === 0 && <div className="px-3 py-8 text-center text-sm text-neutral-500">No targets match these filters.</div>}
      </div>
    </Panel>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: DriverMarketSortKey;
  sort: DriverMarketSort;
  onSort: (key: DriverMarketSortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-2 py-2">
      <button type="button" className="inline-flex items-center gap-1 hover:text-neutral-200" onClick={() => onSort(sortKey)}>
        {label}
        <span className="text-[9px]">{active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

function SeniorMarketRow({
  state,
  driver,
  view,
  shortlisted,
  scouted,
  signed,
  pending,
  offseason,
  seats,
  canSignThird,
  canSignRaceDriver,
  thirdFee,
  seatName,
  orgOverall,
  carOverall,
  onNavigate,
  onScout,
  onSignThird,
  onSignRaceDriver,
  onRelease,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  driver: MarketDriver;
  view: DriverMarketView;
  shortlisted: boolean;
  scouted: boolean;
  signed: boolean;
  pending?: SeatSigning;
  offseason: boolean;
  seats: Driver[];
  canSignThird: boolean;
  canSignRaceDriver: boolean;
  thirdFee: number;
  seatName: (id: string) => string;
  orgOverall: number;
  carOverall: number;
  onNavigate: (route: string) => void;
  onScout: () => void;
  onSignThird: () => void;
  onSignRaceDriver: () => void;
  onRelease: (seatDriverId: string) => void;
}) {
  const report = state.scouting?.reports?.[driver.id];
  const scouting = state.scouting ? fogView(
    { id: driver.id, skills: driver.skills, potential: driver.potential },
    report,
    state.scouting.networkAccuracy,
    state.randomSeed,
    'Driver',
  ) : null;
  const scoutingLevel = report?.scoutingLevel ?? 0;
  const cost = scoutingCost('Driver', scoutingLevel);
  const budget = state.teams.find((team) => team.id === state.selectedTeamId)?.budget ?? 0;
  const overall = readoutForMarketOverall(state, driver.id, driver.skills, driver.potential, driver.overall);
  const potential = readoutForPotential(state, driver.id, driver.skills, driver.potential);
  const interest = marketDriverOfferInterest(state, driver, orgOverall, carOverall);
  const preferred = preferredSeries(driver.seriesPreferences);
  const rowClass = `${shortlisted ? 'bg-sky-500/5' : ''} ${scouted ? '' : 'opacity-90'}`;

  return (
    <tr className={`border-t border-neutral-800/70 align-middle hover:bg-neutral-900/60 ${rowClass}`}>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <DriverDossierButton state={state} subject={{ type: 'market', driver }} context={`${driver.context} - ${driver.marketStatus}`} focus="market" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-neutral-100">{driver.name}</span>
              {shortlisted && <span className="rounded bg-sky-500/15 px-1 py-0.5 text-[9px] text-sky-300">SHORTLIST</span>}
            </div>
            <div className="truncate text-[10px] text-neutral-500">{driver.nationality} · {driver.primaryRole}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2 tabular-nums text-neutral-300">{driver.age}</td>
      <td className="px-2 py-2 text-neutral-400">
        <div>{driver.context}</div>
        <div className="text-[10px] text-neutral-600">{preferred ? `Prefers ${preferred}` : 'No preference'}</div>
      </td>
      <td className="px-2 py-2 tabular-nums text-amber-300">{overall.label}</td>
      <td className="px-2 py-2 tabular-nums text-sky-300">{potential.label}</td>
      {view === 'scouting' && <td className="px-2 py-2 tabular-nums text-neutral-300">{scoutingLevel}%</td>}
      {view !== 'contract' && <td className="px-2 py-2 tabular-nums text-neutral-300">{driver.f1Readiness.toFixed(0)}</td>}
      {view === 'contract' && (
        <>
          <td className="px-2 py-2 tabular-nums text-neutral-300"><Money m={driver.salary} /></td>
          <td className="px-2 py-2 tabular-nums text-neutral-300"><Money m={driver.buyoutCost} /></td>
        </>
      )}
      <td className="px-2 py-2">
        <div className="flex flex-wrap gap-1">
          <Tag>{driver.marketStatus}</Tag>
          {driver.immediateF1Eligible && <Tag tone="good">F1-ready</Tag>}
          {scouting?.maxed && <Tag tone="good">Report ready</Tag>}
        </div>
      </td>
      <td className="px-2 py-2">
        <div className="flex min-w-[170px] flex-wrap items-center gap-1">
          {!scouting?.maxed && (
            <Button
              variant="secondary"
              className="px-2 py-1 text-[10px]"
              disabled={cost > budget}
              title={cost > budget ? 'Insufficient budget' : undefined}
              onClick={onScout}
            >
              Scout {formatMoney(cost)}
            </Button>
          )}
          {signed ? (
            <span className="text-[10px] text-neutral-500">Signed</span>
          ) : pending ? (
            <>
              <span className="text-[10px] text-green-300">Queued → {seatName(pending.seatDriverId)}</span>
              <button className="text-[10px] text-red-400 hover:text-red-300" onClick={() => onRelease(pending.seatDriverId)}>Cancel</button>
            </>
          ) : canSignRaceDriver ? (
            <Button variant="primary" className="px-2 py-1 text-[10px]" disabled={toMoney(driver.buyoutCost) > budget} onClick={onSignRaceDriver}>Sign</Button>
          ) : offseason && (interest ?? 0) >= 20 ? (
            seats.map((seat) => (
              <Button key={seat.id} variant="ghost" className="px-2 py-1 text-[10px]" onClick={() => onNavigate(`/market/${encodeURIComponent(driver.id)}/negotiate/${encodeURIComponent(seat.id)}`)}>
                Negotiate #{seat.number}
              </Button>
            ))
          ) : canSignThird && thirdFee <= budget ? (
            <Button variant="primary" className="px-2 py-1 text-[10px]" onClick={onSignThird}>3rd driver</Button>
          ) : (
            <button type="button" className="text-[10px] text-sky-300 hover:text-sky-200" onClick={() => onNavigate(`/market?target=${encodeURIComponent(driver.id)}`)}>Review</button>
          )}
        </div>
      </td>
    </tr>
  );
}

function TopSkills({
  state,
  id,
  skills,
  potential,
  exact = false,
  entityType = 'Driver',
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  id: string;
  skills: MarketSkillRatings;
  potential: number;
  exact?: boolean;
  entityType?: ScoutedEntityType;
}) {
  const readout = (key: keyof MarketSkillRatings) =>
    exact ? { value: skills[key], label: skills[key].toFixed(1) } : readoutForMarketSkill(state, id, skills, potential, key, entityType);
  return (
    <div className="grid grid-cols-1 gap-1">
      <StatBar label="Cornering" value={readout('cornering').value ?? 0} max={100} valueLabel={readout('cornering').label} />
      <StatBar label="Braking" value={readout('braking').value ?? 0} max={100} valueLabel={readout('braking').label} />
      <StatBar label="Overtaking" value={readout('overtakingRacecraft').value ?? 0} max={100} valueLabel={readout('overtakingRacecraft').label} />
      <StatBar label="Consistency" value={readout('enduranceConsistency').value ?? 0} max={100} valueLabel={readout('enduranceConsistency').label} />
    </div>
  );
}

function Money({ m }: { m: number }) {
  return <>{formatMoney(m * 1_000_000)}</>;
}

// Buttons to assign an incoming driver to one of the player's seats.
function SeatButtons({
  seats,
  label,
  onPick,
}: {
  seats: Driver[];
  label: string;
  onPick: (seatDriverId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {seats.map((s) => (
        <Button key={s.id} variant="primary" className="px-2 py-1 text-xs" onClick={() => onPick(s.id)}>
          {label} #{s.number}
        </Button>
      ))}
    </div>
  );
}

function YouthTab({
  prospects,
  academy,
  state,
  academyCapacity,
  offseason,
  seats,
  budget,
  signingBySource,
  seatName,
  potLabel,
  onSignYouth,
  onReleaseAcademy,
  onPromote,
  onReleaseSigning,
  onScoutYouth,
}: {
  prospects: YouthProspect[];
  academy: AcademyMember[];
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  academyCapacity: number;
  offseason: boolean;
  seats: Driver[];
  budget: number;
  signingBySource: Map<string, SeatSigning>;
  seatName: (id: string) => string;
  potLabel: (id: string, skills: MarketSkillRatings, potential: number, entityType?: ScoutedEntityType) => string;
  onSignYouth: (youthId: string) => void;
  onReleaseAcademy: (academyId: string) => void;
  onPromote: (academyId: string, seatDriverId: string) => void;
  onReleaseSigning: (seatDriverId: string) => void;
  onScoutYouth: (youthId: string) => void;
}) {
  const [academyPage, setAcademyPage] = useState(0);
  const [prospectPage, setProspectPage] = useState(0);
  const [prospectSort, setProspectSort] = useState<YouthProspectSort>({ key: 'potential', direction: 'desc' });
  const academyByProspect = new Set(academy.map((a) => a.prospectId));
  const available = prospects.filter((p) => !academyByProspect.has(p.id));
  const academyFull = academy.length >= academyCapacity;
  const orderedAcademy = [...academy].sort((a, b) => b.potential - a.potential);
  const academyPageCount = marketPageCount(orderedAcademy.length);
  const safeAcademyPage = Math.min(academyPage, academyPageCount - 1);
  const visibleAcademy = marketPage(orderedAcademy, safeAcademyPage);
  const prospectPageCount = marketPageCount(available.length);
  const safeProspectPage = Math.min(prospectPage, prospectPageCount - 1);
  const orderedProspects = [...available].sort((left, right) => compareYouthProspects(left, right, prospectSort));
  const visibleProspects = marketPage(orderedProspects, safeProspectPage);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-neutral-100">Youth Academy &amp; Prospect Market</h2>
          <p className="text-xs text-neutral-500">All academy members and open prospects in one management view.</p>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${academyFull ? 'bg-amber-500/15 text-amber-300' : 'bg-neutral-800 text-neutral-300'}`}>
          Academy Slots: {academy.length} / {academyCapacity}
        </span>
      </div>

      <div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-100">Your Academy</h2>
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                academyFull ? 'bg-amber-500/15 text-amber-300' : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              Academy Slots: {academy.length} / {academyCapacity}
            </span>
          </div>
          {academyFull && (
            <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Academy Full: Upgrade facilities or improve team rating to expand capacity.
            </p>
          )}
          {academy.length === 0 ? (
            <Panel>
              <p className="text-sm text-neutral-400">
                No academy drivers yet. Sign prospects below; they gain ratings each offseason and can
                be promoted to a race seat once F1-ready.
              </p>
            </Panel>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleAcademy.map((a) => {
                const ready = isAcademyReady(a);
                const pending = signingBySource.get(a.id);
                return (
                  <Panel key={a.id}>
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-neutral-100">{a.name}</div>
                        <div className="text-xs text-neutral-500">{a.nationality}</div>
                      </div>
                      <div className="text-right">
                        <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-sky-300">
                          {a.overall.toFixed(1)} → {a.potential.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
                      {ready ? (
                        <Tag tone="good">F1-ready</Tag>
                      ) : (
                        <Tag>~{a.yearsUntilF1Ready}y to F1</Tag>
                      )}
                    </div>
                    <div className="mb-2">
                      <DriverDossierButton
                        state={state}
                        subject={{ type: 'academy', driver: a }}
                        context="Your Academy"
                        focus="development"
                      />
                    </div>
                    <TopSkills state={state} id={a.id} skills={a.skills} potential={a.potential} exact />
                    <div className="mt-3 border-t border-neutral-800 pt-2">
                      {pending ? (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-green-300">
                            Promoting → {seatName(pending.seatDriverId)}
                          </span>
                          <button
                            className="text-red-400 hover:text-red-300"
                            onClick={() => onReleaseSigning(pending.seatDriverId)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : offseason && ready ? (
                        <SeatButtons
                          seats={seats}
                          label="Promote →"
                          onPick={(seatId) => onPromote(a.id, seatId)}
                        />
                      ) : (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-600">
                            {ready ? 'Promote in the offseason.' : 'Still developing.'}
                          </span>
                          <button
                            className="text-red-400 hover:text-red-300"
                            onClick={() => onReleaseAcademy(a.id)}
                          >
                            Release
                          </button>
                        </div>
                      )}
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
          {academy.length > 0 && (
            <MarketPagination
              label="Academy drivers"
              total={orderedAcademy.length}
              page={safeAcademyPage}
              pageCount={academyPageCount}
              onPage={setAcademyPage}
            />
          )}
        </div>
      </div>

      <div>
        <div>
          <h2 className="mb-2 text-lg font-semibold text-neutral-100">
            Youth Prospects ({available.length} open / {prospects.length} total)
          </h2>
          <div className="overflow-x-auto rounded border border-neutral-800">
            <table className="w-full min-w-[980px] border-collapse text-xs">
              <thead className="bg-neutral-900/70 text-left text-[10px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-2 py-2">Prospect</th>
                  <YouthSortHeader label="Age" sortKey="age" sort={prospectSort} onSort={(key) => setProspectSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })} />
                  <th className="px-2 py-2">Level</th>
                  <YouthSortHeader label="OVR" sortKey="overall" sort={prospectSort} onSort={(key) => setProspectSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'desc' })} />
                  <YouthSortHeader label="POT" sortKey="potential" sort={prospectSort} onSort={(key) => setProspectSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'desc' })} />
                  <YouthSortHeader label="Ready" sortKey="yearsUntilF1Ready" sort={prospectSort} onSort={(key) => setProspectSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })} />
                  <th className="px-2 py-2">Risk</th>
                  <th className="px-2 py-2">Signing</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleProspects.map((y) => (
                  <tr key={y.id} className="border-t border-neutral-800/70 align-middle hover:bg-neutral-900/60">
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <DriverDossierButton state={state} subject={{ type: 'academy', driver: y }} context={`${y.currentLevel} - youth prospect`} focus="development" />
                        <div>
                          <div className="font-semibold text-neutral-100">{y.name}</div>
                          <div className="text-[10px] text-neutral-500">{y.nationality}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 tabular-nums text-neutral-300">{y.age}</td>
                    <td className="px-2 py-2 text-neutral-400">{y.currentLevel}</td>
                    <td className="px-2 py-2 tabular-nums text-neutral-300">{readoutForMarketOverall(state, y.id, y.skills, y.potential, y.overall, 'YouthProspect').label}</td>
                    <td className="px-2 py-2 tabular-nums text-sky-300">{potLabel(y.id, y.skills, y.potential, 'YouthProspect')}</td>
                    <td className="px-2 py-2 tabular-nums text-neutral-300">{y.academyEligibleNow ? 'Now' : `~${y.yearsUntilF1Ready}y`}</td>
                    <td className="px-2 py-2 text-neutral-400">{y.riskLevel}</td>
                    <td className="px-2 py-2 tabular-nums text-neutral-300"><Money m={y.signingCost} /></td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-[10px]"
                          onClick={() => onScoutYouth(y.id)}
                          disabled={!!state.scouting?.reports?.[y.id]?.scoutingLevel && state.scouting.reports[y.id].scoutingLevel >= 100}
                        >
                          {state.scouting?.reports?.[y.id]?.scoutingLevel && state.scouting.reports[y.id].scoutingLevel >= 100 ? 'Scouted' : 'Scout'}
                        </Button>
                        <Button variant="primary" className="px-2 py-1 text-[10px]" disabled={academyFull || toMoney(y.signingCost) > budget} onClick={() => onSignYouth(y.id)}>
                          {academyFull ? 'Full' : toMoney(y.signingCost) > budget ? 'Over budget' : 'Add'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleProspects.length === 0 && <div className="px-3 py-8 text-center text-sm text-neutral-500">No prospects are available.</div>}
          </div>
          <MarketPagination
            label="Youth prospects"
            total={orderedProspects.length}
            page={safeProspectPage}
            pageCount={prospectPageCount}
            onPage={setProspectPage}
          />
        </div>
      </div>
    </div>
  );
}

function Tag({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn';
}) {
  const tones = {
    neutral: 'bg-neutral-800 text-neutral-300',
    good: 'bg-green-500/15 text-green-300',
    warn: 'bg-amber-500/15 text-amber-300',
  };
  return <span className={`rounded px-1.5 py-0.5 ${tones[tone]}`}>{children}</span>;
}

type YouthProspectSortKey = 'name' | 'age' | 'overall' | 'potential' | 'yearsUntilF1Ready';
type YouthProspectSort = { key: YouthProspectSortKey; direction: 'asc' | 'desc' };

function compareYouthProspects(left: YouthProspect, right: YouthProspect, sort: YouthProspectSort): number {
  const leftValue = sort.key === 'name' ? left.name : left[sort.key];
  const rightValue = sort.key === 'name' ? right.name : right[sort.key];
  const direction = sort.direction === 'asc' ? 1 : -1;
  if (leftValue < rightValue) return -1 * direction;
  if (leftValue > rightValue) return direction;
  return left.name.localeCompare(right.name);
}

function YouthSortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: YouthProspectSortKey;
  sort: YouthProspectSort;
  onSort: (key: YouthProspectSortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-2 py-2">
      <button type="button" className="inline-flex items-center gap-1 hover:text-neutral-200" onClick={() => onSort(sortKey)}>
        {label}<span className="text-[9px]">{active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

function MarketPagination({
  label,
  total,
  page,
  pageCount,
  onPage,
}: {
  label: string;
  total: number;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <Button
        variant="secondary"
        className="px-3 py-1 text-xs"
        onClick={() => onPage(Math.max(0, page - 1))}
        disabled={page === 0}
      >
        Previous
      </Button>
      <span className="text-xs text-neutral-500">
        {label} {total ? page * MARKET_PAGE_SIZE + 1 : 0}–{Math.min(total, (page + 1) * MARKET_PAGE_SIZE)} of{' '}
        {total} · Page {page + 1} of {pageCount}
      </span>
      <Button
        variant="secondary"
        className="px-3 py-1 text-xs"
        onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
        disabled={page >= pageCount - 1}
      >
        Next
      </Button>
    </div>
  );
}
