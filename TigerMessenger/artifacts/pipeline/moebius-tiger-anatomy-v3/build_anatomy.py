import bpy,bmesh,math,json,hashlib
from mathutils import Matrix,Vector
from pathlib import Path
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');ev=base/'artifacts/pipeline/moebius-tiger-anatomy-v3'
s=bpy.data.scenes['Tiger Anatomy V3'];bpy.context.window.scene=s
nodes={o.get('three_node_id'):o for o in s.objects if o.get('three_node_id')}
assert len(nodes)==80
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));Ci=C.inverted()
def transform(o,pos=(0,0,0),rot=0,scale=(1,1,1)):
 m=Matrix.Translation(Vector(pos))@Matrix.Rotation(rot,4,'X')@Matrix.Diagonal(Vector((*scale,1)));o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_basis=C@m@Ci
rest_before={id:{'parent':o.parent.get('three_node_id')if o.parent else None,'matrix':[list(row)for row in Ci@o.matrix_local@C]}for id,o in nodes.items()}
for id,o in nodes.items():
 ud=json.loads(o.get('three_userData','{}'))
 if ud.get('isOutline'):
  o.hide_render=True;o.hide_set(True);o['candidateHiddenOutline']=True
# Deliberately use a visible charcoal base; never multiply a dark map by black.
img=bpy.data.images.new('Tiger_V3_Ink_Stripes',width=512,height=256)
pixels=[]
for y in range(256):
 v=y/255
 for x in range(512):
  u=x/511;phase=u*12+.13*math.sin(v*math.pi*6+u*8)+.075*math.sin(v*math.pi*13+u*3)
  d=abs((phase+.5)%1-.5);width=.085+.055*(.5+.5*math.sin(v*11+int(u*12)*1.9))
  fork=abs(((phase+.23*math.sin(v*8))+.5)%1-.5)<width*.32 and math.sin(v*15+u*3)>.2
  ink=d<width or fork
  val=(.045,.055,.058)if ink else(.24,.265,.275)
  pixels.extend((*val,1))
img.pixels.foreach_set(pixels);img.pack()
def mat(name,col,image=None):
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=.82
 if image:
  tx=m.node_tree.nodes.new('ShaderNodeTexImage');tx.image=image;m.node_tree.links.new(tx.outputs['Color'],bs.inputs['Base Color'])
 return m
ink=mat('Tiger_V3_Charcoal_Striped',(1,1,1),img);dark=mat('Tiger_V3_Deep_Ink',(.012,.018,.020));white=mat('Tiger_V3_Ivory',(.76,.73,.66));nosemat=mat('Tiger_V3_Nose',(.025,.02,.018));red=mat('Tiger_V3_Red_Eyes',(.45,.018,.015));earmat=mat('Tiger_V3_Ear_Inner',(.09,.11,.105))
def meshdata(name,verts,faces,uv=None):
 m=bpy.data.meshes.new(name);m.from_pydata([(x,-z,y)for x,y,z in verts],[],faces);m.update()
 bm=bmesh.new();bm.from_mesh(m);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(m);bm.free()
 layer=m.uv_layers.new(name='TigerSurfaceUV')
 for poly in m.polygons:
  for li in poly.loop_indices:
   vi=m.loops[li].vertex_index
   layer.data[li].uv=uv[vi]if uv else((verts[vi][2]+3)/6,(verts[vi][1]+2.5)/5)
 return m
def assign(id,verts,faces,material,uv=None):
 o=nodes[id];o.data=meshdata('Anatomy_'+id,verts,faces,uv);o.data.materials.append(material);transform(o);return o
def create(name,parent,verts,faces,material,uv=None):
 o=bpy.data.objects.new(name,meshdata(name,verts,faces,uv));s.collection.objects.link(o);o.parent=parent;o.data.materials.append(material);transform(o);o['candidateAddition']=True;return o
# Loft along Z. Cross section x radius/y radius and asymmetric height centre.
def loftZ(rings,N=20):
 v=[];uv=[]
 for j,(z,c,rx,ry)in enumerate(rings):
  for i in range(N+1):
   a=2*math.pi*i/N;v.append((rx*math.cos(a),c+ry*math.sin(a),z));uv.append((j/(len(rings)-1),i/N))
 f=[]
 for j in range(len(rings)-1):
  for i in range(N):a=j*(N+1)+i;f.append((a,a+1,a+N+2,a+N+1))
 f.extend([tuple(range(N-1,-1,-1)),tuple((len(rings)-1)*(N+1)+i for i in range(N))]);return v,f,uv
# Loft along Y: anatomically defined shoulder, elbow/carpus and hind hock.
def loftY(rings,N=12):
 v=[];uv=[]
 for j,(y,cz,rx,rz)in enumerate(rings):
  for i in range(N+1):a=2*math.pi*i/N;v.append((rx*math.cos(a),y,cz+rz*math.sin(a)));uv.append((j/(len(rings)-1),i/N))
 f=[]
 for j in range(len(rings)-1):
  for i in range(N):a=j*(N+1)+i;f.append((a,a+1,a+N+2,a+N+1))
 f.extend([tuple(range(N-1,-1,-1)),tuple((len(rings)-1)*(N+1)+i for i in range(N))]);return v,f,uv
# Squared-superellipse patches make broad muzzle pads, not tiny spherical cat snouts.
def patch(center,radii,N=16,L=10,power=1):
 v=[];uv=[]
 for j in range(L+1):
  lat=-math.pi/2+j*math.pi/L
  for i in range(N+1):
   a=2*math.pi*i/N
   def sp(t):return math.copysign(abs(t)**power,t)
   v.append((center[0]+radii[0]*sp(math.cos(lat)*math.cos(a)),center[1]+radii[1]*sp(math.sin(lat)),center[2]+radii[2]*sp(math.cos(lat)*math.sin(a))));uv.append((i/N,j/L))
 f=[]
 for j in range(L):
  for i in range(N):a=j*(N+1)+i;f.append((a,a+1,a+N+2,a+N+1))
 return v,f,uv
transform(nodes['n0'],scale=(.4,.4,.4));transform(nodes['n1'],(0,2.4,0));transform(nodes['n8'],(0,.72,2.45))
v,f,u=loftZ([(-2.8,.0,.20,.35),(-2.55,.06,.72,.78),(-2.0,.12,1.01,1.02),(-1.4,.06,1.0,1.02),(-.6,-.03,.93,.96),(.2,.03,1.01,1.04),(.95,.12,1.10,1.16),(1.55,.24,1.10,1.24),(2.0,.32,.92,1.08),(2.35,.36,.50,.73)])
assign('n2',v,f,ink,u)
# Old haunch identity retained, mesh integrated into continuous torso rather than another ball.
assign('n4',[],[],ink);nodes['n4']['integratedInto']='n2'
v,f,u=loftZ([(1.2,.15,.73,.85),(1.65,.28,.93,1.15),(2.0,.42,.82,1.15),(2.35,.58,.70,.96),(2.65,.68,.48,.72)])
assign('n6',v,f,ink,u)
v,f,u=loftZ([(-.82,.02,.30,.40),(-.60,.05,.72,.67),(-.25,.03,.96,.77),(.15,.02,1.0,.72),(.55,-.10,.82,.58),(.88,-.18,.57,.40),(1.06,-.25,.34,.24)],20)
assign('n9',v,f,ink,u)
for id,sign in [('n11',-1),('n13',1)]:
 v,f,u=patch((sign*.61,-.35,.49),(.46,.42,.53),12,7,.82);assign(id,v,f,ink,u)
for id,sign in [('n15',-1),('n17',1)]:
 v,f,u=patch((sign*.76,.67,-.43),(.235,.27,.12),12,8,1);assign(id,v,f,dark,u)
 v,f,u=patch((sign*.76,.68,-.315),(.14,.18,.025),12,6,1);create('Tiger_Round_Ear_Inner_'+id,nodes['n8'],v,f,earmat,u)
for id,sign in [('n19',-1),('n21',1)]:
 v,f,u=patch((sign*.59,.09,.807),(.14,.092,.045),12,6,.85);assign(id,v,f,red,u)
 v,f,u=patch((sign*.59,.09,.850),(.045,.072,.012),10,6,1);create('Tiger_Round_Pupil_'+id,nodes['n8'],v,f,dark,u)
 v,f,u=patch((sign*.58,.205,.79),(.29,.085,.16),12,6,.65);create('Tiger_Heavy_Brow_'+id,nodes['n8'],v,f,ink,u)
# Two distinct broad ivory whisker pads and an ivory lower jaw.
v1,f1,u1=patch((-.285,-.405,1.03),(.32,.245,.31),14,8,.75);v2,f2,u2=patch((.285,-.405,1.03),(.32,.245,.31),14,8,.75)
assign('n23',v1+v2,f1+[tuple(x+len(v1)for x in f)for f in f2],white,u1+u2)
v,f,u=patch((0,-.65,.92),(.43,.16,.35),14,8,.75);create('Tiger_Ivory_Chin',nodes['n8'],v,f,white,u)
v,f,u=loftZ([(.57,-.08,.28,.18),(.91,-.15,.30,.20),(1.22,-.22,.23,.13)],12);create('Tiger_Broad_Nasal_Bridge',nodes['n8'],v,f,ink,u)
v=[(-.23,-.20,1.25),(.23,-.20,1.25),(.17,-.34,1.30),(0,-.405,1.30),(-.17,-.34,1.30),(-.20,-.20,1.36),(.20,-.20,1.36),(.14,-.33,1.38),(0,-.39,1.38),(-.14,-.33,1.38)]
f=[(4,3,2,1,0),(5,6,7,8,9)]+[(i,(i+1)%5,(i+1)%5+5,i+5)for i in range(5)];assign('n25',v,f,nosemat)
# Whisker follicle dots follow ivory pad curvature; subtle, no long stiff rods.
vv=[];ff=[]
for sign in [-1,1]:
 for i in range(3):
  for j in range(2):
   v,f,u=patch((sign*(.20+i*.11),-.39-j*.075,1.315-i*.035),(.022,.018,.015),6,4);off=len(vv);vv+=v;ff +=[tuple(x+off for x in face)for face in f]
create('Tiger_Whisker_Follicles',nodes['n8'],vv,ff,dark)
# Four articulated source leg groups; long lower legs and broad toes are geometry under them.
for k,legid in enumerate(['n52','n59','n66','n73']):
 side=-1 if k%2==0 else 1;front=k<2;transform(nodes[legid],(side*(.87 if front else .85),2.10,1.53 if front else -1.78))
 upper,paw,pad=(['n53','n55','n57']if k==0 else ['n60','n62','n64']if k==1 else ['n67','n69','n71']if k==2 else ['n74','n76','n78'])
 rings=[(.66,-.03,.43,.50),(.18,0,.47,.45),(-.45,.01,.35,.37),(-1.0,.04,.29,.29),(-1.60,.09,.255,.255),(-1.86,.15,.28,.28)]if front else[(.45,-.12,.51,.62),(.02,-.05,.52,.52),(-.60,.20,.37,.42),(-1.10,.30,.24,.29),(-1.55,-.08,.23,.25),(-1.86,.09,.25,.25)]
 v,f,u=loftY(rings);assign(upper,v,f,ink,u)
 v,f,u=patch((0,-1.918,.19),(.40,.182,.45),14,7,.66)
 for t in range(4):
  vt,ft,ut=patch(((t-1.5)*.182,-1.939,.48),(.115,.161,.25),10,6,.80);off=len(v);v+=vt;f +=[tuple(x+off for x in face)for face in ft];u+=ut
 assign(paw,v,f,white,u)
 # Old under-paw pad becomes a small dark sole, above common ground plane.
 v,f,u=patch((0,-2.077,.13),(.30,.021,.32),10,5);assign(pad,v,f,dark,u)
# Eight original +Y joints now form a long dropping tail with a raised white tip.
lengths=[.5,.55,.6,.6,.6,.6,.55,.45];radii=[.25,.235,.22,.20,.18,.16,.135,.10,.04];jointids=['n28','n31','n34','n37','n40','n43','n46','n49'];meshids=['n29','n32','n35','n38','n41','n44','n47','n50'];bends=[0,0,5,10,15,18,20,20]
transform(nodes['n27'],(0,.20,-2.6),math.radians(-150))
for i,(jid,mid)in enumerate(zip(jointids,meshids)):
 transform(nodes[jid],(0,0 if i==0 else lengths[i-1]*.98,0),math.radians(bends[i]));v,f,u=loftY([(0,0,radii[i],radii[i]),(lengths[i],0,radii[i+1],radii[i+1])],12);assign(mid,v,f,white if i>=6 else ink,u)
# Eye light anchors retain their IDs but move with new wide-set eyes.
for id,sign in [('n20',-1),('n22',1)]:transform(nodes[id],(sign*.60,.10,.94))
# Freeze real geometry candidate before adding review-only lights/cameras/ground.
for o in nodes.values():o.select_set(True)
for o in s.objects:
 if o.get('candidateAddition'):o.select_set(True)
bpy.context.view_layer.objects.active=nodes['n0']
bpy.data.libraries.write(str(base/'assets/models/optimized/moebius-tiger-anatomy-v3.blend'),{s},fake_user=True,compress=True)
# Keep hidden outline identities for runtime, but serialize visibility marker for engine filtering.
for o in nodes.values():
 if o.get('candidateHiddenOutline'):o.hide_set(False)
bpy.ops.export_scene.gltf(filepath=str(base/'godot/assets/art-pilots/moebius-tiger-anatomy-v3.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
for o in nodes.values():
 if o.get('candidateHiddenOutline'):o.hide_set(True)
rest_after={id:{'parent':o.parent.get('three_node_id')if o.parent else None,'matrix':[list(row)for row in Ci@o.matrix_local@C]}for id,o in nodes.items()}
assert all(rest_before[id]['parent']==rest_after[id]['parent']for id in nodes)
report={'sourceIds':list(nodes),'sourceIdCount':80,'parentsUnchanged':True,'rootId':'n0','rootScale':.4,'axis':'Godot Y up +Z head; tail joint local +Y retained','restBefore':rest_before,'restAfter':rest_after,'legIds':['n52','n59','n66','n73'],'headId':'n8','bodyId':'n1','tailRootId':'n27','tailJointIds':jointids,'tailLengths':lengths,'tailRestLeanDegrees':-150,'tailRestBendsDegrees':bends,'hiddenOutlineKey':'candidateHiddenOutline','doNotRunOldAbsolutePose':True,'engineInstruction':'Apply original gait/drinking/sway deltas relative to candidate rest; replace n0 world placement with captured source transform instead of multiplying .4 again.','stage':'geometry/anatomy candidate; runtime integration remains separate','mcpRecovered':'registered missing _drain_command_queue timer via visible Blender Console; no restart or source save'}
(ev/'assembly.json').write_text(json.dumps(report,indent=2))
s.render.engine='CYCLES';s.cycles.samples=24;s.render.resolution_x=1100;s.render.resolution_y=800;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('Tiger_Anatomy_Review_World');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.34,.36,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.7
cd=bpy.data.cameras.new('Tiger_Review_Camera');cam=bpy.data.objects.new('Tiger_Review_Camera',cd);s.collection.objects.link(cam);s.camera=cam;cd.type='ORTHO';cd.ortho_scale=5.4
target=Vector((0,.20,.83))
for name,loc,power,size in [('Tiger_Key',(-3,-4,6),450,4),('Tiger_Fill',(4,-1,3),220,3),('Tiger_Rim',(1,4,4),500,3)]:
 ld=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,ld);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();ld.energy=power;ld.size=size
for label,loc in [('side',(6,-1.0,2.4)),('front',(2,-7,2.8))]:
 cam.location=loc;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(ev/('round1-'+label+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps({'stage':'round1','sourceIds':80,'parentsUnchanged':True,'glb':'moebius-tiger-anatomy-v3.glb'}))
