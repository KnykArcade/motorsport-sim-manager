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
  // Latest crossing at each timing line. Kept separately so a trailing car can
  // be compared with the same line/lap after the car ahead reaches another line.
  lineCrossings?: Partial<Record<'Sector1' | 'Sector2' | 'Finish', { lap: number; time: number }>>;
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
