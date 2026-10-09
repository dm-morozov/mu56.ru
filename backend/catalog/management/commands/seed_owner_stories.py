"""Add only the owner's two stories, preserving existing editorial changes."""

from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Article, Offering

from .owner_stories import ARTICLES


class Command(BaseCommand):
    help = "Добавить два рассказа Дмитрия без изменения существующих статей и отзывов"

    @transaction.atomic
    def handle(self, *args, **options):
        created_count = 0
        for slug, title, excerpt, offering_slug, body in ARTICLES:
            _, created = Article.objects.get_or_create(
                slug=slug,
                defaults={
                    "title": title,
                    "excerpt": excerpt,
                    "body": body,
                    "seo_description": excerpt,
                    "related_offering": Offering.objects.filter(slug=offering_slug).first(),
                    "is_published": True,
                },
            )
            created_count += int(created)
        self.stdout.write(f"Добавлено рассказов: {created_count}. Существующие записи сохранены.")
