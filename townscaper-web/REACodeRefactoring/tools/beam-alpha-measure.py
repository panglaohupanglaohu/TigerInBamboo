# coding: utf-8
"""量天光柱逐帧 α（投影法 v3：先用阈值命中找柱心与柱底，再只取柱身**芯**列求 p75）。

为什么要芯列 + p75：柱边缘是 AA 过渡像素，把边缘算进中位数会把 α 系统性压低
（v2 用全掩膜中位数时，在 837 已知阶梯上把「0.93/0.42/0.03」抹成「0.74/0.64/0.54」，直接判错）。
用 837 已知阶梯（r94 像素计数：4 帧满亮 → 0.93 → 0.42 → 0.03 → 0）做标定，本工具必须能复现。

用法：
  python3 tools/beam-alpha-measure.py --id <id> --bg <帧> --x 255,330 --y 0,140 \
    --frames 270-298 [--color e6e4c5]
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
cov = root / 'artifacts/coverage'

def load(id, idx):
    return np.asarray(Image.open(cov / id / f'frame-{idx:04d}.jpg').convert('RGB'), dtype=np.float32)

def parse(argv, key, default=None):
    return argv[argv.index('--' + key) + 1] if '--' + key in argv else default

def hex2rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)

def main():
    argv = sys.argv[1:]
    id = parse(argv, 'id')
    bg = int(parse(argv, 'bg'))
    x0, x1 = [int(v) for v in parse(argv, 'x').split(',')]
    y0, y1 = [int(v) for v in parse(argv, 'y').split(',')]
    a, b = parse(argv, 'frames').split('-')
    frames = list(range(int(a), int(b) + 1))
    C = hex2rgb(parse(argv, 'color', 'e6e4c5').lstrip('#'))

    def hit(A):
        R, G, B = A[..., 0], A[..., 1], A[..., 2]
        return (R > C[0] - 40) & (G > C[1] - 40) & (B > C[2] - 45) & ((R + G + B) > (C.sum()) * 0.78)

    Bg = load(id, bg)[y0:y1, x0:x1]
    base = int(hit(Bg).sum())
    print(f'背景帧 {bg:04d} · 窗口 x{x0}-{x1} y{y0}-{y1} · 基线命中 {base} px · 参考色 {C.tolist()}')
    print(' frame | 柱心x | 宽 | 芯 α(p75) | 计数')
    out = []
    for f in frames:
        A = load(id, f)[y0:y1, x0:x1]
        m = hit(A)
        cnt = int(m.sum())
        colcnt = m.sum(0)
        cols = np.nonzero(colcnt >= 0.35 * (y1 - y0))[0]
        if len(cols) == 0:
            print(f' {f:04d} |    -- |  0 |     0.000 | {cnt:5d}')
            out.append((f, None, 0, 0.0, cnt))
            continue
        splits = np.split(cols, np.nonzero(np.diff(cols) > 2)[0] + 1)
        seg = max(splits, key=len)
        cx = x0 + int(round(seg.mean()))
        core = slice(max(0, cx - x0 - 5), min(A.shape[1], cx - x0 + 6))
        band, bband = A[:, core], Bg[:, core]
        d = C - bband.mean((0, 1))
        proj = ((band - bband) @ d) / (d @ d)
        al = float(np.clip(np.percentile(proj, 75), 0, 1.5))
        rowsig = (band.mean(2) - bband.mean(2)).mean(1) > 14
        yb = np.nonzero(rowsig)[0]
        print(f' {f:04d} | {cx:4d} | {len(seg):2d} |     {al:.3f} | {cnt:5d}'
              + (f'  柱底 y{y0 + yb.max()}' if len(yb) else ''))
        out.append((f, cx, len(seg), al, cnt))
    live = [r for r in out if r[3] > 0.05]
    if live:
        pk = max(live, key=lambda r: r[3])
        print(f'\n窗口 {live[0][0]:04d}–{live[-1][0]:04d}（{len(live)} 帧）· 峰值 {pk[0]:04d} α={pk[3]:.3f} · 峰值计数 {pk[4]}')
        print('α 逐帧：' + ' '.join(f'{r[0]:04d}:{r[3]:.2f}' for r in live))
        print('对峰值：' + ' '.join(f'{r[0]:04d}:{r[3] / pk[3]:.2f}' for r in live))

main()
