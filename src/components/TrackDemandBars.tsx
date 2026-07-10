import type { Track } from '../types/gameTypes';
import { StatBar } from './StatBar';

// Shows a track's primary demand profile as bars.
export function TrackDemandBars({ track }: { track: Track }) {
  const p = track.setupProfile;
  // setupProfile values are mixed between 1-10 (legacy data) and 1-100 (current runtime).
  // Use a 0-10 scale when the value is in the legacy range; otherwise 0-100.
  const max = (v: number) => (v > 10 ? 100 : 10);
  return (
    <div className="space-y-1.5">
      <StatBar label="Aero" value={p.aeroDemand} max={max(p.aeroDemand)} />
      <StatBar label="Power" value={p.powerDemand} max={max(p.powerDemand)} />
      <StatBar label="Mechanical" value={p.mechanicalDemand} max={max(p.mechanicalDemand)} />
      <StatBar label="Risk" value={p.riskDemand} max={max(p.riskDemand)} />
    </div>
  );
}
