import type { GameState } from '../game/careerState';
import type { RaceResult } from '../types/gameTypes';
import type { CareerLegacyState, HallOfFameEntry, LegacyMilestone } from '../types/phase18Types';
import type { UniverseHistory } from '../types/universeTypes';
import { ensurePhase18FoundationState } from './phase18FoundationEngine';

function legacyState(state: GameState): CareerLegacyState {
  return (state.phase18 ?? ensurePhase18FoundationState(undefined, state)).legacy;
}

function addMilestone(legacy: CareerLegacyState, milestone: LegacyMilestone): CareerLegacyState {
  if (legacy.milestones.some((entry) => entry.id === milestone.id)) return legacy;
  return {
    ...legacy,
    score: legacy.score + milestone.legacyPoints,
    milestones: [...legacy.milestones, milestone].slice(-250),
  };
}

function withLegacy(state: GameState, legacy: CareerLegacyState): GameState {
  const phase18 = state.phase18 ?? ensurePhase18FoundationState(undefined, state);
  return { ...state, phase18: { ...phase18, legacy } };
}

export function recordRaceLegacy(state: GameState, raceId: string, round: number, results: RaceResult[]): GameState {
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  if (!team) return state;
  const driverName = (id: string) => state.drivers.find((driver) => driver.id === id)?.name ?? id;
  const archive = [...(state.raceArchive ?? [])].reverse().find((entry) => entry.raceId === raceId);
  let legacy = legacyState(state);
  for (const result of results.filter((entry) => entry.teamId === team.id && entry.position != null && entry.position <= 3)) {
    const win = result.position === 1;
    legacy = addMilestone(legacy, {
      id: `legacy-${state.seasonYear}-${raceId}-${win ? 'win' : 'podium'}-${result.driverId}`,
      category: win ? 'RaceWin' : 'Podium',
      seasonYear: state.seasonYear,
      round,
      teamId: team.id,
      subjectId: result.driverId,
      title: win ? `${driverName(result.driverId)} wins` : `${driverName(result.driverId)} reaches the podium`,
      description: `${team.name} secured ${win ? 'a race victory' : `P${result.position}`} in round ${round}.`,
      legacyPoints: win ? 10 : 4,
    });
  }
  if (archive?.poleDriverId && results.some((entry) => entry.driverId === archive.poleDriverId && entry.teamId === team.id)) {
    legacy = addMilestone(legacy, { id: `legacy-${state.seasonYear}-${raceId}-pole`, category: 'Pole', seasonYear: state.seasonYear, round, teamId: team.id, subjectId: archive.poleDriverId, title: `${driverName(archive.poleDriverId)} takes pole`, description: `${team.name} set the fastest qualifying time in round ${round}.`, legacyPoints: 3 });
  }
  if (archive?.fastestLap?.driverId && results.some((entry) => entry.driverId === archive.fastestLap!.driverId && entry.teamId === team.id)) {
    legacy = addMilestone(legacy, { id: `legacy-${state.seasonYear}-${raceId}-fastest-lap`, category: 'FastestLap', seasonYear: state.seasonYear, round, teamId: team.id, subjectId: archive.fastestLap.driverId, title: `${driverName(archive.fastestLap.driverId)} sets fastest lap`, description: `${team.name} recorded the fastest race lap in round ${round}.`, legacyPoints: 2 });
  }
  const updated = withLegacy(state, legacy);
  return updated.seasonComplete ? recordSeasonOutcomeLegacy(updated) : updated;
}

export function recordSeasonOutcomeLegacy(state: GameState): GameState {
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  const constructorPosition = state.constructorStandings.findIndex((entry) => entry.entityId === state.selectedTeamId) + 1;
  const driverChampion = state.driverStandings[0];
  const constructorChampion = state.constructorStandings[0];
  if (!team || !driverChampion || !constructorChampion || constructorPosition <= 0) return state;
  const championDriver = state.drivers.find((driver) => driver.id === driverChampion.entityId);
  const championTeam = state.teams.find((entry) => entry.id === championDriver?.teamId);
  const constructorChampionTeam = state.teams.find((entry) => entry.id === constructorChampion.entityId);
  const expectedStanding = team.expectedStanding ?? constructorPosition;
  const preseasonFavorite = [...state.teams].sort((a, b) => (a.expectedStanding ?? 999) - (b.expectedStanding ?? 999))[0];
  let legacy = legacyState(state);
  if (championDriver?.teamId === team.id) {
    legacy = addMilestone(legacy, { id: `legacy-${state.seasonYear}-driver-title`, category: 'DriverTitle', seasonYear: state.seasonYear, teamId: team.id, subjectId: championDriver.id, title: `${championDriver.name} becomes World Champion`, description: `${team.name} delivered the ${state.seasonYear} ${state.series} Drivers' Championship.`, legacyPoints: 40 });
  }
  if (constructorChampion.entityId === team.id) {
    legacy = addMilestone(legacy, { id: `legacy-${state.seasonYear}-constructor-title`, category: 'ConstructorTitle', seasonYear: state.seasonYear, teamId: team.id, title: `${team.name} wins the Constructors' Championship`, description: `${team.name} finished the season as the leading constructor.`, legacyPoints: 50 });
  }
  const placesGained = expectedStanding - constructorPosition;
  if (placesGained >= 3) {
    legacy = addMilestone(legacy, { id: `legacy-${state.seasonYear}-turnaround-${team.id}`, category: 'TeamTurnaround', seasonYear: state.seasonYear, teamId: team.id, title: `${team.name} exceeds every expectation`, description: `Expected P${expectedStanding}, the team finished P${constructorPosition}.`, legacyPoints: 15 + placesGained * 2 });
  }
  const alternateHistory = [...legacy.alternateHistory];
  const addOutcome = (id: string, category: string, careerOutcome: string, significance: number) => {
    if (!alternateHistory.some((entry) => entry.id === id)) alternateHistory.push({ id, seasonYear: state.seasonYear, category, historicalOutcome: preseasonFavorite ? `Preseason benchmark: ${preseasonFavorite.name}` : undefined, careerOutcome, significance });
  };
  addOutcome(`alternate-${state.seasonYear}-driver`, 'Drivers Champion', `${championDriver?.name ?? driverChampion.entityId} won the Drivers' Championship for ${championTeam?.name ?? championDriver?.teamId ?? 'their team'}.`, championTeam?.expectedStanding === 1 ? 45 : 70);
  addOutcome(`alternate-${state.seasonYear}-constructor`, 'Constructors Champion', `${constructorChampionTeam?.name ?? constructorChampion.entityId} won the Constructors' Championship.`, constructorChampionTeam?.expectedStanding === 1 ? 45 : 75);
  if (placesGained >= 3) addOutcome(`alternate-${state.seasonYear}-player-turnaround`, 'Unexpected Team Rise', `${team.name} rose from an expected P${expectedStanding} to P${constructorPosition}.`, Math.min(100, 45 + placesGained * 8));
  return withLegacy(state, { ...legacy, alternateHistory: alternateHistory.slice(-120) });
}

export function inductLegacyHallOfFame(state: GameState, history: UniverseHistory, completedSeasonYear: number): GameState {
  const legacy = legacyState(state);
  const entries: HallOfFameEntry[] = [...legacy.hallOfFame];
  const add = (entry: HallOfFameEntry) => { if (!entries.some((existing) => existing.id === entry.id)) entries.push(entry); };
  for (const driver of Object.values(history.driverCareerStats)) {
    if (driver.driverTitles < 2 && driver.wins < 10) continue;
    add({ id: `hall-driver-${driver.driverId}`, subjectType: 'Driver', subjectId: driver.driverId, inductionSeasonYear: completedSeasonYear, title: 'Hall of Fame Driver', summary: `${driver.name}: ${driver.driverTitles} titles, ${driver.wins} wins, and ${driver.podiums} podiums.` });
  }
  for (const team of Object.values(history.teamCareerStats)) {
    if (team.constructorTitles < 2 && team.wins < 15) continue;
    add({ id: `hall-team-${team.teamId}`, subjectType: 'Team', subjectId: team.teamId, inductionSeasonYear: completedSeasonYear, title: 'Hall of Fame Team', summary: `${team.name}: ${team.constructorTitles} titles and ${team.wins} race victories.` });
  }
  const principal = state.principal;
  if (principal && (principal.careerStats.constructorTitles >= 2 || principal.careerStats.driverTitles >= 2 || principal.careerStats.raceWins >= 15)) {
    add({ id: `hall-principal-${principal.id}`, subjectType: 'TeamPrincipal', subjectId: principal.id, inductionSeasonYear: completedSeasonYear, title: 'Hall of Fame Team Principal', summary: `${principal.name}: ${principal.careerStats.constructorTitles} constructors' titles, ${principal.careerStats.driverTitles} drivers' titles, and ${principal.careerStats.raceWins} wins.` });
  }
  return withLegacy(state, { ...legacy, hallOfFame: entries });
}
