// Morale & confidence updates after a race weekend.

import type { QualifyingResult, RaceResult } from '../types/gameTypes';

export type MoraleUpdate = {
  driverConfidence: Record<string, number>; // new absolute values 0-100
  driverMorale: Record<string, number>;
  teamMorale: Record<string, number>;
  notes: string[];
};

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function updateMorale(
  qualifying: QualifyingResult[],
  race: RaceResult[],
  prevDriverConfidence: Record<string, number>,
  prevDriverMorale: Record<string, number>,
  prevTeamMorale: Record<string, number>,
  driverTeam: Record<string, string>,
): MoraleUpdate {
  const driverConfidence: Record<string, number> = { ...prevDriverConfidence };
  const driverMorale: Record<string, number> = { ...prevDriverMorale };
  const teamMorale: Record<string, number> = { ...prevTeamMorale };
  const notes: string[] = [];

  // Qualifying confidence effects.
  for (const q of qualifying) {
    let delta = 0;
    if (q.position <= 3) delta += 6;
    else if (q.position <= 10) delta += 1;
    else delta -= 3;
    if (q.incident?.type === 'Crash') delta -= 8;
    driverConfidence[q.driverId] = clamp((driverConfidence[q.driverId] ?? 65) + delta);
  }

  // Race results morale/confidence effects.
  const teamDelta: Record<string, number> = {};
  for (const r of race) {
    let cDelta = 0;
    let mDelta = 0;
    if (r.position === 1) {
      cDelta += 12;
      mDelta += 10;
    } else if (r.position !== null && r.position <= 3) {
      cDelta += 8;
      mDelta += 6;
    } else if (r.points > 0) {
      cDelta += 3;
      mDelta += 3;
    } else if (r.status === 'DNF') {
      cDelta -= 6;
      mDelta -= 4;
    } else {
      cDelta -= 1;
    }
    driverConfidence[r.driverId] = clamp((driverConfidence[r.driverId] ?? 65) + cDelta);
    driverMorale[r.driverId] = clamp((driverMorale[r.driverId] ?? 65) + mDelta);

    const team = driverTeam[r.driverId] ?? r.teamId;
    teamDelta[team] = (teamDelta[team] ?? 0) + mDelta * 0.5;
  }

  for (const [team, delta] of Object.entries(teamDelta)) {
    teamMorale[team] = clamp((teamMorale[team] ?? 65) + delta);
  }

  return { driverConfidence, driverMorale, teamMorale, notes };
}
