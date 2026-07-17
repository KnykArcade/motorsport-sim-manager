import { useState } from 'react';
import { useGame } from '../game/GameContext';
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
import { formatMoney } from '../components/ui';
import { readoutForDriverRating } from '../components/scouting/ratingDisplay';
import { driverExtensionSigningFee } from '../sim/contractEngine';
import { driverScoutTarget } from '../sim/scoutingEngine';
import {
  activeDriversForTeam,
  reserveDriversForTeam,
  teamById,
} from '../game/careerState';
import { contractClauseLabel, DRIVER_NEGOTIATION_CLAUSES } from '../sim/phase18ContractClauseEngine';
import type { ContractClause, ContractClauseType } from '../types/phase18Types';
import type { CharacterFutureIntent } from '../types/characterInteractionTypes';
import { characterFutureIntentLabel, futureIntentForTarget } from '../sim/characterFutureIntentEngine';
import {
  DRIVER_DIRECTORY_PAGE_SIZE,
  DRIVERS_TABS,
  driverDirectoryPage,
  driverDirectoryPageCount,
  type DriversTab,
} from './driversViewModel';

export function Drivers() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<DriversTab>('lineup');
  const [directoryPage, setDirectoryPage] = useState(0);
  if (!state) return null;

  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color ?? '#666';

  const ordered = state.drivers;
  const directoryPageCount = driverDirectoryPageCount(ordered.length);
  const safeDirectoryPage = Math.min(directoryPage, directoryPageCount - 1);
  const visibleDirectoryDrivers = driverDirectoryPage(ordered, safeDirectoryPage);

  const playerTeam = teamById(state, state.selectedTeamId);
  const raceSeats = activeDriversForTeam(state, state.selectedTeamId);
  const reserves = reserveDriversForTeam(state, state.selectedTeamId);
  const racesRemaining = Math.max(1, state.calendar.length - state.currentRaceIndex);
  const teamBudget = playerTeam?.budget ?? 0;
  const canNegotiateContracts = state.gameMode !== 'SingleSeason' && !state.seasonComplete;
  const extensionCost = (driver: typeof state.drivers[number], years: number, offerMultiplier = 1) =>
    Math.round(driverExtensionSigningFee(driver, years, racesRemaining, state.calendar.length) * offerMultiplier);
  const extendDriver = (driverId: string, years: number, offerMultiplier: number, clauseType?: ContractClauseType) =>
    dispatch({ type: 'EXTEND_DRIVER_CONTRACT', driverId, years, offerMultiplier, clauseType });
  const activeClause = (driverId: string) => state.phase18?.contractClauses.find((clause) =>
    clause.partyId === driverId && clause.status === 'Active',
  );
  const contractOfferNews = state.news.filter((item) => item.id.startsWith('news-contract-offer-'));
  const latestContractOffer = (driverId: string) => contractOfferNews.find((item) => item.driverId === driverId);
  const expiringContracts = [...raceSeats, ...reserves].filter(
    (driver) => (driver.contractYearsRemaining ?? 1) <= 1,
  ).length;
  const driverTabs = DRIVERS_TABS.map((item) => ({
    ...item,
    label: item.id === 'lineup'
      ? `${item.label} (${raceSeats.length})`
      : item.id === 'reserves'
        ? `${item.label} (${reserves.length})`
        : `${item.label} (${ordered.length})`,
  }));

  return (
    <WorkspaceScreen className="era-feature-screen era-drivers">
      <WorkspaceHeader
        eyebrow="Recruitment center"
        title="Drivers"
        subtitle={`${playerTeam?.name ?? 'Team'} · lineup, contracts, reserves, and grid directory`}
      />

      <MetricStrip>
        <WorkspaceMetric label="Race seats" value={`${raceSeats.length} / 2`} detail={raceSeats.length >= 2 ? 'Lineup complete' : 'Action required'} />
        <WorkspaceMetric label="Reserve drivers" value={reserves.length} detail="Third, reserve, and test roles" />
        <WorkspaceMetric label="Expiring contracts" value={expiringContracts} detail="One season or less remaining" />
        <WorkspaceMetric label="Driver budget" value={formatMoney(teamBudget)} detail="Available team balance" />
      </MetricStrip>

      <WorkspaceTabs items={driverTabs} active={tab} onChange={setTab} ariaLabel="Driver roster sections" />

      <WorkspaceBody>

      {tab === 'lineup' && playerTeam && (
        <Panel className="ring-1 ring-amber-500/60">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">
              Your Race Lineup — {playerTeam.name}
            </h2>
            <span className="text-xs text-neutral-500">Only two cars per team race</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1].map((seat) => {
              const driver = raceSeats[seat];
              return (
                <div key={seat} className="rounded border border-neutral-700 bg-neutral-900/60 p-3">
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    Car {seat + 1}
                  </div>
                  {driver ? (
                    <>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-neutral-100">
                            #{driver.number} {driver.name}
                          </span>
                          <span className="ml-2 rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-amber-300">
                            {driver.ratings.overall.toFixed(1)}
                          </span>
                        </div>
                        <DriverDossierButton
                          state={state}
                          subject={{ type: 'driver', driver }}
                          context={`Car ${seat + 1} - ${playerTeam.name}`}
                          focus="relationship"
                        />
                      </div>
                      <ContractExtensionControls
                        driver={driver}
                        budget={teamBudget}
                        canNegotiate={canNegotiateContracts}
                        extensionCost={extensionCost}
                        latestOffer={latestContractOffer(driver.id)}
                        currentClause={activeClause(driver.id)}
                        futureIntent={futureIntentForTarget(state, { type: 'Driver', id: driver.id, name: driver.name, teamId: driver.teamId })}
                        onExtend={extendDriver}
                      />
                    </>
                  ) : (
                    <div className="mt-1 text-sm text-neutral-500">Empty seat</div>
                  )}
                </div>
              );
            })}
          </div>

          {contractOfferNews.length > 0 && (
            <div className="mt-4 rounded border border-neutral-800 bg-neutral-950/45 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Recent Contract Responses</div>
              <div className="space-y-1.5">
                {contractOfferNews.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-xs">
                    <span className={item.id.includes('-accepted-') ? 'font-semibold text-green-300' : 'font-semibold text-red-300'}>
                      {item.headline}
                    </span>
                    <span className="shrink-0 text-neutral-500">News Center</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </Panel>
      )}

      {tab === 'reserves' && playerTeam && (
        <Panel title={`Reserve Drivers — ${playerTeam.name}`}>
          {reserves.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {reserves.map((reserve) => (
                <div key={reserve.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-neutral-200">
                      #{reserve.number} {reserve.name}{' '}
                      <span className="text-xs text-amber-300/80">{reserve.ratings.overall.toFixed(1)}</span>
                      {reserve.contractType === 'third' && (
                        <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300">
                          3rd driver
                        </span>
                      )}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <DriverDossierButton
                        state={state}
                        subject={{ type: 'driver', driver: reserve }}
                        context={`Reserve - ${playerTeam.name}`}
                        focus="development"
                      />
                      {[0, 1].map((seat) => (
                        <Button
                          key={seat}
                          variant="ghost"
                          onClick={() =>
                            dispatch({
                              type: 'SWAP_RACE_DRIVER',
                              seatIndex: seat,
                              reserveDriverId: reserve.id,
                            })
                          }
                        >
                          → Car {seat + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <ContractExtensionControls
                    driver={reserve}
                    budget={teamBudget}
                    canNegotiate={canNegotiateContracts}
                    extensionCost={extensionCost}
                    latestOffer={latestContractOffer(reserve.id)}
                    currentClause={activeClause(reserve.id)}
                    futureIntent={futureIntentForTarget(state, {
                      type: 'Driver',
                      id: reserve.id,
                      name: reserve.name,
                      teamId: reserve.teamId,
                    })}
                    onExtend={extendDriver}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded border border-dashed border-neutral-700 px-4 py-8 text-center text-sm text-neutral-500">
              No reserve or test drivers are currently signed.
            </div>
          )}
        </Panel>
      )}

      {tab === 'directory' && (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleDirectoryDrivers.map((d) => {
              const isPlayer = d.teamId === state.selectedTeamId;
              const overall = readoutForDriverRating(state, d, 'overall');
              const stat = (key: keyof typeof d.ratings) => readoutForDriverRating(state, d, key);
              return (
                <Panel key={d.id} className={isPlayer ? 'ring-1 ring-amber-500/60' : ''}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-1.5 rounded-sm" style={{ backgroundColor: teamColor(d.teamId) }} />
                      <span className="font-bold text-neutral-100">#{d.number} {d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs font-semibold text-amber-300">
                        {overall.label}
                      </span>
                      <DriverDossierButton
                        state={state}
                        subject={{ type: 'driver', driver: d }}
                        context={teamName(d.teamId)}
                        focus={isPlayer ? 'relationship' : 'identity'}
                      />
                    </div>
                  </div>
                  <div className="mb-2 text-xs text-neutral-500">{teamName(d.teamId)}</div>
                  {!isPlayer && (
                    <div className="mb-2">
                      <ScoutingWidget target={driverScoutTarget(d)} entityType="Driver" compact />
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-1">
                    <StatBar label="Qualifying" value={stat('qualifying').value ?? 0} max={100} valueLabel={stat('qualifying').label} />
                    <StatBar label="Race Pace" value={stat('racePace').value ?? 0} max={100} valueLabel={stat('racePace').label} />
                    <StatBar label="Morale" value={d.morale} max={100} valueLabel={`${d.morale.toFixed(1)}`} />
                    <StatBar label="Confidence" value={d.confidence} max={100} valueLabel={`${d.confidence.toFixed(1)}`} />
                  </div>
                </Panel>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2">
            <Button
              variant="secondary"
              className="px-3 py-1 text-xs"
              onClick={() => setDirectoryPage(Math.max(0, safeDirectoryPage - 1))}
              disabled={safeDirectoryPage === 0}
            >
              Previous
            </Button>
            <span className="text-xs text-neutral-500">
              Drivers {ordered.length ? safeDirectoryPage * DRIVER_DIRECTORY_PAGE_SIZE + 1 : 0}–
              {Math.min(ordered.length, (safeDirectoryPage + 1) * DRIVER_DIRECTORY_PAGE_SIZE)} of {ordered.length} ·
              Page {safeDirectoryPage + 1} of {directoryPageCount}
            </span>
            <Button
              variant="secondary"
              className="px-3 py-1 text-xs"
              onClick={() => setDirectoryPage(Math.min(directoryPageCount - 1, safeDirectoryPage + 1))}
              disabled={safeDirectoryPage >= directoryPageCount - 1}
            >
              Next
            </Button>
          </div>
        </>
      )}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function ContractExtensionControls({
  driver,
  budget,
  canNegotiate,
  extensionCost,
  latestOffer,
  currentClause,
  futureIntent,
  onExtend,
}: {
  driver: NonNullable<ReturnType<typeof useGame>['state']>['drivers'][number];
  budget: number;
  canNegotiate: boolean;
  extensionCost: (driver: NonNullable<ReturnType<typeof useGame>['state']>['drivers'][number], years: number, offerMultiplier?: number) => number;
  latestOffer?: NonNullable<ReturnType<typeof useGame>['state']>['news'][number];
  currentClause?: ContractClause;
  futureIntent?: CharacterFutureIntent;
  onExtend: (driverId: string, years: number, offerMultiplier: number, clauseType?: ContractClauseType) => void;
}) {
  const [clauseType, setClauseType] = useState<ContractClauseType>(currentClause?.clauseType ?? 'EqualTreatment');
  const yearsLeft = driver.contractYearsRemaining ?? 1;
  const maxed = yearsLeft >= 5;
  if (!canNegotiate) {
    return (
      <div className="mt-2 text-[11px] text-neutral-500">
        Contract: {yearsLeft} yr{yearsLeft === 1 ? '' : 's'} remaining
      </div>
    );
  }
  const oneYearCost = extensionCost(driver, 1);
  const strongOneYearCost = extensionCost(driver, 1, 1.35);
  const twoYearCost = extensionCost(driver, 2, 1.2);
  const accepted = latestOffer?.id.includes('-accepted-') ?? false;
  return (
    <div className="mt-2 border-t border-neutral-800 pt-2 text-[11px]">
      {futureIntent && (
        <div className={`mb-2 rounded border px-2 py-1.5 ${futureIntent.status === 'WantsExit' ? 'border-red-500/35 bg-red-500/10' : futureIntent.status === 'TestingMarket' ? 'border-amber-500/35 bg-amber-500/10' : 'border-emerald-500/25 bg-emerald-500/5'}`}>
          <div className="flex items-center justify-between gap-2"><span className="font-semibold text-neutral-200">{characterFutureIntentLabel(futureIntent.target, futureIntent.status)}</span><span className="text-neutral-500">Leverage {futureIntent.leverage}</span></div>
          <div className="mt-0.5 text-neutral-400">Renewal willingness {futureIntent.negotiationModifier > 0 ? '+' : ''}{futureIntent.negotiationModifier}. {futureIntent.reason}</div>
        </div>
      )}
      {currentClause && (
        <div className="mb-2 rounded border border-sky-500/25 bg-sky-500/5 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sky-300">Active clause: {contractClauseLabel(currentClause.clauseType)}</span>
            <span className="text-neutral-500">{currentClause.risk ?? 'Secure'}</span>
          </div>
          <div className="mt-0.5 text-neutral-400">{currentClause.triggerDescription ?? currentClause.description}</div>
        </div>
      )}
      {!maxed && (
        <label className="mb-2 flex items-center justify-between gap-2 text-neutral-400">
          <span>Contract promise</span>
          <select value={clauseType} onChange={(event) => setClauseType(event.target.value as ContractClauseType)} className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-neutral-200">
            {DRIVER_NEGOTIATION_CLAUSES.map((type) => <option key={type} value={type}>{contractClauseLabel(type)}</option>)}
          </select>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto text-neutral-500">
          Contract: <span className="text-neutral-300">{yearsLeft} yr{yearsLeft === 1 ? '' : 's'} left</span>
          <span className="ml-1 text-neutral-600">offer required</span>
        </span>
        {maxed ? (
          <span className="rounded bg-neutral-800 px-2 py-1 text-neutral-400">Max term</span>
        ) : (
          <>
            {yearsLeft <= 3 && (
              <Button
                variant="ghost"
                className="px-2 py-1 text-[11px]"
                disabled={twoYearCost > budget}
                title={twoYearCost > budget ? 'Insufficient budget' : `Preferred multi-year offer ${formatMoney(twoYearCost)}`}
                onClick={() => onExtend(driver.id, 2, 1.2, clauseType)}
              >
                Preferred +2 ({formatMoney(twoYearCost)})
              </Button>
            )}
            <Button
              variant="ghost"
              className="px-2 py-1 text-[11px]"
              disabled={strongOneYearCost > budget}
              title={strongOneYearCost > budget ? 'Insufficient budget' : `Improved short-term offer ${formatMoney(strongOneYearCost)}`}
              onClick={() => onExtend(driver.id, 1, 1.35, clauseType)}
            >
              Better +1 ({formatMoney(strongOneYearCost)})
            </Button>
            <Button
              variant="ghost"
              className="px-2 py-1 text-[11px]"
              disabled={oneYearCost > budget}
              title={oneYearCost > budget ? 'Insufficient budget' : `Short-term offer ${formatMoney(oneYearCost)}; secure drivers may push for more years`}
              onClick={() => onExtend(driver.id, 1, 1, clauseType)}
            >
              Offer +1 ({formatMoney(oneYearCost)})
            </Button>
          </>
        )}
      </div>
      {latestOffer && (
        <div className={`mt-2 rounded border px-2 py-1 ${accepted ? 'border-green-500/35 bg-green-500/10 text-green-300' : 'border-red-500/35 bg-red-500/10 text-red-300'}`}>
          <div className="font-semibold">{accepted ? 'Accepted' : 'Refused'}: {latestOffer.headline}</div>
          {latestOffer.body && <div className="mt-0.5 text-neutral-400">{latestOffer.body}</div>}
        </div>
      )}
    </div>
  );
}
