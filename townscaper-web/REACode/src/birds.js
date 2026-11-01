/**
 * birds.js — 海鸥（index 场景用）。
 *
 * 原文 1244892370392489989（2020-03-31）：
 *   "Better Birdies: 🐦 More bird shaped 🐦 Only has outlines when sitting
 *    🐦 Shuffle about more 🐦 Has reflections 🐦 Flowier flight"
 *
 * 逐帧看到的（23 秒，512²）：
 *   - 停着：胖乎乎的白色海鸥 —— 水滴形身体、圆头、短喙，翅尖和尾巴是浅灰；
 *     成排停在屋脊上，山墙尖上也常有一只；朝向各不相同；一条细深色轮廓线。
 *   - 挪动（shuffle）：停着时不时小跳一步、原地转身、点头。
 *   - 飞：没有轮廓线；宽翅膀，扇几下再滑翔；上白下灰；
 *     在镇子上空绕着大圈"流动"地飞（不是刚性的圆），会从屋顶起飞、再落回屋顶。
 *   - 倒影：鸟在水里有倒影（停着的和飞着的都有）。
 *
 * 实现：
 *   栖息点：从烘好的城镇网格的顶点里找每个屋顶格的最高顶点（屋脊 / 山墙尖），
 *     把同一格里相邻的屋脊顶点连成线段，沿线段每隔 ~0.13 放一个栖位 —— 鸟就排成一排坐在屋脊上。
 *   状态机：sit → takeoff → fly → land → sit；位置连续，不瞬移。
 *     飞行用"转向"：期望方向指向绕镇中心的大圈上前方一点，速度方向每秒最多转一定角度 →
 *     平滑的弧线；转弯时按角速度倾斜（bank）。降落时目标是一个空栖位，越近越慢，最后贴上去。
 *   扇翅：飞行几何里翅膀顶点带"展向距离"属性，顶点着色器按每只鸟的实例属性 aWing（翅膀角度）
 *     绕身体轴转动；扇动 / 滑翔交替。背面（下侧）在片元里压暗 → 上白下灰。
 *   轮廓：只给停着的鸟 —— 同一组实例矩阵再画一遍反向外壳（BackSide、沿法线外扩）。
 *   倒影：同样的实例沿水面镜像（scale.y = -1），颜色取"白色与水色的中点"（和城镇倒影同一思路），
 *     随深度变淡。
 */

import * as THREE from 'three';
import { pointInQuad } from './town.js';

/* ---------------------------------------------------------------- 几何 */

function pushTri(arr, cols, a, b, c, col) {
  arr.push(...a, ...b, ...c);
  for (let i = 0; i < 3; i++) cols.push(...col);
}

/** 停着的海鸥：+z 朝前。由几个低多边形椭球拼成，带顶点色。 */
function sittingGeometry() {
  const pos = [], col = [];
  const WHITE = [0.97, 0.96, 0.93], GREY = [0.74, 0.76, 0.79], DARK = [0.36, 0.38, 0.42], BEAK = [0.93, 0.72, 0.32];
  const blob = (cx, cy, cz, rx, ry, rz, color, colorTop = color, seg = 10, rows = 7) => {
    for (let i = 0; i < rows; i++) {
      const t0 = (i / rows) * Math.PI, t1 = ((i + 1) / rows) * Math.PI;
      for (let j = 0; j < seg; j++) {
        const p0 = (j / seg) * Math.PI * 2, p1 = ((j + 1) / seg) * Math.PI * 2;
        const P = (t, p) => [cx + Math.sin(t) * Math.cos(p) * rx, cy + Math.cos(t) * ry, cz + Math.sin(t) * Math.sin(p) * rz];
        const c = i < rows / 2 ? colorTop : color;
        pushTri(pos, col, P(t0, p0), P(t1, p1), P(t1, p0), c);   // 外法线朝外（轮廓外壳要靠它）
        pushTri(pos, col, P(t0, p0), P(t0, p1), P(t1, p1), c);
      }
    }
  };
  // 身体：前低后高的水滴
  blob(0, 0.045, 0.0, 0.040, 0.036, 0.062, WHITE);
  // 头
  blob(0, 0.090, 0.046, 0.024, 0.023, 0.026, WHITE);
  // 收起的翅膀：贴在两侧、偏后、浅灰，翅尖深灰
  blob(0.027, 0.058, -0.014, 0.015, 0.021, 0.054, GREY, GREY);
  blob(-0.027, 0.058, -0.014, 0.015, 0.021, 0.054, GREY, GREY);
  blob(0, 0.060, -0.072, 0.016, 0.010, 0.030, DARK, DARK, 5, 3);
  // 喙
  pushTri(pos, col, [-0.006, 0.090, 0.066], [0.006, 0.090, 0.066], [0, 0.086, 0.090], BEAK);
  pushTri(pos, col, [-0.006, 0.090, 0.066], [0, 0.082, 0.068], [0.006, 0.090, 0.066], BEAK);
  // 小黑眼睛（两个小三角）
  pushTri(pos, col, [0.021, 0.096, 0.056], [0.022, 0.092, 0.060], [0.022, 0.099, 0.061], [0.1, 0.1, 0.1]);
  pushTri(pos, col, [-0.021, 0.096, 0.056], [-0.022, 0.099, 0.061], [-0.022, 0.092, 0.060], [0.1, 0.1, 0.1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * 飞着的海鸥：俯视是一个"M"形 —— 身体细长，翅膀在肘部略向后折，翅尖深灰。
 * aSpan：顶点离身体轴的距离（0 = 身体），着色器按它把翅膀绕身体轴转起来。
 */
function flyingGeometry() {
  const pos = [], col = [], span = [];
  const WHITE = [0.98, 0.97, 0.95], TIP = [0.46, 0.48, 0.52];
  const tri = (a, b, c, color) => {
    pushTri(pos, col, a, b, c, color);
    span.push(Math.abs(a[0]), Math.abs(b[0]), Math.abs(c[0]));
  };
  // 身体（菱形截面的细长体）
  const nose = [0, 0.004, 0.085], tail = [0, 0.006, -0.075], l = [-0.016, 0, 0], r = [0.016, 0, 0], top = [0, 0.016, 0.005], bot = [0, -0.012, 0.005];
  for (const [a, b] of [[l, top], [top, r], [r, bot], [bot, l]]) { tri(nose, a, b, WHITE); tri(tail, b, a, WHITE); }
  // 尾扇
  tri([0, 0.006, -0.06], [-0.026, 0.006, -0.105], [0.026, 0.006, -0.105], WHITE);
  // 两只翅膀：肩 → 肘（前缘向前）→ 腕（向后折）→ 翅尖
  for (const s of [1, -1]) {
    const sh0 = [0.012 * s, 0.004, 0.030], sh1 = [0.012 * s, 0.004, -0.018];
    const el0 = [0.085 * s, 0.006, 0.026], el1 = [0.085 * s, 0.006, -0.026];
    const wr0 = [0.150 * s, 0.004, 0.000], wr1 = [0.150 * s, 0.004, -0.034];
    const tip = [0.215 * s, 0.002, -0.058];
    // 镜像的一侧要反转绕序，否则左翅的上表面会被当成"下侧"压暗
    const T = s > 0 ? tri : (a, b, c, k) => tri(a, c, b, k);
    T(sh0, el0, el1, WHITE); T(sh0, el1, sh1, WHITE);
    T(el0, wr0, wr1, WHITE); T(el0, wr1, el1, WHITE);
    T(wr0, tip, wr1, TIP);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSpan', new THREE.Float32BufferAttribute(span, 1));
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------- 材质 */

/** 翅膀转动 + 下侧压暗。aWing：每只鸟的翅膀角度（弧度，正 = 上扬）。 */
function wingMaterial(base, { reflect = false, water = null } = {}) {
  const m = reflect
    ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false })
    : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    if (water) shader.uniforms.uWater = water;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSpan;\nattribute float aWing;\nvarying float vDepth;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ang = aWing * smoothstep(0.0, 0.03, aSpan);
        float sx = sign(transformed.x);
        // 翅膀绕身体轴（z）转：外侧越远抬得越高；翅尖再多弯一点
        float bend = ang * (1.0 + 0.6 * smoothstep(0.12, 0.21, aSpan));
        transformed.y += sin(bend) * aSpan;
        transformed.x = sx * (aSpan * cos(bend)) + (aSpan < 0.0001 ? transformed.x : 0.0);`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDepth = -(modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;');
    patchFragment(shader, reflect);
  };
  return m;
}

function patchFragment(shader, reflect) {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vDepth;' + (reflect ? '\nuniform vec3 uWater;' : ''));
  if (reflect) {
    // 倒影：鸟色和水色的中点，随深度淡出（与城镇倒影 1215644531221311488 同一思路）
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
      `#include <opaque_fragment>
       vec3 mid = mix(uWater, gl_FragColor.rgb * 1.15 + 0.04, 0.5);
       gl_FragColor = vec4(mid, 0.75 * exp(-max(vDepth, 0.0) * 0.6));`);
  } else {
    // 下侧（背面）压暗：上白下灰
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.78;');
  }
}

function sittingMaterial({ reflect = false, water = null } = {}) {
  const m = reflect
    ? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    if (water) shader.uniforms.uWater = water;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vDepth;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvDepth = -(modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;');
    if (reflect) patchFragment(shader, true);
    else shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDepth;');
  };
  return m;
}

/** 停着的鸟的轮廓：反向外壳，沿法线外扩固定世界宽度。 */
function outlineMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: '#3a3833', side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.0038;');
  };
  return m;
}

/* -------------------------------------------------------------- 工具 */

function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

/**
 * 屋脊栖位：每个屋顶格里最高的那些网格顶点（屋脊 / 山墙尖），相邻的连成线段，沿线段均匀取点。
 * @param geometry 烘好的城镇几何（position 属性，非索引）
 * @param cellAt (x, z) → cell | null
 * @param minY   只看高于这个高度的顶点（第 2 层以上，排除码头）
 */
export function findRoofPerches(geometry, { cellAt, isRoofCell, minY = 0.6, spacing = 0.13 }) {
  const P = geometry.getAttribute('position');
  if (!P) return [];
  const best = new Map();      // cell.id → { y, pts: Map(key → [x,y,z]) }
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i);
    if (y < minY) continue;
    const x = P.getX(i), z = P.getZ(i);
    const c = cellAt(x, z);
    if (!c || !isRoofCell(c)) continue;
    let b = best.get(c.id);
    if (!b || y > b.y + 0.004) { b = { y, cell: c, pts: new Map() }; best.set(c.id, b); }
    if (y >= b.y - 0.004) b.pts.set(`${Math.round(x * 500)},${Math.round(z * 500)}`, [x, y, z]);
  }
  const out = [];
  for (const b of best.values()) {
    const pts = [...b.pts.values()];
    if (pts.length === 1) { out.push({ x: pts[0][0], y: pts[0][1], z: pts[0][2], dir: 0, cell: b.cell, peak: true }); continue; }
    // 屋脊线：取相距最远的两个顶点作为线段两端（屋脊顶点共线）
    let A = pts[0], B = pts[1], dmax = -1;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][2] - pts[j][2]);
      if (d > dmax) { dmax = d; A = pts[i]; B = pts[j]; }
    }
    const n = Math.max(1, Math.floor(dmax / spacing));
    const dir = Math.atan2(B[0] - A[0], B[2] - A[2]);
    for (let k = 0; k <= n; k++) {
      const t = n === 0 ? 0.5 : (k + 0.5) / (n + 1);
      out.push({ x: A[0] + (B[0] - A[0]) * t, y: A[1] + (B[1] - A[1]) * t, z: A[2] + (B[2] - A[2]) * t, dir, cell: b.cell, peak: false });
    }
  }
  return out;
}

/* ----------------------------------------------------------- 鸟群 */

export class Birds {
  /**
   * @param {object} o
   * @param {THREE.IUniform} o.water  水色 uniform（倒影取中点色）
   */
  constructor({ scene = null, town = null, grid = null, index = null, levelHeight = 0.5, water, max = 96, seed = 7 } = {}) {
    this.town = town; this.grid = grid; this.index = index; this.levelHeight = levelHeight;
    this.max = max;
    this.rng = rng32(seed);
    this.time = 0;
    this.perches = [];
    this.birds = [];
    this.center = new THREE.Vector3();
    this.radius = 6;
    this.size = 1.0;

    const sitGeo = sittingGeometry();
    const flyGeo = flyingGeometry();
    this.wingAttr = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    flyGeo.setAttribute('aWing', this.wingAttr);

    const mk = (geo, mat, order = 0) => {
      const m = new THREE.InstancedMesh(geo, mat, max);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      m.renderOrder = order;
      return m;
    };
    this.sit = mk(sitGeo, sittingMaterial());
    this.sit.castShadow = true;
    this.sitOutline = mk(sitGeo, outlineMaterial());
    this.sitOutline.instanceMatrix = this.sit.instanceMatrix;       // 同一组实例矩阵
    this.fly = mk(flyGeo, wingMaterial());
    this.fly.castShadow = false;   // 飞鸟的影子落在水面上像一群黑鸟，原片里没有
    // 倒影：同一组实例沿水面镜像
    this.sitRef = mk(sitGeo, sittingMaterial({ reflect: true, water }), 1);
    this.sitRef.instanceMatrix = this.sit.instanceMatrix;
    this.flyRef = mk(flyGeo, wingMaterial(null, { reflect: true, water }), 1);
    this.flyRef.instanceMatrix = this.fly.instanceMatrix;
    const mirror = new THREE.Group();
    mirror.scale.y = -1;
    mirror.add(this.sitRef, this.flyRef);
    this.reflection = mirror;

    this.group = new THREE.Group();
    this.group.add(this.sit, this.sitOutline, this.fly, mirror);
    if (scene) scene.add(this.group);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler(0, 0, 0, 'YXZ');
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
  }

  set reflections(on) { this.reflection.visible = on; }
  set visible(on) { this.group.visible = on; }
  get visible() { return this.group.visible; }

  /** 城镇网格重建后：从屋脊顶点重新找栖位，镇子的中心和半径决定飞行的大圈。 */
  refresh(geometry) {
    const { town, grid, index } = this;
    const cellAt = (x, z) => {
      for (const c of index.at(x, z)) if (pointInQuad(c.pts, x, z)) return c;
      return null;
    };
    const perches = findRoofPerches(geometry, { cellAt, isRoofCell: (c) => town.top(c) >= 2, minY: this.levelHeight * 1.5 });
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const c of grid.cells) {
      if (!town.top(c)) continue;
      minX = Math.min(minX, c.cx); maxX = Math.max(maxX, c.cx); minZ = Math.min(minZ, c.cz); maxZ = Math.max(maxZ, c.cz);
    }
    if (!Number.isFinite(minX)) { minX = maxX = minZ = maxZ = 0; }
    const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.setPerches(perches, { center, radius: Math.max(maxX - minX, maxZ - minZ) * 0.55 });
  }

  /**
   * 城镇变了：换一批栖位。已经停着的鸟如果脚下的栖位没了，就起飞；空中的鸟照常飞，之后落到新栖位上。
   */
  setPerches(perches, { center, radius }) {
    this.perches = perches;
    this.center.copy(center);
    this.radius = Math.max(3, radius);
    for (const p of perches) p.taken = null;
    const want = Math.min(this.max, Math.round(perches.length * 0.75) + 8);
    const rand = this.rng;
    // 已有的鸟：停着的找最近的新栖位（很近就留下），否则起飞
    for (const b of this.birds) {
      if (b.state === 'sit' || b.state === 'land') {
        const p = this.#nearestFree(b.pos.x, b.pos.z, 0.08);
        if (p && b.state === 'sit') { b.perch = p; p.taken = b; b.pos.set(p.x, p.y, p.z); }
        else { b.perch = null; this.#takeOff(b); }
      }
    }
    while (this.birds.length > want) this.birds.pop();
    // 新鸟：一半直接坐在屋脊上，一半在空中
    while (this.birds.length < want) {
      const b = {
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: rand() * TAU, bank: 0, wing: 0,
        state: 'sit', timer: 3 + rand() * 28, perch: null, flapPhase: rand() * TAU, glide: 0,
        hop: 0, hopFrom: new THREE.Vector3(), hopTo: new THREE.Vector3(), yawTo: 0, bob: rand() * TAU,
        lane: 0.75 + rand() * 0.6, alt: 2.2 + rand() * 2.2, dirSign: 1, seed: rand() * 100,
      };
      const p = rand() < 0.72 ? this.#randomFree() : null;
      if (p) {
        b.perch = p; p.taken = b; b.pos.set(p.x, p.y, p.z);
        b.yaw = p.dir + (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) + (rand() - 0.5) * 1.2;
        b.yawTo = b.yaw;
      } else {
        const a = rand() * TAU, r = this.radius * b.lane;
        b.pos.set(this.center.x + Math.cos(a) * r, b.alt, this.center.z + Math.sin(a) * r);
        b.state = 'fly'; b.timer = 4 + rand() * 10;
        b.vel.set(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(1.5);
      }
      this.birds.push(b);
    }
  }

  #randomFree() {
    const free = this.perches.filter((p) => !p.taken);
    return free.length ? free[(this.rng() * free.length) | 0] : null;
  }

  #nearestFree(x, z, maxD = Infinity) {
    let best = null, bd = maxD;
    for (const p of this.perches) {
      if (p.taken) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  #takeOff(b) {
    if (b.perch) b.perch.taken = null;
    b.perch = null;
    b.state = 'takeoff';
    b.timer = 0.9;
    const f = new THREE.Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw));
    b.vel.copy(f).multiplyScalar(0.6).add(new THREE.Vector3(0, 1.4, 0));
    b.dirSign = this.rng() < 0.75 ? 1 : -1;     // 大多数鸟同向绕圈，像一群
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const t = this.time, rand = this.rng;
    const up = new THREE.Vector3(0, 1, 0);
    const desired = new THREE.Vector3();
    let ns = 0, nf = 0;

    for (const b of this.birds) {
      b.timer -= dt;
      if (b.state === 'sit') {
        // shuffle：偶尔沿屋脊挪一步（小跳）、转身、点头
        if (b.hop > 0) {
          b.hop = Math.max(0, b.hop - dt * 3.2);
          const k = 1 - b.hop;
          b.pos.lerpVectors(b.hopFrom, b.hopTo, k);
          b.pos.y += Math.sin(k * Math.PI) * 0.035;
        } else if (rand() < dt * 0.35) {
          const p = b.perch;
          const step = (rand() < 0.5 ? -1 : 1) * (0.03 + rand() * 0.04);
          b.hopFrom.copy(b.pos);
          b.hopTo.set(p.x + Math.sin(p.dir) * step, p.y, p.z + Math.cos(p.dir) * step);
          b.hop = 1;
        }
        if (rand() < dt * 0.25) b.yawTo = b.yaw + (rand() - 0.5) * 2.4;
        b.yaw += angDiff(b.yaw, b.yawTo) * Math.min(1, dt * 6);
        if (b.timer <= 0) { this.#takeOff(b); }
      } else {
        // 飞行：转向一个目标方向，速度方向每秒最多转 turnRate 弧度 → 平滑弧线
        let speed = 1.7, turnRate = 1.6;
        if (b.state === 'takeoff') {
          desired.copy(b.vel).setY(0).normalize().multiplyScalar(0.8).add(new THREE.Vector3(0, 1, 0));
          speed = 1.3; turnRate = 3;
          if (b.timer <= 0) { b.state = 'fly'; b.timer = 5 + rand() * 12; }
        } else if (b.state === 'fly') {
          // 绕镇中心的大圈：圈上"前方"一点，半径和高度随时间缓慢变化 → 流动感
          const dx = b.pos.x - this.center.x, dz = b.pos.z - this.center.z;
          const a = Math.atan2(dz, dx) + 0.55 * b.dirSign;
          const r = this.radius * (b.lane + 0.15 * Math.sin(t * 0.21 + b.seed));
          const alt = b.alt + 0.6 * Math.sin(t * 0.33 + b.seed * 1.7);
          desired.set(this.center.x + Math.cos(a) * r - b.pos.x, alt - b.pos.y, this.center.z + Math.sin(a) * r - b.pos.z);
          // 世界空间噪声：同一片空域的鸟偏向一致（有群感，不用 boids）
          desired.normalize().add(new THREE.Vector3(Math.sin(b.pos.z * 0.4 + t * 0.3), 0, Math.cos(b.pos.x * 0.4 - t * 0.27)).multiplyScalar(0.25));
          if (b.timer <= 0 && this.perches.length) {
            const p = this.#nearestFree(b.pos.x + b.vel.x * 2, b.pos.z + b.vel.z * 2) || this.#randomFree();
            if (p) { b.perch = p; p.taken = b; b.state = 'land'; }
            else b.timer = 3;
          }
        } else if (b.state === 'land') {
          const p = b.perch;
          const to = new THREE.Vector3(p.x, p.y, p.z).sub(b.pos);
          const d = to.length();
          // 从上方滑下来：目标点抬高一点，越近越低
          desired.copy(to).add(new THREE.Vector3(0, Math.min(0.6, d * 0.25), 0));
          speed = Math.min(1.7, 0.35 + d * 0.9);
          turnRate = d < 1.2 ? 6 : 2.2;
          if (d < 0.05) {
            b.state = 'sit'; b.pos.set(p.x, p.y, p.z); b.vel.set(0, 0, 0);
            b.timer = 6 + rand() * 18; b.yawTo = b.yaw; b.hop = 0;
          }
        }
        if (b.state !== 'sit') {
          desired.normalize();
          const cur = b.vel.lengthSq() > 1e-6 ? b.vel.clone().normalize() : desired.clone();
          const ang = cur.angleTo(desired);
          const maxA = turnRate * dt;
          let dir = desired;
          if (ang > maxA) {
            const axis = new THREE.Vector3().crossVectors(cur, desired);
            if (axis.lengthSq() < 1e-8) axis.copy(up);
            dir = cur.applyAxisAngle(axis.normalize(), maxA);
          }
          // 转弯角速度 → 倾斜
          const yawNew = Math.atan2(dir.x, dir.z);
          const yawRate = angDiff(b.yaw, yawNew) / Math.max(dt, 1e-3);
          b.bank += (THREE.MathUtils.clamp(-yawRate * 0.35, -0.8, 0.8) - b.bank) * Math.min(1, dt * 3);
          b.yaw = yawNew;
          b.vel.copy(dir).multiplyScalar(speed);
          b.pos.addScaledVector(b.vel, dt);
          if (b.pos.y < 0.15) b.pos.y = 0.15;
          // 扇翅 / 滑翔：起飞、降落、爬升时扇，平飞时扇几下滑一阵
          const climbing = dir.y > 0.15 || b.state !== 'fly';
          const cycle = (Math.sin(t * 0.9 + b.seed) + 1) * 0.5;
          const flapping = climbing || cycle > 0.55;
          b.glide += ((flapping ? 0 : 1) - b.glide) * Math.min(1, dt * 4);
          b.flapPhase += dt * (b.state === 'fly' ? 11 : 15);
          b.wing = (1 - b.glide) * Math.sin(b.flapPhase) * 0.85 + b.glide * 0.12;
        }
      }

      // 写实例
      const sz = this.size;
      if (b.state === 'sit') {
        if (ns >= this.max) continue;
        const bob = Math.max(0, Math.sin(t * 2.3 + b.bob)) ** 8 * 0.25;
        this.e.set(bob, b.yaw, 0);
        this.q.setFromEuler(this.e);
        this.m.compose(b.pos, this.q, this.s.setScalar(sz));
        this.sit.setMatrixAt(ns++, this.m);
      } else {
        if (nf >= this.max) continue;
        const pitch = -Math.asin(THREE.MathUtils.clamp(b.vel.y / Math.max(b.vel.length(), 1e-3), -1, 1)) * 0.6;
        this.e.set(pitch, b.yaw, b.bank);
        this.q.setFromEuler(this.e);
        this.m.compose(b.pos, this.q, this.s.setScalar(sz));
        this.fly.setMatrixAt(nf, this.m);
        this.wingAttr.array[nf] = b.wing;
        nf++;
      }
    }
    for (const m of [this.sit, this.sitOutline, this.sitRef]) m.count = ns;
    for (const m of [this.fly, this.flyRef]) m.count = nf;
    this.sit.instanceMatrix.needsUpdate = true;
    this.fly.instanceMatrix.needsUpdate = true;
    this.wingAttr.needsUpdate = true;
  }

  get stats() {
    const c = { sit: 0, takeoff: 0, fly: 0, land: 0 };
    for (const b of this.birds) c[b.state]++;
    return { ...c, perches: this.perches.length };
  }

  dispose() {
    this.sit.geometry.dispose(); this.fly.geometry.dispose();
    for (const m of [this.sit, this.sitOutline, this.fly, this.sitRef, this.flyRef]) m.material.dispose();
  }
}
