"""Root-run Docker backup controller. Never reads or transfers credentials."""
from datetime import datetime,timezone
import hashlib,json,os,shutil
from pathlib import Path,PurePosixPath
import subprocess
from uuid import uuid4
from zipfile import ZipFile,ZIP_DEFLATED

PROJECT=Path('/srv/projects/mu56')
MEDIA=Path(subprocess.check_output(['docker','volume','inspect','mu56_media','--format','{{.Mountpoint}}'],text=True).strip())
PARENT=PROJECT/'backups'
PARENT.mkdir(mode=0o700,exist_ok=True)
if shutil.disk_usage(PARENT).free < 2 * 1024**3:
 raise RuntimeError('Less than 2 GiB free: refusing to start backup')
os.umask(0o077)
TARGET=PARENT/(datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'_'+uuid4().hex[:8])
TARGET.mkdir(mode=0o700)
COMPOSE=['docker','compose','-f',str(PROJECT/'compose.yml')]
SNAPSHOT_CODE='''
import django,json,sys
from psycopg import sql
django.setup()
from django.db import connection
from django.db import transaction
with transaction.atomic():
 with connection.cursor() as c:
  c.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
  c.execute('SELECT pg_export_snapshot()');snapshot=c.fetchone()[0]
  c.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");tables=c.fetchall()
  counts={}
  for (table,) in tables:
   c.execute(sql.SQL('SELECT count(*) FROM public.{}').format(sql.Identifier(table)));counts[table]=c.fetchone()[0]
  c.execute('SELECT image FROM catalog_characterphoto');images=[r[0] for r in c.fetchall()]
  print(json.dumps({'snapshot':snapshot,'table_counts':counts,'images':images}),flush=True)
  if sys.stdin.readline().strip()!='done': raise RuntimeError('Backup controller interrupted')
'''

def digest(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

holder=subprocess.Popen(COMPOSE+['exec','-T','backend','python','-c',SNAPSHOT_CODE],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
try:
 line=holder.stdout.readline()
 if not line: raise RuntimeError('Could not export database snapshot')
 snapshot=json.loads(line)
 with (TARGET/'database.dump').open('wb') as output:
  result=subprocess.run(COMPOSE+['exec','-T','database','pg_dump','-U','bootstrap','-d','mu56','-Fc','--no-owner','--no-acl','--snapshot',snapshot['snapshot']],stdout=output,stderr=subprocess.PIPE,timeout=900)
 if result.returncode:raise RuntimeError('pg_dump failed; incomplete backup retained')
 names={p.relative_to(MEDIA).as_posix() for p in MEDIA.rglob('*') if p.is_file()}
 names.update(snapshot['images'])
 checksums={}
 with ZipFile(TARGET/'media.zip','x',ZIP_DEFLATED) as archive:
  for name in sorted(names):
   rel=PurePosixPath(name)
   if rel.is_absolute() or '..' in rel.parts or '\\' in name or ':' in name:raise ValueError('Unsafe media path')
   source=MEDIA/name
   if not source.resolve().is_relative_to(MEDIA.resolve()) or source.is_symlink() or not source.is_file():raise ValueError('Missing or unsafe media')
   checksums[name]=digest(source);archive.write(source,name)
 with ZipFile(TARGET/'media.zip') as archive:
  if set(archive.namelist())!=set(checksums):raise ValueError('Media archive differs')
  for name,checksum in checksums.items():
   with archive.open(name) as f:
    if hashlib.file_digest(f,'sha256').hexdigest()!=checksum:raise ValueError('Media checksum differs')
 holder.stdin.write('done\n');holder.stdin.flush()
 if holder.wait(timeout=30)!=0:raise RuntimeError('Snapshot transaction failed')
 manifest={'format':'mu56-backup-v1','created_at_utc':datetime.now(timezone.utc).isoformat(),'contains_private_data':True,'database_consistency':'exported_repeatable_read_snapshot','table_counts':snapshot['table_counts'],'media':checksums,'files':{name:digest(TARGET/name) for name in ('database.dump','media.zip')},'archives_verified':True,'restore_verified':False,'code_and_secrets_included':False}
 (TARGET/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
 (TARGET/'release.json').write_bytes((PROJECT/'release.json').read_bytes())
 print(json.dumps({'backup':str(TARGET),'tables':len(snapshot['table_counts']),'media':len(checksums),'verified_archives':True,'restore_verified':False}))
finally:
 if holder.poll() is None:holder.terminate();holder.wait(timeout=10)
