import json
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from catalog.models import Character, CharacterPhoto


class Command(BaseCommand):
    help = "Импортирует выбранные фотографии архива один раз, сохраняя правки и скрытие владельца."

    def add_arguments(self, parser):
        parser.add_argument("--source-root", type=Path, help="Корень каталога импорта с frontend/src и frontend/public")

    def handle(self, *args, **options):
        root = options.get("source_root") or Path(__file__).resolve().parents[4]
        manifest = json.loads((root / "frontend/src/lib/character-gallery.json").read_text(encoding="utf-8"))
        count = 0
        for slug, photos in manifest.items():
            character = Character.objects.filter(slug=slug).first()
            if not character:
                continue
            for position, relative in enumerate(photos, 1):
                key = f"archive:{slug}:{relative}"
                if CharacterPhoto.objects.filter(source_key=key).exists():
                    continue
                source = root / "frontend/public" / relative.lstrip("/")
                photo = CharacterPhoto(character=character, source_key=key, position=position,
                                       alt=f"{character.name} на празднике «Мира Улыбок» — фото {position}")
                with source.open("rb") as handle:
                    photo.image.save(source.name, File(handle), save=False)
                photo.full_clean()
                photo.save()
                count += 1
        self.stdout.write(f"Добавлено фотографий: {count}. Существующие записи сохранены.")
