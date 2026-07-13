export function sectorPlaybackIntervalMs(lapTimeSeconds: number, speed: number): number {
  const realLapMs = Math.max(15_000, Math.min(120_000, lapTimeSeconds * 1000));
  return realLapMs / Math.max(1, speed) / 3;
}

export function advanceTrackProgress(
  progress: number,
  speedMetersPerSecond: number,
  elapsedRealMs: number,
  playbackSpeed: number,
  lapLengthMeters: number,
): number {
  if (lapLengthMeters <= 0 || elapsedRealMs <= 0) return normalizeTrackProgress(progress);
  const distance = Math.max(0, speedMetersPerSecond) * elapsedRealMs / 1000 * Math.max(1, playbackSpeed);
  return normalizeTrackProgress(progress + distance / lapLengthMeters);
}

export function blendTrackProgress(from: number, to: number, alpha: number): number {
  const clamped = Math.max(0, Math.min(1, alpha));
  let delta = normalizeTrackProgress(to) - normalizeTrackProgress(from);
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;
  return normalizeTrackProgress(from + delta * clamped);
}

// Reconcile a renderer that has extrapolated slightly ahead of the latest sim
// snapshot without ever moving a car backwards. If the snapshot is behind, the
// marker holds its current correction baseline until the simulation catches up.
export function reconcileTrackProgressForward(displayed: number, authoritative: number, alpha: number): number {
  const from = normalizeTrackProgress(displayed);
  const to = normalizeTrackProgress(authoritative);
  let delta = to - from;
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;
  if (delta <= 0) return from;
  return normalizeTrackProgress(from + delta * Math.max(0, Math.min(1, alpha)));
}

export function normalizeTrackProgress(value: number): number {
  return ((value % 1) + 1) % 1;
}
