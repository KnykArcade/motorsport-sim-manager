export type RaceSeries = "nascar" | "f1" | "indycar" | "cart";

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

const PLAYER_RADIUS = 9;
const AI_RADIUS = 7;
const PLAYER_STROKE = 2.5;
const AI_STROKE = 1;

function MarkerShape({ series, primaryColor, accentColor = "#f7f7f7", strokeWidth }: {
  series: RaceSeries;
  primaryColor: string;
  accentColor?: string;
  strokeWidth: number;
}) {
  const dark = "#17191c";
  const white = "#f7f7f7";
  const black = "#050505";
  const plate = "#f2f2f2";
  const common = {
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };

  // Coordinates are centered around 0,0 and fit inside a 18px player footprint before scaling.
  switch (series) {
    case "nascar":
      return <g>
        <path d="M-5.2 -8.2 H5.2 L7.4 -5.0 V3.4 L0 8.3 L-7.4 3.4 V-5.0 Z" fill={dark} stroke={black} strokeWidth={strokeWidth + 0.9} {...common}/>
        <path d="M-5.2 -8.2 H5.2 L7.4 -5.0 V3.4 L0 8.3 L-7.4 3.4 V-5.0 Z" fill={dark} stroke={white} strokeWidth={strokeWidth} {...common}/>
        <path d="M-6.0 -4.7 L-4.0 -7.1 H-2.6 V4.4 L0 6.9 L-4.8 5.5 L-6.0 3.0 Z" fill={primaryColor}/>
        <path d="M6.0 -4.7 L4.0 -7.1 H2.6 V4.4 L0 6.9 L4.8 5.5 L6.0 3.0 Z" fill={primaryColor}/>
        <path d="M-4.8 -6.9 H4.8 L6.1 -4.8 H-6.1 Z" fill={accentColor} opacity={0.95}/>
        <path d="M-5.2 -4.7 H5.2 V3.4 L0 6.7 L-5.2 3.4 Z" fill={dark}/>
        <rect x={-5.3} y={-4.6} width={10.6} height={7.7} rx={1.1} fill={plate} stroke={black} strokeWidth={0.7}/>
      </g>;
    case "f1":
      return <g>
        <circle r={8.25} fill={dark} stroke={black} strokeWidth={strokeWidth + 0.9}/>
        <circle r={8.25} fill={dark} stroke={white} strokeWidth={strokeWidth}/>
        <path d="M-7.8 -4.7 Q-6.0 -5.8 -4.1 -6.1 V6.1 Q-6.0 5.8 -7.8 4.7 Q-6.9 0 -7.8 -4.7 Z" fill={accentColor} opacity={0.9}/>
        <path d="M7.8 -4.7 Q6.0 -5.8 4.1 -6.1 V6.1 Q6.0 5.8 7.8 4.7 Q6.9 0 7.8 -4.7 Z" fill={accentColor} opacity={0.9}/>
        <path d="M0 -8.4 L3.0 -3.7 L2.8 3.9 L0 8.45 L-2.8 3.9 L-3.0 -3.7 Z" fill={primaryColor}/>
        <path d="M0 -5.7 L1.4 -2.9 V2.9 L0 5.7 L-1.4 2.9 V-2.9 Z" fill={dark} opacity={0.55}/>
        <circle r={4.65} fill={plate} stroke={black} strokeWidth={0.7}/>
      </g>;
    case "indycar":
      return <g>
        <circle r={8.15} fill={dark} stroke={black} strokeWidth={strokeWidth + 0.9}/>
        <circle r={8.15} fill={dark} stroke={white} strokeWidth={strokeWidth}/>
        <path d="M-3.8 -7.3 H3.8 L4.7 -5.25 Q6.7 -3.7 7.6 -1.5 H5.0 Q4.2 -3.3 2.7 -4.4 H-2.7 Q-4.2 -3.3 -5.0 -1.5 H-7.6 Q-6.7 -3.7 -4.7 -5.25 Z" fill={accentColor}/>
        <path d="M0 -8.2 L3.8 -4.5 L4.9 0 L3.7 4.6 L0 8.2 L-3.7 4.6 L-4.9 0 L-3.8 -4.5 Z" fill={primaryColor}/>
        <path d="M0 -5.7 L2.0 -2.7 L2.7 0 L2.0 2.7 L0 5.7 L-2.0 2.7 L-2.7 0 L-2.0 -2.7 Z" fill={dark} opacity={0.55}/>
        <rect x={-8.4} y={-1.8} width={2.4} height={3.6} rx={0.4} fill={accentColor}/>
        <rect x={6.0} y={-1.8} width={2.4} height={3.6} rx={0.4} fill={accentColor}/>
        <circle r={4.55} fill={plate} stroke={black} strokeWidth={0.7}/>
      </g>;
    case "cart":
      return <g>
        <path d="M-5.3 -8.1 H5.3 L7.1 -4.2 V3.4 L0 8.4 L-7.1 3.4 V-4.2 Z" fill={dark} stroke={black} strokeWidth={strokeWidth + 0.9} {...common}/>
        <path d="M-5.3 -8.1 H5.3 L7.1 -4.2 V3.4 L0 8.4 L-7.1 3.4 V-4.2 Z" fill={dark} stroke={white} strokeWidth={strokeWidth} {...common}/>
        <path d="M0 -7.2 L5.4 -4.8 V3.5 L0 7.2 L-5.4 3.5 V-4.8 Z" fill={primaryColor}/>
        <path d="M-4.9 -6.6 H4.9 L5.8 -5.2 H-5.8 Z" fill={accentColor}/>
        <path d="M0 -5.4 L3.3 -3.7 V2.8 L0 5.8 L-3.3 2.8 V-3.7 Z" fill={dark} opacity={0.56}/>
        <path d="M-3.8 -3.7 H3.8 Q4.6 -3.7 4.6 -2.9 V2.8 L0 5.8 L-4.6 2.8 V-2.9 Q-4.6 -3.7 -3.8 -3.7 Z" fill={plate} stroke={black} strokeWidth={0.7}/>
        <rect x={-8.0} y={-3.5} width={1.8} height={6.4} rx={0.2} fill={accentColor}/>
        <rect x={6.2} y={-3.5} width={1.8} height={6.4} rx={0.2} fill={accentColor}/>
      </g>;
  }
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
  const strokeWidth = isPlayer ? PLAYER_STROKE : AI_STROKE;
  const scale = radius / PLAYER_RADIUS;

  return (
    <g transform={`translate(${x} ${y})`}>
      {selected && (
        <circle r={radius + 3} fill="none" stroke="#ffd400" strokeWidth={1.5} opacity={0.9} />
      )}
      <g transform={`rotate(${rotationDeg}) scale(${scale})`}>
        <MarkerShape
          series={series}
          primaryColor={primaryColor}
          accentColor={accentColor}
          strokeWidth={strokeWidth}
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
