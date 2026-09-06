# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/probe_inner_wall.mjs")
s = io.open(P, encoding="utf-8").read()
old = """/** 数「这一圈」的体块三角：只认带 userData.cell 且落在 3×3×3 邻域里的网格 */
const ringTris = (root, c) => {
  let t = 0;
  const names = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    const cell = o.userData?.cell;
    if (!cell) return;
    if (Math.abs(cell.ix - c.ix) > 1 || Math.abs(cell.iy - c.iy) > 1 || Math.abs(cell.iz - c.iz) > 1) return;
    const n = tri(o);
    t += n;
    names.set(o.name || "(无名)", (names.get(o.name || "(无名)") || 0) + n);
  });
  return { t, names };
};"""
new = """/**
 * 数「这一圈」的体块三角。两条来源都要算，少一条就会读出假数字：
 *   ① 独立网格：`userData.cell`
 *   ② 合并块：几何已经烘进整层大网格，逐格信息在 `userData.faceToCell`
 *      的区间表里（{ triStart, triCount, cell }）——体块基本都在这一路。
 */
const inRing = (cell, c) => cell &&
  Math.abs(cell.ix - c.ix) <= 1 && Math.abs(cell.iy - c.iy) <= 1 && Math.abs(cell.iz - c.iz) <= 1;

const ringTris = (root, c) => {
  let t = 0;
  const names = new Map();
  const bump = (k, n) => { t += n; names.set(k, (names.get(k) || 0) + n); };
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    if (o.userData?.mergedGeometry === true) {
      const map = o.userData?.faceToCell;
      if (!Array.isArray(map)) return;
      for (const seg of map) {
        const cell = typeof seg.cell === "string"
          ? (() => { const [a, b, d] = seg.cell.split(",").map(Number); return { ix: a, iy: b, iz: d }; })()
          : seg.cell;
        if (!inRing(cell, c)) continue;
        bump("〔合并块〕", seg.triCount || 0);
      }
      return;
    }
    if (!inRing(o.userData?.cell, c)) return;
    bump(o.name || "(无名)", tri(o));
  });
  return { t, names };
};"""
assert old in s, "ringTris 未匹配"
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("探针改为同时数合并块区间")
