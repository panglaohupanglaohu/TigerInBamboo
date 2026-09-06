# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/probe_geom_leak.mjs")
s = io.open(P, encoding="utf-8").read()

old_start = s.index("const m = await import(new URL(\"src/world/odysseyCitadel.js\", BASE).href);")
old_end = s.index("// ---- 净增的都是些什么")
new = '''const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

// 与 test_edit_soak 同一条路径：整座古堡 + terraces[0].levels 的 ASCII 布局
const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
let spec = JSON.parse(JSON.stringify(citadel.userData.townSpec));

const mark = () => ({ created, disposed, live: live.size });
const base = mark();
console.log(`建城后：新建 ${base.created} · 释放 ${base.disposed} · 存活 ${base.live}`);

const levels = spec.terraces[0].levels;
const targets = [];
for (let iy = 1; iy < 6; iy++) {
  for (let iz = 3; iz < 9; iz++) {
    const row = String(levels[iy]?.[iz] ?? "");
    for (let ix = 3; ix < 9; ix++) if ((row[ix] ?? ".") !== ".") targets.push({ ix, iy, iz });
  }
}
const N = Math.min(Math.max(1, Number(process.argv[2]) || 20), targets.length);
console.log(`可编辑格 ${targets.length}，将做 ${N} 次编辑（每次挖掉一格，几何**本应减少**）`);

const perEdit = [];
for (let n = 0; n < N; n++) {
  const before = mark();
  const t = targets[n];
  const next = JSON.parse(JSON.stringify(spec));
  const rows = next.terraces[0].levels[t.iy];
  const row = String(rows[t.iz]).split("");
  row[t.ix] = ".";
  rows[t.iz] = row.join("");
  const dirty = [...m.computeCitadelDirtyCells(m.diffCitadelLayouts(spec, next))].map(String);
  const r = m.rebuildCitadelTownIncremental(citadel, next, dirty, { debounceMs: 0 });
  if (!r.ok) { console.log(`  #${n} 增量失败：${r.error ?? ""}`); break; }
  spec = next;
  const after = mark();
  perEdit.push({
    i: n,
    created: after.created - before.created,
    disposed: after.disposed - before.disposed,
    net: after.live - before.live,
  });
}

const tot = mark();
const sum = perEdit.reduce((a, e) => a + e.net, 0);
console.log("\\n每次编辑（新建 / 释放 / 净增存活）：");
for (const e of perEdit) {
  console.log(`  #${String(e.i).padStart(2)}  +${String(e.created).padStart(5)} / -${String(e.disposed).padStart(5)} / 净 ${e.net >= 0 ? "+" : ""}${e.net}`);
}
console.log(`\\n合计：新建 ${tot.created - base.created} · 释放 ${tot.disposed - base.disposed} · **净增 ${sum}**`);
console.log(`存活几何：建城后 ${base.live} → ${N} 次编辑后 ${tot.live}` +
  `（${((tot.live / Math.max(1, base.live) - 1) * 100).toFixed(1)}%，人均每次编辑 +${(sum / Math.max(1, N)).toFixed(1)}）`);

const root = citadel;
'''
s = s[:old_start] + new + s[old_end:]
s = s.replace("citadel.group.traverse", "root.traverse")
io.open(P, "w", encoding="utf-8").write(s)
print("probe 已改写")
