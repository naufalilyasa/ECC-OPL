#!/usr/bin/env python3
"""Refresh only curated families from a pinned public google/fonts revision.

Python standard library only. Repository metadata verifies declared capabilities,
not CSS API availability, glyph completeness, or delivered OpenType features.
"""
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "typography-system-catalog/1"})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read()


def field(text, key, default=None):
    match = re.search(r'^\s*' + re.escape(key) + r':\s*("(?:[^"\\]|\\.)*"|[^\n]+)', text, re.M)
    if not match:
        return default
    value = match.group(1).strip()
    return json.loads(value) if value.startswith('"') else float(value)


def blocks(text, key):
    # Current METADATA fonts/axes blocks contain flat scalar fields.
    return re.findall(r'^' + re.escape(key) + r'\s*\{([^{}]*)\}', text, re.M)


def parse_metadata(raw, expected, path, revision, verified_at):
    source = raw.decode("utf-8")
    if field(source, "name") != expected:
        raise ValueError(f"Family mismatch at {path}: expected {expected!r}")
    axes = {field(b, "tag"): {"min": field(b, "min_value"), "max": field(b, "max_value")}
            for b in blocks(source, "axes")}
    faces = []
    for block in blocks(source, "fonts"):
        filename = field(block, "filename")
        axis_match = re.search(r'\[([^\]]+)\]', filename)
        variable_axes = axis_match.group(1).split(",") if axis_match else []
        unknown = set(variable_axes) - set(axes)
        if unknown:
            raise ValueError(f"Missing metadata axes for {expected}: {unknown}")
        face = {"style": field(block, "style"), "metadata_weight": field(block, "weight"),
                "filename": filename, "variable_axes": variable_axes}
        if "wght" in variable_axes:
            face["weight_range"] = axes["wght"]
        else:
            face["weight"] = face["metadata_weight"]
        faces.append(face)
    if not faces:
        raise ValueError(f"No parseable font faces for {expected}")
    license_name = field(source, "license")
    license_file = {"OFL": "OFL.txt", "APACHE2": "LICENSE.txt", "UFL": "UFL.txt"}.get(license_name)
    base = f"https://github.com/google/fonts/blob/{revision}/{path}"
    return {"family": expected, "category": field(source, "category"),
            "designer": field(source, "designer"), "license": license_name,
            "repository_path": path, "metadata_url": base + "/METADATA.pb",
            "metadata_sha256": hashlib.sha256(raw).hexdigest(),
            "license_url": base + "/" + license_file if license_file else None,
            "specimen_url": "https://fonts.google.com/specimen/" + urllib.parse.quote_plus(expected),
            "verified_at": verified_at,
            "subsets": re.findall(r'^subsets: "([^"]+)"', source, re.M),
            "axes": axes, "faces": faces,
            "upstream_url": field(source, "repository_url"),
            "glyph_and_feature_verification": "not_checked"}


def retrieve(family, revision, verified_at, cache_dir):
    slug = re.sub(r'[^a-z0-9]', '', family.lower())
    for license_dir in ("ofl", "apache", "ufl"):
        path = f"{license_dir}/{slug}"
        url = f"https://raw.githubusercontent.com/google/fonts/{revision}/{path}/METADATA.pb"
        try:
            raw = fetch(url)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                continue
            raise
        record = parse_metadata(raw, family, path, revision, verified_at)
        if cache_dir:
            cache_dir.mkdir(parents=True, exist_ok=True)
            (cache_dir / f"{slug}.pb").write_bytes(raw)
        return record
    raise ValueError(f"{family}: no matching known directory; check repository path manually")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--pairings", type=Path, help="Pairings JSON; discover families from roles")
    group.add_argument("--families", type=Path, help="JSON list of exact family names")
    parser.add_argument("--revision", required=True, help="Pinned 40-character google/fonts commit SHA")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--cache-dir", type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{40}', args.revision):
        parser.error("Use a resolved 40-character commit SHA, not a moving branch")
    if args.families:
        families = json.loads(args.families.read_text())
    else:
        data = json.loads(args.pairings.read_text())
        families = [role["family"] for recipe in data["recipes"] for role in recipe["roles"].values()]
    if not families or not all(isinstance(f, str) and f.strip() for f in families):
        parser.error("Expected a nonempty list of exact family names")
    verified_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    results, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        tasks = {pool.submit(retrieve, f, args.revision, verified_at, args.cache_dir): f for f in sorted(set(families))}
        for task in concurrent.futures.as_completed(tasks):
            try:
                results.append(task.result())
            except Exception as error:
                failures.append(f"{tasks[task]}: {error}")
    if failures:
        for message in sorted(failures):
            print(message, file=sys.stderr)
        print("Catalog not replaced: resolve failed families and retry.", file=sys.stderr)
        return 1
    data = {"schema_version": 1, "verified_at": verified_at,
            "google_fonts_revision": args.revision,
            "verification_scope": "Pinned repository METADATA.pb only. CSS delivery, actual glyphs, shaping and OpenType features require separate checks.",
            "families": sorted(results, key=lambda r: r["family"])}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix(args.output.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    temp.replace(args.output)
    print(f"Verified {len(results)} families at {args.revision}; wrote {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
