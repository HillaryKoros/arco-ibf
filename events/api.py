"""
API endpoints for the E4DRR Disaster Events CMS.

Exposes:
  /api/v2/pages/         — Wagtail pages API (events, monitoring, forecast, storylines)
  /api/v2/images/        — Wagtail images API
  /api/v2/documents/     — Wagtail documents API
  /api/proxy/emdat/      — Proxy to Cloud Run EM-DAT endpoints
  /api/proxy/forecast/   — Proxy to Cloud Run forecast endpoints
"""

from wagtail.api.v2.views import PagesAPIViewSet
from wagtail.api.v2.router import WagtailAPIRouter
from wagtail.images.api.v2.views import ImagesAPIViewSet
from wagtail.documents.api.v2.views import DocumentsAPIViewSet

from .models import DisasterEventsPage, StorylineEntry

# Wagtail API router
api_router = WagtailAPIRouter("wagtailapi")

api_router.register_endpoint("pages", PagesAPIViewSet)
api_router.register_endpoint("images", ImagesAPIViewSet)
api_router.register_endpoint("documents", DocumentsAPIViewSet)


# Custom viewset for storyline entries
class StorylineAPIViewSet(PagesAPIViewSet):
    """API endpoint that returns only StorylineEntry pages."""

    model = StorylineEntry
    name = "storylines"


api_router.register_endpoint("storylines", StorylineAPIViewSet)
