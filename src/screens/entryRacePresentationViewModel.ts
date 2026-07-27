import type { GameState } from '../game/careerState';
import type { LiveCarState, LiveRaceState } from '../types/liveTypes';
import type { RaceEvent } from '../types/simTypes';
import { workflowDestination } from '../components/layoutWorkflow';

export type EntryStep = 'mode' | 'setup' | 'team' | 'principal';

export const ENTRY_STEPS: ReadonlyArray<{
  id: EntryStep;
  label: string;
  detail: string;
}> = [
  { id: 'mode', label: 'Game Mode', detail: 'Choose the career rules' },
  { id: 'setup', label: 'Championship', detail: 'Select series and season' },
  { id: 'team', label: 'Team', detail: 'Review the grid and choose a seat' },
  { id: 'principal', label: 'Principal', detail: 'Build your management profile' },
];

export function entryStepState(
  item: EntryStep,
  active: EntryStep,
): 'complete' | 'active' | 'upcoming' {
  const itemIndex = ENTRY_STEPS.findIndex((entry) => entry.id === item);
  const activeIndex = ENTRY_STEPS.findIndex((entry) => entry.id === active);
  if (itemIndex < activeIndex) return 'complete';
  if (itemIndex === activeIndex) return 'active';
  return 'upcoming';
}

export type SavedCareerSummary = {
  title: string;
  team: string;
  round: string;
  stage: string;
  nextAction: string;
  updated: string;
};

export function savedCareerSummary(state: GameState): SavedCareerSummary {
  const team = state.teams.find((entry) => entry.id === state.selectedTeamId);
  const race = state.calendar[state.currentRaceIndex];
  const workflow = workflowDestination(state);
  const completed = state.calendar.filter((entry) => entry.completed).length;
  return {
    title: `${state.seasonYear} ${state.series} · ${gameModeLabel(state.gameMode)}`,
    team: team?.name ?? state.selectedTeamId,
    round: race
      ? `Round ${race.round}/${state.calendar.length} · ${race.gpName}`
      : `${completed}/${state.calendar.length} rounds complete`,
    stage: workflow.context,
    nextAction: workflow.label,
    updated: formatSavedAt(state.updatedAt),
  };
}

function gameModeLabel(mode: GameState['gameMode']): string {
  if (mode === 'SingleSeason') return 'Single Season';
  if (mode === 'Career') return 'Career';
  return 'Sandbox';
}

function formatSavedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved career';
  return `Saved ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export type RaceControlPresentation = {
  label: string;
  detail: string;
  tone: 'green' | 'yellow' | 'red' | 'finished';
  pitLane: 'Open' | 'Closed';
};

export function raceControlPresentation(live: LiveRaceState): RaceControlPresentation {
  const control = live.raceControl;
  if (live.phase === 'finished' || control?.mode === 'Finished') {
    return { label: 'Finished', detail: 'Provisional classification available', tone: 'finished', pitLane: 'Closed' };
  }
  if (control?.mode === 'RedFlag') {
    return { label: 'Red Flag', detail: control.reason ?? 'Race suspended', tone: 'red', pitLane: 'Closed' };
  }
  if (live.safetyCar.active || ['SafetyCar', 'PaceCar', 'Caution', 'FullCourseYellow', 'VirtualSafetyCar'].includes(control?.mode ?? '')) {
    return {
      label: control?.mode === 'VirtualSafetyCar' ? 'Virtual Safety Car' : control?.mode === 'Caution' ? 'Caution' : 'Safety Car',
      detail: control?.reason ?? live.safetyCar.reason ?? 'Field under control',
      tone: 'yellow',
      pitLane: control?.pitLaneOpen === false ? 'Closed' : 'Open',
    };
  }
  if (control?.mode === 'LocalYellow') {
    return { label: 'Local Yellow', detail: control.reason ?? 'Incident in sector', tone: 'yellow', pitLane: control.pitLaneOpen ? 'Open' : 'Closed' };
  }
  if (control?.mode === 'RestartFormation' || control?.mode === 'GreenFlagRestart') {
    return { label: 'Restart', detail: 'Field preparing to return to green', tone: 'yellow', pitLane: control.pitLaneOpen ? 'Open' : 'Closed' };
  }
  return {
    label: live.phase === 'formation' ? 'Formation' : 'Green Flag',
    detail: live.phase === 'formation' ? 'Grid forming for the start' : 'Race running normally',
    tone: 'green',
    pitLane: control?.pitLaneOpen === false ? 'Closed' : 'Open',
  };
}

export function selectedLiveCar(
  cars: readonly LiveCarState[],
  selectedDriverId: string | null | undefined,
  preferredDriverIds: readonly string[] = [],
): LiveCarState | undefined {
  return cars.find((car) => car.driverId === selectedDriverId)
    ?? preferredDriverIds.map((id) => cars.find((car) => car.driverId === id)).find(Boolean)
    ?? cars.find((car) => car.position === 1)
    ?? cars[0];
}

export type RaceStoryFilter = 'all' | 'priority' | 'incidents' | 'strategy' | 'battles' | 'control';

export function filterRaceStory(
  events: readonly RaceEvent[],
  filter: RaceStoryFilter,
): RaceEvent[] {
  if (filter === 'all') return [...events];
  return events.filter((event) => {
    const text = event.text.toLowerCase();
    if (filter === 'priority') {
      return event.category === 'incident'
        || event.category === 'weather'
        || event.category === 'race-control'
        || /(retir|crash|failure|safety car|yellow|red flag|rain|lead change)/.test(text);
    }
    if (filter === 'incidents') return event.category === 'incident' || /(retir|crash|contact|failure|spin|puncture|damage)/.test(text);
    if (filter === 'strategy') return event.category === 'strategy' || /(pit|tyre|tire|box|strategy|undercut|overcut|mode)/.test(text);
    if (filter === 'battles') return event.category === 'battle' || /(pass|overtak|defend|battle|position)/.test(text);
    return event.category === 'race-control' || event.category === 'weather' || event.category === 'status';
  });
}
