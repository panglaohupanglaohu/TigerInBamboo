import json, os, subprocess, sys, time
BASE = "/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/citadel-battle-blender"
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
orbits = args[0] if args else "0,45,90,135,180,225,270,315"
label = args[1] if len(args) > 1 else "orbit"
env = dict(os.environ, PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
t0 = time.time()
p = subprocess.run(["/opt/homebrew/bin/node", os.path.join(BASE, "scripts/capture_citadel.mjs"),
                    os.path.join(BASE, "game"), orbits, label],
                   capture_output=True, text=True, env=env, cwd=BASE, timeout=1500)
open(os.path.join(BASE, "game", "capture-stdout.txt"), "w").write(p.stdout[-8000:] + "\n--- STDERR ---\n" + p.stderr[-8000:])
print("RUN_CAPTURE rc=%s sec=%.1f" % (p.returncode, time.time() - t0))
print(p.stdout[-1500:])
print(p.stderr[-1500:])
