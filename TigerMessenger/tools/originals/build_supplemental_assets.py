"""Immutable supplemental Blender archives and GLB staging, max two background workers."""
import concurrent.futures, hashlib, json, os, struct, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/models/originals/supplemental'
OUT=ROOT/'godot/assets/supplemental'
LOGS=ROOT/'artifacts/supplemental-import'
BLENDER=os.environ.get('BLENDER','/Applications/Blender.app/Contents/MacOS/Blender')
CAT=json.loads((SOURCE/'catalog.json').read_text())['entries']
for p in [OUT,LOGS]:p.mkdir(parents=True,exist_ok=True)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def execute(script,args,log):
 p=subprocess.run([BLENDER,'--background','--python-exit-code','1','--python',str(ROOT/'tools/originals'/script),'--',*map(str,args)],capture_output=True,text=True,timeout=600)
 log.write_text(p.stdout+p.stderr)
 if p.returncode:raise RuntimeError((p.stdout+p.stderr)[-1600:])
def validate(snapshot,glb):
 raw=glb.read_bytes();magic,version,total=struct.unpack_from('<III',raw);size,kind=struct.unpack_from('<II',raw,12)
 assert magic==0x46546c67 and version==2 and total==len(raw) and kind==0x4e4f534a
 doc=json.loads(raw[20:20+size]);data=json.loads(snapshot.read_text());expected=0;visible={}
 for n in data['nodes']:
  visible[n['id']]=n['visible'] and visible.get(n['parent'],True)
  if not visible[n['id']] or n.get('userData',{}).get('isOutline'):continue
  geo=data['geometries'].get(n.get('geometry'))
  if not geo or n['type'] in ['Line','LineLoop','LineSegments','Points']:continue
  length=len(geo['index']) if geo['index'] is not None else len(geo['attributes']['position']['values'])//3
  draw=geo.get('drawRange',{});start=draw.get('start',0);count=draw.get('count')
  count=max(0,length-start) if count is None else min(count,max(0,length-start))
  expected+=count//3*len(n.get('instances',[None]))
 triangles=0
 for n in doc.get('nodes',[]):
  if 'mesh' not in n:continue
  for prim in doc['meshes'][n['mesh']]['primitives']:
   if prim.get('mode',4)==4:triangles+=doc['accessors'][prim.get('indices',prim['attributes']['POSITION'])]['count']//3
 result=dict(expectedTriangles=expected,exportedTriangles=triangles,triangleMatch=expected==triangles,images=len(doc.get('images',[])),nodes=len(doc.get('nodes',[])),animationClips=len(doc.get('animations',[])))
 if not result['triangleMatch']:raise RuntimeError('Visible triangle mismatch '+json.dumps(result))
 return result

def build(entry):
 aid=entry['id'];snap=SOURCE/(aid+'.source.json');blend=SOURCE/'blender-r3'/(aid+'.blend');dst=OUT/(aid+'.glb')
 row=dict(id=aid,status='failed',source=str(blend.relative_to(ROOT)),target=str(dst.relative_to(ROOT)),res='res://assets/supplemental/'+aid+'.glb')
 try:
  snapshot_hash=digest(snap)
  if not blend.exists():execute('import_supplemental_blender.py',[aid],LOGS/(aid+'.import.log'))
  if not blend.exists():raise RuntimeError('Blender archive missing')
  before=digest(blend)
  if not dst.exists():
   temp=LOGS/(aid+'.glb');temp.unlink(missing_ok=True)
   execute('export_godot_scene.py',[blend,temp,LOGS/(aid+'.counts.json')],LOGS/(aid+'.export.log'))
   if not temp.exists():raise RuntimeError('GLB export missing')
   validate(snap,temp);temp.replace(dst)
  if before!=digest(blend) or snapshot_hash!=digest(snap):raise RuntimeError('Source changed during export')
  row.update(status='partial',sourceSha256=before,outputSha256=digest(dst),sourceSnapshotSha256=snapshot_hash,bytes=dst.stat().st_size,blenderCounts=json.loads((LOGS/(aid+'.counts.json')).read_text()),validation=validate(snap,dst),blenderImport=json.loads((blend.parent/(aid+'.import-report.json')).read_text()),lost=['原作资源归档；完整场景位置/尺度与交互尚待验证，实际引擎导入证据单独记录','墨线、程序动画、灯光与隐藏装备状态切换需要引擎适配；GLB 只含当前可见状态，完整动态节点保存在源快照与 Blender'])
 except Exception as e:row['reason']=str(e)
 return row
results=[]
def save():
 (OUT/'export-report.json').write_text(json.dumps(dict(generatedBy='tools/originals/build_supplemental_assets.py',counts={k:sum(r['status']==k for r in results) for k in ['partial','failed']},results=results),ensure_ascii=False,indent=2))
 rows=[]
 for entry in CAT:
  aid=entry['id'];snap=SOURCE/(aid+'.source.json');blend=SOURCE/'blender-r3'/(aid+'.blend');dst=OUT/(aid+'.glb');result=next((r for r in results if r['id']==aid),{})
  rows.append(dict(id=aid,label=entry['label'],family=entry.get('family',aid),relationship=entry.get('relationship','standalone original factory'),representative=True,sourceSnapshot=dict(path=str(snap.relative_to(ROOT)),exists=snap.exists(),bytes=snap.stat().st_size),exportSource=dict(path=str(blend.relative_to(ROOT)),exists=blend.exists(),why='原作补充归档，未改造造型'),godot=dict(file=str(dst.relative_to(ROOT)),res='res://assets/supplemental/'+aid+'.glb',exists=dst.exists()),scale=result.get('blenderImport',{}),knownGaps=result.get('lost',['补充原作，导入/场景与动画尚待验证']),status=result.get('status','pending')))
 (OUT/'import-map.json').write_text(json.dumps(dict(version=1,note='补充条目包含涂装/装备变体，不能计为独立新设计；独立模型导出不等于原世界移植',assets=rows),ensure_ascii=False,indent=2))
save()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for future in concurrent.futures.as_completed([pool.submit(build,row) for row in CAT]):
  row=future.result();results.append(row);save();print('SUPPLEMENTAL_EXPORT',row['id'],row['status'],flush=True)
(LOGS/'validation.json').write_text(json.dumps(dict(tested=len(results),failed=[r['id'] for r in results if r['status']=='failed'],results=[dict(id=r['id'],**r.get('validation',{}),sourceUnchanged=r['status']!='failed') for r in results]),ensure_ascii=False,indent=2))
raise SystemExit(any(r['status']=='failed' for r in results))
