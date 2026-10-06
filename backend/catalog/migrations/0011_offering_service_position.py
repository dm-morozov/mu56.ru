from django.db import migrations, models


def set_initial_positions(apps, schema_editor):
    Offering = apps.get_model("catalog", "Offering")
    positions = {"animation": 10, "nitrogen": 20, "cotton-candy-show": 30,
                 "bumblebee": 40, "new-year": 50, "silver": 60, "ribbons": 70,
                 "sound": 80, "projector": 90, "foam": 100, "photographer": 110}
    for slug, position in positions.items():
        Offering.objects.using(schema_editor.connection.alias).filter(slug=slug).update(service_position=position)


class Migration(migrations.Migration):
    dependencies = [("catalog", "0010_new_year_final_tariffs")]
    operations = [
        migrations.AddField(model_name="offering", name="service_position",
                            field=models.PositiveSmallIntegerField(blank=True, null=True, verbose_name="Порядок в услугах",
                                help_text="Меньше число — выше карточка. Пустое поле — нет карточки в разделе услуг. Порядок общей карточки трансформеров задаётся у Бамблби.")),
        migrations.RunPython(set_initial_positions, migrations.RunPython.noop),
    ]
