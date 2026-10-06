"""Local-only real database drills. Creates isolated databases; never runs workers."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
os.environ["TELEGRAM_ENABLED"] = "0"

parser = argparse.ArgumentParser()
parser.add_argument("--import-verify", type=Path)
parser.add_argument("--media", type=Path)
args = parser.parse_args()
if os.environ.get("PGHOST") != "127.0.0.1" or os.environ.get("PGPORT") != "55456":
    raise SystemExit("Only the project's local PostgreSQL on 127.0.0.1:55456 is supported.")
if args.import_verify:
    if not os.environ.get("PGDATABASE", "").startswith("mu56_transfer_"):
        raise SystemExit("Import drill requires a dedicated transfer database.")
elif os.environ.get("PGDATABASE") != "mu56":
    raise SystemExit("Load dev_postgres.ps1 Load first.")

import django
django.setup()
from django.core.management import call_command
from django.test import override_settings
from catalog.archives import digest

if args.import_verify:
    with override_settings(MEDIA_ROOT=args.media):
        call_command("migrate", interactive=False, verbosity=0)
        call_command("import_catalog", args.import_verify, replace_migration_defaults=True)
        roundtrip = args.media.parent / "roundtrip"
        call_command("export_catalog", roundtrip)
        if (roundtrip / "catalog.json").read_bytes() != (args.import_verify / "catalog.json").read_bytes():
            raise RuntimeError("Catalog content differs after roundtrip.")
        original = json.loads((args.import_verify / "manifest.json").read_text())
        imported = json.loads((roundtrip / "manifest.json").read_text())
        if imported["media"] != original["media"]:
            raise RuntimeError("Media differs after roundtrip.")
    from leads.models import Lead, TelegramNotification
    from django.contrib.auth import get_user_model
    if Lead.objects.exists() or TelegramNotification.objects.exists() or get_user_model().objects.exists():
        raise RuntimeError("Private operational data was transferred.")
    print("Exact catalog roundtrip verified; no leads, queue or users.", flush=True)
    raise SystemExit(0)

import psycopg
from psycopg import sql

pg = Path(r"C:\Program Files\PostgreSQL\18\bin")
qa = ROOT / ".local" / ("data-transfer-qa-" + uuid4().hex[:10])
qa.mkdir(mode=0o700)
bundle = qa / "catalog"
call_command("export_catalog", bundle)
call_command("backup_site", qa / "backups", pg_bin=pg)
backup = next((qa / "backups").iterdir())
manifest = json.loads((backup / "manifest.json").read_text())
for name, checksum in manifest["files"].items():
    if digest(backup / name) != checksum:
        raise RuntimeError("Backup checksum mismatch.")

def run(tool, *arguments):
    result = subprocess.run([str(pg / (tool + ".exe")), *map(str, arguments)], capture_output=True, timeout=900)
    if result.returncode:
        raise RuntimeError(f"{tool} failed; drill not verified.")

restore_db = "mu56_restore_" + uuid4().hex[:12]
run("createdb", "-w", restore_db)
run("pg_restore", "-w", "--exit-on-error", "--no-owner", "--no-acl", "-d", restore_db, backup / "database.dump")
with psycopg.connect(dbname=restore_db, connect_timeout=10) as database:
    tables = database.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").fetchall()
    counts = {name: database.execute(sql.SQL("SELECT count(*) FROM public.{}").format(sql.Identifier(name))).fetchone()[0] for (name,) in tables}
    if counts != manifest["table_counts"]:
        raise RuntimeError("Restored database counts differ from backup snapshot.")
print(f"Full data backup restored: {len(counts)} tables, matching snapshot counts.", flush=True)

transfer_db = "mu56_transfer_" + uuid4().hex[:12]
run("createdb", "-w", transfer_db)
environment = os.environ.copy()
environment["PGDATABASE"] = transfer_db
subprocess.run([sys.executable, str(Path(__file__).resolve()), "--import-verify", str(bundle), "--media", str(qa / "imported-media")], env=environment, check=True, timeout=900)
report = {"verified": True, "backup": str(backup), "restored_database": restore_db,
          "transferred_database": transfer_db, "table_counts_match": True,
          "catalog_content_exact": True, "media_checksums_match": True,
          "private_data_transferred": False, "worker_started": False}
(qa / "verification.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report), flush=True)
