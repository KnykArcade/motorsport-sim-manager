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
import f1MarkerDesignsJson from './f1MarkerDesigns.json';

export type RaceMapSeriesMarkerProps = {
  x: number;
  y: number;
  series: RaceSeries;
  year?: number;
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

type F1MarkerDesign = MarkerGeometry & {
  label: string;
  bodyPath: string;
  sidepodPath: string;
  nosePath: string;
  rearWingPath: string;
  frontWingPath: string;
  accentPaths: string[];
  detailPaths: string[];
  wheels: Array<{ x: number; y: number; width: number; height: number; rx: number }>;
  cockpit: { cx: number; cy: number; rx: number; ry: number };
  haloPath: string | null;
  numberPlate: { x: number; y: number; width: number; height: number; rx: number };
};

export const F1_GAMEPLAY_MARKER_SIZE = 35;
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
 * Authoritative series silhouettes, including one locked F1 design per era.
 * All paths fit inside a 20×20 vector design footprint and scale to the
 * requested gameplay size with room for the approved bold damage outline.
 */
const F1_MARKER_DESIGNS = f1MarkerDesignsJson as Record<F1MarkerEra, F1MarkerDesign>;

const MARKER_GEOMETRY: Record<MarkerAssetId, MarkerGeometry> = {
  nascar_a: {
    outerPath: 'M-7.1-4.1H7.3Q8.5-4.1 8.75-3L7.35 3.2Q7.1 4.1 6 4.1H-8.1Q-9 4.1-8.65 3L-7.2-3.25Q-7-4.1-6-4.1Z',
    numberAnchor: { x: -1.45, y: 0 },
    numberFontSize: 7.15,
    numberMaxWidth: 8.7,
  },
  f1_1990s: F1_MARKER_DESIGNS.f1_1990s,
  f1_2000s: F1_MARKER_DESIGNS.f1_2000s,
  f1_2010s: F1_MARKER_DESIGNS.f1_2010s,
  f1_2020s: F1_MARKER_DESIGNS.f1_2020s,
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
      {isF1MarkerEra(assetId) && (
        <F1Details assetId={assetId} primaryColor={primaryColor} secondaryColor={secondaryColor} />
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

function isF1MarkerEra(assetId: MarkerAssetId): assetId is F1MarkerEra {
  return (F1_MARKER_ERAS as readonly string[]).includes(assetId);
}

function F1Details({
  assetId,
  primaryColor,
  secondaryColor,
}: {
  assetId: F1MarkerEra;
  primaryColor: string;
  secondaryColor: string;
}) {
  const design = F1_MARKER_DESIGNS[assetId];
  return (
    <g data-f1-era={design.label}>
      {design.wheels.map((wheel, index) => (
        <rect
          key={`${assetId}-wheel-${index}`}
          {...wheel}
          fill="#08090b"
          stroke="#33383d"
          strokeWidth={0.35}
          data-layer="exposed-tyre"
        />
      ))}
      {design.detailPaths.map((path, index) => (
        <path
          key={`${assetId}-suspension-${index}`}
          d={path}
          fill="none"
          stroke={index === 0 ? '#111519' : '#d7d9dc'}
          strokeWidth={index === 0 ? 0.5 : 0.24}
          strokeLinecap="round"
          opacity={index === 0 ? 1 : 0.75}
          data-layer="suspension-detail"
        />
      ))}
      <path d={design.rearWingPath} fill={secondaryColor} stroke={BLACK} strokeWidth={0.42} data-layer="rear-wing" />
      <path d={design.bodyPath} fill={primaryColor} stroke={BLACK} strokeWidth={0.45} data-layer="primary" />
      <path d={design.sidepodPath} fill={primaryColor} stroke={BLACK} strokeWidth={0.36} data-layer="era-sidepods" />
      {design.accentPaths.map((path, index) => (
        <path
          key={`${assetId}-accent-${index}`}
          d={path}
          fill={index < 3 ? secondaryColor : 'none'}
          stroke={index < 3 ? BLACK : secondaryColor}
          strokeWidth={index < 3 ? 0.28 : 0.38}
          strokeLinecap="round"
          strokeLinejoin="round"
          data-layer="secondary"
        />
      ))}
      <path d={design.nosePath} fill={primaryColor} stroke={BLACK} strokeWidth={0.34} data-layer="nose" />
      <ellipse
        {...design.cockpit}
        fill="#080a0d"
        stroke={secondaryColor}
        strokeWidth={0.48}
        data-layer="open-cockpit"
      />
      <ellipse
        cx={design.cockpit.cx - 0.2}
        cy={design.cockpit.cy}
        rx={design.cockpit.rx * 0.56}
        ry={design.cockpit.ry * 0.58}
        fill="#20252a"
        stroke="#050607"
        strokeWidth={0.24}
        data-layer="helmet"
      />
      {design.haloPath && (
        <path
          d={design.haloPath}
          fill="none"
          stroke="#111417"
          strokeWidth={0.48}
          strokeLinecap="round"
          strokeLinejoin="round"
          data-layer="halo"
        />
      )}
      <path d={design.frontWingPath} fill={secondaryColor} stroke={BLACK} strokeWidth={0.42} data-layer="front-wing" />
      <rect
        {...design.numberPlate}
        fill={BLACK}
        stroke={WHITE}
        strokeWidth={0.3}
        data-layer="front-number-plate"
      />
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
  year,
  number,
  primaryColor,
  accentColor = DEFAULT_SECONDARY_COLOR,
  rotationDeg = 0,
  selected = false,
  damagePercent,
  size = DEFAULT_SIZE,
}: RaceMapSeriesMarkerProps) {
  const assetId = seriesToAssetId(series, year);
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
      data-marker-year={year}
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
