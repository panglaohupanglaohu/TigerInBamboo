/**
 * splash-c07.js — 第 56 批 C07：「splashier splashes」的冠状水帘 + 多圈长寿命泡沫环（1258421104756097029）。
 *
 * 原文「We were long overdue for some splashier splashes」。逐帧（见 1258421104756097029-review.md）：
 *   ① 一圈 8–10 根竖直白条围成冠状（约 0.5–0.7 格高，几乎不外抛），约 0.4s 内竖起、再塌落；
 *   ② 2–3 圈同心泡沫环向外扩、边缘不规则，末帧（事件后 ~3.2s）仍有淡环（这里寿命 3.8s）；
 *   ③ 9–12 颗飞沫，偏竖直，落回水面即灭。
 * 触发口径沿用 life/effects.js 的 onEdit（第一块落水 / 拆到水面），这里只负责形态。默认关：view-c07 打开 splash 时
 * 包一层 effects.onEdit，并把原来那一圈 1.1s 的环和 26 颗外抛飞沫换成本模块（不改 effects.js）。
 *
 * 形态全在 GPU 上按「出生时间」算，CPU 只写实例属性；年龄 → 形状的函数同时导出给 node 测试。
 */
import * as THREE from 'three';

export const CROWN_STRIPS = 10, CROWN_LIFE = 0.9, RING_LIFE = 3.8, RING_DELAYS = Object.freeze([0, 0.22, 0.5]);
/** 冠状条高度：0→0.35s 升到 h，之后塌落到 0（0.9s） */
export function crownHeight(age, h = 0.6) {
  if (age < 0 || age > CROWN_LIFE) return 0;
  return age < 0.35 ? h * Math.sin(age / 0.35 * Math.PI / 2) : h * Math.max(0, 1 - ((age - 0.35) / (CROWN_LIFE - 0.35)) ** 1.6);
}
/** 第 i 圈环在事件后 t 秒的 [半径, 不透明度]；减速外扩，3.8s 才淡完 */
export function ringState(t, i, scale = 1) {
  const age = t - RING_DELAYS[i];
  if (age < 0 || age > RING_LIFE) return [0, 0];
  const r = (0.5 + 0.7 * (1 - Math.exp(-age * 1.1)) * (1 + 0.25 * i)) * scale;   // 从块脚（≈半格）往外
  const a = (1 - age / RING_LIFE) ** 0.8 * (i === 0 ? 0.9 : 0.6);
  return [r, a];
}

const MAXE = 24;   // 同时存在的水花事件
export class CrownSplash {
  constructor({ scene, uTime, random = Math.random }) {
    this.uTime = uTime; this.random = random; this.n = 0; this.group = new THREE.Group(); scene.add(this.group);
    this.log = [];
    // ① 冠状竖条：一条 = 一个竖直细四边形，实例 = 事件 × 条
    const strip = new THREE.PlaneGeometry(1, 1, 1, 4); strip.translate(0, 0.5, 0);
    const N = MAXE * CROWN_STRIPS;
    this.cStart = new THREE.InstancedBufferAttribute(new Float32Array(N).fill(-99), 1);
    this.cAng = new THREE.InstancedBufferAttribute(new Float32Array(N), 2);
    strip.setAttribute('aStart', this.cStart); strip.setAttribute('aAng', this.cAng);
    this.crown = new THREE.InstancedMesh(strip, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime },
      vertexShader: /* glsl */ `
        attribute float aStart; attribute vec2 aAng; uniform float uTime; varying float vA; varying vec2 vUv;
        float crownH(float age){ if(age<0.0||age>${CROWN_LIFE.toFixed(2)}) return 0.0; return age<0.35 ? sin(age/0.35*1.5708) : max(0.0,1.0-pow((age-0.35)/${(CROWN_LIFE - 0.35).toFixed(2)},1.6)); }
        void main(){
          float age = uTime - aStart, h = crownH(age) * 0.6 * aAng.y;
          vec3 o = (instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
          float sc = length(instanceMatrix[0].xyz), a = aAng.x, rr = (0.56 + 0.14 * clamp(age / ${CROWN_LIFE.toFixed(2)}, 0.0, 1.0)) * sc;   // 围着落水块的脚一圈
          vec3 c = o + vec3(cos(a), 0.0, sin(a)) * rr;
          // 面朝外的竖条：宽 0.07，顶端略外翻（水帘）
          vec3 side = vec3(-sin(a), 0.0, cos(a)), out_ = vec3(cos(a), 0.0, sin(a));
          vec3 p = c + side * position.x * 0.07 * (1.0 - 0.4 * position.y) + vec3(0.0, position.y * h, 0.0) + out_ * position.y * position.y * h * 0.25;
          vA = h > 0.001 ? (1.0 - 0.35 * position.y) : 0.0; vUv = vec2(position.x + 0.5, position.y);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying vec2 vUv;
        void main(){ if(vA<=0.0) discard; float e = 1.0 - abs(vUv.x - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0), vA * smoothstep(0.0, 0.35, e) * 0.92);
          #include <colorspace_fragment>
        }`,
    }), N);
    this.crown.frustumCulled = false; this.crown.renderOrder = 6; this.crown.count = 0; this.group.add(this.crown);
    // ② 多圈不规则泡沫环：一个环 = 实例；片元按角度噪声给锯齿边
    const ring = new THREE.RingGeometry(0.8, 1, 64, 1); ring.rotateX(-Math.PI / 2);
    const R = MAXE * RING_DELAYS.length;
    this.rStart = new THREE.InstancedBufferAttribute(new Float32Array(R).fill(-99), 1);
    this.rIdx = new THREE.InstancedBufferAttribute(new Float32Array(R), 2);
    ring.setAttribute('aStart', this.rStart); ring.setAttribute('aIdx', this.rIdx);
    this.rings = new THREE.InstancedMesh(ring, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime },
      vertexShader: /* glsl */ `
        attribute float aStart; attribute vec2 aIdx; uniform float uTime; varying float vA; varying float vAng; varying float vRad;
        void main(){
          float i = aIdx.x, age = uTime - aStart - (i < 0.5 ? 0.0 : (i < 1.5 ? ${RING_DELAYS[1].toFixed(2)} : ${RING_DELAYS[2].toFixed(2)}));
          vec3 o = (instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
          float r = (0.5 + 0.7 * (1.0 - exp(-age * 1.1)) * (1.0 + 0.25 * i)) * aIdx.y;
          vA = (age < 0.0 || age > ${RING_LIFE.toFixed(2)}) ? 0.0 : pow(1.0 - age / ${RING_LIFE.toFixed(2)}, 0.8) * (i < 0.5 ? 0.9 : 0.6);
          vAng = atan(position.z, position.x) + aStart * 3.7 + i; vRad = length(position.xz);
          vec3 p = o + position * r; p.y = 0.021 + i * 0.001;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vAng; varying float vRad;
        void main(){ if(vA<=0.0) discard;
          float jag = 0.86 + 0.07 * sin(vAng * 7.0) + 0.05 * sin(vAng * 13.0 + 1.3) + 0.03 * sin(vAng * 29.0);
          if (vRad < jag) discard;
          gl_FragColor = vec4(vec3(1.0), vA * 0.85);
          #include <colorspace_fragment>
        }`,
    }), R);
    this.rings.frustumCulled = false; this.rings.renderOrder = 5; this.rings.count = 0; this.group.add(this.rings);
    // ③ 飞沫：小粒子，偏竖直
    this.P = 400; this.p = new Float32Array(this.P * 3).fill(-99); this.v = new Float32Array(this.P * 3); this.life = new Float32Array(this.P); this.next = 0;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.06, color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
    this.points.frustumCulled = false; this.group.add(this.points);
  }
  /** 一次落水 / 拆到水面：在格心起一个水花；scale ≈ 格宽 */
  spawn(cell, t = this.uTime.value) {
    const e = this.n++ % MAXE, scale = Math.max(0.5, Math.min(1.4, 0.5 * (Math.max(cell.maxX - cell.minX, cell.maxZ - cell.minZ) || 1) + 0.3));
    const m = new THREE.Matrix4().makeTranslation(cell.cx, 0, cell.cz), mc = m.clone().multiply(new THREE.Matrix4().makeScale(scale, 1, scale));
    for (let s = 0; s < CROWN_STRIPS; s++) {
      const k = e * CROWN_STRIPS + s;
      this.crown.setMatrixAt(k, mc); this.cStart.setX(k, t + this.random() * 0.05);
      this.cAng.setXY(k, (s + this.random() * 0.5) / CROWN_STRIPS * Math.PI * 2, 0.7 + this.random() * 0.5);
    }
    for (let i = 0; i < RING_DELAYS.length; i++) { const k = e * RING_DELAYS.length + i; this.rings.setMatrixAt(k, m); this.rStart.setX(k, t); this.rIdx.setXY(k, i, scale); }
    this.crown.count = Math.min(MAXE, this.n) * CROWN_STRIPS; this.rings.count = Math.min(MAXE, this.n) * RING_DELAYS.length;
    for (const a of [this.crown.instanceMatrix, this.rings.instanceMatrix, this.cStart, this.cAng, this.rStart, this.rIdx]) a.needsUpdate = true;
    const drops = 10 + Math.floor(this.random() * 3);
    for (let k = 0; k < drops; k++) {
      const a = this.random() * Math.PI * 2, i = this.next++ % this.P, sp = 0.15 + this.random() * 0.25;
      this.p.set([cell.cx + Math.cos(a) * 0.6 * scale, 0.1, cell.cz + Math.sin(a) * 0.6 * scale], i * 3);
      this.v.set([Math.cos(a) * sp, 1.8 + this.random() * 1.0, Math.sin(a) * sp], i * 3); this.life[i] = 1.4;
    }
    this.log.push({ cell: cell.id, t, drops });
    return { event: e, drops };
  }
  update(dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05); let any = false;
    for (let i = 0; i < this.P; i++) {
      if (this.life[i] <= 0) continue; any = true; this.life[i] -= dt; this.v[i * 3 + 1] -= 5.5 * dt;
      for (let a = 0; a < 3; a++) this.p[i * 3 + a] += this.v[i * 3 + a] * dt;
      if (this.p[i * 3 + 1] < 0 || this.life[i] <= 0) { this.life[i] = 0; this.p[i * 3 + 1] = -99; }
    }
    if (any || this._any) this.points.geometry.attributes.position.needsUpdate = true; this._any = any;
  }
  /** 当前活着的飞沫数（测试 / 截图度量） */
  get drops() { let n = 0; for (let i = 0; i < this.P; i++) if (this.life[i] > 0) n++; return n; }
  dispose() { this.group.removeFromParent(); for (const o of [this.crown, this.rings, this.points]) { o.geometry.dispose(); o.material.dispose(); } }
}
