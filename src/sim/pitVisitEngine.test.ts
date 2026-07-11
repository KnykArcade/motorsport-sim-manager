import { describe, expect, it } from 'vitest';
import { allocateTransitLoss, reconcilePitVisitBreakdown, transitAllocationTotal } from './pitVisitEngine';

describe('pit visit reconciliation', () => {
  it('keeps workbook transit separate from individual stationary service', () => {
    const visit = reconcilePitVisitBreakdown({
      pitDataTrackId: 'TRK-001',
      transitLossSeconds: 19.4,
      individualPitStopSeconds: 2.5,
      sourceMethod: 'Workbook transit + runtime service',
      confidence: 'High',
    });
    expect(visit.transitLossSeconds).toBe(19.4);
    expect(visit.individualPitStopSeconds).toBe(2.5);
    expect(visit.totalPitVisitLossSeconds).toBe(21.9);
  });

  it('allows drive-through visits with zero stationary service', () => {
    const visit = reconcilePitVisitBreakdown({
      transitLossSeconds: 23.2,
      individualPitStopSeconds: 0,
      penaltyDelaySeconds: 0,
      sourceMethod: 'Drive-through',
      confidence: 'Medium',
    });
    expect(visit.totalPitVisitLossSeconds).toBe(23.2);
  });

  it('allocates entry/transit/exit portions to exactly one transit value', () => {
    const allocation = allocateTransitLoss(19.4);
    expect(transitAllocationTotal(allocation)).toBe(19.4);
  });
});
