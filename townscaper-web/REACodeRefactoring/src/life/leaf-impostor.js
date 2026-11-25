import * as THREE from 'three';
import { makeLeafSurface, LEAF_SURFACE_GLSL } from './leaf-surface.js';

/**
 * leaf-impostor.js — 远景树冠的共享图集交叉面片 impostor。
 *
 * 依据：
 *   1849427564034498642 "octagonal impostors for these trees"（远景树用替身，
 *     转镜头比广告牌稳）。已有的 life/impostor.js 八方位烘焙版需要 renderer
 *     在启动时烘图；本模块是**不依赖烘焙**的姊妹做法：3 张竖直交叉面片
 *     （60° 间隔），片元沿用与树冠网格同一份 32² 共享叶图集 +
 *     「视角 alpha × 球面叶纹」判据（1205420678859632640）—— 远景照样出
 *     叶形轮廓，而且和近景网格读的是同一张图（材质共享图集单例不分裂）。
 *
 *   片元把每张卡片当「球的正面」（与 impostor.js SPHERE 分支同口径）：
 *   卡片平面坐标 → 半球方向 sph = (x, y, z)，zz = 视线夹角余弦，
 *   alpha = leafCoverage(zz, leafPattern(sph))：球面叶纹采样 × 视角调制，
 *   轮廓是圆球剪影叠叶隙，边上一圈墨线（与网格版 / 烘焙版同一墨线口径）。
 *
 * 近似边界：交叉面片不是原作的八角烘焙替身——没有逐方位光照图、没有俯仰行；
 * 明暗用 zz 近似（顶亮边暗）。图集关掉时退化为球形渐隐剪影。这是程序化近似，
 * 不声称复现原作 impostor。
 */

/**
 * 交叉面片几何：planes 张竖直四边形绕 Y 轴等间隔交叉（默认 3 张 × 60°）。
 * 尺寸来自源树冠几何的包围盒，保证远景替身和近景网格同大同位。
 * @param {THREE.BufferGeometry} [source] 树冠网格几何（取 boundingBox）
 * @param {number} [planes]
 */
export function crossedLeafGeometry(source = null, planes = 3) {
  if (!Number.isSafeInteger(planes) || planes < 2 || planes > 6) throw new RangeError('planes must be an integer in 2..6');
  let w = 1, h = 1, y0 = 0;
  if (source) {
    source.computeBoundingBox();
    const bb = source.boundingBox;
    w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 1.06;
    h = bb.max.y - bb.min.y;
    y0 = bb.min.y;
  }
  const pos = [], card = [], tri = [];
  const quads = [[-.5, 0], [.5, 0], [.5, 1], [-.5, 1]];
  const order = [0, 1, 2, 0, 2, 3];
  for (let k = 0; k < planes; k++) {
    const a = (k * Math.PI) / planes, ca = Math.cos(a), sa = Math.sin(a);
    const base = pos.length / 3;
    for (const [x, y] of quads) {
      pos.push(x * w * ca, y0 + y * h, x * w * sa);
      card.push(x * 2, y * 2 - 1);   // 卡片空间 [-1,1]²，球心在卡片正中
    }
    for (const t of order) tri.push(base + t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCard', new THREE.Float32BufferAttribute(card, 2));
  g.setIndex(tri);
  return g;
}

/**
 * 一种树冠变体的远景替身场（InstancedMesh，与 ImpostorField 同 API：set / commit）。
 * 材质绑 surface.uniform / surface.on —— 与近景叶材质同一份 uniform 对象：
 * sharedLeafTexture 单例不分裂，TownSkinLayer 换图时远景一起换。
 */
export class LeafImpostorField {
  /**
   * @param {object} surface  makeLeafSurface() 结果
   * @param {number} max      实例上限（与源树冠 InstancedMesh 一致）
   * @param {THREE.BufferGeometry} [o.source]  树冠网格几何（定卡片包围盒）
   * @param {number} [o.planes]   交叉面片数（默认 3）
   * @param {{value:number}} [o.uLight]
   */
  constructor(surface = makeLeafSurface(), max = 1, { source = null, planes = 3, uLight = { value: 1 } } = {}) {
    if (!Number.isSafeInteger(max) || max < 1) throw new RangeError('positive integer instance capacity required');
    const g = crossedLeafGeometry(source, planes);
    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uLeafAtlas: surface.uniform,      // 绑定共享纹理 uniform 对象本身
        uLeafAtlasOn: surface.on,         // 与近景同一个开关 uniform
        uLight,
      },
      vertexShader: /* glsl */ `
        attribute vec2 aCard;
        varying vec2 vCard;
        varying vec3 vCol;
        varying vec3 vLeafSphere;
        void main() {
          mat4 im = modelMatrix * instanceMatrix;
          vec3 w = (im * vec4(position, 1.0)).xyz;
          vCard = aCard;
          #ifdef USE_INSTANCING_COLOR
            vCol = instanceColor;
          #else
            vCol = vec3(1.0);
          #endif
          vLeafSphere = position;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uLight;
        varying vec2 vCard;
        varying vec3 vCol;
        ${LEAF_SURFACE_GLSL}
        void main() {
          // 卡片当「球的正面」：vCard ∈ [-1,1]²，rr=1 是球冠剪影边，zz = 视线夹角余弦
          float rr = length(vCard);
          if (rr > 1.0) discard;
          float zz = sqrt(max(0.0, 1.0 - rr * rr));
          vec3 sph = vec3(vCard.x, vCard.y, zz);
          float a;
          if (uLeafAtlasOn > .5) {
            // 与近景网格同一判据：视角 alpha（zz）× 球面叶纹（共享 32² 图集）
            a = leafCoverage(zz, leafPattern(sph));
          } else {
            a = smoothstep(.02, .42, zz);   // 图集关：退化为球面渐隐剪影
          }
          if (a < .5) discard;
          float ink = 1.0 - smoothstep(.5, .78, a);
          vec3 col = vCol * uLight * (.55 + .45 * zz);
          col = mix(col, vec3(.12, .13, .1), ink * .85);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.InstancedMesh(g, this.material, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  set(i, matrix, color) {
    this.mesh.setMatrixAt(i, matrix);
    if (color) this.mesh.setColorAt(i, color);
  }

  commit(n) {
    if (n < 0 || n > this.mesh.instanceMatrix.count) throw new RangeError('impostor commit out of capacity');
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
