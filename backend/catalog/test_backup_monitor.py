from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from zipfile import ZipFile

from django.core.management.base import CommandError
from django.test import SimpleTestCase
from catalog.archives import digest, pack_media
from catalog.backup_checks import check_latest_backup


class BackupMonitorTests(SimpleTestCase):
    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.now = datetime(2026, 10, 6, 12, tzinfo=timezone.utc)
        self.bundle = self.root / "20261006T110000Z_1234abcd"
        self.bundle.mkdir()
        (self.bundle / "database.dump").write_bytes(b"test dump")
        with ZipFile(self.bundle / "media.zip", "w") as archive:
            archive.writestr("image.txt", b"test media")
        import hashlib
        self.manifest = {"format": "mu56-backup-v1", "archives_verified": True,
                         "created_at_utc": (self.now - timedelta(hours=1)).isoformat(),
                         "media": {"image.txt": hashlib.sha256(b"test media").hexdigest()},
                         "files": {name: digest(self.bundle / name) for name in ("database.dump", "media.zip")},
                         "restore_verified": False}
        self.save()

    def save(self):
        (self.bundle / "manifest.json").write_text(json.dumps(self.manifest))

    def check(self):
        return check_latest_backup(self.root, now=self.now, min_free_gib=0)

    def test_passes_without_changing_files_or_claiming_restoration(self):
        before = {p.name: p.read_bytes() for p in self.bundle.iterdir()}
        result = self.check()
        self.assertEqual(result["age_hours"], 1)
        self.assertFalse(result["restore_verified"])
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.bundle.iterdir()})

    def test_newer_incomplete_bundle_does_not_fall_back_to_old_success(self):
        (self.root / "20261006T120000Z_1234abcd").mkdir()
        with self.assertRaises(CommandError):
            self.check()

    def test_stale_and_future_timestamp(self):
        for offset in (-37, 1):
            with self.subTest(offset=offset):
                self.manifest["created_at_utc"] = (self.now + timedelta(hours=offset)).isoformat()
                self.save()
                with self.assertRaises(CommandError):
                    self.check()

    def test_corrupted_dump(self):
        (self.bundle / "database.dump").write_bytes(b"corrupted")
        with self.assertRaises(CommandError):
            self.check()

    def test_media_entries_checked_even_if_archive_checksum_matches(self):
        self.manifest["media"]["image.txt"] = "0" * 64
        self.save()
        with self.assertRaises(CommandError):
            self.check()

    def test_low_disk_space(self):
        with patch("catalog.backup_checks.shutil.disk_usage") as usage:
            usage.return_value.free = 0
            with self.assertRaises(CommandError):
                check_latest_backup(self.root, now=self.now)

    def test_empty_directory(self):
        with TemporaryDirectory() as folder:
            with self.assertRaises(CommandError):
                check_latest_backup(folder, now=self.now)

    def test_private_fallback_is_only_written_to_backup(self):
        public = self.root / "public"
        private = self.root / "private"
        public.mkdir()
        private.mkdir()
        (private / "removed.jpg").write_bytes(b"private photo")
        target = self.root / "private-copy.zip"
        pack_media(target, public, ["removed.jpg"], fallback_root=private)
        self.assertFalse((public / "removed.jpg").exists())
        with ZipFile(target) as archive:
            self.assertEqual(archive.read("removed.jpg"), b"private photo")
