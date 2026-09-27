"""Export authored r03 shoreline meshes only; live towers/swamp keep their scripts."""
import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/models/optimized/crystal-v7/crystal-v7-r03.blend'))
sites=[(3,40,9),(-42,-29,5),(43,-29,5),(0,-3,8.2)]
parts=[]
for o in bpy.context.scene.objects:
 if o.type!='MESH' or o.parent or o.name.startswith(('garden-connector','connector-support')):continue
 o.data.calc_loop_triangles()
 verts=[o.matrix_world@v.co for v in o.data.vertices]
 c=sum(verts,Vector())/len(verts)
 owner=3 if o.name.startswith('swamp-outer') else min(range(3),key=lambda i:(c.x-sites[i][0])**2+(c.y-sites[i][1])**2)
 x,y,z=sites[owner];positions=[];colors=[]
 for tri in o.data.loop_triangles:
  mat=o.data.materials[tri.material_index];bs=mat.node_tree.nodes.get('Principled BSDF');col=bs.inputs['Base Color'].default_value[:3]
  for idx in tri.vertices:
   v=verts[idx];positions.extend([round(v.x-x,5),round(v.z-z,5),round(-(v.y-y),5)]);colors.extend([round(k,5) for k in col])
 parts.append(dict(name=o.name,owner=owner,positions=positions,colors=colors,walk=o.name.startswith(('bank-grass','tower-plinth','quay-course','quay-coping','island-stair','side-berth-deck','swamp-outer'))))
(root/'src/assets/crystalV7ShoresData.js').write_text('// Generated from preserved Blender r03 by export_crystal_v7_web.py. Linear vertex colors.\nexport const CRYSTAL_V7_SHORES='+json.dumps(parts,separators=(',',':'))+';\n')
print('Exported shoreline meshes:',len(parts))
