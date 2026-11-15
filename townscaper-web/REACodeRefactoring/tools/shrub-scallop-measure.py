#!/usr/bin/env python3
"""shrub-scallop-measure.py — 量橙色灌木带**外轮廓**的凸起周期，并与格边像素长求比值。

用法：python3 tools/shrub-scallop-measure.py <png> <pxPerUnit> <latticeSpacing>

口径（与原片第 81 轮同口径，便于直接比 0.376）：
  · 橙色掩膜：r−g > 45 且 r > 120 且 r−b > 20（#e2723f 系）
  · 逐列取橙色最上沿 y 作为外轮廓 → 沿 x 做 3 点平滑
  · 峰 = 轮廓上「上升后下降」的局部极值（min distance = 3px），周期 = 相邻峰间距中位
  · 格边像素长 = latticeSpacing × pxPerUnit
"""
import json
import sys

import numpy as np
from PIL import Image


def main():
    path, px_per_unit, spacing = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(int)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    orange = (r - g > 45) & (r > 120) & (r - b > 20)
    band = int(orange.sum())
    if band < 200:
        print(json.dumps({'bandPixels': band, 'peaks': 0, 'periodPx': 0, 'edgePx': 0, 'ratio': 0}))
        return
    h, w = orange.shape
    top = np.full(w, np.nan)
    for x in range(w):
        ys = np.nonzero(orange[:, x])[0]
        if ys.size:
            top[x] = ys.min()
    # 只保留连续有轮廓的列段里最长的一段
    cols = np.nonzero(~np.isnan(top))[0]
    if cols.size < 20:
        print(json.dumps({'bandPixels': band, 'peaks': 0, 'periodPx': 0, 'edgePx': 0, 'ratio': 0}))
        return
    # 平滑
    y = top.copy()
    filled = np.interp(np.arange(w), cols, y[cols])
    k = 3
    sm = np.convolve(filled, np.ones(k) / k, mode='same')
    # 峰：用宽度 3 的邻域比较，挑出局部极大且落差 > 0.6px（低于 1px 的起伏当噪声）
    peaks = []
    last = -99
    for x in range(2, w - 2):
        seg = sm[x - 1:x + 2]
        if sm[x] == seg.min() and (seg.max() - seg.min()) > 0.6 and (x - last) >= 4:
            peaks.append(x)
            last = x
    if len(peaks) >= 2:
        d = np.diff(peaks)
        period = float(np.median(d))
    else:
        period = 0.0
    edge = spacing * px_per_unit
    ratio = (period / edge) if edge > 0 else 0.0
    print(json.dumps({
        'bandPixels': band, 'peaks': len(peaks), 'periodPx': round(period, 2),
        'edgePx': round(edge, 2), 'ratio': round(ratio, 3),
        'contourSpanPx': int(cols.max() - cols.min()),
    }))


if __name__ == '__main__':
    main()
