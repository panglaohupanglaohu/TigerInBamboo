import bpy,bmesh,math,json,struct
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
ASSET=ROOT/'assets/models/optimized/citadel-old-shore'
OUT=ROOT/'artifacts/pipeline/citadel-old-shore-blender'
SCENE='TigerMessenger_Old_Shore_Review'
SOURCE=ROOT/'godot/assets/art-pilots/citadel-west-city-v1.glb'
def initialize():
    if SCENE in bpy.data.scenes:raise RuntimeError('Review scene already exists; do not reimport')
    scene=bpy.data.scenes.new(SCENE);bpy.context.window.scene=scene
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    coast=next(o for o in scene.objects if o.name=='citadel-coastal-cliff-seal')
    coast.data=coast.data.copy()
    bm=bmesh.new();bm.from_mesh(coast.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.00001)
    selected=[]
    for f in bm.faces:
        p=coast.matrix_world@f.calc_center_median()
        if -80<p.x<-26 and 12<-p.y<38 and p.z<8:selected.extend(f.edges)
    bmesh.ops.subdivide_edges(bm,edges=list(set(selected)),cuts=3,use_grid_fill=True)
    bm.to_mesh(coast.data);bm.free();coast.data.update()
    a=coast.data.attributes.new('shore_base','FLOAT_VECTOR','POINT')
    for v in coast.data.vertices:a.data[v.index].vector=v.co
    # Preserve original vertex colors so round 2 never compounds round 1 tint.
    color=coast.data.color_attributes.active_color
    if color:
        backup=coast.data.color_attributes.new(name='shore_base_color',type='FLOAT_COLOR',domain=color.domain)
        for i,d in enumerate(color.data):backup.data[i].color=d.color
        coast['color_name']=color.name
    scene.render.engine='CYCLES';scene.cycles.samples=16
    scene.render.resolution_x=1100;scene.render.resolution_y=720;scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Old shore review world');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.15,.21,.29,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
    sun=bpy.data.objects.new('Shore review sun',bpy.data.lights.new('Shore review sun','SUN'));scene.collection.objects.link(sun);sun.data.energy=2.2;sun.rotation_euler=(.4,-.3,-.6)
    cam=bpy.data.objects.new('Shore review camera',bpy.data.cameras.new('Shore review camera'));scene.collection.objects.link(cam)
    cam.location=(-26,-78,24);target=Vector((-49,-24,3));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.angle=math.radians(52);scene.camera=cam
    print({'scene':scene.name,'coast_vertices':len(coast.data.vertices),'subdivided_edges':len(set(selected)),'original_scene_retained':bpy.data.scenes.get('Scene') is not None})
def refine(stage):
    scene=bpy.data.scenes[SCENE];bpy.context.window.scene=scene
    coast=next(o for o in scene.objects if o.name=='citadel-coastal-cliff-seal')
    base=coast.data.attributes['shore_base'];world=coast.matrix_world;inv=world.inverted();changed=0
    for v in coast.data.vertices:
        p=world@base.data[v.index].vector;x,z,h=p.x,-p.y,p.z
        if -80<x<-26 and 12<z<38 and h<4:
            fade=min(1,(x+80)/4,(-26-x)/4,(z-12)/3,(38-z)/3,max(0,(4-h)/4))
            strength=.65 if stage==1 else 1.0
            p.x+=fade*strength*(.43*math.sin(x*.67+h*.51))
            p.y-=fade*strength*(.75+.65*math.sin(x*.56+h*.73)+.22*math.cos(x*.23-h*.5))
            p.z+=fade*strength*.18*math.sin(x*.71+h*.62);changed+=1
        v.co=inv@p
    coast.data.update()
    for f in coast.data.polygons:f.use_smooth=False
    if coast.get('color_name'):
        colors=coast.data.color_attributes[coast['color_name']];backup=coast.data.color_attributes['shore_base_color']
        for f in coast.data.polygons:
            p=world@f.center
            gain=.9+.12*abs(f.normal.x) if -80<p.x<-26 and 12<-p.y<38 and p.z<4 else 1
            for loop in f.loop_indices:
                i=loop if colors.domain=='CORNER' else coast.data.loops[loop].vertex_index
                c=backup.data[i].color;colors.data[i].color=(c[0]*gain,c[1]*gain,c[2]*gain,c[3])
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSET/f'citadel-old-shore-r0{stage}.blend'),copy=True)
    scene.render.filepath=str(OUT/f'blender-r0{stage}.png');bpy.ops.render.render(write_still=True)
    print({'stage':stage,'changed_vertices':changed,'tops_above_4_unchanged':True})
def export():
    scene=bpy.data.scenes[SCENE];coast=next(o for o in scene.objects if o.name=='citadel-coastal-cliff-seal')
    coast.data.calc_loop_triangles();positions=[];normals=[];colors=[]
    attr=coast.data.color_attributes.get(coast.get('color_name',''))
    for t in coast.data.loop_triangles:
        for vertex,loop in zip(t.vertices,t.loops):
            p=coast.data.vertices[vertex].co;n=t.normal
            positions.extend([p.x,p.z,-p.y]);normals.extend([n.x,n.z,-n.y])
            c=attr.data[loop if attr.domain=='CORNER' else vertex].color if attr else (.03,.07,.12,1)
            colors.extend(c[:3])
    b=SOURCE.read_bytes();size=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+size]);start=28+size
    node=next(n for n in doc['nodes'] if n.get('name')=='citadel-coastal-cliff-seal')
    a=doc['accessors'][doc['meshes'][node['mesh']]['primitives'][0]['attributes']['POSITION']];view=doc['bufferViews'][a['bufferView']]
    values=struct.unpack_from('<'+'f'*(a['count']*3),b,start+view.get('byteOffset',0)+a.get('byteOffset',0))
    signature=2166136261
    for v in values:
        for byte in (str(math.floor(v*10000+.5))+',').encode():signature=((signature^byte)*16777619)&0xffffffff
    result={'source':'assets/models/optimized/citadel-old-shore/citadel-old-shore-r02.blend','baseVertexCount':a['count'],'baseSignature':signature,'positions':positions,'normals':normals,'colors':colors}
    (ASSET/'citadelOldShoreData.js').write_text('export default '+json.dumps(result,separators=(',',':'))+';\n')
    report={k:v for k,v in result.items() if k not in ['positions','normals','colors']};report['triangles']=len(positions)//9
    (OUT/'export.json').write_text(json.dumps(report,indent=2));print(report)
