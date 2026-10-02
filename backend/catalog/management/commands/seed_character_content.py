from django.core.management.base import BaseCommand
from catalog.character_content import DESCRIPTIONS
from catalog.models import Character


class Command(BaseCommand):
    help = "Заполняет только пустые описания, сохраняя правки владельца."

    def handle(self, *args, **options):
        count = 0
        for slug, description in DESCRIPTIONS.items():
            count += Character.objects.filter(slug=slug, description="").update(description=description)
        self.stdout.write(f"Заполнено описаний: {count}. Существующие тексты сохранены.")
