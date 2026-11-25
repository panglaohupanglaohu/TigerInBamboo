// town-visual-referee.mjs — 1197909675443916803「饱和度纠偏/庭院草地/彩色反弹」裁判对照。
// 裁判=只读 townscaper-web/REACode：palette.js / courtyard.js / colorgamut.js 直接 import，
// townmesh.js STYLE 源码解析，lighting.js diffuseBounce 经 'three' 注册后 import。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REA = join(HERE, '..', '..', 'REACode');
const imp = (p) => import(pathToFileURL(p).href);

const F = await import('./fixtures/g2-build.mjs');          // 先注册 'three' → vendor
const { World, BUILD, PALETTES } = F;
const { TOWN_VISUAL, hexToHsv, inHsvEnvelope, wallPaletteAudit, styleAudit } = await import('../src/core/town-visual.js');
const { classifyCourtyards } = await import('../src/core/courtyards.js');
const { planCourtyardGrass, groundFinish } = await import('../src/build/courtyard-grass.js');
const { bakeLighting, diffuseAir } = await import('../src/light/bake.js');
const O = {
  palette: await imp(join(REA, 'src', 'palette.js')),
  courtyard: await imp(join(REA, 'src', 'courtyard.js')),
  gamut: await imp(join(REA, 'src', 'colorgamut.js')),
  lighting: await imp(join(REA, 'src', 'lighting.js')),
};
const hexRgb = (hex) => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 });

/* ================== a) 暖橙屋顶与多色墙（palette 侧参数） ================== */
{
  // ① BUILD 与裁判 townmesh.js STYLE 逐键比对（源码解析裁判常量，不照抄表）
  const src = fs.readFileSync(join(REA, 'src', 'townmesh.js'), 'utf8');
  const styleSrc = src.match(/export const STYLE = \{([\s\S]*?)\};/)[1];
  const STYLE = Object.fromEntries([...styleSrc.matchAll(/(\w+): '(#\w+)'/g)].map((m) => [m[1], m[2]]));
  const audit = styleAudit(BUILD, STYLE);
  assert.deepEqual(audit.diff, [], `BUILD 与裁判 STYLE 重叠键应逐字节相等，差异=${audit.diff}`);
  assert.deepEqual(audit.missing, ['curb'], `唯一缺的键应只是 curb，实得=${audit.missing}`);

  // ② 屋顶落在裁判色容体（colorgamut FEATURES.roof HSV）内；
  //    裁判自己的 STYLE.roof v=.878 也略超包络上限 .86，故 v 放 +0.03 容差如实记。
  const roofEnv = O.gamut.FEATURES.find((f) => f.key === 'roof');
  assert.deepEqual([TOWN_VISUAL.roofHsv.h, TOWN_VISUAL.roofHsv.s, TOWN_VISUAL.roofHsv.v], [roofEnv.h, roofEnv.s, roofEnv.v], '包络表与裁判一致');
  for (const key of ['roof', 'roofAlt']) {
    const [h, s, v] = hexToHsv(BUILD[key]);
    assert.ok(h >= roofEnv.h[0] && h <= roofEnv.h[1], `${key} 暖橙色相 ${h.toFixed(1)}∈[${roofEnv.h}]`);
    assert.ok(s >= roofEnv.s[0] && s <= roofEnv.s[1], `${key} 饱和 ${s.toFixed(3)}∈[${roofEnv.s}]`);
    assert.ok(v >= roofEnv.v[0] && v <= roofEnv.v[1] + 0.03, `${key} 明度 ${v.toFixed(3)}≈裁判上限+容差`);
    const chk = inHsvEnvelope(BUILD[key], TOWN_VISUAL.roofHsv);
    assert.ok(chk.ok || chk.misses.every((m) => m.startsWith('v=')), `${key} 包络内或仅 v 微超：${chk.misses}`);
  }
  // ③ 本仓两档橙顶与裁判取色最近色 Δh≤8°（#e07a52↔#e2703a、#d96f4a↔#b4644a/#c9693c）
  for (const key of ['roof', 'roofAlt']) {
    const h = hexToHsv(BUILD[key])[0];
    const d = Math.min(...TOWN_VISUAL.roofReferee.map((c) => Math.abs(hexToHsv(c)[0] - h)));
    assert.ok(d <= 8, `${key} 距裁判屋顶色最近 Δh=${d.toFixed(1)}°≤8°`);
  }
  // ④ 草地与小径色在裁判范围内
  const grassEnv = O.gamut.FEATURES.find((f) => f.key === 'grass');
  for (const key of ['lawn', 'lawnAlt']) {
    const chk = inHsvEnvelope(BUILD[key], { h: grassEnv.h, s: grassEnv.s, v: grassEnv.v });
    assert.ok(chk.ok, `${key} 在裁判草色容体：${JSON.stringify(chk)}`);
  }
  assert.equal(BUILD.path, '#a49c8a', '小径色=裁判 STYLE.path');
  assert.deepEqual(O.courtyard.YARD.grass, [86, 122, 102], '片内实测草色记录');
  assert.deepEqual(O.courtyard.YARD.path, [190, 162, 148], '片内实测小径色记录');
}

/* ================== b) 饱和度规则 ================== */
{
  // 裁判实测：vivid（纠偏后艳板）均饱和 vs stone（灰白米）
  const vividMean = O.palette.meanSaturation(O.palette.PALETTES.vivid);
  const stoneMean = O.palette.meanSaturation(O.palette.PALETTES.stone);
  assert.ok(Math.abs(vividMean - TOWN_VISUAL.wallSatReferee.vividMean) < 0.005, `裁判 vivid 均饱和 ${vividMean}`);
  assert.ok(Math.abs(stoneMean - TOWN_VISUAL.wallSatReferee.stoneMean) < 0.005, `裁判 stone 均饱和 ${stoneMean}`);
  // 纠偏方向 = 更艳：town 板均值 ≥2×stone 且与 vivid 均值差 ≤0.12
  const audit = wallPaletteAudit(PALETTES.town.colors);
  assert.ok(audit.ok, `town 墙板饱和度审计：mean=${audit.meanSat} min=${audit.minSat} vsVivid=${audit.vsVividMean} ×stone=${audit.vsStoneMean}`);
  assert.ok(audit.slots === 15 && audit.meanSat >= 0.37, '15 槽多色墙、明显高于灰板');
}

/* ================== c) 庭院草地判定 ================== */
{
  const mk = (side, inner) => {
    const C = Array.from({ length: side * side }, (_, id) => ({ id, n: 4 }));
    const w = new World({ cells: C, neighbors: [] });
    w.neighbor = (c, i) => { const x = c.id % side, y = (c.id / side) | 0, [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][i]; return x + dx >= 0 && x + dx < side && y + dy >= 0 && y + dy < side ? C[(y + dy) * side + x + dx] : null; };
    for (const c of C) w.fill(c, inner(c) ? 1 : 3);
    return { w, C };
  };
  const inner5 = (c) => { const x = c.id % 5, y = (c.id / 5) | 0; return x >= 1 && x <= 3 && y >= 1 && y <= 3; };

  // 封闭 → 全格长草；子区（矮墙分区）照长
  {
    const { w } = mk(5, inner5);
    const cy = classifyCourtyards(w);
    const plan = planCourtyardGrass(w, cy);
    assert.equal(plan.stats.grassCells, 9);
    assert.deepEqual([...plan.grass.keys()].filter((i) => plan.grass[i]).sort((a, b) => a - b), [6, 7, 8, 11, 12, 13, 16, 17, 18]);
    const low = [[12, 7], [12, 11], [12, 13], [12, 17]];
    const cy2 = classifyCourtyards(w, { lowWalls: low });
    const plan2 = planCourtyardGrass(w, cy2);
    assert.equal(plan2.stats.grassCells, 9, '矮墙子区照长草');
    assert.equal(plan2.components[0].subregionCount, 2);
    assert.ok(plan2.components[0].subregions.every((s) => s.every((id) => plan2.grass[id])), '每个子区格都有草');
    assert.equal(plan2.stats.lowWallEdges, 4);
  }

  // 开口 → 一格不铺（裁判：一个缺口就漏）
  {
    const { w } = mk(5, inner5);
    w.fill(w.cells[5], 1);                       // 周圈墙格 (0,1) 降成地面 → 街道把院连通到网格边
    const cy = classifyCourtyards(w);
    assert.ok(cy.openComponents.length >= 1);
    const plan = planCourtyardGrass(w, cy);
    assert.equal(plan.stats.grassCells, 0, '有开口的组件一格草都不铺');
    assert.ok(plan.stats.openCellsSkipped > 0);
  }

  // 小径在草上面：path 格仍计草（渲染先铺草再叠径）
  {
    const { w } = mk(5, inner5);
    const cy = classifyCourtyards(w);
    const path = new Uint8Array(25); path[12] = 1; path[7] = 1;
    const plan = planCourtyardGrass(w, cy, { path });
    assert.equal(plan.grass[12], 1, '小径格底色仍是草');
    assert.equal(plan.components[0].grassUnderPath, 2);
    assert.equal(groundFinish(1, true), 'grass+path');
    assert.equal(groundFinish(1, false), 'grass');
    assert.equal(groundFinish(0, true), 'paving');
  }

  // 确定性：同输入逐字节同输出
  {
    const { w } = mk(5, inner5);
    const cy = classifyCourtyards(w);
    const a = JSON.stringify(planCourtyardGrass(w, cy)), b = JSON.stringify(planCourtyardGrass(w, cy));
    assert.equal(a, b);
  }

  // 真实双网格：yardScene 圈院 → buildBuildings 的 grassPlan 与实际出格一致
  for (const kind of ['quad', 'mixed']) {
    const { yardScene } = await import('../src/build/scenes-r56.js');
    const w = F.world(kind, 'town', 7), S = yardScene(w, { depth: 4 });
    const pathHex = F.hexOf(BUILD.path), lawnHexes = [F.hexOf(BUILD.lawn), F.hexOf(BUILD.lawnAlt)];
    const { r, tris } = F.build(w, {}, { capture: [pathHex, ...lawnHexes] });
    assert.equal(r.grassPlan.stats.grassCells, S.yard.length, kind + ': 封闭组件全格计草');
    assert.ok(r.grassPlan.components[0].grassUnderPath > 0, kind + ': 有小径叠草格');
    // 渲染：小径格出暖灰 path 色叠面 + 草底（色按 writer 的 getHexString 回读）
    assert.ok(tris.some((t) => t.hex === pathHex), kind + ': 小径暖灰叠面已出');
    assert.ok(tris.some((t) => lawnHexes.includes(t.hex)), kind + ': 草地色已出');
  }
}

/* ================== d) 彩色反弹：多跳参数与裁判等价 ================== */
{
  // ① diffuseAir vs 裁判 diffuseBounce：同一合成场逐点一致
  const W = 12, H = 9, layers = 5, size = W * H;
  const occ = new Float32Array(size * layers), cr = new Float32Array(size * layers), cg = new Float32Array(size * layers), cb = new Float32Array(size * layers);
  // 一面红墙（第 2/3 层、x≈中间）+ 一片蓝色矮块
  for (let lv = 2; lv <= 3; lv++) for (let j = 2; j <= 6; j++) { const k = lv * size + j * W + 5; occ[k] = 0.9; cr[k] = 0.9; cg[k] = 0.25; cb[k] = 0.2; }
  for (let j = 6; j <= 8; j++) for (let i = 7; i <= 9; i++) { const k = 2 * size + j * W + i; occ[k] = 0.7; cr[k] = 0.2; cg[k] = 0.4; cb[k] = 0.9; }
  const spec = { W, H, layers, size, occ, cr, cg, cb, res: 0.08, minX: 0, minZ: 0, L: 0.5 };
  const ours = diffuseAir(spec, { passes: 3, gain: 0.9, stride: 3 });
  const refField = { W, H, L: layers, size, occ, cr, cg, cb, res: 0.08, minX: 0, minZ: 0, levelHeight: 0.5, voxels: 1 };
  O.lighting.diffuseBounce(refField, 3, 0.9, 3);
  assert.ok(refField.sampleAir && ours.sampleAir, '两边都出空气采样');
  let maxDiff = 0;
  for (let t = 0; t < 400; t++) {
    const x = (t % 20) * 0.045 + 0.01, z = ((t / 20) | 0) * 0.038 + 0.01, y = 0.3 + (t % 5) * 0.13;
    const a = ours.sampleAir(x, y, z), b = refField.sampleAir(x, y, z);
    for (let c = 0; c < 3; c++) maxDiff = Math.max(maxDiff, Math.abs(a[c] - b[c]));
  }
  assert.ok(maxDiff < 1e-12, `diffuseAir 与裁判 diffuseBounce 逐点最大差 ${maxDiff}`);
  // 空气色被红墙染色：红墙旁空气的 R 分量 > G
  const airNearRed = ours.sampleAir(5 * 0.08, 0.7, 4 * 0.08);
  assert.ok(airNearRed[0] > airNearRed[1], `红墙旁空气色偏红 ${airNearRed}`);

  // ② 空场 / 参数校验
  assert.equal(diffuseAir(null).sampleAir, null);
  assert.equal(diffuseAir(spec, { passes: 0 }).sampleAir, null);
  assert.throws(() => diffuseAir(spec, { stride: 0 }), RangeError);
  assert.throws(() => diffuseAir(spec, { gain: 0 }), RangeError);
}

/* ================== d2) bakeLighting 多跳：染色断言 + 确定性 + 兼容 ================== */
{
  const w = F.world('quad', 'town', 7);
  const { m } = F.build(w);
  const colOf = (c, lv) => { if (w.isRock(c, lv)) return { r: 0.62, g: 0.61, b: 0.6 }; if (lv === 1) return { r: 0.55, g: 0.56, b: 0.58 }; const k = w.color[c.id]; return k >= 0 ? hexRgb(w.palette.colors[k]) : { r: 0.94, g: 0.9, b: 0.83 }; };
  const base = m.col.slice(), pos = m.pos;
  const mk = () => ({ pos: pos.slice(), col: base.slice() });

  // 单跳（默认）与显式 bounces=1+bounce=.42 逐字节一致（兼容）
  const A = mk(), B = mk();
  bakeLighting(A, w, { L: 0.5, colorOf: colOf });
  bakeLighting(B, w, { L: 0.5, colorOf: colOf, bounces: 1, bounce: 0.42 });
  assert.deepEqual(A.col, B.col, '默认 = 单跳 0.42 老行为');

  // 多跳（裁判档默认 bounce .62/airGain .55）：颜色改变且被遮处普遍变亮（加法染色）
  const C = mk();
  const rC = bakeLighting(C, w, { L: 0.5, colorOf: colOf, bounces: 3 });
  let changed = 0, brighter = 0, tinted = 0;
  for (let i = 0; i < A.col.length; i += 3) {
    const dA = C.col[i] - A.col[i], dG = C.col[i + 1] - A.col[i + 1], dB = C.col[i + 2] - A.col[i + 2];
    const dd = Math.abs(dA) + Math.abs(dG) + Math.abs(dB);
    if (dd > 1e-9) {
      changed++;
      if (dA + dG + dB > 0) brighter++;
      const baseSum = A.col[i] + A.col[i + 1] + A.col[i + 2] + 1e-6;
      // 染色 ≠ 等比提亮：通道增益不一致即带色
      if (Math.abs(dA / baseSum - dG / baseSum) > 1e-4 || Math.abs(dG / baseSum - dB / baseSum) > 1e-4) tinted++;
    }
  }
  assert.ok(changed > 50, `多跳改动的顶点数 ${changed}`);
  assert.ok(brighter / changed > 0.5, `加法补光：变亮顶点占比 ${(brighter / changed).toFixed(2)}`);
  assert.ok(tinted / changed > 0.5, `彩色反弹：带色（非等比）占比 ${(tinted / changed).toFixed(2)}`);
  assert.ok(rC.diffuseMs >= 0 && rC.airGain === 0.55);

  // 显式参数覆盖：bounces=3 + airGain 0 时只走扩散色、不加空气补光
  const D = mk(), E = mk();
  bakeLighting(D, w, { L: 0.5, colorOf: colOf, bounces: 3, airGain: 0, bounce: 0.42 });
  bakeLighting(E, w, { L: 0.5, colorOf: colOf, bounces: 3, airGain: 0, bounce: 0.42 });
  assert.deepEqual(D.col, E.col, '确定性');
  // airGain>0 相对 airGain=0：只增不减（加法项）
  let neg = 0;
  for (let i = 0; i < C.col.length; i++) if (C.col[i] < D.col[i] - 1e-9) neg++;
  assert.equal(neg, 0, 'airGain 是加法项：相对关档无变暗通道');
  // 非法参数
  assert.throws(() => bakeLighting(mk(), w, { L: 0.5, colorOf: colOf, bounces: 0 }), RangeError);
  assert.throws(() => bakeLighting(mk(), w, { L: 0.5, colorOf: colOf, bounces: 1.5 }), RangeError);

  // keepField：多跳后 field.sampleAir 可用
  const fld = bakeLighting(mk(), w, { L: 0.5, colorOf: colOf, bounces: 3, keepField: true, res: 0.14 }).field;
  assert.equal(typeof fld.sampleAir, 'function', 'keepField 暴露 sampleAir');
  const air = fld.sampleAir(fld.minX + 3 * fld.res, 0.3, fld.minZ + 3 * fld.res);
  assert.ok(Array.isArray(air) && air.length === 3);
}

console.log('PASS town-visual referee：STYLE逐键相等、屋顶在裁判色容体、墙板饱和度审计、');
console.log('    封闭→全格草/矮墙子区照长/开口零草/径叠草上、diffuseAir≡裁判diffuseBounce、');
console.log('    多跳染色变亮带色、加法非负、确定性与兼容、RangeError');
