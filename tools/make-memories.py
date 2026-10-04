#!/usr/bin/env python3
"""Rebuild the published memory images from the private originals.

The twenty photographs in public/memories are resized copies of originals that
are NOT in this repository. They are rewritten pixel by pixel so that no EXIF,
GPS, camera model or timestamp survives in the published file;
tests/memories.test.js fails if an APP1 segment ever appears in one.

This script is the only supported way to regenerate them. It reads the
originals, never writes to them, and never copies metadata.

    pip install pillow
    python tools/make-memories.py --originals /path/to/photos/originals

By default it regenerates every frame already listed in
public/memories/memories.json, matching each one to an original by the
`original` field if present, otherwise by filename convention. Captions, times
and world placements in memories.json are hand-authored from the hike record
and are never touched by this script.

To add a new frame: copy the original in, run this with --add, then write the
caption, time and placement into memories.json by hand. See HANDOFF.md §6.
"""

import argparse
import json
import pathlib
import sys

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover - a setup problem, not a code path
    sys.exit("Pillow is required:  pip install pillow")

REPO = pathlib.Path(__file__).resolve().parent.parent
MEMORIES = REPO / "public" / "memories"
INDEX = MEMORIES / "memories.json"

FULL_EDGE = 1600
FULL_QUALITY = 82
THUMB_EDGE = 256
THUMB_QUALITY = 72


def strip(image):
    """Return a copy carrying pixels and nothing else.

    Image.save() can propagate info from the source, so the pixels are poured
    into a brand-new image rather than the original object being handed on.
    """
    clean = Image.new("RGB", image.size)
    clean.putdata(list(image.convert("RGB").getdata()))
    return clean


def emit(source: pathlib.Path, memory_id: str, out: pathlib.Path, dry_run: bool):
    original = ImageOps.exif_transpose(Image.open(source))

    full = original.copy()
    full.thumbnail((FULL_EDGE, FULL_EDGE), Image.LANCZOS)
    thumb = original.copy()
    thumb.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)

    targets = [
        (out / f"m{memory_id}.jpg", strip(full), FULL_QUALITY),
        (out / f"m{memory_id}_t.jpg", strip(thumb), THUMB_QUALITY),
    ]
    written = 0
    for path, image, quality in targets:
        if dry_run:
            print(f"  would write {path.name} at {image.size[0]}x{image.size[1]}")
            continue
        image.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
        written += path.stat().st_size
    return written


def find_original(originals: pathlib.Path, record: dict) -> pathlib.Path | None:
    named = record.get("original")
    if named:
        candidate = originals / named
        return candidate if candidate.exists() else None
    # The published name is m<NNN>.jpg where NNN is the frame's index in the
    # hike sequence; without an explicit mapping we cannot guess the original.
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--originals", required=True, type=pathlib.Path,
                        help="directory of full-resolution originals (private, never committed)")
    parser.add_argument("--ids", help="comma-separated frame ids, e.g. 008,094 (default: all in memories.json)")
    parser.add_argument("--add", nargs=2, metavar=("ID", "FILENAME"),
                        help="add a frame not yet in memories.json, then edit that file by hand")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.originals.is_dir():
        sys.exit(f"not a directory: {args.originals}")
    MEMORIES.mkdir(parents=True, exist_ok=True)

    if args.add:
        memory_id, filename = args.add
        source = args.originals / filename
        if not source.exists():
            sys.exit(f"no such original: {source}")
        emit(source, memory_id, MEMORIES, args.dry_run)
        print(f"wrote m{memory_id}. Now add its caption, time and placement to "
              f"{INDEX.relative_to(REPO)} by hand, then run: npm test")
        return

    index = json.loads(INDEX.read_text(encoding="utf-8"))
    wanted = set(args.ids.split(",")) if args.ids else None

    total = done = missing = 0
    for record in index["memories"]:
        memory_id = record["id"]
        if wanted and memory_id not in wanted:
            continue
        source = find_original(args.originals, record)
        if source is None:
            print(f"  {memory_id}: no original found — add an \"original\" field "
                  f"to its entry in memories.json naming the source file")
            missing += 1
            continue
        total += emit(source, memory_id, MEMORIES, args.dry_run)
        done += 1
        print(f"  {memory_id}: {record['time']}  {record['en']}")

    print(f"\n{done} frame(s) rebuilt, {missing} unresolved, {total / 1048576:.1f} MB written")
    if done and not args.dry_run:
        print("Now run:  npm test   (the EXIF scan is part of it)")


if __name__ == "__main__":
    main()
