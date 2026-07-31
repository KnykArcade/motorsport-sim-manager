import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createRoot, type Root } from 'react-dom/client';
import App from '../../src/app/App';
import '../../src/index.css';
import {
  initializeMasterRegistry,
  loadSeasonBundle,
  preloadMarketBundle,
  type SeasonBundle,
} from '../../src/data';
import type { GameState } from '../../src/game/careerState';
import { gameReducer } from '../../src/game/gameReducer';
import { saveGame } from '../../src/game/saveSystem';
import type { GameMode } from '../../src/types/gameTypes';

let seasonBundle: SeasonBundle;
let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeAll(async () => {
  [seasonBundle] = await Promise.all([
    loadSeasonBundle(1995, 'F1'),
    preloadMarketBundle(1995, 'F1'),
    initializeMasterRegistry(1995, 'F1'),
  ]);
}, 60_000);

afterEach(() => {
  root?.unmount();
  container?.remove();
  root = undefined;
  container = undefined;
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = '';
});

function newCareer(mode: GameMode): GameState {
  const state = gameReducer(null, {
    type: 'NEW_GAME',
    options: {
      gameMode: mode,
      seasonYear: 1995,
      series: 'F1',
      teamId: 't-benetton',
      seed: `phase-28-${mode}`,
      principalName: 'Alex Morgan',
      bundle: seasonBundle,
    },
  });
  if (!state) throw new Error(`Could not create ${mode} browser fixture`);
  return state;
}

function completeFirstDay(state: GameState): GameState {
  let next = state;
  for (let index = 0; index < 3; index += 1) {
    next = gameReducer(next, { type: 'ADVANCE_CAREER_LAUNCH' }) ?? next;
  }
  return gameReducer(next, { type: 'COMPLETE_CAREER_LAUNCH' }) ?? next;
}

function liveRaceReady(state: GameState): GameState {
  const race = state.calendar[state.currentRaceIndex];
  if (!race || !state.careerPhase) throw new Error('Live Race fixture has no current event');
  const ready = {
    ...state,
    careerPhase: {
      ...state.careerPhase,
      currentPhase: 'race_weekend',
      careerLaunch: state.careerPhase.careerLaunch
        ? { ...state.careerPhase.careerLaunch, required: false }
        : undefined,
    },
    garageAddresses: [{
      raceId: race.id,
      teamId: state.selectedTeamId,
      seasonYear: state.seasonYear,
      round: race.round,
      tone: 'CalmExecute',
      messageLabel: 'Calm and execute',
      delegated: false,
      recommendedTone: 'CalmExecute',
      recommendationReason: 'Rendered Live Race fixture',
      reactions: [],
    }],
  };
  const qualifying = gameReducer(ready, {
    type: 'RUN_QUALIFYING',
    decisions: ready.drivers
      .filter((driver) => driver.teamId === ready.selectedTeamId)
      .map((driver) => ({
        driverId: driver.id,
        setupId: '',
        runPlanId: 'StandardPush',
        runs: 2,
        tyreApproach: 'Standard',
      })),
  });
  if (!qualifying?.qualifyingResults[race.id]) {
    throw new Error('Live Race fixture could not complete qualifying');
  }
  return qualifying;
}

async function mountSavedCareer(state: GameState) {
  await page.viewport(1280, 720);
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = '';
  saveGame(state);
  container = document.createElement('div');
  container.id = 'browser-test-root';
  document.body.append(container);
  root = createRoot(container);
  root.render(<App />);
  await page.getByRole('button', { name: /^Continue/ }).click();
}

describe('Phase 28 rendered real-play verification', () => {
  it('keeps the first day focused, reviewable, and resumable without rewinding its checkpoint', async () => {
    await mountSavedCareer(newCareer('Career'));

    await expect.element(page.getByRole('navigation', { name: 'First-day navigation' })).toBeInTheDocument();
    await expect.element(page.getByRole('navigation', { name: 'Game navigation' })).not.toBeInTheDocument();
    await expect.element(page.getByRole('heading', { name: 'Welcome to Benetton', exact: true })).toBeInTheDocument();

    await page.getByRole('button', { name: 'Meet Your Team →' }).click();
    await expect.element(page.getByText('Team handover', { exact: true })).toBeInTheDocument();

    await page.getByRole('button', { name: /Appointment Your new role/i }).click();
    await expect.element(page.getByRole('button', { name: 'Return to Team Handover →' })).toBeInTheDocument();
    await expect.element(page.getByText('Your appointment', { exact: true })).toBeInTheDocument();

    await page.getByRole('button', { name: 'Return to Team Handover →' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Main Menu' }).click();
    await page.getByRole('button', { name: /^Continue/ }).click();

    await expect.element(page.getByText('Team handover', { exact: true })).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Meet the Owner →' })).toBeInTheDocument();
  });

  it.each(['Career', 'Sandbox', 'SingleSeason'] as const)(
    'renders the complete %s first-day handoff into the exact first management task',
    async (mode) => {
      await mountSavedCareer(newCareer(mode));

      await page.getByRole('button', { name: 'Meet Your Team →' }).click();
      await page.getByRole('button', { name: 'Meet the Owner →' }).click();
      await page.getByRole('button', { name: 'Review First-Week Plan →' }).click();
      await page.getByRole('button', { name: 'Acknowledge Welcome Pack & Start →' }).first().click();

      await expect.element(page.getByRole('heading', { name: /1995 F1 Preseason Setup/i })).toBeInTheDocument();
      await expect.element(page.getByRole('button', { name: /Driver line-up Team briefing/i })).toHaveClass(/is-active/);
      expect(window.location.hash).toContain('/preseason?task=driverLineup');
    },
  );

  it('keeps visible tabs synchronized with URL history without remounting', async () => {
    await mountSavedCareer(completeFirstDay(newCareer('Career')));
    await page.getByRole('link', { name: 'Finance' }).click();

    await page.getByRole('tab', { name: /Transactions/i }).click();
    await expect.element(page.getByRole('tab', { name: /Transactions/i })).toHaveAttribute('aria-selected', 'true');
    expect(window.location.hash).toContain('tab=transactions');

    await page.getByRole('tab', { name: /Commitments/i }).click();
    await expect.element(page.getByRole('tab', { name: /Commitments/i })).toHaveAttribute('aria-selected', 'true');

    window.history.back();
    await expect.element(page.getByRole('tab', { name: /Transactions/i })).toHaveAttribute('aria-selected', 'true');

    window.history.forward();
    await expect.element(page.getByRole('tab', { name: /Commitments/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('supports keyboard tab movement and preserves the primary action at every supported viewport', async () => {
    await mountSavedCareer(completeFirstDay(newCareer('Career')));
    await page.getByRole('link', { name: 'Finance' }).click();

    const commitmentsTab = page.getByRole('tab', { name: /Commitments/i });
    await expect.element(commitmentsTab).toBeInTheDocument();
    commitmentsTab.element().focus();
    await userEvent.keyboard('{Home}');
    await expect.element(page.getByRole('tab', { name: /Overview/i })).toHaveFocus();

    for (const [width, height] of [[1024, 720], [1280, 720], [1440, 900], [1920, 1080]] as const) {
      await page.viewport(width, height);
      const financeHeading = page.getByRole('heading', { name: /Finance/i }).nth(1).element();
      const workspace = financeHeading.closest<HTMLElement>('.ui-workspace-screen');
      const shell = financeHeading.closest<HTMLElement>('.ui-app-shell');
      const action = shell?.querySelector<HTMLElement>('.ui-continue-button');
      expect(shell).not.toBeNull();
      expect(action).not.toBeNull();
      if (!shell || !action) throw new Error('Application shell is incomplete');
      expect(shell.getBoundingClientRect().width).toBeLessThanOrEqual(width);
      expect(shell.scrollWidth).toBeLessThanOrEqual(width);
      expect(action.getBoundingClientRect().right).toBeLessThanOrEqual(width);
      expect(workspace?.getBoundingClientRect().height ?? 0).toBeGreaterThan(240);
    }
  });

  it('renders Live Race as an isolated full-screen workspace at supported viewport sizes', async () => {
    const state = liveRaceReady(completeFirstDay(newCareer('Career')));
    const race = state.calendar[state.currentRaceIndex];
    await mountSavedCareer(state);
    window.location.hash = `#/live-race/${race.id}`;

    const liveRaceScreen = page.getByTestId('f1-1990s-live-race-screen');
    await expect.element(liveRaceScreen).toBeInTheDocument();
    await expect.element(page.getByRole('navigation', { name: 'Game navigation' })).not.toBeInTheDocument();

    for (const [width, height] of [[1024, 720], [1280, 720], [1920, 1080]] as const) {
      await page.viewport(width, height);
      const element = liveRaceScreen.element();
      const bounds = element.getBoundingClientRect();
      expect(document.querySelector('.ui-sidebar')).toBeNull();
      expect(document.querySelector('.ui-topbar')).toBeNull();
      expect(document.querySelector('.ui-context-navigation')).toBeNull();
      expect(document.querySelector('.ui-main-content')).toBeNull();
      expect(bounds.left).toBe(0);
      expect(bounds.top).toBe(0);
      expect(bounds.width).toBe(width);
      expect(bounds.height).toBe(height);
    }
  });
});
