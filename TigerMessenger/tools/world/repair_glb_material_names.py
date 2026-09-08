"""Uniquify GLB material names without touching geometry/PBR; editor imports itself."""
import copy, hashlib, json, os, shutil, struct
from pathlib import Path
root = Path(__file__).resolve().parents[2]
source = root / "godot/assets/world-source/original-world-v1.glb"
evidence = root / "artifacts/world-migration/import-repair"
evidence.mkdir(parents=True, exist_ok=True)
backup = evidence / "original-world-v1.before.glb"
if backup.exists():
    raise SystemExit("Refuse to replace existing original backup")
raw = source.read_bytes()
magic, version, length = struct.unpack_from("<III", raw)
assert magic == 0x46546c67 and version == 2 and length == len(raw)
json_len, json_type = struct.unpack_from("<II", raw, 12)
assert json_type == 0x4e4f534a
before = json.loads(raw[20:20+json_len])
after = copy.deepcopy(before)
for i, material in enumerate(after["materials"]):
    material["name"] = f'{material.get("name", "Material")}__material_{i}'
assert len({m["name"] for m in after["materials"]}) == len(after["materials"])
for old, new in zip(before["materials"], after["materials"]):
    assert {k:v for k,v in old.items() if k != "name"} == {k:v for k,v in new.items() if k != "name"}
rest_before = {k:v for k,v in before.items() if k != "materials"}
assert rest_before == {k:v for k,v in after.items() if k != "materials"}
encoded = json.dumps(after, ensure_ascii=False, separators=(",", ":")).encode()
encoded += b" " * (-len(encoded) % 4)
remaining_chunks = raw[20+json_len:]
result = struct.pack("<IIIII", magic, version, 20+len(encoded)+len(remaining_chunks), len(encoded), json_type) + encoded + remaining_chunks
assert result[20+len(encoded):] == remaining_chunks
shutil.copy2(source, backup)
temporary = evidence / "material-names-fixed.glb.tmp"
temporary.write_bytes(result)
sha = lambda x: hashlib.sha256(x).hexdigest()
# Atomic replacement means the open editor cannot read a partial file.
os.replace(temporary, source)
readback = source.read_bytes()
assert readback == result
bin_length, bin_type = struct.unpack_from("<II", remaining_chunks)
assert bin_type == 0x004e4942
report = {"source": str(source), "backup": str(backup), "beforeBytes": len(raw), "afterBytes": len(result), "beforeSha256": sha(raw), "afterSha256": sha(result), "materialCount": len(after["materials"]), "beforeUniqueNames": len({m.get("name") for m in before["materials"]}), "afterUniqueNames": len({m["name"] for m in after["materials"]}), "binBytes": bin_length, "beforeBinSha256": sha(remaining_chunks[8:8+bin_length]), "afterBinSha256": sha(readback[20+len(encoded)+8:20+len(encoded)+8+bin_length]), "allMaterialFieldsExceptNameDeepEqual": True, "allNonMaterialJsonDeepEqual": True, "allRemainingChunksByteEqual": True, "nodesMeshesHierarchyAnimationsAccessorsTexturesUnchanged": True, "importMethod": "existing editor automatic filesystem import; no separate importer launched", "editorErrorCounterAfterRepair": "not observed by this script"}
(evidence / "material-name-verification.json").write_text(json.dumps(report, indent=2)+"\n")
print(json.dumps(report, indent=2))
