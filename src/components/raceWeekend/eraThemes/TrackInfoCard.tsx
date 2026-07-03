import type { Race, RegulationSet, Track } from '../../../types/gameTypes';
import { circuitLengthKm, drsDisplay, raceDistanceKm } from './raceWeekendHubData';

type Props = {
  race: Race;
  track: Track;
  regulation?: RegulationSet;
  onOpenTrackData: () => void;
};

export function TrackInfoCard({ race, track, regulation, onOpenTrackData }: Props) {
  return (
    <section className="f1-1990s-panel" aria-label="Track information">
      <header className="f1-1990s-panel-title">Track Info</header>
      <div className="grid grid-cols-[72px_1fr] gap-3">
        <div className="f1-1990s-track-outline" aria-hidden="true" />
        <div className="space-y-1 text-xs text-neutral-300">
          <div className="text-sm font-semibold uppercase text-neutral-100">{track.name}</div>
          <InfoRow label="Circuit length" value={circuitLengthKm(race)} />
          <InfoRow label="Corners" value={`${track.attributes.corners.toFixed(0)}/10 demand`} />
          <InfoRow label="Distance" value={raceDistanceKm(race)} />
          <InfoRow label="DRS" value={drsDisplay(regulation)} />
        </div>
      </div>
      <div className="mt-3 border-t border-neutral-700/60 pt-3 text-xs text-neutral-400">
        <InfoRow label="Format" value={regulation?.qualifyingFormat ?? 'Unknown'} />
        <InfoRow label="Record" value="No lap record logged" />
      </div>
      <button type="button" className="f1-1990s-secondary-button mt-3 w-full" onClick={onOpenTrackData}>
        View Track Data
      </button>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right text-neutral-200">{value}</span>
    </div>
  );
}
