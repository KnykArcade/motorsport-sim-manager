import { useCallback, useState } from 'react';

export type InformationDensity = 'compact' | 'standard' | 'detailed';
export type DataHubTab = 'overview' | 'drivers' | 'tracks' | 'rivals';
export type DataHubPanelId = 'indicators' | 'findings' | 'context';
export type DriverColumnId =
  | 'driver'
  | 'races'
  | 'grid'
  | 'finish'
  | 'gain'
  | 'finishRate'
  | 'consistency';
export type TrackColumnId =
  | 'archetype'
  | 'races'
  | 'grid'
  | 'finish'
  | 'gain'
  | 'setup'
  | 'tireWear'
  | 'points'
  | 'finishRate';

export type NamedDataHubView = {
  id: string;
  name: string;
  tab: DataHubTab;
  rivalTeamId: string;
  density: InformationDensity;
  panelOrder: DataHubPanelId[];
  driverColumns: DriverColumnId[];
  trackColumns: TrackColumnId[];
  columnWidths: Record<string, number>;
};

export type InformationViewPreferences = {
  version: 1;
  density: InformationDensity;
  pinnedFindingIds: string[];
  dataHubPanelOrder: DataHubPanelId[];
  driverColumns: DriverColumnId[];
  trackColumns: TrackColumnId[];
  columnWidths: Record<string, number>;
  namedViews: NamedDataHubView[];
};

export const DEFAULT_DRIVER_COLUMNS: DriverColumnId[] = [
  'driver',
  'races',
  'grid',
  'finish',
  'gain',
  'finishRate',
  'consistency',
];

export const DEFAULT_TRACK_COLUMNS: TrackColumnId[] = [
  'archetype',
  'races',
  'grid',
  'finish',
  'gain',
  'setup',
  'tireWear',
  'points',
  'finishRate',
];

export const DEFAULT_INFORMATION_VIEW_PREFERENCES: InformationViewPreferences = {
  version: 1,
  density: 'standard',
  pinnedFindingIds: [],
  dataHubPanelOrder: ['indicators', 'findings', 'context'],
  driverColumns: DEFAULT_DRIVER_COLUMNS,
  trackColumns: DEFAULT_TRACK_COLUMNS,
  columnWidths: {},
  namedViews: [],
};

const STORAGE_PREFIX = 'msm-information-views-v1';
const DRIVER_COLUMNS = new Set(DEFAULT_DRIVER_COLUMNS);
const TRACK_COLUMNS = new Set(DEFAULT_TRACK_COLUMNS);
const PANELS = new Set(DEFAULT_INFORMATION_VIEW_PREFERENCES.dataHubPanelOrder);

function uniqueKnown<T extends string>(values: unknown, known: Set<T>, fallback: T[]): T[] {
  if (!Array.isArray(values)) return [...fallback];
  const clean = [...new Set(values.filter((value): value is T => typeof value === 'string' && known.has(value as T)))];
  return clean.length ? clean : [...fallback];
}

function sanitize(raw: unknown): InformationViewPreferences {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_INFORMATION_VIEW_PREFERENCES };
  const input = raw as Partial<InformationViewPreferences>;
  const density = input.density === 'compact' || input.density === 'detailed' ? input.density : 'standard';
  const widths = (value: unknown) => value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).flatMap(([key, width]) =>
      typeof width === 'number' && Number.isFinite(width)
        ? [[key, Math.max(70, Math.min(320, Math.round(width)))]]
        : []))
    : {};
  const namedViews = Array.isArray(input.namedViews)
    ? input.namedViews.flatMap((view) => {
      if (!view || typeof view !== 'object') return [];
      const item = view as Partial<NamedDataHubView>;
      if (typeof item.id !== 'string' || typeof item.name !== 'string') return [];
      const tab: DataHubTab = item.tab === 'drivers' || item.tab === 'tracks' || item.tab === 'rivals'
        ? item.tab
        : 'overview';
      const viewDensity: InformationDensity = item.density === 'compact' || item.density === 'detailed'
        ? item.density
        : 'standard';
      return [{
        id: item.id,
        name: item.name.slice(0, 40),
        tab,
        rivalTeamId: typeof item.rivalTeamId === 'string' ? item.rivalTeamId : '',
        density: viewDensity,
        panelOrder: uniqueKnown(item.panelOrder, PANELS, DEFAULT_INFORMATION_VIEW_PREFERENCES.dataHubPanelOrder),
        driverColumns: uniqueKnown(item.driverColumns, DRIVER_COLUMNS, DEFAULT_DRIVER_COLUMNS),
        trackColumns: uniqueKnown(item.trackColumns, TRACK_COLUMNS, DEFAULT_TRACK_COLUMNS),
        columnWidths: widths(item.columnWidths),
      }];
    }).slice(-12)
    : [];
  return {
    version: 1,
    density,
    pinnedFindingIds: Array.isArray(input.pinnedFindingIds)
      ? [...new Set(input.pinnedFindingIds.filter((id): id is string => typeof id === 'string'))].slice(-12)
      : [],
    dataHubPanelOrder: uniqueKnown(input.dataHubPanelOrder, PANELS, DEFAULT_INFORMATION_VIEW_PREFERENCES.dataHubPanelOrder),
    driverColumns: uniqueKnown(input.driverColumns, DRIVER_COLUMNS, DEFAULT_DRIVER_COLUMNS),
    trackColumns: uniqueKnown(input.trackColumns, TRACK_COLUMNS, DEFAULT_TRACK_COLUMNS),
    columnWidths: widths(input.columnWidths),
    namedViews,
  };
}

export function informationViewStorageKey(careerId: string): string {
  return `${STORAGE_PREFIX}:${careerId}`;
}

export function loadInformationViewPreferences(careerId: string): InformationViewPreferences {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_INFORMATION_VIEW_PREFERENCES };
  try {
    const raw = localStorage.getItem(informationViewStorageKey(careerId));
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_INFORMATION_VIEW_PREFERENCES };
  } catch {
    return { ...DEFAULT_INFORMATION_VIEW_PREFERENCES };
  }
}

export function saveInformationViewPreferences(careerId: string, preferences: InformationViewPreferences): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(informationViewStorageKey(careerId), JSON.stringify(sanitize(preferences)));
  } catch {
    // Display preferences are optional; storage failure must never block the career.
  }
}

export function useInformationViewPreferences(careerId: string) {
  const [preferences, setPreferencesState] = useState(() => loadInformationViewPreferences(careerId));
  const setPreferences = useCallback((update: InformationViewPreferences | ((current: InformationViewPreferences) => InformationViewPreferences)) => {
    setPreferencesState((current) => {
      const next = sanitize(typeof update === 'function' ? update(current) : update);
      saveInformationViewPreferences(careerId, next);
      return next;
    });
  }, [careerId]);
  const resetPreferences = useCallback(() => {
    const defaults = { ...DEFAULT_INFORMATION_VIEW_PREFERENCES };
    saveInformationViewPreferences(careerId, defaults);
    setPreferencesState(defaults);
  }, [careerId]);
  return { preferences, setPreferences, resetPreferences };
}

export function moveItem<T>(items: T[], item: T, offset: -1 | 1): T[] {
  const index = items.indexOf(item);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
