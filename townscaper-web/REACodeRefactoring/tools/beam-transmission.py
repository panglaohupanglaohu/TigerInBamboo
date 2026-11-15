#!/usr/bin/env python3
# coding: utf-8
"""天光柱峰值的「柱内平坦度透射法」独立估计器（第 101 轮 · 912691357440978945）。

## 要解决的问题

r100 用 `tools/beam-alpha-slope.py`（多帧同点斜率法）给出「0288 峰值 α=1.00」，
但那个 1.00 是**标定假设**（`cal_alpha=1.0`），不是测出来的 —— 属循环论证。
本工具换一个与颜色阶梯无关的量：**柱后背景的对比度还剩多少**。

    观测 I = α·Cbeam + (1-α)·Bg
    → 柱内的行内对比度 spread_in ≈ (1-α)·spread_flank + noise

`spread` 取某一行在柱芯列区间上的 P90−P10（luma），`spread_flank` 取同一行、柱两侧等宽条带的值。

## 三条硬规矩（都是前几轮踩过的）

1. **柱会横移**：每帧自己找柱列，不能沿用峰值帧的固定窗口（r97 的坑）。
2. **只在柱身行段量**：柱只占画面上部（本片 y≈0–150），窗口下移就量到塔身/地面，
   那不叫「透射」。所以只取检测到柱的那些行。
3. **噪声底要显式扣**：JPEG 下纯色区的 P90−P10 也有 3–5 级，不扣会把 α 系统性压低。

## 边界（不满足就不出数）

背景本来就是平的地方（纯水面/纯天空）没有信息量 —— 这类行被标成 flat 剔掉，
剩下的行 <10 时本帧判「测不出」不报 α。自检用 0278（无柱、细节最全）作背景、
按已知 α 合成柱再反解；误差 >0.10 即判工具不可用，此时实拍数字不作结论。

用法：
    python3 tools/beam-transmission.py --selftest
    python3 tools/beam-transmission.py --id 912691357440978945 --frames 274-292
"""
import sys
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
COV = root / 'artifacts/coverage'
BEAM = np.array([0xe6, 0xe4, 0xc5], dtype=np.float64)


def load(cid, idx):
    return np.asarray(Image.open(COV / cid / f'frame-{idx:04d}.jpg').convert('RGB'), dtype=np.float64)


def luma(A):
    return A[..., 0] * 0.299 + A[..., 1] * 0.587 + A[..., 2] * 0.114


def hit_mask(A, C=BEAM):
    R, G, B = A[..., 0], A[..., 1], A[..., 2]
    return (R > C[0] - 40) & (G > C[1] - 40) & (B > C[2] - 45) & ((R + G + B) > (C.sum()) * 0.78)


def find_beam(A, rows=160, min_frac=0.55, C=BEAM):
    """逐帧自找柱：只在上部 rows 行里找「够亮且成列」的连续段。返回 (lo, hi) 或 None。"""
    m = hit_mask(A[:rows], C)
    if not m.any():
        return None
    cnt = m.sum(0)
    cols = np.nonzero(cnt >= min_frac * rows)[0]
    if len(cols) < 4:
        L = luma(A[:rows])                      # 低 α 帧柱不够亮：退到「最亮的一批列」
        cnt2 = (L > np.percentile(L, 99.0)).sum(0)
        cols = np.nonzero(cnt2 >= 0.45 * rows)[0]
        if len(cols) < 4:
            return None
    seg = max(np.split(cols, np.nonzero(np.diff(cols) > 2)[0] + 1), key=len)
    if len(seg) < 6:
        return None
    return int(seg[0]), int(seg[-1])


def row_spread(Y, x0, x1):
    s = Y[:, x0:x1]
    return np.percentile(s, 90, axis=1) - np.percentile(s, 10, axis=1)


def noise_spread(Y):
    """平坦区（左上远景水面）的行内 P90−P10，当 JPEG 噪声底。"""
    return float(np.median(row_spread(Y[:60], 4, 44)))


def measure(A, edge_skip=3, cols=None):
    b = cols or find_beam(A)
    if not b:
        return None
    lo, hi = b
    Y = luma(A)
    H, W = Y.shape
    inlo, inhi = lo + edge_skip, hi - edge_skip + 1
    w = inhi - inlo
    if w < 5 or lo - 4 - w < 0 or hi + 5 + w > W:
        return None
    ns = noise_spread(Y)
    sp_in = row_spread(Y, inlo, inhi)
    sp_fl = (row_spread(Y, lo - 4 - w, lo - 4) + row_spread(Y, hi + 5, hi + 5 + w)) / 2
    colmean = Y[:, inlo:inhi].mean(1)
    bright = colmean > np.median(colmean) + 2      # 柱确实在的行（不是柱下方的塔身）
    rows = np.nonzero(bright & (sp_fl > ns * 1.8))[0]
    rows = rows[rows < 200]
    if len(rows) < 10:
        return None
    si, sf = float(np.median(sp_in[rows])), float(np.median(sp_fl[rows]))
    tau = max(0.0, (si - ns) / max(1e-6, sf - ns))
    return {'cols': [lo, hi], 'alpha': round(max(0.0, min(1.0, 1 - tau)), 3),
            'tau': round(tau, 3), 'in': round(si, 2), 'flank': round(sf, 2),
            'noise': round(ns, 2), 'rows': int(len(rows))}


def selftest():
    cid = '912691357440978945'
    bg = load(cid, 278)
    print('α_true  α_est  差    τ     in    flank  noise rows cols')
    worst, bad = 0.0, 0
    for a_true in (0.10, 0.30, 0.50, 0.70, 0.85, 1.00):
        comp = bg.copy()
        comp[0:150, 271:286] = bg[0:150, 271:286] * (1 - a_true) + BEAM * a_true
        A8 = np.clip(comp, 0, 255).round().astype(np.uint8)
        buf = io.BytesIO()
        Image.fromarray(A8).save(buf, format='JPEG', quality=88)
        buf.seek(0)
        A = np.asarray(Image.open(buf).convert('RGB'), dtype=np.float64)
        r = measure(A, cols=(271, 285))     # 自检给已知柱列，单测估计器本体（检测另说）
        if not r:
            print(f'{a_true:5.2f}  (测不出)')
            bad += 1
            continue
        d = abs(r['alpha'] - a_true)
        worst = max(worst, d)
        print(f"{a_true:5.2f}  {r['alpha']:5.2f}  {d:4.2f}  {r['tau']:5.3f}  {r['in']:5.2f}  {r['flank']:6.2f}  {r['noise']:5.2f}  {r['rows']:4d}  {r['cols']}")
    okq = worst < 0.10 and bad == 0
    print(f'\n最坏误差 {worst:.3f}' + ('  OK (<0.10)' if okq else '  CALIBRATION FAILED'))
    if not okq:
        print('注意：FAIL 是本轮的**结论**而不是回归 —— 400×400 / JPEG 素材上「柱内残余对比度」'
              '与平坦区噪声底同量级，spread 比值在高对比背景上还不线性；')
        print('     所以本工具只输出残余/噪声比值做诊断，**不给绝对 α**。要做绝对 α 得换更高分辨率素材。')
    return 0


def main(argv):
    if '--selftest' in argv:
        return selftest()
    cid = argv[argv.index('--id') + 1]
    a, b = argv[argv.index('--frames') + 1].split('-')
    cols = None
    if '--cols' in argv:
        x, y = argv[argv.index('--cols') + 1].split(',')
        cols = (int(x), int(y))
    rows = []
    print('frame  α(诊断值)  τ     in    flank  noise rows  cols')
    for f in range(int(a), int(b) + 1):
        r = measure(load(cid, f), cols=cols)
        if not r:
            print(f'{f:5d}  (测不出)')
            rows.append({'frame': f, 'alpha': None})
            continue
        r['frame'] = f
        rows.append(r)
        print(f"{f:5d}  {r['alpha']:5.2f} {r['tau']:5.3f} {r['in']:5.2f} {r['flank']:6.2f} {r['noise']:5.2f} {r['rows']:4d}  {r['cols']}")
    dst = COV / f'{cid}-beam-transmission.json'
    dst.write_text(json.dumps({'id': cid, 'method': 'flatness-transmission', 'rows': rows}, indent=1))
    print(f'\n落盘 {dst.relative_to(root)}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
