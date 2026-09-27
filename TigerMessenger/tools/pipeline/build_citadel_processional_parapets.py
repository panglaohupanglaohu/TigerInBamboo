"""Blender-built stone sidewalls for the existing ten-metre processional flights."""
import bpy, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/optimized/citadel-processional-parapets'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
parts=[]
for kind in ['wall','coping']:
    meshes=[]
    for side in [-1,1]:
        for i in range(30):
            floor=6*(i+1)/30
            z=10-(i+.5)*10/30
            h=.14 if kind=='coping' else 1.18
            y=floor+.85 if kind=='coping' else floor+.19
            width=.52 if kind=='coping' else .38
            bpy.ops.mesh.primitive_cube_add(size=1,location=(side*3.91,-z,y))
            ob=bpy.context.object;ob.name=kind
            ob.scale=(width,10/30,h)
            bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
            # Only copings are bevelled: the wall blocks have closed butt joints.
            if kind=='coping':
                mod=ob.modifiers.new('Stone edge','BEVEL');mod.width=.025;mod.segments=1
                bpy.ops.object.modifier_apply(modifier=mod.name)
            meshes.append(ob)
    positions=[];normals=[]
    for ob in meshes:
        ob.data.calc_loop_triangles()
        for tri in ob.data.loop_triangles:
            for vi in tri.vertices:
                v=ob.matrix_world@ob.data.vertices[vi].co;n=tri.normal
                positions.extend([round(v.x,6),round(v.z,6),round(-v.y,6)])
                normals.extend([round(n.x,6),round(n.z,6),round(-n.y,6)])
    mat=bpy.data.materials.new(kind);mat.diffuse_color=(.72,.68,.59,1) if kind=='wall' else (.84,.79,.69,1)
    for ob in meshes:ob.data.materials.append(mat)
    parts.append({'name':kind,'positions':positions,'normals':normals})
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'processional-parapets.blend'))
data={'source':'Blender processional-parapets.blend','length':10,'rise':6,'treads':30,'clearWidth':7.3,'parts':parts}
(OUT/'processionalParapets.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
print('PARAPETS_EXPORTED',sum(len(p['positions'])//9 for p in parts),'triangles')
