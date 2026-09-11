"""Five static concealment gardens built with the already-optimized Saihoji pines.

Scale contract: original Kun island crust is about 15 x 7.7 source units.
This external scenery stays close to 18 x 16, with a 9 x 7 central opening.
"""
import bpy
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PINES = ROOT / "godot/assets/saihoji-pines-v1"
OUT = ROOT / "assets/models/optimized/saihoji-surroundings-v3"
ART = ROOT / "artifacts/pipeline/saihoji-surroundings-v3"
MOSS = STONE = None


def material(name, color):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1.0)
    result.use_nodes = True
    result.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*color, 1.0)
    result.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .96
    return result


def mesh(parent, name, vertices, faces, item):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(item)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def terrain_sector(parent, zone_id, label, angle, width, seed):
    """A continuous wedge, not a detached strip; together the five wedges conceal the center."""
    zone = bpy.data.objects.new(f"{zone_id} · {label}", None)
    bpy.context.collection.objects.link(zone)
    zone.parent = parent
    inner, outer, count = 4.5, 9.2, 10
    rings = 4
    vertices = []
    for ring in range(rings + 1):
        f = ring / rings
        for i in range(count + 1):
            t = angle - width * .5 + width * i / count
            r = inner + (outer - inner) * f + math.sin(seed + i * 1.9) * .16
            h = .06 + f * (.24 + .22 * math.sin(seed + i * .77) ** 2)
            vertices.append((math.cos(t) * r, math.sin(t) * r, h))
    faces = []
    for ring in range(rings):
        for i in range(count):
            a = ring * (count + 1) + i
            faces.append((a, a + 1, a + count + 2, a + count + 1))
    # Outer skirt visually nests the garden into the planet without adding collision.
    start = len(vertices)
    for i in range(count + 1):
        top = vertices[rings * (count + 1) + i]
        vertices.append((top[0], top[1], -1.0))
    for i in range(count):
        a = rings * (count + 1) + i
        faces.append((a, start + i, start + i + 1, a + 1))
    terrain = mesh(zone, f"{zone_id}_continuous_moss", vertices, faces, MOSS)
    terrain["role"] = "static external terrain; no gameplay collision"
    rng = random.Random(seed)
    for i in range(6):
        t = angle + rng.uniform(-width * .38, width * .38)
        r = rng.uniform(5.3, 8.8)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0, location=(math.cos(t) * r, math.sin(t) * r, .32))
        stone = bpy.context.object
        stone.name = f"{zone_id}_stone_{i}"
        stone.scale = (rng.uniform(.28, .78), rng.uniform(.25, .63), rng.uniform(.16, .38))
        stone.rotation_euler[2] = rng.uniform(0, math.tau)
        stone.data.materials.append(STONE)
        stone.parent = zone
    return zone


def import_pine(zone, seed, location, scale, yaw):
    before = set(bpy.data.objects)
    path = PINES / f"ancient-pine-{seed}-lod0.glb"
    bpy.ops.import_scene.gltf(filepath=str(path))
    created = set(bpy.data.objects) - before
    holder = bpy.data.objects.new(f"{zone.name}_original_pine_{seed}", None)
    bpy.context.collection.objects.link(holder)
    holder.parent = zone
    holder.location = location
    holder.rotation_euler[2] = yaw
    holder.scale = (scale, scale, scale)
    roots = [obj for obj in created if obj.parent not in created]
    for obj in roots:
        obj.parent = holder
        obj.matrix_parent_inverse = holder.matrix_world.inverted()
    holder["source"] = f"ancient-pine-{seed}-lod0.glb"
    holder["reuse_contract"] = "same optimized geometry and materials as live Saihoji pine family"


def render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1500
    scene.render.resolution_y = 950
    scene.world = bpy.data.worlds.new("Saihoji v3 studio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.18, .25, .28, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .45
    bpy.ops.object.light_add(type="AREA", location=(-7, -8, 16))
    bpy.context.object.data.energy = 1800
    bpy.context.object.data.size = 10
    bpy.ops.object.light_add(type="AREA", location=(9, 8, 9))
    bpy.context.object.data.energy = 950
    bpy.context.object.data.size = 8
    bpy.ops.object.camera_add(location=(16, -19, 17))
    camera = bpy.context.object
    scene.camera = camera
    target = bpy.data.objects.new("Review target", None)
    bpy.context.collection.objects.link(target)
    target.location = (0, 0, .7)
    camera.rotation_euler = (target.location - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 52
    scene.render.filepath = str(ART / "five-static-surroundings-original-pines.png")
    bpy.ops.render.render(write_still=True)


def run():
    global MOSS, STONE
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MOSS = material("Moss outer terrain: original-compatible", (.145, .25, .075))
    STONE = material("Outer stones: weathered gray", (.29, .31, .27))
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    root = bpy.data.objects.new("Saihoji surroundings v3: five static regions", None)
    bpy.context.collection.objects.link(root)
    # Five zones deliberately cover 318 degrees, leaving one narrow natural approach.
    rows = [
        ("moss-entry", "入口苔径", math.radians(220), math.radians(56), 811, [(6.2, -.7, .86, .12), (7.6, .9, .72, -.14)]),
        ("master-stones", "主石之庭", math.radians(154), math.radians(58), 5566, [(6.4, -.5, .92, -.18), (7.8, .8, .78, .16)]),
        ("dry-cascade", "枯瀑之庭", math.radians(88), math.radians(60), 1401, [(6.4, -.7, .88, .10), (7.7, .8, .73, -.13)]),
        ("moss-islands", "苔海岛群", math.radians(22), math.radians(66), 1997, [(6.4, -.9, .86, .19), (7.9, .7, .73, -.16)]),
        ("return-view", "回望石组", math.radians(-49), math.radians(78), 4101, [(6.2, -.8, .94, -.14), (7.6, .9, .76, .17)]),
    ]
    for index, (zone_id, label, angle, width, pine_seed, placements) in enumerate(rows):
        zone = terrain_sector(root, zone_id, label, angle, width, 31 + index * 11)
        for distance, offset, scale, yaw in placements:
            local_angle = angle + offset
            import_pine(zone, pine_seed, (math.cos(local_angle) * distance, math.sin(local_angle) * distance, .28), scale, yaw)
    root["version"] = "saihoji-surroundings-v3"
    root["movement_contract"] = "static external world scenery; no Kun parent"
    root["tree_contract"] = "reuses five original optimized Saihoji pine source models"
    root["scale_contract"] = "18.4 x 16.0 outer footprint; central opening approximately 9 x 7"
    render()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "saihoji-surroundings-v3.blend"))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=str(OUT / "saihoji-surroundings-v3.glb"), export_format="GLB", use_selection=True, export_yup=True, export_apply=True)
    report = {"id": "saihoji-surroundings-v3", "type": "static external concealment scenery", "treeSource": "five existing optimized Saihoji pine GLBs", "scale": {"originalKunIsland": [15.04, 7.72], "outerFootprint": [18.4, 16.0], "centralOpening": [9.0, 7.0]}, "movement": "remains on planet when Kun rises", "zones": [{"id": r[0], "name": r[1], "pine": r[4]} for r in rows]}
    (OUT / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    (ART / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print("SAIHOJI_SURROUNDINGS_V3_READY", json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    run()
