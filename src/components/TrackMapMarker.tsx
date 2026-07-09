/* eslint-disable react-refresh/only-export-components */
import { useId } from 'react';

export type TrackMapMarkerVariant =
  | 'f1-1990s'
  | 'f1-2000s'
  | 'f1-2010s'
  | 'f1-2020s'
  | 'nascar-1990s'
  | 'nascar-2000s'
  | 'nascar-2010s'
  | 'nascar-2020s'
  | 'indycar-1990s'
  | 'indycar-2000s'
  | 'indycar-2010s'
  | 'indycar-2020s'
  | 'cart-1990s'
  | 'cart-2000s';

export type TrackMapMarkerStatus = {
  leader?: boolean;
  player?: boolean;
  inPit?: boolean;
  damaged?: boolean;
  fastestLap?: boolean;
};

export type TrackMapMarkerProps = {
  x: number;
  y: number;
  headingDeg: number;
  teamColor: string;
  number: string | number | null;
  rank?: number;
  gapToLeader?: number;
  variant?: TrackMapMarkerVariant;
  compact?: boolean;
  status?: TrackMapMarkerStatus;
};

type SpriteLayout = {
  width: number;
  height: number;
  fontSize: number;
  strokeWidth: number;
};

const SPRITE_PATHS: Record<TrackMapMarkerVariant, string> = {
  'f1-1990s': '/assets/track-markers/v4/tight/f1_1990s.png',
  'f1-2000s': '/assets/track-markers/v4/tight/f1_2000s.png',
  'f1-2010s': '/assets/track-markers/v4/tight/f1_2010s.png',
  'f1-2020s': '/assets/track-markers/v4/tight/f1_2020s.png',
  'nascar-1990s': '/assets/track-markers/v4/tight/nascar_1990s.png',
  'nascar-2000s': '/assets/track-markers/v4/tight/nascar_2000s.png',
  'nascar-2010s': '/assets/track-markers/v4/tight/nascar_2010s.png',
  'nascar-2020s': '/assets/track-markers/v4/tight/nascar_2020s.png',
  'indycar-1990s': '/assets/track-markers/v4/tight/indycar_1990s.png',
  'indycar-2000s': '/assets/track-markers/v4/tight/indycar_2000s.png',
  'indycar-2010s': '/assets/track-markers/v4/tight/indycar_2010s.png',
  'indycar-2020s': '/assets/track-markers/v4/tight/indycar_2020s.png',
  'cart-1990s': '/assets/track-markers/v4/tight/cart_1990s.png',
  'cart-2000s': '/assets/track-markers/v4/tight/cart_2000s.png',
};

const BASE_FALLBACK: TrackMapMarkerVariant = 'f1-1990s';

const NORMAL_LAYOUT: Record<'f1' | 'nascar' | 'indycar' | 'cart', SpriteLayout> = {
  f1: { width: 50, height: 25, fontSize: 13, strokeWidth: 2.1 },
  nascar: { width: 56, height: 28, fontSize: 14, strokeWidth: 2.4 },
  indycar: { width: 50, height: 25, fontSize: 13, strokeWidth: 2.1 },
  cart: { width: 50, height: 25, fontSize: 13, strokeWidth: 2.1 },
};

const COMPACT_LAYOUT: Record<'f1' | 'nascar' | 'indycar' | 'cart', SpriteLayout> = {
  f1: { width: 38, height: 19, fontSize: 10, strokeWidth: 1.8 },
  nascar: { width: 42, height: 21, fontSize: 10.5, strokeWidth: 2.0 },
  indycar: { width: 38, height: 19, fontSize: 10, strokeWidth: 1.8 },
  cart: { width: 38, height: 19, fontSize: 10, strokeWidth: 1.8 },
};

const NUMBER_ANCHOR = { x: 0.5, y: 0.5 };

export function resolveTrackMapMarkerVariant(series?: string, year?: number): TrackMapMarkerVariant {
  const normalizedSeries = normalizeSeries(series);
  const decade = decadeFromYear(year);

  if (normalizedSeries === 'f1') {
    if (decade === '1990s') return 'f1-1990s';
    if (decade === '2000s') return 'f1-2000s';
    if (decade === '2010s') return 'f1-2010s';
    if (decade === '2020s') return 'f1-2020s';
  }

  if (normalizedSeries === 'nascar') {
    if (decade === '1990s') return 'nascar-1990s';
    if (decade === '2000s') return 'nascar-2000s';
    if (decade === '2010s') return 'nascar-2010s';
    if (decade === '2020s') return 'nascar-2020s';
  }

  if (normalizedSeries === 'indycar') {
    if (decade === '1990s') return 'indycar-1990s';
    if (decade === '2000s') return 'indycar-2000s';
    if (decade === '2010s') return 'indycar-2010s';
    if (decade === '2020s') return 'indycar-2020s';
  }

  if (normalizedSeries === 'cart' || normalizedSeries === 'champcar') {
    if (decade === '1990s') return 'cart-1990s';
    if (decade === '2000s') return 'cart-2000s';
  }

  return BASE_FALLBACK;
}

export function TrackMapMarker({
  x,
  y,
  headingDeg,
  teamColor,
  number,
  rank,
  gapToLeader,
  variant = BASE_FALLBACK,
  compact = false,
  status,
}: TrackMapMarkerProps) {
  const id = useId();
  const sprite = SPRITE_PATHS[variant] ?? SPRITE_PATHS[BASE_FALLBACK];
  const layout = compact ? compactLayoutFor(variant) : layoutFor(variant);
  const label = number == null || number === '' ? '' : String(number);
  const titleBits = [`marker ${variant}`, `heading ${headingDeg.toFixed(1)}deg`];
  if (rank != null && label) {
    titleBits.unshift(`P${rank} car ${label}${gapToLeader != null ? `, ${gapToLeader.toFixed(1)}s behind leader` : ''}`);
  }
  if (status?.leader) titleBits.push('leader');
  if (status?.player) titleBits.push('player');
  if (status?.inPit) titleBits.push('in pit');
  if (status?.damaged) titleBits.push('damaged');
  if (status?.fastestLap) titleBits.push('fastest lap');

  const filterId = `${id}-tint`;
  const spriteX = -layout.width / 2;
  const spriteY = -layout.height / 2;

  return (
    <g transform={`translate(${x} ${y}) rotate(${headingDeg})`} data-track-map-marker-variant={variant}>
      <title>{titleBits.join(' · ')}</title>
      <defs>
        <filter id={filterId} colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values={tintMatrixValues(teamColor)}
          />
        </filter>
      </defs>

      <image
        href={sprite}
        x={spriteX}
        y={spriteY}
        width={layout.width}
        height={layout.height}
        preserveAspectRatio="xMidYMid meet"
        filter={`url(#${filterId})`}
      />

      {label ? (
        <text
          x={spriteX + layout.width * NUMBER_ANCHOR.x}
          y={spriteY + layout.height * NUMBER_ANCHOR.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          stroke="#09090b"
          strokeWidth={layout.strokeWidth}
          paintOrder="stroke"
          fontSize={layout.fontSize}
          fontWeight="900"
          fontFamily='"Arial Narrow", "DejaVu Sans Condensed", "Liberation Sans Narrow", sans-serif'
        >
          {label}
        </text>
      ) : null}

      {status?.leader ? <circle cx={0} cy={-layout.height * 0.72} r={compact ? 2.8 : 3.6} fill="#facc15" stroke="#111827" strokeWidth="1" /> : null}
      {status?.player ? <rect x={-layout.width * 0.48} y={-layout.height * 0.16} width={compact ? 2.8 : 3.6} height={compact ? 11 : 13} rx="1.4" fill="#e0f2fe" opacity="0.95" /> : null}
      {status?.inPit ? <rect x={-layout.width * 0.16} y={layout.height * 0.34} width={compact ? 14 : 18} height={compact ? 2.8 : 3.4} rx="1.4" fill="#f59e0b" opacity="0.92" /> : null}
      {status?.damaged ? <path d={`M ${-layout.width * 0.22} ${layout.height * 0.34} L ${layout.width * 0.22} ${-layout.height * 0.34}`} stroke="#ef4444" strokeWidth={compact ? 1.9 : 2.4} strokeLinecap="round" /> : null}
      {status?.fastestLap ? (
        <path
          d="M 0 -12 L 2 -8.4 L 6.4 -8 L 3.5 -5.4 L 4.4 -1.2 L 0 -3 L -4.4 -1.2 L -3.5 -5.4 L -6.4 -8 L -2 -8.4 Z"
          fill="#a855f7"
          stroke="#111827"
          strokeWidth="1"
        />
      ) : null}
    </g>
  );
}

export function headingFromPath(points: readonly (readonly [number, number])[], index: number): number {
  if (points.length < 2) return 0;
  const current = points[index] ?? points[0];
  const next = points[(index + 1) % points.length] ?? points[0];
  return Math.atan2(next[1] - current[1], next[0] - current[0]) * (180 / Math.PI);
}

export function headingOnOval(progress: number): number {
  const angle = normalizeProgress(progress) * Math.PI * 2 - Math.PI / 2;
  const dx = -Math.sin(angle);
  const dy = Math.cos(angle);
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

export function ovalPointAt(progress: number, cx: number, cy: number, rx: number, ry: number): { x: number; y: number } {
  const angle = normalizeProgress(progress) * Math.PI * 2 - Math.PI / 2;
  return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
}

export function normalizeProgress(value: number): number {
  return ((value % 1) + 1) % 1;
}

function normalizeSeries(series?: string): string {
  return series?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
}

function decadeFromYear(year?: number): '1990s' | '2000s' | '2010s' | '2020s' | null {
  if (typeof year !== 'number' || !Number.isFinite(year)) return null;
  if (year >= 1990 && year <= 1999) return '1990s';
  if (year >= 2000 && year <= 2009) return '2000s';
  if (year >= 2010 && year <= 2019) return '2010s';
  if (year >= 2020 && year <= 2026) return '2020s';
  return null;
}

function layoutFor(variant: TrackMapMarkerVariant): SpriteLayout {
  return seriesLayout(normalizeVariantSeries(variant), NORMAL_LAYOUT);
}

function compactLayoutFor(variant: TrackMapMarkerVariant): SpriteLayout {
  return seriesLayout(normalizeVariantSeries(variant), COMPACT_LAYOUT);
}

function seriesLayout(series: 'f1' | 'nascar' | 'indycar' | 'cart', layouts: Record<'f1' | 'nascar' | 'indycar' | 'cart', SpriteLayout>): SpriteLayout {
  return layouts[series];
}

function normalizeVariantSeries(variant: TrackMapMarkerVariant): 'f1' | 'nascar' | 'indycar' | 'cart' {
  if (variant.startsWith('nascar')) return 'nascar';
  if (variant.startsWith('indycar')) return 'indycar';
  if (variant.startsWith('cart')) return 'cart';
  return 'f1';
}

function tintMatrixValues(teamColor: string): string {
  const { r, g, b } = parseColor(teamColor);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  return `${rn} 0 0 0 0 0 ${gn} 0 0 0 0 0 ${bn} 0 0 0 0 0 0 1 0`;
}

function parseColor(color: string): { r: number; g: number; b: number } {
  const normalized = color.trim();

  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }

  const rgbMatch = normalized.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(',')
      .map((part) => Number.parseFloat(part.trim()))
      .filter((value) => Number.isFinite(value));
    if (parts.length >= 3) {
      return {
        r: clamp(parts[0]),
        g: clamp(parts[1]),
        b: clamp(parts[2]),
      };
    }
  }

  return { r: 148, g: 163, b: 184 };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
