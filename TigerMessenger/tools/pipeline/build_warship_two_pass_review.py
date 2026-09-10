"""Publish only the two actual exported-model renders that exist on disk."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/pipeline/warship-two-pass-review'

def build():
    cards = []
    for version, description in [(3, '第一轮：移动双眼、初步收窄两端（发现眼白穿壳，未通过）'),
                                 (4, '第二轮：继续收尖船壳与甲板，修整眼部贴合')]:
        folder = ROOT / f'artifacts/pipeline/warship-battle-v{version}'
        for image in ['glb-frame51-three-quarter.png', 'glb-frame51-top.png']:
            if not (folder / image).is_file():
                raise FileNotFoundError(folder / image)
        provenance = json.loads((folder / 'render-provenance.json').read_text())
        if not provenance.get('freshImport'):
            raise ValueError('Expected actual GLB roundtrip render')
        cards.append(f'<section><h2>{description}</h2><div class="pair">' + ''.join(
            f'<figure><img src="../warship-battle-v{version}/{name}"><figcaption>{label}</figcaption></figure>'
            for name, label in [('glb-frame51-three-quarter.png', '实际GLB · 透视'),
                                ('glb-frame51-top.png', '实际GLB · 顶视')]) + '</div></section>')
    closeup = ROOT / 'artifacts/pipeline/warship-battle-v4/glb-eye-closeup.png'
    if closeup.is_file():
        cards.append('<section><h2>第二轮眼部近景</h2><img src="../warship-battle-v4/glb-eye-closeup.png"></section>')
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'index.html').write_text('''<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>传统战船 · 两轮造型对照</title><style>body{background:#14252c;color:#e6ece8;font:17px/1.65 system-ui;margin:0}main{max-width:1280px;margin:auto;padding:24px}section{margin:24px 0;background:#21363f;padding:20px;border-radius:12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}figure{margin:0}img{width:100%}a{color:#ace0e5}figcaption{padding:6px}@media(max-width:800px){.pair{grid-template-columns:1fr}}</style><main><h1>传统战船 · 两轮造型对照</h1><p>以认可的大透视目标为准：双眼移到卷曲高端，两端船壳收尖。参考图侧视与主透视的眼位不一致，原游戏航向和撞角保持。</p><section><h2>目标图</h2><img src="../../../assets/concepts/warship-target-v1.png"></section>''' + ''.join(cards) + '''<p>两轮均为实际GLB回读渲染。保留26桨手与同步划桨；新船壳的检查以本轮报告为准，不能沿用旧版碰撞结论。仍为造型候选，尚未正式战场替换或完成25人登陆调度。</p><p><a href="../../../docs/WARSHIP_TWO_PASS_REVIEW.md">本轮范围与方向说明</a> · <a href="../saihoji-battle-review/index.html">返回苔庭总览</a></p></main></html>''')
    print(OUT / 'index.html')

if __name__ == '__main__':
    build()
