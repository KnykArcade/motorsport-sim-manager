import { RaceTrack2D, type TrackDot } from './RaceTrack2D';
import { getTrackMapAsset } from '../data/trackMaps/getTrackMapAsset';
import type { TrackMapGeometry, TrackMapPoint } from '../data/trackMaps/trackMapGeometry';
import {
  TrackMapMarker,
  headingFromPath,
  normalizeProgress,
  resolveTrackMapMarkerVariant,
} from './TrackMapMarker';

type Props = {
  series?: string;
  year?: number;
  trackId?: string;
  trackName?: string;
  dots: TrackDot[];
  rotation: number;
  eraTheme?: 'f1-1990s' | 'default';
  hideFooterLabel?: boolean;
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
  hideFooterLabel = false,
  className = 'w-full',
}: Props) {
  const match = getTrackMapAsset({ series, year, trackId, trackName });

  if (!match) {
    return (
      <div data-testid="track-map-asset-fallback" className={className}>
        <RaceTrack2D dots={dots} rotation={rotation} series={series} year={year} className="h-full w-full" />
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
      <AssetTrackMap
        geometry={match.geometry}
        dots={dots}
        rotation={rotation}
        eraTheme={eraTheme}
        hideFooterLabel={hideFooterLabel}
      />
    </svg>
  );
}

function AssetTrackMap({
  geometry,
  dots,
  rotation,
  eraTheme,
  hideFooterLabel,
}: {
  geometry: TrackMapGeometry;
  dots: TrackDot[];
  rotation: number;
  eraTheme: 'f1-1990s' | 'default';
  hideFooterLabel: boolean;
}) {
  const fitted = fitPoints(geometry);
  const pathD = toPath(fitted);
  const running = dots.filter((dot) => dot.running && !dot.inPit && !dot.pitRequested).sort((a, b) => a.rank - b.rank);
  const pitting = dots.filter((dot) => dot.running && (dot.inPit || dot.pitRequested));
  const spacing = 1 / Math.max(running.length, 14);

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

      {running.map((dot, index) => {
        const progress = dot.trackProgress ?? normalizeProgress(rotation + index * spacing);
        const point = pointAt(fitted, progress);
        const heading = headingAt(fitted, progress);
        return (
          <TrackMapMarker
            key={dot.driverId}
            x={point[0]}
            y={point[1]}
            headingDeg={heading}
            teamColor={dot.color}
            number={dot.label || null}
            rank={dot.rank}
            gapToLeader={dot.gapToLeader}
            variant={resolveTrackMapMarkerVariant(geometry.series, geometry.year)}
            status={{
              leader: dot.rank === 1,
              player: dot.isPlayer,
              inPit: dot.inPit || dot.pitRequested,
              damaged: dot.damaged,
              fastestLap: dot.fastestLap,
            }}
          />
        );
      })}

      <g transform={`translate(${PAD} ${H - 34})`}>
        <rect width="230" height="24" rx="7" fill="#090b0c" stroke="#30363a" />
        <text x="12" y="17" fill="#71717a" fontSize="12" fontWeight="700">
          PIT
        </text>
        {pitting.map((dot, index) => (
          <TrackMapMarker
            key={dot.driverId}
            x={50 + index * 26}
            y={12}
            headingDeg={0}
            teamColor={dot.color}
            number={dot.label || null}
            rank={dot.rank}
            gapToLeader={dot.gapToLeader}
            variant={resolveTrackMapMarkerVariant(geometry.series, geometry.year)}
            compact
            status={{
              leader: dot.rank === 1,
              player: dot.isPlayer,
              inPit: true,
              damaged: dot.damaged,
              fastestLap: dot.fastestLap,
            }}
          />
        ))}
      </g>

      {!hideFooterLabel && (
        <text x={W - PAD} y={H - 13} textAnchor="end" fill="#71717a" fontSize="12" fontWeight="700">
          {geometry.name.toUpperCase()} {geometry.year}
        </text>
      )}
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
  const progress = normalizeTrackProgress(t);
  const index = Math.min(points.length - 1, Math.max(0, Math.floor(progress * points.length)));
  return points[index];
}

function normalizeTrackProgress(value: number): number {
  return ((value % 1) + 1) % 1;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function headingAt(points: readonly TrackMapPoint[], progress: number): number {
  if (points.length < 2) return 0;
  const normalized = normalizeTrackProgress(progress);
  const index = Math.min(points.length - 1, Math.max(0, Math.floor(normalized * points.length)));
  return headingFromPath(points, index);
}
