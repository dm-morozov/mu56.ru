from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("leads", "0003_lead_second_character")]
    operations = [
        migrations.AddField(model_name="lead", name="submission_key", field=models.UUIDField(editable=False, null=True, unique=True)),
        migrations.AddField(model_name="lead", name="submission_fingerprint", field=models.CharField(blank=True, editable=False, max_length=64)),
    ]
