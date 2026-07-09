import { RaceTrack2D, type TrackDot } from './RaceTrack2D';
import { RaceMapSeriesMarker } from './RaceMapSeriesMarker';
import { normalizeSeries } from './seriesMarker';
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
  hideFooterLabel?: boolean;
  className?: string;
  // Zoom into a region of the track. 1 = default, 2 = 2x magnification.
  zoom?: number;
  // Driver IDs to focus the zoomed view on. If omitted, the centre of the track is used.
  focusDriverIds?: string[];
  // Driver IDs that should be rendered even though they are no longer running
  // (e.g. retired cars in a crash-zoom overlay).
  incidentDriverIds?: string[];
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
  zoom,
  focusDriverIds,
  incidentDriverIds,
}: Props) {
  const match = getTrackMapAsset({ series, year, trackId, trackName });

  if (!match) {
    return (
      <div data-testid="track-map-asset-fallback" className={className}>
        <RaceTrack2D dots={dots} rotation={rotation} className="h-full w-full" />
      </div>
    );
  }

  const viewBox = zoomBox(zoom, focusDriverIds, dots, match.geometry);

  return (
    <svg
      viewBox={viewBox}
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
        zoom={zoom}
        incidentDriverIds={incidentDriverIds}
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
  zoom,
  incidentDriverIds,
}: {
  geometry: TrackMapGeometry;
  dots: TrackDot[];
  rotation: number;
  eraTheme: 'f1-1990s' | 'default';
  hideFooterLabel: boolean;
  zoom?: number;
  incidentDriverIds?: string[];
}) {
  const fitted = fitPoints(geometry);
  const pathD = toPath(fitted);
  const showSet = new Set(incidentDriverIds ?? []);
  const running = dots
    .filter((dot) => (dot.running || showSet.has(dot.driverId)) && !dot.inPit && !dot.pitRequested)
    .sort((a, b) => a.rank - b.rank);
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
        const progress = dot.trackProgress ?? (rotation + index * spacing) % 1;
        const point = pointAt(fitted, progress);
        return <MapDot key={dot.driverId} point={point} dot={dot} zoom={zoom} />;
      })}

      <g transform={`translate(${PAD} ${H - 34})`}>
        <rect width="230" height="24" rx="7" fill="#090b0c" stroke="#30363a" />
        <text x="12" y="17" fill="#71717a" fontSize="12" fontWeight="700">
          PIT
        </text>
        {pitting.map((dot, index) => (
          <MapDot key={dot.driverId} point={[50 + index * 26, 12]} dot={dot} compact zoom={zoom} />
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
  const progress = normalizeProgress(t);
  const index = Math.min(points.length - 1, Math.max(0, Math.floor(progress * points.length)));
  return points[index];
}

function normalizeProgress(value: number): number {
  return ((value % 1) + 1) % 1;
}

function zoomBox(
  zoom: number | undefined,
  focusDriverIds: string[] | undefined,
  dots: TrackDot[],
  geometry: TrackMapGeometry,
): string {
  if (!zoom || zoom <= 1) {
    return `0 0 ${W} ${H}`;
  }

  const fitted = fitPoints(geometry);
  const focus = focusPoint(fitted, focusDriverIds, dots);
  const width = W / zoom;
  const height = H / zoom;
  const cx = Math.max(width / 2, Math.min(W - width / 2, focus.x));
  const cy = Math.max(height / 2, Math.min(H - height / 2, focus.y));
  return `${cx - width / 2} ${cy - height / 2} ${width} ${height}`;
}

function focusPoint(fitted: TrackMapPoint[], focusDriverIds: string[] | undefined, dots: TrackDot[]): { x: number; y: number } {
  const focusSet = new Set(focusDriverIds ?? []);
  const focusDots = dots.filter((d) => focusSet.has(d.driverId) && d.trackProgress != null);
  if (focusDots.length > 0) {
    const pts = focusDots.map((d) => pointAt(fitted, d.trackProgress!));
    const x = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const y = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    return { x, y };
  }
  return { x: W / 2, y: H / 2 };
}

function MapDot({ point, dot, compact = false, zoom }: { point: TrackMapPoint; dot: TrackDot; compact?: boolean; zoom?: number }) {
  const baseRadius = compact ? 12 : 20;
  const zoomFactor = zoom && zoom > 1 ? zoom : 1;
  const radius = baseRadius / zoomFactor;
  const scale = radius / 20;
  return (
    <g transform={`translate(${point[0]} ${point[1]})`}>
      <title>{`P${dot.rank} car ${dot.label}${dot.gapToLeader ? `, ${dot.gapToLeader.toFixed(1)}s behind leader` : ''}`}</title>
      <g transform={`scale(${scale})`}>
        <RaceMapSeriesMarker
          x={0}
          y={0}
          series={normalizeSeries(dot.series)}
          number={dot.label}
          primaryColor={dot.color}
          accentColor={dot.accentColor}
          isPlayer={true}
          selected={dot.isPlayer}
          rotationDeg={0}
        />
      </g>
    </g>
  );
}

function round(value: number): number {
  return Number(value.toFixed(2));
}
