/**
 * lighthouse.js — 灯塔（1331905048801144836 "Townscaper now has lighthouses!"）。
 *   画面（逐帧核过 347 帧）：海边一根一格粗的塔，塔顶一段红/白楼身之上是
 *   ① 方形灯室：正面一排 ~5 扇大玻璃，白色竖横棂，玻璃偏蓝绿，夜里暖黄；
 *   ② 灯室下面是方形挑出的观景台 + 一圈细立杆栏杆，栏杆下沿一道红唇；
 *   ③ 灯室上面是四坡（方形）橙红屋顶 + 深色顶尖。
 *
 * 规则（我们的推断）：
 *   - 塔顶 ≥ MIN_H 层；
 *   - 塔"很细"：每个邻格都比它矮至少 2 层（一格粗的柱子）；
 *   - 在海边：至少一个邻格是海（top = 0 或没有邻格）。
 *   满足的格子：屋顶上罩灯室（灯室够高，把原来单格的尖屋顶包在里面）+ 平台 + 屋顶 + 旋转光束。
 */

import * as THREE from 'three';

const MIN_H = 5;
const PANES = 5;          // 灯室正面玻璃扇数（片中数得出 5 扇）
const POST_STEP = 0.085;  // 栏杆立杆间距（世界单位）

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
          // 5 扇玻璃 + 白色竖横棂（片子里灯室正面就是 5 扇大玻璃，白框不是黑框）
          float fx = fract(vUv.x * ${PANES}.0);
          float fy = fract(vUv.y * 2.0);
          float bars = step(fx, 0.09) + step(0.91, fx) + step(fy, 0.12) + step(0.88, fy);
          float edge = (vUv.x < 0.05 || vUv.x > 0.95 || vUv.y < 0.08 || vUv.y > 0.92) ? 1.0 : 0.0;
          vec3 glass = mix(vec3(0.42, 0.62, 0.66), vec3(1.0, 0.87, 0.5), 0.35 + 0.65 * uNight);
          vec3 c = mix(glass, vec3(0.95, 0.94, 0.90), clamp(bars + edge, 0.0, 1.0));
          c *= 0.86 + 0.14 * max(vN.y, abs(vN.x));
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
    this.capMat = new THREE.MeshLambertMaterial({ color: '#cf6a43' });   // 四坡顶：和屋顶同一种橙红，不是暗红锥
    this.rimMat = new THREE.MeshLambertMaterial({ color: '#c2543f' });
    this.frameMat = new THREE.MeshLambertMaterial({ color: '#f0ece1' });
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
      const r = c.size * 0.56, y0 = t * L;      // r = 灯室半宽（方格，比塔身略外挑）
      const g = new THREE.Group();
      g.position.set(c.cx, y0, c.cz);
      // 观景台：方形挑檐 + 红唇 + 一圈细立杆栏杆（片子里栏杆是立杆，不是圆环）
      const deckHalf = c.size * 0.7;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(deckHalf * 2, 0.035, deckHalf * 2), this.frameMat);
      deck.name = 'deck'; deck.position.y = 0.018;
      const rim = new THREE.Mesh(new THREE.BoxGeometry(deckHalf * 2.12, 0.026, deckHalf * 2.12), this.rimMat);
      rim.name = 'rim'; rim.position.y = -0.008;
      const posts = [];
      {
        const half = deckHalf * 1.02, h = 0.085;
        const count = Math.max(4, Math.round((half * 2) / POST_STEP));
        const edge = (axis, fixed, u) => (axis === 'x' ? [u, 0.035 + h / 2, fixed] : [fixed, 0.035 + h / 2, u]);
        for (let i = 0; i <= count; i++) {
          const u = -half + (2 * half * i) / count;
          for (const [axis, fixed] of [['x', half], ['x', -half], ['z', half], ['z', -half]]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.014, h, 0.014), this.darkMat);
            post.name = 'railpost';
            post.position.set(...edge(axis, fixed, u));
            posts.push(post); g.add(post);
          }
        }
        for (const [w, d, dx, dz] of [[half * 2, 0.016, 0, half], [half * 2, 0.016, 0, -half], [0.016, half * 2, half, 0], [0.016, half * 2, -half, 0]]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.014, d), this.darkMat);
          rail.name = 'railtop'; rail.position.set(dx, 0.035 + h, dz); g.add(rail);
        }
      }
      // 灯室：方形，5 扇玻璃一面
      const lanternH = 0.34;
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(r * 2, lanternH, r * 2), this.lanternMat);
      lantern.name = 'lantern';
      lantern.position.y = 0.035 + lanternH / 2;
      // 灯室下的白色檐口 + 上面的白色檐板
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(r * 2.16, 0.05, r * 2.16), this.frameMat);
      skirt.name = 'skirt'; skirt.position.y = 0.06;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(r * 2.2, 0.045, r * 2.2), this.frameMat);
      lid.name = 'lid'; lid.position.y = 0.035 + lanternH + 0.02;
      // 四坡屋顶（4 段锥 = 方锥）+ 顶尖
      const capH = 0.2;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 1.56, capH, 4), this.capMat);
      cap.name = 'roof'; cap.rotation.y = Math.PI / 4;
      cap.position.y = 0.035 + lanternH + 0.042 + capH / 2;
      const ball = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.07, 6), this.darkMat);
      ball.name = 'finial';
      ball.position.y = 0.035 + lanternH + 0.042 + capH + 0.035;
      // 光束：两道背对背的扁锥，绕竖轴转
      const beam = new THREE.Group();
      beam.position.y = 0.035 + lanternH * 0.55;
      for (const s of [1, -1]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 4.5, 16, 1, true).translate(0, -2.25, 0), this.beamMat);
        cone.rotation.z = s * Math.PI / 2;
        cone.scale.set(1, 1, 0.45);
        beam.add(cone);
      }
      g.add(deck, rim, skirt, lantern, lid, cap, ball, beam);
      g.traverse((o) => { if (o.isMesh && o.name !== 'beam') o.castShadow = true; });
      this.group.add(g);
      this.list.push({ cell: c.id, beam, posts: posts.length, phase: (c.id * 0.618) % 1 * 6.28 });
    }
    return this.list.length;
  }

  update() {
    const t = this.uTime.value;
    for (const l of this.list) l.beam.rotation.y = t * 0.9 + l.phase;
  }
}
