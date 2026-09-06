# -*- coding: utf-8 -*-
"""合并烘焙的中间几何从来没释放过：每次编辑漏 ~900 个 BufferGeometry。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/geometryMerge.js")
s = io.open(P, encoding="utf-8").read()

def rep(old, new, why):
    global s
    assert old in s, "未匹配：" + why
    s = s.replace(old, new, 1)

rep("""      const src = mesh.geometry;
      const hasIndex = !!src.index;
      const geo = src.clone();
      _rel.copy(mesh.matrixWorld).premultiply(_rootInv);
      geo.applyMatrix4(_rel);
      const final = hasIndex ? geo.toNonIndexed() : geo;
      const pos = final.getAttribute("position");
      entry = { geo: final, triCount: pos ? pos.count / 3 : 0 };
      bakedByMesh.set(mesh, entry);""",
"""      const src = mesh.geometry;
      const hasIndex = !!src.index;
      const geo = src.clone();
      _rel.copy(mesh.matrixWorld).premultiply(_rootInv);
      geo.applyMatrix4(_rel);
      const final = hasIndex ? geo.toNonIndexed() : geo;
      // toNonIndexed() 会再造一个新几何，clone 出来的那个当场就没人要了。
      // 不显式 dispose 就等着 GC——而这是每次编辑跑几百次的热路径，
      // 攒下来的 Float32Array 足以把帧时间顶到 1.5s（主人 2026-09-05 截屏
      // hitch 844 / worst 1582.6ms / fps 11.9，声音在放画面几乎不动）。
      if (final !== geo) geo.dispose();
      const pos = final.getAttribute("position");
      entry = { geo: final, triCount: pos ? pos.count / 3 : 0 };
      bakedByMesh.set(mesh, entry);""",
"clone 中间体")

rep("""  const dead = new Set();
  for (const mesh of removedSurfaces) if (!stillUsed.has(mesh.geometry)) dead.add(mesh.geometry);
  for (const mesh of removedOutlines) if (!stillUsed.has(mesh.geometry)) dead.add(mesh.geometry);
  for (const g of dead) g.dispose();""",
"""  const dead = new Set();
  for (const mesh of removedSurfaces) if (!stillUsed.has(mesh.geometry)) dead.add(mesh.geometry);
  for (const mesh of removedOutlines) if (!stillUsed.has(mesh.geometry)) dead.add(mesh.geometry);
  // 烘焙中间体（bake 的 clone / toNonIndexed 产物）：mergeGroup 已经把顶点
  // 数据整块拷进合并几何里了，它们从此无人引用。原来这一段只清「被摘掉的源
  // 网格」，把烘焙副本漏在外面——`tools/probe_geom_leak.mjs` 实测：
  // 12 次编辑漏 11011 个几何，其中 90% 出自 bake()。
  for (const entry of bakedByMesh.values()) {
    if (entry?.geo && !stillUsed.has(entry.geo)) dead.add(entry.geo);
  }
  bakedByMesh.clear();
  for (const g of dead) g.dispose();""",
"烘焙中间体")

io.open(P, "w", encoding="utf-8").write(s)
print("geometryMerge.js 已修")
