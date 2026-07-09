// Simplified 2D race view: coloured markers running around an oval circuit. Real
// track geometry is not modelled — markers are spaced by running order and
// rotate each lap so the field visibly moves. Cars in the pits sit in a pit-lane strip.

import {
  TrackMapMarker,
  headingOnOval,
  normalizeProgress,
  ovalPointAt,
  resolveTrackMapMarkerVariant,
} from './TrackMapMarker';

export type TrackDot = {
  driverId: string;
  label: string; // car number / short label
  color: string;
  isPlayer: boolean;
  running: boolean;
  inPit: boolean;
  pitRequested?: boolean;
  rank: number; // 1 = leader
  trackProgress?: number; // 0..1, approximate lap position derived from live timing gaps
  gapToLeader?: number;
  interval?: number;
  damaged?: boolean;
  fastestLap?: boolean;
};

const W = 460;
const H = 280;
const CX = W / 2;
const CY = H / 2;
const RX = 180;
const RY = 95;

export function RaceTrack2D({
  dots,
  rotation,
  series,
  year,
  className = 'w-full',
}: {
  dots: TrackDot[];
  rotation: number;
  series?: string;
  year?: number;
  className?: string;
}) {
  const running = dots.filter((d) => d.running && !d.inPit && !d.pitRequested).sort((a, b) => a.rank - b.rank);
  const pitting = dots.filter((d) => d.running && (d.inPit || d.pitRequested));
  const spacing = 1 / Math.max(running.length, 14);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Live track map">
      {/* Track ribbon */}
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="#27272a" strokeWidth={22} />
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="#3f3f46" strokeWidth={2} strokeDasharray="6 8" />

      {/* Start/finish line */}
      <line x1={CX} y1={CY - RY - 12} x2={CX} y2={CY - RY + 12} stroke="#e5e5e5" strokeWidth={3} />

      {/* Pit lane strip */}
      <rect x={CX - 110} y={CY + RY + 18} width={220} height={26} rx={6} fill="#18181b" stroke="#27272a" />
      <text x={CX - 100} y={CY + RY + 35} fontSize={10} fill="#71717a">PIT</text>

      {/* Running cars on the oval */}
      {running.map((d, i) => {
        const t = d.trackProgress ?? normalizeProgress(rotation + i * spacing);
        const p = ovalPointAt(t, CX, CY, RX, RY);
        return (
          <TrackMapMarker
            key={d.driverId}
            x={p.x}
            y={p.y}
            headingDeg={headingOnOval(t)}
            teamColor={d.color}
            number={d.label || null}
            rank={d.rank}
            gapToLeader={d.gapToLeader}
            variant={resolveTrackMapMarkerVariant(series, year)}
            status={{
              leader: d.rank === 1,
              player: d.isPlayer,
              inPit: d.inPit || d.pitRequested,
              damaged: d.damaged,
              fastestLap: d.fastestLap,
            }}
          />
        );
      })}

      {/* Pitting cars */}
      {pitting.map((d, i) => (
        <TrackMapMarker
          key={d.driverId}
          x={CX - 90 + i * 26}
          y={CY + RY + 31}
          headingDeg={0}
          teamColor={d.color}
          number={d.label || null}
          rank={d.rank}
          gapToLeader={d.gapToLeader}
          variant={resolveTrackMapMarkerVariant(series, year)}
          compact
          status={{
            leader: d.rank === 1,
            player: d.isPlayer,
            inPit: true,
            damaged: d.damaged,
            fastestLap: d.fastestLap,
          }}
        />
      ))}
    </svg>
  );
}
