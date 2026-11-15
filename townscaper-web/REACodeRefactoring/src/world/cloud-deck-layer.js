/**
 * cloud-deck-layer.js — 第 55 批（G2）：把 core/cloud-depth.js 的 makeCloudDeck 接进 View 渲染。
 *
 * 1243228419162341379 "Some moody clouds"：画面是小镇背后一整面**高耸、成团往上堆的云体**，
 * 三层前后叠着，离得越远越淡、越糊、飘得越慢（REACode clouddeck.js：速度 = 风 / 深度，模糊 ∝ 深度）。
 *
 * 这里做两件事，都吃同一份 deck 数据：
 *   1. 云体：三圈围着岛的圆柱带（半径随深度增大），片元着色器在（弧长 s, 高度 y）平面上
 *      用 deck 的团块画"一团压一团"的积云轮廓（每个团块 = 底部大圆 + 两侧小圆 + 往上逐级变小的三个圆，
 *      密度取 max —— 和 deck.density 一样不累加），按层的 depth 做视差平移和边缘模糊。
 *      towerDensity() 是同一公式的 CPU 版，供 node 测试。
 *   2. 云影：近层和中层的团块喂进 View 已有的 CloudShadow 着色器（地形 / 屋顶都用 cloudShadowTone），
 *      投影沿太阳方向落到任意高度的接收面——与 deck.shadowAt 同一几何。图集换成一张程序化的
 *      椭圆软斑（原版云材质没有，属于替代）。
 * 默认关；由 view-post-extras.js 的 'clouddeck' 开关控制。
 */
import * as THREE from 'three';
import { makeCloudDeck, CLOUD_DECK_LAYERS } from '../core/cloud-depth.js';

export const TOWER_PUFFS = 24;
const RING_HEIGHT = 16;

/** 每个团块的六个圆（底部大圆 + 两侧 + 逐级变小往上堆；相对团块中心 s 与底部 y0，以半径 r 为单位）。 */
const LOBES = Object.freeze([[0, .55, 1], [.55, 1.15, .72], [-.38, 1.75, .56], [.95, .5, .62], [-.9, .72, .55], [.18, 2.25, .4]]);

/** 把 deck 的一层团块换算成圆柱带上的塔：s ∈ [0,C)，r 世界单位，k 高度系数。 */
export function towerPuffs(layer, circumference, span) {
  return layer.puffs.slice(0, TOWER_PUFFS).map((p) => ({ s: p.x / span * circumference, r: (2 + p.rx * .2) * (.75 + .3 * layer.depth), k: p.k }));
}

/** CPU 版：塔面上（弧长 s, 高度 y）处的密度 0..1，time 秒，speed = 风/深度。 */
export function towerDensity(puffs, s, y, { circumference, base = -1, time = 0, speed = 0 } = {}) {
  let d = 0;
  for (const p of puffs) {
    for (const [ox, oy, rr] of LOBES) {
      let ds = s - (p.s + time * speed + ox * p.r);
      ds -= Math.round(ds / circumference) * circumference;
      const dy = y - (base + oy * p.r * p.k);
      const R = rr * p.r, q = (ds * ds + dy * dy) / (R * R);
      if (q < 1) d = Math.max(d, 1 - q);
    }
  }
  return d;
}

const TOWER_GLSL = /* glsl */ `
uniform vec4 uPuffs[${TOWER_PUFFS}];
uniform int uCount;
uniform float uC;
uniform float uBase;
uniform float uShift;
uniform float uBlur;
uniform float uAlpha;
uniform vec3 uLit;
uniform vec3 uShade;
uniform vec3 uFogCol;
uniform float uFogMix;
varying vec2 vSY;
float lobe(vec2 c, float R) {
  vec2 d = vSY - c; d.x -= floor(d.x / uC + .5) * uC;
  return 1. - dot(d, d) / (R * R);
}
void main() {
  float dens = 0.; float topY = 0.;
  for (int i = 0; i < ${TOWER_PUFFS}; i++) {
    if (i >= uCount) break;
    vec4 p = uPuffs[i];
    float s = p.x + uShift;
    float a = lobe(vec2(s, uBase + .55 * p.y * p.z), p.y);
    float b = lobe(vec2(s + .55 * p.y, uBase + 1.15 * p.y * p.z), .72 * p.y);
    float c = lobe(vec2(s - .38 * p.y, uBase + 1.75 * p.y * p.z), .56 * p.y);
    float d = lobe(vec2(s + .95 * p.y, uBase + .5 * p.y * p.z), .62 * p.y);
    float e = lobe(vec2(s - .9 * p.y, uBase + .72 * p.y * p.z), .55 * p.y);
    float f = lobe(vec2(s + .18 * p.y, uBase + 2.25 * p.y * p.z), .4 * p.y);
    float m = max(max(a, max(b, c)), max(d, max(e, f)));
    if (m > dens) { dens = m; topY = uBase + 2.65 * p.y * p.z; }
  }
  // 底部融进海雾（原片云墙下沿是软的，没有地平线硬边）
  float alpha = smoothstep(0., uBlur, dens) * uAlpha * smoothstep(uBase + .5, uBase + 4.5, vSY.y);
  if (alpha < .01) discard;
  // 上亮下暗（顶部受光，底部压暗），边缘略亮一点（软边透光）
  float h = clamp((vSY.y - uBase) / max(.001, topY - uBase), 0., 1.);
  vec3 col = mix(uShade, uLit, smoothstep(.05, .95, h));
  col = mix(col, uLit, (1. - smoothstep(0., uBlur * 1.5, dens)) * .35);
  col = mix(col, uFogCol, uFogMix);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

export class CloudDeckLayer {
  constructor(view, { seed = 7 } = {}) {
    this.view = view;
    this.enabled = false;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.renderOrder = -3;
    view.scene.add(this.group);
    this.seed = seed;
    this.rings = [];
    this.shadowStrength = .46;
    // 程序化云影图集：64² 椭圆软斑（alpha），CloudShadow 着色器按 smoothstep(.05,.55,a) 读
    const N = 64, px = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = (i + .5) / N * 2 - 1, v = (j + .5) / N * 2 - 1, q = u * u + v * v, a = q < 1 ? (1 - q) : 0, k = (j * N + i) * 4;
      px[k] = px[k + 1] = px[k + 2] = 255; px[k + 3] = Math.round(Math.min(1, a) * 255);
    }
    this.atlas = new THREE.DataTexture(px, N, N, THREE.RGBAFormat);
    this.atlas.magFilter = this.atlas.minFilter = THREE.LinearFilter; this.atlas.needsUpdate = true;
    this.version = -1;
  }

  /** 按岛的范围（World 顶面包围盒）重建 deck 与三圈塔。 */
  rebuild() {
    const v = this.view, w = v.town;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const c of w.cells) if (w.top(c)) { minX = Math.min(minX, c.minX); maxX = Math.max(maxX, c.maxX); minZ = Math.min(minZ, c.minZ); maxZ = Math.max(maxZ, c.maxZ); }
    if (!Number.isFinite(minX)) { minX = minZ = -6; maxX = maxZ = 6; }
    this.center = [(minX + maxX) / 2, (minZ + maxZ) / 2];
    this.radius = Math.max(maxX - minX, maxZ - minZ) / 2;
    const span = Math.max(40, this.radius * 4);
    this.deck = makeCloudDeck({ span, seed: this.seed, wind: [1.2, 0] });
    for (const r of this.rings) { r.mesh.geometry.dispose(); r.mesh.material.dispose(); r.mesh.removeFromParent(); }
    this.rings = [];
    const fog = v.scene.background?.isColor ? v.scene.background.clone() : new THREE.Color('#9fbfc4');
    this.deck.layers.forEach((L, li) => {
      const R = Math.max(this.radius + 16, (v.distance ?? 30) * 1.5) + (L.depth - 1) * 14, C = Math.PI * 2 * R;
      const puffs = towerPuffs(L, C, span);
      const geo = new THREE.CylinderGeometry(R, R, RING_HEIGHT, 96, 1, true);
      geo.translate(0, RING_HEIGHT / 2 - 1.5, 0);
      // 弧长 + 高度（世界单位）作为 varying
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
        uniforms: {
          uPuffs: { value: puffs.map((p) => new THREE.Vector4(p.s, p.r, p.k, 0)).concat(Array.from({ length: TOWER_PUFFS - puffs.length }, () => new THREE.Vector4())) },
          uCount: { value: puffs.length }, uC: { value: C }, uBase: { value: -1 }, uShift: { value: 0 },
          uBlur: { value: .08 * L.blur }, uAlpha: { value: Math.min(.95, L.alpha + .12) },
          uLit: { value: new THREE.Color('#f4f6f2') }, uShade: { value: new THREE.Color('#9aaeb4') },
          uFogCol: { value: fog }, uFogMix: { value: (L.depth - 1) / 2.2 * .55 },
        },
        vertexShader: /* glsl */ `varying vec2 vSY; uniform float uC;
          void main(){ float a = atan(position.x, position.z); vSY = vec2((a / 6.28318530718 + .5) * uC, position.y);
            vec4 wp = modelMatrix * vec4(position, 1.); gl_Position = projectionMatrix * viewMatrix * wp; gl_Position.z = gl_Position.w * (.99985 - .00004 * ${li}.); }`,
        fragmentShader: TOWER_GLSL,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(this.center[0], 0, this.center[1]);
      mesh.renderOrder = -3 + li;   // 远层先画
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.rings.push({ mesh, layer: L, C, R, puffs });
    });
    this.version = w.version;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.enabled && !this.deck) this.rebuild();
    this.group.visible = this.enabled;
  }

  /** 每帧：塔的视差平移 + 云影喂给 CloudShadow（在 View.cloudShadow.update 之后调用）。 */
  update() {
    if (!this.enabled) return;
    const v = this.view, t = v.waterUniforms.uTime.value;
    if (!this.deck || this.version !== v.town.version) this.rebuild();
    for (const r of this.rings) r.mesh.material.uniforms.uShift.value = t * r.layer.vx * .8;
    // 云影：近层 + 中层团块（与 deck.density 同位置、同漂移），只取覆盖岛的
    const u = v.cloudShadow.uniforms, [cx, cz] = this.center, span = this.deck.span;
    const wrap = (x) => ((x % span) + span * 1.5) % span - span * .5;
    let n = 0;
    for (const li of [2, 1]) {
      const L = this.deck.layers[li];
      for (const p of L.puffs) {
        const x = cx + wrap(p.x + t * L.vx), z = cz + wrap(p.z + t * L.vz);
        if (Math.abs(x - cx) > this.radius + p.rx + 4 || Math.abs(z - cz) > this.radius + p.rz + 4) continue;
        // deck 的椭圆（rx × rz，沿风向拉长）拆成一串直径 2·rz 的圆，排在长轴上
        const k = Math.max(1, Math.round(p.rx / p.rz));
        for (let j = 0; j < k && n < 64; j++) {
          const f = k === 1 ? 0 : (j / (k - 1) - .5) * 2 * (p.rx - p.rz);
          u.uCloudPuffs.value[n++].set(x + f, L.height, z, 2 * p.rz * Math.min(1.1, p.k + .2));
        }
      }
    }
    u.uCloudAtlas.value = this.atlas;
    u.uCloudRect.value.set(0, 0, 1, 1);
    u.uCloudSun.value.copy(v.sunDir);
    u.uCloudCount.value = n;
    u.uCloudStrength.value = this.shadowStrength;
    this.stats = { shadowPuffs: n, rings: this.rings.length, layers: CLOUD_DECK_LAYERS.map((l) => l.depth) };
  }

  dispose() {
    for (const r of this.rings) { r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
    this.group.removeFromParent(); this.atlas.dispose();
  }
}
