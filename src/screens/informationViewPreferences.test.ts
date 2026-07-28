import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_INFORMATION_VIEW_PREFERENCES,
  informationViewStorageKey,
  loadInformationViewPreferences,
  moveItem,
  saveInformationViewPreferences,
} from './informationViewPreferences';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

describe('information view preferences', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  it('persists pins, density, panel order, columns, and named views per career', () => {
    const preferences = {
      ...DEFAULT_INFORMATION_VIEW_PREFERENCES,
      density: 'compact' as const,
      pinnedFindingIds: ['qualifying-gap'],
      dataHubPanelOrder: ['findings', 'indicators', 'context'] as const,
      driverColumns: ['driver', 'finish', 'races'] as const,
      columnWidths: { 'driver:driver': 180 },
      namedViews: [{
        id: 'race-review',
        name: 'Race review',
        tab: 'drivers' as const,
        rivalTeamId: 'rival',
        density: 'compact' as const,
        panelOrder: ['findings', 'indicators', 'context'] as const,
        driverColumns: ['driver', 'finish', 'races'] as const,
        trackColumns: ['archetype', 'points'] as const,
        columnWidths: { 'driver:driver': 180 },
      }],
    };
    saveInformationViewPreferences('career-a', {
      ...preferences,
      dataHubPanelOrder: [...preferences.dataHubPanelOrder],
      driverColumns: [...preferences.driverColumns],
      namedViews: preferences.namedViews.map((view) => ({
        ...view,
        panelOrder: [...view.panelOrder],
        driverColumns: [...view.driverColumns],
        trackColumns: [...view.trackColumns],
        columnWidths: { ...view.columnWidths },
      })),
    });

    expect(loadInformationViewPreferences('career-a')).toMatchObject({
      density: 'compact',
      pinnedFindingIds: ['qualifying-gap'],
      dataHubPanelOrder: ['findings', 'indicators', 'context'],
      driverColumns: ['driver', 'finish', 'races'],
      columnWidths: { 'driver:driver': 180 },
      namedViews: [{ name: 'Race review', tab: 'drivers' }],
    });
    expect(loadInformationViewPreferences('career-b')).toEqual(DEFAULT_INFORMATION_VIEW_PREFERENCES);
    expect(localStorage.getItem(informationViewStorageKey('career-a'))).toContain('qualifying-gap');
  });

  it('sanitizes malformed preferences and always keeps a usable primary column', () => {
    localStorage.setItem(informationViewStorageKey('career-a'), JSON.stringify({
      density: 'microscopic',
      driverColumns: ['made-up'],
      trackColumns: [],
      dataHubPanelOrder: ['context', 'made-up'],
      pinnedFindingIds: [12, 'valid'],
    }));
    const loaded = loadInformationViewPreferences('career-a');
    expect(loaded.density).toBe('standard');
    expect(loaded.driverColumns).toEqual(DEFAULT_INFORMATION_VIEW_PREFERENCES.driverColumns);
    expect(loaded.trackColumns).toEqual(DEFAULT_INFORMATION_VIEW_PREFERENCES.trackColumns);
    expect(loaded.dataHubPanelOrder).toEqual(['context']);
    expect(loaded.pinnedFindingIds).toEqual(['valid']);
  });

  it('reorders visible information without mutating the source list', () => {
    const source = ['a', 'b', 'c'];
    expect(moveItem(source, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(source, 'b', 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(source, 'a', -1)).toBe(source);
    expect(source).toEqual(['a', 'b', 'c']);
  });
});
