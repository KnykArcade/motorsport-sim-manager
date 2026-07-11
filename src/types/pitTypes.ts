import type { NormalizedPitSeries } from './seriesTypes';

export type PitConfidence = 'High' | 'Medium' | 'Low';
export type RuntimePitConfidence = PitConfidence | 'Fallback' | 'Unknown';

export type PitTransitRecord = {
  pitDataTrackId: string;
  trackName: string;
  series: NormalizedPitSeries;
  startYear: number | null;
  endYear: number | null;
  pitLaneLengthMeters: number | null;
  pitSpeedLimitOverride: number | null;
  transitLossSeconds: number;
  configNotes: string;
  source: string;
  pitLossMethod: string;
  confidence: PitConfidence;
  uncertaintyPlusMinusSeconds: number | null;
  stationaryServiceIncluded: false;
};

export type PitRulesBySeriesEraRecord = {
  series: Exclude<NormalizedPitSeries, 'ALL'>;
  startYear: number;
  endYear: number | null;
  refuelingAllowed: boolean | null;
  typicalTyresChanged: string | null;
  crewOverWall: number | null;
  stationaryCalibrationLowSeconds: number | null;
  stationaryCalibrationHighSeconds: number | null;
  pitSpeedLimitFallback: number | null;
  notes: string[];
};

export type PitTrackMapping = {
  gameTrackId: string;
  pitDataTrackId: string;
  series: NormalizedPitSeries;
  startYear?: number;
  endYear?: number;
  configuration?: string;
  notes?: string;
};

export type PitJourneyPhase =
  | 'None'
  | 'Requested'
  | 'Committed'
  | 'PitEntry'
  | 'Decelerating'
  | 'PitTransitToBox'
  | 'QueuedBehindTeammate'
  | 'StationaryService'
  | 'Released'
  | 'PitTransitFromBox'
  | 'PitExit'
  | 'Rejoined';

export type PitVisitBreakdown = {
  pitDataTrackId: string | null;
  transitLossSeconds: number;
  individualPitStopSeconds: number;
  queueDelaySeconds: number;
  entryExitErrorSeconds: number;
  penaltyDelaySeconds: number;
  repairDelaySeconds: number;
  cautionAdjustmentSeconds: number;
  totalPitVisitLossSeconds: number;
  sourceMethod: string;
  confidence: RuntimePitConfidence;
};

export type PitTransitAllocation = {
  entrySeconds: number;
  toBoxSeconds: number;
  fromBoxSeconds: number;
  exitSeconds: number;
};
