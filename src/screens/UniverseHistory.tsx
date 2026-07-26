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
  UniverseLiveSeason,
} from '../types/universeTypes';
import type { Series, StandingsEntry } from '../types/gameTypes';
import { worldDriverAvailability } from './worldAvailabilityViewModel';
import { LegacyArchive } from '../components/history/LegacyArchive';
import {
  WorkspaceBody,
  WorkspaceHeader,
  WorkspaceScreen,
  WorkspaceTabs,
} from '../components/workspace/Workspace';
import {
  DRIVER_RECORD_METRICS,
  TEAM_RECORD_METRICS,
  driverRecordRanking,
  selectedRecord,
  sortedCareerSeasons,
  sortedMovements,
  sortedWorldSeasons,
  teamRecordRanking,
  type DriverRecordMetric,
  type TeamRecordMetric,
} from './championshipRecordsViewModel';

type Tab = 'records' | 'legacy' | 'drivers' | 'teams' | 'seasons' | 'world' | 'grid';

export function UniverseHistory() {
  const { state } = useGame();
  const [tab, setTab] = useState<Tab>('records');
  const [recordView, setRecordView] = useState<'drivers' | 'teams'>('drivers');
  const [driverMetric, setDriverMetric] = useState<DriverRecordMetric>('wins');
  const [teamMetric, setTeamMetric] = useState<TeamRecordMetric>('wins');
  const [selectedCareerId, setSelectedCareerId] = useState<string | null>(null);
  const [selectedSeasonKey, setSelectedSeasonKey] = useState<string | null>(null);
  const [selectedWorldSeasonKey, setSelectedWorldSeasonKey] = useState<string | null>(null);

  const history = state?.universeHistory;
  const nameOfDriver = useMemo(() => {
    const fromState = new Map((state?.drivers ?? []).map((driver) => [driver.id, driver.name] as const));
    return (id?: string) => id ? history?.driverCareerStats[id]?.name ?? fromState.get(id) ?? id : '—';
  }, [state, history]);
  const nameOfTeam = useMemo(() => {
    const fromState = new Map((state?.teams ?? []).map((team) => [team.id, team.name] as const));
    return (id?: string) => id ? history?.teamCareerStats[id]?.name ?? fromState.get(id) ?? id : '—';
  }, [state, history]);

  if (!state) return null;

  const seasons = sortedCareerSeasons(history?.seasons ?? []);
  const drivers = Object.values(history?.driverCareerStats ?? {});
  const teams = Object.values(history?.teamCareerStats ?? {});
  const worldSeasons = sortedWorldSeasons(
    Object.values(state.motorsportUniverse?.championships ?? {})
      .flatMap((championship) => championship?.seasonHistory ?? []),
  );
  const worldChampionships = state.motorsportUniverse?.championships ?? {};
  const worldSeatCount = Object.values(worldChampionships)
    .reduce((total, championship) => total + (championship?.drivers.length ?? 0), 0);

  if (seasons.length === 0 && worldSeasons.length === 0 && worldSeatCount === 0) {
    return (
      <WorkspaceScreen className="era-feature-screen era-universe-history-screen ui-records-screen">
        <WorkspaceHeader eyebrow="World archive" title="Records" subtitle={`${state.seasonYear} ${state.series} · Your alternate-history record book`} />
        <WorkspaceBody><Panel><p className="text-sm text-neutral-400">No seasons recorded yet. Finish a season to begin the archive.</p></Panel></WorkspaceBody>
      </WorkspaceScreen>
    );
  }

  const tabs = [
    { id: 'records' as const, label: 'Records' },
    { id: 'legacy' as const, label: 'Legacy' },
    { id: 'drivers' as const, label: `Drivers (${drivers.length})` },
    { id: 'teams' as const, label: `Teams (${teams.length})` },
    { id: 'seasons' as const, label: `Career History (${seasons.length})` },
    { id: 'world' as const, label: `World Championships (${worldSeasons.length})` },
    { id: 'grid' as const, label: `World Grid (${worldSeatCount})` },
  ];

  return (
    <WorkspaceScreen className="era-feature-screen era-universe-history-screen ui-records-screen">
      <WorkspaceHeader
        eyebrow="World archive"
        title="Records and History"
        subtitle={`${state.seasonYear} ${state.series} · Champions, leaderboards, movements, and legacy`}
      />
      <WorkspaceTabs items={tabs} active={tab} onChange={(next) => { setTab(next); setSelectedCareerId(null); }} ariaLabel="Records and history sections" />
      <WorkspaceBody className="ui-records-body">
        {tab === 'records' && (
          <RecordsWorkspace
            drivers={drivers}
            teams={teams}
            scope={recordView}
            onScope={(scope) => { setRecordView(scope); setSelectedCareerId(null); }}
            driverMetric={driverMetric}
            teamMetric={teamMetric}
            onDriverMetric={(metric) => { setDriverMetric(metric); setSelectedCareerId(null); }}
            onTeamMetric={(metric) => { setTeamMetric(metric); setSelectedCareerId(null); }}
            selectedId={selectedCareerId}
            onSelect={setSelectedCareerId}
          />
        )}
        {tab === 'legacy' && <LegacyArchive legacy={state.phase18!.legacy} />}
        {tab === 'drivers' && <DriverCareerWorkspace drivers={drivers} selectedId={selectedCareerId} onSelect={setSelectedCareerId} />}
        {tab === 'teams' && <TeamCareerWorkspace teams={teams} selectedId={selectedCareerId} onSelect={setSelectedCareerId} />}
        {tab === 'seasons' && (
          <SeasonArchive
            seasons={seasons}
            selectedKey={selectedSeasonKey}
            onSelect={setSelectedSeasonKey}
            nameOfDriver={nameOfDriver}
            nameOfTeam={nameOfTeam}
          />
        )}
        {tab === 'world' && (
          <WorldSeasonArchive
            seasons={worldSeasons}
            selectedKey={selectedWorldSeasonKey}
            onSelect={setSelectedWorldSeasonKey}
          />
        )}
        {tab === 'grid' && <WorldGrid championships={worldChampionships} />}
      </WorkspaceBody>
    </WorkspaceScreen>
  );
}

function RecordsWorkspace({
  drivers,
  teams,
  scope,
  onScope,
  driverMetric,
  teamMetric,
  onDriverMetric,
  onTeamMetric,
  selectedId,
  onSelect,
}: {
  drivers: DriverCareerStats[];
  teams: TeamCareerStats[];
  scope: 'drivers' | 'teams';
  onScope: (scope: 'drivers' | 'teams') => void;
  driverMetric: DriverRecordMetric;
  teamMetric: TeamRecordMetric;
  onDriverMetric: (metric: DriverRecordMetric) => void;
  onTeamMetric: (metric: TeamRecordMetric) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const driverRows = driverRecordRanking(drivers, driverMetric);
  const teamRows = teamRecordRanking(teams, teamMetric);
  const selectedDriver = selectedRecord(driverRows, selectedId, (entry) => entry.driverId);
  const selectedTeam = selectedRecord(teamRows, selectedId, (entry) => entry.teamId);
  const metricLabel = scope === 'drivers'
    ? DRIVER_RECORD_METRICS.find((entry) => entry.id === driverMetric)?.label
    : TEAM_RECORD_METRICS.find((entry) => entry.id === teamMetric)?.label;

  return (
    <div className="ui-fm-workspace-grid is-three ui-records-grid">
      <section className="ui-fm-pane ui-record-category-pane">
        <div className="ui-fm-pane-header">
          <div><div className="ui-fm-pane-title">Record categories</div><div className="ui-fm-pane-meta">Choose a career leaderboard</div></div>
        </div>
        <div className="ui-record-scope-switch">
          <button type="button" className={scope === 'drivers' ? 'is-active' : ''} onClick={() => onScope('drivers')}>Drivers</button>
          <button type="button" className={scope === 'teams' ? 'is-active' : ''} onClick={() => onScope('teams')}>Teams</button>
        </div>
        <div className="ui-fm-pane-body">
          {scope === 'drivers'
            ? DRIVER_RECORD_METRICS.map((metric) => (
              <button key={metric.id} type="button" className={`ui-fm-list-button ${driverMetric === metric.id ? 'is-active' : ''}`} onClick={() => onDriverMetric(metric.id)}>
                <span>Driver record</span><strong>{metric.label}</strong><small>{drivers.length} eligible careers</small>
              </button>
            ))
            : TEAM_RECORD_METRICS.map((metric) => (
              <button key={metric.id} type="button" className={`ui-fm-list-button ${teamMetric === metric.id ? 'is-active' : ''}`} onClick={() => onTeamMetric(metric.id)}>
                <span>Team record</span><strong>{metric.label}</strong><small>{teams.length} eligible teams</small>
              </button>
            ))}
        </div>
      </section>

      <section className="ui-fm-pane ui-record-ranking-pane">
        <div className="ui-fm-pane-header">
          <div><div className="ui-fm-pane-title">{metricLabel}</div><div className="ui-fm-pane-meta">Full career leaderboard</div></div>
        </div>
        <div className="ui-fm-pane-body ui-fm-scroll-column">
          <table className="ui-record-table">
            <thead><tr><th>Pos</th><th>{scope === 'drivers' ? 'Driver' : 'Team'}</th><th className="is-numeric">{metricLabel}</th><th className="is-numeric">Wins</th><th className="is-numeric">Points</th></tr></thead>
            <tbody>
              {scope === 'drivers'
                ? driverRows.map((entry, index) => (
                  <tr key={entry.driverId} className={selectedDriver?.driverId === entry.driverId ? 'is-selected' : ''} onClick={() => onSelect(entry.driverId)}>
                    <td>P{index + 1}</td><td><strong>{entry.name}</strong></td><td className="is-numeric">{Math.round(entry[driverMetric])}</td><td className="is-numeric">{entry.wins}</td><td className="is-numeric">{Math.round(entry.points)}</td>
                  </tr>
                ))
                : teamRows.map((entry, index) => (
                  <tr key={entry.teamId} className={selectedTeam?.teamId === entry.teamId ? 'is-selected' : ''} onClick={() => onSelect(entry.teamId)}>
                    <td>P{index + 1}</td><td><strong>{entry.name}</strong></td><td className="is-numeric">{Math.round(entry[teamMetric])}</td><td className="is-numeric">{entry.wins}</td><td className="is-numeric">{Math.round(entry.points)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ui-fm-pane ui-record-holder-pane">
        <div className="ui-fm-pane-header">
          <div><div className="ui-fm-pane-title">Record-holder profile</div><div className="ui-fm-pane-meta">{scope === 'drivers' ? selectedDriver?.name : selectedTeam?.name}</div></div>
        </div>
        <div className="ui-fm-pane-body">
          {scope === 'drivers' && selectedDriver ? <DriverDossier driver={selectedDriver} /> : null}
          {scope === 'teams' && selectedTeam ? <TeamDossier team={selectedTeam} /> : null}
          {scope === 'drivers' && !selectedDriver ? <EmptyArchive /> : null}
          {scope === 'teams' && !selectedTeam ? <EmptyArchive /> : null}
        </div>
      </section>
    </div>
  );
}

function DriverCareerWorkspace({ drivers, selectedId, onSelect }: { drivers: DriverCareerStats[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const rows = driverRecordRanking(drivers, 'driverTitles');
  const selected = selectedRecord(rows, selectedId, (entry) => entry.driverId);
  return (
    <div className="ui-fm-workspace-grid is-two ui-career-record-grid">
      <section className="ui-fm-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Driver archive</div><div className="ui-fm-pane-meta">Titles, wins, and total contribution</div></div></div>
        <div className="ui-fm-pane-body">{rows.map((entry) => (
          <button key={entry.driverId} type="button" className={`ui-fm-list-button ${selected?.driverId === entry.driverId ? 'is-active' : ''}`} onClick={() => onSelect(entry.driverId)}>
            <span>{entry.driverTitles} titles · {entry.starts} starts</span><strong>{entry.name}</strong><small>{entry.wins} wins · {Math.round(entry.points)} points</small>
          </button>
        ))}</div>
      </section>
      <section className="ui-fm-pane ui-career-detail-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Driver career dossier</div><div className="ui-fm-pane-meta">{selected?.name}</div></div></div>
        <div className="ui-fm-pane-body">{selected ? <DriverDossier driver={selected} /> : <EmptyArchive />}</div>
      </section>
    </div>
  );
}

function TeamCareerWorkspace({ teams, selectedId, onSelect }: { teams: TeamCareerStats[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const rows = teamRecordRanking(teams, 'constructorTitles');
  const selected = selectedRecord(rows, selectedId, (entry) => entry.teamId);
  return (
    <div className="ui-fm-workspace-grid is-two ui-career-record-grid">
      <section className="ui-fm-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Team archive</div><div className="ui-fm-pane-meta">Titles, victories, and championship entries</div></div></div>
        <div className="ui-fm-pane-body">{rows.map((entry) => (
          <button key={entry.teamId} type="button" className={`ui-fm-list-button ${selected?.teamId === entry.teamId ? 'is-active' : ''}`} onClick={() => onSelect(entry.teamId)}>
            <span>{entry.constructorTitles} titles · {entry.entries} entries</span><strong>{entry.name}</strong><small>{entry.wins} wins · {Math.round(entry.points)} points</small>
          </button>
        ))}</div>
      </section>
      <section className="ui-fm-pane ui-career-detail-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Team career dossier</div><div className="ui-fm-pane-meta">{selected?.name}</div></div></div>
        <div className="ui-fm-pane-body">{selected ? <TeamDossier team={selected} /> : <EmptyArchive />}</div>
      </section>
    </div>
  );
}

function SeasonArchive({
  seasons,
  selectedKey,
  onSelect,
  nameOfDriver,
  nameOfTeam,
}: {
  seasons: SeasonHistoryRecord[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  nameOfDriver: (id?: string) => string;
  nameOfTeam: (id?: string) => string;
}) {
  const keyOf = (season: SeasonHistoryRecord) => `${season.seasonYear}-${season.series}`;
  const selected = selectedRecord(seasons, selectedKey, keyOf);
  return (
    <div className="ui-fm-workspace-grid is-three ui-season-archive-grid">
      <section className="ui-fm-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Season archive</div><div className="ui-fm-pane-meta">Newest completed season first</div></div></div>
        <div className="ui-fm-pane-body">{seasons.map((season) => (
          <button key={keyOf(season)} type="button" className={`ui-fm-list-button ${selected && keyOf(selected) === keyOf(season) ? 'is-active' : ''}`} onClick={() => onSelect(keyOf(season))}>
            <span>{season.series}</span><strong>{season.seasonYear} season</strong><small>{season.raceResults.length} races · {season.majorStorylines.length} storylines</small>
          </button>
        ))}</div>
      </section>
      <section className="ui-fm-pane ui-season-detail-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Season dossier</div><div className="ui-fm-pane-meta">{selected ? `${selected.seasonYear} ${selected.series}` : 'No season selected'}</div></div></div>
        <div className="ui-fm-pane-body ui-fm-scroll-column">
          {selected ? (
            <>
              <div className="ui-season-champions">
                <div><span>Driver champion</span><strong>{nameOfDriver(selected.driverChampionId)}</strong></div>
                <div><span>Team champion</span><strong>{nameOfTeam(selected.constructorChampionId)}</strong></div>
              </div>
              <ArchiveStandings title="Final driver standings" rows={selected.finalDriverStandings} nameOf={nameOfDriver} />
              <ArchiveStandings title="Final team standings" rows={selected.finalConstructorStandings} nameOf={nameOfTeam} />
            </>
          ) : <EmptyArchive />}
        </div>
      </section>
      <section className="ui-fm-pane ui-season-context-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Season story</div><div className="ui-fm-pane-meta">Race winners and major events</div></div></div>
        <div className="ui-fm-pane-body ui-fm-scroll-column">
          {selected ? (
            <>
              <div className="ui-fm-section-label">Race archive</div>
              <div className="ui-season-race-list">{selected.raceResults.map((race) => (
                <div key={race.raceId}><span>R{race.round}</span><p><strong>{race.gpName}</strong><small>Winner {nameOfDriver(race.winnerDriverId)}{race.poleDriverId ? ` · Pole ${nameOfDriver(race.poleDriverId)}` : ''}</small></p></div>
              ))}</div>
              <div className="ui-fm-section-label">Major storylines</div>
              <div className="ui-season-storylines">{selected.majorStorylines.length ? selected.majorStorylines.map((story, index) => <p key={`${index}-${story}`}>{story}</p>) : <p>No major storyline was archived.</p>}</div>
              {selected.regulationChanges.length > 0 && <><div className="ui-fm-section-label">Regulation changes</div><div className="ui-season-storylines">{selected.regulationChanges.map((change, index) => <p key={`${index}-${change}`}>{change}</p>)}</div></>}
            </>
          ) : <EmptyArchive />}
        </div>
      </section>
    </div>
  );
}

function WorldSeasonArchive({ seasons, selectedKey, onSelect }: { seasons: UniverseChampionshipSeason[]; selectedKey: string | null; onSelect: (key: string) => void }) {
  const keyOf = (season: UniverseChampionshipSeason) => `${season.seasonYear}-${season.series}`;
  const selected = selectedRecord(seasons, selectedKey, keyOf);
  return (
    <div className="ui-fm-workspace-grid is-two ui-world-season-grid">
      <section className="ui-fm-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">World championships</div><div className="ui-fm-pane-meta">Completed off-screen series</div></div></div>
        <div className="ui-fm-pane-body">{seasons.map((season) => (
          <button key={keyOf(season)} type="button" className={`ui-fm-list-button ${selected && keyOf(selected) === keyOf(season) ? 'is-active' : ''}`} onClick={() => onSelect(keyOf(season))}>
            <span>{season.series}</span><strong>{season.seasonYear} championship</strong><small>{season.driverChampionName ?? season.driverChampionId ?? 'No champion'} · {season.completedRaces} races</small>
          </button>
        ))}</div>
      </section>
      <section className="ui-fm-pane ui-world-season-detail">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Championship dossier</div><div className="ui-fm-pane-meta">{selected ? `${selected.seasonYear} ${selected.series}` : 'No season selected'}</div></div></div>
        <div className="ui-fm-pane-body ui-fm-scroll-column">{selected ? <WorldSeasonCard season={selected} expanded /> : <EmptyArchive />}</div>
      </section>
    </div>
  );
}

export function WorldGrid({
  championships,
  showMovements = true,
}: {
  championships: Partial<Record<Series, UniverseChampionshipState>>;
  showMovements?: boolean;
}) {
  const entries = Object.values(championships)
    .filter((championship): championship is UniverseChampionshipState => Boolean(championship))
    .sort((a, b) => a.series.localeCompare(b.series));
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(entries[0]?.series ?? null);
  const selected = entries.find((entry) => entry.series === selectedSeries) ?? entries[0];
  const movements = sortedMovements(entries.flatMap((championship) => championship.movementHistory ?? []));
  const availability = selected ? worldDriverAvailability(selected) : new Map();
  const drivers = new Map(selected?.drivers.map((driver) => [driver.driverId, driver]) ?? []);

  if (!selected) return <EmptyArchive />;

  return (
    <div className="ui-world-grid-layout">
      <section className="ui-fm-pane">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">Series and teams</div><div className="ui-fm-pane-meta">{entries.length} active championships</div></div></div>
        <div className="ui-fm-pane-body">
          {entries.map((championship) => (
            <button key={championship.series} type="button" className={`ui-fm-list-button ${selected.series === championship.series ? 'is-active' : ''}`} onClick={() => setSelectedSeries(championship.series)}>
              <span>{championship.seasonYear} grid</span><strong>{championship.series}</strong><small>{championship.teams.length} teams · {championship.drivers.length} drivers</small>
            </button>
          ))}
        </div>
      </section>
      <section className="ui-fm-pane ui-world-grid-detail">
        <div className="ui-fm-pane-header"><div><div className="ui-fm-pane-title">{selected.series} world grid</div><div className="ui-fm-pane-meta">Drivers, contracts, injuries, and replacements</div></div></div>
        <div className="ui-fm-pane-body ui-fm-scroll-column">
          <div className="ui-world-team-grid">{selected.teams.map((team) => (
            <div key={team.teamId} className="ui-world-team-card">
              <span>{team.seatCount} seat{team.seatCount === 1 ? '' : 's'} · Reputation {team.reputation}</span>
              <strong>{team.name}</strong>
              {team.driverIds.map((driverId) => {
                const driver = drivers.get(driverId);
                const status = availability.get(driverId);
                return (
                  <div key={driverId}>
                    <p>{driver?.name ?? driverId}<small>{driver ? `${driver.contractYearsRemaining} yr${driver.contractYearsRemaining === 1 ? '' : 's'} remaining` : 'Contract unavailable'}</small></p>
                    {status?.status === 'Injured' && <em>Injured · {status.replacementName} deputising</em>}
                  </div>
                );
              })}
            </div>
          ))}</div>
          {showMovements && (
            <div className="ui-world-movement-ledger">
              <div className="ui-fm-section-label">Recent Driver Moves · movement ledger</div>
              {movements.length ? movements.map((movement) => <MovementRow key={movement.id} movement={movement} />) : <p>No renewals, releases, transfers, or signings have been archived yet.</p>}
            </div>
          )}
        </div>
      </section>
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
  return <div><span>{movement.effectiveYear} · {movement.series}</span><p><strong>{movement.driverName}</strong> {detail}</p></div>;
}

export function WorldSeasonCard({ season, expanded = false }: { season: UniverseChampionshipSeason; expanded?: boolean }) {
  const driverRows = expanded ? season.driverStandings : season.driverStandings.slice(0, 5);
  return (
    <div className="ui-world-season-card">
      <div className="ui-world-season-heading">
        <strong>{season.seasonYear} {season.series}</strong>
        <span>{season.completedRaces} races</span>
      </div>
      <div className="ui-season-champions">
        <div><span>Driver champion</span><strong>{season.driverChampionName ?? season.driverChampionId ?? '—'}</strong></div>
        <div><span>Team champion</span><strong>{season.teamChampionName ?? season.teamChampionId ?? '—'}</strong></div>
      </div>
      <ArchiveStandings title="Driver standings" rows={driverRows} nameOf={(id) => season.driverNames[id] ?? id} />
      {expanded && <ArchiveStandings title="Team standings" rows={season.teamStandings} nameOf={(id) => season.teamNames[id] ?? id} />}
      {expanded && season.raceResults && season.raceResults.length > 0 && (
        <div className="ui-world-race-summary">
          <div className="ui-fm-section-label">Race winners</div>
          {season.raceResults.map((race) => <div key={race.raceId}><span>R{race.round}</span><strong>{race.raceName}</strong><small>{race.winnerDriverName ?? race.winnerDriverId ?? 'Unknown winner'}</small></div>)}
        </div>
      )}
    </div>
  );
}

export function WorldLiveSeasonCard({ championship, live }: { championship: UniverseChampionshipState; live: UniverseLiveSeason }) {
  const driverNames = new Map([
    ...championship.drivers.map((driver) => [driver.driverId, driver.name] as const),
    ...Object.entries(live.driverNames ?? {}),
    ...(championship.driverAbsences ?? []).map((absence) => [absence.replacement.driverId, absence.replacement.name] as const),
  ]);
  const latest = live.raceResults.at(-1);
  const next = live.schedule[live.completedRaces];
  return (
    <div className="ui-world-live-card">
      <div className="ui-season-champions">
        <div><span>Championship leader</span><strong>{driverNames.get(live.driverStandings[0]?.entityId ?? '') ?? 'No standings yet'}</strong></div>
        <div><span>Season progress</span><strong>{live.completedRaces} / {live.totalRaces}</strong></div>
      </div>
      <div className="ui-world-live-events">
        <div><span>Latest result</span><strong>{latest ? `${latest.winnerDriverName ?? 'Unknown winner'} won ${latest.raceName}` : 'No races completed'}</strong></div>
        <div><span>Next round</span><strong>{next ? `${next.raceName} · ${next.trackName}` : live.completedRaces ? 'Season complete' : 'Schedule unavailable'}</strong></div>
      </div>
      <ArchiveStandings title="Live driver standings" rows={live.driverStandings.slice(0, 8)} nameOf={(id) => driverNames.get(id) ?? id} />
    </div>
  );
}

function DriverDossier({ driver }: { driver: DriverCareerStats }) {
  return (
    <div className="ui-record-dossier">
      <div className="ui-record-profile"><span>Driver career</span><strong>{driver.name}</strong><small>{driver.seasonsContested.length} seasons contested</small></div>
      <div className="ui-fm-key-value"><span>Drivers' titles</span><strong>{driver.driverTitles}</strong></div>
      <div className="ui-fm-key-value"><span>Race wins</span><strong>{driver.wins}</strong></div>
      <div className="ui-fm-key-value"><span>Podiums</span><strong>{driver.podiums}</strong></div>
      <div className="ui-fm-key-value"><span>Pole positions</span><strong>{driver.poles}</strong></div>
      <div className="ui-fm-key-value"><span>Fastest laps</span><strong>{driver.fastestLaps}</strong></div>
      <div className="ui-fm-key-value"><span>Starts</span><strong>{driver.starts}</strong></div>
      <div className="ui-fm-key-value"><span>Career points</span><strong>{Math.round(driver.points)}</strong></div>
      <div className="ui-fm-key-value"><span>Win rate</span><strong>{driver.starts ? `${((driver.wins / driver.starts) * 100).toFixed(1)}%` : '—'}</strong></div>
      <div className="ui-record-season-tags">{driver.seasonsContested.map((season) => <span key={season}>{season}</span>)}</div>
    </div>
  );
}

function TeamDossier({ team }: { team: TeamCareerStats }) {
  return (
    <div className="ui-record-dossier">
      <div className="ui-record-profile"><span>Team career</span><strong>{team.name}</strong><small>{team.seasonsContested.length} seasons contested</small></div>
      <div className="ui-fm-key-value"><span>Constructors' titles</span><strong>{team.constructorTitles}</strong></div>
      <div className="ui-fm-key-value"><span>Race wins</span><strong>{team.wins}</strong></div>
      <div className="ui-fm-key-value"><span>Podiums</span><strong>{team.podiums}</strong></div>
      <div className="ui-fm-key-value"><span>Pole positions</span><strong>{team.poles}</strong></div>
      <div className="ui-fm-key-value"><span>Championship entries</span><strong>{team.entries}</strong></div>
      <div className="ui-fm-key-value"><span>Career points</span><strong>{Math.round(team.points)}</strong></div>
      <div className="ui-fm-key-value"><span>Wins per entry</span><strong>{team.entries ? (team.wins / team.entries).toFixed(2) : '—'}</strong></div>
      <div className="ui-record-season-tags">{team.seasonsContested.map((season) => <span key={season}>{season}</span>)}</div>
    </div>
  );
}

function ArchiveStandings({ title, rows, nameOf }: { title: string; rows: StandingsEntry[]; nameOf: (id: string) => string }) {
  return (
    <div className="ui-archive-standings">
      <div className="ui-fm-section-label">{title}</div>
      <table><thead><tr><th>Pos</th><th>Name</th><th>Pts</th><th>W</th><th>Pod</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.entityId}><td>P{index + 1}</td><td>{nameOf(row.entityId)}</td><td>{Math.round(row.points)}</td><td>{row.wins}</td><td>{row.podiums}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function EmptyArchive() {
  return <p className="ui-technical-empty">No archived data is available in this section yet.</p>;
}
