"""Validate original archive and emit merge-only entries; never rewrite registry/maps."""
import hashlib,json,struct
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'assets/models/originals/leviathan'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def gltf(p):
 with p.open('rb') as f:
  magic,version,total=struct.unpack('<III',f.read(12));n,kind=struct.unpack('<II',f.read(8))
  assert magic==0x46546c67 and version==2 and total==p.stat().st_size and kind==0x4e4f534a
  return json.loads(f.read(n))
snapshot=SRC/'leviathanIsland.source.json';blend=SRC/'blender-r3/leviathanIsland.blend';glb=ROOT/'godot/assets/supplemental/leviathanIsland.glb'
data=json.loads(snapshot.read_text());doc=gltf(glb);visible={};expected=0
for n in data['nodes']:
 visible[n['id']]=n['visible'] and visible.get(n['parent'],True)
 if not visible[n['id']] or n.get('userData',{}).get('isOutline'):continue
 geo=data['geometries'].get(n.get('geometry'))
 if not geo or n['type'] in ['Line','LineLoop','LineSegments','Points']:continue
 length=len(geo['index']) if geo['index'] is not None else len(geo['attributes']['position']['values'])//3
 draw=geo.get('drawRange',{});start=draw.get('start',0);count=draw.get('count')
 count=max(0,length-start) if count is None else min(count,max(0,length-start))
 expected+=count//3*len(n.get('instances',[None]))
actual=sum(doc['accessors'][p.get('indices',p['attributes']['POSITION'])]['count']//3 for n in doc['nodes'] if 'mesh' in n for p in doc['meshes'][n['mesh']]['primitives'] if p.get('mode',4)==4)
assert expected==actual,(expected,actual)
counts=json.loads((SRC/'export-counts.json').read_text());imported=json.loads((SRC/'blender-r3/leviathanIsland.import-report.json').read_text());assert imported['maxLocalVertexError']==0
world=gltf(ROOT/'godot/assets/world-source/original-world-v1.glb');node=world['nodes'][19304];assert node['name']=='leviathanGroup' and node['extras']['sourcePath']=='leviathanGroup[156]'
gaps=['这是原工厂本体、浮岛地台及工厂植被的独立归档，不含saihojiGarden.js运行时装到鲸背的六景；不能直接替换完整鲸背场景根节点。','非swamp_whale；没有改造原作造型或完成美术优化。','原始默认姿态及可见性保留，180个隐藏mesh未强制显示；程序升降、摆尾、眨眼、雨滴和鲸背六景行为未迁移。','Godot GLB已生成，项目统一导入/实例化由主代理执行，当前未确认Godot检视通过。']
report={'id':'leviathanIsland','snapshotSha256':sha(snapshot),'blendSha256':sha(blend),'glbSha256':sha(glb),'expectedTriangles':expected,'exportedTriangles':actual,'triangleMatch':True,'bytes':glb.stat().st_size,'blenderImport':imported,'exportCounts':counts,'godotImported':False,'scope':'original factory archive only; excludes runtime-attached six garden scenes'}
(SRC/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
catalog=json.loads((SRC/'catalog-entry.json').read_text())
catalog['stages'].update(blenderArchived=True,glbExported=True)
catalog['validation']='assets/models/originals/leviathan/validation.json'
(SRC/'catalog-entry.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
rel=lambda p:str(p.relative_to(ROOT))
res='res://assets/supplemental/leviathanIsland.glb'
entry={'id':'leviathanIsland','stableId':'tiger:leviathanIsland','label':'苔庭·太古浮岛白鲸','catalog':'supplemental','family':'leviathanIsland','variant':'factory-default-local','relationship':'original whale/island factory; distinct from swamp_whale; six garden scenes assembled separately at runtime','source':{'factory':'buildEcoLeviathanIsland','files':['src/assets/leviathanIsland.js'],'snapshot':rel(snapshot),'blend':rel(blend),'runtimeSource':'src/scenes/saihojiGarden.js','seed':9901},'archiveResource':res,'currentResource':{'res':res,'revision':'original-archive','role':'independent factory review; not a replacement for the assembled whale-back world'},'replacement':{'candidateResource':None,'status':'not-started','requiredChecks':['six garden scene attachment','original animation and hidden state','world transform and collision','visual review'],'history':[]},'placementRefs':[{'world':'original-world-v1','node':19304,'sourcePath':node['extras']['sourcePath'],'matrix':node['matrix'],'match':'verified original named root, whose runtime subtree additionally contains six garden scenes; no direct replacement authorized by this archive'}],'stages':{'captured':True,'blenderArchived':True,'glbExported':True,'godotInstantiated':False,'artOptimized':False,'worldIntegrated':False,'gameplayAccepted':False},'evidence':{'exportReport':rel(SRC/'validation.json'),'factoryCatalog':rel(SRC/'catalog-entry.json')},'knownGaps':gaps,'exportStatus':'partial'}
(SRC/'registry-entry.json').write_text(json.dumps(entry,ensure_ascii=False,indent=2)+'\n')
row={'id':entry['id'],'label':entry['label'],'family':entry['family'],'relationship':entry['relationship'],'representative':True,'sourceSnapshot':{'path':rel(snapshot),'exists':True,'bytes':snapshot.stat().st_size},'exportSource':{'path':rel(blend),'exists':True,'why':'原工厂归档，未优化，未含鲸背六景'},'godot':{'file':rel(glb),'res':res,'exists':True},'scale':imported,'knownGaps':gaps,'status':'partial'}
(SRC/'import-map-entry.json').write_text(json.dumps(row,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
