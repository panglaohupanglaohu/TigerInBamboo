// 第 102 轮 · 903647529203634176 · 伤害飘字的「受击方向甩出 + 击杀 +10 独立上浮」验收。
//
// 背景：r60 把这条记成 partial，note 里写「仍缺按受击方向抖动与 +10 独立上浮速度（机制未做）」。
// 但 `src/badnorth/damage-numbers.js` 后来（56 批 C02）已经有了 `kickDamageNumber` / `stepDamageKick`，
// `battle-c02.js` 的 `dmgKick` 开关也在调它们 —— 缺的其实是**验收**，不是实现。
// 这个文件就是补那一层：不看代码注释，只按原片的三件可量的事断言。
//
// 原片口径（654 帧，见 artifacts/coverage/903647529203634176-review-r60.md）：
//   ① 数字是被**打出来**的：从受击点沿「攻击者→受击者」方向甩一小段，不是原地冒起来；
//   ② 甩出去之后有阻尼抖动（片中数字边缘会来回抖一下，不是刚性直线上升）；
//   ③ 击杀的金色 "+10" 比普通 "+4" **升得更快**（上浮速度不共用常量）。
import {
  kickDamageNumber, stepDamageKick, addDamageNumber, stepDamageNumbers, damageValue,
} from '../src/badnorth/damage-numbers.js';

const rows = [];
const ok = (c, m) => rows.push({ ok: !!c, m });

// ---------- ① 击杀 +10 的上浮速度独立于 +4 ----------
{
  const plain = [{ x: 0, y: 0, z: 0, age: 0, kind: 'damage', value: 4 }];
  const kill = [{ x: 0, y: 0, z: 0, age: 0, kind: 'kill', value: 10 }];
  const dt = 1 / 60, n = 30;                       // 0.5s
  for (let i = 0; i < n; i++) {
    stepDamageNumbers(plain, dt); stepDamageKick(plain, dt);
    stepDamageNumbers(kill, dt); stepDamageKick(kill, dt);
  }
  const dp = plain[0].y, dk = kill[0].y;
  ok(Math.abs(dp - 0.55 * 0.5) < 1e-6, `+4 在 0.5s 上浮 ${dp.toFixed(4)}（= 0.55×0.5，旧口径不变）`);
  ok(Math.abs(dk - (0.55 + 0.35) * 0.5) < 1e-6, `+10 在 0.5s 上浮 ${dk.toFixed(4)}（= (0.55+0.35)×0.5，独立 killRise）`);
  ok(dk / dp > 1.5 && dk / dp < 1.7, `+10 / +4 上浮比 ${(dk / dp).toFixed(3)}（原片「+10 略快」，落在 1.5–1.7）`);
}

// ---------- ② 甩出方向 = 攻击者→受击者，且指数衰减到停 ----------
{
  const p = { x: 0, y: 0, z: 0, age: 0, kind: 'damage' };
  kickDamageNumber(p, 1, 0);                        // 攻击者在左，受击者在右 → 往 +x 甩
  ok(p.kx > 0 && Math.abs(p.kz) < 1e-9, `kick 初速沿受击方向 (kx=${p.kx}, kz=${p.kz})`);
  const dt = 1 / 60;
  stepDamageKick([p], dt);
  const x1 = p.x, kx1 = p.kx;
  for (let i = 0; i < 60; i++) stepDamageKick([p], dt);
  ok(p.x > x1, `甩出后 x 继续增加（${x1.toFixed(4)} → ${p.x.toFixed(4)}）`);
  ok(Math.abs(p.kx) < kx1 * 0.02, `1s 后速度衰减到初速的 ${(100 * Math.abs(p.kx) / kx1).toFixed(2)}%（damp=9）`);
  ok(p.x < 0.12, `总位移 ${p.x.toFixed(4)} 世界单位（一小段，不是飞出去）`);

  // 方向反转：攻击者在右 → 往 -x
  const q = { x: 0, y: 0, z: 0, age: 0, kind: 'damage' };
  kickDamageNumber(q, -2, 0);
  ok(q.kx < 0, `反向受击时 kx 为负（${q.kx}）`);
}

// ---------- ③ 阻尼抖动：沿受击方向来回、包络衰减 ----------
{
  const p = { x: 0, y: 0, z: 0, age: 0, kind: 'damage' };
  kickDamageNumber(p, 0, 1);                        // 沿 +z 抖
  const dt = 1 / 120;
  const j = [];
  for (let i = 0; i < 120; i++) { p.age += dt; stepDamageKick([p], dt); j.push(p.jz); }
  const early = Math.max(...j.slice(0, 12).map(Math.abs));
  const late = Math.max(...j.slice(-12).map(Math.abs));
  ok(j.some((v) => v > 1e-5) && j.some((v) => v < -1e-5), '抖动正负都出现（是振荡不是单向偏移）');
  ok(early > late * 3, `包络衰减：前 0.1s 峰值 ${early.toFixed(5)} vs 后 0.1s ${late.toFixed(5)}`);
  ok(Math.max(...j.map(Math.abs)) <= 0.018 + 1e-9, `抖动幅度不超过 shake=${0.018}`);
  ok(Math.abs(p.jx) < 1e-9, '沿 +z 受击时横向 jx 为 0（抖动方向跟受击方向走）');
}

// ---------- ④ 只对 kill 加上浮，别把普通数字也抬起来 ----------
{
  const list = [{ x: 0, y: 0, z: 0, age: 0, kind: 'damage' }, { x: 0, y: 0, z: 0, age: 0, kind: 'kill' }];
  for (let i = 0; i < 30; i++) stepDamageKick(list, 1 / 60);
  ok(Math.abs(list[0].y - 0) < 1e-9, `普通数字 y 未被 killRise 影响（${list[0].y}）`);
  ok(list[1].y > 0.17 && list[1].y < 0.18, `kill 数字单独涨 ${list[1].y.toFixed(4)}（0.35×0.5=0.175）`);
}

// ---------- ⑤ 非法输入要抛，不要静默算成 NaN ----------
{
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };
  ok(throws(() => kickDamageNumber({ x: 0 }, NaN, 0)), 'kick 收到 NaN 方向 → RangeError');
  ok(throws(() => stepDamageKick([], -1)), 'stepDamageKick 收到负 dt → RangeError');
  const p = { x: 0, y: 0, z: 0, age: 0, kind: 'damage' };
  kickDamageNumber(p, 0, 0);                        // 零向量：不抛，且不改字段
  ok(p.kx === undefined, '零长度方向不写 kick 字段（避免 NaN 传播）');
}

// ---------- ⑥ 与旧口径共存：add/step 的合并没有被 kick 破坏 ----------
{
  const list = [];
  addDamageNumber(list, { unitId: 7, x: 1, y: 2, z: 3, value: damageValue(10, 9) });
  addDamageNumber(list, { unitId: 7, x: 1, y: 2, z: 3, value: damageValue(9, 8) });
  ok(list.length === 1 && list[0].value === 8, `同单位连击仍合并且数值为 8（${list[0]?.value}）`);
  kickDamageNumber(list[0], 1, 0);
  stepDamageKick(list, 1 / 60);
  ok(Number.isFinite(list[0].x) && Number.isFinite(list[0].y), 'kick 之后位置仍是有限数');
}

console.log(rows.map((r) => `  ${r.ok ? '✓' : '✗'} ${r.m}`).join('\n'));
const bad = rows.filter((r) => !r.ok).length;
console.log(bad ? `\nFAIL ${bad}/${rows.length}` : `\nALL PASS ${rows.length}/${rows.length}`);
if (bad) process.exitCode = 1;
