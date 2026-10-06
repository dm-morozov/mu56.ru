"""Read-only integrity and freshness checks for backup_site bundles."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import shutil
from zipfile import BadZipFile

from django.core.management.base import CommandError

from catalog.archives import digest, verify_media


def check_latest_backup(root, *, max_age_hours=36, min_free_gib=1, now=None):
    root = Path(root).resolve()
    if max_age_hours <= 0 or min_free_gib < 0:
        raise CommandError("Invalid backup check limits.")
    if not root.is_dir():
        raise CommandError("Backup directory is missing.")
    candidates = sorted(path for path in root.iterdir()
                        if re.fullmatch(r"\d{8}T\d{6}Z_[0-9a-f]{8}", path.name))
    if not candidates:
        raise CommandError("No backup_site bundles found.")
    target = candidates[-1]
    if target.is_symlink() or not target.is_dir():
        raise CommandError("Invalid backup bundle directory.")
    try:
        manifest_path = target / "manifest.json"
        if manifest_path.is_symlink():
            raise CommandError("Backup manifest cannot be a symlink.")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (manifest.get("format") != "mu56-backup-v1"
                or manifest.get("archives_verified") is not True
                or set(manifest.get("files", {})) != {"database.dump", "media.zip"}):
            raise CommandError("Latest backup is incomplete or has an unsupported manifest.")
        created = datetime.fromisoformat(manifest["created_at_utc"])
        now = now or datetime.now(timezone.utc)
        if created.tzinfo is None or created > now + timedelta(minutes=5):
            raise CommandError("Invalid backup timestamp.")
        age = max(0, (now - created).total_seconds() / 3600)
        if age > max_age_hours:
            raise CommandError("Latest backup is too old.")
        for name, checksum in manifest["files"].items():
            source = target / name
            if source.is_symlink() or not source.is_file():
                raise CommandError("Backup archive is missing or is a symlink.")
            if not isinstance(checksum, str) or not re.fullmatch(r"[0-9a-f]{64}", checksum):
                raise CommandError("Invalid archive checksum in manifest.")
            if digest(source) != checksum:
                raise CommandError("Backup archive checksum mismatch.")
        verify_media(target / "media.zip", manifest["media"])
        free = shutil.disk_usage(root).free
        if free < min_free_gib * 1024 ** 3:
            raise CommandError("Backup disk has insufficient free space.")
        return {"result": "passed", "bundle": target.name,
                "age_hours": round(age, 2), "free_gib": round(free / 1024 ** 3, 2),
                "media_files": len(manifest["media"]),
                "restore_verified": manifest.get("restore_verified") is True}
    except (OSError, ValueError, KeyError, TypeError, AttributeError, BadZipFile) as error:
        raise CommandError("Latest backup cannot be read or verified.") from error
