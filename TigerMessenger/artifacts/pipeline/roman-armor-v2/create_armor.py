import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector, Matrix
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');ev=base/'artifacts/pipeline/roman-armor-v2'
assert 'Roman Armor V2' not in bpy.data.scenes
scene=bpy.data.scenes.new('Roman Armor V2');bpy.context.window.scene=scene
root=bpy.data.objects.new('Roman_Armor_V2_BodyLocal',None);scene.collection.objects.link(root)
ref=bpy.data.scenes['Roman Armor Original Reference'];refnodes={o.get('three_node_id'):o for o in ref.objects}
def mat(name,node):
 m=bpy.data.materials.new(name);m.diffuse_color=refnodes[node].data.materials[0].diffuse_color;m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=m.diffuse_color;bs.inputs['Roughness'].default_value=.8;return m
gold=mat('Roman_V2_Original_Bronze','n9');dark=mat('Roman_V2_Original_Skirt','n5')
parts={}
def add(name,v,f):
 pv,pf=parts.setdefault(name,([],[]));offset=len(pv);pv.extend(v);pf.extend([tuple(i+offset for i in face)for face in f])
def box(name,c,d):
 x,y,z=c;dx,dy,dz=[a*.5 for a in d];v=[(x-dx,y-dy,z-dz),(x+dx,y-dy,z-dz),(x+dx,y+dy,z-dz),(x-dx,y+dy,z-dz),(x-dx,y-dy,z+dz),(x+dx,y-dy,z+dz),(x+dx,y+dy,z+dz),(x-dx,y+dy,z+dz)];f=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)];add(name,v,f)
# A hand-shaped ring profile: hollow faceted calotte, not a scaled primitive sphere.
N=12;v=[];rings=[(.214,.054,.038),(.232,.050,.036),(.252,.037,.029),(.266,.018,.016),(.272,.003,.003)]
for inset in [0,.004]:
 for y,rx,rz in rings:
  for i in range(N):
   a=2*math.pi*i/N;v.append(((rx-inset if rx>inset else .001)*math.cos(a),y-inset,(rz-inset if rz>inset else .001)*math.sin(a)))
f=[];L=len(rings)
for side in range(2):
 off=side*N*L
 for ring in range(L-1):
  for i in range(N): f.append((off+ring*N+i,off+ring*N+(i+1)%N,off+(ring+1)*N+(i+1)%N,off+(ring+1)*N+i))
 f.append(tuple(off+(L-1)*N+i for i in range(N)))
for i in range(N):f.append((i,(i+1)%N,L*N+(i+1)%N,L*N+i))
add('Helmet_Galea',v,f)
# Separate narrow brow, short independent cheeks, rear nape flange, crest socket.
# +Z is face/front; central face opening stays clear below y=.207.
box('Helmet_Galea',(0,.215,.036),(.108,.015,.010))
for sign in [-1,1]:
 # Tapered cheek plates with angled lower end.
 x=sign*.048;outer=x+sign*.007;inner=x-sign*.004
 yz=[(.210,.012),(.207,.034),(.159,.031),(.156,.018)]
 vs=[(xx,y,z)for xx in [inner,outer]for y,z in yz]
 add('Helmet_Galea',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
box('Helmet_Galea',(0,.194,-.038),(.086,.038,.010))
box('Helmet_Galea',(0,.281,0),(.028,.030,.021))
# Ten separated, tapered leather plates: each a closed prism, no connecting hem.
for i in range(10):
 a=2*math.pi*i/10;half=math.pi/10*.76
 v=[]
 for inset in [0,.005]:
  for y,rx,rz in [(-.004,.073,.048),(-.062,.090,.060)]:
   for t in [a-half,a+half]:v.append(((rx-inset)*math.cos(t),y,(rz-inset)*math.sin(t)))
 add('Skirt_Ten_Separated_Lames',v,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)])
# Fitted elliptical belt and modest original-bronze studs.
v=[]
for y in [-.007,.010]:
 for rx,rz in [(.076,.052),(.068,.044)]:
  for i in range(20):a=2*math.pi*i/20;v.append((rx*math.cos(a),y,rz*math.sin(a)))
f=[]
for i in range(20):
 j=(i+1)%20;f.extend([(i,j,40+j,40+i),(20+i,60+i,60+j,20+j),(i,20+i,20+j,j),(40+i,40+j,60+j,60+i)])
add('Waist_Belt',v,f)
for i in range(10):
 a=2*math.pi*i/10;box('Helmet_Galea',(.077*math.cos(a),.002,.053*math.sin(a)),(.010,.012,.009))
for name,(v,f) in parts.items():
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,y)for x,y,z in v],[],f);mesh.update();bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
 obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.parent=root;mesh.materials.append(gold if name=='Helmet_Galea' else dark)
root['attachToOriginalNodeId']='n2';root['bodyLocalYUp']=True
out=base/'assets/models/optimized/roman-armor-v2.blend';bpy.data.libraries.write(str(out),{scene},fake_user=True,compress=True)
for o in scene.objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(base/'godot/assets/art-pilots/roman-armor-v2.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
assembly={'schema':'TigerMessenger.roman-armor-v2','resource':'res://assets/art-pilots/roman-armor-v2.glb','attachBodyNodeId':'n2','attachTransform':'identity; source body local Y-up','hideOriginalNodeIds':['n5','n9'],'hideDescendants':True,'retainOriginalNodeIds':['n0','n1','n2','n3','n7','n11','n13','n15','n17','n20','n23','n26','n31'],'crestNodeIds':['n11','n13','n15'],'crestOffset':[0,0,0],'crestSocketYRange':[.266,.296],'originalCrestMinY':.292,'skirtPlateCount':10,'skirtYRange':[-.062,-.004],'originalSkirtYRange':[-.084840275,.004840272],'sourceHeadBounds':[[-.043719266,.043719266],[.133593798,.242406189],[-.030117717,.030117717]],'frontAxis':'+Z','colors':'copied original Blender n9 bronze / n5 dark leather material diffuse values','variants':['romanSoldier_gladius_blue','romanSoldier_gladius_red'],'scope':'wearables only; root/fig/body/limbs/equipment/crest geometries retained'}
(ev/'assembly.json').write_text(json.dumps(assembly,indent=2))
# Context render uses actual original geometry in body-local coordinates, not proxy body shapes.
src=json.loads((base/'assets/models/originals/supplemental/romanSoldier_gladius_blue.source.json').read_text());nd={n['id']:n for n in src['nodes']}
worlds={}
for n in src['nodes']:
 m=Matrix([n['matrix'][i::4]for i in range(4)]);worlds[n['id']]=worlds[n['parent']]@m if n['parent'] else m
body_inv=worlds['n2'].inverted()
for id in ['n3','n7','n11','n13','n15','n18','n21','n24','n27']:
 n=nd[id];g=src['geometries'][n['geometry']];vals=g['attributes']['position']['values'];trans=body_inv@worlds[id]
 vv=[trans@Vector(vals[i:i+3])for i in range(0,len(vals),3)]
 idx=g.get('index');ii=idx['values'] if isinstance(idx,dict) else (idx if idx else list(range(len(vv))))
 ff=[ii[i:i+3]for i in range(0,len(ii),3)];mesh=bpy.data.meshes.new('Context_'+id);mesh.from_pydata([(v.x,-v.z,v.y)for v in vv],[],ff);mesh.update();o=bpy.data.objects.new('Context_'+id,mesh);scene.collection.objects.link(o)
 m=bpy.data.materials.new('ContextMat_'+id);m.diffuse_color=refnodes[id].data.materials[0].diffuse_color;m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=m.diffuse_color;m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;mesh.materials.append(m)
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Roman_Armor_Context_World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.38,.43,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
camdata=bpy.data.cameras.new('Armor_Camera');cam=bpy.data.objects.new('Armor_Camera',camdata);scene.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO';camdata.ortho_scale=.64
target=Vector((0,0,.135))
lampdata=bpy.data.lights.new('Armor_Key','AREA');lamp=bpy.data.objects.new('Armor_Key',lampdata);scene.collection.objects.link(lamp);lamp.location=(-1,-1,2);lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler();lampdata.energy=80;lampdata.size=2
for label,loc in [('front',(.30,-1.7,.44)),('side',(1.7,-.20,.35))]:
 cam.location=loc;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ev/('armor-'+label+'.png'));bpy.ops.render.render(write_still=True)
print(json.dumps(assembly))
