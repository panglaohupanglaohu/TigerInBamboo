"""Read-only triangle intersection sweep of the current Blender boarding candidate."""
import bpy,json,math,hashlib,importlib.util,sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
P=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('ship',P/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
source=P/'assets/models/optimized/citadel-boarding-r04/citadel-boarding-r04-wide.blend'
digest=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
ids={s.ident(o):o for o in bpy.context.scene.objects if s.ident(o)}
for o in ids.values():o.animation_data_clear()
assembly=json.loads((P/'assets/models/optimized/warship-battle-v11/warship-battle-v11.assembly.json').read_text())
candidate=json.loads((P/'godot/data/citadel-boarding-r04-wide-candidate.json').read_text())['landing']
candidate['widthAdjustment']=json.loads((P/'assets/models/optimized/citadel-boarding-r04/wide-transforms.json').read_text())
hinge=ids['add:boarding-hinge'];board=set(hinge.children_recursive)
upright='--upright' in sys.argv
bake='--bake' in sys.argv
if bake and not upright:raise ValueError('Only the audited upright candidate may be baked')
anchor=s.mat(assembly['poseFrames'][210]['transforms']['add:boarding-hinge']).translation.copy()
def visible(o):
 while o:
  if o.get('candidateHidden') or o.get('candidate_hidden_source_geometry') or o.get('three_visible') is False:return False
  o=o.parent
 return True
meshes=[o for o in ids.values() if o.type=='MESH' and visible(o)]
def geometry(o):
 vertices=[o.matrix_world@v.co for v in o.data.vertices]
 lo=Vector([min(v[k] for v in vertices) for k in range(3)]);hi=Vector([max(v[k] for v in vertices) for k in range(3)])
 return BVHTree.FromPolygons(vertices,[list(p.vertices) for p in o.data.polygons]),lo,hi
hits=[];frames=[]
for index in range(31):
 t=index/30
 for key,values in assembly['poseFrames'][180+index]['transforms'].items():
  if key in ids:s.setm(ids[key],s.mat(values))
 for change in candidate['widthAdjustment']['changes']:s.setm(ids[change['id']],s.mat(change['matrix']))
 m=s.local(hinge);e=m.to_euler('XYZ');u=max(0,min(1,(t-.8)/.2));ease=u*u*(3-2*u)
 e.x+=(math.radians(candidate['degrees'])-.12)*ease
 if upright:
  progress=t*t*(3-2*t)
  s.setm(hinge,Matrix.Translation(anchor)@Matrix.Rotation(-math.pi/2+(math.radians(candidate['degrees'])+math.pi/2)*progress,4,'X')@Matrix.Rotation(candidate['roll']*progress,4,'Z'))
 else:s.setm(hinge,Matrix.Translation(m.translation)@e.to_matrix().to_4x4()@Matrix.Rotation(candidate['roll']*ease,4,'Z'))
 bpy.context.view_layer.update()
 obstacles=[(o,*geometry(o)) for o in meshes if o not in board]
 count=0
 for obj in board:
  if obj.type!='MESH' or not visible(obj):continue
  bv,lo,hi=geometry(obj)
  for other,obv,olo,ohi in obstacles:
   if any(hi[k]<olo[k] or lo[k]>ohi[k] for k in range(3)):continue
   pairs=bv.overlap(obv)
   if pairs:
    count+=1;hits.append({'progress':t,'board':s.ident(obj),'obstacle':s.ident(other),'name':other.name,'trianglePairs':len(pairs)})
 frames.append({'progress':t,'intersectingPairs':count,'hingeMatrix':s.flat(s.local(hinge))})
 if bake:
  for key in set(assembly['poseFrames'][180+index]['transforms'])|{'add:boarding-hinge'}:
   if key in ids:
    for field in ['location','rotation_euler','scale']:ids[key].keyframe_insert(field,frame=index+1)
 print('MOTION',index,count,flush=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
report={'source':str(source.relative_to(P)),'sha256':digest,'frames':frames,'hits':hits,'passed':not hits,'scope':'31 sampled deployment poses against original ship and saved shore candidate pieces; triangle intersections include attachment contacts. Not continuous collision proof, external harbor sweep or full retract lifecycle.'}
report['trajectory']='fixed-hinge-upright-lowering-candidate' if upright else 'original-v11-runtime'
if bake and not hits:
 sc=bpy.context.scene;sc.frame_start=1;sc.frame_end=31;sc.render.fps=30
 destination=source.with_name('citadel-boarding-r04-motion.blend')
 bpy.ops.wm.save_as_mainfile(filepath=str(destination))
 report['bakedCandidate']=str(destination.relative_to(P))
(P/('artifacts/pipeline/citadel-master-terrain/surroundings-r04-motion'+('-upright' if upright else '')+'.json')).write_text(json.dumps(report,indent=2))
print('RESULT',len(hits),flush=True)
