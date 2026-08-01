import { describe, expect, it } from 'vitest';
import {
  normalizedDepartmentRating,
  selectedStaffDepartment,
  staffDepartmentRows,
} from './staffDepartmentViewModel';

describe('staff department view model', () => {
  it('normalizes legacy ten-point ratings and supplies a state-backed default', () => {
    expect(normalizedDepartmentRating(7)).toBe(70);
    expect(normalizedDepartmentRating(88)).toBe(88);
    expect(normalizedDepartmentRating()).toBe(50);
  });

  it('builds permanent department rows with clear upgrade disabled reasons', () => {
    const rows = staffDepartmentRows([
      { role: 'Technical Director', rating: 100 },
      { role: 'Race Engineer', rating: 70 },
    ], 0);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ role: 'Technical Director', canImprove: false, disabledReason: 'Department is already at its maximum rating.' });
    expect(rows[1]).toMatchObject({ role: 'Race Engineer', canImprove: false, disabledReason: 'No Principal Points are available.' });
  });

  it('keeps the selected department visible and falls back to the first department', () => {
    const rows = staffDepartmentRows(undefined, 2);
    expect(selectedStaffDepartment(rows, 'Strategist')?.role).toBe('Strategist');
    expect(selectedStaffDepartment(rows)?.role).toBe('Technical Director');
    expect(selectedStaffDepartment([], 'Strategist')).toBeUndefined();
  });

  it('surfaces all specialist attributes for the Race Engineer department', () => {
    const rows = staffDepartmentRows([{
      id: 're-1',
      name: 'Engineer One',
      role: 'Race Engineer',
      rating: 72,
    }], 1);
    const engineering = rows.find((row) => row.role === 'Race Engineer')?.engineering;
    expect(engineering?.specialty).toContain('specialist');
    expect(Object.keys(engineering?.profile ?? {})).toHaveLength(8);
    expect(engineering?.strongest).toBeTruthy();
    expect(engineering?.weakest).toBeTruthy();
  });
});
