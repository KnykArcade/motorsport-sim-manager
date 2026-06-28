import type { Track } from '../types/gameTypes';
import { StatBar } from './StatBar';

// Shows a track's primary demand profile as bars.
export function TrackDemandBars({ track }: { track: Track }) {
  const p = track.setupProfile;
  return (
    <div className="space-y-1.5">
      <StatBar label="Aero" value={p.aeroDemand} />
      <StatBar label="Power" value={p.powerDemand} />
      <StatBar label="Mechanical" value={p.mechanicalDemand} />
      <StatBar label="Risk" value={p.riskDemand} />
    </div>
  );
}
