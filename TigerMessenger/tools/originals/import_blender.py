"""Import an original Three.js snapshot, preserving mesh data and hierarchy.
Usage: blender --background --python tools/originals/import_blender.py -- bookshop
This creates an editable archive, not a replacement design or runtime migration.
"""
import bpy,json,sys,math,base64,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
root=Path(__file__).resolve().parents[2]
asset=sys.argv[sys.argv.index('--')+1]
source=root/'assets/models/originals'/f'{asset}.source.json'
data=json.loads(source.read_text())
revision_dir=source.parent/'blender-r3'
revision_dir.mkdir(exist_ok=True)
asset_basename=Path(asset).name
out=revision_dir/f'{asset_basename}.blend'
if out.exists():raise RuntimeError('Archive exists; use a new revision to preserve edits: '+str(out))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.view_settings.view_transform='Standard'
scene.unit_settings.system='METRIC'
collection=bpy.data.collections.new(data['provenance']['label']+' · 原模型');scene.collection.children.link(collection)
C=Matrix.Rotation(math.pi/2,4,'X')
images={};materials={};meshes={};objects={};warnings=list(data['warnings'])
instance_objects=[];node_meshes={};primitive_counts={'Line':0,'LineSegments':0,'LineLoop':0,'Points':0};effective_visible={}
for key,tex in data['textures'].items():
    if tex.get('png'):
        texture_dir=source.parent/'textures';texture_dir.mkdir(exist_ok=True)
        payload=base64.b64decode(tex['png'].split(',',1)[1]);path=texture_dir/(hashlib.sha256(payload).hexdigest()+'.png')
        if not path.exists():path.write_bytes(payload)
        img=bpy.data.images.load(str(path),check_existing=True);img.pack();images[key]=img
for key,src in data['materials'].items():
    mat=bpy.data.materials.new(src.get('name') or f"{src['type']}_{key[:8]}")
    mat.use_nodes=True
    mat['three_uuid']=key;mat['three_source']=json.dumps(src,ensure_ascii=False)
    col=src.get('color',[1,1,1]);alpha=src.get('opacity',1)
    mat.diffuse_color=(*col,alpha)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links
    bsdf=nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*col,alpha)
    bsdf.inputs['Roughness'].default_value=src.get('roughness',.85)
    bsdf.inputs['Metallic'].default_value=src.get('metalness',0)
    bsdf.inputs['Alpha'].default_value=alpha
    em=src.get('emissive',[0,0,0]);bsdf.inputs['Emission Color'].default_value=(*em,1)
    bsdf.inputs['Emission Strength'].default_value=src.get('emissiveIntensity',1)
    texkey=src.get('map',{}).get('textureRef')
    base=nodes.new('ShaderNodeRGB');base.outputs[0].default_value=(*col,1)
    color_output=base.outputs[0]
    def multiply_color(first, second):
        mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
        links.new(first,mix.inputs[1]);links.new(second,mix.inputs[2]);return mix.outputs[0]
    if texkey in images:
        tex=nodes.new('ShaderNodeTexImage');tex.image=images[texkey]
        coords=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeMapping');mapping.vector_type='POINT'
        original=data['textures'][texkey]
        # Three's texture.matrix: rotation about center followed by per-axis scale.
        angle=original.get('rotation',0);center=original.get('center',[0,0]);repeat=original.get('repeat',[1,1]);offset=original.get('offset',[0,0])
        # Implement with vector math so non-uniform scale and rotation preserve order.
        sub=nodes.new('ShaderNodeVectorMath');sub.operation='SUBTRACT';sub.inputs[1].default_value=(*center,0)
        rotate=nodes.new('ShaderNodeVectorRotate');rotate.rotation_type='AXIS_ANGLE';rotate.inputs['Axis'].default_value=(0,0,1);rotate.inputs['Angle'].default_value=-angle
        scale=nodes.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(*repeat,1)
        add=nodes.new('ShaderNodeVectorMath');add.operation='ADD';add.inputs[1].default_value=(center[0]+offset[0],center[1]+offset[1],0)
        links.new(coords.outputs['UV'],sub.inputs[0]);links.new(sub.outputs[0],rotate.inputs['Vector']);links.new(rotate.outputs[0],scale.inputs[0]);links.new(scale.outputs[0],add.inputs[0]);links.new(add.outputs[0],tex.inputs['Vector'])
        color_output=multiply_color(color_output,tex.outputs['Color'])
        if src.get('transparent'):links.new(tex.outputs['Alpha'],bsdf.inputs['Alpha'])
    if src.get('vertexColors'):
        vertex=nodes.new('ShaderNodeVertexColor');vertex.layer_name='OriginalColor'
        color_output=multiply_color(color_output,vertex.outputs['Color'])
    instance=nodes.new('ShaderNodeObjectInfo')
    color_output=multiply_color(color_output,instance.outputs['Color'])
    links.new(color_output,bsdf.inputs['Base Color'])
    if src['type']=='MeshBasicMaterial':
        links.new(color_output,bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value=1
    mat.use_backface_culling=src.get('side',0)==0
    materials[key]=mat
for n in data['nodes']:
    geo=data['geometries'].get(n.get('geometry'));mesh=None
    if geo:
        meshkey=(n['geometry'],tuple(n.get('materials',[])),n['type'])
        if meshkey in meshes:mesh=meshes[meshkey]
        else:
            attr=geo['attributes'];p=attr['position']['values'];verts=[C.to_3x3()@Vector(p[i:i+3]) for i in range(0,len(p),3)]
            indices=geo['index'] if geo['index'] is not None else list(range(len(verts)))
            start=geo.get('drawRange',{}).get('start',0);count=geo.get('drawRange',{}).get('count')
            indices=indices[start:start+count] if count is not None else indices[start:]
            edges=[];faces=[]
            if n['type']=='LineSegments':edges=[indices[i:i+2] for i in range(0,len(indices)-1,2)]
            elif n['type'] in ['Line','LineLoop']:
                edges=[[indices[i],indices[i+1]] for i in range(len(indices)-1)]
                if n['type']=='LineLoop' and len(indices)>2:edges.append([indices[-1],indices[0]])
            elif n['type']!='Points':faces=[indices[i:i+3] for i in range(0,len(indices)-2,3)]
            mesh=bpy.data.meshes.new(geo.get('name') or n.get('name') or n['id']);mesh.from_pydata(verts,edges,faces);mesh.update()
            for key in n.get('materials',[]):mesh.materials.append(materials[key])
            for group in geo['groups']:
                for poly in mesh.polygons:
                    original_offset=start+poly.index*3
                    if group['start']<=original_offset<group['start']+group['count']:poly.material_index=group.get('materialIndex',0)
            if 'uv' in attr:
                uv=attr['uv']['values'];layer=mesh.uv_layers.new(name='UVMap')
                layer.data.foreach_set('uv',[v for loop in mesh.loops for v in uv[loop.vertex_index*2:loop.vertex_index*2+2]])
            if 'color' in attr:
                colors=attr['color'];stride=colors['itemSize'];layer=mesh.color_attributes.new(name='OriginalColor',type='FLOAT_COLOR',domain='POINT')
                for i,v in enumerate(layer.data):
                    vals=colors['values'][i*stride:(i+1)*stride];v.color=(*vals[:3],vals[3] if stride>3 else 1)
            if 'normal' in attr and len(mesh.loops):
                values=attr['normal']['values'];normals=[C.to_3x3()@Vector(values[i:i+3]) for i in range(0,len(values),3)]
                mesh.polygons.foreach_set('use_smooth',[True]*len(mesh.polygons))
                mesh.normals_split_custom_set([normals[loop.vertex_index] for loop in mesh.loops])
            mesh['three_geometry_uuid']=n['geometry'];meshes[meshkey]=mesh
    node_meshes[n['id']]=mesh
    obj=bpy.data.objects.new(n.get('name') or n['id'],None if 'instances' in n else mesh);collection.objects.link(obj)
    if n['type'] in primitive_counts:
        primitive_counts[n['type']]+=1
        obj['preview_pending']='Original line/point coordinates retained; screen-space width/billboard shader requires engine-specific adaptation'
    obj['three_node_id']=n['id'];obj['three_userData']=json.dumps(n.get('userData',{}),ensure_ascii=False)
    effective_visible[n['id']]=n['visible'] and effective_visible.get(n['parent'],True)
    obj['three_visible']=n['visible'];obj.hide_render=not effective_visible[n['id']];obj.hide_viewport=not effective_visible[n['id']]
    if n.get('userData',{}).get('isOutline'):
        # The original brush outline is a runtime vertex/fragment shader, not a
        # second opaque coincident surface. Archive it hidden until shader parity.
        obj.hide_render=True;obj.hide_viewport=True;obj['preview_pending']='Original brush shader; raw mesh and shader source retained'
    if 'instances' in n:
        for i,arr in enumerate(n['instances']):
            child=bpy.data.objects.new(f"{obj.name} · instance {i}",mesh);collection.objects.link(child);child.parent=obj
            I=Matrix([[arr[col*4+row] for col in range(4)] for row in range(4)])
            child.matrix_basis=C@I@C.inverted()
            child['three_instance_index']=i;child['three_instance_owner']=n['id']
            child.hide_render=obj.hide_render;child.hide_viewport=obj.hide_viewport
            if n.get('instanceColor'):
                colors=n['instanceColor'];stride=colors['itemSize'];value=colors['values'][i*stride:i*stride+3]
                child.color=(*value,1)
            instance_objects.append((child,n,i))
    objects[n['id']]=obj
for n in data['nodes']:
    obj=objects[n['id']]
    if n['parent'] in objects:obj.parent=objects[n['parent']]
    arr=n['matrix'];M=Matrix([[arr[col*4+row] for col in range(4)] for row in range(4)])
    obj.matrix_basis=C@M@C.inverted()
# Check imported local coordinates and hierarchy, not a visual-equivalence claim.
max_error=0;surface_vertices=0
for n in data['nodes']:
    obj=objects[n['id']]
    mesh=node_meshes[n['id']]
    if mesh is None:continue
    raw=data['geometries'][n['geometry']]['attributes']['position']['values']
    for i,v in enumerate(mesh.vertices):
        expected=C.to_3x3()@Vector(raw[i*3:i*3+3]);max_error=max(max_error,(v.co-expected).length)
    surface_vertices+=len(mesh.vertices)
text=bpy.data.texts.new('SOURCE_ORIGINAL.json');text.write(json.dumps(data,ensure_ascii=False,indent=1))
readme=bpy.data.texts.new('先读这里.txt');readme.write('这是用户原模型的几何与层级导入，不是新设计。\n原程序、材质与动画引用保存在 SOURCE_ORIGINAL.json。\nBlender 材质为预览适配，尚未证明与 Web 渲染一致。飞白描边暂隐藏，原数据保留。\n未进行减面、重拓扑、改色或回写游戏。\n'+ '\n'.join(warnings))
scene['original_source_sha256']=hashlib.sha256(source.read_bytes()).hexdigest()
scene['migration_status']='geometry archive; shaders/animation/runtime parity pending'
# Frame the original object in the saved editor, preserving its own transforms.
visible=[o for o in list(objects.values())+[item[0] for item in instance_objects] if o.type=='MESH' and not o.hide_viewport]
if visible:
    bpy.context.view_layer.update()
    corners=[o.matrix_world@Vector(v) for o in visible for v in o.bound_box]
    lo=Vector([min(v[i] for v in corners) for i in range(3)]);hi=Vector([max(v[i] for v in corners) for i in range(3)])
    center=(lo+hi)/2;size=max((hi-lo).length,1)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                region=area.spaces.active.region_3d;region.view_location=center;region.view_distance=size*1.4
                area.spaces.active.shading.color_type='MATERIAL'
bpy.context.view_layer.update()
instance_error=0
for child,n,i in instance_objects:
    arr=n['instances'][i];I=Matrix([[arr[col*4+row] for col in range(4)] for row in range(4)])
    expected=objects[n['id']].matrix_world@C@I@C.inverted()
    instance_error=max(instance_error,max(abs(expected[r][c]-child.matrix_world[r][c]) for r in range(4) for c in range(4)))
report={'revision':3,'asset':asset,'nodes':len(objects),'meshDatablocks':len(meshes),'verticesIncludingOutline':surface_vertices,'maxLocalVertexError':max_error,'expandedInstances':len(instance_objects),'maxInstanceMatrixError':instance_error,'primitiveNodes':primitive_counts,'warnings':warnings,'status':'imported original; optimization and render parity pending'}
(revision_dir/f'{asset_basename}.import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True)
print('ORIGINAL_BLEND_OK',json.dumps(report,ensure_ascii=False))
