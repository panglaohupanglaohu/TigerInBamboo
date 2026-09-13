import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
ASSET=ROOT/'assets/models/optimized/citadel-west-massif'
OUT=ROOT/'artifacts/pipeline/citadel-west-massif'
NAME='TigerMessenger_West_Massif_Review'
def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def refine(stage):
    scene=bpy.data.scenes.get(NAME)
    if scene is None:scene=bpy.data.scenes.new(NAME)
    bpy.context.window.scene=scene
    old=scene.objects.get('highland-ravine-wall-west')
    if old:bpy.data.objects.remove(old,do_unlink=True)
    # Retain the original west-wing envelope and ridge peak; close the volume.
    # Three coordinates (x,y,z) are converted to Blender (x,-z,y).
    nx,nz=18,28;verts=[]
    for j in range(nz+1):
        z=-37+j*72/nz
        length=max(0,math.sin(math.pi*j/nz))
        ridge=-(50+3*math.sin((z+7)*.037))
        crest=43*length**.72*(.92+.08*math.cos((z+8)*.11))
        if stage==2:crest*=.87+.13*math.cos((z+9)*.28)
        for i in range(nx+1):
            x=-66+i*37/nx
            u=(x+66)/(ridge+66) if x<=ridge else (-29-x)/(-29-ridge)
            shape=max(0,u)**(.7 if stage==1 else .86)
            y=-5+crest*shape
            if 0<i<nx and 0<j<nz:
                # Short stepped facets interrupt the enormous old triangular planes.
                faceting=math.sin(x*.83+z*.39)*.55+math.cos(z*.91-x*.21)*.36
                y+=faceting*length*math.sin(math.pi*i/nx)*(1 if stage==1 else 1.4)
                if stage==2:
                    shelf=3.1
                    y+=(round(y/shelf)*shelf-y)*.24*shape*length
                    x+=.24*math.sin(z*.71+i*1.2)*length*math.sin(math.pi*i/nx)
            verts.append((x,-z,y))
    faces=[]
    for j in range(nz):
        for i in range(nx):
            a=j*(nx+1)+i;b=a+1;c=b+nx+1;d=a+nx+1
            faces.extend([(a,b,c),(a,c,d)] if (i+j)%2 else [(a,b,d),(b,c,d)])
    boundary=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,nz+1)]+[nz*(nx+1)+i for i in range(nx-1,-1,-1)]+[j*(nx+1) for j in range(nz-1,0,-1)]
    lower=[]
    for index in boundary:
        lower.append(len(verts));v=verts[index];verts.append((v[0],v[1],-11))
    for k,a in enumerate(boundary):
        b=boundary[(k+1)%len(boundary)];lo=lower[k];ln=lower[(k+1)%len(lower)]
        faces.extend([(a,lo,ln),(a,ln,b)])
    faces.append(tuple(reversed(lower)))
    mesh=bpy.data.meshes.new('West massif closed rock r0'+str(stage));mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));nonmanifold=sum(1 for e in bm.edges if not e.is_manifold);bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new('highland-ravine-wall-west',mesh);scene.collection.objects.link(obj)
    colors=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for face in mesh.polygons:
        h=max(0,min(1,(face.center.z+5)/44));gain=.85+.15*abs(face.normal.x)
        rgb=[linear(a/255)+(linear(b/255)-linear(a/255))*h for a,b in zip((32,59,89),(69,109,145))]
        for loop in face.loop_indices:colors.data[loop].color=(*[v*gain for v in rgb],1)
    mat=bpy.data.materials.new('Original blue-grey rock r0'+str(stage));mat.use_nodes=True
    nodes=mat.node_tree.nodes;attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='Color';mat.node_tree.links.new(attr.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);nodes.get('Principled BSDF').inputs['Roughness'].default_value=1;mesh.materials.append(mat)
    if not scene.camera:
        cam=bpy.data.objects.new('West massif review camera',bpy.data.cameras.new('Massif camera'));scene.collection.objects.link(cam);cam.location=(-9,-70,54);cam.rotation_euler=(Vector((-47,0,13))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=88;scene.camera=cam
        light=bpy.data.objects.new('Massif review sun',bpy.data.lights.new('Massif sun','SUN'));scene.collection.objects.link(light);light.data.energy=2;light.rotation_euler=(.4,-.5,-.6)
        scene.world=bpy.data.worlds.new('Massif review world');scene.world.color=(.16,.2,.27)
    scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.resolution_x=800;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    bpy.ops.wm.save_as_mainfile(filepath=str(ASSET/f'west-massif-r0{stage}.blend'),copy=True)
    scene.render.filepath=str(OUT/f'blender-r0{stage}.png');bpy.ops.render.render(write_still=True)
    mesh.calc_loop_triangles();positions=[];normals=[];rgb=[]
    for tri in mesh.loop_triangles:
        for vertex,loop in zip(tri.vertices,tri.loops):
            v=mesh.vertices[vertex].co;n=tri.normal
            positions.extend([v.x,v.z,-v.y]);normals.extend([n.x,n.z,-n.y]);rgb.extend(colors.data[loop].color[:3])
    data={'source':f'assets/models/optimized/citadel-west-massif/west-massif-r0{stage}.blend','stage':stage,'positions':positions,'normals':normals,'colors':rgb,'nonManifoldEdges':nonmanifold,'closedVolume':nonmanifold==0}
    (ASSET/f'westMassifR0{stage}.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
    report={k:v for k,v in data.items() if k not in ['positions','normals','colors']};report['triangles']=len(positions)//9
    (OUT/f'blender-r0{stage}.json').write_text(json.dumps(report,indent=2));print(report)
