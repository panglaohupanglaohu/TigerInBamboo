import json, os, shutil, subprocess
BASE = "/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/citadel-battle-blender"
out = {}
cands = ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node",
         os.path.expanduser("~/.nvm/versions/node")]
out["exists"] = {c: os.path.exists(c) for c in cands}
try:
    env = dict(os.environ, PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:" + os.environ.get("PATH", ""))
    p = subprocess.run(["bash", "-lc", "which -a node; node -v; which -a npx"],
                       capture_output=True, text=True, env=env, timeout=60)
    out["which"] = p.stdout.strip().splitlines()
    out["err"] = p.stderr.strip()[:300]
except Exception as e:
    out["which_error"] = str(e)
try:
    p2 = subprocess.run(["bash", "-lc", "curl -s -o /dev/null -w '%{http_code}' http://localhost:8931/TigerMessenger/"],
                        capture_output=True, text=True, timeout=30)
    out["server_8931"] = p2.stdout.strip()
except Exception as e:
    out["server_error"] = str(e)
json.dump(out, open(os.path.join(BASE, "env-probe.json"), "w"), indent=1)
print("ENV_PROBE", json.dumps(out))
