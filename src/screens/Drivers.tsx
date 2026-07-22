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
                        canNegotiate={canNegotiateContracts}
                        latestOffer={latestContractOffer(driver.id)}
                        onOpen={openNegotiation}
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
                    canNegotiate={canNegotiateContracts}
                    latestOffer={latestContractOffer(reserve.id)}
                    onOpen={openNegotiation}
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
          <Panel title="Grid Directory" className="mb-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="px-2 py-1.5 text-left">#</th>
                    <th className="px-2 py-1.5 text-left">Driver</th>
                    <th className="px-2 py-1.5 text-left">Team</th>
                    <th className="px-2 py-1.5 text-right">OVR</th>
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
