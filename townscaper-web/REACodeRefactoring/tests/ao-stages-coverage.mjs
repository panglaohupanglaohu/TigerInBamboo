// 793557992931266561「flat -> up normal -> vertex voxel AO -> SSAO -> directional AO
// (With textures and baked vertex colors, I could get rid of the SSAO)」· 6 帧遮蔽序列对照。
//
// 本测试只做「可观察行为 ↔ 本地落点」的核对与差异量化，不把本地实现冒充原算法：
//   帧0 平色剪影            → bake.js aoMode 'flat'（顶点色不动）
//   帧1 凸部/向上明暗        → aoMode 'up'（只看法线朝上的量，不认邻居）
//   帧2 明显体素遮蔽         → aoMode 'vertex'（分层占用烘焙）
//   帧3 凹处进一步变化        → view-c04 SSAOPass（屏幕空间 AO，本地常数；原作自述已弃用 SSAO，
//                            其核与参数从未公开 —— 只能覆盖"有接触暗影"这一可观察事实）
//   帧4 方向性色彩           → aoMode 'directional'（六标量 ±轴遮蔽 + 方向色偏）
//   帧5 尾帧保持             → 无新行为
// 与只读裁判（townscaper-web/REACode/src，不改动）的对照：
//   · 裁判 bakeVertexAO 跑在裁判自己的分层场上，与 bake.js 'vertex' 在同一份输入上比顶点色；
//   · 裁判 buildVoxelAO（格级四档事实）与移植版 src/light/voxel-ao.js 逐格逐向比；
//   · 结论量化见文末 console 输出；大场景全量口径见 catalog parity/lighting.json
//     （maxAbs 0.0359 / meanAbs 0.0023 / pearson 0.9997——同一套数学，栅格化口径不同）。
// 卡点·C（永久）：原作 SSAO 核与方向 AO 六标量公式、各项常数均未公开，配文只说阶段名，
// 6 帧画面不足以反推 —— 除非出现新证据，"原算法本体"不可复现，只有可观察行为可对拍。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
globalThis.document = new Proxy({}, { get: () => () => ({ style: {}, getContext: () => null }) });

const { generateModulePatch } = await import('../src/core/module-patch.js');
const { World } = await import('../src/core/world.js');
const { bakeLighting, AO_MODES } = await import('../src/light/bake.js');
const { buildVoxelAO } = await import('../src/light/voxel-ao.js');
const { C04_KEYS, ssaoKernel } = await import('../src/world/view-c04.js');
// 只读裁判：REACode/src（voxelao.js 纯计算无依赖；lighting.js 只要 'three' 与 ./town.js）
const { buildVoxelAO: refVoxelAO } = await import('../../REACode/src/voxelao.js');
const { Town } = await import('../../REACode/src/town.js');
const REF = await import('../../REACode/src/lighting.js');

const L = .5;
/* ---------- 场景 A：平地 + 一面 4 层高墙（阶段行为探针） ---------- */
const vertices = [], faces = [];
for (let x = 0; x <= 8; x++) for (let z = 0; z <= 8; z++) vertices.push([x, z]);
for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) { const a = x * 9 + z; faces.push([a, a + 9, a + 10, a + 1]); }
const g1 = generateModulePatch({ vertices, faces });
const world = new World(g1), town = new Town(g1);
world.cells.forEach((c) => { world.fill(c, 1, { rock: true }); town.fill(c, 1); });
const wall = world.cells.filter((c) => c.cx > 4 && c.cx < 5);
wall.forEach((c) => { world.fill(c, 4); town.fill(c, 4); });
const colorOf = () => ({ r: .8, g: .8, b: .8 });
const tri = (x, z) => [x, L, z, x, L, z + .1, x + .1, L, z];
const pos = [...tri(3.75, 4.45), ...tri(1, 1)];   // 三角①：墙根边；三角②：空旷地
const run = (aoMode, extra = {}) => { const m = { pos: pos.slice(), col: new Array(18).fill(1) }; const r = bakeLighting(m, world, { L, colorOf, aoMode, res: 0.09, radius: 4, keepField: true, ...extra }); return { m, r }; };
const out = Object.fromEntries(AO_MODES.map((k) => [k, run(k)]));

/* 帧0 → flat：剪影平色，顶点色原样 */
assert.ok(out.flat.m.col.every((v) => v === 1), 'frame0 flat: 顶点色不动');
/* 帧1 → up normal：只认朝向不认邻居——墙根地板与空地地板同亮；竖直面比水平面暗 */
assert.equal(out.up.m.col[0], out.up.m.col[9], 'frame1 up: 无邻居信息');
assert.equal(out.up.m.col[0], 1, 'frame1 up: 顶面 ny=1 不压暗');
{ // 竖直面（贴墙 x=4.95 朝 -x）比水平面暗
  const side = { pos: [4.95, 0, 4.4, 4.95, L, 4.4, 4.95, 0, 4.5], col: [1, 1, 1, 1, 1, 1, 1, 1, 1] };
  bakeLighting(side, world, { L, colorOf, aoMode: 'up', res: 0.09, radius: 4 });
  assert.ok(side.col[0] < 1, 'frame1 up: 竖直面被压暗');
}
/* 帧2 → vertex voxel AO：墙根比空地暗 */
assert.ok(out.vertex.m.col[0] < out.vertex.m.col[9] - .05, 'frame2 voxel AO: 墙根更暗');
/* 帧3 → SSAO：不是烘焙档（aoMode 拒收），是 view-c04 屏幕空间 pass；核在半球内且确定 */
assert.throws(() => bakeLighting({ pos: pos.slice(), col: new Array(18).fill(1) }, world, { L, colorOf, aoMode: 'ssao' }), RangeError);
assert.ok(C04_KEYS.includes('ssao'), 'frame3 SSAO: c04 开关存在');
{ const k1 = ssaoKernel(), k2 = ssaoKernel();
  assert.equal(k1.length, 16); assert.deepEqual(k1, k2, 'frame3 SSAO: 核确定');
  assert.ok(k1.every((v) => v[2] >= 0 && Math.hypot(...v) <= 1 + 1e-9), 'frame3 SSAO: 半球核');
}
/* 帧4 → directional AO：六标量，+x（墙所在侧）遮蔽大于 -x，暗部带方向色偏 */
{ const d = out.directional.r.field.dirAo;
  assert.equal(d.length, 6 * 6, 'frame4 directional: 每顶点 6 标量');
  assert.ok(d[0] > d[1] + .1, `frame4 directional: +x 被挡更多 (${d[0]} vs ${d[1]})`);
  const c = out.directional.m.col;
  assert.ok(c[0] < 1 && (Math.abs(c[0] - c[1]) > 1e-3 || Math.abs(c[1] - c[2]) > 1e-3), 'frame4 directional: 方向色偏');
  const m2 = { pos: tri(5.15, 4.45), col: new Array(9).fill(1) };
  const r2 = bakeLighting(m2, world, { L, colorOf, aoMode: 'directional', res: 0.09, radius: 4, keepField: true });
  assert.ok(r2.field.dirAo[1] > r2.field.dirAo[0], 'frame4 directional: 镜像侧 -x 占优');
}
/* 帧5：尾帧保持，无新行为 */

/* ---------- 对照 1：裁判格级事实 vs 移植版（应逐值相同） ---------- */
{ const A = refVoxelAO(world, g1), B = buildVoxelAO(world);
  let checked = 0, diffs = 0, maxd = 0;
  for (const c of world.cells) for (const d of ['top', '+x', '-x', '+z', '-z']) {
    const a = A.faceShading(c, d), b = B.faceShading(c, d);
    for (const k of ['flat', 'upNormal', 'ao']) { checked++; const dd = Math.abs(a[k] - b[k]); if (dd > 1e-12) { diffs++; maxd = Math.max(maxd, dd); } }
    for (let i = 0; i < 3; i++) { checked++; const dd = Math.abs(a.dirAo[i] - b.dirAo[i]); if (dd > 1e-12) { diffs++; maxd = Math.max(maxd, dd); } }
  }
  assert.equal(diffs, 0, `格级事实移植逐值一致（${checked} 项）`);
  console.log(`  cellFacts: ${checked} values, diffs ${diffs}, maxd ${maxd}`);
}

/* ---------- 对照 2：bake.js 'vertex' vs 裁判 bakeVertexAO（同一输入的顶点色） ---------- */
{ // 同一份 pos：裁判跑在自己建的分层场上（逐像素 pointInQuad 栅格化），
  // bake.js 跑自己的扫描线栅格化；同一套 AO 数学（1−0.62·min(1,occ·1.15) + 0.42·反弹）。
  const fO = REF.buildVoxelField({ grid: g1, levelHeight: L, res: 0.09, pad: 0.8, blurRadius: 4, blurPasses: 2, sets: [{ town, colorOf }] });
  const colO = new Array(18).fill(1);
  REF.bakeVertexAO(fO, pos, colO);
  const colB = out.vertex.m.col;
  let max = 0; for (let i = 0; i < 18; i++) max = Math.max(max, Math.abs(colO[i] - colB[i]));
  assert.ok(max < 1e-9, `墙根探针两实现逐值一致（maxAbs ${max}）`);
  console.log(`  probeWall: referee vs bake.js vertex maxAbs ${max}`);
}

/* ---------- 对照 3：变化高度/颜色的整片小镇，差异量化 ---------- */
{ // 与 catalog parity/lighting.json 同口径的小号版：期望均值差 ~1e-3 量级、pearson ≈1，
  // 差异来源 = 栅格化方法（扫描线 vs 逐像素点测）与包围盒边距，不是 AO 公式。
  const g2 = generateModulePatch({ vertices, faces });
  const w2 = new World(g2), t2 = new Town(g2);
  let s = 7; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (const c of g2.cells) { const h = c.cx < 1 || c.cx > 7 || c.cz < 1 || c.cz > 7 ? 0 : 1 + Math.floor(rnd() * 4); w2.fill(c, h, { rock: true }); t2.fill(c, h); }
  const colors = g2.cells.map(() => ({ r: .3 + rnd() * .6, g: .3 + rnd() * .6, b: .3 + rnd() * .6 }));
  const colorOf2 = (c) => colors[c.id];
  const P = [], C0 = [];
  const push = (pts, c) => { for (const p of pts) P.push(...p); const k = colorOf2(c); for (let v = 0; v < 3; v++) C0.push(k.r, k.g, k.b); };
  for (const c of g2.cells) {
    const t = w2.top(c); if (!t) continue; const y = t * L, [a, b, cc, d] = c.pts;
    push([[a.x, y, a.z], [cc.x, y, cc.z], [b.x, y, b.z]], c); push([[a.x, y, a.z], [d.x, y, d.z], [cc.x, y, cc.z]], c);
    for (let e = 0; e < 4; e++) {
      const nid = c.edgeNeighbors[e], nt = nid < 0 ? 0 : w2.top(g2.cells[nid]); if (nt >= t) continue;
      const p = c.pts[e], q = c.pts[(e + 1) % 4], y0 = nt * L;
      push([[p.x, y0, p.z], [q.x, y, q.z], [q.x, y0, q.z]], c); push([[p.x, y0, p.z], [p.x, y, p.z], [q.x, y, q.z]], c);
    }
  }
  const fO = REF.buildVoxelField({ grid: g2, levelHeight: L, res: 0.09, pad: 0.8, blurRadius: 4, blurPasses: 2, sets: [{ town: t2, colorOf: colorOf2 }] });
  const colO = C0.slice(), colB = C0.slice();
  REF.bakeVertexAO(fO, P, colO);
  bakeLighting({ pos: P, col: colB }, w2, { L, colorOf: colorOf2, res: 0.09, radius: 4 });
  const n = C0.length;
  let max = 0, sum = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < n; i++) { const d = Math.abs(colO[i] - colB[i]); max = Math.max(max, d); sum += d; sa += colO[i]; sb += colB[i]; saa += colO[i] ** 2; sbb += colB[i] ** 2; sab += colO[i] * colB[i]; }
  const va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2, pear = (sab / n - sa * sb / n / n) / Math.sqrt(va * vb);
  console.log(`  townDiff: verts ${n / 3}, maxAbs ${max.toFixed(6)}, meanAbs ${(sum / n).toFixed(6)}, pearson ${pear.toFixed(6)}`);
  assert.ok(pear > 0.999 && sum / n < 0.01, '整镇顶点色与裁判高度相关（同一套数学，残差是栅格化口径）');
}

console.log('PASS ao-stages coverage: 6帧五阶段可观察行为均有本地落点（四档 aoMode + c04 SSAOPass）；裁判对照：格级事实逐值一致、探针逐值一致、整镇 pearson>0.999。残余仅为原作未公开算法本体（卡点·C）。');
