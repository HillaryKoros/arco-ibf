from django.db import models
from django.contrib.gis.db import models as gis_models
from wagtail.models import Page
from wagtail.fields import RichTextField, StreamField
from wagtail.admin.panels import FieldPanel, MultiFieldPanel
from wagtail.api import APIField
from wagtail import blocks


class HazardChoiceBlock(blocks.ChoiceBlock):
    choices = [
        ("drought", "Drought"),
        ("flood", "Flood"),
    ]


class DisasterEventsPage(Page):
    """
    Tab 1: EM-DAT calendar heatmap + Admin1 choropleth map.
    When a user clicks a calendar cell, the storyline (MDX markdown)
    renders below the map. Hazard toggle filters between drought/flood.
    """

    subtitle = models.CharField(
        max_length=255,
        blank=True,
        default="Explore multi-decade EM-DAT events, view affected regions, and read event storylines.",
    )
    default_hazard = models.CharField(
        max_length=20,
        choices=[("drought", "Drought"), ("flood", "Flood")],
        default="drought",
        help_text="Default hazard type shown on page load.",
    )
    calendar_start_year = models.IntegerField(
        default=2020,
        help_text="First year displayed in the calendar heatmap.",
    )
    calendar_end_year = models.IntegerField(
        default=2025,
        help_text="Last year displayed in the calendar heatmap.",
    )
    topojson_url = models.CharField(
        max_length=500,
        blank=True,
        default="/static/data/ea_adm2.topojson",
        help_text="Path or URL to the Admin boundary TopoJSON file.",
    )

    content_panels = Page.content_panels + [
        FieldPanel("subtitle"),
        MultiFieldPanel(
            [
                FieldPanel("default_hazard"),
                FieldPanel("calendar_start_year"),
                FieldPanel("calendar_end_year"),
                FieldPanel("topojson_url"),
            ],
            heading="Visualization Settings",
        ),
    ]

    api_fields = [
        APIField("subtitle"),
        APIField("default_hazard"),
        APIField("calendar_start_year"),
        APIField("calendar_end_year"),
        APIField("topojson_url"),
    ]

    template = "events/disaster_events_page.html"
    parent_page_types = ["home.HomePage"]
    subpage_types = []

    class Meta:
        verbose_name = "Disaster Events Page"


class RiskMonitoringPage(Page):
    """
    Tab 2: CRMA — Regional situational awareness dashboard.
    Links to country-level CRMA dashboards for the chosen hazard.
    """

    subtitle = models.CharField(
        max_length=255,
        blank=True,
        default="Regional situational awareness for flood and drought monitoring.",
    )
    body = RichTextField(
        blank=True,
        help_text="Introductory content for the risk monitoring section.",
    )
    crma_dashboard_url = models.URLField(
        blank=True,
        help_text="External URL to the full CRMA dashboard.",
    )
    default_hazard = models.CharField(
        max_length=20,
        choices=[("drought", "Drought"), ("flood", "Flood")],
        default="drought",
    )

    content_panels = Page.content_panels + [
        FieldPanel("subtitle"),
        FieldPanel("default_hazard"),
        FieldPanel("body"),
        FieldPanel("crma_dashboard_url"),
    ]

    api_fields = [
        APIField("subtitle"),
        APIField("body"),
        APIField("crma_dashboard_url"),
        APIField("default_hazard"),
    ]

    template = "events/risk_monitoring_page.html"
    parent_page_types = ["home.HomePage"]
    subpage_types = []

    class Meta:
        verbose_name = "Risk Monitoring Page"


class IBFForecastPage(Page):
    """
    Tab 3: Impact-Based Forecasting — Admin1 BN seasonal projections.
    """

    subtitle = models.CharField(
        max_length=255,
        blank=True,
        default="Admin1 Bayesian Network seasonal probability and severity projections.",
    )
    body = RichTextField(
        blank=True,
        help_text="Introductory content for the IBF forecast section.",
    )
    ibf_dashboard_url = models.URLField(
        blank=True,
        help_text="External URL to the full IBF dashboard.",
    )
    default_hazard = models.CharField(
        max_length=20,
        choices=[("drought", "Drought"), ("flood", "Flood")],
        default="drought",
    )

    content_panels = Page.content_panels + [
        FieldPanel("subtitle"),
        FieldPanel("default_hazard"),
        FieldPanel("body"),
        FieldPanel("ibf_dashboard_url"),
    ]

    api_fields = [
        APIField("subtitle"),
        APIField("body"),
        APIField("ibf_dashboard_url"),
        APIField("default_hazard"),
    ]

    template = "events/ibf_forecast_page.html"
    parent_page_types = ["home.HomePage"]
    subpage_types = []

    class Meta:
        verbose_name = "IBF Forecast Page"


class StorylineEntry(Page):
    """
    Individual storyline — an authored MDX/rich-text narrative for a
    specific disaster event. Child of DisasterEventsPage.
    Rendered inline when a user selects a calendar cell.
    """

    hazard_type = models.CharField(
        max_length=20,
        choices=[("drought", "Drought"), ("flood", "Flood")],
    )
    event_key = models.CharField(
        max_length=100,
        blank=True,
        help_text="EM-DAT event key (e.g. drought-2023-03).",
    )
    event_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date of the disaster event.",
    )
    body = RichTextField(
        help_text="Narrative storyline for this event.",
    )
    regions_affected = models.CharField(
        max_length=500,
        blank=True,
        help_text="Comma-separated list of affected regions.",
    )

    content_panels = Page.content_panels + [
        MultiFieldPanel(
            [
                FieldPanel("hazard_type"),
                FieldPanel("event_key"),
                FieldPanel("event_date"),
                FieldPanel("regions_affected"),
            ],
            heading="Event Metadata",
        ),
        FieldPanel("body"),
    ]

    api_fields = [
        APIField("hazard_type"),
        APIField("event_key"),
        APIField("event_date"),
        APIField("body"),
        APIField("regions_affected"),
    ]

    template = "events/storyline_entry.html"
    parent_page_types = ["events.DisasterEventsPage"]
    subpage_types = []

    class Meta:
        verbose_name = "Storyline Entry"
        verbose_name_plural = "Storyline Entries"


# ── GIS Models (shared with TiPG via PostGIS) ──


class EMDATEvent(models.Model):
    """EM-DAT disaster event — managed via Wagtail admin, served via TiPG."""
    event_key = models.CharField(max_length=50, unique=True)
    hazard = models.CharField(max_length=20, choices=[("drought", "Drought"), ("flood", "Flood")])
    country = models.CharField(max_length=100)
    iso3 = models.CharField(max_length=3)
    start_year = models.IntegerField()
    end_year = models.IntegerField()
    start_month = models.IntegerField(default=1)
    end_month = models.IntegerField(default=12)
    severity = models.CharField(max_length=20, choices=[
        ("extreme", "Extreme"), ("severe", "Severe"),
        ("high", "High"), ("moderate", "Moderate"),
    ])
    total_affected = models.IntegerField(default=0)
    total_deaths = models.IntegerField(default=0)
    total_displaced = models.IntegerField(default=0)
    description = models.TextField(blank=True)
    geom = gis_models.PointField(srid=4326, null=True, blank=True)

    class Meta:
        db_table = "emdat_events"
        managed = False  # Table created by SQL init script, read by TiPG
        ordering = ["-start_year", "-start_month"]

    def __str__(self):
        return f"{self.event_key} — {self.country} ({self.hazard})"


class Admin0Boundary(models.Model):
    """Country-level boundaries — served as vector tiles via TiPG."""
    country = models.CharField(max_length=100)
    iso3 = models.CharField(max_length=3)
    geom = gis_models.MultiPolygonField(srid=4326)

    class Meta:
        db_table = "admin0_boundaries"
        managed = False
        verbose_name_plural = "Admin0 Boundaries"


class Admin1Boundary(models.Model):
    """Province/State boundaries — served as vector tiles via TiPG."""
    country = models.CharField(max_length=100)
    iso3 = models.CharField(max_length=3)
    name_1 = models.CharField(max_length=100)
    geom = gis_models.MultiPolygonField(srid=4326)

    class Meta:
        db_table = "admin1_boundaries"
        managed = False
        verbose_name_plural = "Admin1 Boundaries"


class Admin2Boundary(models.Model):
    """District-level boundaries — served as vector tiles via TiPG."""
    country = models.CharField(max_length=100)
    iso3 = models.CharField(max_length=3)
    name_1 = models.CharField(max_length=100)
    name_2 = models.CharField(max_length=100)
    geom = gis_models.MultiPolygonField(srid=4326)

    class Meta:
        db_table = "admin2_boundaries"
        managed = False
        verbose_name_plural = "Admin2 Boundaries"
