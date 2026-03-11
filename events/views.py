"""
Proxy views for external API endpoints (Cloud Run, STAC, eoAPI).
Falls back to local mock data when external APIs are unavailable.
"""

import json
import random
from django.conf import settings
from django.http import JsonResponse


def proxy_emdat(request, path=""):
    """
    Proxy EM-DAT requests to Cloud Run backend.
    Falls back to mock data when API is unavailable.
    """
    import httpx

    target = f"{settings.CLOUDRUN_API_URL}/api/{path}"
    if request.META.get("QUERY_STRING"):
        target += f"?{request.META['QUERY_STRING']}"

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(target)
            if resp.status_code == 200:
                return JsonResponse(resp.json(), safe=False)
    except Exception:
        pass

    # Fallback: generate mock data based on the endpoint
    if "emdat-monthly-risk" in path or path == "":
        hazard = request.GET.get("type", "drought")
        return _mock_monthly_risk(hazard)
    elif "emdat-month-regions" in path:
        return _mock_regions()
    elif "emdat-event-markdown" in path:
        event_key = path.split("/")[-1] if "/" in path else path
        return _mock_markdown(event_key)

    return JsonResponse({"error": "Unknown endpoint"}, status=404)


def proxy_stac(request, path=""):
    """Proxy STAC API requests."""
    import httpx

    target = f"{settings.STAC_API_URL}/{path}"
    if request.META.get("QUERY_STRING"):
        target += f"?{request.META['QUERY_STRING']}"

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(target)
            return JsonResponse(resp.json(), safe=False, status=resp.status_code)
    except Exception:
        return JsonResponse({"error": "STAC API unavailable"}, status=502)


# ── Mock data generators ──

def _mock_monthly_risk(hazard):
    """Generate realistic mock EM-DAT monthly risk data."""
    data = []
    for year in range(2020, 2026):
        for month in range(1, 13):
            count = random.randint(0, 11)
            if count > 0:
                data.append({
                    "year": year,
                    "month": month,
                    "event_count": count,
                    "event_key": f"{hazard}-{year}-{month}",
                    "total_deaths": random.randint(0, 50) * count,
                    "total_affected": random.randint(100, 5000) * count,
                    "regions_affected": random.randint(1, 8),
                    "countries_affected": random.randint(1, 5),
                    "level": min(count, 5),
                })
    return JsonResponse({"data": data})


def _mock_regions():
    """Generate mock Admin2 region data using real shapeIDs from ea_adm2.topojson."""
    # Real shapeIDs from the TopoJSON file
    all_regions = [
        {"shapeID": "KEN-ADM2-3_0_0-B1", "shapeName": "BARINGO", "shapeGroup": "KEN"},
        {"shapeID": "KEN-ADM2-3_0_0-B2", "shapeName": "BOMET", "shapeGroup": "KEN"},
        {"shapeID": "KEN-ADM2-3_0_0-B3", "shapeName": "BONDO", "shapeGroup": "KEN"},
        {"shapeID": "ETH-ADM2-3_0_0-B1", "shapeName": "Afder", "shapeGroup": "ETH"},
        {"shapeID": "ETH-ADM2-3_0_0-B2", "shapeName": "Agnuak", "shapeGroup": "ETH"},
        {"shapeID": "ETH-ADM2-3_0_0-B3", "shapeName": "Alaba", "shapeGroup": "ETH"},
        {"shapeID": "SOM-ADM2-3_0_0-B1", "shapeName": "Balcad", "shapeGroup": "SOM"},
        {"shapeID": "SOM-ADM2-3_0_0-B2", "shapeName": "Burtinle", "shapeGroup": "SOM"},
        {"shapeID": "SOM-ADM2-3_0_0-B3", "shapeName": "Ceel Afweyn", "shapeGroup": "SOM"},
        {"shapeID": "UGA-ADM2-3_0_0-B1", "shapeName": "ABIM", "shapeGroup": "UGA"},
        {"shapeID": "UGA-ADM2-3_0_0-B2", "shapeName": "ADJUMANI", "shapeGroup": "UGA"},
        {"shapeID": "TZA-ADM2-3_0_0-B1", "shapeName": "Bagamoyo", "shapeGroup": "TZA"},
        {"shapeID": "TZA-ADM2-3_0_0-B2", "shapeName": "Bariadi", "shapeGroup": "TZA"},
        {"shapeID": "SDN-ADM2-3_0_0-B1", "shapeName": "Jabal Aulia", "shapeGroup": "SDN"},
        {"shapeID": "SDN-ADM2-3_0_0-B2", "shapeName": "Umm Badda", "shapeGroup": "SDN"},
        {"shapeID": "SSD-ADM2-3_0_0-B1", "shapeName": "Morobo", "shapeGroup": "SSD"},
        {"shapeID": "SSD-ADM2-3_0_0-B2", "shapeName": "Kajo-keji", "shapeGroup": "SSD"},
        {"shapeID": "DJI-ADM2-3_0_0-B1", "shapeName": "Alaili Dadda", "shapeGroup": "DJI"},
        {"shapeID": "ERI-ADM2-3_0_0-B1", "shapeName": "Tesseney", "shapeGroup": "ERI"},
        {"shapeID": "RWA-ADM2-3_0_0-B1", "shapeName": "Nyarugenge", "shapeGroup": "RWA"},
        {"shapeID": "RWA-ADM2-3_0_0-B2", "shapeName": "Gasabo", "shapeGroup": "RWA"},
        {"shapeID": "BDI-ADM2-3_0_0-B1", "shapeName": "Ryansoro", "shapeGroup": "BDI"},
    ]
    # Randomly assign frequencies
    regions = []
    for r in all_regions:
        freq = random.randint(0, 10)
        if freq > 0:
            regions.append({**r, "frequency": freq})
    return JsonResponse({"regions": regions})


def _mock_markdown(event_key):
    """Generate mock storyline markdown for an event."""
    parts = event_key.split("-") if event_key else []
    hazard = parts[0] if len(parts) > 0 else "unknown"
    year = parts[1] if len(parts) > 1 else "2024"
    month = parts[2] if len(parts) > 2 else "1"

    month_names = [
        "", "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    month_name = month_names[int(month)] if month.isdigit() and 1 <= int(month) <= 12 else month

    md = f"""## {hazard.title()} Events — {month_name} {year}

### Overview

During {month_name} {year}, multiple {hazard} events were recorded across the
IGAD region affecting several countries in East Africa.

### Key Impacts

- **Affected Population**: Multiple communities across the region
- **Countries Involved**: Kenya, Ethiopia, Somalia, South Sudan, and others
- **Duration**: Throughout {month_name} {year}

### Regional Context

The {hazard} conditions during this period were influenced by prevailing
climate patterns including {"La Nina conditions contributing to below-average rainfall" if hazard == "drought" else "enhanced moisture transport from the Indian Ocean"}.

### Response

ICPAC issued early warnings through the Greater Horn of Africa Climate
Outlook Forum (GHACOF), enabling preparedness actions by national
meteorological services and humanitarian agencies.

---

*Data source: EM-DAT International Disaster Database. Event key: {event_key}*
"""
    return JsonResponse({"markdown": md, "event_key": event_key})
