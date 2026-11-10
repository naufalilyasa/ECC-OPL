#!/usr/bin/env python3
"""Build a portable HTML specimen lab; only the selected recipe loads web fonts."""
import argparse
import json
from pathlib import Path
import subprocess
import sys


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    pairings = json.loads((root / "references/pairings.json").read_text())
    catalog = json.loads((root / "references/font-catalog.json").read_text())
    records = {f["family"]: f for f in catalog["families"]}
    for recipe in pairings["recipes"]:
        result = subprocess.run([sys.executable, str(root / "scripts/font_tools.py"), "css", "--recipe", recipe["id"]], text=True, capture_output=True)
        if result.returncode:
            raise SystemExit(f"Invalid recipe {recipe['id']}: {result.stderr}")
        recipe["css_url"] = result.stdout.strip()
        recipe["families"] = {role["family"]: {"category": records[role["family"]]["category"],
                             "specimen_url": records[role["family"]]["specimen_url"]}
                             for role in recipe["roles"].values()}
    # JSON in script context must not admit an HTML closing-script sequence.
    encoded = json.dumps(pairings, ensure_ascii=False).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    template = (root / "assets/specimen.html").read_text()
    output = template.replace("__PAIRINGS_DATA__", encoded).replace("__VERIFIED_AT__", catalog["verified_at"][:10])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output)
    print(f"Built {len(pairings['recipes'])} recipes: {args.output}")


if __name__ == "__main__":
    main()
