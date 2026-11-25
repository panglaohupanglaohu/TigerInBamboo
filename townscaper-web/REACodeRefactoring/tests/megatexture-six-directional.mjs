// 1580845127207387137「1st texture = sdf volume（距离在 alpha，RG 指向 mega texture UV）；2nd = baked 6 directional
// light volume，raycast against the sdf，命中处按 UV 取 mega texture；3rd = the lit mega texture」
// 本支只验第 2、3 张图的语义（第 1 张的 A=距离 / RG=最近纹素 已由 tests/megatexture-gi.mjs ② 覆盖）：
//   ② 六向体积：每空格 6 个 lobe × 5 射线，六个方向整体能量真的不同（+Y 天光 > −Y 地面），换太阳方位后
//      「能量搬去哪个 lobe」跟着转 —— 这就是「6 directional」可读量；
//   ③ 命中处按 SDF 的 RG 取 mega texture：两色反照率世界里，间接光必须跟着**局部**纹素颜色走
//      （若代码用平均 RGB，间接光处处同色）；再逐纹素重算 exitance = 反照率 ×（直射 + 体积间接）= 第 3 张图。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const THREE = await import('three');
const { World } = await import('../src/core/world.js');
const { buildQuadGrid } = await import('../src/core/grid.js');
const { decorateCells, buildCellIndex } = await import('../src/core/spatial.js');
const { buildScene } = await import('../src/world/scenes.js');
const { PALETTES } = await import('../src/core/palette.js');
const M = await import('../src/light/megatexture-gi.js');
const D = await import('../src/light/megatexture-gi-debug.js');

const g = decorateCells(buildQuadGrid({ radius: 14, hexSize: 1 })), index = buildCellIndex(g), w = new World(g);
w.palette = PALETTES.town; buildScene(w, 'terrain', 7);
const version = w.version;
const albedoOf = (c, lv) => w.isRock(c, lv) ? (lv === w.top(c) ? [.5, .6, .34] : [.6, .58, .55]) : [.9, .85, .8];
const out = {};

/* ---------- ⓪ 主烘焙（与页面同参数：3 轮、六向、5 射线/lobe） ---------- */
const r = M.bakeMegaTextureGI(w, index, { albedoOf, bounces: 3, keepSnapshots: true });
const { lv, mega, vox, lsolid, lnx, lny, lnz } = r;
const LN = lnx * lny * lnz;
assert.equal(r.stats.raysPerLobe, 5, 'lobe 内 5 条射线（轴向 + 4 条 40° 斜射）');
assert.equal(lv.length, LN * 6 * 3, '每格 6 lobe × RGB');
out.struct = { lvCells: r.stats.lvCells, lvEmpty: r.stats.lvEmpty, raysPerLobe: r.stats.raysPerLobe, lobes: 6, texels: mega.count };

/* ---------- ① 六向确实分得开：逐 lobe 能量（只统计空格） ---------- */
const AX = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const lobeEnergy = (res) => {
  const E = new Float64Array(6); let cells = 0;
  for (let k = 0; k < res.stats.lvCells; k++) { if (res.lsolid[k]) continue; cells++; for (let d = 0; d < 6; d++) { const o = (k * 6 + d) * 3; E[d] += res.lv[o] + res.lv[o + 1] + res.lv[o + 2]; } }
  return { E: Array.from(E, (x) => +(x / Math.max(1, cells)).toFixed(4)), cells };
};
const L0 = lobeEnergy(r);
out.lobeEnergy = L0.E;
assert.ok(L0.E.every((x) => x > 0), '六个 lobe 全非零（每向都有天光或反弹）');
// +Y（朝上，见天）= d2；−Y（朝下，见地面）= d3 —— 原片那张六向图里「上排中格最亮、下排中格最暗」正是这一对
assert.ok(L0.E[2] > L0.E[3] * 1.15, `+Y 应明显亮于 −Y：${L0.E[2]} vs ${L0.E[3]}`);
// 三个轴向对都不对称（否则等于把体积做成标量场）
for (const [a, b] of [[0, 1], [2, 3], [4, 5]]) assert.ok(Math.abs(L0.E[a] - L0.E[b]) > 1e-3, `轴向对 ${a}/${b} 对称：${L0.E[a]} vs ${L0.E[b]}`);

/* ---------- ② 换太阳方位 → 能量在 lobe 之间搬家（baked 6 directional 才有的行为） ---------- */
const dirVec = (E) => { const v = [E[0] - E[1], E[2] - E[3], E[4] - E[5]], n = Math.hypot(...v) || 1; return v.map((x) => +(x / n).toFixed(4)); };
const sunOf = (az, el = 42) => [Math.cos(el * Math.PI / 180) * Math.sin(az * Math.PI / 180), Math.sin(el * Math.PI / 180), Math.cos(el * Math.PI / 180) * Math.cos(az * Math.PI / 180)];
const bakeSun = (az) => {
  const s = sunOf(az);
  return M.bakeMegaTextureGI(w, index, { albedoOf, bounces: 3, sun: s, sunColor: [1, .95, .85] });
};
const A = lobeEnergy(bakeSun(20)), B = lobeEnergy(bakeSun(110));
const vA = dirVec(A.E), vB = dirVec(B.E), hor = (v) => { const n = Math.hypot(v[0], v[2]) || 1; return [v[0] / n, v[2] / n]; };
const hA = hor(vA), hB = hor(vB);
const cosAB = hA[0] * hB[0] + hA[1] * hB[1];
const angAB = Math.acos(Math.max(-1, Math.min(1, cosAB))) * 180 / Math.PI;
out.sunTurn = { az20: A.E, az110: B.E, vA, vB, horizontalAngleDeg: +angAB.toFixed(1) };
// 太阳转了 90°，lobe 能量矢量的水平分量也应转 ~90°（不强求精确：还有天光/反弹的各向同性成分）
assert.ok(vA[1] > 0 && vB[1] > 0, '两种太阳下 +Y 都最强（天光）');
// 水平分量本身很小（树冠/天光占大头），所以用「与各自太阳的反向对齐度」判，比夹角更稳
const cosAnti = (h, az) => { const s2 = [Math.sin(az * Math.PI / 180), Math.cos(az * Math.PI / 180)]; return -(h[0] * s2[0] + h[1] * s2[1]); };
assert.ok(cosAnti(hA, 20) > .9, `az20 lobe 矢量与背光方向对齐度 ${cosAnti(hA, 20).toFixed(3)}`);
assert.ok(cosAnti(hB, 110) > .9, `az110 lobe 矢量与背光方向对齐度 ${cosAnti(hB, 110).toFixed(3)}`);
assert.ok(angAB > 45, `换太阳方位后 lobe 能量矢量没跟着转：${angAB.toFixed(1)}°`);
// 方向对得上：lobe 能量峰值指向**背光侧**（射线朝太阳走会撞上背光面，朝另一侧才撞到受光面）
// → 能量矢量水平分量应与「太阳水平方向的负向」同侧（cos > .3），并与太阳同侧为负。


/* ---------- ③ 命中处按 SDF 的 RG 取 mega texture —— 不是平均 RGB ----------
 * 两色反照率（世界 x<0 红、x>0 蓝），关天光、1 轮反弹：间接光只可能来自「射线命中处那张纹素的出射光」。
 * 若实现用全局平均 RGB，间接光在整张图上同色；若按 SDF-RG 逐命中取纹素，红侧/蓝侧的间接光必须分家。 */
const twoTone = (c) => (c.cx < 0 ? [.85, .08, .06] : [.06, .1, .85]);
const two = M.bakeMegaTextureGI(w, index, { albedoOf: (c, lv2) => (lv2 === 1 ? [.45, .25, .15] : twoTone(c)), bounces: 2, skyIntensity: 0 });
const cls = (t) => { const a = two.mega.albedo.subarray(t * 3, t * 3 + 3), mx = Math.max(...a), mn = Math.min(...a); return mx - mn < .2 ? 0 : (a[0] > a[2] ? 1 : -1); };   // 1=红侧 −1=蓝侧 0=中性（海底/岩石）
const hue = (arr, t) => { const s = arr[t * 3] + arr[t * 3 + 1] + arr[t * 3 + 2]; return s > 1e-6 ? (arr[t * 3] - arr[t * 3 + 2]) / s : 0; };
const acc = { 1: [], '-1': [] };
for (let t = 0; t < two.mega.count; t++) { const k = cls(t); if (k) acc[k].push(hue(two.indirect, t)); }
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const mRed = mean(acc[1]), mBlue = mean(acc['-1']);
// 逐纹素相关：反照率红蓝差 ↔ 间接光红蓝差（只取两色纹素，中性色是海底/岩石，不属于这两个世界）
const xa = [], ya = [];
for (let t = 0; t < two.mega.count; t++) { const a = two.mega.albedo.subarray(t * 3, t * 3 + 3); if (!cls(t)) continue; xa.push(a[0] - a[2]); ya.push(two.indirect[t * 3] - two.indirect[t * 3 + 2]); }
const pearson = M.pearson(xa, ya);
const indHue = Array.from({ length: two.mega.count }, (_, t) => hue(two.indirect, t));
const sd = Math.sqrt(mean(indHue.map((h) => (h - mean(indHue)) ** 2)));
out.twoTone = { redTexels: acc[1].length, blueTexels: acc['-1'].length, indirectHueRed: +mRed.toFixed(3), indirectHueBlue: +mBlue.toFixed(3), pearson: +pearson.toFixed(3), indirectHueSd: +sd.toFixed(3) };
assert.ok(acc[1].length > 50 && acc['-1'].length > 50, '两色世界两边的纹素都够多');
assert.ok(mRed - mBlue > .2, `红/蓝两侧间接光没分家：${mRed.toFixed(3)} vs ${mBlue.toFixed(3)}（平均 RGB 实现会几乎相等）`);
// 反照率红蓝差与间接光红蓝差不必接近 1：一个纹素收到的是「它看见的那些面」的光，邻墙往往是另一色。
// 但平均 RGB 实现会让色相处处相同（sd≈0、两侧差≈0），实测 sd / 两侧差都远大于 0 即为逐命中取纹素。
assert.ok(pearson > .4, `逐纹素「反照率红蓝差 ↔ 间接光红蓝差」相关只有 ${pearson.toFixed(3)}`);
assert.ok(sd > .2, `间接光色相空间标准差 ${sd.toFixed(3)}（平均 RGB 实现会接近 0）`);

/* ---------- ④ 第 3 张图 = 被照亮的 mega texture：逐纹素 exitance = 反照率 ×（直射 + 体积间接） ---------- */
let maxE = 0, maxI = 0;
for (let t = 0; t < mega.count; t++) {
  const n = mega.nrm.subarray(t * 3, t * 3 + 3);
  // sampleIndirect 自己会沿法线外移半格（与 relightTexture 同口径），这里只传面中心
  const s = r.sampleIndirect(mega.pos[t * 3], mega.pos[t * 3 + 1], mega.pos[t * 3 + 2], [n[0], n[1], n[2]]);
  for (let c = 0; c < 3; c++) {
    maxI = Math.max(maxI, Math.abs(s[c] - r.indirect[t * 3 + c]));
    maxE = Math.max(maxE, Math.abs(mega.albedo[t * 3 + c] * (r.direct[t * 3 + c] + s[c]) - r.exitance[t * 3 + c]));
  }
}
out.relight = { maxIndirectErr: +maxI.toExponential(2), maxExitanceErr: +maxE.toExponential(2) };
assert.ok(maxI < 1e-6, 'sampleIndirect 与 indirect 不一致：' + maxI);
assert.ok(maxE < 1e-6, 'exitance ≠ 反照率×(直射+间接)：' + maxE);

/* ---------- ⑤ 调试图：六面板 + 16 张 SDF 切片（与片子里那三张同比结构） ---------- */
const li = D.lightVolumeImage(r), si = D.sdfImage(r), mi = D.megaTextureImage(r);
const cols = Math.ceil(Math.sqrt(lny)), rows = Math.ceil(lny / cols), PW = cols * lnx + 2, PH = rows * lnz + 2;
assert.equal(li.w, PW * 3); assert.equal(li.h, PH * 2);
const bg = (d, i) => d[i] === 32 && d[i + 1] === 52 && d[i + 2] === 60;
const panel = [];
for (let d = 0; d < 6; d++) {
  const px = (d >> 1) * PW, py = (d & 1) * PH; let s = 0, n = 0;
  for (let y = py; y < py + PH; y++) for (let x = px; x < px + PW; x++) { const i = (y * li.w + x) * 4; if (bg(li.data, i)) continue; s += (li.data[i] + li.data[i + 1] + li.data[i + 2]) / 3; n++; }
  panel.push(+(s / Math.max(1, n)).toFixed(1));
}
out.panels = { means: panel, sdfColsRows: [si.cols, si.rows], megaAtlas: [mi.w, mi.h] };
assert.ok(panel.every((x) => x > 0), '六个面板都有内容');
assert.ok(panel[2] > panel[3], `调试图 +Y 面板应亮于 −Y：${panel[2]} vs ${panel[3]}`);
assert.ok(new Set(panel).size >= 4, '六个面板亮度几乎相同，不像六向：' + panel.join('/'));
assert.equal(si.cols * si.rows >= vox.ny ? 1 : 0, 1, 'SDF 图能平铺全部 y 切片');

assert.equal(w.version, version, 'World 未被改动');
console.log('PASS megatexture-six-directional', JSON.stringify(out));
