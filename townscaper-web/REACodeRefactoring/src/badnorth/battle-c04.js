/**
 * battle-c04.js — 第 56 批 C04 的两样战斗层效果（默认关，由 world/view-c04.js 的 ?c04= 开关驱动；battle.js 一行不改）。
 *
 * ① dustao — 823848950553780226「O yes, I do have AO on my dust particles. O yes, it does work on mobile」
 *    片子（227 帧）：一队人从塔门洞里走出、绕基座左转，脚下扬起灰白尘团；门洞里 / 贴墙的尘团明显更暗，走到开阔地变亮。
 *    → 单位移动时脚下冒尘（软圆点），每粒尘按所在位置的共享 World 体素遮挡算 AO（周围 14 个方向两圈半径的实心比例 +
 *      离地高度接触项），再乘到颜色上。只读 World，不另建体积。
 * ② hexslots — 815236105079398400「irregular is the new hex」
 *    片子（185 帧）：下命令时地面亮出几块**不规则六边形**（白描边 + 浅色填充），小队就落在这些格里；它们是三角/四边网格的
 *    顶点对偶格（每个网格顶点一块，邻接 ~6 → "不规则的 hex"）。
 *    → 小队目标格变了，就把目标格各个顶点的对偶格（只取与目标同一台地层的楔块）画成白框浅填，淡出。
 *      对偶格来自 core/vertex-dual.js gridVertexDual（同一共享网格，959752525867036672 也用它）。
 */
import * as THREE from 'three';
import { gridVertexDual } from '../core/vertex-dual.js';

/** 14 个方向（6 轴 + 8 体对角），单位向量 */
export const AO_DIRS = (() => { const d = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) d.push([x / Math.sqrt(3), y / Math.sqrt(3), z / Math.sqrt(3)]); return d; })();

/** 粒子 AO：occupied(x,y,z) 是共享 World 的实心查询。上半球 + 水平共 9 个方向、两圈半径 r、2r 上的实心比例（近圈权重 2；
 * 向下的方向不计——脚下地面每粒尘都有，由接触项单独处理）；
 * 再按离地高度加接触暗化（贴地最暗，1.5 层以上无）。返回 [minAO, 1]。 */
export function particleAO(occupied, x, y, z, { radius = .3, levelHeight = .5, strength = .85, minAO = .2 } = {}) {
  if (typeof occupied !== 'function' || ![x, y, z, radius, levelHeight].every(Number.isFinite)) throw new RangeError('Invalid particle AO sample');
  let occ = 0, tot = 0;
  for (const [ring, w] of [[1, 2], [2, 1]]) for (const d of AO_DIRS) { if (d[1] < 0) continue; tot += w; if (occupied(x + d[0] * radius * ring, y + d[1] * radius * ring, z + d[2] * radius * ring)) occ += w; }
  // 下方的地面每个粒子都有，单独计接触项，不让它把开阔地也压暗
  let below = 0; for (let k = 1; k <= 3; k++) if (occupied(x, y - k * levelHeight * .5, z)) { below = k; break; }
  const contact = below ? .18 * (1 - (below - 1) / 3) : 0;
  const open = 1 - occ / tot;
  return Math.max(minAO, Math.min(1, 1 - strength * (1 - open) * 1.6 - contact));
}

/** 目标格 cell 的"不规则六边形"：cell 每个顶点的对偶格，只保留与 cell 同一台地高度的楔块，返回每块的外轮廓（顺序点）。 */
export function hexSlotOutlines(world, dual, cell) {
  const level = world.top(cell), out = [];
  const byVertex = dual.byVertex ?? (dual.byVertex = new Map(dual.cells.map((d) => [d.vertex, d])));
  for (const v of cell.pts) {
    const d = byVertex.get(v.id); if (!d) continue;
    const keep = d.wedges.filter((w) => world.top(world.cells[w.cell]) === level);
    if (!keep.length) continue;
    // 楔块并集的外边：内部边出现两次，抵消
    const key = (p) => p.x.toFixed(5) + ',' + p.z.toFixed(5), edges = new Map(), pts = new Map();
    for (const w of keep) for (let k = 0; k < 4; k++) { const a = w.poly[k], b = w.poly[(k + 1) % 4], ka = key(a), kb = key(b), e = ka < kb ? ka + '|' + kb : kb + '|' + ka; pts.set(ka, a); pts.set(kb, b); if (edges.has(e)) edges.delete(e); else edges.set(e, [ka, kb]); }
    const segs = [...edges.values()].map(([a, b]) => [pts.get(a), pts.get(b)]);
    out.push({ vertex: v.id, level, wedges: keep, segs, area: keep.reduce((s, w) => s + w.area, 0), sides: segs.length });
  }
  return out;
}

const DUST_N = 700;
export class BattleC04 {
  constructor(view) {
    this.view = view; this.L = view.levelHeight; this.group = new THREE.Group(); view.scene.add(this.group);
    this.dustOn = false; this.hexOn = false; this.dustAO = true; this.stats = { dust: 0, emitted: 0, aoMin: 1, aoMax: 0, hex: 0 };
    // 尘粒
    this.p = new Float32Array(DUST_N * 3).fill(-99); this.v = new Float32Array(DUST_N * 3); this.life = new Float32Array(DUST_N); this.span = new Float32Array(DUST_N);
    this.shade = new Float32Array(DUST_N).fill(1); this.alpha = new Float32Array(DUST_N); this.size = new Float32Array(DUST_N); this.next = 0; this.rand = 0x2a;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('aShade', new THREE.BufferAttribute(this.shade, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.dust = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uColor: { value: new THREE.Color(0xe9e5dc) }, uScale: { value: 400 } },
      vertexShader: 'uniform float uScale; attribute float aShade; attribute float aAlpha; attribute float aSize; varying float vS; varying float vA; void main(){ vS=aShade; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uScale/max(.001,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uColor; varying float vS; varying float vA; void main(){ float r=length(gl_PointCoord-.5); if(r>.5) discard; gl_FragColor=vec4(uColor*vS, vA*smoothstep(.5,.15,r));\n#include <colorspace_fragment>\n}',
    }));
    this.dust.frustumCulled = false; this.dust.visible = false; this.group.add(this.dust);
    this.last = new Map();
    // 不规则六边形
    this.hexes = []; this.goals = new Map(); this.dual = null; this.dualVersion = -1;
  }
  #rnd() { this.rand = (Math.imul(this.rand, 1664525) + 1013904223) >>> 0; return this.rand / 4294967296; }
  occupied = (x, y, z) => { if (y < 0) return true; const c = this.view.index.cellAt(x, z); return !!(c && this.view.town.isSolid(c, Math.floor(y / this.L) + 1)); };
  setDust(on) { this.dustOn = !!on; this.dust.visible = this.dustOn; if (!on) { this.life.fill(0); this.p.fill(-99); this.last.clear(); } }
  setHex(on) { this.hexOn = !!on; if (!on) { for (const h of this.hexes) this.#dropHex(h); this.hexes = []; this.goals.clear(); } }
  emit(x, y, z, vx, vz) {
    const i = this.next++ % DUST_N, r = () => this.#rnd() - .5;
    this.p.set([x + r() * .06, y + .02, z + r() * .06], i * 3); this.v.set([vx * -.25 + r() * .12, .1 + this.#rnd() * .14, vz * -.25 + r() * .12], i * 3);
    this.life[i] = this.span[i] = .9 + this.#rnd() * .7; this.stats.emitted++;
  }
  update(dt, battle) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid C04 timestep');
    dt = Math.min(dt, .05);
    if (this.dustOn) {
      // 点大小按透视换算成世界尺寸：像素 = 世界直径 × (视口高/2 × proj[5]) / 深度
      const cam = this.view.camera, h = this.view.renderer?.domElement?.height ?? 800;
      if (cam?.projectionMatrix) this.dust.material.uniforms.uScale.value = h / 2 * cam.projectionMatrix.elements[5];
      this.#updateDust(dt, battle);
    }
    if (this.hexOn) this.#updateHex(dt, battle);
  }
  #updateDust(dt, battle) {
    if (battle?.units) for (const u of battle.units) {
      if (u.dead || u.onBoat || u.fall) { this.last.delete(u); continue; }
      const prev = this.last.get(u); this.last.set(u, { x: u.x, z: u.z });
      if (!prev || dt <= 0) continue;
      const vx = (u.x - prev.x) / dt, vz = (u.z - prev.z) / dt, sp = Math.hypot(vx, vz);
      if (sp > .12 && this.#rnd() < Math.min(1, sp * 6 * dt)) this.emit(u.x, u.y, u.z, vx, vz);
    }
    let live = 0, mn = 1, mx = 0;
    for (let i = 0; i < DUST_N; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.p[i * 3 + 1] = -99; continue; }
      live++; this.life[i] -= dt; const age = 1 - Math.max(0, this.life[i]) / this.span[i];
      for (let a = 0; a < 3; a++) { this.p[i * 3 + a] += this.v[i * 3 + a] * dt; this.v[i * 3 + a] *= 1 - 1.6 * dt; }
      if (this.occupied(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2])) { this.p[i * 3 + 1] += this.L * .25; this.v[i * 3 + 1] = Math.abs(this.v[i * 3 + 1]); }
      this.size[i] = .05 + .16 * Math.sqrt(age); this.alpha[i] = .75 * (1 - age) * Math.min(1, age * 8);
      // AO 每帧轮流更新 1/4，粒子慢，看不出延迟
      if (dt === 0 || (i + this.stats.emitted) % 4 === 0 || this.shade[i] === 1) this.shade[i] = this.dustAO ? particleAO(this.occupied, this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2], { levelHeight: this.L }) : 1;
      mn = Math.min(mn, this.shade[i]); mx = Math.max(mx, this.shade[i]);
    }
    Object.assign(this.stats, { dust: live, aoMin: +mn.toFixed(3), aoMax: +mx.toFixed(3) });
    const a = this.dust.geometry.attributes; for (const k of ['position', 'aShade', 'aAlpha', 'aSize']) a[k].needsUpdate = true;
  }
  #ensureDual() { const w = this.view.town; if (!this.dual || this.dualVersion !== w.version) { this.dual = gridVertexDual(w.grid); this.dualVersion = w.version; } return this.dual; }
  showHexAt(cell, { life = 3.2 } = {}) {
    const w = this.view.town, outlines = hexSlotOutlines(w, this.#ensureDual(), cell), y = w.top(cell) * this.L + .035;
    const line = [], fill = [];
    for (const o of outlines) { for (const [a, b] of o.segs) line.push(a.x, y, a.z, b.x, y, b.z); for (const wd of o.wedges) { const p = wd.poly; for (const t of [[0, 1, 2], [0, 2, 3]]) for (const k of t) fill.push(p[k].x, y - .005, p[k].z); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fill, 3));
    const lm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }), fm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide });
    const h = { lines: new THREE.LineSegments(lg, lm), fill: new THREE.Mesh(fg, fm), age: 0, life, outlines };
    h.lines.renderOrder = 6; h.fill.renderOrder = 5; this.group.add(h.fill, h.lines); this.hexes.push(h); this.stats.hex = outlines.length; this.stats.hexSides = outlines.map((o) => o.sides);
    return h;
  }
  #dropHex(h) { for (const o of [h.lines, h.fill]) { o.geometry.dispose(); o.material.dispose(); this.group.remove(o); } }
  #updateHex(dt, battle) {
    for (const sq of battle?.squads ?? []) { if (!sq.alive || !sq.goal) continue; const g = this.goals.get(sq); if (g !== undefined && g !== sq.goal) this.showHexAt(sq.goal); this.goals.set(sq, sq.goal); }
    for (const h of this.hexes) { h.age += dt; const f = Math.max(0, 1 - Math.max(0, h.age - h.life * .6) / (h.life * .4)); h.lines.material.opacity = f; h.fill.material.opacity = .3 * f; }
    for (const h of this.hexes.filter((x) => x.age >= x.life)) this.#dropHex(h);
    this.hexes = this.hexes.filter((x) => x.age < x.life);
  }
  dispose() { this.setHex(false); this.dust.geometry.dispose(); this.dust.material.dispose(); this.group.removeFromParent(); }
}
