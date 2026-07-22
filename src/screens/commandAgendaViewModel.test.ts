import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../game/initialCareer';
import type { GameState } from '../game/careerState';
import { commandAgenda } from './commandAgendaViewModel';

function newState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'command-agenda-test',
  });
}

describe('commandAgenda', () => {
  it('projects a clear next action from the current Inbox agenda', () => {
    const base = newState();
    const state: GameState = {
      ...base,
      careerPhase: {
        ...base.careerPhase!,
        currentPhase: 'paddock_week',
        paddockEvents: [{
          id: 'agenda-required',
          weekId: 'week-1',
          season: base.seasonYear,
          series: base.series,
          round: 1,
          category: 'general_team',
          title: 'Approve the race package',
          description: 'Choose the package for the next race.',
          severity: 'critical',
          isRequiredDecision: true,
          options: [{ id: 'approve', label: 'Approve', description: 'Approve the package.' }],
          effectsApplied: false,
          createdAt: '2026-01-01T00:00:00.000Z',
        }],
      },
    };

    expect(commandAgenda(state)).toMatchObject({
      phase: 'paddock_week',
      nextAction: {
        id: 'inbox-paddock-agenda-required',
        blocking: true,
        route: '/paddock?tab=decisions&focus=agenda-required',
      },
      continueAction: {
        label: 'Open Operations Agenda',
        route: '/paddock?tab=decisions&focus=agenda-required',
        disabled: false,
      },
    });
  });

  it('falls back to the phase handoff when no action is waiting', () => {
    const state = { ...newState(), seasonComplete: true };
    const agenda = commandAgenda(state);

    expect(agenda.nextAction).toBeNull();
    expect(agenda.continueAction.route).toBe('/season-review');
    expect(agenda.continueAction.label).toBe('Open Season Review');
    expect(agenda.nextEvent.label).toBe('Season review');
  });

  it('keeps the latest race review visible as a command-desk change', () => {
    const base = newState();
    const state: GameState = {
      ...base,
      careerPhase: {
        ...base.careerPhase!,
        currentPhase: 'post_race_review',
        lastCompletedRaceId: base.calendar[0].id,
        paddockEvents: [],
      },
    };

    expect(commandAgenda(state).recentChanges[0]).toMatchObject({
      id: `command-review-${base.calendar[0].id}`,
      route: `/post-race/${base.calendar[0].id}`,
    });
  });

  it('prioritizes an exact driver negotiation route from the weekly agenda', () => {
    const base = newState();
    const driver = base.drivers.find((candidate) => candidate.teamId === base.selectedTeamId);
    if (!driver) throw new Error('Expected the selected team to have a driver');
    const state: GameState = {
      ...base,
      drivers: base.drivers.map((candidate) =>
        candidate.teamId === base.selectedTeamId
          ? { ...candidate, contractYearsRemaining: candidate.id === driver.id ? 1 : 5 }
          : candidate),
    };

    expect(commandAgenda(state).nextAction).toMatchObject({
      id: `inbox-driver-contract-${driver.id}`,
      route: `/drivers/${encodeURIComponent(driver.id)}/negotiate`,
      routeLabel: 'Open Negotiation',
    });
  });
});
