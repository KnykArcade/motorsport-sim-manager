import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { GameState } from '../../../game/careerState';
import type { AnalyticsMonitor } from '../../../sim/analyticsMonitor';
import type { Race } from '../../../types/gameTypes';
import type { LiveCarState, LiveRaceState, PitStopState } from '../../../types/liveTypes';
import { F11990sLiveRaceScreen } from './F11990sLiveRaceScreen';

const basePit: PitStopState = {
  plannedStops: 1,
  stopsMade: 0,
  scheduledLaps: [18],
  lastPitLap: null,
  inPitThisLap: false,
  window: { open: 18, ideal: 20, close: 24 },
  pitRequested: false,
  planStatus: 'planned',
  planCancelled: false,
  lastWindowPromptLap: null,
};

function car(overrides: Partial<LiveCarState>): LiveCarState {
  return {
    driverId: 'd-schumacher',
    teamId: 't-benetton',
    isPlayer: false,
    grid: 1,
    position: 1,
    totalTime: 1652,
    gapToLeader: 0,
    interval: 0,
    lastLapTime: 112.511,
    bestLap: 111.934,
    lapsCompleted: 18,
    running: true,
    status: 'Finished',
    retiredOnLap: null,
    paceRating: 9,
    baseRacePace: 9,
    baseFailureRisk: 0.01,
    baseCrashRisk: 0.01,
    baseMistakeRisk: 0.01,
    tireDegRate: 2,
    pitLossBase: 23,
    opsForm: 0,
    personality: 'Balanced',
    strategyId: 'balanced',
    instructionId: 'normal',
    paceMode: 'Balanced',
    strategyStint: {
      mode: 'Balanced',
      previousMode: null,
      startedLap: 1,
      consecutiveLaps: 18,
      source: 'initial',
      lastChangedLap: 1,
      warned: false,
    },
    liveRacePace: 8.8,
    tire: { compound: 'Dry', age: 18, wear: 38, stintTarget: 24 },
    pit: { ...basePit },
    reliabilityIssue: null,
    reliabilityRisk: 0.01,
    crashRisk: 0.01,
    damaged: false,
    fuel: 58,
    engineHealth: 95,
    gearboxHealth: 94,
    brakeHealth: 93,
    lastSectors: [35, 42, 35],
    bestSectors: [34, 42, 35],
    reliabilityRiskLevel: 'Low',
    crashRiskLevel: 'Low',
    trafficStatus: 'Clear',
    statusMessage: 'Running',
    ...overrides,
  };
}

function liveState(): LiveRaceState {
  return {
    raceId: 'r-belgium-1995',
    trackId: 'spa',
    seed: 'test',
    totalLaps: 44,
    currentLap: 18,
    phase: 'racing',
    weather: { condition: 'Dry', gripLevel: 1, wet: false, changingSoon: false, label: 'Sunny' },
    safetyCar: { active: false, lapsRemaining: 0, deployedOnLap: null, reason: null, deployments: 0 },
    cars: [
      car({ driverId: 'd-schumacher', teamId: 't-benetton', position: 1, gapToLeader: 0, isPlayer: false }),
      car({ driverId: 'd-hill', teamId: 't-williams', position: 2, gapToLeader: 2.41, isPlayer: false }),
      car({ driverId: 'd-senna', teamId: 't-mclaren', position: 3, gapToLeader: 6.23, isPlayer: true }),
    ],
    events: [
      { lap: 17, text: 'M. Schumacher set fastest lap 1:52.511', category: 'status' },
      { lap: 16, text: 'D. Hill closed to within three seconds.', category: 'battle' },
    ],
    pendingPrompt: null,
    promptCooldown: {},
    firedEventIds: [],
    recommendations: [],
    ignoredRecs: [],
    recCooldowns: {},
    battleTracker: {},
    retirements: 0,
  };
}

function monitor(): AnalyticsMonitor {
  return {
    headline: 'Monitoring race pace',
    confidence: 82,
    drivers: [
      {
        driverId: 'd-senna',
        position: 3,
        focus: 'Tyre life',
        focusLabel: 'Tyres',
        strategyRead: 'Plan on target',
        nextTrigger: 'Pit window',
        triggerShort: 'L18',
        tiles: [],
      },
    ],
    recent: [],
  };
}

describe('F11990sLiveRaceScreen', () => {
  it('renders the 1990s live race shell with actual race and driver data', () => {
    const live = liveState();
    const html = renderToStaticMarkup(
      <F11990sLiveRaceScreen
        state={{ seasonYear: 1995 } as GameState}
        race={{
          id: 'r-belgium-1995',
          gpName: 'Belgian Grand Prix',
          trackName: 'Spa-Francorchamps',
          trackId: 'spa',
          round: 10,
          laps: 44,
          distanceKm: 305,
          completed: false,
        } satisfies Race}
        live={live}
        dots={[]}
        rotation={0}
        playerCars={[live.cars[2]]}
        forecast={[{ label: 'Now', condition: 'Sunny', wet: false, temp: 22 }]}
        monitor={monitor()}
        activeRecs={[]}
        needsDecision={false}
        decisionSecondsLeft={null}
        playing={false}
        speed={1}
        nameOf={(id) => ({ 'd-schumacher': 'Michael Schumacher', 'd-hill': 'Damon Hill', 'd-senna': 'Ayrton Senna' })[id] ?? id}
        teamNameOf={(id) => ({ 't-benetton': 'Benetton Renault', 't-williams': 'Williams Renault', 't-mclaren': 'McLaren Ford' })[id] ?? id}
        colorOf={(id) => ({ 't-benetton': '#0f7a3b', 't-williams': '#1e40af', 't-mclaren': '#f97316' })[id] ?? '#999'}
        onTogglePlay={vi.fn()}
        onStep={vi.fn()}
        onSpeed={vi.fn()}
        onSkipToEnd={vi.fn()}
        onOpenOrders={vi.fn()}
        onOpenStrategy={vi.fn()}
        onOpenLog={vi.fn()}
        onExit={vi.fn()}
        onFinishRace={vi.fn()}
        onPit={vi.fn()}
        onMode={vi.fn()}
        onAccept={vi.fn()}
        onModify={vi.fn()}
        onIgnore={vi.fn()}
        onLetCrewDecide={vi.fn()}
        onAcceptAll={vi.fn()}
        onIgnoreAll={vi.fn()}
      />,
    );

    expect(html).toContain('data-testid="f1-1990s-live-race-screen"');
    expect(html).toContain('1990s Era');
    expect(html).toContain('Belgian Grand Prix');
    expect(html).toContain('Spa-Francorchamps');
    expect(html).toContain('Lap 18 / 44');
    expect(html).toContain('A. Senna');
    expect(html).toContain('M. Schumacher');
    expect(html).toContain('Live Timing');
    expect((html.match(/Driver Focus/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Driver Focus');
    expect(html).toContain('Team Radio');
    expect(html).toContain('Pit Window');
  });

  it('renders the full timing field instead of truncating the tower', () => {
    const live = liveState();
    live.cars = Array.from({ length: 24 }, (_, index) =>
      car({
        driverId: `driver-${index + 1}`,
        teamId: index % 2 === 0 ? 't-benetton' : 't-williams',
        position: index + 1,
        gapToLeader: index === 0 ? 0 : index * 1.25,
        isPlayer: index === 22,
      }),
    );

    const html = renderToStaticMarkup(
      <F11990sLiveRaceScreen
        state={{ seasonYear: 1995 } as GameState}
        race={{
          id: 'r-belgium-1995',
          gpName: 'Belgian Grand Prix',
          trackName: 'Spa-Francorchamps',
          trackId: 'spa',
          round: 10,
          laps: 44,
          distanceKm: 305,
          completed: false,
        } satisfies Race}
        live={live}
        dots={[]}
        rotation={0}
        playerCars={[live.cars[22], live.cars[23]]}
        forecast={[{ label: 'Now', condition: 'Sunny', wet: false, temp: 22 }]}
        monitor={monitor()}
        activeRecs={[]}
        needsDecision={false}
        decisionSecondsLeft={null}
        playing={false}
        speed={1}
        nameOf={(id) => `Test Driver ${id.split('-')[1]}`}
        teamNameOf={(id) => ({ 't-benetton': 'Benetton Renault', 't-williams': 'Williams Renault' })[id] ?? id}
        colorOf={(id) => ({ 't-benetton': '#0f7a3b', 't-williams': '#1e40af' })[id] ?? '#999'}
        onTogglePlay={vi.fn()}
        onStep={vi.fn()}
        onSpeed={vi.fn()}
        onSkipToEnd={vi.fn()}
        onOpenOrders={vi.fn()}
        onOpenStrategy={vi.fn()}
        onOpenLog={vi.fn()}
        onExit={vi.fn()}
        onFinishRace={vi.fn()}
        onPit={vi.fn()}
        onMode={vi.fn()}
        onAccept={vi.fn()}
        onModify={vi.fn()}
        onIgnore={vi.fn()}
        onLetCrewDecide={vi.fn()}
        onAcceptAll={vi.fn()}
        onIgnoreAll={vi.fn()}
      />,
    );

    expect(html).toContain('T. 24');
    expect(html).toContain('24');
  });
});
