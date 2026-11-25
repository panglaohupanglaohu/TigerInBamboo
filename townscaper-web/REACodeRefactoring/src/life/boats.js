/**
 * boats.js — 长船 + 航迹（Bad North）。
 *
 * 依据：901469409579061248 "Working on nicer ship wakes"
 *   画面（r183 逐帧核实，r184 接进主场景）：**不是 Kelvin V**。船后是两条**近乎平行**的白边线
 *   （间距 ≈ 船宽 3–4 倍、整段恒定），线间是**按航迹成排、排内跳格**的泡沫（近船密、往远端断成 X 形），
 *   再往远端先没的是内部泡沫，两条边线拖得更远、更淡。
 *
 * 做法：每条船沿一条绕岛的闭合路线开（半径从岛外开始往外找，直到一圈都是海）；
 *   - `corridor` 档（默认）：`advanceWake({corridor:true,latOffset})` 记下船尾左右两点，横偏偏移**恒定**、
 *     不外推 → 两条带状边线保持平行；泡沫粒子走 `makeWakeParticles({corridor:true})` 的里程分行。
 *   - `v` 档（`?wake=v` 对照）：旧 Kelvin V（横偏随年龄外推），保留用于 A/B。
 * 远端淡出：带状边线与粒子共用 `wakeFade(age,life,power)`（边线 power .85 长尾、泡沫行 1.75 早收）。
 */

import * as THREE from 'three';
import { advanceWake, makeWakeParticles, wakeFade, wakeLife } from '../core/wake-sampling.js';

const TRAIL_V = 70, TRAIL_CORRIDOR = 110;
const BEAM = 0.16, LEN = 1.1;

export class Boats {
  constructor({ scene, uTime, mode = 'corridor' }) {
    this.uTime = uTime;
    this.mode = mode === 'v' ? 'v' : 'corridor';
    const corridor = this.mode === 'corridor';
    this.group = new THREE.Group();
    scene.add(this.group);
    this.boats = [];
    this.hullMat = new THREE.MeshStandardMaterial({ color: 0x6a4535, roughness: 0.9, flatShading: true });
    this.crewMat = new THREE.MeshStandardMaterial({ color: 0x8e3b3b, roughness: 0.9, flatShading: true });
    this.wakeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `attribute float aA; varying float vA; void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          gl_FragColor = vec4(1.0, 1.0, 1.0, vA);
          #include <colorspace_fragment>
        }`,
    });
    // REACode wake.js: broadside foam particles at the Kelvin angle + square bow spray, drawn
    // over the existing V ribbons. Pixel-lab constants are rescaled to hull length/beam.
    // corridor 档（本片）：边线恒定横偏（beam·3.4/2）+ 按里程成排跳格；边线寿命 6.2s（长尾），泡沫行 2.4s。
    this.corridor = corridor;
    this.latOffset = BEAM * 3.4 / 2;
    this.wakeFx = corridor
      ? makeWakeParticles({ rate: 70, sprayRate: 4, life: 2.4, edgeLife: 6.2, corridor: true, corridorBeam: 3.4, rowStep: .12, rowFill: .6, edgePower: .85, rowPower: 1.75, bowSize: .14 })
      : makeWakeParticles({ rate: 70, sprayRate: 6, life: 3.2 });
    this.FX_MAX = 2600;   // r184：corridor 档粒子更多（边线寿命 6.2s + 每 .22 船长一行），1600 会把远端截掉
    const mk = (square) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.FX_MAX * 3), 3));
      g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(this.FX_MAX), 1));
      g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(this.FX_MAX), 1));
      g.setDrawRange(0, 0);
      const m = new THREE.Points(g, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        vertexShader: /* glsl */ `attribute float aA; attribute float aS; varying float vA; void main() { vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * 420.0 / max(.001, -mv.z); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: /* glsl */ `varying float vA; void main() { ${square ? '' : 'if (length(gl_PointCoord - .5) > .5) discard;'} gl_FragColor = vec4(1.0, 1.0, 1.0, vA);
          #include <colorspace_fragment>
        }`,
      }));
      m.frustumCulled = false; this.group.add(m); return m;
    };
    this.foamPoints = mk(false);
    this.sprayPoints = mk(true);
  }

  set visible(on) { this.group.visible = on; }

  #hull() {
    // 长船：两头翘起的细长船身 + 一排士兵（小方块）
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.5, 0); shape.quadraticCurveTo(0, -0.12, 0.5, 0); shape.lineTo(0.56, 0.1); shape.quadraticCurveTo(0, 0.02, -0.56, 0.1); shape.closePath();
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false }), this.hullMat);
    hull.geometry.translate(0, 0.02, -0.08);
    g.add(hull);
    for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.05), this.crewMat);
      m.position.set(i * 0.12, 0.1, s * 0.035);
      g.add(m);
    }
    return g;
  }

  /** 找一圈都是海的航线；isLand(x, z) → bool */
  refresh(isLand, span = 8, count = 2) {
    for (const b of this.boats) { this.group.remove(b.mesh, b.wake); b.wake.geometry.dispose(); b.mesh.traverse(o => o.geometry?.dispose()); }
    this.boats = [];
    this.wakeFx.foam.length = this.wakeFx.spray.length = 0;
    let R = span * 0.6;
    for (; R < span * 2; R += 0.25) {
      let ok = true;
      for (let k = 0; k < 64 && ok; k++) { const a = (k / 64) * Math.PI * 2; if (isLand(Math.cos(a) * R, Math.sin(a) * R) || isLand(Math.cos(a) * (R - 0.6), Math.sin(a) * (R - 0.6))) ok = false; }
      if (ok) break;
    }
    for (let i = 0; i < count; i++) {
      const mesh = this.#hull();
      const wake = new THREE.Mesh(new THREE.BufferGeometry(), this.wakeMat);
      wake.frustumCulled = false;
      this.group.add(mesh, wake);
      this.boats.push({ mesh, wake, R: R + i * 0.7, phase: i * 2.4, speed: 0.11 - i * 0.02, trail: [], acc: 0 });
    }
    return R;
  }

  update(dt) {
    const t = this.uTime.value, ships = [];
    for (const b of this.boats) {
      const a = b.phase + t * b.speed;
      const R = b.R + Math.sin(t * 0.13 + b.phase) * 0.4;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const dx = -Math.sin(a), dz = Math.cos(a);   // 前进方向
      b.mesh.position.set(x, 0.0 + Math.sin(t * 2 + b.phase) * 0.008, z);
      b.mesh.rotation.y = -Math.atan2(dz, dx);
      b.mesh.rotation.z = Math.sin(t * 1.6 + b.phase) * 0.03;
      // Keep emission remainder and interpolate event poses; existing ribbons stay in world space.
      advanceWake(b, { x, z, dx, dz }, dt, this.corridor
        ? { max: TRAIL_CORRIDOR, corridor: true, latOffset: this.latOffset }
        : { max: TRAIL_V });
      // 两条带子
      const pos = [], al = [];
      const life = this.corridor ? wakeLife(LEN, this.boats[0] ? Math.abs(this.boats[0].speedTan || 0) : 0, 3.2) : this.wakeFx.edgeLife;
      for (const side of ['l', 'r']) {
        for (let k = 0; k < b.trail.length - 1; k++) {
          const p = b.trail[k], q = b.trail[k + 1];
          const w0 = this.corridor ? 0.009 : 0.012 + p.age * 0.02, w1 = this.corridor ? 0.009 : 0.012 + q.age * 0.02;
          const A0 = this.corridor ? 0.75 * wakeFade(p.age, life, this.wakeFx.edgePower) : Math.max(0, 0.75 - p.age * 0.18);
          const A1 = this.corridor ? 0.75 * wakeFade(q.age, life, this.wakeFx.edgePower) : Math.max(0, 0.75 - q.age * 0.18);
          const [px, pz] = p[side], [qx, qz] = q[side];
          const ex = qx - px, ez = qz - pz, el = Math.hypot(ex, ez) || 1, ox = -ez / el, oz = ex / el;
          const y = 0.03;
          pos.push(px - ox * w0, y, pz - oz * w0, px + ox * w0, y, pz + oz * w0, qx + ox * w1, y, qz + oz * w1,
                   px - ox * w0, y, pz - oz * w0, qx + ox * w1, y, qz + oz * w1, qx - ox * w1, y, qz - oz * w1);
          al.push(A0, A0, A1, A0, A1, A1);
        }
      }
      const g = b.wake.geometry;
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aA', new THREE.Float32BufferAttribute(al, 1));
      const v = b.speed * R;   // tangential speed along the circular course
      const ship = { id: this.boats.indexOf(b), x, z, dx, dz, speed: Math.abs(v), len: LEN, beam: BEAM };
      b.ship = ship; b.speedTan = Math.abs(v);
      ships.push(ship);
    }
    this.wakeFx.step(Math.min(dt, .1), ships);
    this.#writeFx();
  }

  /** 只读探针（r184 运行验收用，零渲染改动）：
   *   ribbon = 两条带状边线的**间距**逐段读数（corridor 档应恒定、v 档随年龄张开）；
   *   wake   = 泡沫粒子的逐距离分桶（单位=船长）+ 边线/行各自"仍可见的最远船长数"。 */
  wakeProbe(shipIndex = 0, { bins = 6, min = .1 } = {}) {
    const b = this.boats[shipIndex];
    if (!b || !b.ship) return null;
    const spans = b.trail.map((p) => Math.hypot(p.l[0] - p.r[0], p.l[1] - p.r[1]));
    const buckets = [];
    for (let i = 0; i < bins; i++) {
      const sel = spans.filter((_, k) => k >= i * (spans.length / bins) && k < (i + 1) * (spans.length / bins));
      buckets.push(sel.length ? sel.reduce((s, v) => s + v, 0) / sel.length : 0);
    }
    const alphas = [];
    for (let k = 0; k < b.trail.length - 1; k += 1) {
      const a = this.corridor ? 0.75 * wakeFade(b.trail[k].age, this.wakeFx.edgeLife, this.wakeFx.edgePower) : Math.max(0, 0.75 - b.trail[k].age * 0.18);
      alphas.push(a);
    }
    const prof = this.wakeFx.profile(b.ship, { bins, min });
    return {
      mode: this.mode, corridor: this.corridor, latOffset: this.latOffset,
      trail: { count: b.trail.length, spans, buckets: { spans: buckets, min: Math.min(...spans), max: Math.max(...spans) } },
      ribbonAlpha: { first: alphas[0], mid: alphas[Math.floor(alphas.length / 2)], last: alphas.at(-1), monotonic: alphas.every((v, i) => i === 0 || v <= alphas[i - 1] + 1e-12) },
      wake: prof,
      foam: this.wakeFx.foam.length, spray: this.wakeFx.spray.length, rows: this.wakeFx.rows,
    };
  }

  #writeFx() {
    const put = (pts, list, alpha, size, y) => {
      const P = pts.geometry.attributes.position.array, A = pts.geometry.attributes.aA.array, S = pts.geometry.attributes.aS.array;
      const n = Math.min(this.FX_MAX, list.length);
      for (let i = 0; i < n; i++) { const p = list[list.length - n + i]; P.set([p.x, y, p.z], i * 3); A[i] = alpha(p); S[i] = size(p); }
      pts.geometry.setDrawRange(0, n);
      for (const a of ['position', 'aA', 'aS']) pts.geometry.attributes[a].needsUpdate = true;
    };
    put(this.foamPoints, this.wakeFx.foam, (p) => this.wakeFx.alphaOf(p), (p) => p.size * .5, .032);
    put(this.sprayPoints, this.wakeFx.spray, (p) => Math.pow(1 - p.age / p.life, 1.2) * .9, (p) => p.w * .5, .06);
  }
}
