/**
 * effects.js — 建造时的反馈：水花、出现 / 消失动画、火。
 *
 * 依据：
 *   1258421104756097029 "We were long overdue for some splashier splashes"
 *     画面：往水里放一块 → 一圈白色泡沫环向外扩、中间溅起一团水花；拆掉也有。
 *   1246074663546916873 "The props now animate when they appear and disappear. This was much trickier than I anticipated."
 *     画面：原片道具随布局变化出现/消失；当前代码仅做柱顶增长缩放和拆除灰尘，不是完整逐道具生命周期。
 *   1056990611738451968 "New fire effect. For blend mode, I use Max instead of Add … the particles blend together
 *     and form a common silhouette."  1056999668486471682 "Works well in daylight too, largely thanks to the max blend"
 *     画面：烟囱 / 屋顶上的火是一团团软圆粒子，黄 → 橙 → 红，互相融成一个整体轮廓，白天也不发白。
 *
 * 出现动画在主材质的顶点着色器里做（world/view.js 注入）：最近 8 次"长高"的格子，
 *   格心周围、原高度以上的顶点按弹性曲线按本地 0.45s 曲线从 0.35 缩放到 1（并非由视频恢复的参数）—— 合并成一个网格之后
 *   没法单独动某个道具，这是把"哪里刚变了"作为 uniform 交给着色器的办法。
 * 消失：几何已经没了，补一团往上飘、慢慢变淡的灰尘。
 */

import * as THREE from 'three';

const MAX_POPS = 8;

/** 主材质用：弹性出现。返回要并进 onBeforeCompile 的 uniforms 和 GLSL 片段。 */
export function popShaderChunk() {
  return {
    uniforms: { uPops: { value: Array.from({ length: MAX_POPS }, () => new THREE.Vector4(0, 0, 0, -99)) }, uPopY: { value: new Array(MAX_POPS).fill(0) } },
    pars: /* glsl */ `
      uniform vec4 uPops[${MAX_POPS}];   // x, z, 半径, 开始时间
      uniform float uPopY[${MAX_POPS}];  // 原来的顶高（以上的部分才缩放）
      float popCurve(float a) {          // 0 → 1，带一点过冲
        float t = clamp(a / 0.45, 0.0, 1.0);
        return 0.35 + 0.65 * (1.0 + 1.35 * pow(t - 1.0, 3.0) + 0.35 * pow(t - 1.0, 2.0));
      }`,
    body: /* glsl */ `
      for (int i = 0; i < ${MAX_POPS}; i++) {
        vec4 P = uPops[i];
        float age = uTime - P.w;
        if (age < 0.0 || age > 0.45) continue;
        vec2 d = transformed.xz - P.xy;
        if (dot(d, d) > P.z * P.z || transformed.y < uPopY[i] - 0.01) continue;
        float s = popCurve(age);
        transformed.xz = P.xy + d * s;
        transformed.y = uPopY[i] + (transformed.y - uPopY[i]) * s;
      }`,
  };
}

export class Effects {
  constructor({ scene, uTime, popUniforms, random = Math.random }) {
    this.random = random; this.fireShrink = 2;
    this.uTime = uTime;
    this.pop = popUniforms;
    this.popIdx = 0;
    this.group = new THREE.Group();
    scene.add(this.group);

    // 泡沫环（水花）：一个实例化的圆环，按年龄扩大、变淡
    const ring = new THREE.RingGeometry(0.75, 1, 40);
    ring.rotateX(-Math.PI / 2);
    this.ringAge = new THREE.InstancedBufferAttribute(new Float32Array(32).fill(99), 1);
    ring.setAttribute('aStart', this.ringAge);
    this.rings = new THREE.InstancedMesh(ring, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime },
      vertexShader: /* glsl */ `
        attribute float aStart;
        uniform float uTime;
        varying float vA;
        void main() {
          float age = uTime - aStart;
          float r = 0.12 + age * 0.9;
          vec3 o = (instanceMatrix * vec4(0, 0, 0, 1)).xyz;
          vA = age < 0.0 ? 0.0 : clamp(1.0 - age / 1.1, 0.0, 1.0);
          vec3 p = o + position * r * (0.4 + 0.6 * length(instanceMatrix[0].xyz));
          p.y = 0.02;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          if (vA <= 0.0) discard;
          gl_FragColor = vec4(1.0, 1.0, 1.0, vA * 0.85);
          #include <colorspace_fragment>
        }`,
    }), 32);
    this.rings.frustumCulled = false;
    this.rings.renderOrder = 5;
    this.ringN = 0;
    this.group.add(this.rings);

    // 粒子（水花飞沫 / 灰尘）：CPU 小粒子池
    this.N = 600;
    this.p = new Float32Array(this.N * 3); this.v = new Float32Array(this.N * 3); this.life = new Float32Array(this.N); this.kind = new Uint8Array(this.N);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.col = new Float32Array(this.N * 3);
    pg.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.next = 0;

    // 火：Max 混合的软粒子（1056990611738451968）
    this.fireN = 900;
    this.fp = new Float32Array(this.fireN * 3); this.fv = new Float32Array(this.fireN * 3); this.flife = new Float32Array(this.fireN);
    this.fspan = new Float32Array(this.fireN);
    this.fsize = new Float32Array(this.fireN); this.fage = new Float32Array(this.fireN);
    const fg = new THREE.BufferGeometry();
    fg.setDrawRange(0, 0);
    fg.setAttribute('position', new THREE.BufferAttribute(this.fp, 3));
    fg.setAttribute('aSize', new THREE.BufferAttribute(this.fsize, 1));
    fg.setAttribute('aAge', new THREE.BufferAttribute(this.fage, 1));
    this.fire = new THREE.Points(fg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAge;
        varying float vAge;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * 380.0 / -mv.z;
          vAge = aAge;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vAge;
        void main() {
          // Point size zero may clamp to one pixel: expired particles must discard.
          if (vAge >= 1.0) discard;
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float m = 1.0 - smoothstep(0.55, 1.0, r);                       // 软圆
          if (m <= 0.0) discard;
          vec3 hot = vec3(1.0, 0.93, 0.6), mid = vec3(1.0, 0.55, 0.18), cool = vec3(0.85, 0.2, 0.12);
          vec3 c = vAge < 0.5 ? mix(hot, mid, vAge * 2.0) : mix(mid, cool, (vAge - 0.5) * 2.0);
          // Max 混合：颜色乘遮罩，重叠处取最大值 → 融成一个轮廓，不会加成一片白
          gl_FragColor = vec4(c * m, m);
          #include <colorspace_fragment>
        }`,
    }));
    this.fire.frustumCulled = false;
    this.fire.visible = false;
    this.fire.renderOrder = 7;
    this.group.add(this.fire);
    this.fireSources = [];
  }

  set showFire(on) { this.fire.visible = on; }
  setFireSources(list) { this.fireSources = list; if (!list.length) this.clearFire(); }
  // 1056990611738451968: additive is a diagnostic comparison, max remains default.
  // 1056992291108413446: power 2 shrinks faster than a linear profile.
  setFireAppearance({ blend = 'max', shrink = 2 } = {}) {
    if (!['max', 'add'].includes(blend) || !Number.isFinite(shrink) || shrink < 1 || shrink > 6) throw new RangeError('Invalid fire appearance');
    this.fireShrink = shrink;
    this.fire.material.blendEquation = blend === 'max' ? THREE.MaxEquation : THREE.AddEquation;
  }
  clearFire() { this.flife.fill(0); this.fspan.fill(0); this.fsize.fill(0); this.fage.fill(0); this.fire.geometry.setDrawRange(0, 0); }
  dispose() { this.group.removeFromParent(); for (const o of [this.rings, this.points, this.fire]) { o.geometry.dispose(); o.material.dispose(); } this.clearFire(); this.fireSources = []; }


  /** 建造 / 拆除时调用：before / after 是这格之前和之后的顶层（层号）。 */
  onEdit(cell, before, after, L) {
    const t = this.uTime.value;
    if (after > before) {
      // 出现：交给主材质的弹性缩放
      const k = this.popIdx++ % this.pop.uPops.value.length;
      const r = Math.max(cell.maxX - cell.minX, cell.maxZ - cell.minZ) * 0.75 + 0.08;
      this.pop.uPops.value[k].set(cell.cx, cell.cz, r, t);
      this.pop.uPopY.value[k] = before * L;
      if (before === 0) this.#splash(cell, t);     // 第一块落进水里
    } else if (after < before) {
      this.#dust(cell, before * L);
      if (after === 0) this.#splash(cell, t);
    }
  }

  #splash(cell, t) {
    const i = this.ringN++ % 32;
    const m = new THREE.Matrix4().makeTranslation(cell.cx, 0, cell.cz);
    m.scale(new THREE.Vector3(1.2, 1, 1.2));
    this.rings.setMatrixAt(i, m);
    this.ringAge.setX(i, t);
    this.rings.count = Math.min(32, this.ringN);
    this.rings.instanceMatrix.needsUpdate = true;
    this.ringAge.needsUpdate = true;
    for (let k = 0; k < 26; k++) {
      const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 0.9;
      this.#emit(cell.cx + Math.cos(a) * 0.12, 0.05, cell.cz + Math.sin(a) * 0.12, Math.cos(a) * sp * 0.5, 1.2 + Math.random() * 1.1, Math.sin(a) * sp * 0.5, 0.9, [1, 1, 1], 0);
    }
  }

  #dust(cell, y) {
    for (let k = 0; k < 18; k++) {
      this.#emit(cell.cx + (Math.random() - 0.5) * 0.3, y - Math.random() * 0.2, cell.cz + (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.25, 0.25 + Math.random() * 0.35, (Math.random() - 0.5) * 0.25, 1.1, [0.85, 0.83, 0.78], 1);
    }
  }

  #emit(x, y, z, vx, vy, vz, life, c, kind) {
    const i = this.next++ % this.N;
    this.p.set([x, y, z], i * 3); this.v.set([vx, vy, vz], i * 3); this.col.set(c, i * 3);
    this.life[i] = life; this.kind[i] = kind;
  }

  update(dt, wind) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid effects timestep');
    dt = Math.min(dt, 0.05);
    // 飞沫 / 灰尘
    let alive = false;
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { this.p[i * 3 + 1] = -99; continue; }
      alive = true;
      this.life[i] -= dt;
      const g = this.kind[i] === 0 ? -5.5 : -0.1;
      this.v[i * 3 + 1] += g * dt;
      for (let a = 0; a < 3; a++) this.p[i * 3 + a] += this.v[i * 3 + a] * dt;
      if (this.kind[i] === 0 && this.p[i * 3 + 1] < 0) this.life[i] = 0;
    }
    if (alive) { this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true; }

    // 火：从火源往上冒，风吹得偏一点
    if (!this.fire.visible || !this.fireSources.length) return;
    const w = wind ?? new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < this.fireN; i++) {
      if (this.flife[i] <= 0) {
        const s = this.fireSources[(this.random() * this.fireSources.length) | 0];
        this.fp.set([s.x + (this.random() - 0.5) * 0.06, s.y, s.z + (this.random() - 0.5) * 0.06], i * 3);
        this.fv.set([(this.random() - 0.5) * 0.08, 0.35 + this.random() * 0.3, (this.random() - 0.5) * 0.08], i * 3);
        this.flife[i] = this.fspan[i] = 0.6 + this.random() * 0.7;
        this.fage[i] = 0;
        this.fsize[i] = 0.13 * (0.8 + 0.4 * ((i * 0.618) % 1));
        continue;
      }
      this.flife[i] -= dt;
      this.fage[i] = Math.min(1, 1 - Math.max(0, this.flife[i]) / this.fspan[i]);
      this.fv[i * 3] += w.x * 0.25 * dt; this.fv[i * 3 + 2] += w.z * 0.25 * dt;
      for (let a = 0; a < 3; a++) this.fp[i * 3 + a] += this.fv[i * 3 + a] * dt;
      // 1056992291108413446 "The quads above shrink way more than they are supposed to. This looks much better and breaks up
      // the flame in a much more interesting way"：往上缩得比"应该的"快得多，火焰顶端碎成小块
      const k = 1 - this.fage[i];
      this.fsize[i] = 0.13 * Math.pow(k, this.fireShrink) * (0.8 + 0.4 * ((i * 0.618) % 1));
    }
    this.fire.geometry.setDrawRange(0, this.fireN);
    const ga = this.fire.geometry.attributes;
    ga.position.needsUpdate = ga.aSize.needsUpdate = ga.aAge.needsUpdate = true;
  }
}
