import json
from datetime import datetime, timezone
from pathlib import Path

from django.core import serializers
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.db import connection, transaction

from catalog.archives import digest, pack_media
from catalog.models import Character, CharacterPhoto, Offering, PriceOption, PackagePart, ContactChannel, Review, Article

MODELS = (Character, Offering, PriceOption, PackagePart, ContactChannel, Review, Article, CharacterPhoto)
FORMAT = "mu56-catalog-v1"


class Command(BaseCommand):
    help = "Export only catalog and referenced photos; never leads, users or Telegram queue."

    def add_arguments(self, parser):
        parser.add_argument("destination", type=Path)

    def handle(self, destination, **options):
        root = destination.resolve()
        if any(root.is_relative_to(Path(public).resolve()) for public in (settings.MEDIA_ROOT, settings.STATIC_ROOT)):
            raise CommandError("Catalog bundles must be outside public media and static directories.")
        if destination.exists():
            raise CommandError("Destination must be a new directory.")
        destination.mkdir(parents=True, mode=0o700)
        with transaction.atomic():
            if connection.vendor == "postgresql":
                with connection.cursor() as cursor:
                    cursor.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            objects = [obj for model in MODELS for obj in model.objects.order_by("pk")]
            payload = serializers.serialize("json", objects, indent=2)
            (destination / "catalog.json").write_text(payload, encoding="utf-8")
            names = [str(obj.image) for obj in objects if isinstance(obj, CharacterPhoto)]
            media = pack_media(destination / "media.zip", settings.MEDIA_ROOT, names)
        manifest = {
            "format": FORMAT, "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "models": {model._meta.label_lower: sum(isinstance(obj, model) for obj in objects) for model in MODELS},
            "media": media,
            "files": {name: digest(destination / name) for name in ("catalog.json", "media.zip")},
            "contains_leads_users_or_queue": False,
        }
        (destination / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Catalog exported: {len(objects)} records, {len(media)} photos. {destination}"))
