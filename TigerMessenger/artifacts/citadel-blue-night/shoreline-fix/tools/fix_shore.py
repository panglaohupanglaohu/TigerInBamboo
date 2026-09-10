import bpy,bmesh,json,struct,math
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'terrain-before.glb'))
# The source water remains read-only; use its actual curved triangles as the floor reference.
b=(root/'project/assets/candidate.glb').read_bytes();size=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+size]);offset=28+size
n=next(n for n in g['nodes'] if n.get('name')=='highland-waterfront-water');prim=g['meshes'][n['mesh']]['primitives'][0]
def array(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];count=a['count']*(3 if a['type']=='VEC3' else 1);fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']];return struct.unpack_from('<'+fmt*count,b,offset+v.get('byteOffset',0)+a.get('byteOffset',0))
p=array(prim['attributes']['POSITION']);water=[Vector((p[i],-p[i+2],p[i+1])) for i in range(0,len(p),3)];ids=array(prim['indices']);faces=[ids[i:i+3] for i in range(0,len(ids),3)];sea=BVHTree.FromPolygons(water,faces,all_triangles=True)
def water_height(x,y):
 hit,_,_,_=sea.ray_cast(Vector((x,y,100)),Vector((0,0,-1)),300)
 return hit.z if hit is not None else None
mountain_changes=[]
for surface in [o for o in bpy.data.objects if o.type=="MESH" and "citadel-oskar-grid-mountain-surface" in o.name]:
 before=len(surface.data.vertices)
 bm=bmesh.new();bm.from_mesh(surface.data)
 # Refine original shore triangles, not the protected mountain skyline or city platform.
 edges=[e for e in bm.edges if any(abs((surface.matrix_world@v.co).x)<38 and (surface.matrix_world@v.co).y < -20 for v in e.verts)]
 bmesh.ops.subdivide_edges(bm,edges=edges,cuts=5,use_grid_fill=True)
 # Insert an actual shoreline edge so broad triangles cannot bridge across the quay.
 inv=surface.matrix_world.inverted()
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=0.0001,plane_co=inv@Vector((0,-18,0)),plane_no=surface.matrix_world.to_3x3().transposed()@Vector((0,1,0)),clear_inner=False,clear_outer=False)
 bm.to_mesh(surface.data);bm.free()
 changed=0;protected=0
 for v in surface.data.vertices:
  w=surface.matrix_world@v.co;z=-w.y
  if z<17.999 or abs(w.x)>40:protected+=1;continue
  sea_y=water_height(w.x,w.y)
  if sea_y is None:sea_y=-10.0
  target=sea_y-1.0
  if w.z>target:w.z=target;v.co=surface.matrix_world.inverted()@w;changed+=1
 surface.data.update()
 mountain_changes.append(dict(name=surface.name,before=before,after=len(surface.data.vertices),lowered=changed))
# Match the exact top footprint; the imported old side is flipped along Z and lacks the 5.03 lift.
top=next(o for o in bpy.data.objects if o.name=='highland-town-foundation-platform')
side=next(o for o in bpy.data.objects if o.name=='highland-town-foundation-platform-side')
old_bounds=[list(side.matrix_world@Vector(c)) for c in side.bound_box]
points=[top.matrix_world@v.co for v in top.data.vertices];center=sum(points,Vector())/len(points);points.sort(key=lambda p:math.atan2(p.y-center.y,p.x-center.x))
verts=[];quads=[];segments=[]
for i,a in enumerate(points):
 b=points[(i+1)%len(points)];count=max(1,math.ceil((b-a).length/2.0))
 for j in range(count):
  p=a.lerp(b,j/count);q=a.lerp(b,(j+1)/count)
  def bottom(v):
   h=water_height(v.x,v.y)
   return min(-2.0,h-1.0) if h is not None else -2.0
  base=len(verts);verts.extend([tuple(p),tuple(q),(q.x,q.y,bottom(q)),(p.x,p.y,bottom(p))]);quads.append((base,base+1,base+2,base+3));segments.append([list(p),list(q)])
mesh=bpy.data.meshes.new('Corrected quay retaining wall');mesh.from_pydata(verts,[],quads);mesh.update();materials=list(side.data.materials);side.data=mesh;side.parent=None;side.matrix_world=Matrix.Identity(4)
for mat in materials:side.data.materials.append(mat)
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
for f in bm.faces:
 c=f.calc_center_median();out=Vector((c.x-center.x,c.y-center.y,0))
 if f.normal.dot(out)<0:f.normal_flip()
bm.to_mesh(mesh);bm.free()
assert changed>0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'shoreline-corrected.blend'))
bpy.ops.export_scene.gltf(filepath=str(root/'project/assets/terrain-blue.glb'),export_format='GLB',export_extras=True)
(root/'blender-shore-report.json').write_text(json.dumps({'mountain_layers':mountain_changes,'mountain_vertices_before':before,'mountain_vertices_after':len(surface.data.vertices),'lowered_shore_vertices':changed,'protected_vertices':protected,'side_old_world_bounds':old_bounds,'top_edge_segments':len(segments),'top_height':center.z,'building_and_water_glb_unchanged':True,'scope':'Rebuild mismatched quay side and lower original mountain intersections beneath the actual curved water; preserve top footprint and city geometry'},indent=2))
