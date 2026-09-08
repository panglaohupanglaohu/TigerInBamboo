"""Build the stable global asset registry without inventing world placements.
Re-running preserves placementRefs and explicit replacement pointers.
"""
import hashlib, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'godot/data/asset-registry.json'
def read(path,default=None):
 p=ROOT/path
 return json.loads(p.read_text()) if p.exists() else default
old={r['id']:r for r in read('godot/data/asset-registry.json',{}).get('assets',[])}
supp={r['id']:r for r in read('assets/models/originals/supplemental/catalog.json',{}).get('entries',[])}
verification=read('artifacts/supplemental-import/godot-registry-verification.json',{})
verified={r['id']:r for r in verification.get('results',[]) if r.get('passed')}
inventory=read('assets/models/inventory.json',{}).get('sources',[])
# Resolve actual named imports, including build* and SWAMP_COMPONENT_BUILDERS;
# the older geometry inventory does not index every compatibility re-export.
catalog_path=ROOT/'src/core/buildingCatalog.js'
factory_imports={}
for names,path in re.findall(r'import\s*\{([^}]+)\}\s*from\s*[\"\']([^\"\']+)[\"\']',catalog_path.read_text(),re.S):
 resolved=(catalog_path.parent/path.split('?')[0]).resolve()
 if not resolved.is_relative_to(ROOT) or not resolved.exists():continue
 for binding in names.split(','):
  symbol=binding.strip().split(' as ')[-1].strip()
  if symbol:factory_imports[symbol]=str(resolved.relative_to(ROOT))

assets=[];seen=set()
for name in ['originals','supplemental']:
 manifest=read(f'godot/assets/{name}/import-map.json',{})
 reports={r['id']:r for r in read(f'godot/assets/{name}/export-report.json',{}).get('results',[])}
 for row in manifest.get('assets',[]):
  aid=row['id']
  if aid in seen:raise ValueError('Duplicate stable asset id: '+aid)
  seen.add(aid);source=read(row['sourceSnapshot']['path'],{});provenance=source.get('provenance',{});extra=supp.get(aid,{})
  factory=extra.get('factory',provenance.get('factory',''))
  symbols=set(re.findall(r'\b[A-Za-z_][A-Za-z0-9_]*',factory))
  source_files=[extra['source']] if extra.get('source') else sorted({s.get('canonicalSource',s.get('originalSource')) for s in inventory if symbols.intersection(s.get('exports',[]))} | {factory_imports[symbol] for symbol in symbols if symbol in factory_imports})
  resource=row['godot']['res'];report=reports.get(aid,{})
  previous=old.get(aid,{})
  current=previous.get('currentResource',{'res':resource,'revision':'original-archive','role':'review source; world placement not implied'})
  if aid=='bookshop' and not previous:
   current={'res':'res://assets/art-pilots/bookshop-art-v3.glb','revision':'bookshop-art-v3','blend':'assets/models/optimized/bookshop-art-v3.blend','role':'existing bookshop pilot in current world.gd; not whole-world acceptance','evidence':['godot/scripts/world.gd','artifacts/bookshop-integration/','artifacts/bookshop-materials/']}
  actual=verified.get(aid,{})
  imported=actual.get('resource')==resource and actual.get('passed',False) and actual.get('sha256')==hashlib.sha256((ROOT/row['godot']['file']).read_bytes()).hexdigest()
  assets.append({'id':aid,'stableId':'tiger:'+aid,'label':row.get('label',aid),'catalog':name,'family':extra.get('family',row.get('family',aid)),'variant':extra.get('variant'),'relationship':extra.get('relationship',row.get('relationship','original catalog entry; may represent one object or a compound scene')),'source':{'factory':factory,'files':source_files,'snapshot':row['sourceSnapshot']['path'],'blend':row['exportSource']['path'],'runtimeSource':extra.get('runtimeSource'),'seed':provenance.get('seed')},'archiveResource':resource,'currentResource':current,'replacement':previous.get('replacement',{'candidateResource':None,'status':'none','requiredChecks':['source identity and all child attachments','same-camera visual review','animation and hidden equipment','collision and gameplay in original placement'],'history':[]}),'placementRefs':previous.get('placementRefs',[]),'stages':{'captured':bool(source),'blenderArchived':(ROOT/row['exportSource']['path']).exists(),'glbExported':(ROOT/row['godot']['file']).exists(),'godotInstantiated':imported,'artOptimized':previous.get('stages',{}).get('artOptimized',aid=='bookshop') is True or aid=='bookshop','worldIntegrated':previous.get('stages',{}).get('worldIntegrated',aid=='bookshop') is True or aid=='bookshop','gameplayAccepted':previous.get('stages',{}).get('gameplayAccepted',False)},'evidence':{'exportReport':f'godot/assets/{name}/export-report.json','godotInstantiation':'artifacts/supplemental-import/godot-registry-verification.json' if imported else None},'knownGaps':row.get('knownGaps',[]),'exportStatus':report.get('status','pending')})
DEST.parent.mkdir(parents=True,exist_ok=True)
DEST.write_text(json.dumps({'version':1,'generatedBy':'tools/build_godot_asset_registry.py','scope':'Unified original asset/configuration library; not a placement manifest or world reconstruction','counts':{'entries':len(assets),'originalCatalog':sum(r['catalog']=='originals' for r in assets),'supplementalConfigurations':sum(r['catalog']=='supplemental' for r in assets),'godotInstantiated':sum(r['stages']['godotInstantiated'] for r in assets)},'rules':['stableId persists across optimized revisions','variants and nested scene contents are not independent new designs','placementRefs stay empty until actual original-world mappings are captured','currentResource and replacement are registry pointers; runtime consumers must explicitly resolve them','art optimization, engine import and playable world integration are separate stages'],'assets':assets},ensure_ascii=False,indent=2))
print('ASSET_REGISTRY',len(assets),'Godot instantiated',sum(r['stages']['godotInstantiated'] for r in assets))
