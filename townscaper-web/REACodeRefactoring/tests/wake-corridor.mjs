// 第 183 轮：901469409579061248「nicer ship wakes」的两档口径
//   V 档（默认，REACode/Kelvin 19.47°）：横向速度把边线推成张开的 V —— 旧测试 already covers 角度；
//   corridor 档（本轮新加，对原片）：边线固定横向偏移 → 平行、不张开；内部按行发泡、行内跳格 → 断续。
// 片子依据：frame-0060 / frame-0120 的 4× 裁切，两条白边线在整段尾迹上近似平行，间距 ≈ 船宽 3–4 倍，
// 线间是成排的 X / chevron 碎块（近船密、远端稀）。见 artifacts/coverage/901469409579061248-review-r183.md
import assert from 'node:assert/strict';
import { makeWakeParticles, KELVIN } from '../src/core/wake-sampling.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const ship = { id: 0, x: 0, z: 0, dx: 1, dz: 0, speed: 2, len: 1, beam: 0.2 };

// 船必须**同一条**跨段连续跑：每次 new 一个回到原点会让新旧粒子混在一起（斜率直接被抹平）
function run(w, seconds, s = { ...ship }, dt = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    s.x += s.dx * s.speed * dt; s.z += s.dz * s.speed * dt;
    w.step(dt, [s]);
  }
  return s;
}

// ---------- 1. V 档（默认）真的会张开 ----------
{
  const w = makeWakeParticles({ life: 8, seed: 3 });
  const s2 = run(w, 2);
  const w2 = w.width(s2);
  const s5 = run(w, 3, s2);
  const w5 = w.width(s5);
  ok(w5 > w2 * 1.3, `V 档横向半宽随时间张开（2s ${w2.toFixed(3)} → 5s ${w5.toFixed(3)}）`);
  const m = w.measureAngle(s5);
  ok(Math.abs(m.angleDeg - KELVIN) < 1.5, `V 档最小二乘角 ≈ Kelvin ${KELVIN}°（实得 ${m.angleDeg.toFixed(2)}°，样本 ${m.samples}）`);
  ok(w.rows === 0, 'V 档不发"行"（rows 恒 0，portal 到 corridor 才有意义）');
}

// ---------- 2. corridor 档：两条边线平行、间距恒定 ----------
{
  const w = makeWakeParticles({ life: 8, seed: 3, corridor: true });
  const s2 = run(w, 2);
  const w2 = w.width(s2);
  const s5 = run(w, 3, s2);
  const w5 = w.width(s5);
  ok(Math.abs(w5 - w2) / w2 < 0.02, `corridor 档横向半宽恒定（2s ${w2.toFixed(4)} → 5s ${w5.toFixed(4)}，应无张开）`);
  ok(Math.abs(w2 - ship.beam * 3.4 / 2) < 1e-9, `半宽 == beam·corridorBeam/2（${w2} vs ${ship.beam * 3.4 / 2}）`);
  const m = w.measureAngle(s5);
  ok(m.angleDeg < 3, `corridor 档拟合角近 0（实得 ${m.angleDeg.toFixed(2)}°）—— 边线平行，不是 Kelvin V`);
}

// ---------- 3. 断续：按里程发"行"，行内有空格 ----------
{
  const w = makeWakeParticles({ life: 8, seed: 3, corridor: true, rowStep: 1.1 });
  const s = run(w, 5);
  // 5s × 2 unit/s = 10 unit，rowStep·len = 1.1 → 约 9 行
  ok(w.rows >= 8 && w.rows <= 10, `行数按里程算（实得 ${w.rows}，期望 8–10）`);
  const perRow = new Map();
  for (const p of w.foam) if (p.row >= 0) perRow.set(p.row, (perRow.get(p.row) || 0) + 1);
  // r184：行寿命改为按船长标定（1.5 个船长），所以"发过 9 行"但同时在场的只有最近 2–4 行
  ok(perRow.size >= 2 && perRow.size < w.rows, `在场行数 ${perRow.size}/${w.rows}（按长度淡出，旧行已收）`);
  const slots = Math.max(2, Math.round(3.4 * 1.5));   // r184：横向格数 = round(corridorBeam·1.5)
  const sparse = [...perRow.values()].filter((n) => n > 0 && n < slots);
  ok(sparse.length > 0, `行内有空格 = 断续（${sparse.length}/${perRow.size} 行未填满 ${slots} 格）`);
  ok([...perRow.values()].every((n) => n <= slots), '行内粒子数不超过格数');
  // 行的纵向节奏：同一行的粒子共线，相邻行沿航迹的间距 ≈ rowStep·len
  const mid = new Map();
  // 行内粒子以 0.1·speed 顺流微漂（r184 改为"泡沫留在原地"，尾迹长度改由航速×寿命决定），
  // 越老的行漂得越远 —— 不扣掉这段漂移，相邻行的表观间距会被压缩，所以按 age 反推**发射点**：
  const drift = s.speed * 0.1;
  for (const p of w.foam) if (p.row >= 0) {
    const at = p.x * s.dx + p.z * s.dz - drift * p.age;
    mid.set(p.row, [...(mid.get(p.row) || []), at]);
  }
  const along = [...mid.entries()].map(([row, ds]) => ({ row, at: ds.reduce((a, b) => a + b, 0) / ds.length, spread: Math.max(...ds) - Math.min(...ds) }))
    .sort((a, b) => a.at - b.at);
  ok(along.every((r) => r.spread < 1e-6), '同一行的泡沫严格横向共线（行是"横线"，不是散点云）');
  const gaps = along.slice(1).map((r, i) => r.at - along[i].at);
  // 整行为空时会出现 2.2 的间隔（跳一行）—— 所以判据是「gap 必须是 rowStep 的整数倍」，
  // 不是「每段都等于 1.1」
  const gapErr = Math.max(...gaps.map((g) => Math.abs(g / 1.1 - Math.round(g / 1.1)) * 1.1));
  ok(gapErr < 0.05, `行间距 == n·rowStep·len（n≥1，最差偏差 ${gapErr.toFixed(4)}；实测 ${gaps.map((g) => g.toFixed(2)).join('/')}）`);
  // 整行全空是随机事件（r184 把横向格数提到 5，空行概率 0.45^5≈1.8%），所以"断"改判行内空格：
  ok([...perRow.values()].some((n) => n <= 2), `确有只填 1–2 格的稀疏行（${[...perRow.values()].filter((n) => n <= 2).length} 行）`);
}

// ---------- 4. corridor 档仍在船头喷溅 ----------
{
  const w = makeWakeParticles({ life: 4, seed: 9, corridor: true });
  run(w, 2);
  ok(w.spray.length > 0, `corridor 档也发船头喷溅（${w.spray.length} 粒）`);
  ok(w.foam.some((p) => !p.veil) && w.foam.some((p) => p.veil), '边线与行内泡沫两类都在（形态可分辨）');
}

// ---------- 5. 定种子可回放 ----------
{
  const a = makeWakeParticles({ life: 6, seed: 21, corridor: true });
  const b = makeWakeParticles({ life: 6, seed: 21, corridor: true });
  run(a, 3); run(b, 3);
  ok(a.emitted === b.emitted && a.rows === b.rows, `同种子同结果（emitted ${a.emitted}/${b.emitted}，rows ${a.rows}/${b.rows}）`);
  ok(JSON.stringify(a.foam.slice(0, 20)) === JSON.stringify(b.foam.slice(0, 20)), '前 20 粒逐位相同');
  const c = makeWakeParticles({ life: 6, seed: 22, corridor: true });
  run(c, 3);
  ok(JSON.stringify(a.foam[0]) !== JSON.stringify(c.foam[0]), '换种子会换粒子序列');
}

// ---------- 6. 参数校验 ----------
{
  assert.throws(() => makeWakeParticles({ corridorBeam: 0.5 }), RangeError); checks++;
  assert.throws(() => makeWakeParticles({ rowStep: 0 }), RangeError); checks++;
  assert.throws(() => makeWakeParticles({ rowFill: 0 }), RangeError); checks++;
  assert.throws(() => makeWakeParticles({ rowFill: 1.2 }), RangeError); checks++;
  const w = makeWakeParticles({ corridor: true });
  assert.throws(() => w.step(-1, []), RangeError); checks++;
  assert.throws(() => w.step(0.1, [{ ...ship, dx: 3 }]), RangeError); checks++;
}

console.log(`wake-corridor: ${checks} checks PASS · V 档仍 Kelvin ${KELVIN}°，corridor 档恒宽+断続行`);
