import { describe, expect, it } from 'vitest';
import { advancePitJourney, beginPitJourney } from './pitJourneyEngine';

describe('pit journey engine', () => {
  it('applies transit and stationary service exactly once across physical phases', () => {
    let journey = visit();
    const losses: number[] = [];
    for (let step = 0; step < 10 && journey.phase !== 'Rejoined'; step++) {
      const result = advancePitJourney(journey);
      journey = result.journey;
      losses.push(result.appliedThisStepSeconds);
    }
    expect(journey.phase).toBe('Rejoined');
    expect(journey.appliedLossSeconds).toBe(journey.breakdown.totalPitVisitLossSeconds);
    expect(losses.filter((loss) => Math.abs(loss - 7.9) < 0.001)).toHaveLength(1);
  });

  it('waits behind a teammate without repeatedly applying queue loss', () => {
    let journey = visit();
    while (journey.phase !== 'PitTransitToBox') journey = advancePitJourney(journey).journey;
    journey = advancePitJourney(journey, true).journey;
    expect(journey.phase).toBe('QueuedBehindTeammate');
    const waiting = advancePitJourney(journey, true);
    expect(waiting.appliedThisStepSeconds).toBe(0);
    const service = advancePitJourney(waiting.journey, false);
    expect(service.journey.phase).toBe('StationaryService');
    expect(service.appliedThisStepSeconds).toBe(7.9);
  });

  it('supports a drive-through with zero stationary service', () => {
    let journey = beginPitJourney({
      ...base(), individualPitStopSeconds: 0, queueDelaySeconds: 0,
      penaltyDelaySeconds: 0, repairDelaySeconds: 0,
    });
    const phases: string[] = [];
    while (journey.phase !== 'Rejoined') {
      journey = advancePitJourney(journey).journey;
      phases.push(journey.phase);
    }
    expect(phases).not.toContain('StationaryService');
    expect(journey.serviceCompleted).toBe(true);
    expect(journey.appliedLossSeconds).toBe(journey.breakdown.totalPitVisitLossSeconds);
  });
});

function visit() { return beginPitJourney(base()); }
function base() {
  return {
    pitDataTrackId: 'track', transitLossSeconds: 20, individualPitStopSeconds: 2.5,
    queueDelaySeconds: 1.2, entryExitErrorSeconds: 0.4, penaltyDelaySeconds: 0.8,
    repairDelaySeconds: 3.4, cautionAdjustmentSeconds: -2,
    sourceMethod: 'workbook', confidence: 'High' as const,
  };
}
