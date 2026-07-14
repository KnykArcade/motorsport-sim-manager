import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { UniverseChampionshipSeason } from '../types/universeTypes';
import { WorldSeasonCard } from './UniverseHistory';

describe('WorldSeasonCard', () => {
  it('shows the off-screen champion and top-five standings with real names', () => {
    const season: UniverseChampionshipSeason = {
      seasonYear: 1998,
      series: 'CART',
      completedRaces: 19,
      driverChampionId: 'driver-a',
      driverChampionName: 'Alex Champion',
      teamChampionId: 'team-a',
      teamChampionName: 'Team Alpha',
      driverNames: {
        'driver-a': 'Alex Champion',
        'driver-b': 'Blake Runner-up',
      },
      teamNames: { 'team-a': 'Team Alpha' },
      driverStandings: [
        { entityId: 'driver-a', points: 210, wins: 5, podiums: 10, dnfs: 1 },
        { entityId: 'driver-b', points: 190, wins: 4, podiums: 9, dnfs: 2 },
      ],
      teamStandings: [
        { entityId: 'team-a', points: 400, wins: 9, podiums: 19, dnfs: 3 },
      ],
    };

    const html = renderToStaticMarkup(<WorldSeasonCard season={season} />);
    expect(html).toContain('1998 CART');
    expect(html).toContain('Alex Champion');
    expect(html).toContain('Blake Runner-up');
    expect(html).toContain('Team Alpha');
    expect(html).toContain('19 races');
  });
});
