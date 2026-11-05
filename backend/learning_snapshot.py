"""Read-only, bounded snapshots with observed file-stability checks.

A producer generation manifest is still needed to prove transactional batch consistency."""
from datetime import datetime,timezone
import hashlib,json,pathlib

FILES=('learn/architecture.js','learn/pipeline.js','learn/data.js','learn/coverage.json','learn/coverage-progress.json','learn/refactoring-status.js','learn/coverage-overrides.json')
OPTIONAL={'learn/refactoring-status.js','learn/coverage-overrides.json'}
LIMIT=2*1024*1024
class SnapshotError(Exception):
 def __init__(self,code,status):self.code,self.status=code,status;super().__init__(code)

def _read(root):
 values={}
 for name in FILES:
  path=root/name
  try:
   path.resolve().relative_to(root.resolve())
   with path.open('rb') as stream:raw=stream.read(LIMIT+1)
  except FileNotFoundError:
   if name in OPTIONAL:continue
   raise SnapshotError('SOURCE_MISSING',503)
  except (ValueError,OSError):raise SnapshotError('SOURCE_UNREADABLE',503)
  if len(raw)>LIMIT:raise SnapshotError('SOURCE_TOO_LARGE',503)
  values[name]=raw
 return values

def learning_snapshot(root,reader=None,attempts=3):
 root=pathlib.Path(root);read=reader or (lambda:_read(root))
 for _ in range(attempts):
  before=read();after=read()
  if before!=after:continue
  try:
   sources={name:raw.decode('utf-8') for name,raw in after.items()}
   coverage=json.loads(sources['learn/coverage.json']);progress=json.loads(sources['learn/coverage-progress.json'])
   if not isinstance(coverage['modules'],list) or not isinstance(coverage['counts'],dict) or not isinstance(progress['completed'],list) or not isinstance(progress['next'],list):raise ValueError()
  except (KeyError,UnicodeError,ValueError,TypeError):raise SnapshotError('SOURCE_INVALID',503)
  manifest=[{'path':name,'sha256':hashlib.sha256(after[name]).hexdigest()} for name in sorted(after)]
  missing=sorted(set(FILES)-set(after));identity={'files':manifest,'missing':missing}
  snapshot_id='sha256:'+hashlib.sha256(json.dumps(identity,sort_keys=True,separators=(',',':')).encode()).hexdigest()
  return {'schemaVersion':1,'snapshotId':snapshot_id,'sourceRoot':'REACodeRefactoring','sourceUpdatedAt':progress.get('updatedAt'),'fetchedAt':datetime.now(timezone.utc).isoformat(),'files':manifest,'missing':missing,'sources':sources}
 raise SnapshotError('SOURCE_CHANGING',409)
