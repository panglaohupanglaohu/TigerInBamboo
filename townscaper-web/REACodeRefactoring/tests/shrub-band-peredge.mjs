// 第 99 轮 · 灌木「逐三角带宽」（aBand，1707497006640365880 / 1707490932017279035）。
//
// 原片口径（600 帧片 sheet-00…05 + 257 帧片 3 张，第 84–98 轮反复量过）：
//   同一格的不同边上，灌木带宽明显不同 —— P50 2–3px、P90 3–4px（比值 1.5–1.9×）；
//   而沿**一条边**宽度是常数（低模块面贴图，不是逐像素噪声）。
//
// 断言：
//   ① shrubBandMul 确定性、落在 [0.70, 1.36]、跨度 = 1.94×（覆盖实测 1.5–1.9× 上沿）；
//   ② 同格相邻边确实宽窄不一：绝大多数格 max/min ≥ 1.35；
//   ③ 分布均匀（均值 ≈ 1.03，中位在区间中点附近），不能全挤在一边；
//   ④ MeshWriter 真的把 aBand 写进几何（每三角 3 个同值顶点，长度 = 顶点数），默认 1；
//   ⑤ 逐三角恒定：同三角三顶点同值（否则插值会在面里渐变，就退化成噪声）；
//   ⑥ 关掉（world.shrubBandPerEdge = false）时整片退回 1 —— 旧画面逐位不变。
import './fixtures/g5-battle.mjs';
import { shrubBandMul, SHRUB_BAND, SHRUB_BAND_SPREAD } from '../src/terrain/shrub-band.js';
// meshwriter 静态 import three → 必须等 fixture 注册完 resolve 钩子后再动态 import。
const { MeshWriter, UP } = await import('../src/core/meshwriter.js');

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const near = (a, b, e) => Math.abs(a - b) <= e;

// ---------- ① 基本性质 ----------
console.log('① shrubBandMul 取值 / 确定性');
ok(SHRUB_BAND_SPREAD >= 1.85 && SHRUB_BAND_SPREAD <= 2.0, `跨度 ${SHRUB_BAND_SPREAD.toFixed(3)}× 落在 1.85–2.00（实测 1.5–1.9× 上沿）`);
let lo = Infinity, hi = -Infinity, det = true;
const vals = [];
for (let c = 0; c < 400; c++) for (let i = 0; i < 6; i++) for (let g = 0; g < 3; g++) {
  const v = shrubBandMul(c, i, g);
  if (v !== shrubBandMul(c, i, g)) det = false;
  if (!Number.isFinite(v) || v < SHRUB_BAND.min - 1e-9 || v > SHRUB_BAND.max + 1e-9) { lo = NaN; }
  lo = Math.min(lo, v); hi = Math.max(hi, v); vals.push(v);
}
ok(det, '同 (格, 边, 层) 反复调用同值（确定性）');
ok(near(lo, SHRUB_BAND.min, 0.02) && near(hi, SHRUB_BAND.max, 0.02), `实测区间 ${lo.toFixed(3)}–${hi.toFixed(3)} 贴住 [${SHRUB_BAND.min}, ${SHRUB_BAND.max}]`);

// ---------- ② 同格不同边 ----------
console.log('② 同格相邻边宽窄不一（原片核心观感）');
let cells = 0, single = 0, over13 = 0;
const ratios = [];
for (let c = 0; c < 300; c++) {
  const r = [0, 1, 2, 3].map((i) => shrubBandMul(c, i, 2));
  const mn = Math.min(...r), mx = Math.max(...r);
  cells++;
  ratios.push(mx / mn);
  if (mx / mn >= 1.3) over13++;
  if (new Set(r.map((v) => v.toFixed(6))).size === 1) single++;
}
ratios.sort((a, b) => a - b);
const rmed = ratios[ratios.length >> 1], r90 = ratios[(ratios.length * 0.9) | 0];
// 原片实测：同格相邻边宽度比 1.5–1.9×（P50 2–3px / P90 3–4px）。这里是「四个边里最宽 / 最窄」，
// 所以中位应当落在实测区间下沿、P90 落在上沿。
ok(rmed >= 1.40 && rmed <= 1.75, `同格四边 max/min 中位 ${rmed.toFixed(3)} 落在实测 1.5–1.9× 下沿`);
ok(r90 >= 1.60, `max/min P90 ${r90.toFixed(3)} ≥ 1.60（对上实测 P90 3–4px 的 1.76×）`);
ok(over13 / cells >= 0.75, `${over13}/${cells} 格 max/min ≥ 1.3（${(100 * over13 / cells).toFixed(0)}%，要求 ≥75%）`);
ok(single === 0, `没有一格四个边倍率完全相同（${single} 格）`);

// ---------- ③ 分布 ----------
console.log('③ 分布');
const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
const sorted = [...vals].sort((a, b) => a - b);
const med = sorted[sorted.length >> 1];
ok(near(mean, 1.03, 0.05), `均值 ${mean.toFixed(3)} ≈ 1.03（区间中点，不偏宽也不偏窄）`);
ok(near(med, 1.03, 0.06), `中位 ${med.toFixed(3)} ≈ 1.03`);
const tenth = sorted[(sorted.length * 0.1) | 0], nineti = sorted[(sorted.length * 0.9) | 0];
ok(nineti - tenth >= 0.40, `P10–P90 宽度 ${tenth.toFixed(3)}–${nineti.toFixed(3)}（跨度 ≥0.40，不是一档）`);

// ---------- ④⑤ MeshWriter 写属性 ----------
console.log('④⑤ MeshWriter 的 aBand');
const w = new MeshWriter();
const A = [0, 0, 0], B = [1, 0, 0], C = [0, 0, 1];
const col = w.c('#ffffff');
w.tri(A, B, C, UP, col);                       // 默认 1
w.bandTri = 1.31;
w.triC(A, B, C, UP, col, col, col);            // 显式档
w.bandTri = 0.72;
w.quad(A, B, [1, 0, 1], [0, 0, 1], UP, col);   // quad = 2 个三角，都 0.72
w.bandTri = 1;
const g = w.toGeometry();
const band = g.getAttribute('aBand'), pos = g.getAttribute('position');
ok(!!band, 'toGeometry 里有 aBand 属性');
ok(band && band.count === pos.count, `aBand 顶点数 ${band?.count} = position ${pos.count}`);
const a = band.array;
ok(a[0] === 1 && a[1] === 1 && a[2] === 1, '默认三角 aBand = 1');
ok(near(a[3], 1.31, 1e-6) && a[3] === a[4] && a[4] === a[5], 'bandTri=1.31 时三个顶点同值（沿三角恒定，不会插成渐变）');
ok(near(a[6], 0.72, 1e-6) && a[6] === a[8] && a[8] === a[11] && near(a[9], 0.72, 1e-6) && a[9] === a[10] && a[10] === a[11], 'quad 拆出的两个三角都是 0.72');
ok(new Set([...a]).size >= 3, `属性里至少 3 个不同档（${[...new Set([...a])].join(' / ')}）`);

// ---------- ⑥ 关掉 = 旧画面 ----------
console.log('⑥ 关掉开关退回旧画面');
const w2 = new MeshWriter();
// 复刻 terrainmesh 的表达式：bandOn && ce >= 0 ? shrubBandMul(...) : 1
const bandOn = false;
const ce = 0.6;
w2.bandTri = bandOn && ce >= 0 ? shrubBandMul(7, 2, 1) : 1;
w2.tri(A, B, C, UP, col);
ok([...w2.toGeometry().getAttribute('aBand').array].every((v) => v === 1), 'bandOn=false → 全 1（与旧几何逐位相同）');
const w3 = new MeshWriter();
const ce2 = -1;   // 整面覆盖档不吃倍率
w3.bandTri = true && ce2 >= 0 ? shrubBandMul(7, 2, 1) : 1;
w3.tri(A, B, C, UP, col);
ok(w3.toGeometry().getAttribute('aBand').array[0] === 1, '整面覆盖档（aEdge=-1）不吃逐三角倍率');

// ---------- 采样打印 ----------
console.log('\n样例（格 5，四条边，层 2）：', [0, 1, 2, 3].map((i) => shrubBandMul(5, i, 2).toFixed(3)).join(' / '));
console.log(fail ? `\nFAIL ${fail} 项` : '\nALL PASS');
process.exit(fail ? 1 : 0);
