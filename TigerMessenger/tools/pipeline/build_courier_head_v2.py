import bpy,ast,json,math,sys,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from math import sin,cos,pi
BASE=Path(__file__).resolve().parents[2]
DEST=BASE/'assets/models/optimized/human-courier-production-v2'
REVIEW=BASE/'artifacts/pipeline/courier-production-v2'
DEST.mkdir(exist_ok=True);REVIEW.mkdir(exist_ok=True)
stage=int(sys.argv[sys.argv.index('--stage')+1])
source=BASE/'assets/models/optimized/human-courier-production/head-3/courier.blend' if stage==4 else DEST/f'head-{stage-1}'/'courier.blend'
digest=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
C=Matrix.Rotation(pi/2,4,'X');CI=C.inverted()
root=bpy.data.objects['Courier'];body=bpy.data.objects['body'];head=bpy.data.objects['head']
M={m.name:m for m in bpy.data.materials}
code=(BASE/'tools/pipeline/build_human_courier.py').read_text()
for node in ast.parse(code).body:
    if isinstance(node,ast.FunctionDef) and node.name in ['vec','attach','joint','mesh','rings','orb','bar','box','ribbon']:
        exec(compile(ast.Module(body=[node],type_ignores=[]),'<courier-original-helpers>','exec'))
def deform(obj,fn):
    bpy.context.view_layer.update();inv=obj.matrix_world.inverted()
    for v in obj.data.vertices:
        p=CI.to_3x3()@(obj.matrix_world@v.co);v.co=inv@vec(fn(p))
    obj.data.update()
exec((BASE/'tools/pipeline/courier_anatomy_v2.py').read_text(),globals())
report=anatomy_pass(stage)
bpy.context.view_layer.update()
OUT=DEST/f'head-{stage}';OUT.mkdir(exist_ok=True)
asset=[root,*root.children_recursive];M={m.name:m for o in asset if o.type=='MESH' for m in o.data.materials}
export=code.split('nodes=[]')[1].split('# Studio rendering')[0]
export='nodes=[]'+export
export=export.replace('CI.to_3x3()@tri.normal','CI.to_3x3()@(me.vertices[vi].normal if me.polygons[tri.polygon_index].use_smooth else tri.normal)')
exec(export,globals())
for o in bpy.context.selected_objects:o.select_set(False)
for o in asset:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(OUT/'courier.glb'),use_selection=True,export_yup=True)
scene=bpy.context.scene;scene.cycles.samples=12;scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100
cam=scene.camera
for name,p,target,size in [('front',(0,1.65,3),(0,1.635,0),.34),('profile',(3,1.65,0),(0,1.635,0),.34),('three-quarter',(1,1.70,3),(0,1.635,0),.34),('top',(0,4,0),(0,1.65,0),.29)]:
    cam.location=vec(p);cam.rotation_euler=(vec(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=size
    scene.render.filepath=str(REVIEW/f'head-{stage}-{name}.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'courier.blend'))
assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
report.update({'sourcePreserved':True,'sourceSHA256':digest,'status':'candidate, not production integration or user acceptance'})
(OUT/'pass.json').write_text(json.dumps(report,indent=2));print('HEAD_PASS_COMPLETE',report)
