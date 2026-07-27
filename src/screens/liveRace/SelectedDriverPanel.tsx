import type { LiveCarState } from '../../types/liveTypes';
import { formatLiveTimingDelta } from '../../sim/liveTimingGapEngine';
import { fmtLap, tyreLetter } from './dashboardFormat';

export function SelectedDriverPanel({
  car,
  name,
  team,
  color,
}: {
  car?: LiveCarState;
  name: string;
  team: string;
  color: string;
}) {
  if (!car) {
    return <div className="ui-selected-driver-panel is-empty">No driver selected.</div>;
  }
  const tyre = tyreLetter(car.tire.compound);
  const condition = !car.running && car.status !== 'Finished'
    ? car.lastIncident ?? 'Retired'
    : car.reliabilityIssue?.label ?? car.statusMessage ?? 'Running';
  return (
    <section className="ui-selected-driver-panel" aria-label="Selected driver">
      <div className="ui-selected-driver-identity">
        <span style={{ backgroundColor: color }} />
        <div>
          <small>Selected driver</small>
          <strong>{name}</strong>
          <em>{team}</em>
        </div>
        <b>P{car.position ?? '—'}</b>
      </div>
      <div className="ui-selected-driver-metrics">
        <span><small>Gap</small><strong>{car.position === 1 ? 'Leader' : formatLiveTimingDelta(car.gapToLeader, car.lapsBehindLeader)}</strong></span>
        <span><small>Last lap</small><strong>{car.lastLapTime > 0 ? fmtLap(car.lastLapTime) : '—'}</strong></span>
        <span><small>Tyre</small><strong>{tyre.letter} · {Math.max(0, 100 - Math.round(car.tire.wear))}%</strong></span>
        <span><small>Pit</small><strong>{car.pit.pitRequested ? 'Called' : `${car.pit.stopsMade} stops`}</strong></span>
        <span><small>Mode</small><strong>{car.paceMode}</strong></span>
        <span><small>Condition</small><strong>{condition}</strong></span>
      </div>
    </section>
  );
}
