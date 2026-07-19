"""离线预览 GLB：三视角顶点散点图，验证网格质量与朝向
用法: python preview_glb.py <model.glb> <out.png>
"""
import sys
import numpy as np
import trimesh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

path, out = sys.argv[1], sys.argv[2]
m = trimesh.load(path, force="scene")
if isinstance(m, trimesh.Scene):
    m = trimesh.util.concatenate(tuple(m.dump()))
v = np.asarray(m.vertices)
try:
    c = np.asarray(m.visual.vertex_colors)[:, :3]
    if c.max() > 1.5:
        c = c / 255.0
except Exception:
    c = np.full((len(v), 3), 0.6)

rng = np.random.default_rng(0)
idx = rng.choice(len(v), min(30000, len(v)), replace=False)

fig = plt.figure(figsize=(15, 5))
views = [(12, -60, "front-right"), (12, 120, "back-left"), (89, -90, "top")]
for k, (elev, azim, name) in enumerate(views):
    ax = fig.add_subplot(1, 3, k + 1, projection="3d")
    ax.scatter(v[idx, 0], v[idx, 2], v[idx, 1], c=c[idx], s=0.7)
    ax.view_init(elev=elev, azim=azim)
    ax.set_box_aspect((np.ptp(v[:, 0]), np.ptp(v[:, 2]), np.ptp(v[:, 1])))
    ax.set_title(name)
    ax.set_xticks([]); ax.set_yticks([]); ax.set_zticks([])
print("bbox min:", v.min(axis=0).round(2), "max:", v.max(axis=0).round(2))
plt.tight_layout()
plt.savefig(out, dpi=75)
print("saved", out)
