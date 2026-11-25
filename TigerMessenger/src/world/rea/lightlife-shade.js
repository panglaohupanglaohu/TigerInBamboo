/**
 * lightlife-shade.js — 光影与生命实景预览的纯数学部分（R66，无 three / DOM，Node 单元测试与游戏共用）。
 *   shadeFactor   体素遮蔽 + 彩色反弹网格（lightlife 能力 light.voxel-ao / light.bounce 的 plan.light）在任意一点的三线性采样，
 *                 返回乘到顶点色上的 [r, g, b] 系数：ao + tint · mix · occ（与 voxel-light.js bakeVertexAO 同一个式子：ao = 1 − strength · min(1, 1.15 · occ)）。
 *   posesFor      固定机位（贴球舞台坐标，米）：按场景半径 H 算正面 / 侧面 / 俯视 / 斜后——「之前 / 之后」同机位对照都用这一组。
 *   frameAt       动物关键帧插值（来回播）；puffAt 烟团沿自己的轨迹循环上升。
 */
export const POSE_ORDER = ['front', 'side', 'top', 'oblique'];
export const POSE_LABEL = { front: '正面', side: '侧面', top: '俯视', oblique: '斜后' };
export function posesFor(H) {
  const h = Math.max(12, Number(H) || 60);
  return {
    front: { label: POSE_LABEL.front, pos: [0, 0.78 * h, 1.95 * h], at: [0, 0.1 * h, 0] },
    side: { label: POSE_LABEL.side, pos: [1.95 * h, 0.72 * h, 0], at: [0, 0.1 * h, 0] },
    top: { label: POSE_LABEL.top, pos: [0, 3.1 * h, 0.01 * h], at: [0, 0, 0] },
    oblique: { label: POSE_LABEL.oblique, pos: [-1.4 * h, 1.0 * h, -1.4 * h], at: [0, 0.1 * h, 0] },
  };
}
const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** 网格上一点（贴球舞台坐标 x, y = 离海面高度, z）的遮蔽与反弹色。网格外 = 不遮蔽、白色。 */
export function sampleLight(light, x, y, z) {
  const { n, step, L, x0, z0, Lv, occ, tint } = light;
  const fi = (x - x0) / step - 0.5, fj = (z - z0) / step - 0.5, fl = y / L + 0.5;
  if (!(fi > -1 && fj > -1 && fi < n && fj < n)) return { occ: 0, tint: [1, 1, 1] };
  const i0 = Math.floor(fi), j0 = Math.floor(fj), l0 = Math.floor(fl), tx = fi - i0, tz = fj - j0, tl = fl - l0;
  let o = 0, r = 0, g = 0, b = 0, ws = 0;
  for (let dl = 0; dl < 2; dl++) for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
    const i = clampI(i0 + di, 0, n - 1), j = clampI(j0 + dj, 0, n - 1), l = l0 + dl;
    const w = (di ? tx : 1 - tx) * (dj ? tz : 1 - tz) * (dl ? tl : 1 - tl);
    if (l < 0 || l >= Lv) { ws += w; r += w; g += w; b += w; continue; }
    const k = (l * n + j) * n + i; o += occ[k] * w; ws += w;
    if (tint) { r += tint[k * 3] * w; g += tint[k * 3 + 1] * w; b += tint[k * 3 + 2] * w; } else { r += w; g += w; b += w; }
  }
  return ws > 0 ? { occ: o / ws, tint: [r / ws, g / ws, b / ws] } : { occ: 0, tint: [1, 1, 1] };
}
export function shadeFactor(light, x, y, z) {
  const s = sampleLight(light, x, y, z), strength = light.strength ?? 0.62, mix = light.mix ?? 0;
  if (s.occ < 0.002) return [1, 1, 1];
  const ao = 1 - strength * Math.min(1, s.occ * 1.15), k = mix * s.occ;
  return [ao + s.tint[0] * k, ao + s.tint[1] * k, ao + s.tint[2] * k];
}
/** 关键帧来回播：t 秒，period 秒走完一遍 */
export function frameAt(frames, t, period = 8) {
  if (!frames?.length) return [];
  if (frames.length === 1) return frames[0];
  const u = ((t % (2 * period)) + 2 * period) % (2 * period), f = (u <= period ? u : 2 * period - u) / period * (frames.length - 1);
  const a = Math.floor(f), b = Math.min(frames.length - 1, a + 1), w = f - a;
  return frames[a].map((p, i) => [p[0] + (frames[b][i][0] - p[0]) * w, p[1] + (frames[b][i][1] - p[1]) * w, p[2] + (frames[b][i][2] - p[2]) * w]);
}
/** 烟团：沿「烟源 → 这团的位置」那条轨迹按年龄循环上升，越老越大 */
export function puffAt(puff, source, t, speed = 0.12) {
  const age0 = Math.max(0.05, puff.age || 0.05), a = ((puff.age + t * speed) % 1 + 1) % 1, k = a / age0;
  return { x: source.x + (puff.x - source.x) * k, y: source.y + (puff.y - source.y) * k, z: source.z + (puff.z - source.z) * k, r: puff.r * (0.35 + a), a };
}
