"""Pack the courier's local 2D references into an isolated Blender workbench."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector

BASE=Path(__file__).resolve().parents[2]
PACK=BASE/'assets/models/optimized/human-courier-refinement/reference-pack-v1'
MODEL=BASE/'assets/models/optimized/human-courier-refinement/round-7/human-courier.blend'
names=['head-views','face-details','walk','run','jump','stealth','wall-vault']
for name in names:
    assert (PACK/(name+'.png')).is_file(),name
bpy.ops.wm.open_mainfile(filepath=str(MODEL))
collection=bpy.data.collections.new('REFERENCE_BOARDS__not_runtime_assets')
bpy.context.scene.collection.children.link(collection)
for i,name in enumerate(names):
    img=bpy.data.images.load(str(PACK/(name+'.png')),check_existing=True)
    img.pack()
    obj=bpy.data.objects.new('REF_'+name,None)
    collection.objects.link(obj)
    obj.empty_display_type='IMAGE';obj.data=img
    obj.empty_display_size=1.4
    obj.rotation_euler=(math.pi/2,0,0)
    obj.location=(1.6+(i%2)*1.6,0,2.4-(i//2)*1.05)
    obj.hide_render=True
    obj['purpose']='2D construction reference, not exact calibrated geometry'
    obj['source_image']=str(PACK/(name+'.png'))

original=BASE/'assets/models/optimized/human-courier-v1/approved-target.png'
image=bpy.data.images.load(str(original),check_existing=True);image.pack()
note=bpy.data.texts.new('READ_ME__Courier_reference_workbench')
note.write('''Courier isolated reference workbench
The main courier is round 7: reduced cheek bulges and shortened lower face.
Seven packed 2D boards sit to the right in REFERENCE_BOARDS__not_runtime_assets.
The original approved reference image is also packed in this file.
Generated views are construction guides, not calibrated multi-camera scans.
Use front/profile/top to reconcile volumes; do not copy each view independently.
Current face, hair and fine anatomy still differ from the target.
Motion boards are key-pose references, not baked animations or final foot contacts.
Production Web/Godot characters are unchanged.
''')
root=bpy.data.objects['Courier']
bpy.ops.object.select_all(action='DESELECT')
face=bpy.data.objects['Face'];face.select_set(True);bpy.context.view_layer.objects.active=face
# Leave the original 3D scene camera intact; all references are viewport-only.
out=PACK/'courier-reference-workbench.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(out))
report={'blenderFile':str(out),'modelSource':str(MODEL),'packedBoards':names,'originalTargetPacked':True,'productionIntegrated':False,'animationsBaked':False,'status':'reference-assisted face blocking; not visual acceptance'}
(PACK/'blender-workbench.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
