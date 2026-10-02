from pathlib import Path
from uuid import uuid4

from django.core.exceptions import ValidationError


def character_photo_path(instance, filename):
    return f"characters/{instance.character.slug}/{uuid4().hex}{Path(filename).suffix.lower()}"


def validate_photo_size(value):
    if value.size > 15 * 1024 * 1024:
        raise ValidationError("Фотография должна быть не больше 15 МБ.")
