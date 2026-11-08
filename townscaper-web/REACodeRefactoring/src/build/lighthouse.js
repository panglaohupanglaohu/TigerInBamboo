/**
 * lighthouse.js — 灯塔（1331905048801144836 "Townscaper now has lighthouses!"）。
 *   画面：海边一根又高又细、只有一格粗的塔，顶上是一圈玻璃灯室（深色窗棂、暖黄的光）、外面一圈栏杆平台、
 *   上面一个尖顶；入夜后灯室发亮，一道光束在海上转圈。
 *
 * 规则（我们的推断）：
 *   - 塔顶 ≥ MIN_H 层；
 *   - 塔"很细"：每个邻格都比它矮至少 2 层（一格粗的柱子）；
 *   - 在海边：至少一个邻格是海（top = 0 或没有邻格）。
 *   满足的格子：屋顶上罩灯室（灯室够高，把原来单格的尖屋顶包在里面）+ 平台 + 尖顶 + 旋转光束。
 *   原片说"这个图案需要的代码重写比想象中多"——在我们的结构里它只是一个"看邻居"的模式，单独成一层装饰。
 */

import * as THREE from 'three';

const MIN_H = 5;

export class Lighthouses {
  constructor({ scene, levelHeight = 0.5, uTime, uNight }) {
    this.L = levelHeight;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.uTime = uTime; this.uNight = uNight;
    this.list = [];
    this.lanternMat = new THREE.ShaderMaterial({
      uniforms: { uTime, uNight },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; void main() { vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uNight; varying vec2 vUv; varying vec3 vN;
        void main() {
          float bars = step(0.86, fract(vUv.x * 8.0));                      // 8 根竖窗棂
          float rail = step(vUv.y, 0.12) + step(0.9, vUv.y);                 // 上下两道框
          vec3 glass = mix(vec3(0.62, 0.74, 0.74), vec3(1.0, 0.86, 0.48), 0.35 + 0.65 * uNight);
          vec3 c = mix(glass, vec3(0.16, 0.17, 0.18), clamp(bars + rail, 0.0, 1.0));
          c *= 0.82 + 0.18 * max(vN.y, abs(vN.x));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uNight },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uNight; varying vec2 vUv;
        void main() {
          float a = vUv.y * vUv.y * 0.5 * (0.08 + 0.92 * uNight);           // 越远越淡；白天几乎看不见
          gl_FragColor = vec4(vec3(1.0, 0.9, 0.6) * a, 1.0);
        }`,
    });
    this.darkMat = new THREE.MeshLambertMaterial({ color: '#2b2e31' });
    this.capMat = new THREE.MeshLambertMaterial({ color: '#b5463a' });
  }

  set visible(on) { this.group.visible = on; }

  refresh(world) {
    this.group.clear();
    this.list = [];
    const L = this.L;
    for (const c of world.cells) {
      const t = world.top(c);
      if (t < MIN_H || world.isRock(c, t)) continue;   // 岩柱不算塔：顶上必须是建筑
      let slim = true, sea = false;
      for (let i = 0; i < c.n; i++) {
        const o = world.neighbor(c, i);
        const ot = o ? world.top(o) : 0;
        if (ot > t - 2) slim = false;
        if (ot === 0) sea = true;
      }
      if (!slim || !sea) continue;
      const r = c.size * 1.05, y0 = t * L;
      const g = new THREE.Group();
      g.position.set(c.cx, y0, c.cz);
      // 平台 + 栏杆
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.45, r * 1.3, 0.04, 16), this.darkMat);
      deck.position.y = 0.02;
      const rail = new THREE.Mesh(new THREE.TorusGeometry(r * 1.42, 0.008, 4, 24), this.darkMat);
      rail.rotation.x = Math.PI / 2; rail.position.y = 0.11;
      // 灯室（玻璃 + 窗棂）
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.36, 16, 1, true), this.lanternMat);
      lantern.position.y = 0.04 + 0.18;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.03, 16), this.darkMat);
      lid.position.y = 0.415;
      // 尖顶 + 顶球
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 1.05, 0.22, 16), this.capMat);
      cap.position.y = 0.54;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), this.darkMat);
      ball.position.y = 0.66;
      // 光束：两道背对背的扁锥，绕竖轴转
      const beam = new THREE.Group();
      beam.position.y = 0.22;
      for (const s of [1, -1]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 4.5, 16, 1, true).translate(0, -2.25, 0), this.beamMat);
        cone.rotation.z = s * Math.PI / 2;
        cone.scale.set(1, 1, 0.45);
        beam.add(cone);
      }
      g.add(deck, rail, lantern, lid, cap, ball, beam);
      this.group.add(g);
      this.list.push({ cell: c.id, beam, phase: (c.id * 0.618) % 1 * 6.28 });
    }
    return this.list.length;
  }

  update() {
    const t = this.uTime.value;
    for (const l of this.list) l.beam.rotation.y = t * 0.9 + l.phase;
  }
}
