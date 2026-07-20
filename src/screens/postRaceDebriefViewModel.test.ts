import { describe, expect, it } from 'vitest';
import type { QualifyingResult, RaceResult, Track } from '../types/gameTypes';
import type { RaceEvent } from '../types/simTypes';
import type { WeatherState } from '../types/liveTypes';
import { buildPostRaceCausalDebrief } from './postRaceDebriefViewModel';

const track = {
  id: 'track-1',
  name: 'Test Circuit',
  setupProfile: { powerDemand: 80, aeroDemand: 55, mechanicalDemand: 40 },
} as Track;

const result = (driverId: string, gridPosition: number, position: number | null): RaceResult => ({
  driverId,
  teamId: 'player',
  gridPosition,
  position,
  status: position === null ? 'DNF' : 'Finished',
  lapsCompleted: 50,
  points: position === 1 ? 25 : 0,
  raceScore: 80,
  gapText: '',
  incidents: [],
});

describe('postRaceDebriefViewModel', () => {
  it('turns stored race evidence into a causal, non-formulaic summary', () => {
    const plan = buildPostRaceCausalDebrief({
      raceId: 'race-1',
      playerResults: [result('driver-1', 8, 4)],
      qualifyingResults: [{ position: 8 } as QualifyingResult],
      events: [{ lap: 12, text: 'Contact', category: 'incident' } as RaceEvent],
      track,
      raceWeather: {
        condition: 'Dry',
        wet: false,
        gripLevel: 1,
        changingSoon: false,
        label: 'Dry',
      } satisfies WeatherState,
      packageLabel: 'Standard Package',
      setupKnowledge: 0.4,
      tyreKnowledge: 0.8,
      reliabilityKnowledge: 0.7,
      unresolvedTechnicalCases: 1,
      unresolvedPaddockDecisions: 1,
    });

    expect(plan.summary).toContain('4 net places gained');
    expect(plan.evidence.find((item) => item.label === 'Track demand')?.value).toBe('Power');
    expect(plan.evidence.find((item) => item.label === 'Knowledge gap')?.value).toBe('Setup 40%');
    expect(plan.followUps.map((item) => item.route)).toEqual([
      '/post-race/race-1?tab=investigation',
      '/technical?section=parts',
      '/paddock?tab=decisions',
    ]);
  });
});
