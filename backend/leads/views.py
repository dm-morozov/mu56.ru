from io import BytesIO

from django.conf import settings
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET
from rest_framework import generics, status
from rest_framework.exceptions import ParseError
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .serializers import LeadCreateSerializer
from catalog.models import Offering, Availability, PriceOption
from catalog.pricing import transformer_quote, animation_quote


@never_cache
@require_GET
def csrf_token(request):
    return JsonResponse({"csrf_token": get_token(request)})


@never_cache
@require_GET
def quote_transformer(request):
    """Read-only preview: accepts catalogue slugs, never contact information."""
    query = request.GET
    if set(query) - {"offering", "addons"} or any(len(query.getlist(key)) != 1 for key in query):
        return JsonResponse({"detail": "Укажите программу и разные шоу."}, status=400)
    addon_slugs = query.get("addons", "").split(",") if query.get("addons") else []
    if len(addon_slugs) > 3 or len(set(addon_slugs)) != len(addon_slugs):
        return JsonResponse({"detail": "Выберите разные шоу, не более трёх."}, status=400)
    try:
        program = Offering.objects.get(slug=query.get("offering", ""), kind=Offering.Kind.TRANSFORMER, is_listed=True)
        if program.availability == Availability.UNAVAILABLE:
            raise ValueError()
        shows = list(Offering.objects.filter(slug__in=addon_slugs, kind=Offering.Kind.SHOW, is_listed=True).exclude(availability=Availability.UNAVAILABLE))
        if len(shows) != len(addon_slugs):
            raise ValueError()
        return JsonResponse(transformer_quote(program, shows))
    except (Offering.DoesNotExist, ValueError, PriceOption.DoesNotExist, PriceOption.MultipleObjectsReturned):
        return JsonResponse({"detail": "Этот состав требует уточнения цены. Выберите другое шоу или опишите пожелания."}, status=400)


@never_cache
@require_GET
def quote_animation(request):
    """Read-only preview: accepts catalogue slugs, never contact information."""
    query = request.GET
    if set(query) - {"offering", "addons"} or any(len(query.getlist(key)) != 1 for key in query):
        return JsonResponse({"detail": "Укажите программу и разные шоу."}, status=400)
    addon_slugs = query.get("addons", "").split(",") if query.get("addons") else []
    if len(addon_slugs) > 6 or len(set(addon_slugs)) != len(addon_slugs):
        return JsonResponse({"detail": "Выберите разные шоу, не более шести."}, status=400)
    try:
        program = Offering.objects.get(slug=query.get("offering", ""), kind=Offering.Kind.ANIMATION, is_listed=True)
        if program.availability == Availability.UNAVAILABLE:
            raise ValueError()
        shows = list(Offering.objects.filter(slug__in=addon_slugs, kind=Offering.Kind.SHOW, is_listed=True).exclude(availability=Availability.UNAVAILABLE))
        if len(shows) != len(addon_slugs):
            raise ValueError()
        return JsonResponse(animation_quote(program, shows))
    except (Offering.DoesNotExist, ValueError, PriceOption.DoesNotExist, PriceOption.MultipleObjectsReturned):
        return JsonResponse({"detail": "Этот состав требует уточнения цены. Выберите другое шоу или опишите пожелания."}, status=400)


class LimitedJSONParser(JSONParser):
    def parse(self, stream, media_type=None, parser_context=None):
        limit = settings.DATA_UPLOAD_MAX_MEMORY_SIZE
        body = stream.read(limit + 1)
        if len(body) > limit:
            raise ParseError("Заявка слишком большая.")
        return super().parse(BytesIO(body), media_type, parser_context)


@method_decorator(csrf_protect, name="dispatch")
class LeadCreate(generics.CreateAPIView):
    serializer_class = LeadCreateSerializer
    parser_classes = [LimitedJSONParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "lead_create"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lead = serializer.save()
        response = Response({
            "reference": str(lead.pk), "status": "received",
            "message": "Заявка сохранена. Дату, состав программы и стоимость выезда согласуем отдельно.",
        }, status=status.HTTP_201_CREATED)
        response["Cache-Control"] = "no-store"
        return response


def csrf_failure(request, reason=""):
    if request.path.startswith("/api/"):
        return JsonResponse({"detail": "Обновите страницу и попробуйте отправить заявку снова."}, status=403)
    from django.views.csrf import csrf_failure as default_failure
    return default_failure(request, reason=reason)
