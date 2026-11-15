// r56 C05-D · 1279107097108635649 拼图块目录：签名公式与 buildings.js 计数一致；理论全集；每块用真实建筑管线单独造出且签名复原。
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const M = await import('../src/build/module-catalog-r56.js');
let pieces = 0;
for (const kind of ['quad', 'mixed']) {
  for (const scene of ['town', 'fusion']) {
    const w = F.world(kind, scene, 7), { r } = F.build(w), used = M.usedSignatures(w);
    assert.equal(used.size, r.modules, `${kind}/${scene}: catalog = buildStats.modules`);
    for (const [sig, e] of used) { assert.equal(M.signatureOf(w, w.cells[e.cell], e.lv), sig); const d = M.decodeSignature(sig, e.n); assert.equal(d.n, w.cells[e.cell].n); assert.ok(e.count >= 1); }
  }
  const w = F.world(kind, 'town', 7), all = M.allSignatures(w.grid), used = M.usedSignatures(w);
  assert.equal(all.length, kind === 'quad' ? 60 : 88);
  assert.equal(new Set(all.map((s) => s.sig)).size, all.length);
  for (const s of used.keys()) assert.ok(all.some((a) => a.sig === s), 'every used signature is in the theoretical set');
  const lay = M.catalogLayout(all);
  for (let i = 0; i < lay.length; i++) for (let j = i + 1; j < lay.length; j++) assert.ok(Math.hypot(lay[i].x - lay[j].x, lay[i].z - lay[j].z) >= 1.69, 'pieces laid out apart');
  const cols = new Map();
  for (const s of all) {
    const p = M.buildPiece(w.grid, s, { palette: w.palette });
    assert.equal(p.sigRebuilt, s.sig, 'piece rebuilt with the same neighbour signature');
    assert.ok(p.tris > 0);
    const xs = []; for (let i = 0; i < p.pos.length; i += 3) xs.push(Math.hypot(p.pos[i], p.pos[i + 2]));
    assert.ok(Math.max(...xs) < 1.2, 'piece centred on its own cell');
    if (!s.up) assert.ok(Math.max(...p.pos.filter((_, i) => i % 3 === 1)) > 2 * F.L, 'top piece carries its roof');
    if (!s.down) assert.ok(Math.min(...p.pos.filter((_, i) => i % 3 === 1)) <= F.L + 1e-6, 'floating piece carries its underside (floor slab / arch / legs)');
    cols.set(s.sig, p.col.slice(0, 3).join(','));
    pieces++;
  }
}
console.log('PASS module-catalog-r56', { pieces });
