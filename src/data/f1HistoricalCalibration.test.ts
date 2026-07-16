import { describe, expect, it } from 'vitest';
import type { CarRatings } from '../types/gameTypes';
import { loadSeasonBundle } from './seasonLoader';

describe('F1 historical source calibration', () => {
  it('resolves the abbreviated 1995 Benetton drivers to their canonical registry records', async () => {
    const bundle = await loadSeasonBundle(1995, 'F1');
    expect(bundle).toBeDefined();

    const benetton = bundle!.teams.find((team) => team.name.includes('Benetton'));
    expect(benetton).toBeDefined();

    const drivers = bundle!.drivers.filter((driver) => driver.teamId === benetton!.id);
    expect(drivers.map((driver) => driver.name).sort()).toEqual(['Johnny Herbert', 'Michael Schumacher']);
    expect(drivers.every((driver) => !driver.id.startsWith('driver-'))).toBe(true);
  });

  it('recovers a severely understated generated car rating from the curated historical source', async () => {
    const bundle = await loadSeasonBundle(1995, 'F1');
    expect(bundle).toBeDefined();

    const benetton = bundle!.teams.find((team) => team.name.includes('Benetton'));
    const williams = bundle!.teams.find((team) => team.name.includes('Williams'));
    expect(benetton).toBeDefined();
    expect(williams).toBeDefined();

    const benettonCar = bundle!.cars.find((car) => car.teamId === benetton!.id);
    const williamsCar = bundle!.cars.find((car) => car.teamId === williams!.id);
    expect(benettonCar).toBeDefined();
    expect(williamsCar).toBeDefined();

    const average = (ratings: CarRatings) =>
      Object.values(ratings).reduce((sum, value) => sum + value, 0) / Object.values(ratings).length;
    expect(average(benettonCar!.ratings)).toBeGreaterThanOrEqual(80);
    expect(Math.abs(average(benettonCar!.ratings) - average(williamsCar!.ratings))).toBeLessThanOrEqual(10);
  });
});
