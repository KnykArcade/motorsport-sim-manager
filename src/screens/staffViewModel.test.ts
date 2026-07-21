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
});
