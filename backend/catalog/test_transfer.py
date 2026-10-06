import hashlib
import json
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile, ZipInfo

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from catalog.archives import digest, media_path, verify_media
from catalog.management.commands.export_catalog import MODELS
from catalog.models import Character, CharacterPhoto, Offering, PriceOption, Article
from leads.models import Lead, TelegramNotification


class CatalogTransferTests(TransactionTestCase):
    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.media = self.root / "media"
        self.media.mkdir()
        self.settings_override = override_settings(MEDIA_ROOT=self.media, TELEGRAM_ENABLED=False)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.bundle = self.root / "bundle"
        hero = Character.objects.create(name="Тестовый герой", slug="transfer-hero", category="Супергерои")
        self.hero_pk = hero.pk
        offering = Offering.objects.create(name="Анимация", slug="transfer-animation", kind="animation")
        offering.characters.add(hero)
        PriceOption.objects.create(offering=offering, code="hour", label="1 час", amount_rub=3500, is_confirmed=True)
        Article.objects.create(title="Статья", slug="transfer-article", excerpt="Описание", body="Текст", related_offering=offering)
        (self.media / "photo.jpg").write_bytes(b"fixture photo bytes")
        (self.media / "unreferenced.jpg").write_bytes(b"not referenced")
        CharacterPhoto.objects.create(character=hero, image="photo.jpg", alt="Тестовая фотография")
        lead = Lead.objects.create(name="Private test", phone="+79030000000", consent_at=timezone.now(), consent_version="test")
        TelegramNotification.objects.create(lead=lead)
        get_user_model().objects.create_user(username="private-owner", password="not-exported")

    def export(self):
        call_command("export_catalog", self.bundle, stdout=StringIO())

    def empty_target(self):
        Lead.objects.all().delete()
        get_user_model().objects.all().delete()
        # Delete reverse dependencies first; source bundle remains unchanged.
        for model in reversed(MODELS):
            model.objects.all().delete()

    def rewrite_manifest(self):
        path = self.bundle / "manifest.json"
        manifest = json.loads(path.read_text())
        for name in manifest["files"]:
            manifest["files"][name] = digest(self.bundle / name)
        path.write_text(json.dumps(manifest))

    def test_export_excludes_private_data_and_orphan_media(self):
        self.export()
        rows = json.loads((self.bundle / "catalog.json").read_text())
        self.assertTrue(all(row["model"].startswith("catalog.") for row in rows))
        with ZipFile(self.bundle / "media.zip") as archive:
            self.assertEqual(archive.namelist(), ["photo.jpg"])
        self.assertNotIn("private-owner", (self.bundle / "catalog.json").read_text())
        self.assertNotIn("Private test", (self.bundle / "catalog.json").read_text())

    def test_roundtrip_preserves_relations_prices_photos_and_sequences(self):
        self.export()
        self.empty_target()
        target = self.root / "new-media"
        with override_settings(MEDIA_ROOT=target):
            call_command("import_catalog", self.bundle, stdout=StringIO())
            self.assertEqual((target / "photo.jpg").read_bytes(), b"fixture photo bytes")
        offering = Offering.objects.get(slug="transfer-animation")
        self.assertEqual(offering.characters.get().pk, self.hero_pk)
        self.assertEqual(offering.prices.get().amount_rub, 3500)
        self.assertEqual(Article.objects.get().related_offering, offering)
        self.assertGreater(Character.objects.create(name="Следующий", slug="next", category="test").pk, self.hero_pk)
        self.assertEqual(Lead.objects.count(), 0)
        self.assertEqual(TelegramNotification.objects.count(), 0)
        self.assertEqual(get_user_model().objects.count(), 0)

    def test_import_rejects_occupied_database(self):
        self.export()
        with self.assertRaisesMessage(CommandError, "Target must"):
            call_command("import_catalog", self.bundle, stdout=StringIO())
        self.assertEqual(Lead.objects.count(), 1)

    def test_only_unchanged_migration_default_can_be_replaced_explicitly(self):
        self.export()
        self.empty_target()
        initial = Character.objects.create(name="Новогодняя сказка: Дед Мороз и Снегурочка", slug="new-year-duo", category="Новый год")
        initial.description = "Owner has edited this record"
        initial.save()
        with self.assertRaisesMessage(CommandError, "Target must"):
            call_command("import_catalog", self.bundle, replace_migration_defaults=True, stdout=StringIO())
        initial.description = ""
        initial.save()
        with self.assertRaisesMessage(CommandError, "Target must"):
            call_command("import_catalog", self.bundle, stdout=StringIO())
        call_command("import_catalog", self.bundle, replace_migration_defaults=True, stdout=StringIO())
        self.assertTrue(Character.objects.filter(slug="transfer-hero").exists())

    def test_import_rejects_corrupted_payload_before_writes(self):
        self.export()
        self.empty_target()
        with (self.bundle / "catalog.json").open("a") as stream:
            stream.write("corruption")
        with self.assertRaisesMessage(CommandError, "checksum"):
            call_command("import_catalog", self.bundle, stdout=StringIO())
        self.assertFalse(Character.objects.exists())

    def test_import_rejects_private_model_even_with_matching_checksum(self):
        self.export()
        rows = json.loads((self.bundle / "catalog.json").read_text())
        rows[0]["model"] = "auth.user"
        (self.bundle / "catalog.json").write_text(json.dumps(rows))
        self.rewrite_manifest()
        with self.assertRaisesMessage(CommandError, "Unsupported catalog model"):
            call_command("import_catalog", self.bundle, stdout=StringIO())

    def test_import_does_not_overwrite_conflicting_media(self):
        self.export()
        self.empty_target()
        (self.media / "photo.jpg").write_bytes(b"different upload")
        with self.assertRaisesMessage(CommandError, "conflicting media"):
            call_command("import_catalog", self.bundle, stdout=StringIO())
        self.assertFalse(Character.objects.exists())
        self.assertEqual((self.media / "photo.jpg").read_bytes(), b"different upload")

    def test_path_traversal_and_symlink_zip_rejected(self):
        for name in ("../file.jpg", "/file.jpg", "C:/file.jpg", "nested\\file.jpg", "a/./file.jpg"):
            with self.assertRaises(CommandError):
                media_path(self.media, name)
        path = self.root / "unsafe.zip"
        with ZipFile(path, "w") as archive:
            archive.writestr("../escape.jpg", b"escape")
        with self.assertRaises(CommandError):
            verify_media(path, {"../escape.jpg": hashlib.sha256(b"escape").hexdigest()})
        entry = ZipInfo("photo.jpg")
        entry.external_attr = (0o120777 << 16)
        with ZipFile(path, "w") as archive:
            archive.writestr(entry, b"linked")
        with self.assertRaisesMessage(CommandError, "Unsupported media"):
            verify_media(path, {"photo.jpg": hashlib.sha256(b"linked").hexdigest()})

    def test_export_cannot_publish_bundle_inside_media(self):
        with self.assertRaisesMessage(CommandError, "outside public"):
            call_command("export_catalog", self.media / "private-bundle", stdout=StringIO())
        self.assertFalse((self.media / "private-bundle").exists())

    def test_missing_referenced_media_does_not_make_ready_bundle(self):
        (self.media / "photo.jpg").unlink()
        with self.assertRaisesMessage(CommandError, "missing"):
            self.export()
        self.assertFalse((self.bundle / "manifest.json").exists())
