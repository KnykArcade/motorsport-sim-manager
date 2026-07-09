import type { RaceSeries } from './seriesMarker';

export type RaceMapSeriesMarkerProps = {
  x: number;
  y: number;
  series: RaceSeries;
  number: string | number;
  primaryColor: string;
  accentColor?: string;
  isPlayer?: boolean;
  rotationDeg?: number; // optional; leave 0 if markers do not rotate
  selected?: boolean;
};

const PLAYER_RADIUS = 15;
const AI_RADIUS = 15;

// The provided SVG templates are drawn on a 24×24 viewBox with the shape
// centered at (12,12) and an outer radius of ~9.4. Scale to the requested
// 15px game footprint.
const TEMPLATE_SCALE = 15 / 9.4;

function MarkerShape({
  series,
  primaryColor,
  accentColor = "#f7f7f7",
}: {
  series: RaceSeries;
  primaryColor: string;
  accentColor?: string;
}) {
  const dark = "#17191c";
  const white = "#f7f7f7";
  const black = "#050505";
  const plate = "#f2f2f2";

  return (
    <g transform={`scale(${TEMPLATE_SCALE})`}>
      <g transform="translate(-12 -12)">
        {series === "f1" && (
          <g>
            <circle
              cx="12"
              cy="12"
              r="9.4"
              fill="none"
              stroke={black}
              strokeWidth={2.25}
            />
            <circle cx="12" cy="12" r="9.4" fill={dark} />
            <circle
              cx="12"
              cy="12"
              r="9.4"
              fill="none"
              stroke={white}
              strokeWidth={1.25}
            />
            <path
              d="M3.2 7.2 Q5.0 6.1 7.2 5.6 L7.2 18.4 Q5.0 17.9 3.2 16.8 Q4.0 12 3.2 7.2 Z"
              fill={accentColor}
              opacity={0.88}
            />
            <path
              d="M20.8 7.2 Q19.0 6.1 16.8 5.6 L16.8 18.4 Q19.0 17.9 20.8 16.8 Q20.0 12 20.8 7.2 Z"
              fill={accentColor}
              opacity={0.88}
            />
            <path
              d="M12 2.75 L15.25 8.15 L15.0 15.8 L12 21.3 L9.0 15.8 L8.75 8.15 Z"
              fill={primaryColor}
            />
            <path
              d="M12 5.2 L13.7 8.6 V15.4 L12 18.7 L10.3 15.4 V8.6 Z"
              fill={dark}
              opacity={0.55}
            />
            <path
              d="M12 7.15 A4.85 4.85 0 1 1 12 16.85 A4.85 4.85 0 1 1 12 7.15"
              fill={plate}
              stroke={black}
              strokeWidth={0.85}
            />
            <path
              d="M12 3.4 V6.8 M12 17.2 V20.4"
              stroke={white}
              strokeWidth={0.45}
              strokeLinecap="round"
              opacity={0.72}
            />
            <path
              d="M4.1 7.9 Q6.1 7.1 8.1 7.0 M15.9 7.0 Q17.9 7.1 19.9 7.9"
              stroke={white}
              strokeWidth={0.45}
              strokeLinecap="round"
              opacity={0.72}
            />
          </g>
        )}

        {series === "nascar" && (
          <g>
            <path
              d="M5.1 3.0 H18.9 L20.8 6.2 V15.1 L12 21.1 L3.2 15.1 V6.2 Z"
              fill="none"
              stroke={black}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M5.1 3.0 H18.9 L20.8 6.2 V15.1 L12 21.1 L3.2 15.1 V6.2 Z"
              fill={dark}
            />
            <path
              d="M5.1 3.0 H18.9 L20.8 6.2 V15.1 L12 21.1 L3.2 15.1 V6.2 Z"
              fill="none"
              stroke={white}
              strokeWidth={1.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M4.45 6.1 L6.7 4.15 H8.5 V17.2 L12 19.65 L7.2 18.15 L4.45 14.5 Z"
              fill={primaryColor}
            />
            <path
              d="M19.55 6.1 L17.3 4.15 H15.5 V17.2 L12 19.65 L16.8 18.15 L19.55 14.5 Z"
              fill={primaryColor}
            />
            <path
              d="M7.25 4.35 H16.75 L18.65 6.85 H5.35 Z"
              fill={accentColor}
              opacity={0.96}
            />
            <path
              d="M6.1 7.15 H17.9 V15.1 L12 18.85 L6.1 15.1 Z"
              fill={dark}
            />
            <path
              d="M7.05 7.05 H16.95 Q17.75 7.05 17.75 7.85 V13.75 Q17.75 14.55 16.95 14.55 H7.05 Q6.25 14.55 6.25 13.75 V7.85 Q6.25 7.05 7.05 7.05 Z"
              fill={plate}
              stroke={black}
              strokeWidth={0.85}
            />
            <path
              d="M5.2 6.4 H18.8"
              stroke={white}
              strokeWidth={0.45}
              strokeLinecap="round"
              opacity={0.72}
            />
            <path
              d="M5.2 14.8 L12 19.0 L18.8 14.8"
              stroke={white}
              strokeWidth={0.45}
              strokeLinecap="round"
              opacity={0.72}
            />
            <path
              d="M8.7 4.15 V6.2 M15.3 4.15 V6.2"
              stroke={white}
              strokeWidth={0.45}
              strokeLinecap="round"
              opacity={0.72}
            />
          </g>
        )}

        {series === "indycar" && (
          <g>
            <circle
              cx="12"
              cy="12"
              r="9.25"
              fill="none"
              stroke={black}
              strokeWidth={2.25}
            />
            <circle cx="12" cy="12" r="9.25" fill={dark} />
            <circle
              cx="12"
              cy="12"
              r="9.25"
              fill="none"
              stroke={white}
              strokeWidth={1.25}
            />
            <path
              d="M7.6 3.9 H16.4 L17.35 6.1 Q19.3 7.6 20.3 9.9 H17.4 Q16.7 8.05 15.1 6.95 H8.9 Q7.3 8.05 6.6 9.9 H3.7 Q4.7 7.6 6.65 6.1 Z"
              fill={accentColor}
              opacity={0.96}
            />
            <path
              d="M12 3.05 L15.9 6.95 L17.0 11.8 L15.8 17.05 L12 20.95 L8.2 17.05 L7.0 11.8 L8.1 6.95 Z"
              fill={primaryColor}
            />
            <path
              d="M12 5.35 L14.2 8.3 L14.85 12 L14.1 15.8 L12 18.65 L9.9 15.8 L9.15 12 L9.8 8.3 Z"
              fill={dark}
              opacity={0.55}
            />
            <path
              d="M2.85 10.2 H5.25 Q5.0 12 5.25 13.8 H2.85 Z"
              fill={accentColor}
            />
            <path
              d="M18.75 10.2 H21.15 V13.8 H18.75 Q19.0 12 18.75 10.2 Z"
              fill={accentColor}
            />
            <path
              d="M12 7.35 A4.65 4.65 0 1 1 12 16.65 A4.65 4.65 0 1 1 12 7.35"
              fill={plate}
              stroke={black}
              strokeWidth={0.85}
            />
            <path
              d="M8.25 6.9 H15.75"
              stroke={white}
              strokeWidth={0.45}
              strokeLinecap="round"
              opacity={0.72}
            />
            <path
              d="M6.2 10.0 Q5.9 12 6.2 14.0 M17.8 10.0 Q18.1 12 17.8 14.0"
              stroke={white}
              strokeWidth={0.45}
              strokeLinecap="round"
              opacity={0.72}
            />
          </g>
        )}

        {series === "cart" && (
          <g>
            <path
              d="M4.9 3.1 H19.1 L21.0 7.4 V15.0 L12 21.2 L3.0 15.0 V7.4 Z"
              fill="none"
              stroke={black}
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M4.9 3.1 H19.1 L21.0 7.4 V15.0 L12 21.2 L3.0 15.0 V7.4 Z"
              fill={dark}
            />
            <path
              d="M4.9 3.1 H19.1 L21.0 7.4 V15.0 L12 21.2 L3.0 15.0 V7.4 Z"
              fill="none"
              stroke={white}
              strokeWidth={1.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d="M12 4.2 L17.8 6.75 V15.05 L12 19.5 L6.2 15.05 V6.75 Z"
              fill={primaryColor}
            />
            <path
              d="M5.9 4.5 H18.1 L18.9 6.1 H5.1 Z"
              fill={accentColor}
              opacity={0.96}
            />
            <path
              d="M12 6.1 L15.8 8.0 V14.2 L12 17.15 L8.2 14.2 V8.0 Z"
              fill={dark}
              opacity={0.56}
            />
            <path
              d="M8.0 8.0 H16.0 Q16.9 8.0 16.9 8.9 V14.0 L12 17.3 L7.1 14.0 V8.9 Q7.1 8.0 8.0 8.0 Z"
              fill={plate}
              stroke={black}
              strokeWidth={0.85}
            />
            <path
              d="M3.2 7.9 H5.2 V14.2 H3.2 Z"
              fill={accentColor}
            />
            <path
              d="M18.8 7.9 H20.8 V14.2 H18.8 Z"
              fill={accentColor}
            />
            <path
              d="M6.4 6.6 H17.6"
              stroke={white}
              strokeWidth={0.45}
              strokeLinecap="round"
              opacity={0.72}
            />
            <path
              d="M8.2 14.1 L12 16.65 L15.8 14.1"
              stroke={white}
              strokeWidth={0.45}
              strokeLinecap="round"
              opacity={0.72}
            />
          </g>
        )}
      </g>
    </g>
  );
}

export function RaceMapSeriesMarker({
  x,
  y,
  series,
  number,
  primaryColor,
  accentColor = "#f7f7f7",
  isPlayer = false,
  rotationDeg = 0,
  selected = false,
}: RaceMapSeriesMarkerProps) {
  const radius = isPlayer ? PLAYER_RADIUS : AI_RADIUS;
  const scale = radius / PLAYER_RADIUS;

  return (
    <g transform={`translate(${x} ${y})`}>
      {selected && (
        <g>
          <circle r={radius + 7} fill="#ffd400" opacity={0.08} />
          <circle r={radius + 5} fill="#ffd400" opacity={0.14} />
          <circle r={radius + 3} fill="#ffd400" opacity={0.22} />
        </g>
      )}
      <g transform={`rotate(${rotationDeg}) scale(${scale})`}>
        <MarkerShape
          series={series}
          primaryColor={primaryColor}
          accentColor={accentColor}
        />
      </g>
      <text
        x={0}
        y={0.35}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={8}
        fontFamily="Impact, 'Arial Black', 'Roboto Condensed', sans-serif"
        fontWeight={900}
        fill="#111"
        stroke="#fff"
        strokeWidth={0.35}
        paintOrder="stroke"
        pointerEvents="none"
      >
        {number}
      </text>
    </g>
  );
}

export default RaceMapSeriesMarker;
