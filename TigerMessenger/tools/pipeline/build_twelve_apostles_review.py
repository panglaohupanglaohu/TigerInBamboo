# -*- coding: utf-8 -*-
"""Build the local three-hour review from actual saved captures and evidence."""
from pathlib import Path
import json,html
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'artifacts/pipeline/twelve-apostles-three-hour'
state=json.loads((OUT/'progress.json').read_text())
score=state.get('independentVisualScores',{})
final=state.get('finalRound','r09')
def img(name,caption):
 p=OUT/name
 return f'<figure><a href="{html.escape(name)}"><img loading="lazy" src="{html.escape(name)}" alt="{html.escape(caption)}"></a><figcaption>{html.escape(caption)}</figcaption></figure>' if p.exists() else ''
gallery=''.join(img(f'{final}-{view}.png',caption) for view,caption in [('hero','固定主柱视角 · 实际游戏渲染'),('complete','完整岩柱 · 实际游戏渲染'),('foliage','植被近景 · 实际表面承托'),('base','海蚀基座 · 实际球面水线'),('coastline','岩群与沿海铁路'),('rail','列车眼高'),('plaza','书店镇广场'),('dusk','黄昏光照'),('albedo','技术对照 · 本色（无局部明暗）'),('silhouette','技术对照 · 白色剪影')])
checks=state.get('finalChecks',{})
rows=''.join(f'<tr><td>{html.escape(str(k))}</td><td>{html.escape(str(v))}</td></tr>' for k,v in checks.items())
scoretable=''.join(f'<tr><td>{html.escape(k)}</td><td>{v}/100</td></tr>' for k,v in score.items())
coverage=''.join('<tr><td>'+html.escape(x['request'])+'</td><td>'+html.escape(x['status'])+'<br>'+html.escape(x['result'])+'<br><span class="muted">'+html.escape(x['remaining'])+'</span></td></tr>' for x in state.get('requirementCoverage',[]))
status=html.escape(state.get('status','进行中'))
body=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>十二门徒 · 三小时迭代交卷</title><style>
:root{{color-scheme:dark;font:16px/1.7 system-ui,sans-serif;background:#142229;color:#e7ece7}}body{{max-width:1320px;margin:auto;padding:30px}}h1{{font-size:clamp(30px,4vw,52px);line-height:1.2;margin-bottom:15px}}h2{{font-size:24px;margin-top:40px}}p{{max-width:960px}}a{{color:#a7cfcb}}nav{{display:flex;gap:14px;flex-wrap:wrap;margin:25px 0}}nav a{{background:#29434b;padding:9px 16px;border-radius:8px;text-decoration:none}}.muted{{color:#acbbb8}}.gallery,.compare{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}}figure{{margin:0;background:#1d3038;border:1px solid #35505a;border-radius:10px;overflow:hidden}}img{{display:block;width:100%}}figcaption{{padding:12px 16px}}table{{border-collapse:collapse;width:100%;max-width:850px}}td,th{{text-align:left;border-bottom:1px solid #395059;padding:9px 14px}}details{{background:#1d3038;padding:18px;border-radius:10px;margin-top:22px}}.badge{{color:#c6dfa8;font-size:14px;letter-spacing:.08em}}@media(max-width:850px){{body{{padding:18px}}.gallery,.compare{{grid-template-columns:1fr}}}}</style>
<header><div class="badge">2026-10-04 · 十二门徒 · 三小时迭代</div><h1>岩肩、草缘与海蚀水线</h1><p class="muted">当前记录：{status}。交卷时间约定为北京时间 19:12。本批已接入游戏默认运行时，<code>?seaStackStudy=0</code>保留旧版比较。所有“实际场景”图片来自游戏画布；独立组件试验有单独标记，不代替整场景验收。</p></header>
<nav><a href="live.html?seaStackStudy=1">打开实际场景与检查控件</a><a href="live.html?seaStackStudy=0">查看保留的旧版</a><a href="component.html">独立组件技术试验</a><a href="progress.json">迭代记录</a></nav>
<h2>同机位前后对照</h2><div class="compare">{img('baseline-hero.png','修改前 · 固定主柱视角')}{img(f'{final}-hero.png','本轮结果 · 相同主柱机位与白昼时钟')}</div>
<h2>实际场景</h2><div class="gallery">{gallery}</div>
<h2>五项要求落实范围</h2><table>{coverage}</table><h2>逐轮独立评分</h2><p class="muted">同一独立评审按形体25、植被25、光照20、配色15、场景融入15分评图。属于主观美术评价，不是算法客观分数；未拍到的内容不凭代码加分。r01主代理评分不加入此序列。</p><table><tr><th>版本</th><th>独立评分</th></tr>{scoretable}</table>
<h2>仍需继续改善</h2><p>{html.escape(state.get("remainingSummary","本轮仍在迭代，最终差距将在交卷时据实填写。"))}</p><h2>验收证据</h2><table>{rows}</table><p><a href="{final}-checks.json">完整场景检查 JSON</a> · <a href="manifest.json">源文件与证据摘要</a> · <a href="{final}-test-suite.json">五组自动检查</a> · <a href="{final}-performance.json">实际性能样本</a> · <a href="legacy-final-conditions-performance.json">同条件旧版性能样本</a></p>
<details><summary>方法及范围</summary><p>手工海岸体块决定轮廓，现有一维 WFC 模块词汇负责兼容选择，选择结果实际约束台宽、退台与峰冠参数；它不是完整三维 WFC，也不直接集成 ndwfc。岩面语义约束平滑保护底面、台地与裂口。草皮按最终岩面中可承土的连通区域生成，以真实三维边界距离内缩、羽化草缘，灌木使用有枝叶结构的实例几何。</p><p>岩石、草与灌木采用实际场景主光方向，岩体高度场与128×128局部灌丛遮蔽分别计算，浪沫贴合实际球面并同步水面波形与深度偏移；不宣称还原 Oskar 私有光照或完整 GI。局部 2.5D 场仍不支持跨岩柱和所有角色的投影。表面/海面版本合同限定于本岩群，不代表全球球面原子更新。</p><p>铁路检查为密集采样而非连续碰撞数学证明。主柱机位固定；“叶丛近景”自动选择当前最密集岩台，可能随植被变化换目标，不能作为严格像素前后对照。</p></details>
<details><summary>研究依据与保留内容</summary><p>沿用已研究的 Bad North 手工模块与接口、Townscaper 局部约束和形体优先原则；本批自制几何、植被及球面接触实现均为项目适配。未下载或导入作者私有素材。</p><p><a href="../../research/oskar-deep-20261004/review.html">本地研究总览</a> · <a href="https://www.youtube.com/watch?v=0bcZb-SsnrA">EPC2018 · Wave Function Collapse in Bad North</a> · <a href="https://www.youtube.com/watch?v=6JcFbivo8dQ">Konsoll2018 · Developing the Bad North Look</a></p></details>
<footer><p class="muted">原布局八座岩柱、叹息之门左侧区域、铁路与广场保护边界继续保留。评分、图片和检查按实际结果更新。</p></footer></html>'''
(OUT/'review.html').write_text(body)
print(OUT/'review.html')
