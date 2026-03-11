#!/usr/bin/env python3
"""
Convert ea_adm2.topojson → SQL INSERT statements for PostGIS.
Generates admin0 (dissolved countries), admin1 (placeholder), and admin2 boundaries.

Usage:
    python3 seed-boundaries.py > 02-seed-boundaries.sql
"""

import json
import sys
from pathlib import Path

# TopoJSON → GeoJSON conversion (inline, no heavy deps)
def topo_to_geojson(topo_data, object_name):
    """Convert TopoJSON to GeoJSON features using the topojson library."""
    arcs = topo_data["arcs"]
    transform = topo_data.get("transform")

    features = []
    for geom in topo_data["objects"][object_name]["geometries"]:
        props = geom.get("properties", {})
        geo_type = geom["type"]

        if geo_type == "Polygon":
            coords = [decode_arc_ring(ring, arcs, transform) for ring in geom["arcs"]]
            features.append({"type": "Feature", "properties": props, "geometry": {"type": "Polygon", "coordinates": coords}})
        elif geo_type == "MultiPolygon":
            coords = [[decode_arc_ring(ring, arcs, transform) for ring in polygon] for polygon in geom["arcs"]]
            features.append({"type": "Feature", "properties": props, "geometry": {"type": "MultiPolygon", "coordinates": coords}})

    return features


def decode_arc_ring(arc_indexes, arcs, transform):
    """Decode a ring of arc indexes into coordinates."""
    coords = []
    for idx in arc_indexes:
        if idx < 0:
            arc = list(reversed(arcs[~idx]))
        else:
            arc = arcs[idx]
        # Skip first point of subsequent arcs to avoid duplicates
        start = 0 if not coords else 1
        for pt in arc[start:]:
            coords.append(pt)

    # Apply quantization transform if present
    if transform:
        sx = transform["scale"][0]
        sy = transform["scale"][1]
        tx = transform["translate"][0]
        ty = transform["translate"][1]

        decoded = []
        x, y = 0, 0
        for dx, dy in coords:
            x += dx
            y += dy
            decoded.append([x * sx + tx, y * sy + ty])
        return decoded

    return coords


def escape_sql(s):
    """Escape single quotes for SQL."""
    if s is None:
        return ""
    return str(s).replace("'", "''")


# Country name lookup
COUNTRY_NAMES = {
    "BDI": "Burundi", "DJI": "Djibouti", "ERI": "Eritrea",
    "ETH": "Ethiopia", "KEN": "Kenya", "RWA": "Rwanda",
    "SDN": "Sudan", "SOM": "Somalia", "SSD": "South Sudan",
    "TZA": "Tanzania", "UGA": "Uganda",
}


def main():
    topo_path = Path(__file__).parent.parent / "frontend" / "public" / "data" / "ea_adm2.topojson"
    if not topo_path.exists():
        topo_path = Path(__file__).parent.parent / "disasterevents_cms" / "static" / "data" / "ea_adm2.topojson"

    with open(topo_path) as f:
        topo = json.load(f)

    features = topo_to_geojson(topo, "data")

    print("-- ============================================================")
    print("-- Auto-generated from ea_adm2.topojson")
    print(f"-- {len(features)} admin2 boundaries")
    print("-- ============================================================")
    print()
    print("BEGIN;")
    print()

    # ── Admin2 boundaries ──
    print("-- Admin2 boundaries")
    for feat in features:
        props = feat["properties"]
        geom = feat["geometry"]

        shape_name = escape_sql(props.get("shapeName", ""))
        iso3 = escape_sql(props.get("shapeGroup", ""))
        shape_id = escape_sql(props.get("shapeID", ""))
        country = escape_sql(COUNTRY_NAMES.get(iso3, ""))

        # Convert geometry to WKT-like GeoJSON for ST_GeomFromGeoJSON
        geom_json = json.dumps(geom).replace("'", "''")

        # Ensure MultiPolygon
        if geom["type"] == "Polygon":
            multi_geom = {"type": "MultiPolygon", "coordinates": [geom["coordinates"]]}
            geom_json = json.dumps(multi_geom).replace("'", "''")

        print(f"INSERT INTO admin2_boundaries (country, iso3, name_1, name_2, geom) VALUES ('{country}', '{iso3}', '', '{shape_name}', ST_SetSRID(ST_GeomFromGeoJSON('{geom_json}'), 4326));")

    print()

    # ── Admin0 boundaries (dissolved from admin2 per country) ──
    print("-- Admin0 boundaries (dissolved from admin2)")
    countries = set(f["properties"]["shapeGroup"] for f in features)
    for iso3 in sorted(countries):
        country = escape_sql(COUNTRY_NAMES.get(iso3, iso3))
        print(f"INSERT INTO admin0_boundaries (country, iso3, geom) SELECT '{country}', '{iso3}', ST_Multi(ST_Union(geom)) FROM admin2_boundaries WHERE iso3 = '{iso3}';")

    print()
    print("COMMIT;")
    print()
    print(f"-- Done: {len(features)} admin2 + {len(countries)} admin0 boundaries")


if __name__ == "__main__":
    main()
