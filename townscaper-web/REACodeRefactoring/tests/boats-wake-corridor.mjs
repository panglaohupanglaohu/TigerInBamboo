// r184：901469409579061248 的**接线**验收（node 侧）——Boats 真的走 corridor 档，
// 两条带状边线间距恒定、泡沫按里程成排跳格、远端淡出曲线是幂律长尾（边线比泡沫行拖得远）。
// V 档（`?wake=v`）作为反向对照：间距必须随年龄张开。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { Boats } = await import('../src/life/boats.js');
const { wakeFade } = await import('../src/core/wake-sampling.js');

const run = (mode, steps = 300, hz = 30, land = (x, z) => Math.hypot(x, z) < 3) => {
  const uTime = { value: 0 };
  const boats = new Boats({ scene: new THREE.Scene(), uTime, mode });
  boats.refresh(land, 6, 2);
  for (let i = 0; i < steps; i++) { uTime.value += 1 / hz; boats.update(1 / hz); }   // 时钟必须走，否则船原地不动
  return boats;
};

// ---- 1. corridor 档：边线间距恒定且等于 2·latOffset
const cor = run('corridor');
assert.equal(cor.mode, 'corridor');
assert.equal(cor.corridor, true);
const pc = cor.wakeProbe(0, { bins: 6 });
assert.equal(pc.trail.count, 110, 'corridor 拖带长度 110 段（≈6.2s）');
const sp = pc.trail.spans;
const mean = sp.reduce((s, v) => s + v, 0) / sp.length;
assert.ok(Math.abs(mean - 2 * cor.latOffset) < 1e-9, `间距 == 2·latOffset（${mean} vs ${2 * cor.latOffset}）`);
assert.ok((Math.max(...sp) - Math.min(...sp)) / mean < 1e-9, '间距逐段恒定（无外推）');
assert.ok(Math.abs(pc.trail.buckets.spans.at(-1) / pc.trail.buckets.spans[0] - 1) < 1e-9, '首/末段间距比 == 1');
console.log('PASS corridor 边线间距恒定', mean.toFixed(4), 'CV', ((Math.max(...sp) - Math.min(...sp)) / mean).toExponential(2));

// ---- 2. V 档：同一夹具下间距必须张开（反向对照）
const v = run('v');
const pv = v.wakeProbe(0, { bins: 6 });
assert.equal(pv.corridor, false);
const grow = pv.trail.buckets.spans.at(-1) / pv.trail.buckets.spans[0];
assert.ok(grow > 1.3, `V 档末/首段间距 ${grow.toFixed(2)} > 1.3`);
console.log('PASS V 档仍张开', grow.toFixed(3), '× （corridor 为 1.000）');

// ---- 3. 远端淡出曲线：幂律、单调、边线比泡沫行拖得远
assert.ok(pc.ribbonAlpha.monotonic, '带状 alpha 随年龄单调不增');
assert.ok(pc.ribbonAlpha.first > pc.ribbonAlpha.mid && pc.ribbonAlpha.mid > pc.ribbonAlpha.last, '三分点严格递减');
const trail0 = cor.boats[0].trail;
const expectMid = 0.75 * wakeFade(trail0[Math.floor((trail0.length - 1) / 2)].age, cor.wakeFx.edgeLife, cor.wakeFx.edgePower);
assert.ok(Math.abs(pc.ribbonAlpha.mid - expectMid) < 1e-9, 'ribbon alpha 与 wakeFade 同一条曲线');
assert.ok(pc.ribbonAlpha.mid > 0.2 && pc.ribbonAlpha.mid < 0.5, `中段 ${pc.ribbonAlpha.mid.toFixed(3)} 仍在半可见`);
const tailAge = trail0[Math.floor(trail0.length * .75)].age;
const tailAlpha = 0.75 * wakeFade(tailAge, cor.wakeFx.edgeLife, cor.wakeFx.edgePower);
assert.ok(tailAlpha > 0.03, `3/4 处残余 ${tailAlpha.toFixed(3)} > .03（长尾）`);
assert.ok(pc.ribbonAlpha.last <= 0.02, `末端 ${pc.ribbonAlpha.last.toFixed(4)} 渐隐到 0`);
const reach = pc.wake.reach;
assert.ok(reach.edge > reach.row, `边线可见 ${reach.edge.toFixed(2)} 船长 > 泡沫行 ${reach.row.toFixed(2)} 船长`);
assert.ok(reach.edge > 1.2, '边线拖到 1.2 船长以外');
// 泡沫行 alpha 的衰减指数更陡：同距离桶里 row/edge 的 alpha 比随距离下降
const b = pc.wake.buckets.filter((x) => x.edge && x.row);
assert.ok(b.length >= 2, '至少两桶同时有边线与行');
const ratioAt = (x) => x.rowAlpha / x.edgeAlpha;
assert.ok(ratioAt(b[0]) > ratioAt(b.at(-1)), `行/边 alpha 比随距离下降 ${ratioAt(b[0]).toFixed(2)} → ${ratioAt(b.at(-1)).toFixed(2)}`);
console.log('PASS 远端淡出', { first: +pc.ribbonAlpha.first.toFixed(3), mid: +pc.ribbonAlpha.mid.toFixed(3), last: +pc.ribbonAlpha.last.toFixed(4), reach });

// ---- 4. 泡沫按里程成排、排内跳格（断续）
assert.ok(pc.rows >= 10, `发 ${pc.rows} 行`);
const byRow = new Map();
for (const p of cor.wakeFx.foam) if (p.row >= 0) byRow.set(p.row, (byRow.get(p.row) || 0) + 1);
const sizes = [...byRow.values()];
assert.ok(sizes.every((n) => n <= 5), `每行不超过 5 格（实得最多 ${Math.max(...sizes)}）`);
const fill = sizes.reduce((s, n) => s + n, 0) / (sizes.length * 5);
assert.ok(fill > .35 && fill < .8, `行内填充率 ${fill.toFixed(2)}（≈rowFill .55 → 约四成空格 = 断续）`);
assert.ok(sizes.some((n) => n < 5), '确有未填满的行（空格即"断"）');
console.log('PASS 成排跳格', { rows: pc.rows, perRow: sizes.slice(-8) });

// ---- 5. 船头小泡沫尺寸（标定到片内「一小撮」）：corridor ≤ .27 beam
const sprayW = cor.wakeFx.spray.map((s) => s.w / 0.16);
assert.ok(sprayW.length > 0 && Math.max(...sprayW) <= 0.27 && Math.min(...sprayW) >= 0.13, `船头泡沫 ${Math.min(...sprayW).toFixed(2)}–${Math.max(...sprayW).toFixed(2)} beam`);
assert.ok(v.wakeFx.spray.some((s) => s.w / 0.16 > 0.3), 'V 档喷溅仍较大（对照）');
console.log('PASS 船头泡沫尺寸', { min: +Math.min(...sprayW).toFixed(3), max: +Math.max(...sprayW).toFixed(3) }, 'beam');

// ---- 6. 逐帧稳定：同一 uTime 序列 30/60/120Hz 出的 trail 段数不随步长变
const lens = [30, 60, 120].map((hz) => run('corridor', Math.round(hz * 7), hz).boats[0].trail.length);
assert.deepEqual(lens, [110, 110, 110], '步长无关');
console.log('PASS 帧率无关 trail', lens);
console.log('boats-wake-corridor: PASS · corridor 恒定间距 + 幂律长尾 + 成排断续 + 船头小泡沫');
