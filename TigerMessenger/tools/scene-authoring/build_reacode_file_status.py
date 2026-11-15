"""Read-only whole-directory inventory. Candidate links do not imply completion."""
from pathlib import Path
from collections import Counter
import hashlib,json,re,posixpath
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[3];SOURCE=ROOT/'townscaper-web/REACode';TARGET=ROOT/'townscaper-web/REACodeRefactoring'
COVER=json.loads((TARGET/'learn/coverage.json').read_text());by={m['source']:m for m in COVER['modules']}
EVIDENCE='TigerMessenger/artifacts/workshop-tests/source-refactor-20261112'
# These are scoped source-code deliveries with actual execution evidence, not claims of complete visual reproduction.
DELIVERIES={
 'engine/spritepack.js':{'targets':['src/core/atlas.js','src/core/sprite-atlas.js','sprite-atlas.html'],'scope':'共享Atlas上的SpriteAtlas插入/更新/释放/重排/有界增长，保留padding；径向放置15组原版差分一致。','gap':'内部树结构与重排坐标不作序列化契约；一般三角UV页填充率与主View接入是独立续项。'},
 'src/mipfilter.js':{'targets':['src/light/mip-chain.js','src/light/mip-ground.js','mip-ground.html'],'scope':'完成共享mip生成/采样到透视铺地、过滤对照、均值/闪烁度量与Canvas绘制的消费者迁移。RGB浮点/IEC sRGB/重复寻址替代旧RGBA字节/gamma2.2接口；数值与原版不完全等价。','gap':'原片精确过滤内核未公开；尚未接主场景impostor图集。'},
 'engine/outline.js':{'targets':['src/world/outline-pass.js','src/world/outline-painted-normal.js','src/world/view-post-extras.js','outline-painted.html'],'scope':'原描边pass保留几何模式；接共享程序笔触法线图作为主World法线缓冲线源，开关/异常恢复/双网格GLSL运行验证。','gap':'原片美术/UV图块与远景投影接缝尚非精确复现。'},
 'engine/mipfilter.html':{'targets':['mip-ground.html'],'scope':'原透视铺地实验迁入共享mip模块的可运行对照页。','gap':'不是原HTML逐像素复刻，过滤内核和地址策略差异见模块说明。'}
}
SUPPORT={'learn/data.js':['learn/data.js'],'learn/pipeline.js':['learn/pipeline.js'],'learn/learned.js':['learn/data.js'],'learn/learnui.js':['src/ui/learnpanel.js']}
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
try:receipt=json.loads((ROOT/EVIDENCE/'browser.json').read_text())
except (OSError,ValueError):receipt={}
def verified_delivery(targets):return receipt.get('passed') is True and all((TARGET/t).is_file() and receipt.get('sourceHashes',{}).get(t)==digest(TARGET/t) for t in targets)
def dependencies(text,relative):
 refs=re.findall(r'(?:from\s*|import\s*\(|\bsrc\s*=\s*)[\'\"]([^\'\"]+)[\'\"]',text)
 out=[]
 for s in refs:
  if s.startswith('.') or re.match(r'^(?:src|engine|learn|vendor)/',s):
   p=posixpath.normpath(posixpath.join(posixpath.dirname(relative),s.split('?')[0].split('#')[0]));
   if not p.startswith('../'):out.append(p)
 return sorted(set(out))
files=sorted(p for p in SOURCE.rglob('*') if p.is_file() and p.suffix in {'.js','.mjs','.html'} and not any(x in p.relative_to(SOURCE).parts for x in ['.git','node_modules','artifacts','.workbuddy']))
rows=[]
for p in files:
 rel=p.relative_to(SOURCE).as_posix();text=p.read_text();deps=dependencies(text,rel);m=by.get(rel);targets=[];evidence=[];gap='';scope='';verified=False
 if rel.startswith('vendor/'):
  kind='第三方依赖';state='保留第三方';targets=['vendor/'+p.name] if (TARGET/'vendor'/p.name).is_file() else [];gap='第三方Three.js发行包；列入清单但不重写其实现。'
 elif m:
  kind='核心模块';targets=m['targets'];state='待补代码' if '部分' in m['status'] else '待运行验收' if '静态' in m['status'] else '已迁移待完整核验';gap=m.get('gap','');scope=m['status']
  if m.get('evidence'):evidence=[{'root':'refactored','path':m['evidence'],'exists':(TARGET/m['evidence']).is_file()}]
 elif rel in SUPPORT:
  kind='学习界面/数据';state='待工具/数据核验';targets=SUPPORT[rel];gap='有职责落点；数据记录不是算法，旧UI布局与新的学习工坊需逐项核验。'
 elif rel.startswith('tmp/'):
  kind='临时原型';state='待原型归档判定';gap='历史临时文件，保留原件；不自动算生产能力或删除。'
 elif rel.endswith('.mjs'):
  kind='开发工具';state='待工具/数据核验';candidates={'shot.mjs':['tools/shot.py'],'video-frames.mjs':['tools/extract-review-frames.py'],'contact-sheet.mjs':['tools/extract-review-frames.py'],'mark.mjs':['tools/record-review.mjs'],'report.mjs':['tools/gen-pipeline-md.mjs'],'ab.mjs':['tools/shot-ab.py']};targets=candidates.get(p.name,[]);gap='仅列候选职责替代；原脚本的本机路径/端口/输出契约尚未逐项验证。'
 else:
  kind='页面/内联代码';state='待页面核验';targets=[rel] if (TARGET/rel).is_file() else []
  for dep in deps:
   if dep in by:targets.extend(by[dep]['targets'])
  if not targets:
   stem=p.stem.removesuffix('lab');candidate=stem+'.html'
   if (TARGET/candidate).is_file():targets.append(candidate)
  gap='静态候选关联，尚未证明页面内联控制器/交互行为已迁移；不能用依赖模块完成替代页面完成。'
 if rel=='src/floatprobe.js':state='已迁移待跨GPU验收'
 if rel=='src/flowfield.js':state='已迁移待集成/性能验收'
 if rel=='src/spheretown.js':state='待补形状约束'
 if rel=='src/combatfx.js':state='待补动作/美术'
 if rel in DELIVERIES:
  d=DELIVERIES[rel];targets=d['targets'];scope=d['scope'];gap=d['gap'];verified=verified_delivery(targets);state='本轮代码验证通过' if verified else '本轮代码待复验';evidence=[{'root':'workspace','path':EVIDENCE+'/browser.json','exists':(ROOT/EVIDENCE/'browser.json').is_file()}]
 rows.append({'source':rel,'sha256':digest(p),'bytes':p.stat().st_size,'lines':len(text.splitlines()),'kind':kind,'state':state,'verifiedDelivery':verified,'scope':scope,'gap':gap,'clips':m.get('clips',[]) if m else [],'dependencies':deps,'inlineScripts':len(re.findall(r'<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?</script>',text,re.I)) if p.suffix=='.html' else 0,'targets':[{'path':t,'exists':(TARGET/t).is_file(),'sha256':digest(TARGET/t) if (TARGET/t).is_file() else None} for t in sorted(set(targets))],'evidence':evidence})
report={'generatedAt':datetime.now(timezone.utc).isoformat(),'sourceRoot':'townscaper-web/REACode','scope':'所有.js/.mjs/.html文件；不含artifacts/.git/node_modules/.workbuddy；原件只读。','warning':'有落点/有局部证据不等于完整重构验收；本轮通过仅对应明确交付范围，保留扩展差距。','total':len(rows),'extensions':dict(Counter(p.suffix for p in files)),'states':dict(Counter(r['state'] for r in rows)),'kinds':dict(Counter(r['kind'] for r in rows)),'rows':rows}
out=ROOT/'TigerMessenger/src/scene-authoring/catalog/reacode-file-status.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
md=['# REACode 全目录重构状态','',report['scope'],'',report['warning'],'',f"共 {report['total']} 文件：{report['extensions']}。",'', '| 原文件 | 类别 | 当前状态 | 重构落点 |','|---|---|---|---|']
for r in rows:md.append('| '+r['source']+' | '+r['kind']+' | '+r['state']+' | '+('、'.join(t['path'] for t in r['targets']) or '待建立落点')+' |')
(ROOT/'TigerMessenger/docs/REACODE_REFACTOR_STATUS.md').write_text('\n'.join(md)+'\n');print(json.dumps({'total':report['total'],'extensions':report['extensions'],'states':report['states']},ensure_ascii=False))
