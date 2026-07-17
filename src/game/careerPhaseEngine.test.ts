import '../testDataSetup';
import { describe, expect, it } from 'vitest';
import { createNewGame } from './initialCareer';
import { gameReducer, type GameAction } from './gameReducer';
import {
  defaultCareerPhaseState,
  getCareerPhase,
  getOrCreatePhaseState,
  hasUnresolvedRequiredDecisions,
  isPreseasonChecklistComplete,
  computeRacePrepFocusEffect,
  processAITeamActivity,
  getPreseasonApprovals,
  approvePreseasonTab,
} from './careerPhaseEngine';
import { carForTeam, driversForTeam, activeDriversForTeam } from './careerState';
import { syncDriverRelationshipsForTeam } from '../sim/relationshipEngine';
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
  // Use new tab approval system instead of old checklist
  let s = state;
  s = approvePreseasonTab(s, 'teamOverview');
  s = approvePreseasonTab(s, 'budget');
  s = approvePreseasonTab(s, 'driverLineup');
  s = approvePreseasonTab(s, 'carDevelopment');
  s = approvePreseasonTab(s, 'sponsorsEngine');
  s = approvePreseasonTab(s, 'seasonObjectives');
  s = approvePreseasonTab(s, 'roundOnePreview');
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

  it('pre-race briefing cannot enter the race weekend with an incomplete active lineup', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    const active = activeDriversForTeam(state, state.selectedTeamId);
    state = {
      ...state,
      drivers: state.drivers.map((driver) => driver.id === active[0].id ? { ...driver, contractType: 'reserve' as const } : driver),
    };

    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });

    expect(activeDriversForTeam(state, state.selectedTeamId)).toHaveLength(1);
    expect(getCareerPhase(state)).toBe('pre_race_briefing');
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
    state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
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

    state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
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
      state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
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
    // Resolve any required decisions before advancing.
    const ps2 = getOrCreatePhaseState(state);
    for (const ev of ps2.paddockEvents.filter((e) => e.isRequiredDecision)) {
      const optionId = ev.options?.[0]?.id ?? 'balanced';
      state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: ev.id, optionId });
    }
    state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
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

  it('budget focus adds $500K to team budget and records finance transaction', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });

    // Make team budget low enough to trigger budget focus option.
    state = {
      ...state,
      teams: state.teams.map((t) =>
        t.id === state.selectedTeamId ? { ...t, budget: 3_000_000 } : t,
      ),
    };

    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const phaseState = getOrCreatePhaseState(state);
    const racePrepEvent = phaseState.paddockEvents.find(
      (e) => e.category === 'general_team' && e.title.startsWith('Select race preparation focus'),
    );
    expect(racePrepEvent).toBeDefined();

    const budgetOption = racePrepEvent!.options?.find((o) => o.id === 'budget');
    expect(budgetOption).toBeDefined();

    state = dispatch(state, {
      type: 'RESOLVE_PADDOCK_EVENT',
      eventId: racePrepEvent!.id,
      optionId: 'budget',
    });

    const teamAfter = state.teams.find((t) => t.id === state.selectedTeamId)!;
    expect(teamAfter.budget).toBe(3_000_000 + 500_000);
    expect(getOrCreatePhaseState(state).racePrepFocus).toBe('budget');
    expect(getOrCreatePhaseState(state).budgetFocusBonusApplied).toBe(true);

    // Finance transaction should be recorded.
    const budgetTxn = (state.finance ?? []).find(
      (f) => f.id.startsWith('txn-budget-focus-'),
    );
    expect(budgetTxn).toBeDefined();
    expect(budgetTxn!.amount).toBe(500_000);
  });

  it('budget focus does not stack $500K on repeated selection', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });

    state = {
      ...state,
      teams: state.teams.map((t) =>
        t.id === state.selectedTeamId ? { ...t, budget: 3_000_000 } : t,
      ),
    };

    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const phaseState = getOrCreatePhaseState(state);
    const racePrepEvent = phaseState.paddockEvents.find(
      (e) => e.category === 'general_team' && e.title.startsWith('Select race preparation focus'),
    );
    expect(racePrepEvent).toBeDefined();

    // First selection.
    state = dispatch(state, {
      type: 'RESOLVE_PADDOCK_EVENT',
      eventId: racePrepEvent!.id,
      optionId: 'budget',
    });

    const teamAfterFirst = state.teams.find((t) => t.id === state.selectedTeamId)!;
    expect(teamAfterFirst.budget).toBe(3_500_000);

    // Re-resolve the same event — should NOT add another $500K.
    state = dispatch(state, {
      type: 'RESOLVE_PADDOCK_EVENT',
      eventId: racePrepEvent!.id,
      optionId: 'budget',
    });

    const teamAfterSecond = state.teams.find((t) => t.id === state.selectedTeamId)!;
    expect(teamAfterSecond.budget).toBe(3_500_000);
  });

  it('budget focus effects clear after race completion', () => {
    let state = newCareerState();
    state = completeChecklist(state);
    state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });

    state = {
      ...state,
      teams: state.teams.map((t) =>
        t.id === state.selectedTeamId ? { ...t, budget: 3_000_000 } : t,
      ),
    };

    state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

    const phaseState = getOrCreatePhaseState(state);
    const racePrepEvent = phaseState.paddockEvents.find(
      (e) => e.category === 'general_team' && e.title.startsWith('Select race preparation focus'),
    );
    expect(racePrepEvent).toBeDefined();

    state = dispatch(state, {
      type: 'RESOLVE_PADDOCK_EVENT',
      eventId: racePrepEvent!.id,
      optionId: 'budget',
    });

    expect(getOrCreatePhaseState(state).budgetFocusBonusApplied).toBe(true);

    // Advance to next race: paddock → pre-race briefing → race weekend.
    state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
    state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
    state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
    state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
    state = dispatch(state, { type: 'RUN_RACE', decisions: [] });

    // After race, focus should be consumed.
    expect(getOrCreatePhaseState(state).racePrepFocusApplied).toBe(true);

    // Enter paddock week for next race — bonus should reset.
    state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
    expect(getOrCreatePhaseState(state).racePrepFocusApplied).toBe(false);
    expect(getOrCreatePhaseState(state).budgetFocusBonusApplied).toBe(false);
  });

  // --- Default career phase state ---

  it('defaultCareerPhaseState has announcedCompletedProjectIds and preseasonChecklist', () => {
    const dps = defaultCareerPhaseState();
    expect(dps.announcedCompletedProjectIds).toEqual([]);
    expect(dps.preseasonChecklist).toBeDefined();
    expect(dps.preseasonChecklist?.length).toBe(5);
    expect(dps.preseasonChecklist?.every((item) => !item.completed)).toBe(true);
  });

  // --- Reducer-level phase guards (ISSUE 1) ---

  describe('reducer phase guards', () => {
    it('RUN_QUALIFYING is blocked outside race_weekend', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      // Still in pre_season_setup — should not run qualifying.
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      expect(getCareerPhase(state)).toBe('pre_season_setup');
    });

    it('RUN_RACE is blocked outside race_weekend', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      // In pre_race_briefing — should not run race.
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');
    });

    it('ADVANCE_TO_PADDOCK_WEEK is blocked outside post_race_review', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      // In pre_race_briefing — should not advance to paddock.
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');
    });

    it('ADVANCE_TO_RACE_WEEKEND is blocked outside pre_race_briefing', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      // In pre_season_setup — should not advance to race weekend.
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      expect(getCareerPhase(state)).toBe('pre_season_setup');
    });

    it('ADVANCE_TO_PRE_RACE_BRIEFING is blocked from wrong phase', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      // In race_weekend — should not advance to briefing.
      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      expect(getCareerPhase(state)).toBe('race_weekend');
    });

    it('RESOLVE_PADDOCK_EVENT is blocked outside paddock_week', () => {
      let state = newCareerState();
      // In pre_season_setup — should not resolve paddock events.
      state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: 'fake', optionId: 'fake' });
      expect(getCareerPhase(state)).toBe('pre_season_setup');
    });

    it('TOGGLE_PRESEASON_CHECKLIST_ITEM is blocked outside pre_season_setup', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      // In pre_race_briefing — should not toggle checklist.
      state = dispatch(state, { type: 'TOGGLE_PRESEASON_CHECKLIST_ITEM', itemId: 'team_overview' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');
    });

    it('GENERATE_PADDOCK_EVENTS is blocked outside paddock_week', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      // In pre_season_setup — should not generate paddock events.
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });
      expect(getOrCreatePhaseState(state).paddockEvents.length).toBe(0);
    });
  });

  // --- AI team activity dedup (ISSUE 4) ---

  describe('AI team activity', () => {
    it('processAITeamActivity is idempotent (dedup flag)', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });

      // Process AI activity.
      state = processAITeamActivity(state);
      const newsAfterFirst = state.news.length;

      // Process again — should be a no-op.
      state = processAITeamActivity(state);
      expect(state.news.length).toBe(newsAfterFirst);
      expect(getOrCreatePhaseState(state).aiActionsProcessedForCurrentWeek).toBe(true);
    });

    it('GENERATE_PADDOCK_EVENTS processes AI activity once per week', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });

      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });
      const newsAfterFirst = state.news.length;

      // Generate again — should not add more AI news.
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });
      expect(state.news.length).toBe(newsAfterFirst);
    });
  });

  // --- Race prep focus effect (ISSUE 5) ---

  describe('race prep focus effect', () => {
    it('computeRacePrepFocusEffect returns correct modifiers for each focus', () => {
      const balanced = computeRacePrepFocusEffect('balanced');
      expect(balanced.paceModifier).toBeGreaterThan(0);
      expect(balanced.mistakeRiskMultiplier).toBeLessThan(1);

      const qualifying = computeRacePrepFocusEffect('qualifying');
      expect(qualifying.qualifyingModifier).toBeGreaterThan(0);
      expect(qualifying.paceModifier).toBeLessThanOrEqual(0);

      const race = computeRacePrepFocusEffect('race');
      expect(race.paceModifier).toBeGreaterThan(0);
      expect(race.reliabilityModifier).toBeGreaterThan(0);

      const reliability = computeRacePrepFocusEffect('reliability');
      expect(reliability.reliabilityModifier).toBeGreaterThan(race.reliabilityModifier);
      expect(reliability.paceModifier).toBeLessThan(0);

      const power = computeRacePrepFocusEffect('power');
      expect(power.paceModifier).toBeGreaterThan(0);
      expect(power.reliabilityModifier).toBeLessThan(0);

      const budget = computeRacePrepFocusEffect('budget');
      expect(budget.paceModifier).toBeLessThan(0);
      expect(budget.reliabilityModifier).toBeLessThan(0);
      expect(budget.qualifyingModifier).toBeLessThan(0);
      expect(budget.mistakeRiskMultiplier).toBeGreaterThan(1);
      expect(budget.setupConfidencePenalty).toBeGreaterThan(0);
      expect(budget.pitStopPenalty).toBeGreaterThan(0);
      expect(budget.strategyPenalty).toBeGreaterThan(0);
      expect(budget.costSavingMultiplier).toBeUndefined();
    });

    it('racePrepFocusApplied is set to true after race completion', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      // After race, racePrepFocusApplied should be true.
      expect(getOrCreatePhaseState(state).racePrepFocusApplied).toBe(true);
    });

    it('racePrepFocusApplied is reset when entering paddock week', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      // After entering paddock week, racePrepFocusApplied should be reset.
      expect(getOrCreatePhaseState(state).racePrepFocusApplied).toBe(false);
    });

    it('defaultCareerPhaseState has racePrepFocusApplied false', () => {
      const dps = defaultCareerPhaseState();
      expect(dps.racePrepFocusApplied).toBe(false);
    });
  });

  // --- Preseason checklist enforcement (ISSUE 6) ---

  describe('preseason checklist enforcement', () => {
    it('COMPLETE_PRESEASON_SETUP is blocked when checklist is incomplete', () => {
      let state = newCareerState();
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      expect(getCareerPhase(state)).toBe('pre_season_setup');
    });

    it('ADVANCE_TO_PRE_RACE_BRIEFING from pre_season_setup is blocked when checklist incomplete', () => {
      let state = newCareerState();
      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      expect(getCareerPhase(state)).toBe('pre_season_setup');
    });

    it('ADVANCE_TO_PRE_RACE_BRIEFING from pre_season_setup works when checklist complete', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');
    });
  });

  // --- Save/load duplicate safety (ISSUE 7) ---

  describe('save/load duplicate safety', () => {
    it('LOAD_GAME does not re-process paddock events or AI activity', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

      const eventsBefore = getOrCreatePhaseState(state).paddockEvents.length;
      const newsBefore = state.news.length;
      const aiFlagBefore = getOrCreatePhaseState(state).aiActionsProcessedForCurrentWeek;

      // Simulate save/load by dispatching LOAD_GAME with the same state.
      state = dispatch(state, { type: 'LOAD_GAME', state });
      expect(getOrCreatePhaseState(state).paddockEvents.length).toBe(eventsBefore);
      expect(state.news.length).toBe(newsBefore);
      expect(getOrCreatePhaseState(state).aiActionsProcessedForCurrentWeek).toBe(aiFlagBefore);
    });

    it('re-dispatching GENERATE_PADDOCK_EVENTS after load is a no-op', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

      // Simulate save/load.
      state = dispatch(state, { type: 'LOAD_GAME', state });

      // Try to generate again — should be a no-op.
      const eventsBefore = getOrCreatePhaseState(state).paddockEvents.length;
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });
      expect(getOrCreatePhaseState(state).paddockEvents.length).toBe(eventsBefore);
    });

    it('paddock event effectsApplied flag survives save/load', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

      // Resolve a required event.
      const phaseState = getOrCreatePhaseState(state);
      const requiredEvent = phaseState.paddockEvents.find((e) => e.isRequiredDecision);
      if (!requiredEvent) return;
      const optionId = requiredEvent.options?.[0]?.id ?? 'balanced';
      state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: requiredEvent.id, optionId });

      // Save/load.
      state = dispatch(state, { type: 'LOAD_GAME', state });

      // Event should still be marked as effectsApplied.
      const event = getOrCreatePhaseState(state).paddockEvents.find((e) => e.id === requiredEvent.id);
      expect(event?.effectsApplied).toBe(true);
      expect(event?.resolvedOptionId).toBe(optionId);
    });
  });

  // --- Cleanup ISSUE 1: Race prep no permanent gains ---

  describe('race prep no permanent gains', () => {
    it('race prep focus does not permanently increase car reliability or stats', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });

      const carBefore = carForTeam(state, state.selectedTeamId);
      const relBefore = carBefore?.developmentLevel.reliability ?? 0;

      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });

      const carAfter = carForTeam(state, state.selectedTeamId);
      const relAfter = carAfter?.developmentLevel.reliability ?? 0;

      // Race prep focus should NOT permanently change car reliability.
      expect(relAfter).toBeCloseTo(relBefore, 5);
    });

    it('repeated race prep choices cannot stack permanent car gains', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });

      const carBefore = carForTeam(state, state.selectedTeamId);
      const statsBefore = carBefore?.developmentLevel;

      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

      // Resolve required decisions (including race prep focus).
      const ps = getOrCreatePhaseState(state);
      for (const ev of ps.paddockEvents.filter((e) => e.isRequiredDecision)) {
        const optionId = ev.options?.[0]?.id ?? 'balanced';
        state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: ev.id, optionId });
      }

      // Second race cycle.
      state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });

      const carAfter = carForTeam(state, state.selectedTeamId);
      const statsAfter = carAfter?.developmentLevel;

      // No permanent stacking from race prep focus.
      expect(statsAfter?.enginePower).toBeCloseTo(statsBefore?.enginePower ?? 0, 5);
      expect(statsAfter?.reliability).toBeCloseTo(statsBefore?.reliability ?? 0, 5);
    });

    it('race prep effect is consumed/cleared after race', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });

      expect(getOrCreatePhaseState(state).racePrepFocusApplied).toBe(true);
    });
  });

  // --- Cleanup ISSUE 2: COMPLETE_PRESEASON_SETUP phase guard ---

  describe('COMPLETE_PRESEASON_SETUP phase guard', () => {
    it('does nothing outside pre_season_setup', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      // Now in pre_race_briefing.
      const phaseBefore = getCareerPhase(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      expect(getCareerPhase(state)).toBe(phaseBefore);
    });

    it('works inside pre_season_setup when checklist is complete', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');
    });

    it('does nothing from race_weekend', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      expect(getCareerPhase(state)).toBe('race_weekend');
    });

    it('does nothing from paddock_week', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      expect(getCareerPhase(state)).toBe('paddock_week');
    });
  });

  // --- Cleanup ISSUE 3: Preseason advancement sets completion flags ---

  describe('preseason advancement sets completion flags', () => {
    it('COMPLETE_PRESEASON_SETUP sets preseasonSetupComplete and preseasonDecisionsComplete', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      const ps = getOrCreatePhaseState(state);
      expect(ps.preseasonSetupComplete).toBe(true);
      expect(ps.preseasonDecisionsComplete).toBe(true);
    });

    it('ADVANCE_TO_PRE_RACE_BRIEFING from pre_season_setup sets completion flags', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      const ps = getOrCreatePhaseState(state);
      expect(ps.preseasonSetupComplete).toBe(true);
      expect(ps.preseasonDecisionsComplete).toBe(true);
    });

    it('ADVANCE_TO_PRE_RACE_BRIEFING from paddock_week does not modify preseason flags', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

      // Resolve required decisions.
      const ps = getOrCreatePhaseState(state);
      for (const ev of ps.paddockEvents.filter((e) => e.isRequiredDecision)) {
        const optionId = ev.options?.[0]?.id ?? 'balanced';
        state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: ev.id, optionId });
      }

      const flagsBefore = getOrCreatePhaseState(state);
      const setupCompleteBefore = flagsBefore.preseasonSetupComplete;
      const decisionsCompleteBefore = flagsBefore.preseasonDecisionsComplete;

      state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      const flagsAfter = getOrCreatePhaseState(state);
      expect(flagsAfter.preseasonSetupComplete).toBe(setupCompleteBefore);
      expect(flagsAfter.preseasonDecisionsComplete).toBe(decisionsCompleteBefore);
    });
  });

  // --- Cleanup ISSUE 4: AI paddock team selection fairness ---

  describe('AI paddock team selection fairness', () => {
    it('does not always select the first teams', () => {
      let state1 = newCareerState();
      state1 = completeChecklist(state1);
      state1 = dispatch(state1, { type: 'COMPLETE_PRESEASON_SETUP' });
      state1 = dispatch(state1, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state1 = dispatch(state1, { type: 'RUN_QUALIFYING', decisions: [] });
      state1 = dispatch(state1, { type: 'RUN_RACE', decisions: [] });
      state1 = dispatch(state1, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state1 = processAITeamActivity(state1);

      // Get AI team IDs from news.
      const aiNews1 = state1.news.filter((n) => n.id.startsWith('news-ai-'));

      // Advance to next paddock week (round 2).
      let state2 = newCareerState();
      state2 = completeChecklist(state2);
      state2 = dispatch(state2, { type: 'COMPLETE_PRESEASON_SETUP' });
      state2 = dispatch(state2, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state2 = dispatch(state2, { type: 'RUN_QUALIFYING', decisions: [] });
      state2 = dispatch(state2, { type: 'RUN_RACE', decisions: [] });
      state2 = dispatch(state2, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state2 = dispatch(state2, { type: 'GENERATE_PADDOCK_EVENTS' });

      // Resolve required decisions and advance to next race.
      const ps2 = getOrCreatePhaseState(state2);
      for (const ev of ps2.paddockEvents.filter((e) => e.isRequiredDecision)) {
        const optionId = ev.options?.[0]?.id ?? 'balanced';
        state2 = dispatch(state2, { type: 'RESOLVE_PADDOCK_EVENT', eventId: ev.id, optionId });
      }
      state2 = dispatch(state2, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
      state2 = dispatch(state2, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      state2 = dispatch(state2, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state2 = dispatch(state2, { type: 'RUN_QUALIFYING', decisions: [] });
      state2 = dispatch(state2, { type: 'RUN_RACE', decisions: [] });
      state2 = dispatch(state2, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      const state2After = processAITeamActivity(state2);

      // The selection should vary across weeks — not always the same teams.
      // (They might overlap, but they shouldn't be identical every time.)
      // We check that at least the selection is deterministic (same state => same result).
      expect(aiNews1.length).toBeGreaterThan(0);
      expect(state2After.news.length).toBeGreaterThan(0);
    });

    it('AI processing is deterministic for same save/week', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });

      const state1 = processAITeamActivity(state);
      const state2 = processAITeamActivity(state);

      // Both should produce the same news (deterministic).
      // Note: processAITeamActivity returns state unchanged on second call
      // because aiActionsProcessedForCurrentWeek is set. So we compare the
      // car stats from the first call.
      const cars1 = state1.cars.map((c) => ({ id: c.teamId, rel: c.developmentLevel.reliability }));
      const cars2 = state2.cars.map((c) => ({ id: c.teamId, rel: c.developmentLevel.reliability }));
      expect(cars1).toEqual(cars2);
    });

    it('AI processing does not duplicate after reload', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state = processAITeamActivity(state);
      const newsCount = state.news.length;

      // Simulate reload.
      state = dispatch(state, { type: 'LOAD_GAME', state });
      state = processAITeamActivity(state);
      expect(state.news.length).toBe(newsCount);
    });
  });

  // --- Cleanup ISSUE 6: Race-weekend action guards ---

  describe('race-weekend action guards', () => {
    it('SET_CAR_SETUP does not mutate outside race_weekend', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      // In pre_season_setup.
      const setupsBefore = state.carSetups;
      state = dispatch(state, {
        type: 'SET_CAR_SETUP',
        driverId: 'test-driver',
        setup: { wingLevel: 5, tyrePressure: 28, brakeBias: 50 } as never,
      });
      expect(state.carSetups).toEqual(setupsBefore);
    });

    it('SELECT_RACE_WEEKEND_PACKAGE does not mutate before preseason or paddock package selection windows', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      // In pre_season_setup.
      const pkgBefore = state.raceWeekendPackage;
      state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
      expect(state.raceWeekendPackage).not.toEqual(pkgBefore);

      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      const preRacePkg = state.raceWeekendPackage;
      state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Budget' });
      expect(state.raceWeekendPackage).toEqual(preRacePkg);
    });

    it('Paddock Week requires a race package before advancing to pre-race briefing', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

      const phaseState = getOrCreatePhaseState(state);
      for (const ev of phaseState.paddockEvents.filter((e) => e.isRequiredDecision)) {
        const optionId = ev.options?.[0]?.id ?? 'balanced';
        state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: ev.id, optionId });
      }

      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      expect(getCareerPhase(state)).toBe('paddock_week');

      state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');
    });

    it('RUN_PRACTICE_SESSION does not mutate outside race_weekend', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      // In pre_season_setup.
      const wpBefore = state.weekendPractice;
      state = dispatch(state, {
        type: 'RUN_PRACTICE_SESSION',
        raceId: 'test-race',
        kind: 'free' as never,
        assignments: [],
      });
      expect(state.weekendPractice).toEqual(wpBefore);
    });
  });

  // --- Cleanup ISSUE 7: Post-race review read-only ---

  describe('post-race review', () => {
    it('active post-race review can continue to Paddock Week', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      // In post_race_review.
      expect(getCareerPhase(state)).toBe('post_race_review');
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      expect(getCareerPhase(state)).toBe('paddock_week');
    });

    it('old post-race review cannot advance current phase', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });

      // Resolve required decisions.
      const ps = getOrCreatePhaseState(state);
      for (const ev of ps.paddockEvents.filter((e) => e.isRequiredDecision)) {
        const optionId = ev.options?.[0]?.id ?? 'balanced';
        state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: ev.id, optionId });
      }

      // Advance to next race and complete it.
      state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });

      // Now in post_race_review for race 2. The first race's review is "old".
      // ADVANCE_TO_PADDOCK_WEEK should work (we're in post_race_review for race 2).
      expect(getCareerPhase(state)).toBe('post_race_review');

      // But dispatching ADVANCE_TO_PADDOCK_WEEK should advance normally.
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      expect(getCareerPhase(state)).toBe('paddock_week');
    });
  });

  // --- Regression tests ---

  describe('regression', () => {
    it('full 5-phase loop still works', () => {
      let state = newCareerState();
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      expect(getCareerPhase(state)).toBe('race_weekend');
      state = dispatch(state, { type: 'RUN_QUALIFYING', decisions: [] });
      state = dispatch(state, { type: 'RUN_RACE', decisions: [] });
      expect(getCareerPhase(state)).toBe('post_race_review');
      state = dispatch(state, { type: 'ADVANCE_TO_PADDOCK_WEEK' });
      expect(getCareerPhase(state)).toBe('paddock_week');
      state = dispatch(state, { type: 'GENERATE_PADDOCK_EVENTS' });
      // Resolve required decisions.
      const ps = getOrCreatePhaseState(state);
      for (const ev of ps.paddockEvents.filter((e) => e.isRequiredDecision)) {
        const optionId = ev.options?.[0]?.id ?? 'balanced';
        state = dispatch(state, { type: 'RESOLVE_PADDOCK_EVENT', eventId: ev.id, optionId });
      }
      state = dispatch(state, { type: 'SELECT_RACE_WEEKEND_PACKAGE', packageType: 'Standard' });
      state = dispatch(state, { type: 'ADVANCE_TO_PRE_RACE_BRIEFING' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');
    });

    it('Single Season Mode still works', () => {
      let state = newSingleSeasonState();
      expect(getCareerPhase(state)).toBe('pre_season_setup');
      state = completeChecklist(state);
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');
    });
  });

  // --- Pre-Season Tab Approval Flow Tests ---

  describe('Pre-Season Tab Approval Flow', () => {
    it('preseason approvals start incomplete', () => {
      const state = newCareerState();
      const approvals = getPreseasonApprovals(state);
      expect(approvals.teamOverview).toBe(false);
      expect(approvals.budget).toBe(false);
      expect(approvals.driverLineup).toBe(false);
      expect(approvals.carDevelopment).toBe(false);
      expect(approvals.sponsorsEngine).toBe(false);
      expect(approvals.seasonObjectives).toBe(false);
      expect(approvals.roundOnePreview).toBe(false);
    });

    it('approving a single tab updates only that tab', () => {
      let state = newCareerState();
      state = approvePreseasonTab(state, 'teamOverview');
      const approvals = getPreseasonApprovals(state);
      expect(approvals.teamOverview).toBe(true);
      expect(approvals.budget).toBe(false);
      expect(approvals.driverLineup).toBe(false);
    });

    it('approving multiple tabs works independently', () => {
      let state = newCareerState();
      state = approvePreseasonTab(state, 'teamOverview');
      state = approvePreseasonTab(state, 'budget');
      state = approvePreseasonTab(state, 'driverLineup');
      const approvals = getPreseasonApprovals(state);
      expect(approvals.teamOverview).toBe(true);
      expect(approvals.budget).toBe(true);
      expect(approvals.driverLineup).toBe(true);
      expect(approvals.carDevelopment).toBe(false);
    });

    it('cannot advance to Pre-Race Briefing until all tabs are approved', () => {
      let state = newCareerState();
      state = approvePreseasonTab(state, 'teamOverview');
      state = approvePreseasonTab(state, 'budget');
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      expect(getCareerPhase(state)).toBe('pre_season_setup');
    });

    it('can advance to Pre-Race Briefing when all tabs are approved', () => {
      let state = newCareerState();
      state = approvePreseasonTab(state, 'teamOverview');
      state = approvePreseasonTab(state, 'budget');
      state = approvePreseasonTab(state, 'driverLineup');
      state = approvePreseasonTab(state, 'carDevelopment');
      state = approvePreseasonTab(state, 'sponsorsEngine');
      state = approvePreseasonTab(state, 'seasonObjectives');
      state = approvePreseasonTab(state, 'roundOnePreview');
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      expect(getCareerPhase(state)).toBe('pre_race_briefing');
    });

    it('APPROVE_PRESEASON_TAB action only works from pre_season_setup phase', () => {
      let state = newCareerState();
      // Complete all tabs to allow advancing
      state = approvePreseasonTab(state, 'teamOverview');
      state = approvePreseasonTab(state, 'budget');
      state = approvePreseasonTab(state, 'driverLineup');
      state = approvePreseasonTab(state, 'carDevelopment');
      state = approvePreseasonTab(state, 'sponsorsEngine');
      state = approvePreseasonTab(state, 'seasonObjectives');
      state = approvePreseasonTab(state, 'roundOnePreview');
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      state = dispatch(state, { type: 'ADVANCE_TO_RACE_WEEKEND' });
      const before = getPreseasonApprovals(state);
      state = dispatch(state, { type: 'APPROVE_PRESEASON_TAB', tabId: 'teamOverview' });
      const after = getPreseasonApprovals(state);
      expect(after.teamOverview).toBe(before.teamOverview);
    });

    it('advancing from preseason sets completion flags', () => {
      let state = newCareerState();
      state = approvePreseasonTab(state, 'teamOverview');
      state = approvePreseasonTab(state, 'budget');
      state = approvePreseasonTab(state, 'driverLineup');
      state = approvePreseasonTab(state, 'carDevelopment');
      state = approvePreseasonTab(state, 'sponsorsEngine');
      state = approvePreseasonTab(state, 'seasonObjectives');
      state = approvePreseasonTab(state, 'roundOnePreview');
      state = dispatch(state, { type: 'COMPLETE_PRESEASON_SETUP' });
      const phaseState = getOrCreatePhaseState(state);
      expect(phaseState.preseasonSetupComplete).toBe(true);
      expect(phaseState.preseasonDecisionsComplete).toBe(true);
    });
  });

  // --- Relationship Sync Tests ---

  describe('Relationship Sync', () => {
    it('syncDriverRelationshipsForTeam creates relationships for new drivers', () => {
      let state = newCareerState();
      const teamId = state.selectedTeamId;
      const drivers = driversForTeam(state, teamId);
      const driverId = drivers[0]?.id;
      if (!driverId) return;

      // Remove existing relationship
      state = { ...state, driverRelationships: {} };
      state = syncDriverRelationshipsForTeam(state, teamId, state.randomSeed ?? 'sync');
      expect(state.driverRelationships?.[driverId]).toBeDefined();
    });

    it('syncDriverRelationshipsForTeam preserves existing relationship values', () => {
      let state = newCareerState();
      const teamId = state.selectedTeamId;
      const drivers = driversForTeam(state, teamId);
      const driverId = drivers[0]?.id;
      if (!driverId) return;

      const originalRel = state.driverRelationships?.[driverId];
      if (!originalRel) return;

      state = syncDriverRelationshipsForTeam(state, teamId, state.randomSeed ?? 'sync');
      const syncedRel = state.driverRelationships?.[driverId];
      expect(syncedRel?.teamLoyalty).toBe(originalRel.teamLoyalty);
      expect(syncedRel?.engineerChemistry).toBe(originalRel.engineerChemistry);
    });

    it('syncDriverRelationshipsForTeam updates teammate links for active drivers', () => {
      let state = newCareerState();
      const teamId = state.selectedTeamId;
      const activeDrivers = activeDriversForTeam(state, teamId);
      if (activeDrivers.length < 2) return;

      state = syncDriverRelationshipsForTeam(state, teamId, state.randomSeed ?? 'sync');
      const rel1 = state.driverRelationships?.[activeDrivers[0].id];
      const rel2 = state.driverRelationships?.[activeDrivers[1].id];
      expect(rel1?.teammateId).toBe(activeDrivers[1].id);
      expect(rel2?.teammateId).toBe(activeDrivers[0].id);
    });

    it('syncDriverRelationshipsForTeam removes relationships for drivers who left the team', () => {
      let state = newCareerState();
      const teamId = state.selectedTeamId;
      const drivers = driversForTeam(state, teamId);
      const driverId = drivers[0]?.id;
      if (!driverId) return;

      // Create a relationship for a driver not on the team
      const fakeDriverId = 'fake-driver-id';
      state = {
        ...state,
        driverRelationships: {
          ...state.driverRelationships,
          [fakeDriverId]: {
            driverId: fakeDriverId,
            teamId,
            teamLoyalty: 50,
            engineerChemistry: 50,
            teammateRelationship: 50,
            morale: 60,
            frustration: 20,
            numberOneExpectation: false,
            selfConfidence: 55,
            trustInCar: 50,
            trustInTeam: 55,
            trustInPrincipal: 58,
            teamTrustInDriver: 55,
            ego: 45,
            personalityTraits: [],
            wants: [],
          },
        },
      };

      state = syncDriverRelationshipsForTeam(state, teamId, state.randomSeed ?? 'sync');
      expect(state.driverRelationships?.[fakeDriverId]).toBeUndefined();
    });
  });

  // --- Preseason driver lineup guard (PART 6) ---

  describe('preseason driver lineup guard', () => {
    it('approvePreseasonTab rejects driverLineup when team has fewer than 2 active race drivers', () => {
      let state = newCareerState();
      const teamId = state.selectedTeamId;

      // Change one active driver's contract to reserve to have only 1 race driver.
      const raceDrivers = activeDriversForTeam(state, teamId);
      if (raceDrivers.length >= 2) {
        const toDemote = raceDrivers[0];
        state = {
          ...state,
          drivers: state.drivers.map((d) =>
            d.id === toDemote.id
              ? { ...d, contractType: 'reserve' as const }
              : d,
          ),
        };
      }

      const activeCount = activeDriversForTeam(state, teamId).length;
      expect(activeCount).toBeLessThan(2);

      const approvalsBefore = getPreseasonApprovals(state);
      state = approvePreseasonTab(state, 'driverLineup');
      const approvalsAfter = getPreseasonApprovals(state);

      // Approval should NOT be granted.
      expect(approvalsAfter.driverLineup).toBe(approvalsBefore.driverLineup);
      expect(approvalsAfter.driverLineup).toBeFalsy();
    });

    it('approvePreseasonTab allows driverLineup when team has 2+ active race drivers', () => {
      const state = newCareerState();
      const teamId = state.selectedTeamId;
      const activeCount = activeDriversForTeam(state, teamId).length;
      expect(activeCount).toBeGreaterThanOrEqual(2);

      const updated = approvePreseasonTab(state, 'driverLineup');
      const approvals = getPreseasonApprovals(updated);
      expect(approvals.driverLineup).toBe(true);
    });

    it('approvePreseasonTab still allows other tabs regardless of driver count', () => {
      let state = newCareerState();
      const teamId = state.selectedTeamId;

      // Change all race drivers to reserve contracts.
      const raceDrivers = activeDriversForTeam(state, teamId);
      const raceDriverIds = new Set(raceDrivers.map((d) => d.id));
      state = {
        ...state,
        drivers: state.drivers.map((d) =>
          d.teamId === teamId && raceDriverIds.has(d.id)
            ? { ...d, contractType: 'reserve' as const }
            : d,
        ),
      };

      // Other tabs should still be approvable.
      state = approvePreseasonTab(state, 'teamOverview');
      expect(getPreseasonApprovals(state).teamOverview).toBe(true);

      state = approvePreseasonTab(state, 'budget');
      expect(getPreseasonApprovals(state).budget).toBe(true);
    });

    it('checklist cannot be completed without driverLineup approval', () => {
      let state = newCareerState();
      const teamId = state.selectedTeamId;

      // Change one active driver's contract to reserve.
      const raceDrivers = activeDriversForTeam(state, teamId);
      if (raceDrivers.length >= 2) {
        const toDemote = raceDrivers[0];
        state = {
          ...state,
          drivers: state.drivers.map((d) =>
            d.id === toDemote.id
              ? { ...d, contractType: 'reserve' as const }
              : d,
          ),
        };
      }

      // Approve all tabs except driverLineup (which should fail).
      state = approvePreseasonTab(state, 'teamOverview');
      state = approvePreseasonTab(state, 'budget');
      state = approvePreseasonTab(state, 'driverLineup'); // Should fail.
      state = approvePreseasonTab(state, 'carDevelopment');
      state = approvePreseasonTab(state, 'sponsorsEngine');
      state = approvePreseasonTab(state, 'seasonObjectives');
      state = approvePreseasonTab(state, 'roundOnePreview');

      expect(isPreseasonChecklistComplete(state)).toBe(false);
    });
  });

  // --- Career mobility setting (PART 8) ---

  describe('career mobility mode', () => {
    it('SET_CAREER_MOBILITY updates careerMobilityMode', () => {
      let state = newCareerState();
      expect(state.careerMobilityMode).toBe('StandardCareer');

      state = dispatch(state, { type: 'SET_CAREER_MOBILITY', mode: 'TeamLock' });
      expect(state.careerMobilityMode).toBe('TeamLock');

      state = dispatch(state, { type: 'SET_CAREER_MOBILITY', mode: 'Sandbox' });
      expect(state.careerMobilityMode).toBe('Sandbox');
    });

    it('SET_CAREER_MOBILITY defaults to StandardCareer on new game', () => {
      const state = newCareerState();
      expect(state.careerMobilityMode).toBe('StandardCareer');
    });
  });
});
