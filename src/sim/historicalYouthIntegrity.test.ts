import { expect, it } from 'vitest';
import { initializeMasterRegistry, preloadMarketBundle } from '../data';
import { createNewGame } from '../game/initialCareer';
import { careerMarketBundle } from './careerMarketEngine';

it('does not surface uncited generic youth prospects in a historical career', async () => {
  await initializeMasterRegistry(2026, 'F1');
  await preloadMarketBundle(2026, 'F1');
  const state = createNewGame({
    gameMode: 'Career',
    seasonYear: 2026,
    series: 'F1',
    teamId: 't-mclaren',
    seed: 'historical-youth-integrity',
  });
  const youth = careerMarketBundle(state).youth;
  expect(youth.some((entry) => /Noah Ricci|Ethan Brooks|Luca Weber/.test(entry.name))).toBe(false);
  expect(youth.some((entry) => entry.id.startsWith('gen-yth-'))).toBe(false);
});
