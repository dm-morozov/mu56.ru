"""Restore a checked private bundle into a new local database, never the VPS."""
import argparse,json,os
from pathlib import Path
import shutil,subprocess,sys
from uuid import uuid4
from zipfile import ZipFile

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from catalog.archives import digest,media_path,verify_media
import psycopg
from psycopg import sql

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('bundle',type=Path)
parser.add_argument('--media-dir',type=Path)
args=parser.parse_args()
if (os.environ.get('PGHOST'),os.environ.get('PGPORT'),os.environ.get('PGUSER'))!=('127.0.0.1','55456','mu56_dev'):
 parser.error('Load dev_postgres.ps1 Load: only the dedicated local PostgreSQL is allowed')
backup=args.bundle.resolve()
manifest=json.loads((backup/'manifest.json').read_text(encoding='utf-8'))
format_name=manifest.get('format')
if format_name=='mu56-backup-v1':
 if manifest.get('archives_verified') is not True or set(manifest.get('files',{}))!={'database.dump','media.zip'}:raise ValueError('Invalid backup')
 photo_bundle=backup;photo_manifest=manifest
elif format_name=='mu56-database-v2':
 if set(manifest.get('files',{}))!={'database.dump'}:raise ValueError('Invalid database backup')
 media_id=manifest.get('media_snapshot','')
 import re
 if not re.fullmatch(r'\d{8}T\d{6}Z_[0-9a-f]{8}',media_id):raise ValueError('Unsafe media snapshot')
 photo_bundle=(args.media_dir or backup.parent.parent/'media')/media_id
 photo_manifest=json.loads((photo_bundle/'manifest.json').read_text()) if photo_bundle.is_dir() else None
 if photo_manifest is not None:
  if photo_manifest.get('format')!='mu56-media-v2' or set(photo_manifest.get('files',{}))!={'media.zip'}:raise ValueError('Invalid media backup')
  if (photo_bundle/'media.zip').is_symlink() or digest(photo_bundle/'media.zip')!=photo_manifest['files']['media.zip']:raise ValueError('Photo archive differs')
else:raise ValueError('Unsupported backup format')
for name,checksum in manifest['files'].items():
 if (backup/name).is_symlink() or digest(backup/name)!=checksum:raise ValueError('Backup checksum differs')
if photo_manifest is not None:verify_media(photo_bundle/'media.zip',photo_manifest['media'])
pg=Path(r'C:\Program Files\PostgreSQL\18\bin')
restored='mu56_restore_'+uuid4().hex[:12]
output=ROOT/'.local'/('vps-restore-'+restored)
output.mkdir(parents=True,exist_ok=False)

def run(tool,*arguments):
 result=subprocess.run([str(pg/(tool+'.exe')),'-w',*map(str,arguments)],capture_output=True,timeout=900)
 if result.returncode:raise RuntimeError(tool+' failed; verification not complete')

run('createdb',restored)
run('pg_restore','--exit-on-error','--no-owner','--no-acl','-d',restored,backup/'database.dump')
with psycopg.connect(dbname=restored,connect_timeout=10) as connection:
 tables=connection.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").fetchall()
 counts={name:connection.execute(sql.SQL('SELECT count(*) FROM public.{}').format(sql.Identifier(name))).fetchone()[0] for (name,) in tables}
 if counts!=manifest['table_counts']:raise ValueError('Restored table counts differ from the snapshot')
private=output/'private-media'
if photo_manifest is not None:
 with ZipFile(photo_bundle/'media.zip') as archive:
  for name,checksum in photo_manifest['media'].items():
   target=media_path(private,name);target.parent.mkdir(parents=True,exist_ok=True)
   with archive.open(name) as source,target.open('xb') as destination:
    shutil.copyfileobj(source,destination)
   if digest(target)!=checksum:raise ValueError('Restored photo differs')
report={'verified':True,'backup':str(backup),'restored_database':restored,'table_count':len(counts),'table_counts_match':True,'media_files':len(photo_manifest['media']) if photo_manifest else 0,'media_checksums_match':photo_manifest is not None,'worker_started':False,'production_database_changed':False,'scope':'Schema restoration, row counts and media hashes; not a full application acceptance test'}
(output/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({**report,'report':str(output/'verification.json')}),flush=True)
