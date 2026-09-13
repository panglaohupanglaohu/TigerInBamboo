import json, os, subprocess, sys, time
BASE = "/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/citadel-battle-blender"
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
label = args[0]
views = open(args[1]).read() if os.path.exists(args[1]) else args[1]
env = dict(os.environ, PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
p = subprocess.run(["/opt/homebrew/bin/node", os.path.join(BASE, "scripts/capture_view.mjs"),
                    os.path.join(BASE, "game"), label, views],
                   capture_output=True, text=True, env=env, cwd=BASE, timeout=1500)
open(os.path.join(BASE, "game", label + "-stdout.txt"), "w").write(p.stdout[-9000:] + "\n--STDERR--\n" + p.stderr[-9000:])
print("RUN_VIEW rc=%s" % p.returncode); print(p.stdout[-1200:]); print(p.stderr[-800:])
