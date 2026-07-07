import type { PointsSystem } from '../../types/gameTypes';
import { aowPointsSystems } from './aowPointsSystems';

// Points systems are configurable per-season so future years can differ.
export const pointsSystems: Record<string, PointsSystem> = {
  'pts-1990': {
    id: 'pts-1990',
    name: '1990 (9-6-4-3-2-1)',
    pointsByPosition: { 1: 9, 2: 6, 3: 4, 4: 3, 5: 2, 6: 1 },
  },
  'pts-1995': {
    id: 'pts-1995',
    name: '1995 (10-6-4-3-2-1)',
    pointsByPosition: { 1: 10, 2: 6, 3: 4, 4: 3, 5: 2, 6: 1 },
  },
  'pts-2003': {
    id: 'pts-2003',
    name: '2003 (10-8-6-5-4-3-2-1)',
    pointsByPosition: { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 },
  },
  'pts-modern': {
    id: 'pts-modern',
    name: 'Modern (25-18-15-...)',
    pointsByPosition: {
      1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
    },
  },
  'pts-indycar-2026': {
    id: 'pts-indycar-2026',
    name: 'IndyCar 2026 (50-40-35-...)',
    pointsByPosition: {
      1: 50, 2: 40, 3: 35, 4: 32, 5: 30, 6: 28, 7: 26, 8: 24, 9: 22, 10: 20,
      11: 19, 12: 18, 13: 17, 14: 16, 15: 15, 16: 14, 17: 13, 18: 12, 19: 11,
      20: 10, 21: 9, 22: 8, 23: 7, 24: 6, 25: 5, 26: 5, 27: 5, 28: 5, 29: 5,
      30: 5, 31: 5, 32: 5, 33: 5,
    },
  },
};

// IndyCar 2008-2025: consistent 50-40-35-32-30-... points structure
const _indycarPoints = {
  1: 50, 2: 40, 3: 35, 4: 32, 5: 30, 6: 28, 7: 26, 8: 24, 9: 22, 10: 20,
  11: 19, 12: 18, 13: 17, 14: 16, 15: 15, 16: 14, 17: 13, 18: 12, 19: 11,
  20: 10, 21: 9, 22: 8, 23: 7, 24: 6, 25: 5, 26: 5, 27: 5, 28: 5, 29: 5,
  30: 5, 31: 5, 32: 5, 33: 5,
};
for (let _y = 2008; _y <= 2025; _y++) {
  pointsSystems[`pts-indycar-${_y}`] = {
    id: `pts-indycar-${_y}`,
    name: `IndyCar ${_y} (50-40-35-...)`,
    pointsByPosition: _indycarPoints,
  };
}

Object.assign(pointsSystems, aowPointsSystems);

export function getPointsSystem(id: string): PointsSystem {
  return pointsSystems[id] ?? pointsSystems['pts-1995'];
}
