import { RaceTrack2D, type TrackDot } from './RaceTrack2D';
import { GAMEPLAY_MARKER_SIZE, RaceMapSeriesMarker } from './RaceMapSeriesMarker';
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
const KYALAMI_IMAGE_SIZE = 1000;
const KYALAMI_HISTORIC_MAP_IMAGE = '/assets/track-maps/kyalami-historic-2p5d.png';
const KYALAMI_LANE_OFFSET = 7;
const CLOSE_RACING_PROGRESS = 0.012;

const KYALAMI_HISTORIC_IMAGE_POINTS: TrackMapPoint[] = [
  [636.7, 647.5],
  [593.8, 676.8],
  [543.9, 714.8],
  [498, 749],
  [459, 766.6],
  [428.7, 754.9],
  [418.9, 714.8],
  [424.8, 650.4],
  [421.9, 582],
  [408.2, 509.8],
  [387.7, 445.3],
  [366.2, 393.6],
  [341.8, 351.6],
  [305.7, 347.7],
  [285.2, 388.7],
  [270.5, 453.1],
  [246.1, 518.6],
  [207, 574.2],
  [160.2, 619.1],
  [111.3, 639.6],
  [76.2, 627.9],
  [69.3, 584],
  [89.8, 546.9],
  [132.8, 532.2],
  [184.6, 522.5],
  [222.7, 498],
  [229.5, 453.1],
  [235.4, 396.5],
  [255.9, 350.6],
  [298.8, 306.6],
  [345.7, 259.8],
  [389.6, 216.8],
  [438.5, 219.7],
  [462.9, 257.8],
  [468.8, 330.1],
  [482.4, 401.4],
  [515.6, 440.4],
  [565.4, 462.9],
  [621.1, 455.1],
  [670.9, 419.9],
  [710, 370.1],
  [750, 322.3],
  [791, 276.4],
  [833, 226.6],
  [883.8, 211.9],
  [924.8, 240.2],
  [938.5, 297.9],
  [931.6, 381.8],
  [911.1, 455.1],
  [864.3, 515.6],
  [795.9, 532.2],
  [734.4, 569.3],
  [679.7, 614.3],
];
const KYALAMI_HISTORIC_MAP_POINTS: TrackMapPoint[] = KYALAMI_HISTORIC_IMAGE_POINTS.map(([x, y]) => [x, y * (H / KYALAMI_IMAGE_SIZE)]);

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
        <RaceTrack2D dots={dots} rotation={rotation} year={year} safetyCar={safetyCar} className="h-full w-full" />
      </div>
    );
  }

  const isHistoricKyalami = eraTheme === 'f1-1990s' && match.geometry.id === 'kyalami-grand-prix-circuit-historic';
  const viewBox = zoomBox(zoom, focusDriverIds, focusTrackProgress, dots, match.geometry, isHistoricKyalami);

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
        year={year}
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
  year,
  rotation,
  eraTheme,
  hideFooterLabel,
  zoom,
  incidentDriverIds,
  safetyCar = false,
}: {
  geometry: TrackMapGeometry;
  dots: TrackDot[];
  year?: number;
  rotation: number;
  eraTheme: 'f1-1990s' | 'default';
  hideFooterLabel: boolean;
  zoom?: number;
  incidentDriverIds?: string[];
  safetyCar?: boolean;
}) {
  const isHistoricKyalami = eraTheme === 'f1-1990s' && geometry.id === 'kyalami-grand-prix-circuit-historic';
  const fitted = fitPoints(geometry);
  const trackPoints = isHistoricKyalami ? KYALAMI_HISTORIC_MAP_POINTS : fitted;
  const pathD = toPath(fitted);
  const mapWidth = W;
  const mapHeight = H;
  const showSet = new Set(incidentDriverIds ?? []);
  const running = dots
    .filter((dot) => (dot.running || showSet.has(dot.driverId)) && !dot.inPit && !dot.pitRequested)
    .sort((a, b) => a.rank - b.rank);
  const pitting = dots.filter((dot) => dot.running && (dot.inPit || dot.pitRequested));
  const retired = dots.filter((dot) => dot.retired && !showSet.has(dot.driverId));
  const spacing = 1 / Math.max(running.length, 14);
  const laneOffsets = isHistoricKyalami ? closeRacingLaneOffsets(running) : new Map<string, number>();

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

      <rect x="0" y="0" width={mapWidth} height={mapHeight} rx="12" fill={eraTheme === 'f1-1990s' ? '#050606' : '#0f172a'} />
      {isHistoricKyalami ? (
        <g data-track-style="historic-kyalami-image-2.5d" data-track-map-background="kyalami-historic-2p5d">
          <image
            x="0"
            y="0"
            width={KYALAMI_IMAGE_SIZE}
            height={H}
            href={KYALAMI_HISTORIC_MAP_IMAGE}
            preserveAspectRatio="none"
            data-track-layer="scenery-background"
            data-testid="kyalami-historic-image"
          />
        </g>
      ) : (
        <>
          <path d={pathD} fill="none" stroke="#111719" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
          <path d={pathD} fill="none" stroke={eraTheme === 'f1-1990s' ? '#e7e2d0' : '#cbd5e1'} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" opacity="0.98" />
          <path d={pathD} fill="none" stroke={eraTheme === 'f1-1990s' ? '#222a2d' : '#334155'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="18 22" />
        </>
      )}

      {safetyCar && (
        <SafetyCarDot
          point={pointAt(trackPoints, normalizeProgress(rotation + 0.04))}
          year={year}
          rotationDeg={headingAt(trackPoints, normalizeProgress(rotation + 0.04))}
          zoom={zoom}
        />
      )}

      {running.map((dot, index) => {
        const progress = dot.trackProgress ?? (rotation + index * spacing) % 1;
        const point = pointAt(trackPoints, progress);
        const heading = headingAt(trackPoints, progress);
        const displayPoint = offsetPoint(point, heading, laneOffsets.get(dot.driverId) ?? 0);
        return <MapDot key={dot.driverId} point={displayPoint} dot={dot} year={year} rotationDeg={heading} zoom={zoom} />;
      })}

      <g transform={`translate(${PAD} ${mapHeight - 34})`}>
        <rect width="230" height="24" rx="7" fill="#090b0c" stroke="#30363a" />
        <text x="12" y="17" fill="#71717a" fontSize="12" fontWeight="700">
          PIT
        </text>
        {pitting.map((dot, index) => (
          <MapDot key={dot.driverId} point={[50 + index * 26, 12]} dot={dot} year={year} compact rotationDeg={0} zoom={zoom} />
        ))}
      </g>

      <g transform={`translate(${mapWidth - PAD - 230} ${mapHeight - 34})`}>
        <rect width="230" height="24" rx="7" fill="#090b0c" stroke="#30363a" />
        <text x="12" y="17" fill="#71717a" fontSize="12" fontWeight="700">
          RETIRED
        </text>
        {retired.map((dot, index) => (
          <MapDot key={dot.driverId} point={[58 + index * 26, 12]} dot={dot} year={year} compact rotationDeg={0} zoom={zoom} />
        ))}
      </g>

      {!hideFooterLabel && (
        <text x={mapWidth / 2} y={mapHeight - 10} textAnchor="middle" fill="#71717a" fontSize="12" fontWeight="700">
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

function offsetPoint(point: TrackMapPoint, heading: number, lateralOffset: number): TrackMapPoint {
  if (lateralOffset === 0) return point;
  const normal = ((heading + 90) * Math.PI) / 180;
  return [round(point[0] + Math.cos(normal) * lateralOffset), round(point[1] + Math.sin(normal) * lateralOffset)];
}

/**
 * The simulation does not expose a discrete left/right lane. When two cars are
 * within roughly one marker length around the lap, give them small opposing
 * lateral offsets. At 40px the 1990s silhouettes then touch or overlap slightly
 * while remaining inside Kyalami's image-backed racing surface.
 */
function closeRacingLaneOffsets(running: TrackDot[]): Map<string, number> {
  const offsets = new Map<string, number>();
  const candidates = running
    .filter((dot) => dot.trackProgress != null)
    .map((dot) => ({ dot, progress: normalizeProgress(dot.trackProgress!) }))
    .sort((a, b) => a.progress - b.progress);

  if (candidates.length < 2) return offsets;

  const paired = new Set<string>();
  for (let index = 0; index < candidates.length; index += 1) {
    const current = candidates[index];
    if (paired.has(current.dot.driverId)) continue;

    let nearest: (typeof candidates)[number] | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let otherIndex = 0; otherIndex < candidates.length; otherIndex += 1) {
      if (index === otherIndex) continue;
      const other = candidates[otherIndex];
      if (paired.has(other.dot.driverId)) continue;
      const direct = Math.abs(current.progress - other.progress);
      const distance = Math.min(direct, 1 - direct);
      if (distance < nearestDistance) {
        nearest = other;
        nearestDistance = distance;
      }
    }

    if (!nearest || nearestDistance > CLOSE_RACING_PROGRESS) continue;
    const ordered = [current.dot, nearest.dot].sort((a, b) => a.rank - b.rank);
    offsets.set(ordered[0].driverId, -KYALAMI_LANE_OFFSET);
    offsets.set(ordered[1].driverId, KYALAMI_LANE_OFFSET);
    paired.add(current.dot.driverId);
    paired.add(nearest.dot.driverId);
  }

  return offsets;
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
  isHistoricKyalami: boolean,
): string {
  const mapWidth = W;
  const mapHeight = H;
  if (!zoom || zoom <= 1) {
    return `0 0 ${mapWidth} ${mapHeight}`;
  }

  const fitted = isHistoricKyalami ? KYALAMI_HISTORIC_MAP_POINTS : fitPoints(geometry);
  const focus = focusPoint(fitted, focusDriverIds, focusTrackProgress, dots, mapWidth, mapHeight);
  const width = mapWidth / zoom;
  const height = mapHeight / zoom;
  const cx = Math.max(width / 2, Math.min(mapWidth - width / 2, focus.x));
  const cy = Math.max(height / 2, Math.min(mapHeight - height / 2, focus.y));
  return `${cx - width / 2} ${cy - height / 2} ${width} ${height}`;
}

function focusPoint(
  fitted: TrackMapPoint[],
  focusDriverIds: string[] | undefined,
  focusTrackProgress: number | undefined,
  dots: TrackDot[],
  mapWidth = W,
  mapHeight = H,
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
  return { x: mapWidth / 2, y: mapHeight / 2 };
}

function MapDot({
  point,
  dot,
  year,
  compact = false,
  rotationDeg = 0,
  zoom,
}: {
  point: TrackMapPoint;
  dot: TrackDot;
  year?: number;
  compact?: boolean;
  rotationDeg?: number;
  zoom?: number;
}) {
  const zoomFactor = zoom && zoom > 1 ? zoom : 1;
  const markerSeries = normalizeSeries(dot.series);
  const gameplaySize = GAMEPLAY_MARKER_SIZE;
  const size = (compact ? 18 : gameplaySize) / zoomFactor;
  const tooltip = markerTooltipPosition(point);
  const numberAndName = `${dot.label ? `#${dot.label} ` : ''}${dot.driverName ?? `Car ${dot.label}`}`;
  const teamAndPosition = `${dot.teamName ?? 'Race car'} · P${dot.rank}`;
  return (
    <g
      transform={`translate(${point[0]} ${point[1]})`}
      className="track-map-car"
      tabIndex={0}
      role="img"
      aria-label={`${numberAndName}, ${teamAndPosition}`}
      data-track-map-driver={dot.driverId}
    >
      <title>{`${numberAndName}, ${teamAndPosition}${dot.gapToLeader ? `, ${dot.gapToLeader.toFixed(1)}s behind leader` : ''}`}</title>
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series={markerSeries}
        year={dot.year ?? year}
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
      {!compact && (
        <>
          <circle r={Math.max(22 / zoomFactor, size * 0.62)} fill="transparent" pointerEvents="all" data-marker-hit-target="true" />
          <g
            className="track-map-car-tooltip"
            transform={`translate(${tooltip.x} ${tooltip.y})`}
            pointerEvents="none"
            data-marker-tooltip="true"
          >
            <rect width="174" height="43" rx="5" fill="#07090b" stroke="#f2b600" strokeWidth="1.25" />
            <rect x="7" y="8" width="8" height="27" rx="1" fill={dot.color} />
            <text x="22" y="19" fill="#f7f7f7" fontSize="12" fontWeight="900" fontFamily="Arial Narrow, Roboto Condensed, Arial, sans-serif">
              {numberAndName.toUpperCase()}
            </text>
            <text x="22" y="34" fill="#a1a1aa" fontSize="9.5" fontWeight="700" fontFamily="Arial Narrow, Roboto Condensed, Arial, sans-serif">
              {teamAndPosition.toUpperCase()}
            </text>
          </g>
        </>
      )}
    </g>
  );
}

function markerTooltipPosition(point: TrackMapPoint): { x: number; y: number } {
  return {
    x: point[0] > W - 200 ? -184 : 12,
    y: point[1] < 70 ? 12 : -55,
  };
}

function SafetyCarDot({
  point,
  year,
  rotationDeg = 0,
  zoom,
}: {
  point: TrackMapPoint;
  year?: number;
  rotationDeg?: number;
  zoom?: number;
}) {
  const zoomFactor = zoom && zoom > 1 ? zoom : 1;
  const size = 24 / zoomFactor;
  return (
    <g transform={`translate(${point[0]} ${point[1]})`}>
      <title>Safety Car</title>
      <RaceMapSeriesMarker
        x={0}
        y={0}
        series="f1"
        year={year}
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
