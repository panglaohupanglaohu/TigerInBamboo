"""Temporary-file tests; never writes the real learning library."""
import json,pathlib,sys,tempfile,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]))
from backend.learning_snapshot import learning_snapshot,SnapshotError,FILES,OPTIONAL,LIMIT
class SnapshotTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.tmp.name)
  for name in FILES:
   p=self.root/name;p.parent.mkdir(exist_ok=True);p.write_text('window.X = {};')
  (self.root/'learn/coverage.json').write_text(json.dumps({'modules':[],'counts':{}}))
  (self.root/'learn/coverage-progress.json').write_text(json.dumps({'updatedAt':'2026-11-04','completed':[],'next':[]}))
 def tearDown(self):self.tmp.cleanup()
 def test_identity_stable_and_content_changes(self):
  a=learning_snapshot(self.root);b=learning_snapshot(self.root);self.assertEqual(a['snapshotId'],b['snapshotId']);self.assertEqual(len(a['files']),7)
  (self.root/'learn/data.js').write_text('window.LEARN = {"items": []};');self.assertNotEqual(a['snapshotId'],learning_snapshot(self.root)['snapshotId'])
 def test_changing_source_never_activates(self):
  counter=[0]
  def read():counter[0]+=1;return {'changing':str(counter[0]).encode()}
  with self.assertRaises(SnapshotError) as e:learning_snapshot(self.root,reader=read)
  self.assertEqual(e.exception.status,409)
 def test_missing_optional_and_invalid_core(self):
  for name in OPTIONAL:(self.root/name).unlink()
  self.assertEqual(learning_snapshot(self.root)['missing'],sorted(OPTIONAL))
  (self.root/'learn/coverage.json').write_text('broken')
  with self.assertRaises(SnapshotError):learning_snapshot(self.root)
 def test_missing_core_and_size_limit(self):
  p=self.root/'learn/pipeline.js';p.unlink()
  with self.assertRaises(SnapshotError):learning_snapshot(self.root)
  p.write_bytes(b'x'*(LIMIT+1))
  with self.assertRaises(SnapshotError) as e:learning_snapshot(self.root)
  self.assertEqual(e.exception.code,'SOURCE_TOO_LARGE')
 def test_external_symlink_rejected(self):
  p=self.root/'learn/data.js';p.unlink();p.symlink_to(pathlib.Path(self.tmp.name).parent/'not-in-library')
  with self.assertRaises(SnapshotError) as e:learning_snapshot(self.root)
  self.assertEqual(e.exception.code,'SOURCE_UNREADABLE')
if __name__=='__main__':unittest.main()
