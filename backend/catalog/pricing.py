"""Prices come from confirmed tariffs, not from inferred hourly durations."""
from .models import Offering, PriceOption


def two_performer_show_amount(show):
    """Confirmed add-on rate shared by transformers and New Year programs."""
    prices = {p.context: p.amount_rub for p in show.prices.filter(is_confirmed=True)}
    required = (PriceOption.Context.WITH_ANIMATION, PriceOption.Context.TRANSFORMER_SUPPORT)
    if any(context not in prices for context in required):
        raise ValueError("Цена шоу с двумя аниматорами ещё не подтверждена.")
    return sum(prices[context] for context in required)


def new_year_quote(program, tariff_code, shows=()):
    tariff = program.prices.get(code=tariff_code, is_confirmed=True)
    lines = [{"slug": program.slug, "name": f"{program.name} · {tariff.duration_minutes} минут" +
              (" и комплект звука" if tariff_code == "group-with-sound" else ""), "amount_rub": tariff.amount_rub}]
    for show in shows:
        lines.append({"slug": show.slug, "name": f"{show.name} · 2 аниматора", "amount_rub": two_performer_show_amount(show)})
    return {"amount_rub": sum(line["amount_rub"] for line in lines), "lines": lines}


def package_total(package, *, second_performer=False):
    if package.kind != Offering.Kind.PACKAGE:
        raise ValueError("Расчёт предназначен только для пакетов.")
    prices = {p.context: p for p in package.prices.filter(is_confirmed=True)}
    base = prices.get(PriceOption.Context.BASE)
    if base is None:
        raise ValueError("Основная цена ещё не подтверждена.")
    if not second_performer:
        return base.amount_rub
    extra = prices.get(PriceOption.Context.SECOND_PERFORMER)
    if extra is None:
        raise ValueError("Доплата ещё не подтверждена.")
    return base.amount_rub + extra.amount_rub


def transformer_total(program, shows=()):
    if program.kind != Offering.Kind.TRANSFORMER:
        raise ValueError("Выберите программу большого героя.")
    base = program.prices.filter(context=PriceOption.Context.BASE, is_confirmed=True).get()
    total = base.amount_rub
    seen = set()
    for show in shows:
        sound = show.slug == "sound" and show.kind == Offering.Kind.EXTRA
        if show.pk in seen or (show.kind != Offering.Kind.SHOW and not sound):
            raise ValueError("Выберите разные шоу из каталога.")
        seen.add(show.pk)
        tariffs = {p.context: p for p in show.prices.filter(is_confirmed=True)}
        if sound:
            if PriceOption.Context.BASE not in tariffs:
                raise ValueError("Цена комплекта звука ещё не подтверждена.")
            total += tariffs[PriceOption.Context.BASE].amount_rub
            continue
        required = (PriceOption.Context.WITH_ANIMATION, PriceOption.Context.TRANSFORMER_SUPPORT)
        if any(context not in tariffs for context in required):
            raise ValueError("Цена шоу после трансформера ещё не согласована.")
        total += sum(tariffs[context].amount_rub for context in required)
    return total


def transformer_quote(program, shows=()):
    """Use the same confirmed tariffs for previews and immutable lead snapshots."""
    shows = list(shows)
    total = transformer_total(program, shows)
    base = program.prices.get(context=PriceOption.Context.BASE, is_confirmed=True)
    lines = [{"slug": program.slug, "name": program.name, "amount_rub": base.amount_rub}]
    for show in shows:
        prices = {p.context: p.amount_rub for p in show.prices.filter(is_confirmed=True)}
        if show.slug == "sound" and show.kind == Offering.Kind.EXTRA:
            lines.append({"slug": show.slug, "name": show.name, "amount_rub": prices[PriceOption.Context.BASE]})
            continue
        show_amount = prices[PriceOption.Context.WITH_ANIMATION]
        support = prices[PriceOption.Context.TRANSFORMER_SUPPORT]
        lines.append({"slug": show.slug, "name": show.name, "show_amount_rub": show_amount,
                      "support_amount_rub": support, "amount_rub": show_amount + support})
    return {"amount_rub": total, "lines": lines, "requires_manager_confirmation": True,
            "travel": "Стоимость выезда уточним по адресу"}


def animation_quote(program, shows=()):
    """Animation is charged once; each show uses its confirmed add-on rate."""
    if program.kind != Offering.Kind.ANIMATION:
        raise ValueError("Выберите анимацию.")
    shows = list(shows)
    if {"foam", "sound"}.issubset({item.slug for item in shows}):
        raise ValueError("Комплект звука уже входит в пенную вечеринку.")
    base = program.prices.get(context=PriceOption.Context.BASE, is_confirmed=True)
    lines = [{"slug": program.slug, "name": program.name, "amount_rub": base.amount_rub}]
    seen = set()
    for show in shows:
        sound = show.slug == "sound" and show.kind == Offering.Kind.EXTRA
        if show.pk in seen or (show.kind != Offering.Kind.SHOW and not sound):
            raise ValueError("Выберите разные шоу.")
        seen.add(show.pk)
        prices = {p.context: p for p in show.prices.filter(is_confirmed=True)}
        price = prices.get(PriceOption.Context.WITH_ANIMATION) or prices.get(PriceOption.Context.BASE)
        if price is None:
            raise ValueError("Цена шоу не подтверждена.")
        lines.append({"slug": show.slug, "name": show.name, "amount_rub": price.amount_rub})
    return {"amount_rub": sum(line["amount_rub"] for line in lines), "lines": lines,
            "requires_manager_confirmation": True, "travel": "Стоимость выезда уточним по адресу"}
