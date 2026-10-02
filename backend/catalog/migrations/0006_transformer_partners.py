from django.db import migrations


def add_partners(apps, schema_editor):
    Character = apps.get_model("catalog", "Character")
    Offering = apps.get_model("catalog", "Offering")
    partners = list(Character.objects.exclude(category__in=["Большие герои", "Новый год"]).exclude(slug__in=["bumblebee", "optimus-prime", "iron-man"]))
    for offering in Offering.objects.filter(kind="transformer", slug__in=["bumblebee", "optimus-prime", "iron-man"]):
        offering.characters.add(*partners)


class Migration(migrations.Migration):
    dependencies = [("catalog", "0005_ceiling_requirement")]
    operations = [migrations.RunPython(add_partners, migrations.RunPython.noop)]
