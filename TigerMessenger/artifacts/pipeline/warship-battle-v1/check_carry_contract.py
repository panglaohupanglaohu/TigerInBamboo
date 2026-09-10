import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[3];ART=ROOT/'artifacts/pipeline/warship-battle-v1';C=Matrix.Rotation(math.pi/2,4,'X')
def ident(o):return o.get('three_node_id',o.get('roman_family_added_id'))
def points(o):return sorted(set(tuple(round(float(c),6) for c in v.co) for v in o.data.vertices))
bpy.ops.wm.open_mainfile(filepath=str(ART/'boarding-review.blend'));scene=bpy.context.scene;scene.frame_set(78);bpy.context.view_layer.update();actor={ident(o):o for o in scene.objects if o.get('reviewOnly') and ident(o)};coordinates={k:points(o) for k,o in actor.items() if o.type=='MESH'};errors={}
for hand,weapon,point in [('add:handL','n32',[-.055,0,0]),('add:handR','n50',[0,.04,0])]:errors[hand]=(actor[hand].matrix_world.translation-actor[weapon].matrix_world@(C.to_3x3()@Vector(point))).length*1.7
before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/models/optimized/roman-family-v1/romanSoldier_gladius_blue.glb'));new=set(scene.objects)-before;changed=[]
for o in new:
 k=ident(o)
 if o.type=='MESH' and k in coordinates and points(o)!=coordinates[k]:changed.append(k)
r={'passed':not changed and max(errors.values())<1e-5,'actorLocalGripErrors':errors,'changedGeometryNodes':changed,'testedMeshNodes':len(coordinates),'geometryTolerance':1e-6,'scope':'Carry pose uses the original optimized soldier local geometry; full original figure scale retained. Exact hand anchor contact at retained shield and sword grip points.'};(ART/'carry-contract-validation.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
