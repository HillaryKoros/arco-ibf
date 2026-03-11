#!/bin/bash
# ============================================================
# Load GADM admin boundaries from GeoJSON into PostGIS
# Runs after 01-create-tables.sql on first DB startup
# Uses ogr2ogr (included in postgis/postgis Docker image)
# ============================================================

set -e

PGCONN="PG:host=localhost dbname=$POSTGRES_DB user=$POSTGRES_USER password=$POSTGRES_PASSWORD"
DATA_DIR="/docker-entrypoint-initdb.d/data"

# Install ogr2ogr (not included in base postgis image)
echo "=== Installing gdal-bin for ogr2ogr ==="
apt-get update -qq && apt-get install -y -qq gdal-bin 2>/dev/null

echo "=== Loading Admin0 boundaries (12 countries) ==="
ogr2ogr -f "PostgreSQL" "$PGCONN" \
    "$DATA_DIR/GHA_EA_admin0.geojson" \
    -nln admin0_boundaries \
    -append \
    -nlt MULTIPOLYGON \
    -lco GEOMETRY_NAME=geom \
    -sql "SELECT GID_0 AS iso3, COUNTRY AS country FROM GHA_EA_admin0" \
    -a_srs EPSG:4326

echo "=== Loading Admin1 boundaries (171 provinces) ==="
ogr2ogr -f "PostgreSQL" "$PGCONN" \
    "$DATA_DIR/GHA_EA_admin1.geojson" \
    -nln admin1_boundaries \
    -append \
    -nlt MULTIPOLYGON \
    -lco GEOMETRY_NAME=geom \
    -sql "SELECT GID_0 AS iso3, COUNTRY AS country, NAME_1 AS name_1 FROM GHA_EA_admin1" \
    -a_srs EPSG:4326

echo "=== Loading Admin2 boundaries (1070 districts) ==="
ogr2ogr -f "PostgreSQL" "$PGCONN" \
    "$DATA_DIR/GHA_EA_admin2.geojson" \
    -nln admin2_boundaries \
    -append \
    -nlt MULTIPOLYGON \
    -lco GEOMETRY_NAME=geom \
    -sql "SELECT GID_0 AS iso3, COUNTRY AS country, NAME_1 AS name_1, NAME_2 AS name_2 FROM GHA_EA_admin2" \
    -a_srs EPSG:4326

echo "=== Verifying loaded data ==="
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
    SELECT 'admin0' AS level, COUNT(*) AS features FROM admin0_boundaries
    UNION ALL
    SELECT 'admin1', COUNT(*) FROM admin1_boundaries
    UNION ALL
    SELECT 'admin2', COUNT(*) FROM admin2_boundaries
    UNION ALL
    SELECT 'emdat_events', COUNT(*) FROM emdat_events;
"

echo "=== Boundary loading complete ==="
