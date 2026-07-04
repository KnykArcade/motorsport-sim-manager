import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { activeDriversForTeam, carForTeam, driversForTeam, teamById, MAX_RACE_DRIVERS } from '../game/careerState';
import { isPreseason } from '../game/rosterEnforcement';
import { isSingleSeasonMode } from '../game/modeRestrictions';
import { careerMarketBundle } from '../sim/careerMarketEngine';
import { marketDriverOfferInterest } from '../sim/crossSeriesEngine';
import { carPerformanceRating } from '../sim/trackFitEngine';
import { isAcademyReady } from '../sim/driverMarketEngine';
import { academyCapacityFor } from '../sim/teamRatingsEngine';
import { toMoney } from '../sim/financeEngine';
import { thirdDriverMidSeasonFee } from '../sim/contractEngine';
import { fogView } from '../sim/scoutingEngine';
import { competingBidFor, bidToWin, resolveDriverBid } from '../sim/driverBiddingEngine';
import { Panel } from '../components/Panel';
import { StatBar } from '../components/StatBar';
import { Button } from '../components/Button';
import { DriverDossierButton } from '../components/driverCards/DriverDossier';
import { formatMoney } from '../components/ui';
import type {
  AcademyMember,
  MarketDriver,
  MarketSkillRatings,
  SeatSigning,
  YouthProspect,
} from '../types/marketTypes';
import type { Driver } from '../types/gameTypes';

type Tab = 'senior' | 'youth' | 'crossover';

export function DriverMarket() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<Tab>('senior');

  const bundle = useMemo(
    () => (state ? careerMarketBundle(state) : undefined),
    [state],
  );

  // Split the senior pool into same-series drivers and cross-series (foreign)
  // candidates so each has its own tab.
  const seniorDrivers = useMemo(
    () => (bundle?.drivers ?? []).filter((d) => d.marketPool !== 'crossSeries'),
    [bundle],
  );
  const crossoverDrivers = useMemo(
    () => (bundle?.drivers ?? []).filter((d) => d.marketPool === 'crossSeries'),
    [bundle],
  );

  if (!state) return null;

  const singleSeason = isSingleSeasonMode(state.gameMode);
  const offseason = state.seasonComplete;
  const preseason = isPreseason(state);
  const budget = teamById(state, state.selectedTeamId)?.budget ?? 0;
  const orgOverall = state.teamOrgRatings?.[state.selectedTeamId]?.overallTeamRating ?? 50;
  const playerCar = carForTeam(state, state.selectedTeamId);
  const carOverall = playerCar ? carPerformanceRating(playerCar) : 5;
  const seats = activeDriversForTeam(state, state.selectedTeamId);
  const roster = driversForTeam(state, state.selectedTeamId);
  const openRaceSeats = MAX_RACE_DRIVERS - seats.length;
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

  // Fogged potential label: scouted targets show an exact ceiling, the rest a
  // range you can narrow on the Scouting screen.
  const scouting = state.scouting;
  const potLabel = (id: string, skills: MarketSkillRatings, potential: number): string => {
    if (!scouting) return potential.toFixed(1);
    const v = fogView({ id, skills, potential }, scouting.reports[id], scouting.networkAccuracy, state.randomSeed);
    const [lo, hi] = v.potential.range;
    return `${lo.toFixed(1)}-${hi.toFixed(1)}`;
  };

  return (
    <div className="era-feature-screen era-driver-market space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Driver Market</h1>
          <p className="text-sm text-neutral-400">
            {singleSeason
              ? `Current-season driver management for ${state.seasonYear}.`
              : `Scout senior drivers for ${state.seasonYear + 1} and grow under-18 talent in your academy.`}
            {' '}Budget: <span className="font-semibold text-neutral-200">{formatMoney(budget)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <TabButton active={tab === 'senior'} onClick={() => setTab('senior')}>
            Senior Market{bundle ? ` (${seniorDrivers.length})` : ''}
          </TabButton>
          <TabButton active={tab === 'crossover'} onClick={() => setTab('crossover')}>
            Crossover{bundle ? ` (${crossoverDrivers.length})` : ''}
          </TabButton>
          {!singleSeason && (
            <TabButton active={tab === 'youth'} onClick={() => setTab('youth')}>
              Youth Academy{bundle ? ` (${bundle.youth.length})` : ''}
            </TabButton>
          )}
        </div>
      </div>

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

      {bundle && tab === 'crossover' && crossoverDrivers.length === 0 && (
        <Panel>
          <p className="text-sm text-neutral-400">
            No drivers from other series are open to switching into {state.series} right now.
            Seatless, younger, and veteran drivers are the most willing to cross over as the
            universe grows.
          </p>
        </Panel>
      )}

      {bundle && (tab === 'senior' || tab === 'crossover') && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...(tab === 'senior' ? seniorDrivers : crossoverDrivers)]
            .sort((a, b) => b.overall - a.overall)
            .map((d) => {
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
                suggestedBid={bidToWin(d, orgOverall, state.randomSeed, interest)}
                teamOverall={orgOverall}
                seed={state.randomSeed}
                onSign={(seatDriverId, bid) =>
                  dispatch({ type: 'SIGN_MARKET_DRIVER', marketId: d.id, seatDriverId, bid })
                }
                onSignThird={() => dispatch({ type: 'SIGN_THIRD_DRIVER', marketId: d.id })}
                onSignRaceDriver={() => dispatch({ type: 'SIGN_RACE_DRIVER', marketId: d.id })}
                onRelease={(seatDriverId) =>
                  dispatch({ type: 'RELEASE_SIGNING', seatDriverId })
                }
              />
              );
            })}
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
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm ${
        active
          ? 'bg-amber-500 font-semibold text-neutral-950'
          : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  );
}

function TopSkills({ skills }: { skills: MarketSkillRatings }) {
  return (
    <div className="grid grid-cols-1 gap-1">
      <StatBar label="Cornering" value={skills.cornering} />
      <StatBar label="Braking" value={skills.braking} />
      <StatBar label="Overtaking" value={skills.overtakingRacecraft} />
      <StatBar label="Consistency" value={skills.enduranceConsistency} />
    </div>
  );
}

function Money({ m }: { m: number }) {
  return <>{formatMoney(m * 1_000_000)}</>;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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
  suggestedBid,
  teamOverall,
  seed,
  onSign,
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
  suggestedBid: number;
  teamOverall: number;
  seed: string;
  onSign: (seatDriverId: string, bid: number) => void;
  onSignThird: () => void;
  onSignRaceDriver: () => void;
  onRelease: (seatDriverId: string) => void;
}) {
  const [bid, setBid] = useState<number>(round1(Math.max(d.buyoutCost, suggestedBid)));
  const resolution = resolveDriverBid(bid, d, teamOverall, seed, interest);
  const affordableBid = toMoney(bid) <= budget;
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
            {d.overall.toFixed(1)}
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

      <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
        <Tag>{d.marketStatus}</Tag>
        <Tag>{d.primaryRole}</Tag>
        {d.immediateF1Eligible && <Tag tone="good">F1-ready</Tag>}
        <Tag tone="warn">{d.negotiationDifficulty} difficulty</Tag>
      </div>

      <TopSkills skills={d.skills} />

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
            {resolution.refused ? (
              <span className="text-xs text-red-400">
                Won't switch series — not interested in this move at any price.
              </span>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-neutral-500">Your bid ($M)</label>
                  <input
                    type="number"
                    min={d.buyoutCost}
                    step={0.1}
                    value={bid}
                    onChange={(e) => setBid(round1(Math.max(d.buyoutCost, Number(e.target.value) || 0)))}
                    className="w-20 rounded bg-neutral-800 px-2 py-1 text-xs tabular-nums text-neutral-100"
                  />
                  <span className={`text-[11px] font-semibold ${resolution.won ? 'text-green-400' : 'text-red-400'}`}>
                    {resolution.won ? 'Winning bid' : 'Likely outbid'}
                  </span>
                </div>
                {!affordableBid ? (
                  <span className="text-xs text-red-400">Bid exceeds budget.</span>
                ) : (
                  <SeatButtons seats={seats} label="Bid →" onPick={(seatId) => onSign(seatId, bid)} />
                )}
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
  potLabel: (id: string, skills: MarketSkillRatings, potential: number) => string;
  onSignYouth: (youthId: string) => void;
  onReleaseAcademy: (academyId: string) => void;
  onPromote: (academyId: string, seatDriverId: string) => void;
  onReleaseSigning: (seatDriverId: string) => void;
}) {
  const academyByProspect = new Set(academy.map((a) => a.prospectId));
  const available = [...prospects]
    .filter((p) => !academyByProspect.has(p.id))
    .sort((a, b) => b.potential - a.potential);
  const academyFull = academy.length >= academyCapacity;

  return (
    <div className="space-y-6">
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
            {[...academy]
              .sort((a, b) => b.potential - a.potential)
              .map((a) => {
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
                    <TopSkills skills={a.skills} />
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
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold text-neutral-100">
          Available Prospects ({available.length})
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {available.map((y) => (
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
                    POT {potLabel(y.id, y.skills, y.potential)}
                  </span>
                  <div className="mt-0.5 text-[10px] text-neutral-500">now {y.overall.toFixed(1)}</div>
                </div>
              </div>
              <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
                {y.academyEligibleNow && <Tag tone="good">Eligible now</Tag>}
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
              <TopSkills skills={y.skills} />
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
          ))}
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

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded bg-neutral-800/50 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-semibold tabular-nums text-neutral-200">{children}</div>
    </div>
  );
}
