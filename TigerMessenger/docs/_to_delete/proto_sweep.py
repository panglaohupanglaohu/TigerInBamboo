# -*- coding: utf-8 -*-
"""buildCitadelTown 每次调用都急切造 ~40 个共享原型几何；增量 dirty build 里绝大多数一个网格都用不上，从此无人释放。"""
import io, os, re
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/citadelTown.js")
lines = io.open(P, encoding="utf-8").read().split("\n")

# 定位函数体
start = next(i for i, l in enumerate(lines) if l.startswith("export function buildCitadelTown(spec, ctx"))
end = next(i for i, l in enumerate(lines) if i > start and l.strip() == "return { levels: levelGroups, stats };")

PAT = re.compile(r"^(  const \w+Geometry = )(new THREE\.\w+Geometry\(.*\));\s*$")
wrapped = 0
for i in range(start, end):
    m = PAT.match(lines[i])
    if not m:
        continue
    lines[i] = f"{m.group(1)}proto({m.group(2)});"
    wrapped += 1
assert wrapped >= 30, f"只包住了 {wrapped} 个原型几何，模式可能失效"

# 函数体开头插入登记器
decl = """  // 原型几何登记（2026-09-05）：本函数开头急切造 ~40 个**共享**原型几何
  // （cellGeometry / winFrameGeometry / …），全量建城时每个都有网格在用；
  // 但增量 dirty build 只造少数几格，绝大多数原型一个网格都没用上——它们
  // 既不在场景里，也进不了 geometryMerge 的回收清单，于是**每次编辑漏一整套**。
  // 见 tools/probe_geom_leak.mjs：修掉这一处之前每次编辑净漏 ~245 个几何。
  const _protoGeometries = [];
  const proto = (g) => { _protoGeometries.push(g); return g; };"""
lines.insert(start + 1, decl)
end += 1

sweep = """  // 原型几何清扫：本次调用没被任何网格用上的原型，就地释放。
  // 用「网格是否引用」判定而不是「有没有被 proto() 登记」——共享实例只要还有
  // 一个活着的网格在用就不能碰。
  {
    const used = new Set();
    for (const lg of levelGroups) {
      lg?.traverse?.((o) => { if (o.isMesh && o.geometry) used.add(o.geometry); });
    }
    for (const g of _protoGeometries) if (g && !used.has(g)) g.dispose();
    _protoGeometries.length = 0;
  }
"""
lines.insert(end, sweep)

io.open(P, "w", encoding="utf-8").write("\n".join(lines))
print(f"已包住 {wrapped} 个原型几何并加清扫")
