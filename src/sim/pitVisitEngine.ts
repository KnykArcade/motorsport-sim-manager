import type { PitTransitAllocation, PitVisitBreakdown, RuntimePitConfidence } from '../types/pitTypes';

export function allocateTransitLoss(transitLossSeconds: number): PitTransitAllocation {
  const entrySeconds = round3(transitLossSeconds * 0.22);
  const toBoxSeconds = round3(transitLossSeconds * 0.28);
  const fromBoxSeconds = round3(transitLossSeconds * 0.28);
  const exitSeconds = round3(transitLossSeconds - entrySeconds - toBoxSeconds - fromBoxSeconds);
  return { entrySeconds, toBoxSeconds, fromBoxSeconds, exitSeconds };
}

export function transitAllocationTotal(allocation: PitTransitAllocation): number {
  return round3(allocation.entrySeconds + allocation.toBoxSeconds + allocation.fromBoxSeconds + allocation.exitSeconds);
}

export type PitVisitBreakdownInput = {
  pitDataTrackId?: string | null;
  transitLossSeconds: number;
  individualPitStopSeconds: number;
  queueDelaySeconds?: number;
  entryExitErrorSeconds?: number;
  penaltyDelaySeconds?: number;
  repairDelaySeconds?: number;
  cautionAdjustmentSeconds?: number;
  sourceMethod: string;
  confidence: RuntimePitConfidence;
};

export function reconcilePitVisitBreakdown(input: PitVisitBreakdownInput): PitVisitBreakdown {
  const queueDelaySeconds = input.queueDelaySeconds ?? 0;
  const entryExitErrorSeconds = input.entryExitErrorSeconds ?? 0;
  const penaltyDelaySeconds = input.penaltyDelaySeconds ?? 0;
  const repairDelaySeconds = input.repairDelaySeconds ?? 0;
  const cautionAdjustmentSeconds = input.cautionAdjustmentSeconds ?? 0;
  const totalPitVisitLossSeconds = round3(
    input.transitLossSeconds
      + input.individualPitStopSeconds
      + queueDelaySeconds
      + entryExitErrorSeconds
      + penaltyDelaySeconds
      + repairDelaySeconds
      + cautionAdjustmentSeconds,
  );
  return {
    pitDataTrackId: input.pitDataTrackId ?? null,
    transitLossSeconds: input.transitLossSeconds,
    individualPitStopSeconds: input.individualPitStopSeconds,
    queueDelaySeconds,
    entryExitErrorSeconds,
    penaltyDelaySeconds,
    repairDelaySeconds,
    cautionAdjustmentSeconds,
    totalPitVisitLossSeconds,
    sourceMethod: input.sourceMethod,
    confidence: input.confidence,
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
