/**
 * impostor.js — 把网格烘成八角 impostor（8 个方位），挂到实例化 billboard 上。
 *
 * 两条原文，一件实现：
 *
 * (1) x.com/OskSta/status/1849427564034498642
 *   "Made some octagonal impostors for these trees. Might seem like overkill for
 *    such a stylized look, but they're a lot more stable when rotating the
 *    camera than all other billboard solutions I've tried, which is kinda
 *    important."
 *
 * (2) x.com/OskSta/status/1852334860137849222
 *   "A fluffy cloud shader. It is using the same impostors as the trees, in case
 *    that isn't obvious."
 *
 * 为什么"8 个方位"能解决翻转：单张 billboard 在相机绕过去的时候，贴图内容
 * 一直是同一个视角，所以转到背面就会看到"正面"——那一瞬间就是翻牌感。8 个
 * 方位意味着贴图内容**已经**是当前相机方向看到的形状，转 45° 才换一张，换的
 * 时候形状只差一点点，于是看不出切换。原文说的"stable when rotating"就是这个。
 *
 * 为什么必须用打包器（spritepack.js）：8 个方位 × N 种物体，尺寸还不一样
 * （树 96、云 128），不能靠"每棵树立一张纹理"。一张图集 + 一个二分树打包器
 * 才能一边加物体一边塞进去，这就是 (1)(2) 与前一条 sprite packer 的关系。
 *
 * 画面观察（1849427564034498642 第 0/12 帧）：
 *   · 树冠是灰绿色多边形块，轮廓有明显**平面切角** —— 说明贴图分辨率不高（约
 *     96²），且烘焙时用的是低多边形团块，不是真树叶
 *   · 镜头转动时树冠轮廓保持稳定，没有翻面 / 没有亮度跳变 → 光照是烘进顶点
 *     色的，不参与实时光照
 *   · 每棵树底部有一点点接触阴影（那是烘焙时画的，不是 shadow map）
 */

import * as THREE from 'three';
import { SpriteAtlas } from './spritepack.js';

// --- 小工具：把几段几何拼成一段（vendor 里没有 BufferGeometryUtils）-----

function mergeGeometries(parts) {
  let count = 0;
  for (const p of parts) count += p.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const idx = [];
  let offset = 0;
  for (const p of parts) {
    const P = p.attributes.position.array;
    const N = p.attributes.normal.array;
    const C = p.attributes.color.array;
    pos.set(P, offset * 3);
    nrm.set(N, offset * 3);
    col.set(C, offset * 3);
    const I = p.index ? p.index.array : null;
    const n = p.attributes.position.count;
    if (I) for (let i = 0; i < I.length; i++) idx.push(I[i] + offset);
    else for (let i = 0; i < n; i++) idx.push(i + offset);
    offset += n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * 把光照烘进顶点色。固定一个世界方向的主光 + 底部压暗，于是 impostor 在相机
 * 转动时亮度不变 —— 这是原文那种"稳定"的一半（另一半是 8 方位）。
 */
const BAKE_LIGHT = new THREE.Vector3(0.45, 0.82, 0.35).normalize();
function bakeLitColors(geometry, baseHex, { footDarken = 0.35, topLighten = 0.18, height = 1 } = {}) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const base = new THREE.Color(baseHex);
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    const lam = Math.max(0, nx * BAKE_LIGHT.x + ny * BAKE_LIGHT.y + nz * BAKE_LIGHT.z);
    const y = pos.getY(i) / Math.max(height, 1e-3);       // 0 底 1 顶
    const shade = 0.52 + 0.48 * lam;
    const k = shade * (1 - footDarken * (1 - y)) * (1 + topLighten * y);
    col[i * 3 + 0] = base.r * k;
    col[i * 3 + 1] = base.g * k;
    col[i * 3 + 2] = base.b * k;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geometry;
}

/** 一团树：一段树干 + 三坨二十面体。低多边形，因为 impostor 只要轮廓。 */
export function makeBlobTree(seed = 1, { height = 1.9, canopy = '#a9bba0' } = {}) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);

  const trunkH = height * 0.42;
  const trunk = new THREE.CylinderGeometry(height * 0.05, height * 0.075, trunkH, 5, 1);
  trunk.translate(0, trunkH * 0.5, 0);
  bakeLitColors(trunk, '#6d5b46', { height });

  const parts = [trunk];
  const blobs = 3;
  for (let i = 0; i < blobs; i++) {
    const r = height * (0.30 - i * 0.055) * (0.9 + rnd() * 0.2);
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1, 0.82, 1);
    g.translate(
      (rnd() - 0.5) * height * 0.12,
      trunkH + r * 0.7 + i * height * 0.16,
      (rnd() - 0.5) * height * 0.12,
    );
    bakeLitColors(g, canopy, { height, footDarken: 0.5, topLighten: 0.26 });
    parts.push(g);
  }
  return { mesh: mergeGeometries(parts), height };
}

/** 一朵云：几个压扁的球，用同一套 impostor 管线（原文第 2 条）。 */
export function makeBlobCloud(seed = 1, { size = 3.2, tint = '#f2f0ea' } = {}) {
  let s = seed * 7919 + 104729;
  const rnd = () => ((s = (s * 7919 + 104729) % 233280) / 233280);
  const parts = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const r = size * (0.30 + rnd() * 0.16);
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1.25, 0.72, 1.15);
    g.translate(
      (i / (n - 1) - 0.5) * size * 1.15,
      (rnd() - 0.5) * size * 0.16,
      (rnd() - 0.5) * size * 0.35,
    );
    bakeLitColors(g, tint, { height: size * 0.7, footDarken: 0.22, topLighten: 0.16 });
    parts.push(g);
  }
  return { mesh: mergeGeometries(parts), height: size * 0.8 };
}

// --- 烘焙 + 实例化 billboard -------------------------------------------

const VIEWS = 8;

const VERT = /* glsl */`
  uniform sampler2D uAtlas;
  uniform float uTile;
  uniform vec4  uSlots[8];
  uniform float uAtlasSize;
  uniform int   uViewCount;
  varying vec2 vUv;
  varying vec4 vSlot;

  void main() {
    vUv = position.xy + vec2(0.5);
    // 方位由**每棵实例**自己算，而不是全局一个值：同一批里的树朝向可以不同
    mat4 im = modelMatrix * instanceMatrix;
    vec3 centre = (im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float sx = length(im[0].xyz);
    vec3 toCam = cameraPosition - centre;
    float az = atan(toCam.x, toCam.z);
    int view = int(mod(floor(az / 6.2831853 * float(uViewCount) + 0.5), float(uViewCount)));
    vSlot = uSlots[view];

    // 圆柱 billboard：只绕 Y 轴朝向相机，竖直方向永远直立（树不能歪）
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
    vec3 p = centre
           + right * (position.x * sx)
           + vec3(0.0, 1.0, 0.0) * ((position.y + 0.5) * sx);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform sampler2D uAtlas;
  uniform sampler2D uLeaf;
  uniform float uTile;
  uniform float uAtlasSize;
  uniform float uLeafAmt;
  varying vec2 vUv;
  varying vec4 vSlot;

  void main() {
    // vSlot = (x, y, w, h) 像素矩形；图的 y 轴和 three 的 uv 同向（都在底部）
    vec2 uv = (vSlot.xy + vUv * vSlot.zw) / uAtlasSize;
    vec4 c = texture2D(uAtlas, uv);

    // --- 视角调制的 alpha + 球面叶片（x.com/OskSta/status/1205420678859632640）---
    // 原文："For the plants, I dug up this ol' trick: alpha is view angle
    //       modulated by leaf texture mapped to a sphere."
    // 拆开看是两件事，共同点是**都按球面参数**算：
    //   ① 卡片上的点先当成一个球的正面：cp∈[-0.5,0.5] → 单位球上的 (x,y,z)，
    //      z 就是这点相对视线的夹角余弦（正对=1，卡片边缘=0）；
    //   ② 用同一个球坐标 (经度, 半径) 去采样叶片图，得到"这一点有没有叶子"；
    //   ③ alpha = 原 alpha × 视角项 × 叶片项。
    // 于是卡片方角被削掉（植物轮廓变圆），边缘出现叶隙（不是硬切的一块板）。
    vec2 cp = vUv - vec2(0.5);
    float r = length(cp) * 2.0;
    float z = sqrt(max(0.0, 1.0 - r * r));
    float viewTerm = smoothstep(0.02, 0.42, z);
    float lon = atan(cp.y, cp.x) / 6.2831853 + 0.5;
    float leaf = texture2D(uLeaf, vec2(lon * 3.0, r * 1.4)).r;
    float leafTerm = smoothstep(0.28, 0.62, leaf);

    float a = c.a * mix(1.0, viewTerm, uLeafAmt) * mix(1.0, leafTerm, uLeafAmt * 0.85);
    if (a < 0.5) discard;                  // 硬切：impostor 用 alpha test，不进 blend 队列
    // 实测：RT 里存下来的已经是**编码过**的值（同一份顶点色如果在这里再编一次
    // sRGB，树冠会灰白发白）。所以原样输出，不再做二次变换。
    gl_FragColor = vec4(c.rgb, 1.0);
  }
`;

/** 小的叶片遮罩图（周期值噪声，阈值后就是叶隙）。 */
function makeLeafMask(size = 64, seed = 3) {
  const data = new Uint8Array(size * size * 4);
  const hash = (x, y) => {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const noise = (u, v, p) => {
    const x = u * p, y = v * p;
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const w = (n) => ((n % p) + p) % p;
    const n00 = hash(w(xi), w(yi)), n10 = hash(w(xi + 1), w(yi));
    const n01 = hash(w(xi), w(yi + 1)), n11 = hash(w(xi + 1), w(yi + 1));
    return (n00 + (n10 - n00) * sx) * (1 - sy) + (n01 + (n11 - n01) * sx) * sy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = noise(u, v, 6) * 0.6 + noise(u, v, 13) * 0.4;
      const i = (y * size + x) * 4;
      const val = Math.round(Math.min(1, Math.max(0, n * 1.35)) * 255);
      data[i] = val; data[i + 1] = val; data[i + 2] = val; data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export function createImpostors(renderer, { atlas = 512, views = VIEWS } = {}) {
  const rt = new THREE.WebGLRenderTarget(atlas, atlas, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: true,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.generateMipmaps = false;
  // 图集里的值是**线性**的：关掉 tone mapping 再烘，否则 ACES 会在烘焙时就被
  // 压一遍，billboard 的着色器再编一次 sRGB，得到的树冠会灰白发白。
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;

  const pack = new SpriteAtlas(atlas);
  const leafTex = makeLeafMask(64);
  const objects = new Map();     // key -> {slot, tile, height}
  const placements = new Map();  // key -> [{x,y,z,scale}]
  const group = new THREE.Group();
  const pending = [];
  let meshes = [];
  let dirty = false;

  // 烘焙用的临时场景：只有被烘的物体 + 一个固定 key light（光照已烘进顶点色，
  // 所以这里其实只需要 basic 材质，光只是给 alpha 边缘一点点抗锯齿余量）
  const bakeScene = new THREE.Scene();
  const bakeMat = new THREE.MeshBasicMaterial({ vertexColors: true });

  function place(key, x, y, z, scale = 1) {
    if (!placements.has(key)) placements.set(key, []);
    placements.get(key).push({ x, y, z, scale });
    dirty = true;
  }

  function rebuildInstances() {
    for (const m of meshes) { group.remove(m); m.geometry.dispose(); m.material.dispose(); }
    meshes = [];
    for (const [key, list] of placements) {
      const info = objects.get(key);
      if (!info || !list.length) continue;
      const geo = new THREE.PlaneGeometry(1, 1);
      const slots = [];
      // 8 个方位在打包器里是 8 个独立 allotment：key+view
      for (let v = 0; v < views; v++) {
        const s = pack.slots.get(key + '#' + v);
        if (!s) continue;
        slots.push(new THREE.Vector4(s.x, s.y, s.w, s.h));
      }
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uAtlas: { value: rt.texture },
          uLeaf: { value: leafTex },
          uLeafAmt: { value: info.leaf || 0 },
          uTile: { value: info.tile },
          uAtlasSize: { value: atlas },
          uViewCount: { value: views },
          uSlots: { value: slots },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.DoubleSide,
      });
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s3 = new THREE.Vector3();
      const p3 = new THREE.Vector3();
      list.forEach((p, i) => {
        // 高度 = 烘焙时的 ortho 尺寸：保证 impostor 的像素密度和原网格一致
        const size = info.radius * 2.12 * p.scale;
        p3.set(p.x, p.y, p.z);
        s3.set(size, size, size);
        m4.compose(p3, q, s3);
        inst.setMatrixAt(i, m4);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      inst.userData.overlayOnly = true;
      group.add(inst);
      meshes.push(inst);
    }
    dirty = false;
  }

  /**
   * 登记一个物体：只占图集格，**不立刻烘**。
   *
   * 踩过的坑：一开始是「插入 8 格 → 马上烘 → 再插入下一个物体的 8 格」。
   * 但打包器每次插入都会整体重排（大块优先），第二个物体一插进来，第一个
   * 物体烘在图集里的像素就"搬家"了，而它的 slot 记录还停在原地 —— 结果
   * billboard 采样到的是别人的格子 / 空白格，画面上出现一块巨大的杂色方块。
   * 所以必须先把所有物体都登记完，再统一烘。
   */
  function addObject(key, { geometry, height, tile = 96, leaf = 0 }) {
    for (let v = 0; v < views; v++) pack.insert(key + '#' + v, tile, tile, 1);
    pending.push({ key, geometry, height, tile, leaf });
    return key;
  }

  function bakeAll() {
    if (!pending.length) return;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevViewport = new THREE.Vector4();
    renderer.getViewport(prevViewport);
    const prevScissorTest = renderer.getScissorTest();
    const prevClear = new THREE.Color();
    renderer.getClearColor(prevClear);
    const prevClearAlpha = renderer.getClearAlpha();
    const prevToneMapping = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;

    renderer.setRenderTarget(rt);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, atlas, atlas);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.autoClear = false;

    for (const job of pending) {
      const { key, geometry, height } = job;
      const mesh = new THREE.Mesh(geometry, bakeMat);
      bakeScene.add(mesh);
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      const radius = Math.max(geometry.boundingSphere.radius, 0.05);
      const cam = new THREE.OrthographicCamera(
        -radius * 1.06, radius * 1.06, radius * 1.06, -radius * 1.06, 0.01, radius * 12,
      );
      const centre = new THREE.Vector3(0, height * 0.5, 0);
      const elev = 0.32;   // 18°：参考片的树都是略俯视，不是纯水平
      for (let v = 0; v < views; v++) {
        const slot = pack.slots.get(key + '#' + v);
        if (!slot) continue;
        const a = (v / views) * Math.PI * 2;
        const d = radius * 4;
        cam.position.set(
          Math.sin(a) * Math.cos(elev) * d,
          centre.y + Math.sin(elev) * d,
          Math.cos(a) * Math.cos(elev) * d,
        );
        cam.lookAt(centre);
        cam.updateProjectionMatrix();
        renderer.setViewport(slot.x, slot.y, slot.w, slot.h);
        renderer.setScissor(slot.x, slot.y, slot.w, slot.h);
        renderer.setScissorTest(true);
        renderer.render(bakeScene, cam);
      }
      bakeScene.remove(mesh);
      objects.set(key, { height, radius, tile: job.tile, leaf: job.leaf || 0 });
    }

    renderer.autoClear = prevAutoClear;
    renderer.setScissorTest(prevScissorTest);
    renderer.setViewport(prevViewport.x, prevViewport.y, prevViewport.z, prevViewport.w);
    renderer.setClearColor(prevClear, prevClearAlpha);
    renderer.toneMapping = prevToneMapping;
    renderer.setRenderTarget(prevTarget);
    pending.length = 0;
  }

  function finalize() {
    bakeAll();
    rebuildInstances();
    return group;
  }

  return {
    group,
    rt,
    pack,
    addObject,
    bakeAll,
    place,
    finalize,
    /** 调试/对照用：把叶片强度整体推到某个值（0 = 关掉球面 alpha 调制）。 */
    setLeaf(v) {
      for (const m of meshes) m.material.uniforms.uLeafAmt.value = v;
    },
    get leaf() { return meshes.length ? meshes[0].material.uniforms.uLeafAmt.value : 0; },
    get stats() { return { atlas, objects: objects.size, instances: [...placements.values()].reduce((a, l) => a + l.length, 0), occupancy: +pack.occupancy().toFixed(3) }; },
    dispose() {
      for (const m of meshes) { group.remove(m); m.geometry.dispose(); m.material.dispose(); }
      rt.dispose();
    },
  };
}
