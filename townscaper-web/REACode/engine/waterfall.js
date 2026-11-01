/**
 * waterfall.js — 河床掉级的地方长出一条瀑布：竖着的白缎带 + 水下泡沫圈。
 *
 * 原文（x.com/OskSta/status/1007587812462530561, 2018-06-15）：
 *
 *   "Proper games have waterfalls. I'm glad to report that @BadNorthGame is now a
 *    proper game."
 *
 * 画面（20 帧）：深紫蓝色的岛，崖面上挂着**两三条细白竖带**，往下略微张开，
 * 落水处有一圈**白泡沫**（比水面亮、边缘软）；岛转过来时露出第二处、第三处瀑布，
 * 都是"从台地边缘直接垂到水面"，没有沿崖面斜流的。
 *
 * 两个观察决定了实现：
 *   ① 瀑布**只出现在高差 ≥2 级的地方**（一级台阶只是"小跌水"，没有缎带）；
 *   ② 缎带是**分段**的（能看到横向的亮暗节），而且节在**往下走** ——
 *      这不是噪声，是滚动条纹。所以用一个 `aT` 参数做相位，uTime 一推就是水流。
 *
 * 纯数据 + three（会建 mesh）。
 */

import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float aT;        // 0 = 顶部，1 = 底部
  attribute float aSide;     // -1 / +1，左右边
  varying float vT;
  varying float vSide;
  void main() {
    vT = aT;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uOpacity;
  varying float vT;
  varying float vSide;
  void main() {
    // 滚动条纹：相位往上推 → 亮带往下走（水流方向）
    float phase = vT * 7.0 - uTime * 1.6;
    float band = 0.55 + 0.45 * sin(phase * 6.2831);
    // 两侧收边（缎带中间实、边缘透），底部略微张开
    float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
    float a = uOpacity * (0.55 + 0.45 * band) * edge;
    // 顶部一进来就是实心的（从台地边缘翻出来），底部收一点
    a *= mix(0.85, 1.0, smoothstep(0.0, 0.25, vT));
    if (a < 0.02) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

/**
 * 找出所有"河床掉 ≥ minDrop 级"的台阶，并给每一处建一条缎带 + 一个泡沫圈。
 *
 * @param {object} town
 * @param {object} grid
 * @param {{cells:number[]}} rivers
 */
export function createWaterfalls(town, grid, rivers, {
  minDrop = 2,
  // 只保留"落进低处（水面/滩地）"的瀑布。
  // 为什么：河被削在岛内部，`drop>=2` 的台阶有 21 处，但它们都是**峡谷内部**
  // 的跌水，全景一张都看不到；真正落进海里的只有 2 处 —— 参考片里也就是两三处。
  intoLow = 1,
  levelHeight = 0.42,
  width = 0.16,
  segments = 6,
  foamRadius = 0.30,
  opacity = 0.92,
} = {}) {
  const cells = grid.cells;
  const riverSet = new Set(rivers && rivers.cells ? rivers.cells : []);
  const sites = [];
  const seen = new Set();

  for (const id of riverSet) {
    const c = cells[id];
    if (!c) continue;
    const h = town.top(c);
    for (let e = 0; e < 4; e++) {
      const nid = c.edgeNeighbors[e];
      if (nid < 0) continue;
      const nb = cells[nid];
      const drop = h - town.top(nb);
      if (drop < minDrop) continue;
      if (intoLow !== null && town.top(nb) > intoLow) continue;
      // 同一条棱只建一次（两个方向都会走到）
      const key = id < nid ? id + ':' + nid : nid + ':' + id;
      if (seen.has(key)) continue;
      seen.add(key);
      const a = c.pts[e], b = c.pts[(e + 1) % 4];
      const mx = (a.x + b.x) * 0.5, mz = (a.z + b.z) * 0.5;
      // 缎带要贴在**崖面外侧**：从棱中点朝"下游那格的中心"推出去一点。
      // 第一版直接放在棱上，结果整条瀑布埋在两格之间的石缝里，全景一张都看不见。
      let ox = nb.cx - mx, oz = nb.cz - mz;
      const ol = Math.hypot(ox, oz) || 1;
      ox = ox / ol * 0.26; oz = oz / ol * 0.26;
      // 缎带的"横向" = 这条棱的方向；缎带就挂在这条棱上
      const ex = b.x - a.x, ez = b.z - a.z;
      const el = Math.hypot(ex, ez) || 1;
      sites.push({
        x: mx + ox, z: mz + oz,
        ux: ex / el, uz: ez / el,       // 沿棱
        topY: h * levelHeight,
        // 落水点：低于 1 级的格子就直接落到水面（0），否则落在下游河床
        bottomY: Math.max(0, town.top(nb) * levelHeight),
        drop: drop * levelHeight,
        edgeLen: el,
      });
    }
  }

  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#f2f7ff') },
      uOpacity: { value: opacity },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const meshes = [];
  for (const s of sites) {
    const w = Math.min(width, s.edgeLen * 0.30);
    const pos = [], aT = [], aSide = [], idx = [];
    // 缎带：segments 段竖条，底部稍微外扩（水花张开的形状）
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = s.topY + (s.bottomY - s.topY) * t;
      const spread = 1 + t * 0.55;
      // 每段横向有一点点摆（不是笔直的刀片）
      const wob = Math.sin(t * 5.0 + s.x * 3.1) * 0.02 * t;
      for (const side of [-1, 1]) {
        const off = side * w * spread * 0.5;
        pos.push(
          s.x + s.ux * off + s.uz * wob,
          y,
          s.z + s.uz * off - s.ux * wob,
        );
        aT.push(t);
        aSide.push(side);
      }
      if (i < segments) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
    g.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    m.userData.overlayOnly = true;
    m.renderOrder = 3;
    group.add(m);
    meshes.push(m);

    // 泡沫：落水点一圈白盘（半透明，靠 alpha 边缘软）
    const foam = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(0.12, foamRadius * (0.8 + s.edgeLen * 0.4)), 14),
      new THREE.MeshBasicMaterial({ color: '#eef6ff', transparent: true, opacity: 0.5, depthWrite: false }),
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(s.x, s.bottomY + 0.012, s.z);
    foam.userData.overlayOnly = true;
    foam.renderOrder = 3;
    group.add(foam);
    meshes.push(foam);
  }

  return {
    group,
    sites,
    update(dt, t) { mat.uniforms.uTime.value = t; },
    stats() {
      return {
        falls: sites.length,
        maxDrop: sites.reduce((a, s) => Math.max(a, s.drop), 0),
        // 每处瀑布的落差（世界单位），用来确认"只在高差 ≥2 级处出现"
        drops: sites.map((s) => +s.drop.toFixed(2)),
      };
    },
    dispose() {
      for (const m of meshes) { m.geometry.dispose(); if (m.material !== mat) m.material.dispose(); }
      mat.dispose();
    },
  };
}
