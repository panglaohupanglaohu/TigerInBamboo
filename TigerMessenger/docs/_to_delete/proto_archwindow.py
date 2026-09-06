# -*- coding: utf-8 -*-
"""水门拱窗几何也进清扫表：建城 105 条游离几何全部出自它。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/citadelTown.js")
s = io.open(P, encoding="utf-8").read()

old = """  const _protoGeometries = [];
  const proto = (g) => { _protoGeometries.push(g); return g; };"""
new = """  const _protoGeometries = [];
  const proto = (g) => { _protoGeometries.push(g); return g; };
  // ctx.archWindowGeometry 由调用方（odysseyCitadel.buildCitadelTownAssembly）
  // 每次装配现造一条，全函数只有「水门」一处用得上（见规则 4 的 town-watergate）。
  // 绝大多数层压根没有水门，于是每次建城/每次编辑都漏一条——probe_geom_leak
  // 的排行榜上它单独占 105 条。它是本次调用独有的实例，交给同一套
  // 「没有任何网格引用就释放」的清扫即可，不会误伤共享原型。
  if (ctx?.archWindowGeometry) proto(ctx.archWindowGeometry);"""
assert old in s and s.count(old) == 1
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("patched citadelTown.js")
