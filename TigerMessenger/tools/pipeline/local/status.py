"""Generate a local, read-only production status page from saved evidence."""
import argparse
from datetime import datetime, timezone
import html
import json
import os
from pathlib import Path
from runner import digest


LABELS = {'passed': '工程检查通过', 'running': '正在执行', 'failed': '失败，已留档',
          'interrupted': '执行中断', 'needs_review': '重试已停止，待检查'}


def build(root, config_path, output):
    root, output = Path(root).resolve(), Path(output).resolve()
    config = json.loads(Path(config_path).read_text())
    state_path = root / 'assets/pipeline/local-runs/state.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {'jobs': {}}
    queue = json.loads((root / 'assets/pipeline/queue.json').read_text())
    esc = html.escape

    def link(path, label):
        target = (root / path).resolve()
        if not target.is_relative_to(root) or not target.is_file():
            return esc(label) + '（文件不可用）'
        href = os.path.relpath(target, output.parent)
        return '<a href="' + esc(href, quote=True) + '">' + esc(label) + '</a>'

    rows = []
    for jid, job in sorted(state['jobs'].items()):
        history = job.get('history', [])
        last = history[-1] if history else {}
        label = LABELS.get(job.get('status'), job.get('status', '未知'))
        if job.get('status') == 'passed' and last.get('run_dir'):
            try:
                saved = json.loads((root / last['run_dir'] / 'inputs.json').read_text())
                if any(not (root / path).is_file() or digest(root / path) != sha for path, sha in saved.items()):
                    label = '原检查通过；输入已变化，待重验'
                if any(not (root / path).is_file() or digest(root / path) != sha for path, sha in {**job.get('reports', {}), **job.get('artifacts', {})}.items()):
                    label = '报告或产物已变化，待重验'
            except (OSError, ValueError):
                label = '检查记录不完整，待重验'
        reports = [link(path, '验收报告') for path in job.get('reports', {})]
        reports.extend(link(path, '导出文件') for path in job.get('artifacts', {}))
        if last.get('run_dir'):
            reports.append(link(last['run_dir'] + '/execution.json', '执行记录'))
        rows.append('<tr><td>' + esc(jid) + '</td><td>' + esc(label) +
                    '</td><td>' + str(len(history)) + '</td><td>' + ' · '.join(reports) + '</td></tr>')
    qwen = '已填写端点，推理仍须查实际报告' if config.get('qwen', {}).get('configured') else '未连接 Studio 模型服务'
    llada = '已填写端点，出图仍须查实际报告' if config.get('llada', {}).get('configured') else 'Mac 兼容性待验证，尚未部署'
    counts = len(queue.get('assets', []))
    stamp = datetime.now(timezone.utc).astimezone().strftime('%Y-%m-%d %H:%M:%S %Z')
    page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TigerMessenger · 本地生产线</title><style>
body{margin:0;background:#101e26;color:#e5edf0;font:16px/1.65 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:40px 24px}h1{font-size:30px;margin:0}h2{font-size:20px;margin-top:30px}p{color:#bacbd4}a{color:#8fd9dd}section{border:1px solid #365160;border-radius:12px;padding:18px 22px;margin:24px 0}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #365160}small{color:#91a7b4}.scroll{overflow-x:auto}strong{color:#f6dba2}
</style><main><small>TIGERMESSENGER / LOCAL ASSET FACTORY</small><h1>本地资产生产线</h1>'''
    page += '<p>报告生成于 ' + esc(stamp) + '。这是保存的检查点；重新生成报告后刷新页面查看最新结果。</p>'
    page += '<section><strong>当前交付：可恢复的工程检查执行器</strong><p>已登记 ' + str(counts) + ' 项资产/变体，包含复合场景。这里的通过数不表示美术优化百分比，也不表示完整剧情已接入。</p>'
    page += '<p>目标机器：Mac Studio M5 Max / 64GB（用户提供，尚未连接核验）。<br>Qwen：' + esc(qwen) + '<br>LLaDA-Image：' + esc(llada) + '</p></section>'
    registry = json.loads((root / 'godot/data/asset-registry.json').read_text())
    tiger = next((a for a in registry.get('assets', []) if a.get('id') == 'moebiusTiger'), {})
    web = tiger.get('webReplacement', {})
    if web:
        page += '<h2>游戏里已经改变了什么</h2><section><strong>湖沼之虎：Blender 新造型已默认接回原 Web 游戏</strong><p>保留原角色、动作回调和救援身份，修正静止姿态、平面脚掌支撑与眼灯过亮。Godot 完整行为迁移仍待完成。</p>'
        fixture = web.get('fixtureEvidence', '')
        if fixture:
            comparison = str(Path(fixture).parent / 'idle-before-after.png')
            if (root / comparison).is_file():
                src = esc(os.path.relpath(root / comparison, output.parent), quote=True)
                page += '<img style="width:100%;height:auto;border-radius:8px" alt="同镜头：左侧原虎，右侧已回接的 Blender 新虎" src="' + src + '">'
            page += '<p>' + link(fixture, '36 项浏览器检查') + ' · ' + link(comparison, '打开大图') + '</p>'
        page += '<p><strong>未完成：</strong>完整场景的自然接近对话与复杂地形接触尚未验收；工程通过不代表完整救援已通过。</p>'
        page += '<p>' + link(web.get('worldEvidence', ''), '完整场景原始检查') + ' · ' + link('artifacts/pipeline/tiger-web-v3/world-smoke-summary.json', '失败诊断与后续复测') + '</p></section>'
    page += '<h2>实际执行记录</h2><div class="scroll"><table><thead><tr><th>任务</th><th>最新状态</th><th>执行次数</th><th>证据</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>'
    page += '<p>缓存复用需要输入和报告哈希一致；相同输入失败两次后停止自动重试。Godot 测试在隔离副本执行；后台 Blender 作业只输出新候选，前台原作保留。</p>'
    page += '<h2>仍需完成</h2><p>Studio 真实 Qwen 文本、工具与看图联调；LLaDA 的 Mac 推理验证；建模改动模板与跨阶段产物交接；实际区域的动画、碰撞、战争与救援验收。模型的口头“完成”不能改变这些状态。</p>'
    page += '<section>' + ' · '.join([link('docs/LOCAL_ASSET_FACTORY.md', '总方案'), link('docs/LOCAL_ASSET_FACTORY_MAC.md', 'Mac 部署'), link('docs/PROJECT_HANDOFF.md', '接手指南')]) + '</section></main></html>'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(page)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default=str(Path(__file__).resolve().parents[3]))
    parser.add_argument('--config', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    print(build(args.root, args.config, args.output))
