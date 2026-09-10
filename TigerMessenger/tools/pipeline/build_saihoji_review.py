"""Publish an evidence index, not an asset completion counter."""
from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/pipeline/saihoji-battle-review'
OUT.mkdir(parents=True, exist_ok=True)
rows = [
    ('罗马三兵种 · 红蓝六组', 'roman-soldier-target-v2.png', 'roman-family-blender/roman-family-v1-overview.png', '脸型、装备与握持候选完成；六组独立结构和保存动作检查通过。蓝兵进入苔庭战斗候选；尚待连续游玩验收。'),
    ('鲲 · 背岛与鲸吞', 'kun-battle-target-v1.png', 'kun-battle-v2/v2-open-three-quarter-glb-roundtrip.png', '鲲v2已修真实内壁、收窄喉道和内部横杆；121姿态无内外表面交叉。已在Godot海面上的真实吞噬场面出现，保留原背岛/六庭。完整巡航结束与重置继续验证。'),
    ('苔庭古松', 'ancient-pine-target-v1.png', 'saihoji-pines-v1/godot-pine-near-after.png', '原枝干连接、根盘和层叠树冠已优化，单树三档模型进入 Godot 资产目录。六庭25种原树的25份Blender、75份GLB已完成检查；125个原可见网格逐棵匹配实际位置。最终五页对照已完成；25棵LOD0已接原位置并通过近远GPU核对。原岛边树根悬空仍需地形修正，没有自动LOD。'),
    ('莫比斯重甲兵', 'vanguard-trooper-target-v1.png', 'vanguard-battle-v1/idle-three-quarter.png', 'Blender 关节、握柄与肩炮支架候选已完成，161 帧保存姿态检查通过，真实 GLB 材质回读通过。已在 Godot 战斗候选替换；移动仍缺完整行走步态，不能把保存姿态当作全套动作完成。'),
    ('莫比斯吸食飞艇', 'moebius-aircraft-target-v1.png', 'moebius-aircraft-v1/glb-roundtrip-full-three-quarter.png', 'Blender 采集口、支架与驾驶舱候选已完成并实际 GLB 回读。67 个原节点及动画引用保留，已在 Godot 五机编队接入新视觉，保留原运动根并接尾焰脉动；实际画面继续核对。'),
    ('SOCCO 运兵艇', 'socco-craft-target-v1.png', 'socco-craft-v1/glb-deployed-new-crew-seven.png', 'Blender 货舱、坡道和七席新重甲候选已完成，已导入 Godot 资源目录。已在实际战场完成逐座出舱和幸存者回艇；整舱底/全坡道的地形穿入已修。完整行走步态仍待补。'),
    ('传统战船 · 26 桨手', 'warship-target-v1.png', 'warship-battle-v1/glb-roundtrip-three-quarter.png', '原船轮廓、26桨与26桨手保留，新增可通行侧门和登船板，301帧握点及身体/甲板接触检查通过，但相邻桨叶仍有36帧相交，尚待修正。仅单兵收盾路径已验，未完成25名登陆兵调度或战场替换；桨手仍为原作简化造型。'),
    ('GatePod 护航艇', 'gatepod-escort-target-v1.png', 'gatepod-escort-v1/pod-41-7-glb-roundtrip.png', '已归并为一种共用护航艇，以pod-41-7为母版；三艘战场实例共用模型和动作数据，保留各自航线、比例与双索降连接。旧版仅作历史归档。已进入真实 Godot 战场并连接两名重甲的实际索降；斜绳端点已修正，完整身体扫掠仍待验。'),
]
rows = [(a,b,
         'saihoji-pines-v1/root-ground-near-after.png' if a.startswith('苔庭古松') else
         'warship-battle-v2/glb-synchronized-frame51-3q.png' if a.startswith('传统战船') else c,
         d.replace('原岛边树根悬空仍需地形修正，没有自动LOD。', '已补连续岛缘承托，425个根盘采样全命中；待机整体提高约0.553米避免海水淹没，升鲲恢复原设置。地面折面与根际过渡仍需打磨，没有自动LOD或新增导航。').replace('301帧握点及身体/甲板接触检查通过，但相邻桨叶仍有36帧相交，尚待修正。', 'v2同侧划桨同步，301保存帧相邻桨碰撞由36帧降至0；握点及身体/甲板检查通过。')) for a,b,c,d in rows]
rows = [(a,b,'warship-battle-v4/glb-frame51-three-quarter.png' if a.startswith('传统战船') else c,
         '已按主透视目标完成两轮Blender迭代：双眼移到卷曲高端，船壳、甲板与上层平台两端收尖。v3发现眼穿壳与旧封口接触，v4已修；301保存帧的新壳体及划桨检查通过，450登船接面采样无缺口。保留26原桨手与动作；尚未正式战場回接或完成25人调度。' if a.startswith('传统战船') else d) for a,b,c,d in rows]
rows = [(a,b,
         'vanguard-color-v2/after-three-quarter.png' if a.startswith('莫比斯重甲兵') else
         'socco-color-v2/after-three-quarter.png' if a.startswith('SOCCO') else c,
         d + (' 本轮配色已按目标图调整并接入Godot：深炭蓝灰装甲与灰褐护板/肩炮；已有真实出舱画面。' if a.startswith('莫比斯重甲兵') else
              ' 本轮配色已按目标图调整并接入Godot：珊瑚砖红上壳、暖象牙下舱、深棕底座和木坡道；已有真实出舱画面。' if a.startswith('SOCCO') else '')) for a,b,c,d in rows]
rows = [(a,b,c,d+(' 网页8931已接入新版几何与配色，27名重甲/3艘运兵艇加载检查通过。坡道与岸边路径已接实际地形和树石避让；诊断运行21人离艇、21人回舱、0超时兜底。完整战斗区域避障、自然触发与伤亡/紧急撤离仍待验。' if a.startswith('莫比斯重甲兵') or a.startswith('SOCCO') else '')) for a,b,c,d in rows]
cards = []
for title, reference, render, status in rows:
    paths = [ROOT/'assets/concepts'/reference, ROOT/'artifacts/pipeline'/render]
    for path in paths:
        if not path.exists():
            raise FileNotFoundError(path)
    extras = ""
    if title.startswith("莫比斯重甲兵") or title.startswith("SOCCO"):
        extras = '<p><a href="../moebius-color-review/index.html">查看目标图、配色前后与Godot实际出舱画面</a> · <a href="../web-battle-assets/index.html">网页接入记录</a></p>'
    if title.startswith("传统战船"):
        extras = '<p><a href="../warship-two-pass-review/index.html">查看目标图与两轮实际模型对照</a> · <a href="../../../assets/models/optimized/warship-battle-v4/validation-summary.json">本轮验证范围</a></p>'
    if title.startswith("苔庭古松"):
        extras = "<details><summary>展开25棵原树与优化模型对照（五页）</summary>" + "".join(f'<figure><img loading=lazy style="height:auto" src="../saihoji-pines-v1/five-seeds-page-{page}.png"><figcaption>第{page}页 · 左原作 / 右实际GLB</figcaption></figure>' for page in range(1,6)) + "</details>"
    if title.startswith("GatePod"):
        extras = "<details><summary>查看共用护航艇模型</summary><div class=pair>" + "".join(f'<figure><img loading=lazy src="../gatepod-escort-v1/{variant}-glb-roundtrip.png"><figcaption>{variant}</figcaption></figure>' for variant in ["pod-41-7"]) + "</div></details>"
    cards.append(f'<article><h2>{html.escape(title)}</h2><p>{html.escape(status)}</p><div class="pair"><figure><img loading="lazy" src="../../../assets/concepts/{reference}"><figcaption>目标参考图</figcaption></figure><figure><img loading="lazy" src="../{render}"><figcaption>实际模型记录 · 请结合上方状态阅读</figcaption></figure></div>{extras}</article>')
page = '''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>苔庭之战 · 资产与接入</title><style>body{margin:0;background:#101d23;color:#e4ecdf;font:17px/1.65 system-ui}main{max-width:1150px;margin:auto;padding:30px}h1{font-size:32px}a{color:#a0d7db}.note,article{background:#1a2c33;border:1px solid #385059;border-radius:12px;padding:22px;margin:22px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:15px}figure{margin:0}img{width:100%;height:350px;object-fit:contain;background:#d3d4cb}figcaption{font-size:14px;color:#a4bbba}h2{margin:0;font-size:22px}@media(max-width:700px){.pair{grid-template-columns:1fr}main{padding:15px}}</style><main><h1>苔庭之战 · 资产与接入</h1><p>以原作资产为起点，目标图 → Blender 候选 → Godot 战场 → 游玩验收。各阶段单独记录。</p><section class="note"><b>战斗验证已有一轮闭环，新版继续修正原规则与实景。</b><p>最新实景：重甲首人落地后即可按原规则反击，鲲不再等全员出舱才吞噬；新运兵舱门与全坡道已有实际出入。性能恢复原实例绘制后，开始镜头绘制调用减少约10.8%，并非FPS结论。下方r35为已通过完整一轮的证据。</p><div class="pair"><figure><img src="../saihoji-battle-world/native-r34-actual-swallow.png"><figcaption>r34 Godot真实鲸吞 · 原海面与战场</figcaption></figure><figure><img src="../saihoji-battle-world/native-r30-actual-socco-exit.png"><figcaption>r30 Godot真实运兵舱与坡道</figcaption></figure></div><p>r35 干地与鲲主动反击的固定步长验证记录：真实航行靠岸、305 次几何命中、六档吸力削弱、14 次真实吞入及 14 次对应吐出、撤军结束与重置。鲲后撤并转向敌群，保留原范围与前向判定。仅机队实际受击才请求重甲投放；未注入命中或登陆事件。此记录不等于完整视觉或音频验收。</p><p><a href="../saihoji-battle-world/report-r35.json">读取战斗证据</a> · <a href="../../../docs/SAIHOJI_BATTLE_ASSET_AUDIT.md">完整参战资产及规则清单</a> · <a href="../roman-family-blender/review.html">三兵种多视角与动作</a></p><p>继续修复：海面与鲲引擎颜色已恢复；原地形面朝向已修，干地列阵和新重甲、飞艇、护航艇已参与一轮战斗。继续运兵舱出入、鲲口腔、战船与完整步态。三条原曲实际音频总线抽样已通过，全曲听验仍待完成。原电车轨道距登陆点约 95 米，超过原补兵 42 米门槛，尚未接通。</p></section>'''
update = '''<section class="note"><h2>本轮更新 · 树根承托、战船划桨与绘制开销</h2><p>25棵树的原局部位置不变，岛缘连续扩展35.084平方米，425个根盘采样均有支撑。待机整体提高约0.553米，实际顶面高于最大波峰约5.15厘米。尚未新增玩家导航或动态碰撞，本轮没有重跑整场战斗。</p><div class="pair"><figure><img src="../saihoji-pines-v1/root-ground-near-after.png"><figcaption>Godot实际近景 · 地面过渡仍待美术细化</figcaption></figure><figure><img src="../saihoji-pines-v1/root-ground-far-after.png"><figcaption>Godot实际远景 · 保留25棵原布局</figcaption></figure></div><p>战船v2保留原26桨手与网格，调整划桨时序后301保存帧相邻桨碰撞为0。尚未正式回接战场，25人登陆调度待接。</p><p>原电车和城堡2602个同材质盒体表面已合并绘制，位置、UV和拓扑保持。独立电车GPU对照由372降至97次绘制，画面最大误差1/255；这不是整场FPS结果。</p><p><a href="../warship-battle-v2/review.html">战船v2多视角</a> · <a href="../saihoji-pines-v1/root-ground-support-report.json">树根承托检查</a> · <a href="../original-surface-restore/report.json">同材质绘制检查</a></p></section>'''
(OUT/'index.html').write_text(page + update + ''.join(cards) + '</main></html>')
(OUT/'status.json').write_text(json.dumps([dict(asset=a,reference=b,model_image=c,status=d) for a,b,c,d in rows],ensure_ascii=False,indent=2))
print(OUT/'index.html')
