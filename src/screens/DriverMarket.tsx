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
import { competingBidFor } from '../sim/driverBiddingEngine';
import { preferredSeries } from '../sim/seriesPreferenceEngine';
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
import { ScoutingWidget } from '../components/scouting/ScoutingWidget';
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
  YOUTH_MARKET_TABS,
  marketPage,
  marketPageCount,
  type YouthMarketTab,
} from './driverMarketViewModel';
import { transferCalendarView } from './transferCalendarViewModel';

type Tab = 'senior' | 'youth';

export function DriverMarket() {
  const { state, dispatch } = useGame();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('senior');
  const [seniorPage, setSeniorPage] = useState(0);
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
  const seniorPageCount = marketPageCount(seniorDrivers.length);
  const safeSeniorPage = Math.min(seniorPage, seniorPageCount - 1);
  const visibleSeniorDrivers = marketPage(seniorDrivers, safeSeniorPage);

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
        <Panel title="Scouting handoff">
          {seniorDrivers.some((driver) => driver.id === approachedTargetId) ? (
            <p className="text-sm text-neutral-300"><span className="font-semibold">{seniorDrivers.find((driver) => driver.id === approachedTargetId)?.name}</span> is pinned first below. Review the fog-aware report, interest, competing bid, and available contract action before committing.</p>
          ) : (
            <p className="text-sm text-amber-300">This shortlisted target is no longer available in the current market.</p>
          )}
        </Panel>
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
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleSeniorDrivers.map((d) => {
              const interest = marketDriverOfferInterest(state, d, orgOverall, carOverall);
              return (
                <SeniorCard
                  key={d.id}
                  state={state}
                  d={d}
                  offseason={offseason}
                  seats={seats}
                  signed={signedMarketIds.has(d.id)}
                  pending={signingBySource.get(d.id)}
                  potLabel={potLabel(d.id, d.skills, d.potential)}
                  affordable={toMoney(d.buyoutCost) <= budget}
                  canSignThird={canSignThird}
                  canSignRaceDriver={canSignRaceDriver}
                  thirdFee={thirdDriverMidSeasonFee(d.salary, racesRemaining, state.calendar.length)}
                  budget={budget}
                  seatName={seatName}
                  interest={interest}
                  competingBid={competingBidFor(d, state.randomSeed)}
                  onNegotiate={(seatDriverId) => navigate(`/market/${encodeURIComponent(d.id)}/negotiate/${encodeURIComponent(seatDriverId)}`)}
                  onSignThird={() => dispatch({ type: 'SIGN_THIRD_DRIVER', marketId: d.id })}
                  onSignRaceDriver={() => dispatch({ type: 'SIGN_RACE_DRIVER', marketId: d.id })}
                  onRelease={(seatDriverId) =>
                    dispatch({ type: 'RELEASE_SIGNING', seatDriverId })
                  }
                />
              );
            })}
          </div>
          <MarketPagination
            label="Senior drivers"
            total={seniorDrivers.length}
            page={safeSeniorPage}
            pageCount={seniorPageCount}
            onPage={setSeniorPage}
          />
        </div>
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
        />
      )}
      </WorkspaceBody>
    </WorkspaceScreen>
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

// A driver's interest in a cross-series move: colour + short label.
function interestTone(interest: number): string {
  if (interest >= 60) return 'text-green-400';
  if (interest >= 40) return 'text-amber-300';
  return 'text-red-400';
}

function interestLabel(interest: number): string {
  if (interest >= 70) return 'keen';
  if (interest >= 50) return 'open';
  if (interest >= 35) return 'reluctant';
  return 'unwilling';
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

function SeniorCard({
  state,
  d,
  offseason,
  seats,
  signed,
  pending,
  potLabel,
  affordable,
  canSignThird,
  canSignRaceDriver,
  thirdFee,
  budget,
  seatName,
  interest,
  competingBid,
  onNegotiate,
  onSignThird,
  onSignRaceDriver,
  onRelease,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  d: MarketDriver;
  offseason: boolean;
  seats: Driver[];
  signed: boolean;
  pending?: SeatSigning;
  potLabel: string;
  affordable: boolean;
  canSignThird: boolean;
  canSignRaceDriver: boolean;
  thirdFee: number;
  budget: number;
  seatName: (id: string) => string;
  interest?: number;
  competingBid: number;
  onNegotiate: (seatDriverId: string) => void;
  onSignThird: () => void;
  onSignRaceDriver: () => void;
  onRelease: (seatDriverId: string) => void;
}) {
  const overallReadout = readoutForMarketOverall(state, d.id, d.skills, d.potential, d.overall);
  const preferred = preferredSeries(d.seriesPreferences);
  return (
    <Panel>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-neutral-100">{d.name}</span>
            {d.marketPool === 'crossSeries' && (
              <span className="rounded bg-sky-900/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                Crossover
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-500">
            {d.nationality} · {d.age} · {d.context}
          </div>
        </div>
        <div className="text-right">
          <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-amber-300">
            {overallReadout.label}
          </span>
          <div className="mt-0.5 text-[10px] text-neutral-500">POT {potLabel}</div>
        </div>
      </div>

      <div className="mb-2">
        <DriverDossierButton
          state={state}
          subject={{ type: 'market', driver: d }}
          context={`${d.context} - ${d.marketStatus}`}
          focus="market"
        />
      </div>
      <div className="mb-2">
        <ScoutingWidget target={{ id: d.id, skills: d.skills, potential: d.potential }} entityType="Driver" compact />
      </div>

      <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
        <Tag>{d.marketStatus}</Tag>
        <Tag>{d.primaryRole}</Tag>
        {preferred && <Tag tone={preferred === state.series ? 'good' : 'neutral'}>Prefers {preferred}</Tag>}
        {d.immediateF1Eligible && <Tag tone="good">F1-ready</Tag>}
        <Tag tone="warn">{d.negotiationDifficulty} difficulty</Tag>
      </div>

      <TopSkills state={state} id={d.id} skills={d.skills} potential={d.potential} />

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Salary/yr">
          <Money m={d.salary} />
        </Stat>
        <Stat label="Buyout">
          <Money m={d.buyoutCost} />
        </Stat>
        <Stat label="Sponsor/yr">
          <Money m={d.sponsorValue} />
        </Stat>
      </div>

      <div className="mt-3 border-t border-neutral-800 pt-2">
        {signed ? (
          <span className="text-xs text-neutral-500">Already racing for you.</span>
        ) : canSignRaceDriver ? (
          <Button
            variant="primary"
            className="w-full px-2 py-1 text-xs"
            disabled={!affordable}
            title={affordable ? undefined : 'Insufficient budget for this signing'}
            onClick={onSignRaceDriver}
          >
            Sign as Race Driver ({(d.buyoutCost).toFixed(1)}M)
          </Button>
        ) : pending ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-green-300">Queued → replaces {seatName(pending.seatDriverId)}</span>
            <button
              className="text-red-400 hover:text-red-300"
              onClick={() => onRelease(pending.seatDriverId)}
            >
              Cancel
            </button>
          </div>
        ) : offseason && !affordable ? (
          <span className="text-xs text-red-400">Buyout exceeds budget.</span>
        ) : offseason ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>Rival interest</span>
              {competingBid > 0 ? (
                <span className="tabular-nums text-amber-300">~<Money m={competingBid} /></span>
              ) : (
                <span className="text-neutral-500">None</span>
              )}
            </div>
            {interest != null && (
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>Series interest</span>
                <span className={`tabular-nums font-semibold ${interestTone(interest)}`}>
                  {Math.round(interest)}/100 · {interestLabel(interest)}
                </span>
              </div>
            )}
            {interest != null && interest < 20 ? (
              <span className="text-xs text-red-400">
                Won't switch series — not interested in this move at any price.
              </span>
            ) : (
              <>
                <SeatButtons seats={seats} label="Negotiate →" onPick={onNegotiate} />
              </>
            )}
          </div>
        ) : canSignThird && thirdFee > budget ? (
          <span className="text-xs text-red-400">
            3rd-driver fee {formatMoney(thirdFee)} exceeds budget.
          </span>
        ) : canSignThird ? (
          <Button variant="primary" className="w-full px-2 py-1 text-xs" onClick={onSignThird}>
            Sign as 3rd driver — {formatMoney(thirdFee)}
          </Button>
        ) : (
          <span className="text-xs text-neutral-600">Signings open in the offseason.</span>
        )}
      </div>

      {d.notes && <p className="mt-2 text-[11px] italic text-neutral-500">{d.notes}</p>}
    </Panel>
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
}) {
  const [youthTab, setYouthTab] = useState<YouthMarketTab>('academy');
  const [academyPage, setAcademyPage] = useState(0);
  const [prospectPage, setProspectPage] = useState(0);
  const academyByProspect = new Set(academy.map((a) => a.prospectId));
  const available = prospects.filter((p) => !academyByProspect.has(p.id));
  const academyFull = academy.length >= academyCapacity;
  const orderedAcademy = [...academy].sort((a, b) => b.potential - a.potential);
  const academyPageCount = marketPageCount(orderedAcademy.length);
  const safeAcademyPage = Math.min(academyPage, academyPageCount - 1);
  const visibleAcademy = marketPage(orderedAcademy, safeAcademyPage);
  const prospectPageCount = marketPageCount(available.length);
  const safeProspectPage = Math.min(prospectPage, prospectPageCount - 1);
  const visibleProspects = marketPage(available, safeProspectPage);

  return (
    <div className="space-y-3">
      <nav
        className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1"
        aria-label="Youth market sections"
      >
        {YOUTH_MARKET_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setYouthTab(item.id)}
            aria-current={youthTab === item.id ? 'page' : undefined}
            className={`rounded px-3 py-2 text-xs font-semibold transition-colors ${
              youthTab === item.id
                ? 'bg-sky-500 text-neutral-950'
                : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
            }`}
          >
            {item.label} ({item.id === 'academy' ? academy.length : available.length})
          </button>
        ))}
      </nav>

      {youthTab === 'academy' && (
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
      )}

      {youthTab === 'prospects' && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-neutral-100">
            Youth Prospects ({available.length} open / {prospects.length} total)
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleProspects.map((y) => {
              const preferred = preferredSeries(y.seriesPreferences);
              return (
              <Panel key={y.id}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-neutral-100">{y.name}</div>
                    <div className="text-xs text-neutral-500">
                      {y.nationality} · age {y.age} · {y.currentLevel}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-sky-300">
                      POT {potLabel(y.id, y.skills, y.potential, 'YouthProspect')}
                    </span>
                    <div className="mt-0.5 text-[10px] text-neutral-500">
                      now {readoutForMarketOverall(state, y.id, y.skills, y.potential, y.overall, 'YouthProspect').label}
                    </div>
                  </div>
                </div>
                <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
                  {y.academyEligibleNow && <Tag tone="good">Eligible now</Tag>}
                  {preferred && <Tag tone={preferred === state.series ? 'good' : 'neutral'}>Prefers {preferred}</Tag>}
                  <Tag>{y.riskLevel} risk</Tag>
                  <Tag>~{y.yearsUntilF1Ready}y to F1</Tag>
                </div>
                <div className="mb-2">
                  <DriverDossierButton
                    state={state}
                    subject={{ type: 'academy', driver: y }}
                    context={`${y.currentLevel} - youth prospect`}
                    focus="development"
                  />
                </div>
                <div className="mb-2">
                  <ScoutingWidget target={{ id: y.id, skills: y.skills, potential: y.potential }} entityType="YouthProspect" compact />
                </div>
                <TopSkills state={state} id={y.id} skills={y.skills} potential={y.potential} entityType="YouthProspect" />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Signing">
                    <Money m={y.signingCost} />
                  </Stat>
                  <Stat label="Academy/yr">
                    <Money m={y.yearlyAcademyCost} />
                  </Stat>
                </div>
                <div className="mt-3 border-t border-neutral-800 pt-2">
                  <Button
                    variant="primary"
                    className="w-full px-2 py-1 text-xs"
                    disabled={academyFull || toMoney(y.signingCost) > budget}
                    onClick={() => onSignYouth(y.id)}
                  >
                    {academyFull
                      ? 'Academy full'
                      : toMoney(y.signingCost) > budget
                        ? 'Insufficient budget'
                        : 'Add to Academy'}
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-neutral-400">{y.suggestedPath}</p>
              </Panel>
              );
            })}
          </div>
          <MarketPagination
            label="Youth prospects"
            total={available.length}
            page={safeProspectPage}
            pageCount={prospectPageCount}
            onPage={setProspectPage}
          />
        </div>
      )}
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

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded bg-neutral-800/50 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-semibold tabular-nums text-neutral-200">{children}</div>
    </div>
  );
}
