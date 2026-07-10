"""Build the locked F1 era marker layers from the approved pixel artwork.

The source cars are flattened RGBA files on a charcoal background. This script
uses the supplied white perimeter as the cutout boundary, blanks only the baked
front-number glyph, separates the two repaint channels, rotates the authoring
art from nose-down to the game's nose-right convention, and centers every layer
on a common 512px transparent canvas.

Build dependency: Pillow, NumPy, SciPy.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "artwork" / "f1-markers" / "approved"
PUBLIC_ROOT = ROOT / "public" / "assets" / "markers" / "f1"
MANIFEST_PATH = ROOT / "src" / "components" / "f1RasterMarkerDesigns.json"
CANVAS_SIZE = 512


ERAS = {
    "f1_1990s": {
        "label": "1990s",
        "source": "1990s.png",
        "directory": "1990s",
        "paint_order": ("color", "white"),
        "plate_inner": (99, 363, 115, 396),
        "number_anchor_source": (106.5, 379.0),
        "number_font_size": 2.65,
        "number_max_width": 2.05,
    },
    "f1_2000s": {
        "label": "2000s",
        "source": "2000s.png",
        "directory": "2000s",
        "paint_order": ("color", "white"),
        "plate_inner": (105, 373, 124, 404),
        "number_anchor_source": (114.5, 388.5),
        "number_font_size": 2.6,
        "number_max_width": 2.05,
    },
    "f1_2010s": {
        "label": "2010s",
        "source": "2010s.png",
        "directory": "2010s",
        "paint_order": ("white", "color"),
        "plate_inner": (93, 332, 129, 371),
        "number_anchor_source": (110.5, 351.5),
        "number_font_size": 2.55,
        "number_max_width": 2.15,
    },
    "f1_2020s": {
        "label": "2020s",
        "source": "2020s.png",
        "directory": "2020s",
        "paint_order": ("color", "white"),
        "plate_inner": (103, 337, 139, 375),
        "number_anchor_source": (121.0, 356.0),
        "number_font_size": 2.55,
        "number_max_width": 2.15,
    },
}


def extract_alpha(image: Image.Image) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    luminance = rgb.mean(axis=2)
    saturation = maximum - minimum

    # The background is dark and nearly neutral. Painted pixels and the white
    # outline provide closed barriers around tyres, wings, body and suspension.
    barrier = (luminance > 53) | ((saturation > 18) & (maximum > 38))
    barrier = ndimage.binary_dilation(barrier, iterations=1)
    barrier = ndimage.binary_closing(barrier, iterations=1)
    filled = ndimage.binary_fill_holes(barrier)

    labels, count = ndimage.label(filled)
    kept = np.zeros_like(filled)
    center_x = image.width / 2
    for label in range(1, count + 1):
        ys, xs = np.where(labels == label)
        if len(xs) < 14:
            continue
        if abs(float(xs.mean()) - center_x) <= image.width * 0.48:
            kept |= labels == label

    kept = ndimage.binary_dilation(kept, iterations=1)
    alpha = Image.fromarray((kept * 255).astype(np.uint8), mode="L")
    return alpha.filter(ImageFilter.GaussianBlur(0.45))


def blank_number(image: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    result = np.array(image.convert("RGBA"), copy=True)
    left, top, right, bottom = box
    roi = result[top:bottom, left:right, :3]
    dark = roi[roi.mean(axis=2) < 30]
    fill = np.median(dark, axis=0) if len(dark) else np.array([6, 7, 8])
    height = max(1, bottom - top)
    for row in range(height):
        shade = np.clip(fill + (row / height - 0.5) * 3, 0, 255)
        result[top + row, left:right, :3] = shade.astype(np.uint8)
    return Image.fromarray(result, mode="RGBA")


def soft_mask(binary: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    binary = ndimage.binary_closing(binary, iterations=1)
    softened = ndimage.gaussian_filter(binary.astype(np.float32), sigma=0.58)
    softened = np.clip(softened, 0, 1) * (alpha.astype(np.float32) / 255)
    return np.round(softened * 255).astype(np.uint8)


def paint_masks(image: Image.Image, alpha_image: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    alpha = np.asarray(alpha_image, dtype=np.uint8)
    maximum = rgb.max(axis=2)
    minimum = rgb.min(axis=2)
    luminance = rgb.mean(axis=2)
    saturation = maximum - minimum
    distance = ndimage.distance_transform_edt(alpha > 28)

    color = (saturation > 18) & (maximum > 28) & (distance > 1.35)
    white = (saturation <= 30) & (luminance > 46) & (distance > 2.25)

    # Keep the two channels disjoint at anti-aliased boundaries.
    white &= ~color
    return soft_mask(color, alpha), soft_mask(white, alpha)


def grayscale_shading(image: Image.Image, mask: np.ndarray) -> Image.Image:
    rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
    value = rgb.max(axis=2)
    rgba = np.zeros((*value.shape, 4), dtype=np.uint8)
    rgba[:, :, :3] = value[:, :, None]
    rgba[:, :, 3] = mask
    return Image.fromarray(rgba, mode="RGBA")


def fixed_details(image: Image.Image, alpha: np.ndarray, primary: np.ndarray, secondary: np.ndarray) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8).copy()
    paint = np.maximum(primary, secondary).astype(np.float32) / 255
    fixed_alpha = np.round(alpha.astype(np.float32) * (1 - paint)).astype(np.uint8)
    rgba[:, :, 3] = fixed_alpha
    return Image.fromarray(rgba, mode="RGBA")


def white_mask(mask: np.ndarray) -> Image.Image:
    rgba = np.full((*mask.shape, 4), 255, dtype=np.uint8)
    rgba[:, :, 3] = mask
    return Image.fromarray(rgba, mode="RGBA")


def runtime_canvas(image: Image.Image) -> Image.Image:
    # Pillow's ROTATE_90 is counter-clockwise: source nose-down becomes +X.
    rotated = image.transpose(Image.Transpose.ROTATE_90)
    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    x = (CANVAS_SIZE - rotated.width) // 2
    y = (CANVAS_SIZE - rotated.height) // 2
    canvas.alpha_composite(rotated, (x, y))
    return canvas


def runtime_anchor(source_size: tuple[int, int], source_anchor: tuple[float, float]) -> tuple[float, float]:
    width, height = source_size
    source_x, source_y = source_anchor
    rotated_x = source_y
    rotated_y = width - source_x
    canvas_x = rotated_x + (CANVAS_SIZE - height) / 2
    canvas_y = rotated_y + (CANVAS_SIZE - width) / 2
    return (canvas_x / CANVAS_SIZE * 20 - 10, canvas_y / CANVAS_SIZE * 20 - 10)


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def main() -> None:
    manifest: dict[str, dict[str, object]] = {}

    for asset_id, spec in ERAS.items():
        source = Image.open(SOURCE_ROOT / spec["source"]).convert("RGBA")
        alpha_image = extract_alpha(source)
        numberless = blank_number(source, spec["plate_inner"])
        numberless.putalpha(alpha_image)

        color_mask, white_paint_mask = paint_masks(numberless, alpha_image)
        mask_by_kind = {"color": color_mask, "white": white_paint_mask}
        primary_mask = mask_by_kind[spec["paint_order"][0]]
        secondary_mask = mask_by_kind[spec["paint_order"][1]]
        alpha = np.asarray(alpha_image, dtype=np.uint8)

        output = PUBLIC_ROOT / spec["directory"]
        save(runtime_canvas(numberless), output / "master-numberless.png")
        save(runtime_canvas(grayscale_shading(numberless, primary_mask)), output / "primary-shading.png")
        save(runtime_canvas(grayscale_shading(numberless, secondary_mask)), output / "secondary-shading.png")
        save(runtime_canvas(fixed_details(numberless, alpha, primary_mask, secondary_mask)), output / "fixed-details.png")
        save(runtime_canvas(white_mask(primary_mask)), output / "primary-mask.png")
        save(runtime_canvas(white_mask(secondary_mask)), output / "secondary-mask.png")
        save(runtime_canvas(white_mask(alpha)), output / "silhouette-mask.png")

        anchor_x, anchor_y = runtime_anchor(source.size, spec["number_anchor_source"])
        prefix = f"/assets/markers/f1/{spec['directory']}"
        manifest[asset_id] = {
            "label": spec["label"],
            "canvasSize": CANVAS_SIZE,
            "forwardAxis": "+x",
            "assets": {
                "master": f"{prefix}/master-numberless.png",
                "primaryShading": f"{prefix}/primary-shading.png",
                "secondaryShading": f"{prefix}/secondary-shading.png",
                "fixedDetails": f"{prefix}/fixed-details.png",
                "primaryMask": f"{prefix}/primary-mask.png",
                "secondaryMask": f"{prefix}/secondary-mask.png",
                "silhouetteMask": f"{prefix}/silhouette-mask.png",
            },
            "numberLocation": "front nose between front tyres",
            "numberAnchor": {"x": round(anchor_x, 3), "y": round(anchor_y, 3)},
            "numberFontSize": spec["number_font_size"],
            "numberMaxWidth": spec["number_max_width"],
            "numberStrokeWidth": 0.34,
        }

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
