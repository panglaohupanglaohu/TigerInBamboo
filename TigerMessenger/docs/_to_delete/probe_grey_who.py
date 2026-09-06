# -*- coding: utf-8 -*-
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/tools/probe_delete_residue.mjs")
s = io.open(P, encoding="utf-8").read()
old = 'console.log("\\n场景里所有「灰色」（低饱和、中等明度）网格 Top：");'
new = '''// 顺带把每类灰色网格的**父链**打出来——名字为空时，只有父链能说明它是谁
const chain = (o) => {
  const out = [];
  let p = o.parent;
  for (let i = 0; i < 5 && p; i++) { if (p.name) out.push(p.name); p = p.parent; }
  return out.join(" < ") || "(无名父链)";
};
const greyWho = new Map();
citadel.traverse((o) => {
  if (!o.isMesh || !o.material?.color) return;
  const c = o.material.color;
  const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b);
  if (max - min > 0.06 || max > 0.75 || max < 0.05) return;
  const key = `#${c.getHexString()} | ${o.userData.isOutline ? "描边" : "表面"} | ${o.name || "(无名)"} < ${chain(o)}`;
  const e = greyWho.get(key) || { n: 0, tris: 0 };
  e.n++; e.tris += tri(o);
  greyWho.set(key, e);
});
console.log("\\n灰色网格的出身（父链）：");
for (const [k, v] of [...greyWho.entries()].sort((a, b) => b[1].tris - a[1].tris).slice(0, 12)) {
  console.log(`  ${String(v.n).padStart(4)} 个 / ${String(v.tris).padStart(7)} tris`);
  console.log(`        ${k}`);
}

console.log("\\n场景里所有「灰色」（低饱和、中等明度）网格 Top：");'''
assert old in s, "未匹配"
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("ok")
