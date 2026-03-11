from django.urls import path

from . import views

urlpatterns = [
    path("proxy/emdat/<path:path>", views.proxy_emdat, name="proxy_emdat"),
    path("proxy/emdat/", views.proxy_emdat, name="proxy_emdat_root"),
    path("proxy/stac/<path:path>", views.proxy_stac, name="proxy_stac"),
    path("proxy/stac/", views.proxy_stac, name="proxy_stac_root"),
]
