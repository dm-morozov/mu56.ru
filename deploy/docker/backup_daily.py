"""Bounded Docker backups: daily database, three changed-media generations."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
from uuid import uuid4
from zipfile import ZipFile, ZIP_DEFLATED

PROJECT = Path('/srv/projects/mu56')
ROOT = PROJECT / 'backup-v2'
BUDGET = 1024**3
MIN_FREE = 2 * 1024**3
NAME = re.compile(r'\d{8}T\d{6}Z_[0-9a-f]{8}')
COMPOSE = ['docker', 'compose', '-f', str(PROJECT / 'compose.yml')]
SNAPSHOT_CODE = '''
import django,json,sys
from psycopg import sql
django.setup()
from django.db import connection,transaction
with transaction.atomic():
 with connection.cursor() as c:
  c.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
  c.execute('SELECT pg_export_snapshot()');snapshot=c.fetchone()[0]
  c.execute('SELECT pg_database_size(current_database())');db_bytes=c.fetchone()[0]
  c.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");tables=c.fetchall()
  counts={}
  for (table,) in tables:
   c.execute(sql.SQL('SELECT count(*) FROM public.{}').format(sql.Identifier(table)));counts[table]=c.fetchone()[0]
  c.execute('SELECT image FROM catalog_characterphoto');images=[r[0] for r in c.fetchall()]
  print(json.dumps({'snapshot':snapshot,'table_counts':counts,'images':images,'db_bytes':db_bytes}),flush=True)
  if sys.stdin.readline().strip()!='done':raise RuntimeError('Controller interrupted')
'''


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def safe_media(root, name):
    rel = PurePosixPath(name)
    if not name or rel.is_absolute() or any(p in ('', '.', '..') for p in name.split('/')) or '\\' in name or ':' in name:
        raise ValueError('Unsafe media name')
    path = root / name
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError('Media escapes root')
    for parent in (path, *path.parents):
        if parent == root:
            break
        if parent.is_symlink():
            raise ValueError('Media symlinks are not supported')
    if not path.is_file():
        raise ValueError('Referenced media missing')
    return path


def completed(parent, kind):
    bundles = []
    for path in sorted(parent.iterdir()):
        if not NAME.fullmatch(path.name) or path.is_symlink() or not path.is_dir():
            continue
        manifest_path = path / 'manifest.json'
        if manifest_path.is_symlink() or not manifest_path.is_file():
            continue  # Preserve incomplete directories for diagnosis.
        manifest = json.loads(manifest_path.read_text())
        expected = {'database.dump'} if kind == 'database' else {'media.zip'}
        if manifest.get('format') != 'mu56-' + kind + '-v2' or set(manifest.get('files', {})) != expected:
            raise ValueError('Unknown completed bundle; refusing rotation')
        for name, checksum in manifest['files'].items():
            file = path / name
            if file.is_symlink() or digest(file) != checksum:
                raise ValueError('Corrupt bundle; refusing rotation')
        bundles.append((path, manifest))
    return bundles


def rotation_candidates(parent, kind, now):
    bundles = completed(parent, kind)
    keep = 90 if kind == 'database' else 3
    expired = bundles[:-keep]
    if kind == 'database':
        expired += [(p, m) for p, m in bundles[-keep:-1]
                    if datetime.fromisoformat(m['created_at_utc']) < now - timedelta(days=90)]
    return list(dict.fromkeys(p for p, _ in expired))


def rotate(parent, kind, now):
    removed = 0
    for path in rotation_candidates(parent, kind, now):
        # Every recursive delete is confined to an exact verified bundle directory.
        if path.is_symlink() or path.resolve().parent != parent.resolve() or not NAME.fullmatch(path.name):
            raise ValueError('Unsafe rotation target')
        shutil.rmtree(path)
        removed += 1
    return removed


def folder_bytes(root):
    return sum(p.stat().st_size for p in root.rglob('*') if p.is_file())


def main():
    os.umask(0o077)
    if ROOT.is_symlink():
        raise ValueError('Backup root must not be a symlink')
    ROOT.mkdir(mode=0o700, exist_ok=True)
    parents = {kind: ROOT / kind for kind in ('database', 'media')}
    for parent in parents.values():
        if parent.is_symlink():
            raise ValueError('Backup parent must not be a symlink')
        parent.mkdir(mode=0o700, exist_ok=True)
    if shutil.disk_usage(ROOT).free < MIN_FREE:
        raise RuntimeError('Less than 2 GiB free; backup stopped')
    media = Path(subprocess.check_output(['docker', 'volume', 'inspect', 'mu56_media', '--format', '{{.Mountpoint}}'], text=True).strip())
    holder = subprocess.Popen(COMPOSE + ['exec', '-T', 'backend', 'python', '-c', SNAPSHOT_CODE], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        line = holder.stdout.readline()
        if not line:
            raise RuntimeError('Database snapshot unavailable')
        snapshot = json.loads(line)
        now = datetime.now(timezone.utc)
        stamp = now.strftime('%Y%m%dT%H%M%SZ') + '_' + uuid4().hex[:8]
        names = {p.relative_to(media).as_posix() for p in media.rglob('*') if p.is_file()} | set(snapshot['images'])
        sources = {name: safe_media(media, name) for name in names}
        checksums = {name: digest(path) for name, path in sources.items()}
        previous = completed(parents['media'], 'media')
        changed = not previous or previous[-1][1]['media'] != checksums
        estimate = 2 * snapshot['db_bytes'] + (sum(p.stat().st_size for p in sources.values()) if changed else 0)
        used_before = folder_bytes(ROOT)
        if used_before + estimate > BUDGET or shutil.disk_usage(ROOT).free < MIN_FREE + estimate:
            raise RuntimeError('Storage budget insufficient; old backups preserved')
        target = parents['database'] / stamp
        target.mkdir(mode=0o700)
        with (target / 'database.dump').open('xb') as output:
            result = subprocess.run(COMPOSE + ['exec', '-T', 'database', 'pg_dump', '-U', 'bootstrap', '-d', 'mu56', '-Fc', '--no-owner', '--no-acl', '--snapshot', snapshot['snapshot']], stdout=output, stderr=subprocess.PIPE, timeout=900)
        if result.returncode:
            raise RuntimeError('pg_dump failed; incomplete directory preserved')
        media_id = stamp if changed else previous[-1][0].name
        if changed:
            media_target = parents['media'] / stamp
            media_target.mkdir(mode=0o700)
            with ZipFile(media_target / 'media.zip', 'x', ZIP_DEFLATED) as archive:
                for name, path in sorted(sources.items()):
                    archive.write(path, name)
            with ZipFile(media_target / 'media.zip') as archive:
                if set(archive.namelist()) != set(checksums):
                    raise ValueError('Archive file list differs')
                for name, checksum in checksums.items():
                    with archive.open(name) as stream:
                        if hashlib.file_digest(stream, 'sha256').hexdigest() != checksum:
                            raise ValueError('Media changed during backup')
            photo_manifest = {'format': 'mu56-media-v2', 'created_at_utc': now.isoformat(), 'media': checksums, 'files': {'media.zip': digest(media_target / 'media.zip')}}
            (media_target / 'manifest.json').write_text(json.dumps(photo_manifest, indent=2))
        holder.stdin.write('done\n')
        holder.stdin.flush()
        if holder.wait(timeout=30):
            raise RuntimeError('Snapshot transaction failed')
        if folder_bytes(ROOT) > BUDGET or shutil.disk_usage(ROOT).free < MIN_FREE:
            raise RuntimeError('Budget exceeded; rotation not performed')
        manifest = {'format': 'mu56-database-v2', 'created_at_utc': now.isoformat(), 'contains_private_data': True, 'table_counts': snapshot['table_counts'], 'media_snapshot': media_id, 'files': {'database.dump': digest(target / 'database.dump')}, 'database_consistency': 'exported_repeatable_read_snapshot', 'restore_verified': False}
        (target / 'release.json').write_bytes((PROJECT / 'release.json').read_bytes())
        (target / 'manifest.json').write_text(json.dumps(manifest, indent=2))
        removed = {kind: rotate(parent, kind, now) for kind, parent in parents.items()}
        previous_db_size = None
        db_bundles = completed(parents['database'], 'database')
        if len(db_bundles) > 1:
            previous_db_size = (db_bundles[-2][0] / 'database.dump').stat().st_size
        report = {'database_backup': str(target), 'database_dump_bytes': (target / 'database.dump').stat().st_size, 'previous_dump_bytes': previous_db_size, 'media_snapshot': media_id, 'media_changed': changed, 'media_files': len(checksums), 'total_backup_bytes': folder_bytes(ROOT), 'removed': removed}
        (ROOT / 'last-success.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report), flush=True)
    finally:
        if holder.poll() is None:
            holder.terminate()
            holder.wait(timeout=10)


if __name__ == '__main__':
    main()
