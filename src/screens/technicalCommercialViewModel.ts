export const TECHNICAL_SECTIONS = [
  { id: 'command', label: 'Command' },
  { id: 'development', label: 'Development' },
  { id: 'parts', label: 'Parts & Factory' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'engine', label: 'Engine' },
] as const;

export type TechnicalSection = (typeof TECHNICAL_SECTIONS)[number]['id'];

export function technicalSectionFromQuery(value: string | null): TechnicalSection {
  return TECHNICAL_SECTIONS.some((section) => section.id === value)
    ? value as TechnicalSection
    : 'command';
}

export function selectedTechnicalRecord<T extends { id: string }>(
  records: readonly T[],
  selectedId?: string | null,
  preferredId?: string | null,
): T | undefined {
  return records.find((record) => record.id === selectedId)
    ?? records.find((record) => record.id === preferredId)
    ?? records[0];
}

export function selectedNamedRecord<T extends { name: string }>(
  records: readonly T[],
  selectedName?: string | null,
): T | undefined {
  return records.find((record) => record.name === selectedName) ?? records[0];
}

export type TechnicalActionGate = {
  modeAllowed?: boolean;
  capacityFull?: boolean;
  cashAvailable?: number;
  cashCost?: number;
  tppAvailable?: number;
  tppCost?: number;
};

export function technicalActionDisabledReason(gate: TechnicalActionGate): string | undefined {
  if (gate.modeAllowed === false) return 'This program is unavailable in the current game mode.';
  if (gate.capacityFull) return 'All technical capacity is currently committed.';
  if ((gate.cashAvailable ?? 0) < (gate.cashCost ?? 0)) return 'The team does not have enough available cash.';
  if ((gate.tppAvailable ?? 0) < (gate.tppCost ?? 0)) return 'The research programme does not have enough TPP.';
  return undefined;
}

export type FacilityUpgradeGate = {
  maxed: boolean;
  pending: boolean;
  affordable: boolean;
};

export function facilityUpgradeDisabledReason(gate: FacilityUpgradeGate): string | undefined {
  if (gate.maxed) return 'This facility is already at its maximum level.';
  if (gate.pending) return 'An upgrade for this facility is already in the construction queue.';
  if (!gate.affordable) return 'The team cannot afford this facility upgrade.';
  return undefined;
}

export function financeCoverageLabel(coverage: number | null): string {
  if (coverage === null) return 'No recurring commitments';
  if (coverage < 1) return 'Commitments exceed cash';
  if (coverage < 1.5) return 'Limited cash headroom';
  return 'Commitments covered';
}

export function regulationVotingStatus(
  votingLocked: boolean,
  unvotedCount: number,
  lockRound: number,
): string {
  if (votingLocked) return `Voting locked after round ${lockRound}.`;
  if (unvotedCount > 0) return `${unvotedCount} proposal${unvotedCount === 1 ? '' : 's'} awaiting your vote.`;
  return 'All open proposals have a recorded vote.';
}
