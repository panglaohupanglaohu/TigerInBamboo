# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/probe_geom_leak.mjs")
s = io.open(P, encoding="utf-8").read()

old = """  const origSet = proto.setAttribute;
  proto.setAttribute = function patchedSetAttribute(name, attr) {
    if (!live.has(this)) { live.add(this); created++; }
    return origSet.call(this, name, attr);
  };"""
new = """  const origSet = proto.setAttribute;
  proto.setAttribute = function patchedSetAttribute(name, attr) {
    if (!live.has(this)) {
      live.add(this);
      created++;
      // 记出生地：泄漏的几何是「没人引用也没 dispose」的，光看名字定位不到，
      // 得知道是**哪段代码**造的。只留仓库内的前 3 帧。
      if (TRACE) {
        const st = (new Error().stack || "").split("\\n").slice(2)
          .map((l) => l.trim())
          .filter((l) => l.includes("/src/") && !l.includes("three.module.js"))
          .slice(0, 3)
          .map((l) => {
            const mm = l.match(/at ([^\\s(]+).*?\\/src\\/(.+?):(\\d+):/);
            return mm ? `${mm[2]}:${mm[3]} ${mm[1]}` : l.slice(0, 90);
          })
          .join("  <-  ");
        birth.set(this, st || "(仓库外)");
      }
    }
    return origSet.call(this, name, attr);
  };"""
assert old in s
s = s.replace(old, new, 1)

s = s.replace("""const live = new Set();
let created = 0;
let disposed = 0;""",
"""const live = new Set();
const birth = new Map();   // geometry -> 出生地（仅 TRACE 时填）
const TRACE = process.env.TRACE !== "0";
let created = 0;
let disposed = 0;""", 1)

# 泄漏归类
s = s.replace('''console.log(`\\n⚠️ **游离几何（没挂在场景里、也没 dispose）= ${orphan}** —— 这一项就是纯泄漏`);''',
'''console.log(`\\n⚠️ **游离几何（没挂在场景里、也没 dispose）= ${orphan}** —— 这一项就是纯泄漏`);

if (TRACE) {
  const inScene = new Set();
  root.traverse((o) => { if (o.geometry) inScene.add(o.geometry); });
  const byBirth = new Map();
  for (const g of live) {
    if (inScene.has(g)) continue;
    const k = birth.get(g) || "(未记录)";
    byBirth.set(k, (byBirth.get(k) || 0) + 1);
  }
  const rank = [...byBirth.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log("\\n泄漏几何按出生地排行（造它的那段代码）：");
  for (const [k, v] of rank) console.log(`  ${String(v).padStart(6)}  ${k}`);
}''', 1)

io.open(P, "w", encoding="utf-8").write(s)
print("probe 加了出生地追踪")
