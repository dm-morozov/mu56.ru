from django.db import migrations


def refresh_new_year(apps, schema_editor):
    # Keep the retired row and historical lead snapshots; hide it from new orders.
    apps.get_model("catalog", "PriceOption").objects.filter(
        offering__slug="new-year", code="minutes-15",
    ).update(is_confirmed=False)
    # Existing pictures show the previous costumes. New uploads remain listed.
    apps.get_model("catalog", "CharacterPhoto").objects.filter(
        character__slug="new-year-duo",
    ).update(is_listed=False)
    Character = apps.get_model("catalog", "Character")
    for character in Character.objects.filter(slug="new-year-duo"):
        text = character.description.replace("Выберите 15, 30, 45 или 60 минут.", "Выберите поздравление от 30 минут до часа.")
        if text != character.description:
            character.description = text
            character.save(update_fields=["description"])


class Migration(migrations.Migration):
    dependencies = [("catalog", "0006_transformer_partners")]
    operations = [migrations.RunPython(refresh_new_year, migrations.RunPython.noop)]
