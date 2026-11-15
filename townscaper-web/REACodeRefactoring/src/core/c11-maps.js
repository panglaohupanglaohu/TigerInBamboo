/**
 * c11-maps.js — 第 56 批 C11：两张世界 XZ 图 + 着色器的 JS 孪生（node 可测）。
 *
 * ① 反差纹理 + 顶高（1590674061092212738）
 *    原文："In the vertex shader, my grass gets to sample that contrast texture both where they stand, and also raycast into the
 *    background. The outline strength is determined by the difference between these two samples!"
 *    bakeContrastHeightMap：共享 World 的三角扇做反差求解（core/contrast-field.js solveContrastColors：对比边拉开、非对比边趋同），
 *    每格取其三角的平均色写 RGB，A 写该格顶高（/maxH）。草卡顶点着色器先在站立处采一次，再沿「镜头 → 草」射线往背景步进，
 *    在高度场里找到第一个命中点再采一次；两次 RGB 差 → 描边强度。grassOutlineStrength 是同一算法的 JS 孪生。
 *    注：这是 XZ 平面图 + 顶高的 2.5D 近似，崖壁取的是它所在格的颜色（原作的反差纹理是 mesh UV 上的，这里没有那套 UV）。
 *
 * ② 灌木带崖高图（1707490932017279035）
 *    bakeShrubDropMap：R = 顶层 / 15，G = 本格各崖边的最大落差（层）/ 15，B = 是否陆地。灌木带宽按落差缩放、崖壁上每层台阶线
 *    挂一条灌木带（片子 0150：高塔崖壁每一层都压一条橙带）。
 */
import { worldContrastMesh, solveContrastColors } from './contrast-field.js';

export function worldSquareBounds(world, pad = 0.5) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of world.cells) for (const p of c.pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  if (!Number.isFinite(minX)) throw new RangeError('empty world');
  minX -= pad; minZ -= pad; const span = Math.max(maxX - minX, maxZ - minZ) + pad;
  return { minX, minZ, span };
}

function rasterCells(world, index, res, B, fn) {
  if (!Number.isInteger(res) || res < 8 || res > 2048) throw new RangeError('map res');
  for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
    const c = index.cellAt(B.minX + (x + 0.5) * B.span / res, B.minZ + (z + 0.5) * B.span / res);
    fn((z * res + x) * 4, c);
  }
}

/** RGBA8：RGB = 反差色（每格平均），A = 顶高 / maxH。海 / 空格 = 0。 */
export function bakeContrastHeightMap(world, index, { res = 256, levelHeight = 0.5, iters = 160, seed = 3 } = {}) {
  const mesh = worldContrastMesh(world), solved = solveContrastColors(mesh, { iters, seed });
  const sum = new Map();
  mesh.tris.forEach((t, i) => { const s = sum.get(t.cell) ?? [0, 0, 0, 0]; const c = solved.rgb[i]; s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; s[3]++; sum.set(t.cell, s); });
  let maxTop = 1; for (const c of world.cells) maxTop = Math.max(maxTop, world.top(c));
  const maxH = (maxTop + 1) * levelHeight, B = worldSquareBounds(world), data = new Uint8Array(res * res * 4);
  rasterCells(world, index, res, B, (o, c) => {
    if (!c) return; const t = world.top(c); if (t <= 0) return;
    const s = sum.get(c.id); if (!s) return;
    data[o] = Math.round(s[0] / s[3] * 255); data[o + 1] = Math.round(s[1] / s[3] * 255); data[o + 2] = Math.round(s[2] / s[3] * 255);
    data[o + 3] = Math.round(Math.min(1, t * levelHeight / maxH) * 255);
  });
  return { data, res, ...B, maxH, before: solved.before, after: solved.after, tris: mesh.tris.length };
}

/** 双线性 / 最近取样（与 GPU LinearFilter 近似；测试用最近邻足够）。 */
export function sampleMap(map, x, z) {
  const u = (x - map.minX) / map.span, v = (z - map.minZ) / map.span;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return [0, 0, 0, 0];
  const i = ((Math.floor(v * map.res) * map.res) + Math.floor(u * map.res)) * 4, d = map.data;
  return [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, d[i + 3] / 255];
}

export const GRASS_RAY = Object.freeze({ steps: 28, t0: 0.06, growth: 1.12, gain: 2.2, maxT: 9, lift: 0.12 });
/**
 * 站立处 vs 背景射线命中处的反差差值（顶点着色器 GRASSLINE_VERT 的 JS 孪生）。
 * 射线 = 镜头 → 草卡上沿（草根上抬 lift ≈ 草卡高，即轮廓所在处），再往远处走；第一个 y ≤ 高度场 的样本即命中；
 * 走出图 / 到 maxT 都没中 = 背景是海/天（反差色 0）。站立处采样用草根 XZ。
 */
export function grassOutlineStrength(map, origin, cam, opts = {}) {
  const { steps, t0, growth, gain, maxT, lift } = { ...GRASS_RAY, ...opts };
  const here = sampleMap(map, origin[0], origin[2]);
  origin = [origin[0], origin[1] + lift, origin[2]];
  let dx = origin[0] - cam[0], dy = origin[1] - cam[1], dz = origin[2] - cam[2]; const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
  let t = t0, step = t0, back = [0, 0, 0, 0], hit = false;
  for (let i = 0; i < steps && t < maxT; i++) {
    const p = [origin[0] + dx * t, origin[1] + dy * t, origin[2] + dz * t], s = sampleMap(map, p[0], p[2]);
    if (s[3] > 0 && p[1] <= s[3] * map.maxH + 1e-4) { back = s; hit = true; break; }
    step *= growth; t += step;
  }
  const diff = Math.hypot(here[0] - back[0], here[1] - back[1], here[2] - back[2]);
  return { strength: Math.min(1, diff * gain), hit, t };
}

export const GRASSLINE_VERT_PARS = /* glsl */`
uniform float uGL; uniform sampler2D uGLMap; uniform vec4 uGLX; uniform float uGLMaxH; uniform float uGLGain;
vec4 glSample(vec2 xz) { vec2 uv = (xz - uGLX.xy) * uGLX.zw; if (uv.x < 0. || uv.y < 0. || uv.x >= 1. || uv.y >= 1.) return vec4(0.); return texture2D(uGLMap, uv); }
float glOutline(vec3 o, float lift) {
  vec4 here = glSample(o.xz), back = vec4(0.);
  o.y += lift;
  vec3 dir = normalize(o - cameraPosition);
  float t = ${GRASS_RAY.t0.toFixed(3)}, stp = t;
  for (int i = 0; i < ${GRASS_RAY.steps}; i++) {
    if (t > ${GRASS_RAY.maxT.toFixed(1)}) break;
    vec3 p = o + dir * t; vec4 s = glSample(p.xz);
    if (s.a > 0. && p.y <= s.a * uGLMaxH + 1e-4) { back = s; break; }
    stp *= ${GRASS_RAY.growth.toFixed(3)}; t += stp;
  }
  return clamp(length(here.rgb - back.rgb) * uGLGain, 0., 1.);
}
`;

/** 灌木带崖高图：R 顶层/15，G 本格最大崖边落差/15，B 陆地。 */
export function bakeShrubDropMap(world, index, { res = 256 } = {}) {
  const drop = new Map();
  for (const c of world.cells) {
    const t = world.top(c); if (t <= 0) continue; let d = 0;
    for (let i = 0; i < c.n; i++) { const nb = world.neighbor(c, i); const nt = nb ? world.top(nb) : 0; d = Math.max(d, t - nt); }
    drop.set(c.id, d);
  }
  const B = worldSquareBounds(world), data = new Uint8Array(res * res * 4);
  rasterCells(world, index, res, B, (o, c) => {
    if (!c) return; const t = world.top(c); if (t <= 0) return;
    data[o] = Math.round(Math.min(15, t) / 15 * 255); data[o + 1] = Math.round(Math.min(15, drop.get(c.id)) / 15 * 255); data[o + 2] = 255; data[o + 3] = 255;
  });
  let maxDrop = 0; for (const d of drop.values()) maxDrop = Math.max(maxDrop, d);
  return { data, res, ...B, maxDrop, cells: drop.size };
}

/** 带宽缩放：落差 1 层 → 0.8，4 层及以上 → 1.6（GLSL shrubDropScale 的孪生）。 */
export const shrubDropScale = (dropLevels) => 0.8 + 0.8 * Math.min(1, Math.max(0, (dropLevels - 1) / 3));

/** 崖壁台阶带：wall 片元在高度 y、本格顶层 top、落差 drop、层高 L → 是否在某条中间台阶线下方的带内（GLSL 孪生）。 */
export function wallLedgeBand(y, top, drop, L, width = 0.16) {
  const k = Math.floor(y / L + 1e-6) + 1, below = k * L - y;   // 上方最近的台阶线 k
  if (k >= top || k <= top - drop) return 0;                   // 只有中间台阶（顶沿已有顶面带；崖脚以下不画）
  return below < width * L ? 1 : 0;
}
