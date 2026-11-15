"""Read-only physical library scan. Fixed script/roots, no user-supplied code or paths."""
import json, pathlib, shutil, subprocess

def code_library_snapshot(root):
    root = pathlib.Path(root).resolve()
    node = shutil.which('node')
    if not node:
        candidate = pathlib.Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
        node = str(candidate) if candidate.is_file() else None
    if not node:
        raise RuntimeError('NODE_UNAVAILABLE')
    script = root/'TigerMessenger/tools/refactor/scan-code-library.mjs'
    result = subprocess.run([node,str(script),'--stdout'],cwd=root,capture_output=True,timeout=25,check=False)
    if result.returncode or len(result.stdout)>12*1024*1024:
        raise RuntimeError('SOURCE_SCAN_FAILED')
    snapshot = json.loads(result.stdout)
    if snapshot.get('schemaVersion')!=2 or not snapshot.get('modules'):
        raise RuntimeError('SOURCE_SCAN_INVALID')
    return snapshot
