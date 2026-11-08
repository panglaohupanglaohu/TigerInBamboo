/**
 * worldmesh.js — 把整个世界变成一个网格：地形管线 + 建筑管线 → 同一个顶点池 → 一次烘焙。
 *
 * 这是"融合"在代码里的落点：两条管线读同一个 World、写同一个 MeshWriter，
 * 光照烘焙看到的是两者合起来的体素场，所以房子贴着崖壁会被压暗、崖壁也会染上房子的颜色。
 *
 * 分块增量重建（拖动建造不卡）：
 *   1. 每次都重新生成全部几何（地形 + 建筑，便宜），但按格子路由进 4×4 单位的块（w.at(cell)）。
 *   2. 一个块要重新烘焙 + 重算法线，当且仅当：
 *        - 它的原始内容（位置 + 底色）的哈希变了 —— 屋顶体量、后院、地形平滑这类"远处影响"自动覆盖；
 *        - 或它附近（AO 半径内）有体素变了 —— 邻居的遮蔽 / 反弹光变了。
 *      其余块直接用上次烘焙好的数组。
 *   3. 所有块拼成一个几何体（仍然一次 draw call）。
 *   4. 法线计算带上相邻块的三角形做"光晕"，接缝处软法线和描边方向一致。
 * 烘焙分辨率按整座岛定一次（换场景时），各块对齐到同一像素网格，接缝处 AO 不跳。
 */

import * as THREE from 'three';
import {bakeNormalLight} from '../core/mountain-bake.js';
import { MeshWriter } from '../core/meshwriter.js';
import { BUILD, TERRAIN } from '../core/palette.js';
import { buildTerrain } from '../terrain/terrainmesh.js';
import { shapeTerrain } from '../terrain/shape.js';
import { buildBuildings } from '../build/buildings.js';
import { bakeLighting } from '../light/bake.js';

const CHUNK = 2.5;        // 块边长（世界单位）：越小，一次编辑重烘焙的范围越小
const AO_REACH = 0.7;     // 体素变化影响多远的烘焙（模糊半径 + 采样偏移 + 余量）

/** 按格子把三角形分到各块的 MeshWriter；对生成器来说它就是一个 MeshWriter。 */
class ChunkRouter {
  constructor(chunkOf) {
    this.chunkOf = chunkOf;
    this.writers = new Map();
    this.cur = this.writer(0);
    this.colorCache = new Map();
    this._soft = false;
  }
  writer(k) {
    let w = this.writers.get(k);
    if (!w) {
      w = new MeshWriter();
      w.colorCache = this.colorCache ?? w.colorCache;
      w.soft = this._soft;
      this.writers.set(k, w);
    }
    return w;
  }
  at(cell) { this.cur = this.writer(this.chunkOf(cell)); this.cur.soft = this._soft; }
  set fieldFrame(v) { this.cur.fieldFrame = v; }
  set soft(v) { this._soft = v; this.cur.soft = v; }
  get soft() { return this._soft; }
  c(hex) { return this.cur.c(hex); }
  tri(...a) { this.cur.tri(...a); }
  quad(...a) { this.cur.quad(...a); }
  poly(...a) { this.cur.poly(...a); }
  triC(...a) { this.cur.triC(...a); }
  beam(...a) { this.cur.beam(...a); }
  box(...a) { this.cur.box(...a); }
  blob(...a) { this.cur.blob(...a); }
  get triangles() { let n = 0; for (const w of this.writers.values()) n += w.triangles; return n; }
}

/** 快速内容哈希（FNV 风格，量化到 1e-4）。 */
function hashWriter(w) {
  let h = 2166136261 >>> 0;
  const mix = (x) => { h = Math.imul(h ^ (x | 0), 16777619) >>> 0; };
  for (let i = 0; i < w.pos.length; i++) mix(Math.round(w.pos[i] * 10000));
  for (let i = 0; i < w.col.length; i++) mix(Math.round(w.col[i] * 4096));
  for (let i = 0; i < w.glow.length; i++) mix(w.glow[i] * 7);
  for (const v of w.field) mix(Math.round(v * 10000));
  return h ^ w.pos.length;
}

function boundsOf(pos) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], z = pos[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
}

export class WorldMesh {
  constructor(world, { levelHeight = 0.5 } = {}) {
    this.world = world;
    this.L = levelHeight;
    this.builtVersion = -1;
    this.paletteRef = null;
    this.geometry = new MeshWriter().toGeometry();
    this.posts = [];
    this.bake = true;
    this.debugModules = false;   // 模块签名调试色（build/buildings.js）
    this.smooth = true;   // 层级平滑 + 笼形变形（terrain/shape.js）
    this.shape = null;
    this.shapeOptions = {};
    this.stats = {};
    this.cache = new Map();      // 块 → { hash, pos, col, glow, normal, outline }
    this.prev = null;            // 上次的体素快照，用来找变了的格子
    this.bakeRes = null;
    this.landKey = '';           // 岸浪只在陆地 / 钢柱 / 海岸形状变了时重建
    this.shoreDirty = true;
    this.full = true;
  }

  /** 强制下次整体重建（开关烘焙 / 平滑、换场景时）。 */
  setBakeLighting({enabled=true,strength=.62,bounce=.42}={}) {
    if(typeof enabled!=='boolean'||![strength,bounce].every(Number.isFinite)||strength<0||strength>1||bounce<0||bounce>1)throw new RangeError('invalid layered bake settings');
    const old=this.bakeLightingOptions??{strength:.62,bounce:.42};
    if(this.bake===enabled&&old.strength===strength&&old.bounce===bounce)return;
    this.bake=enabled;this.bakeLightingOptions={strength,bounce};this.invalidate();
  }
  invalidate() { this.builtVersion = -1; this.full = true; }

  chunkKey(c) { return Math.floor(c.cx / CHUNK) * 1000 + Math.floor(c.cz / CHUNK); }

  rebuild() {
    const world = this.world;
    if (world.version === this.builtVersion && world.palette === this.paletteRef) return false;
    if (world.palette !== this.paletteRef) this.full = true;
    this.builtVersion = world.version;
    this.paletteRef = world.palette;
    const t0 = performance.now();
    const L = this.L;
    const cells = world.cells;

    // 0. 哪些格子变了
    const n = cells.length;
    const changed = [];
    const prev = this.prev;
    if (prev && !this.full) {
      for (let i = 0; i < n; i++) {
        if (prev.solid[i] !== world.solid[i] || prev.rock[i] !== world.rock[i] || prev.color[i] !== world.color[i] || prev.river[i] !== world.river[i]) changed.push(cells[i]);
      }
      if (changed.length > n * 0.3) this.full = true;   // 改动太多（换场景、读档）：整体重建
    }
    // 给出现 / 消失动画、水花用：每个变了的格子之前和之后的顶层
    const topOf = (m) => (m === 0 ? 0 : 32 - Math.clz32(m));
    this.edits = (prev && changed.length <= 40) ? changed.map((c) => ({ cell: c, before: topOf(prev.solid[c.id]), after: world.top(c) })) : [];
    this.prev = { solid: world.solid.slice(), rock: world.rock.slice(), color: world.color.slice(), river: world.river.slice() };
    const full = this.full;
    this.full = false;
    if (full) {
      this.cache.clear();
      // 烘焙分辨率按整座岛定一次
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const c of cells) if (world.top(c)) { minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ); }
      const area = Number.isFinite(minX) ? (maxX - minX + 3.2) * (maxZ - minZ + 3.2) : 1;
      this.bakeRes = Math.max(0.08, Math.min(0.14, Math.sqrt(area / 40000)));
    }

    // 1. 全部重新生成，按块路由
    const shape = shapeTerrain(world, { ...this.shapeOptions, enabled: this.smooth });
    this.shape = shape;
    const r = new ChunkRouter((c) => this.chunkKey(c));
    const terrain = buildTerrain(r, world, { L, shape });
    const tTerrain = performance.now();
    const build = buildBuildings(r, world, { L, debugModules: this.debugModules });
    const tBuild = performance.now();

    // 2. 找脏块
    const changedBoxes = changed.map((c) => ({ minX: c.minX - AO_REACH, maxX: c.maxX + AO_REACH, minZ: c.minZ - AO_REACH, maxZ: c.maxZ + AO_REACH }));
    const overlaps = (a, b) => a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
    const rock = r.c(TERRAIN.rock), stone = r.c(BUILD.stone), plaster = r.c(BUILD.plaster);
    const colorOf = (c, lv) => {
      if (world.isRock(c, lv)) return rock;
      if (lv === 1) return stone;
      const k = world.color[c.id];
      return k >= 0 ? r.c(world.palette.colors[k]) : plaster;
    };
    const entries = [...r.writers.entries()].filter(([, w]) => w.pos.length);
    const info = entries.map(([k, w]) => ({ k, w, hash: hashWriter(w), box: boundsOf(w.pos) }));
    let bakeMs = 0, dirtyCount = 0;
    const fresh = new Map();
    for (const it of info) {
      const old = this.cache.get(it.k);
      const near = changedBoxes.some((b) => overlaps(b, it.box));
      if (old && old.hash === it.hash && !near) { fresh.set(it.k, old); continue; }
      dirtyCount++;
      const w = it.w;
      if (this.bake) {
        bakeMs += bakeLighting(w, world, { L, shape, colorOf, region: it.box, res: this.bakeRes, ...this.bakeLightingOptions }).ms;
      }
      // 法线：带上相邻块落在本块范围里的三角形
      const halo = { pos: [], soft: [] };
      const e = 0.02;
      for (const o of info) {
        if (o === it || !overlaps(o.box, { minX: it.box.minX - e, maxX: it.box.maxX + e, minZ: it.box.minZ - e, maxZ: it.box.maxZ + e })) continue;
        const P = o.w.pos;
        for (let t = 0; t < P.length; t += 9) {
          let inside = false;
          for (let v = 0; v < 9 && !inside; v += 3) {
            const x = P[t + v], z = P[t + v + 2];
            inside = x >= it.box.minX - e && x <= it.box.maxX + e && z >= it.box.minZ - e && z <= it.box.maxZ + e;
          }
          if (!inside) continue;
          for (let v = 0; v < 9; v++) halo.pos.push(P[t + v]);
          halo.soft.push(o.w.softTri[t / 9]);
        }
      }
      const { normal, outline } = w.normals(halo);
      fresh.set(it.k, { hash: it.hash, pos: new Float32Array(w.pos), col: new Float32Array(w.col), field: new Float32Array(w.field), glow: new Float32Array(w.glow), normal, outline });
    }
    this.cache = fresh;

    // 3. 拼成一个几何体
    const parts = [...fresh.values()];
    const total = parts.reduce((s, p) => s + p.pos.length, 0);
    const cat = (key, size) => {
      const out = new Float32Array(total / 3 * size);
      let o = 0;
      for (const p of parts) { out.set(p[key], o); o += p[key].length; }
      return out;
    };
    this.geometry?.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(cat('pos', 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(cat('col', 3), 3));
    g.setAttribute('aField', new THREE.BufferAttribute(cat('field', 3), 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(cat('glow', 1), 1));
    g.setAttribute('normal', new THREE.BufferAttribute(cat('normal', 3), 3));
    g.setAttribute('aMountainTone',new THREE.BufferAttribute(bakeNormalLight(g.getAttribute('normal').array),1));
    g.setAttribute('aOutline', new THREE.BufferAttribute(cat('outline', 3), 3));
    g.computeBoundingSphere();
    this.geometry = g;
    this.posts = build.posts;
    this.garden = { yards: build.yardCells, paths: build.pathCells, openings: build.yardOpenings };
    this.chimneys = build.chimneys;   // 给植被层（后院灌木、小花）
    this.buildStats = { decoPlacements:build.decoPlacements,decoDrawn:build.decoDrawn,decoDropped:build.decoDropped,archBudgets:build.archBudgets, modules: build.modules, doors: build.doors, decorationGroups: build.decorationGroups, decoSolved:build.decoSolved,decoFailures:build.decoFailures,archCount:build.archCount, archSegments:build.archSegments };   // 用到几种拼图块、开了几扇门

    // 4. 岸浪要不要重建：陆地（第 1 层实心）、钢柱、海岸切面形状
    let land = '';
    for (let i = 0; i < n; i++) land += world.solid[i] & 1 ? '1' : '0';
    let coast = 0;
    for (const c of cells) {
      if (!(world.solid[c.id] & 1)) continue;
      for (const p of c.pts) { const [x, z] = shape.at(p, 0); coast = (coast * 31 + Math.round(x * 1000) * 7 + Math.round(z * 1000)) | 0; }
    }
    const key = land + '|' + build.posts.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`).join(';') + '|' + coast;
    this.shoreDirty = key !== this.landKey;
    this.landKey = key;

    this.stats = {
      triangles: total / 9,
      chunks: parts.length,
      dirtyChunks: dirtyCount,
      changedCells: full ? 'all' : changed.length,
      terrainCells: terrain.cells,
      yards: build.yards,
      posts: build.posts.length,
      shapeMs: shape.ms,
      terrainMs: +(tTerrain - t0).toFixed(1),
      buildMs: +(tBuild - tTerrain).toFixed(1),
      bakeMs: +bakeMs.toFixed(1),
      ms: +(performance.now() - t0).toFixed(1),
    };
    return true;
  }
}
