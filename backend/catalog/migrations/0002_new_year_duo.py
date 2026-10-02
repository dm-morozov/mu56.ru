from django.db import migrations


def combine_new_year(apps, schema_editor):
    Character = apps.get_model("catalog", "Character")
    Offering = apps.get_model("catalog", "Offering")
    duo, _ = Character.objects.get_or_create(slug="new-year-duo", defaults={
        "name": "Новогодняя сказка: Дед Мороз и Снегурочка",
        "category": "Новый год", "availability": "available",
    })
    # Preserve old records and their references in past requests; stop listing them separately.
    Character.objects.filter(slug__in=["ded-moroz", "snegurochka"]).update(is_listed=False)
    program = Offering.objects.filter(slug="new-year").first()
    if program:
        program.characters.set([duo])


class Migration(migrations.Migration):
    dependencies = [("catalog", "0001_initial")]
    operations = [migrations.RunPython(combine_new_year, migrations.RunPython.noop)]
