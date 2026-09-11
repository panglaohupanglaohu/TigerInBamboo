from pathlib import Path
root = Path(__file__).resolve().parents[2]
web = root / "godot-web"
for name in ["index.html", "index.js", "index.wasm", "index.pck"]:
    if not (web / name).is_file(): raise SystemExit("Missing Web output: " + name)
p = web / "index.html"
s = p.read_text()
if 'id="return-original"' not in s:
    s = s.replace("<body>", '<body><a id="return-original" href="../" style="position:fixed;bottom:12px;left:12px;z-index:9999;color:#fff;background:#142831;padding:8px 14px;border-radius:8px;font:14px sans-serif;text-decoration:none">返回原网页版</a>')
p.write_text(s)
print("Godot Web diagnostic build ready; main game entry unchanged")
