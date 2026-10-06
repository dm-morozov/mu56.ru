"""Extras that can only accompany an event service."""
from .models import Offering
from .new_year import SLOTS

ADDON_ONLY_SLUGS = {"sound", "photographer"}


def includes_sound(offering, addons=(), tariff_code=""):
    return bool(offering and (
        offering.slug == "foam"
        or offering.parts.filter(service__slug="foam").exists()
        or (offering.kind == Offering.Kind.SEASONAL and tariff_code == "group-with-sound")
        or any(item.slug == "foam" for item in addons)
    ))


def addon_error(offering, addons, tariff_code=""):
    if offering and offering.slug == "new-year" and any(item.kind == Offering.Kind.SHOW and item.slug not in {"nitrogen", "silver", "cotton-candy-show"} for item in addons):
        return "К новогодней программе можно добавить азотное, серебряное шоу или шоу сладкой ваты."
    if offering and offering.slug == "new-year" and tariff_code in SLOTS and any(item.kind == Offering.Kind.SHOW for item in addons):
        return "В новогоднюю ночь доступна только сказка на 50 минут без продления шоу."
    if offering and offering.slug in ADDON_ONLY_SLUGS:
        return "Звук и фотограф доступны только как дополнения к программе."
    if any(item.slug in ADDON_ONLY_SLUGS for item in addons) and not offering:
        return "Сначала выберите основную программу для звука или фотографа."
    if any(item.slug == "sound" for item in addons) and includes_sound(offering, addons, tariff_code):
        return "Комплект звука уже включён в выбранную программу."
    return None
