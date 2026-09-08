#!/usr/bin/env python3
"""Export the existing Y-up v3 GLB to plain Three.js candidate data, no art edits."""
from __future__ import annotations

import base64
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "godot/assets/art-pilots/moebius-tiger-anatomy-v3.glb"
ORIGINAL = ROOT / "assets/models/originals/moebiusTiger.source.json"
OUTPUT = ROOT / "assets/models/optimized/moebiusTigerAnatomyData.js"
REPORT = ROOT / "artifacts/pipeline/tiger-web-v3/export.json"
COMPONENTS = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def glb_parts(data):
    magic, version, size = struct.unpack_from("<4sII", data)
    assert magic == b"glTF" and version == 2 and size == len(data), "Invalid GLB header"
    offset, document, binary = 12, None, None
    while offset < size:
        length, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        chunk = data[offset:offset + length]
        assert len(chunk) == length
        if kind == b"JSON":
            assert document is None
            document = json.loads(chunk)
        elif kind == b"BIN\x00":
            assert binary is None
            binary = chunk
        offset += length
    assert document is not None and binary is not None
    assert len(document["buffers"]) == 1 and not document["buffers"][0].get("uri")
    return document, binary


def accessor(doc, binary, index):
    acc = doc["accessors"][index]
    assert "sparse" not in acc, "Sparse accessor requires an explicit decoder"
    view = doc["bufferViews"][acc["bufferView"]]
    assert view.get("buffer", 0) == 0
    code, component_size = COMPONENTS[acc["componentType"]]
    width = WIDTHS[acc["type"]]
    item_size = width * component_size
    stride = view.get("byteStride", item_size)
    assert stride >= item_size
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    end = start + (acc["count"] - 1) * stride + item_size if acc["count"] else start
    assert end <= view.get("byteOffset", 0) + view["byteLength"] <= len(binary)
    values = []
    for item in range(acc["count"]):
        row = struct.unpack_from("<" + code * width, binary, start + item * stride)
        if acc.get("normalized"):
            maximum = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535}[acc["componentType"]]
            row = [max(v / maximum, -1) for v in row]
        assert all(math.isfinite(v) for v in row)
        values.extend(row)
    return values, width, acc["count"]


def local_matrix(node):
    if "matrix" in node:
        result = list(node["matrix"])
    else:
        x, y, z, w = node.get("rotation", [0, 0, 0, 1])
        sx, sy, sz = node.get("scale", [1, 1, 1])
        tx, ty, tz = node.get("translation", [0, 0, 0])
        result = [(1 - 2*y*y - 2*z*z)*sx, (2*x*y + 2*z*w)*sx, (2*x*z - 2*y*w)*sx, 0,
                  (2*x*y - 2*z*w)*sy, (1 - 2*x*x - 2*z*z)*sy, (2*y*z + 2*x*w)*sy, 0,
                  (2*x*z + 2*y*w)*sz, (2*y*z - 2*x*w)*sz, (1 - 2*x*x - 2*y*y)*sz, 0,
                  tx, ty, tz, 1]
    assert len(result) == 16 and all(math.isfinite(v) for v in result)
    return result


def multiply(a, b):
    return [sum(a[k*4 + row] * b[col*4 + k] for k in range(4)) for col in range(4) for row in range(4)]


def point(matrix, value):
    return [sum(matrix[col*4 + row] * value[col] for col in range(3)) + matrix[12 + row] for row in range(3)]


def geometry(doc, binary, mesh):
    attrs = {"position": [], "normal": [], "uv": []}
    indices, groups, material_indices = [], [], []
    for primitive in mesh["primitives"]:
        assert primitive.get("mode", 4) == 4, "Only triangle primitives are supported"
        assert not primitive.get("targets") and not primitive.get("extensions"), "Unexpected morph/compressed primitive"
        assert set(primitive["attributes"]) == {"POSITION", "NORMAL", "TEXCOORD_0"}, "Unexpected vertex attributes; do not silently discard"
        decoded = {}
        for gltf_name, name, width in [("POSITION", "position", 3), ("NORMAL", "normal", 3), ("TEXCOORD_0", "uv", 2)]:
            values, actual_width, count = accessor(doc, binary, primitive["attributes"][gltf_name])
            assert width == actual_width
            decoded[name] = (values, count)
        counts = {count for _, count in decoded.values()}
        assert len(counts) == 1
        vertex_count = counts.pop()
        offset = len(attrs["position"]) // 3
        primitive_indices, width, _ = accessor(doc, binary, primitive["indices"]) if "indices" in primitive else (list(range(vertex_count)), 1, vertex_count)
        assert width == 1 and len(primitive_indices) % 3 == 0
        assert all(isinstance(i, int) and 0 <= i < vertex_count for i in primitive_indices)
        material = primitive["material"]
        assert 0 <= material < len(doc["materials"])
        if material not in material_indices:
            material_indices.append(material)
        groups.append({"start": len(indices), "count": len(primitive_indices), "materialIndex": material_indices.index(material)})
        indices.extend(i + offset for i in primitive_indices)
        for name, (values, _) in decoded.items():
            attrs[name].extend(values)
    assert indices, "Nonempty GLB mesh must have triangles"
    return {"attributes": attrs, "attributeItemSizes": {"position": 3, "normal": 3, "uv": 2}, "index": indices, "groups": groups}, material_indices


def bounds(nodes, visible_only=False, root_local=False):
    transforms, points = {}, []
    for node in nodes:
        matrix = IDENTITY if root_local and node["parentId"] is None else node["matrix"]
        transforms[node["id"]] = multiply(transforms[node["parentId"]], matrix) if node["parentId"] else matrix
        if visible_only and node["hiddenOutline"]:
            continue
        if "geometry" not in node:
            continue
        values = node["geometry"]["attributes"]["position"]
        for i in node["geometry"]["index"]:
            points.append(point(transforms[node["id"]], values[i*3:i*3 + 3]))
    assert points
    return {"min": [min(p[i] for p in points) for i in range(3)], "max": [max(p[i] for p in points) for i in range(3)]}


def main():
    source_bytes, original_bytes = SOURCE.read_bytes(), ORIGINAL.read_bytes()
    doc, binary = glb_parts(source_bytes)
    original = json.loads(original_bytes)
    assert not doc.get("skins") and not doc.get("animations"), "Export is static rest pose, not animation migration"
    old = {n["id"]: n for n in original["nodes"]}
    assert len(old) == 80
    ids, parents = {}, {}
    for i, node in enumerate(doc["nodes"]):
        extras = node.get("extras", {})
        node_id = extras.get("three_node_id")
        if node_id is None:
            assert extras.get("candidateAddition"), "Unidentified GLB node"
            node_id = "add:" + node["name"]
        ids[i] = node_id
        for child in node.get("children", []):
            assert child not in parents, "Multiple node parents"
            parents[child] = i
    assert len(set(ids.values())) == len(ids) == 90
    assert {node_id for node_id in ids.values() if not node_id.startswith("add:")} == set(old)
    scene = doc["scenes"][doc.get("scene", 0)]
    assert len(scene["nodes"]) == 1 and ids[scene["nodes"][0]] == "n0", "Expected sole original root, no extra wrapper"
    records = []
    visited = set()

    def visit(index):
        assert index not in visited, "Cycle or duplicate scene node"
        visited.add(index)
        raw, node_id = doc["nodes"][index], ids[index]
        parent_id = ids[parents[index]] if index in parents else None
        if node_id in old:
            assert parent_id == old[node_id]["parent"], "Original parent identity changed: " + node_id
        extras = raw.get("extras", {})
        row = {"id": node_id, "name": raw["name"], "parentId": parent_id, "matrix": local_matrix(raw),
               "type": old[node_id]["type"] if node_id in old else ("Mesh" if "mesh" in raw else "Group"),
               "hiddenOutline": bool(extras.get("candidateHiddenOutline", False)), "materialIndices": []}
        if "mesh" in raw:
            row["geometry"], row["materialIndices"] = geometry(doc, binary, doc["meshes"][raw["mesh"]])
        elif node_id in old and old[node_id]["type"] == "Mesh":
            assert extras.get("integratedInto"), "Original mesh lost geometry without explicit integration marker"
            row.update(emptyGeometry=True, integratedInto=extras["integratedInto"], geometry={
                "attributes": {"position": [], "normal": [], "uv": []},
                "attributeItemSizes": {"position": 3, "normal": 3, "uv": 2}, "index": [], "groups": []})
        if node_id.startswith("add:"):
            row["candidateComponent"] = extras.get("candidateComponent", raw["name"])
        records.append(row)
        for child in raw.get("children", []):
            visit(child)

    visit(scene["nodes"][0])
    assert len(visited) == len(doc["nodes"])
    textures = []
    for texture in doc.get("textures", []):
        image = doc["images"][texture["source"]]
        assert "bufferView" in image and image["mimeType"] == "image/png"
        view = doc["bufferViews"][image["bufferView"]]
        start = view.get("byteOffset", 0)
        payload = binary[start:start + view["byteLength"]]
        assert payload.startswith(b"\x89PNG\r\n\x1a\n") and len(payload) == view["byteLength"]
        textures.append({"name": image.get("name", ""), "mimeType": image["mimeType"],
                         "dataURL": "data:" + image["mimeType"] + ";base64," + base64.b64encode(payload).decode(),
                         "sha256": sha(payload), "sampler": doc.get("samplers", [])[texture["sampler"]] if "sampler" in texture else {},
                         "flipY": False, "colorSpace": "srgb"})
    materials = [{key: value for key, value in material.items() if key != "extras"} for material in doc["materials"]]
    original_nodes = [{"id": node["id"], "name": node["name"], "type": node["type"], "parentId": node["parent"]} for node in original["nodes"]]
    total_triangles = sum(len(row.get("geometry", {}).get("index", [])) // 3 for row in records)
    visible_triangles = sum(len(row.get("geometry", {}).get("index", [])) // 3 for row in records if not row["hiddenOutline"])
    assert (total_triangles, visible_triangles) == (9440, 8376)
    data = {"version": 3, "source": str(SOURCE.relative_to(ROOT)), "sha256": sha(source_bytes),
            "sourceSnapshot": str(ORIGINAL.relative_to(ROOT)), "sourceSnapshotSha256": sha(original_bytes),
            "coordinateSystem": "Y-up, +Z head, column-major local matrices; n0 alone supplies factory scale 0.4",
            "originalNodes": original_nodes, "nodes": records, "materials": materials, "textures": textures,
            "stats": {"originalNodes": len(original_nodes), "nodes": len(records), "addedNodes": 10,
                      "meshNodes": sum(bool(row.get("geometry", {}).get("index")) for row in records),
                      "materials": len(materials), "textures": len(textures), "totalTriangles": total_triangles,
                      "visibleTriangles": visible_triangles, "hiddenOutlineNodes": sum(row["hiddenOutline"] for row in records),
                      "factoryBounds": bounds(records), "visibleFactoryBounds": bounds(records, visible_only=True),
                      "visibleRootLocalBounds": bounds(records, visible_only=True, root_local=True)}}
    serialized = json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    assert "three_userData" not in serialized and "runtimeFunction" not in serialized
    assert SOURCE.read_bytes() == source_bytes and ORIGINAL.read_bytes() == original_bytes
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("// Generated from the existing v3 GLB; use export_tiger_anatomy_web.py.\nexport default " + serialized + ";\n")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    report = {"passed": True, "source": data["source"], "sourceSha256": data["sha256"],
              "sourceSnapshotSha256": data["sourceSnapshotSha256"], "output": str(OUTPUT.relative_to(ROOT)),
              "outputSha256": sha(OUTPUT.read_bytes()), "outputBytes": OUTPUT.stat().st_size,
              "stats": data["stats"], "originalParentsPreserved": True, "allAttributesDecoded": ["POSITION", "NORMAL", "TEXCOORD_0"],
              "primitiveGroupsPreserved": True, "embeddedImageHashes": [t["sha256"] for t in textures],
              "pointLightIdentityIds": [n["id"] for n in original_nodes if n["type"] == "PointLight"],
              "emptyMeshIds": [r["id"] for r in records if r.get("emptyGeometry")],
              "staleAnimationMetadataExcluded": True, "sourceFilesUnchanged": True,
              "scope": "Data export only; no Web runtime, animation, story, material adaptation or visual approval.",
              "notes": ["Keep original PointLight instances at n20/n22; candidate records supply only their new transforms.",
                        "n4 remains an original Mesh identity with empty geometry; do not hide its parent subtree. Its n5 outline is separately marked hidden.",
                        "geometry.groups[].materialIndex indexes each node materialIndices; those values index top-level materials.",
                        "materials retain glTF defaults when a factor is absent; textured baseColorFactor defaults to white."]}
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"passed": True, "output": str(OUTPUT), "stats": data["stats"]}))


if __name__ == "__main__":
    main()
