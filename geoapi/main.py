"""
E4DRR Geospatial API — FastAPI wrapper around TiPG.

Includes TiPG's OGC Features + Tiles router plus custom domain endpoints
for calendar aggregation, choropleth data, and bounding box lookups.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from tipg.database import connect_to_db, close_db_connection
from tipg.collections import register_collection_catalog
from tipg.factory import Endpoints as TiPGEndpoints
from tipg.settings import PostgresSettings

import asyncpg


db_pool: asyncpg.Pool | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect to DB, register TiPG catalog. Shutdown: close."""
    global db_pool

    pg = PostgresSettings()
    await connect_to_db(app, schemas=["public"], settings=pg)
    await register_collection_catalog(app)

    # Separate pool for custom queries
    db_pool = await asyncpg.create_pool(
        host=pg.postgres_host,
        port=pg.postgres_port,
        database=pg.postgres_dbname,
        user=pg.postgres_user,
        password=pg.postgres_pass,
        min_size=2,
        max_size=10,
    )

    yield

    await close_db_connection(app)
    if db_pool:
        await db_pool.close()


app = FastAPI(
    title="E4DRR Geospatial API",
    description="OGC Features/Tiles (TiPG) + custom hazard endpoints",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include TiPG OGC router ──────────────────────────────────────────────────
tipg_endpoints = TiPGEndpoints()
app.include_router(tipg_endpoints.router, tags=["OGC Features & Tiles"])


# ── Custom domain endpoints ──────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "e4drr-geoapi"}


@app.get("/api/calendar")
async def calendar_data(
    hazard: str = Query(..., description="drought or flood"),
):
    """
    Calendar heatmap data: monthly aggregation of EM-DAT events.
    Returns year, month, event_count, total_deaths, total_affected, countries, event_keys.
    """
    rows = await db_pool.fetch(
        "SELECT * FROM calendar_data($1) ORDER BY year, month",
        hazard,
    )
    return [dict(r) for r in rows]


@app.get("/api/choropleth")
async def choropleth_data(
    hazard: str = Query(..., description="drought or flood"),
    event_key: str | None = Query(None, description="Filter to specific event"),
    year: int | None = Query(None, description="Filter to events active in this year"),
    month: int | None = Query(None, description="Filter to events active in this month"),
):
    """
    Choropleth regions: countries affected by a hazard with frequency counts.
    Optionally filtered to a specific year/month (events active during that period).
    """
    if event_key:
        rows = await db_pool.fetch("""
            SELECT e.iso3 AS "shapeGroup", e.country AS "shapeName",
                   1::bigint AS frequency
            FROM emdat_events e
            WHERE e.hazard = $1 AND e.event_key = $2
        """, hazard, event_key)
    elif year is not None and month is not None:
        # Find events active during this year/month from the calendar view
        rows = await db_pool.fetch("""
            SELECT c.iso3 AS "shapeGroup", c.country AS "shapeName",
                   c.event_count::bigint AS frequency
            FROM emdat_calendar c
            WHERE c.hazard = $1 AND c.year = $2 AND c.month = $3
            ORDER BY c.event_count DESC
        """, hazard, year, month)
    elif year is not None:
        rows = await db_pool.fetch("""
            SELECT c.iso3 AS "shapeGroup", c.country AS "shapeName",
                   SUM(c.event_count)::bigint AS frequency
            FROM emdat_calendar c
            WHERE c.hazard = $1 AND c.year = $2
            GROUP BY c.iso3, c.country
            ORDER BY frequency DESC
        """, hazard, year)
    else:
        rows = await db_pool.fetch("""
            SELECT e.iso3 AS "shapeGroup", e.country AS "shapeName",
                   COUNT(*)::bigint AS frequency
            FROM emdat_events e
            WHERE e.hazard = $1
            GROUP BY e.iso3, e.country
            ORDER BY frequency DESC
        """, hazard)
    return [dict(r) for r in rows]


@app.get("/api/bbox/{iso3}")
async def country_bbox(iso3: str):
    """Bounding box for a country (for map fitBounds)."""
    rows = await db_pool.fetch("SELECT * FROM country_bbox($1)", iso3)
    if not rows:
        return None
    r = rows[0]
    return {"iso3": r["iso3"], "country": r["country"],
            "minx": r["minx"], "miny": r["miny"],
            "maxx": r["maxx"], "maxy": r["maxy"]}


@app.get("/api/events")
async def hazard_events(
    hazard: str = Query(..., description="drought or flood"),
):
    """All EM-DAT events for a hazard type."""
    rows = await db_pool.fetch(
        "SELECT * FROM hazard_events($1)",
        hazard,
    )
    return [dict(r) for r in rows]
