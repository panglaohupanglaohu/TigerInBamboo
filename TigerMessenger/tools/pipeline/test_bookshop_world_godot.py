#!/usr/bin/env python3
"""Actual original-world bookshop sign, tested in a private Godot snapshot."""
import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from local import godot_jobs

ROOT = Path(__file__).resolve().parents[2]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--godot", default=godot_jobs.BINARY)
    parser.add_argument("--capture", action="store_true", help="Launch background macOS renderer with a hidden main window")
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output.exists() or not output.is_relative_to(ROOT / "artifacts"):
        raise ValueError("Use a new artifacts directory")
    output.mkdir(parents=True)
    report = {"passed": False, "active_editor_import_performed": False, "scope": "Original bookshop sign lighting semantics only"}
    try:
        before = godot_jobs.inventory()
        workspace = Path(tempfile.mkdtemp(prefix="tiger-bookshop-sign-"))
        project = workspace / "godot"
        shutil.copytree(ROOT / "godot", project, ignore=shutil.ignore_patterns(".godot"))
        assembly = workspace / godot_jobs.ASSEMBLY
        assembly.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / godot_jobs.ASSEMBLY, assembly)
        checkpoint = json.loads((ROOT / "artifacts/pipeline/20260909-integration-checkpoint.json").read_text())
        cache = Path(checkpoint["verificationProject"]) / ".godot"
        if cache.is_dir(): shutil.copytree(cache, project / ".godot")
        if any(godot_jobs.digest(workspace / path) != sha for path, sha in before.items()):
            raise ValueError("Snapshot input mismatch")
        report.update({"isolated_project": str(project), "input_sha256": before})
        def run(label, tail, timeout):
            with (output / (label + ".log")).open("w") as log:
                result = subprocess.run([args.godot, "--headless", "--path", str(project)] + tail, stdout=log, stderr=subprocess.STDOUT, timeout=timeout)
            log = (output / (label + ".log")).read_text()
            if result.returncode or "SCRIPT ERROR:" in log or "Parse Error:" in log:
                raise ValueError(label + " failed")
        run("import", ["--editor", "--import", "--quit"], 180)
        run("parse", ["--script", "res://scripts/test_bookshop_world_sign.gd", "--check-only"], 20)
        tail = ["--script", "res://scripts/test_bookshop_world_sign.gd", "--", "--output=" + str(output)]
        run("validation", tail, 60)
        if args.capture:
            # -g keeps the new process in the background; the script immediately
            # hides its window and renders the original scene in a SubViewport.
            command = ["open", "-g", "-n", "-W", "-a", str(Path(args.godot).parents[2]), "--args", "--path", str(project), "--audio-driver", "Dummy", "--log-file", str(output / "capture.log")] + tail
            subprocess.run(command, check=True, timeout=90)
            if not (output / "bookshop-original-context.png").exists():
                raise ValueError("Background renderer did not produce a complete real capture")
        validation = json.loads((output / "validation.json").read_text())
        relevant = ["godot/scripts/original_world.gd", "godot/scripts/bookshop_world_adapter.gd", "godot/scripts/test_bookshop_world_sign.gd", "godot/assets/world-source/original-world-v1.glb"]
        current = all(godot_jobs.digest(ROOT / path) == before[path] for path in relevant)
        report.update({"result": validation, "source_snapshot_still_current": current, "screenshots_captured": args.capture})
        if not validation["passed"] or not current: raise ValueError("Assertions failed or relevant snapshot stale")
        report["passed"] = True
    except Exception as error:
        report["failure"] = str(error)
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"passed": report["passed"], "report": str(output / "report.json"), "failure": report.get("failure")}))
    return 0 if report["passed"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
