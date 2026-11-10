#!/usr/bin/env python3
"""Inspect the bundled catalog, validate recipes, and build Google Fonts CSS2 URLs.

Validation checks the pinned metadata only. It does not verify live API delivery,
glyph coverage, shaping, features, or which font a browser actually renders.
All runtime dependencies are from Python's standard library.
"""

import argparse
from decimal import Decimal
import json
import math
from pathlib import Path
import re
import sys
from urllib.parse import quote_plus


REFERENCES = Path(__file__).resolve().parent.parent / "references"


class FontError(ValueError):
    """A catalog or recipe cannot safely produce the requested font selection."""


def read_json(path):
    try:
        with Path(path).open(encoding="utf-8") as source:
            return json.load(source)
    except (OSError, ValueError) as exc:
        raise FontError(f"Cannot read JSON from {path}: {exc}") from exc


def name_key(name):
    return " ".join(name.split()).casefold()


def catalog_index(catalog):
    if not isinstance(catalog, dict) or catalog.get("schema_version") != 1:
        raise FontError("Catalog must be an object with schema_version 1.")
    families = catalog.get("families")
    if not isinstance(families, list):
        raise FontError("Catalog families must be an array.")
    result = {}
    for family in families:
        if not isinstance(family, dict) or not isinstance(family.get("family"), str):
            raise FontError("Each catalog family must have a string family name.")
        key = name_key(family["family"])
        if not key or key in result:
            raise FontError(f"Empty or duplicate catalog family: {family['family']!r}.")
        result[key] = family
    return result


def find_family(catalog, name):
    if not isinstance(name, str) or not name.strip():
        raise FontError("A nonempty family name is required.")
    result = catalog_index(catalog).get(name_key(name))
    if result is None:
        raise FontError(f"Unknown catalog family {name!r}; use an exact family name.")
    return result


def number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise FontError(f"{label} must be a finite number, got {value!r}.")
    if not math.isfinite(value):
        raise FontError(f"{label} must be finite.")
    return value


def in_range(value, bounds, label):
    if not isinstance(bounds, dict):
        raise FontError(f"Catalog is missing {label} range metadata.")
    low = number(bounds.get("min"), f"Catalog {label} minimum")
    high = number(bounds.get("max"), f"Catalog {label} maximum")
    if low > high:
        raise FontError(f"Catalog {label} has reversed range {low}..{high}.")
    return low <= value <= high


def validate_role(role, catalog, label="role"):
    """Return normalized role selection; raise FontError for an invalid face."""
    if not isinstance(role, dict):
        raise FontError(f"{label} must be an object.")
    try:
        family = find_family(catalog, role.get("family"))
        weight = number(role.get("weight"), "weight")
        style = role.get("style", "normal")
        if style not in ("normal", "italic"):
            raise FontError("style must be normal or italic; use a supported slnt axis for slant.")
        axes = role.get("axes", {})
        if not isinstance(axes, dict):
            raise FontError("axes must be an object of axis tags and numeric coordinates.")
        for tag, value in axes.items():
            if not isinstance(tag, str) or not re.fullmatch(r"[a-z]{4}|[A-Z]{4}", tag):
                raise FontError(f"Invalid axis tag {tag!r}; use four lowercase or uppercase letters.")
            if tag in ("wght", "ital"):
                raise FontError(f"Set {'weight' if tag == 'wght' else 'style'} on the role, not axes.{tag}.")
            number(value, f"axis {tag}")
            if tag not in family.get("axes", {}):
                raise FontError(f"{family['family']} does not advertise axis {tag} (tags are case-sensitive).")
            if not in_range(value, family["axes"][tag], tag):
                bounds = family["axes"][tag]
                raise FontError(f"{family['family']} axis {tag}={value} is outside {bounds['min']}..{bounds['max']}.")

        faces = family.get("faces")
        if not isinstance(faces, list) or not faces:
            raise FontError(f"{family['family']} has no usable face metadata.")
        style_faces = [face for face in faces if isinstance(face, dict) and face.get("style") == style]
        if not style_faces:
            raise FontError(f"{family['family']} has no {style} face in the catalog.")
        weight_faces = []
        for face in style_faces:
            if "wght" in face.get("variable_axes", []):
                # A variable file's metadata_weight is a default, not its limit.
                matches = in_range(weight, face.get("weight_range"), "weight")
            else:
                matches = weight == number(face.get("weight"), "Catalog static weight")
            if matches:
                weight_faces.append(face)
        if not weight_faces:
            raise FontError(f"{family['family']} has no {style} face supporting weight {weight}.")
        if not any(set(axes).issubset(face.get("variable_axes", [])) for face in weight_faces):
            raise FontError(f"{family['family']} {style} at weight {weight} does not support all requested axes together: {', '.join(sorted(axes))}.")
        return {"family": family["family"], "weight": weight, "style": style, "axes": dict(axes)}
    except FontError as exc:
        raise FontError(f"{label}: {exc}") from exc


def validate_recipe(recipe, catalog):
    """Return normalized roles for a recipe that can be serialized unambiguously."""
    if not isinstance(recipe, dict):
        raise FontError("Each recipe must be an object.")
    recipe_id = recipe.get("id")
    if not isinstance(recipe_id, str) or not recipe_id.strip():
        raise FontError("Each recipe must have a nonempty string id.")
    roles = recipe.get("roles")
    if not isinstance(roles, dict) or not roles:
        raise FontError(f"Recipe {recipe_id}: roles must be a nonempty object.")
    result = {}
    family_axis_sets = {}
    for role_name, role in roles.items():
        normalized = validate_role(role, catalog, f"Recipe {recipe_id}, role {role_name}")
        family = normalized["family"]
        key_set = frozenset(normalized["axes"])
        if family in family_axis_sets and family_axis_sets[family] != key_set:
            raise FontError(f"Recipe {recipe_id}: every role using {family} must specify the same axis keys; supply explicit coordinates instead of inferring unrecorded defaults.")
        family_axis_sets[family] = key_set
        result[role_name] = normalized
    return result


def recipe_records(pairings):
    if not isinstance(pairings, dict) or not isinstance(pairings.get("recipes"), list):
        raise FontError("Pairings must be an object with a recipes array.")
    recipes = pairings["recipes"]
    seen = set()
    for recipe in recipes:
        recipe_id = recipe.get("id") if isinstance(recipe, dict) else None
        if not isinstance(recipe_id, str) or not recipe_id.strip():
            raise FontError("Every recipe requires a nonempty string id.")
        if recipe_id in seen:
            raise FontError(f"Duplicate recipe id {recipe_id!r}.")
        seen.add(recipe_id)
    return recipes


def find_recipe(pairings, recipe_id):
    for recipe in recipe_records(pairings):
        if recipe["id"] == recipe_id:
            return recipe
    raise FontError(f"Unknown recipe {recipe_id!r}; run list to see recipe ids.")


def validate_pairings(pairings, catalog):
    """Return all recipe validation errors; an empty list means metadata checks pass."""
    catalog_index(catalog)
    errors = []
    for recipe in recipe_records(pairings):
        try:
            validate_recipe(recipe, catalog)
        except FontError as exc:
            errors.append(str(exc))
    return errors


def axis_sort_key(tag):
    # Google CSS2 puts registered lowercase axes before custom uppercase axes.
    return (not tag.islower(), tag)


def format_number(value):
    result = format(Decimal(str(value)), "f")
    if "." in result:
        result = result.rstrip("0").rstrip(".")
    return "0" if result == "-0" else result


def automatic_optical_range(family, selections):
    """Preserve opsz for CSS automatic optical sizing when the selected faces allow it."""
    if "opsz" in selections[0]["axes"] or "opsz" not in family.get("axes", {}):
        return None
    for role in selections:
        candidates = []
        for face in family["faces"]:
            if face["style"] != role["style"]:
                continue
            if "wght" in face.get("variable_axes", []):
                matches = in_range(role["weight"], face.get("weight_range"), "weight")
            else:
                matches = role["weight"] == face.get("weight")
            if matches and set(role["axes"]).issubset(face.get("variable_axes", [])):
                candidates.append(face)
        if not candidates or any("opsz" not in face.get("variable_axes", []) for face in candidates):
            return None
    bounds = family["axes"]["opsz"]
    low = number(bounds.get("min"), "Catalog opsz minimum")
    high = number(bounds.get("max"), "Catalog opsz maximum")
    in_range(low, bounds, "opsz")
    return (low, high) if low != high else low


def format_coordinate(value):
    if isinstance(value, tuple):
        return "..".join(format_number(bound) for bound in value)
    return format_number(value)


def css_url(recipe, catalog, display="swap"):
    """Request unique role coordinates, preserving supported automatic opsz ranges."""
    if display not in ("auto", "block", "swap", "fallback", "optional"):
        raise FontError(f"Invalid font-display value {display!r}.")
    roles = validate_recipe(recipe, catalog)
    groups = {}
    for role in roles.values():
        groups.setdefault(role["family"], []).append(role)
    specs = []
    for family in sorted(groups, key=str.casefold):
        selections = groups[family]
        optical_range = automatic_optical_range(find_family(catalog, family), selections)
        italic = any(role["style"] == "italic" for role in selections)
        tags = set(selections[0]["axes"]) | {"wght"}
        if optical_range is not None:
            tags.add("opsz")
        if italic:
            tags.add("ital")
        tags = sorted(tags, key=axis_sort_key)
        tuples = set()
        for role in selections:
            values = dict(role["axes"], wght=role["weight"])
            if optical_range is not None:
                values["opsz"] = optical_range
            if italic:
                values["ital"] = 1 if role["style"] == "italic" else 0
            tuples.add(tuple(values[tag] for tag in tags))
        tuple_order = lambda values: tuple(value if isinstance(value, tuple) else (value, value) for value in values)
        coordinates = ";".join(",".join(format_coordinate(value) for value in values) for values in sorted(tuples, key=tuple_order))
        specs.append(f"family={quote_plus(family)}:{','.join(tags)}@{coordinates}")
    return "https://fonts.googleapis.com/css2?" + "&".join(specs) + f"&display={display}"


def add_path_options(parser, defaults=False):
    default = None if defaults else argparse.SUPPRESS
    parser.add_argument("--catalog", type=Path, default=default, help="Override font-catalog.json.")
    parser.add_argument("--pairings", type=Path, default=default, help="Override pairings.json.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    add_path_options(parser, defaults=True)
    subcommands = parser.add_subparsers(dest="command", required=True)
    family_parser = subcommands.add_parser("family", help="Print one matching catalog record as JSON.")
    family_parser.add_argument("name")
    list_parser = subcommands.add_parser("list", help="Print recipes as JSON, optionally filtered by context.")
    list_parser.add_argument("--context")
    validate_parser = subcommands.add_parser("validate", help="Validate all recipes against catalog metadata.")
    css_parser = subcommands.add_parser("css", help="Print a Google CSS2 URL for one recipe.")
    css_parser.add_argument("--recipe", required=True)
    css_parser.add_argument("--display", default="swap", choices=("auto", "block", "swap", "fallback", "optional"))
    for command_parser in (family_parser, list_parser, validate_parser, css_parser):
        add_path_options(command_parser)
    args = parser.parse_args(argv)
    try:
        if args.command == "family":
            catalog = read_json(args.catalog or REFERENCES / "font-catalog.json")
            print(json.dumps(find_family(catalog, args.name), ensure_ascii=False, indent=2))
            return 0
        pairings = read_json(args.pairings or REFERENCES / "pairings.json")
        if args.command == "list":
            recipes = recipe_records(pairings)
            if args.context:
                target = args.context.casefold()
                recipes = [recipe for recipe in recipes if any(isinstance(context, str) and context.casefold() == target for context in recipe.get("contexts", []))]
            print(json.dumps(recipes, ensure_ascii=False, indent=2))
            return 0
        catalog = read_json(args.catalog or REFERENCES / "font-catalog.json")
        if args.command == "css":
            print(css_url(find_recipe(pairings, args.recipe), catalog, args.display))
        else:
            errors = validate_pairings(pairings, catalog)
            if errors:
                raise FontError("\n".join(errors))
            print(f"Validated {len(recipe_records(pairings))} recipes against catalog metadata. Live delivery, glyphs, shaping, and features are not checked.")
        return 0
    except FontError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
