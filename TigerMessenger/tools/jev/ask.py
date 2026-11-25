"""通用 JEV 批量判断：让开发模型把「分类 / 筛选 / 是否」这类重复小判断外包出去，省自己的 token。

用法（仓库根或任意目录）：
  python3 TigerMessenger/tools/jev/ask.py request.json --output decisions.json
request.json：
  {"task": "一句话说明要判断什么",
   "type": "choice" | "noul",                 # choice 选一类；noul 回答是/否的概率
   "criteria": {"类别id": "这一类的判断标准", ...},   # 仅 choice
   "instructions": "对每一项问的问题（可省）",
   "items": {"项id": {任意紧凑文字字段}, ...},
   "threshold": 0.85, "batch": 6}
也可在 Python 里 `from ask import ask`。

规则：只发紧凑文字；不发密钥、图片、整份源码或聊天记录。JEV 看不了图，不是源码审阅，不能替代硬性检查。
缓存按「单项」算（端点 + 任务 + 标准 + 该项内容），清单增减不会让其它项的缓存失效。不自动重试。"""
import argparse, hashlib, json, os, sys, time, urllib.request
from pathlib import Path

ENDPOINT = 'https://jevtypesafeai.com/api/v1/decide'
CACHE = Path.home() / '.cache/tigermessenger/jev/items'
BANNED = [b'apikey_', b'jv_live_', b'jv_test_', b'ghp_', b'authorization', b'data:image']
dumps = lambda o: json.dumps(o, ensure_ascii=False, sort_keys=True)

def item_key(task, qtype, criteria, instructions, item):
    return hashlib.sha256(dumps([ENDPOINT, task, qtype, criteria, instructions, item]).encode()).hexdigest()

def ask(task, items, criteria=None, qtype='choice', instructions='', threshold=0.85, batch=6, max_item_bytes=2000):
    if qtype not in ('choice', 'noul'): raise ValueError('type must be choice or noul')
    if qtype == 'choice' and not criteria: raise ValueError('choice needs criteria')
    CACHE.mkdir(parents=True, exist_ok=True, mode=0o700)
    usage = {'items': len(items), 'requests': 0, 'cache_hits': 0, 'input': 0, 'output': 0, 'cost_usd': 0.0, 'errors': []}
    out, todo = {}, []
    for iid, item in items.items():
        raw = dumps(item).encode()
        if len(raw) > max_item_bytes: raise ValueError(f'{iid}: item exceeds {max_item_bytes} bytes; summarize first')
        if any(b in raw.lower() for b in BANNED): raise ValueError(f'{iid}: credentials or image data are not valid evidence')
        cf = CACHE / (item_key(task, qtype, criteria, instructions, item) + '.json')
        if cf.exists(): out[iid] = {**json.loads(cf.read_text()), 'cached': True}; usage['cache_hits'] += 1
        else: todo.append((iid, item, cf))
    key = None
    for i in range(0, len(todo), batch):
        part = todo[i:i + batch]; ids = {f'q{j}': t for j, t in enumerate(part)}
        q = lambda n: {'type': qtype, 'instructions': (instructions or task) + f' Answer for item {n} only, using only the supplied text.', **({'criteria': criteria} if qtype == 'choice' else {})}
        body = dumps({'state': {'task': task, 'items': {n: t[1] for n, t in ids.items()}}, 'questions': {n: q(n) for n in ids}}).encode()
        if key is None: key = os.environ.get('JEV_API_KEY') or (Path.home() / '.config/tigermessenger/typesafe.key').read_text().strip()
        try:
            with urllib.request.urlopen(urllib.request.Request(ENDPOINT, data=body, headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}), timeout=40) as r: res = json.load(r)
        except Exception as e:
            usage['errors'].append(f'batch {i}: {type(e).__name__} {getattr(e, "code", "")}'); continue
        usage['requests'] += 1; u = res.get('usage') or {}
        usage['input'] += u.get('input_tokens', 0) or 0; usage['output'] += u.get('output_tokens', 0) or 0; usage['cost_usd'] += u.get('cost_usd', 0) or 0
        for n, (iid, item, cf) in ids.items():
            a = (res.get('answers') or {}).get(n) or {}
            if qtype == 'choice':
                c, conf = a.get('choice'), a.get('confidence')
                if c not in criteria or not isinstance(conf, (int, float)): continue
                row = {'choice': c, 'confidence': round(conf, 3), 'model': res.get('model')}
            else:
                p = a.get('noul')
                if not isinstance(p, (int, float)): continue
                row = {'noul': round(p, 3), 'model': res.get('model')}
            cf.write_text(dumps(row)); out[iid] = {**row, 'cached': False}
    for row in out.values():
        row['accepted'] = (row['confidence'] >= threshold) if qtype == 'choice' else (row['noul'] >= threshold or row['noul'] <= 1 - threshold)
    usage['cost_usd'] = round(usage['cost_usd'], 6); usage['answered'] = len(out)
    return {'endpoint': ENDPOINT, 'task': task, 'type': qtype, 'threshold': threshold, 'usage': usage, 'decisions': out,
            'scope': '文字证据的批量小判断。不看图、不审源码、不替代硬性检查；未达阈值的交给开发模型复核。'}

if __name__ == '__main__':
    p = argparse.ArgumentParser(); p.add_argument('request'); p.add_argument('--output', required=True); a = p.parse_args()
    r = json.loads(Path(a.request).read_text())
    res = ask(r['task'], r['items'], r.get('criteria'), r.get('type', 'choice'), r.get('instructions', ''), r.get('threshold', 0.85), r.get('batch', 6))
    Path(a.output).write_text(json.dumps(res, ensure_ascii=False, indent=1) + '\n')
    d = res['decisions']; tally = {}
    for v in d.values():
        k = v.get('choice') if 'choice' in v else ('yes' if v['noul'] >= .5 else 'no'); tally[k] = tally.get(k, 0) + 1
    print(json.dumps({'usage': res['usage'], 'accepted': sum(v['accepted'] for v in d.values()), 'tally': tally}, ensure_ascii=False))
