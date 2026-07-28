import type { QualifyingDecision, RaceDecision } from '../types/simTypes';
import type { CarSetup } from '../types/setupTypes';
import {
  RACE_WEEKEND_PHASES,
  type RaceWeekendPhase,
} from './raceTransitionViewModel';

export type RaceWeekendUiDraft = {
  raceId: string;
  phase: RaceWeekendPhase;
  furthestPhase: RaceWeekendPhase;
  setupDraft: Record<string, CarSetup>;
  qualifyingOverrides: Record<string, Partial<QualifyingDecision>>;
  raceOverrides: Record<string, Partial<RaceDecision>>;
};

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const DRAFT_PREFIX = 'motorsport-manager:race-weekend-draft:';
const VALID_PHASES = new Set(RACE_WEEKEND_PHASES.map((phase) => phase.id));

function draftKey(raceId: string): string {
  return `${DRAFT_PREFIX}${raceId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readRaceWeekendUiDraft(
  storage: DraftStorage | undefined,
  raceId: string,
): RaceWeekendUiDraft | undefined {
  if (!storage) return undefined;
  try {
    const raw = storage.getItem(draftKey(raceId));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed)
      || parsed.raceId !== raceId
      || typeof parsed.phase !== 'string'
      || typeof parsed.furthestPhase !== 'string'
      || !VALID_PHASES.has(parsed.phase as RaceWeekendPhase)
      || !VALID_PHASES.has(parsed.furthestPhase as RaceWeekendPhase)
      || !isRecord(parsed.setupDraft)
      || !isRecord(parsed.qualifyingOverrides)
      || !isRecord(parsed.raceOverrides)
    ) {
      storage.removeItem(draftKey(raceId));
      return undefined;
    }
    return parsed as RaceWeekendUiDraft;
  } catch {
    storage.removeItem(draftKey(raceId));
    return undefined;
  }
}

export function writeRaceWeekendUiDraft(
  storage: DraftStorage | undefined,
  draft: RaceWeekendUiDraft,
): void {
  if (!storage) return;
  try {
    storage.setItem(draftKey(draft.raceId), JSON.stringify(draft));
  } catch {
    // A full or unavailable session store must not block race-weekend play.
  }
}

export function clearRaceWeekendUiDraft(
  storage: DraftStorage | undefined,
  raceId: string,
): void {
  if (!storage) return;
  try {
    storage.removeItem(draftKey(raceId));
  } catch {
    // Storage cleanup is best-effort after the race starts.
  }
}
