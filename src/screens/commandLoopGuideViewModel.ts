import type { GameState } from '../game/careerState';

export type CommandLoopGuideStep = {
  number: number;
  title: string;
  detail: string;
};

export type CommandLoopGuide = {
  title: string;
  summary: string;
  steps: CommandLoopGuideStep[];
};

export function commandLoopGuide(state: GameState): CommandLoopGuide | null {
  const hasStartedRace = Object.keys(state.completedRaceResults).length > 0;
  if (state.seasonComplete || hasStartedRace || state.currentRaceIndex > 0) return null;

  return {
    title: 'Your first management week',
    summary: 'Use Manager Office as your command hub. The game will teach the rhythm once, then get out of your way.',
    steps: [
      {
        number: 1,
        title: 'Start at Manager Office',
        detail: 'See the next decision, this week’s priorities, and what changed.',
      },
      {
        number: 2,
        title: 'Triage the Inbox',
        detail: 'Must Respond blocks progress; Recommended items are advice; News & Stories is information.',
      },
      {
        number: 3,
        title: 'Use Continue for the next action',
        detail: 'Continue opens the owning screen and exact decision. It never makes a consequential choice for you.',
      },
      {
        number: 4,
        title: 'Return to the agenda',
        detail: 'Use Manager Office whenever you want to step back and see the whole week again.',
      },
    ],
  };
}
