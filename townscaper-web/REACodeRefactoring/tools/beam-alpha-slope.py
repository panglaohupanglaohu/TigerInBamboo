# coding: utf-8
"""天光柱 α 的「多帧同点斜率法」估计器（第 100 轮 · 912691357440978945）。

## 为什么需要它

`tools/beam-alpha-measure.py`（v3）对**高 α** 段是准的（837 已知阶梯 0.93/0.42 复现得住），
但它的掩膜是绝对亮度阈值（`R>Cr-40 & … & 亮度和>0.78·ΣC`）。α<0.6 时柱身像素根本没跨过阈值：
命中列变窄甚至为零 → 取不到柱芯 → 阈值计数把低 α 系统性**低估约 0.12**（第 96–99 轮都记着这条）。

## 方法

同一批像素点，在**一串帧**上一起解。观测色 C(t) = α(t)·Cbeam + (1-α(t))·Bg，所以在 RGB 空间里
所有帧的观测点都落在「Bg → Cbeam」这条直线上，只差一个标量位置。

1. 参考帧（峰值帧）用阈值掩膜定出柱芯像素集合 **P**（此时 α 高，掩膜可靠）；
2. 对 P 里每个像素，取它在整段帧上的颜色，减去该像素在**最暗帧**的色（逐像素 anchor，消掉底图渐变）；
3. 把所有 (帧 × 像素) 的差向量堆起来做主成分（PCA），得到全局方向 **d**（比单帧 `C-Bg` 稳得多）；
4. α(t) = mean_{p∈P} [ (C_p(t) - anchor_p)·d ] / mean_{p∈P} [ (Cbeam - anchor_p)·d ]。

关键点是 **P 与 anchor 都跟 α 无关**：低 α 帧不会被掩膜裁掉，也不靠单帧 p75 猜。

## 用法

    python3 tools/beam-alpha-slope.py --selftest
    python3 tools/beam-alpha-slope.py --id 912691357440978945 --x 240,300 --y 0,150 \\
        --frames 276-289 --ref 288 --color e6e4c5

`--selftest` 用合成斜坡（真值 α = 0.10…0.70）同时跑两种方法，输出各自误差 —— 这是本工具的自证，
不是自说自话：斜率法必须做到误差 < 0.05，且必须**证明阈值法在低 α 段确实低估**。
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
cov = root / 'artifacts/coverage'
BEAM = np.array([0xe6, 0xe4, 0xc5], dtype=np.float64)


def load(cid, idx):
    return np.asarray(Image.open(cov / cid / f'frame-{idx:04d}.jpg').convert('RGB'), dtype=np.float64)


def hit_mask(A, C=BEAM):
    R, G, B = A[..., 0], A[..., 1], A[..., 2]
    return (R > C[0] - 40) & (G > C[1] - 40) & (B > C[2] - 45) & ((R + G + B) > (C.sum()) * 0.78)


def core_from_ref(ref, C=BEAM):
    """用峰值帧的阈值掩膜定柱芯**列区间** (lo,hi)（峰值帧 α 高，掩膜可靠）。
    返回 (lo, hi, cx, width)；定不出来返回 None。"""
    H, W = ref.shape[:2]
    m = hit_mask(ref, C)
    colcnt = m.sum(0)
    cols = np.nonzero(colcnt >= 0.35 * max(1, H))[0]
    if len(cols) == 0:
        return None
    seg = max(np.split(cols, np.nonzero(np.diff(cols) > 2)[0] + 1), key=len)
    cx = int(round(seg.mean()))
    return max(0, cx - 5), min(W, cx + 6), cx, len(seg)


def slope_alphas(stack, anchor, cal=0, cal_alpha=1.0):
    """stack: (T,h,w,3) 同点同柱芯多帧；anchor: (h,w,3) 最暗帧；cal: 已知 α 的标定帧下标。

    **方法边界（必须说清）**：单凭像素颜色只能解出 α(t)/α(cal)，绝对值要一个已知 α 的标定帧
    （全不透明帧给 cal_alpha=1，或者本来就知道峰值帧的值）。所以本工具输出
    `α(t) = cal_alpha · s(t)/s(cal)`，`s(t) = mean_像素 (C_p(t) − anchor_p)·d`。
    好处是 low α 段不再依赖阈值：α=0.10 的帧一样进这条比值，不会被掩膜裁掉。
    """
    D = stack - anchor[None]
    flat = D.reshape(-1, 3)
    u, s, vt = np.linalg.svd(flat - flat.mean(0), full_matrices=False)
    d = vt[0]
    ref_dir = (stack[cal] - anchor).reshape(-1, 3).mean(0)
    if d @ ref_dir < 0:                           # 符号修正：d 必须指向「更亮」一侧
        d = -d
    proj = np.array([float(((f - anchor).reshape(-1, 3) @ d).mean()) for f in stack])
    if abs(proj[cal]) < 1e-9:
        return np.zeros(len(stack))
    return proj / proj[cal] * cal_alpha


def v3_alpha(A, C=BEAM):
    """原 v3 口径的忠实复刻（阈值定柱芯 + p75 投影 + 自比背景取窗口两侧）。
    低 α 时 hit_mask 命中不到 35% 覆盖率 → 定不出柱芯 → 直接判 0，这就是它低估的来源。"""
    H, W = A.shape[:2]
    got = core_from_ref(A, C)
    if got is None:
        return 0.0, 0
    lo, hi = got[0], got[1]
    core = A[:, lo:hi]
    bg = np.concatenate([A[:, :max(1, lo)], A[:, min(W, hi):]], 1) if (lo > 0 or hi < W) else A
    d = C - bg.reshape(-1, 3).mean(0)
    proj = ((core.reshape(-1, 3) - bg.reshape(-1, 3).mean(0)) @ d) / (d @ d)
    return float(np.clip(np.percentile(proj, 75), 0, 1.5)), hi - lo


def selftest():
    rng = np.random.default_rng(7)
    H, W = 150, 60
    yy, xx = np.mgrid[0:H, 0:W]
    bg = np.stack([np.full((H, W), 52.0) + 6 * (yy / H), np.full((H, W), 46.0) + 4 * (xx / W),
                   np.full((H, W), 58.0) + 5 * (yy / H)], -1)          # 有渐变的底色
    column = (np.abs(xx - W / 2) < 6).astype(np.float64)               # 14px 宽柱
    column *= np.clip(1 - yy / (H * 1.05), 0, 1) ** 0.35               # 底下实、顶上淡
    truth = [0.10, 0.16, 0.24, 0.34, 0.46, 0.58, 0.70]
    stack = []
    for a in [0.0] + truth:                        # 第 0 帧是**无柱**背景帧 —— anchor 必须取它
        img = bg * (1 - a * column[..., None]) + BEAM * (a * column[..., None])
        img = np.clip(img + rng.normal(0, 3.1, img.shape), 0, 255)      # JPEG 级噪声
        stack.append(img)
    stack = np.stack(stack)
    anchor = stack[0]                              # 真背景
    cal = int(np.argmax(truth)) + 1                # 标定帧：最亮那帧，α=0.70（模拟「有一帧是全亮」）
    got = slope_alphas(stack[1:], anchor, cal - 1, truth[cal - 1])
    print('合成斜坡（真值 → 斜率法 / 阈值法 v3 复刻）')
    errs, terr = [], []
    for i, a in enumerate(truth):
        th, w = v3_alpha(stack[i + 1])
        errs.append(abs(got[i] - a))
        terr.append(th - a)
        print(f'  α={a:.2f} → {got[i]:.3f} (err {got[i] - a:+.3f})   | v3 {th:.3f} 柱宽 {w:2d}px (err {th - a:+.3f})')
    low = [i for i, a in enumerate(truth) if a < 0.6]
    low_err = max(abs(terr[i]) for i in low)
    ok = max(errs) < 0.05 and low_err > 0.06
    print(f'\n斜率法最大误差 {max(errs):.3f}（要求 <0.05）；v3 低 α 段（α<0.6）最大误差 {low_err:.3f}'
          f'（要求 >0.06 —— 证明它确实低估，这就是要换方法的原因）')
    print('SELFTEST ' + ('PASS' if ok else 'FAIL'))
    return 0 if ok else 1


def main():
    argv = sys.argv[1:]
    if '--selftest' in argv:
        return selftest()
    arg = lambda k, d=None: argv[argv.index('--' + k) + 1] if '--' + k in argv else d
    cid = arg('id')
    if not cid:
        print('需要 --id 或 --selftest'); return 2
    x0, x1 = [int(v) for v in arg('x').split(',')]
    y0, y1 = [int(v) for v in arg('y').split(',')]
    a, b = arg('frames').split('-')
    frames = list(range(int(a), int(b) + 1))
    C = BEAM if not arg('color') else np.array([int(arg('color').lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)
    ref = load(cid, int(arg('ref', frames[len(frames) // 2])))
    ref = ref[y0:y1, x0:x1]
    got = core_from_ref(ref, C)
    if got is None:
        print('峰值帧也没定出柱芯（窗口给错了？）'); return 2
    lo, hi, cx, width = got
    stack = np.stack([load(cid, f)[y0:y1, x0:x1] for f in frames])
    # anchor：**无柱**帧（同点、逐像素）。默认取窗口内最暗帧；有柱前的干净帧就用 --anchor 指定，
    #   否则最暗那帧本身带 α → 它会被人为算成 0，整条曲线整体低一个 α（自检里踩过这个坑）。
    anchorIdx = arg('anchor')
    if anchorIdx is not None:
        anchor = load(cid, int(anchorIdx))[y0:y1, x0:x1]
    else:
        anchor = stack[int(np.argmin([s.mean() for s in stack]))]
    refIdx = int(arg('ref', frames[len(frames) // 2]))
    calIdx = frames.index(refIdx) if refIdx in frames else len(frames) // 2
    calAlpha = float(arg('cal-alpha', 1.0))
    al = slope_alphas(stack[:, :, lo:hi, :], anchor[:, lo:hi, :], calIdx, calAlpha)
    print(f'{cid} · 窗口 x{x0}-{x1} y{y0}-{y1} · 柱心 x={cx + x0} 宽 {width}px · {len(frames)} 帧 · 参考色 {C.astype(int).tolist()}')
    print(f'标定帧 {frames[calIdx]:04d} α={calAlpha:.2f} · anchor {anchorIdx or "窗口最暗帧"}')
    print(' frame | 斜率法 α | v3 α')
    for f, x in zip(frames, al):
        th, _ = v3_alpha(load(cid, f)[y0:y1, x0:x1], C)
        print(f' {f:04d} |    {x:.3f} | {th:.3f}')
    pk = float(np.max(al))
    print(f'\n峰值 α = {pk:.3f} @ {frames[int(np.argmax(al))]:04d}')
    print('相对峰值：' + ' '.join(f'{f:04d}:{x / pk:.2f}' for f, x in zip(frames, al) if x > 0.05))
    return 0


if __name__ == '__main__':
    sys.exit(main())
