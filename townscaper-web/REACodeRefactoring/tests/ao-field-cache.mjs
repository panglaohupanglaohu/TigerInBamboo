// 1168571866405097472 残差补全：「分层网格每次改动重投影成纹理」的增量半边。
//
// 原片机制：遮蔽住在分层网格里，改动时重投影成纹理，模糊后由顶点着色器采样。
// 只读裁判 REACode/src/lightingcache.js 是同机制的落点（stamps/sigs diff → 脏矩形
// 重模糊，badTexels 0）；本仓此前 bakeLighting 每次都整层栅格化+整层模糊。
// 本轮：bake.js 拆出 buildOcclusionField（重投影+模糊，keepRaw 暴露底片与
// cellWriteRect/clearRect/restamp/refreshBits/reblur 钩子），新增
// src/light/field-cache.js LayeredFieldCache——常驻场 + 逐格签名 diff →
// 脏矩形清零、按格序重投影、窗口化重模糊。
// 本测试证明：
//   1. 增量 update(mode='dirty') 后的场与全量重建逐纹素一致（occ/cr/cg/cb/bits，
//      ≤1e-9 容差只为滑动前缀和锚点不同的浮点尾数，实测上报）；
//   2. 写回区之外的模糊纹素逐字节不动（变化确实局部）；
//   3. bakeLighting({field}) 吃增量场产出的顶点色与全量烘焙一致；
//   4. 遮蔽/反弹通道分离在外部场上同样成立（channels 重构恒等）；
//   5. 打包纹理（packLayeredField→sampleLayeredTexture）与场取样一致 = GPU 路径同源。
// 对齐裁判：同一机制的本地实现；裁判 LightingCache 在 townmesh 里默认走增量
// （"实测与全量重烤逐 texel 一致"），本测试是同口径的本地证明。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
globalThis.document = new Proxy({}, { get: () => () => ({ style: {}, getContext: () => null }) });

const { generateModulePatch } = await import('../src/core/module-patch.js');
const { World } = await import('../src/core/world.js');
const { bakeLighting, buildOcclusionField } = await import('../src/light/bake.js');
const { LayeredFieldCache } = await import('../src/light/field-cache.js');
const { packLayeredField, sampleLayeredTexture } = await import('../src/light/voxel-field.js');

const L = .5;
/* ---------- 场景：9×9 平地 + x∈(4,5) 一列 4 层高墙 + 一块红顶（给反弹通道留签名差异） ---------- */
const vertices = [], faces = [];
for (let x = 0; x <= 8; x++) for (let z = 0; z <= 8; z++) vertices.push([x, z]);
for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) { const a = x * 9 + z; faces.push([a, a + 9, a + 10, a + 1]); }
const g1 = generateModulePatch({ vertices, faces });
const world = new World(g1);
const PALETTE = [{ r: .8, g: .75, b: .7 }, { r: .7, g: .3, b: .25 }, { r: .3, g: .45, b: .75 }];
world.palette = { colors: ['#ccbfa8', '#b34d40', '#4d73bf'] };
world.cells.forEach((c) => world.fill(c, 1, { rock: true }));
world.cells.filter((c) => c.cx > 4 && c.cx < 5).forEach((c) => { world.fill(c, 4); world.color[c.id] = 1; });
const colorOf = (c, lv) => (world.isRock(c, lv) ? { r: .6, g: .58, b: .55 } : world.color[c.id] >= 0 ? PALETTE[world.color[c.id]] : { r: .8, g: .75, b: .7 });
const opts = { L, colorOf, res: 0.09, radius: 4 };
const tri = (x, z) => [x, L, z, x, L, z + .1, x + .1, L, z];
const pos = [...tri(3.75, 4.45), ...tri(1, 1), ...tri(4.55, 4.45)];
const run = (extra = {}) => { const m = { pos: pos.slice(), col: new Array(27).fill(1) }; const r = bakeLighting(m, world, { L, colorOf, res: 0.09, radius: 4, ...extra }); return { m, r }; };
const arrEq = (a, b, tol) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m <= tol ? m : -m; };
const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

/* ---------- 1) 首建 = 全量；clean 不动 ---------- */
const cache = new LayeredFieldCache(opts);
{
  const u = cache.update(world);
  assert.equal(u.mode, 'full', '首建 mode=full');
  assert.ok(u.field?.occ?.length, '场已建');
  const fresh = buildOcclusionField(world, { L, colorOf, res: 0.09, radius: 4, keepBits: true });
  assert.equal(maxDiff(u.field.occ, fresh.occ), 0, '首建场与全量逐纹素一致');
  assert.deepEqual(u.field.bits, fresh.bits, 'bits 一致');
  const clean = cache.update(world);
  assert.equal(clean.mode, 'clean', '无改动 mode=clean');
  assert.equal(clean.dirty, 0);
}

/* ---------- 2) 单格加高 → dirty：与全量逐纹素一致（容差 1e-9），写回区外逐字节不动 ---------- */
{
  const before = { occ: cache.field.occ.slice(), cr: cache.field.cr.slice(), cg: cache.field.cg.slice(), cb: cache.field.cb.slice() };
  const target = world.cells.find((c) => c.cx > 6 && c.cx < 7 && c.cz > 3 && c.cz < 4);
  world.fill(target, 3);                       // 平地里起一栋 3 层楼
  const u = cache.update(world);
  assert.equal(u.mode, 'dirty', '单格改动 mode=dirty');
  assert.equal(u.dirty, 1);
  assert.ok(Number.isFinite(u.rect.i0), '脏矩形存在');
  const v = cache.verifyAgainstFull(world);
  assert.ok(v.badTexels === 0 && v.maxDiff <= 1e-9, '增量场 ≡ 全量（occ/cr/cg/cb ≤1e-9）：' + JSON.stringify(v));
  // 局部性：写回矩形之外的模糊纹素逐字节不动（写回区 = 脏矩形 ± P·R，见 field.reblur）
  let outsideBad = 0, changedInside = 0;
  const wb = cache.last.rect;
  const { W, H, layers, size } = u.field;
  const R = u.field.radius, halo = R * 2;
  const wx0 = Math.max(0, wb.i0 - halo), wx1 = Math.min(W - 1, wb.i1 + halo);
  const wz0 = Math.max(0, wb.j0 - halo), wz1 = Math.min(H - 1, wb.j1 + halo);
  for (let lv = 1; lv < layers; lv++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = lv * size + j * W + i;
    const inside = i >= wx0 && i <= wx1 && j >= wz0 && j <= wz1;
    const d = u.field.occ[k] - before.occ[k];
    if (!inside && (u.field.occ[k] !== before.occ[k] || u.field.cr[k] !== before.cr[k] || u.field.cg[k] !== before.cg[k] || u.field.cb[k] !== before.cb[k])) outsideBad++;
    if (inside && d !== 0) changedInside++;
  }
  assert.equal(outsideBad, 0, '写回区外模糊纹素逐字节不动');
  assert.ok(changedInside > 0, '写回区内确有变化（新楼投下遮蔽）');
  console.log(`  dirty#1: rect ${JSON.stringify(wb)} 写回内 occ 变化 ${changedInside} texels，verify maxDiff ${v.maxDiff.toExponential(2)}`);
}

/* ---------- 3) 组合编辑（改色 + 削平 + 又起一栋）→ dirty 合并矩形仍逐纹素一致 ---------- */
{
  const wall = world.cells.find((c) => c.cx > 4 && c.cx < 5 && c.cz > 4 && c.cz < 5);
  world.color[wall.id] = 2;                    // 改色（同色实心 → 反弹色输入变）
  const flat = world.cells.find((c) => c.cx > 1 && c.cx < 2 && c.cz > 6 && c.cz < 7);
  world.fill(flat, 0);                         // 削掉一格地形
  const tower = world.cells.find((c) => c.cx > 2 && c.cx < 3 && c.cz > 2 && c.cz < 3);
  world.fill(tower, 3);                        // 又起一栋（≤ 现有 maxH，保持增量路径）
  const u = cache.update(world);
  assert.equal(u.mode, 'dirty');
  assert.equal(u.dirty, 3, '三处改动合成一次 dirty');
  const v = cache.verifyAgainstFull(world);
  assert.ok(v.badTexels === 0 && v.maxDiff <= 1e-9, '组合编辑增量 ≡ 全量：' + JSON.stringify(v));
  console.log(`  dirty#3: dirty 3 rect ${JSON.stringify(u.rect)} verify maxDiff ${v.maxDiff.toExponential(2)}`);
}

/* ---------- 4) bakeLighting({field})：增量场直接顶点采样 ≡ 全量烘焙；channels 分离仍成立 ---------- */
{
  const viaCache = { pos: pos.slice(), col: new Array(27).fill(1) };
  const r1 = bakeLighting(viaCache, world, { L, colorOf, field: cache.field, channels: true });
  const fresh = run({ channels: true });
  const d = maxDiff(viaCache.col, fresh.m.col);
  assert.ok(d <= 1e-9, `外部场顶点色 ≡ 全量烘焙（${d.toExponential(2)}）`);
  const ONE = new Array(27).fill(1);
  const recon = ONE.map((c, i) => c * r1.channels.sun[i / 3 | 0] * (r1.channels.ao[i / 3 | 0] + r1.channels.bounce[i]) + r1.channels.air[i]);
  assert.ok(maxDiff(viaCache.col, recon) < 1e-6, '外部场 channels 重构恒等');
  assert.ok(r1.channels.ao[0] < r1.channels.ao[3], '墙根遮蔽 < 空地');
  // 多跳场照吃（diffuseAir 读的是同一组模糊数组）
  const mB = { pos: pos.slice(), col: new Array(27).fill(1) };
  bakeLighting(mB, world, { L, colorOf, field: cache.field, bounces: 3 });
  const freshB = run({ bounces: 3 });
  assert.ok(maxDiff(mB.col, freshB.m.col) <= 1e-9, '外部场 + bounces=3 ≡ 全量');
}

/* ---------- 5) 打包纹理：增量场 → packLayeredField → GPU 镜像取样与场取样一致 ---------- */
{
  const pack = packLayeredField(cache.field);
  let worst = 0;
  for (const p of [[3.9, .55, 4.4], [6.5, .6, 3.5], [4.5, 1.1, 4.45], [2.5, .3, 2.5]]) {
    worst = Math.max(worst, Math.abs(cache.field.sampleOcc(...p) - sampleLayeredTexture(pack, ...p)[0]));
  }
  assert.ok(worst <= 1e-9, `纹理镜像与场取样一致（${worst.toExponential(2)}）`);
}

/* ---------- 6) 包围盒扩张 → 回退全量；空场 → field=null ---------- */
{
  const edge = world.cells.find((c) => c.cx < 1 && c.cz < 1);
  world.fill(edge, 2);
  const u = cache.update(world);
  // 格 (0,0) 的包围盒本就在场界内 → 是 dirty 不是 full；把楼加到 maxH 之上触发层数变化
  assert.equal(u.mode, 'dirty');
  const tall = world.cells.find((c) => c.cx > 7 && c.cz > 7);
  world.fill(tall, 12);                        // 超过既有 maxH → layers 变 → 全量
  const u2 = cache.update(world);
  assert.equal(u2.mode, 'full', '层数/包围盒变了回退全量');
  const v = cache.verifyAgainstFull(world);
  assert.ok(v.badTexels === 0 && v.maxDiff <= 1e-9, '全量后仍一致');
  // 清空 → 场回 null，不炸
  world.cells.forEach((c) => world.fill(c, 0));
  const u3 = cache.update(world);
  assert.equal(u3.field, null);
  assert.equal(u3.mode, 'full');
}

/* ---------- 7) 形变签名：shape 变了岩石层判脏（本仓栅格化用切面顶点，裁判无此维） ---------- */
{
  const world2 = new World(g1);
  world2.palette = world.palette;
  // 只让左边两列是岩石层（形变签名只管 rock solid lv），其余是建筑层——
  // 换 shape 时 dirty = 岩石格数，低于 fullRatio 阈值才走增量。
  world2.cells.forEach((c) => world2.fill(c, 1, { rock: c.cx < 2 }));
  const colorOf2 = (c, lv) => (world2.isRock(c, lv) ? { r: .6, g: .58, b: .55 } : { r: .8, g: .75, b: .7 });
  const cache2 = new LayeredFieldCache({ L, colorOf: colorOf2, res: 0.09, radius: 4 });
  const shapeA = { at: (p, lv) => [p.x, p.z] };
  const u1 = cache2.update(world2, { shape: shapeA });
  assert.equal(u1.mode, 'full');
  const rockCells = world2.cells.filter((c) => world2.isRock(c, 1)).length;
  const shapeB = { at: (p, lv) => [p.x + 0.08 * Math.min(lv, 3), p.z] };
  const u2 = cache2.update(world2, { shape: shapeB });
  assert.equal(u2.mode, 'dirty', '形变变了 → 岩石层判脏重投影');
  assert.equal(u2.dirty, rockCells, '脏格数 = 岩石格数');
  const v = cache2.verifyAgainstFull(world2, { shape: shapeB });
  assert.ok(v.badTexels === 0 && v.maxDiff <= 1e-9, '形变增量 ≡ 全量：' + JSON.stringify(v));
  console.log(`  shape diff: dirty ${u2.dirty}/${world2.cells.length} cells, verify maxDiff ${v.maxDiff.toExponential(2)}`);
}

console.log('PASS ao-field-cache: 常驻分层场逐次重投影——增量 ≡ 全量（逐纹素 ≤1e-9，写回区外字节不动），bakeLighting({field})/channels/纹理打包同源，裁判 lightingcache 同机制。');
