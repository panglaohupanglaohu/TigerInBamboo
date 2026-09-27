"""Remove the waist flare left by the shoulder-only width warp; preserve source."""
import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
BASE=Path(__file__).resolve().parents[2];SOURCE=BASE/'assets/models/optimized/human-courier-v1/human-courier.blend'
OUT=BASE/'assets/models/optimized/human-courier-cape-drape';OUT.mkdir(exist_ok=True)
REVIEW=BASE/'artifacts/pipeline/courier-cape-drape';REVIEW.mkdir(parents=True,exist_ok=True)
sha=hashlib.sha256(SOURCE.read_bytes()).hexdigest();bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
C=Matrix.Rotation(math.pi/2,4,'X');CI=C.inverted();root=bpy.data.objects['Courier'];cloth=bpy.data.objects['Cloak_folds']
bpy.context.view_layer.update()
def point(obj,v):return CI.to_3x3()@(obj.matrix_world@v.co)
cam=bpy.context.scene.camera;cam.location=C.to_3x3()@Vector((0,1.1,-3));cam.rotation_euler=(C.to_3x3()@Vector((0,.95,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=2.05
scene=bpy.context.scene;scene.cycles.samples=8;scene.render.resolution_x=640;scene.render.resolution_y=800
scene.render.filepath=str(REVIEW/'before.png');bpy.ops.render.render(write_still=True)
pts=[point(cloth,v) for v in cloth.data.vertices];top_width=max(p.x for p in pts[:13])-min(p.x for p in pts[:13]);widths=[]
for row in range(9):
    t=row/8;width=top_width*(1+.12*t);widths.append(width)
    for col in range(13):
        vi=row*13+col;p=pts[vi].copy();p.x=(col/12-.5)*width
        cloth.data.vertices[vi].co=cloth.matrix_world.inverted()@(C.to_3x3()@p)
factor=json.loads((BASE/'artifacts/pipeline/human-courier-v1/shoulder-proportions.json').read_text())['shoulderScale']
for obj in root.children_recursive:
    if obj.type=='MESH' and obj.name.startswith('Cloak_gold_hem'):
        inv=obj.matrix_world.inverted()
        for v in obj.data.vertices:
            p=point(obj,v);weight=max(0,min(1,(p.y-1.02)/.28));old_width=.57*(1+(factor-1)*weight)
            p.x*=widths[-1]/old_width;v.co=inv@(C.to_3x3()@p)
asset=[root,*root.children_recursive];M={m.name:m for o in asset if o.type=='MESH' for m in o.data.materials}
code=(BASE/'tools/pipeline/build_human_courier.py').read_text();export='nodes=[]'+code.split('nodes=[]')[1].split('# Studio rendering')[0];exec(export,globals())
for o in bpy.context.selected_objects:o.select_set(False)
for o in asset:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(OUT/'human-courier.glb'),use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'human-courier.blend'))
scene.render.filepath=str(REVIEW/'after.png');bpy.ops.render.render(write_still=True)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==sha
(REVIEW/'report.json').write_text(json.dumps({'sourceSHA256':sha,'originalPreserved':True,'backWidthsShoulderToHem':widths,'change':'continuous 12% widening from shoulders to hem; no waist flare; original head and animation hierarchy retained'},indent=2))
