from io import StringIO

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Offering
from .models import Lead


class SoundAddonTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalog", stdout=StringIO())

    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.token = self.client.get("/api/v1/csrf/").json()["csrf_token"]

    def test_sound_preview_matches_saved_quote_and_remains_immutable(self):
        for kind, offering, amount in [("transformer", "bumblebee", 14600), ("animation", "animation", 9400)]:
            with self.subTest(kind=kind):
                cache.clear()
                preview = self.client.get(f"/api/v1/{kind}-quote/?offering={offering}&addons=nitrogen,sound")
                self.assertEqual(preview.status_code, 200)
                self.assertEqual(preview.json()["amount_rub"], amount)
                response = self.client.post("/api/v1/leads/", {
                    "name": "Тест звука", "phone": "+7 (903) 111-22-33", "contact_method": "phone",
                    "offering": offering, "addons": ["nitrogen", "sound"], "data_consent": True,
                }, format="json", HTTP_X_CSRFTOKEN=self.token)
                self.assertEqual(response.status_code, 201, response.data)
                lead = Lead.objects.latest("created_at")
                self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], amount)
                self.assertEqual(lead.selection_snapshot["price_breakdown"], preview.json()["lines"])
        Offering.objects.get(slug="sound").prices.update(amount_rub=2500)
        lead.refresh_from_db()
        self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 9400)

    def test_sound_requires_confirmed_tariff_and_other_extras_are_not_quoted(self):
        self.assertEqual(self.client.get("/api/v1/animation-quote/?offering=animation&addons=foam,sound").status_code, 400)
        for kind, offering in [("transformer", "bumblebee"), ("animation", "animation")]:
            for addons in ["sound,sound", "photographer"]:
                self.assertEqual(self.client.get(f"/api/v1/{kind}-quote/?offering={offering}&addons={addons}").status_code, 400)
        Offering.objects.get(slug="sound").prices.update(is_confirmed=False)
        self.assertEqual(self.client.get("/api/v1/transformer-quote/?offering=bumblebee&addons=sound").status_code, 400)
        response = self.client.post("/api/v1/leads/", {
            "name": "Тест звука", "phone": "+79031112233", "contact_method": "phone",
            "offering": "bumblebee", "addons": ["sound"], "data_consent": True,
        }, format="json", HTTP_X_CSRFTOKEN=self.token)
        self.assertEqual(response.status_code, 400)
