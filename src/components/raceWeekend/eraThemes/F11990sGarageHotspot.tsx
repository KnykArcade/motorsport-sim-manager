import { activateGarageHotspot } from './raceWeekendHubData';
import type { GarageHotspot, RaceWeekendHubCallbacks } from './types';

type Props = {
  hotspot: GarageHotspot;
  callbacks: RaceWeekendHubCallbacks;
};

export function F11990sGarageHotspot({ hotspot, callbacks }: Props) {
  const locked = !!hotspot.lockedReason;
  const label = `${hotspot.label}: ${hotspot.description}${locked ? `. Locked. ${hotspot.lockedReason}` : ''}`;

  return (
    <button
      type="button"
      className={`f1-1990s-hotspot ${locked ? 'f1-1990s-hotspot-locked' : ''}`}
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
      aria-label={label}
      aria-disabled={locked}
      title={locked ? hotspot.lockedReason : hotspot.description}
      onClick={() => activateGarageHotspot(hotspot, callbacks)}
    >
      <span className="f1-1990s-hotspot-marker" aria-hidden="true" />
      <span className="f1-1990s-hotspot-label">
        <span className="text-[11px] font-bold uppercase text-amber-200">{hotspot.label}</span>
        <span className="mt-0.5 block text-[11px] leading-tight text-neutral-200">
          {locked ? hotspot.lockedReason : hotspot.description}
        </span>
      </span>
    </button>
  );
}
