from django.db import migrations


def update_requirements(apps, schema_editor):
    for model_name, fields in [("Character", ("description",)), ("Offering", ("description", "requirements")), ("Article", ("body",))]:
        model = apps.get_model("catalog", model_name)
        for record in model.objects.using(schema_editor.connection.alias).all():
            changed = []
            for field in fields:
                old = getattr(record, field)
                new = old.replace("2,40 м", "2,30 м").replace(
                    "Важно проверить не только комнату, но и путь до неё: двери, коридор, лестницу или лифт.",
                    "Размер дверей не критичен. Проходы и свободное пространство обсудим заранее.",
                )
                if new != old:
                    setattr(record, field, new)
                    changed.append(field)
            if changed:
                record.save(using=schema_editor.connection.alias, update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [("catalog", "0004_review_article")]
    operations = [migrations.RunPython(update_requirements, migrations.RunPython.noop)]
