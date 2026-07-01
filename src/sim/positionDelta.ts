// Position Delta / Grid Movement helpers.
//
// A driver's position delta compares where they are now to where they started:
//   positionDelta = startingGridPosition - currentPosition
// so a positive number means places GAINED and a negative number means places
// LOST. These pure helpers are shared by the Live Race UI (timing tower, pit
// wall cards) and the post-race recap/news generator so the maths and the
// gained/lost bookkeeping stay consistent everywhere.

export type GridMovement = {
  driverId: string;
  startingGridPosition: number;
  currentPosition: number | null; // null = not classified (retired / no time)
  positionDelta: number | null; // null when not classified
  positionsGained: number;
  positionsLost: number;
};

// Raw delta (grid - position). null when the driver is not classified.
export function positionDeltaValue(grid: number, position: number | null): number | null {
  if (position == null) return null;
  return grid - position;
}

export function gridMovement(
  driverId: string,
  grid: number,
  position: number | null,
): GridMovement {
  const delta = positionDeltaValue(grid, position);
  return {
    driverId,
    startingGridPosition: grid,
    currentPosition: position,
    positionDelta: delta,
    positionsGained: delta != null && delta > 0 ? delta : 0,
    positionsLost: delta != null && delta < 0 ? -delta : 0,
  };
}

// A minimal classification row the movement helpers operate on (RaceResult and
// live cars both satisfy this shape).
export type Classified = {
  driverId: string;
  gridPosition: number;
  position: number | null;
  teamId?: string;
};

export function gridMovements(rows: Classified[]): GridMovement[] {
  return rows.map((r) => gridMovement(r.driverId, r.gridPosition, r.position));
}

// The classified driver who gained the most positions (null if nobody gained).
export function biggestGainer(rows: Classified[]): GridMovement | null {
  return best(rows, (m) => m.positionDelta, 'max', (d) => d > 0);
}

// The classified driver who lost the most positions (null if nobody lost).
export function biggestLoser(rows: Classified[]): GridMovement | null {
  return best(rows, (m) => m.positionDelta, 'min', (d) => d < 0);
}

function best(
  rows: Classified[],
  key: (m: GridMovement) => number | null,
  mode: 'max' | 'min',
  qualifies: (delta: number) => boolean,
): GridMovement | null {
  let winner: GridMovement | null = null;
  let winnerVal: number | null = null;
  for (const m of gridMovements(rows)) {
    const v = key(m);
    if (v == null || !qualifies(v)) continue;
    if (winnerVal == null || (mode === 'max' ? v > winnerVal : v < winnerVal)) {
      winner = m;
      winnerVal = v;
    }
  }
  return winner;
}

// A short natural-language summary of the player team's grid movement, e.g.
// "Coulthard gained 3 places; Webber finished where he started." Suitable for
// the race recap / news generator. Returns '' if the team has no classified
// drivers.
export function playerTeamDeltaSummary(
  rows: Classified[],
  playerTeamId: string,
  driverNames: Record<string, string>,
): string {
  const mine = rows.filter((r) => r.teamId === playerTeamId && r.position != null);
  const parts = mine.map((r) => {
    const name = driverNames[r.driverId] ?? r.driverId;
    return `${name} ${deltaPhrase(r.gridPosition - (r.position as number))}`;
  });
  return parts.join('; ');
}

// "gained N place(s)" / "lost N place(s)" / "finished where he started".
export function deltaPhrase(delta: number): string {
  if (delta > 0) return `gained ${delta} place${delta === 1 ? '' : 's'}`;
  if (delta < 0) return `lost ${-delta} place${-delta === 1 ? '' : 's'}`;
  return 'finished where he started';
}
