"""Prices come from confirmed tariffs, not from inferred hourly durations."""
from .models import Offering, PriceOption


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
        if show.pk in seen or show.kind != Offering.Kind.SHOW:
            raise ValueError("Выберите разные шоу из каталога.")
        seen.add(show.pk)
        tariffs = {p.context: p for p in show.prices.filter(is_confirmed=True)}
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
        show_amount = prices[PriceOption.Context.WITH_ANIMATION]
        support = prices[PriceOption.Context.TRANSFORMER_SUPPORT]
        lines.append({"slug": show.slug, "name": show.name, "show_amount_rub": show_amount,
                      "support_amount_rub": support, "amount_rub": show_amount + support})
    return {"amount_rub": total, "lines": lines, "requires_manager_confirmation": True,
            "travel": "Стоимость выезда уточним по адресу"}
