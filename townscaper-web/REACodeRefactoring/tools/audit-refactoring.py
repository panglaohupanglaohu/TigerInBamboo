# coding: utf-8

"""Reproducible inventory; byte differences and historical claims are not visual approval."""
from pathlib import Path
import re, json, hashlib, html, difflib
root = Path(__file__).resolve().parents[1]
original = root.parent / 'REACode'
media = root.parents[1] / 'REA-agent/gifs'
readme = (media / 'README.md').read_text()
texts = dict(re.findall(r'^(\d{16,20})\s+\[([^\n]+)', readme, re.M))
learn = json.loads((root/'learn/data.js').read_text().split('window.LEARN = ',1)[1].strip().rstrip(';'))
items = {i['id']: i for i in learn['items']}
files = [p for p in root.rglob('*') if p.is_file() and p.suffix in ('.js','.html') and 'vendor' not in p.parts and 'learn' not in p.parts and p.name != 'refactoring-audit.html']
# Compare executable bodies across relocated modules, rather than same paths.
def executable(text):
    text=re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    text=re.sub(r'^\s*//.*$', '', text, flags=re.M)
    text=re.sub(r'^import .*?;\s*$', '', text, flags=re.M)
    return re.sub(r'\s+', '', text)
oldfiles=[p for p in original.rglob('*') if p.is_file() and p.suffix in ('.js','.html') and 'vendor' not in p.parts and 'learn' not in p.parts]
oldtexts={str(p.relative_to(original)):p.read_text(errors='replace') for p in oldfiles}
oldnorm={f:executable(t) for f,t in oldtexts.items()}
moduleEvidence={}
for p in files:
    if p.suffix not in ('.js','.html'): continue
    rel=str(p.relative_to(root)); text=p.read_text(errors='replace'); norm=executable(text)
    ids=set(re.findall(r'\b\d{16,20}\b',text))
    candidates=[f for f,t in oldtexts.items() if ids.intersection(re.findall(r'\b\d{16,20}\b',t)) or Path(f).name==p.name]
    if not candidates: candidates=list(oldtexts)
    # Fast matching, followed by a real token/body comparison on the best candidates.
    ranked=sorted(candidates,key=lambda f:difflib.SequenceMatcher(None,norm,oldnorm[f]).quick_ratio(),reverse=True)[:3]
    preferred={'src/core/world.js':'src/town.js','src/world/worldmesh.js':'src/townmesh.js','src/light/bake.js':'src/mesh.js','src/build/buildings.js':'src/townmesh.js'}
    best=max(ranked,key=lambda f:difflib.SequenceMatcher(None,norm,oldnorm[f]).ratio()) if ranked else None
    if rel in preferred and preferred[rel] in oldnorm: best=preferred[rel]
    ratio=difflib.SequenceMatcher(None,norm,oldnorm[best]).ratio() if best else 0
    moduleEvidence[rel]={'original':best,'bodySimilarity':round(ratio,4),'changedBody':ratio<0.995,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(root/'learn/module-comparison.json').write_text(json.dumps(moduleEvidence,ensure_ascii=False,indent=2)+'\n')
rows=[]
for id in sorted(set(texts) | {p.stem for p in media.glob('*.mp4')} | set(items), reverse=True):
    it=items.get(id,{})
    refs=[str(p.relative_to(root)) for p in files if id in p.read_text(errors='replace')]
    changed=[f for f in refs if not (original/f).exists() or (root/f).read_bytes() != (original/f).read_bytes()]
    mapped=[f for f in moduleEvidence if f in it.get('where','') or f in refs]
    evidence=[dict(path=f,**moduleEvidence[f]) for f in mapped if moduleEvidence[f]['changedBody']]
    state='未实现（历史登记）' if it.get('status')=='todo' else ('已重构 · 部分实现' if evidence else '部分实现（历史登记）') if it.get('status')=='partial' else '已重构（代码对比确认）' if evidence else '沿用实现 / 待核查'
    rows.append(dict(id=id, video=(media/(id+'.mp4')).exists(), description=texts.get(id,''), historicalStatus=it.get('status','未登记'), where=it.get('where',''), references=refs, changedReferences=changed, review=state, refactored=bool(evidence), codeEvidence=evidence, frameReview=bool(it.get("reviewEvidence") and it.get("decodedFrames")), reviewEvidence=it.get("reviewEvidence"), decodedFrames=it.get("decodedFrames",0)))
report={'date':'2026-11-01','directory':str(root),'original':str(original),'clips':rows,'meaning':'按用户确认口径：映射到实际代码且可执行主体有改进差异，即保留已重构成果；静态确认不等于本轮逐帧或运行验收。部分实现仍保留缺口。'}
(root/'learn/refactoring-status.js').write_text('window.REFACTOR_STATUS = '+json.dumps({x['id']:x['review'] for x in rows},ensure_ascii=False)+';\n')
(root/'learn/refactoring-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
e=html.escape
body=''.join(f'<tr id="clip-{r["id"]}"><td><a href="gifs/{r["id"]}.mp4">{r["id"]}</a><br>{"视频存在" if r["video"] else "缺少视频"}</td><td>{e(r["description"]) or "README 未匹配"}</td><td>{e(r["historicalStatus"])}<br>{e(r["where"])}</td><td>{e(", ".join(r["changedReferences"])) or "未找到含帖子 ID 的差异代码，需人工追踪"}</td><td>{r["review"]}</td></tr>' for r in rows)
(root/'refactoring-audit.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>REACode 重构版 · 视频审核清单</title><style>body{font:14px/1.6 system-ui;margin:28px;color:#20343c;background:#eff5f3}a{color:#236d81}table{border-collapse:collapse;width:100%}td,th{border:1px solid #b9cdce;padding:10px;vertical-align:top}tr:target{background:#ffe6a6}td:first-child{white-space:nowrap}th{text-align:left}</style><h1>REACode 重构版 · 视频审核清单</h1><p><a href="index.html">返回重构版场景</a> · <a href="pipeline.html">管线</a> · <a href="learn/refactoring-audit.json">审计数据</a></p><p>2026-11-01：共 '''+str(len(rows))+''' 条。原文先按帖子 ID 匹配，再学习视频。按用户确认口径，跨目录匹配实际代码并比较可执行主体，有差异改进即保留“已重构”成果。部分实现仍保留缺口。此为快速静态扫描，不表示本轮重新逐帧或运行验收；无需全部从头学习。模块对比证据见 learn/module-comparison.json。</p><table><thead><tr><th>视频</th><th>README 对应原文</th><th>历史记录 / 代码位置</th><th>含帖子 ID 且与原版有差异的代码</th><th>审核状态</th></tr></thead><tbody>'''+body+'</tbody></table></html>')
print('视频清单',len(rows),'本地视频',sum(r['video'] for r in rows),'历史笔记',len(items),'README 匹配',len(texts))
