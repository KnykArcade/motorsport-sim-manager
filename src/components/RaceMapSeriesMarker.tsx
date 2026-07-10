import { useEffect, useId, useState } from 'react';
import {
  baseMarkerUrl,
  criticalFrameFromTick,
  criticalFrameUrl,
  damageOverlayUrl,
  damageStateFromPercent,
  pickMarkerSize,
  seriesToAssetId,
  type DamageState,
} from './raceMarkerAssets';
import { useRaceMarkerFrame } from './raceMarkerAnimation';
import type { RaceSeries } from './seriesMarker';

export type RaceMapSeriesMarkerProps = {
  x: number;
  y: number;
  series: RaceSeries;
  number: string | number;
  primaryColor: string;
  accentColor?: string;
  isPlayer?: boolean;
  rotationDeg?: number; // marker and overlay rotate with track heading
  selected?: boolean;
  damagePercent?: number; // 0–100
  size?: number; // viewBox diameter; default 20
  zoom?: number; // viewBox zoom factor; used to pick the best-resolution asset
};

const DEFAULT_SIZE = 20;
const NUMBER_PLATE_RATIO = 0.29;
const NUMBER_FONT_RATIO = 0.45;
const NUMBER_STROKE_RATIO = 0.04;
const PLATE_STROKE_RATIO = 0.04;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, []);

  return reduced;
}

function DamageOverlayImage({
  assetId,
  state,
  assetSize,
  size,
}: {
  assetId: string;
  state: DamageState;
  assetSize: number;
  size: number;
}) {
  if (state === 'healthy') return null;
  const scale = size / assetSize;
  return (
    <image
      x={-assetSize / 2}
      y={-assetSize / 2}
      width={assetSize}
      height={assetSize}
      transform={`scale(${scale})`}
      href={damageOverlayUrl(assetId, state, assetSize)}
      preserveAspectRatio="xMidYMid meet"
      pointerEvents="none"
    />
  );
}

function CriticalDamageOverlayImage({
  assetId,
  assetSize,
  size,
}: {
  assetId: string;
  assetSize: number;
  size: number;
}) {
  const frame = useRaceMarkerFrame();
  const reducedMotion = useReducedMotion();
  const frameIndex = reducedMotion ? 1 : criticalFrameFromTick(frame);
  const scale = size / assetSize;
  return (
    <image
      x={-assetSize / 2}
      y={-assetSize / 2}
      width={assetSize}
      height={assetSize}
      transform={`scale(${scale})`}
      href={criticalFrameUrl(assetId, frameIndex, assetSize)}
      preserveAspectRatio="xMidYMid meet"
      pointerEvents="none"
    />
  );
}

function NumberPlate({ number, size }: { number: string | number; size: number }) {
  const text = String(number);
  if (!text) return null;

  const plateRadius = size * NUMBER_PLATE_RATIO;
  const fontSize = size * NUMBER_FONT_RATIO;
  const plateStroke = Math.max(0.5, size * PLATE_STROKE_RATIO);
  const textStroke = Math.max(0.5, size * NUMBER_STROKE_RATIO);

  return (
    <g pointerEvents="none">
      <circle
        r={plateRadius}
        fill="#151515"
        stroke="#ffffff"
        strokeWidth={plateStroke}
      />
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontFamily="Arial Narrow, Roboto Condensed, Arial, sans-serif"
        fontWeight={900}
        fill="#ffffff"
        stroke="#151515"
        strokeWidth={textStroke}
        paintOrder="stroke"
      >
        {text}
      </text>
    </g>
  );
}

export function RaceMapSeriesMarker({
  x,
  y,
  series,
  number,
  primaryColor,
  rotationDeg = 0,
  selected = false,
  damagePercent,
  size = DEFAULT_SIZE,
  zoom = 1,
}: RaceMapSeriesMarkerProps) {
  const filterId = useId();
  const radius = size / 2;
  const assetId = seriesToAssetId(series);
  const state = damageStateFromPercent(damagePercent);
  const screenSize = size * zoom;
  const assetSize = pickMarkerSize(screenSize);
  const scale = size / assetSize;

  // The color filter uses the supplied neutral PNG as a mask.
  // Dark body pixels become the team color; bright outline pixels become white.
  return (
    <g transform={`translate(${x} ${y})`}>
      {selected && (
        <g>
          <circle r={radius + 5} fill="#ffd400" opacity={0.08} />
          <circle r={radius + 4} fill="#ffd400" opacity={0.14} />
          <circle r={radius + 2} fill="#ffd400" opacity={0.22} />
        </g>
      )}
      <defs>
        <filter
          id={filterId}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feColorMatrix
            in="SourceGraphic"
            type="luminanceToAlpha"
            result="luma"
          />
          <feComponentTransfer in="luma" result="bodyMask">
            <feFuncA type="linear" slope="-1" intercept="1" />
          </feComponentTransfer>
          <feComponentTransfer in="luma" result="outlineMask">
            <feFuncA type="linear" slope="1" intercept="0" />
          </feComponentTransfer>
          <feFlood floodColor={primaryColor} floodOpacity={1} result="teamFill" />
          <feComposite in="teamFill" in2="bodyMask" operator="in" result="teamBody" />
          <feFlood floodColor="#ffffff" floodOpacity={1} result="whiteFill" />
          <feComposite in="whiteFill" in2="outlineMask" operator="in" result="whiteOutline" />
          <feComposite in="whiteOutline" in2="teamBody" operator="over" result="colored" />
        </filter>
      </defs>
      <g transform={`rotate(${rotationDeg})`}>
        <image
          x={-assetSize / 2}
          y={-assetSize / 2}
          width={assetSize}
          height={assetSize}
          transform={`scale(${scale})`}
          href={baseMarkerUrl(assetId, assetSize)}
          filter={`url(#${filterId})`}
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
        />
        {state === 'critical' ? (
          <CriticalDamageOverlayImage assetId={assetId} assetSize={assetSize} size={size} />
        ) : (
          <DamageOverlayImage assetId={assetId} state={state} assetSize={assetSize} size={size} />
        )}
      </g>
      <g transform={`rotate(${-rotationDeg})`}>
        <NumberPlate number={number} size={size} />
      </g>
    </g>
  );
}

export default RaceMapSeriesMarker;
