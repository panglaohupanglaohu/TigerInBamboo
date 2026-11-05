/**
 * scenes.js — 三个场景，同一个 World、同一张网格：
 *   town     Townscaper：水上码头 + 排屋（建筑管线）
 *   terrain  地形管线：台地、峡谷、河流、洞窟，没有房子
 *   fusion   融合（第三个项目的方向）：地形上长出房子 —— 台地上的排屋、海湾里的码头、
 *            跨峡谷的拱、水里钢架上的房子
 *            1579483114178768898 "combine an irregular grid (like in Townscaper) with
 *            multi-cell tiles (like in Bad North)"；1584623053061099520 "splice houses
 *            into the terrain"
 */

import { placeHouseTiles } from '../build/multicell.js';
import { generateTerrain } from '../terrain/generate.js';
import { forceChurch } from '../terrain/features.js';
import { generateBadNorth } from '../badnorth/island.js';
import { generateTown } from './townDemo.js';
import { makeRng } from '../core/noise.js';

export const SCENES = {
  town: { name: '小镇', note: 'Townscaper：建筑管线' },
  terrain: { name: '地形', note: 'engine：地形管线' },
  fusion: { name: '融合', note: '地形 + 建筑，同一张网格' },
  badnorth: { name: '北境', note: 'Bad North：守岛打维京人' },
};

const SCHEMES = [[0, 1, 3, 2, 7], [0, 7, 9, 1], [3, 13, 7, 1], [2, 12, 7, 11], [4, 14, 5, 7], [0, 3, 1, 2, 5, 13]];

export function buildScene(world, name, seed = 7) {
  if (name === 'town') return generateTown(world, seed, 0);
  if (name === 'terrain') return generateTerrain(world, { seed });
  if (name === 'badnorth') return generateBadNorth(world, seed);
  // 管线示例用：融合场景那座岛的"只有地形"版本（同一个种子、同一组参数），房子之后再拼进来
  if (name === 'fusion-terrain') return generateTerrain(world, FUSION_TERRAIN(seed));
  return generateFusion(world, seed);
}

const FUSION_TERRAIN = (seed) => ({ seed, rivers: 1, caves: 1, towers: 2 });

export function generateFusion(world, seed = 7) {
  generateTerrain(world, FUSION_TERRAIN(seed));
  const rng = makeRng(seed * 31 + 7);
  const cells = world.cells;
  const nb = (c, i) => world.neighbor(c, i);
  const pick = (a) => a[(rng() * a.length) | 0];
  const scheme = pick(SCHEMES);
  const paint = (c, k) => { world.color[c.id] = k ?? pick(scheme); };
  const ground = (c) => world.ground(c);
  const free = (c) => world.top(c) === ground(c) && !world.river[c.id];

  // 0) 强制模块：先把一块台地压平，再放一座教堂（1751932427272909032）——排屋之前放，免得被占
  world.church = forceChurch(world, { seed, color: scheme[0] });

  // 1579483114178768898: explicit quad+triangle footprint, committed atomically.
  // Existing mesher reads those same solid bits, suppressing the shared wall.
  const tileBatch = placeHouseTiles(world, { seed, count: 6 });

  // 1) 台地上的排屋：从平坦的台地格出发，尽量直着走
  const flat = cells.filter((c) => ground(c) >= 2 && free(c) && !tileBatch.reserved.has(c.id) && c.edgeNeighbors.every((_, i) => { const o = nb(c, i); return o && ground(o) === ground(c); }));
  const rows = Math.round(flat.length * 0.09);
  for (let r = 0; r < rows; r++) {
    let cur = pick(flat);
    let prev = null;
    const g = ground(cur);
    const stories = rng() < 0.7 ? 1 : 2;
    const colour = pick(scheme);
    for (let k = 0, len = 2 + ((rng() * 4) | 0); k < len && cur; k++) {
      if (!free(cur) || tileBatch.reserved.has(cur.id) || ground(cur) !== g) break;
      for (let s = 1; s <= stories; s++) world.setSolid(cur, g + s, true);
      paint(cur, rng() < 0.85 ? colour : undefined);
      let next = null;
      if (prev) {
        const e = cur.edgeNeighbors.indexOf(prev.id);
        const st = cur.n === 4 && e >= 0 ? cur.edgeNeighbors[(e + 2) % 4] : -1;   // 三角格没有对边，直接随机拐
        if (st >= 0 && rng() < 0.8) next = cells[st];
      }
      if (!next) next = pick(cur.edgeNeighbors.map((_, i) => nb(cur, i)).filter(Boolean));
      prev = cur;
      cur = next;
    }
  }

  // 2) 海湾码头：贴着沙滩 / 低岸的水格铺一圈码头，上面盖几栋
  const shore = cells.filter((c) => world.top(c) === 0 && c.edgeNeighbors.some((_, i) => { const o = nb(c, i); return o && ground(o) >= 1 && ground(o) <= 2; }));
  const start = shore.length ? pick(shore) : null;
  const quay = [];
  if (start) {
    const frontier = [start];
    const seen = new Set([start.id]);
    while (frontier.length && quay.length < 26) {
      const c = frontier.shift();
      quay.push(c);
      world.setSolid(c, 1, true);
      for (let i = 0; i < c.n; i++) {
        const o = nb(c, i);
        if (!o || seen.has(o.id) || world.top(o) !== 0) continue;
        if (!o.edgeNeighbors.some((_, j) => { const q = nb(o, j); return q && world.top(q) > 0; })) continue;
        seen.add(o.id);
        frontier.push(o);
      }
    }
    for (const c of quay) {
      if (rng() < 0.4) {
        world.setSolid(c, 2, true);
        if (rng() < 0.35) world.setSolid(c, 3, true);
        paint(c);
      }
    }
    // 3) 水里钢架上的房子
    const out = quay.flatMap((c) => c.edgeNeighbors.map((_, i) => nb(c, i))).filter((o) => o && world.top(o) === 0);
    if (out.length) { const s = pick(out); world.setSolid(s, 2, true); world.setSolid(s, 3, true); paint(s); }
  }

  // 4) 跨峡谷 / 河道的拱：两侧台地同高、中间低的格子，在台地高度上补一个体素
  let arches = 0;
  for (const c of cells) {
    if (arches >= 3) break;
    for (const i of [0, 1]) {
      const a = nb(c, i), b = nb(c, i + 2);
      if (!a || !b) continue;
      const h = Math.min(ground(a), ground(b));
      if (h < 3 || ground(c) > h - 2 || world.top(c) >= h) continue;
      world.setSolid(c, h, true);
      world.setSolid(c, h + 1, true);
      paint(c);
      arches++;
      break;
    }
  }

  world.touch();
  // Diagnostic generation receipt only: invalid after any edit/undo changes version.
  world.fusionTileReport = { version: world.version, placements: tileBatch.placements, receipt: tileBatch.receipt };
  return { quay: quay.length, arches, multiCellTiles: tileBatch.placements.length };
}
