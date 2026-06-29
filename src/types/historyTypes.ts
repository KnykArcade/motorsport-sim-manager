// Race history archive (Phase D). A compact, persisted record of each completed
// race plus a deterministic lap-time archive (a representative best lap per
// classified driver and the overall fastest lap).

export type DriverLap = {
  driverId: string;
  driverName: string;
  teamName: string;
  bestLapSec: number;
};

export type RaceArchiveEntry = {
  raceId: string;
  season: number;
  round: number;
  gpName: string;
  trackName: string;
  poleDriverId?: string;
  winnerDriverId?: string;
  podium: string[]; // top-3 driverIds
  fastestLap?: { driverId: string; timeSec: number };
  laps: DriverLap[]; // classified drivers, sorted fastest-first
};
