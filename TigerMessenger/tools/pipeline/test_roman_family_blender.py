#!/usr/bin/env python3
"""Independent read-only inspection of saved complete Roman family Blender/GLB assets.

The Blender subprocess reads the saved candidate and then its GLB in temporary memory.
It never saves the .blend, changes the foreground scene, or imports an editor project.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "artifacts/pipeline/roman-family-blender-validation/source-poses.json"
ASSETS = [f"romanSoldier_{role}_{side}" for role in ("gladius", "spear", "longbow") for side in ("red", "blue")]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_glb(path):
    blob = Path(path).read_bytes()
    magic, version, length = struct.unpack_from("<4sII", blob)
    if magic != b"glTF" or version != 2 or length != len(blob):
        raise ValueError("Invalid GLB header")
    offset, result = 12, None
    while offset < length:
        size, kind = struct.unpack_from("<II", blob, offset)
        if kind == 0x4E4F534A:
            result = json.loads(blob[offset + 8:offset + 8 + size])
        offset += 8 + size
    if result is None:
        raise ValueError("GLB has no JSON chunk")
    return result


def glb_identity(path, source):
    doc = read_glb(path)
    nodes = doc["nodes"]
    parents = {child: parent for parent, node in enumerate(nodes) for child in node.get("children", [])}
    ids, additions, failures, archived = {}, {}, [], {}
    for index, node in enumerate(nodes):
        extras = node.get("extras", {})
        original_id = extras.get("three_node_id")
        if original_id:
            if original_id in ids:
                failures.append("Duplicate original ID " + original_id)
            ids[original_id] = index
        added_id = extras.get("roman_family_added_id")
        if added_id:
            if added_id in additions:
                failures.append("Duplicate added ID " + added_id)
            additions[added_id] = index
        archive = extras.get("archivedHiddenMeshIndex")
        if archive is not None:
            if extras.get("candidateHidden") is not True or "mesh" in node or not isinstance(archive, int) or not 0 <= archive < len(doc.get("meshes", [])):
                failures.append("Invalid hidden geometry archive " + str(original_id or added_id))
            else:
                archived[original_id or added_id] = archive
    expected = {n["id"]: n for n in source["nodes"]}
    if set(ids) != set(expected):
        failures.append("Original IDs differ from live factory snapshot")
    for original_id, node in expected.items():
        if original_id not in ids:
            continue
        parent_id = node["parentId"]
        actual_index = parents.get(ids[original_id])
        if parent_id and actual_index != ids.get(parent_id):
            failures.append("Original parent changed: " + original_id)
        if not parent_id and actual_index is not None and nodes[actual_index].get("extras", {}).get("three_node_id"):
            failures.append("Original root acquired another original parent")
    for kind in ("parts", "equipment"):
        if any(ref not in ids for ref in source[kind].values()):
            failures.append("Missing " + kind + " reference")
    crest_colors = {}
    for original_id in ("n11", "n13", "n15"):
        if original_id not in ids:
            continue
        node = nodes[ids[original_id]]
        actual = [doc["materials"][p["material"]].get("pbrMetallicRoughness", {}).get("baseColorFactor", [1, 1, 1, 1])[:3]
                  for p in doc["meshes"][node["mesh"]]["primitives"]] if "mesh" in node else []
        wanted = expected[original_id]["materials"][0]["color"]
        crest_colors[original_id] = {"expected": wanted, "actual": actual,
                                     "passed": bool(actual) and all(max(abs(a - b) for a, b in zip(color, wanted)) < 1e-5 for color in actual)}
        if not crest_colors[original_id]["passed"]:
            failures.append("Original red/blue crest palette changed " + original_id)
    for original_id, source_node in expected.items():
        if source_node.get("isOutline") and original_id in ids and "mesh" in nodes[ids[original_id]]:
            failures.append("Old shader outline remains active in GLB " + original_id)
    if not additions:
        failures.append("No tagged candidate additions")
    return {"passed": not failures, "failures": failures, "original_ids": sorted(ids), "added_ids": sorted(additions),
            "nodes": len(nodes), "meshes": len(doc.get("meshes", [])), "materials": len(doc.get("materials", [])),
            "parts": source["parts"], "equipment": source["equipment"], "archived_hidden_meshes": archived, "crest_colors": crest_colors}


def inspect_poses(assembly, source):
    """Apply declared portable matrices, then independently measure actual anchor locations."""
    import bpy
    from mathutils import Matrix, Vector
    from mathutils.bvhtree import BVHTree
    from mathutils.geometry import intersect_ray_tri
    objects = {obj.get("three_node_id") or obj.get("roman_family_added_id"): obj for obj in bpy.context.scene.objects
               if obj.get("three_node_id") or obj.get("roman_family_added_id")}
    convert = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    inverse = convert.inverted()
    anchors = assembly.get("anchors", {})
    errors, results = [], []
    original_samples = json.loads(SOURCE.read_text())["longbowSamples"]
    pose_frames = assembly.get("poseFrames", [])
    groups = {}
    for i, frame in enumerate(pose_frames):
        groups.setdefault(frame.get("phase", "ready"), []).append(i)
    geometry_indices = {i for indices in groups.values() for i in (indices[0], indices[len(indices) // 2], indices[-1])}
    geometry_indices.update(i for i, frame in enumerate(pose_frames) if frame.get("released"))

    def anchor(name):
        spec = anchors[name]
        return objects[spec["nodeId"]].matrix_world @ (convert.to_3x3() @ Vector(spec["point"]))

    def actor_point(point):
        return objects["n0"].matrix_world.inverted() @ point

    def depth(obj):
        return 1 + depth(obj.parent) if obj.parent else 0

    def visible_meshes(obj):
        if obj.hide_render or obj.get("candidateHidden", False):
            return []
        result = [obj] if obj.type == "MESH" else []
        for child in obj.children:
            result.extend(visible_meshes(child))
        return result

    def mesh_points(obj):
        return [mesh.matrix_world @ v.co for mesh in visible_meshes(obj) for v in mesh.data.vertices]

    def bvh(obj):
        points, triangles = [], []
        for mesh in visible_meshes(obj):
            mesh.data.calc_loop_triangles()
            offset = len(points)
            points.extend(actor_point(mesh.matrix_world @ v.co) for v in mesh.data.vertices)
            triangles.extend(tuple(offset + i for i in t.vertices) for t in mesh.data.loop_triangles)
        return BVHTree.FromPolygons(points, triangles, all_triangles=True) if triangles else None

    def triangle_mesh(obj):
        points, triangles = [], []
        for mesh in visible_meshes(obj):
            mesh.data.calc_loop_triangles()
            offset = len(points)
            points.extend(actor_point(mesh.matrix_world @ v.co) for v in mesh.data.vertices)
            triangles.extend(tuple(offset + i for i in t.vertices) for t in mesh.data.loop_triangles)
        return points, triangles, BVHTree.FromPolygons(points, triangles, all_triangles=True) if triangles else None

    def actual_crossings(a, b):
        # BVH is only a broad phase. Confirm finite triangle-edge/face crossings.
        pa, ta, ba = triangle_mesh(a)
        pb, tb, bb = triangle_mesh(b)
        if ba is None or bb is None:
            return {"crossing_triangle_pairs": 0, "tested": False}
        count, example = 0, None
        for ia, ib in ba.overlap(bb):
            aa, ab = [pa[i] for i in ta[ia]], [pb[i] for i in tb[ib]]
            hit = None
            for edges, face in ((aa, ab), (ab, aa)):
                for i in range(3):
                    start, end = edges[i], edges[(i + 1) % 3]
                    direction = end - start
                    if direction.length < 1e-8:
                        continue
                    point = intersect_ray_tri(*face, direction.normalized(), start, True)
                    if point is not None and 1e-7 < (point - start).dot(direction.normalized()) < direction.length - 1e-7:
                        hit = point
                        break
                if hit is not None:
                    break
            if hit is not None:
                count += 1
                example = example or list(inverse.to_3x3() @ hit)
        return {"crossing_triangle_pairs": count, "tested": True, "example_actor_three": example}

    def garment_observations():
        body_inverse = objects[source["parts"]["body"]].matrix_world.inverted()
        def body_points(obj):
            return [inverse.to_3x3() @ (body_inverse @ p) for p in mesh_points(obj)]
        points = body_points(objects["n3"])
        minimum, maximum = min(p.y for p in points), max(p.y for p in points)
        height = maximum - minimum
        bands = {"lower": [p for p in points if p.y < minimum + height * .2],
                 "shoulder": [p for p in points if minimum + height * .65 < p.y < minimum + height * .9]}
        widths = {key: max((p.z for p in group), default=0) - min((p.z for p in group), default=0) for key, group in bands.items()}
        sleeves = {}
        for side in ("L", "R"):
            obj = objects.get("add:sleeve" + side)
            parent_id = (obj.parent.get("three_node_id") if obj and obj.parent else None)
            sleeves[side] = {"present": obj is not None, "parent_id": parent_id,
                             "follows_original_arm": parent_id == source["parts"]["arm" + side]}
        return {"torso_widths_body_z": widths, "shoulders_wider_than_waist": widths["shoulder"] > widths["lower"],
                "sleeves": sleeves, "scope": "Geometry silhouette and parent attachment only; collar shape, sleeve seams and target likeness require image review."}

    def surface_gap(hand_name, weapon_name):
        hand = objects[anchors[hand_name]["nodeId"]]
        weapon = objects[anchors[weapon_name]["nodeId"]]
        target = bvh(weapon)
        points = [actor_point(point) for point in mesh_points(hand)]
        if target is None or not points:
            return None
        return min(target.find_nearest(point)[3] for point in points)

    def segment_ends(node_id):
        # Recover actual rod endpoints from geometry, without trusting marker positions.
        import numpy as np
        points = np.asarray([tuple(actor_point(v)) for v in mesh_points(objects[node_id])])
        if len(points) < 4:
            raise ValueError("String has no actual rod geometry")
        centered = points - points.mean(axis=0)
        _, _, axes = np.linalg.svd(centered, full_matrices=False)
        projections = centered @ axes[0]
        tolerance = max(1e-6, (projections.max() - projections.min()) * .0001)
        return [Vector(points[np.abs(projections - end) < tolerance].mean(axis=0))
                for end in (projections.min(), projections.max())]

    def crest_plane():
        import numpy as np
        body_inverse = objects[source["parts"]["body"]].matrix_world.inverted()
        points = []
        for node_id, obj in objects.items():
            if not ("crest" in str(node_id).lower() or "crest" in obj.name.lower()):
                continue
            if obj.type != "MESH" or obj.hide_render or obj.get("candidateHidden", False):
                continue
            points.extend(tuple(inverse.to_3x3() @ (body_inverse @ (obj.matrix_world @ v.co))) for v in obj.data.vertices)
        if len(points) < 4:
            return {"passed": False, "reason": "No visible crest mesh points"}
        points = np.asarray(points)
        _, _, axes = np.linalg.svd(points - points.mean(axis=0), full_matrices=False)
        normal = axes[-1]
        return {"passed": bool(abs(normal[2]) > .9), "thin_axis_body_three": normal.tolist(),
                "bounds_size_body_three": (points.max(axis=0) - points.min(axis=0)).tolist(),
                "criterion": "Actual crest fan plane contains body +X forward; thin normal aligns with +/-Z, not +/-X"}

    for frame_index, frame in enumerate(pose_frames):
        transforms = frame.get("transforms", {})
        for node_id in sorted(transforms, key=lambda key: depth(objects[key])):
            flat = transforms[node_id]
            matrix = Matrix([[flat[col * 4 + row] for col in range(4)] for row in range(4)])
            obj = objects[node_id]
            obj.matrix_parent_inverse = Matrix.Identity(4)
            obj.matrix_basis = convert @ matrix @ inverse
        if "arrowVisible" in frame and source["role"] == "longbow":
            arrow = objects[source["equipment"]["nockedArrow"]]
            arrow.hide_render = not frame["arrowVisible"]
        bpy.context.view_layer.update()
        row = {"name": frame.get("name"), "frame": frame.get("frame"), "phase": frame.get("phase"), "contacts": {}}
        row["crest_plane"] = crest_plane()
        if not row["crest_plane"]["passed"]:
            errors.append("Actual crest fan plane is transverse to original character +X forward")
        pairs = [("handL", "weaponGrip")] if source["role"] == "longbow" else [("handL", "shieldGrip"), ("handR", "weaponGrip")]
        if source["role"] == "longbow" and frame.get("phase") in ("draw", "hold"):
            pairs.append(("handR", "nock"))
        if source["role"] == "longbow" and frame.get("arrowVisible") and frame.get("phase") in ("draw", "hold"):
            pairs.append(("nock", "arrowNock"))
        for a, b in pairs:
            try:
                distance = (actor_point(anchor(a)) - actor_point(anchor(b))).length
                row["contacts"][a + "_" + b] = distance
                if not math.isfinite(distance) or distance > .01:
                    errors.append(f"Anchor contact exceeds .01 actor units: {frame.get('name')} {a}/{b} {distance}")
            except (KeyError, TypeError) as error:
                errors.append("Missing declared contact anchor: " + str(error))
        geometry_pairs = [("handL", "weaponGrip")] if source["role"] == "longbow" else [("handL", "shieldGrip"), ("handR", "weaponGrip")]
        row["actual_hand_surface_gaps"] = {}
        for hand, target in geometry_pairs:
            gap = surface_gap(hand, target)
            row["actual_hand_surface_gaps"][hand + "_" + target] = gap
            if gap is None or gap > .012:
                errors.append(f"Hand mesh does not touch weapon/handle geometry within .012: {frame.get('name')} {hand}/{target} {gap}")
        if source["role"] == "longbow":
            row["actual_string_endpoint_errors"] = {}
            for key, tip in (("stringTop", "bowTipTop"), ("stringBot", "bowTipBottom")):
                try:
                    ends = segment_ends(source["equipment"][key])
                    expected = [actor_point(anchor(tip)), actor_point(anchor("nock"))]
                    error = min(max((ends[i] - expected[i]).length for i in range(2)),
                                max((ends[1 - i] - expected[i]).length for i in range(2)))
                    row["actual_string_endpoint_errors"][key] = error
                    if error > .01:
                        errors.append(f"String geometry misses actual tip/nock by {error}: {frame.get('name')} {key}")
                except (KeyError, ValueError) as error:
                    errors.append("String endpoint validation failed: " + str(error))
            if frame.get("phase") in ("draw", "hold"):
                hand_points = [actor_point(point) for point in mesh_points(objects[anchors["handR"]["nodeId"]])]
                string_trees = [bvh(objects[source["equipment"][key]]) for key in ("stringTop", "stringBot")]
                actual_gaps = [tree.find_nearest(point)[3] for tree in string_trees if tree for point in hand_points]
                row["right_hand_actual_string_gap"] = min(actual_gaps) if actual_gaps else None
                if not actual_gaps or min(actual_gaps) > .012:
                    errors.append("Right hand geometry does not contact actual bowstring: " + str(frame.get("name")))
        if frame_index in geometry_indices:
            row["garment_observations"] = garment_observations()
            crossings = {}
            armor = [obj for node_id, obj in objects.items() if node_id == "n3" or node_id.startswith("add:armor:") or node_id.startswith("add:sleeve")]
            if source["role"] == "longbow":
                equipment_keys = ["bow", "stringTop", "stringBot"]
                if frame.get("arrowVisible"):
                    equipment_keys.append("nockedArrow")
                for key in equipment_keys:
                    obj = objects[source["equipment"][key]]
                    for target in armor:
                        crossings[key + " / " + target.name] = actual_crossings(obj, target)
            skirts = [obj for obj in armor if "skirt" in obj.name.lower()]
            for skirt in skirts:
                for side in ("L", "R"):
                    crossings["leg" + side + " / " + skirt.name] = actual_crossings(objects[source["parts"]["leg" + side]], skirt)
            row["sampled_surface_crossings"] = crossings
        if "helmetFront" in anchors and "helmetRear" in anchors:
            # Body lean is part of animation; facing must be relative to the body.
            body_inverse = objects[source["parts"]["body"]].matrix_world.inverted()
            direction = inverse.to_3x3() @ (body_inverse.to_3x3() @ (anchor("helmetFront") - anchor("helmetRear")))
            row["helmet_front_dot_x"] = direction.normalized().x if direction.length else 0
            row["helmet_direction_space"] = "Original body local +X; excludes animated body lean"
            if row["helmet_front_dot_x"] < .85:
                errors.append("Helmet front/rear anchors do not open toward original +X")
        else:
            errors.append("Missing actual helmet front/rear geometry anchors")
        source_index = frame.get("sourceIndex")
        if source["role"] == "longbow" and source_index is not None:
            expected = original_samples[source_index]
            row["source_event_preserved"] = (frame.get("phase") == expected["phase"] and frame.get("released") == expected["released"]
                                             and frame.get("arrowVisible") == expected["contacts"]["arrowVisible"])
            if not row["source_event_preserved"]:
                errors.append("Original bow phase/release event changed")
        results.append(row)
    if not results:
        errors.append("No portable candidate poseFrames supplied")
    if source["role"] == "longbow" and [frame.get("sourceIndex") for frame in pose_frames] != list(range(len(original_samples))):
        errors.append("Portable bow action does not contain every original source sample exactly once in order")
    crossing_rows = [{"name": row["name"], "frame": row["frame"], "pairs": {key: value for key, value in row.get("sampled_surface_crossings", {}).items() if value["crossing_triangle_pairs"] > 0}}
                     for row in results if any(value["crossing_triangle_pairs"] > 0 for value in row.get("sampled_surface_crossings", {}).values())]
    return {"anchor_checks_passed": not errors, "errors": errors, "poses": results,
            "sampled_surface_crossings_clear": not crossing_rows, "surface_crossing_frames": crossing_rows,
            "geometry_sample_indices": sorted(geometry_indices),
            "measurement_space": "Actor root local units (root scale removed); example points use original Three +Y up/+X forward axes.",
            "geometry_scope": "Exact noncoplanar edge/triangle surface crossings at first/middle/last sample per phase and every release. Excludes intentional hand contact; not a swept collision, containment, coplanar overlap or complete gait proof.",
            "scope": "Actual anchor, nearest hand/weapon surface, rod endpoint, event and head-direction checks. Visual wrapping and armor intersection are separate acceptance items."}


def saved_timeline(assembly):
    import bpy
    from mathutils import Matrix
    scene = bpy.context.scene
    objects = {obj.get("three_node_id") or obj.get("roman_family_added_id"): obj for obj in scene.objects
               if obj.get("three_node_id") or obj.get("roman_family_added_id")}
    animated = [key for key, obj in objects.items() if obj.animation_data and obj.animation_data.action]
    frames = assembly.get("poseFrames", [])
    if len(frames) < 2:
        return {"applicable": False, "scope": "Single static pose; no saved motion claim"}
    if not animated:
        return {"applicable": True, "passed": False, "frames": 0, "reason": "Portable multiple poses exist but saved Blender file has no animation keys"}
    convert = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    original_frame = scene.frame_current
    maximum, bad = 0.0, []
    for frame in frames:
        scene.frame_set(frame["frame"])
        frame_error, worst = 0.0, None
        for key, flat in frame["transforms"].items():
            expected = convert @ Matrix([[flat[col * 4 + row] for col in range(4)] for row in range(4)]) @ convert.inverted()
            error = max(abs(objects[key].matrix_basis[row][col] - expected[row][col]) for row in range(4) for col in range(4))
            if error > frame_error:
                frame_error, worst = error, key
        maximum = max(maximum, frame_error)
        if frame_error > 1e-4:
            bad.append({"frame": frame["frame"], "phase": frame.get("phase"), "node_id": worst, "matrix_error": frame_error})
    scene.frame_set(original_frame)
    return {"applicable": True, "passed": not bad, "frames": len(frames), "animated_nodes": animated,
            "maximum_local_matrix_error": maximum, "failed_frames": len(bad), "examples": bad[:12],
            "scope": "Saved Blender timeline evaluated at every declared sample against portable authored local matrices; independent from static GLB pose."}


def blender_snapshot():
    import bpy
    from mathutils import Matrix
    rows, failures = {}, []
    world_cache = {}

    def actual_world(obj):
        # Hidden archived objects are excluded from Blender's evaluated depsgraph;
        # matrix_world may still be identity on file load. Recompose authored TRS.
        if obj not in world_cache:
            local = obj.matrix_parent_inverse @ obj.matrix_basis
            world_cache[obj] = actual_world(obj.parent) @ local if obj.parent else local
        return world_cache[obj]
    for obj in bpy.context.scene.objects:
        original_id = obj.get("three_node_id")
        added_id = obj.get("roman_family_added_id")
        if not original_id and not added_id:
            continue
        key = original_id or added_id
        if key in rows:
            failures.append("Duplicate object identity " + key)
        parent = obj.parent
        world = actual_world(obj)
        row = {"name": obj.name, "type": obj.type, "original_id": original_id, "added_id": added_id,
               "parent_id": (parent.get("three_node_id") or parent.get("roman_family_added_id")) if parent else None,
               "matrix_world": [float(v) for col in world.transposed() for v in col],
               "hide_render": obj.hide_render, "source_visible": obj.get("three_visible"),
               "candidate_hidden": obj.get("candidateHidden", False)}
        if not all(math.isfinite(v) for v in row["matrix_world"]):
            failures.append("Nonfinite transform " + key)
        if obj.type == "MESH":
            mesh = obj.data
            mesh.calc_loop_triangles()
            points = [world @ vertex.co for vertex in mesh.vertices]
            if not all(math.isfinite(v) for point in points for v in point):
                failures.append("Nonfinite mesh " + key)
            row.update(vertices=len(mesh.vertices), triangles=len(mesh.loop_triangles),
                       materials=[m.name if m else None for m in mesh.materials],
                       bounds_min=[min((p[i] for p in points), default=0) for i in range(3)],
                       bounds_max=[max((p[i] for p in points), default=0) for i in range(3)])
            if mesh.loop_triangles and (not mesh.materials or any(m is None for m in mesh.materials)):
                failures.append("Missing mesh material " + key)
        rows[key] = row
    return rows, failures


def worker(args):
    import bpy
    source = next(v for v in json.loads(SOURCE.read_text())["variants"] if v["assetId"] == args.asset)
    saved, failures = blender_snapshot()
    assembly_path = args.glb.with_suffix(".assembly.json")
    assembly = json.loads(assembly_path.read_text()) if assembly_path.is_file() else None
    timeline = saved_timeline(assembly) if assembly else {"applicable": False, "reason": "No assembly"}
    for node in source["nodes"]:
        row = saved.get(node["id"])
        if not row:
            failures.append("Saved .blend missing " + node["id"])
        elif row["parent_id"] != node["parentId"]:
            failures.append("Saved .blend original parent changed " + node["id"])
    # Import into a clean in-memory file, not a production save or foreground scene.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.glb))
    imported, more = blender_snapshot()
    failures.extend(more)
    if set(saved) != set(imported):
        failures.append("GLB roundtrip changed tagged object identities")
    maximum_transform_error = 0.0
    archive_nodes = {n.get("extras", {}).get("three_node_id") or n.get("extras", {}).get("roman_family_added_id"):
                     n.get("extras", {}).get("archivedHiddenMeshIndex") for n in read_glb(args.glb)["nodes"]
                     if n.get("extras", {}).get("candidateHidden") is True and isinstance(n.get("extras", {}).get("archivedHiddenMeshIndex"), int)}
    for key in set(saved) & set(imported):
        a, b = saved[key], imported[key]
        if a["parent_id"] != b["parent_id"]:
            failures.append("GLB roundtrip changed parent " + key)
        error = max(abs(x - y) for x, y in zip(a["matrix_world"], b["matrix_world"]))
        maximum_transform_error = max(maximum_transform_error, error)
        if error > 0.0001:
            failures.append("GLB roundtrip changed world transform " + key)
        if a.get("triangles", 0) != b.get("triangles", 0) and key not in archive_nodes:
            failures.append("GLB roundtrip changed triangle count " + key)
    report = {"passed": not failures, "failures": failures, "asset": args.asset, "blender_version": bpy.app.version_string,
              "saved_objects": saved, "glb_objects": imported, "maximum_transform_error": maximum_transform_error,
              "saved_timeline": timeline,
              "source_file_saved": False, "scope": "Structure and geometry roundtrip; contact/pose validation is a separate section"}
    if assembly:
        report["pose_validation"] = inspect_poses(assembly, source)
    else:
        report["pose_validation"] = {"anchor_checks_passed": False, "errors": ["No candidate assembly supplied"]}
    Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
    return 0 if report["passed"] else 1


def main(args):
    output = Path(args.output).resolve()
    if output.exists() or not output.is_relative_to(ROOT / "artifacts/pipeline/roman-family-blender-validation"):
        raise ValueError("Use a new run folder inside roman-family-blender-validation")
    output.mkdir(parents=True)
    source = json.loads(SOURCE.read_text())
    variants = {v["assetId"]: v for v in source["variants"]}
    report = {"structure_passed": False, "full_contact_validation_passed": False, "foreground_touched": False,
              "production_overwritten": False, "source_pose_sha256": sha(SOURCE), "assets": {}, "failures": []}
    report["source_snapshot_current"] = sha(ROOT / source["source"]["path"]) == source["source"]["sha256"]
    if not report["source_snapshot_current"]:
        report["failures"].append("Live factory changed since source pose snapshot")
    requested = [args.asset] if args.asset else ASSETS
    report["requested_assets"] = requested
    for asset in requested:
        blend, glb = args.input_dir / (asset + ".blend"), args.input_dir / (asset + ".glb")
        if not blend.is_file() or not glb.is_file():
            report["failures"].append("Missing complete candidate " + asset)
            continue
        tracked = [blend, glb, glb.with_suffix(".assembly.json")]
        before = {str(p): sha(p) for p in tracked if p.is_file()}
        item = {"input_sha256": before, "glb": glb_identity(glb, variants[asset])}
        detail = output / (asset + ".json")
        command = [args.blender, "--background", "--factory-startup", "--disable-autoexec", str(blend),
                   "--python-exit-code", "1", "--python", str(Path(__file__).resolve()), "--", "--worker",
                   "--asset", asset, "--glb", str(glb), "--report", str(detail)]
        try:
            with (output / (asset + ".log")).open("w") as log:
                result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=180)
            returncode = result.returncode
        except subprocess.TimeoutExpired:
            returncode = -1
            item["worker_failure"] = "Background read-only validation timed out after 180 seconds"
        item["source_files_unchanged"] = before == {str(p): sha(p) for p in tracked if p.is_file()}
        item["roundtrip"] = json.loads(detail.read_text()) if detail.exists() else {"passed": False, "failure": "Worker produced no report"}
        item["structure_passed"] = returncode == 0 and item["glb"]["passed"] and item["roundtrip"]["passed"] and item["source_files_unchanged"]
        report["assets"][asset] = item
        if not item["structure_passed"]:
            report["failures"].append("Structure/roundtrip failed " + asset)
    report["structure_passed"] = len(report["assets"]) == len(requested) and not report["failures"]
    report["anchor_checks_passed"] = report["structure_passed"] and all(row["roundtrip"].get("pose_validation", {}).get("anchor_checks_passed", False) for row in report["assets"].values())
    report["sampled_surface_crossings_clear"] = report["structure_passed"] and all(row["roundtrip"].get("pose_validation", {}).get("sampled_surface_crossings_clear", False) for row in report["assets"].values())
    report["saved_timeline_passed"] = report["structure_passed"] and all(
        not row["roundtrip"].get("saved_timeline", {}).get("applicable", False)
        or row["roundtrip"]["saved_timeline"].get("passed", False)
        for row in report["assets"].values())
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ("structure_passed", "anchor_checks_passed", "sampled_surface_crossings_clear", "saved_timeline_passed", "failures")} | {"output": str(output)}))
    return 0 if report["structure_passed"] and report["anchor_checks_passed"] and report["saved_timeline_passed"] else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--worker", action="store_true")
    parser.add_argument("--asset")
    parser.add_argument("--glb", type=Path)
    parser.add_argument("--report")
    parser.add_argument("--input-dir", type=Path, default=ROOT / "assets/models/optimized/roman-family-v1")
    parser.add_argument("--output")
    parser.add_argument("--blender", default="/Applications/Blender.app/Contents/MacOS/Blender")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else None)
    raise SystemExit(worker(args) if args.worker else main(args))
