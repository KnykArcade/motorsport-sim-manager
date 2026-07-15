import { getStaffPool } from '../data';
import type { Team } from '../types/gameTypes';
import { STAFF_ROLES, type StaffMember, type StaffRole } from '../types/staffTypes';

export type AIStaffRosters = Record<string, StaffMember[]>;

function targetRating(team: Team): number {
  return Math.max(35, Math.min(96, Math.round(38 + team.reputation * 0.58)));
}

function bestAvailable(
  pool: readonly StaffMember[],
  used: Set<string>,
  role: StaffRole,
  target: number,
): StaffMember | undefined {
  return pool
    .filter((member) => member.role === role && !used.has(member.id))
    .sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target) || b.rating - a.rating || a.id.localeCompare(b.id))[0];
}

function fillMissingRoles(
  rosters: AIStaffRosters,
  teams: readonly Team[],
  selectedTeamId: string,
  year: number,
  series: string,
  reservedStaff: readonly StaffMember[],
): AIStaffRosters {
  const pool = getStaffPool(year, series);
  const used = new Set([
    ...reservedStaff.map((member) => member.id),
    ...Object.values(rosters).flat().map((member) => member.id),
  ]);
  const next = Object.fromEntries(Object.entries(rosters).map(([teamId, staff]) => [teamId, staff.map((member) => ({ ...member }))]));
  for (const team of [...teams].filter((entry) => entry.id !== selectedTeamId).sort((a, b) => b.reputation - a.reputation || a.id.localeCompare(b.id))) {
    const roster = next[team.id] ?? [];
    for (const role of STAFF_ROLES) {
      if (roster.some((member) => member.role === role)) continue;
      const candidate = bestAvailable(pool, used, role, targetRating(team));
      if (!candidate) continue;
      roster.push({ ...candidate, contractYearsRemaining: 2 });
      used.add(candidate.id);
    }
    next[team.id] = roster;
  }
  return next;
}

export function ensureAIStaffRosters(
  existing: AIStaffRosters | undefined,
  initialized: boolean | undefined,
  teams: readonly Team[],
  selectedTeamId: string,
  year: number,
  series: string,
  reservedStaff: readonly StaffMember[] = [],
): AIStaffRosters {
  if (initialized) return existing ?? {};
  return fillMissingRoles(existing ?? {}, teams, selectedTeamId, year, series, reservedStaff);
}

export function rolloverAIStaffRosters(
  existing: AIStaffRosters | undefined,
  teams: readonly Team[],
  selectedTeamId: string,
  year: number,
  series: string,
  reservedStaff: readonly StaffMember[] = [],
): AIStaffRosters {
  const reservedIds = new Set(reservedStaff.map((member) => member.id));
  const aged = Object.fromEntries(Object.entries(existing ?? {}).map(([teamId, staff]) => [
    teamId,
    staff
      .filter((member) => !reservedIds.has(member.id))
      .map((member) => ({ ...member, contractYearsRemaining: Math.max(0, (member.contractYearsRemaining ?? 2) - 1) }))
      .filter((member) => (member.contractYearsRemaining ?? 0) > 0),
  ]));
  return fillMissingRoles(aged, teams, selectedTeamId, year, series, reservedStaff);
}

export function staffEmployer(aiStaff: AIStaffRosters | undefined, staffId: string): string | undefined {
  return Object.entries(aiStaff ?? {}).find(([, staff]) => staff.some((member) => member.id === staffId))?.[0];
}

export function staffPoachingCompensation(member: StaffMember): number {
  return Math.round(member.salary * Math.max(1, member.contractYearsRemaining ?? 2) * 0.75 * 1_000_000);
}
