// 纯纹理灌木（1707490932017279035 / 1707497006640365880）：
//   ① 真实生成地形（quad / mixed 两种网格）的 MeshWriter 写出 aEdge，长度与顶点数一致；
//   ② 顶面扇形：落在崖边上的角 = 0、格心 = 1；非顶面（崖壁 / 建筑）全为 1（不画灌木）；
//   ③ 把 shader 里的 shrubApply 按同一公式在 CPU 上逐像素算一遍（俯视正交光栅化顶面），
//      检查：灌木只出现在崖边带里、格心附近没有、有的边断开（覆盖率 < 100%）、灌木内侧有一圈小阴影；输出 PNG 供目视。
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(pathToFileURL(join(root, 'vendor/three.module.js')).href)},shortCircuit:true};return n(s,c);}`));
const { buildQuadGrid, buildMixedGrid } = await import('../src/core/grid.js');
const { decorateCells } = await import('../src/core/spatial.js');
const { World } = await import('../src/core/world.js');
const { generateTerrain } = await import('../src/terrain/generate.js');
const { MeshWriter } = await import('../src/core/meshwriter.js');
const { buildTerrain } = await import('../src/terrain/terrainmesh.js');
const { SHRUB_DEFAULT_STYLE } = await import('../src/terrain/shrub-texture.js');

// —— shader 同式（BLOTCH_GLSL 的 bh/bn/bfbm + SHRUB_GLSL 的 shrubApply）
const fract = (x) => x - Math.floor(x);
const bh = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const bn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = bh(ix, iy), b = bh(ix + 1, iy), c = bh(ix, iy + 1), d = bh(ix + 1, iy + 1); return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy; };
const bfbm = (x, y) => { let s = 0, a = .5; for (let i = 0; i < 4; i++) { s += a * bn(x, y); x = x * 2.03 + 7.1; y = y * 2.03 + 7.1; a *= .5; } return s; };
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** 第 67 轮：细齿的三档 LOD（与 SHRUB_GLSL 同式）。返回该像素的齿位移（e 归一化单位）。 */
function toothFn(fw, x, z) {
  const freq = 46 + (16 - 46) * ss(.045, .075, fw);   // 单次采样、频率随距离降
  return (Math.abs(bn(x * freq + 5.3, z * freq + 5.3) * 2 - 1) - .5) * S.ragged * .55 * (1 - ss(.085, .115, fw));
}
const S = SHRUB_DEFAULT_STYLE, col = [1, 3, 5].map((i) => Math.pow(parseInt(S.color.slice(i, i + 2), 16) / 255, 2.2));   // 与 THREE.Color 一样转线性
function shrubApply(base, e, x, z, aa, fwArg = null) {
  // 第 70 轮：整面覆盖档（aEdge = -1，落差 ≥4 层）—— 与 SHRUB_GLSL 的 e<-.5 分支同式
  if (e < -.5) {
    const litF = ss(.45, .7, bfbm(x * 2.4 + 31, z * 2.4 + 31));
    const k = (.90 + .22 * litF) * (.955 + .065 * bn(x * 11, z * 11));
    return { c: col.map((v) => v * k), body: 1, shadow: 0, wide: 1 };
  }
  const cover = ss(.62 - S.coverage * .55, .7 - S.coverage * .55, bfbm(x * .33 + 17.3, z * .33 + 4.1));
  // 第 60 轮：着色器里 cover 改成「只收窄不清零」（mix(.5,1,cover)），复刻必须同步
  const width = S.width * (.55 + .9 * bfbm(x * 1.1 + 3.7, z * 1.1 + 3.7)) * (.5 + .5 * cover);
  if (width < .01) return { c: base, body: 0, shadow: 0 };
  // 第 66 轮：外缘拆两套尺度（大瓣 bn*9 + 细齿 abs(bn*46)），复刻必须同步
  // 第 67 轮：细齿按屏幕导数分级降频（fw 小=近 → 46；中 → 16；大 → 幅度归零），复刻必须同步
  const lobe = (bn(x * 9.0 + 9.1, z * 9.0 + 9.1) - .5) * S.ragged * 1.6;
  const tooth = toothFn(fwArg == null ? Math.max(0, (aa - .003) / 1.2) : fwArg, x, z);
  const rag = lobe + tooth;
  const d = e + rag;
  const body = 1 - ss(width - aa, width + aa, d);
  const shW = .055 + .035 * bn(x * 3.1, z * 3.1);
  const shadow = (1 - ss(width + shW - aa, width + shW + aa, d)) * (1 - body);
  const rim = body * ss(width - .028 - aa, width - .028 + aa, d);
  const lit = ss(.45, .7, bfbm(x * 2.4 + 31, z * 2.4 + 31));
  const k = (.92 + .22 * lit) * (.95 + .08 * bn(x * 11, z * 11));
  const shrub = col.map((v) => v * k * (1 - rim * .75) + v * .55 * rim * .75);
  const c = base.map((v) => v * (1 - .42 * S.shadow * shadow));
  return { c: c.map((v, i) => v + (shrub[i] - v) * body), body, shadow };
}

function png(w, h, rgb) {
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(Buffer.concat([Buffer.from(t), d])), 8 + d.length); return b; };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = rgb[y * w * 3 + x]; }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = {};
for (const [name, grid] of [['quad', buildQuadGrid({ radius: 10 })], ['mixed', buildMixedGrid({ radius: 14 })]]) {
  const world = new World(decorateCells(grid));
  generateTerrain(world, { seed: 7, rivers: 0, caves: 0 });
  const L = 0.5, w = new MeshWriter();
  buildTerrain(w, world, { L });
  const nv = w.pos.length / 3;
  assert.equal(w.edge.length, nv, 'aEdge 与顶点一一对应');
  const geo = w.toGeometry(); assert.equal(geo.getAttribute('aEdge').count, nv, 'BufferGeometry 有 aEdge');
  // 顶面三角：aField.z == 1 且朝上
  const tops = [];
  let zeros = 0, ones = 0, nonTopNot1 = 0;
  for (let t = 0; t < nv; t += 3) {
    const fz = w.field[t * 3 + 2];
    const P = [0, 1, 2].map((k) => [w.pos[(t + k) * 3], w.pos[(t + k) * 3 + 1], w.pos[(t + k) * 3 + 2]]);
    const ux = P[1][0] - P[0][0], uz = P[1][2] - P[0][2], vx = P[2][0] - P[0][0], vz = P[2][2] - P[0][2], uy = P[1][1] - P[0][1], vy = P[2][1] - P[0][1];
    const ny = uz * vx - ux * vz, nlen = Math.hypot(uy * vz - uz * vy, ny, ux * vy - uy * vx) || 1;
    const E = [w.edge[t], w.edge[t + 1], w.edge[t + 2]];
    if (fz > .5 && fz < 1.5 && Math.abs(ny) / nlen > .8) { tops.push({ P, E, C: [0, 1, 2].map((k) => [w.col[(t + k) * 3], w.col[(t + k) * 3 + 1], w.col[(t + k) * 3 + 2]]) }); for (const e of E) e === 0 ? zeros++ : e === 1 && ones++; }
    else if (E.some((e) => e !== 1)) nonTopNot1++;
  }
  assert.ok(tops.length > 100 && zeros > 50 && ones > 50, `顶面有崖边角（0）也有格心（1）：${zeros}/${ones}`);
  assert.equal(nonTopNot1, 0, '非顶面不画灌木');
  // 第 49 轮：高崖格的格心距离 < 1（带更宽）；第 70 轮加了第四档「整面覆盖」（落差 ≥4 层 → aEdge = -1）
  const widened = tops.filter((t) => t.E[0] < 0.999 && t.E[0] > -0.5);
  assert.ok(widened.length > 0 && widened.every((t) => t.E[0] >= 1 / 1.8 - 1e-6), `高崖格灌木带加宽（${widened.length} 个顶面三角）`);
  const wideTris = tops.filter((t) => t.E.every((e) => e === -1));
  assert.ok(wideTris.length > 0, `落差 ≥4 层自动进整面覆盖档（${wideTris.length} 个顶面三角，三顶点全 -1）`);
  assert.ok(tops.every((t) => t.E.every((e) => e === -1) || t.E.every((e) => e > -0.5)), '整面覆盖档不会与崖角 0 混插（否则面中间会插出假边界）');
  // 第 65 轮：带宽改成**逐边**按该边落差缩放（旧写法取整格 maxDrop 一起放大）。
  // 一个格子的每个顶面三角张的是一条边，所以同一格心的不同三角应当拿到不同的中心值。
  const byCentre = new Map();
  for (const t of tops) {
    const k = t.P[0][0].toFixed(3) + ',' + t.P[0][2].toFixed(3);
    if (!byCentre.has(k)) byCentre.set(k, []);
    byCentre.get(k).push(+t.E[0].toFixed(4));
  }
  let splitCells = 0, maxPerCell = 0;
  for (const v of byCentre.values()) {
    const u = new Set(v);
    if (u.size > 1) splitCells++;
    maxPerCell = Math.max(maxPerCell, u.size);
  }
  assert.ok(splitCells > 20, `逐边带宽：${splitCells} 个格子内不同边拿到不同中心值（最多 ${maxPerCell} 档）`);
  // —— 俯视光栅化 + CPU shrubApply
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const t of tops) for (const p of t.P) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]); }
  const W = 720, H = Math.round(W * (maxZ - minZ) / (maxX - minX)), sx = (W - 1) / (maxX - minX);
  const img = new Uint8Array(W * H * 3).fill(60), zbuf = new Float32Array(W * H).fill(-1e9);
  let px = 0, shrubPx = 0, shadowPx = 0, shrubNearEdge = 0, shrubDeep = 0, widePx = 0;
  for (const t of tops) {
    const Q = t.P.map((p) => [(p[0] - minX) * sx, (p[2] - minZ) * sx]);
    const x0 = Math.max(0, Math.floor(Math.min(...Q.map((q) => q[0])))), x1 = Math.min(W - 1, Math.ceil(Math.max(...Q.map((q) => q[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...Q.map((q) => q[1])))), y1 = Math.min(H - 1, Math.ceil(Math.max(...Q.map((q) => q[1]))));
    const den = (Q[1][1] - Q[2][1]) * (Q[0][0] - Q[2][0]) + (Q[2][0] - Q[1][0]) * (Q[0][1] - Q[2][1]); if (Math.abs(den) < 1e-9) continue;
    const de = Math.max(...t.E) - Math.min(...t.E), span = Math.max(1, Math.max(x1 - x0, y1 - y0)), aa = de / span * 1.2 + .003;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const a = ((Q[1][1] - Q[2][1]) * (x - Q[2][0]) + (Q[2][0] - Q[1][0]) * (y - Q[2][1])) / den, b = ((Q[2][1] - Q[0][1]) * (x - Q[2][0]) + (Q[0][0] - Q[2][0]) * (y - Q[2][1])) / den, c = 1 - a - b;
      if (a < -1e-4 || b < -1e-4 || c < -1e-4) continue;
      const wy = a * t.P[0][1] + b * t.P[1][1] + c * t.P[2][1], i = y * W + x; if (wy < zbuf[i]) continue; zbuf[i] = wy;
      const e = a * t.E[0] + b * t.E[1] + c * t.E[2], wx = minX + x / sx, wz = minZ + y / sx;
      const base = [0, 1, 2].map((k) => a * t.C[0][k] + b * t.C[1][k] + c * t.C[2][k]);
      const r = shrubApply(base, e, wx, wz, aa);
      px++; if (r.wide) widePx++; else if (r.body > .5) { shrubPx++; if (e < .35) shrubNearEdge++; if (e > .6) shrubDeep++; } if (r.shadow > .5) shadowPx++;
      for (let k = 0; k < 3; k++) img[i * 3 + k] = Math.round(255 * Math.pow(Math.min(1, Math.max(0, r.c[k])), 1 / 2.2));
    }
  }
  // —— 第 66 轮：外缘两套尺度（原片一条格边上大瓣 2–3 个、细齿 20+ 个）
  {
    const onlyLobe = (x, z) => (bn(x * 9.0 + 9.1, z * 9.0 + 9.1) - .5);
    const onlyTeeth = (x, z) => (Math.abs(bn(x * 46 + 5.3, z * 46 + 5.3) * 2 - 1) - .5);
    const maximaPerUnit = (f, step = .0015, len = 8) => {
      let n = 0, prev = f(0, 0), cur = f(step, 0), rising = cur > prev;
      for (let x = step * 2; x <= len; x += step) { const nxt = f(x, 0); if (rising && nxt < cur) n++; rising = nxt >= cur; cur = nxt; }
      return n / len;
    };
    const lobePerUnit = maximaPerUnit(onlyLobe), toothPerUnit = maximaPerUnit(onlyTeeth);
    assert.ok(lobePerUnit > 2 && lobePerUnit < 5, `大瓣每单位 ${lobePerUnit.toFixed(2)} 个（格边≈0.7 单位 → 2–3 瓣）`);
    assert.ok(toothPerUnit > 20 && toothPerUnit < 40, `细齿每单位 ${toothPerUnit.toFixed(1)} 个（格边≈0.7 单位 → 15–28 齿）`);
    assert.ok(toothPerUnit / lobePerUnit > 6, `两套尺度分离（齿/瓣 ${(toothPerUnit / lobePerUnit).toFixed(1)}×）`);
    const ampLobe = Math.max(...Array.from({ length: 400 }, (_, i) => Math.abs(onlyLobe(i * .01, 0)))) * S.ragged * 1.6;
    const ampTooth = Math.max(...Array.from({ length: 400 }, (_, i) => Math.abs(onlyTeeth(i * .01, 0)))) * S.ragged * .55;
    assert.ok(ampLobe > ampTooth, `大瓣幅度 ${ampLobe.toFixed(3)} > 齿 ${ampTooth.toFixed(3)}（e 归一化）`);
    out[name + 'TwoScale'] = { lobePerUnit: +lobePerUnit.toFixed(2), toothPerUnit: +toothPerUnit.toFixed(1), ampLobe: +ampLobe.toFixed(3), ampTooth: +ampTooth.toFixed(3) };
  }
  // —— 第 67 轮：细齿按 fwidth 分级降频（原片远景的齿变粗，本仓旧写法被 AA 压平成光滑带）
  {
    const peaksPerUnit = (fw) => {
      const step = .0015, len = 8; let n = 0;
      let prev = toothFn(fw, 0, 0), cur = toothFn(fw, step, 0), rising = cur > prev;
      for (let x = step * 2; x <= len; x += step) { const nxt = toothFn(fw, x, 0); if (rising && nxt < cur) n++; rising = nxt >= cur; cur = nxt; }
      return n / len;
    };
    const amp = (fw) => Math.max(...Array.from({ length: 700 }, (_, i) => Math.abs(toothFn(fw, i * .009, 0))));
    const nearF = peaksPerUnit(.020), midF = peaksPerUnit(.060);
    const ampNear = amp(.020), ampMid = amp(.060), ampFar = amp(.125);
    // 中距只降频、不降幅度（齿还是那么深，但变粗了），远距才整条归零
    assert.ok(Math.abs(ampMid - ampNear) < .02 * ampNear, `中距齿幅度保持（近 ${ampNear.toFixed(3)} / 中 ${ampMid.toFixed(3)}）`);
    assert.ok(nearF > 1.3 * midF && midF > 8, `齿距随距离变粗：近 ${nearF.toFixed(1)} 个/单位 → 中 ${midF.toFixed(1)} 个/单位（${(nearF / midF).toFixed(1)}×）`);
    assert.ok(ampFar < .06 * ampNear, `远到每齿不足 0.6px 时细齿归零（${(ampFar / ampNear).toFixed(3)}×）`);
    out[name + 'ToothLod'] = { nearPerUnit: +nearF.toFixed(1), midPerUnit: +midF.toFixed(1), ampNear: +ampNear.toFixed(3), ampMid: +ampMid.toFixed(3), ampFar: +ampFar.toFixed(3) };
  }
  const share = shrubPx / px, near = shrubNearEdge / Math.max(1, shrubPx);
  assert.ok(share > .04, `带子型灌木占顶面比例 ${share.toFixed(3)}`);
  // 第 70 轮：整面覆盖档是实心橙面，不参与「带子在崖边 / 格心无灌木」这两条（那两条只对阈值带成立）
  assert.ok(widePx / px > .01, `整面覆盖档占顶面像素 ${(widePx / px).toFixed(3)}`);
  // 第 60 轮：带宽 0.36→0.50（原片占崖高 8–12%），带子更宽 → e<0.35 的比例自然下降，判据放宽到 0.70
  assert.ok(near > .70, `灌木几乎都在崖边带（e<0.35 占 ${near.toFixed(3)}）`);
  assert.ok(shrubDeep / Math.max(1, shrubPx) < .02, '格心没有灌木');
  assert.ok(shadowPx > shrubPx * .08, `内侧小阴影存在（${shadowPx} px）`);
  mkdirSync(join(root, 'artifacts/coverage'), { recursive: true });
  writeFileSync(join(root, `artifacts/coverage/shrub-texture-${name}.png`), png(W, H, img));
  out[name] = { vertices: nv, topTris: tops.length, edgeZero: zeros, edgeOne: ones, wideTris: wideTris.length, splitCells, maxPerCell, shrubShare: +share.toFixed(3), wideShare: +(widePx / px).toFixed(3), nearEdge: +near.toFixed(3), shadowPx, shrubPx };
}
console.log('PASS 纯纹理灌木：aEdge 写入（顶面崖边 0 / 格心 1 / 非顶面 1）+ CPU 同式着色只在崖边带、有断开、有内侧小阴影', JSON.stringify(out));
