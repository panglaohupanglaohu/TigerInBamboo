// 1168571866405097472 残差补全：遮蔽/反弹「通道级」分离对照。
//
// 原片机制：遮蔽存在分层 mesh，改动时重投影成纹理，模糊后由顶点着色器采样。
// 本地 bake.js 此前把遮蔽与彩色反弹直接混进同一组顶点色——ao-stages.html 只能靠
// 两次烘焙（strength=0 / bounce=0）做画面对照，单次烘焙里两通道无法单独读数。
// 本轮新增 bakeLighting({ channels:true })：逐顶点返回
//   { ao[nVert], bounce[nVert*3], air[nVert*3], sun[nVert] }
// 契约（vertex/up/flat 档精确成立）：
//   col_out[c] = col_in[c]·sun[v]·( ao[v] + bounce[3v+c] ) + air[3v+c]
// 本测试证明：
//   1. 通道读数逐值重构（Float32 通道，≤1e-6）最终顶点色（含 sunShadow / 多跳 airGain / directional 色偏）；
//   2. 通道读数与参数隔离两次烘焙逐值一致——即「仅遮蔽」「仅反弹」两种烘焙结果
//      可以从单次烘焙的通道里直接读出，不再需要跑两遍；
//   3. 同一可分离性在只读裁判 bakeVertexAO 上同样成立（裁判同式 col·(ao+br·k)）。
// 不声称这是原 GPU 重投影管线——原 GPU 路径仍是卡点·A，见 data.js note。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
globalThis.document = new Proxy({}, { get: () => () => ({ style: {}, getContext: () => null }) });

const { generateModulePatch } = await import('../src/core/module-patch.js');
const { World } = await import('../src/core/world.js');
const { bakeLighting } = await import('../src/light/bake.js');
// 只读裁判：REACode/src（不改动）
const { Town } = await import('../../REACode/src/town.js');
const REF = await import('../../REACode/src/lighting.js');

const L = .5;
/* ---------- 场景：9×9 平地 + x∈(4,5) 一列 4 层高墙（墙根顶点被遮蔽、空地不被遮蔽） ---------- */
const vertices = [], faces = [];
for (let x = 0; x <= 8; x++) for (let z = 0; z <= 8; z++) vertices.push([x, z]);
for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) { const a = x * 9 + z; faces.push([a, a + 9, a + 10, a + 1]); }
const g1 = generateModulePatch({ vertices, faces });
const world = new World(g1), town = new Town(g1);
world.cells.forEach((c) => { world.fill(c, 1, { rock: true }); town.fill(c, 1); });
world.cells.filter((c) => c.cx > 4 && c.cx < 5).forEach((c) => { world.fill(c, 4); town.fill(c, 4); });
const colorOf = () => ({ r: .8, g: .8, b: .8 });
const tri = (x, z) => [x, L, z, x, L, z + .1, x + .1, L, z];
const pos = [...tri(3.75, 4.45), ...tri(1, 1)];   // 三角①贴墙根（被遮蔽）；三角②空旷（不被遮蔽）
const run = (extra = {}) => { const m = { pos: pos.slice(), col: new Array(18).fill(1) }; const r = bakeLighting(m, world, { L, colorOf, res: 0.09, radius: 4, ...extra }); return { m, r }; };
const reconstruct = (colIn, ch) => colIn.map((c, i) => c * ch.sun[i / 3 | 0] * (ch.ao[i / 3 | 0] + ch.bounce[i]) + ch.air[i]);
const maxAbs = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

/* ---------- 1) 通道逐值重构（Float32 通道，≤1e-6）顶点色：vertex（含 sunShadow）、多跳 airGain、directional、up、flat ---------- */
{ const { m, r } = run({ channels: true, sunShadow: { dir: [0.4, 1, 0.3] } });
  assert.ok(r.channels, 'channels 输出存在');
  assert.ok(r.channels.ao[0] < r.channels.ao[3] - .05, '墙根顶点遮蔽强于空地顶点');
  assert.ok(r.channels.bounce[0] > r.channels.bounce[9], '墙根顶点反弹量大于空地顶点');
  assert.ok(r.channels.sun[0] < 1 && r.channels.sun[3] === 1, 'sun 通道独立读数');
  assert.ok(maxAbs(m.col, reconstruct(new Array(18).fill(1), r.channels)) < 1e-6, 'vertex+sun 重构恒等');
  const off = run(); assert.equal(off.r.channels, undefined, '默认不产出 channels');
}
{ const { m, r } = run({ channels: true, bounces: 3 });
  assert.ok(r.channels.air.some((v) => v > 0), '多跳 air 通道非零');
  assert.ok(maxAbs(m.col, reconstruct(new Array(18).fill(1), r.channels)) < 1e-6, 'bounces=3 重构恒等（含 air 加法项）');
}
{ const { m, r } = run({ channels: true, aoMode: 'directional' });
  assert.ok(maxAbs(m.col, reconstruct(new Array(18).fill(1), r.channels)) < 1e-6, 'directional 重构恒等（色偏余量记入 bounce）');
}
for (const mode of ['up', 'flat']) {
  const { m, r } = run({ channels: true, aoMode: mode });
  assert.ok(maxAbs(m.col, reconstruct(new Array(18).fill(1), r.channels)) < 1e-6, `${mode} 重构恒等`);
}

/* ---------- 2) 通道读数 ≡ 参数隔离两次烘焙：遮蔽/反弹可分离是数据事实，不只是画面对照 ---------- */
{ const def = run({ channels: true });
  const aoOnly = run({ bounce: 0, channels: true });        // ao-stages.html「仅本地分层遮蔽」
  const bounceOnly = run({ strength: 0, channels: true });  // ao-stages.html「仅本地彩色反弹」
  const ONE = new Array(18).fill(1);
  // 参数隔离可分离性：col_def = col_aoOnly + col_bounceOnly − col_in
  assert.ok(maxAbs(def.m.col, ONE.map((_, i) => aoOnly.m.col[i] + bounceOnly.m.col[i] - 1)) < 1e-9,
    '参数隔离线性可分：默认 = 仅遮蔽 + 仅反弹 − 原色');
  // 通道读数与参数隔离逐值一致：ao 通道 = 仅遮蔽烘焙乘子，bounce 通道 = 仅反弹烘焙超出部分
  assert.ok(aoOnly.r.channels.bounce.every((v) => v === 0) && aoOnly.r.channels.air.every((v) => v === 0),
    '仅遮蔽烘焙：bounce/air 通道恒零');
  assert.ok(bounceOnly.r.channels.ao.every((v) => v === 1), '仅反弹烘焙：ao 通道恒 1');
  assert.ok(maxAbs(def.r.channels.ao, aoOnly.m.col.filter((_, i) => i % 3 === 0)) < 1e-6,
    '默认烘焙 ao 通道 = 仅遮蔽烘焙顶点色（白模 col=1）');
  assert.ok(maxAbs(def.r.channels.bounce, bounceOnly.m.col.map((v) => v - 1)) < 1e-6,
    '默认烘焙 bounce 通道 = 仅反弹烘焙顶点色 − 原色');
}

/* ---------- 3) 裁判对照：同一可分离性在只读 bakeVertexAO 上成立（同式 col·(ao+br·k)） ---------- */
{ const fO = REF.buildVoxelField({ grid: g1, levelHeight: L, res: 0.09, pad: 0.8, blurRadius: 4, blurPasses: 2, sets: [{ town, colorOf }] });
  const cD = new Array(18).fill(1), cA = new Array(18).fill(1), cB = new Array(18).fill(1);
  REF.bakeVertexAO(fO, pos, cD);
  REF.bakeVertexAO(fO, pos, cA, { bounce: 0 });
  REF.bakeVertexAO(fO, pos, cB, { strength: 0 });
  assert.ok(maxAbs(cD, cA.map((v, i) => v + cB[i] - 1)) < 1e-6,
    '裁判 bakeVertexAO 同样线性可分：默认 = 仅遮蔽 + 仅反弹 − 原色');
  // 本地默认烘焙与裁判在同一探针上逐值一致（既有 parity 结论的通道化复核）
  const loc = run();
  assert.ok(maxAbs(loc.m.col, cD) < 1e-9, '本地 bake 顶点色与裁判逐值一致');
  console.log(`  referee: separable identity maxAbs ${maxAbs(cD, cA.map((v, i) => v + cB[i] - 1)).toExponential(2)}`);
}

console.log('PASS ao-split-channels: 遮蔽/反弹通道读数逐值重构（Float32 通道，≤1e-6）顶点色，与参数隔离两次烘焙逐值一致；裁判同式可分离。残余仅原 GPU 重投影/动态纹理（卡点·A）。');
