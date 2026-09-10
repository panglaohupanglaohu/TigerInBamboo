"""Build a five-zone peripheral Saihoji concealment asset for the live Kun garden.

The original island and its six authored scenes stay untouched.  This is a
supplemental Blender asset: five uneven moss-and-pine banks sit outside the
central playable garden so the resting Kun reads as part of a larger garden.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/models/optimized/saihoji-concealment-v1"
ART = ROOT / "artifacts/pipeline/saihoji-concealment-v1"


def material(name, color):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*color, 1.0)
    value.use_nodes = True
    node = value.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = (*color, 1.0)
    node.inputs["Roughness"].default_value = 0.92
    return value


MOSS = None
MOSS_LIGHT = None
STONE = None
BARK = None
LEAF_DARK = None
LEAF_LIGHT = None


def link(obj, parent, name):
    obj.name = name
    obj.parent = parent
    return obj


def cone(parent, name, loc, radius1, radius2, depth, mat, verts=7):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius1, radius2=radius2, depth=depth, location=loc)
    obj = bpy.context.object
    obj.data.materials.append(mat)
    return link(obj, parent, name)


def rock(parent, name, loc, scale, rotation=0.0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    obj.rotation_euler[2] = rotation
    obj.data.materials.append(STONE)
    return link(obj, parent, name)


def moss_bank(parent, name, center, radius, angle, width):
    verts = []
    faces = []
    n = 10
    for i in range(n + 1):
        t = -width / 2 + width * i / n
        outer = Vector((math.cos(angle + t) * radius.x, math.sin(angle + t) * radius.y, 0)) + center
        inner = Vector((math.cos(angle + t) * (radius.x - 2.0), math.sin(angle + t) * (radius.y - 1.55), 0)) + center
        verts.extend([inner, outer])
    for i in range(n):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(MOSS)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def old_pine(parent, name, loc, scale, lean, seed):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.parent = parent
    root.location = loc
    root.rotation_euler[2] = lean
    root.scale = (scale, scale, scale)
    # Four offset trunk sections provide age and a visible faceted color break.
    offsets = [(0, 0, 0.55), (0.08, -0.03, 1.45), (-0.05, 0.07, 2.35), (0.12, 0.03, 3.1)]
    for i, (x, y, z) in enumerate(offsets):
        seg = cone(root, f"{name}_trunk_{i}", (x, y, z), 0.25 - i * 0.035, 0.19 - i * 0.03, 1.25, BARK, 7)
        seg.rotation_euler[1] = (0.12 if i % 2 else -0.09) * (1 + seed * 0.04)
    canopy_offsets = [(-0.68, 0.10, 2.65), (0.50, -0.04, 3.12), (0.02, 0.50, 3.55), (0.72, 0.36, 2.48)]
    for i, (x, y, z) in enumerate(canopy_offsets):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=(x, y, z))
        crown = bpy.context.object
        crown.scale = (0.95 + (i % 2) * 0.25, 0.56 + (i % 3) * 0.08, 0.31)
        crown.data.materials.append(LEAF_LIGHT if i == 2 else LEAF_DARK)
        link(crown, root, f"{name}_crown_{i}")
    return root


def build_zone(root, zone_id, label, center, angle, trees, rocks):
    zone = bpy.data.objects.new(f"{zone_id} · {label}", None)
    bpy.context.collection.objects.link(zone)
    zone.parent = root
    moss_bank(zone, f"{zone_id}_moss_bank", center, Vector((10.6, 7.0, 0)), angle, 0.74)
    # A low second moss shelf breaks the perfect arc without becoming a road.
    shelf = Vector((center.x + math.cos(angle) * 0.55, center.y + math.sin(angle) * 0.55, 0.11))
    moss_bank(zone, f"{zone_id}_inner_moss", shelf, Vector((9.1, 5.7, 0)), angle + 0.05, 0.42)
    for i, (dx, dy, size) in enumerate(rocks):
        rock(zone, f"{zone_id}_stone_{i}", (center.x + dx, center.y + dy, size * 0.25), (size, size * 0.76, size * 0.42), angle + i * 0.38)
    for i, (dx, dy, size, lean) in enumerate(trees):
        old_pine(zone, f"{zone_id}_pine_{i}", (center.x + dx, center.y + dy, 0.20), size, lean, i)


def camera_and_render(root):
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.context.scene.render.resolution_x = 1500
    bpy.context.scene.render.resolution_y = 950
    bpy.context.scene.render.resolution_percentage = 100
    world = bpy.context.scene.world or bpy.data.worlds.new("Saihoji concealment studio")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.18, 0.24, 0.27, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
    bpy.ops.object.light_add(type='AREA', location=(0, -8, 15))
    key = bpy.context.object
    key.data.energy = 1800
    key.data.shape = 'DISK'
    key.data.size = 10
    key.rotation_euler = (math.radians(24), 0, 0)
    bpy.ops.object.light_add(type='AREA', location=(-11, 7, 8))
    fill = bpy.context.object
    fill.data.energy = 1000
    fill.data.size = 8
    fill.rotation_euler = (math.radians(45), 0, math.radians(-120))
    bpy.ops.object.camera_add(location=(18, -24, 19))
    cam = bpy.context.object
    bpy.context.scene.camera = cam
    cam.rotation_euler = ((Vector((0, 0, 0.9)) - cam.location).to_track_quat('-Z', 'Y').to_euler())
    cam.data.lens = 52
    bpy.context.scene.render.filepath = str(ART / "five-zone-concealment.png")
    bpy.ops.render.render(write_still=True)


def run():
    global MOSS, MOSS_LIGHT, STONE, BARK, LEAF_DARK, LEAF_LIGHT
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Factory reset releases all datablocks, so create the palette afterwards.
    MOSS = material("Moss: muted old green", (0.16, 0.27, 0.075))
    MOSS_LIGHT = material("Moss: sunlit facets", (0.29, 0.42, 0.12))
    STONE = material("Stone: weathered gray", (0.30, 0.31, 0.25))
    BARK = material("Pine bark: faceted umber", (0.23, 0.16, 0.09))
    LEAF_DARK = material("Pine needles: shadow", (0.055, 0.16, 0.065))
    LEAF_LIGHT = material("Pine needles: crown", (0.20, 0.34, 0.10))
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    root = bpy.data.objects.new("Saihoji concealment: five original scene motifs", None)
    bpy.context.collection.objects.link(root)
    zones = [
        ("moss-entry", "入口苔径", Vector((-1.8, -0.5, 0)), math.radians(220), [(-5.7, -1.1, 1.35, 0.14), (-3.8, -2.0, 1.00, -0.20), (-1.8, -2.1, 0.86, 0.17)], [(-4.8, 0.2, 0.8), (-2.6, -0.7, 0.55)]),
        ("master-stones", "主石之庭", Vector((0.0, 0.2, 0)), math.radians(120), [(-2.2, 4.3, 1.25, -0.1), (-0.4, 5.1, 1.05, 0.17), (1.6, 4.3, 1.12, -0.16)], [(-0.5, 5.9, 1.2), (1.4, 5.2, 0.9), (-2.2, 4.8, 0.7)]),
        ("dry-cascade", "枯瀑之庭", Vector((0.4, 0.0, 0)), math.radians(55), [(5.2, 3.2, 1.38, -0.28), (6.5, 1.7, 0.96, 0.15), (5.4, 0.1, 0.80, -0.09)], [(7.7, 2.7, 1.35), (6.4, 3.8, 0.92), (8.3, 0.7, 0.66)]),
        ("moss-islands", "苔海岛群", Vector((0.0, 0.0, 0)), math.radians(-12), [(7.4, -1.6, 1.12, 0.24), (6.6, -3.2, 1.25, -0.13), (4.8, -4.0, 0.83, 0.13)], [(8.0, -3.1, 0.75), (5.2, -5.0, 0.88), (7.0, -4.8, 0.55)]),
        ("return-view", "回望石组", Vector((-0.7, 0.15, 0)), math.radians(172), [(-6.7, 1.5, 1.18, -0.16), (-7.8, 3.0, 0.95, 0.20), (-5.9, 4.1, 0.82, -0.1)], [(-8.4, 0.1, 1.1), (-7.3, 1.2, 0.78), (-6.2, 3.1, 0.56)]),
    ]
    for values in zones:
        build_zone(root, *values)
    # An intentionally empty central ellipse remains for the original garden and battle positions.
    root["version"] = "saihoji-concealment-v1"
    root["purpose"] = "five-zone peripheral cover; original Saihoji and Kun geometry unchanged"
    camera_and_render(root)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "saihoji-concealment-v1.blend"))
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(OUT / "saihoji-concealment-v1.glb"), export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    manifest = {
        "id": "saihoji-concealment-v1",
        "kind": "supplemental Blender environment asset",
        "sourcePreserved": ["original Kun mesh", "original Saihoji six scenes", "original pine placements"],
        "zones": [{"id": z[0], "name": z[1]} for z in zones],
        "centralClearing": "reserved for original garden, battle routes and Kun reveal",
        "reveal": "asset follows the Kun; its uneven outline hides the resting body, then rises as part of the garden",
        "files": ["saihoji-concealment-v1.blend", "saihoji-concealment-v1.glb"],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    (ART / "report.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print("SAIHOJI_CONCEALMENT_READY", json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    run()
