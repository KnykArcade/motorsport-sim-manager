// Staff helpers: indexing the hired roster by role, computing the gameplay
// bonuses each role grants, and the annual wage bill. Pure and deterministic.

import { toMoney } from './financeEngine';
import type { StaffMember, StaffRole } from '../types/staffTypes';

export function staffByRole(staff: StaffMember[]): Partial<Record<StaffRole, StaffMember>> {
  const map: Partial<Record<StaffRole, StaffMember>> = {};
  for (const s of staff) {
    const existing = map[s.role];
    if (!existing || s.rating > existing.rating) map[s.role] = s;
  }
  return map;
}

function roleRating(staff: StaffMember[], role: StaffRole): number {
  return staffByRole(staff)[role]?.rating ?? 0;
}

// Technical Director lifts development project success chance. A rating of 5 is
// neutral; each point above adds ~3 percentage points (capped).
export function developmentSuccessBonus(staff: StaffMember[]): number {
  const r = roleRating(staff, 'Technical Director');
  if (r <= 0) return 0;
  return Math.max(-0.15, Math.min(0.2, (r - 5) * 0.03));
}

// Race Engineer adds flat setup confidence points (0-100 scale).
export function setupConfidenceBonus(staff: StaffMember[]): number {
  const r = roleRating(staff, 'Race Engineer');
  if (r <= 0) return 0;
  return Math.max(-6, Math.min(10, (r - 5) * 1.5));
}

// Pit Crew Chief sharpens pit-stop execution. A rating of 5 is neutral; each
// point above reduces pit time loss and fumble chance. Returns a bonus on the
// same 0-neutral scale as opsForm (positive = better stops).
export function pitCrewBonus(staff: StaffMember[]): number {
  const r = roleRating(staff, 'Pit Crew Chief');
  if (r <= 0) return 0;
  return Math.max(-0.3, Math.min(0.4, (r - 5) * 0.06));
}

// Strategist improves in-race strategy calls. A rating of 5 is neutral; each
// point above adds a small strategy-execution bonus (used in quick sim).
export function strategyBonus(staff: StaffMember[]): number {
  const r = roleRating(staff, 'Strategist');
  if (r <= 0) return 0;
  return Math.max(-0.2, Math.min(0.3, (r - 5) * 0.05));
}

// Total annual staff wages, in raw dollars.
export function totalStaffSalary(staff: StaffMember[]): number {
  return staff.reduce((sum, s) => sum + toMoney(s.salary), 0);
}
