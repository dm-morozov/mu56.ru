from django.db import migrations


NAMES = [
    ("bumblebee", "Бамблби + супергерой", "Бамблби + второй герой на выбор"),
    ("optimus-prime", "Оптимус + супергерой", "Оптимус Прайм + второй герой на выбор"),
    ("iron-man", "Железный человек + супергерой", "Железный человек + второй герой на выбор"),
]


def rename(apps, schema_editor):
    Offering = apps.get_model("catalog", "Offering")
    for slug, old, new in NAMES:
        Offering.objects.filter(slug=slug, name=old).update(name=new)


def revert(apps, schema_editor):
    Offering = apps.get_model("catalog", "Offering")
    for slug, old, new in NAMES:
        Offering.objects.filter(slug=slug, name=new).update(name=old)


class Migration(migrations.Migration):
    dependencies = [("catalog", "0008_new_year_formats")]
    operations = [migrations.RunPython(rename, revert)]
