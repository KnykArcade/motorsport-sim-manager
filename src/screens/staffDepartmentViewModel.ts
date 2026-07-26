import { ROLE_EFFECT, STAFF_ROLES, type StaffRole } from '../types/staffTypes';

export type StaffDepartmentRow = {
  role: StaffRole;
  rating: number;
  level: number;
  effect: string;
  canImprove: boolean;
  disabledReason?: string;
};

export function normalizedDepartmentRating(rating?: number): number {
  if (rating == null) return 50;
  return Math.max(0, Math.min(100, rating <= 10 ? rating * 10 : rating));
}

export function staffDepartmentRows(
  staff: ReadonlyArray<{ role: StaffRole; rating: number }> | undefined,
  principalPoints: number,
): StaffDepartmentRow[] {
  return STAFF_ROLES.map((role) => {
    const rating = normalizedDepartmentRating(staff?.find((entry) => entry.role === role)?.rating);
    const canImprove = rating < 100 && principalPoints > 0;
    return {
      role,
      rating,
      level: Math.max(1, Math.round(rating / 10)),
      effect: ROLE_EFFECT[role],
      canImprove,
      disabledReason: rating >= 100
        ? 'Department is already at its maximum rating.'
        : principalPoints <= 0
          ? 'No Principal Points are available.'
          : undefined,
    };
  });
}

export function selectedStaffDepartment(
  departments: readonly StaffDepartmentRow[],
  selectedRole?: StaffRole,
): StaffDepartmentRow | undefined {
  return departments.find((department) => department.role === selectedRole) ?? departments[0];
}
