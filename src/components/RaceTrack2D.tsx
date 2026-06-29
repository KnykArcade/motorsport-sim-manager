// Simplified 2D race view: coloured dots running around an oval circuit. Real
// track geometry is not modelled — dots are spaced by running order and rotate
// each lap so the field visibly moves. Cars in the pits sit in a pit-lane strip.

export type TrackDot = {
  driverId: string;
  label: string; // car number / short label
  color: string;
  isPlayer: boolean;
  running: boolean;
  inPit: boolean;
  rank: number; // 1 = leader
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

export function RaceTrack2D({ dots, rotation }: { dots: TrackDot[]; rotation: number }) {
  const running = dots.filter((d) => d.running && !d.inPit).sort((a, b) => a.rank - b.rank);
  const pitting = dots.filter((d) => d.running && d.inPit);
  const spacing = 1 / Math.max(running.length, 14);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Live track map">
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
        const t = (rotation + i * spacing) % 1;
        const p = pointOnOval(t);
        return <Dot key={d.driverId} x={p.x} y={p.y} dot={d} />;
      })}

      {/* Pitting cars */}
      {pitting.map((d, i) => (
        <Dot key={d.driverId} x={CX - 90 + i * 26} y={CY + RY + 31} dot={d} />
      ))}
    </svg>
  );
}

function Dot({ x, y, dot }: { x: number; y: number; dot: TrackDot }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={dot.isPlayer ? 9 : 7}
        fill={dot.color}
        stroke={dot.isPlayer ? '#fafafa' : '#0a0a0a'}
        strokeWidth={dot.isPlayer ? 2.5 : 1}
      />
      <text x={x} y={y + 3} fontSize={8} textAnchor="middle" fill="#0a0a0a" fontWeight={700}>
        {dot.label}
      </text>
    </g>
  );
}
