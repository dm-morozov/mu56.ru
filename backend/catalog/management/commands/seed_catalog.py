from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Availability, Character, ContactChannel, Offering, PackagePart, PriceOption


CHARACTERS = [
    ("nolik", "Нолик", "Мультфильмы и сказки"),
    ("mcqueen", "Молния Маккуин", "Мультфильмы и сказки"),
    ("clown-kesha", "Клоун Кеша", "Мультфильмы и сказки"),
    ("korzhik", "Коржик", "Мультфильмы и сказки"),
    ("karamelka", "Карамелька", "Мультфильмы и сказки"),
    ("chase", "Гонщик", "Мультфильмы и сказки"),
    ("prince", "Принц", "Мультфильмы и сказки"),
    ("hatter", "Шляпник", "Мультфильмы и сказки"),
    ("alice", "Алиса", "Мультфильмы и сказки"),
    ("aladdin", "Аладдин", "Мультфильмы и сказки"),
    ("spider-man", "Человек-паук", "Супергерои"),
    ("black-spider-man", "Чёрный Человек-паук", "Супергерои"),
    ("captain-america", "Капитан Америка", "Супергерои"),
    ("batman", "Бэтмен", "Супергерои"),
    ("superman", "Супермен", "Супергерои"),
    ("deadpool", "Дэдпул", "Супергерои"),
    ("ninja-turtle", "Черепашка-ниндзя", "Супергерои"),
    ("ladybug", "Леди Баг", "Супергерои"),
    ("cat-noir", "Супер Кот", "Супергерои"),
    ("luke-skywalker", "Джедай Люк Скайуокер", "Приключения"),
    ("harry-potter", "Гарри Поттер", "Приключения"),
    ("kutamba", "Индеец Кутамба", "Приключения"),
    ("jack-sparrow", "Пират Джек Воробей", "Приключения"),
    ("james-bond", "Джеймс Бонд", "Приключения"),
    ("hawaiian", "Гавайская вечеринка", "Приключения"),
    ("among-us", "Among Us", "Игровые и тематические программы"),
    ("creeper", "Крипер / Minecraft", "Игровые и тематические программы"),
    ("leon", "Leon / Brawl Stars", "Игровые и тематические программы"),
    ("tiktok", "TikTok / стильный ведущий", "Игровые и тематические программы"),
    ("football", "Футбольная вечеринка", "Игровые и тематические программы"),
    ("graduation-host", "Ведущий на выпускной", "Игровые и тематические программы"),
    ("bumblebee", "Бамблби", "Большие герои"),
    ("optimus-prime", "Оптимус", "Большие герои"),
    ("iron-man", "Железный человек", "Большие герои"),
    ("new-year-duo", "Новогодняя сказка: Дед Мороз и Снегурочка", "Новый год"),
]
CHECK_ROLES = {"karamelka", "alice", "ladybug", "hawaiian"}
SECOND_HEROES = {slug for slug, _, category in CHARACTERS if category not in {"Большие герои", "Новый год"}}

# slug, name, kind, duration, price, price with animation, performers, approximate
SERVICES = [
    ("animation", "Аниматор на праздник", "animation", 60, 3500, None, 1, False),
    ("nitrogen", "Азотное шоу с мороженым", "show", 45, 4500, 3900, 1, True),
    ("silver", "Серебряное шоу", "show", 30, 3500, 3000, 1, False),
    ("ribbons", "Ленточное шоу", "show", 30, 2800, 2500, 1, False),
    ("cotton-candy-show", "Шоу сладкой ваты", "show", 30, 2500, 2000, 1, False),
    ("projector", "Шоу с проектором", "show", 30, 2500, None, 1, False),
    ("foam", "Пенная вечеринка", "show", 40, 8000, None, 1, True),
    ("photographer", "Фотограф", "extra", 60, 3500, None, 1, False),
    ("sound", "Много звука", "extra", None, 2000, None, 1, False),
    ("face-painting", "Аквагрим", "extra", None, None, None, 1, False),
    ("pinata", "Пиньята", "extra", None, None, None, 1, False),
    ("cotton-candy-operator", "Сахарная вата с оператором", "extra", None, None, None, 1, False),
    ("bumblebee", "Бамблби + супергерой", "transformer", 60, 6200, None, 2, False),
    ("optimus-prime", "Оптимус + супергерой", "transformer", 60, 6200, None, 2, False),
    ("iron-man", "Железный человек + супергерой", "transformer", 60, 5800, None, 2, False),
    ("new-year", "Дед Мороз и Снегурочка", "seasonal", None, None, None, 2, True),
]
# Package stages keep the final background music separate from hosted activity.
PACKAGES = [
    ("sweet-vibe", "Сладкий вайб", 5500, 5300, [("animation", 60), ("cotton-candy-show", 30), (None, 10)]),
    ("silver-party", "Серебряное пати", 6500, 5300, [("animation", 60), ("silver", 30), (None, 15)]),
    ("ice-breath", "Ледяное дыхание", 7400, 7000, [("animation", 60), ("nitrogen", 45), (None, 15)]),
    ("full-party", "Полный Расколбас", 9400, 8800, [("animation", 60), ("nitrogen", 45), ("cotton-candy-show", 30), (None, 15)]),
    ("foam-party", "Запеним все!!!", 15400, 10500, [("animation", 60), ("nitrogen", 45), ("foam", 40), (None, 35)]),
]


class Command(BaseCommand):
    help = "Добавить начальный каталог по буклету 9.0; существующие правки не перезаписываются."

    def create(self, model, lookup, defaults):
        obj = model.objects.filter(**lookup).first()
        if obj is not None:
            return obj, False
        obj = model(**lookup, **defaults)
        obj.full_clean()
        obj.save()
        return obj, True

    def price(self, offering, code, amount, context="base", duration=None):
        return self.create(PriceOption, {"offering": offering, "code": code}, {
            "label": dict(PriceOption.Context.choices)[context], "context": context,
            "amount_rub": amount, "is_confirmed": True, "duration_minutes": duration,
            "terms": "Буклет 9.0 и подтверждение владельца от 30.09.2026; удалённый выезд отдельно.",
        })

    @transaction.atomic
    def handle(self, *args, **options):
        characters = {}
        for slug, name, category in CHARACTERS:
            characters[slug], _ = self.create(Character, {"slug": slug}, {
                "name": name, "category": category,
                "availability": Availability.CHECK if slug in CHECK_ROLES else Availability.AVAILABLE,
            })
        services = {}
        for slug, name, kind, duration, amount, addon, performers, approximate in SERVICES:
            service, created = self.create(Offering, {"slug": slug}, {
                "name": name, "kind": kind, "duration_minutes": duration,
                "duration_is_approximate": approximate, "included_performers": performers,
            })
            services[slug] = service
            if amount is not None:
                self.price(service, "base", amount)
            if addon is not None:
                self.price(service, "with-animation", addon, "with_animation")
            if slug in {"nitrogen", "silver", "cotton-candy-show"}:
                self.price(service, "transformer-support", 2500 if slug == "nitrogen" else 1300, "transformer_support")
            if created and kind == "transformer":
                service.characters.set([characters[slug]] + [characters[s] for s in sorted(SECOND_HEROES)])
            elif created and kind == "animation":
                service.characters.set([c for s, c in characters.items() if c.category not in {"Большие герои", "Новый год"}])
            elif created and kind == "seasonal":
                service.characters.set([characters["new-year-duo"]])
        for duration, amount in [(30, 4500), (40, 5000), (55, 6000)]:
            self.price(services["new-year"], f"minutes-{duration}", amount, duration=duration)
        self.price(services["new-year"], "group-with-sound", 9000, duration=60)
        for slug, name, amount, extra, stages in PACKAGES:
            package, created = self.create(Offering, {"slug": slug}, {
                "name": name, "kind": "package", "duration_minutes": sum(t for _, t in stages),
            })
            self.price(package, "base", amount)
            self.price(package, "second-performer", extra, "second_performer")
            if created:
                package.characters.set(services["animation"].characters.all())
                for position, (service_slug, duration) in enumerate(stages, 1):
                    service = services[service_slug] if service_slug else None
                    self.create(PackagePart, {"package": package, "position": position}, {
                        "title": service.name if service else "Фоновая музыка, без ведущих",
                        "duration_minutes": duration, "led_by_performer": service is not None,
                        "service": service, "is_approximate": service is None or service.duration_is_approximate,
                    })
        for kind, label, url, verified in [
            ("phone", "+7 903 392-22-29", "tel:+79033922229", True),
            ("telegram", "Написать в Telegram", "https://t.me/dem2014", True),
            ("max", "Написать в MAX", "https://max.ru/u/f9LHodD0cOJrL3EkQeraU9Ajq6LR6UeBpxjl6Dg77jmZRW7lPGh89Cj40Ls", False),
        ]:
            self.create(ContactChannel, {"kind": kind}, {"label": label, "url": url, "is_verified": verified})
        self.stdout.write(self.style.SUCCESS(
            f"Каталог готов: {Character.objects.count()} персонажей, {Offering.objects.count()} предложений. Существующие записи сохранены."
        ))
