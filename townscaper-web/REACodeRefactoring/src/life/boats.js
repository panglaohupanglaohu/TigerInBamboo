/**
 * boats.js — 长船 + 航迹（Bad North）。
 *
 * 依据：901469409579061248 "Working on nicer ship wakes"
 *   画面：两条载满士兵的长船朝岸边划，船尾拖出两道向外张开的白线（V 字形尾迹），越远越淡、越宽。
 *
 * 做法：每条船沿一条绕岛的闭合路线开（半径从岛外开始往外找，直到一圈都是海）；
 * 每隔一小段记下船尾左右两点（各自带一个向外的速度），每帧往外推开、变淡 → 两条带子画成 V 字。
 */

import * as THREE from 'three';
import { advanceWake } from '../core/wake-sampling.js';

const TRAIL = 70;

export class Boats {
  constructor({ scene, uTime }) {
    this.uTime = uTime;
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
    const t = this.uTime.value;
    for (const b of this.boats) {
      const a = b.phase + t * b.speed;
      const R = b.R + Math.sin(t * 0.13 + b.phase) * 0.4;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const dx = -Math.sin(a), dz = Math.cos(a);   // 前进方向
      b.mesh.position.set(x, 0.0 + Math.sin(t * 2 + b.phase) * 0.008, z);
      b.mesh.rotation.y = -Math.atan2(dz, dx);
      b.mesh.rotation.z = Math.sin(t * 1.6 + b.phase) * 0.03;
      // Keep emission remainder and interpolate event poses; existing ribbons stay in world space.
      advanceWake(b, { x, z, dx, dz }, dt, { max: TRAIL });
      // 两条带子
      const pos = [], al = [];
      for (const side of ['l', 'r']) {
        for (let k = 0; k < b.trail.length - 1; k++) {
          const p = b.trail[k], q = b.trail[k + 1];
          const w0 = 0.012 + p.age * 0.02, w1 = 0.012 + q.age * 0.02;
          const A0 = Math.max(0, 0.75 - p.age * 0.18), A1 = Math.max(0, 0.75 - q.age * 0.18);
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
    }
  }
}
