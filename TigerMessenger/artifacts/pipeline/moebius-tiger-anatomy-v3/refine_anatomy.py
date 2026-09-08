import bpy,bmesh,math,json
from mathutils import Matrix,Vector
from pathlib import Path
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');ev=base/'artifacts/pipeline/moebius-tiger-anatomy-v3';s=bpy.data.scenes['Tiger Anatomy V3'];bpy.context.window.scene=s
nodes={o.get('three_node_id'):o for o in s.objects if o.get('three_node_id')};C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));Ci=C.inverted()
def transform(o,pos=(0,0,0),rot=0,scale=(1,1,1)):
 o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_basis=C@(Matrix.Translation(Vector(pos))@Matrix.Rotation(rot,4,'X')@Matrix.Diagonal(Vector((*scale,1))))@Ci
ink=bpy.data.materials['Tiger_V3_Charcoal_Striped'];dark=bpy.data.materials['Tiger_V3_Deep_Ink'];white=bpy.data.materials['Tiger_V3_Ivory']
source=(ev/'build_anatomy.py').read_text();exec(source[source.index('def meshdata'):source.index("transform(nodes['n0']")])
def make_pattern(name,count,face=False):
 image=bpy.data.images.get(name)or bpy.data.images.new(name,width=512,height=256);pixels=[]
 for y in range(256):
  v=y/255
  for x in range(512):
   u=x/511
   if face:
    xx=(u-.5)*2.4;yy=v*2-1;ax=abs(xx)
    inked=(.26<yy<.74 and ax<(.028+.03*math.sin(yy*5))) or(.3<yy<.72 and abs(ax-(.12+.22*(yy-.3)))<.028) or(.33<yy<.64 and abs(ax-(.35+.12*math.sin(yy*7)))<.042)
    if .43<ax<1.05:
     for j in range(4):
      line=-.66+j*.20+.14*math.sin((ax-.43)*5+j*.35)
      if abs(yy-line)<(.018+.040*(ax-.43)/.62):inked=True
    inked=inked or(-.07<yy<.23 and ax<.045+.055*(.23-yy))
   else:
    phase=u*count+.23*math.sin(v*6+u*12)+.08*math.sin(v*19+u*7);d=abs((phase+.5)%1-.5);width=.105+.065*math.sin(v*5+int(u*count)*2)**2
    inked=d<width or(abs(((phase+.21*math.sin(v*9))+.5)%1-.5)<width*.30 and math.sin(v*14+u*8)>.4)
   pixels.extend((.005,.008,.010,1)if inked else(.047,.060,.066,1))
 image.pixels.foreach_set(pixels);image.update();image.pack();return image
bodyimg=make_pattern('Tiger_V3_Ink_Stripes',8)
for node in ink.node_tree.nodes:
 if node.type=='TEX_IMAGE':node.image=bodyimg
materials={}
for name,count,face in [('Leg',3.2,False),('Tail',1.05,False),('Face',0,True)]:
 m=ink.copy();m.name='Tiger_V3_'+name+'_Pattern';im=make_pattern('Tiger_V3_'+name+'_Image',count,face)
 for nd in m.node_tree.nodes:
  if nd.type=='TEX_IMAGE':nd.image=im
 materials[name]=m
# Higher alert head, neck follows without changing original joint hierarchy.
transform(nodes['n8'],(0,.90,2.45))
v,f,u=loftZ([(1.2,.15,.73,.85),(1.65,.33,.93,1.17),(2.0,.50,.83,1.20),(2.35,.72,.70,1.04),(2.65,.86,.48,.73)])
assign('n6',v,f,ink,u)
# Recess upper leg caps inside the torso; retain substantial deltoid/thigh volume.
for k,upper in enumerate(['n53','n60','n67','n74']):
 front=k<2
 rings=[(.86,-.03,.045,.08),(.56,-.03,.27,.37),(.20,0,.42,.43),(-.45,.01,.35,.37),(-1.0,.04,.29,.29),(-1.60,.09,.255,.255),(-1.86,.15,.28,.28)]if front else[(.70,-.12,.045,.08),(.40,-.10,.28,.41),(.02,-.05,.46,.49),(-.60,.20,.37,.42),(-1.10,.30,.24,.29),(-1.55,-.08,.23,.25),(-1.86,.09,.25,.25)]
 v,f,u=loftY(rings);assign(upper,v,f,materials['Leg'],u)
for id,sign in [('n11',-1),('n13',1)]:
 v,f,u=patch((sign*.58,-.35,.51),(.40,.35,.48),12,7,.82);assign(id,v,f,materials['Face'],u)
for id in ['n9','n11','n13']:
 o=nodes[id];o.data.materials.clear();o.data.materials.append(materials['Face'])
 layer=o.data.uv_layers.active
 for loop in o.data.loops:
  v=Ci@o.data.vertices[loop.vertex_index].co
  layer.data[loop.index].uv=((v.x+1.2)/2.4,(v.y+1)/2)
for o in s.objects:
 if o.name.startswith('Tiger_Broad_Nasal_Bridge'):
  o.data.materials.clear();o.data.materials.append(dark)
 if o.name.startswith('Tiger_Heavy_Brow'):
  o.data.materials.clear();o.data.materials.append(dark)
for id in ['n29','n32','n35','n38','n41','n44']:
 nodes[id].data.materials.clear();nodes[id].data.materials.append(materials['Tail'])
# Fine whiskers taper to tips; one combined mesh under head (no rigid large rods).
v=[];f=[]
for sign in [-1,1]:
 for j in range(4):
  points=[Vector((sign*(.38+t*.68),-.45+(j-1.5)*.06+t*(j-1.4)*.07,1.20+t*.09-t*t*.12))for t in [0,.33,.66,1]]
  for k in range(3):
   a,b=points[k:k+2];direction=(b-a).normalized();right=direction.cross(Vector((0,1,0))).normalized();up=direction.cross(right).normalized();off=len(v)
   for point,radius in [(a,.0045*(1-k/4)),(b,.0045*(1-(k+1)/4))]:
    for i in range(5):ang=i*2*math.pi/5;v.append(tuple(point+radius*(right*math.cos(ang)+up*math.sin(ang))))
   f +=[(off+i,off+(i+1)%5,off+(i+1)%5+5,off+i+5)for i in range(5)]
create('Tiger_Fine_Whiskers',nodes['n8'],v,f,white)
# Save only the intended candidate hierarchy plus review helpers in .blend;
# selection explicitly restricts glTF to original IDs and candidate additions.
for o in s.objects:o.select_set(bool(o.get('three_node_id')or o.get('candidateAddition')))
for o in nodes.values():
 if o.get('candidateHiddenOutline'):o.hide_set(False)
bpy.context.view_layer.objects.active=nodes['n0']
bpy.data.libraries.write(str(base/'assets/models/optimized/moebius-tiger-anatomy-v3.blend'),{s},fake_user=True,compress=True)
bpy.ops.export_scene.gltf(filepath=str(base/'godot/assets/art-pilots/moebius-tiger-anatomy-v3.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
for o in nodes.values():
 if o.get('candidateHiddenOutline'):o.hide_set(True)
r=json.loads((ev/'assembly.json').read_text());r['restAfter']={id:{'parent':o.parent.get('three_node_id')if o.parent else None,'matrix':[list(row)for row in Ci@o.matrix_local@C]}for id,o in nodes.items()};r['iteration']=2;r['anatomyChanges']=['continuous elongated torso profile','deep shoulder/chest neck','broad flat skull and nasal bridge','two ivory muzzle lobes and chin','small rounded ears','wide-set red eyes','four strong articulated legs with rounded white toes','eight source tail joints curved down and back, ivory tip'];(ev/'assembly.json').write_text(json.dumps(r,indent=2))
target=Vector((0,.20,.86));cam=s.camera;cam.data.ortho_scale=5.4
for label,loc in [('side',(6,-1.0,2.4)),('front',(2,-7,2.8))]:
 cam.location=loc;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(ev/('round2-'+label+'.png'));bpy.ops.render.render(write_still=True)
print('Tiger anatomy round2 exported and rendered')
