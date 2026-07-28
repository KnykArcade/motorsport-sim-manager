import type { GameState } from '../game/careerState';
import type { Series } from '../types/gameTypes';
import { routePath } from './layoutNavigation';

export type GlobalSearchCategory =
  | 'Driver'
  | 'Staff'
  | 'Team'
  | 'Race'
  | 'Circuit'
  | 'Championship';

export type GlobalSearchAction = {
  label: string;
  to: string;
};

export type GlobalSearchResult = {
  id: string;
  category: GlobalSearchCategory;
  title: string;
  subtitle: string;
  to: string;
  keywords: string;
  actions: GlobalSearchAction[];
};

const SERIES: ReadonlyArray<Series> = ['F1', 'IndyCar', 'CART', 'Champ Car', 'NASCAR'];

function route(to: string, params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${to}?${query}` : to;
}

function searchable(value: string): string {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
}

function allowedActions(
  actions: ReadonlyArray<GlobalSearchAction>,
  hiddenRoutes: ReadonlySet<string>,
): GlobalSearchAction[] {
  return actions.filter((action) => !hiddenRoutes.has(routePath(action.to)));
}

export function globalSearchIndex(
  state: GameState,
  hiddenRoutes: ReadonlySet<string> = new Set(),
): GlobalSearchResult[] {
  const teamNames = new Map(state.teams.map((team) => [team.id, team.name]));
  const results: GlobalSearchResult[] = [];

  for (const driver of state.drivers) {
    const to = route('/drivers', { tab: 'directory', driver: driver.id });
    const actions = allowedActions([
      { label: 'Open profile', to },
      { label: 'Scout', to: route('/scouting', { driver: driver.id }) },
      ...(driver.teamId === state.selectedTeamId && state.gameMode !== 'SingleSeason'
        ? [{ label: 'Negotiate', to: `/drivers/${encodeURIComponent(driver.id)}/negotiate` }]
        : []),
    ], hiddenRoutes);
    results.push({
      id: `driver:${driver.id}`,
      category: 'Driver',
      title: driver.name,
      subtitle: `#${driver.number} · ${teamNames.get(driver.teamId) ?? driver.teamId}`,
      to,
      keywords: `${driver.name} ${driver.number} ${teamNames.get(driver.teamId) ?? ''} driver`,
      actions,
    });
  }

  const staffById = new Map<string, { member: NonNullable<GameState['staff']>[number]; teamId: string }>();
  for (const member of state.staff ?? []) staffById.set(member.id, { member, teamId: state.selectedTeamId });
  for (const [teamId, members] of Object.entries(state.aiStaff ?? {})) {
    for (const member of members) {
      if (!staffById.has(member.id)) staffById.set(member.id, { member, teamId });
    }
  }
  for (const { member, teamId } of staffById.values()) {
    const to = route('/staff', { view: 'departments', role: member.role });
    results.push({
      id: `staff:${member.id}`,
      category: 'Staff',
      title: member.name,
      subtitle: `${member.role} · ${teamNames.get(teamId) ?? 'Unattached'}`,
      to,
      keywords: `${member.name} ${member.role} ${teamNames.get(teamId) ?? ''} staff`,
      actions: allowedActions([
        { label: 'Open department', to },
        { label: 'Responsibilities', to: '/staff?view=responsibilities' },
      ], hiddenRoutes),
    });
  }

  for (const team of state.teams) {
    const to = route('/teams', { team: team.id });
    results.push({
      id: `team:${team.id}`,
      category: 'Team',
      title: team.name,
      subtitle: team.id === state.selectedTeamId ? 'Your team' : `${state.series} organization`,
      to,
      keywords: `${team.name} ${state.series} team organization`,
      actions: allowedActions([
        { label: 'Open profile', to },
        ...(team.id === state.selectedTeamId
          ? [
              ...(state.gameMode === 'SingleSeason' ? [] : [{ label: 'Team planner', to: '/planner' }]),
              { label: 'Team relationships', to: '/relationships' },
            ]
          : [{ label: 'Rival context', to: '/rivals' }]),
      ], hiddenRoutes),
    });
  }

  for (const race of state.calendar) {
    const to = route('/calendar', {
      tab: race.completed ? 'results' : 'schedule',
      race: race.id,
    });
    results.push({
      id: `race:${race.id}`,
      category: 'Race',
      title: race.gpName,
      subtitle: `${state.seasonYear} · Round ${race.round} · ${race.trackName}`,
      to,
      keywords: `${race.gpName} ${race.trackName} ${state.seasonYear} round ${race.round} race`,
      actions: allowedActions([
        { label: 'Open event', to },
        ...(race.completed ? [{ label: 'Race archive', to: route('/history', { race: race.id }) }] : []),
      ], hiddenRoutes),
    });
  }

  const circuits = new Map<string, { trackId: string; trackName: string; raceId: string; completed: boolean }>();
  for (const race of state.calendar) {
    if (!circuits.has(race.trackId)) {
      circuits.set(race.trackId, {
        trackId: race.trackId,
        trackName: race.trackName,
        raceId: race.id,
        completed: race.completed,
      });
    }
  }
  for (const circuit of circuits.values()) {
    const to = route('/calendar', {
      tab: circuit.completed ? 'results' : 'schedule',
      race: circuit.raceId,
    });
    results.push({
      id: `circuit:${circuit.trackId}`,
      category: 'Circuit',
      title: circuit.trackName,
      subtitle: `${state.series} calendar · ${state.seasonYear}`,
      to,
      keywords: `${circuit.trackName} circuit track venue`,
      actions: allowedActions([{ label: 'Open circuit dossier', to }], hiddenRoutes),
    });
  }

  const availableSeries = new Set<Series>([state.series]);
  for (const series of SERIES) {
    if (state.motorsportUniverse?.championships?.[series]) availableSeries.add(series);
  }
  for (const series of availableSeries) {
    const to = route('/standings', { series });
    results.push({
      id: `championship:${series}`,
      category: 'Championship',
      title: `${series} Championship`,
      subtitle: series === state.series ? `${state.seasonYear} · Your championship` : 'World championship',
      to,
      keywords: `${series} championship standings competition`,
      actions: allowedActions([
        { label: 'Open standings', to },
        { label: 'Records', to: '/records' },
      ], hiddenRoutes),
    });
  }

  return results;
}

export function searchGlobalIndex(
  index: ReadonlyArray<GlobalSearchResult>,
  query: string,
  limit = 12,
): GlobalSearchResult[] {
  const needle = searchable(query.trim());
  if (needle.length < 2) return [];
  const terms = needle.split(/\s+/).filter(Boolean);

  return index
    .map((result) => {
      const title = searchable(result.title);
      const haystack = searchable(`${result.title} ${result.subtitle} ${result.keywords}`);
      if (!terms.every((term) => haystack.includes(term))) return undefined;
      const score = title === needle ? 0 : title.startsWith(needle) ? 1 : title.includes(needle) ? 2 : 3;
      return { result, score };
    })
    .filter((entry): entry is { result: GlobalSearchResult; score: number } => Boolean(entry))
    .sort((left, right) =>
      left.score - right.score
      || left.result.category.localeCompare(right.result.category)
      || left.result.title.localeCompare(right.result.title))
    .slice(0, limit)
    .map((entry) => entry.result);
}
