#!/usr/bin/env python3
"""
Ingest admin boundaries and EM-DAT disaster events into pgstac as STAC items.

Collections created:
  - icpac-admin1: 227 Admin1 boundary polygons (from TopoJSON)
  - emdat-drought: EM-DAT drought events per admin1 region
  - emdat-flood: EM-DAT flood events per admin1 region

Usage:
  pip install pypgstac pystac topojson pandas pyarrow
  python stac-ingest/ingest.py

Requires pgstac running on localhost:5439 (or PGSTAC_CONN env var).
"""

import json
import math
import os
from datetime import datetime, timezone

import pandas as pd
import pystac
from pypgstac.db import PgstacDB
from pypgstac.load import Loader, Methods
from topojson import Topology

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOPO_PATH = os.path.join(ROOT, "frontend", "public", "data", "icpac_adm1v3.json")
PARQUET_DIR = os.path.join(ROOT, "data")

PGSTAC_CONN = os.environ.get(
    "PGSTAC_CONN",
    "postgresql://pgstac:pgstac_dev@localhost:5439/pgstac",
)

# IGAD region bbox [west, south, east, north]
IGAD_BBOX = [21.0, -12.0, 52.0, 23.0]


def load_topojson_as_geojson(path):
    """Convert TopoJSON to GeoJSON features using the topojson spec directly."""
    with open(path) as f:
        topo = json.load(f)

    from topojson.core.extract import Extract
    # Simple manual conversion: use the built-in algorithm
    import topojson as tp
    # Re-parse: topojson library expects to CREATE topojson, not read it
    # So we use a direct approach with the raw arcs
    obj_key = list(topo["objects"].keys())[0]

    # Use subprocess to convert via Node.js topojson-client if available,
    # otherwise do manual arc decoding
    try:
        from topojson import Topology as TopoLib
        # Create a Topology from the raw dict and export
        t = TopoLib(topo, object_name=obj_key)
        geojson = t.to_geojson()
        return json.loads(geojson) if isinstance(geojson, str) else geojson
    except Exception:
        pass

    # Fallback: manual arc decoding
    def decode_arc(arc_indices, arcs, transform=None):
        coords = []
        for idx in arc_indices:
            reverse = idx < 0
            arc = arcs[~idx if reverse else idx]
            points = list(arc)
            if reverse:
                points = list(reversed(points))
            if transform:
                sx, sy = transform["scale"]
                tx, ty = transform["translate"]
                x, y = 0, 0
                decoded = []
                for dx, dy in points:
                    x += dx
                    y += dy
                    decoded.append([x * sx + tx, y * sy + ty])
                points = decoded
            coords.extend(points if not coords else points[1:])
        return coords

    transform = topo.get("transform")
    arcs = topo["arcs"]
    features = []
    for geom in topo["objects"][obj_key]["geometries"]:
        gtype = geom["type"]
        props = geom.get("properties", {})
        if gtype == "Polygon":
            rings = [decode_arc(ring, arcs, transform) for ring in geom["arcs"]]
            geometry = {"type": "Polygon", "coordinates": rings}
        elif gtype == "MultiPolygon":
            polys = []
            for poly in geom["arcs"]:
                rings = [decode_arc(ring, arcs, transform) for ring in poly]
                polys.append(rings)
            geometry = {"type": "MultiPolygon", "coordinates": polys}
        else:
            continue
        features.append({"type": "Feature", "properties": props, "geometry": geometry})

    return {"type": "FeatureCollection", "features": features}


def bbox_from_geometry(geom):
    """Extract bbox from GeoJSON geometry."""
    coords = []
    def extract(c):
        if isinstance(c[0], (int, float)):
            coords.append(c)
            return
        for sub in c:
            extract(sub)
    try:
        extract(geom["coordinates"])
        if not coords:
            return IGAD_BBOX
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        return [min(lons), min(lats), max(lons), max(lats)]
    except Exception:
        return IGAD_BBOX


def safe(v):
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def create_admin1_collection():
    """Create STAC collection for ICPAC Admin1 boundaries."""
    return pystac.Collection(
        id="icpac-admin1",
        title="ICPAC Admin1 Boundaries",
        description="GADM Admin Level 1 boundaries for 11 IGAD countries (227 regions)",
        extent=pystac.Extent(
            spatial=pystac.SpatialExtent(bboxes=[IGAD_BBOX]),
            temporal=pystac.TemporalExtent(intervals=[[None, None]]),
        ),
        license="CC-BY-4.0",
    )


def create_admin1_items(geojson_fc):
    """Create STAC items from Admin1 GeoJSON features."""
    items = []
    for feat in geojson_fc["features"]:
        props = feat.get("properties", {})
        gid = props.get("GID_1", props.get("shapeID", "unknown"))
        name = props.get("NAME_1", props.get("shapeName", gid))
        iso = gid.split(".")[0] if "." in gid else gid[:3]
        bbox = bbox_from_geometry(feat["geometry"])

        item = pystac.Item(
            id=gid,
            geometry=feat["geometry"],
            bbox=bbox,
            datetime=None,
            properties={
                "name": name,
                "iso3": iso,
                "admin_level": 1,
                "start_datetime": "1990-01-01T00:00:00Z",
                "end_datetime": "2026-12-31T23:59:59Z",
            },
        )
        items.append(item)
    return items


def create_event_collection(hazard):
    """Create STAC collection for EM-DAT disaster events."""
    return pystac.Collection(
        id=f"emdat-{hazard}",
        title=f"EM-DAT {hazard.title()} Events — East Africa",
        description=f"EM-DAT {hazard} disaster events (1990-2025) linked to Admin1 regions across 11 IGAD countries",
        extent=pystac.Extent(
            spatial=pystac.SpatialExtent(bboxes=[IGAD_BBOX]),
            temporal=pystac.TemporalExtent(
                intervals=[[datetime(1990, 1, 1, tzinfo=timezone.utc), datetime(2025, 12, 31, tzinfo=timezone.utc)]]
            ),
        ),
        license="CC-BY-4.0",
    )


def create_event_items(hazard, admin1_geom_lookup):
    """Create STAC items from EM-DAT parquet, one per event-admin1 pair."""
    path = os.path.join(PARQUET_DIR, f"emdat_{hazard}_adm1.parquet")
    df = pd.read_parquet(path)

    if "Start Month" in df.columns:
        df["Start Month"] = df["Start Month"].fillna(1).astype(int)
    if "Start Year" in df.columns:
        df["Start Year"] = df["Start Year"].fillna(2000).astype(int)

    items = []
    for dis_no, group in df.groupby("Dis No"):
        first = group.iloc[0]
        year = int(first.get("Start Year", 2000))
        month = int(first.get("Start Month", 1))
        country = str(first.get("Country", "Unknown"))
        iso = str(first.get("ISO", ""))
        deaths = safe(first.get("Total Deaths"))
        affected = safe(first.get("Total Affected"))
        location = str(first.get("Location", "")) if first.get("Location") else None

        admin1_codes = sorted(group["admin1_code"].unique().tolist())

        # Use first admin1 geometry if available, else point
        geom = None
        bbox = IGAD_BBOX
        for code in admin1_codes:
            if code in admin1_geom_lookup:
                geom = admin1_geom_lookup[code]
                bbox = bbox_from_geometry(geom)
                break

        if geom is None:
            lat = safe(first.get("Latitude")) or 0
            lon = safe(first.get("Longitude")) or 35
            geom = {"type": "Point", "coordinates": [lon or 35, lat or 0]}
            bbox = [lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5] if lon and lat else IGAD_BBOX

        dt = datetime(year, month, 1, tzinfo=timezone.utc)

        item = pystac.Item(
            id=str(dis_no),
            geometry=geom,
            bbox=bbox,
            datetime=dt,
            properties={
                "country": country,
                "iso3": iso,
                "hazard": hazard,
                "total_deaths": int(deaths) if deaths else None,
                "total_affected": int(affected) if affected else None,
                "admin1_regions": len(admin1_codes),
                "admin1_codes": admin1_codes,
                "location": location,
            },
        )
        items.append(item)

    return items


def main():
    print(f"Connecting to pgstac: {PGSTAC_CONN}")

    # Load admin1 geometries for lookup
    print("Loading Admin1 TopoJSON...")
    geojson_fc = load_topojson_as_geojson(TOPO_PATH)
    admin1_geom_lookup = {}
    for feat in geojson_fc["features"]:
        gid = feat["properties"].get("GID_1", feat["properties"].get("shapeID"))
        if gid:
            admin1_geom_lookup[gid] = feat["geometry"]
    print(f"  {len(admin1_geom_lookup)} admin1 geometries loaded")

    with PgstacDB(dsn=PGSTAC_CONN) as db:
        loader = Loader(db=db)

        # Admin1 collection + items
        print("Creating icpac-admin1 collection...")
        col = create_admin1_collection()
        loader.load_collections([col.to_dict()], insert_mode=Methods.upsert)

        print("Creating admin1 items...")
        admin_items = create_admin1_items(geojson_fc)
        item_dicts = []
        for item in admin_items:
            d = item.to_dict()
            d["collection"] = "icpac-admin1"
            item_dicts.append(d)
        loader.load_items(item_dicts, insert_mode=Methods.upsert)
        print(f"  {len(item_dicts)} admin1 items ingested")

        # Disaster event collections + items
        for hazard in ("drought", "flood"):
            print(f"Creating emdat-{hazard} collection...")
            col = create_event_collection(hazard)
            loader.load_collections([col.to_dict()], insert_mode=Methods.upsert)

            print(f"Creating {hazard} event items...")
            event_items = create_event_items(hazard, admin1_geom_lookup)
            item_dicts = []
            for item in event_items:
                d = item.to_dict()
                d["collection"] = f"emdat-{hazard}"
                item_dicts.append(d)
            loader.load_items(item_dicts, insert_mode=Methods.upsert)
            print(f"  {len(item_dicts)} {hazard} event items ingested")

    print("\nDone! STAC catalog ready.")
    print("  Collections: icpac-admin1, emdat-drought, emdat-flood")
    print(f"  STAC API: http://localhost:9080/stac/")


if __name__ == "__main__":
    main()
