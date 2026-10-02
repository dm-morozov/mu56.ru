from catalog.models import Character, Offering

BIG_HERO_SLUGS = {"bumblebee", "optimus-prime", "iron-man"}


def allowed_characters(offering):
    choices = offering.characters.all() if offering else Character.objects.all()
    if offering and offering.kind == Offering.Kind.TRANSFORMER:
        choices = choices.exclude(category__in=["Большие герои", "Новый год"]).exclude(slug__in=BIG_HERO_SLUGS)
    return choices.order_by("name", "pk")


def character_error(offering, character):
    if not offering or not character:
        return None
    if offering.kind == Offering.Kind.TRANSFORMER and (character.slug in BIG_HERO_SLUGS or character.category in {"Большие герои", "Новый год"}):
        return "Большой герой уже выбран программой. Второй герой должен быть в обычном костюме. Несколько больших героев обсудим отдельно — напишите пожелание в комментарии."
    if not offering.characters.filter(pk=character.pk).exists():
        return "Этот герой не указан для выбранной программы."
    return None
