// 1677242779162877952（第 51 轮，迁自 REACode src/triGraph.js 的 locate / clone / edgeMap / tryFlip）：
// 共享 TriGraph 上：locate 找到所在三角（含压边判定）；强制翻一条内部边后图不再 Delaunay，legalize 从那条边传播翻回、check 恢复；clone 互不影响。
import assert from 'node:assert/strict';
import { TriGraph } from '../src/core/trigraph.js';
let s = 7; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const g = new TriGraph(10); for (let i = 0; i < 120; i++) g.add(rnd() * 8 - 4, rnd() * 8 - 4);
const base = g.check(Infinity); assert.ok(base.manifold !== false, '初始流形');
// locate：随机点都落在某个三角；三角顶点压边
for (let i = 0; i < 50; i++) { const px = rnd() * 6 - 3, py = rnd() * 6 - 3, h = g.locate(px, py); assert.ok(h && h.tri >= 0, 'locate 命中'); }
const [a, b] = g.tris.find((t) => t.every((v) => v > 2)); const mid = g.locate((g.x[a] + g.x[b]) / 2, (g.y[a] + g.y[b]) / 2); assert.ok(mid.onEdge && new Set(mid.onEdge).has(a) && new Set(mid.onEdge).has(b), '边中点判为压边');
// edgeMap：内部边恰 2 个三角
const em = g.edgeMap(); assert.ok([...em.values()].every((l) => l.length <= 2), '每条边最多 2 个三角');
// clone 隔离 + 强制翻边破坏 Delaunay，再 legalize 恢复
const c = g.clone(); let forced = null;
for (const [k, l] of em) { if (l.length !== 2) continue; const [u, v] = k.split(',').map(Number); if (u < 3 || v < 3) continue; if (c.flip(u, v, { force: true })) { forced = [u, v, ...c.lastFlips.at(-1).slice(2)]; break; } }
assert.ok(forced, '找到一条可强制翻的内部边');
assert.notDeepEqual(c.tris, g.tris, 'clone 改动不影响原图');
const viol = (gr) => { let n = 0; for (const [k, l] of gr.edgeMap()) { if (l.length !== 2) continue; const [u, v] = k.split(',').map(Number); const q = gr.tris[l[1]].find((i) => i !== u && i !== v), [ux, uy, r2] = gr.circ[l[0]]; if ((gr.x[q] - ux) ** 2 + (gr.y[q] - uy) ** 2 < r2 * (1 - 1e-9)) n++; } return n; };
assert.equal(viol(g), 0, '原图 Delaunay'); assert.ok(viol(c) > 0, '强制翻后出现非 Delaunay 边');
const flips = c.legalize(forced[2], forced[3]);
assert.ok(flips >= 1 && viol(c) === 0, `legalize 传播 ${flips} 次后恢复 Delaunay`);
assert.equal(c.triangles().length, g.triangles().length, '三角数不变');
console.log('PASS TriGraph locate / edgeMap / clone / flip / legalize', JSON.stringify({ tris: g.triangles().length, legalizeFlips: flips }));
