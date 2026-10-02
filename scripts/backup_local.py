"""Backup this checkout and verify restoration in a new isolated local database."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
from datetime import datetime, timezone
from uuid import uuid4
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
if os.environ.get("PGHOST") != "127.0.0.1" or os.environ.get("PGPORT") != "55456" or os.environ.get("PGDATABASE") != "mu56":
    raise SystemExit("Load scripts/dev_postgres.ps1 Load first; only local mu56:55456 is supported.")
pg = Path(r"C:\Program Files\PostgreSQL\18\bin")
stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "_" + uuid4().hex[:6]
destination = root / ".local" / "backups" / stamp
destination.mkdir(parents=True, exist_ok=False)


def run(tool, *args):
    return subprocess.run([str(pg / (tool + ".exe")), *map(str, args)], check=True,
                          capture_output=True, text=True, encoding="utf-8").stdout


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def archive(name, paths):
    skipped = {"node_modules", ".next", "__pycache__", ".git", "staticfiles"}
    files = []
    for path in paths:
        for file in path.rglob("*") if path.is_dir() else [path]:
            if not file.is_file() or file.is_symlink():
                continue
            relative = file.relative_to(root)
            if name == "source.zip" and (set(relative.parts) & skipped or relative.parts[:2] == ("backend", "media") or file.name.startswith(".env") and file.name != ".env.example" or file.suffix in {".sqlite3", ".pyc", ".tsbuildinfo"}):
                continue
            files.append(file)
    target = destination / name
    originals = {str(file.relative_to(root)).replace("\\", "/"): digest(file) for file in files}
    with ZipFile(target, "w", ZIP_DEFLATED) as zipped:
        for file in files:
            zipped.write(file, str(file.relative_to(root)).replace("\\", "/"))
    with ZipFile(target) as zipped:
        assert zipped.testzip() is None
        assert all(hashlib.sha256(zipped.read(name)).hexdigest() == checksum for name, checksum in originals.items())
    return originals


dump = destination / "database.dump"
run("pg_dump", "-w", "-Fc", "--no-owner", "--no-acl", "-f", dump, "mu56")
source_files = archive("source.zip", [root / name for name in ["backend", "frontend", "scripts", "docs"]] + list(root.glob("*.md")) + [root / ".gitignore"])
media_files = archive("media.zip", [root / "backend" / "media"])
restore_db = "mu56_restore_" + uuid4().hex[:12]
run("createdb", "-w", restore_db)
run("pg_restore", "-w", "--exit-on-error", "--no-owner", "--no-acl", "-d", restore_db, dump)
tables = run("psql", "-w", "-d", restore_db, "-Atc", "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").splitlines()
counts = {}
for table in tables:
    identifier = '"' + table.replace('"', '""') + '"'
    query = f"SELECT count(*) FROM public.{identifier}"
    live = int(run("psql", "-w", "-d", "mu56", "-Atc", query).strip())
    restored = int(run("psql", "-w", "-d", restore_db, "-Atc", query).strip())
    assert live == restored, "Row counts changed during backup; repeat during quiet period."
    counts[table] = restored
manifest = {"created_at_utc": stamp, "restore_database": restore_db, "source_files": source_files,
            "media_files": media_files, "restored_table_counts": counts,
            "archives": {name: digest(destination / name) for name in ["database.dump", "source.zip", "media.zip"]},
            "verified": True, "secrets_included": False}
(destination / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"backup": str(destination), "restored_database": restore_db, "tables": len(counts),
                  "source_files": len(source_files), "media_files": len(media_files), "verified": True}))
