"""Re-anchor completionReviews.sourceEvidence to the current learn/data.js.

学习批次会重写某条目的 where / note（补新证据、改卡点），但批注
（priority / workType / reason / nextAction / acceptance）留在
learn/pipeline.js 的 completionReviews 里。capability-evolution.js 只在批注的
sourceEvidence 与当前条目逐字一致时才认为批注"current"，不一致就降级为
「待复核」——`capability-evolution.test.mjs` 会对这种状态报红。

本工具只同步 sourceEvidence 的 status / where / note 三个字段，优先级与工作项
原样保留；跑完请人工确认批注里的 nextAction 是否仍描述同一条残差。

用法：python3 TigerMessenger/tools/scene-authoring/reanchor_completion_reviews.py [--dry-run]
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
LEARN = ROOT / 'townscaper-web/REACodeRefactoring/learn'


def load(path, var):
    raw = path.read_text(encoding='utf-8')
    match = re.match(r'^window\.' + var + r' = (\{[\s\S]*\});?\s*$', raw)
    if not match:
        raise SystemExit(f'无法解析 {path}')
    return json.loads(match.group(1))


def main():
    dry = '--dry-run' in sys.argv
    data = load(LEARN / 'data.js', 'LEARN')
    pipeline = load(LEARN / 'pipeline.js', 'PIPELINE')
    items = {str(item['id']): item for item in data['items']}
    reviews = pipeline.get('evolution', {}).get('completionReviews', {})
    changed = []
    for pid, review in reviews.items():
        item = items.get(pid)
        if not item or item.get('status') != 'partial':
            continue
        want = {'status': item['status'], 'where': item.get('where', ''), 'note': item.get('note', '')}
        if review.get('sourceEvidence') != want:
            changed.append(pid)
            review['sourceEvidence'] = want
    if dry or not changed:
        print(json.dumps({'reanchored': 0 if dry else len(changed), 'ids': changed}, ensure_ascii=False))
        return
    (LEARN / 'pipeline.js').write_text(
        'window.PIPELINE = ' + json.dumps(pipeline, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(json.dumps({'reanchored': len(changed), 'ids': changed}, ensure_ascii=False))


main()
