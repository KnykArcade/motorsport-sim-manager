import { useId } from 'react';
import {
  damageColorForState,
  damageStateFromPercent,
  F1_MARKER_ERAS,
  seriesToAssetId,
  type DamageState,
  type F1MarkerEra,
  type MarkerAssetId,
} from './raceMarkerAssets';
import type { RaceSeries } from './seriesMarker';
import f1RasterMarkerDesignsJson from './f1RasterMarkerDesigns.json';
import seriesRasterMarkerDesignsJson from './seriesRasterMarkerDesigns.json';

export type RaceMapSeriesMarkerProps = {
  x: number;
  y: number;
  series: RaceSeries;
  year?: number;
  number: string | number;
  primaryColor: string;
  accentColor?: string;
  isPlayer?: boolean;
  rotationDeg?: number;
  selected?: boolean;
  damagePercent?: number;
  size?: number;
  zoom?: number;
};

type RasterMarkerDesign = {
  label: string;
  canvasSize: number;
  forwardAxis: '+x';
  gameplayFootprint?: number;
  numberDecal?: boolean;
  identification?: string;
  numberLocation?: string;
  numberAnchor?: { x: number; y: number };
  numberFontSize?: number;
  numberMaxWidth?: number;
  numberStrokeWidth?: number;
  assets: {
    master: string;
    primaryShading: string;
    secondaryShading: string;
    fixedDetails: string;
    primaryMask: string;
    secondaryMask: string;
    silhouetteMask: string;
  };
};

export const GAMEPLAY_MARKER_SIZE = 40;
export const F1_GAMEPLAY_MARKER_SIZE = GAMEPLAY_MARKER_SIZE;
const DEFAULT_SECONDARY_COLOR = '#f7f7f7';
const DESIGN_SIZE = 20;
const CONTENT_SCALE = 0.925;
const WHITE = '#f7f7f7';

const F1_MARKER_DESIGNS = f1RasterMarkerDesignsJson as Record<F1MarkerEra, RasterMarkerDesign>;
const SERIES_MARKER_DESIGNS = seriesRasterMarkerDesignsJson as Record<Exclude<MarkerAssetId, F1MarkerEra>, RasterMarkerDesign>;
const RASTER_MARKER_DESIGNS = {
  ...F1_MARKER_DESIGNS,
  ...SERIES_MARKER_DESIGNS,
} as Record<MarkerAssetId, RasterMarkerDesign>;

function isF1MarkerEra(assetId: MarkerAssetId): assetId is F1MarkerEra {
  return (F1_MARKER_ERAS as readonly string[]).includes(assetId);
}

function RasterDetails({
  assetId,
  primaryColor,
  secondaryColor,
  damageState,
  uniqueId,
}: {
  assetId: MarkerAssetId;
  primaryColor: string;
  secondaryColor: string;
  damageState: DamageState;
  uniqueId: string;
}) {
  const design = RASTER_MARKER_DESIGNS[assetId];
  const primaryMaskId = `${uniqueId}-${assetId}-primary-mask`;
  const secondaryMaskId = `${uniqueId}-${assetId}-secondary-mask`;
  const silhouetteMaskId = `${uniqueId}-${assetId}-silhouette-mask`;
  const damageColor = damageColorForState(damageState);
  const damageOffsets = [
    [-0.54, 0], [0.54, 0], [0, -0.54], [0, 0.54],
    [-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4],
  ] as const;
  const f1 = isF1MarkerEra(assetId);

  return (
    <g
      data-raster-marker={design.label}
      data-raster-artwork="approved-raster"
      data-f1-era={f1 ? design.label : undefined}
      data-f1-artwork={f1 ? 'approved-raster' : undefined}
      data-forward-axis={design.forwardAxis}
      data-number-location={f1 ? design.numberLocation : undefined}
      data-identification={f1 ? undefined : design.identification}
      style={{ isolation: 'isolate' }}
    >
      <defs>
        <mask id={primaryMaskId} x={-10} y={-10} width={20} height={20} maskUnits="userSpaceOnUse">
          <image href={design.assets.primaryMask} x={-10} y={-10} width={20} height={20} preserveAspectRatio="none" />
        </mask>
        <mask id={secondaryMaskId} x={-10} y={-10} width={20} height={20} maskUnits="userSpaceOnUse">
          <image href={design.assets.secondaryMask} x={-10} y={-10} width={20} height={20} preserveAspectRatio="none" />
        </mask>
        <mask id={silhouetteMaskId} x={-10} y={-10} width={20} height={20} maskUnits="userSpaceOnUse">
          <image href={design.assets.silhouetteMask} x={-10} y={-10} width={20} height={20} preserveAspectRatio="none" />
        </mask>
      </defs>

      {damageColor && (
        <g fill={damageColor} data-damage-outline={damageState}>
          {damageOffsets.map(([dx, dy]) => (
            <g key={`${dx}-${dy}`} transform={`translate(${dx} ${dy})`}>
              <rect x={-10} y={-10} width={20} height={20} mask={`url(#${silhouetteMaskId})`} />
            </g>
          ))}
        </g>
      )}
      <rect x={-10} y={-10} width={20} height={20} fill={primaryColor} mask={`url(#${primaryMaskId})`} data-layer="primary" />
      <image href={design.assets.primaryShading} x={-10} y={-10} width={20} height={20} preserveAspectRatio="none" style={{ mixBlendMode: 'multiply' }} data-layer="primary-shading" />
      <rect x={-10} y={-10} width={20} height={20} fill={secondaryColor} mask={`url(#${secondaryMaskId})`} data-layer="secondary" />
      <image href={design.assets.secondaryShading} x={-10} y={-10} width={20} height={20} preserveAspectRatio="none" style={{ mixBlendMode: 'multiply' }} data-layer="secondary-shading" />
      <image href={design.assets.fixedDetails} x={-10} y={-10} width={20} height={20} preserveAspectRatio="none" data-layer="fixed-details" />
      {f1 && <g data-layer="front-number-plate" data-location={design.numberLocation} />}
    </g>
  );
}

function RuntimeNumber({ value, design }: { value: string | number; design: RasterMarkerDesign }) {
  const text = String(value).trim();
  if (!text || !design.numberAnchor || !design.numberFontSize || !design.numberMaxWidth) return null;
  const lengthScale = text.length <= 1 ? 1.08 : text.length === 2 ? 1 : 0.78;
  const fontSize = design.numberFontSize * lengthScale;
  const estimatedWidth = text.length * fontSize * 0.58;
  const textLength = estimatedWidth > design.numberMaxWidth ? design.numberMaxWidth : undefined;

  return (
    <text
      x={0}
      y={0.15}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={fontSize}
      fontFamily="Arial Narrow, Roboto Condensed, Arial, sans-serif"
      fontStyle="italic"
      fontWeight={900}
      fill={WHITE}
      stroke="#07090b"
      strokeWidth={design.numberStrokeWidth ?? 0.95}
      strokeLinejoin="round"
      paintOrder="stroke"
      textLength={textLength}
      lengthAdjust={textLength ? 'spacingAndGlyphs' : undefined}
      pointerEvents="none"
      data-layer="runtime-number"
    >
      {text}
    </text>
  );
}

export function RaceMapSeriesMarker({
  x,
  y,
  series,
  year,
  number,
  primaryColor,
  accentColor = DEFAULT_SECONDARY_COLOR,
  rotationDeg = 0,
  selected = false,
  damagePercent,
  size = GAMEPLAY_MARKER_SIZE,
}: RaceMapSeriesMarkerProps) {
  const markerUid = useId().replaceAll(':', '');
  const assetId = seriesToAssetId(series, year);
  const design = RASTER_MARKER_DESIGNS[assetId];
  const damageState = damageStateFromPercent(damagePercent);
  const scale = size / DESIGN_SIZE;
  const renderNumber = isF1MarkerEra(assetId) && design.numberDecal !== false && design.numberAnchor;

  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      data-race-map-marker={assetId}
      data-damage-state={damageState}
      data-primary-color={primaryColor}
      data-secondary-color={accentColor}
      data-marker-year={year}
    >
      <g transform={`scale(${CONTENT_SCALE})`} data-footprint-inset={CONTENT_SCALE}>
        {selected && (
          <g data-selected-focus="true">
            <circle r={10.55} fill="#ffffff" opacity={0.045} />
            <circle r={10.1} fill="none" stroke="#ffffff" strokeWidth={0.42} strokeDasharray="1.2 1.8" opacity={0.2} />
          </g>
        )}
        <g transform={`rotate(${rotationDeg})`} data-heading-degrees={rotationDeg} data-marker-body={assetId}>
          <RasterDetails
            assetId={assetId}
            primaryColor={primaryColor}
            secondaryColor={accentColor}
            damageState={damageState}
            uniqueId={markerUid}
          />
          {renderNumber && (
            <g transform={`translate(${design.numberAnchor!.x} ${design.numberAnchor!.y})`} data-number-anchor={assetId}>
              <g transform={`rotate(${-rotationDeg})`} data-number-counter-rotation={-rotationDeg}>
                <RuntimeNumber value={number} design={design} />
              </g>
            </g>
          )}
        </g>
      </g>
    </g>
  );
}

export default RaceMapSeriesMarker;
