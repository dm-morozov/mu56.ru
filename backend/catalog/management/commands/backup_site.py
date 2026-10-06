"""Full private data backup. Restoration is an independent operator procedure."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import shutil
import subprocess
from uuid import uuid4

import psycopg
from psycopg import sql
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from catalog.archives import digest, pack_media


class Command(BaseCommand):
    help = "Create a PostgreSQL snapshot dump and checked full media archive. Contains private client data."

    def add_arguments(self, parser):
        parser.add_argument("destination", type=Path, help="Private backup parent directory.")
        parser.add_argument("--pg-bin", type=Path, help="Optional PostgreSQL binaries directory.")
        parser.add_argument("--archived-media-root", type=Path,
                            help="Optional private archive for referenced media removed from the public site.")

    def handle(self, destination, pg_bin=None, archived_media_root=None, **options):
        db = settings.DATABASES["default"]
        if db["ENGINE"] != "django.db.backends.postgresql":
            raise CommandError("PostgreSQL is required.")
        executable = str(pg_bin / ("pg_dump.exe" if os.name == "nt" else "pg_dump")) if pg_bin else shutil.which("pg_dump")
        if not executable or not Path(executable).is_file():
            raise CommandError("Install PostgreSQL client tools or supply --pg-bin.")
        root = destination.resolve()
        if root.is_relative_to(Path(settings.MEDIA_ROOT).resolve()) or root.is_relative_to(Path(settings.STATIC_ROOT).resolve()):
            raise CommandError("Backups must be outside public media and static directories.")
        target = root / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "_" + uuid4().hex[:8])
        target.mkdir(parents=True, mode=0o700)
        env = os.environ.copy()
        for key, value in {"PGDATABASE": db["NAME"], "PGUSER": db["USER"], "PGPASSWORD": db["PASSWORD"], "PGHOST": db["HOST"], "PGPORT": db["PORT"]}.items():
            env[key] = str(value)
        env["PGCONNECT_TIMEOUT"] = "10"
        self.stdout.write("Creating private database snapshot...")
        with psycopg.connect(dbname=db["NAME"], user=db["USER"], password=db["PASSWORD"], host=db["HOST"], port=db["PORT"], connect_timeout=10) as database:
            database.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
            snapshot = database.execute("SELECT pg_export_snapshot()").fetchone()[0]
            try:
                subprocess.run([executable, "-w", "-Fc", "--no-owner", "--no-acl", "--snapshot", snapshot, "-f", str(target / "database.dump")], env=env, check=True, capture_output=True, timeout=900)
            except (subprocess.SubprocessError, OSError) as error:
                raise CommandError("pg_dump failed. Incomplete directory is not a backup.") from error
            tables = database.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").fetchall()
            counts = {name: database.execute(sql.SQL("SELECT count(*) FROM public.{}").format(sql.Identifier(name))).fetchone()[0] for (name,) in tables}
            referenced = [name for (name,) in database.execute("SELECT image FROM catalog_characterphoto")]
            media_root = Path(settings.MEDIA_ROOT).resolve()
            names = {path.relative_to(media_root).as_posix() for path in media_root.rglob("*") if path.is_file()}
            names.update(referenced)
            media = pack_media(target / "media.zip", media_root, names,
                               fallback_root=archived_media_root)
        manifest = {
            "format": "mu56-backup-v1", "created_at_utc": datetime.now(timezone.utc).isoformat(),
            "contains_private_data": True, "database_consistency": "exported_repeatable_read_snapshot",
            "table_counts": counts, "media": media,
            "files": {name: digest(target / name) for name in ("database.dump", "media.zip")},
            "archives_verified": True, "restore_verified": False,
            "code_and_secrets_included": False,
            "private_archived_media_used": archived_media_root is not None,
        }
        (target / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Data backup complete: {target}. Restore drill still required."))
