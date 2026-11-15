"""Build the public website from tracked runtime files, never local archive links."""
from pathlib import Path
import json, re, subprocess, shutil, sys

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/tiger-pages-site').resolve()
if out == root or root in out.parents:
    raise SystemExit('Output must be outside the working tree')
out.mkdir(parents=True, exist_ok=True)

roots = {'frontend', 'TigerMessenger', 'CartonBook', 'townscaper-web'}
exclude = {'artifacts', 'tests', 'tools', 'node_modules', 'docs', '.git', 'originals', 'optimized', 'godot', 'godot-web', 'tmp', '_to_delete'}
exts = {'.html','.css','.js','.mjs','.json','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.glb','.gltf','.bin','.wasm','.woff','.woff2','.ttf','.ogg','.mp3','.wav','.glsl','.vert','.frag','.pdf'}

# 概念设计图：仅在源码注释与离线资产队列中被提及，打包产物里零引用，运行时不会请求
exclude_paths = ('TigerMessenger/assets/concepts/',)

# 打包产物直接引用的运行时数据与模型：位于 artifacts/optimized 下但启动即加载，必须随站点发布
artifact_allow = {
    'TigerMessenger/artifacts/pipeline/citadel-east-shore-route-20261006/remesh-final-surface-geometry.json',
    'TigerMessenger/artifacts/pipeline/citadel-east-shore-route-20261006/remesh-expanded-shift-audit.json',
    'TigerMessenger/artifacts/pipeline/citadel-east-shore-route-20261006/remesh-final-surface-audit.json',
    'TigerMessenger/artifacts/pipeline/citadel-architecture-target-20261005/target-v3-landmarks.png',
    'TigerMessenger/artifacts/pipeline/citadel-architecture-target-20261005/target-v5-street-cameras.png',
    'TigerMessenger/artifacts/pipeline/citadel-front-strata/report.json',
    'TigerMessenger/assets/models/optimized/citadel-cypress/citadel-cypress-v1.glb',
    'TigerMessenger/assets/models/optimized/citadel-boarding-r04/berth.json',
}

# 只发布 build.json 当前指向的运行时包；其余历史 game-*.js 每个约 7MiB，页面从不加载
runtime_dir = 'TigerMessenger/runtime/'
runtime_current = runtime_dir + json.loads((root / 'TigerMessenger/runtime/build.json').read_text())['file']

count = total = 0
skipped_legacy = skipped_concepts = 0
tracked = [n for n in subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0') if n]
tracked_set = set(tracked)
for name in tracked:
    if not name: continue
    rel = Path(name)
    if len(rel.parts) == 1:
        allowed = name in {'index.html', '.nojekyll'}
    elif name in artifact_allow:
        allowed = True
    elif any(p in exclude or p.startswith('_backup') for p in rel.parts) or rel.parts[0] not in roots or rel.suffix.lower() not in exts:
        allowed = False
    elif name.startswith(exclude_paths):
        allowed = False
        src = root / rel
        skipped_concepts += src.stat().st_size if src.is_file() and not src.is_symlink() else 0
    elif name.startswith(runtime_dir) and rel.name.startswith('game-') and name != runtime_current:
        allowed = False
        src = root / rel
        skipped_legacy += src.stat().st_size if src.is_file() and not src.is_symlink() else 0
    else:
        allowed = True
    if not allowed: continue
    src = root / rel
    if src.is_symlink() or not src.is_file(): continue
    target = out / rel
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(src,target)
    total += src.stat().st_size; count += 1
for name in ['frontend/home.html','TigerMessenger/pipeline.html','CartonBook/index.html','CartonBook/chapters/bookshop-letter/book.html']:
    if not (out/name).is_file(): raise SystemExit('Missing public entry: '+name)
for name in artifact_allow:
    if not (out/name).is_file(): raise SystemExit('Missing startup artifact: '+name)

# 构建期守护：打包产物里所有可加载资源引用都必须存在于发布目录，否则线上必然 404
ref_pat = re.compile(r"""["'`(]((?:\.\./)*(?:\./)?(?:assets|music|artifacts|data|vendor)/[^"'`()\s]+?\.(?:png|jpg|jpeg|webp|gif|glb|gltf|bin|wasm|json|mp3|ogg|wav|svg|glsl|frag|vert))["'`)]""")
js_text = (out / runtime_current).read_text(encoding='utf-8', errors='ignore')
missing_refs, upstream_gaps = set(), set()
for m in ref_pat.finditer(js_text):
    raw = m.group(1)
    if '$' in raw: continue
    ref = re.sub(r'^(?:\.\./|\./)+', '', raw)
    try: ref = ref.encode().decode('unicode_escape')
    except Exception: pass
    # data/ 相对 runtime 目录解析，其余相对 TigerMessenger 根
    bases = ('runtime',) if ref.startswith('data/') else ('',)
    if any((out / 'TigerMessenger' / b / ref).is_file() for b in bases): continue
    if any(f'TigerMessenger/{b}/{ref}'.replace('//', '/') in tracked_set for b in bases):
        missing_refs.add(ref)
    else:
        upstream_gaps.add(ref)
if upstream_gaps:
    for ref in sorted(upstream_gaps): print('  warn: bundle references a file absent from the repo: ' + ref)
if missing_refs:
    for ref in sorted(missing_refs): print('  missing runtime resource: ' + ref)
    raise SystemExit(f'{len(missing_refs)} tracked runtime resources referenced by the bundle are not published')

if total > 900 * 1024 * 1024: raise SystemExit('Site exceeds 900 MiB budget')
print(f'Published {count} regular files, {total/1024/1024:.1f} MiB; no symlinks')
print(f'Skipped {skipped_legacy/1024/1024:.1f} MiB of legacy runtime bundles and {skipped_concepts/1024/1024:.1f} MiB of concept art')
