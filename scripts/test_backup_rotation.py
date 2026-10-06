"""Verify destructive rotation boundaries using only temporary directories."""
import importlib.util
import json
from pathlib import Path
import tempfile
from datetime import datetime,timedelta,timezone
import unittest
spec=importlib.util.spec_from_file_location('backup_daily',Path(__file__).resolve().parents[1]/'deploy/docker/backup_daily.py')
backup=importlib.util.module_from_spec(spec);spec.loader.exec_module(backup)

TEST_ROOT=Path(__file__).resolve().parents[1]/'.local/backup-rotation-tests'
TEST_ROOT.mkdir(parents=True,exist_ok=True)

class RotationTests(unittest.TestCase):
 def bundle(self,parent,when,kind):
  path=parent/(when.strftime('%Y%m%dT%H%M%SZ')+'_00000001');path.mkdir()
  name='database.dump' if kind=='database' else 'media.zip';(path/name).write_bytes(b'checked test payload')
  (path/'manifest.json').write_text(json.dumps({'format':'mu56-'+kind+'-v2','created_at_utc':when.isoformat(),'files':{name:backup.digest(path/name)}}))
  return path
 def test_daily_database_keeps_90_and_preserves_incomplete(self):
  with tempfile.TemporaryDirectory(dir=TEST_ROOT) as d:
   root=Path(d);now=datetime.now(timezone.utc).replace(microsecond=0)
   entries=[self.bundle(root,now-timedelta(days=i),'database') for i in range(95)]
   incomplete=root/'20200101T000000Z_ffffffff';incomplete.mkdir()
   self.assertEqual(backup.rotate(root,'database',now),5)
   self.assertTrue(incomplete.exists());self.assertTrue(entries[0].exists());self.assertFalse(entries[-1].exists())
 def test_media_keeps_three_generations(self):
  with tempfile.TemporaryDirectory(dir=TEST_ROOT) as d:
   root=Path(d);now=datetime.now(timezone.utc)
   entries=[self.bundle(root,now-timedelta(days=i),'media') for i in range(5)]
   self.assertEqual(backup.rotate(root,'media',now),2)
   self.assertTrue(entries[0].exists());self.assertFalse(entries[-1].exists())
 def test_corrupt_archive_prevents_any_deletion(self):
  with tempfile.TemporaryDirectory(dir=TEST_ROOT) as d:
   root=Path(d);now=datetime.now(timezone.utc)
   entries=[self.bundle(root,now-timedelta(days=i),'media') for i in range(4)]
   (entries[-1]/'media.zip').write_bytes(b'corrupt')
   with self.assertRaises(ValueError):backup.rotate(root,'media',now)
   self.assertTrue(all(p.exists() for p in entries))
 def test_old_database_removed_but_latest_preserved(self):
  with tempfile.TemporaryDirectory(dir=TEST_ROOT) as d:
   root=Path(d);now=datetime.now(timezone.utc)
   old=self.bundle(root,now-timedelta(days=100),'database');latest=self.bundle(root,now-timedelta(days=99),'database')
   self.assertEqual(backup.rotate(root,'database',now),1)
   self.assertFalse(old.exists());self.assertTrue(latest.exists())
if __name__=='__main__':unittest.main()
