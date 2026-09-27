"""Bake isolated object-joint and cloth shape-key animation, never touch the game."""
import bpy,json,math,sys,hashlib
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
BASE=Path(__file__).resolve().parents[2]
DEST=BASE/'assets/models/optimized/human-courier-production-v2'
round=int(sys.argv[sys.argv.index('--round')+1]);source=DEST/'head-8/courier.blend'
sha=hashlib.sha256(source.read_bytes()).hexdigest()
data=json.loads((DEST/f'motion-round-{round}.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(source))
C=Matrix.Rotation(math.pi/2,4,'X');CI=C.inverted();root=bpy.data.objects['Courier']
pelvis=bpy.data.objects.new('pelvis',None);bpy.context.collection.objects.link(pelvis);pelvis.parent=root;pelvis.location=C.to_3x3()@Vector((0,.93,0));bpy.context.view_layer.update()
for name in ['body','legL','legR']:
    obj=bpy.data.objects[name];world=obj.matrix_world.copy();obj.parent=pelvis;obj.matrix_world=world
bpy.context.view_layer.update()
for side in ['L','R']:
    knee=bpy.data.objects['knee'+side]
    ankle=bpy.data.objects.new('ankle'+side,None);bpy.context.collection.objects.link(ankle);ankle.parent=knee;ankle.location=C.to_3x3()@Vector((0,-.41,0))
    bpy.context.view_layer.update()
    for pre in ['Boot_sole_','Boot_toe_']:
        obj=bpy.data.objects[pre+side];world=obj.matrix_world.copy();obj.parent=ankle;obj.matrix_world=world
bpy.context.view_layer.update()
# Exporter duplicates triangle vertices. Reverse that mapping into each original mesh.
maps={}
for c in data['clips'][0]['frames'][0]['cloth']:
    name=c['name'];obj=bpy.data.objects[name];me=obj.data;me.calc_loop_triangles()
    if name not in maps:
        maps[name]=[]
        for mi in range(len(me.materials)):
            ids=[vi for tri in me.loop_triangles if tri.material_index==mi for vi in tri.vertices]
            if ids:maps[name].append(ids)
        if me.shape_keys:obj.shape_key_clear()
        obj.shape_key_add(name='Basis')
for obj in [root,*root.children_recursive]:obj.animation_data_clear()
scene=bpy.context.scene;scene.render.fps=data['fps'];scene.frame_start=1;cursor=1;ranges=[];previous_quaternions={}
for clip in data['clips']:
    start=cursor
    scene.timeline_markers.new(clip['name'],frame=start)
    for i,f in enumerate(clip['frames']):
        frame=start+i
        for n in f['nodes']:
            obj=bpy.data.objects[n['name']];p=Vector(n['position']);q=n['quaternion'];q=Quaternion((q[3],q[0],q[1],q[2]))
            mat=C@Matrix.LocRotScale(p,q,Vector(n['scale']))@CI
            # Inputs are matrix_local transforms. Clear inherited parent inverse once.
            obj.matrix_parent_inverse=Matrix.Identity(4);obj.matrix_basis=mat;obj.rotation_mode='QUATERNION'
            if n['name'] in previous_quaternions and obj.rotation_quaternion.dot(previous_quaternions[n['name']])<0:obj.rotation_quaternion.negate()
            previous_quaternions[n['name']]=obj.rotation_quaternion.copy()
            obj.keyframe_insert('location',frame=frame);obj.keyframe_insert('rotation_quaternion',frame=frame);obj.keyframe_insert('scale',frame=frame)
        keys={}
        for c in f['cloth']:
            name=c['name'];obj=bpy.data.objects[name]
            if name not in keys:keys[name]=obj.shape_key_add(name=f'{clip["name"]}_{i:03d}')
            key=keys[name];ids=maps[name][c['part']];a=c['position'];assert len(ids)*3==len(a)
            for j,vi in enumerate(ids):key.data[vi].co=C.to_3x3()@Vector(a[j*3:j*3+3])
        for key in keys.values():
            for t,val in [(frame-1,0),(frame,1),(frame+1,0)]:key.value=val;key.keyframe_insert('value',frame=t)
            key.value=0
    cursor=start+len(clip['frames']);ranges.append({'name':clip['name'],'start':start,'end':cursor-1,'fps':data['fps']})
# Linear sampling prevents Bezier overshoot between contact frames.
for action in bpy.data.actions:
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for key in fc.keyframe_points:key.interpolation='LINEAR'
scene.frame_end=cursor-1
bpy.data.objects['letter'].hide_render=True;bpy.data.objects['letter'].hide_viewport=True
for obj in bpy.data.objects:
    if obj.name.startswith('Letter_'):obj.hide_render=True;obj.hide_viewport=True
# Wall appears only during the vault segment and is a review fixture.
bpy.ops.mesh.primitive_cube_add(size=1,location=C.to_3x3()@Vector((0,.525,0)))
wall=bpy.context.object;wall.name='REVIEW_wall_1m05';wall.scale=(3,.24,1.05)
start=ranges[-1]['start']
for fr,hidden in [(1,True),(start-1,True),(start,False),(scene.frame_end,False)]:
    wall.hide_render=hidden;wall.hide_viewport=hidden;wall.keyframe_insert('hide_render',frame=fr);wall.keyframe_insert('hide_viewport',frame=fr)
cam=scene.camera;cam.location=C.to_3x3()@Vector((3.5,2.0,3.5));target=C.to_3x3()@Vector((0,1,.4));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=3.3
scene.frame_set(1)
max_position_error=0;max_cloth_error=0
for clip,rng in zip(data['clips'],ranges):
    for i in [0,len(clip['frames'])//2,len(clip['frames'])-1]:
        scene.frame_set(rng['start']+i);bpy.context.view_layer.update();f=clip['frames'][i]
        for n in f['nodes']:
            actual=(CI@bpy.data.objects[n['name']].matrix_local@C).translation
            max_position_error=max(max_position_error,(actual-Vector(n['position'])).length)
        deps=bpy.context.evaluated_depsgraph_get()
        for c in f['cloth']:
            obj=bpy.data.objects[c['name']].evaluated_get(deps);me=obj.to_mesh();ids=maps[c['name']][c['part']];a=c['position']
            for j,vi in enumerate(ids):max_cloth_error=max(max_cloth_error,(CI.to_3x3()@me.vertices[vi].co-Vector(a[j*3:j*3+3])).length)
            obj.to_mesh_clear()
assert max_position_error<.0001,(max_position_error,'joint bake differs')
assert max_cloth_error<.0001,(max_cloth_error,'cloth bake differs')
scene.frame_set(1)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=3.5;area.spaces.active.region_3d.view_location=C.to_3x3()@Vector((0,1,.4))
out=DEST/f'animation-round-{round}';out.mkdir(exist_ok=True)
readme=bpy.data.texts.get('COURIER_README') or bpy.data.texts.new('COURIER_README')
readme.clear();readme.write('Independent courier candidate. Object joint animation + cloth shape keys.\n'+json.dumps(ranges,indent=2)+'\nReferences: ../human-courier-refinement/reference-pack-v1/. Not integrated into the game.')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'courier-animated.blend'))
(out/'clips.json').write_text(json.dumps({'round':round,'clips':ranges,'sourceSHA256':sha,'rig':'object hierarchy with ankle joints; sampled shape-key cloth','bakeChecks':{'maxLocalPositionError':max_position_error,'maxClothVertexError':max_cloth_error},'status':'review candidate; no production integration'},indent=2))
scene.frame_set(ranges[-1]['start']+20);scene.cycles.samples=8;scene.render.resolution_x=900;scene.render.resolution_y=700
scene.render.filepath=str(BASE/f'artifacts/pipeline/courier-production-v2/blender-vault-round-{round}.png');bpy.ops.render.render(write_still=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==sha
print('COURIER_BAKE_COMPLETE',round,ranges)
