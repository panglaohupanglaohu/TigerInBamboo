"""Foreground-Blender job runner.

Polls artifacts/pipeline/citadel-battle-blender/jobs/ for *.job.json and runs each
referenced python file in a SEPARATE background Blender process
(--background --factory-startup). The foreground Blender scene is never touched
and never saved by this runner.

job.json: {"script": "<abs path .py>", "argv": ["..."], "timeout": 1800}
outputs : <job>.log (combined stdout/stderr), <job>.done (json result)
"""
import bpy, json, os, subprocess, time, traceback

REPO = "/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger"
JOBS = os.path.join(REPO, "artifacts/pipeline/citadel-battle-blender/jobs")
BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender"
STATE = {"running": {}}

os.makedirs(JOBS, exist_ok=True)


def _start(job_path):
    try:
        spec = json.load(open(job_path))
    except Exception:
        with open(job_path + ".done", "w") as f:
            json.dump({"ok": False, "error": traceback.format_exc()}, f)
        return
    log = open(job_path + ".log", "w")
    cmd = [BLENDER, "--background", "--factory-startup", "--python", spec["script"]]
    argv = spec.get("argv") or []
    if argv:
        cmd += ["--"] + [str(a) for a in argv]
    proc = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT, cwd=REPO)
    STATE["running"][job_path] = {"proc": proc, "log": log, "t0": time.time(),
                                  "timeout": spec.get("timeout", 3600), "cmd": cmd}


def poll():
    for name in sorted(os.listdir(JOBS)):
        if not name.endswith(".job.json"):
            continue
        p = os.path.join(JOBS, name)
        if p in STATE["running"] or os.path.exists(p + ".done"):
            continue
        _start(p)
    for p, info in list(STATE["running"].items()):
        rc = info["proc"].poll()
        if rc is None:
            if time.time() - info["t0"] > info["timeout"]:
                info["proc"].kill()
                rc = -9
            else:
                continue
        info["log"].close()
        with open(p + ".done", "w") as f:
            json.dump({"ok": rc == 0, "returncode": rc,
                       "seconds": round(time.time() - info["t0"], 1),
                       "cmd": info["cmd"]}, f)
        STATE["running"].pop(p, None)
    return 2.0


try:
    bpy.app.timers.unregister(poll)
except Exception:
    pass
bpy.app.timers.register(poll, persistent=True)
with open(os.path.join(JOBS, "RUNNER_READY.txt"), "w") as f:
    f.write("ready %s blender=%s\n" % (time.strftime("%H:%M:%S"), bpy.app.version_string))
print("TIGERMESSENGER_JOB_RUNNER_READY")
