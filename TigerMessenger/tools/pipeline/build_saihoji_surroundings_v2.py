"""Build five static, continuous Saihoji-like landscape sectors around resting Kun.

The center is deliberately empty: it receives the original Kun and its live
garden.  The five sectors are world scenery, not a child of the whale, so they
remain on the planet when Kun rises.
"""
import bpy
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/models/optimized/saihoji-surroundings-v2"
ART = ROOT / "artifacts/pipeline/saihoji-surroundings-v2"
MOSS = STONE = BARK = NEEDLE_DARK = NEEDLE_LIGHT = None


def mat(name, color):
    item = bpy.data.materials.new(name)
    item.diffuse_color = (*color, 1.0)
    item.use_nodes = True
    bsdf = item.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.95
    return item


def mesh_object(parent, name, vertices, faces, material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def cone(parent, name, location, r0, r1, height):
    bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=r0, radius2=r1, depth=height, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(BARK)
    obj.parent = parent
    return obj


def rock(parent, name, location, size, spin):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size, size * 0.72, size * 0.45)
    obj.rotation_euler[2] = spin
    obj.data.materials.append(STONE)
    obj.parent = parent
    return obj


def pine(parent, name, location, size, lean, seed):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.parent = parent
    root.location = location
    root.rotation_euler[2] = lean
    root.scale = (size, size, size)
    for index, row in enumerate([(0, 0, .6), (.09, -.04, 1.55), (-.08, .05, 2.42), (.08, .02, 3.22)]):
        trunk = cone(root, f"{name}_trunk_{index}", row, .29 - index * .045, .22 - index * .037, 1.4)
        trunk.rotation_euler[1] = (.10 if index % 2 else -.12) * (1 + seed * .05)
    crowns = [(-.72, .05, 2.8, 1.05), (.58, -.10, 3.22, 1.16), (.08, .48, 3.65, 1.12), (.75, .35, 2.55, .92), (-.48, -.45, 2.42, .78)]
    for index, (x, y, z, width) in enumerate(crowns):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(x, y, z))
        crown = bpy.context.object
        crown.name = f"{name}_crown_{index}"
        crown.scale = (width, width * .62, .34)
        crown.data.materials.append(NEEDLE_LIGHT if index == 2 else NEEDLE_DARK)
        crown.parent = root


def sector(parent, zone_id, label, midpoint, width, seed):
    """An uneven, thick annular garden sector; no thin disconnected strips."""
    node = bpy.data.objects.new(f"{zone_id} · {label}", None)
    bpy.context.collection.objects.link(node)
    node.parent = parent
    rng = random.Random(seed)
    angles, radial = 13, 5
    inner, outer = 4.3, 13.2
    verts = []
    for ring in range(radial + 1):
        factor = ring / radial
        for i in range(angles + 1):
            t = -width * .5 + width * i / angles
            r = inner + (outer - inner) * factor
            r += math.sin((i + seed) * 1.7) * (.18 + factor * .35)
            x, y = math.cos(midpoint + t) * r, math.sin(midpoint + t) * r
            h = .05 + factor * (.32 + .35 * math.sin((i + seed) * .8) ** 2) + .12 * math.sin((ring + i + seed) * 1.9)
            verts.append((x, y, h))
    faces = []
    for ring in range(radial):
        for i in range(angles):
            a = ring * (angles + 1) + i
            faces.append((a, a + 1, a + angles + 2, a + angles + 1))
    # Add a dark, low skirt only along the exterior contour, grounding the scenery.
    side_start = len(verts)
    for i in range(angles + 1):
        top = verts[radial * (angles + 1) + i]
        verts.append((top[0], top[1], -1.35))
    for i in range(angles):
        top_a = radial * (angles + 1) + i
        top_b = top_a + 1
        bottom_a = side_start + i
        bottom_b = bottom_a + 1
        faces.append((top_a, bottom_a, bottom_b, top_b))
    terrain = mesh_object(node, f"{zone_id}_continuous_moss_terrain", verts, faces, MOSS)
    terrain["zone"] = zone_id
    # Forest mass lies at varying depths, never on a perfect fence line.
    for index in range(8):
        t = midpoint + rng.uniform(-width * .42, width * .42)
        r = rng.uniform(7.0, 12.0)
        scale = rng.uniform(.75, 1.35) * (1.2 if index < 2 else 1.0)
        pine(node, f"{zone_id}_pine_{index}", (math.cos(t) * r, math.sin(t) * r, .45), scale, rng.uniform(-.32, .32), index + seed)
    # Stones settle into three small irregular groups rather than a stepping path.
    for index in range(8):
        t = midpoint + rng.uniform(-width * .39, width * .39)
        r = rng.uniform(5.7, 12.1)
        rock(node, f"{zone_id}_weathered_rock_{index}", (math.cos(t) * r, math.sin(t) * r, .45), rng.uniform(.32, .95), rng.uniform(0, math.tau))
    return node


def render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1500
    scene.render.resolution_y = 950
    scene.render.resolution_percentage = 100
    world = bpy.data.worlds.new("Misty Saihoji surroundings studio")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (.20, .27, .29, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = .45
    bpy.ops.object.light_add(type="AREA", location=(-5, -9, 19))
    bpy.context.object.data.energy = 2200
    bpy.context.object.data.size = 12
    bpy.ops.object.light_add(type="AREA", location=(12, 7, 10))
    bpy.context.object.data.energy = 1200
    bpy.context.object.data.size = 9
    bpy.ops.object.camera_add(location=(19, -24, 21))
    camera = bpy.context.object
    scene.camera = camera
    camera.rotation_euler = ((Vector((0, 0, 1.1)) - camera.location).to_track_quat("-Z", "Y").to_euler())
    camera.data.lens = 52
    scene.render.filepath = str(ART / "five-static-surroundings.png")
    bpy.ops.render.render(write_still=True)


def run():
    global MOSS, STONE, BARK, NEEDLE_DARK, NEEDLE_LIGHT
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MOSS = mat("Moss: layered old green", (.16, .29, .08))
    STONE = mat("Stone: mist-weathered gray", (.29, .31, .27))
    BARK = mat("Pine bark: aged faceted umber", (.24, .17, .10))
    NEEDLE_DARK = mat("Pine needles: deep moss green", (.05, .16, .07))
    NEEDLE_LIGHT = mat("Pine needles: soft crown", (.25, .37, .12))
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    root = bpy.data.objects.new("Saihoji surroundings: five static concealment regions", None)
    bpy.context.collection.objects.link(root)
    rows = [
        ("moss-entry", "入口苔径", math.radians(218), math.radians(66), 11),
        ("master-stones", "主石之庭", math.radians(145), math.radians(60), 21),
        ("dry-cascade", "枯瀑之庭", math.radians(80), math.radians(62), 31),
        ("moss-islands", "苔海岛群", math.radians(12), math.radians(64), 41),
        ("return-view", "回望石组", math.radians(-62), math.radians(70), 51),
    ]
    for row in rows:
        sector(root, *row)
    root["version"] = "saihoji-surroundings-v2"
    root["movement_contract"] = "static world scenery; never parent to Kun or garden island"
    root["center_contract"] = "central opening reserved for original Kun + Saihoji garden reveal"
    render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "saihoji-surroundings-v2.blend"))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(OUT / "saihoji-surroundings-v2.glb"), export_format="GLB", use_selection=True, export_yup=True, export_apply=True)
    report = {"id": "saihoji-surroundings-v2", "type": "static external concealment scenery", "zones": [{"id": r[0], "name": r[1]} for r in rows], "movement": "remains on planet when Kun rises", "centralOpening": "Kun and live garden emerge through it", "files": ["saihoji-surroundings-v2.blend", "saihoji-surroundings-v2.glb"]}
    (OUT / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    (ART / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print("SAIHOJI_SURROUNDINGS_V2_READY", json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    run()
