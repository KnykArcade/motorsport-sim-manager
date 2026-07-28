export type InboxWorkspaceState = {
  teamId: string;
  seasonYear: number;
  category: string;
  section: string;
  selectedMessageId?: string;
  listScrollTop: number;
  contextScrollTop: number;
};

type WorkspaceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const WORKSPACE_KEY = 'motorsport-manager:inbox-workspace';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function readInboxWorkspaceState(
  storage: WorkspaceStorage | undefined,
  teamId: string,
  seasonYear: number,
): InboxWorkspaceState | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(WORKSPACE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed)
      || parsed.teamId !== teamId
      || parsed.seasonYear !== seasonYear
      || typeof parsed.category !== 'string'
      || typeof parsed.section !== 'string'
      || (parsed.selectedMessageId !== undefined && typeof parsed.selectedMessageId !== 'string')
      || typeof parsed.listScrollTop !== 'number'
      || typeof parsed.contextScrollTop !== 'number'
    ) {
      storage.removeItem(WORKSPACE_KEY);
      return undefined;
    }
    return parsed as InboxWorkspaceState;
  } catch {
    storage.removeItem(WORKSPACE_KEY);
    return undefined;
  }
}

export function writeInboxWorkspaceState(
  storage: WorkspaceStorage | undefined,
  state: InboxWorkspaceState,
): void {
  if (!storage) return;
  try {
    storage.setItem(WORKSPACE_KEY, JSON.stringify(state));
  } catch {
    // Workspace restoration is best-effort and must never block play.
  }
}
