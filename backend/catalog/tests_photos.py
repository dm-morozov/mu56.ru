from io import BytesIO, StringIO
from tempfile import TemporaryDirectory
import json
from pathlib import Path

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image

from .models import Character, CharacterPhoto


def uploaded_image():
    data = BytesIO()
    Image.new("RGB", (12, 12), "yellow").save(data, format="PNG")
    return SimpleUploadedFile("photo.png", data.getvalue(), content_type="image/png")


class GalleryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_catalog", stdout=StringIO())
        cls.owner = get_user_model().objects.create_superuser("gallery-owner", password="local-test-only")

    def setUp(self):
        self.storage = TemporaryDirectory()
        self.addCleanup(self.storage.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.storage.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.hero = Character.objects.get(slug="spider-man")

    def test_api_hides_unlisted_photos_and_preserves_order_in_both_catalogs(self):
        CharacterPhoto.objects.create(character=self.hero, image="characters/later.png", alt="Позже", position=9)
        CharacterPhoto.objects.create(character=self.hero, image="characters/first.png", alt="Сначала", position=1)
        CharacterPhoto.objects.create(character=self.hero, image="characters/hidden.png", alt="Скрыто", is_listed=False)
        data = self.client.get("/api/v1/characters/spider-man/").json()
        self.assertEqual([p["alt"] for p in data["photos"]], ["Сначала", "Позже"])
        self.assertEqual(data["photos"][0]["url"], "/uploads/characters/first.png")
        Character.objects.get(slug="spider-man").offering_set.add(Character.objects.get(slug="bumblebee").offering_set.first())
        data = self.client.get("/api/v1/offerings/bumblebee/").json()
        hero = next(c for c in data["characters"] if c["slug"] == "spider-man")
        self.assertEqual(len(hero["photos"]), 2)

    def test_admin_upload_immediately_appears_in_public_api(self):
        self.client.force_login(self.owner)
        response = self.client.post(f"/admin/catalog/character/{self.hero.pk}/change/", {
            "name": self.hero.name, "slug": self.hero.slug, "category": self.hero.category,
            "description": self.hero.description, "availability": self.hero.availability, "is_listed": "on",
            "photos-TOTAL_FORMS": "1", "photos-INITIAL_FORMS": "0",
            "photos-MIN_NUM_FORMS": "0", "photos-MAX_NUM_FORMS": "1000",
            "photos-0-image": uploaded_image(), "photos-0-alt": "Игра с Человеком-пауком",
            "photos-0-position": "1", "photos-0-is_listed": "on", "_save": "Сохранить",
        })
        self.assertEqual(response.status_code, 302)
        data = self.client.get("/api/v1/characters/spider-man/").json()
        self.assertEqual(data["photos"][0]["alt"], "Игра с Человеком-пауком")
        self.assertTrue(CharacterPhoto.objects.get().image.storage.exists(CharacterPhoto.objects.get().image.name))

    def test_admin_rejects_fake_image_and_large_file(self):
        inline = admin.site._registry[Character].inlines[0]
        from django.forms import modelform_factory
        form_class = modelform_factory(inline.model, fields=("image", "alt", "position", "is_listed"))
        bad = SimpleUploadedFile("fake.png", b"not an image", content_type="image/png")
        form = form_class({"alt": "Фото", "position": 0}, {"image": bad})
        self.assertFalse(form.is_valid())
        self.assertIn("image", form.errors)
        image = uploaded_image()
        image.size = 16 * 1024 * 1024
        form = form_class({"alt": "Фото", "position": 0}, {"image": image})
        self.assertFalse(form.is_valid())
        self.assertIn("15 МБ", str(form.errors))

    def test_reimport_preserves_owner_caption_and_hidden_state(self):
        manifest = {"spider-man": ["/media/gallery/spider-man/1.jpg"]}
        with TemporaryDirectory() as fixture:
            source = Path(fixture)
            manifest_path = source / "frontend/src/lib/character-gallery.json"
            manifest_path.parent.mkdir(parents=True)
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            image_path = source / "frontend/public/media/gallery/spider-man/1.jpg"
            image_path.parent.mkdir(parents=True)
            Image.new("RGB", (12, 12), "yellow").save(image_path)
            call_command("seed_character_photos", source_root=source, stdout=StringIO())
            photo = CharacterPhoto.objects.get()
            photo.alt = "Описание владельца"
            photo.is_listed = False
            photo.save()
            call_command("seed_character_photos", source_root=source, stdout=StringIO())
        photo.refresh_from_db()
        self.assertEqual(CharacterPhoto.objects.count(), 1)
        self.assertEqual(photo.alt, "Описание владельца")
        self.assertFalse(photo.is_listed)
