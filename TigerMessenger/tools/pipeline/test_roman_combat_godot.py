#!/usr/bin/env python3
"""Bounded original-combat-subset check in a new private Godot project."""
import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from local import godot_jobs

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "artifacts/pipeline/roman-combat-godot/source-damage-oracle.json"

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="New artifacts directory")
    parser.add_argument("--godot", default=godot_jobs.BINARY)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output.exists() or not output.is_relative_to(ROOT / "artifacts"):
        raise ValueError("Use a new project artifacts directory")
    output.mkdir(parents=True)
    report = {"passed": False, "active_editor_import_performed": False, "scope": "Reusable combat adapter and original gladius rule subset only, not global battlefield deployment."}
    try:
        source = (ROOT / "src/world/saihojiPhalanx.js").read_text()
        start = source.index("  function applySoldierDamage(")
        end = source.index("\n  // Bad North", start)
        expected_source = (FIXTURE.parent / "source-applySoldierDamage.js").read_text().rstrip()
        if source[start:end].rstrip() != expected_source:
            raise ValueError("Existing damage function changed; regenerate the exact-source oracle")
        before = godot_jobs.inventory()
        workspace = Path(tempfile.mkdtemp(prefix="tiger-roman-combat-"))
        project = workspace / "godot"
        shutil.copytree(ROOT / "godot", project, ignore=shutil.ignore_patterns(".godot"))
        assembly = workspace / godot_jobs.ASSEMBLY
        assembly.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / godot_jobs.ASSEMBLY, assembly)
        checkpoint = json.loads((ROOT / "artifacts/pipeline/20260909-integration-checkpoint.json").read_text())
        cache = Path(checkpoint["verificationProject"]) / ".godot"
        if cache.is_dir(): shutil.copytree(cache, project / ".godot")
        if any(godot_jobs.digest(workspace / path) != digest for path, digest in before.items()):
            raise ValueError("Snapshot copy changed an input")
        report.update({"isolated_project": str(project), "input_sha256": before, "source_damage_function_sha256": hashlib.sha256(expected_source.encode()).hexdigest(), "fixture_sha256": godot_jobs.digest(FIXTURE)})
        def run(label, tail, timeout):
            with (output / (label + ".log")).open("w") as log:
                p = subprocess.run([args.godot, "--headless", "--path", str(project)] + tail, stdout=log, stderr=subprocess.STDOUT, timeout=timeout)
            text = (output / (label + ".log")).read_text()
            if p.returncode or "SCRIPT ERROR:" in text or "Parse Error:" in text:
                raise ValueError(label + " failed; inspect its log")
        run("import", ["--editor", "--import", "--quit"], 180)
        run("parse", ["--script", "res://scripts/test_roman_combat_runtime.gd", "--check-only"], 15)
        run("combat", ["--script", "res://scripts/test_roman_combat_runtime.gd", "--", "--fixture=" + str(FIXTURE), "--output=" + str(output / "validation.json")], 45)
        validation = json.loads((output / "validation.json").read_text())
        report.update({"result": validation, "source_snapshot_still_current": godot_jobs.inventory() == before})
        if not validation["passed"] or not report["source_snapshot_still_current"]:
            raise ValueError("Combat assertions failed or source snapshot became stale")
        report["passed"] = True
    except Exception as error:
        report["failure"] = str(error)
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"passed": report["passed"], "report": str(output / "report.json"), "failure": report.get("failure")}))
    return 0 if report["passed"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
