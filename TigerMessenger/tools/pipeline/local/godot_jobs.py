#!/usr/bin/env python3
"""Run bounded, existing Godot regressions in a fresh isolated source snapshot.

Never imports in the active project. Cached imports may be seeded from the old
checkpoint, but Godot refreshes them in the new private snapshot before testing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BINARY = "/Users/panglaohu/Downloads/Godot.app/Contents/MacOS/Godot"
ASSEMBLY = "artifacts/pipeline/roman-armor-v3-direction/assembly.json"
JOBS = {
    "godot-tiger-world": ("test_tiger_world_deployment.gd", "TIGER_WORLD ", "moebiusTiger"),
    "godot-roman-armor": ("test_roman_armor_direction.gd", "", "romanSoldier_gladius_red"),
    "godot-castle-world": ("test_castle_world_adapter.gd", "", None),
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory() -> dict[str, str]:
    files = [p for p in (ROOT / "godot").rglob("*") if p.is_file() and ".godot" not in p.parts]
    files.append(ROOT / ASSEMBLY)
    return {str(p.relative_to(ROOT)): digest(p) for p in sorted(files)}


def check_result(job: str, result: dict) -> None:
    if result.get("failures") != []:
        raise ValueError("Regression did not return an empty failures array")
    if job == "godot-roman-armor":
        if result.get("test") != "roman_armor_direction" or result.get("cases") != 252:
            raise ValueError("Expected the real Roman armor direction test and 252 pose cases")
        if result.get("variants") != ["blue", "red"]:
            raise ValueError("Both soldier variants must be tested")
        if not result.get("maxGripError", 1) < 0.00001:
            raise ValueError("Soldier grip tolerance failed")
        if min(result.get("minimumBodySeparation", 0), result.get("minimumSwordSeparation", 0)) <= 0.002:
            raise ValueError("Soldier separation tolerance failed")
    elif job == "godot-tiger-world":
        if result.get("passed") is not True or result.get("sameWorldTransform") is not True:
            raise ValueError("Tiger world transform or static deployment failed")
    elif result.get("passed") is not True or result.get("hiddenTownLayers") != 12 or result.get("originalNodesChecked", 0) < 20202 or result.get("originalCastleGlobalTransformPreserved") is not True:
        raise ValueError("Castle placement, layer isolation or source restoration failed")


def run(args: argparse.Namespace) -> int:
    output = Path(args.output).resolve()
    if output.exists():
        raise ValueError("Output already exists; use a new run directory")
    output.parent.mkdir(parents=True, exist_ok=True)
    before = inventory()
    script, prefix, asset = JOBS[args.job]
    report = {"job_id": args.job, "asset_id": asset, "passed": False, "visual_approved": False,
              "active_editor_import_performed": False, "started_unix": time.time(),
              "input_sha256": before, "failure": None, "commands": []}
    if args.job == "godot-castle-world":
        report["world_placement"] = "castleContainer"
    workspace = Path(tempfile.mkdtemp(prefix="tiger-godot-job-"))
    project = workspace / "godot"
    report["isolated_project"] = str(project)
    try:
        shutil.copytree(ROOT / "godot", project, ignore=shutil.ignore_patterns(".godot"))
        copied_assembly = workspace / ASSEMBLY
        copied_assembly.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / ASSEMBLY, copied_assembly)
        checkpoint = json.loads((ROOT / "artifacts/pipeline/20260909-integration-checkpoint.json").read_text())
        seed = Path(checkpoint["verificationProject"]).resolve()
        if seed != (ROOT / "godot").resolve() and (seed / ".godot").is_dir():
            shutil.copytree(seed / ".godot", project / ".godot")
            report["cache_seed"] = str(seed)
        for relative, expected in before.items():
            if digest(workspace / relative) != expected:
                raise ValueError("Snapshot changed while copying: " + relative)
        if inventory() != before:
            raise ValueError("Source changed while preparing snapshot; retry with current inputs")

        def command(argv: list[str], label: str, timeout: int) -> str:
            report["commands"].append(argv)
            log = output.parent / (output.stem + "." + label + ".log")
            with log.open("w") as stream:
                proc = subprocess.run(argv, cwd=project, stdout=stream, stderr=subprocess.STDOUT, timeout=timeout)
            text = log.read_text(errors="replace")
            if proc.returncode != 0:
                raise RuntimeError(f"{label} exited {proc.returncode}; see {log}")
            if "SCRIPT ERROR:" in text or "Parse Error:" in text:
                raise RuntimeError(f"{label} had script errors; see {log}")
            return text

        # The only editor/import invocation targets the newly allocated directory.
        command([args.godot, "--headless", "--path", str(project), "--editor", "--import", "--quit"], "import", 180)
        # Existing tiger test waits on rendering even with the dummy headless
        # renderer. Remove only these waits in the isolated copy; no assertions
        # or runtime behavior changes, and no screenshot evidence is produced.
        if args.job == "godot-tiger-world":
            path = project / "scripts" / script
            original = path.read_text()
            lines = original.splitlines(keepends=True)
            removed = [i + 1 for i, line in enumerate(lines) if line.strip() == "await RenderingServer.frame_post_draw"]
            path.write_text("".join(line for line in lines if line.strip() != "await RenderingServer.frame_post_draw"))
            report["headless_test_adaptation"] = {"removed_render_wait_lines": removed, "assertions_preserved": True, "source_script_unchanged": True}
            (workspace / "artifacts/pipeline/tiger-anatomy-v3").mkdir(parents=True, exist_ok=True)
        text = command([args.godot, "--headless", "--path", str(project), "--script", "res://scripts/" + script], "test", 120)
        results = []
        for line in text.splitlines():
            candidate = line[len(prefix):] if prefix and line.startswith(prefix) else line
            try:
                parsed = json.loads(candidate)
            except ValueError:
                continue
            if isinstance(parsed, dict) and ("failures" in parsed):
                results.append(parsed)
        if len(results) != 1:
            raise ValueError("Expected exactly one structured regression result")
        check_result(args.job, results[0])
        report["result"] = results[0]
        report["input_snapshot_still_current"] = inventory() == before
        if not report["input_snapshot_still_current"]:
            raise ValueError("Live inputs changed during regression; snapshot result is stale")
        report["passed"] = True
    except Exception as exc:
        report["failure"] = str(exc)
    finally:
        report["finished_unix"] = time.time()
        report["scope"] = "Fresh isolated snapshot regression only; no visual approval, foreground refresh, combat, quest, navigation or full gameplay acceptance."
        output.write_text(json.dumps(report, indent=2) + "\n")
        # Keep each isolated workspace for audit and avoid deleting evidence after failures.
    print(json.dumps({"job_id": args.job, "passed": report["passed"], "report": str(output), "failure": report["failure"]}))
    return 0 if report["passed"] else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--job", required=True, choices=JOBS)
    parser.add_argument("--output", required=True)
    parser.add_argument("--godot", default=BINARY)
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
