#!/usr/bin/env python3
"""区域线框色板扫描（第 84 轮）。

原片的彩色区域边界是 1–2px 细线，而岛体本身也是深蓝灰、白色棋盘是纯白 —— 直接按
色相阈值会把整块岛体算进蓝色带。本工具先做 3×3 形态学开运算取出「成片实体」，
再从掩膜里把它抠掉，只留细线（thin），最后对细线取逐通道中位色（JPEG 边缘不会拉偏）。

用法：
  python3 tools/region-palette-scan.py <clip_id> [--frames 0,300,569] [--min-px 25]

输出：每个色带的帧窗口（连续帧）、像素量、中位色 #rrggbb。
"""
import sys, glob, os, json
import cv2
import numpy as np

BANDS = [
    ('red',    list(range(170, 180)) + list(range(0, 12))),
    ('orange', list(range(12, 24))),
    ('yellow', list(range(24, 36))),
    ('lime',   list(range(36, 58))),
    ('teal',   list(range(70, 95))),
    ('blue',   list(range(100, 120))),
    ('purple', list(range(128, 150))),
    ('pink',   list(range(155, 172))),
]


def thin_line_mask(hsv, hues):
    H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    band = np.isin(H, list(hues)) & (S > 90) & (V > 60)
    band = band.astype(np.uint8)
    solid = cv2.morphologyEx(band, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    solid = cv2.dilate(solid, np.ones((3, 3), np.uint8))
    thin = (band == 1) & (solid == 0)
    return thin


def median_hex(bgr, mask):
    if mask.sum() == 0:
        return None
    px = bgr[mask][:, ::-1].astype(np.float32)  # BGR -> RGB
    # 去掉最暗/最亮的 10%，避开 JPEG 边缘与背景混色
    lum = px.mean(axis=1)
    lo, hi = np.percentile(lum, 15), np.percentile(lum, 90)
    keep = px[(lum >= lo) & (lum <= hi)]
    if len(keep) < 5:
        keep = px
    r, g, b = [int(round(v)) for v in np.median(keep, axis=0)]
    return '#%02x%02x%02x' % (r, g, b)


def windows(idx, gap=2):
    out = []
    for i in idx:
        if out and i - out[-1][1] <= gap:
            out[-1][1] = i
        else:
            out.append([i, i])
    return out


def main():
    cid = sys.argv[1]
    only = None
    min_px = 25
    for i, a in enumerate(sys.argv):
        if a == '--frames':
            only = set(int(x) for x in sys.argv[i + 1].split(','))
        if a == '--min-px':
            min_px = int(sys.argv[i + 1])
    files = sorted(glob.glob(f'artifacts/coverage/{cid}/frame-*.jpg'))
    per_band = {n: {'frames': [], 'px': [], 'colors': []} for n, _ in BANDS}
    for f in files:
        n = int(os.path.basename(f)[6:10])
        if only is not None and n not in only:
            continue
        bgr = cv2.imread(f)
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        for name, hues in BANDS:
            m = thin_line_mask(hsv, hues)
            c = int(m.sum())
            if c < min_px:
                continue
            hx = median_hex(bgr, m)
            per_band[name]['frames'].append(n)
            per_band[name]['px'].append(c)
            per_band[name]['colors'].append(hx)
    print(f'clip {cid}  frames={len(files)}')
    for name, _ in BANDS:
        d = per_band[name]
        if not d['frames']:
            print(f'{name:7s} —  无细线像素')
            continue
        win = windows(d['frames'])
        best = int(np.argmax(d['px']))
        print(f"{name:7s} 帧数={len(d['frames']):3d} 总px={sum(d['px']):7d} "
              f"最大帧={d['frames'][best]}({d['px'][best]}px {d['colors'][best]}) "
              f"窗口={[(a, b) for a, b in win][:8]}")
    json.dump({k: v for k, v in per_band.items()}, open(f'/tmp/palette-{cid}.json', 'w'), ensure_ascii=False)


if __name__ == '__main__':
    main()
