import {
  damageColorForState,
  damageStateFromPercent,
  seriesToAssetId,
  type DamageState,
  type MarkerAssetId,
} from './raceMarkerAssets';
import type { RaceSeries } from './seriesMarker';

export type RaceMapSeriesMarkerProps = {
  x: number;
  y: number;
  series: RaceSeries;
  number: string | number;
  primaryColor: string;
  accentColor?: string;
  isPlayer?: boolean;
  rotationDeg?: number; // 0° is right-facing; body and damage follow the live heading
  selected?: boolean;
  damagePercent?: number; // 0–100
  size?: number; // maximum marker footprint, including the damage outline; default 20
  zoom?: number; // retained for call-site compatibility; vector markers do not need raster selection
};

type MarkerGeometry = {
  outerPath: string;
  numberAnchor: { x: number; y: number };
  numberFontSize: number;
  numberMaxWidth: number;
};

const DEFAULT_SIZE = 20;
const DEFAULT_SECONDARY_COLOR = '#f7f7f7';
const DESIGN_SIZE = 20;
// The widest CART geometry plus a 3px damage stroke resolves to 21.5 design
// units. This inset keeps every damage state inside the requested 20px box.
const CONTENT_SCALE = 0.925;
const BLACK = '#07090b';
const WHITE = '#f7f7f7';
const OUTER_BLACK_STROKE = 1.55;
const WHITE_KEYLINE_STROKE = 0.58;
const DAMAGE_STROKE = 3;

/**
 * Authoritative A/A/C/C silhouettes. All paths fit inside a 20×20 design
 * footprint with room for the approved bold damage outline.
 */
const MARKER_GEOMETRY: Record<MarkerAssetId, MarkerGeometry> = {
  nascar_a: {
    outerPath: 'M-7.1-4.1H7.3Q8.5-4.1 8.75-3L7.35 3.2Q7.1 4.1 6 4.1H-8.1Q-9 4.1-8.65 3L-7.2-3.25Q-7-4.1-6-4.1Z',
    numberAnchor: { x: -1.45, y: 0 },
    numberFontSize: 7.15,
    numberMaxWidth: 8.7,
  },
  f1_a: {
    // The approved F1 A silhouette is visually left-pointed but its logical
    // forward heading is still right-facing at 0°.
    outerPath: 'M-8.8 0C-5.4-2.25.2-4.25 4.85-4.25 7.45-4.25 8.65-2.45 8.65 0S7.45 4.25 4.85 4.25C.2 4.25-5.4 2.25-8.8 0Z',
    numberAnchor: { x: 3.25, y: 0 },
    numberFontSize: 6.45,
    numberMaxWidth: 7.1,
  },
  indycar_c: {
    outerPath: 'M8.65 0C5.25-2.2.25-4.15-5.25-4.15-7.65-4.15-8.85-2.3-8.85 0S-7.65 4.15-5.25 4.15C.25 4.15 5.25 2.2 8.65 0Z',
    numberAnchor: { x: -3.05, y: 0 },
    numberFontSize: 6.7,
    numberMaxWidth: 7.2,
  },
  cart_c: {
    outerPath: 'M-8.25-4.05H-5.15V-3.2H2.8L8.65-.65Q9.25 0 8.65.65L2.8 3.2H-5.15V4.05H-8.25V1.4H-7.2V-1.4H-8.25Z',
    numberAnchor: { x: -3.45, y: 0 },
    numberFontSize: 6.25,
    numberMaxWidth: 6.7,
  },
};

function SilhouetteLayers({
  assetId,
  primaryColor,
  secondaryColor,
  damageState,
  selected,
}: {
  assetId: MarkerAssetId;
  primaryColor: string;
  secondaryColor: string;
  damageState: DamageState;
  selected: boolean;
}) {
  const geometry = MARKER_GEOMETRY[assetId];
  const damageColor = damageColorForState(damageState);

  return (
    <g pointerEvents="none" data-marker-body={assetId}>
      {selected && (
        <g data-selected-focus="true">
          <circle r={10.55} fill="#ffffff" opacity={0.045} />
          <circle
            r={10.1}
            fill="none"
            stroke="#ffffff"
            strokeWidth={0.42}
            strokeDasharray="1.2 1.8"
            opacity={0.2}
          />
        </g>
      )}

      {damageColor && (
        <path
          d={geometry.outerPath}
          fill="none"
          stroke={damageColor}
          strokeWidth={DAMAGE_STROKE}
          strokeLinejoin="round"
          strokeLinecap="round"
          data-damage-outline={damageState}
        />
      )}

      <path
        d={geometry.outerPath}
        fill={primaryColor}
        stroke={BLACK}
        strokeWidth={OUTER_BLACK_STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
        data-layer="primary"
      />

      {assetId === 'nascar_a' && (
        <NascarDetails secondaryColor={secondaryColor} />
      )}
      {assetId === 'f1_a' && (
        <F1Details secondaryColor={secondaryColor} />
      )}
      {assetId === 'indycar_c' && (
        <IndyCarDetails secondaryColor={secondaryColor} />
      )}
      {assetId === 'cart_c' && (
        <CartDetails secondaryColor={secondaryColor} />
      )}

      <path
        d={geometry.outerPath}
        fill="none"
        stroke={WHITE}
        strokeWidth={WHITE_KEYLINE_STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
        data-layer="white-keyline"
      />
    </g>
  );
}

function NascarDetails({ secondaryColor }: { secondaryColor: string }) {
  return (
    <g>
      {/* Fixed black window net. The runtime number is rendered later so its
          trailing edge sits over the first section of the net. */}
      <path
        d="M2.25-3.25 5.05-3.25 4.15 3.2H1.35Z"
        fill="none"
        stroke={BLACK}
        strokeWidth={0.26}
        data-layer="window-net"
      />
      <path
        d="M2.4-3.15 1.55 3.05M3.35-3.15 2.5 3.05M4.3-3.15 3.45 3.05M1.98-1.15H4.7M1.7.8H4.42"
        fill="none"
        stroke="#030405"
        strokeWidth={0.4}
        strokeLinecap="square"
      />
      <path d="M5.45-3.55H6.55L5.1 3.55H4Z" fill={secondaryColor} stroke={BLACK} strokeWidth={0.22} data-layer="secondary" />
      <path d="M7-3.45Q7.9-3.4 8.05-2.75L6.75 2.95Q6.6 3.5 5.75 3.55Z" fill={secondaryColor} stroke={BLACK} strokeWidth={0.22} data-layer="secondary" />
    </g>
  );
}

function F1Details({ secondaryColor }: { secondaryColor: string }) {
  return (
    <g>
      <ellipse cx={3.25} cy={0} rx={4.15} ry={3.25} fill={BLACK} stroke={secondaryColor} strokeWidth={0.82} data-layer="secondary" />
      <ellipse cx={3.25} cy={0} rx={3.5} ry={2.62} fill="#0b0d10" stroke="#23262a" strokeWidth={0.18} data-layer="fixed-black-field" />
    </g>
  );
}

function IndyCarDetails({ secondaryColor }: { secondaryColor: string }) {
  return (
    <g>
      <path
        d="M-.05-3.32 7.65 0-.05 3.32Q.55 1.65.55 0T-.05-3.32Z"
        fill={secondaryColor}
        stroke={BLACK}
        strokeWidth={0.3}
        strokeLinejoin="round"
        data-layer="secondary"
      />
      <path d="M-.05-3.18Q.55-1.55.55 0T-.05 3.18" fill="none" stroke="#ffffff" strokeWidth={0.2} opacity={0.55} />
    </g>
  );
}

function CartDetails({ secondaryColor }: { secondaryColor: string }) {
  return (
    <g>
      <path d="M-.45-2.76 8.05 0-.45 2.76Z" fill={secondaryColor} stroke={BLACK} strokeWidth={0.3} strokeLinejoin="round" data-layer="secondary" />
      <path d="M-6.95-2.9V2.9M-5.55-3.05V3.05" fill="none" stroke="#080a0c" strokeWidth={0.28} opacity={0.9} />
    </g>
  );
}

function RuntimeNumber({
  value,
  geometry,
}: {
  value: string | number;
  geometry: MarkerGeometry;
}) {
  const text = String(value).trim();
  if (!text) return null;

  const lengthScale = text.length <= 1 ? 1.08 : text.length === 2 ? 1 : 0.78;
  const fontSize = geometry.numberFontSize * lengthScale;
  const estimatedWidth = text.length * fontSize * 0.58;
  const textLength = estimatedWidth > geometry.numberMaxWidth ? geometry.numberMaxWidth : undefined;

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
      stroke={BLACK}
      strokeWidth={0.95}
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
  number,
  primaryColor,
  accentColor = DEFAULT_SECONDARY_COLOR,
  rotationDeg = 0,
  selected = false,
  damagePercent,
  size = DEFAULT_SIZE,
}: RaceMapSeriesMarkerProps) {
  const assetId = seriesToAssetId(series);
  const geometry = MARKER_GEOMETRY[assetId];
  const damageState = damageStateFromPercent(damagePercent);
  const scale = size / DESIGN_SIZE;

  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      data-race-map-marker={assetId}
      data-damage-state={damageState}
      data-primary-color={primaryColor}
      data-secondary-color={accentColor}
    >
      <g transform={`scale(${CONTENT_SCALE})`} data-footprint-inset={CONTENT_SCALE}>
        <g transform={`rotate(${rotationDeg})`} data-heading-degrees={rotationDeg}>
          <SilhouetteLayers
            assetId={assetId}
            primaryColor={primaryColor}
            secondaryColor={accentColor}
            damageState={damageState}
            selected={selected}
          />

          {/* The anchor rotates with the marker. The nested inverse rotation is
              local to the anchor, keeping the decal number screen-upright. */}
          <g transform={`translate(${geometry.numberAnchor.x} ${geometry.numberAnchor.y})`} data-number-anchor={assetId}>
            <g transform={`rotate(${-rotationDeg})`} data-number-counter-rotation={-rotationDeg}>
              <RuntimeNumber value={number} geometry={geometry} />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

export default RaceMapSeriesMarker;
