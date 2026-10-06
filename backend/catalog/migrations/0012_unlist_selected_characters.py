from django.db import migrations


def unlist_characters(apps, schema_editor):
    alias = schema_editor.connection.alias
    slugs = ("nolik", "korzhik", "karamelka")
    Character = apps.get_model("catalog", "Character")
    CharacterPhoto = apps.get_model("catalog", "CharacterPhoto")
    Character.objects.using(alias).filter(slug__in=slugs).update(is_listed=False)
    CharacterPhoto.objects.using(alias).filter(character__slug__in=slugs).update(is_listed=False)


class Migration(migrations.Migration):
    dependencies = [("catalog", "0011_offering_service_position")]
    # Keep historical bookings; reversing migrations must not republish these images.
    operations = [migrations.RunPython(unlist_characters, migrations.RunPython.noop)]
