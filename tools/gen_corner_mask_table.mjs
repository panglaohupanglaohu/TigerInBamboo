// =====================================================================
// 角柱 8-bit 邻域 mask → D4（绕 Y 四旋转 × 镜像，不含上下翻转）归并
// 位序：bit = dx | (dz << 1) | (dy << 2)；dy=0 下层，dy=1 上层。
// 用法：node tools/gen_corner_mask_table.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const idx = (dx, dz, dy) => dx | (dz << 1) | (dy << 2);

function popcount(n) {
  let c = 0;
  n >>>= 0;
  while (n) {
    c += n & 1;
    n >>>= 1;
  }
  return c;
}

function transform(mask, k, m) {
  let out = 0;
  for (let dy = 0; dy < 2; dy++) {
    for (let dz = 0; dz < 2; dz++) {
      for (let dx = 0; dx < 2; dx++) {
        if (!((mask >> idx(dx, dz, dy)) & 1)) continue;
        let x = dx;
        let z = dz;
        for (let i = 0; i < k; i++) [x, z] = [1 - z, x];
        if (m) x = 1 - x;
        out |= 1 << idx(x, z, dy);
      }
    }
  }
  return out;
}

const OPS = [];
for (let k = 0; k < 4; k++) for (const m of [0, 1]) OPS.push([k, m]);

const table = [];
const classes = new Map();
for (let mask = 0; mask < 256; mask++) {
  let best = { c: Infinity, k: 0, m: 0 };
  for (const [k, m] of OPS) {
    const c = transform(mask, k, m);
    if (c < best.c) best = { c, k, m };
  }
  if (!classes.has(best.c)) classes.set(best.c, classes.size);
  table.push({
    mask,
    canonical: best.c,
    k: best.k,
    m: best.m,
    classId: classes.get(best.c),
    lowerCount: popcount(mask & 0xF),
    upperCount: popcount(mask >> 4),
  });
}

assert.equal(classes.size, 55, `D4 轨道数必须是 55，实际 ${classes.size}`);
assert.equal(table.length, 256);
for (const row of table) {
  assert.equal(transform(row.mask, row.k, row.m), row.canonical);
}

const y4 = new Set();
for (let mask = 0; mask < 256; mask++) {
  let best = Infinity;
  for (let k = 0; k < 4; k++) {
    const c = transform(mask, k, 0);
    if (c < best) best = c;
  }
  y4.add(best);
}
assert.equal(y4.size, 70, `Y4-only 应为 70 类，实际 ${y4.size}`);

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
fs.mkdirSync(outDir, { recursive: true });
const payload = {
  bitOrder: "dx|dz<<1|dy<<2",
  symmetry: "D4-about-Y",
  classCount: 55,
  classes: [...classes.keys()],
  table,
};
fs.writeFileSync(path.join(outDir, "corner_mask_table.json"), JSON.stringify(payload, null, 2));
console.log(`classes=55 (Y4-only would be 70)`);
