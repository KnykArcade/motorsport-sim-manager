import type { StaffMember } from '../types/staffTypes';

export const STAFF_RECRUITMENT_SORT_KEYS = [
  'name',
  'rating',
  'salary',
  'signingFee',
  'poachingCost',
  'totalCost',
] as const;

export type StaffRecruitmentSortKey = (typeof STAFF_RECRUITMENT_SORT_KEYS)[number];

export type StaffRecruitmentSort = {
  key: StaffRecruitmentSortKey;
  direction: 'asc' | 'desc';
};

export type StaffRecruitmentFilters = {
  query: string;
  affordableOnly: boolean;
  underContractOnly: boolean;
};

export const DEFAULT_STAFF_RECRUITMENT_FILTERS: StaffRecruitmentFilters = {
  query: '',
  affordableOnly: false,
  underContractOnly: false,
};

export type StaffRecruitmentCandidate = StaffMember & {
  employerName?: string;
  poachingCost: number;
  totalCost: number;
  affordable: boolean;
};

export function filterStaffRecruitmentCandidates(
  candidates: StaffRecruitmentCandidate[],
  filters: StaffRecruitmentFilters,
  budget: number,
): StaffRecruitmentCandidate[] {
  const query = filters.query.trim().toLowerCase();
  return candidates.filter((candidate) => {
    if (query && ![
      candidate.name,
      candidate.nationality,
      candidate.role,
      candidate.employerName ?? '',
      candidate.bio,
    ].some((value) => value.toLowerCase().includes(query))) return false;
    if (filters.affordableOnly && candidate.totalCost > budget) return false;
    if (filters.underContractOnly && !candidate.employerName) return false;
    return true;
  });
}

export function sortStaffRecruitmentCandidates(
  candidates: StaffRecruitmentCandidate[],
  sort: StaffRecruitmentSort,
): StaffRecruitmentCandidate[] {
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...candidates].sort((left, right) => {
    const leftValue = sortValue(left, sort.key);
    const rightValue = sortValue(right, sort.key);
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return direction;
    return left.name.localeCompare(right.name);
  });
}

function sortValue(candidate: StaffRecruitmentCandidate, key: StaffRecruitmentSortKey): number | string {
  if (key === 'name') return candidate.name;
  return candidate[key];
}
