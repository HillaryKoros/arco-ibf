from django.db import models
from wagtail.models import Page
from wagtail.fields import RichTextField
from wagtail.admin.panels import FieldPanel
from wagtail.api import APIField


class HomePage(Page):
    banner_title = models.CharField(max_length=255, default="E4DRR Early Warning System")
    banner_subtitle = models.CharField(
        max_length=500,
        blank=True,
        default="Flood & Drought Early Warning for East Africa",
    )
    intro_text = RichTextField(
        blank=True,
        default="Explore multi-decade EM-DAT disaster events, risk monitoring dashboards, and impact-based forecasts.",
    )

    content_panels = Page.content_panels + [
        FieldPanel("banner_title"),
        FieldPanel("banner_subtitle"),
        FieldPanel("intro_text"),
    ]

    api_fields = [
        APIField("banner_title"),
        APIField("banner_subtitle"),
        APIField("intro_text"),
    ]

    max_count = 1
    subpage_types = [
        "events.DisasterEventsPage",
        "events.RiskMonitoringPage",
        "events.IBFForecastPage",
    ]

    def get_context(self, request):
        context = super().get_context(request)
        context["child_pages"] = self.get_children().live().specific()
        return context
