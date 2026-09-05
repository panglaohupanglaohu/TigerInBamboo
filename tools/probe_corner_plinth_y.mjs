// =====================================================================
// 探针：目录的 plinth 裙边落在哪个高度（C9 待办 #7 的前提验证，只读）
// 用法：node tools/probe_corner_plinth_y.mjs
//
// 待办 #7 想「把浪费掉的 plinth.* 用起来」。但裙边零件画在单位立方体
// y ∈ [0, plinthHeight]，而 assembleCornerBody 的映射是 y0 = (iy+0.5)*ch
// —— 节点 iy 的 y=0 未必是建筑底面。用起来之前必须先量。
//
// ⚠️ 第一版探针拿 mask=0xff 去比，那是八格全实的内部柱，plinth 与 wall
// 都只出 body-lower/body-upper，裙边压根没发出来 → 结论作废。
// 这一版**扫全部 256 个 mask**，只挑真的发出 `plinth-*` 零件的来量。
// =====================================================================
const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const { cornerGeometryParts, CORNER_METRICS, cornerAllowedProtoIds, cornerShapeOf } =
  await import(new URL("world/citadel/cornerPrototypes.js", SRC).href);

const ch = 2; // 实测口径：基线外壳 [4.95, 26.95]，11 层 → ch=2
const yOf = (iy, unitY) => (iy + 0.5) * ch + unitY * ch;
const levelRange = (iy) => [iy * ch, (iy + 1) * ch];

console.log(`ch=${ch}  plinthHeight=${CORNER_METRICS.plinthHeight}（× ch）`);
console.log(`映射 y(iy,u) = (iy+0.5)*ch + u*ch\n`);

// 扫全部 mask，找真的发裙边的 (mask, proto)
const hits = [];
for (let mask = 1; mask <= 255; mask++) {
  for (const protoId of cornerAllowedProtoIds(mask)) {
    if (!protoId.startsWith("plinth.")) continue;
    let parts;
    try {
      parts = cornerGeometryParts(mask, protoId);
    } catch {
      continue;
    }
    const skirt = parts.filter((p) => p.min && p.part.startsWith("plinth"));
    if (skirt.length) {
      const lo = Math.min(...skirt.map((p) => p.min[1]));
      const hi = Math.max(...skirt.map((p) => p.max[1]));
      hits.push({ mask, protoId, shape: cornerShapeOf(mask), n: skirt.length, lo, hi });
    }
  }
}

console.log(`真的发出 plinth-* 裙边的 (mask, proto) 组合：${hits.length} 个`);
if (!hits.length) {
  console.log("❌ 一个都没有 —— 说明 plinth 件在任何 mask 下都不出裙边零件，待办 #7 的前提本身不成立");
  process.exit(0);
}

// 裙边的单位 y 区间在所有命中里应当一致（都来自同一 emitWalls 调用）
const loSet = new Set(hits.map((h) => h.lo.toFixed(6)));
const hiSet = new Set(hits.map((h) => h.hi.toFixed(6)));
console.log(`裙边单位 y：lo ∈ {${[...loSet].join(", ")}}  hi ∈ {${[...hiSet].join(", ")}}`);

for (const h of hits.slice(0, 6)) {
  console.log(
    `  mask=${String(h.mask).padStart(3)} ${h.protoId.padEnd(12)} shape=${h.shape.padEnd(8)}` +
      ` 裙边 ×${h.n} 单位 y ${h.lo.toFixed(2)}–${h.hi.toFixed(2)}`
  );
}

const lo = hits[0].lo;
const hi = hits[0].hi;
const [g0, g1] = levelRange(0);
console.log(`\n层 0 的局部区间 = ${g0.toFixed(2)} … ${g1.toFixed(2)}（地面在 ${g0.toFixed(2)}）`);
for (const iy of [-1, 0]) {
  const a = yOf(iy, lo);
  const b = yOf(iy, hi);
  const gap = a - g0;
  console.log(
    `  节点 iy=${String(iy).padStart(2)} → 裙边局部 y ${a.toFixed(2)} … ${b.toFixed(2)}` +
      `  离地 ${gap.toFixed(2)}（${(gap / ch).toFixed(2)} 层）${Math.abs(gap) < 1e-9 ? " ✓ 贴地" : " ❌"}`
  );
}
console.log(
  `\n注：iy=-1 的 mask 下四格恒空 → 形态必为 soffit，而 plinth.* 只允许 through 类 mask，` +
    `所以 iy=-1 选不到 plinth 件。`
);
