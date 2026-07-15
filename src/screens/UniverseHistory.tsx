import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import type {
  DriverCareerStats,
  SeasonHistoryRecord,
  TeamCareerStats,
  UniverseChampionshipSeason,
  UniverseChampionshipState,
  UniverseDriverMovement,
} from '../types/universeTypes';
import type { Series } from '../types/gameTypes';
import { LegacyArchive } from '../components/history/LegacyArchive';

type Tab = 'records' | 'legacy' | 'drivers' | 'teams' | 'seasons' | 'world' | 'grid';

export function UniverseHistory() {
  const { state } = useGame();
  const [tab, setTab] = useState<Tab>('records');
  const [recordView, setRecordView] = useState<'drivers' | 'teams'>('drivers');

  const history = state?.universeHistory;

  const nameOfDriver = useMemo(() => {
    const fromState = new Map((state?.drivers ?? []).map((d) => [d.id, d.name] as const));
    return (id?: string) =>
      id ? history?.driverCareerStats[id]?.name ?? fromState.get(id) ?? id : '—';
  }, [state, history]);
  const nameOfTeam = useMemo(() => {
    const fromState = new Map((state?.teams ?? []).map((t) => [t.id, t.name] as const));
    return (id?: string) =>
      id ? history?.teamCareerStats[id]?.name ?? fromState.get(id) ?? id : '—';
  }, [state, history]);

  if (!state) return null;

  const seasons = history?.seasons ?? [];
  const drivers = Object.values(history?.driverCareerStats ?? {});
  const teams = Object.values(history?.teamCareerStats ?? {});
  const worldSeasons = Object.values(state.motorsportUniverse?.championships ?? {})
    .flatMap((championship) => championship?.seasonHistory ?? [])
    .sort((a, b) => b.seasonYear - a.seasonYear || a.series.localeCompare(b.series));
  const worldChampionships = state.motorsportUniverse?.championships ?? {};
  const worldSeatCount = Object.values(worldChampionships)
    .reduce((total, championship) => total + (championship?.drivers.length ?? 0), 0);

  if (seasons.length === 0 && worldSeasons.length === 0 && worldSeatCount === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <Panel>
          <p className="text-sm text-neutral-400">
            No seasons recorded yet. Finish a season to start building your universe's record book —
            champions, race winners, poles and career stats are archived at each offseason.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Header />
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === 'records'} onClick={() => setTab('records')}>
            Records
          </TabButton>
          <TabButton active={tab === 'legacy'} onClick={() => setTab('legacy')}>
            Legacy
          </TabButton>
          <TabButton active={tab === 'drivers'} onClick={() => setTab('drivers')}>
            Drivers
          </TabButton>
          <TabButton active={tab === 'teams'} onClick={() => setTab('teams')}>
            Teams
          </TabButton>
          <TabButton active={tab === 'seasons'} onClick={() => setTab('seasons')}>
            Seasons ({seasons.length})
          </TabButton>
          <TabButton active={tab === 'world'} onClick={() => setTab('world')}>
            World Championships ({worldSeasons.length})
          </TabButton>
          <TabButton active={tab === 'grid'} onClick={() => setTab('grid')}>
            World Grid ({worldSeatCount})
          </TabButton>
        </div>
      </div>

      {tab === 'records' && (
        <div className="space-y-3">
          <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-950/70 p-1">
            <TabButton active={recordView === 'drivers'} onClick={() => setRecordView('drivers')}>Driver Records</TabButton>
            <TabButton active={recordView === 'teams'} onClick={() => setRecordView('teams')}>Team Records</TabButton>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recordView === 'drivers' ? <>
          <RecordCard
            label="Most Race Wins"
            holder={nameOfDriver(history?.records.mostWinsDriverId)}
            value={drivers.find((d) => d.driverId === history?.records.mostWinsDriverId)?.wins}
          />
          <RecordCard
            label="Most Drivers' Titles"
            holder={nameOfDriver(history?.records.mostTitlesDriverId)}
            value={drivers.find((d) => d.driverId === history?.records.mostTitlesDriverId)?.driverTitles}
          />
          <RecordCard
            label="Most Poles"
            holder={nameOfDriver(history?.records.mostPolesDriverId)}
            value={drivers.find((d) => d.driverId === history?.records.mostPolesDriverId)?.poles}
          />
          <RecordCard label="Most Podiums" holder={nameOfDriver(history?.records.mostPodiumsDriverId)} value={drivers.find((d) => d.driverId === history?.records.mostPodiumsDriverId)?.podiums} />
          <RecordCard label="Most Fastest Laps" holder={nameOfDriver(history?.records.mostFastestLapsDriverId)} value={drivers.find((d) => d.driverId === history?.records.mostFastestLapsDriverId)?.fastestLaps} />
          <RecordCard label="Most Career Points" holder={nameOfDriver(history?.records.mostPointsDriverId)} value={drivers.find((d) => d.driverId === history?.records.mostPointsDriverId)?.points} />
          </> : <>
          <RecordCard
            label="Most Constructor Wins"
            holder={nameOfTeam(history?.records.mostWinsTeamId)}
            value={teams.find((t) => t.teamId === history?.records.mostWinsTeamId)?.wins}
          />
          <RecordCard
            label="Most Constructors' Titles"
            holder={nameOfTeam(history?.records.mostTitlesTeamId)}
            value={teams.find((t) => t.teamId === history?.records.mostTitlesTeamId)?.constructorTitles}
          />
          <RecordCard label="Most Team Podiums" holder={nameOfTeam(history?.records.mostPodiumsTeamId)} value={teams.find((t) => t.teamId === history?.records.mostPodiumsTeamId)?.podiums} />
          <RecordCard label="Most Team Poles" holder={nameOfTeam(history?.records.mostPolesTeamId)} value={teams.find((t) => t.teamId === history?.records.mostPolesTeamId)?.poles} />
          <RecordCard label="Most Team Points" holder={nameOfTeam(history?.records.mostPointsTeamId)} value={teams.find((t) => t.teamId === history?.records.mostPointsTeamId)?.points} />
          </>}
          </div>
        </div>
      )}

      {tab === 'legacy' && <LegacyArchive legacy={state.phase18!.legacy} />}

      {tab === 'drivers' && <DriverTable drivers={drivers} />}
      {tab === 'teams' && <TeamTable teams={teams} />}
      {tab === 'seasons' && (
        <div className="space-y-3">
          {[...seasons]
            .sort((a, b) => b.seasonYear - a.seasonYear)
            .map((s) => (
              <SeasonCard
                key={`${s.seasonYear}-${s.series}`}
                season={s}
                nameOfDriver={nameOfDriver}
                nameOfTeam={nameOfTeam}
              />
            ))}
        </div>
      )}
      {tab === 'world' && (
        <div className="space-y-3">
          {worldSeasons.length > 0 ? (
            worldSeasons.map((season) => (
              <WorldSeasonCard key={`${season.seasonYear}-${season.series}`} season={season} />
            ))
          ) : (
            <Panel>
              <p className="text-sm text-neutral-400">
                Off-screen championship results will appear after the first completed season.
              </p>
            </Panel>
          )}
        </div>
      )}
      {tab === 'grid' && <WorldGrid championships={worldChampionships} />}
    </div>
  );
}

export function WorldGrid({
  championships,
}: {
  championships: Partial<Record<Series, UniverseChampionshipState>>;
}) {
  const entries = Object.values(championships)
    .filter((championship): championship is UniverseChampionshipState => Boolean(championship))
    .sort((a, b) => a.series.localeCompare(b.series));
  const movements = entries
    .flatMap((championship) => championship.movementHistory ?? [])
    .sort((a, b) => b.effectiveYear - a.effectiveYear || a.series.localeCompare(b.series) || a.id.localeCompare(b.id))
    .slice(0, 30);

  return (
    <div className="space-y-4">
      {entries.map((championship) => {
        const drivers = new Map(championship.drivers.map((driver) => [driver.driverId, driver]));
        return (
          <Panel key={championship.series}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div className="font-bold text-neutral-100">{championship.series}</div>
              <div className="text-xs text-neutral-500">{championship.seasonYear} grid</div>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {championship.teams.map((team) => (
                <div key={team.teamId} className="rounded border border-neutral-800 bg-neutral-950/40 p-2.5">
                  <div className="text-sm font-semibold text-neutral-200">{team.name}</div>
                  <div className="mt-1 space-y-0.5">
                    {team.driverIds.map((driverId) => {
                      const driver = drivers.get(driverId);
                      return (
                        <div key={driverId} className="flex justify-between gap-3 text-xs">
                          <span className="text-neutral-300">{driver?.name ?? driverId}</span>
                          {driver && (
                            <span className="whitespace-nowrap text-neutral-500">
                              {driver.contractYearsRemaining} yr{driver.contractYearsRemaining === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        );
      })}

      <Panel>
        <div className="font-bold text-neutral-100">Recent Driver Moves</div>
        {movements.length > 0 ? (
          <div className="mt-2 divide-y divide-neutral-800/70">
            {movements.map((movement) => <MovementRow key={movement.id} movement={movement} />)}
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-400">
            Driver renewals, releases, transfers and signings will appear after the first offseason.
          </p>
        )}
      </Panel>
    </div>
  );
}

function MovementRow({ movement }: { movement: UniverseDriverMovement }) {
  const detail = movement.kind === 'renewal'
    ? `renewed with ${movement.toTeamName ?? movement.fromTeamName ?? 'their team'}`
    : movement.kind === 'release'
      ? `released by ${movement.fromTeamName ?? 'their team'}`
      : movement.kind === 'transfer'
        ? `moved from ${movement.fromTeamName ?? 'another team'} to ${movement.toTeamName ?? 'a new team'}`
        : `signed for ${movement.toTeamName ?? 'a new team'}`;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
      <div>
        <span className="font-semibold text-neutral-200">{movement.driverName}</span>{' '}
        <span className="text-neutral-400">{detail}</span>
      </div>
      <div className="text-xs text-neutral-500">{movement.effectiveYear} · {movement.series}</div>
    </div>
  );
}

export function WorldSeasonCard({ season }: { season: UniverseChampionshipSeason }) {
  const topFive = season.driverStandings.slice(0, 5);
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-bold text-neutral-100">{season.seasonYear} {season.series}</div>
          <div className="mt-0.5 text-sm text-neutral-300">
            🏆 {season.driverChampionName ?? season.driverChampionId ?? '—'}
            <span className="text-neutral-500"> · </span>
            {season.teamChampionName ?? season.teamChampionId ?? '—'}
          </div>
        </div>
        <div className="text-xs text-neutral-500">{season.completedRaces} races</div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-500">
              <th className="py-1 pr-2">Pos</th>
              <th className="py-1 pr-2">Driver</th>
              <Th>Points</Th>
              <Th>Wins</Th>
              <Th>Podiums</Th>
            </tr>
          </thead>
          <tbody>
            {topFive.map((standing, index) => (
              <tr key={standing.entityId} className="border-t border-neutral-800/60">
                <td className="py-1 pr-2 text-neutral-500">{index + 1}</td>
                <td className="py-1 pr-2 font-medium text-neutral-200">
                  {season.driverNames[standing.entityId] ?? standing.entityId}
                </td>
                <Td highlight={index === 0}>{Math.round(standing.points)}</Td>
                <Td>{standing.wins}</Td>
                <Td>{standing.podiums}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-100">Universe History</h1>
      <p className="text-sm text-neutral-400">
        Your alternate-history record book — champions, race winners, all-time records and career
        stats accumulated across every season you've played.
      </p>
    </div>
  );
}

function RecordCard({
  label,
  holder,
  value,
}: {
  label: string;
  holder: string;
  value?: number;
}) {
  return (
    <Panel>
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-neutral-100">{holder}</div>
      {value != null && (
        <div className="text-sm font-semibold text-amber-300">{value}</div>
      )}
    </Panel>
  );
}

function DriverTable({ drivers }: { drivers: DriverCareerStats[] }) {
  const rows = [...drivers].sort(
    (a, b) => b.driverTitles - a.driverTitles || b.wins - a.wins || b.points - a.points,
  );
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-500">
              <th className="py-1 pr-2">Driver</th>
              <Th>Titles</Th>
              <Th>Wins</Th>
              <Th>Podiums</Th>
              <Th>Poles</Th>
              <Th>FL</Th>
              <Th>Starts</Th>
              <Th>Points</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.driverId} className="border-t border-neutral-800/60">
                <td className="py-1 pr-2 font-medium text-neutral-200">{d.name}</td>
                <Td highlight={d.driverTitles > 0}>{d.driverTitles}</Td>
                <Td>{d.wins}</Td>
                <Td>{d.podiums}</Td>
                <Td>{d.poles}</Td>
                <Td>{d.fastestLaps}</Td>
                <Td>{d.starts}</Td>
                <Td>{Math.round(d.points)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function TeamTable({ teams }: { teams: TeamCareerStats[] }) {
  const rows = [...teams].sort(
    (a, b) => b.constructorTitles - a.constructorTitles || b.wins - a.wins || b.points - a.points,
  );
  return (
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-500">
              <th className="py-1 pr-2">Team</th>
              <Th>Titles</Th>
              <Th>Wins</Th>
              <Th>Podiums</Th>
              <Th>Poles</Th>
              <Th>Entries</Th>
              <Th>Points</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.teamId} className="border-t border-neutral-800/60">
                <td className="py-1 pr-2 font-medium text-neutral-200">{t.name}</td>
                <Td highlight={t.constructorTitles > 0}>{t.constructorTitles}</Td>
                <Td>{t.wins}</Td>
                <Td>{t.podiums}</Td>
                <Td>{t.poles}</Td>
                <Td>{t.entries}</Td>
                <Td>{Math.round(t.points)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function SeasonCard({
  season,
  nameOfDriver,
  nameOfTeam,
}: {
  season: SeasonHistoryRecord;
  nameOfDriver: (id?: string) => string;
  nameOfTeam: (id?: string) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-neutral-100">
            {season.seasonYear} {season.series}
          </div>
          <div className="mt-0.5 text-sm text-neutral-300">
            🏆 {nameOfDriver(season.driverChampionId)}
            <span className="text-neutral-500"> · </span>
            {nameOfTeam(season.constructorChampionId)}
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
        >
          {open ? 'Hide' : `${season.raceResults.length} races`}
        </button>
      </div>

      {season.majorStorylines.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-neutral-400">
          {season.majorStorylines.map((s, i) => (
            <li key={i}>• {s}</li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-1 text-xs">
          {season.raceResults.map((r) => (
            <div
              key={r.raceId}
              className="flex items-center justify-between border-t border-neutral-800/60 py-1"
            >
              <span className="text-neutral-400">
                R{r.round} · {r.gpName}
              </span>
              <span className="text-neutral-200">
                🥇 {nameOfDriver(r.winnerDriverId)}
                {r.poleDriverId && (
                  <span className="text-neutral-500"> · pole {nameOfDriver(r.poleDriverId)}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1 text-right">{children}</th>;
}
function Td({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <td className={`px-2 py-1 text-right tabular-nums ${highlight ? 'font-semibold text-amber-300' : 'text-neutral-300'}`}>
      {children}
    </td>
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
