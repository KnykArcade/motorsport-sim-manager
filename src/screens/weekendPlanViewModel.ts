import { recommendedInstruction, recommendedQualiRunPlan, recommendedRaceStrategy } from '../sim/weekendAdvisorEngine';
import type { KnowledgeGaps } from '../sim/practiceProgramEngine';
import type { Track } from '../types/gameTypes';
import type { WeekendForecast } from '../sim/weatherEngine';
import { staffRatingOutOfTen } from '../sim/staffEngine';
import type { StaffMember, StaffResponsibilityPolicy } from '../types/staffTypes';
import type { RaceWeekendPhase } from './raceTransitionViewModel';

export type StaffWeekendRecommendation = {
  owner: string;
  confidence: number;
  summary: string;
  approvalBoundary: string;
};

export type WeekendPlan = {
  nextPhase: RaceWeekendPhase;
  nextLabel: string;
  nextDescription: string;
  qualifyingRecommendation: string;
  raceRecommendation: string;
  instructionRecommendation: string;
  knowledgePriority: 'Setup' | 'Tyres' | 'Reliability' | 'Complete';
  knowledgeGaps: KnowledgeGaps;
  staffRecommendation?: StaffWeekendRecommendation;
};

const PHASE_LABELS: Record<RaceWeekendPhase, string> = {
  hub: 'Weekend Plan',
  briefing: 'Track Briefing',
  practice: 'Practice',
  setup: 'Car Setup',
  'quali-run': 'Qualifying Run Plan',
  'quali-review': 'Qualifying Review',
  'race-strategy': 'Race Strategy',
  'race-instructions': 'Driver Instructions',
};

export function nextWeekendPhase(
  phase: RaceWeekendPhase,
  isMinPackage: boolean,
  qualifyingComplete: boolean,
): RaceWeekendPhase {
  if (phase === 'hub') return 'briefing';
  if (phase === 'briefing') return isMinPackage ? 'quali-run' : 'practice';
  if (phase === 'practice') return 'setup';
  if (phase === 'setup') return qualifyingComplete ? 'race-strategy' : 'quali-run';
  if (phase === 'quali-run') return 'quali-review';
  if (phase === 'quali-review') return isMinPackage ? 'race-strategy' : 'setup';
  if (phase === 'race-strategy') return 'race-instructions';
  return 'race-instructions';
}

export function buildWeekendPlan(input: {
  phase: RaceWeekendPhase;
  isMinPackage: boolean;
  qualifyingComplete: boolean;
  track: Track;
  forecast: WeekendForecast;
  knowledgeGaps: KnowledgeGaps;
  raceEngineer?: StaffMember;
  racePreparationPolicy?: StaffResponsibilityPolicy;
}): WeekendPlan {
  const nextPhase = nextWeekendPhase(input.phase, input.isMinPackage, input.qualifyingComplete);
  const gaps = input.knowledgeGaps;
  const priorities: Array<[WeekendPlan['knowledgePriority'], number]> = [
    ['Setup', 1 - gaps.setup],
    ['Tyres', 1 - gaps.tire],
    ['Reliability', 1 - gaps.reliability],
  ];
  priorities.sort((a, b) => b[1] - a[1]);
  const knowledgePriority = priorities[0][1] <= 0 ? 'Complete' : priorities[0][0];

  const staffRecommendation = input.raceEngineer && input.racePreparationPolicy === 'staff_prepare_player_approval'
    ? {
        owner: `${input.raceEngineer.name} · ${staffRatingOutOfTen(input.raceEngineer.rating).toFixed(1)}/10`,
        confidence: Math.round(50 + staffRatingOutOfTen(input.raceEngineer.rating) * 5),
        summary: 'Race Engineer has prepared the weekend recommendations from the forecast and current knowledge gaps.',
        approvalBoundary: 'You still approve the qualifying run, race strategy, and driver instructions.',
      }
    : undefined;

  return {
    nextPhase,
    nextLabel: PHASE_LABELS[nextPhase],
    nextDescription: nextPhase === 'practice'
      ? 'Use track time to close the most important knowledge gap before setup.'
      : nextPhase === 'setup'
        ? 'Apply what the team learned and commit the qualifying and race trims.'
        : `Review the ${PHASE_LABELS[nextPhase].toLowerCase()} before moving on.`,
    qualifyingRecommendation: recommendedQualiRunPlan(input.track, input.forecast.Qualifying).reason,
    raceRecommendation: recommendedRaceStrategy(input.track, input.forecast.Race).reason,
    instructionRecommendation: recommendedInstruction(input.track, input.forecast.Race).reason,
    knowledgePriority,
    knowledgeGaps: gaps,
    staffRecommendation,
  };
}
