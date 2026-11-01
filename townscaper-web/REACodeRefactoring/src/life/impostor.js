/**
 * impostor.js — 八方位 impostor（树林）+ 共用 impostor 的云。
 *
 * 依据：
 *   1849427564034498642 "octagonal impostors for these trees … a lot more stable when rotating the camera
 *     than all other billboard solutions I've tried"
 *     画面：球面上大片树林，每棵都是一团圆冠，转镜头时轮廓不跳。
 *   1852334860137849222 "A fluffy cloud shader. It is using the same impostors as the trees"
 *     画面：白色蓬松的云团成带状飘过岛屿上空，底部略灰。
 *   1593215065423245313 运行时从网格烘出精灵、放进动态图集 → 用 core/atlas.js 分配图集里的格子。
 *
 * 做法：
 *   烘焙：每种网格从水平方向 8 个方位（每 45°，仰角固定）各拍一张，放进图集里分配到的格子；
 *         白色材质 + 固定光照 → 图里存的是"明暗"，实例颜色在着色器里再乘上去（一套图给所有颜色的树用）。
 *   绘制：每棵树一个竖直的四边形（只绕 Y 轴朝向镜头）；按"镜头相对这棵树朝向的方位角"
 *         找相邻两个方位的图，按角度插值混合 —— 这就是比普通广告牌转镜头时稳定的原因。
 *   云：同一个烘焙器烘一团白色的"云团块"，实例放大很多、半透明边缘、沿风向慢慢飘。
 */

import * as THREE from 'three';
import { Atlas } from '../core/atlas.js';

const VIEWS = 8;
const CELL = 128;
const ELEV = 0.42;   // 烘焙仰角（弧度）：接近游戏镜头的俯角

export class ImpostorBaker {
  constructor(renderer, size = 1024) {
    this.renderer = renderer;
    this.atlas = new Atlas(size, size);
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
    // 缩小时不闪：开 mipmap（图集格子之间留了边，低级别 mip 不会串到隔壁格子）
    this.rt.texture.generateMipmaps = true;
    this.rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.size = size;
    this.cleared = false;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(-0.6, 1.4, 0.8);
    this.scene.add(sun);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  }

  /**
   * 烘一种网格的 8 个方位，返回 { frames: [u0,v0,du,dv]×8, size: 世界尺寸, base: 底部偏移 }。
   */
  bake(geometry, CELL = 128) {
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const c = bb.getCenter(new THREE.Vector3());
    const ext = bb.getSize(new THREE.Vector3());
    const half = Math.max(ext.x, ext.y, ext.z) * 0.62;
    const mesh = new THREE.Mesh(geometry, this.mat);
    this.scene.add(mesh);
    const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, half * 8);
    const r = this.renderer;
    const prevRT = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.rt);
    if (!this.cleared) { r.setClearColor(0x000000, 0); r.clear(true, true, true); this.cleared = true; }
    const frames = [];
    for (let k = 0; k < VIEWS; k++) {
      const PADC = 8;                              // 每格四周留 8px
      const slot0 = this.atlas.allocate(CELL + PADC * 2, CELL + PADC * 2);
      const slot = slot0 && { x: slot0.x + PADC, y: slot0.y + PADC };
      if (!slot) throw new Error('impostor 图集满了');
      const a = (k / VIEWS) * Math.PI * 2;
      cam.position.set(c.x + Math.sin(a) * Math.cos(ELEV) * half * 4, c.y + Math.sin(ELEV) * half * 4, c.z + Math.cos(a) * Math.cos(ELEV) * half * 4);
      cam.lookAt(c);
      this.rt.viewport.set(slot.x, slot.y, CELL, CELL);
      this.rt.scissor.set(slot.x, slot.y, CELL, CELL);
      this.rt.scissorTest = true;
      r.setRenderTarget(this.rt);
      r.setClearColor(0x000000, 0);
      r.clear(true, true, true);
      r.render(this.scene, cam);
      frames.push(slot.x / this.size, slot.y / this.size, CELL / this.size, CELL / this.size);
    }
    this.rt.scissorTest = false;
    this.rt.viewport.set(0, 0, this.size, this.size);
    r.setRenderTarget(prevRT);
    r.setClearColor(prevClear, prevAlpha);
    this.scene.remove(mesh);
    // 四边形的世界尺寸 = 烘焙相机的视野宽度；中心对准包围盒中心
    return { frames, size: half * 2, center: c.clone() };
  }
}

/**
 * 一组同种网格的 impostor 实例（树冠 / 云）。
 * 实例矩阵：平移 = 网格原点所在位置，Y 旋转 = 朝向，缩放 = 大小。
 */
export class ImpostorField {
  constructor(texture, baked, max, { cloud = false, uTime = { value: 0 }, uLight = { value: 1 } } = {}) {
    const g = new THREE.PlaneGeometry(1, 1);
    this.color = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.yaw = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    g.setAttribute('aColor', this.color);
    g.setAttribute('aYaw', this.yaw);
    const fr = [];
    for (let i = 0; i < VIEWS; i++) fr.push(new THREE.Vector4(...baked.frames.slice(i * 4, i * 4 + 4)));
    this.material = new THREE.ShaderMaterial({
      transparent: cloud,
      depthWrite: !cloud,
      side: THREE.DoubleSide,
      uniforms: {
        uTex: { value: texture }, uFrames: { value: fr }, uSize: { value: baked.size },
        uCenter: { value: baked.center }, uTime, uLight,
      },
      defines: { CLOUD: cloud ? 1 : 0, VIEWS },
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aYaw;
        uniform float uSize;
        uniform vec3 uCenter;
        uniform float uTime;
        uniform vec4 uFrames[VIEWS];
        varying vec4 vF0;
        varying vec4 vF1;
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vK;
        varying float vT;
        void main() {
          float s = length(instanceMatrix[0].xyz);
          vec3 origin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec3 center = origin + uCenter * s;
          #if CLOUD
            center.x += mod(uTime * 0.12 + aYaw * 7.0, 40.0) - 20.0;   // 沿风向慢慢飘，飘出去从另一边回来
          #endif
          vec3 toCam = cameraPosition - center;
          vec3 hdir = normalize(vec3(toCam.x, 0.0, toCam.z) + vec3(1e-5));
          vec3 right = vec3(hdir.z, 0.0, -hdir.x);
          vec3 up = vec3(0.0, 1.0, 0.0);
          vec3 p = center + (right * position.x + up * position.y) * uSize * s;
          // 镜头相对这棵树的方位角 → 第几张图（相邻两张按 t 混合）
          float az = atan(hdir.x, hdir.z) - aYaw;
          float f = mod(az / 6.2831853 * float(VIEWS) + float(VIEWS), float(VIEWS));
          vK = floor(f);
          vT = f - vK;
          // 在顶点着色器里选好两张图（整块四边形都一样），片元里就能无条件采样
          // —— 在条件分支里采样会让 mip 级别的导数失效，云会一片片地闪（之前的"雪花点"就是这个）
          int k0 = int(vK), k1 = int(mod(vK + 1.0, float(VIEWS)));
          vF0 = uFrames[0]; vF1 = uFrames[0];
          for (int i = 0; i < VIEWS; i++) { if (i == k0) vF0 = uFrames[i]; if (i == k1) vF1 = uFrames[i]; }
          vUv = position.xy + 0.5;
          vCol = aColor;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform float uLight;
        varying vec4 vF0;
        varying vec4 vF1;
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vK;
        varying float vT;
        void main() {
          vec4 a = texture2D(uTex, vF0.xy + vUv * vF0.zw);
          vec4 b = texture2D(uTex, vF1.xy + vUv * vF1.zw);
          vec4 c = mix(a, b, vT);
          #if CLOUD
            float alpha = smoothstep(0.05, 0.55, c.a) * 0.9;
            if (alpha < 0.02) discard;
            float lum = clamp(c.r / max(c.a, 0.05), 0.0, 1.0);    // 去掉"和透明黑混合"带来的暗边
            vec3 col = mix(vec3(0.8, 0.84, 0.9), vec3(1.0), lum) * vCol * uLight;   // vCol：阴云偏灰
            gl_FragColor = vec4(col, alpha);
          #else
            if (c.a < 0.5) discard;
            // 轮廓：alpha 边缘一圈墨色（和网格版团块的墨线一致）
            float ink = 1.0 - smoothstep(0.5, 0.75, c.a);
            vec3 col = c.rgb * vCol * uLight;
            col = mix(col, vec3(0.12, 0.13, 0.1), ink * 0.9);
            gl_FragColor = vec4(col, 1.0);
          #endif
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.InstancedMesh(g, this.material, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    if (cloud) this.mesh.renderOrder = 9;
  }

  set(i, matrix, color, yaw) {
    this.mesh.setMatrixAt(i, matrix);
    if (color) this.color.setXYZ(i, color.r, color.g, color.b);
    this.yaw.setX(i, yaw);
  }

  commit(n) {
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.color.needsUpdate = true;
    this.yaw.needsUpdate = true;
  }
}

/** 云团块：许多球融成的扁平一团（烘一次，所有云共用）。 */
export function cloudGeometry() {
  const parts = [];
  const puffs = [[0, 0.5, 0, 0.55], [0.6, 0.42, 0.1, 0.42], [-0.62, 0.4, -0.05, 0.44], [0.25, 0.75, -0.1, 0.4], [-0.3, 0.72, 0.12, 0.38], [0.95, 0.32, -0.12, 0.3], [-0.95, 0.3, 0.1, 0.3]];
  for (const [x, y, z, r] of puffs) {
    const s = new THREE.IcosahedronGeometry(r, 2).toNonIndexed();
    s.scale(1, 0.8, 1);
    s.translate(x, y, z);
    parts.push(s);
  }
  const total = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++, o++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      pos.set([x, y, z], o * 3);
      const l = Math.hypot(x, (y - 0.5) * 1.6, z) || 1;
      nor.set([x / l, ((y - 0.5) * 1.6) / l + 0.25, z / l], o * 3);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
