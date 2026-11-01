/**
 * watervol.js — 一摞采样 SDF 的平面做出的"有体积"的浅水（第三个项目）。
 *
 * 依据：1758251637280268481 "It's simply a stack of planes sampling an SDF I had laying around. Gives a much more fluid vibe
 *   than the basic flipped mesh approach in Bad North and Townscaper"
 *   画面：小岛周围的水有层次——近岸浅、透出一圈圈色带，远处深；色带边缘在微微流动。
 *
 * 做法：
 *   1. 2D 海岸距离场：岛的包围盒铺 192² 的网格，陆地格 = 0，其余用两遍 chamfer 算到最近陆地的距离（世界单位）。
 *   2. N 张水平面，叠在海面上方极小的高度上（第 i 张代表"水下 i 层"），每张只画距离 < 阈值 i 的那一圈，
 *      颜色从浅青到海色，半透明；阈值随时间和噪声轻微起伏 → 一圈套一圈、会流动的浅水。
 *   我们的海面是不透明的，所以平面叠在水面之上而不是之下；视觉上等价于"透过水看到的一层层浅滩"。
 */

import * as THREE from 'three';

export class WaterVolume {
  constructor({ scene, uTime, layers = 6 }) {
    this.uTime = uTime;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.layers = layers;
    this.tex = null;
    this.mats = [];
  }

  set visible(on) { this.group.visible = on; }

  refresh(world, index) {
    // 包围盒
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const c of world.cells) { if (!world.top(c)) continue; minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ); }
    if (!Number.isFinite(minX)) return;
    const pad = 4; minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
    const R = 192, sx = (maxX - minX) / R, sz = (maxZ - minZ) / R;
    const d = new Float32Array(R * R).fill(1e9);
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      const c = index.cellAt(minX + (x + 0.5) * sx, minZ + (y + 0.5) * sz);
      if (c && world.top(c) > 0) d[y * R + x] = 0;
    }
    // 两遍 chamfer（3-4 权重近似欧氏距离）
    const s = Math.max(sx, sz), a = s, b = s * 1.4142;
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      let v = d[y * R + x];
      if (x > 0) v = Math.min(v, d[y * R + x - 1] + a);
      if (y > 0) { v = Math.min(v, d[(y - 1) * R + x] + a); if (x > 0) v = Math.min(v, d[(y - 1) * R + x - 1] + b); if (x < R - 1) v = Math.min(v, d[(y - 1) * R + x + 1] + b); }
      d[y * R + x] = v;
    }
    for (let y = R - 1; y >= 0; y--) for (let x = R - 1; x >= 0; x--) {
      let v = d[y * R + x];
      if (x < R - 1) v = Math.min(v, d[y * R + x + 1] + a);
      if (y < R - 1) { v = Math.min(v, d[(y + 1) * R + x] + a); if (x < R - 1) v = Math.min(v, d[(y + 1) * R + x + 1] + b); if (x > 0) v = Math.min(v, d[(y + 1) * R + x - 1] + b); }
      d[y * R + x] = v;
    }
    const data = new Uint8Array(R * R * 4);
    for (let i = 0; i < R * R; i++) { const v = Math.min(255, (d[i] / 4) * 255); data[i * 4] = v; data[i * 4 + 3] = 255; }
    this.tex?.dispose();
    this.tex = new THREE.DataTexture(data, R, R, THREE.RGBAFormat);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    // 平面
    this.group.clear();
    this.mats = [];
    const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ).rotateX(-Math.PI / 2).translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    for (let i = 0; i < this.layers; i++) {
      const t = i / (this.layers - 1);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uSdf: { value: this.tex }, uTime: this.uTime, uLimit: { value: 0.25 + t * 1.6 }, uCol: { value: new THREE.Color().lerpColors(new THREE.Color('#bfe6e0'), new THREE.Color('#2f6c78'), t) }, uLayer: { value: i }, uBox: { value: new THREE.Vector4(minX, minZ, maxX - minX, maxZ - minZ) } },
        vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: /* glsl */ `
          uniform sampler2D uSdf; uniform float uTime; uniform float uLimit; uniform vec3 uCol; uniform float uLayer; uniform vec4 uBox;
          varying vec3 vW;
          void main() {
            vec2 uv = (vW.xz - uBox.xy) / uBox.zw;
            float d = texture2D(uSdf, uv).r * 4.0;                 // 到最近陆地的距离（世界单位）
            float wob = sin(vW.x * 1.7 + uTime * 0.6 + uLayer) * 0.06 + sin(vW.z * 2.3 - uTime * 0.45 + uLayer * 1.3) * 0.05;
            float edge = uLimit + wob;
            if (d <= 0.02 || d > edge) discard;
            float a = 0.2 * (1.0 - smoothstep(edge - 0.25, edge, d));
            float rim = 1.0 - smoothstep(0.0, 0.035, edge - d);           // 每层边缘一道亮线 = "等高线"
            gl_FragColor = vec4(mix(uCol, vec3(1.0), rim * 0.7), max(a, rim * 0.45));
            #include <colorspace_fragment>
          }`,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.y = 0.004 + i * 0.0015;
      m.renderOrder = 2.5;   // 在岸边光晕（skirt，2）之后、浪（3）之前
      this.group.add(m);
      this.mats.push(mat);
    }
  }
}
