import re
from collections.abc import Mapping

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from catalog.models import Availability, Character, Offering, PriceOption
from catalog.pricing import package_total, transformer_quote
from .models import Lead, TelegramNotification
from .selection import character_error


def selection_item(offering):
    return {
        "slug": offering.slug, "name": offering.name, "kind": offering.kind,
        "duration_minutes": offering.duration_minutes,
        "availability": offering.availability,
        "prices": list(offering.prices.filter(is_confirmed=True).values(
            "code", "context", "amount_rub", "duration_minutes"
        )),
    }


class LeadCreateSerializer(serializers.ModelSerializer):
    offering = serializers.SlugRelatedField(
        slug_field="slug", queryset=Offering.objects.filter(is_listed=True).exclude(availability=Availability.UNAVAILABLE),
        required=False, allow_null=True,
    )
    character = serializers.SlugRelatedField(
        slug_field="slug", queryset=Character.objects.filter(is_listed=True).exclude(availability=Availability.UNAVAILABLE),
        required=False, allow_null=True,
    )
    addons = serializers.SlugRelatedField(
        slug_field="slug", many=True, required=False,
        queryset=Offering.objects.filter(is_listed=True, kind__in=[Offering.Kind.SHOW, Offering.Kind.EXTRA]).exclude(availability=Availability.UNAVAILABLE),
    )
    data_consent = serializers.BooleanField(write_only=True)
    website = serializers.CharField(required=False, allow_blank=True, max_length=200, write_only=True)
    child_age = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=18)
    children_count = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=1000)

    class Meta:
        model = Lead
        fields = (
            "name", "phone", "contact_method", "messenger_handle", "event_date", "event_time", "child_age",
            "children_count", "location", "comment", "offering", "character", "addons", "second_performer",
            "data_consent", "website",
        )

    def to_internal_value(self, data):
        if isinstance(data, Mapping):
            unknown = set(data) - set(self.fields)
            if unknown:
                raise serializers.ValidationError({field: "Неизвестное поле." for field in sorted(unknown)})
        return super().to_internal_value(data)

    def validate_phone(self, value):
        if re.search(r"[^\d+()\s-]", value):
            raise serializers.ValidationError("Укажите российский номер телефона.")
        digits = re.sub(r"\D", "", value)
        if len(digits) == 10 and digits.startswith("9"):
            digits = "7" + digits
        if len(digits) == 11 and digits.startswith("8"):
            digits = "7" + digits[1:]
        if len(digits) != 11 or not digits.startswith("7"):
            raise serializers.ValidationError("Укажите номер в формате +7 XXX XXX-XX-XX.")
        return "+" + digits

    def validate_event_date(self, value):
        if value and value < timezone.localdate():
            raise serializers.ValidationError("Дата праздника уже прошла.")
        return value

    def validate_data_consent(self, value):
        if not value:
            raise serializers.ValidationError("Нужно согласие на обработку заявки.")
        return value

    def validate_website(self, value):
        if value:
            raise serializers.ValidationError("Не удалось отправить заявку.")
        return value

    def validate(self, attrs):
        offering, character, addons = attrs.get("offering"), attrs.get("character"), attrs.get("addons", [])
        if len(addons) > 12 or len({item.pk for item in addons}) != len(addons):
            raise serializers.ValidationError({"addons": "Выберите разные дополнения, не более 12."})
        if offering and any(item.pk == offering.pk for item in addons):
            raise serializers.ValidationError({"addons": "Основную услугу не нужно добавлять повторно."})
        error = character_error(offering, character)
        if error:
            raise serializers.ValidationError({"character": error})
        if attrs.get("second_performer") and (not offering or offering.kind != Offering.Kind.PACKAGE):
            raise serializers.ValidationError({"second_performer": "Доплата второго ведущего выбирается только в обычном пакете."})
        if offering and offering.kind == Offering.Kind.TRANSFORMER and addons:
            try:
                transformer_quote(offering, [item for item in addons if item.kind == Offering.Kind.SHOW])
            except (ValueError, PriceOption.DoesNotExist, PriceOption.MultipleObjectsReturned):
                raise serializers.ValidationError({"addons": "Стоимость этого шоу после трансформера нужно согласовать отдельно. Опишите пожелания в комментарии."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop("data_consent")
        validated_data.pop("website", None)
        addons = validated_data.pop("addons", [])
        offering = validated_data.get("offering")
        character = validated_data.get("character")
        known_program_amount = None
        quote = None
        if offering:
            try:
                if offering.kind == Offering.Kind.PACKAGE:
                    known_program_amount = package_total(offering, second_performer=validated_data.get("second_performer", False))
                elif offering.kind == Offering.Kind.TRANSFORMER:
                    quote = transformer_quote(offering, [item for item in addons if item.kind == Offering.Kind.SHOW])
                    known_program_amount = quote["amount_rub"]
            except (ValueError, PriceOption.DoesNotExist, PriceOption.MultipleObjectsReturned):
                pass  # Preserve a request even when its exact tariff needs discussion.
        snapshot = {
            "offering": selection_item(offering) if offering else None,
            "character": {"slug": character.slug, "name": character.name, "availability": character.availability} if character else None,
            "addons": [selection_item(item) for item in addons],
            "second_performer": validated_data.get("second_performer", False),
            "known_program_amount_rub": known_program_amount,
            "price_breakdown": quote["lines"] if quote else [],
            "travel": "Стоимость выезда уточним по адресу",
            "requires_manager_confirmation": True,
        }
        lead = Lead.objects.create(
            **validated_data, selection_snapshot=snapshot,
            consent_at=timezone.now(), consent_version=settings.LEAD_CONSENT_VERSION,
        )
        lead.addons.set(addons)
        TelegramNotification.objects.create(lead=lead)
        lead.notification_status = "Ожидает отправки"
        lead.save(update_fields=["notification_status"])
        return lead
