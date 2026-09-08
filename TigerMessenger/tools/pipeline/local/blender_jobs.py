"""Reviewed read-only .blend validation jobs; exports only to a new run directory."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
JOBS = {
    "blender-tiger-roundtrip": ("moebiusTiger", "moebius-tiger-anatomy-v3", "Tiger Anatomy V3"),
    "blender-roman-armor-roundtrip": ("romanSoldier_gladius_red", "roman-armor-v3-direction", "Roman Armor V3 Direction"),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--job", required=True, choices=JOBS)
    parser.add_argument("--output", required=True)
    parser.add_argument("--blender", default=os.environ.get("BLENDER_BINARY", "/Applications/Blender.app/Contents/MacOS/Blender"))
    parser.add_argument("--godot", default=os.environ.get("GODOT_BINARY", "/Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot"))
    args = parser.parse_args()
    asset, stem, scene = JOBS[args.job]
    source = ROOT / "assets/models/optimized" / (stem + ".blend")
    production = ROOT / "godot/assets/art-pilots" / (stem + ".glb")
    script = Path(__file__).with_name("blender_export_check.py")
    godot_script = Path(__file__).with_name("godot_export_check.gd")
    output = Path(args.output).resolve()
    run_dir = output.parent
    # This helper's output can never be a production import or source artifact.
    if not run_dir.is_relative_to(ROOT / "artifacts/pipeline"):
        raise ValueError("Output must use a new artifacts/pipeline run directory")
    if output.name != "report.json":
        raise ValueError("Use report.json in a new run directory, separate from candidate.glb")
    candidate = run_dir / "candidate.glb"
    detail = run_dir / "blender-roundtrip.json"
    if any(p.exists() for p in [output, candidate, detail, run_dir / "blender.log",
                               run_dir / "godot-roundtrip.json", run_dir / "godot-import.log", run_dir / "godot-test.log"]):
        raise ValueError("Refusing to overwrite existing run evidence")
    run_dir.mkdir(parents=True, exist_ok=True)
    inputs = {str(p.relative_to(ROOT)): sha(p) for p in [source, production, script, godot_script, Path(__file__)]}
    report = {"job_id": args.job, "asset_id": asset, "passed": False, "visual_approved": False,
              "production_overwritten": False, "foreground_touched": False, "input_sha256": inputs,
              "started_unix": time.time(), "failure": None}
    argv = [args.blender, "--background", "--factory-startup", "--disable-autoexec", str(source),
            "--python-exit-code", "1", "--python", str(script), "--", "--scene", scene,
            "--candidate", str(candidate), "--report", str(detail)]
    report["argv"] = argv
    proc = None
    try:
        with (run_dir / "blender.log").open("w") as log:
            # Inherit the parent runner's process group so its cancellation also
            # reaches Blender. Standalone helper timeouts terminate only this child.
            proc = subprocess.Popen(argv, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
            proc.wait(timeout=150)
        result = json.loads(detail.read_text()) if detail.is_file() else {}
        report["result"] = result
        if proc.returncode != 0 or result.get("passed") is not True:
            raise ValueError("Blender export/import validation failed; inspect blender.log and blender-roundtrip.json")
        project = Path(tempfile.mkdtemp(prefix="tiger-new-export-godot-"))
        report["isolated_godot_project"] = str(project)
        (project / "project.godot").write_text('config_version=5\n[application]\nconfig/name="New Export Validation"\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n')
        shutil.copy2(candidate, project / "candidate.glb")
        shutil.copy2(godot_script, project / "inspect.gd")
        if sha(candidate) != sha(project / "candidate.glb"):
            raise ValueError("Godot input copy does not match the new candidate")
        godot_report = run_dir / "godot-roundtrip.json"
        commands = [
            ([args.godot, "--headless", "--path", str(project), "--editor", "--import", "--quit"], "godot-import", 90),
            ([args.godot, "--headless", "--path", str(project), "--script", "res://inspect.gd", "--", "--expected", str(detail), "--report", str(godot_report)], "godot-test", 60),
        ]
        report["godot_commands"] = [command for command, _, _ in commands]
        for command, label, timeout in commands:
            with (run_dir / (label + ".log")).open("w") as log:
                proc = subprocess.Popen(command, cwd=project, stdout=log, stderr=subprocess.STDOUT)
                proc.wait(timeout=timeout)
            if proc.returncode != 0:
                raise ValueError(label + " failed; see its log")
        godot_result = json.loads(godot_report.read_text())
        report["godot_result"] = godot_result
        if godot_result.get("passed") is not True:
            raise ValueError("New export failed Godot geometry/material checks")
        if sha(candidate) != sha(project / "candidate.glb"):
            raise ValueError("Godot tested input diverged from the new candidate")
        report["new_export_godot_passed"] = True
        report["godot_tested_candidate_sha256"] = sha(project / "candidate.glb")
        current = {name: sha(ROOT / name) for name in inputs}
        report["input_snapshot_still_current"] = current == inputs
        report["source_blend_unchanged"] = current[str(source.relative_to(ROOT))] == inputs[str(source.relative_to(ROOT))]
        report["production_glb_unchanged"] = current[str(production.relative_to(ROOT))] == inputs[str(production.relative_to(ROOT))]
        if current != inputs:
            raise ValueError("Source or worker inputs changed during execution")
        report["candidate"] = {"path": str(candidate.relative_to(ROOT)), "sha256": sha(candidate), "bytes": candidate.stat().st_size}
        report["passed"] = True
    except Exception as exc:
        report["failure"] = type(exc).__name__ + ": " + str(exc)
    finally:
        if proc is not None and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
        report["finished_unix"] = time.time()
        report["scope"] = "Saved candidate Blender export/re-import plus new-GLB isolated Godot import/instantiation. No new art, shader/texture fidelity, animation, runtime deployment or visual approval. All hidden-outline geometry retained and identified by extras."
        output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"job_id": args.job, "passed": report["passed"], "report": str(output), "failure": report["failure"]}))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
