import { RaceMapSeriesMarker } from './RaceMapSeriesMarker';
import { normalizeSeries } from './seriesMarker';

// Simplified 2D race view: coloured dots running around an oval circuit. Real
// track geometry is not modelled — dots are spaced by running order and rotate
// each lap so the field visibly moves. Cars in the pits sit in a pit-lane strip.

export type TrackDot = {
  driverId: string;
  label: string; // car number / short label
  color: string;
  accentColor?: string; // secondary team color for the marker wings/tabs
  series?: string; // series shape for the marker; falls back to the track-map default
  isPlayer: boolean;
  running: boolean;
  retired?: boolean; // DNF — should be shown in the retired box instead of the track
  inPit: boolean;
  pitRequested?: boolean;
  rank: number; // 1 = leader
  trackProgress?: number; // 0..1, approximate lap position derived from live timing gaps
  gapToLeader?: number;
  interval?: number;
};

const W = 460;
const H = 280;
const CX = W / 2;
const CY = H / 2;
const RX = 180;
const RY = 95;

function pointOnOval(t: number): { x: number; y: number } {
  const angle = t * Math.PI * 2 - Math.PI / 2; // start at the top
  return { x: CX + RX * Math.cos(angle), y: CY + RY * Math.sin(angle) };
}

export function RaceTrack2D({
  dots,
  rotation,
  safetyCar = false,
  className = 'w-full',
}: {
  dots: TrackDot[];
  rotation: number;
  safetyCar?: boolean;
  className?: string;
}) {
  const running = dots.filter((d) => d.running && !d.inPit && !d.pitRequested).sort((a, b) => a.rank - b.rank);
  const pitting = dots.filter((d) => d.running && (d.inPit || d.pitRequested));
  const retired = dots.filter((d) => d.retired);
  const spacing = 1 / Math.max(running.length, 14);
  const safetyCarT = normalizeProgress(rotation + 0.04);
  const safetyCarP = pointOnOval(safetyCarT);

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

      {/* Retired box */}
      {retired.length > 0 && (
        <>
          <rect x={CX + 115} y={CY + RY + 18} width={115} height={26} rx={6} fill="#18181b" stroke="#27272a" />
          <text x={CX + 125} y={CY + RY + 35} fontSize={10} fill="#71717a">RETIRED</text>
        </>
      )}

      {/* Safety car */}
      {safetyCar && (
        <g transform={`translate(${safetyCarP.x} ${safetyCarP.y})`}>
          <RaceMapSeriesMarker
            x={0}
            y={0}
            series="f1"
            number=""
            primaryColor="#facc15"
            accentColor="#facc15"
            isPlayer={false}
            selected={false}
            rotationDeg={0}
          />
        </g>
      )}

      {/* Running cars on the oval */}
      {running.map((d, i) => {
        const t = d.trackProgress ?? (rotation + i * spacing) % 1;
        const p = pointOnOval(t);
        return <Dot key={d.driverId} x={p.x} y={p.y} dot={d} />;
      })}

      {/* Pitting cars */}
      {pitting.map((d, i) => (
        <Dot key={d.driverId} x={CX - 90 + i * 26} y={CY + RY + 31} dot={d} />
      ))}

      {/* Retired cars */}
      {retired.map((d, i) => (
        <Dot key={d.driverId} x={CX + 130 + i * 26} y={CY + RY + 31} dot={d} />
      ))}
    </svg>
  );
}

function normalizeProgress(n: number): number {
  return ((n % 1) + 1) % 1;
}

function Dot({ x, y, dot }: { x: number; y: number; dot: TrackDot }) {
  return (
    <RaceMapSeriesMarker
      x={x}
      y={y}
      series={normalizeSeries(dot.series)}
      number={dot.label}
      primaryColor={dot.color}
      accentColor={dot.accentColor}
      isPlayer={true}
      selected={dot.isPlayer}
      rotationDeg={0}
    />
  );
}
