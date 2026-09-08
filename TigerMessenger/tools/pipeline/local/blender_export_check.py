"""Blender-only saved-candidate export/import structural check; never saves .blend."""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import sys

import bpy


def simple(value):
    if hasattr(value, "to_dict"):
        return {k: simple(v) for k, v in value.to_dict().items()}
    if hasattr(value, "to_list"):
        return [simple(v) for v in value.to_list()]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {k: simple(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [simple(v) for v in value]
    raise ValueError("Unsupported custom property type: " + str(type(value)))


def capture(objects):
    rows = {}
    deps = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        extras = {key: simple(obj[key]) for key in obj.keys() if key != "_RNA_UI"}
        # Reject non-finite custom numbers as well as geometry/transforms.
        json.dumps(extras, allow_nan=False)
        matrix = [float(v) for row in obj.matrix_world for v in row]
        if not all(math.isfinite(v) for v in matrix):
            raise ValueError("Nonfinite transform: " + obj.name)
        row = {"type": obj.type, "parent": obj.parent.name if obj.parent else None,
               "extras": extras, "matrix_world": matrix}
        if obj.type == "MESH":
            evaluated = obj.evaluated_get(deps)
            mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=deps)
            try:
                mesh.calc_loop_triangles()
                if not mesh.vertices and not mesh.loop_triangles and extras.get("integratedInto"):
                    # Existing v3 intentionally retains original IDs as empty
                    # anchors after integrating their geometry into another node.
                    # glTF re-import represents these geometry-free nodes as EMPTY.
                    row["type"] = "EMPTY"
                    row["empty_mesh_anchor"] = True
                    rows[obj.name] = row
                    continue
                if not mesh.vertices or not mesh.loop_triangles:
                    raise ValueError("Empty mesh: " + obj.name)
                points = [evaluated.matrix_world @ v.co for v in mesh.vertices]
                if not all(math.isfinite(v) for p in points for v in p):
                    raise ValueError("Nonfinite coordinates: " + obj.name)
                usage = Counter()
                for tri in mesh.loop_triangles:
                    index = min(tri.material_index, len(mesh.materials) - 1)
                    material = mesh.materials[index] if index >= 0 else None
                    if material is None:
                        raise ValueError("Mesh triangle has no named material: " + obj.name)
                    usage[material.name] += 1
                row.update(vertices=len(mesh.vertices), triangles=len(mesh.loop_triangles),
                           material_triangles=dict(sorted(usage.items())),
                           bounds_min=[min(p[i] for p in points) for i in range(3)],
                           bounds_max=[max(p[i] for p in points) for i in range(3)])
            finally:
                evaluated.to_mesh_clear()
        rows[obj.name] = row
    return rows


def summary(rows):
    meshes = [row for row in rows.values() if row["type"] == "MESH"]
    return {"nodes": len(rows), "mesh_objects": len(meshes),
            "triangles": sum(row["triangles"] for row in meshes),
            "bounds_min": [min(row["bounds_min"][i] for row in meshes) for i in range(3)],
            "bounds_max": [max(row["bounds_max"][i] for row in meshes) for i in range(3)],
            "materials": sorted({name for row in meshes for name in row["material_triangles"]}),
            "hidden_outline_nodes": sorted(name for name, row in rows.items() if row["extras"].get("candidateHiddenOutline")),
            "empty_mesh_anchors": sorted(name for name, row in rows.items() if row.get("empty_mesh_anchor")),
            "original_node_ids": sorted(str(row["extras"]["three_node_id"]) for row in rows.values() if "three_node_id" in row["extras"])}


def run(args):
    out = Path(args.candidate).resolve()
    report_path = Path(args.report).resolve()
    if out.exists() or report_path.exists():
        raise ValueError("New candidate and report paths are required")
    report = {"passed": False, "failures": [], "blender_version": bpy.app.version_string,
              "scene": args.scene, "visual_approved": False,
              "scope": "Saved candidate mesh/empty hierarchy export-import; node, extras, triangle/material usage, transforms and bounds only. Shader appearance, textures, animations and runtime acceptance are not certified."}
    try:
        scene = bpy.data.scenes.get(args.scene)
        if scene is None:
            raise ValueError("Requested candidate scene missing")
        bpy.context.window.scene = scene
        objects = [o for o in scene.objects if o.type in {"MESH", "EMPTY"}]
        if not objects or not any(o.type == "MESH" for o in objects):
            raise ValueError("Candidate scene has no meshes")
        if any(o.parent and o.parent not in objects for o in objects):
            raise ValueError("Candidate mesh/empty has excluded parent")
        report["excluded_review_objects"] = [{"name": o.name, "type": o.type} for o in scene.objects if o not in objects]
        report["saved_visibility"] = {o.name: {"hide_render": o.hide_render, "hide_viewport": o.hide_viewport, "hide_set": o.hide_get()} for o in objects}
        # Preserve every outline node and all geometry. Unhide only this disposable
        # process's objects to include them in export; runtime may read the extras.
        for obj in objects:
            obj.hide_viewport = False
            obj.hide_render = False
            obj.hide_set(False)
        bpy.context.view_layer.update()
        before = capture(objects)
        report["source"] = summary(before)
        for obj in scene.objects:
            obj.select_set(obj in objects)
        bpy.context.view_layer.objects.active = objects[0]
        status = bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", use_selection=True,
                                           use_active_scene=True, export_extras=True, export_apply=True,
                                           export_cameras=False, export_lights=False, export_animations=False,
                                           export_yup=True)
        if "FINISHED" not in status or not out.is_file() or out.stat().st_size < 100:
            raise ValueError("GLB export did not produce a nonempty file")
        # Clear only this background process. No .blend save, foreground UI or MCP.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        status = bpy.ops.import_scene.gltf(filepath=str(out))
        if "FINISHED" not in status:
            raise ValueError("GLB re-import failed")
        bpy.context.view_layer.update()
        after = capture([o for o in bpy.context.scene.objects if o.type in {"MESH", "EMPTY"}])
        report["roundtrip"] = summary(after)
        if set(before) != set(after):
            raise ValueError("Node names/count differ after re-import")
        maximum_bound_error = 0.0
        maximum_transform_error = 0.0
        for name, row in before.items():
            other = after[name]
            for key in ("type", "parent", "extras"):
                if row[key] != other[key]:
                    raise ValueError(name + ": roundtrip mismatch in " + key)
            error = max(abs(a - b) for a, b in zip(row["matrix_world"], other["matrix_world"]))
            maximum_transform_error = max(maximum_transform_error, error)
            if error > 0.0001:
                raise ValueError(name + ": world transform drift")
            if row["type"] != "MESH":
                continue
            for key in ("triangles", "material_triangles"):
                if row[key] != other[key]:
                    raise ValueError(name + ": roundtrip mismatch in " + key)
            error = max(abs(a - b) for key in ("bounds_min", "bounds_max") for a, b in zip(row[key], other[key]))
            maximum_bound_error = max(maximum_bound_error, error)
            if error > 0.0001:
                raise ValueError(name + ": mesh world bounds drift")
        report.update(passed=True, node_hierarchy_preserved=True, custom_extras_preserved=True,
                      triangle_material_usage_preserved=True, finite_geometry=True,
                      maximum_bound_error=maximum_bound_error, maximum_transform_error=maximum_transform_error,
                      hidden_outlines_exported=True, source_visibility_not_encoded=True)
    except Exception as exc:
        report["failures"].append(type(exc).__name__ + ": " + str(exc))
    report_path.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print("BLENDER_ROUNDTRIP " + json.dumps({"passed": report["passed"], "failures": report["failures"]}))
    if not report["passed"]:
        raise RuntimeError("Candidate roundtrip failed; see report")


parser = argparse.ArgumentParser()
parser.add_argument("--scene", required=True)
parser.add_argument("--candidate", required=True)
parser.add_argument("--report", required=True)
run(parser.parse_args(sys.argv[sys.argv.index("--") + 1:]))
