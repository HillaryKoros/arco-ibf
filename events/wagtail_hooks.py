from wagtail.snippets.models import register_snippet
from wagtail.snippets.views.snippets import SnippetViewSet

from .models import EMDATEvent


class EMDATEventViewSet(SnippetViewSet):
    model = EMDATEvent
    icon = "warning"
    menu_label = "EM-DAT Events"
    menu_name = "emdat-events"
    menu_order = 200
    add_to_admin_menu = True
    list_display = ["event_key", "hazard", "country", "iso3", "severity", "start_year", "end_year"]
    list_filter = ["hazard", "severity", "iso3"]
    search_fields = ["event_key", "country", "description"]


register_snippet(EMDATEventViewSet)
