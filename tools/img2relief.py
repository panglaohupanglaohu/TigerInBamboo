"""单图 → 浮雕式 GLB（轻量图转 3D，替代 TripoSR 大权重）

管线：rembg 抠图 → Depth-Anything-V2-Small 单目深度（约 99MB，CPU 可跑）
→ 轮廓内网格按深度隆起成浮雕实体（正面真彩、背面镜像、侧缘封口）。

用法: python img2relief.py in.png out.glb [--relief 0.28] [--thick 0.06] [--grid 224]
输出约定：glTF 坐标（+Y 向上），正面朝 +Z，纵向跨度约 1（前端再归一化）。
"""
import argparse
import numpy as np
import rembg
import trimesh
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("image")
p.add_argument("out")
p.add_argument("--relief", type=float, default=0.28, help="正面隆起幅度（相对高度=1）")
p.add_argument("--thick", type=float, default=0.06, help="背面厚度（相对高度=1）")
p.add_argument("--grid", type=int, default=224, help="网格最长边")
p.add_argument("--mask-mode", choices=["rembg", "lum", "bright"], default="rembg",
               help="rembg=u2net 抠图；lum=墨色偏离背景；bright=亮于边框背景（白鹤类用）")
p.add_argument("--bright-thr", type=float, default=18.0, help="bright 模式亮度阈值")
p.add_argument("--keep-largest", action="store_true", help="lum 模式：只保留最大连通块并补洞（单体动物用）")
p.add_argument("--morph", type=int, default=5, help="lum 模式：闭运算核大小（<=1 关闭）")
args = p.parse_args()

# ---------- 1. 抠图 / 造掩码 ----------
img = Image.open(args.image).convert("RGB")


def otsu(v):
    hist = np.bincount(v.ravel(), minlength=256).astype(np.float64)
    w = hist / hist.sum()
    omega = np.cumsum(w)
    mu = np.cumsum(w * np.arange(256))
    mt = mu[-1]
    s2 = (mt * omega - mu) ** 2 / (omega * (1 - omega) + 1e-12)
    return int(np.argmax(s2))


def largest_component(m):
    from collections import deque
    Hh, Ww = m.shape
    lab = np.zeros(m.shape, np.int32)
    cur = best = bestn = 0
    for i in range(Hh):
        for j in range(Ww):
            if m[i, j] and lab[i, j] == 0:
                cur += 1
                n = 0
                dq = deque([(i, j)])
                lab[i, j] = cur
                while dq:
                    y, x = dq.popleft()
                    n += 1
                    for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                        if 0 <= yy < Hh and 0 <= xx < Ww and m[yy, xx] and lab[yy, xx] == 0:
                            lab[yy, xx] = cur
                            dq.append((yy, xx))
                if n > bestn:
                    bestn, best = n, cur
    return lab == best


def fill_holes(m):
    """边界 flood fill 找真背景，其余非前景视为洞填上"""
    from collections import deque
    Hh, Ww = m.shape
    seen = np.zeros(m.shape, bool)
    dq = deque()
    for i in range(Hh):
        for j in (0, Ww - 1):
            if not m[i, j] and not seen[i, j]:
                dq.append((i, j)); seen[i, j] = True
    for j in range(Ww):
        for i in (0, Hh - 1):
            if not m[i, j] and not seen[i, j]:
                dq.append((i, j)); seen[i, j] = True
    while dq:
        y, x = dq.popleft()
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= yy < Hh and 0 <= xx < Ww and not m[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True
                dq.append((yy, xx))
    return m | ~seen


if args.mask_mode == "rembg":
    session = rembg.new_session()
    cut = rembg.remove(img, session)  # RGBA
    rgba = np.asarray(cut).astype(np.float32) / 255.0
else:
    from PIL import ImageFilter
    a = np.asarray(img).astype(np.int16)
    bg = img.filter(ImageFilter.GaussianBlur(max(img.size) // 6))
    diff = np.abs(a - np.asarray(bg).astype(np.int16)).max(axis=2).astype(np.uint8)
    m = diff > otsu(diff)
    if args.morph > 1:
        mi = Image.fromarray(m.astype(np.uint8) * 255)
        mi = mi.filter(ImageFilter.MaxFilter(args.morph)).filter(ImageFilter.MinFilter(args.morph))
        m = np.asarray(mi) > 127
    if args.keep_largest:
        m = fill_holes(largest_component(m))
    if m.sum() < 100:
        raise SystemExit("lum 掩码过小：" + args.image)
    rgba = np.dstack([np.asarray(img).astype(np.float32) / 255.0, m.astype(np.float32)])

# 裁剪到前景包围盒 + 2% 边距
alpha = rgba[..., 3]
ys, xs = np.where(alpha > 0.05)
if len(ys) == 0:
    raise SystemExit("抠图结果为空：" + args.image)
m = int(0.02 * max(rgba.shape[:2]))
y0, y1 = max(ys.min() - m, 0), min(ys.max() + m + 1, rgba.shape[0])
x0, x1 = max(xs.min() - m, 0), min(xs.max() + m + 1, rgba.shape[1])
rgba = rgba[y0:y1, x0:x1]

# ---------- 2. 缩放到网格尺寸 ----------
H0, W0 = rgba.shape[:2]
g = args.grid
scale = g / max(H0, W0)
H, W = max(8, round(H0 * scale)), max(8, round(W0 * scale))
sim = Image.fromarray((rgba * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
rgba = np.asarray(sim).astype(np.float32) / 255.0
alpha = rgba[..., 3]
mask = alpha > 0.5

# ---------- 3. 单目深度（轮廓内归一化到 0..1） ----------
from transformers import pipeline  # 延迟导入，启动快
pipe = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device=-1)
dimg = pipe(Image.fromarray((rgba[..., :3] * 255).astype(np.uint8)))["depth"]
depth = np.asarray(dimg.resize((W, H)), dtype=np.float32)
dm = depth[mask]
lo, hi = np.percentile(dm, 2), np.percentile(dm, 98)
depth = np.clip((depth - lo) / max(hi - lo, 1e-6), 0, 1)  # 近处=1
depth[~mask] = 0.0

# ---------- 4. 造网格：正面隆起 + 背面镜像 + 侧缘封口 ----------
# glTF 坐标：x 向右，y 向上，正面朝 +z；纵向跨度 = 1
xs_g = (np.arange(W) - (W - 1) / 2) / H
ys_g = ((H - 1) / 2 - np.arange(H)) / H
X, Y = np.meshgrid(xs_g, ys_g)
Zf = depth * args.relief
Zb = np.full_like(Zf, -args.thick)

idx = np.full((H, W), -1, dtype=np.int64)
verts, colors = [], []

def vid(i, j, back):
    key = (i, j, back)
    if key not in vid.map:
        z = Zb if back else Zf
        verts.append([X[i, j], Y[i, j], z[i, j]])
        c = rgba[i, j, :3] * (0.75 if back else 1.0)
        colors.append(c)
        vid.map[key] = len(verts) - 1
    return vid.map[key]
vid.map = {}

faces = []
# 面：轮廓内的完整四边形（正面逆时针朝 +z；背面反向）
for i in range(H - 1):
    for j in range(W - 1):
        if mask[i, j] and mask[i, j + 1] and mask[i + 1, j] and mask[i + 1, j + 1]:
            v00, v01 = vid(i, j, False), vid(i, j + 1, False)
            v10, v11 = vid(i + 1, j, False), vid(i + 1, j + 1, False)
            faces += [[v00, v10, v11], [v00, v11, v01]]
            b00, b01 = vid(i, j, True), vid(i, j + 1, True)
            b10, b11 = vid(i + 1, j, True), vid(i + 1, j + 1, True)
            faces += [[b00, b11, b10], [b00, b01, b11]]

# 侧缘：轮廓边界边封口（双向面，免推绕向）
edges = []
for i in range(H):
    for j in range(W):
        if not mask[i, j]:
            continue
        for di, dj in ((0, 1), (1, 0)):
            ni, nj = i + di, j + dj
            if ni >= H or nj >= W or not mask[ni, nj]:
                continue
            # 共享此边的两个四边形
            quads = 0
            for qi, qj in ((i, j), (i - 1, j)) if di == 1 else ((i, j), (i, j - 1)):
                if 0 <= qi < H - 1 and 0 <= qj < W - 1 and mask[qi, qj] and mask[qi, qj + 1] and mask[qi + 1, qj] and mask[qi + 1, qj + 1]:
                    quads += 1
            if quads == 1:
                edges.append(((i, j), (ni, nj)))

for (i, j), (ni, nj) in edges:
    fa, fb = vid(i, j, False), vid(ni, nj, False)
    ba, bb = vid(i, j, True), vid(ni, nj, True)
    faces += [[fa, fb, bb], [fa, bb, ba]]
    faces += [[fa, bb, fb], [fa, ba, bb]]  # 反向各一份，双面可见

mesh = trimesh.Trimesh(
    vertices=np.asarray(verts, dtype=np.float32),
    faces=np.asarray(faces, dtype=np.int64),
    vertex_colors=(np.asarray(colors) * 255).astype(np.uint8),
    process=False,
)
mesh.export(args.out)
print(f"OK {args.out}  verts={len(verts)} faces={len(faces)} grid={W}x{H} "
      f"relief={args.relief} thick={args.thick}")
