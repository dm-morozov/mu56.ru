from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Review
from .seed_editorial import AVITO, REVIEWS


class Command(BaseCommand):
    help = "Добавляет выбранные отзывы Авито, обновляет порядок и ссылки, сохраняя правки текстов и публикации."

    @transaction.atomic
    def handle(self, *args, **options):
        created_count = 0
        for position, (key, author, text) in enumerate(REVIEWS, 1):
            review, created = Review.objects.get_or_create(
                source_key=key,
                defaults={"author": author, "text": text, "position": position,
                          "source_label": "Avito", "source_url": AVITO, "is_published": True},
            )
            if not created:
                review.position = position
                review.source_url = AVITO
                review.save(update_fields=["position", "source_url"])
            created_count += created
        self.stdout.write(self.style.SUCCESS(
            f"Добавлено: {created_count}. Порядок и ссылки обновлены для {len(REVIEWS)} отзывов."
        ))
