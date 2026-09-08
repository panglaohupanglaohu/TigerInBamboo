import bpy,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'terrain-input.blend'))
surfaces=[o for o in bpy.data.objects if o.type=='MESH' and o.name=='citadel-oskar-grid-mountain-surface']
assert len(surfaces)==1
surface=surfaces[0];deps=bpy.context.evaluated_depsgraph_get();bvh=BVHTree.FromObject(surface,deps);rows=[]
# Merged canopy/grass geometry belongs to this terrain; separate mountain tree roots live in the city GLB.
existing=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(root/'project/assets/terrain.glb'))
imported=set(bpy.data.objects)-existing
old=next(o for o in imported if o.type=='MESH' and o.name.startswith('citadel-oskar-grid-mountain-surface'))
old_bvh=BVHTree.FromObject(old,bpy.context.evaluated_depsgraph_get())
def height(obj,tree,x,y):
 inv=obj.matrix_world.inverted();origin=inv@Vector((x,y,200));direction=(inv.to_3x3()@Vector((0,0,-1))).normalized()
 hit,_,_,_=tree.ray_cast(origin,direction,500)
 return (obj.matrix_world@hit).z if hit is not None else None
for o in existing:
 if o.type!='MESH' or not o.name.startswith(('highland-canopy-groves','highland-slope-grass-billboards')):continue
 center=o.matrix_world.translation.copy()
 h0=height(old,old_bvh,center.x,center.y);h1=height(surface,bvh,center.x,center.y)
 if h0 is None or h1 is None:rows.append({'name':o.name,'hit':False});continue
 delta=h1-h0
 o.matrix_world.translation.z+=delta
 rows.append({'name':o.name,'hit':True,'delta':delta})
for o in imported:bpy.data.objects.remove(o,do_unlink=True)
assert rows
bpy.ops.wm.save_as_mainfile(filepath=str(root/'terrain-plants-v3.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'project/assets/terrain-blue.glb'),export_format='GLB',export_extras=True)
(root/'plant-grounding.json').write_text(json.dumps({'scope':'Merged terrain vegetation checked against old/new terrain; zero displacement means support unchanged. Separate city-GLB tree roots are grounded in Godot.','plants':rows},indent=2))
