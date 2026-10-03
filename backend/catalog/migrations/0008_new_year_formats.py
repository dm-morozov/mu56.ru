from django.db import migrations


def update_formats(apps, schema_editor):
    Price = apps.get_model("catalog", "PriceOption")
    Offering = apps.get_model("catalog", "Offering")
    program = Offering.objects.filter(slug="new-year").first()
    if not program:
        return
    Price.objects.filter(offering=program, code__in=["minutes-45", "minutes-60"]).update(is_confirmed=False)
    for code, minutes, amount, label in [
        ("minutes-40", 40, 5000, "40 минут · два героя"),
        ("minutes-55", 55, 6000, "Полная новогодняя сказка · 55 минут"),
        ("group-with-sound", 60, 9000, "Для большой группы · час и комплект звука"),
    ]:
        Price.objects.update_or_create(offering=program, code=code, defaults={
            "duration_minutes": minutes, "amount_rub": amount, "label": label, "is_confirmed": True,
        })


class Migration(migrations.Migration):
    dependencies = [("catalog", "0007_refresh_new_year")]
    operations = [migrations.RunPython(update_formats, migrations.RunPython.noop)]
