from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.urls import include, path


def health(request):
    return JsonResponse({"status": "ok", "service": "mu56-backend"})


urlpatterns = [
    path("admin/", admin.site.urls), path("health/", health),
    path("api/v1/", include("catalog.urls")),
    path("api/v1/", include("leads.urls")),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
