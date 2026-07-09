import { useEffect } from 'react';
import { TrackMapAssetPanel } from '../../components/TrackMapAssetPanel';
import type { TrackDot } from '../../components/RaceTrack2D';
import type { LiveRaceState, SafetyCarState } from '../../types/liveTypes';

type Props = {
  dots: TrackDot[];
  lastIncident: NonNullable<LiveRaceState['lastIncident']>;
  safetyCar: SafetyCarState;
  series?: string;
  year?: number;
  trackId?: string;
  trackName?: string;
  nameOf: (driverId: string) => string;
  onDismiss: () => void;
};

const ZOOM = 2.2;
const NO_SC_DISMISS_MS = 5000;

export function CrashZoomOverlay({
  dots,
  lastIncident,
  safetyCar,
  series,
  year,
  trackId,
  trackName,
  nameOf,
  onDismiss,
}: Props) {
  // On the final safety-car lap, show the incident area with the crashed cars
  // removed — like watching the clean-up in real time.
  const cleaned =
    lastIncident.safetyCarDeployed && safetyCar.active && safetyCar.lapsRemaining === 1;

  useEffect(() => {
    if (lastIncident.safetyCarDeployed) {
      // Hold the popup until the safety car is cleared.
      if (!safetyCar.active) {
        onDismiss();
      }
      return;
    }

    // No safety car for this incident: auto-dismiss after a short beat.
    const id = window.setTimeout(() => onDismiss(), NO_SC_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [lastIncident, safetyCar.active, onDismiss]);

  const visibleIds = cleaned ? [] : lastIncident.driverIds;
  const driverNames = cleaned ? '' : lastIncident.driverIds.map(nameOf).join(', ');

  const status = cleaned
    ? 'Incident cleared — safety car in this lap'
    : safetyCar.active
      ? 'Safety car deployed'
      : 'Incident';

  return (
    <div className="absolute bottom-2 left-2 z-20 w-64 rounded-lg border border-amber-500/50 bg-[#0b0d0f] p-2 shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">{status}</div>
          <div className="truncate text-xs font-semibold text-slate-100">
            Lap {lastIncident.lap} — {driverNames}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 rounded bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-300 hover:bg-amber-500/20"
        >
          Close
        </button>
      </div>

      <div className="mt-1 aspect-[2/1] w-full overflow-hidden rounded-md border border-slate-700/50 bg-[#050606]">
        <TrackMapAssetPanel
          series={series}
          year={year}
          trackId={trackId}
          trackName={trackName}
          dots={dots}
          rotation={0}
          eraTheme="f1-1990s"
          zoom={ZOOM}
          focusDriverIds={visibleIds}
          focusTrackProgress={lastIncident.trackProgress}
          incidentDriverIds={visibleIds}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
