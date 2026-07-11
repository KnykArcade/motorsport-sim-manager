export type LiveRaceControlMode =
  | 'Green'
  | 'LocalYellow'
  | 'FullCourseYellow'
  | 'Caution'
  | 'VirtualSafetyCar'
  | 'SafetyCar'
  | 'PaceCar'
  | 'RedFlag'
  | 'RestartFormation'
  | 'GreenFlagRestart'
  | 'Finished';

export type LiveRaceControlState = {
  mode: LiveRaceControlMode;
  previousMode: LiveRaceControlMode | null;
  deployedOnLap: number | null;
  reason: string | null;
  restartProcedure: 'Standing' | 'RollingSingleFile' | 'RollingDoubleFile' | 'SeriesDefault';
  deployments: number;
  queueFormed: boolean;
  pitLaneOpen: boolean;
  pitLaneClosedOnLap: number | null;
  freePassApplied: boolean;
  freePassDriverId: string | null;
};
