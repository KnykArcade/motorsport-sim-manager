import type { Series, Track } from '../types/gameTypes';
import {
  RACE_ENGINEER_ATTRIBUTE_LABELS,
  ROLE_EFFECT,
  STAFF_ROLES,
  type RaceEngineerProfile,
  type StaffMember,
  type StaffRole,
} from '../types/staffTypes';
import {
  deriveRaceEngineerProfile,
  raceEngineerSpecialty,
  raceEngineerStrengths,
  raceEngineerTrackRating,
} from '../sim/raceEngineerEngine';

export type StaffDepartmentRow = {
  role: StaffRole;
  rating: number;
  level: number;
  effect: string;
  canImprove: boolean;
  disabledReason?: string;
  memberName?: string;
  engineering?: {
    profile: RaceEngineerProfile;
    specialty: string;
    strongest: string;
    weakest: string;
    currentRelevance?: number;
  };
};

export function normalizedDepartmentRating(rating?: number): number {
  if (rating == null) return 50;
  return Math.max(0, Math.min(100, rating <= 10 ? rating * 10 : rating));
}

export function staffDepartmentRows(
  staff: ReadonlyArray<
    Pick<StaffMember, 'role' | 'rating'>
    & Partial<Pick<StaffMember, 'id' | 'name' | 'engineeringProfile'>>
  > | undefined,
  principalPoints: number,
  track?: Track,
  series?: Series,
): StaffDepartmentRow[] {
  return STAFF_ROLES.map((role) => {
    const member = staff?.find((entry) => entry.role === role);
    const rating = normalizedDepartmentRating(member?.rating);
    const canImprove = rating < 100 && principalPoints > 0;
    const profile = role === 'Race Engineer' && member
      ? deriveRaceEngineerProfile({
        id: member.id ?? `department-${role}`,
        name: member.name ?? role,
        rating: member.rating,
        engineeringProfile: member.engineeringProfile,
      })
      : undefined;
    const strengths = profile ? raceEngineerStrengths(profile) : undefined;
    return {
      role,
      rating,
      level: Math.max(1, Math.round(rating / 10)),
      effect: ROLE_EFFECT[role],
      memberName: member?.name,
      engineering: profile && strengths ? {
        profile,
        specialty: raceEngineerSpecialty(profile),
        strongest: RACE_ENGINEER_ATTRIBUTE_LABELS[strengths.strongest],
        weakest: RACE_ENGINEER_ATTRIBUTE_LABELS[strengths.weakest],
        currentRelevance: track ? raceEngineerTrackRating(profile, track, series) : undefined,
      } : undefined,
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
