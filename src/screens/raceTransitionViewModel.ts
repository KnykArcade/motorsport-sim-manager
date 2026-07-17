export type PreRaceBriefingTab = 'overview' | 'preparation' | 'team' | 'paddock';
export type RaceResultsTab = 'summary' | 'classification' | 'story' | 'championships';
export type SeasonReviewTab = 'honours' | 'drivers' | 'constructors' | 'next';
export type RaceWeekendPhase =
  | 'hub'
  | 'briefing'
  | 'practice'
  | 'setup'
  | 'quali-run'
  | 'quali-review'
  | 'race-strategy'
  | 'race-instructions';

export const PRE_RACE_BRIEFING_TABS: ReadonlyArray<{ id: PreRaceBriefingTab; label: string }> = [
  { id: 'overview', label: 'Race Overview' },
  { id: 'preparation', label: 'Preparation' },
  { id: 'team', label: 'Team Status' },
  { id: 'paddock', label: 'Paddock' },
];

export const RACE_RESULTS_TABS: ReadonlyArray<{ id: RaceResultsTab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'classification', label: 'Classification' },
  { id: 'story', label: 'Race Story' },
  { id: 'championships', label: 'Championships' },
];

export const SEASON_REVIEW_TABS: ReadonlyArray<{ id: SeasonReviewTab; label: string }> = [
  { id: 'honours', label: 'Season Honours' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'constructors', label: 'Constructors' },
  { id: 'next', label: 'What’s Next' },
];

export const RACE_WEEKEND_PHASES: ReadonlyArray<{ id: RaceWeekendPhase; label: string }> = [
  { id: 'hub', label: 'Weekend Hub' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'practice', label: 'Practice' },
  { id: 'setup', label: 'Car Setup' },
  { id: 'quali-run', label: 'Qualifying Plan' },
  { id: 'quali-review', label: 'Qualifying Review' },
  { id: 'race-strategy', label: 'Race Strategy' },
  { id: 'race-instructions', label: 'Instructions' },
];

export function visibleRaceWeekendPhases(minimumPackage: boolean) {
  return minimumPackage
    ? RACE_WEEKEND_PHASES.filter((phase) => phase.id !== 'practice' && phase.id !== 'setup')
    : [...RACE_WEEKEND_PHASES];
}

export function raceWeekendPhaseIndex(phase: RaceWeekendPhase, minimumPackage: boolean): number {
  return visibleRaceWeekendPhases(minimumPackage).findIndex((item) => item.id === phase);
}

export function canOpenRaceWeekendPhase(
  candidate: RaceWeekendPhase,
  furthest: RaceWeekendPhase,
  minimumPackage: boolean,
): boolean {
  const candidateIndex = raceWeekendPhaseIndex(candidate, minimumPackage);
  const furthestIndex = raceWeekendPhaseIndex(furthest, minimumPackage);
  return candidateIndex >= 0 && furthestIndex >= 0 && candidateIndex <= furthestIndex;
}

export const RESULT_PAGE_SIZE = 10;
export const EVENT_PAGE_SIZE = 8;

export function transitionPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function transitionPage<T>(entries: T[], requestedPage: number, pageSize = RESULT_PAGE_SIZE): T[] {
  const safePage = Math.max(0, Math.min(transitionPageCount(entries.length, pageSize) - 1, requestedPage));
  return entries.slice(safePage * pageSize, (safePage + 1) * pageSize);
}
