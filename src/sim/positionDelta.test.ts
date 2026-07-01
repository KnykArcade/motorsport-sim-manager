import { describe, it, expect } from 'vitest';
import {
  positionDeltaValue,
  gridMovement,
  biggestGainer,
  biggestLoser,
  playerTeamDeltaSummary,
  deltaPhrase,
  type Classified,
} from './positionDelta';

describe('positionDelta — value + movement', () => {
  it('computes delta as grid - position (positive = gained)', () => {
    expect(positionDeltaValue(12, 11)).toBe(1); // started P12, now P11 = +1
    expect(positionDeltaValue(9, 9)).toBe(0); // no change
    expect(positionDeltaValue(5, 8)).toBe(-3); // lost 3
  });

  it('returns null delta for an unclassified (retired) driver', () => {
    expect(positionDeltaValue(9, null)).toBeNull();
    const m = gridMovement('d1', 9, null);
    expect(m.positionDelta).toBeNull();
    expect(m.positionsGained).toBe(0);
    expect(m.positionsLost).toBe(0);
  });

  it('splits gained / lost into separate non-negative counts', () => {
    const up = gridMovement('d1', 12, 11);
    expect(up.positionsGained).toBe(1);
    expect(up.positionsLost).toBe(0);

    const flat = gridMovement('d2', 9, 9);
    expect(flat.positionsGained).toBe(0);
    expect(flat.positionsLost).toBe(0);

    const down = gridMovement('d3', 5, 8);
    expect(down.positionsGained).toBe(0);
    expect(down.positionsLost).toBe(3);
  });
});

describe('positionDelta — biggest movers', () => {
  const rows: Classified[] = [
    { driverId: 'a', gridPosition: 20, position: 8, teamId: 't1' }, // +12
    { driverId: 'b', gridPosition: 2, position: 9, teamId: 't1' }, // -7
    { driverId: 'c', gridPosition: 5, position: 5, teamId: 't2' }, // 0
    { driverId: 'd', gridPosition: 10, position: null, teamId: 't2' }, // retired
  ];

  it('finds the biggest gainer', () => {
    const g = biggestGainer(rows);
    expect(g?.driverId).toBe('a');
    expect(g?.positionsGained).toBe(12);
  });

  it('finds the biggest loser', () => {
    const l = biggestLoser(rows);
    expect(l?.driverId).toBe('b');
    expect(l?.positionsLost).toBe(7);
  });

  it('returns null when nobody gained/lost', () => {
    const flat: Classified[] = [{ driverId: 'x', gridPosition: 4, position: 4 }];
    expect(biggestGainer(flat)).toBeNull();
    expect(biggestLoser(flat)).toBeNull();
  });
});

describe('positionDelta — player team summary + phrasing', () => {
  it('phrases gains, losses and no-change', () => {
    expect(deltaPhrase(3)).toBe('gained 3 places');
    expect(deltaPhrase(1)).toBe('gained 1 place');
    expect(deltaPhrase(-2)).toBe('lost 2 places');
    expect(deltaPhrase(0)).toBe('finished where he started');
  });

  it('summarises the player team, skipping unclassified drivers', () => {
    const rows: Classified[] = [
      { driverId: 'coul', gridPosition: 12, position: 11, teamId: 'mine' },
      { driverId: 'webb', gridPosition: 9, position: 9, teamId: 'mine' },
      { driverId: 'rival', gridPosition: 1, position: 4, teamId: 'other' },
    ];
    const names = { coul: 'Coulthard', webb: 'Webber' };
    const summary = playerTeamDeltaSummary(rows, 'mine', names);
    expect(summary).toBe('Coulthard gained 1 place; Webber finished where he started');
  });
});
