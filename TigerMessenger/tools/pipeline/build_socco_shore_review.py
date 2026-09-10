import html
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
output = root / 'artifacts/pipeline/socco-web-berth'
report = json.loads((output / 'report.json').read_text())
rows = []
for ship in report.get('transport', []):
    roster = ship['roster']
    counts = [len(roster)] + [sum(bool(e.get(k)) for e in roster) for k in ('departed', 'returned', 'forcedReturn', 'dead')]
    rows.append('<tr><td>' + html.escape(ship['name']) + '</td>' + ''.join(f'<td>{n}</td>' for n in counts) + '</tr>')
passed = sum(c['passed'] for c in report['checks'])
status = '检查通过' if report['passed'] else '仍有检查未通过'
extra = ''
detour_path = root / 'artifacts/pipeline/socco-battlefield-return/report.json'
if detour_path.exists():
    detour = json.loads(detour_path.read_text())
    if detour.get('passed'):
        length = detour['entry']['returnPathLength']
        extra += f'<h2>从战斗位置绕行返回</h2><p>在实际苔庭将一名活兵放到经过净空检查的位置，由原任务更新器完成约{length:.2f}米回程，再走舷梯回舱；21人全部真实回舱、0兜底。这个诊断含一次起点摆位，不冒充自然战斗。</p><img src="../socco-battlefield-return/actual-detour.png"><p><a href="../socco-battlefield-return/report.json">实际绕行报告</a> · <a href="../socco-return-routes/report.json">精确寻路与失败处理检查</a></p>'
for candidate in sorted((root / 'artifacts/pipeline/socco-web-evacuation').glob('*/report.json'), reverse=True):
    evacuation = json.loads(candidate.read_text())
    hashes = evacuation.get('localAfter', {})
    if not (evacuation.get('passed') and evacuation.get('localStable') and hashes):
        continue
    if not all(hashlib.sha256((root / p).read_bytes()).hexdigest() == sha for p, sha in hashes.items()):
        continue
    labels = {'casualty-normal': '伤亡后正常撤离', 'casualty-normal-blocked': '受阻：45秒撤离', 'casualty-emergency-blocked': '机队离站：12秒撤离'}
    case_rows = ''
    for case in evacuation['cases']:
        a = case['accounting']
        label = labels.get(case['scenario'], case['scenario'])
        case_rows += f'<tr><td>{html.escape(label)}</td><td>{a["returned"]}</td><td>{a["dead"]}</td><td>{a["forced"]}</td><td>{a["unresolved"]}</td></tr>'
    extra += f'<h2>伤亡与紧急撤离</h2><table><tr><th>诊断场景</th><th>真实回舱</th><th>阵亡</th><th>兜底</th><th>未解决</th></tr>{case_rows}</table><p>本组包含真实伤害函数调用、明确的持续受阻故障注入及机队离站设置。兜底是原作超时处理，未计为走回舱内；所测运行源码与当前文件一致。<a href="../socco-web-evacuation/{candidate.parent.name}/index.html">查看逐人记录与版本</a></p>'
    break
page = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SOCCO · 岸边上下船验收</title><style>body{{font:17px/1.75 system-ui;background:#14252c;color:#e6ece8;max-width:1100px;margin:30px auto;padding:20px}}img{{width:100%}}a{{color:#ace0e5}}table{{width:100%;border-collapse:collapse}}td,th{{padding:10px;text-align:left;border-bottom:1px solid #53717a}}</style>
<h1>SOCCO · 岸边上下船</h1><p>{status}：{passed} / {len(report['checks'])} 项。下列人数来自实际网页任务更新器的诊断运行。</p>
<table><tr><th>运兵艇</th><th>编入</th><th>实际离艇</th><th>实际回舱</th><th>超时兜底</th><th>阵亡</th></tr>{''.join(rows)}</table>
<h2>离艇</h2><img src="actual-unloading.png"><h2>回舱</h2><img src="actual-return.png">
<p>保留原地形、树木和庭石；泊位随障碍调整，岸边集合点随船朝向变化。先安排远处位置，回程按相反顺序进入共用路段，舷梯单人通行。超时兜底人数与真实回舱分开统计。</p>
{extra}
<p>范围：这些是诊断启动和明确注入的检查，尚不能代替自然受击触发和整场战斗验收。精确回岸静态路径已接入；全场作战移动、跨艇人物动态避障、完整人体碰撞、运动地形重规划和连续重置仍需继续。</p>
<p><a href="report.json">逐项报告</a> · <a href="http://localhost:8931/TigerMessenger/?assetRevision=socco-shore-v3">打开游戏</a> · <a href="../saihoji-battle-review/index.html">资产总览</a></p></html>'''
(output / 'index.html').write_text(page)
print(output / 'index.html')
