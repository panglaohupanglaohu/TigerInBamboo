// 第 56 批 C01 · 1015142746372366336：Smoke 外挂层（life/smoke-c01.js）大瓣 / 顶端断开 / 弥散薄雾。
// 浏览器侧：tools/shot.py http://localhost:8801/smoke.html … --eval "$(cat tests/smoke-c01-probe.js)"（同机位离屏渲染数瓣 / 断开 / 薄雾像素）。
import assert from 'node:assert/strict';
import { THREE } from './fixtures/g5-battle.mjs';
const { Smoke } = await import('../src/life/smoke.js');
const { installSmokeShape, lobeFactor } = await import('../src/life/smoke-c01.js');

// 纯函数
assert.equal(lobeFactor({ serial: 2, age: 0, life: 4 }, 1, {}), 1, '全关 = 原尺寸');
assert.equal(lobeFactor({ serial: 2, age: 0, life: 4 }, 1, { bigLobes: true }), 0, '每 3 片丢 1 片');
assert.equal(lobeFactor({ serial: 3, age: 0, life: 4 }, 1, { bigLobes: true }), 1.32, '留下的放大');
assert.equal(lobeFactor({ serial: 3, age: 0, life: 4 }, 3.0, { detach: true }), 0, '空档里出生的不画');
assert.equal(lobeFactor({ serial: 3, age: 0.5, life: 4 }, 3.0, { detach: true }), 1, '空档前出生的照画（birth = 1.0）');

const run = (opts) => {
  let a = 7; const random = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const s = new Smoke({ scene: new THREE.Group(), uTime: { value: 0 }, random });
  const shape = opts ? installSmokeShape(s) : null; if (shape) shape.set(opts);
  s.sources = [{ x: 0, y: 0, z: 0 }];
  const cam = new THREE.PerspectiveCamera(40, 1, .1, 100); cam.position.set(2, 1, 5); cam.lookAt(1, 1.3, 0); cam.updateMatrixWorld();
  for (let i = 0; i < 120; i++) s.update(.05, new THREE.Vector3(1, 0, .2), cam);
  return { s, shape, m: Array.from(s.back.instanceMatrix.array.slice(0, s.back.count * 16)) };
};
const base = run(null), off = run({ bigLobes: false, detach: false, haze: false }), on = run({ bigLobes: true, detach: true, haze: true });
assert.deepEqual(off.m, base.m, '装上外挂但全关：实例矩阵与原 smoke.js 逐位相同');
assert.equal(off.shape.mesh.count, 0);
assert.ok(on.shape.hidden > on.s.back.count * .33 && on.shape.drawn > 10, '大瓣 + 断开：' + JSON.stringify([on.shape.hidden, on.shape.drawn]));
assert.ok(on.shape.hazeCards > 5, '薄雾卡');
// 薄雾卡比本体大（2.4 倍）、只给老一些的烟团
const hm = new THREE.Matrix4(), hs = new THREE.Vector3(), hp = new THREE.Vector3(), hq = new THREE.Quaternion();
on.shape.mesh.getMatrixAt(0, hm); hm.decompose(hp, hq, hs); assert.ok(hs.x > .5, '薄雾卡 ' + hs.x);
// 断开：按出生时间排序，空档里出生的片全部隐藏 → 柱身在高度上出现一段没有可见片的空隙
const vis = [], gone = [];
const bySerial = new Map(on.s.p.map((p) => [p.serial, p]));
on.s.drawOrder.forEach((ser, i) => { const p = bySerial.get(ser), m = new THREE.Matrix4(); on.s.back.getMatrixAt(i, m); const sc = new THREE.Vector3().setFromMatrixScale(m).x; (sc < 1e-3 ? gone : vis).push(p.serial); });
const ys = vis.map((s) => bySerial.get(s).y).sort((a, b) => a - b); let maxGap = 0; for (let i = 1; i < ys.length; i++) maxGap = Math.max(maxGap, ys[i] - ys[i - 1]);
const ysOff = base.s.p.map((p) => p.y).sort((a, b) => a - b); let gapOff = 0; for (let i = 1; i < ysOff.length; i++) gapOff = Math.max(gapOff, ysOff[i] - ysOff[i - 1]);
// ——— 第 75 轮重标（r74 记的「0.23 断言过时」）———
// 旧判据是 `maxGap > gapOff * 2 && maxGap > .3`，那是外挂层卡数 67 时的口径。native 化后 smoke.js 自己只发 66 片，
// bigLobes 每 3 片丢 1 → 可见 44，**间距被丢片撑大**，实测 maxGap 0.434 全部来自丢片、不是来自 detach：
//   同跑对照（本轮实测）：base 0.227 / detachOnly 0.260 / bigOnly 0.434 / on 0.434 → 「2×」量的是卡数，判据无效。
// 改成量**机制本身**：空档是一个**连续出生序号区间**，区间内的片全不画（与卡数无关）。
const goneSorted = gone.slice().sort((a, b) => a - b);
const runs = []; let st = 0;
for (let i = 1; i <= goneSorted.length; i++) if (i === goneSorted.length || goneSorted[i] !== goneSorted[i - 1] + 1) { runs.push(goneSorted[i - 1] - goneSorted[st] + 1); st = i; }
const detachOnly = run({ bigLobes: false, detach: true, haze: false });
const donlyGone = [], dTotal = detachOnly.s.p.length;
detachOnly.s.drawOrder.forEach((ser, i) => { const m = new THREE.Matrix4(); detachOnly.s.back.getMatrixAt(i, m); const sc = new THREE.Vector3().setFromMatrixScale(m).x; if (sc < 1e-3) donlyGone.push(ser); });
const dg = donlyGone.sort((a, b) => a - b), dRuns = []; st = 0;
for (let i = 1; i <= dg.length; i++) if (i === dg.length || dg[i] !== dg[i - 1] + 1) { dRuns.push(dg[i - 1] - dg[st] + 1); st = i; }
assert.equal(dRuns.length, 1, '空档只有一个：单开 detach 时被隐藏的出生序号连成 1 段，实测 ' + JSON.stringify(dRuns));
assert.ok(dg.length >= 12 && dg.length <= Math.ceil(dTotal * .3), `空档宽度 ${dg.length}/${dTotal} 片（实测 16/66，约一个静默窗）`);
assert.ok(maxGap > gapOff, `可见片最大竖向空隙 ${maxGap.toFixed(2)} 不小于原片卡组的 ${gapOff.toFixed(2)}`);
assert.ok(vis.length < on.s.p.length * .75, `bigLobes 丢片：可见 ${vis.length}/${on.s.p.length}`);
console.log('smoke-c01 PASS', JSON.stringify({ hidden: gone.length, drawn: on.shape.drawn, haze: on.shape.hazeCards, gap: +maxGap.toFixed(2), gapOff: +gapOff.toFixed(2), silentWindow: dg.length }));
