"""Read-only identity audit. A legacy landmark alias is not a mounted aircraft."""
from pathlib import Path
import hashlib,json,struct,math
root=Path(__file__).resolve().parents[2]
glb=root/'godot/assets/world-source/original-world-v1.glb'
b=glb.read_bytes(); length=struct.unpack_from('<I',b,12)[0]; doc=json.loads(b[20:20+length]); nodes=doc['nodes']
manifest=json.loads((root/'godot/data/original-world-manifest.json').read_text())
landmark=manifest['landmarks']['tripleGateScoutAircraft']; squad_id=landmark['node']; squad=nodes[squad_id]
assert squad['name']=='crystal-scout-defense-squad'
parents={child:i for i,node in enumerate(nodes) for child in node.get('children',[])}
instances=[]
for i,n in enumerate(nodes):
    if n.get('name')!='triple-gate-scout-aircraft':continue
    parent=parents.get(i); matrix=n['matrix']; scales=[math.sqrt(sum(matrix[j*4+k]**2 for k in range(3))) for j in range(3)]
    assert parent==squad_id and all(abs(v-.72)<1e-8 for v in scales)
    descendants=[];todo=[i]
    while todo:
        at=todo.pop();descendants.append(at);todo.extend(nodes[at].get('children',[]))
    instances.append({'id':f'scoutDefense:{squad["children"].index(i)}','gltfNode':i,'sourcePath':n['extras']['sourcePath'],'parentGltfNode':parent,'parentSourcePath':squad['extras']['sourcePath'],'localMatrix':matrix,'scale':scales,'visibleCaptureDescendantNodes':len(descendants),'visibleCaptureMeshNodes':sum('mesh' in nodes[x] for x in descendants),'role':'fleetWhenAnchorAvailableElseCityGateDefense' if squad['children'].index(i)<3 else 'cityGateDefense','identityEvidence':'messengerIsland.js:381-402; scoutDefense.js:605-613'})
assert len(instances)==5
sources=['src/scenes/messengerIsland.js','src/world/scoutDefense.js','src/world/planetV8/tripleGateScout.js','src/scenes/messenger/updateIsland.js']
report={'schema':'TigerMessenger.scout-placement.v1','worldGlbSha256':hashlib.sha256(b).hexdigest(),'legacyLandmark':'tripleGateScoutAircraft','actualLandmarkKind':squad['name'],'parentMatrix':squad['matrix'],'instances':instances,'mountedGateScoutInstances':0,'candidateReplacementEnabled':False,'worldIntegrated':False,'reason':'Current production creates a five-aircraft defense squad. mountTripleGateScoutAircraft is defined but not called by production; no unique mounted instance exists in this capture. Do not replace a defense variant by landmark name or configure mounted hover on it.','sources':{s:hashlib.sha256((root/s).read_bytes()).hexdigest() for s in sources},'limitations':['Capture is a visible static snapshot, not a patrol home-position manifest.','Four capture instances contain fewer descendants, consistent with runtime visibility/LOD; no inference that their missing anchors never exist in Web.','Piloting, fleet movement and war targeting remain unported.']}
out=root/'godot/data/scout-placement-audit.json';out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'instances':len(instances),'mounted':0,'output':str(out)}))
