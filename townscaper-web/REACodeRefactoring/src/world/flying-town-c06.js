/**
 * flying-town-c06.js — 第 56 批 C06：1313837640366596096 "You can now build flying towns (if you find any of the
 * perfect loops I've scattered across the grid)"。
 * 主场景 ?flying=1（默认关）：在共享网格上找完美环（core/loop-lift.js findLoops → grid.js 拓扑直线回到起点），
 * 环内格子的整列体素（地形 + 建筑）一起抬高 lift 层 → 同一 World/WorldMesh 直接渲染成悬空的镇子（建筑随岛抬升）；
 * 岛底沿环周挂等距细腿落到水面 + 落脚涟漪圈，环周外沿一圈白色小构件（片尾原尺寸看到的「蝶形」小件，程序化替代）。
 * 编辑：环内新建的方块同样处在抬升后的层上（直接点悬空的岛建造）。
 */
import * as THREE from 'three';
import { findLoops, supportLegs, hullDepth } from '../core/loop-lift.js';
import { MAX_LEVEL } from '../core/world.js';

/** 把 region 里每格的整列体素上移 lift 层（纯数据操作，可单测）。返回移动的体素数。 */
export function liftColumns(world, cellIds, lift) {
  let moved = 0;
  for (const id of cellIds) {
    const c = world.grid.cells[id], col = [];
    for (let l = 1; l <= MAX_LEVEL; l++) col.push(world.isSolid(c, l) ? ((world.rock[c.id] >> (l - 1)) & 1 ? 'rock' : 'block') : null);
    const top = col.findLastIndex(Boolean) + 1;
    if (top + lift > MAX_LEVEL) throw new RangeError('lift exceeds MAX_LEVEL for cell ' + id);
    for (let l = 1; l <= MAX_LEVEL; l++) world.setSolid(c, l, false);
    // 底下补一层「船壳」实心（原来是空列/水面的格，抬起后至少有一块板，岛才连成一片）
    if (!col.some(Boolean)) col[0] = 'rock';
    col.forEach((k, i) => { if (k) { world.setSolid(c, i + 1 + lift, true, { rock: k === 'rock' }); moved++; } });
    world.river[c.id] = 0;
  }
  world.touch();
  return moved;
}

export function attachFlyingTown(view, world, grid, { lift = 3, loop = 0, spacing = 1.1 } = {}) {
  const loops = findLoops(grid);
  if (!loops.length) return { ok: false, reason: 'no perfect loop on this grid' };
  const L = loops[Math.min(loop, loops.length - 1)];
  const region = L.region ?? L;
  const ids = (region.cells ?? []).map((c) => (typeof c === 'number' ? c : c.id));
  const moved = liftColumns(world, ids, lift);
  view.changed();
  const y0 = lift * view.levelHeight, depth = hullDepth(region.area ?? 4);
  const group = new THREE.Group(); group.name = 'flying-town-c06';
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2d3440, roughness: .6 }), ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55 }), trimMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .5 });
  const legs = supportLegs(region, { spacing, depth: 0 }).legs;
  for (const leg of legs) {
    const h = y0 - .02, m = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, h, 6), legMat); m.position.set(leg.x, h / 2, leg.z); group.add(m);
    const r = new THREE.Mesh(new THREE.RingGeometry(.12, .16, 20), ringMat); r.rotation.x = -Math.PI / 2; r.position.set(leg.x, .03, leg.z); group.add(r);
    // 外沿白色小构件（两片小叶，像系船桩/小螺旋桨）
    const t = new THREE.Group(); t.position.set(leg.x, y0 + .02, leg.z);
    for (const a of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.22, .03, .06), trimMat); b.rotation.y = a + Math.atan2(leg.z, leg.x); t.add(b); }
    group.add(t);
  }
  view.scene.add(group);
  return {
    ok: true, loops: loops.length, cells: ids.length, moved, legs: legs.length, lift, y0, depth, area: region.area,
    cellIds: ids,
    dispose() { view.scene.remove(group); group.traverse((o) => { o.geometry?.dispose(); }); for (const m of [legMat, ringMat, trimMat]) m.dispose(); },
  };
}
