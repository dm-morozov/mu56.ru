import json
import shutil
from pathlib import Path
from zipfile import ZipFile

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import serializers
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction

from catalog.archives import digest, media_path, verify_media
from catalog.management.commands.export_catalog import FORMAT, MODELS
from catalog.models import Character
from leads.models import Lead


class Command(BaseCommand):
    help = "Import a checked catalog bundle into an empty, migrated database only."

    def add_arguments(self, parser):
        parser.add_argument("source", type=Path)
        parser.add_argument("--replace-migration-defaults", action="store_true", help="Allow only the unchanged single New Year character created by migration 0002.")

    def handle(self, source, **options):
        try:
            manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
            if manifest.get("format") != FORMAT or set(manifest["files"]) != {"catalog.json", "media.zip"}:
                raise CommandError("Unsupported catalog bundle.")
            for name, checksum in manifest["files"].items():
                if digest(source / name) != checksum:
                    raise CommandError("Bundle checksum mismatch.")
            if (source / "catalog.json").stat().st_size > 64 * 1024 * 1024:
                raise CommandError("Catalog is too large.")
            rows = json.loads((source / "catalog.json").read_text(encoding="utf-8"))
            allowed = {model._meta.label_lower: model for model in MODELS}
            counts = dict.fromkeys(allowed, 0)
            keys = set()
            for row in rows:
                label = row["model"]
                if label not in allowed or not isinstance(row["pk"], int) or row["pk"] < 1:
                    raise CommandError("Unsupported catalog model or primary key.")
                key = (label, row["pk"])
                if key in keys:
                    raise CommandError("Duplicate catalog record.")
                keys.add(key)
                fields = {field.name for field in allowed[label]._meta.get_fields() if not field.auto_created and field.name != "id"}
                if set(row["fields"]) != fields:
                    raise CommandError("Catalog fields differ from this release; use matching code.")
                counts[label] += 1
            if counts != manifest["models"]:
                raise CommandError("Catalog counts differ from manifest.")
            referenced = {row["fields"]["image"] for row in rows if row["model"] == "catalog.characterphoto"}
            if referenced != set(manifest["media"]):
                raise CommandError("Photo references differ from manifest.")
            verify_media(source / "media.zip", manifest["media"])
            paths = {name: media_path(settings.MEDIA_ROOT, name) for name in manifest["media"]}
            for name, path in paths.items():
                if path.exists() and (not path.is_file() or digest(path) != manifest["media"][name]):
                    raise CommandError("Destination contains conflicting media; nothing overwritten.")
            objects = list(serializers.deserialize("json", json.dumps(rows)))
        except (KeyError, TypeError, ValueError, OSError) as error:
            raise CommandError("Invalid or unreadable catalog bundle.") from error

        with transaction.atomic():
            if connection.vendor == "postgresql":
                # Prevent concurrent writes while checking and populating the empty target.
                tables = [model._meta.db_table for model in MODELS] + [Lead._meta.db_table, get_user_model()._meta.db_table]
                tables.append(allowed["catalog.offering"].characters.through._meta.db_table)
                with connection.cursor() as cursor:
                    quoted = ", ".join(connection.ops.quote_name(table) for table in sorted(tables))
                    cursor.execute(f"LOCK TABLE {quoted} IN EXCLUSIVE MODE")
            private_data = Lead.objects.exists() or get_user_model().objects.exists()
            populated = any(model.objects.exists() for model in MODELS)
            initial = None
            if options["replace_migration_defaults"] and populated and not private_data:
                expected = {"name": "Новогодняя сказка: Дед Мороз и Снегурочка", "slug": "new-year-duo", "category": "Новый год", "description": "", "availability": "available", "is_listed": True}
                if Character.objects.count() == 1 and not any(model.objects.exists() for model in MODELS if model is not Character):
                    candidate = Character.objects.get()
                    if all(getattr(candidate, name) == value for name, value in expected.items()):
                        initial = candidate
            if private_data or (populated and initial is None):
                raise CommandError("Target must have no catalog, leads or admin users. Use a new migrated database.")
            if initial is not None:
                initial.delete()
            for obj in objects:
                obj.save()
            connection.check_constraints()
            with connection.cursor() as cursor:
                for statement in connection.ops.sequence_reset_sql(no_style(), MODELS):
                    cursor.execute(statement)
            with ZipFile(source / "media.zip") as archive:
                for name, path in paths.items():
                    if path.exists():
                        continue
                    path.parent.mkdir(parents=True, exist_ok=True)
                    # Exclusive creation avoids overwriting a concurrent upload.
                    with archive.open(name) as incoming, path.open("xb") as outgoing:
                        shutil.copyfileobj(incoming, outgoing)
        self.stdout.write(self.style.SUCCESS(f"Catalog imported: {len(objects)} records. No leads or users transferred."))
