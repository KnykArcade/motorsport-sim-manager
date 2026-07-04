import { RaceTrack2D, type TrackDot } from './RaceTrack2D';
import { getTrackMapAsset } from '../data/trackMaps/getTrackMapAsset';
import type { TrackMapGeometry, TrackMapPoint } from '../data/trackMaps/trackMapGeometry';

type Props = {
  series?: string;
  year?: number;
  trackId?: string;
  trackName?: string;
  dots: TrackDot[];
  rotation: number;
  eraTheme?: 'f1-1990s' | 'default';
  className?: string;
};

const W = 1000;
const H = 500;
const PAD = 54;
const BOTTOM_BAND = 36;

export function TrackMapAssetPanel({
  series,
  year,
  trackId,
  trackName,
  dots,
  rotation,
  eraTheme = 'default',
  className = 'w-full',
}: Props) {
  const match = getTrackMapAsset({ series, year, trackId, trackName });

  if (!match) {
    return (
      <div data-testid="track-map-asset-fallback" className={className}>
        <RaceTrack2D dots={dots} rotation={rotation} className="h-full w-full" />
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`Live track map for ${trackName ?? match.geometry.name}`}
      data-testid="track-map-asset-panel"
      data-track-map-match={match.matchType}
      preserveAspectRatio="none"
    >
      <AssetTrackMap geometry={match.geometry} dots={dots} rotation={rotation} eraTheme={eraTheme} />
    </svg>
  );
}

function AssetTrackMap({
  geometry,
  dots,
  rotation,
  eraTheme,
}: {
  geometry: TrackMapGeometry;
  dots: TrackDot[];
  rotation: number;
  eraTheme: 'f1-1990s' | 'default';
}) {
  const fitted = fitPoints(geometry);
  const pathD = toPath(fitted);
  const running = dots.filter((dot) => dot.running && !dot.inPit).sort((a, b) => a.rank - b.rank);
  const pitting = dots.filter((dot) => dot.running && dot.inPit);
  const spacing = 1 / Math.max(running.length, 14);
  const markerStyle = eraTheme === 'f1-1990s' ? retroMarkerStyle : defaultMarkerStyle;

  return (
    <>
      <defs>
        <filter id={`track-map-glow-${geometry.id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="0" y="0" width={W} height={H} rx="12" fill={eraTheme === 'f1-1990s' ? '#050606' : '#0f172a'} />
      <path d={pathD} fill="none" stroke="#111719" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathD} fill="none" stroke={eraTheme === 'f1-1990s' ? '#e7e2d0' : '#cbd5e1'} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" opacity="0.98" />
      <path d={pathD} fill="none" stroke={eraTheme === 'f1-1990s' ? '#222a2d' : '#334155'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="18 22" />

      <TrackMarker point={pointAt(fitted, 0.01)} label="S/F" color={markerStyle.start} />
      <TrackMarker point={pointAt(fitted, 0.33)} label="S1" color={markerStyle.split} />
      <TrackMarker point={pointAt(fitted, 0.66)} label="S2" color={markerStyle.split} />
      <TrackMarker point={pointAt(fitted, 0.82)} label="PIT" color={markerStyle.pit} />

      {running.map((dot, index) => {
        const progress = dot.trackProgress ?? (rotation + index * spacing) % 1;
        const point = pointAt(fitted, progress);
        return <MapDot key={dot.driverId} point={point} dot={dot} />;
      })}

      <g transform={`translate(${PAD} ${H - 34})`}>
        <rect width="230" height="24" rx="7" fill="#090b0c" stroke="#30363a" />
        <text x="12" y="17" fill="#71717a" fontSize="12" fontWeight="700">
          PIT
        </text>
        {pitting.map((dot, index) => (
          <MapDot key={dot.driverId} point={[50 + index * 26, 12]} dot={dot} compact />
        ))}
      </g>

      <text x={W - PAD} y={H - 13} textAnchor="end" fill="#71717a" fontSize="12" fontWeight="700">
        {geometry.name.toUpperCase()} {geometry.year}
      </text>
    </>
  );
}

function fitPoints(geometry: TrackMapGeometry): TrackMapPoint[] {
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2 - BOTTOM_BAND;
  return geometry.points.map(([x, y]) => [round(PAD + x * innerW), round(PAD + y * innerH)]);
}

function toPath(points: readonly TrackMapPoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')} Z`;
}

function pointAt(points: readonly TrackMapPoint[], t: number): TrackMapPoint {
  if (points.length === 0) return [W / 2, H / 2];
  const progress = normalizeProgress(t);
  const index = Math.min(points.length - 1, Math.max(0, Math.floor(progress * points.length)));
  return points[index];
}

function normalizeProgress(value: number): number {
  return ((value % 1) + 1) % 1;
}

function TrackMarker({ point, label, color }: { point: TrackMapPoint; label: string; color: string }) {
  return (
    <g transform={`translate(${point[0]} ${point[1]})`}>
      <circle r="12" fill="#050606" stroke={color} strokeWidth="4" />
      <circle r="5" fill={color} />
      <text x="15" y="5" fill={color} fontSize="15" fontWeight="800">
        {label}
      </text>
    </g>
  );
}

function MapDot({ point, dot, compact = false }: { point: TrackMapPoint; dot: TrackDot; compact?: boolean }) {
  const radius = compact ? 12 : dot.isPlayer ? 28 : 24;
  const fontSize = compact ? 12 : dot.label.length > 2 ? 17 : 21;
  return (
    <g transform={`translate(${point[0]} ${point[1]})`}>
      <title>{`P${dot.rank} car ${dot.label}${dot.gapToLeader ? `, ${dot.gapToLeader.toFixed(1)}s behind leader` : ''}`}</title>
      <circle r={radius + 8} fill="#050606" opacity="0.92" />
      <circle
        r={radius}
        fill={dot.color}
        stroke={dot.isPlayer ? '#fef3c7' : '#ffffff'}
        strokeWidth={dot.isPlayer ? 6 : 4}
      />
      <circle r={Math.max(4, radius - 8)} fill="none" stroke="#050606" strokeWidth="2" opacity="0.45" />
      <text
        y={compact ? 4 : 7}
        textAnchor="middle"
        fill="#ffffff"
        stroke="#050606"
        strokeWidth={compact ? 2 : 4}
        paintOrder="stroke"
        fontSize={fontSize}
        fontWeight="900"
      >
        {dot.label}
      </text>
    </g>
  );
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

const retroMarkerStyle = {
  start: '#facc15',
  split: '#38bdf8',
  pit: '#f59e0b',
};

const defaultMarkerStyle = {
  start: '#facc15',
  split: '#38bdf8',
  pit: '#f97316',
};
