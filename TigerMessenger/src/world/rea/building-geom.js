/**
 * building-geom.js — R57 / R58 建筑候选的纯几何与记录（不依赖 three / 游戏状态，Node 测试与游戏页共用）。
 *   buildingBoxes(layout)  建筑群计划 → 一组舞台坐标的盒子（台基 / 墙身 / 屋顶 / 门 / 路），buildingCandidate.js 把它们贴到球面上；
 *   crystalField(...)      水晶城采样：峡谷阶地高度（解析，canyon.js）+ 已有建筑足迹（标成 cls 1）→ 与山形采样同格式的高度场；
 *   adoptKey / adoptRecord 采用记录（只写 tm.building.adopted.v1:<场景>，不写任何用户存档；进游戏不自动换，待用户决定）。
 */
import { cellCenter, DIRS } from '../../../../townscaper-web/REACodeRefactoring/src/build/prefab-socket.js';

export const STORY_H = 3.2;
export const WALLS = [0xf2e6d0, 0xe8d3b0, 0xd9e4ec, 0xf0d6c8, 0xe3e0c8];
export const ROOFS = [0xb5523b, 0x8a4b3a, 0x4f6d8a, 0xa0603a, 0x6b7f4a];

/** 计划 → 盒子。每个盒子 { kind, n（第几栋，路为 -1）, x, z, y0, y1, sx, sz, color }；单位米，舞台坐标（x,z 沿球面弧长，y 离海面高）。 */
export function buildingBoxes(layout) {
  if (!layout?.placements) return [];
  const cs = layout.cellSize, out = [];
  for (const p of layout.placements) {
    p.cells.forEach(([I, J], ci) => {
      const c = cellCenter(layout, I, J), st = p.stories + (p.tower === ci ? 1 : 0), top = p.base + st * STORY_H;
      if (p.base - p.floor > 0.05) out.push({ kind: 'plinth', n: p.n, x: c.x, z: c.z, y0: p.floor - 0.3, y1: p.base, sx: cs * 0.96, sz: cs * 0.96, color: 0x9a8f80 });
      out.push({ kind: 'body', n: p.n, x: c.x, z: c.z, y0: p.base, y1: top, sx: cs * 0.9, sz: cs * 0.9, color: WALLS[p.color % WALLS.length] });
      out.push({ kind: 'roof', n: p.n, x: c.x, z: c.z, y0: top, y1: top + cs * 0.45, sx: cs * 0.98, sz: cs * 0.98, color: ROOFS[p.color % ROOFS.length] });
    });
    const [I, J] = p.door.cell, c = cellCenter(layout, I, J), [dx, dz] = DIRS[p.door.dir], along = p.door.dir % 2 === 0;
    out.push({ kind: 'door', n: p.n, x: c.x + dx * cs * 0.46, z: c.z + dz * cs * 0.46, y0: p.base, y1: p.base + 2.2, sx: along ? 0.25 : 1.4, sz: along ? 1.4 : 0.25, color: 0x4a3a2a });
  }
  for (const r of layout.roads || []) {
    const c = cellCenter(layout, r.cell[0], r.cell[1]), y = (r.h ?? 0) + 0.04, w = cs * 0.5;
    out.push({ kind: 'road', n: -1, x: c.x, z: c.z, y0: y, y1: y + 0.12, sx: w, sz: w, color: 0xb9ad98 });
    for (let e = 0; e < 4; e++) if ((r.mask >> e) & 1) { const [dx, dz] = DIRS[e]; out.push({ kind: 'road', n: -1, x: c.x + dx * cs * 0.375, z: c.z + dz * cs * 0.375, y0: y, y1: y + 0.12, sx: dx ? cs * 0.25 : w, sz: dz ? cs * 0.25 : w, color: 0xb9ad98 }); }
  }
  return out;
}

/**
 * 水晶城采样（R58）。groundAt(x, z) → 地面高（米，舞台坐标）；structures = 已有建筑 / 晶体 / 丘垫在舞台坐标里的包围框 [{x0,x1,z0,z1}]。
 * 城里根部是能量海：最低一级阶地 + seaOffset 以下当海（不建）。
 */
export function crystalField({ n, step, half, groundAt, structures = [], pad = 1.5, seaOffset = 0.5 }) {
  const N = n * n, h = new Array(N), cls = new Array(N).fill(0); let lo = Infinity;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = groundAt(i * step - half, j * step - half); h[j * n + i] = Number.isFinite(v) ? Math.round(v * 100) / 100 : null; if (Number.isFinite(v)) lo = Math.min(lo, v); }
  let marked = 0;
  for (const b of structures) {
    const i0 = Math.max(0, Math.floor((b.x0 - pad + half) / step)), i1 = Math.min(n - 1, Math.ceil((b.x1 + pad + half) / step)), j0 = Math.max(0, Math.floor((b.z0 - pad + half) / step)), j1 = Math.min(n - 1, Math.ceil((b.z1 + pad + half) / step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (!cls[j * n + i]) { cls[j * n + i] = 1; marked++; }
  }
  return { n, step, half, h, cls, sea: Number.isFinite(lo) ? Math.round((lo + seaOffset) * 100) / 100 : 0.3, marked };
}

/** 高度数组的短指纹（山形候选换了没有）。 */
export function heightSig(h) { let a = 2166136261 >>> 0; for (let q = 0; q < (h?.length || 0); q++) { const v = h[q] == null ? -9999 : Math.round(h[q] * 10); a = Math.imul(a ^ (v & 0xffff), 16777619) >>> 0; a = Math.imul(a ^ (v >>> 16 & 0xffff), 16777619) >>> 0; } return a.toString(16); }
export function layoutSig(layout) { return heightSig((layout?.placements || []).flatMap((p) => [p.anchor[0], p.anchor[1], p.rot, p.prefab.length, p.cells.length])); }

export const ADOPT_PREFIX = 'tm.building.adopted.v1:';
export const adoptKey = (id) => ADOPT_PREFIX + String(id || 'citadel');
/** 采用记录：只存计划和它站在哪套地形上。autoDeploy 恒为 false（进游戏自动换上要用户点头，P-R57-01）。 */
export function adoptRecord({ id, layout, terrain = 'original', mountainSig = null, at = Date.now() }) {
  if (!layout?.placements?.length) throw new Error('没有可采用的建筑群');
  return { v: 1, id: String(id), at, terrain, mountainSig, autoDeploy: false, sig: layoutSig(layout), buildings: layout.placements.length, layout };
}
