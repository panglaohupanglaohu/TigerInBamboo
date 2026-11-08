"""Build the public website from tracked runtime files, never local archive links."""
from pathlib import Path
import subprocess, shutil, sys
root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/tiger-pages-site').resolve()
if out == root or root in out.parents:
    raise SystemExit('Output must be outside the working tree')
out.mkdir(parents=True, exist_ok=True)
roots = {'frontend', 'TigerMessenger', 'CartonBook', 'townscaper-web'}
exclude = {'artifacts', 'tests', 'tools', 'node_modules', 'docs', '.git', 'originals', 'optimized', 'godot', 'godot-web', 'tmp', '_to_delete'}
exts = {'.html','.css','.js','.mjs','.json','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.glb','.gltf','.bin','.wasm','.woff','.woff2','.ttf','.ogg','.mp3','.wav','.glsl','.vert','.frag','.pdf'}
count = total = 0
for name in subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0'):
    if not name: continue
    rel = Path(name)
    if len(rel.parts) == 1:
        allowed = name in {'index.html', '.nojekyll'}
    else:
        allowed = rel.parts[0] in roots and not any(p in exclude or p.startswith('_backup') for p in rel.parts) and rel.suffix.lower() in exts
    if not allowed: continue
    src = root / rel
    if src.is_symlink() or not src.is_file(): continue
    target = out / rel
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(src,target)
    total += src.stat().st_size; count += 1
for name in ['frontend/home.html','TigerMessenger/pipeline.html','CartonBook/index.html','CartonBook/chapters/bookshop-letter/book.html']:
    if not (out/name).is_file(): raise SystemExit('Missing public entry: '+name)
if total > 900 * 1024 * 1024: raise SystemExit('Site exceeds 900 MiB budget')
print(f'Published {count} regular files, {total/1024/1024:.1f} MiB; no symlinks')
