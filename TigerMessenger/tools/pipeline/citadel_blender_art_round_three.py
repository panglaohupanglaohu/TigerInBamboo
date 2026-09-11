"""Replay third terrain experiment after round-02.blend, inside Blender."""
import bpy
import bmesh
import json
import math
from pathlib import Path

p=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/citadel-target-iterations')
o=bpy.data.objects['citadel-oskar-grid-mountain-surface']
assert o.get('citadel_art_round') == 2, 'Load round-02.blend first'
bm=bmesh.new()
bm.from_mesh(o.data)
verts=[v for v in bm.verts if math.hypot(v.co.x,v.co.y)>37 and v.co.z>9]
count=len(verts)
for i in range(10):
    bmesh.ops.smooth_vert(bm,verts=verts,factor=.35,use_axis_x=True,use_axis_y=True,use_axis_z=True)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(o.data)
bm.free()
for f in o.data.polygons:
    f.material_index=max(1,min(3,round(2+.65*f.normal.x-.65*f.normal.y)))
o['citadel_art_round']=3
bpy.context.scene.render.filepath=str(p/'round-03.png')
bpy.ops.wm.save_as_mainfile(filepath=str(p/'round-03.blend'))
(p/'round-03.json').write_text(json.dumps({'smoothed_outer_vertices':count,'iterations':10,'protected_radius':37,'protected_height':9,'integrated_web':False,'integrated_godot':False}))
def render_third():
    bpy.ops.render.render(write_still=True)
    return None
bpy.app.timers.register(render_third,first_interval=.5)
