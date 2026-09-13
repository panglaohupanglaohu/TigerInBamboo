import bpy,json,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
OUT=ROOT/'artifacts/pipeline/citadel-front-strata';ASSET=ROOT/'assets/models/optimized/citadel-front-strata';ASSET.mkdir(parents=True,exist_ok=True)
data=json.loads((OUT/'report.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
meshes=[]
def native(v):return (v[0],-v[2],v[1])
def matrix(a):return Matrix([a[i::4] for i in range(4)])
for source in data['meshes']:
 p=source['positions'];idx=source['indices'] or list(range(len(p)//3));geo=bpy.data.meshes.new(source['name']);geo.from_pydata([native(p[i:i+3]) for i in range(0,len(p),3)],[],[idx[i:i+3] for i in range(0,len(idx),3)]);geo.update();o=bpy.data.objects.new(source['name'],geo);bpy.context.collection.objects.link(o)
 o.hide_render=source['name'].startswith('backlit')
 color=geo.color_attributes.new(name='Rock',type='FLOAT_COLOR',domain='POINT')
 for i,d in enumerate(color.data):d.color=(*(source['colors'][i*3:i*3+3] if source['colors'] else [.18,.27,.38]),1)
 mat=bpy.data.materials.new(source['name']+' stone');mat.use_nodes=True;nodes=mat.node_tree.nodes;attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='Rock';mat.node_tree.links.new(attr.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);nodes.get('Principled BSDF').inputs['Roughness'].default_value=.95;geo.materials.append(mat)
 meshes.append((source,o,matrix(source['toCity'])))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Blue hour rock study');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.18,.28,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
sun=bpy.data.objects.new('Grazing light',bpy.data.lights.new('Grazing light','SUN'));scene.collection.objects.link(sun);sun.data.energy=2;sun.rotation_euler=(.7,-.45,-.65)
inv=meshes[0][2].inverted()
cam=bpy.data.objects.new('Fixed terrain camera',bpy.data.cameras.new('Fixed terrain camera'));scene.collection.objects.link(cam)
cam.location=Vector(native(inv@Vector((110,30,145))));target=Vector(native(inv@Vector((60,-12,90))));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(49);scene.camera=cam
reports=[]
for iteration in [0,1,2]:
 changes_by_mesh=[]
 for source,o,to_city in meshes:
  inv=to_city.inverted();changes=[]
  for row in source['vertices']:
   i=row['i'];base=Vector(source['positions'][i*3:i*3+3]);p=Vector(row['author']);x,y,z=p
   if iteration and not row['bottom'] and 84<z<106 and 43<x<92 and row['altitude']>.5:
    smooth=lambda v:max(0,min(1,v))**2*(3-2*max(0,min(1,v)))
    weight=smooth((z-84)/3)*smooth((106-z)/5)*smooth((x-43)/5)*smooth((92-x)/5)*smooth((row['altitude']-.5)/3)
    # Broad irregular rock shelves, preserving the shoreline and all walkable tops.
    phase=.55*math.sin(x*.17)+.30*math.cos(z*.19)
    step=3.4;terrace=round((y+phase)/step)*step-phase
    p.y+=weight*(terrace-y)*(.52 if iteration==1 else .72)
    if iteration==2:
     p.x+=weight*.42*math.sin(z*.37+x*.13)
     p.z+=weight*.30*math.sin(x*.24+y*.18)
    local=inv@p
   else:local=base
   o.data.vertices[i].co=native(local)
   delta=local-base
   if delta.length>1e-5:changes.append([i,*base,*delta])
  o.data.update();changes_by_mesh.append({'name':source['name'],'changes':changes})
 if iteration:
  bpy.ops.wm.save_as_mainfile(filepath=str(ASSET/f'front-strata-r{iteration:02d}.blend'))
  reports.append({'iteration':iteration,'counts':[len(m['changes']) for m in changes_by_mesh]})
 scene.render.filepath=str(OUT/f'blender-r{iteration:02d}.png');bpy.ops.render.render(write_still=True)
result={'source':'assets/models/optimized/citadel-front-strata/front-strata-r02.blend','baseline':'artifacts/pipeline/citadel-front-strata/report.json','meshes':changes_by_mesh,'iterations':reports}
(ASSET/'frontStrataData.js').write_text('export default '+json.dumps(result,separators=(',',':'))+';\n')
(OUT/'blender-report.json').write_text(json.dumps({'source':result['source'],'iterations':reports},indent=2))
