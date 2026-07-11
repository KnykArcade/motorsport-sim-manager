#!/usr/bin/env python3
"""Generate scenic-art reference images and marker points from track geometry.

Example:
  python scripts/trackmap/generate_trackmap_reference.py \
    --track paul-ricard-historic=paulRicard \
    --track jerez-historic=jerez \
    --output-dir /home/ubuntu/batch2_refs \
    --points-file /home/ubuntu/batch2_points.txt

The geometry source stores points normalized to each track's bounds. Reference
images use a 1536x768 canvas with a 90px margin; marker points use the app's
1000x500 panel with the same 58.6px margin as historic image maps.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw


CANVAS_WIDTH = 1536
CANVAS_HEIGHT = 768
REFERENCE_MARGIN_X = 90.0
REFERENCE_MARGIN_Y = 90.0
REFERENCE_WIDTH = 1356.0
REFERENCE_HEIGHT = 588.0

MAP_MARGIN = 58.6
MAP_WIDTH = 882.8
MAP_HEIGHT = 382.8

GEOMETRY_PATH = Path(__file__).resolve().parents[2] / 'src/data/trackMaps/trackMapGeometry.ts'
GEOMETRY_ARRAY_RE = re.compile(
    r'export const TRACK_MAP_GEOMETRIES = (\[.*?\]) as const satisfies',
    re.DOTALL,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--track',
        action='append',
        metavar='GEOMETRY_ID=KEY',
        help='Track geometry ID and output key; may be repeated.',
    )
    parser.add_argument('--geometry-id', help='Generate one geometry ID.')
    parser.add_argument('--key', help='Output key for --geometry-id.')
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path('/home/ubuntu/batch2_refs'),
        help='Directory for reference PNGs.',
    )
    parser.add_argument(
        '--points-file',
        type=Path,
        default=Path('/home/ubuntu/batch2_points.txt'),
        help='Output text file for formatted marker arrays.',
    )
    args = parser.parse_args()

    specs = list(args.track or [])
    if args.geometry_id or args.key:
        if not args.geometry_id or not args.key:
            parser.error('--geometry-id and --key must be provided together')
        specs.append(f'{args.geometry_id}={args.key}')
    if not specs:
        parser.error('provide at least one --track or --geometry-id/--key pair')
    return args, specs


def load_geometries() -> dict[str, dict]:
    source = GEOMETRY_PATH.read_text(encoding='utf-8')
    match = GEOMETRY_ARRAY_RE.search(source)
    if not match:
        raise RuntimeError(f'Could not locate TRACK_MAP_GEOMETRIES in {GEOMETRY_PATH}')
    geometries = json.loads(match.group(1))
    return {geometry['id']: geometry for geometry in geometries}


def parse_specs(specs: Iterable[str]) -> list[tuple[str, str]]:
    parsed: list[tuple[str, str]] = []
    seen_keys: set[str] = set()
    for spec in specs:
        geometry_id, separator, key = spec.partition('=')
        if not separator or not geometry_id or not key:
            raise ValueError(f'Invalid --track value {spec!r}; expected GEOMETRY_ID=KEY')
        if key in seen_keys:
            raise ValueError(f'Duplicate output key: {key}')
        seen_keys.add(key)
        parsed.append((geometry_id, key))
    return parsed


def map_points(points: Sequence[Sequence[float]]) -> list[tuple[float, float]]:
    return [
        (
            round(MAP_MARGIN + point[0] * MAP_WIDTH, 1),
            round(MAP_MARGIN + point[1] * MAP_HEIGHT, 1),
        )
        for point in points
    ]


def reference_points(points: Sequence[Sequence[float]]) -> list[tuple[float, float]]:
    return [
        (
            REFERENCE_MARGIN_X + point[0] * REFERENCE_WIDTH,
            REFERENCE_MARGIN_Y + point[1] * REFERENCE_HEIGHT,
        )
        for point in points
    ]


def catmull_rom_closed(points: Sequence[tuple[float, float]], samples_per_segment: int = 8) -> list[tuple[float, float]]:
    """Return a smooth closed path sampled from the source centerline."""
    if len(points) < 3:
        raise ValueError('A closed track requires at least three points')
    sampled: list[tuple[float, float]] = []
    count = len(points)
    for index in range(count):
        p0 = points[(index - 1) % count]
        p1 = points[index]
        p2 = points[(index + 1) % count]
        p3 = points[(index + 2) % count]
        for step in range(samples_per_segment):
            t = step / samples_per_segment
            t2 = t * t
            t3 = t2 * t
            x = 0.5 * (
                (2 * p1[0])
                + (-p0[0] + p2[0]) * t
                + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
            )
            y = 0.5 * (
                (2 * p1[1])
                + (-p0[1] + p2[1]) * t
                + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
            )
            sampled.append((x, y))
    sampled.append(sampled[0])
    return sampled


def distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(b[0] - a[0], b[1] - a[1])


def draw_dashed_line(
    draw: ImageDraw.ImageDraw,
    points: Sequence[tuple[float, float]],
    fill: tuple[int, int, int],
    width: int,
    dash_length: float = 22.0,
    gap_length: float = 18.0,
) -> None:
    pattern_length = dash_length + gap_length
    distance_into_pattern = 0.0
    for start, end in zip(points, points[1:]):
        segment_length = distance(start, end)
        if segment_length == 0:
            continue
        ux = (end[0] - start[0]) / segment_length
        uy = (end[1] - start[1]) / segment_length
        position = 0.0
        while position < segment_length:
            offset = distance_into_pattern % pattern_length
            remaining_pattern = pattern_length - offset
            run = min(segment_length - position, remaining_pattern)
            if offset < dash_length:
                dash_end = min(run, dash_length - offset)
                x1 = start[0] + ux * position
                y1 = start[1] + uy * position
                x2 = start[0] + ux * (position + dash_end)
                y2 = start[1] + uy * (position + dash_end)
                draw.line((x1, y1, x2, y2), fill=fill, width=width)
            position += run
            distance_into_pattern += run


def render_reference(points: Sequence[Sequence[float]], path: Path) -> None:
    image = Image.new('RGB', (CANVAS_WIDTH, CANVAS_HEIGHT), (0, 0, 0))
    draw = ImageDraw.Draw(image)
    smooth = catmull_rom_closed(reference_points(points))
    draw.line(smooth, fill=(96, 100, 104), width=34, joint='curve')
    radius = 17
    for x, y in smooth[:-1]:
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(96, 100, 104))
    draw_dashed_line(draw, smooth, fill=(242, 242, 242), width=3)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format='PNG')


def format_points(key: str, points: Sequence[tuple[float, float]]) -> str:
    lines = [f'{key}: [']
    for start in range(0, len(points), 16):
        row = ', '.join(f'[{x:g}, {y:g}]' for x, y in points[start:start + 16])
        lines.append(f'  {row},')
    lines.append('],')
    return '\n'.join(lines)


def main() -> None:
    args, raw_specs = parse_args()
    specs = parse_specs(raw_specs)
    geometries = load_geometries()
    output_blocks: list[str] = []
    for geometry_id, key in specs:
        geometry = geometries.get(geometry_id)
        if geometry is None:
            raise KeyError(f'Unknown geometry ID: {geometry_id}')
        points = geometry['points']
        render_reference(points, args.output_dir / f'{key}.png')
        output_blocks.append(format_points(key, map_points(points)))
        print(f'{geometry_id} -> {args.output_dir / f"{key}.png"} ({len(points)} points)')

    args.points_file.parent.mkdir(parents=True, exist_ok=True)
    args.points_file.write_text('\n'.join(output_blocks) + '\n', encoding='utf-8')
    print(f'points -> {args.points_file}')


if __name__ == '__main__':
    main()
