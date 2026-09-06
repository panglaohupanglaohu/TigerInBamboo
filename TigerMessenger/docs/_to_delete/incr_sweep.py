# -*- coding: utf-8 -*-
"""增量重建会整城重造一份装配，却只把 dirty 层的网格搬进场景，其余整批丢弃不释放。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/odysseyCitadel.js")
s = io.open(P, encoding="utf-8").read()

old = """  // 4) 新网格描边（单网格，与全量 applyInkOutlines 同参数）
  let outlineCount = 0;"""
new = """  // 3b) 丢弃剩下的整份装配（2026-09-05）。
  //
  // 增量重建为了拿 dirty 层的新网格，实际上**重造了一整座城**，然后只把
  // 命中的层组 `add` 进场景，其余整批扔掉——扔掉的那些几何从来没人 dispose。
  // `tools/probe_geom_leak.mjs` 实测：修掉 geometryMerge 的烘焙中间体之后，
  // 每次编辑仍净漏 ~245 个 BufferGeometry，出生地全在 buildCitadelTown 的
  // 各个建件行上，就是这一批。编辑几十次之后帧时间被 GC 顶到 1.5s
  // （主人 2026-09-05 截屏：fps 11.9 / hitch 844 / worst 1582.6ms）。
  //
  // 共享实例要当心：一次 build 里多个网格可能共用同一份原型几何，其中一部分
  // 已经被搬进场景。所以只释放「当前场景里没有任何网格引用」的那些。
  {
    const kept = new Set();
    castleContainer.traverse((o) => { if (o.isMesh && o.geometry) kept.add(o.geometry); });
    const dropped = new Set();
    assembly.group?.traverse?.((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (kept.has(o.geometry)) return;
      dropped.add(o.geometry);
    });
    for (const g of dropped) g.dispose();
    // 材质是整份装配共享的（搬进场景的网格还在用），不能碰。
  }

  // 4) 新网格描边（单网格，与全量 applyInkOutlines 同参数）
  let outlineCount = 0;"""
assert old in s, "插入点未匹配"
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("增量丢弃装配的清扫已加")
