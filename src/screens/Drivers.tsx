import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
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
import { formatMoney, ratingColor } from '../components/ui';
import { readoutForDriverRating } from '../components/scouting/ratingDisplay';
import { driverScoutTarget } from '../sim/scoutingEngine';
import {
  activeDriversForTeam,
  reserveDriversForTeam,
  teamById,
} from '../game/careerState';
import {
  DRIVER_DIRECTORY_PAGE_SIZE,
  DRIVERS_TABS,
  driverDirectoryPage,
  driverDirectoryPageCount,
  type DriversTab,
} from './driversViewModel';

export function Drivers() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<DriversTab>('lineup');
  const [directoryPage, setDirectoryPage] = useState(0);
  const [driverSort, setDriverSort] = useState<DriverSort>({ key: 'overall', direction: 'desc' });
  if (!state) return null;

  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color ?? '#666';

  const ordered = state.drivers;
  const directoryPageCount = driverDirectoryPageCount(ordered.length);
  const safeDirectoryPage = Math.min(directoryPage, directoryPageCount - 1);
  const orderedDirectoryDrivers = [...ordered].sort((left, right) => compareDrivers(left, right, driverSort));
  const visibleDirectoryDrivers = driverDirectoryPage(orderedDirectoryDrivers, safeDirectoryPage);

  const playerTeam = teamById(state, state.selectedTeamId);
  const raceSeats = activeDriversForTeam(state, state.selectedTeamId);
  const reserves = reserveDriversForTeam(state, state.selectedTeamId);
  const sortedRaceSeats = [...raceSeats].sort((left, right) => compareDrivers(left, right, driverSort));
  const sortedReserves = [...reserves].sort((left, right) => compareDrivers(left, right, driverSort));
  const teamBudget = playerTeam?.budget ?? 0;
  const canNegotiateContracts = state.gameMode !== 'SingleSeason' && !state.seasonComplete;
  const openNegotiation = (driverId: string) => {
    dispatch({ type: 'START_DRIVER_CONTRACT_NEGOTIATION', driverId });
    navigate(`/drivers/${driverId}/negotiate`);
  };
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
      <div className="ui-decision-strip flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="ui-decision-strip-pulse" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-neutral-100">Roster operations desk</div>
            <div className="truncate text-neutral-400">
              {raceSeats.length < 2
                ? `Action required: ${2 - raceSeats.length} race seat${2 - raceSeats.length === 1 ? '' : 's'} still open.`
                : expiringContracts > 0
                  ? `${expiringContracts} contract${expiringContracts === 1 ? '' : 's'} need attention before the next signing window.`
                  : 'Race lineup is complete and no immediate contract review is due.'}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {raceSeats.length}/2 race seats filled
        </span>
      </div>

      {tab === 'lineup' && playerTeam && (
        <Panel className="ring-1 ring-amber-500/60">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">
              Your Race Lineup — {playerTeam.name}
            </h2>
            <span className="text-xs text-neutral-500">Only two cars per team race</span>
          </div>
          <DriverRosterTable
            state={state}
            drivers={sortedRaceSeats}
            sort={driverSort}
            onSort={(key) => setDriverSort((current) => current.key === key
              ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
              : { key, direction: 'desc' })}
            seatLabel={(driver) => `Car ${raceSeats.findIndex((entry) => entry.id === driver.id) + 1}`}
            context={(driver) => `Car ${raceSeats.findIndex((entry) => entry.id === driver.id) + 1} - ${playerTeam.name}`}
            focus="relationship"
            canNegotiate={canNegotiateContracts}
            latestContractOffer={latestContractOffer}
            onOpenNegotiation={openNegotiation}
          />

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
            <DriverRosterTable
              state={state}
              drivers={sortedReserves}
              sort={driverSort}
              onSort={(key) => setDriverSort((current) => current.key === key
                ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: 'desc' })}
              seatLabel={(driver) => driver.contractType === 'third' ? '3rd driver' : 'Reserve'}
              context={() => `Reserve - ${playerTeam.name}`}
              focus="development"
              canNegotiate={canNegotiateContracts}
              latestContractOffer={latestContractOffer}
              onOpenNegotiation={openNegotiation}
              reserveActions={(driver) => [0, 1].map((seat) => (
                <Button
                  key={seat}
                  variant="ghost"
                  onClick={() => dispatch({ type: 'SWAP_RACE_DRIVER', seatIndex: seat, reserveDriverId: driver.id })}
                >
                  → Car {seat + 1}
                </Button>
              ))}
            />
          ) : (
            <div className="rounded border border-dashed border-neutral-700 px-4 py-8 text-center text-sm text-neutral-500">
              No reserve or test drivers are currently signed.
            </div>
          )}
        </Panel>
      )}

      {tab === 'directory' && (
        <>
          <Panel title="Grid Directory" className="mb-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="px-2 py-1.5 text-left"><DriverSortHeader label="#" sortKey="number" sort={driverSort} onSort={(key) => setDriverSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })} /></th>
                    <th className="px-2 py-1.5 text-left"><DriverSortHeader label="Driver" sortKey="name" sort={driverSort} onSort={(key) => setDriverSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })} /></th>
                    <th className="px-2 py-1.5 text-left">Team</th>
                    <th className="px-2 py-1.5 text-right"><DriverSortHeader label="OVR" sortKey="overall" sort={driverSort} onSort={(key) => setDriverSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'desc' })} /></th>
                    <th className="px-2 py-1.5 text-right">Qual</th>
                    <th className="px-2 py-1.5 text-right">Pace</th>
                    <th className="px-2 py-1.5 text-right">Mor</th>
                    <th className="px-2 py-1.5 text-right">Con</th>
                    <th className="px-2 py-1.5 text-left">Intel</th>
                    <th className="px-2 py-1.5 text-right">Card</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDirectoryDrivers.map((d) => {
                    const isPlayer = d.teamId === state.selectedTeamId;
                    return (
                      <tr key={d.id} className={`border-b border-neutral-900 ${isPlayer ? 'bg-amber-500/5' : ''}`}>
                        <td className="px-2 py-1.5 text-left tabular-nums text-neutral-400">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-4 w-1 shrink-0 rounded-sm" style={{ backgroundColor: teamColor(d.teamId) }} />
                            {d.number}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-left font-semibold text-neutral-100">{d.name}</td>
                        <td className="px-2 py-1.5 text-left text-xs text-neutral-400">{teamName(d.teamId)}</td>
                        <RatingCell readout={readoutForDriverRating(state, d, 'overall')} />
                        <RatingCell readout={readoutForDriverRating(state, d, 'qualifying')} />
                        <RatingCell readout={readoutForDriverRating(state, d, 'racePace')} />
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: ratingColor(d.morale) }}>{d.morale.toFixed(0)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color: ratingColor(d.confidence) }}>{d.confidence.toFixed(0)}</td>
                        <td className="px-2 py-1.5 text-left">
                          {isPlayer ? (
                            <span className="text-xs text-neutral-600">—</span>
                          ) : (
                            <ScoutingWidget target={driverScoutTarget(d)} entityType="Driver" compact />
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <DriverDossierButton
                            state={state}
                            subject={{ type: 'driver', driver: d }}
                            context={teamName(d.teamId)}
                            focus={isPlayer ? 'relationship' : 'identity'}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
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

function RatingCell({ readout }: { readout: ReturnType<typeof readoutForDriverRating> }) {
  const color = readout.value != null ? ratingColor(readout.value) : '#6b7280';
  return (
    <td className="px-2 py-1.5 text-right tabular-nums font-semibold" style={{ color }}>
      {readout.label}
    </td>
  );
}

type DriverSortKey = 'name' | 'number' | 'overall' | 'morale' | 'confidence';
type DriverSort = { key: DriverSortKey; direction: 'asc' | 'desc' };
type RosterDriver = NonNullable<ReturnType<typeof useGame>['state']>['drivers'][number];

function compareDrivers(left: RosterDriver, right: RosterDriver, sort: DriverSort): number {
  const value = (driver: RosterDriver): number | string => {
    if (sort.key === 'name') return driver.name;
    if (sort.key === 'number') return driver.number;
    if (sort.key === 'overall') return driver.ratings.overall;
    if (sort.key === 'morale') return driver.morale;
    return driver.confidence;
  };
  const leftValue = value(left);
  const rightValue = value(right);
  const direction = sort.direction === 'asc' ? 1 : -1;
  if (leftValue < rightValue) return -1 * direction;
  if (leftValue > rightValue) return direction;
  return left.name.localeCompare(right.name);
}

function DriverRosterTable({
  state,
  drivers,
  sort,
  onSort,
  seatLabel,
  context,
  focus,
  canNegotiate,
  latestContractOffer,
  onOpenNegotiation,
  reserveActions,
}: {
  state: NonNullable<ReturnType<typeof useGame>['state']>;
  drivers: RosterDriver[];
  sort: DriverSort;
  onSort: (key: DriverSortKey) => void;
  seatLabel: (driver: RosterDriver) => string;
  context: (driver: RosterDriver) => string;
  focus: 'relationship' | 'development';
  canNegotiate: boolean;
  latestContractOffer: (driverId: string) => NonNullable<ReturnType<typeof useGame>['state']>['news'][number] | undefined;
  onOpenNegotiation: (driverId: string) => void;
  reserveActions?: (driver: RosterDriver) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded border border-neutral-800">
      <table className="w-full min-w-[760px] border-collapse text-xs">
        <thead className="bg-neutral-900/70 text-left text-[10px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-2 py-2">Seat</th>
            <DriverSortHeader label="Driver" sortKey="name" sort={sort} onSort={onSort} />
            <DriverSortHeader label="OVR" sortKey="overall" sort={sort} onSort={onSort} />
            <DriverSortHeader label="Morale" sortKey="morale" sort={sort} onSort={onSort} />
            <DriverSortHeader label="Confidence" sortKey="confidence" sort={sort} onSort={onSort} />
            <th className="px-2 py-2">Contract</th>
            <th className="px-2 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((driver) => (
            <tr key={driver.id} className="border-t border-neutral-800/70 align-middle hover:bg-neutral-900/60">
              <td className="px-2 py-2 text-neutral-400">{seatLabel(driver)}</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <DriverDossierButton state={state} subject={{ type: 'driver', driver }} context={context(driver)} focus={focus} />
                  <span className="font-semibold text-neutral-100">#{driver.number} {driver.name}</span>
                </div>
              </td>
              <td className="px-2 py-2 tabular-nums text-amber-300">{driver.ratings.overall.toFixed(1)}</td>
              <td className="px-2 py-2 tabular-nums" style={{ color: ratingColor(driver.morale) }}>{driver.morale.toFixed(0)}</td>
              <td className="px-2 py-2 tabular-nums" style={{ color: ratingColor(driver.confidence) }}>{driver.confidence.toFixed(0)}</td>
              <td className="px-2 py-2">
                <ContractExtensionControls
                  driver={driver}
                  canNegotiate={canNegotiate}
                  latestOffer={latestContractOffer(driver.id)}
                  onOpen={onOpenNegotiation}
                />
              </td>
              <td className="px-2 py-2">
                <div className="flex flex-wrap gap-1">{reserveActions?.(driver)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {drivers.length === 0 && <div className="px-3 py-8 text-center text-sm text-neutral-500">No drivers are currently listed.</div>}
    </div>
  );
}

function DriverSortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: DriverSortKey;
  sort: DriverSort;
  onSort: (key: DriverSortKey) => void;
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

function ContractExtensionControls({
  driver,
  canNegotiate,
  latestOffer,
  onOpen,
}: {
  driver: NonNullable<ReturnType<typeof useGame>['state']>['drivers'][number];
  canNegotiate: boolean;
  latestOffer?: NonNullable<ReturnType<typeof useGame>['state']>['news'][number];
  onOpen: (driverId: string) => void;
}) {
  const yearsLeft = driver.contractYearsRemaining ?? 1;
  const maxed = yearsLeft >= 5;
  if (!canNegotiate) {
    return (
      <div className="mt-2 text-[11px] text-neutral-500">
        Contract: {yearsLeft} yr{yearsLeft === 1 ? '' : 's'} remaining
      </div>
    );
  }
  const accepted = latestOffer?.id.includes('-accepted-') ?? false;
  return (
    <div className="mt-2 border-t border-neutral-800 pt-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-auto text-neutral-500">
          Contract: <span className="text-neutral-300">{yearsLeft} yr{yearsLeft === 1 ? '' : 's'} left</span>
          <span className="ml-1 text-neutral-600">agent talks required</span>
        </span>
        {maxed ? (
          <span className="rounded bg-neutral-800 px-2 py-1 text-neutral-400">Max term</span>
        ) : (
          <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => onOpen(driver.id)}>Open Negotiation →</Button>
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
