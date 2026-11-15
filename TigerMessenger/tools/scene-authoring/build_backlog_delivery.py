"""Evidence-gated supplement; never overwrite concurrent upstream learning ledgers."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[3];UP=ROOT/'townscaper-web/REACodeRefactoring';OUT=ROOT/'TigerMessenger/src/scene-authoring/catalog/learning-backlog-deliveries.json'
learn=json.loads((UP/'learn/data.js').read_text().split('=',1)[1].strip().removesuffix(';'));by={x['id']:x for x in learn['items']}
ledger=json.loads((OUT.parent/'learning-backlog-review.json').read_text());bytitle={x['title']:x for x in ledger['items']}
receipt='TigerMessenger/artifacts/workshop-tests/environment-menu-20261112/browser.json';run=json.loads((ROOT/receipt).read_text());assert run['passed'] and {x['grid'] for x in run['grids']}=={'quad','mixed'}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def source_record(x):return {k:x.get(k) for k in ['id','decodedFrames','reviewEvidence','reviewStages']}
rows=[]
def add(title,stage,ids,done,remaining,closed=False):
 old=bytitle[title];studies=[]
 for id in ids:
  x=by[id];assert x['reviewStages']['allFramesReviewed'] is True
  assert (UP/x['reviewEvidence']).is_file()
  studies.append(source_record(x))
 entry={'节点图可视编辑器':'node-editor.html','弹道场景碰撞与参数口径':'index.html?scene=fusion','血腥开关样式与底材色差':'index.html?scene=badnorth','飞岛补全片学习':'index.html?flying=1','可走图调试与削台标定':'index.html?scene=badnorth','格心语义与三维网格':'index.html?scene=fusion&grid=mixed'}.get(title)
 rows.append({'entry':entry,'id':old['id'],'fingerprints':[r['fingerprint'] for r in old['records']],'stage':stage,'closed':closed,'studies':studies,'done':done,'remaining':remaining})
add('弹道场景碰撞与参数口径','implementation',['816332161036984320'],['核对已有177帧全片审阅；本轮未增加观看帧数。','新增逐段场景网格碰撞截断、线性/二次阻力模型；主场景菜单可直接预览，未改地形。'],['与定点射表的运行轨迹还需统一；碰撞预览尚未改写战斗箭矢。','Inspector第三参数与原作者阻力模型无法仅凭原片确定，保留来源疑问。'])
add('拆建动画时序素材','source',['806856212260278272'],['核对已有332帧/4张联系表及原尺寸审阅；该片已学完。'],['当前片段整块消失，无法还原块间时序；需有逐块过程的来源才能精确复刻。','不以自行编造的时序冒称原片实现。'])
add('血腥开关样式与底材色差','implementation',['999191760944418817'],['核对已有111帧全片审阅。','主菜单接真实gore开关，切换血迹/血滴/尸体层；北境之外禁用。'],['血迹对深浅底材的色差仍待实现与实测。','原片未出现控制面板，不能声称复刻其开关样式。'])
add('飞岛补全片学习','validation',['1313837640366596096'],['已有315帧/4张联系表全片审阅与第56批整列抬升、支腿、涟漪、白色构件实现证据。','核销“只看第1张联系表”旧排期；不重复计算学习帧数。'],[],True)
add('可走图调试与削台标定','source',['917405214638006273'],['核对已有834帧全片审阅。','补可走格角红点、实际背景格网，使用共享World和形变后的格角；主场景可开关。'],['原片未显示削台前状态，也不能测出原作者削低档数；当前两档只是明确标注的本地策略。','精确原作参数仍需新来源，不伪造六边格覆盖当前四边/混合格。'])
add('格心语义与三维网格','implementation',['1459169210752507904','1466059785703460870','1489193847422865410','1490068909042642944'],['核对四条来源已有全片审阅。','将共享格型分类接入当前World三维地形，保留崖壁两侧高度、三角/四边/过渡边配色。'],['radialLayout分量/补丁分组与极坐标十字刻度仍未完成。','格心彩色小块语义无确证，不据此编造机制。'])
add('节点图可视编辑器','validation',['1724449858369568780'],['本轮新增真实节点编辑器：拖动、按端口连线与删线、增删节点、分组参数、实时求值预览。','图与布局/运行状态保存载入、撤销重做；拒绝环路、错类型和重复输入，失败不污染原图。'],[],True)
node_receipt='TigerMessenger/artifacts/workshop-tests/node-editor-20261112/browser.json';node_run=json.loads((ROOT/node_receipt).read_text());assert node_run['passed']
node_paths=['src/core/node-graph-runtime.js','src/core/node-graph-editor.js','src/ui/node-graph-editor.js','node-editor.html','node-graph.html','tests/node-graph-editor.mjs']
assert all(node_run['sourceHashes'].get(p)==sha(UP/p) for p in node_paths)
paths=['src/badnorth/house-char.js','tests/house-char.mjs','src/world/view.js','src/badnorth/battle.js','src/badnorth/battle-c01.js','src/badnorth/battle-c02.js','src/badnorth/battle-c03.js','src/badnorth/battle-g3.js','src/ui/environment-panel.js','src/ui/scene-capability-panel.js','src/ui/shading-panel.js','src/core/trajectory-trace.js','src/world/trajectory-preview.js','src/core/nav-diagnostic-geometry.js','src/world/nav-diagnostic-overlay.js','tests/trajectory-trace.mjs','tests/nav-diagnostic-geometry.mjs']
assert all(run.get('sourceHashes',{}).get(p)==sha(UP/p) for p in paths),'Code changed since browser verification'
proof={str((UP/p).relative_to(ROOT)):sha(UP/p) for p in paths};proof[receipt]=sha(ROOT/receipt)
proof.update({str((UP/p).relative_to(ROOT)):sha(UP/p) for p in node_paths});proof[node_receipt]=sha(ROOT/node_receipt)
for row in rows:
 for x in row['studies']:
  p=UP/x['reviewEvidence'];proof[str(p.relative_to(ROOT))]=sha(p)
OUT.write_text(json.dumps({'version':1,'receipt':receipt,'proofHashes':proof,'items':rows},ensure_ascii=False,indent=2)+'\n')
print('Built',len(rows),'reviewed backlog supplements; original source and upstream ledgers untouched')
