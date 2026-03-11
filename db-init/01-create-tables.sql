-- ============================================================
-- E4DRR PostGIS Init: Admin Boundaries + EM-DAT Events
-- Runs on first database startup via docker-entrypoint-initdb.d
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ── Admin Boundary Tables ──

CREATE TABLE IF NOT EXISTS admin0_boundaries (
    gid SERIAL PRIMARY KEY,
    country TEXT,
    iso3 TEXT NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326)
);

CREATE TABLE IF NOT EXISTS admin1_boundaries (
    gid SERIAL PRIMARY KEY,
    country TEXT,
    iso3 TEXT,
    name_1 TEXT NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326)
);

CREATE TABLE IF NOT EXISTS admin2_boundaries (
    gid SERIAL PRIMARY KEY,
    country TEXT,
    iso3 TEXT,
    name_1 TEXT,
    name_2 TEXT,
    geom GEOMETRY(MultiPolygon, 4326)
);

-- ── EM-DAT Events Table ──

CREATE TABLE IF NOT EXISTS emdat_events (
    id SERIAL PRIMARY KEY,
    event_key TEXT NOT NULL UNIQUE,
    hazard TEXT NOT NULL,
    country TEXT,
    iso3 TEXT,
    start_year INT,
    end_year INT,
    start_month INT DEFAULT 1,
    end_month INT DEFAULT 12,
    severity TEXT,
    total_affected INT DEFAULT 0,
    total_deaths INT DEFAULT 0,
    total_displaced INT DEFAULT 0,
    description TEXT DEFAULT '',
    geom GEOMETRY(Point, 4326)
);

-- ── Spatial Indexes ──

CREATE INDEX IF NOT EXISTS idx_admin0_geom ON admin0_boundaries USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_admin1_geom ON admin1_boundaries USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_admin2_geom ON admin2_boundaries USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_emdat_geom ON emdat_events USING GIST (geom);

-- ── Regular Indexes ──

CREATE INDEX IF NOT EXISTS idx_emdat_hazard ON emdat_events (hazard);
CREATE INDEX IF NOT EXISTS idx_emdat_iso3 ON emdat_events (iso3);
CREATE INDEX IF NOT EXISTS idx_emdat_event_key ON emdat_events (event_key);
CREATE INDEX IF NOT EXISTS idx_emdat_year ON emdat_events (start_year, end_year);
CREATE INDEX IF NOT EXISTS idx_admin0_iso3 ON admin0_boundaries (iso3);
CREATE INDEX IF NOT EXISTS idx_admin1_iso3 ON admin1_boundaries (iso3);
CREATE INDEX IF NOT EXISTS idx_admin2_iso3 ON admin2_boundaries (iso3);

-- ── SQL Functions (exposed by TiPG as endpoints) ──

-- Get country bounding box by ISO3 code
CREATE OR REPLACE FUNCTION country_bbox(p_iso3 TEXT)
RETURNS TABLE(
    iso3 TEXT,
    country TEXT,
    minx DOUBLE PRECISION,
    miny DOUBLE PRECISION,
    maxx DOUBLE PRECISION,
    maxy DOUBLE PRECISION,
    geom GEOMETRY
) AS $$
    SELECT
        a.iso3,
        a.country,
        ST_XMin(ST_Extent(a.geom)),
        ST_YMin(ST_Extent(a.geom)),
        ST_XMax(ST_Extent(a.geom)),
        ST_YMax(ST_Extent(a.geom)),
        ST_Envelope(ST_Extent(a.geom))
    FROM admin0_boundaries a
    WHERE a.iso3 = p_iso3
    GROUP BY a.iso3, a.country;
$$ LANGUAGE SQL STABLE;

-- Get all events for a hazard with country centroids (powers calendar + choropleth)
CREATE OR REPLACE FUNCTION hazard_events(p_hazard TEXT)
RETURNS TABLE(
    event_key TEXT,
    hazard TEXT,
    country TEXT,
    iso3 TEXT,
    severity TEXT,
    start_year INT,
    end_year INT,
    start_month INT,
    end_month INT,
    total_affected INT,
    total_deaths INT,
    total_displaced INT,
    geom GEOMETRY
) AS $$
    SELECT
        e.event_key, e.hazard, e.country, e.iso3,
        e.severity, e.start_year, e.end_year,
        e.start_month, e.end_month,
        e.total_affected, e.total_deaths, e.total_displaced,
        e.geom
    FROM emdat_events e
    WHERE e.hazard = p_hazard
    ORDER BY e.start_year DESC, e.start_month DESC;
$$ LANGUAGE SQL STABLE;

-- Get admin1 boundaries clipped to a country (for storyline zoom)
CREATE OR REPLACE FUNCTION country_admin1(p_iso3 TEXT)
RETURNS TABLE(
    gid INT,
    country TEXT,
    iso3 TEXT,
    name_1 TEXT,
    geom GEOMETRY
) AS $$
    SELECT a.gid, a.country, a.iso3, a.name_1, a.geom
    FROM admin1_boundaries a
    WHERE a.iso3 = p_iso3;
$$ LANGUAGE SQL STABLE;

-- Get admin2 boundaries clipped to a country
CREATE OR REPLACE FUNCTION country_admin2(p_iso3 TEXT)
RETURNS TABLE(
    gid INT,
    country TEXT,
    iso3 TEXT,
    name_1 TEXT,
    name_2 TEXT,
    geom GEOMETRY
) AS $$
    SELECT a.gid, a.country, a.iso3, a.name_1, a.name_2, a.geom
    FROM admin2_boundaries a
    WHERE a.iso3 = p_iso3;
$$ LANGUAGE SQL STABLE;

-- Aggregate calendar data by hazard, year, month (for heatmap shading)
CREATE OR REPLACE FUNCTION calendar_data(p_hazard TEXT)
RETURNS TABLE(
    year INT,
    month INT,
    event_count BIGINT,
    event_keys TEXT[],
    countries TEXT[],
    max_severity TEXT,
    total_affected BIGINT,
    total_deaths BIGINT,
    geom GEOMETRY
) AS $$
    WITH expanded AS (
        SELECT
            e.event_key, e.iso3, e.country, e.severity,
            e.total_affected, e.total_deaths, e.geom,
            g.y AS year, g.m AS month,
            CASE e.severity
                WHEN 'extreme' THEN 4
                WHEN 'severe' THEN 3
                WHEN 'high' THEN 2
                WHEN 'moderate' THEN 1
                ELSE 0
            END AS sev_rank
        FROM emdat_events e
        CROSS JOIN LATERAL (
            SELECT y, m
            FROM generate_series(e.start_year, e.end_year) AS y
            CROSS JOIN generate_series(1, 12) AS m
            WHERE (y * 100 + m) >= (e.start_year * 100 + e.start_month)
              AND (y * 100 + m) <= (e.end_year * 100 + e.end_month)
        ) g
        WHERE e.hazard = p_hazard
    )
    SELECT
        year, month,
        COUNT(*)::BIGINT AS event_count,
        ARRAY_AGG(DISTINCT event_key) AS event_keys,
        ARRAY_AGG(DISTINCT country) AS countries,
        (ARRAY_AGG(severity ORDER BY sev_rank DESC))[1] AS max_severity,
        SUM(total_affected)::BIGINT,
        SUM(total_deaths)::BIGINT,
        ST_Collect(geom)  -- TiPG needs a geom column
    FROM expanded
    GROUP BY year, month
    ORDER BY year, month;
$$ LANGUAGE SQL STABLE;

-- ── Calendar View: expands events into monthly rows for heatmap ──
-- TiPG auto-discovers views with geometry columns too.
-- Each row = one event contributing to one year-month cell.
-- Frontend groups by (year, month) to get event_count per cell.

CREATE OR REPLACE VIEW emdat_calendar AS
WITH months AS (
    SELECT generate_series(1, 12) AS m
),
years AS (
    SELECT generate_series(
        (SELECT MIN(start_year) FROM emdat_events),
        (SELECT MAX(end_year) FROM emdat_events)
    ) AS y
),
grid AS (
    SELECT y AS year, m AS month FROM years CROSS JOIN months
),
expanded AS (
    SELECT
        e.event_key,
        e.hazard,
        e.country,
        e.iso3,
        e.severity,
        e.total_affected,
        e.total_deaths,
        e.total_displaced,
        e.geom,
        g.year,
        g.month,
        CASE e.severity
            WHEN 'extreme' THEN 4
            WHEN 'severe' THEN 3
            WHEN 'high' THEN 2
            WHEN 'moderate' THEN 1
            ELSE 0
        END AS level
    FROM emdat_events e
    JOIN grid g ON (
        -- Event spans this year-month
        (g.year * 100 + g.month) >= (e.start_year * 100 + e.start_month)
        AND (g.year * 100 + g.month) <= (e.end_year * 100 + e.end_month)
    )
)
SELECT
    ROW_NUMBER() OVER () AS id,
    event_key, hazard, country, iso3, severity,
    total_affected, total_deaths, total_displaced,
    year, month, level,
    1 AS event_count,
    geom
FROM expanded;

-- ── Aggregated calendar summary (no geometry, for fast queries) ──

CREATE OR REPLACE VIEW emdat_calendar_summary AS
SELECT
    hazard,
    year,
    month,
    COUNT(*) AS event_count,
    SUM(total_affected) AS total_affected,
    SUM(total_deaths) AS total_deaths,
    COUNT(DISTINCT iso3) AS countries_affected,
    MAX(level) AS level
FROM emdat_calendar
GROUP BY hazard, year, month;

-- ── Seed EM-DAT Drought Events (11 IGAD countries) ──

INSERT INTO emdat_events (event_key, hazard, country, iso3, start_year, end_year, start_month, end_month, severity, total_affected, total_deaths, total_displaced, description, geom)
VALUES
  ('drought-BDI', 'drought', 'Burundi', 'BDI', 2021, 2022, 1, 6, 'high', 1400000, 0, 0,
   '1.4M people food insecure. Eastern provinces severely affected.',
   ST_SetSRID(ST_MakePoint(29.92, -3.30), 4326)),

  ('drought-DJI', 'drought', 'Djibouti', 'DJI', 2021, 2023, 6, 3, 'severe', 194000, 0, 0,
   '194K people faced food insecurity. 56% increase from February 2022.',
   ST_SetSRID(ST_MakePoint(43.15, 11.57), 4326)),

  ('drought-ERI', 'drought', 'Eritrea', 'ERI', 2021, 2023, 6, 3, 'high', 1600000, 0, 0,
   '1.6M affected. Temperatures increased 1.7C since 1960.',
   ST_SetSRID(ST_MakePoint(38.93, 15.33), 4326)),

  ('2021-9546-ETH', 'drought', 'Ethiopia', 'ETH', 2020, 2023, 10, 6, 'extreme', 24100000, 0, 1400000,
   '24.1M in drought areas. 36.9% children SAM. 4.5M livestock deaths.',
   ST_SetSRID(ST_MakePoint(38.75, 9.02), 4326)),

  ('2021-9152-KEN', 'drought', 'Kenya', 'KEN', 2020, 2023, 10, 6, 'extreme', 4500000, 0, 222720,
   '4.5M affected. 4.4M lacked safe water. 222K children malnourished.',
   ST_SetSRID(ST_MakePoint(36.82, -1.29), 4326)),

  ('drought-RWA', 'drought', 'Rwanda', 'RWA', 2021, 2022, 6, 3, 'moderate', 250000, 0, 0,
   '250K people affected with food shortages.',
   ST_SetSRID(ST_MakePoint(29.87, -1.94), 4326)),

  ('2021-9152-SOM', 'drought', 'Somalia', 'SOM', 2020, 2023, 10, 6, 'extreme', 8300000, 43000, 1400000,
   '8.3M affected. 43K excess deaths in 2022. 1.4M displaced.',
   ST_SetSRID(ST_MakePoint(45.32, 2.05), 4326)),

  ('2021-9639-SSD', 'drought', 'South Sudan', 'SSD', 2019, 2022, 6, 6, 'severe', 7760000, 0, 2200000,
   '7.76M facing severe food insecurity. 43K in IPC Phase 5.',
   ST_SetSRID(ST_MakePoint(31.60, 6.88), 4326)),

  ('2022-9788-SDN', 'drought', 'Sudan', 'SDN', 2020, 2023, 6, 6, 'high', 7740000, 0, 3700000,
   '7.74M food insecure. 3.7M IDPs. 1.1M refugees.',
   ST_SetSRID(ST_MakePoint(32.56, 15.50), 4326)),

  ('drought-TZA', 'drought', 'Tanzania', 'TZA', 2022, 2023, 6, 6, 'severe', 2200000, 0, 0,
   '2.2M facing food shortages. 70% crop failure in northern regions.',
   ST_SetSRID(ST_MakePoint(34.89, -6.37), 4326)),

  ('2022-9436-UGA', 'drought', 'Uganda', 'UGA', 2021, 2022, 6, 12, 'extreme', 518000, 900, 0,
   '900+ dead from hunger in Karamoja. 518K in IPC Phase 4.',
   ST_SetSRID(ST_MakePoint(32.58, 0.35), 4326))
ON CONFLICT (event_key) DO NOTHING;

-- ── Seed EM-DAT Flood Events (11 IGAD countries) ──

INSERT INTO emdat_events (event_key, hazard, country, iso3, start_year, end_year, start_month, end_month, severity, total_affected, total_deaths, total_displaced, description, geom)
VALUES
  ('2023-0812', 'flood', 'Burundi', 'BDI', 2023, 2024, 10, 4, 'severe', 203944, 0, 98000,
   'El Nino flooding along Lake Tanganyika. 19,250+ homes destroyed.',
   ST_SetSRID(ST_MakePoint(29.92, -3.37), 4326)),

  ('2019-0642', 'flood', 'Djibouti', 'DJI', 2019, 2019, 11, 11, 'high', 250000, 9, 0,
   '300mm rainfall (3x annual average). 9 deaths including 7 children.',
   ST_SetSRID(ST_MakePoint(43.15, 11.57), 4326)),

  ('flood-ERI', 'flood', 'Eritrea', 'ERI', 2024, 2024, 5, 5, 'moderate', 5000, 0, 2000,
   'Localized flooding in lowland areas near Red Sea coast.',
   ST_SetSRID(ST_MakePoint(38.93, 15.33), 4326)),

  ('2024-0189', 'flood', 'Ethiopia', 'ETH', 2024, 2024, 4, 5, 'extreme', 590000, 0, 95000,
   'River flooding across Afar, Somali, and Oromia regions.',
   ST_SetSRID(ST_MakePoint(38.75, 9.02), 4326)),

  ('2024-0156', 'flood', 'Kenya', 'KEN', 2024, 2024, 3, 4, 'extreme', 165000, 188, 165000,
   'Worst flooding in decades. El Nino + Cyclone Hidaya.',
   ST_SetSRID(ST_MakePoint(36.82, -1.29), 4326)),

  ('2023-0283', 'flood', 'Rwanda', 'RWA', 2023, 2023, 5, 5, 'extreme', 52000, 131, 20000,
   'Catastrophic floods and landslides near Lake Kivu. 131 deaths.',
   ST_SetSRID(ST_MakePoint(29.87, -1.94), 4326)),

  ('2023-0891', 'flood', 'Somalia', 'SOM', 2023, 2024, 10, 6, 'extreme', 2500000, 4, 1200000,
   'Unprecedented Deyr flooding. $193.4M in damages.',
   ST_SetSRID(ST_MakePoint(45.32, 2.05), 4326)),

  ('2024-0512', 'flood', 'South Sudan', 'SSD', 2024, 2024, 8, 10, 'extreme', 1400000, 0, 379000,
   '48,000 km2 flood extent. Elevated Nile River levels.',
   ST_SetSRID(ST_MakePoint(31.60, 6.88), 4326)),

  ('2024-0445', 'flood', 'Sudan', 'SDN', 2024, 2024, 6, 9, 'severe', 50000, 5, 10000,
   'Devastated communities in Kassala, North Darfur, Sennar.',
   ST_SetSRID(ST_MakePoint(32.56, 15.50), 4326)),

  ('2023-0924', 'flood', 'Tanzania', 'TZA', 2023, 2024, 11, 4, 'severe', 200000, 155, 51000,
   'El Nino + Indian Ocean Dipole. 155 deaths, 236 injuries.',
   ST_SetSRID(ST_MakePoint(34.89, -6.37), 4326)),

  ('2023-0744', 'flood', 'Uganda', 'UGA', 2023, 2023, 1, 12, 'high', 98000, 0, 8000,
   'Year-long storms, floods, and landslides across communities.',
   ST_SetSRID(ST_MakePoint(32.58, 0.35), 4326))
ON CONFLICT (event_key) DO NOTHING;
