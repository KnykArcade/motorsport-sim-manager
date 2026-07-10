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
  // An explicit track progress (0..1) to use as the zoom focus when no driver dot
  // is available (e.g. after the crashed cars have been cleared from the overlay).
  focusTrackProgress?: number;
  // Driver IDs that should be rendered even though they are no longer running
  // (e.g. retired cars in a crash-zoom overlay).
  incidentDriverIds?: string[];
  // Show the safety car leading the field when it is active.
  safetyCar?: boolean;
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
  focusTrackProgress,
  incidentDriverIds,
  safetyCar = false,
}: Props) {
  const match = getTrackMapAsset({ series, year, trackId, trackName });

  if (!match) {
    return (
      <div data-testid="track-map-asset-fallback" className={className}>
        <RaceTrack2D dots={dots} rotation={rotation} safetyCar={safetyCar} className="h-full w-full" />
      </div>
    );
  }

  const viewBox = zoomBox(zoom, focusDriverIds, focusTrackProgress, dots, match.geometry);

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
        safetyCar={safetyCar}
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
  safetyCar = false,
}: {
  geometry: TrackMapGeometry;
  dots: TrackDot[];
  rotation: number;
  eraTheme: 'f1-1990s' | 'default';
  hideFooterLabel: boolean;
  zoom?: number;
  incidentDriverIds?: string[];
  safetyCar?: boolean;
}) {
  const fitted = fitPoints(geometry);
  const pathD = toPath(fitted);
  const showSet = new Set(incidentDriverIds ?? []);
  const running = dots
    .filter((dot) => (dot.running || showSet.has(dot.driverId)) && !dot.inPit && !dot.pitRequested)
    .sort((a, b) => a.rank - b.rank);
  const pitting = dots.filter((dot) => dot.running && (dot.inPit || dot.pitRequested));
  const retired = dots.filter((dot) => dot.retired && !showSet.has(dot.driverId));
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

      {safetyCar && (
        <SafetyCarDot
          point={pointAt(fitted, normalizeProgress(rotation + 0.04))}
          rotationDeg={headingAt(fitted, normalizeProgress(rotation + 0.04))}
          zoom={zoom}
        />
      )}

      {running.map((dot, index) => {
        const progress = dot.trackProgress ?? (rotation + index * spacing) % 1;
        const point = pointAt(fitted, progress);
        const heading = headingAt(fitted, progress);
        return <MapDot key={dot.driverId} point={point} dot={dot} rotationDeg={heading} zoom={zoom} />;
      })}

      <g transform={`translate(${PAD} ${H - 34})`}>
        <rect width="230" height="24" rx="7" fill="#090b0c" stroke="#30363a" />
        <text x="12" y="17" fill="#71717a" fontSize="12" fontWeight="700">
          PIT
        </text>
        {pitting.map((dot, index) => (
          <MapDot key={dot.driverId} point={[50 + index * 26, 12]} dot={dot} compact rotationDeg={0} zoom={zoom} />
        ))}
      </g>

      <g transform={`translate(${W - PAD - 230} ${H - 34})`}>
        <rect width="230" height="24" rx="7" fill="#090b0c" stroke="#30363a" />
        <text x="12" y="17" fill="#71717a" fontSize="12" fontWeight="700">
          RETIRED
        </text>
        {retired.map((dot, index) => (
          <MapDot key={dot.driverId} point={[58 + index * 26, 12]} dot={dot} compact rotationDeg={0} zoom={zoom} />
        ))}
      </g>

      {!hideFooterLabel && (
        <text x={W / 2} y={H - 10} textAnchor="middle" fill="#71717a" fontSize="12" fontWeight="700">
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

function headingAt(points: readonly TrackMapPoint[], t: number): number {
  if (points.length < 2) return 0;
  const progress = normalizeProgress(t);
  const index = Math.min(points.length - 1, Math.max(0, Math.floor(progress * points.length)));
  const next = (index + 1) % points.length;
  const [x1, y1] = points[index];
  const [x2, y2] = points[next];
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
}

function normalizeProgress(value: number): number {
  return ((value % 1) + 1) % 1;
}

function zoomBox(
  zoom: number | undefined,
  focusDriverIds: string[] | undefined,
  focusTrackProgress: number | undefined,
  dots: TrackDot[],
  geometry: TrackMapGeometry,
): string {
  if (!zoom || zoom <= 1) {
    return `0 0 ${W} ${H}`;
  }

  const fitted = fitPoints(geometry);
  const focus = focusPoint(fitted, focusDriverIds, focusTrackProgress, dots);
  const width = W / zoom;
  const height = H / zoom;
  const cx = Math.max(width / 2, Math.min(W - width / 2, focus.x));
  const cy = Math.max(height / 2, Math.min(H - height / 2, focus.y));
  return `${cx - width / 2} ${cy - height / 2} ${width} ${height}`;
}

function focusPoint(
  fitted: TrackMapPoint[],
  focusDriverIds: string[] | undefined,
  focusTrackProgress: number | undefined,
  dots: TrackDot[],
): { x: number; y: number } {
  const focusSet = new Set(focusDriverIds ?? []);
  const focusDots = dots.filter((d) => focusSet.has(d.driverId) && d.trackProgress != null);
  if (focusDots.length > 0) {
    const pts = focusDots.map((d) => pointAt(fitted, d.trackProgress!));
    const x = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const y = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    return { x, y };
  }
  if (focusTrackProgress != null) {
    const point = pointAt(fitted, focusTrackProgress);
    return { x: point[0], y: point[1] };
  }
  return { x: W / 2, y: H / 2 };
}

function MapDot({
  point,
  dot,
  compact = false,
  rotationDeg = 0,
  zoom,
}: {
  point: TrackMapPoint;
  dot: TrackDot;
  compact?: boolean;
  rotationDeg?: number;
  zoom?: number;
}) {
  const baseRadius = compact ? 6 : 10;
  const zoomFactor = zoom && zoom > 1 ? zoom : 1;
  const size = (baseRadius * 2) / zoomFactor;
  return (
    <g transform={`translate(${point[0]} ${point[1]})`}>
      <title>{`P${dot.rank} car ${dot.label}${dot.gapToLeader ? `, ${dot.gapToLeader.toFixed(1)}s behind leader` : ''}`}</title>
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series={normalizeSeries(dot.series)}
        number={dot.label}
        primaryColor={dot.color}
        accentColor={dot.accentColor}
        isPlayer={true}
        selected={dot.isPlayer}
        rotationDeg={rotationDeg}
        damagePercent={dot.damagePercent}
        size={size}
        zoom={zoomFactor}
      />
    </g>
  );
}

function SafetyCarDot({
  point,
  rotationDeg = 0,
  zoom,
}: {
  point: TrackMapPoint;
  rotationDeg?: number;
  zoom?: number;
}) {
  const zoomFactor = zoom && zoom > 1 ? zoom : 1;
  const size = 20 / zoomFactor;
  return (
    <g transform={`translate(${point[0]} ${point[1]})`}>
      <title>Safety Car</title>
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series="f1"
        number=""
        primaryColor="#facc15"
        accentColor="#facc15"
        isPlayer={false}
        selected={false}
        rotationDeg={rotationDeg}
        size={size}
        zoom={zoomFactor}
      />
    </g>
  );
}

function round(value: number): number {
  return Number(value.toFixed(2));
}
