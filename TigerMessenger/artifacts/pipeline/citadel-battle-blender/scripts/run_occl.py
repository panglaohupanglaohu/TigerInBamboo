import os, subprocess
BASE = "/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/citadel-battle-blender"
env = dict(os.environ, PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
p = subprocess.run(["/opt/homebrew/bin/node", os.path.join(BASE, "scripts/test_camera_occlusion.mjs"),
                    os.path.join(BASE, "game")], capture_output=True, text=True, env=env, cwd=BASE, timeout=1400)
open(os.path.join(BASE, "game", "occl-route-stdout.txt"), "w").write(p.stdout[-9000:] + "\n--STDERR--\n" + p.stderr[-9000:])
print("RUN_OCCL rc=%s" % p.returncode); print(p.stdout[-2500:]); print(p.stderr[-600:])
