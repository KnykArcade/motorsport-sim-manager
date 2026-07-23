import { describe, expect, it } from 'vitest';
import type { StaffMember } from '../types/staffTypes';
import {
  STAFF_PAGE_SIZE,
  STAFF_WORKSPACE_TABS,
  staffPage,
  staffPageCount,
  staffRoleFromQuery,
  staffTabFromQuery,
  staffVacancyCount,
} from './staffViewModel';
import {
  DEFAULT_STAFF_RECRUITMENT_FILTERS,
  filterStaffRecruitmentCandidates,
  sortStaffRecruitmentCandidates,
  type StaffRecruitmentCandidate,
} from './staffRecruitmentListViewModel';

describe('staff view model', () => {
  it('keeps roster, contracts, council, and recruitment separate', () => {
    expect(STAFF_WORKSPACE_TABS.map((tab) => tab.id)).toEqual([
      'roster', 'contracts', 'council', 'market',
    ]);
  });

  it('shows three complete staff cards per page and clamps boundaries', () => {
    const entries = Array.from({ length: 8 }, (_, index) => index + 1);
    expect(STAFF_PAGE_SIZE).toBe(3);
    expect(staffPageCount(entries.length)).toBe(3);
    expect(staffPage(entries, 0)).toEqual([1, 2, 3]);
    expect(staffPage(entries, 2)).toEqual([7, 8]);
    expect(staffPage(entries, 99)).toEqual([7, 8]);
  });

  it('counts unique vacant staff roles', () => {
    const member = (id: string, role: StaffMember['role']): StaffMember => ({
      id,
      name: id,
      role,
      nationality: 'GB',
      rating: 7,
      salary: 1,
      signingFee: 1,
      bio: '',
    });
    expect(staffVacancyCount([])).toBe(4);
    expect(staffVacancyCount([
      member('technical', 'Technical Director'),
      member('engineer', 'Race Engineer'),
    ])).toBe(2);
    expect(staffVacancyCount([
      member('technical-a', 'Technical Director'),
      member('technical-b', 'Technical Director'),
    ])).toBe(3);
  });

  it('normalizes Staff deep-link tabs', () => {
    expect(staffTabFromQuery('market')).toBe('market');
    expect(staffTabFromQuery('contracts')).toBe('contracts');
    expect(staffTabFromQuery('unknown')).toBe('roster');
    expect(staffTabFromQuery(null)).toBe('roster');
  });

  it('normalizes Staff recruitment role deep links', () => {
    expect(staffRoleFromQuery('Strategist')).toBe('Strategist');
    expect(staffRoleFromQuery('unknown')).toBe('Technical Director');
    expect(staffRoleFromQuery(null)).toBe('Technical Director');
  });

  it('filters recruitment candidates by search, affordability, and contract status', () => {
    const candidate = (overrides: Partial<StaffRecruitmentCandidate>): StaffRecruitmentCandidate => ({
      id: 'candidate',
      name: 'Candidate',
      role: 'Strategist',
      nationality: 'GB',
      rating: 8,
      salary: 2,
      signingFee: 1,
      bio: 'Race strategy specialist',
      poachingCost: 0,
      totalCost: 1,
      affordable: true,
      ...overrides,
    });
    const filtered = filterStaffRecruitmentCandidates([
      candidate({ id: 'available', name: 'Alex Available', employerName: undefined, totalCost: 1 }),
      candidate({ id: 'poachable', name: 'Morgan Rival', employerName: 'Rival GP', totalCost: 5 }),
    ], {
      ...DEFAULT_STAFF_RECRUITMENT_FILTERS,
      query: 'rival',
      affordableOnly: true,
      underContractOnly: true,
    }, 3);
    expect(filtered).toEqual([]);
    expect(filterStaffRecruitmentCandidates([
      candidate({ id: 'available', name: 'Alex Available', employerName: undefined }),
      candidate({ id: 'poachable', name: 'Morgan Rival', employerName: 'Rival GP' }),
    ], {
      ...DEFAULT_STAFF_RECRUITMENT_FILTERS,
      query: 'strategy',
      underContractOnly: true,
    }, 3).map((entry) => entry.id)).toEqual(['poachable']);
  });

  it('sorts recruitment candidates by rating and total cost', () => {
    const candidate = (overrides: Partial<StaffRecruitmentCandidate>): StaffRecruitmentCandidate => ({
      id: 'candidate',
      name: 'Candidate',
      role: 'Strategist',
      nationality: 'GB',
      rating: 8,
      salary: 2,
      signingFee: 1,
      bio: '',
      poachingCost: 0,
      totalCost: 1,
      affordable: true,
      ...overrides,
    });
    const candidates = [
      candidate({ id: 'a', name: 'A', rating: 7, totalCost: 4 }),
      candidate({ id: 'b', name: 'B', rating: 9, totalCost: 2 }),
    ];
    expect(sortStaffRecruitmentCandidates(candidates, { key: 'rating', direction: 'desc' }).map((entry) => entry.id))
      .toEqual(['b', 'a']);
    expect(sortStaffRecruitmentCandidates(candidates, { key: 'totalCost', direction: 'asc' }).map((entry) => entry.id))
      .toEqual(['b', 'a']);
  });
});
