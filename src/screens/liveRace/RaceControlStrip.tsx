import type { LiveRaceState } from '../../types/liveTypes';
import { raceControlPresentation } from '../entryRacePresentationViewModel';

export function RaceControlStrip({
  live,
  compact = false,
}: {
  live: LiveRaceState;
  compact?: boolean;
}) {
  const status = raceControlPresentation(live);
  const retirements = live.cars.filter((car) => !car.running && car.status === 'DNF').length;
  return (
    <div className={`ui-race-control-strip is-${status.tone} ${compact ? 'is-compact' : ''}`} data-testid="race-control-strip">
      <div className="ui-race-control-flag">
        <span>{status.label}</span>
        <small>{status.detail}</small>
      </div>
      <div className="ui-race-control-metrics">
        <span><small>Pit lane</small><strong>{status.pitLane}</strong></span>
        <span><small>Grip</small><strong>{Math.round(live.weather.gripLevel * 100)}%</strong></span>
        <span><small>Weather</small><strong>{live.weather.label}</strong></span>
        <span><small>Retired</small><strong>{retirements}</strong></span>
      </div>
    </div>
  );
}
