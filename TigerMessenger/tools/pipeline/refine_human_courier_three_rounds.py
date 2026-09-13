"""Three isolated target-led courier passes; never overwrites the active v1 asset."""
import bpy,ast,json,math,hashlib,sys
from pathlib import Path
from mathutils import Vector,Matrix
from math import sin,cos,pi
BASE=Path(__file__).resolve().parents[2]
SOURCE=BASE/'assets/models/optimized/human-courier-v1/human-courier.blend'
DEST=BASE/'assets/models/optimized/human-courier-refinement'
REVIEW=BASE/'artifacts/pipeline/human-courier-refinement'
DEST.mkdir(exist_ok=True);REVIEW.mkdir(exist_ok=True)
digest=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
code=(BASE/'tools/pipeline/build_human_courier.py').read_text()
C=Matrix.Rotation(pi/2,4,'X');CI=C.inverted()
round_no=int(sys.argv[sys.argv.index('--round')+1])
prior=SOURCE if round_no==1 else DEST/f'round-{round_no-1}'/'human-courier.blend'
bpy.ops.wm.open_mainfile(filepath=str(prior))
bpy.context.view_layer.update()
root=bpy.data.objects['Courier'];body=bpy.data.objects['body'];head=bpy.data.objects['head']
M={m.name:m for m in bpy.data.materials}
tree=ast.parse(code)
for node in tree.body:
 if isinstance(node,ast.FunctionDef) and node.name in ['vec','attach','joint','mesh','rings','orb','bar','box','ribbon']:
  exec(compile(ast.Module(body=[node],type_ignores=[]),'<original-courier-helpers>','exec'))
def world_points(o):return [CI.to_3x3()@(o.matrix_world@v.co) for v in o.data.vertices]
def deform(o,fn):
 points=world_points(o);inv=o.matrix_world.inverted()
 for v,p in zip(o.data.vertices,points):v.co=inv@vec(fn(p))
 o.data.update()
def width():
 points=[p for o in root.children_recursive if o.type=='MESH' and o.name.startswith(('Waistcoat','Shirt_shoulder')) for p in world_points(o) if 1.30<p.y<1.46]
 return max(p.x for p in points)-min(p.x for p in points)
before=width()
if round_no==1:
 def warp(p):
  knots=[(0,1),(1.0,1),(1.15,.95),(1.30,.86),(1.39,.82),(1.46,.88),(1.50,1),(3,1)]
  for (a,sa),(b,sb) in zip(knots,knots[1:]):
   if a<=p.y<=b:return Vector((p.x*(sa+(sb-sa)*(p.y-a)/(b-a)),p.y,p.z))
  return p
 meshes=[o for o in root.children_recursive if o.type=='MESH']
 desired={o:[warp(p) for p in world_points(o)] for o in meshes}
 joints=[o for o in root.children_recursive if o.type=='EMPTY']
 originals={o:o.matrix_world.copy() for o in joints}
 def depth(o):return 0 if not o.parent else 1+depth(o.parent)
 for o in sorted(joints,key=depth):
  m=originals[o];m.translation=vec(warp(CI.to_3x3()@m.translation));o.matrix_world=m;bpy.context.view_layer.update()
 for o,points in desired.items():
  inv=o.matrix_world.inverted()
  for v,p in zip(o.data.vertices,points):v.co=inv@vec(p)
  o.data.update()
 bpy.context.view_layer.update()
elif round_no==2:
 bpy.data.objects.remove(bpy.data.objects['Face'],do_unlink=True)
 rings('Face',[(1.508,0,.023,.046,.047),(1.535,0,.012,.066,.060),(1.568,0,.004,.074,.066),(1.599,0,.001,.080,.072),(1.633,0,-.002,.077,.070),(1.666,0,-.004,.077,.071),(1.708,0,-.008,.070,.069),(1.737,0,-.012,.046,.051)],'skin',head,n=24)
 for o in list(head.children_recursive):
  if o.name.startswith('Eye_socket'):o.scale.z*=.66
  if o.name.startswith('Eye') and not o.name.startswith('Eye_socket'):o.scale.x*=.85;o.scale.z*=.80
  if o.name.startswith(('Jaw_stubble','Chin_stubble')):bpy.data.objects.remove(o,do_unlink=True)
 nose=bpy.data.objects['Nose'];deform(nose,lambda p:Vector((p.x*.9,p.y,.068+(p.z-.068)*.83)))
 for side in [-1,1]:
  bar('Upper_eyelid_'+str(side),(side*.018,1.649,.076),(side*.047,1.648,.073),.0025,'skin_shadow',head,n=8)
  orb('Nostril_wing_'+str(side),(side*.010,1.608,.086),(.0055,.004,.0045),'skin',head)
elif round_no==3:
 for o in list(head.children_recursive):
  if o.name.startswith(('Eye_socket','Upper_eyelid','Moustache','Brow')):bpy.data.objects.remove(o,do_unlink=True)
 for side in [-1,1]:
  mesh('Sculpted_brow_'+str(side),[(side*.012,1.660,.073),(side*.025,1.668,.075),(side*.054,1.665,.064),(side*.048,1.660,.068),(side*.025,1.663,.077)],[(0,1,4),(1,2,3,4)],'hair',head)
  mesh('Moustache_patch_'+str(side),[(side*.002,1.592,.079),(side*.015,1.590,.080),(side*.026,1.581,.073),(side*.009,1.585,.080),(side*.002,1.586,.081)],[(0,1,3,4),(1,2,3)],'beard',head)
  bar('Fine_upper_lid_'+str(side),(side*.019,1.648,.074),(side*.044,1.649,.073),.0015,'skin_shadow',head,n=6)
 face=bpy.data.objects['Face']
 material=M['skin'].copy();material.name='Soft_beard_stubble'
 color=(.29,.185,.117,1);material.diffuse_color=color;material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=color
 M[material.name]=material;face.data.materials.append(material)
 for polygon in face.data.polygons:
  p=CI.to_3x3()@(face.matrix_world@polygon.center)
  if p.y<1.574 and p.z>.021:polygon.material_index=1
 for o in head.children_recursive:
  if o.name.startswith('Moustache'):o.scale.x*=.85;o.scale.y*=.72
 lip=bpy.data.objects['Lower_lip'];lip.scale.x*=.84;lip.scale.z*=.78
 cloak=bpy.data.objects['Cloak_folds']
 def settle_cloak(p):
  if p.y<1.28:return p
  t=min(1,(p.y-1.28)/.15)
  return Vector((p.x*(1-.12*t),min(p.y,1.427),p.z))
 deform(cloak,settle_cloak)
 for side in [-1,1]:
  bar('Mouth_seam_'+str(side),(0,1.580,.076),(side*.018,1.579,.074),.0012,'beard',head,n=6)
 bpy.context.view_layer.update()
OUT=DEST/f'round-{round_no}';OUT.mkdir(exist_ok=True)
# Reuse the original export contract, including every named runtime joint.
export=code.split('# Export only authored asset hierarchy.')[1].split('\n',1)[1].split('# Studio rendering')[0]
exec(export,globals())
scene=bpy.context.scene;scene.cycles.samples=16;scene.render.resolution_x=800;scene.render.resolution_y=1000
scene.render.resolution_percentage=100
cam=scene.camera
def capture(name,position,target,scale):
 cam.location=vec(position);cam.rotation_euler=(vec(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
 scene.render.filepath=str(REVIEW/f'round-{round_no}-{name}.png');bpy.ops.render.render(write_still=True)
capture('body',(2.2,1.7,4.5),(0,.88,0),2.02)
capture('face',(1,1.72,3),(0,1.62,0),.40)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'human-courier.blend'))
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==digest
report={'round':round_no,'sourcePreserved':True,'sourceSHA256':digest,'shoulderWidthBefore':before,'shoulderWidthAfter':width(),'target':'../human-courier-v1/approved-target.png','status':'isolated model iteration, not integrated','joints':[o.name for o in root.children_recursive if o.type=='EMPTY']}
(OUT/'iteration.json').write_text(json.dumps(report,indent=2));print('ROUND_COMPLETE',json.dumps(report),flush=True)
