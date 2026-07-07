import { describe, it, expect } from 'vitest';
import { generateStaffPool } from './staffGenerator';
import { STAFF_ROLES } from '../types/staffTypes';

describe('staff generator', () => {
  it('produces an ample pool with candidates for every role', () => {
    const pool = generateStaffPool(1995, 'F1');
    expect(pool.length).toBeGreaterThanOrEqual(40);
    for (const role of STAFF_ROLES) {
      const forRole = pool.filter((s) => s.role === role);
      expect(forRole.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('gives every staff member a unique id and name', () => {
    const pool = generateStaffPool(1994, 'F1');
    expect(new Set(pool.map((s) => s.id)).size).toBe(pool.length);
    expect(new Set(pool.map((s) => s.name)).size).toBe(pool.length);
  });

  it('has a spread of ratings (stars and rookies) with costs that scale', () => {
    const pool = generateStaffPool(1995, 'F1');
    const ratings = pool.map((s) => s.rating);
    expect(Math.max(...ratings)).toBeGreaterThanOrEqual(90);
    expect(Math.min(...ratings)).toBeLessThanOrEqual(40);
    // Higher-rated staff cost more on average.
    const star = pool.find((s) => s.rating >= 90)!;
    const rookie = pool.find((s) => s.rating <= 40)!;
    expect(star.salary).toBeGreaterThan(rookie.salary);
  });

  it('is deterministic for the same season but differs across seasons', () => {
    expect(generateStaffPool(1995, 'F1')).toEqual(generateStaffPool(1995, 'F1'));
    const a = generateStaffPool(1995, 'F1').map((s) => s.name).join();
    const b = generateStaffPool(1997, 'F1').map((s) => s.name).join();
    expect(a).not.toEqual(b);
  });
});
