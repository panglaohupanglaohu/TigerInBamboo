// 第 89 轮 · 837027901853810688（514 帧 / 32.885 fps，小屋被点着）——火光 × 烟体积耦合曲线。
//
// 判据全部来自原片逐帧像素统计（第 86 轮量、本轮复算帧时间）：
//   烟面积  frame-0078 → 0084：5066 → 11777 = 2.30×   （t(0084)−t(0078)=0.180s）
//   火光    frame-0084 峰 1987 → 0090 1155 → 0096 450
//           = 0.180s 剩 58.1%、0.390s 剩 22.6%
// 本测断言的是「曲线在这两个时刻等于实测值」，不是「像不像指数」——
// 三点拟合不出单一指数（两个时刻分别对应 τ≈0.332 / 0.263），所以模块存的是实测折线。
import { FIRE_COUPLING, fireLight, smokeSizeMul, igniteCurve, easeSizeMul, burstPlan, FIRE_COUPLING_TABLE } from '../src/life/fire-coupling.js';

let fail = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ' · ' + extra : ''}`); if (!cond) fail++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ① 点火当刻：光最亮、烟还是常态
{
  const c = igniteCurve(0);
  ok('① t=0 light=1 且 sizeMul=1（点火当刻烟还没长）', c.light === 1 && c.sizeMul === 1, JSON.stringify(c));
}

// ② 0.180s：光是峰值的 58.1%（实测 1155/1987=0.5814），烟面积 2.30×
{
  const c = igniteCurve(0.18);
  ok('② 0.180s light≈0.581（实测 0.5814）', near(c.light, 0.581, 0.01), c.light.toFixed(4));
  ok('② 0.180s 烟面积≈2.30×（实测 11777/5066=2.3247，容差 0.12）', near(c.area, 2.3247, 0.12), c.area.toFixed(4));
}

// ③ 0.390s：光只剩 22.6%（实测 450/1987=0.2265），烟体积**不回落**
{
  const c = igniteCurve(0.39);
  ok('③ 0.390s light≈0.2265（实测 450/1987）', near(c.light, 0.2265, 0.012), c.light.toFixed(4));
  ok('③ 0.390s 烟面积仍 ≥2.30×（原片火灭了烟不缩）', c.area >= 2.29, c.area.toFixed(4));
}

// ④ 表内三点与实测严格相等（折线不是拟合，容差 0）
{
  const pts = [[0, 1], [0.18, 0.581], [0.39, 0.226]];
  ok('④ 折线表三个端点与实测零容差相等', pts.every(([t, v], i) => fireLight(t) === FIRE_COUPLING_TABLE[i][1] && FIRE_COUPLING_TABLE[i][0] === t),
    FIRE_COUPLING_TABLE.map(([t, v]) => `${t}→${v}`).join(', '));
  ok('④ 表结构没被外部改写（Object.freeze 生效）', Object.isFrozen(FIRE_COUPLING_TABLE) && FIRE_COUPLING_TABLE.length === 3);
}

// ⑤ 单调性：火只减不增，烟只增不减
{
  let monoLight = true, monoSize = true, prevL = 1, prevS = 1;
  for (let t = 0; t <= 2; t += 0.01) {
    const L = fireLight(t), S = smokeSizeMul(t);
    if (L > prevL + 1e-9) monoLight = false;
    if (S < prevS - 1e-9) monoSize = false;
    prevL = L; prevS = S;
  }
  ok('⑤ 0–2s 火光单调不增', monoLight);
  ok('⑤ 0–2s 烟尺寸单调不减', monoSize, `末值 ${smokeSizeMul(2).toFixed(4)}`);
}

// ⑥ 表尾收尾：0.78s ≈ 6%（0.226 × e^{-0.39/0.30}），不是 0 也不是还在两成
{
  const L = fireLight(0.78);
  ok('⑥ 0.780s 火光 ≈0.06（表尾 e^{-t/0.30} 收尾）', L < 0.07 && L > 0.05, L.toFixed(4));
}

// ⑦ 非法输入要抛错，不许静默返回 NaN 把火画成 NaN 色
{
  const throws = (fn) => { try { fn(); return false; } catch (e) { return e instanceof RangeError; } };
  ok('⑦ t<0 / NaN 抛 RangeError', throws(() => fireLight(-1)) && throws(() => fireLight(NaN)) && throws(() => smokeSizeMul(NaN)));
}

// ⑧ 缓动：已有卡 0.4s 追上约 63%，且不越过目标
{
  const e1 = easeSizeMul(1, 1.494, 0.12);
  ok('⑧ easeTau 0.12s 处到 63% 差距', near((e1 - 1) / (1.494 - 1), 0.632, 0.02), e1.toFixed(4));
  let cur = 1;
  for (let i = 0; i < 200; i++) cur = easeSizeMul(cur, 1.494, 1 / 60);
  ok('⑧ 200 帧后收敛到目标且不超调', near(cur, 1.494, 0.002) && cur <= 1.494, cur.toFixed(4));
}

// ⑨ 上界口径：smokeGain = √2.30 − 1
{
  const ideal = Math.sqrt(2.3247) - 1;
  ok('⑨ smokeGain 与 √(面积比)−1 一致', near(FIRE_COUPLING.smokeGain, ideal, 0.01),
    `gain ${FIRE_COUPLING.smokeGain} vs ${ideal.toFixed(4)}`);
}

// ⑩ 爆燃团分层（第 91 轮）：不是柱脚一团球，而是沿高度三组
//    原片 0084 相对 0078 多出来的像素在柱身中上段也有（不只柱脚），所以 dy 必须铺开。
{
  const p = burstPlan();
  ok('⑩ 三组、共 16 张', p.layers.length === 3 && p.total === 16, `total ${p.total}`);
  ok('⑩ dy 从柱脚铺到 1.35 单位（≥1.2 才不是一团球）', p.yMin <= 0.15 && p.yMax >= 1.30 && (p.yMax - p.yMin) >= 1.2,
    `dy ${p.yMin}–${p.yMax}`);
  ok('⑩ 尺寸自上而下递减（柱脚最大）', p.sizeMax === 2.75 && p.sizeMin === 1.8, `${p.sizeMax}→${p.sizeMin}`);
  ok('⑩ 顶部那组升得更快（翻卷）', p.layers[2].riseMul > p.layers[1].riseMul && p.layers[1].riseMul > p.layers[0].riseMul,
    p.layers.map((l) => l.riseMul).join('<'));
}

// ⑪ 兼容第 90 轮的单层口径：没有 layers 时 burstPlan 退回 count/lift
{
  const p = burstPlan({ count: 18, sizeMul: 2.8, radius: 0.46, lift: 0.30, lifeMul: 0.55, riseMul: 0.65 });
  ok('⑪ 无 layers 时退回单层 18 张 / dy=lift', p.total === 18 && p.layers.length === 1 && p.yMax === 0.30 && p.sizeMax === 2.8,
    JSON.stringify({ total: p.total, yMax: p.yMax }));
  const z = burstPlan({ layers: [{ name: 'off', count: 0, dy: 0 }] });
  ok('⑪ count=0 的层不计入 total（可关掉这团烟）', z.total === 0, `total ${z.total}`);
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS (fire-coupling)');
process.exit(fail ? 1 : 0);
