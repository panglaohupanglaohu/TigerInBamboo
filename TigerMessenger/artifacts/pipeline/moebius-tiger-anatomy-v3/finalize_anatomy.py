import bpy,json
from pathlib import Path
from mathutils import Vector
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger');ev=base/'artifacts/pipeline/moebius-tiger-anatomy-v3';s=bpy.data.scenes['Tiger Anatomy V3'];bpy.context.window.scene=s
nodes={o.get('three_node_id'):o for o in s.objects if o.get('three_node_id')}
# PNG is sRGB, so use charcoal sRGB values rather than accidentally double-darkening it.
for name in ['Tiger_V3_Ink_Stripes','Tiger_V3_Leg_Image','Tiger_V3_Tail_Image','Tiger_V3_Face_Image']:
 im=bpy.data.images[name];pixels=list(im.pixels)
 for i in range(0,len(pixels),4):
  col=(.025,.032,.040)if pixels[i]<.02 else(.18,.205,.22)
  pixels[i:i+3]=col
 im.pixels.foreach_set(pixels);im.pack()
for id,sign in [('n15',-1),('n17',1)]:
 o=nodes[id];center=Vector((sign*.76,.43,.67))
 for v in o.data.vertices:v.co=center+(v.co-center)*.78
for o in s.objects:
 if o.name.startswith('Tiger_Round_Ear_Inner'):
  sign=-1 if 'n15' in o.name else 1;center=Vector((sign*.76,.315,.68))
  for v in o.data.vertices:v.co=center+(v.co-center)*.78
 if o.name.startswith('Tiger_Heavy_Brow'):
  for v in o.data.vertices:v.co.z=.18+(v.co.z-.205)*.50
for o in s.objects:o.select_set(bool(o.get('three_node_id')or o.get('candidateAddition')))
# Export explicitly includes the 30 retained outline IDs, tagged for engine hiding.
for o in nodes.values():
 if o.get('candidateHiddenOutline'):o.hide_set(False);o.hide_render=False;o.select_set(True)
bpy.context.view_layer.objects.active=nodes['n0']
bpy.ops.export_scene.gltf(filepath=str(base/'godot/assets/art-pilots/moebius-tiger-anatomy-v3.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
for o in nodes.values():
 if o.get('candidateHiddenOutline'):o.hide_set(True);o.hide_render=True
bpy.data.libraries.write(str(base/'assets/models/optimized/moebius-tiger-anatomy-v3.blend'),{s},fake_user=True,compress=True)
r=json.loads((ev/'assembly.json').read_text());r['iteration']=3;r['textureContract']='4 embedded sRGB PNGs: charcoal .18/.205/.22, ink .025/.032/.040; material base factor white, no black multiplier';(ev/'assembly.json').write_text(json.dumps(r,indent=2))
target=Vector((0,.20,.86));cam=s.camera
for label,loc in [('side',(6,-1.0,2.4)),('front',(2,-7,2.8))]:
 cam.location=loc;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(ev/('final-'+label+'.png'));bpy.ops.render.render(write_still=True)
print('Final candidate rendered; all 80 original IDs selected for export')
