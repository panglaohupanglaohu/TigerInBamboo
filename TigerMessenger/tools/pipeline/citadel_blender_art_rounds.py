"""Run in existing Blender MCP scene; candidates only, never bake WFC buildings."""
import bpy
import bmesh
import math
import json
from pathlib import Path
from mathutils import noise, Vector

OUT = Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/citadel-target-iterations')

def smooth(x):
    x = max(0., min(1., x))
    return x*x*(3-2*x)

def material(name, color):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = .91
    return m

def save_render(round_id, report):
    scene = bpy.context.scene
    scene.render.filepath = str(OUT / (round_id+'.png'))
    scene.render.image_settings.file_format = 'PNG'
    scene.render.use_file_extension = True
    scene.render.film_transparent = False
    scene.render.resolution_x = 960
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    (OUT / (round_id+'.json')).write_text(json.dumps(report, indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / (round_id+'.blend')))
    def render():
        bpy.ops.render.render(write_still=True)
        return None
    bpy.app.timers.register(render, first_interval=.5)

def round_one():
    o = bpy.data.objects['citadel-oskar-grid-mountain-surface']
    if o.get('citadel_art_round'):
        raise RuntimeError('Round one already applied; reopen baseline to reproduce')
    original = [v.co.copy() for v in o.data.vertices]
    o.data = o.data.copy()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.0001)
    edges = [e for e in bm.edges if e.calc_length() > 7 and all(math.hypot(v.co.x,v.co.y)>33 and v.co.z>5 for v in e.verts)]
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=4, use_grid_fill=True)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    for v in bm.verts:
        p = v.co.copy()
        w = smooth((math.hypot(p.x,p.y)-33)/12)*smooth((p.z-5)/9)
        n = noise.noise_vector(Vector((p.x*.12,p.y*.12,p.z*.045)), noise_basis='PERLIN_ORIGINAL')
        v.co.x += w*n.x*2.6
        v.co.y += w*n.y*2.6
        v.co.z += w*(n.z*3.2 + 1.4*math.sin(p.x*.37+p.y*.19))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(o.data)
    bm.free()
    o.data.materials.clear()
    colors=[(.055,.105,.20),(.075,.145,.26),(.10,.19,.31),(.15,.245,.36),(.21,.30,.40)]
    for i,c in enumerate(colors):
        o.data.materials.append(material('Citadel_Cliff_Blue_'+str(i),c))
    for f in o.data.polygons:
        f.material_index=max(0,min(4,round(2+f.normal.x-f.normal.y+.6*math.sin(f.center.z*.4))))
        f.use_smooth=False
    o['citadel_art_round']=1
    bpy.data.objects['backlit-highlight-citadel-oskar-grid-mountain-surface'].hide_render=True
    # Keep the playable foundation top and all building transforms intact.
    side=bpy.data.objects['highland-town-foundation-platform-side']
    side.data=side.data.copy()
    side.data.materials.clear()
    for i,c in enumerate([(.17,.22,.28),(.24,.29,.34),(.32,.36,.40)]):
        side.data.materials.append(material('Citadel_Foundation_Strata_'+str(i),c))
    for f in side.data.polygons:
        f.material_index=int(abs(f.center.z*1.3))%3
    # Original protected vertices must remain in the candidate, exactly.
    coords={tuple(round(c,5) for c in v.co) for v in o.data.vertices}
    protected=[p for p in original if math.hypot(p.x,p.y)<=33 or p.z<=5]
    missing=sum(tuple(round(c,5) for c in p) not in coords for p in protected)
    assert missing==0, 'Protected terrain vertices moved'
    save_render('round-01', {'terrain_vertices':len(o.data.vertices),'protected_original_vertices':len(protected),'missing_protected_vertices':missing,'wfc_buildings_modified':False,'integrated_web':False,'integrated_godot':False})

def round_two():
    o=bpy.data.objects['citadel-oskar-grid-mountain-surface']
    assert o.get('citadel_art_round') == 1
    protected=[v.co.copy() for v in o.data.vertices if math.hypot(v.co.x,v.co.y)<=33 or v.co.z<=5]
    bm=bmesh.new()
    bm.from_mesh(o.data)
    # Split long edges including transition triangles; preserve existing vertices.
    for iteration in range(3):
        edges=[e for e in bm.edges if e.calc_length()>7]
        if not edges:
            break
        before=set(bm.verts)
        bmesh.ops.subdivide_edges(bm,edges=edges,cuts=2,use_grid_fill=True)
        for v in set(bm.verts)-before:
            p=v.co.copy()
            w=smooth((math.hypot(p.x,p.y)-33)/12)*smooth((p.z-5)/9)
            n=noise.noise_vector(Vector((p.x*.20,p.y*.20,p.z*.14)),noise_basis='PERLIN_ORIGINAL')
            v.co += n*(w*.85)
        bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(o.data)
    bm.free()
    for f in o.data.polygons:
        f.material_index=max(0,min(4,round(2+f.normal.x-f.normal.y+.5*math.sin(f.center.z*.4))))
    # Archived canyon walls were overlapping the preserved terrain as flat slabs.
    hidden=[]
    for name in ['highland-ravine-wall-west','highland-ravine-wall-east']:
        wall=bpy.data.objects.get(name)
        if wall:
            wall.hide_render=True
            hidden.append(name)
    side=bpy.data.objects['highland-town-foundation-platform-side']
    bm=bmesh.new()
    bm.from_mesh(side.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001)
    bmesh.ops.subdivide_edges(bm,edges=[e for e in bm.edges if e.calc_length()>3],cuts=2,use_grid_fill=True)
    for v in bm.verts:
        p=v.co.copy()
        w=smooth((5.03-p.z)/3)
        # Outward buttressing below the unmodified deck; no playable top deformation.
        v.co.x += math.copysign(w*(.6+.45*math.sin(p.y*1.1)),p.x)
        v.co.y += math.copysign(w*(.6+.4*math.cos(p.x*.9)),p.y)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(side.data)
    bm.free()
    for f in side.data.polygons:
        f.material_index=int(abs(f.center.z*.8))%3
    coords={tuple(round(c,5) for c in v.co) for v in o.data.vertices}
    missing=sum(tuple(round(c,5) for c in p) not in coords for p in protected)
    assert missing==0
    o['citadel_art_round']=2
    save_render('round-02',{'terrain_vertices':len(o.data.vertices),'terrain_triangles':len(o.data.polygons),'protected_vertices':len(protected),'missing_protected_vertices':missing,'hidden_archived_overlaps':hidden,'foundation_top_unchanged':True,'wfc_buildings_modified':False,'integrated_web':False,'integrated_godot':False})

if globals().get('CITADEL_ROUND') == 1:
    round_one()
elif globals().get('CITADEL_ROUND') == 2:
    round_two()
