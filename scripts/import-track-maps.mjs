import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const defaultSourceRoot = 'C:\\Users\\tnick\\CascadeProjects\\track-map-generation';
const sourceRoot = path.resolve(process.argv[2] ?? process.env.TRACK_MAP_SOURCE ?? defaultSourceRoot);
const manifestPath = path.join(sourceRoot, 'output', 'track_manifest.json');
const svgRoot = path.join(sourceRoot, 'svg-maps');
const publicOut = path.join(repoRoot, 'public', 'track-maps');
const dataOut = path.join(repoRoot, 'src', 'data', 'trackMaps', 'trackMapGeometry.ts');

const SAMPLE_COUNT = 96;
const manualHistoricalF1Maps = [
  { id: 'phoenix-street-circuit-historic', name: 'Phoenix Street Circuit', series: 'F1', year: 1990, svgFile: 'phoenix-2.svg', sourceFile: 'phoenix-2.svg' },
  { id: 'kyalami-grand-prix-circuit-historic', name: 'Kyalami Grand Prix Circuit', series: 'F1', year: 1992, svgFile: 'kyalami-2.svg', sourceFile: 'kyalami-2.svg' },
  { id: 'donington-park-historic', name: 'Donington Park', series: 'F1', year: 1993, svgFile: 'donington-1.svg', sourceFile: 'donington-1.svg' },
  { id: 'ti-circuit-aida-historic', name: 'TI Circuit Aida', series: 'F1', year: 1994, svgFile: 'aida-1.svg', sourceFile: 'aida-1.svg' },
  { id: 'autodromo-do-estoril-historic', name: 'Autodromo do Estoril', series: 'F1', year: 1995, svgFile: 'estoril-2.svg', sourceFile: 'estoril-2.svg' },
  { id: 'circuito-de-jerez-historic', name: 'Circuito de Jerez', series: 'F1', year: 1994, svgFile: 'jerez-1.svg', sourceFile: 'jerez-1.svg' },
  { id: 'jerez-historic', name: 'Jerez', series: 'F1', year: 1990, svgFile: 'jerez-1.svg', sourceFile: 'jerez-1.svg' },
  { id: 'adelaide-street-circuit-historic', name: 'Adelaide Street Circuit', series: 'F1', year: 1995, svgFile: 'adelaide-1.svg', sourceFile: 'adelaide-1.svg' },
  { id: 'paul-ricard-historic', name: 'Paul Ricard', series: 'F1', year: 1990, svgFile: 'paul-ricard-2.svg', sourceFile: 'paul-ricard-2.svg' },
  { id: 'autodromo-oscar-alfredo-galvez-historic', name: 'Autodromo Oscar Alfredo Galvez', series: 'F1', year: 1995, svgFile: 'buenos-aires-4.svg', sourceFile: 'buenos-aires-4.svg' },
];

function readManifest() {
  if (!existsSync(manifestPath)) {
    throw new Error(`Track manifest not found: ${manifestPath}`);
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function extractSvgGeometry(svg) {
  const paths = [...svg.matchAll(/<(?:[a-z0-9_-]+:)?path\b[^>]*\sd=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter(Boolean);
  if (paths.length > 0) return { kind: 'path', value: paths.sort((a, b) => b.length - a.length)[0] };

  const pointShapes = [
    ...svg.matchAll(/<(?:[a-z0-9_-]+:)?polyline\b[^>]*\spoints=["']([^"']+)["'][^>]*>/gi),
    ...svg.matchAll(/<(?:[a-z0-9_-]+:)?polygon\b[^>]*\spoints=["']([^"']+)["'][^>]*>/gi),
  ]
    .map((match) => match[1])
    .filter(Boolean);
  if (pointShapes.length > 0) return { kind: 'points', value: pointShapes.sort((a, b) => b.length - a.length)[0] };

  const ellipses = [
    ...svg.matchAll(/<(?:[a-z0-9_-]+:)?ellipse\b[^>]*>/gi),
    ...svg.matchAll(/<(?:[a-z0-9_-]+:)?circle\b[^>]*>/gi),
  ].map((match) => match[0]);
  if (ellipses.length > 0) return { kind: 'ellipse', value: ellipses.sort((a, b) => b.length - a.length)[0] };

  return null;
}

function tokenizePath(d) {
  return d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
}

function isCommand(token) {
  return /^[a-zA-Z]$/.test(token);
}

function cubic(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  };
}

function quadratic(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: mt ** 2 * p0.x + 2 * mt * t * p1.x + t ** 2 * p2.x,
    y: mt ** 2 * p0.y + 2 * mt * t * p1.y + t ** 2 * p2.y,
  };
}

function parsePath(d) {
  const tokens = tokenizePath(d);
  const points = [];
  let i = 0;
  let cmd = '';
  let current = { x: 0, y: 0 };
  let start = { x: 0, y: 0 };
  let lastCubicControl = null;
  let lastQuadraticControl = null;

  const hasNumber = () => i < tokens.length && !isCommand(tokens[i]);
  const num = () => Number(tokens[i++]);
  const push = (p) => {
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) points.push({ x: p.x, y: p.y });
    current = p;
  };
  const readPoint = (relative) => {
    const p = { x: num(), y: num() };
    return relative ? { x: current.x + p.x, y: current.y + p.y } : p;
  };

  while (i < tokens.length) {
    if (isCommand(tokens[i])) cmd = tokens[i++];
    const relative = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();

    if (upper === 'M') {
      const p = readPoint(relative);
      push(p);
      start = p;
      cmd = relative ? 'l' : 'L';
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }

    if (upper === 'Z') {
      push(start);
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }

    if (upper === 'L') {
      while (hasNumber()) push(readPoint(relative));
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }

    if (upper === 'H') {
      while (hasNumber()) {
        const x = num();
        push({ x: relative ? current.x + x : x, y: current.y });
      }
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }

    if (upper === 'V') {
      while (hasNumber()) {
        const y = num();
        push({ x: current.x, y: relative ? current.y + y : y });
      }
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }

    if (upper === 'C') {
      while (hasNumber()) {
        const p0 = current;
        const p1 = readPoint(relative);
        const p2 = readPoint(relative);
        const p3 = readPoint(relative);
        for (let step = 1; step <= 10; step += 1) push(cubic(p0, p1, p2, p3, step / 10));
        lastCubicControl = p2;
        lastQuadraticControl = null;
      }
      continue;
    }

    if (upper === 'S') {
      while (hasNumber()) {
        const p0 = current;
        const p1 = lastCubicControl
          ? { x: current.x * 2 - lastCubicControl.x, y: current.y * 2 - lastCubicControl.y }
          : current;
        const p2 = readPoint(relative);
        const p3 = readPoint(relative);
        for (let step = 1; step <= 10; step += 1) push(cubic(p0, p1, p2, p3, step / 10));
        lastCubicControl = p2;
        lastQuadraticControl = null;
      }
      continue;
    }

    if (upper === 'Q') {
      while (hasNumber()) {
        const p0 = current;
        const p1 = readPoint(relative);
        const p2 = readPoint(relative);
        for (let step = 1; step <= 10; step += 1) push(quadratic(p0, p1, p2, step / 10));
        lastQuadraticControl = p1;
        lastCubicControl = null;
      }
      continue;
    }

    if (upper === 'T') {
      while (hasNumber()) {
        const p0 = current;
        const p1 = lastQuadraticControl
          ? { x: current.x * 2 - lastQuadraticControl.x, y: current.y * 2 - lastQuadraticControl.y }
          : current;
        const p2 = readPoint(relative);
        for (let step = 1; step <= 10; step += 1) push(quadratic(p0, p1, p2, step / 10));
        lastQuadraticControl = p1;
        lastCubicControl = null;
      }
      continue;
    }

    if (upper === 'A') {
      while (hasNumber()) {
        const rx = num();
        const ry = num();
        const angle = num();
        const large = num();
        const sweep = num();
        const end = readPoint(relative);
        void rx;
        void ry;
        void angle;
        void large;
        void sweep;
        push(end);
      }
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }

    throw new Error(`Unsupported SVG path command "${cmd}" in path: ${d.slice(0, 80)}...`);
  }

  return points;
}

function parsePointList(pointsText) {
  const values = pointsText.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
  const points = [];
  for (let i = 0; i < values.length - 1; i += 2) {
    points.push({ x: values[i], y: values[i + 1] });
  }
  return points;
}

function parseEllipse(element) {
  const attr = (name) => {
    const match = element.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
    return match ? Number(match[1]) : null;
  };
  const cx = attr('cx') ?? 0;
  const cy = attr('cy') ?? 0;
  const rx = attr('rx') ?? attr('r') ?? 1;
  const ry = attr('ry') ?? attr('r') ?? rx;
  return Array.from({ length: SAMPLE_COUNT }, (_, index) => {
    const angle = (index / SAMPLE_COUNT) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function samplePoints(points, count) {
  if (points.length < 2) return [];
  const segments = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const length = distance(points[i - 1], points[i]);
    if (length <= 0) continue;
    segments.push({ from: points[i - 1], to: points[i], start: total, length });
    total += length;
  }
  if (total <= 0) return [];

  const sampled = [];
  for (let i = 0; i < count; i += 1) {
    const target = (i / count) * total;
    const segment = segments.find((s) => target >= s.start && target <= s.start + s.length) ?? segments[segments.length - 1];
    const local = segment.length ? (target - segment.start) / segment.length : 0;
    sampled.push({
      x: segment.from.x + (segment.to.x - segment.from.x) * local,
      y: segment.from.y + (segment.to.y - segment.from.y) * local,
    });
  }
  return sampled;
}

function normalizePoints(points) {
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return {
    bounds: {
      minX: round(minX),
      minY: round(minY),
      width: round(width),
      height: round(height),
    },
    points: points.map((p) => [round((p.x - minX) / width), round((p.y - minY) / height)]),
  };
}

function round(value) {
  return Number(value.toFixed(4));
}

function uniqueBySvg(tracks) {
  const seen = new Map();
  for (const track of tracks) {
    if (!track.svgExists || !track.svgFile) continue;
    if (!seen.has(track.svgFile)) seen.set(track.svgFile, track);
  }
  return [...seen.values()];
}

function allSourceTracks(manifestTracks) {
  return [
    ...uniqueBySvg(manifestTracks),
    ...manualHistoricalF1Maps.map((track) => ({
      ...track,
      svgExists: true,
      eventName: track.name,
      manualSourceDir: path.join(sourceRoot, 'external', 'f1-circuits-svg', 'circuits', 'minimal', 'white'),
    })),
  ];
}

function tsString(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function writeGeometry(entries, failures) {
  const body = `// AUTO-GENERATED by scripts/import-track-maps.mjs. Do not edit by hand.

export type TrackMapPoint = readonly [number, number];

export type TrackMapGeometry = {
  readonly id: string;
  readonly name: string;
  readonly series: string;
  readonly year: number;
  readonly eventName?: string;
  readonly svgFile: string;
  readonly lengthKm?: number;
  readonly laps?: number;
  readonly distanceKm?: number;
  readonly sectors?: number;
  readonly drsZones?: number;
  readonly bounds: {
    readonly minX: number;
    readonly minY: number;
    readonly width: number;
    readonly height: number;
  };
  readonly points: readonly TrackMapPoint[];
};

export const TRACK_MAP_IMPORT_SUMMARY = {
  generatedAt: ${tsString(new Date().toISOString())},
  source: ${tsString(sourceRoot)},
  imported: ${entries.length},
  failed: ${failures.length},
} as const;

export const TRACK_MAP_GEOMETRIES = ${tsString(entries)} as const satisfies readonly TrackMapGeometry[];
`;
  mkdirSync(path.dirname(dataOut), { recursive: true });
  writeFileSync(dataOut, body, 'utf8');
}

function main() {
  const manifest = readManifest();
  const entries = [];
  const failures = [];
  mkdirSync(publicOut, { recursive: true });

  for (const track of allSourceTracks(manifest.tracks ?? [])) {
    const svgPath = track.manualSourceDir
      ? path.join(track.manualSourceDir, track.sourceFile ?? track.svgFile)
      : path.join(svgRoot, track.svgFile);
    try {
      if (!existsSync(svgPath)) throw new Error(`Missing SVG file ${track.svgFile}`);
      const svg = readFileSync(svgPath, 'utf8');
      const geometry = extractSvgGeometry(svg);
      if (!geometry) throw new Error('No SVG track geometry found');
      const rawPoints =
        geometry.kind === 'path'
          ? parsePath(geometry.value)
          : geometry.kind === 'points'
            ? parsePointList(geometry.value)
            : parseEllipse(geometry.value);
      const sampled = samplePoints(rawPoints, SAMPLE_COUNT);
      if (sampled.length < 12) throw new Error(`Too few sampled points (${sampled.length})`);
      const normalized = normalizePoints(sampled);
      copyFileSync(svgPath, path.join(publicOut, track.svgFile));
      entries.push({
        id: track.id,
        name: track.name,
        series: track.series,
        year: track.year,
        eventName: track.eventName,
        svgFile: track.svgFile,
        lengthKm: track.lengthKm,
        laps: track.laps,
        distanceKm: track.distanceKm,
        sectors: track.sectors,
        drsZones: track.drsZones,
        bounds: normalized.bounds,
        points: normalized.points,
      });
    } catch (error) {
      failures.push({ id: track.id, svgFile: track.svgFile, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  entries.sort((a, b) => a.series.localeCompare(b.series) || a.name.localeCompare(b.name) || a.year - b.year);
  writeGeometry(entries, failures);

  const failurePreview = failures.slice(0, 8).map((f) => `${f.id}: ${f.reason}`).join('\n');
  console.log(`Imported ${entries.length} track maps into ${path.relative(repoRoot, dataOut)}.`);
  if (failures.length) {
    console.log(`Skipped ${failures.length} map(s):\n${failurePreview}`);
  }
}

main();
