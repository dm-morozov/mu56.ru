from django.db import migrations


POSITIONS = {"bumblebee": (40, 20), "new-year": (50, 30),
             "nitrogen": (20, 40), "cotton-candy-show": (30, 50)}


def reorder(apps, schema_editor, reverse=False):
    Offering = apps.get_model("catalog", "Offering")
    for slug, (old, new) in POSITIONS.items():
        if reverse:
            old, new = new, old
        Offering.objects.using(schema_editor.connection.alias).filter(
            slug=slug, service_position=old,
        ).update(service_position=new)


def restore(apps, schema_editor):
    reorder(apps, schema_editor, reverse=True)


class Migration(migrations.Migration):
    dependencies = [("catalog", "0012_unlist_selected_characters")]
    operations = [migrations.RunPython(reorder, restore)]
