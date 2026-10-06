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
args=parser.parse_args()
if (os.environ.get('PGHOST'),os.environ.get('PGPORT'),os.environ.get('PGUSER'))!=('127.0.0.1','55456','mu56_dev'):
 parser.error('Load dev_postgres.ps1 Load: only the dedicated local PostgreSQL is allowed')
backup=args.bundle.resolve()
manifest=json.loads((backup/'manifest.json').read_text(encoding='utf-8'))
if manifest.get('format')!='mu56-backup-v1' or manifest.get('archives_verified') is not True or set(manifest.get('files',{}))!={'database.dump','media.zip'}:
 raise ValueError('Invalid or incomplete backup')
for name,checksum in manifest['files'].items():
 if (backup/name).is_symlink() or digest(backup/name)!=checksum:raise ValueError('Backup checksum differs')
verify_media(backup/'media.zip',manifest['media'])
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
with ZipFile(backup/'media.zip') as archive:
 for name,checksum in manifest['media'].items():
  target=media_path(private,name);target.parent.mkdir(parents=True,exist_ok=True)
  with archive.open(name) as source,target.open('xb') as destination:
   shutil.copyfileobj(source,destination)
  if digest(target)!=checksum:raise ValueError('Restored photo differs')
report={'verified':True,'backup':str(backup),'restored_database':restored,'table_count':len(counts),'table_counts_match':True,'media_files':len(manifest['media']),'media_checksums_match':True,'worker_started':False,'production_database_changed':False,'scope':'Schema restoration, row counts and media hashes; not a full application acceptance test'}
(output/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({**report,'report':str(output/'verification.json')}),flush=True)
