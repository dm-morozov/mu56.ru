from django.core.management.base import BaseCommand
from django.db import transaction

from catalog.models import Offering
from catalog.offering_content import DESCRIPTIONS, REQUIREMENTS


class Command(BaseCommand):
    help = "Заполнить пустые описания услуг и условия площадки, сохраняя правки владельца."

    @transaction.atomic
    def handle(self, *args, **options):
        descriptions = sum(Offering.objects.filter(slug=slug, description="").update(description=text)
                           for slug, text in DESCRIPTIONS.items())
        requirements = sum(Offering.objects.filter(slug=slug, requirements="").update(requirements=text)
                           for slug, text in REQUIREMENTS.items())
        self.stdout.write(f"Описаний: {descriptions}; условий: {requirements}. Существующие тексты сохранены.")
