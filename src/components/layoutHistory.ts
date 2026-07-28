export type NavigationHistoryEntry = {
  to: string;
  title: string;
  visitedAt: number;
};

const STORAGE_KEY = 'msm-navigation-history-v1';
const MAX_ENTRIES = 12;

export function readNavigationHistory(
  storage: Pick<Storage, 'getItem'> | undefined,
): NavigationHistoryEntry[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as NavigationHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) =>
      typeof entry?.to === 'string'
      && entry.to.startsWith('/')
      && typeof entry.title === 'string'
      && Number.isFinite(entry.visitedAt));
  } catch {
    return [];
  }
}

export function updateNavigationHistory(
  current: ReadonlyArray<NavigationHistoryEntry>,
  entry: NavigationHistoryEntry,
): NavigationHistoryEntry[] {
  const withoutCurrent = current.filter((candidate) => candidate.to !== entry.to);
  return [entry, ...withoutCurrent].slice(0, MAX_ENTRIES);
}

export function writeNavigationHistory(
  storage: Pick<Storage, 'setItem'> | undefined,
  entries: ReadonlyArray<NavigationHistoryEntry>,
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Navigation history is a convenience feature and must never block play.
  }
}
