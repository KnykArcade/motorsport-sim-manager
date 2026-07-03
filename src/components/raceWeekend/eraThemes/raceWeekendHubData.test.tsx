import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getTrackById } from '../../../data';
import { getRegulationSet } from '../../../data/regulations/regulations';
import { createNewGame } from '../../../game/initialCareer';
import { currentRace, activeDriversForTeam, type GameState } from '../../../game/careerState';
import { getSeasonBundle } from '../../../data/seasonData';
import { weekendForecast } from '../../../sim/weatherEngine';
import { F11990sGarageHotspot } from './F11990sGarageHotspot';
import { F11990sRaceWeekendHub } from './F11990sRaceWeekendHub';
import { TrackInfoCard } from './TrackInfoCard';
import {
  activateGarageHotspot,
  buildCarStatus,
  buildF11990sGarageHotspots,
  buildNextSessionAction,
  buildQuickActions,
  buildRaceWeekendSchedule,
  buildTeamMessages,
  circuitLengthKm,
  drsDisplay,
  refuelingDisplay,
  setupConfidenceLabel,
} from './raceWeekendHubData';
import type { RaceWeekendHubCallbacks } from './types';

function makeState(year = 1994, gameMode: GameState['gameMode'] = 'Career', series: GameState['series'] = 'F1'): GameState {
  const bundle = getSeasonBundle(year, series);
  if (!bundle) throw new Error(`Missing bundle for ${year} ${series}`);
  return createNewGame({
    gameMode,
    seasonYear: year,
    series,
    teamId: bundle.teams[0].id,
    seed: `test-${year}-${series}`,
    bundle,
  });
}

function withWeekendPackage(state: GameState): GameState {
  const race = currentRace(state)!;
  return {
    ...state,
    raceWeekendPackage: {
      packageType: 'Standard',
      raceId: race.id,
      gpName: race.gpName,
      cost: 1000,
      teamScale: 1,
      trackModifier: 1,
      packageModifier: 1,
      damageReserve: 0,
    },
  };
}

function renderHub(state: GameState) {
  const race = currentRace(state)!;
  const track = getTrackById(race.trackId)!;
  const forecast = weekendForecast(track, `${state.randomSeed}-r${race.round}`);
  return renderToStaticMarkup(
    <F11990sRaceWeekendHub
      state={state}
      race={race}
      track={track}
      forecast={forecast}
      isMinPackage={state.raceWeekendPackage?.packageType === 'MandatoryMinimum'}
      hasQualifyingResults={!!state.qualifyingResults[race.id]}
      onPhase={() => undefined}
      onRoute={() => undefined}
      onExit={() => undefined}
    />,
  );
}

describe('F1 1990s race weekend hub rendering', () => {
  it('renders the F1 1990s Race Weekend Hub for an F1 1990s season', () => {
    const state = makeState(1994);
    const html = renderHub(state);
    expect(html).toContain('data-testid="f1-1990s-race-weekend-hub"');
    expect(html).toContain('1994 Season');
    expect(html).toContain(currentRace(state)!.gpName);
    expect(html).toContain(state.teams[0].name);
  });

  it('uses actual season, event, team, and standings data', () => {
    const state = makeState(1995);
    const race = currentRace(state)!;
    const driver = activeDriversForTeam(state, state.selectedTeamId)[0];
    const withStandings: GameState = {
      ...state,
      driverStandings: [{ entityId: driver.id, points: 12, wins: 1, podiums: 1, dnfs: 0 }],
    };
    const html = renderHub(withStandings);
    expect(html).toContain('1995 Season');
    expect(html).toContain(race.gpName);
    expect(html).toContain(driver.name);
    expect(html).toContain('12');
  });

  it('renders team messages and car status from actual state', () => {
    const state: GameState = {
      ...makeState(1994),
      news: [{ id: 'n-test', headline: 'Rear suspension parts have arrived.', timestamp: '2026-01-01T00:00:00.000Z' }],
    };
    expect(buildTeamMessages(state, currentRace(state)!)).toContain('Rear suspension parts have arrived.');
    expect(buildCarStatus(state).map((row) => row.label)).toEqual(['Engine', 'Gearbox', 'Chassis', 'Reliability']);
  });

  it('renders track info without crashing when optional distance is missing', () => {
    const state = makeState(1994);
    const race = { ...currentRace(state)!, distanceKm: undefined };
    const track = getTrackById(race.trackId)!;
    const html = renderToStaticMarkup(
      <TrackInfoCard race={race} track={track} regulation={getRegulationSet(state.regulationSetId)} onOpenTrackData={() => undefined} />,
    );
    expect(circuitLengthKm(race)).toBe('N/A');
    expect(html).toContain('N/A');
  });
});

describe('F1 1990s race weekend schedule and primary action', () => {
  it('highlights the current schedule item', () => {
    const state = makeState(1994);
    const race = currentRace(state)!;
    const schedule = buildRaceWeekendSchedule(state, race, false, false);
    expect(schedule.find((item) => item.id === 'pre-race')?.status).toBe('current');
  });

  it('drives the next-session action from real weekend state', () => {
    const state = withWeekendPackage(makeState(1994));
    const action = buildNextSessionAction(state, currentRace(state)!, false, false);
    expect(action.primaryLabel).toBe('START PRACTICE');
    expect(action.action).toEqual({ type: 'phase', phase: 'practice' });
  });

  it('includes warmup only when the active session model supports it', () => {
    const state = makeState(1994);
    const labels = buildRaceWeekendSchedule(state, currentRace(state)!, false, false).map((item) => item.label);
    expect(labels).toContain('Warmup');
    expect(labels).not.toContain('Practice 3');
  });

  it('reports setup confidence from practice state when available', () => {
    const state = makeState(1994);
    const race = currentRace(state)!;
    const driver = activeDriversForTeam(state, state.selectedTeamId)[0];
    const practiced: GameState = {
      ...state,
      weekendPractice: {
        raceId: race.id,
        sessions: [],
        lapsUsed: 0,
        knowledge: {
          raceId: race.id,
          setupKnowledge: { [driver.id]: 0.5 },
          tireKnowledge: {},
          reliabilityKnowledge: {},
          confidenceDelta: {},
        },
      },
    };
    expect(setupConfidenceLabel(practiced, race)).toBe('25%');
  });
});

describe('F1 1990s garage hotspots', () => {
  it('renders all required hotspot areas', () => {
    const state = withWeekendPackage(makeState(1994));
    const labels = buildF11990sGarageHotspots({
      state,
      race: currentRace(state)!,
      isMinPackage: false,
      hasQualifyingResults: false,
    }).map((hotspot) => hotspot.label);
    expect(labels).toEqual([
      'Engineering Desk',
      'Team Principal',
      'Track Monitors',
      'Chief Mechanic',
      'Car',
      'Race Strategist',
      'Tyre Rack',
      'Data Laptop',
    ]);
  });

  it('gives hotspots accessible labels and keeps locked hotspots focusable', () => {
    const state = makeState(1994);
    const hotspot = buildF11990sGarageHotspots({
      state,
      race: currentRace(state)!,
      isMinPackage: false,
      hasQualifyingResults: false,
    }).find((item) => item.id === 'engineering-desk')!;
    const callbacks: RaceWeekendHubCallbacks = { onPhase: vi.fn(), onRoute: vi.fn(), onExit: vi.fn() };
    const html = renderToStaticMarkup(<F11990sGarageHotspot hotspot={hotspot} callbacks={callbacks} />);
    expect(html).toContain('aria-label="Engineering Desk: Car stats, telemetry and engineer feedback. Locked.');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('<button');
    expect(html).not.toContain('disabled=""');
  });

  it('routes unlocked hotspots and blocks locked hotspots with an explanation', () => {
    const state = withWeekendPackage(makeState(1994));
    const callbacks: RaceWeekendHubCallbacks = { onPhase: vi.fn(), onRoute: vi.fn(), onExit: vi.fn() };
    const hotspots = buildF11990sGarageHotspots({
      state,
      race: currentRace(state)!,
      isMinPackage: false,
      hasQualifyingResults: false,
    });
    expect(activateGarageHotspot(hotspots.find((item) => item.id === 'engineering-desk')!, callbacks)).toBe(true);
    expect(callbacks.onPhase).toHaveBeenCalledWith('setup');

    const locked = hotspots.find((item) => item.id === 'race-strategist')!;
    expect(locked.lockedReason).toBe('Race strategy opens after qualifying is complete.');
    expect(activateGarageHotspot(locked, callbacks)).toBe(false);
  });
});

describe('F1 1990s hub mode restrictions', () => {
  it('does not show long-term quick actions in Single Season mode', () => {
    const labels = buildQuickActions(makeState(1994, 'SingleSeason')).map((action) => action.label);
    expect(labels).not.toContain('Scouting Report');
    expect(labels).not.toContain('Sponsorship');
    expect(labels).not.toContain('Regulation Updates');
  });

  it('shows allowed long-term quick actions in Career mode', () => {
    const labels = buildQuickActions(makeState(1994, 'Career')).map((action) => action.label);
    expect(labels).toContain('Scouting Report');
    expect(labels).toContain('Sponsorship');
  });

  it('does not inherit Single Season restrictions in Sandbox mode', () => {
    const labels = buildQuickActions(makeState(1994, 'Sandbox')).map((action) => action.label);
    expect(labels).toContain('Scouting Report');
    expect(labels).toContain('Sponsorship');
  });
});

describe('F1 1990s hub regulation awareness', () => {
  it('does not show DRS as available for the 1990s F1 hub', () => {
    expect(drsDisplay(getRegulationSet('reg-f1-1994-1995'))).toBe('N/A');
  });

  it('does not imply race refueling for F1 1990-1993 when regulations ban it', () => {
    expect(refuelingDisplay(getRegulationSet('reg-f1-1990-1993'))).toBe('No race refueling');
  });

  it('uses refueling metadata for F1 1994-1999 regulation sets', () => {
    expect(refuelingDisplay(getRegulationSet('reg-f1-1994-1995'))).toBe('Refueling allowed');
    expect(refuelingDisplay(getRegulationSet('reg-f1-1996-2002'))).toBe('Refueling allowed');
  });
});
