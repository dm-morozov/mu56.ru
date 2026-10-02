from io import StringIO

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase

from .models import Character, ContactChannel, Offering, PriceOption
from .pricing import package_total, transformer_total


class CatalogTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalog", stdout=StringIO())

    def test_booklet_package_totals_include_rounded_surcharges(self):
        expected = {
            "sweet-vibe": (5500, 10800, 100),
            "silver-party": (6500, 11800, 105),
            "ice-breath": (7400, 14400, 120),
            "full-party": (9400, 18200, 150),
            "foam-party": (15400, 25900, 180),
        }
        for slug, (base, with_second, duration) in expected.items():
            with self.subTest(slug=slug):
                package = Offering.objects.get(slug=slug)
                self.assertEqual(package_total(package), base)
                self.assertEqual(package_total(package, second_performer=True), with_second)
                self.assertEqual(package.duration_minutes, duration)
                self.assertEqual(sum(part.duration_minutes for part in package.parts.all()), duration)
                self.assertFalse(package.parts.last().led_by_performer)

    def test_transformer_extensions_use_distinct_show_and_support_rates(self):
        for program_slug in ("bumblebee", "optimus-prime"):
            program = Offering.objects.get(slug=program_slug)
            self.assertEqual(program.included_performers, 2)
            self.assertEqual(transformer_total(program), 6200)
            for show_slug, total in [("nitrogen", 12600), ("silver", 10500), ("cotton-candy-show", 9500)]:
                with self.subTest(program=program_slug, show=show_slug):
                    self.assertEqual(transformer_total(program, [Offering.objects.get(slug=show_slug)]), total)

    def test_unconfirmed_extension_is_not_silently_priced(self):
        program = Offering.objects.get(slug="bumblebee")
        with self.assertRaises(ValueError):
            transformer_total(program, [Offering.objects.get(slug="foam")])
        silver = Offering.objects.get(slug="silver")
        with self.assertRaises(ValueError):
            transformer_total(program, [silver, silver])

    def test_seed_does_not_reset_owner_edits_or_duplicate_records(self):
        tariff = Offering.objects.get(slug="animation").prices.get(code="base")
        tariff.amount_rub = 3700
        tariff.save()
        counts = (Character.objects.count(), Offering.objects.count(), PriceOption.objects.count())
        call_command("seed_catalog", stdout=StringIO())
        tariff.refresh_from_db()
        self.assertEqual(tariff.amount_rub, 3700)
        self.assertEqual(counts, (Character.objects.count(), Offering.objects.count(), PriceOption.objects.count()))

    def test_unpriced_extras_and_temporary_roles_remain_distinct(self):
        self.assertFalse(Offering.objects.get(slug="cotton-candy-operator").prices.exists())
        self.assertEqual(Offering.objects.get(slug="cotton-candy-show").prices.get(code="base").amount_rub, 2500)
        self.assertTrue(Character.objects.get(slug="ladybug").is_listed)
        self.assertEqual(Character.objects.get(slug="ladybug").availability, "check")
        self.assertEqual(ContactChannel.objects.get(kind="telegram").url, "https://t.me/dem2014")
        self.assertFalse(ContactChannel.objects.get(kind="max").is_verified)

    def test_tariff_validation_blocks_invalid_prices_and_contexts(self):
        program = Offering.objects.get(slug="bumblebee")
        invalid = PriceOption(offering=program, code="invalid", label="invalid", is_confirmed=True)
        with self.assertRaises(ValidationError):
            invalid.full_clean()
        invalid.amount_rub = 1300
        invalid.context = PriceOption.Context.SECOND_PERFORMER
        with self.assertRaises(ValidationError):
            invalid.full_clean()

    def test_admin_requires_login_and_edit_forms_render(self):
        self.assertRedirects(self.client.get("/admin/catalog/offering/"), "/admin/login/?next=/admin/catalog/offering/", fetch_redirect_response=False)
        user = get_user_model().objects.create_superuser(username="catalog-test", password=None)
        self.client.force_login(user)
        for path in ["/admin/", "/admin/catalog/character/", "/admin/catalog/offering/", "/admin/catalog/contactchannel/"]:
            self.assertEqual(self.client.get(path).status_code, 200)
        package = Offering.objects.get(slug="sweet-vibe")
        response = self.client.get(f"/admin/catalog/offering/{package.pk}/change/")
        self.assertContains(response, "Фоновая музыка, без ведущих")

    def test_new_year_has_four_independent_confirmed_tariffs(self):
        tariffs = Offering.objects.get(slug="new-year").prices.order_by("duration_minutes")
        self.assertEqual(list(tariffs.values_list("duration_minutes", "amount_rub")), [(15, 3500), (30, 4500), (45, 5000), (60, 6000)])

    def test_new_year_lists_one_pair_and_keeps_owner_description(self):
        program = Offering.objects.get(slug="new-year")
        self.assertEqual(list(program.characters.values_list("slug", flat=True)), ["new-year-duo"])
        self.assertEqual(program.included_performers, 2)
        duo = Character.objects.get(slug="new-year-duo")
        duo.description = "Описание владельца"
        duo.save()
        call_command("seed_character_content", stdout=StringIO())
        duo.refresh_from_db()
        self.assertEqual(duo.description, "Описание владельца")
        self.assertTrue(Character.objects.get(slug="spider-man").description)
