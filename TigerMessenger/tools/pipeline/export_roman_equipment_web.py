"""Read-only, lossless extraction of the approved identity-transform GLB meshes."""
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    "armor": "godot/assets/art-pilots/roman-armor-v3-direction.glb",
    "handle": "godot/assets/art-pilots/roman-shield-handle-v1.glb",
}


def extract(relative):
    blob = (ROOT / relative).read_bytes()
    magic, version, length = struct.unpack_from("<III", blob)
    assert (magic, version, length) == (0x46546C67, 2, len(blob))
    size, kind = struct.unpack_from("<II", blob, 12)
    assert kind == 0x4E4F534A
    spec = json.loads(blob[20:20 + size])
    offset = 20 + size
    size, kind = struct.unpack_from("<II", blob, offset)
    assert kind == 0x004E4942
    binary = blob[offset + 8:offset + 8 + size]
    assert not spec.get("animations") and not spec.get("skins")

    def accessor(index):
        a = spec["accessors"][index]
        v = spec["bufferViews"][a["bufferView"]]
        assert not a.get("sparse") and not a.get("normalized")
        fmt = {5126: "f", 5123: "H"}[a["componentType"]]
        width = {"SCALAR": 1, "VEC3": 3}[a["type"]]
        assert not v.get("byteStride")
        start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
        return list(struct.unpack_from("<" + fmt * a["count"] * width, binary, start))

    meshes = []
    for node in spec["nodes"]:
        assert not any(k in node for k in ("matrix", "translation", "rotation", "scale"))
        if "mesh" not in node:
            continue
        for primitive in spec["meshes"][node["mesh"]]["primitives"]:
            assert primitive.get("mode", 4) == 4
            meshes.append({"name": node["name"], "positions": accessor(primitive["attributes"]["POSITION"]),
                           "normals": accessor(primitive["attributes"]["NORMAL"]),
                           "indices": accessor(primitive["indices"]), "material": primitive["material"]})
    return {"source": relative, "sha256": hashlib.sha256(blob).hexdigest(),
            "materials": spec["materials"], "meshes": meshes}


if __name__ == "__main__":
    data = {key: extract(value) for key, value in SOURCES.items()}
    target = ROOT / "src/assets/romanEquipmentData.js"
    target.write_text("// Extracted from approved GLBs; regenerate with tools/pipeline/export_roman_equipment_web.py.\n"
                      + "export const ROMAN_EQUIPMENT_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n")
    print(json.dumps({k: {"sha256": v["sha256"], "meshes": len(v["meshes"]),
                         "triangles": sum(len(m["indices"]) // 3 for m in v["meshes"])} for k, v in data.items()}))
