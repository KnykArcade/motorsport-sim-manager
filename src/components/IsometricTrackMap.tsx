import { useMemo } from 'react';
import type { TrackMapGeometry, TrackMapPoint } from '../data/trackMaps/trackMapGeometry';
import type { TrackDot } from './RaceTrack2D';

const VIEW_W = 1000;
const VIEW_H = 500;
const PADDING = 50;
const TRACK_WIDTH = 30;
const BASE_DEPTH = 6;

function normalizeProgress(n: number): number {
  return ((n % 1) + 1) % 1;
}

function projectPoints(points: readonly TrackMapPoint[]): TrackMapPoint[] {
  const raw = points.map(([x, y]) => [x - y, x + y] as TrackMapPoint);
  const minX = Math.min(...raw.map((p) => p[0]));
  const maxX = Math.max(...raw.map((p) => p[0]));
  const minY = Math.min(...raw.map((p) => p[1]));
  const maxY = Math.max(...raw.map((p) => p[1]));

  const width = Math.max(0.001, maxX - minX);
  const height = Math.max(0.001, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const availableW = VIEW_W - PADDING * 2;
  const availableH = VIEW_H - PADDING * 2;
  const scaleX = Math.min(availableW / width, (availableH * 2) / height) * 0.98;
  const scaleY = scaleX / 2;

  const screenCenterX = VIEW_W / 2;
  const screenCenterY = VIEW_H / 2;

  return raw.map(([x, y]) => [
    screenCenterX + (x - centerX) * scaleX,
    screenCenterY + (y - centerY) * scaleY,
  ]);
}

function toPath(points: readonly TrackMapPoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} ${rest
    .map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ')} Z`;
}

function shiftPath(points: readonly TrackMapPoint[], dx: number, dy: number): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${(first[0] + dx).toFixed(2)} ${(first[1] + dy).toFixed(2)} ${rest
    .map(([x, y]) => `L ${(x + dx).toFixed(2)} ${(y + dy).toFixed(2)}`)
    .join(' ')} Z`;
}

function pointAt(points: readonly TrackMapPoint[], t: number): TrackMapPoint {
  if (points.length === 0) return [VIEW_W / 2, VIEW_H / 2];
  const progress = normalizeProgress(t);
  const index = Math.min(points.length - 1, Math.floor(progress * points.length));
  return points[index];
}

function headingAt(points: readonly TrackMapPoint[], t: number): number {
  if (points.length < 2) return 0;
  const progress = normalizeProgress(t);
  const index = Math.min(points.length - 1, Math.floor(progress * points.length));
  const next = (index + 1) % points.length;
  const [x1, y1] = points[index];
  const [x2, y2] = points[next];
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
}

function startFinishLine(points: readonly TrackMapPoint[]) {
  if (points.length < 2) return null;
  const p = points[0];
  const next = points[1];
  const heading = Math.atan2(next[1] - p[1], next[0] - p[0]) + Math.PI / 2;
  const nx = Math.cos(heading);
  const ny = Math.sin(heading);
  const halfWidth = TRACK_WIDTH / 2 + 2;
  return (
    <line
      x1={p[0] - nx * halfWidth}
      y1={p[1] - ny * halfWidth}
      x2={p[0] + nx * halfWidth}
      y2={p[1] + ny * halfWidth}
      stroke="#f2f2f2"
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
}

type CarProps = {
  point: TrackMapPoint;
  heading: number;
  dot: TrackDot;
};

function Car({ point, heading, dot }: CarProps) {
  const length = 18;
  const width = 10;
  const accent = dot.accentColor ?? '#ffffff';
  return (
    <g
      transform={`translate(${point[0].toFixed(2)} ${point[1].toFixed(2)}) rotate(${heading.toFixed(2)})`}
      data-isometric-car={dot.driverId}
    >
      <rect
        x={(-length / 2).toFixed(2)}
        y={(-width / 2).toFixed(2)}
        width={length}
        height={width}
        rx={2}
        fill={dot.color}
        stroke={accent}
        strokeWidth={1}
      />
      {dot.label && (
        <text
          x={0}
          y={1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={7}
          fontWeight="bold"
          fill="#ffffff"
          paintOrder="stroke"
          stroke="#000000"
          strokeWidth={0.5}
        >
          {dot.label}
        </text>
      )}
    </g>
  );
}

function SideCar({
  x,
  y,
  dot,
  index,
  label,
}: {
  x: number;
  y: number;
  dot: TrackDot;
  index: number;
  label: string;
}) {
  return (
    <g
      transform={`translate(${x + index * 24} ${y})`}
      data-isometric-side-car={dot.driverId}
    >
      <rect x={-9} y={-6} width={18} height={12} rx={2} fill={dot.color} stroke={dot.accentColor ?? '#ffffff'} strokeWidth={1} />
      <text x={0} y={1} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight="bold" fill="#ffffff" paintOrder="stroke" stroke="#000000" strokeWidth={0.5}>
        {dot.label}
      </text>
      <text x={0} y={-10} textAnchor="middle" fontSize={8} fill="#a1a1aa">
        {label}
      </text>
    </g>
  );
}

type Props = {
  geometry: TrackMapGeometry;
  dots: TrackDot[];
  rotation?: number;
  className?: string;
};

export function IsometricTrackMap({ geometry, dots, rotation = 0, className = '' }: Props) {
  const projected = useMemo(() => projectPoints(geometry.points), [geometry.points]);

  const { running, pitting, retired } = useMemo(() => {
    const running = dots.filter((d) => d.running && !d.inPit && !d.pitRequested && !d.retired);
    const pitting = dots.filter((d) => d.running && (d.inPit || d.pitRequested));
    const retired = dots.filter((d) => d.retired);
    return { running, pitting, retired };
  }, [dots]);

  const spacing = running.length > 0 ? 1 / Math.max(running.length, 14) : 0.07;

  const pathD = useMemo(() => toPath(projected), [projected]);
  const basePathD = useMemo(() => shiftPath(projected, BASE_DEPTH, BASE_DEPTH), [projected]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={className}
      role="img"
      aria-label={`Isometric track map for ${geometry.name}`}
      data-isometric-track-map={geometry.id}
    >
      {/* Field */}
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#142814" />

      {/* Outfield shadow */}
      <path d={basePathD} fill="none" stroke="#0d1a0d" strokeWidth={TRACK_WIDTH + 16} strokeLinecap="round" strokeLinejoin="round" />

      {/* Track base (depth) */}
      <path d={basePathD} fill="none" stroke="#1a1a1a" strokeWidth={TRACK_WIDTH} strokeLinecap="round" strokeLinejoin="round" />

      {/* Track surface */}
      <path d={pathD} fill="none" stroke="#303030" strokeWidth={TRACK_WIDTH - 2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Centre dashed line */}
      <path d={pathD} fill="none" stroke="#4a4a4a" strokeWidth={1.5} strokeDasharray="14 20" strokeLinecap="round" />

      {/* Start/finish line */}
      {startFinishLine(projected)}

      {/* Running cars on track */}
      {running.map((dot) => {
        const progress = dot.trackProgress ?? normalizeProgress(rotation + (dot.rank - 1) * spacing);
        const point = pointAt(projected, progress);
        const heading = headingAt(projected, progress);
        return <Car key={dot.driverId} point={point} heading={heading} dot={dot} />;
      })}

      {/* Pit lane strip */}
      {pitting.length > 0 && (
        <g>
          <rect x={PADDING} y={VIEW_H - PADDING - 24} width={220} height={24} rx={6} fill="#0f1210" stroke="#27272a" />
          <text x={PADDING + 10} y={VIEW_H - PADDING - 10} fontSize={10} fill="#71717a">
            PIT
          </text>
          {pitting.map((dot, i) => (
            <SideCar key={dot.driverId} x={PADDING + 40} y={VIEW_H - PADDING - 12} dot={dot} index={i} label="PIT" />
          ))}
        </g>
      )}

      {/* Retired box */}
      {retired.length > 0 && (
        <g>
          <rect x={VIEW_W - PADDING - 220} y={VIEW_H - PADDING - 24} width={220} height={24} rx={6} fill="#0f1210" stroke="#27272a" />
          <text x={VIEW_W - PADDING - 210} y={VIEW_H - PADDING - 10} fontSize={10} fill="#71717a">
            RETIRED
          </text>
          {retired.map((dot, i) => (
            <SideCar key={dot.driverId} x={VIEW_W - PADDING - 190} y={VIEW_H - PADDING - 12} dot={dot} index={i} label="RET" />
          ))}
        </g>
      )}

      {/* Footer label */}
      <text
        x={VIEW_W / 2}
        y={VIEW_H - 10}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="#71717a"
      >
        {geometry.name.toUpperCase()} {geometry.year} — ISOMETRIC PROTOTYPE
      </text>
    </svg>
  );
}
