from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from catalog.models import Character, ContactChannel, Offering, PriceOption
from .models import Lead
from .telegram import notification_payload


class PublicAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalog", stdout=StringIO())

    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.token = self.client.get("/api/v1/csrf/").json()["csrf_token"]
        self.payload = {
            "name": "Тестовый клиент", "phone": "8 (903) 111-22-33", "contact_method": "telegram",
            "event_date": str(timezone.localdate() + timedelta(days=10)),
            "offering": "bumblebee", "character": "spider-man", "addons": ["silver"], "data_consent": True,
        }

    def submit(self, payload=None):
        return self.client.post("/api/v1/leads/", payload or self.payload, format="json", HTTP_X_CSRFTOKEN=self.token)

    def test_animation_with_shows_uses_addon_tariffs_once_and_matches_preview(self):
        for slug, amount in [("nitrogen", 7400), ("silver", 6500), ("cotton-candy-show", 5500), ("projector", 6000)]:
            with self.subTest(slug=slug):
                cache.clear()
                preview = self.client.get(f"/api/v1/animation-quote/?offering=animation&addons={slug}")
                self.assertEqual(preview.status_code, 200)
                self.assertEqual(preview.json()["amount_rub"], amount)
                payload = {**self.payload, "offering": "animation", "addons": [slug]}
                self.assertEqual(self.submit(payload).status_code, 201)
                lead = Lead.objects.latest("created_at")
                self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], amount)
                self.assertEqual(lead.selection_snapshot["price_breakdown"], preview.json()["lines"])

    def test_animation_quote_rejects_duplicates_hidden_and_unpriced_shows(self):
        self.assertEqual(self.client.get("/api/v1/animation-quote/?offering=animation&addons=silver,silver").status_code, 400)
        show = Offering.objects.get(slug="silver")
        show.is_listed = False
        show.save()
        self.assertEqual(self.client.get("/api/v1/animation-quote/?offering=animation&addons=silver").status_code, 400)
        show.is_listed = True
        show.save()
        show.prices.update(is_confirmed=False)
        self.assertEqual(self.client.get("/api/v1/animation-quote/?offering=animation&addons=silver").status_code, 400)

    def test_new_year_selected_format_preserves_duration_and_price(self):
        payload = {**self.payload, "offering": "new-year", "character": None, "addons": [], "tariff_code": "minutes-50"}
        self.assertEqual(self.submit(payload).status_code, 201)
        lead = Lead.objects.latest("created_at")
        self.assertEqual(lead.selection_snapshot["selected_tariff"], {"code": "minutes-50", "duration_minutes": 50, "amount_rub": 6000})
        self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 6000)
        tariff = Offering.objects.get(slug="new-year").prices.get(code="minutes-50")
        tariff.amount_rub = 7000
        tariff.save()
        lead.refresh_from_db()
        self.assertEqual(lead.selection_snapshot["selected_tariff"]["amount_rub"], 6000)
        self.assertIn("50 минут", notification_payload(lead, 123456)["text"])

    def test_new_year_rejects_retired_format_and_prices_group_show(self):
        payload = {**self.payload, "offering": "new-year", "character": None, "tariff_code": "minutes-45"}
        self.assertEqual(self.submit(payload).status_code, 400)
        payload["tariff_code"] = "group-with-sound"
        self.assertEqual(self.submit(payload).status_code, 201)
        lead = Lead.objects.latest("created_at")
        self.assertEqual(lead.selection_snapshot["selected_tariff"]["amount_rub"], 9000)
        self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 13300)
        self.assertEqual(list(lead.addons.values_list("slug", flat=True)), ["silver"])

    def test_catalog_excludes_hidden_offerings_roles_and_draft_prices(self):
        animation = Offering.objects.get(slug="animation")
        hidden = Character.objects.get(slug="spider-man")
        hidden.is_listed = False
        hidden.save()
        PriceOption.objects.create(offering=animation, code="draft", label="Черновик", amount_rub=1, is_confirmed=False)
        response = self.client.get("/api/v1/offerings/animation/")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("spider-man", [c["slug"] for c in response.json()["characters"]])
        self.assertNotIn("draft", [p["code"] for p in response.json()["prices"]])
        self.assertEqual(self.client.get("/api/v1/characters/spider-man/").status_code, 404)
        animation.is_listed = False
        animation.save()
        self.assertEqual(self.client.get("/api/v1/offerings/animation/").status_code, 404)

    def test_read_only_catalog_filters_and_paginates(self):
        response = self.client.get("/api/v1/offerings/?kind=package")
        self.assertEqual(response.json()["count"], 5)
        self.assertEqual(self.client.get("/api/v1/offerings/?kind=invalid").status_code, 400)
        self.assertEqual(self.client.post("/api/v1/offerings/", {}, format="json").status_code, 405)
        self.assertEqual(self.client.get("/api/v1/characters/").json()["count"], 32)
        contact_kinds = [item["kind"] for item in self.client.get("/api/v1/contacts/").json()]
        self.assertEqual(contact_kinds, ["phone", "telegram"])
        max_contact = ContactChannel.objects.get(kind="max")
        max_contact.is_verified = True
        max_contact.save()
        self.assertEqual(len(self.client.get("/api/v1/contacts/").json()), 3)

    def test_csrf_is_required_for_anonymous_leads(self):
        response = self.client.post("/api/v1/leads/", self.payload, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Lead.objects.exists())
        response = self.submit()
        self.assertEqual(response.status_code, 201)

    def test_lead_stores_choice_phone_and_server_price_snapshot(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(set(response.json()), {"reference", "status", "message"})
        self.assertEqual(response["Cache-Control"], "no-store")
        lead = Lead.objects.get(pk=response.json()["reference"])
        self.assertEqual(lead.phone, "+79031112233")
        self.assertEqual(lead.status, Lead.Status.NEW)
        self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 10500)

        self.assertEqual(lead.character.slug, "spider-man")
        self.assertEqual(lead.addons.get().slug, "silver")
        self.assertIsNotNone(lead.consent_at)
        self.assertEqual(lead.consent_version, "draft-v1")
        price = Offering.objects.get(slug="silver").prices.get(code="with-animation")
        price.amount_rub = 5000
        price.save()
        lead.refresh_from_db()
        self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 10500)

    def test_optional_program_start_time_is_saved_and_included_in_notification(self):
        response = self.submit({**self.payload, "event_time": "15:30"})
        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.get(pk=response.json()["reference"])
        self.assertEqual(lead.event_time.strftime("%H:%M"), "15:30")
        self.assertIn("Время: 15:30 (Оренбург)", notification_payload(lead, "test-chat")["text"])
        cache.clear()
        self.assertEqual(self.submit({**self.payload, "event_time": None}).status_code, 201)
        self.assertIsNone(Lead.objects.latest("created_at").event_time)

    def test_package_extra_performer_uses_booklet_rounding(self):
        payload = {**self.payload, "offering": "full-party", "addons": [], "second_performer": True}
        self.assertEqual(self.submit(payload).status_code, 201)
        lead = Lead.objects.get()
        self.assertTrue(lead.second_performer)
        self.assertTrue(lead.selection_snapshot["second_performer"])
        self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 18200)
        self.assertEqual(lead.character.slug, "spider-man")
        price = lead.offering.prices.get(context="second_performer")
        price.amount_rub = 9999
        price.save()
        lead.refresh_from_db()
        self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 18200)
        message = notification_payload(lead, "test-chat")["text"]
        self.assertIn("Второй аниматор: да", message)
        self.assertIn("Герой: Человек-паук", message)
        self.assertIn("Предварительный расчёт: 18 200 ₽", message)

    def test_package_second_hero_is_saved_in_snapshot_and_notification(self):
        payload = {**self.payload, "offering": "full-party", "addons": [], "second_performer": True, "second_character": "batman"}
        self.assertEqual(self.submit(payload).status_code, 201)
        lead = Lead.objects.get()
        self.assertEqual(lead.character.slug, "spider-man")
        self.assertEqual(lead.second_character.slug, "batman")
        self.assertEqual(lead.selection_snapshot["second_character"]["name"], "Бэтмен")
        self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 18200)
        self.assertIn("Второй герой: Бэтмен", notification_payload(lead, "test-chat")["text"])

    def test_second_hero_requires_package_extra_performer_and_compatible_role(self):
        for changes in [
            {"offering": "full-party", "second_performer": False, "second_character": "batman"},
            {"offering": "bumblebee", "second_character": "batman"},
            {"offering": "full-party", "second_performer": True, "second_character": "bumblebee"},
        ]:
            with self.subTest(changes=changes):
                cache.clear()
                response = self.submit({**self.payload, "addons": [], **changes})
                self.assertEqual(response.status_code, 400)
                self.assertIn("second_character", response.json())
        self.assertFalse(Lead.objects.exists())

    def test_transformer_preview_all_heroes_and_combinations_without_saving(self):
        for hero, base in [("bumblebee", 6200), ("optimus-prime", 6200), ("iron-man", 5800)]:
            for addons, extra in [("", 0), ("nitrogen", 6400), ("silver", 4300), ("cotton-candy-show", 3300), ("nitrogen,silver,cotton-candy-show", 14000)]:
                response = self.client.get("/api/v1/transformer-quote/", {"offering": hero, "addons": addons})
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(response.json()["amount_rub"], base + extra)
                self.assertEqual(response["Cache-Control"], "max-age=0, no-cache, no-store, must-revalidate, private")
        self.assertFalse(Lead.objects.exists())

    def test_preview_rejects_duplicate_hidden_unpriced_and_unknown_choices(self):
        for program, addons in [("full-party", ""), ("bumblebee", "silver,silver"), ("bumblebee", "unknown"), ("bumblebee", "ribbons")]:
            self.assertEqual(self.client.get("/api/v1/transformer-quote/", {"offering": program, "addons": addons}).status_code, 400)
        silver = Offering.objects.get(slug="silver")
        silver.is_listed = False
        silver.save()
        self.assertEqual(self.client.get("/api/v1/transformer-quote/", {"offering": "bumblebee", "addons": "silver"}).status_code, 400)

    def test_preview_uses_current_prices_and_lead_keeps_breakdown(self):
        response = self.submit({**self.payload, "addons": ["silver", "cotton-candy-show"]})
        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.get()
        self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 13800)
        self.assertEqual(sum(line["amount_rub"] for line in lead.selection_snapshot["price_breakdown"]), 13800)
        price = Offering.objects.get(slug="silver").prices.get(code="with-animation")
        price.amount_rub = 4000
        price.save()
        self.assertEqual(self.client.get("/api/v1/transformer-quote/", {"offering": "bumblebee", "addons": "silver"}).json()["amount_rub"], 11500)
        lead.refresh_from_db()
        self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 13800)

    def test_transformer_rejects_every_large_partner_even_if_catalog_link_exists(self):
        offering = Offering.objects.get(slug="bumblebee")
        for slug in ["bumblebee", "optimus-prime", "iron-man"]:
            offering.characters.add(Character.objects.get(slug=slug))
            response = self.submit({**self.payload, "character": slug})
            self.assertEqual(response.status_code, 400)
            self.assertIn("обычном костюме", response.json()["character"][0])
        self.assertFalse(Lead.objects.exists())

    def test_transformer_accepts_ordinary_partner_or_later_agreement(self):
        for slug in ["chase", "ladybug", None]:
            response = self.submit({**self.payload, "character": slug, "addons": []})
            self.assertEqual(response.status_code, 201)
            lead = Lead.objects.get(pk=response.json()["reference"])
            self.assertEqual(lead.selection_snapshot["known_program_amount_rub"], 6200)
            self.assertEqual(lead.character.slug if lead.character else None, slug)

    def test_partial_request_and_unpriced_extra_are_accepted_for_discussion(self):
        payload = {"phone": "9031112233", "data_consent": True, "addons": ["face-painting"]}
        self.assertEqual(self.submit(payload).status_code, 201)
        snapshot = Lead.objects.get().selection_snapshot
        self.assertIsNone(snapshot["known_program_amount_rub"])
        self.assertTrue(snapshot["requires_manager_confirmation"])
        self.assertEqual(snapshot["addons"][0]["prices"], [])

    def test_invalid_phone_consent_past_date_duplicate_and_hidden_choices(self):
        cases = [
            {"phone": "12345"}, {"data_consent": False}, {"website": "spam"},
            {"event_date": str(timezone.localdate() - timedelta(days=1))},
            {"addons": ["silver", "silver"]}, {"character": "bumblebee"},
            {"character": "optimus-prime"}, {"second_performer": True}, {"status": "confirmed"},
            {"selection_snapshot": {"known_program_amount_rub": 1}},
        ]
        for changes in cases:
            with self.subTest(changes=changes):
                cache.clear()
                self.assertEqual(self.submit({**self.payload, **changes}).status_code, 400)
        hidden = Offering.objects.get(slug="silver")
        hidden.is_listed = False
        hidden.save()
        cache.clear()
        self.assertEqual(self.submit().status_code, 400)
        self.assertFalse(Lead.objects.exists())

    def test_client_cannot_list_read_or_modify_leads(self):
        reference = self.submit().json()["reference"]
        self.assertEqual(self.client.get("/api/v1/leads/").status_code, 405)
        self.assertEqual(self.client.get(f"/api/v1/leads/{reference}/").status_code, 404)
        self.assertEqual(self.client.patch("/api/v1/leads/", {"status": "confirmed"}, format="json", HTTP_X_CSRFTOKEN=self.token).status_code, 405)
        self.assertEqual(self.client.get("/admin/leads/lead/").status_code, 302)
        user = get_user_model().objects.create_superuser(username="lead-admin-test", password=None)
        self.client.force_login(user)
        self.assertEqual(self.client.get("/admin/leads/lead/").status_code, 200)
        self.assertEqual(self.client.get(f"/admin/leads/lead/{reference}/change/").status_code, 200)

    def test_create_rate_limit_ignores_spoofed_forwarded_ips(self):
        for i in range(10):
            response = self.client.post("/api/v1/leads/", self.payload, format="json", HTTP_X_CSRFTOKEN=self.token, HTTP_X_FORWARDED_FOR=f"10.1.1.{i}")
            self.assertEqual(response.status_code, 201)
        self.assertEqual(self.submit().status_code, 429)
        self.assertEqual(Lead.objects.count(), 10)

    def test_oversized_body_and_non_json_are_rejected(self):
        self.assertEqual(self.submit({**self.payload, "comment": "x" * 70000}).status_code, 400)
        response = self.client.post("/api/v1/leads/", "phone=9031112233", content_type="application/x-www-form-urlencoded", HTTP_X_CSRFTOKEN=self.token)
        self.assertEqual(response.status_code, 415)
