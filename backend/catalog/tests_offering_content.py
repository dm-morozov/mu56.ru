from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from catalog.models import Offering, PriceOption
from catalog.offering_content import DESCRIPTIONS


class OfferingContentTests(TestCase):
    def test_seed_preserves_owner_copy_and_prices_on_repeat(self):
        call_command("seed_catalog", stdout=StringIO())
        item = Offering.objects.get(slug="bumblebee")
        item.description = "Текст владельца"
        item.requirements = "Условия владельца"
        item.save()
        prices = list(PriceOption.objects.values_list("pk", "amount_rub"))
        for _ in range(2):
            call_command("seed_offering_content", stdout=StringIO())
        item.refresh_from_db()
        self.assertEqual(item.description, "Текст владельца")
        self.assertEqual(item.requirements, "Условия владельца")
        self.assertFalse(Offering.objects.filter(description="").exists())
        self.assertEqual(list(PriceOption.objects.values_list("pk", "amount_rub")), prices)

    def test_descriptions_cover_current_catalog_and_api(self):
        call_command("seed_catalog", stdout=StringIO())
        self.assertEqual(set(Offering.objects.values_list("slug", flat=True)), set(DESCRIPTIONS))
        call_command("seed_offering_content", stdout=StringIO())
        response = self.client.get("/api/v1/offerings/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(item["description"] for item in response.json()["results"]))
