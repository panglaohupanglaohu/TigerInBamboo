/**
 * waterfall.js — 瀑布（1007587812462530561 "Proper games have waterfalls"）。
 * 画面（Bad North）：深色台地边上一道道白色水帘，从河口垂到海面，底下一圈白沫。
 *
 * 做法：河格的边，外面更低（另一段河 / 海），就从河面挂一片竖直的水帘到下面的面；
 * 着色器里白色竖条纹往下流（u 方向每条水帘的条纹错开），越往下越白（水被打散）；底部一圈白沫环。
 */

import * as THREE from 'three';

export class Waterfalls {
  constructor({ scene, levelHeight = 0.5, uTime }) {
    this.L = levelHeight;
    this.uTime = uTime;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime },
      vertexShader: /* glsl */ `
        attribute vec2 aUv;          // x = 沿边（世界单位），y = 离顶部的距离（世界单位）
        attribute float aH;          // 这一道的总高度
        varying vec2 vUv; varying float vH;
        void main() { vUv = aUv; vH = aH; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv; varying float vH;
        float h(float x) { return fract(sin(x * 127.1) * 43758.5453); }
        void main() {
          float t = vUv.y / max(vH, 0.01);                  // 0 顶 … 1 底
          float col = floor(vUv.x * 26.0);
          float speed = 1.4 + h(col) * 0.8;
          float s = fract(vUv.y * 3.0 - uTime * speed + h(col + 3.0));
          float streak = smoothstep(0.55, 0.8, s) * (0.6 + 0.4 * h(col + 7.0));
          vec3 water = mix(vec3(0.62, 0.84, 0.90), vec3(1.0), clamp(t * 0.8 + streak, 0.0, 1.0));
          float a = mix(0.78, 0.95, t) * (0.85 + 0.15 * streak);
          // 两侧收一点边
          gl_FragColor = vec4(water, a);
          #include <colorspace_fragment>
        }`,
    });
    this.foamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime },
      vertexShader: /* glsl */ `
        attribute vec2 aUv; varying vec2 vUv;
        void main() { vUv = aUv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv;
        void main() {
          float r = length(vUv);
          if (r > 1.0) discard;
          float ring = smoothstep(0.35, 0.6, r) * (1.0 - smoothstep(0.8, 1.0, r));
          float pulse = 0.65 + 0.35 * sin(uTime * 5.0 + r * 9.0);
          gl_FragColor = vec4(vec3(1.0), (0.45 + 0.4 * (1.0 - r)) * pulse * max(ring, 1.0 - r));
          #include <colorspace_fragment>
        }`,
    });
    this.sheet = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.foam = new THREE.Mesh(new THREE.BufferGeometry(), this.foamMat);
    this.sheet.renderOrder = 3; this.foam.renderOrder = 4;
    this.sheet.frustumCulled = this.foam.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.sheet, this.foam);
    scene.add(this.group);
    this.count = 0;
  }

  set visible(on) { this.group.visible = on; }

  refresh(world, shape) {
    const L = this.L;
    const at = (p, s) => (shape ? shape.at(p, s) : [p.x, p.z]);
    const pos = [], uv = [], hh = [], fpos = [], fuv = [];
    let n = 0;
    for (const c of world.cells) {
      if (!world.river[c.id]) continue;
      const g = world.ground(c);
      for (let i = 0; i < c.n; i++) {
        const o = world.neighbor(c, i);
        if (!o) continue;
        const og = world.top(o);
        if (og >= g) continue;
        if (og > 0 && !world.river[o.id]) continue;     // 只落进下一段河或海里
        const a = c.pts[i], b = c.pts[(i + 1) % c.n];
        const yTop = g * L - 0.06, yBot = og > 0 ? og * L - 0.06 : 0.0;
        const [ax, az] = at(a, g), [bx, bz] = at(b, g);
        const [ax2, az2] = at(a, Math.max(og, 0)), [bx2, bz2] = at(b, Math.max(og, 0));
        // 往外推一点，别和崖壁打架
        const mx = (ax + bx) / 2 - c.cx, mz = (az + bz) / 2 - c.cz, ml = Math.hypot(mx, mz) || 1, ox = (mx / ml) * 0.03, oz = (mz / ml) * 0.03;
        const len = Math.hypot(bx - ax, bz - az), H = yTop - yBot;
        // 水帘两侧各收 15%
        const lerp = (p, q, t) => p + (q - p) * t;
        const A = [lerp(ax, bx, 0.15) + ox, yTop, lerp(az, bz, 0.15) + oz], B = [lerp(ax, bx, 0.85) + ox, yTop, lerp(az, bz, 0.85) + oz];
        const C = [lerp(ax2, bx2, 0.85) + ox * 2, yBot, lerp(az2, bz2, 0.85) + oz * 2], D = [lerp(ax2, bx2, 0.15) + ox * 2, yBot, lerp(az2, bz2, 0.15) + oz * 2];
        const u0 = (c.id % 7) * 0.37, u1 = u0 + len * 0.7;
        pos.push(...A, ...B, ...C, ...A, ...C, ...D);
        uv.push(u0, 0, u1, 0, u1, H, u0, 0, u1, H, u0, H);
        for (let k = 0; k < 6; k++) hh.push(H);
        // 白沫环
        const fx = (C[0] + D[0]) / 2 + ox * 2, fz = (C[2] + D[2]) / 2 + oz * 2, r = len * 0.5;
        const fy = yBot + 0.012;
        fpos.push(fx - r, fy, fz - r, fx + r, fy, fz - r, fx + r, fy, fz + r, fx - r, fy, fz - r, fx + r, fy, fz + r, fx - r, fy, fz + r);
        fuv.push(-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1);
        n++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1));
    this.sheet.geometry.dispose(); this.sheet.geometry = g;
    const f = new THREE.BufferGeometry();
    f.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    f.setAttribute('aUv', new THREE.Float32BufferAttribute(fuv, 2));
    this.foam.geometry.dispose(); this.foam.geometry = f;
    this.count = n;
    return n;
  }
}
