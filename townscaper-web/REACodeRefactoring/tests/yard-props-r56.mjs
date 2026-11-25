// r56 C05-D · 1238474550511308800 后院矮墙分区 + 拱门；1246074663546916873 后院真实树木交给道具出现/消失层。
import assert from 'node:assert/strict';
import * as F from './fixtures/g2-build.mjs';
const { yardScene } = await import('../src/build/scenes-r56.js');
const { planYardWalls, yardFloraSpecs } = await import('../src/build/yard-r56.js');
const { PropAnimLayer } = await import('../src/world/prop-anim-layer.js');
const { collectYardProps, yardPropVerts } = await import('../src/world/prop-anim-yard-r56.js');

let plotsChecked = 0, gates = 0, walls = 0, floraChecked = 0;
for (const kind of ['quad', 'mixed']) for (const depth of [3, 4, 5]) {
  const w = F.world(kind, 'town', 7); yardScene(w, { depth });
  const plan = planYardWalls(w), { yard, path, plots } = plan;
  assert.ok(plots.length >= 2, `${kind}/${depth}: yard split into several lawn plots`);
  for (const e of plan.walls) {
    assert.ok(yard[e.lawn] && !path[e.lawn] && yard[e.path] && path[e.path], 'wall only between lawn and path inside the yard');
    assert.equal(w.neighbor(w.cells[e.lawn], e.edge).id, e.path);
  }
  // 每个挨小径的小园恰好一扇门；从小径经门可进每个这样的小园
  for (const p of plots) {
    const g = p.edges.filter((k) => plan.walls[k].gate);
    assert.equal(g.length, p.edges.length ? 1 : 0, 'one gate per plot');
    if (p.edges.length) { const e = plan.walls[g[0]]; assert.ok(path[e.path] && p.cells.includes(e.lawn)); }
    plotsChecked++;
  }
  // 同一小园内部连通（不被墙隔断）且墙不切小园内部
  for (const e of plan.walls) assert.notEqual(plan.plots[e.plot].cells.includes(e.path), true);
  gates += plan.walls.filter((e) => e.gate).length; walls += plan.walls.length;
  // 画出来：开 yardWalls 顶点增加；统计与计划一致
  const off = F.build(w), on = F.build(w, { yardWalls: true });
  assert.ok(on.verts > off.verts && on.r.yardWalls.gates === plots.filter((p) => p.edges.length).length && on.r.yardWalls.walls === plan.walls.length);
  // 植物清单与静态网格逐株一致：propAnimYard 关掉的顶点 = 静态树（树干 24 + 细分团块 96/株冠）
  const flora = yardFloraSpecs(w, { plan }), noFlora = F.build(w, { propAnimYard: true });
  const expect = flora.reduce((s, p) => s + (p.kind === 'shrub' ? 96 : p.kind === 'tree' ? 120 : 216), 0);
  assert.equal(off.verts - noFlora.verts, expect, 'static yard flora removed exactly');
  assert.equal(new Set(flora.map((p) => p.key)).size, flora.length);
  for (const p of flora) { assert.ok(yard[p.cell] && !path[p.cell]); assert.ok(yardPropVerts(p).length <= 72); }
  floraChecked += flora.length;
}

/* ---- 道具生命周期（真实后院）：拆院墙 → 全部缩没并保留旧几何；补回 → 按 x 错峰长出；无变化重建不重放 ---- */
{
  const w = F.world('quad', 'town', 7), S = yardScene(w, { depth: 4 });
  const layer = new PropAnimLayer(w, { collect: collectYardProps, verts: yardPropVerts, spread: .35 });
  layer.update(0); layer.update(5);
  const keys = [...layer.life.byKey.keys()].filter((k) => /^(tree|shrub):/.test(k));
  assert.ok(keys.length >= 8, 'yard trees are props with stable keys');
  for (const k of keys) assert.ok(Math.abs(layer.scaleOf(k) - 1) < .02, 'grown');
  const writes0 = layer.stats.slotWrites; w.touch(); layer.update(5.01);
  assert.equal(layer.stats.slotWrites, writes0, 'rebuild with same props: nothing re-uploaded, no replay');
  const wall = w.cells[S.wall[0]]; w.setSolid(wall, 2, false); w.setSolid(wall, 3, false); w.touch();
  layer.update(6); const mid = keys.map((k) => { layer.update(6.012); return layer.scaleOf(k); });   // 第 192 轮：塌陷只一帧
  for (const s of mid) assert.ok(s > 0 && s < 1, 'vanishing props keep their geometry and shrink');
  layer.update(7);
  for (const k of keys) assert.equal(layer.life.slotOf(k), -1, 'slot released after shrink');
  w.setSolid(wall, 2, true); w.setSolid(wall, 3, true); w.touch(); layer.update(8);
  const ents = keys.map((k) => layer.life.byKey.get(k)).sort((a, b) => a.x - b.x || a.z - b.z);
  for (let i = 1; i < ents.length; i++) assert.ok(ents[i].delay >= ents[i - 1].delay, 'left-to-right stagger');
  assert.ok(ents.at(-1).delay - ents[0].delay > .3, 'stagger spread');
  layer.update(8.1); const a = layer.scaleOf(ents[0].key), b = layer.scaleOf(ents.at(-1).key);
  assert.ok(a > b, 'leftmost already growing while rightmost waits');
  layer.update(12); for (const k of keys) assert.ok(Math.abs(layer.scaleOf(k) - 1) < .02);
}
console.log('PASS yard-props-r56', { plotsChecked, gates, walls, floraChecked });
