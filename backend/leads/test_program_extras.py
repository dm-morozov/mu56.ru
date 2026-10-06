from django.conf import settings
from io import StringIO

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Offering
from .models import Lead
from .telegram import notification_payload


class ProgramExtrasTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalog", stdout=StringIO())

    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.token = self.client.get("/api/v1/csrf/").json()["csrf_token"]

    def submit(self, **changes):
        cache.clear()
        return self.client.post("/api/v1/leads/", {
            "phone": "+79031112233", "data_consent": True, "consent_version": settings.LEAD_CONSENT_VERSION,
            "offering": "silver-party", "addons": ["sound", "photographer"], **changes,
        }, format="json", HTTP_X_CSRFTOKEN=self.token)

    def test_extras_are_saved_and_priced_for_each_program_kind(self):
        for offering, amount, changes in [
            ("silver-party", 12000, {}),
            ("silver-party", 17300, {"second_performer": True}),
            ("animation", 9000, {}),
            ("bumblebee", 11700, {}),
            ("silver", 9000, {}),
            ("new-year", 11500, {"tariff_code": "minutes-50"}),
        ]:
            with self.subTest(offering=offering, changes=changes):
                response = self.submit(offering=offering, **changes)
                self.assertEqual(response.status_code, 201, response.data)
                lead = Lead.objects.latest("created_at")
                snapshot = lead.selection_snapshot
                self.assertEqual(snapshot["known_program_amount_rub"], amount)
                self.assertEqual(sum(line["amount_rub"] for line in snapshot["price_breakdown"]), amount)
                self.assertEqual({item["slug"] for item in snapshot["addons"]}, {"sound", "photographer"})
                self.assertIn("Фотограф", notification_payload(lead, "test")["text"])

    def test_standalone_extras_and_extras_without_program_are_rejected(self):
        for offering, addons in [(None, ["sound"]), (None, ["photographer"]), ("sound", []), ("photographer", [])]:
            self.assertEqual(self.submit(offering=offering, addons=addons).status_code, 400)

    def test_new_year_shows_use_two_performer_prices_and_sum_with_extras(self):
        for addons, total in [(["nitrogen"], 12400), (["silver"], 10300),
                              (["cotton-candy-show"], 9300),
                              (["nitrogen", "silver", "cotton-candy-show", "sound", "photographer"], 25500)]:
            with self.subTest(addons=addons):
                response = self.submit(offering="new-year", tariff_code="minutes-50", addons=addons)
                self.assertEqual(response.status_code, 201, response.data)
                snapshot = Lead.objects.latest("created_at").selection_snapshot
                self.assertEqual(snapshot["known_program_amount_rub"], total)
                self.assertEqual(sum(line["amount_rub"] for line in snapshot["price_breakdown"]), total)

    def test_new_year_unconfirmed_show_does_not_produce_partial_total(self):
        Offering.objects.get(slug="silver").prices.filter(context="transformer_support").update(is_confirmed=False)
        response = self.submit(offering="new-year", tariff_code="minutes-50", addons=["silver", "sound"])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(Lead.objects.latest("created_at").selection_snapshot["known_program_amount_rub"])

    def test_new_year_evening_cannot_be_extended_and_other_shows_are_rejected(self):
        self.assertEqual(self.submit(offering="new-year", tariff_code="eve-20", event_date="2099-12-31", event_time="20:00", addons=["nitrogen"]).status_code, 400)
        self.assertEqual(self.submit(offering="new-year", tariff_code="minutes-50", addons=["foam"]).status_code, 400)

    def test_included_sound_cannot_be_charged_twice_but_photographer_can_be_added(self):
        for offering, changes in [("foam", {}), ("foam-party", {}), ("new-year", {"tariff_code": "group-with-sound"})]:
            with self.subTest(offering=offering):
                self.assertEqual(self.submit(offering=offering, addons=["sound"], **changes).status_code, 400)
                self.assertEqual(self.submit(offering=offering, addons=["photographer"], **changes).status_code, 201)

    def test_unconfirmed_extra_does_not_create_false_total_and_old_quote_is_immutable(self):
        self.assertEqual(self.submit().status_code, 201)
        original = Lead.objects.latest("created_at")
        Offering.objects.get(slug="photographer").prices.update(is_confirmed=False)
        self.assertEqual(self.submit().status_code, 201)
        self.assertIsNone(Lead.objects.latest("created_at").selection_snapshot["known_program_amount_rub"])
        original.refresh_from_db()
        self.assertEqual(original.selection_snapshot["known_program_amount_rub"], 12000)
