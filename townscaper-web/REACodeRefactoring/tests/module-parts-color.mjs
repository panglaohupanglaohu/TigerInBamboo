// r189 · 1279107097108635649 拼图块目录：部位分色（墙身 + 基座 + 屋顶）—— 片子平铺的块不是只有墙身上色，
// 基座/铺地是绿/棕/青、屋顶是绿/暗红，白细边不上色。这里核：
//  ① 分色只改颜色、不改几何（顶点逐字节相同）；
//  ② 默认档（debugModules=false）屋顶/基座仍只走调色板，零回归；
//  ③ 开档后屋顶/基座各拿到自己的一族签名色（互不撞墙色），且同签名同色可复现；
//  ④ 目录页的每块也用同一套（buildPiece 透传 debugParts）。
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { World, MeshWriter, buildBuildings, PALETTES } = F;
const M = await import('../src/build/module-catalog-r56.js');

const hexOf = (buf, i) => `${buf[i].toFixed(4)},${buf[i + 1].toFixed(4)},${buf[i + 2].toFixed(4)}`;
function run(w, opts) { const m = new MeshWriter(); const r = buildBuildings(m, w, { L: .5, ...opts }); return { m, r }; }
const distinct = (col) => { const s = new Set(); for (let i = 0; i < col.length; i += 3) s.add(hexOf(col, i)); return s; };

const L = .5;
for (const kind of ['quad', 'mixed']) {
  const w = F.world(kind, 'town', 7); w.palette = PALETTES.town;
  const off = run(w, { debugModules: false });
  const wallOnly = run(w, { debugModules: true, debugParts: false });
  const full = run(w, { debugModules: true, debugParts: true });

  // ① 几何完全一致（只有颜色变）
  assert.equal(off.m.pos.length, full.m.pos.length, `${kind}: same vertex count`);
  assert.ok(Buffer.compare(Buffer.from(off.m.pos), Buffer.from(full.m.pos)) === 0, `${kind}: positions byte-identical`);
  let colDiff = 0; for (let i = 0; i < off.m.col.length; i++) if (off.m.col[i] !== full.m.col[i]) colDiff++;
  assert.ok(colDiff > 1000, `${kind}: colours really change (${colDiff})`);

  // ② 默认档屋顶/基座不被调试色污染
  const offColors = distinct(off.m.col), fullColors = distinct(full.m.col);
  assert.ok(fullColors.size > offColors.size, `${kind}: debug mode adds colours (${offColors.size}→${fullColors.size})`);
  const dbgOnly = [...fullColors].filter(c => !offColors.has(c));
  assert.ok(dbgOnly.length >= 20, `${kind}: many new part colours (${dbgOnly.length})`);
  for (const c of dbgOnly) assert.ok(!offColors.has(c), `${kind}: part colour ${c} is not a palette colour`);

  // ③ 三族各拿到签名色，屋顶/基座真的分到色
  const p = full.r.moduleParts;
  assert.ok(p.wall >= full.r.modules, `${kind}: wall family covers every module signature (${p.wall} ≥ ${p.modules})`);
  assert.ok(p.roof > 1, `${kind}: roof family has several signature colours (${p.roof})`);
  assert.ok(p.base > 1, `${kind}: base family has several signature colours (${p.base})`);
  assert.ok(p.quads.roof > 0 && p.quads.base > 0, `${kind}: roof/base quads counted`);
  assert.equal(wallOnly.r.moduleParts.roof, 0, `${kind}: ?parts=0 leaves the roof on the palette`);
  assert.equal(wallOnly.r.moduleParts.base, 0, `${kind}: ?parts=0 leaves the base on the palette`);
  assert.ok(wallOnly.r.moduleParts.wall >= full.r.modules, `${kind}: ?parts=0 keeps wall colouring`);

  // 同输入复现：两次构建的屋顶/基座颜色集合逐项相同
  const again = run(w, { debugModules: true, debugParts: true });
  assert.deepEqual([...distinct(again.m.col)].sort(), [...fullColors].sort(), `${kind}: deterministic colours`);
}

// ④ 目录页每块：walls/roofs/bases 都有色，且石块签名复原（只换颜色不改签名）
{
  const w = F.world('quad', 'town', 7), used = M.usedSignatures(w);
  let roofs = 0, bases = 0, walls = 0, pieces = 0;
  for (const [sig, e] of used) {
    const spec = { sig, n: e.n, up: e.up, down: e.down, edges: e.edges, cell: e.cell, lv: e.lv };
    const on = M.buildPiece(w.grid, spec, { palette: w.palette });
    const offp = M.buildPiece(w.grid, spec, { palette: w.palette, debugParts: false });
    assert.equal(on.sigRebuilt, spec.sig, 'piece signature restored');
    assert.ok(Buffer.compare(Buffer.from(on.pos), Buffer.from(offp.pos)) === 0, 'buildPiece geometry unchanged by parts mode');
    walls = Math.max(walls, on.parts.wall); roofs = Math.max(roofs, on.parts.roof); bases = Math.max(bases, on.parts.base);
    if (on.parts.roof > 0 && on.parts.base > 0) pieces++;
    assert.ok(on.parts.wall > 0, 'every piece has a coloured wall family');
  }
  assert.ok(pieces > 10, `most pieces carry both a coloured roof and base (${pieces}/${used.size})`);
  assert.ok(roofs > 1 && bases > 1, `piece-level families spread (${walls}/${roofs}/${bases})`);
}

console.log('PASS module-parts-color');
