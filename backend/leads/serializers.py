import re
from collections.abc import Mapping

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from catalog.models import Availability, Character, Offering, PriceOption
from catalog.pricing import package_total, transformer_quote, animation_quote, new_year_quote
from catalog.addons import ADDON_ONLY_SLUGS, addon_error
from catalog.new_year import schedule_error
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
    tariff_code = serializers.CharField(required=False, allow_blank=True, max_length=100, write_only=True)
    offering = serializers.SlugRelatedField(
        slug_field="slug", queryset=Offering.objects.filter(is_listed=True).exclude(availability=Availability.UNAVAILABLE),
        required=False, allow_null=True,
    )
    character = serializers.SlugRelatedField(
        slug_field="slug", queryset=Character.objects.filter(is_listed=True).exclude(availability=Availability.UNAVAILABLE),
        required=False, allow_null=True,
    )
    second_character = serializers.SlugRelatedField(
        slug_field="slug", queryset=Character.objects.filter(is_listed=True).exclude(availability=Availability.UNAVAILABLE),
        required=False, allow_null=True,
    )
    addons = serializers.SlugRelatedField(
        slug_field="slug", many=True, required=False,
        queryset=Offering.objects.filter(is_listed=True, kind__in=[Offering.Kind.SHOW, Offering.Kind.EXTRA]).exclude(availability=Availability.UNAVAILABLE),
    )
    data_consent = serializers.BooleanField(write_only=True)
    consent_version = serializers.CharField(write_only=True, max_length=50)
    website = serializers.CharField(required=False, allow_blank=True, max_length=200, write_only=True)
    child_age = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=18)
    children_count = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=1000)

    class Meta:
        model = Lead
        fields = (
            "name", "phone", "contact_method", "messenger_handle", "event_date", "event_time", "child_age",
            "children_count", "location", "comment", "offering", "character", "second_character", "addons", "second_performer",
            "data_consent", "consent_version", "website", "tariff_code",
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

    def validate_consent_version(self, value):
        if value != settings.LEAD_CONSENT_VERSION:
            raise serializers.ValidationError("Текст согласия обновился. Обновите страницу и ознакомьтесь с ним перед отправкой заявки.")
        return value

    def validate_website(self, value):
        if value:
            raise serializers.ValidationError("Не удалось отправить заявку.")
        return value

    def validate(self, attrs):
        offering, character, addons = attrs.get("offering"), attrs.get("character"), attrs.get("addons", [])
        code = attrs.get("tariff_code")
        if offering and offering.slug == "new-year":
            timing_error = schedule_error(code, attrs.get("event_date"), attrs.get("event_time"))
            if timing_error:
                raise serializers.ValidationError({"event_time": timing_error})
        error = addon_error(offering, addons, code)
        if error:
            raise serializers.ValidationError({"addons": error})
        if code and (not offering or offering.kind != Offering.Kind.SEASONAL or not offering.prices.filter(code=code, is_confirmed=True).exists()):
            raise serializers.ValidationError({"tariff_code": "Выберите действующий тариф новогодней программы."})
        if len(addons) > 12 or len({item.pk for item in addons}) != len(addons):
            raise serializers.ValidationError({"addons": "Выберите разные дополнения, не более 12."})
        if offering and any(item.pk == offering.pk for item in addons):
            raise serializers.ValidationError({"addons": "Основную услугу не нужно добавлять повторно."})
        error = character_error(offering, character)
        if error:
            raise serializers.ValidationError({"character": error})
        if attrs.get("second_performer") and (not offering or offering.kind != Offering.Kind.PACKAGE):
            raise serializers.ValidationError({"second_performer": "Доплата второго ведущего выбирается только в обычном пакете."})
        second_character = attrs.get("second_character")
        if second_character:
            if not offering or offering.kind != Offering.Kind.PACKAGE or not attrs.get("second_performer"):
                raise serializers.ValidationError({"second_character": "Добавьте второго аниматора в пакете перед выбором второго героя."})
            error = character_error(offering, second_character)
            if error:
                raise serializers.ValidationError({"second_character": error})
        if offering and offering.kind == Offering.Kind.TRANSFORMER and addons:
            try:
                transformer_quote(offering, [item for item in addons if item.kind == Offering.Kind.SHOW or (item.kind == Offering.Kind.EXTRA and item.slug == "sound")])
            except (ValueError, PriceOption.DoesNotExist, PriceOption.MultipleObjectsReturned):
                raise serializers.ValidationError({"addons": "Стоимость этого шоу после трансформера нужно согласовать отдельно. Опишите пожелания в комментарии."})
        if offering and offering.kind == Offering.Kind.ANIMATION and addons:
            try:
                animation_quote(offering, [item for item in addons if item.kind == Offering.Kind.SHOW or (item.kind == Offering.Kind.EXTRA and item.slug == "sound")])
            except (ValueError, PriceOption.DoesNotExist, PriceOption.MultipleObjectsReturned):
                raise serializers.ValidationError({"addons": "Выберите шоу с подтверждённой ценой. Другие пожелания можно написать в комментарии."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop("data_consent")
        validated_data.pop("consent_version")
        validated_data.pop("website", None)
        addons = validated_data.pop("addons", [])
        tariff_code = validated_data.pop("tariff_code", "")
        offering = validated_data.get("offering")
        character = validated_data.get("character")
        second_character = validated_data.get("second_character")
        known_program_amount = None
        quote = None
        selected_tariff = None
        if offering:
            try:
                if offering.kind == Offering.Kind.PACKAGE:
                    known_program_amount = package_total(offering, second_performer=validated_data.get("second_performer", False))
                elif offering.kind == Offering.Kind.TRANSFORMER:
                    quote = transformer_quote(offering, [item for item in addons if item.kind == Offering.Kind.SHOW or (item.kind == Offering.Kind.EXTRA and item.slug == "sound")])
                    known_program_amount = quote["amount_rub"] if all(item.kind == Offering.Kind.SHOW or (item.kind == Offering.Kind.EXTRA and item.slug == "sound") for item in addons) else None
                elif offering.kind == Offering.Kind.ANIMATION:
                    quote = animation_quote(offering, [item for item in addons if item.kind == Offering.Kind.SHOW or (item.kind == Offering.Kind.EXTRA and item.slug == "sound")])
                    known_program_amount = quote["amount_rub"] if all(item.kind == Offering.Kind.SHOW or (item.kind == Offering.Kind.EXTRA and item.slug == "sound") for item in addons) else None
                elif offering.kind in [Offering.Kind.SHOW, Offering.Kind.EXTRA]:
                    known_program_amount = offering.prices.get(context=PriceOption.Context.BASE, is_confirmed=True).amount_rub
                elif offering.kind == Offering.Kind.SEASONAL and tariff_code:
                    selected_tariff = offering.prices.get(code=tariff_code, is_confirmed=True)
                    quote = new_year_quote(offering, tariff_code, [item for item in addons if item.kind == Offering.Kind.SHOW])
                    known_program_amount = quote["amount_rub"]
            except (ValueError, PriceOption.DoesNotExist, PriceOption.MultipleObjectsReturned):
                pass  # Preserve a request even when its exact tariff needs discussion.
        # Extras use confirmed catalogue tariffs. Never treat a partial price as a total.
        extras = [item for item in addons if item.slug in ADDON_ONLY_SLUGS and not (
            item.slug == "sound" and offering and offering.kind in [Offering.Kind.TRANSFORMER, Offering.Kind.ANIMATION]
        )]
        if offering and extras:
            if offering.kind in [Offering.Kind.TRANSFORMER, Offering.Kind.ANIMATION] and quote:
                known_program_amount = quote["amount_rub"]
            quote = quote or {"lines": []}
            if not quote["lines"] and known_program_amount is not None:
                base = offering.prices.filter(context=PriceOption.Context.BASE, is_confirmed=True).first()
                if base:
                    quote["lines"].append({"slug": offering.slug, "name": offering.name, "amount_rub": base.amount_rub})
                if validated_data.get("second_performer"):
                    extra = offering.prices.filter(context=PriceOption.Context.SECOND_PERFORMER, is_confirmed=True).first()
                    if extra:
                        quote["lines"].append({"slug": "second-performer", "name": "Второй аниматор на всю программу", "amount_rub": extra.amount_rub})
            for item in extras:
                price = item.prices.filter(context=PriceOption.Context.BASE, is_confirmed=True).first()
                if price:
                    quote["lines"].append({"slug": item.slug, "name": item.name, "amount_rub": price.amount_rub})
                    if known_program_amount is not None:
                        known_program_amount += price.amount_rub
                else:
                    known_program_amount = None
        if offering and any(item.kind == Offering.Kind.EXTRA and item.slug not in ADDON_ONLY_SLUGS for item in addons):
            known_program_amount = None
        if offering and offering.kind not in [Offering.Kind.ANIMATION, Offering.Kind.TRANSFORMER, Offering.Kind.SEASONAL] and any(item.kind == Offering.Kind.SHOW for item in addons):
            known_program_amount = None
        snapshot = {
            "offering": selection_item(offering) if offering else None,
            "character": {"slug": character.slug, "name": character.name, "availability": character.availability} if character else None,
            "second_character": {"slug": second_character.slug, "name": second_character.name, "availability": second_character.availability} if second_character else None,
            "addons": [selection_item(item) for item in addons],
            "second_performer": validated_data.get("second_performer", False),
            "known_program_amount_rub": known_program_amount,
            "selected_tariff": {"code": selected_tariff.code, "duration_minutes": selected_tariff.duration_minutes, "amount_rub": selected_tariff.amount_rub} if selected_tariff else None,
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
