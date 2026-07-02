import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer, type GameAction } from './gameReducer';
import {
  defaultCareerPhaseState,
  getCareerPhase,
  getOrCreatePhaseState,
  hasUnresolvedRequiredDecisions,
  isPreseasonChecklistComplete,
  togglePreseasonChecklistItem,
} from './careerPhaseEngine';
import type { GameState } from './careerState';

function newCareerState(): GameState {
  return createNewGame({
    gameMode: 'Career',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'test-seed',
  });
}

function newSingleSeasonState(): GameState {
  return createNewGame({
    gameMode: 'SingleSeason',
    seasonYear: 1995,
    series: 'F1',
    teamId: 't-benetton',
    seed: 'test-seed',
  });
}

function dispatch(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action) as GameState;
}

function completeChecklist(state: GameState): GameState {
  const phaseState = getOrCreatePhaseState(state);
  const checklist = phaseState.preseasonChecklist ?? [];
  let s = state;
  for (const item of checklist) {
    if (!item.completed) {
      s = togglePreseasonChecklistItem(s, item.id);
    }
  }
  return s;
}

describe('careerPhaseEngine', () => {
  // --- Phase transitions ---

  it('new Career Mode game starts in pre_season_setup', () => {
    const state = newCareerState();
    expect(getCareerPhase(state)).toBe('pre_season_setup');
  });

  it('new Single Season game starts in pre_season_setup', () => {
    const state = newSingleSeasonState();
    expect(getCareerPhase(state)).toBe('pre_season_setup');
  });

  it('completing preseason moves to pre_race_briefing', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    expect(getCareerPhase(state)).toBe('pre_race_briefing');
  });

  it('pre-race briefing moves to race_weekend', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    expect(getCareerPhase(state)).toBe('race_weekend');
  });

  it('completing a race (RUN_RACE) moves to post_race_review', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    expect(getCareerPhase(state)).toBe('post_race_review');
  });

  it('post-race review moves to paddock_week', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    expect(getCareerPhase(state)).toBe('paddock_week');
  });

  it('paddock week moves to pre_race_briefing after resolving required decisions', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    // Resolve all required decisions.
    const phaseState = getOrCreatePhaseState(state);
    const requiredEvents = phaseState.paddockEvents.filter((e) => e.isRequiredDecision);
    for (const ev of requiredEvents) {
      const optionId = ev.options?.[0]?.id ?? 'balanced';
      state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: ev.id, optionId });
    }

    expect(hasUnresolvedRequiredDecisions(state)).toBe(false);
    state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
    expect(getCareerPhase(state)).toBe('pre_race_briefing');
  });

  // --- Unresolved decisions block advancement ---

  it('unresolved required Paddock decisions block advancement', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    // Try to advance without resolving required decisions.
    state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
    expect(getCareerPhase(state)).toBe('paddock_week');
  });

  it('resolving required decisions allows advancement', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const phaseState = getOrCreatePhaseState(state);
    const requiredEvents = phaseState.paddockEvents.filter((e) => e.isRequiredDecision);
    expect(requiredEvents.length).toBeGreaterThan(0);

    for (const ev of requiredEvents) {
      const optionId = ev.options?.[0]?.id ?? 'balanced';
      state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: ev.id, optionId });
    }

    state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
    expect(getCareerPhase(state)).toBe('pre_race_briefing');
  });

  // --- Event option effects apply exactly once ---

  it('selected event option effects apply exactly once', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const phaseState = getOrCreatePhaseState(state);
    const requiredEvent = phaseState.paddockEvents.find((e) => e.isRequiredDecision);
    expect(requiredEvent).toBeDefined();
    expect(requiredEvent!.options).toBeDefined();
    expect(requiredEvent!.options!.length).toBeGreaterThan(0);

    // Pick an option with moraleChange (e.g. 'qualifying' has moraleChange: 2).
    const optionWithEffect = requiredEvent!.options!.find((o) => o.moraleChange);
    const optionId = optionWithEffect?.id ?? requiredEvent!.options![0].id;

    const teamBefore = state.teams.find((t) => t.id === state.selectedTeamId);
    const moraleBefore = teamBefore?.morale ?? 0;

    // Resolve the event.
    state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: requiredEvent!.id, optionId });

    const teamAfter = state.teams.find((t) => t.id === state.selectedTeamId);
    const moraleAfter = teamAfter?.morale ?? 0;

    if (optionWithEffect && optionWithEffect.moraleChange) {
      expect(moraleAfter).toBe(moraleBefore + optionWithEffect.moraleChange);
    }

    // Try resolving again — effects should NOT be applied twice.
    const moraleBeforeSecond = moraleAfter;
    state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: requiredEvent!.id, optionId });
    const teamAfterSecond = state.teams.find((t) => t.id === state.selectedTeamId);
    const moraleAfterSecond = teamAfterSecond?.morale ?? 0;
    expect(moraleAfterSecond).toBe(moraleBeforeSecond);

    // Check effectsApplied flag.
    const updatedEvent = getOrCreatePhaseState(state).paddockEvents.find(
      (e) => e.id === requiredEvent!.id,
    );
    expect(updatedEvent?.effectsApplied).toBe(true);
  });

  it('budgetChange creates a finance transaction and updates team budget', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const phaseState = getOrCreatePhaseState(state);
    const requiredEvent = phaseState.paddockEvents.find((e) => e.isRequiredDecision);
    if (!requiredEvent) return;

    // Manually create an event with budgetChange to test the effect.
    const eventWithBudget: typeof requiredEvent = {
      ...requiredEvent,
      options: [
        { id: 'test-budget', label: 'Test', description: 'Test', budgetChange: -500_000 },
      ],
    };

    // Replace the event in state.
    state = {
      ...state,
      careerPhase: {
        ...getOrCreatePhaseState(state),
        paddockEvents: getOrCreatePhaseState(state).paddockEvents.map((e) =>
          e.id === requiredEvent.id ? eventWithBudget : e,
        ),
      },
    };

    const teamBefore = state.teams.find((t) => t.id === state.selectedTeamId);
    const budgetBefore = teamBefore?.budget ?? 0;
    const financeCountBefore = (state.finance ?? []).length;

    state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: requiredEvent.id, optionId: 'test-budget' });

    const teamAfter = state.teams.find((t) => t.id === state.selectedTeamId);
    const budgetAfter = teamAfter?.budget ?? 0;
    expect(budgetAfter).toBe(budgetBefore - 500_000);
    expect((state.finance ?? []).length).toBe(financeCountBefore + 1);
  });

  // --- Event ID uniqueness ---

  it('Paddock event IDs are unique within a Paddock Week', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const events = getOrCreatePhaseState(state).paddockEvents;
    const ids = events.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('Paddock event IDs include weekId, category, and index', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const events = getOrCreatePhaseState(state).paddockEvents;
    const weekId = getOrCreatePhaseState(state).paddockWeekId;
    expect(weekId).toBeDefined();

    for (const e of events) {
      expect(e.id).toContain(`pe-${weekId}-`);
      expect(e.id).toContain(`-${e.category}-`);
    }
  });

  // --- No duplication after reload/regeneration ---

  it('Paddock events do not duplicate after regeneration (dedup flag)', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const eventsAfterFirst = getOrCreatePhaseState(state).paddockEvents.length;

    // Try generating again — should be a no-op.
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });
    const eventsAfterSecond = getOrCreatePhaseState(state).paddockEvents.length;

    expect(eventsAfterSecond).toBe(eventsAfterFirst);
  });

  // --- Season rollover resets to pre_season_setup ---

  it('season rollover resets to pre_season_setup', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });

    // Mark season complete and advance.
    state = { ...state, seasonComplete: true };
    state = dispatch(state, { type: 'ADVANCE_SEASON' });
    expect(getCareerPhase(state)).toBe('pre_season_setup');
  });

  // --- Multi-year Career Mode progression ---

  it('multi-year Career Mode can progress through at least 3 seasons', () => {
    let state = newCareerState();

    for (let year = 0; year < 3; year++) {
      // Should be in pre_season_setup at the start of each season.
      expect(getCareerPhase(state)).toBe('pre_season_setup');

      // Complete preseason.
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');

      // Enter race weekend.
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      expect(getCareerPhase(state)).toBe('race_weekend');

      // Run qualifying and race.
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      expect(getCareerPhase(state)).toBe('post_race_review');

      // Advance to paddock week.
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

      // Resolve required decisions.
      const phaseState = getOrCreatePhaseState(state);
      const requiredEvents = phaseState.paddockEvents.filter((e) => e.isRequiredDecision);
      for (const ev of requiredEvents) {
        const optionId = ev.options?.[0]?.id ?? 'balanced';
        state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: ev.id, optionId });
      }

      // Advance to pre-race briefing for the next race.
      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');

      // Advance to season end: mark complete and rollover.
      state = { ...state, seasonComplete: true };
      state = dispatch(state, { type: 'ADVANCE_SEASON' });
    }

    // After 3 seasons, should be back in pre_season_setup.
    expect(getCareerPhase(state)).toBe('pre_season_setup');
    expect(state.seasonYear).toBe(1998);
  });

  // --- Single Season Mode still works ---

  it('Single Season Mode starts and can complete preseason', () => {
    let state = newSingleSeasonState();
    expect(getCareerPhase(state)).toBe('pre_season_setup');

    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    expect(getCareerPhase(state)).toBe('pre_race_briefing');
  });

  // --- Preseason checklist ---

  it('preseason checklist starts incomplete', () => {
    const state = newCareerState();
    expect(isPreseasonChecklistComplete(state)).toBe(false);
  });

  it('preseason checklist blocks advancement when incomplete', () => {
    let state = newCareerState();
    // Don't complete the checklist.
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    expect(getCareerPhase(state)).toBe('pre_season_setup');
  });

  it('preseason checklist allows advancement when complete', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    expect(isPreseasonChecklistComplete(state)).toBe(true);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    expect(getCareerPhase(state)).toBe('pre_race_briefing');
  });

  // --- Development update tracking ---

  it('completed development projects do not repeat in later paddock weeks', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    // Add a fake completed project to state.
    const fakeProject = {
      id: 'test-proj-1',
      name: 'Test Upgrade',
      category: 'Engine' as const,
      horizon: 'CurrentSeason' as const,
      cost: 1_000_000,
      durationRaces: 1,
      progressRaces: 1,
      successChance: 0.9,
      carryoverRate: 0.5,
      regulationSensitivity: 0.3,
    };
    state = {
      ...state,
      completedDevelopmentProjects: [...state.completedDevelopmentProjects, fakeProject],
    };

    // Re-generate events with the new project — need to reset the flag.
    const phaseState = getOrCreatePhaseState(state);
    state = {
      ...state,
      careerPhase: {
        ...phaseState,
        generatedEventsForCurrentWeek: false,
        paddockEvents: [],
      },
    };
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const events = getOrCreatePhaseState(state).paddockEvents;
    const announceCount = events.filter(
      (e) => e.category === 'development' && e.title.includes('Test Upgrade'),
    ).length;
    expect(announceCount).toBe(1);

    // Now simulate a second paddock week — the project should NOT appear again.
    state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const events2 = getOrCreatePhaseState(state).paddockEvents;
    const announceCount2 = events2.filter(
      (e) => e.category === 'development' && e.title.includes('Test Upgrade'),
    ).length;
    expect(announceCount2).toBe(0);
  });

  // --- Race prep focus stored ---

  it('race prep focus is stored when resolving the race prep decision', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const phaseState = getOrCreatePhaseState(state);
    const racePrepEvent = phaseState.paddockEvents.find(
      (e) => e.category === 'general_team' && e.title.startsWith('Select race preparation focus'),
    );
    expect(racePrepEvent).toBeDefined();

    const focusOption = racePrepEvent!.options?.find((o) => o.id === 'qualifying');
    expect(focusOption).toBeDefined();

    state = dispatch(state, {
      type: 'RESOLVE_PADDOCK_EVENT',
      eventId: racePrepEvent!.id,
      optionId: 'qualifying',
    });

    expect(getOrCreatePhaseState(state).racePrepFocus).toBe('qualifying');
  });

  // --- Default career phase state ---

  it('defaultCareerPhaseState has announcedCompletedProjectIds and preseasonChecklist', () => {
    const dps = defaultCareerPhaseState();
    expect(dps.announcedCompletedProjectIds).toEqual([]);
    expect(dps.preseasonChecklist).toBeDefined();
    expect(dps.preseasonChecklist.length).toBe(5);
    expect(dps.preseasonChecklist.every((item) => !item.completed)).toBe(true);
  });
});
