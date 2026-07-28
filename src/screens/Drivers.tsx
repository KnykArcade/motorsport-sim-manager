import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../game/GameContext';
import { Button } from '../components/Button';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  FmDecisionBar,
  FmKeyValue,
  FmListButton,
  FmPane,
  FmPaneBody,
  FmPaneHeader,
  FmWorkspaceGrid,
} from '../components/workspace/FmPane';
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
  DRIVERS_TABS,
  DRIVER_DIRECTORY_PAGE_SIZE,
  driverDirectoryPage,
  driverDirectoryPageCount,
  selectedDriver,
  type DriversTab,
} from './driversViewModel';
import { EntityBrowseControls } from '../components/EntityBrowseControls';

export function Drivers() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: DriversTab = requestedTab === 'reserves' || requestedTab === 'directory'
    ? requestedTab
    : 'lineup';
  const requestedSort = searchParams.get('sort') as DriverSortKey | null;
  const driverSort: DriverSort = {
    key: requestedSort && ['name', 'number', 'overall', 'morale', 'confidence'].includes(requestedSort)
      ? requestedSort
      : 'overall',
    direction: searchParams.get('order') === 'asc' ? 'asc' : 'desc',
  };
  const requestedDirectoryPage = Math.max(0, Number(searchParams.get('page') ?? 0) || 0);
  const selectedDriverId = searchParams.get('driver') ?? undefined;
  if (!state) return null;

  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? id;
  const teamColor = (id: string) => state.teams.find((t) => t.id === id)?.color ?? '#666';

  const ordered = state.drivers;
  const directoryPageCount = driverDirectoryPageCount(ordered.length);
  const orderedDirectoryDrivers = [...ordered].sort((left, right) => compareDrivers(left, right, driverSort));
  const requestedDriverIndex = selectedDriverId
    ? orderedDirectoryDrivers.findIndex((driver) => driver.id === selectedDriverId)
    : -1;
  const exactDriverPage = tab === 'directory' && requestedDriverIndex >= 0
    ? Math.floor(requestedDriverIndex / DRIVER_DIRECTORY_PAGE_SIZE)
    : requestedDirectoryPage;
  const safeDirectoryPage = Math.min(exactDriverPage, directoryPageCount - 1);
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
  const driversInView = tab === 'lineup'
    ? sortedRaceSeats
    : tab === 'reserves'
      ? sortedReserves
      : visibleDirectoryDrivers;
  const selected = selectedDriver(driversInView, selectedDriverId);
  const selectedIsPlayer = selected?.teamId === state.selectedTeamId;
  const selectedSeatIndex = selected ? raceSeats.findIndex((driver) => driver.id === selected.id) : -1;
  const selectedRole = selectedSeatIndex >= 0
    ? `Car ${selectedSeatIndex + 1}`
    : selected?.contractType === 'third'
      ? 'Third driver'
      : selected?.contractType === 'reserve' || selected?.contractType === 'test'
        ? 'Reserve / test'
        : 'Grid driver';
  const selectedIndex = selected
    ? driversInView.findIndex((driver) => driver.id === selected.id)
    : -1;

  const updateQuery = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  };

  const setDriversTab = (next: DriversTab) => {
    updateQuery({
      tab: next,
      driver: undefined,
      page: undefined,
    });
  };
  const selectDriverId = (driverId: string | undefined) => {
    updateQuery({ driver: driverId });
  };
  const browseDriver = (offset: number) => {
    if (!driversInView.length || selectedIndex < 0) return;
    const nextIndex = (selectedIndex + offset + driversInView.length) % driversInView.length;
    selectDriverId(driversInView[nextIndex].id);
  };

  return (
    <WorkspaceScreen className="era-feature-screen era-drivers ui-team-people-screen">
      <WorkspaceHeader
        eyebrow="Recruitment center"
        title="Drivers"
        subtitle={`${playerTeam?.name ?? 'Team'} · lineup, contracts, reserves, and grid directory`}
      />
      <WorkspaceTabs items={driverTabs} active={tab} onChange={setDriversTab} ariaLabel="Driver roster sections" />

      <WorkspaceBody className="overflow-hidden">
        <FmWorkspaceGrid columns="three">
          <FmPane>
            <FmPaneHeader title={tab === 'lineup' ? 'Race Lineup' : tab === 'reserves' ? 'Reserve Drivers' : 'Grid Directory'} meta={`${driversInView.length} in view`} />
            <div className="ui-team-list-tools">
              <label>
                Sort
                <select
                  value={driverSort.key}
                  onChange={(event) => {
                    const key = event.target.value as DriverSortKey;
                    updateQuery({
                      sort: key,
                      order: key === 'name' || key === 'number' ? 'asc' : 'desc',
                      page: undefined,
                      driver: undefined,
                    });
                  }}
                >
                  <option value="overall">Overall</option>
                  <option value="name">Name</option>
                  <option value="number">Number</option>
                  <option value="morale">Morale</option>
                  <option value="confidence">Confidence</option>
                </select>
              </label>
              <button type="button" onClick={() => updateQuery({ order: driverSort.direction === 'asc' ? 'desc' : 'asc' })}>
                {driverSort.direction === 'asc' ? 'Ascending' : 'Descending'}
              </button>
            </div>
            <FmPaneBody className="overflow-auto">
              {driversInView.map((driver) => (
                <FmListButton key={driver.id} active={selected?.id === driver.id} onClick={() => selectDriverId(driver.id)}>
                  <span className="ui-news-list-source">#{driver.number} · {teamName(driver.teamId)}</span>
                  <strong><i style={{ backgroundColor: teamColor(driver.teamId) }} />{driver.name}</strong>
                  <span>OVR {readoutForDriverRating(state, driver, 'overall').label} · Morale {driver.morale.toFixed(0)}</span>
                  <small>{driver.teamId === state.selectedTeamId ? (raceSeats.some((entry) => entry.id === driver.id) ? 'Race driver' : 'Reserve / test') : 'Rival driver'}</small>
                </FmListButton>
              ))}
              {driversInView.length === 0 && <div className="ui-inbox-empty">No drivers are available in this section.</div>}
            </FmPaneBody>
            {tab === 'directory' && (
              <div className="ui-team-list-pagination">
                <button type="button" onClick={() => updateQuery({ page: Math.max(0, safeDirectoryPage - 1), driver: undefined })} disabled={safeDirectoryPage === 0}>Previous</button>
                <span>{safeDirectoryPage + 1} / {directoryPageCount}</span>
                <button type="button" onClick={() => updateQuery({ page: Math.min(directoryPageCount - 1, safeDirectoryPage + 1), driver: undefined })} disabled={safeDirectoryPage >= directoryPageCount - 1}>Next</button>
              </div>
            )}
          </FmPane>

          <FmPane className="ui-driver-profile-pane">
            {selected ? (
              <>
                <FmPaneHeader
                  title={`#${selected.number} ${selected.name}`}
                  meta={`${selectedRole} · ${teamName(selected.teamId)}`}
                  actions={(
                    <EntityBrowseControls
                      position={Math.max(0, selectedIndex)}
                      total={driversInView.length}
                      noun="drivers"
                      onPrevious={() => browseDriver(-1)}
                      onNext={() => browseDriver(1)}
                    />
                  )}
                />
                <FmPaneBody className="ui-driver-profile-body overflow-auto">
                  <section className="ui-profile-identity-strip">
                    <div className="ui-profile-number" style={{ borderColor: teamColor(selected.teamId) }}>{selected.number}</div>
                    <div>
                      <span>{selectedRole}</span>
                      <h2>{selected.name}</h2>
                      <p>{teamName(selected.teamId)} · {selected.contractYearsRemaining ?? 1} year contract</p>
                    </div>
                    <DriverDossierButton
                      state={state}
                      subject={{ type: 'driver', driver: selected }}
                      context={`${selectedRole} · ${teamName(selected.teamId)}`}
                      focus={selectedIsPlayer ? (tab === 'reserves' ? 'development' : 'relationship') : 'identity'}
                    />
                  </section>
                  <section>
                    <h3 className="ui-fm-section-label">Driver attributes</h3>
                    <div className="ui-driver-attribute-grid">
                      <DriverAttribute label="Overall" value={readoutForDriverRating(state, selected, 'overall').label} score={selectedIsPlayer ? selected.ratings.overall : undefined} />
                      <DriverAttribute label="Qualifying" value={readoutForDriverRating(state, selected, 'qualifying').label} score={selectedIsPlayer ? selected.ratings.qualifying : undefined} />
                      <DriverAttribute label="Race pace" value={readoutForDriverRating(state, selected, 'racePace').label} score={selectedIsPlayer ? selected.ratings.racePace : undefined} />
                      <DriverAttribute label="Morale" value={selected.morale.toFixed(0)} score={selected.morale} />
                      <DriverAttribute label="Confidence" value={selected.confidence.toFixed(0)} score={selected.confidence} />
                      <DriverAttribute label="Composure" value={selected.ratings.composure.toFixed(0)} score={selected.ratings.composure} />
                    </div>
                  </section>
                  {selectedIsPlayer && (
                    <section className="ui-driver-contract-block">
                      <h3 className="ui-fm-section-label">Contract and role</h3>
                      <ContractExtensionControls driver={selected} canNegotiate={canNegotiateContracts} latestOffer={latestContractOffer(selected.id)} onOpen={openNegotiation} />
                      {tab === 'reserves' && (
                        <div className="ui-driver-seat-actions">
                          {[0, 1].map((seat) => (
                            <Button key={seat} variant="ghost" onClick={() => dispatch({ type: 'SWAP_RACE_DRIVER', seatIndex: seat, reserveDriverId: selected.id })}>Move to Car {seat + 1}</Button>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                  {!selectedIsPlayer && (
                    <section>
                      <h3 className="ui-fm-section-label">Recruitment intelligence</h3>
                      <ScoutingWidget target={driverScoutTarget(selected)} entityType="Driver" compact />
                    </section>
                  )}
                </FmPaneBody>
              </>
            ) : <FmPaneBody className="ui-inbox-empty">Select a driver to open their profile.</FmPaneBody>}
          </FmPane>

          <FmPane>
            <FmPaneHeader title="Driver Context" meta={playerTeam?.name ?? 'Team'} />
            <FmPaneBody className="ui-team-context-pane overflow-auto">
              <section>
                <h3>Roster status</h3>
                <FmKeyValue label="Race seats" value={`${raceSeats.length}/2`} />
                <FmKeyValue label="Reserves" value={reserves.length} />
                <FmKeyValue label="Expiring" value={expiringContracts} />
                <FmKeyValue label="Budget" value={formatMoney(teamBudget)} />
              </section>
              {selected && (
                <>
                  <section>
                    <h3>Selected driver</h3>
                    <FmKeyValue label="Role" value={selectedRole} />
                    <FmKeyValue label="Contract" value={`${selected.contractYearsRemaining ?? 1} yr`} />
                    <FmKeyValue label="Morale" value={selected.morale.toFixed(0)} />
                    <FmKeyValue label="Confidence" value={selected.confidence.toFixed(0)} />
                  </section>
                  <section>
                    <h3>Next action</h3>
                    <p>{selectedIsPlayer ? 'Review the driver relationship, development plan, or contract position.' : 'Use the scouting report before making a recruitment decision.'}</p>
                    {selectedIsPlayer && <button type="button" onClick={() => navigate('/curves')}>Open development plans →</button>}
                  </section>
                </>
              )}
            </FmPaneBody>
          </FmPane>
        </FmWorkspaceGrid>
      </WorkspaceBody>
      <FmDecisionBar>
        <strong className="text-neutral-200">
          {raceSeats.length < 2
            ? `${2 - raceSeats.length} race seat${2 - raceSeats.length === 1 ? '' : 's'} still open`
            : expiringContracts
              ? `${expiringContracts} contract${expiringContracts === 1 ? '' : 's'} need attention`
              : 'Race lineup complete'}
        </strong>
        <span> · {raceSeats.length}/2 seats filled</span>
      </FmDecisionBar>
    </WorkspaceScreen>
  );
}

function DriverAttribute({ label, value, score }: { label: string; value: string; score?: number }) {
  return (
    <div>
      <span>{label}</span>
      <strong style={{ color: score == null ? undefined : ratingColor(score) }}>{value}</strong>
    </div>
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
