#!/usr/bin/env python3
"""Build lossless WebP derivatives and a manifest for the photo gallery."""

from __future__ import annotations

import argparse
import io
import json
import re
from pathlib import Path

from PIL import Image, ImageCms, ImageOps


CITY_SPECS = (
    ("Italy", "italy", "Italy", "意大利"),
    ("Switerland", "switzerland", "Switzerland", "瑞士"),
    ("Berlin", "berlin", "Berlin", "柏林"),
    ("Spain", "spain", "Spain", "西班牙"),
    ("paris", "paris", "Paris", "巴黎"),
)
VALID_SUFFIXES = {".jpg", ".jpeg", ".png"}
# Responsive lossless display derivatives. Originals remain untouched outside the site.
SIZES = (960, 2560)
MANUAL_ROTATIONS = {
    ("Italy", "dscf7426"): 90,
    ("Italy", "dscf7473"): 90,
    ("Italy", "dscf7490"): 90,
    ("Berlin", "dscf4611"): 90,
    ("Berlin", "dscf4636"): 90,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Folder containing city subfolders")
    parser.add_argument("output", type=Path, help="Output assets/photography folder")
    return parser.parse_args()


def make_slug(path: Path) -> str:
    match = re.search(r"dscf\d+", path.stem, flags=re.IGNORECASE)
    if match:
        return match.group(0).lower()
    return re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")


def flatten_to_srgb(image: Image.Image, icc_profile: bytes | None) -> Image.Image:
    if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, "white")
        background.paste(rgba, mask=rgba.getchannel("A"))
        image = background
    else:
        image = image.convert("RGB")

    if not icc_profile:
        return image

    try:
        source_profile = ImageCms.ImageCmsProfile(io.BytesIO(icc_profile))
        target_profile = ImageCms.createProfile("sRGB")
        return ImageCms.profileToProfile(
            image,
            source_profile,
            target_profile,
            outputMode="RGB",
        )
    except (OSError, ValueError):
        return image


def resized(image: Image.Image, longest_edge: int) -> Image.Image:
    width, height = image.size
    scale = min(1.0, longest_edge / max(width, height))
    target = (max(1, round(width * scale)), max(1, round(height * scale)))
    if target == image.size:
        return image.copy()
    return image.resize(target, Image.Resampling.LANCZOS)


def build_image(
    source: Path,
    destination: Path,
    longest_edge: int,
    rotation: int = 0,
) -> tuple[int, int]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as opened:
        icc_profile = opened.info.get("icc_profile")
        oriented = ImageOps.exif_transpose(opened)
        if rotation:
            oriented = oriented.rotate(rotation, expand=True)
        normalized = flatten_to_srgb(oriented, icc_profile)
        output = resized(normalized, longest_edge)
        output.save(
            destination,
            "WEBP",
            lossless=True,
            method=6,
        )
        return output.size


def main() -> None:
    args = parse_args()
    source_root = args.source.expanduser().resolve()
    output_root = args.output.expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    grouped: list[list[dict[str, object]]] = []
    city_counts: dict[str, int] = {}

    for source_name, slug, label_en, label_zh in CITY_SPECS:
        source_dir = source_root / source_name
        paths = sorted(
            path
            for path in source_dir.iterdir()
            if path.is_file() and path.suffix.lower() in VALID_SUFFIXES
        )
        city_counts[slug] = len(paths)
        city_entries: list[dict[str, object]] = []

        for index, source_path in enumerate(paths, start=1):
            image_slug = make_slug(source_path)
            destinations = {
                size: output_root / slug / f"{image_slug}-{size}.webp"
                for size in SIZES
            }
            rotation = MANUAL_ROTATIONS.get((source_name, image_slug), 0)
            dimensions = {
                size: build_image(source_path, destinations[size], size, rotation)
                for size in SIZES
            }
            large_width, large_height = dimensions[2560]
            thumb_width, thumb_height = dimensions[960]

            city_entries.append(
                {
                    "id": f"{slug}-{image_slug}",
                    "city": slug,
                    "cityEn": label_en,
                    "cityZh": label_zh,
                    "labelEn": f"{label_en} · {index:02d}",
                    "labelZh": f"{label_zh} · {index:02d}",
                    "altEn": f"Photograph from {label_en} by Hui Yao",
                    "altZh": f"惠尧拍摄的{label_zh}摄影作品",
                    "thumb": f"assets/photography/{slug}/{image_slug}-960.webp",
                    "large": f"assets/photography/{slug}/{image_slug}-2560.webp",
                    "thumbWidth": thumb_width,
                    "thumbHeight": thumb_height,
                    "width": large_width,
                    "height": large_height,
                }
            )

        grouped.append(city_entries)

    # Interleave locations so the unfiltered gallery opens with a varied selection.
    photos: list[dict[str, object]] = []
    max_group_length = max((len(group) for group in grouped), default=0)
    for index in range(max_group_length):
        for group in grouped:
            if index < len(group):
                photos.append(group[index])

    manifest = {
        "titleEn": "Photography",
        "titleZh": "摄影作品",
        "count": len(photos),
        "cityCounts": city_counts,
        "photos": photos,
    }
    (output_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Built {len(photos)} photographs in {output_root}")


if __name__ == "__main__":
    main()
