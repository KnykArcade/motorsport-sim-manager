import type { PointsSystem } from '../../types/gameTypes';

// Points systems are configurable per-season so future years can differ.
export const pointsSystems: Record<string, PointsSystem> = {
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
};

export function getPointsSystem(id: string): PointsSystem {
  return pointsSystems[id] ?? pointsSystems['pts-1995'];
}
