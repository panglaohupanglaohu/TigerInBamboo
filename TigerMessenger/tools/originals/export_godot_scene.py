"""Read-only archive conversion in background Blender; never saves source blend."""
import bpy, sys, json, math
from pathlib import Path
args = sys.argv[sys.argv.index('--') + 1:]
source, output, report = map(Path, args[:3])
bpy.ops.wm.open_mainfile(filepath=str(source))
data = json.loads(bpy.data.texts[bpy.context.scene.get('source_text', 'SOURCE_ORIGINAL.json')].as_string())
# glTF cannot evaluate arbitrary Blender graphs. Use its supported PBR inputs.
for mat in bpy.data.materials:
    if 'three_source' not in mat:
        continue
    src = json.loads(mat['three_source'])
    old_images = [n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
    nodes = mat.node_tree.nodes
    nodes.clear()
    bs = nodes.new('ShaderNodeBsdfPrincipled')
    out = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    col = src.get('color', [1,1,1])
    bs.inputs['Base Color'].default_value = (*col, 1)
    bs.inputs['Alpha'].default_value = src.get('opacity', 1)
    bs.inputs['Roughness'].default_value = src.get('roughness', .85)
    bs.inputs['Metallic'].default_value = src.get('metalness', 0)
    bs.inputs['Emission Color'].default_value = (*src.get('emissive', [0,0,0]), 1)
    bs.inputs['Emission Strength'].default_value = src.get('emissiveIntensity', 1)
    if old_images:
        tex = nodes.new('ShaderNodeTexImage'); tex.image = old_images[0]
        mat.node_tree.links.new(tex.outputs['Color'], bs.inputs['Base Color'])
        if src.get('transparent'):
            mat.node_tree.links.new(tex.outputs['Alpha'], bs.inputs['Alpha'])
    # Raw source metadata retained for subsequent Godot shader/animation adaptation.
    mat['export_base_factor'] = list(col) + [src.get('opacity',1)]
counts = dict(objects=len(bpy.data.objects), visibleMeshes=0, hiddenMeshes=0, edgeOnlyMeshes=0, pointOnlyMeshes=0)
for ob in bpy.data.objects:
    if ob.type != 'MESH': continue
    if ob.hide_render or ob.hide_viewport:
        counts['hiddenMeshes'] += 1
        continue
    counts['visibleMeshes'] += 1
    me = ob.data
    if not me.polygons:
        counts['edgeOnlyMeshes' if me.edges else 'pointOnlyMeshes'] += 1
    # Per-object copies are needed for instance colors and per-material texture UVs.
    ob.data = me.copy(); me = ob.data
    if me.uv_layers.active:
        for poly in me.polygons:
            if poly.material_index >= len(me.materials): continue
            mat = me.materials[poly.material_index]
            src = json.loads(mat.get('three_source', '{}')) if mat else {}
            key = src.get('map', {}).get('textureRef')
            tex = data['textures'].get(key, {})
            angle = tex.get('rotation',0); c = tex.get('center',[0,0]); r = tex.get('repeat',[1,1]); off = tex.get('offset',[0,0])
            for li in poly.loop_indices:
                uv = me.uv_layers.active.data[li].uv
                x,y = uv[0]-c[0], uv[1]-c[1]
                uv[0] = r[0]*(math.cos(angle)*x + math.sin(angle)*y)+c[0]+off[0]
                uv[1] = r[1]*(-math.sin(angle)*x + math.cos(angle)*y)+c[1]+off[1]
    if tuple(ob.color) != (1,1,1,1):
        layer = me.color_attributes.active_color
        if layer is None:
            layer = me.color_attributes.new(name='InstanceColor', type='FLOAT_COLOR', domain='POINT')
            for v in layer.data: v.color = (1,1,1,1)
        for v in layer.data: v.color = tuple(v.color[i]*ob.color[i] for i in range(4))
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_visible=True,
    use_mesh_edges=True, use_mesh_vertices=any(n['type'] == 'Points' for n in data['nodes']), export_yup=True, export_apply=bool(bpy.context.scene.get('art_v2')),
    export_materials='EXPORT', export_cameras=False, export_lights=False,
    export_animations=True, export_extras=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False)
# Restore texture tint, which a plain image node cannot encode as a glTF factor.
import struct
raw = output.read_bytes()
length, kind = struct.unpack_from('<II', raw, 12)
doc = json.loads(raw[20:20+length])
for mat in doc.get('materials', []):
    factor = mat.get('extras', {}).get('export_base_factor')
    if factor:
        mat.setdefault('pbrMetallicRoughness', {})['baseColorFactor'] = factor
payload = json.dumps(doc, separators=(',',':')).encode()
payload += b' ' * (-len(payload)%4)
tail = raw[20+length:]
output.write_bytes(struct.pack('<III', 0x46546C67, 2, 20+len(payload)+len(tail)) + struct.pack('<II',len(payload),kind) + payload + tail)
counts.update(gltfMeshes=len(doc.get('meshes',[])), gltfMaterials=len(doc.get('materials',[])), gltfImages=len(doc.get('images',[])), animationClips=len(doc.get('animations',[])))
report.write_text(json.dumps(counts, indent=2))
print('EXPORT_OK', output)
