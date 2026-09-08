#!/usr/bin/env python3
"""Verify original-world idle tail in a fresh Godot snapshot, never the editor project."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from local import godot_jobs

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "artifacts/pipeline/godot-tiger-idle/expected-web-tail.json"

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, help="New directory under project artifacts")
    parser.add_argument("--godot", default=godot_jobs.BINARY)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if not output.is_relative_to(ROOT / "artifacts") or output.exists():
        raise ValueError("Use a new directory under project artifacts")
    output.mkdir(parents=True)
    report = {"passed": False, "active_editor_import_performed": False, "screenshots_captured": False}
    try:
        fixture = json.loads(FIXTURE.read_text())
        source = ROOT / "godot/assets/art-pilots/moebius-tiger-anatomy-v3.glb"
        if hashlib.sha256(source.read_bytes()).hexdigest() != fixture["candidateSha256"]:
            raise ValueError("Independent Three.js fixture does not match current candidate GLB")
        code = godot_jobs.run(argparse.Namespace(job="godot-tiger-world", output=str(output / "static.json"), godot=args.godot))
        static = json.loads((output / "static.json").read_text())
        if code or not static["passed"]: raise ValueError("Static world regression failed")
        project = Path(static["isolated_project"]).resolve()
        if project == (ROOT / "godot").resolve(): raise ValueError("Refuse active editor project")
        argv = [args.godot, "--headless", "--path", str(project), "--script", "res://scripts/test_tiger_idle_tail.gd", "--", "--fixture=" + str(FIXTURE), "--output=" + str(output / "validation.json")]
        process = subprocess.run(argv, capture_output=True, text=True, timeout=90)
        log = process.stdout + process.stderr
        (output / "validation.log").write_text(log)
        if process.returncode or "SCRIPT ERROR:" in log or "Parse Error:" in log:
            raise ValueError("Idle-tail script failed; inspect validation.log")
        validation = json.loads((output / "validation.json").read_text())
        if not validation["passed"]: raise ValueError("Idle-tail assertions failed")
        report.update({"passed": True, "isolated_project": str(project), "result": validation,
                       "fixture_sha256": hashlib.sha256(FIXTURE.read_bytes()).hexdigest(),
                       "static_regression": "static.json", "validation": "validation.json",
                       "source_snapshot_still_current": godot_jobs.inventory() == static["input_sha256"]})
        if not report["source_snapshot_still_current"]: raise ValueError("Inputs changed during validation")
    except Exception as error:
        report.update({"passed": False, "failure": str(error)})
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"passed": report["passed"], "report": str(output / "report.json"), "failure": report.get("failure")}))
    return 0 if report["passed"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
