"""Build the public website from tracked runtime files, never local archive links."""
from pathlib import Path
import hashlib, json, re, subprocess, shutil, sys

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/tiger-pages-site').resolve()
if out == root or root in out.parents:
    raise SystemExit('Output must be outside the working tree')
out.mkdir(parents=True, exist_ok=True)

roots = {'api', 'frontend', 'TigerMessenger', 'CartonBook', 'townscaper-web'}
# 任意层级都排除的采集/临时/依赖目录
exclude_any = {'artifacts', 'tests', 'node_modules', 'optimized', 'godot', 'godot-web', 'tmp', '_to_delete', 'originals'}
# 仅顶层排除：仓库根的构建脚本与文档；TigerMessenger/src/tools 是运行时源码，必须发布
exclude_top = {'tools', 'docs'}
exts = {'.html','.css','.js','.mjs','.cjs','.json','.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.glb','.gltf','.bin','.wasm','.woff','.woff2','.ttf','.ogg','.mp3','.wav','.glsl','.vert','.frag','.pdf'}

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

# 学习工坊运行时 fetch 的工坊快照：本地由 backend/main.py 提供，Pages 上没有后端，
# 因此把同一路径的内容作为静态文件发布（无扩展名，靠 static_allow 放行）。
static_allow = {
    'api/workshop/learning-snapshot',
}

# 学习工坊不是静态展示：它会在浏览器里 fetch 证据回执做 sha256 校验，并把「查看源码」
# 直接链到 tests/ 与 coverage/ 里的真实文件。这些目录在 exclude_any 里（artifacts 本体
# 有 6 GiB 不能整棵发布），所以按子树 + 扩展名精确放行 —— 少了它们，线上就是
# 「证据已变化」和一堆 404，看起来就像代码没推上去。
evidence_subtrees = {
    'TigerMessenger/artifacts/workshop-tests/': ({'.json'}, {'browser.json'}),
    'townscaper-web/REACodeRefactoring/artifacts/coverage/': ({'.md', '.json'}, None),
    'townscaper-web/REACodeRefactoring/tests/': ({'.mjs', '.js', '.cjs', '.md', '.json'}, None),
}


def evidence_allowed(name):
    for prefix, (suffixes, names) in evidence_subtrees.items():
        if not name.startswith(prefix):
            continue
        rel = Path(name)
        if rel.suffix.lower() not in suffixes:
            continue
        if names is not None and rel.name not in names:
            continue
        return True
    return False

# 只发布 build.json 当前指向的运行时包；其余历史 game-*.js 每个约 7MiB，页面从不加载
runtime_dir = 'TigerMessenger/runtime/'
runtime_current = runtime_dir + json.loads((root / 'TigerMessenger/runtime/build.json').read_text())['file']

count = total = 0
skipped_legacy = skipped_concepts = evidence_count = evidence_total = 0
tracked = [n for n in subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0') if n]
tracked_set = set(tracked)
for name in tracked:
    if not name: continue
    rel = Path(name)
    if len(rel.parts) == 1:
        allowed = name in {'index.html', '.nojekyll'}
    elif name in artifact_allow or name in static_allow:
        allowed = True
    elif evidence_allowed(name):
        allowed = True
    elif any(p in exclude_any or p.startswith('_backup') for p in rel.parts) or rel.parts[0] in exclude_top or rel.parts[0] not in roots or rel.suffix.lower() not in exts:
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
    size = src.stat().st_size
    total += size; count += 1
    if evidence_allowed(name):
        evidence_count += 1; evidence_total += size
for name in ['frontend/home.html','TigerMessenger/pipeline.html','CartonBook/index.html','CartonBook/chapters/bookshop-letter/book.html']:
    if not (out/name).is_file(): raise SystemExit('Missing public entry: '+name)
for name in artifact_allow:
    if not (out/name).is_file(): raise SystemExit('Missing startup artifact: '+name)

# 学习快照守护：静态快照必须与 learn/ 源文件逐字节一致，否则学习工坊会展示旧资料
snapshot_rel = 'api/workshop/learning-snapshot'
if not (out/snapshot_rel).is_file():
    raise SystemExit('Missing static learning snapshot; run tools/build_learning_snapshot.py')
snapshot = json.loads((out/snapshot_rel).read_text(encoding='utf-8'))
learn_root = root / 'townscaper-web' / 'REACodeRefactoring'
stale = [f['path'] for f in snapshot.get('files', [])
         if not (learn_root / f['path']).is_file()
         or hashlib.sha256((learn_root / f['path']).read_bytes()).hexdigest() != f['sha256']]
present = {f['path'] for f in snapshot.get('files', [])} | set(snapshot.get('missing', []))
declared = {'learn/architecture.js','learn/pipeline.js','learn/data.js','learn/coverage.json','learn/coverage-progress.json','learn/refactoring-status.js','learn/coverage-overrides.json'}
if set(present) != declared:
    stale.append('file set ' + ','.join(sorted(set(present) ^ declared)))
if stale:
    raise SystemExit('Static learning snapshot is stale (' + ', '.join(sorted(stale)) + '); run tools/build_learning_snapshot.py')

# 证据回执守护：学习工坊会 fetch 交付回执并校验 sha256，缺一个就会在页面上显示
# 「证据或代码已变化」。这里把回执清单当成发布契约。
deliveries_rel = 'TigerMessenger/src/scene-authoring/catalog/learning-backlog-deliveries.json'
deliveries = json.loads((root / deliveries_rel).read_text(encoding='utf-8'))
evidence_refs = set()


def collect_evidence(node):
    if isinstance(node, dict):
        for k, v in node.items():
            if isinstance(k, str) and k.startswith(('townscaper-web/REACodeRefactoring/', 'TigerMessenger/artifacts/workshop-tests/')):
                evidence_refs.add(k)
            collect_evidence(v)
    elif isinstance(node, list):
        for item in node:
            collect_evidence(item)


collect_evidence(deliveries)
missing_evidence = sorted(p for p in evidence_refs if not (out / p).is_file())
if missing_evidence:
    for p in missing_evidence:
        print('  missing learning evidence: ' + p)
    raise SystemExit(f'{len(missing_evidence)} learning-workshop evidence files referenced by {deliveries_rel} are not published')

# 评审证据守护：learn/data.js 里每条能力的 reviewEvidence 都会被页面直接打开，
# 而 artifacts/coverage 默认整棵忽略（6 GiB 帧图），新一批证据很容易被静默漏掉。
learn_data_rel = 'townscaper-web/REACodeRefactoring/learn/data.js'
learn_data = (out / learn_data_rel).read_text(encoding='utf-8', errors='ignore')
review_refs = set(re.findall(r'"reviewEvidence":\s*"([^"]+)"', learn_data))
missing_review = sorted(r for r in review_refs if not (out / 'townscaper-web/REACodeRefactoring' / r).is_file())
if missing_review:
    for r in missing_review:
        print('  missing review evidence: ' + r)
    raise SystemExit(f'{len(missing_review)} reviewEvidence files in learn/data.js are not published; check .gitignore and add them')

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
print(f'Published {evidence_count} learning-workshop evidence files ({evidence_total/1024/1024:.1f} MiB)')
print(f'Skipped {skipped_legacy/1024/1024:.1f} MiB of legacy runtime bundles and {skipped_concepts/1024/1024:.1f} MiB of concept art')
