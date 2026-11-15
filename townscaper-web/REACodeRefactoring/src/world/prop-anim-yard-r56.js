/**
 * prop-anim-yard-r56.js — 第 56 批 C05-D：把后院**真实的**树 / 灌木交给道具出现/消失动画层。
 * 1246074663546916873 "The props now animate when they appear and disappear. This was much trickier than I anticipated."
 *
 * r55 的 prop-anim-layer 只给它自己派生的木箱/系缆桩做动画，后院的树仍在 WorldMesh 静态网格里，加房子时一下子消失。
 * 这里：world.propAnimYard = true → buildings.js 不再把后院植物写进静态网格；同一份清单（build/yard-r56.js
 * yardFloraSpecs：与 buildings.js 同一套哈希/位置）作为 prop 交给 PropAnimLayer：
 *   稳定 key = tree:<格> / shrub:<格>；重建时未变的不重放；消失的保留旧顶点段先缩没（outStiffness）再释放；
 *   新出现的按 x 错峰（spread）弹簧长出。码头系缆桩沿用 r55 的派生（非后院格）。
 * 模板：每株 ≤ 72 顶点（四棱树干 24 + 八面体树冠 24/48），比静态网格的细分团块粗一点（程序化替代）。
 */
import { PropAnimLayer, collectWorldProps, propVerts } from './prop-anim-layer.js';
import { yardFloraSpecs } from '../build/yard-r56.js';
import { Color } from 'three';
import { BUILD } from '../core/palette.js';

// 与静态网格同色：BUILD 十六进制 → 线性空间（MeshWriter.c 同一转换）
const lin = (hex) => new Color(hex).toArray();
const COL = { trunk: lin(BUILD.trunk), tree: lin(BUILD.tree), treeLight: lin(BUILD.treeLight) };

export function collectYardProps(world, { L = .5 } = {}) {
  const flora = yardFloraSpecs(world, { L });
  const rest = collectWorldProps(world, { L }).filter((p) => p.kind !== 'crate');   // 后院不再放木箱：真树接管
  return [...flora, ...rest];
}
function prism(out, x, y0, z, y1, r, col) {
  const P = [[-r, -r], [r, -r], [r, r], [-r, r]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = P[k], [bx, bz] = P[(k + 1) % 4], n = [(ax + bx) / 2 / r, 0, (az + bz) / 2 / r];
    const A0 = [x + ax, y0, z + az], B0 = [x + bx, y0, z + bz], A1 = [x + ax, y1, z + az], B1 = [x + bx, y1, z + bz];
    for (const p of [A0, B0, B1, A0, B1, A1]) out.push({ p, n, c: col });
  }
}
function octa(out, x, y, z, rx, ry, col) {
  const v = [[rx, 0, 0], [-rx, 0, 0], [0, ry, 0], [0, -ry, 0], [0, 0, rx], [0, 0, -rx]].map(([a, b, c]) => [x + a, y + b, z + c]);
  for (const [a, b, c] of [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]]) {
    const A = v[a], B = v[b], C = v[c], u = A.map((q, i) => B[i] - q), w = A.map((q, i) => C[i] - q);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n) || 1;
    const sh = .82 + .3 * Math.max(0, n[1] / l);
    for (const p of [A, B, C]) out.push({ p, n: n.map((q) => q / l), c: col.map((q) => q * sh) });
  }
}
export function yardPropVerts(p, L = .5) {
  if (!['tree', 'treeBig', 'shrub'].includes(p.kind)) return propVerts(p, L);
  const out = [], s = p.s;
  if (p.kind === 'shrub') { octa(out, p.x, p.y + 0.05, p.z, 0.09, 0.07, COL.treeLight); return out; }
  prism(out, p.x, p.y, p.z, p.y + s * 1.3, 0.0175, COL.trunk);
  octa(out, p.x, p.y + s * 1.6, p.z, s, s * 0.95, p.kind === 'treeBig' ? COL.tree : COL.treeLight);
  if (p.kind === 'treeBig') octa(out, p.x + s * 0.35, p.y + s * 2.25, p.z - s * 0.2, s * 0.7, s * 0.65, COL.treeLight);
  if (out.length > 72) throw new RangeError('yard prop exceeds slot');
  return out;
}

/** 挂到 View：打开 world.propAnimYard、让 WorldMesh 重建（去掉静态树），再挂动画层。 */
export function attachYardPropAnim(view, world, opts = {}) {
  world.propAnimYard = true; world.touch(); view.worldMesh?.invalidate?.();
  const layer = new PropAnimLayer(world, { L: view.levelHeight ?? .5, collect: collectYardProps, verts: yardPropVerts, ...opts });
  view.scene.add(layer.mesh);
  const tick = () => { if (!layer.mesh.parent) return; layer.update(layer.clock ? layer.clock() : performance.now() / 1000); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  return layer;
}
