import { useMemo, useState } from 'react';
import { useGame } from '../game/GameContext';
import { Panel } from '../components/Panel';
import type {
  DriverCareerStats,
  SeasonHistoryRecord,
  TeamCareerStats,
} from '../types/universeTypes';

type Tab = 'records' | 'drivers' | 'teams' | 'seasons';

export function UniverseHistory() {
  const { state } = useGame();
  const [tab, setTab] = useState<Tab>('records');

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

  if (seasons.length === 0) {
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
          <TabButton active={tab === 'drivers'} onClick={() => setTab('drivers')}>
            Drivers
          </TabButton>
          <TabButton active={tab === 'teams'} onClick={() => setTab('teams')}>
            Teams
          </TabButton>
          <TabButton active={tab === 'seasons'} onClick={() => setTab('seasons')}>
            Seasons ({seasons.length})
          </TabButton>
        </div>
      </div>

      {tab === 'records' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
      )}

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
    </div>
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
