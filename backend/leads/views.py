from io import BytesIO
import json
import uuid
from hmac import compare_digest

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils.crypto import salted_hmac
from django.db.models import Q
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
from .models import Lead
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
    if len(addon_slugs) > 4 or len(set(addon_slugs)) != len(addon_slugs):
        return JsonResponse({"detail": "Выберите разные шоу, не более четырёх."}, status=400)
    try:
        program = Offering.objects.get(slug=query.get("offering", ""), kind=Offering.Kind.TRANSFORMER, is_listed=True)
        if program.availability == Availability.UNAVAILABLE:
            raise ValueError()
        shows = list(Offering.objects.filter(Q(kind=Offering.Kind.SHOW) | Q(kind=Offering.Kind.EXTRA, slug="sound"), slug__in=addon_slugs, is_listed=True).exclude(availability=Availability.UNAVAILABLE))
        if len(shows) != len(addon_slugs):
            raise ValueError()
        by_slug = {item.slug: item for item in shows}
        return JsonResponse(transformer_quote(program, [by_slug[slug] for slug in addon_slugs]))
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
    if len(addon_slugs) > 7 or len(set(addon_slugs)) != len(addon_slugs):
        return JsonResponse({"detail": "Выберите разные шоу, не более семи."}, status=400)
    try:
        program = Offering.objects.get(slug=query.get("offering", ""), kind=Offering.Kind.ANIMATION, is_listed=True)
        if program.availability == Availability.UNAVAILABLE:
            raise ValueError()
        shows = list(Offering.objects.filter(Q(kind=Offering.Kind.SHOW) | Q(kind=Offering.Kind.EXTRA, slug="sound"), slug__in=addon_slugs, is_listed=True).exclude(availability=Availability.UNAVAILABLE))
        if len(shows) != len(addon_slugs):
            raise ValueError()
        by_slug = {item.slug: item for item in shows}
        return JsonResponse(animation_quote(program, [by_slug[slug] for slug in addon_slugs]))
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
        key = request.headers.get("Idempotency-Key")
        fingerprint = ""
        fingerprints = []
        if key is not None:
            try:
                key = uuid.UUID(key)
            except (ValueError, AttributeError):
                return self.reply({"detail": "Некорректный ключ отправки. Обновите страницу."}, status.HTTP_400_BAD_REQUEST)
            # Keep no extra copy of customer values, and never expose the digest.
            encoded = json.dumps(request.data, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
            fingerprints = [salted_hmac("mu56.lead-submission", encoded, secret=secret, algorithm="sha256").hexdigest() for secret in [settings.SECRET_KEY, *settings.SECRET_KEY_FALLBACKS]]
            fingerprint = fingerprints[0]
            existing = Lead.objects.filter(submission_key=key).first()
            if existing:
                return self.replay(existing, fingerprints)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                lead = serializer.save(submission_key=key, submission_fingerprint=fingerprint)
        except IntegrityError:
            # A concurrent request may have committed this key while we validated.
            existing = Lead.objects.filter(submission_key=key).first() if key else None
            if existing is None:
                raise
            return self.replay(existing, fingerprints)
        return self.received(lead, status.HTTP_201_CREATED)

    def replay(self, lead, fingerprints):
        if not any(compare_digest(lead.submission_fingerprint, fingerprint) for fingerprint in fingerprints):
            return self.reply({"detail": "Эта заявка уже сохранена с другим составом или данными. Позвоните нам, чтобы уточнить изменения."}, status.HTTP_409_CONFLICT)
        return self.received(lead, status.HTTP_200_OK)

    def received(self, lead, response_status):
        return self.reply({
            "reference": str(lead.pk), "status": "received",
            "message": "Заявка сохранена. Дату, состав программы и стоимость выезда согласуем отдельно.",
        }, response_status)

    def reply(self, data, response_status):
        response = Response(data, status=response_status)
        response["Cache-Control"] = "no-store"
        return response


def csrf_failure(request, reason=""):
    if request.path.startswith("/api/"):
        return JsonResponse({"detail": "Обновите страницу и попробуйте отправить заявку снова."}, status=403)
    from django.views.csrf import csrf_failure as default_failure
    return default_failure(request, reason=reason)
