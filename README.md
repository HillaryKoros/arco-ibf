# E4DRR CRMA — Flood & Drought Compound Risk Monitoring & Assessment

A full-stack platform for monitoring and assessing compound flood and drought disaster risks across the IGAD region. Built on EM-DAT historical events, GADM administrative boundaries, and real-time geospatial APIs.

## Architecture

```
                         ┌─────────────────────────┐
                         │   Nginx (port 9080)      │
                         │   Reverse Proxy           │
                         └─────┬───┬───┬───┬────────┘
                               │   │   │   │
               ┌───────────────┘   │   │   └───────────────┐
               ▼                   ▼   ▼                   ▼
        ┌─────────────┐  ┌──────────┐ ┌──────────┐  ┌──────────┐
        │  Frontend    │  │   CMS    │ │  GeoAPI  │  │  Titiler │
        │  Next.js     │  │  Wagtail │ │  FastAPI  │  │  COG     │
        │  port 3000   │  │  port    │ │  + TiPG   │  │  Raster  │
        │              │  │  8000    │ │  port     │  │  port 80 │
        │  /           │  │  /admin/ │ │  8080     │  │  /cog/   │
        │              │  │  /api/   │ │  /geo/    │  │          │
        └─────────────┘  └────┬─────┘ └────┬──────┘  └──────────┘
                               │            │
                               ▼            ▼
                         ┌─────────────────────────┐
                         │  PostGIS (PostgreSQL)     │
                         │  GADM boundaries +        │
                         │  EM-DAT events            │
                         └─────────────────────────┘
```

## Services

| Service | Tech | Port | Route | Purpose |
|---------|------|------|-------|---------|
| **nginx** | Nginx 1.27 | 9080 (host) | — | Reverse proxy, single entry point |
| **db** | PostGIS 16 | 5432 (internal) | — | Shared database (GADM boundaries + EM-DAT events) |
| **cms** | Django / Wagtail | 8000 (internal) | `/admin/`, `/api/` | Content management + REST API |
| **geoapi** | FastAPI + TiPG | 8080 (internal) | `/geo/` | OGC vector tiles, features, custom geo endpoints |
| **titiler** | Titiler | 80 (internal) | `/cog/` | COG raster tile server |
| **frontend** | Next.js 14 | 3000 (internal) | `/` | SSR dashboard (maps, calendar heatmaps, storylines) |

## Quick Start

### Prerequisites

- Docker & Docker Compose v2+
- Git

### Setup

```bash
# Clone the repository
git clone -b crma-deployed https://github.com/HillaryKoros/arco-ibf.git
cd arco-ibf

# Create environment file
cp .env.example .env

# Start all services
docker compose up -d

# Open in browser
open http://localhost:9080
```

### Database Initialization

On first start, the `db-init/` scripts automatically:
1. Create PostGIS extensions
2. Load GADM admin boundaries (admin0, admin1, admin2)
3. Seed EM-DAT disaster events
4. Create materialized views and helper functions

## API Documentation

| Service | Docs URL | Description |
|---------|----------|-------------|
| **GeoAPI** (Swagger) | [/geo/docs](http://41.139.151.242:9080/geo/docs) | Interactive API explorer — OGC collections, calendar, choropleth, events |
| **GeoAPI** (ReDoc) | [/geo/redoc](http://41.139.151.242:9080/geo/redoc) | Clean read-only API reference |
| **Titiler** | [/cog/api.html](http://41.139.151.242:9080/cog/api.html) | COG raster tile endpoints — tiles, previews, statistics |
| **CMS Admin** | [/admin/](http://41.139.151.242:9080/admin/) | Wagtail admin panel — manage pages, media, storylines |
| **CMS REST API** | [/api/v2/pages/](http://41.139.151.242:9080/api/v2/pages/) | Wagtail pages API |

### Key GeoAPI Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /geo/api/calendar?hazard=drought` | Calendar heatmap — monthly event aggregation |
| `GET /geo/api/choropleth?hazard=flood` | Choropleth — affected countries with frequency |
| `GET /geo/api/events?hazard=drought` | All EM-DAT events for a hazard type |
| `GET /geo/api/bbox/{iso3}` | Bounding box for a country (map fitBounds) |
| `GET /geo/collections` | OGC collections — admin boundaries, events |

## CI/CD Pipeline

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push to `crma-deployed`:

```
checksums → build → check → security → deploy
```

| Stage | What it does |
|-------|-------------|
| **Checksums** | SHA256 hash of source files per service — skips rebuild if content unchanged |
| **Build** | Builds only changed Docker images, pushes to GHCR |
| **Check** | ESLint + TypeScript type check (frontend only) |
| **Security** | Trivy vulnerability scan + npm audit + pip-audit |
| **Deploy** | SSH to staging, pull pre-built images, `docker compose up -d` |

### Image Tags

Each image gets 4 tags:

| Tag | Example | Purpose |
|-----|---------|---------|
| `:latest` | `crma-cms:latest` | Always newest |
| `:v{version}` | `crma-cms:v0.1.0` | Semantic version (from `VERSION` file) |
| `:YYYY-MM-DD` | `crma-cms:2026-03-11` | Date-based rollback |
| `:sha-{hash}` | `crma-cms:sha-abc123f` | Commit traceability |

### Container Registry

Images are published to GitHub Container Registry:

- `ghcr.io/hillarykoros/crma-cms`
- `ghcr.io/hillarykoros/crma-geoapi`
- `ghcr.io/hillarykoros/crma-frontend`

## Environment Variables

See [`.env.example`](.env.example) for all available variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CRMA_PORT` | `9080` | Nginx public port |
| `DB_PASSWORD` | `e4drr_dev` | PostGIS password |
| `DJANGO_SETTINGS_MODULE` | `disasterevents_cms.settings.dev` | Django settings |
| `DJANGO_SECRET_KEY` | `change-me-in-production` | Django secret key |

## Project Structure

```
arco-ibf/
├── .github/workflows/ci.yml    # CI/CD pipeline
├── nginx/nginx.conf             # Reverse proxy config
├── db-init/                     # Database init scripts (SQL, boundaries, events)
├── disasterevents_cms/          # Django/Wagtail project settings
├── events/                      # Disaster events app (models, API, views)
├── home/                        # Wagtail home page app
├── search/                      # Wagtail search app
├── geoapi/                      # FastAPI + TiPG geospatial API
├── frontend/                    # Next.js SSR dashboard
├── Dockerfile                   # CMS Docker image
├── docker-compose.yml           # Full stack orchestration
├── VERSION                      # Semantic version (used in image tags)
└── .env.example                 # Environment template
```

## Staging

- **URL**: http://41.139.151.242:9080
- **CMS Admin**: http://41.139.151.242:9080/admin/

## Future Integration — Google Cloud Run & Cloud SQL

The current Docker Compose stack is designed as a portable boilerplate that maps directly to managed cloud services. Below is the migration path to Google Cloud Platform:

### Service Mapping

| Current (Docker Compose) | GCP Equivalent | Notes |
|--------------------------|----------------|-------|
| **db** (PostGIS container) | **Cloud SQL for PostgreSQL** | Enable PostGIS extension; use private IP for VPC connectivity |
| **cms** (Wagtail) | **Cloud Run** (service) | Stateless container; connect to Cloud SQL via Unix socket proxy |
| **geoapi** (FastAPI + TiPG) | **Cloud Run** (service) | Stateless; connect to same Cloud SQL instance |
| **frontend** (Next.js) | **Cloud Run** (service) | SSR container; env vars point to CMS/GeoAPI internal URLs |
| **titiler** (COG raster) | **Cloud Run** (service) | Stateless; reads COGs from GCS buckets |
| **nginx** (reverse proxy) | **Cloud Load Balancer** + **Cloud Run URL maps** | Or use Firebase Hosting rewrites for path-based routing |
| **media volumes** | **Google Cloud Storage (GCS)** | Django Storages backend (`django-storages[google]`) |
| **GHCR** | **Artifact Registry** | Store container images in GCP's registry |

### Migration Steps

1. **Database**: Create a Cloud SQL PostgreSQL instance with PostGIS, migrate data using `pg_dump` / `pg_restore`
2. **Container Images**: Push to Artifact Registry (`gcr.io/{project}/crma-cms`, etc.) or keep GHCR
3. **Cloud Run Services**: Deploy each service as a separate Cloud Run service with:
   - Cloud SQL connection via `--add-cloudsql-instances`
   - Environment variables for DB credentials (use Secret Manager)
   - Min instances = 0 for cost savings, or = 1 for low latency
4. **Routing**: Use Cloud Load Balancer with URL maps:
   - `/` → frontend Cloud Run service
   - `/api/*`, `/admin/*` → cms Cloud Run service
   - `/geo/*` → geoapi Cloud Run service
   - `/cog/*` → titiler Cloud Run service
5. **Storage**: Switch Django media backend to GCS using `django-storages`
6. **CI/CD**: Update GitHub Actions deploy step to use `gcloud run deploy` instead of SSH

### Example Cloud Run Deploy (CI/CD)

```yaml
# Replace the SSH deploy step with:
- name: Deploy CMS to Cloud Run
  run: |
    gcloud run deploy crma-cms \
      --image ${{ env.REGISTRY }}/${{ env.OWNER }}/crma-cms:latest \
      --region us-central1 \
      --platform managed \
      --add-cloudsql-instances ${{ secrets.CLOUD_SQL_INSTANCE }} \
      --set-env-vars "DB_ENGINE=django.contrib.gis.db.backends.postgis" \
      --set-secrets "DB_PASSWORD=crma-db-password:latest" \
      --allow-unauthenticated
```

### Cost Optimization

- Cloud Run scales to zero when idle (pay only for requests)
- Cloud SQL can use a small instance (db-f1-micro) for dev/staging
- Titiler reads COGs directly from GCS — no persistent storage needed
- Use Cloud CDN in front of the load balancer for caching tiles

## License

ICPAC / IGAD — E4DRR Project
