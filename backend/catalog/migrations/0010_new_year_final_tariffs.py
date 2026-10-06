from django.db import migrations


def update_tariffs(apps, schema_editor):
    Offering = apps.get_model("catalog", "Offering")
    Price = apps.get_model("catalog", "PriceOption")
    program = Offering.objects.filter(slug="new-year").first()
    if not program:
        return
    Price.objects.filter(offering=program, code__in=["minutes-40", "minutes-45", "minutes-55", "minutes-60"]).update(is_confirmed=False)
    rows = [("minutes-15", 15, 4000, "Поздравление у ёлки"), ("minutes-30", 30, 5000, "Новогодние игры"), ("minutes-50", 50, 6000, "Путешествие в Великий Устюг за подарками"), ("group-with-sound", 60, 9000, "Для большой компании · час со звуком")]
    rows += [(code, 50, amount, label) for code, amount, label in [
        ("eve-18", 7000, "31 декабря · 18:00"), ("eve-20", 8000, "31 декабря · 20:00"), ("eve-22", 10000, "31 декабря · 22:00"), ("night-00", 12000, "1 января · 00:00"), ("night-02", 10000, "1 января · 02:00")]]
    for code, minutes, amount, label in rows:
        Price.objects.update_or_create(offering=program, code=code, defaults={"duration_minutes": minutes, "amount_rub": amount, "label": label, "context": "base", "is_confirmed": True})


class Migration(migrations.Migration):
    dependencies = [("catalog", "0009_transformer_program_names")]
    operations = [migrations.RunPython(update_tariffs, migrations.RunPython.noop)]
