// =====================================================================
//  Impasto Mossy Knolls · buildImpastoMossyGround()
//  依附于球面的手绘厚涂苔丘草地（西芳寺缘 / 湖沼边缘）：
//  1) 顶点噪声扰动地形：PlaneGeometry 多分段网格贴球弯曲，
//     2–4 座缓坡小山丘 + 一条弯弯曲曲的泥泞湿地沟壑谷底
//     （两侧草地高耸、中间河道低洼的垂直纵深骨架）
//  2) 多层级多面体错落堆叠：80–100 颗极扁 Icosahedron(0.6, 0) 苔藓块，
//     MeshToonMaterial(flatShading)，三色插画绿按高度分层
//  3) 全套 addOutline() 唐伯虎笔意草丝黑线
//  4) minDistance = 4 安全阻尼：避开车站轨道/桥墩/书店大门（avoidWorld）
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline, getToonGradient, INK_COLOR } from "../assets/toon.js";
import { quatYToDir } from "./sphereMath.js";

/* ---------------- 三色插画绿 ---------------- */
const MOSS_FRESH = 0x8ae234; // 鲜嫩黄绿（丘顶受光）
const MOSS_EMERALD = 0x4e9a06; // 成熟翡翠绿（斜坡主体）
const MOSS_INK = 0x1e4620; // 焦墨绿（沟壑背光）
const TERRAIN_LOW = 0x233d1e; // 谷底湿泥基色
const MIN_DISTANCE = 4; // 与轨道/桥墩/书店大门的安全阻尼距离

/* ---------------- 共享资源（跨补丁单例） ---------------- */
let _mossGeo = null;
const _mossMats = new Map();

function getMossGeometry() {
  if (_mossGeo) return _mossGeo;
  _mossGeo = new THREE.IcosahedronGeometry(0.6, 0); // 硬朗分面二十面体
  return _mossGeo;
}

function getMossMaterial(color) {
  let mat = _mossMats.get(color);
  if (!mat) {
    mat = toonMat(color, { flatShading: true }); // 低多边形分面质感
    _mossMats.set(color, mat);
  }
  return mat;
}

/** 确定性随机（项目惯例） */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function smoothstepJS(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/* =====================================================================
 *  地形噪声骨架：山丘群 + 弯曲沟壑 + 细碎涟漪
 * ===================================================================== */
function createTerrainNoise(rnd, size) {
  // ---------- 2–4 座高度不一的缓坡小山丘 ----------
  const knollCount = 2 + Math.floor(rnd() * 3);
  const knolls = [];
  for (let i = 0; i < knollCount; i++) {
    knolls.push({
      x: (rnd() - 0.5) * size * 0.62,
      z: (rnd() - 0.5) * size * 0.62,
      amp: 2 + rnd() * 2, // 隆起 2–4 单位
      sigma: 3.5 + rnd() * 3,
    });
  }

  // ---------- 弯弯曲曲的泥泞湿地沟壑（沿 Z 蜿蜒） ----------
  const channel = {
    amp: 1.6 + rnd() * 0.9, // 深挖幅度
    width: 1.8 + rnd() * 1.2, // 谷底半宽
    bend: 2.5 + rnd() * 2.5, // 蜿蜒摆幅
    freq: 0.16 + rnd() * 0.1, // 蜿蜒频率
    phase: rnd() * Math.PI * 2,
  };

  const rippleSeed = rnd() * 10;

  /** 原始高度（未归一、未衰减）：山丘 − 沟壑 + 细碎涟漪 */
  function raw(x, z) {
    let h = 0;
    for (const k of knolls) {
      const dx = x - k.x;
      const dz = z - k.z;
      h += k.amp * Math.exp(-(dx * dx + dz * dz) / (2 * k.sigma * k.sigma));
    }
    const xc = channel.bend * Math.sin(z * channel.freq + channel.phase);
    const dx = x - xc;
    h -= channel.amp * Math.exp(-(dx * dx) / (2 * channel.width * channel.width));
    // 手绘笔触感的细碎凹凸
    h += 0.35 * Math.sin(x * 0.55 + rippleSeed) * Math.cos(z * 0.62 + rippleSeed * 0.7);
    h += 0.18 * Math.sin(x * 1.35 + rippleSeed * 1.3) * Math.sin(z * 1.15 + rippleSeed * 0.4);
    return h;
  }

  // 边缘衰减：补丁边界柔和汇入球面，不留硬切边
  const half = size / 2;
  function edgeFalloff(x, z) {
    const m = Math.max(Math.abs(x), Math.abs(z));
    return smoothstepJS(half, half - 3.5, m);
  }

  // 归一基准：谷底贴地（0），山丘相对谷底隆起
  let rawMin = Infinity;
  const SAMPLES = 33;
  for (let i = 0; i < SAMPLES; i++) {
    for (let j = 0; j < SAMPLES; j++) {
      const x = -half + (i / (SAMPLES - 1)) * size;
      const z = -half + (j / (SAMPLES - 1)) * size;
      rawMin = Math.min(rawMin, raw(x, z));
    }
  }

  /** 局部凸起高度（≥0）：谷底 = 0，丘顶 = 2–4+（封顶 4.6 防山丘叠穿） */
  function bump(x, z) {
    return Math.min(edgeFalloff(x, z) * Math.max(0, raw(x, z) - rawMin), 4.6);
  }

  return { knolls, bump, knollCount };
}

/* =====================================================================
 *  主工厂：buildImpastoMossyGround()
 * ===================================================================== */

/**
 * 生成一块依附球面的厚涂苔丘草地，并完成球面贴放（调用方 scene.add）。
 *
 * @param {{
 *   dir?: THREE.Vector3,          // 补丁中心的球面方向（缺省 = 北极）
 *   planetRadius?: number,
 *   size?: number,                // 补丁边长（默认 30）
 *   segments?: number,            // 地形分段（默认 64）
 *   seed?: number,
 *   yaw?: number,                 // 绕法线自转
 *   palette?: { low?: number, ink?: number, emerald?: number, fresh?: number, edge?: number },
 *   footprint?: { rx?: number, rz?: number, segments?: number },
 *   heightScale?: number,          // 专用地貌的起伏倍率
 *   avoidWorld?: { position: THREE.Vector3, radius: number }[],
 * }} [opts]  avoidWorld：世界坐标避障体（轨道采样点/桥墩/书店），
 *            苔藓块与其保持 MIN_DISTANCE 安全阻尼距离
 * @returns {THREE.Group} mossyGround
 */
export function buildImpastoMossyGround(opts = {}) {
  const {
    dir = new THREE.Vector3(0, 1, 0),
    planetRadius = 40,
    size = 30,
    segments = 64,
    seed = 20260804,
    yaw = 0,
    palette = null,
    footprint = null,
    heightScale = 1,
    avoidWorld = [],
  } = opts;

  const rnd = lcg(seed);
  const R = planetRadius;
  const group = new THREE.Group();
  group.name = "mossyGround";

  // ---------- 球面贴放（局部 +Y = 法线） ----------
  const center = dir.clone().normalize();
  group.quaternion.copy(quatYToDir(center, new THREE.Quaternion()));
  group.rotateY(yaw);
  group.position.copy(center).multiplyScalar(R);
  group.updateWorldMatrix(true, false);

  // 世界避障体 → 补丁局部坐标（flatten 标记：需要压平地形走廊的避障体，如轨道/书店）
  const avoid = avoidWorld.map((a) => {
    const p = a.position.clone();
    group.worldToLocal(p);
    return { x: p.x, z: p.z, y: p.y, r: a.radius ?? 0, flatten: !!a.flatten };
  });

  let { knolls, bump } = createTerrainNoise(rnd, size);
  // 轨道走廊压平：苔丘 bump 会穿轨/穿车体，避障点附近把地形隆起衰减到 0
  // （苔藓块本身已有 MIN_DISTANCE 避让，这里只处理连续地形）
  const flatteners = avoid.filter((a) => a.flatten);
  if (flatteners.length) {
    const bumpBase = bump;
    bump = (x, z) => {
      let f = 1;
      for (const a of flatteners) {
        const d = Math.hypot(x - a.x, z - a.z);
        const inner = a.r + 1.6; // 全压平半径（轨面以上不得有丘）
        const outer = a.r + 5.0; // 过渡带外缘
        if (d < outer) {
          const w = d <= inner ? 0 : smoothstepJS(inner, outer, d);
          if (w < f) f = w;
        }
      }
      return bumpBase(x, z) * f;
    };
  }

  // ---------- 地形网格：平面贴球弯曲 + 噪声隆起 ----------
  // 球面下陷量：局部系中球面随距中心距离向下弯曲（切平面 → 球面）。
  // 普通苔地继续使用旧的方形采样；苔庭战区传入 footprint 后改用
  // 不规则环形网格，避免出现截图中突兀的巨大矩形绿板。
  const sphereDrop = (x, z) => R - Math.sqrt(Math.max(R * R - (x * x + z * z), 0));
  const footprintSpec = footprint
    ? {
        rx: Math.max(4, footprint.rx ?? size * 0.32),
        rz: Math.max(3, footprint.rz ?? size * 0.22),
        segments: Math.max(14, Math.floor(footprint.segments ?? 24)),
      }
    : null;
  const parsedHeightScale = Number(heightScale);
  const terrainHeightScale = THREE.MathUtils.clamp(
    Number.isFinite(parsedHeightScale) ? parsedHeightScale : 1,
    0,
    1.5
  );
  const footprintDistance = (x, z) =>
    footprintSpec
      ? Math.hypot(x / footprintSpec.rx, z / footprintSpec.rz)
      : 0;
  const terrainY = (x, z) => {
    const base = -sphereDrop(x, z) + 0.05;
    if (!footprintSpec) return base + bump(x, z) * terrainHeightScale;
    // 向边缘连续压低丘陵，边界自然落回星球表面，不形成垂直切口。
    const edgeKeep = 1 - smoothstepJS(0.58, 1.0, footprintDistance(x, z));
    return base + bump(x, z) * edgeKeep * terrainHeightScale;
  };

  const groundPalette = {
    low: palette?.low ?? TERRAIN_LOW,
    ink: palette?.ink ?? MOSS_INK,
    emerald: palette?.emerald ?? MOSS_EMERALD,
    fresh: palette?.fresh ?? MOSS_FRESH,
    edge: palette?.edge ?? palette?.emerald ?? MOSS_EMERALD,
  };
  const cLow = new THREE.Color(groundPalette.low);
  const cInk = new THREE.Color(groundPalette.ink);
  const cEmerald = new THREE.Color(groundPalette.emerald);
  const cFresh = new THREE.Color(groundPalette.fresh);
  const cEdge = new THREE.Color(groundPalette.edge);
  const _c = new THREE.Color();

  //  bumps 的峰值（用于色彩归一）
  let bumpMax = 1e-3;
  const sampleN = footprintSpec ? Math.max(16, footprintSpec.segments) : segments + 1;
  const sampleRx = footprintSpec ? footprintSpec.rx : size / 2;
  const sampleRz = footprintSpec ? footprintSpec.rz : size / 2;
  for (let iz = 0; iz < sampleN; iz++) {
    for (let ix = 0; ix < sampleN; ix++) {
      const sx = -sampleRx + (ix / (sampleN - 1)) * sampleRx * 2;
      const sz = -sampleRz + (iz / (sampleN - 1)) * sampleRz * 2;
      bumpMax = Math.max(bumpMax, bump(sx, sz));
    }
  }
  const colorAt = (x, z, out = new THREE.Color()) => {
    const b = bump(x, z);
    // 按高度分层上色：谷底湿泥焦墨 → 翡翠 → 丘顶嫩绿
    const t = b / bumpMax;
    if (t < 0.28) out.copy(cLow).lerp(cInk, smoothstepJS(0, 0.28, t));
    else if (t < 0.6) out.copy(cInk).lerp(cEmerald, smoothstepJS(0.28, 0.6, t));
    else out.copy(cEmerald).lerp(cFresh, smoothstepJS(0.6, 0.95, t));
    if (footprintSpec) {
      out.lerp(cEdge, smoothstepJS(0.68, 1.0, footprintDistance(x, z)));
    }
    return out;
  };

  let geo;
  if (footprintSpec) {
    const positions = [];
    const faceColors = [];
    const ringCount = 4;
    const ringSize = footprintSpec.segments;
    const phase = rnd() * Math.PI * 2;
    const rings = [];
    const pushTriangle = (a, b, c) => {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      for (const p of [a, b, c]) {
        const tint = colorAt(p.x, p.z, _c);
        faceColors.push(tint.r, tint.g, tint.b);
      }
    };
    for (let ri = 0; ri < ringCount; ri++) {
      const radius01 = (ri + 1) / ringCount;
      const ring = [];
      for (let i = 0; i < ringSize; i++) {
        const a = phase + (i / ringSize) * Math.PI * 2;
        const profile =
          1 +
          Math.sin(a * 3 + phase) * 0.055 +
          Math.cos(a * 5 - phase * 0.7) * 0.035 +
          (rnd() - 0.5) * 0.08;
        const x = Math.cos(a) * footprintSpec.rx * radius01 * profile;
        const z = Math.sin(a) * footprintSpec.rz * radius01 * profile;
        ring.push({ x, y: terrainY(x, z), z });
      }
      rings.push(ring);
    }
    const center = { x: 0, y: terrainY(0, 0), z: 0 };
    for (let i = 0; i < ringSize; i++) {
      const next = (i + 1) % ringSize;
      pushTriangle(center, rings[0][i], rings[0][next]);
    }
    for (let ri = 0; ri < rings.length - 1; ri++) {
      for (let i = 0; i < ringSize; i++) {
        const next = (i + 1) % ringSize;
        pushTriangle(rings[ri][i], rings[ri + 1][i], rings[ri + 1][next]);
        pushTriangle(rings[ri][i], rings[ri + 1][next], rings[ri][next]);
      }
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(faceColors, 3));
  } else {
    geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2); // XY 平面 → XZ 平面（Y 向上）
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, terrainY(x, z));
      colorAt(x, z, _c);
      colors[i * 3] = _c.r;
      colors[i * 3 + 1] = _c.g;
      colors[i * 3 + 2] = _c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  geo.computeVertexNormals();

  const terrainMat = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: getToonGradient(), // 2 阶硬边明暗 → 连环画层次感
  });
  terrainMat.flatShading = true;
  terrainMat.needsUpdate = true;
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.name = "mossy-terrain";
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  group.add(terrain);

  // ---------- 多层级苔藓块堆叠（80–100 颗，避开安全距离） ----------
  const mossGeo = getMossGeometry();
  const count = 80 + Math.floor(rnd() * 21);
  let placed = 0;
  let guard = 0;

  function blocked(x, z) {
    for (const a of avoid) {
      const d = Math.hypot(x - a.x, z - a.z);
      if (d < a.r + MIN_DISTANCE) return true;
    }
    return false;
  }

  while (placed < count && guard++ < count * 45) {
    let x, z;
    if (rnd() < 0.78 && knolls.length) {
      // 主要种在山丘的斜坡与顶部（高斯散布）
      const k = knolls[Math.floor(rnd() * knolls.length)];
      const ang = rnd() * Math.PI * 2;
      const rr = k.sigma * (rnd() + rnd()) * 0.75;
      x = k.x + Math.cos(ang) * rr;
      z = k.z + Math.sin(ang) * rr;
    } else {
      x = (rnd() - 0.5) * (size - 4);
      z = (rnd() - 0.5) * (size - 4);
    }
    if (Math.max(Math.abs(x), Math.abs(z)) > size / 2 - 2) continue;
    // 有机足迹模式下，装饰也必须留在椭圆边界内；否则虽然地形网格已不再是
    // 方形，散落的苔藓块仍会把视觉轮廓重新撑成一个大方块。
    if (footprintSpec && footprintDistance(x, z) > 0.93) continue;
    if (blocked(x, z)) continue; // 轨道/桥墩/书店安全阻尼

    const b = bump(x, z);
    const s = 0.6 * (0.6 + rnd() * 1.0); // 大小不一
    const mat =
      b / bumpMax > 0.62 + rnd() * 0.1
        ? getMossMaterial(groundPalette.fresh)
        : b / bumpMax > 0.24
          ? getMossMaterial(groundPalette.emerald)
          : getMossMaterial(groundPalette.ink);

    const moss = new THREE.Mesh(mossGeo, mat);
    moss.position.set(x, terrainY(x, z) + 0.04, z);
    moss.scale.set(s * (1 + rnd() * 0.35), s * 0.38, s * (1 + rnd() * 0.35)); // 极扁
    moss.rotation.set((rnd() - 0.5) * 0.3, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.3);
    moss.castShadow = true;
    moss.receiveShadow = true;
    addOutline(moss, 0.013, INK_COLOR, 0.05); // 草丝硬朗黑勾线
    moss.userData.isMoss = true;
    group.add(moss);
    placed++;
  }

  group.userData.terrainY = terrainY; // 供外部贴放小物件
  group.userData.mossCount = placed;
  group.userData.footprint = footprintSpec ? Object.freeze({ ...footprintSpec }) : null;
  group.userData.heightScale = terrainHeightScale;
  group.userData.palette = Object.freeze({ ...groundPalette });
  return group;
}
