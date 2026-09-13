import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
OUT=ROOT/'artifacts/pipeline/citadel-old-city-slope'
ASSET=ROOT/'assets/models/optimized/citadel-old-city-slope'
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def clamp(x):return max(0,min(1,x))
def mat(a):return Matrix(tuple(tuple(a[c*4+r] for c in range(4)) for r in range(4)))
def build_round(stage,key='seal'):
    data=json.loads((OUT/'source.json').read_text());s=data[key];M=mat(s['toFoundation']);inv=M.inverted()
    object_name='citadel-coastal-cliff-seal' if key=='seal' else 'citadel-oskar-grid-mountain-surface'
    name='TigerMessenger_Old_City_Coastal_Review'
    scene=bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    bpy.context.window.scene=scene
    for obj in list(scene.objects):
        if obj.name==object_name:bpy.data.objects.remove(obj,do_unlink=True)
    verts=[C@Vector(s['positions'][i:i+3]) for i in range(0,len(s['positions']),3)]
    faces=[(i,i+1,i+2) for i in range(0,len(verts),3)]
    mesh=bpy.data.meshes.new('Original coastal wall terraced round '+str(stage));mesh.from_pydata(verts,[],faces);mesh.update()
    colors=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for loop in mesh.loops:
        i=loop.vertex_index*s['colorSize'];rgb=s['colors'][i:i+3] if s['colors'] else [.09,.145,.215]
        colors.data[loop.index].color=(*rgb,1)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    selected=[]
    for face in bm.faces:
        p=M@(C.inverted()@face.calc_center_median())
        if -34<p.x<32 and -32<p.y<(10 if stage>=3 else 1) and -3<p.z<39:selected.extend(face.edges)
    bmesh.ops.subdivide_edges(bm,edges=list(set(selected)),cuts=2,use_grid_fill=True)
    def route_floor(x,z):
        result=None
        for a,b in zip(data['route'],data['route'][1:]):
            dx,dz=b[0]-a[0],b[2]-a[2];den=dx*dx+dz*dz
            if den<1e-9:continue
            t=clamp(((x-a[0])*dx+(z-a[2])*dz)/den)
            if math.hypot(x-a[0]-t*dx,z-a[2]-t*dz)<5:
                y=a[1]+(b[1]-a[1])*t-.9;result=y if result is None else min(result,y)
        return result
    changed=0;max_shift=0
    def inside(x,z):
        sign=None
        for a,b in zip(data['outline'],data['outline'][1:]+data['outline'][:1]):
            cross=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])
            if abs(cross)<1e-7:continue
            value=cross>0
            if sign is not None and value!=sign:return False
            sign=value
        return True
    for v in bm.verts:
        p=M@(C.inverted()@v.co);old=p.copy()
        top_fade=clamp((8-p.y)/4) if stage>=3 else clamp((-p.y-.6)/3.4)
        fade=clamp((p.x+34)/5)*clamp((32-p.x)/5)*clamp((p.z+3)/5)*clamp((39-p.z)/5)*top_fade*clamp((p.y+30)/8)
        if fade<=0:continue
        if stage>=3 and inside(p.x,p.z):
            # Low town sits on the known flat foundation. Remove rock intrusion
            # at its seaward tier, preserve all rear/middle hillside terraces.
            if p.z>8 and -.15<p.y<8:
                p.y=-.15;v.co=C@(inv@p);changed+=1;max_shift=max(max_shift,(p-old).length)
            continue
        # Broaden the lower rock shoulder, leave the building footprint fixed.
        p.z+=fade*(2.8 if stage==1 else 5.2)*(.75+.25*math.sin(p.x*.41+p.y*.5))
        p.x+=fade*.38*math.sin(p.y*.8+p.x*.55)
        p.y+=(round(p.y/3.1)*3.1-p.y)*fade*(.18 if stage==1 else .32)
        limit=route_floor(p.x,p.z)
        if limit is not None and p.y>limit:p=old
        v.co=C@(inv@p);changed+=1;max_shift=max(max_shift,(p-old).length)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
    obj=bpy.data.objects.new(object_name,mesh);scene.collection.objects.link(obj)
    obj.matrix_world=C@M@C.inverted()
    material=bpy.data.materials.new('Original coastal slate');material.use_nodes=True;nodes=material.node_tree.nodes
    attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='Color';material.node_tree.links.new(attr.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);nodes.get('Principled BSDF').inputs['Roughness'].default_value=.98;mesh.materials.append(material)
    mesh.calc_loop_triangles();positions=[];normals=[];rgb=[];colors=mesh.color_attributes['Color']
    for tri in mesh.loop_triangles:
        for vi,li in zip(tri.vertices,tri.loops):
            v=C.inverted()@mesh.vertices[vi].co;n=C.to_3x3().inverted()@tri.normal
            positions.extend(v);normals.extend(n);rgb.extend(colors.data[li].color[:3])
    ASSET.mkdir(parents=True,exist_ok=True)
    path=ASSET/f'old-city-coastal-{key}-r0{stage}.blend'
    bpy.data.libraries.write(str(path),{scene},fake_user=True)
    result={'name':object_name,'source':str(path.relative_to(ROOT)),'sourceDigest':s['digest'],'positions':positions,'normals':normals,'colors':rgb,'triangles':len(positions)//9,'changedVertices':changed,'maxShift':max_shift,'routeProtected':True}
    (ASSET/f'oldCityCoastal{key.title()}R0{stage}.js').write_text('export default '+json.dumps(result,separators=(',',':'))+';\n')
    report={k:v for k,v in result.items() if k not in ['positions','normals','colors']};(OUT/f'blender-{key}-r0{stage}.json').write_text(json.dumps(report,indent=2));print(report)
    return result

def build_pair(stage=2):
    parts=[build_round(stage,'seal'),build_round(stage,'main')]
    result={'parts':parts}
    (ASSET/f'oldCityCoastalR0{stage}.js').write_text('export default '+json.dumps(result,separators=(',',':'))+';\n')
