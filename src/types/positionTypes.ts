export type TrackLane = 'RacingLine' | 'Inside' | 'Outside' | 'PitLane' | 'Apron';
export type TrafficPhase =
  | 'ClearAir'
  | 'Following'
  | 'InDirtyAir'
  | 'Drafting'
  | 'Attacking'
  | 'Defending'
  | 'SideBySide'
  | 'BeingLapped'
  | 'Recovering'
  | 'UnderLocalYellow'
  | 'UnderFullCourseCaution'
  | 'Retired';

export type TimingCrossingState = {
  lastSectorCrossed: 1 | 2 | 3 | null;
  lastSectorCrossingTime: number | null;
  lastFinishLineCrossingTime: number | null;
  currentLapStartTime: number;
  currentSectorStartTime: number;
};

export type CarPositionState = {
  completedLaps: number;
  currentSegmentIndex: number;
  progressWithinSegment: number;
  totalRaceDistanceMeters: number;
  normalizedLapProgress: number;
  authoritativeRaceTime: number;
  currentSpeedMetersPerSecond: number;
  lane: TrackLane;
  trafficPhase: TrafficPhase;
  distanceToCarAheadMeters: number | null;
  distanceToCarBehindMeters: number | null;
  timing: TimingCrossingState;
};
