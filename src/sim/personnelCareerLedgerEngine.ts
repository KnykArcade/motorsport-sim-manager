import type { GameState } from '../game/careerState';
import type { PersonnelCareerKind, PersonnelCareerTenure } from '../types/personnelCareerTypes';

type Employment = {
  kind: PersonnelCareerKind;
  personId: string;
  personName: string;
  role: string;
  teamId: string;
  teamName: string;
};

// Large enough to retain the complete 1990–2026 history even for NASCAR's
// biggest staff universe, while still protecting local saves from corruption.
const MAX_PERSONNEL_TENURES = 12_000;

function personKey(entry: Pick<Employment, 'kind' | 'personId'>): string {
  return `${entry.kind}:${entry.personId}`;
}

function employmentSnapshot(state: GameState): Map<string, Employment> {
  const result = new Map<string, Employment>();
  const teamName = (teamId: string) => state.teams.find((team) => team.id === teamId)?.name ?? teamId;
  if (state.principal) {
    const teamId = state.principal.currentTeamId || state.selectedTeamId;
    const entry: Employment = {
      kind: 'TeamPrincipal',
      personId: state.principal.id,
      personName: state.principal.name,
      role: 'Team Principal / Crew Chief',
      teamId,
      teamName: teamName(teamId),
    };
    result.set(personKey(entry), entry);
  }
  for (const [teamId, principal] of Object.entries(state.aiPrincipals ?? {})) {
    const entry: Employment = {
      kind: 'TeamPrincipal',
      personId: principal.principalId,
      personName: principal.name,
      role: 'Team Principal / Crew Chief',
      teamId,
      teamName: teamName(teamId),
    };
    result.set(personKey(entry), entry);
  }
  for (const staff of state.staff ?? []) {
    const entry: Employment = {
      kind: 'Staff',
      personId: staff.id,
      personName: staff.name,
      role: staff.role,
      teamId: state.selectedTeamId,
      teamName: teamName(state.selectedTeamId),
    };
    result.set(personKey(entry), entry);
  }
  for (const [teamId, roster] of Object.entries(state.aiStaff ?? {})) {
    for (const staff of roster) {
      const entry: Employment = {
        kind: 'Staff',
        personId: staff.id,
        personName: staff.name,
        role: staff.role,
        teamId,
        teamName: teamName(teamId),
      };
      result.set(personKey(entry), entry);
    }
  }
  return result;
}

function tenureId(entry: Employment, season: number, ordinal: number): string {
  return `tenure-${entry.kind}-${entry.personId}-${entry.teamId}-${season}-${ordinal}`;
}

function openTenure(entry: Employment, season: number, reason: string, ordinal: number): PersonnelCareerTenure {
  return {
    id: tenureId(entry, season, ordinal),
    ...entry,
    startedSeason: season,
    joinedReason: reason,
  };
}

export function ensurePersonnelCareerLedger(state: GameState): GameState {
  const ledger = [...(state.personnelCareerHistory ?? [])];
  const employed = employmentSnapshot(state);
  for (const entry of employed.values()) {
    const active = ledger.some((tenure) => tenure.kind === entry.kind && tenure.personId === entry.personId && tenure.endedSeason == null);
    if (!active) ledger.push(openTenure(entry, state.seasonYear, 'Career record initialized', ledger.length + 1));
  }
  return { ...state, personnelCareerHistory: ledger.slice(-MAX_PERSONNEL_TENURES) };
}

export function reconcilePersonnelCareerLedger(
  before: GameState,
  after: GameState,
  season: number,
  reason = 'Personnel decision',
): GameState {
  const seeded = ensurePersonnelCareerLedger(before);
  const ledger = seeded.personnelCareerHistory!.map((tenure) => ({ ...tenure }));
  const previous = employmentSnapshot(seeded);
  const current = employmentSnapshot(after);

  for (const [key, oldJob] of previous) {
    const nextJob = current.get(key);
    if (nextJob?.teamId === oldJob.teamId) continue;
    const index = ledger.findLastIndex((tenure) => tenure.kind === oldJob.kind && tenure.personId === oldJob.personId && tenure.endedSeason == null);
    if (index >= 0) {
      ledger[index] = {
        ...ledger[index],
        endedSeason: season,
        leftReason: nextJob ? `Moved to ${nextJob.teamName}` : reason,
      };
    }
  }

  for (const [key, newJob] of current) {
    const oldJob = previous.get(key);
    if (oldJob?.teamId === newJob.teamId) continue;
    const joinedReason = oldJob ? `Moved from ${oldJob.teamName}` : reason;
    ledger.push(openTenure(newJob, season, joinedReason, ledger.length + 1));
  }

  return { ...after, personnelCareerHistory: ledger.slice(-MAX_PERSONNEL_TENURES) };
}

export function personnelCareerFor(
  state: GameState,
  kind: PersonnelCareerKind,
  personId: string,
): PersonnelCareerTenure[] {
  return (state.personnelCareerHistory ?? [])
    .filter((tenure) => tenure.kind === kind && tenure.personId === personId)
    .sort((a, b) => b.startedSeason - a.startedSeason || b.id.localeCompare(a.id));
}
