#!/usr/bin/env python3
"""鲑橙带「面积占比 + 厚度」量测（第 96 轮 · 1707497006640365880 / 1707490932017279035）。

为什么换口径：r95 的 tools/shrub-band-measure.py 用「四个方向游程取最小」当厚度，
在**不规则斑块**上会系统性偏小（斑块的斜向游程被截成 2–3px），而且它还叠了
「2px 内有强梯度」的额外门限 —— 只有斑块贴着崖壁那一圈芯能过，量出来自然是发丝。
3× 目视（frame-0100 原尺寸）里鲑橙是 10–15px 的宽斑，不是 2px 的线。

本工具改用两个与形状无关的指标：
1. **salmon%**：鲑橙像素 / 陆地像素（陆地 = 非水、非天空、非白墙）。跨片、跨机位可比。
2. **厚度**：对鲑橙掩膜做 Chebyshev 腐蚀（numpy 移位，不引 scipy），
   `2 × 腐蚀存活步数` 就是该像素处的内切厚度；取 P50/P90。斑块再斜也不会被截短。

用法：
  python3 tools/shrub-salmon-metric.py <img.png|jpg> [...]
"""
import sys
import json
import numpy as np
from PIL import Image


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.int16)


def masks(A):
    R, G, B = A[:, :, 0], A[:, :, 1], A[:, :, 2]
    L = A.mean(2)
    # 鲑橙：R 高、R-G 大、且不是白（白墙 R-G 小）
    salmon = (R >= 190) & ((R - G) >= 45) & ((R - B) >= 55)
    # 水：青绿（原片 #3E7B78 一带；本仓 render 也走青绿）
    water = (B >= G - 8) & (G >= R + 8) & (L < 200)
    # 天空 / 背景：偏青且大面积（原片背景 #4E8A85）
    return salmon, water


def erode_steps(mask, max_steps=40):
    """Chebyshev 腐蚀存活步数（8 邻域），返回 int 图。"""
    cur = mask.copy()
    steps = np.zeros(mask.shape, np.int16)
    for k in range(1, max_steps + 1):
        p = np.pad(cur, 1, constant_values=False)
        nxt = cur.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                nxt &= p[1 + dy:1 + dy + cur.shape[0], 1 + dx:1 + dx + cur.shape[1]]
        if not nxt.any():
            break
        steps[nxt] = k
        cur = nxt
    return steps


def measure(path, land_only=True):
    A = load(path)
    salmon, water = masks(A)
    h, w = salmon.shape
    n = int(salmon.sum())
    if land_only:
        # 陆地 = 画幅内非水且非天空；天空/背景用「整行都偏青」近似
        row_teal = (water | ((A[:, :, 2] >= A[:, :, 0] + 20) & (A.mean(2) < 210))).mean(1) > 0.9
        sky = np.repeat(row_teal[:, None], w, axis=1)
        land = (~water) & (~sky)
        # 顶部整片背景条也剔掉
        land[: int(h * 0.02)] = False
    else:
        land = np.ones_like(salmon)
    landN = int(land.sum()) or 1
    out = {
        'file': path.split('/')[-1],
        'salmonPx': n,
        'landPx': landN,
        'salmonPctOfLand': round(100.0 * n / landN, 2),
    }
    if n:
        st = erode_steps(salmon)
        th = (2 * st[salmon]).astype(np.float32)
        # 只统计「有一定规模」的斑块：厚度 >= 2px
        th = th[th >= 2]
        if th.size:
            out.update({
                'thickP50': int(np.percentile(th, 50)),
                'thickP90': int(np.percentile(th, 90)),
                'thickMax': int(th.max()),
            })
    return out


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(json.dumps(measure(p), ensure_ascii=False))
