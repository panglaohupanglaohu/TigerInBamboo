/**
 * contour.js — 把 src/march.js 的等值线变成可看的线，用来验证"不规则四边形上的
 * marching squares"。原文：x.com/OskSta/status/1120036868966502401
 *
 * 为什么拿海岸线当验证：海岸线是 iso = 0.5（陆地 top≥1 / 水面 top=0）。
 * 如果角点没有正确合并，线会在格子边界处**错开**一小段 —— 一眼就能看出来；
 * 如果合并对了，整圈线是首尾相接的，且穿过每条格边时两边的端点严格重合。
 * 这就是这个模块存在的意义：它不是装饰，是一条自检。
 */

import * as THREE from 'three';
import { marchGrid } from '../src/march.js';

export function createCoastContour(town, grid, { iso = 0.5, levelHeight = 0.42, lift = 0.022, colour = '#ffbf5e' } = {}) {
  const { levels, cornerCount } = marchGrid(grid.cells, (c) => town.top(c), { iso, quant: 1e-3 });

  const verts = [];
  for (const { iso: lv, segs } of levels) {
    // 海岸线（iso 0.5）必须**贴水面**画：画在 0.5 层高（0.21）上会被崖面自己挡掉，
    // 因为等值线正好在陆/水的交界里侧。第一次就是这么画的，截图里一条线都看不见。
    // 其它 iso（台地线）才按层高放。
    const y = lv <= 0.5 ? lift : lv * levelHeight + lift;
    for (const s of segs) {
      verts.push(s[0], y, s[1], s[2], y, s[3]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(colour).convertSRGBToLinear(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  mesh.userData.overlayOnly = true;

  return {
    mesh,
    segs: verts.length / 6,
    corners: cornerCount,
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
