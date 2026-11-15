#!/usr/bin/env python3
"""台沿橙带厚度量测（第 95 轮 · 1707497006640365880 / 1707490932017279035）。

前几轮的毛病：用**全局色阈**数橙像素（r90 的 r-g>40 吃进 26% 画幅，r91 已推翻；r93 换阈值仍命中 37k px），
把整片暖色地表都算成「带」。原片里真正的台沿带只有两个特征：

1. 颜色是**高饱和鲑红**，不是地面的浅桃色 —— frame-0100 实测带内 (249,160,126)/(251,167,123)，
   R-G ≈ 84–89、R ≥ 240；地面 (197,176,147)/(203,190,156)，R-G ≈ 20–30。
2. 它**贴着台沿**长：必须挨着一条强亮度跃变（崖壁/台沿）。

所以本工具只统计同时满足「高饱和」+「2px 内有强梯度」的像素，并且厚度按**四方向游程取最小**
（横向游程在近水平台沿上会把带量成很长的一条，取最小才能逼近真实厚度）。

用法：
  python3 tools/shrub-band-measure.py artifacts/coverage/1707497006640365880/frame-0100.jpg [...]
  python3 tools/shrub-band-measure.py --lattice <frame.jpg>     # 只量等距格顶点间距（扇形线框的 FCC 周期）
"""
import sys
import json
import numpy as np
from PIL import Image, ImageFilter

BAND_R_MIN = 195
BAND_RG_MIN = 50   # R-G
EDGE_GRAD_MIN = 22  # 亮度梯度（px 差），台沿/崖壁跃变


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float32)


def band_mask(A):
    R, G, B = A[:, :, 0], A[:, :, 1], A[:, :, 2]
    sat = (R >= BAND_R_MIN) & ((R - G) >= BAND_RG_MIN)
    L = A.mean(2)
    gy, gx = np.gradient(L)
    grad = np.hypot(gx, gy)
    # 2px 膨胀后的强梯度邻域
    strong = grad > EDGE_GRAD_MIN
    near = strong.copy()
    for dy in (-2, -1, 1, 2):
        for dx in (-2, -1, 1, 2):
            near |= np.roll(np.roll(strong, dy, 0), dx, 1)
    return sat & near


def runs_min(mask):
    """每个前景像素在 4 个方向上所属游程长度的最小值。"""
    h, w = mask.shape
    best = np.full((h, w), 10 ** 6, dtype=np.int32)
    for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
        # 逐像素双向扫描（640×640 可接受；不引 scipy，本机没装）
        for y in range(h):
            for x in range(w):
                if not mask[y, x]:
                    continue
                n = 1
                yy, xx = y + dy, x + dx
                while 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and n < 40:
                    n += 1
                    yy += dy
                    xx += dx
                yy, xx = y - dy, x - dx
                while 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and n < 40:
                    n += 1
                    yy -= dy
                    xx -= dx
                if n < best[y, x]:
                    best[y, x] = n
    return best


def measure(path):
    A = load(path)
    m = band_mask(A)
    n = int(m.sum())
    out = {'file': path.split('/')[-1], 'bandPx': n, 'fillPct': round(100.0 * n / m.size, 2)}
    if n:
        t = runs_min(m)[m]
        out.update({
            'thicknessP50': int(np.percentile(t, 50)),
            'thicknessP90': int(np.percentile(t, 90)),
            'thicknessMean': round(float(t.mean()), 2),
            'thicknessMax': int(t.max()),
        })
    return out


def lattice(path, win=96):
    """等距格顶点间距：在岛内最平坦的暖色窗口上做 FFT，取基频周期。
    扇形线框在每个顶点向外发散，最强周期性 = 顶点间距（frame-0100 实测 ≈30px）。"""
    A = load(path)
    R, G, B = A[:, :, 0], A[:, :, 1], A[:, :, 2]
    L = A.mean(2)
    gy, gx = np.gradient(L)
    grad = np.hypot(gx, gy)
    warm = (R > 170) & ((R - B) > 25) & (G > 140)
    cand = []
    h, w = L.shape
    for y in range(40, h - win - 40, 8):
        for x in range(40, w - win - 40, 8):
            if warm[y:y + win, x:x + win].mean() < 0.97:
                continue
            cand.append((float(grad[y:y + win, x:x + win].mean()), y, x))
    cand.sort()
    periods = []
    used = []
    for _g, y0, x0 in cand[:6]:
        hp = L[y0:y0 + win, x0:x0 + win] - np.asarray(
            Image.fromarray(L[y0:y0 + win, x0:x0 + win].astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
        ).astype(np.float32)
        m = (hp < -1.5).astype(np.float32)
        if m.sum() < 200:
            continue
        F = np.abs(np.fft.fftshift(np.fft.fft2(m - m.mean())))
        c = win // 2
        F[c - 2:c + 3, c - 2:c + 3] = 0
        py, px = np.unravel_index(np.argmax(F), F.shape)
        dy, dx = py - c, px - c
        r = (dy * dy + dx * dx) ** .5
        if r < 1:
            continue
        periods.append(round(win / r, 1))
        used.append([y0, x0])
    return {'file': path.split('/')[-1], 'windows': used, 'periodPx': periods,
            'median': float(np.median(periods)) if periods else None}


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--lattice' in sys.argv:
        for p in args:
            print(json.dumps(lattice(p), ensure_ascii=False))
    else:
        for p in args:
            print(json.dumps(measure(p), ensure_ascii=False))
