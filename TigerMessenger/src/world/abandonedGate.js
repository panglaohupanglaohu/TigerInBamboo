// =====================================================================
//  莫比斯叹息之门 · 太古双子要塞巨门（The Cyber-Megalithic Twin Gates）
//
//  形态：
//    · 三重圆拱门形状不变（createGateShape + Extrude，沿轨三片透光）
//    · 左 / 右双子巨塔夹道对峙：leftTowerGroup / rightTowerGroup 各偏置 ±5
//    · 中央一线天通道宽 10，电车高架从三重门正中穿行
//    · 每塔 4 级长方体阶梯内缩（下粗上细）+ 平顶祭坛台
//    · 墙面科技加固刻线薄片 + 基座风化乱石
//    · 陶土赤红 MeshToon + flatShading + addOutline(0.05)
//
//  局部坐标（seatRoot）：+X = 轨右，+Y = 径向/天空，+Z = 轨道前进
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { facet } from "../assets/lowPoly.js";
import { PLANET_RADIUS } from "./planet.js";
import { canyonOffsetDir } from "./canyon.js";
import { groundLiftAt, worldToFlatXZ } from "./hills.js";

/* ---------------- 陶土赤红（旧默认，现由 Towerscaper 糖果色替代） ---------------- */
const TERRACOTTA = 0xb85a42; // 主体：高饱和陶土赤红
const TERRACOTTA_DEEP = 0xa64b35; // 暗部 / 刻线
const TERRACOTTA_WARM = 0xc46a4e; // 拱环略暖
const RUBBLE_GREY = 0x9a918a; // 基座剥落乱石（改为浅暖灰褐）

/* ---------------- Towerscaper 糖果色板（低饱和·高明度·水彩感） ---------------- */
const TS_WALLS = [
  { name: "樱桃红", main: 0xe85d5d, roof: 0xf2975d },
  { name: "天蓝", main: 0x62b6e6, roof: 0xf2d85a },
  { name: "薄荷绿", main: 0x6dd5a0, roof: 0xf2975d },
  { name: "柠檬黄", main: 0xf2d85a, roof: 0xe87e52 },
  { name: "浅粉", main: 0xe8a0c0, roof: 0xf2975d },
  { name: "奶油白", main: 0xf5f0e6, roof: 0xe87e52 },
];
const TS_ARCH = 0xfff8ed; // 拱门/中央建筑：奶油白
const TS_PIER = 0x8ecae6; // 通道矮墩：淡青蓝（可选，目前未用）

const _cMain = new THREE.Color();
const _cDeep = new THREE.Color();
const _cRoof = new THREE.Color();

/** 同系暗部：主色向黑乘 0.78，再略向暖偏移 */
function deepen(mainHex, factor = 0.78) {
  _cDeep.setHex(mainHex).multiplyScalar(factor);
  return _cDeep.getHex();
}

/** 为双子塔挑选两个不同的糖果色（seed 确定但左右不同） */
function pickTowerColors(rnd) {
  const a = Math.floor(rnd() * TS_WALLS.length);
  let b = Math.floor(rnd() * (TS_WALLS.length - 1));
  if (b >= a) b += 1;
  return [TS_WALLS[a], TS_WALLS[b]];
}

/* ---------------- 城门 / 拱环剖面（三重圆拱形状锁死） ---------------- */
// 局部 XY 平面：X = 横向，Y = 高度，Z = 轨道前进（挤出方向）
export const GATE = Object.freeze({
  wallHalf: 8.5, // 拱墙横向半宽（圆拱外形不变）
  wallTop: 44.0, // 双子塔总高（≈ 玩家 1.6 × 27.5）
  plinthH: 1.6, // 基座埋深
  plinthOut: 0.6,
  passHalf: 3.0, // 券洞半宽 → 净宽 6.0（电车并行余量）
  spring: 11.0, // 起拱线高
  archDepth: 2.2, // 单片拱墙厚度（沿轨）
  archGap: 11.0, // 三重透光间隙（沿轨）
  archTop: 15.0, // 拱墙顶高（圆拱轮廓上缘）
  merlonW: 1.6, // 保留字段（兼容旧 cap API）
  merlonH: 1.5,
  curveSegments: 16,
  // —— 双子要塞 ——
  towerOffset: 5.0, // 左右塔组偏置（通道半宽 = 5 → 夹道 10）
  channelWidth: 10.0,
  outline: 0.05,
});

const ARCH_PITCH = GATE.archDepth + GATE.archGap;
export const GATE_DEPTH = GATE.archDepth * 3 + GATE.archGap * 2;
export const GATE_SETBACK = GATE_DEPTH / 2 + 4;

/** 塔体阶梯总高（不含埋深） */
const TOWER_HEIGHT = GATE.wallTop;
const TOTAL_HEIGHT = +(TOWER_HEIGHT + GATE.plinthH).toFixed(1);
const PASS_APEX = GATE.spring + GATE.passHalf;
const PLAYER_H = 1.6;

/** 足迹量测：双子塔外缘 */
const FOOTPRINT_HALF_X = GATE.towerOffset + 6.5;
const BURY_MARGIN = 0.8;

const _p = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _m = new THREE.Matrix4();

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * 三重圆拱立面轮廓 + 半圆券洞（形状锁死，不可改洞形）。
 * @param {number} holeHalf
 * @returns {THREE.Shape}
 */
export function createGateShape(holeHalf = GATE.passHalf) {
  const W = GATE.wallHalf;
  const Wp = W + GATE.plinthOut;
  const top = GATE.archTop;
  const base = -GATE.plinthH;

  const shape = new THREE.Shape();
  shape.moveTo(-Wp, base);
  shape.lineTo(Wp, base);
  shape.lineTo(Wp, 0);
  shape.lineTo(W, 0);
  shape.lineTo(W, top);
  shape.lineTo(-W, top);
  shape.lineTo(-W, 0);
  shape.lineTo(-Wp, 0);
  shape.closePath();

  const h = holeHalf;
  const hole = new THREE.Path();
  hole.moveTo(-h, 0);
  hole.lineTo(-h, GATE.spring);
  hole.absarc(0, GATE.spring, h, Math.PI, 0, true);
  hole.lineTo(h, 0);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

/**
 * 旧版垛口顶墙（保留导出，双子塔方案不再使用）。
 */
export function createGateCapShape(rnd = lcg(7)) {
  const W = GATE.wallHalf;
  const bot = GATE.archTop;
  const top = Math.min(GATE.wallTop, bot + 6);
  const merlonBase = top - GATE.merlonH;
  const shape = new THREE.Shape();
  shape.moveTo(-W, bot);
  shape.lineTo(W, bot);
  shape.lineTo(W, merlonBase);
  const span = W * 2;
  const n = Math.max(3, Math.floor(span / GATE.merlonW));
  const step = span / n;
  let x = W;
  for (let i = 0; i < n; i++) {
    const nextX = W - (i + 1) * step;
    const r = rnd();
    const merlonTop =
      r < 0.25 ? merlonBase : merlonBase + GATE.merlonH * (0.45 + rnd() * 0.55);
    shape.lineTo(x, merlonTop);
    shape.lineTo(nextX, merlonTop);
    shape.lineTo(nextX, merlonBase);
    x = nextX;
  }
  shape.lineTo(-W, merlonBase);
  shape.closePath();
  return shape;
}

function measureFootFloat(seat, basisQ, groundRadiusAt) {
  const hx = FOOTPRINT_HALF_X;
  const hz = GATE_DEPTH / 2 + 2;
  const NX = 6;
  const NZ = 8;
  const upCenter = seat.clone().normalize();
  let worst = 0;
  const v = new THREE.Vector3();
  for (let i = 0; i <= NX; i++) {
    const lx = -hx + (2 * hx * i) / NX;
    for (let j = 0; j <= NZ; j++) {
      const lz = -hz + (2 * hz * j) / NZ;
      v.set(lx, -GATE.plinthH, lz).applyQuaternion(basisQ).add(seat);
      const dir = v.clone().normalize();
      const gap = v.length() - groundRadiusAt(dir);
      if (gap <= 0) continue;
      const cosT = Math.max(0.5, dir.dot(upCenter));
      const need = gap / cosT;
      if (need > worst) worst = need;
    }
  }
  return worst;
}

/**
 * 在轨道上找门长范围内几乎不横移的落座点。
 */
export function findGateSeatU(curve, planetRadius = PLANET_RADIUS) {
  if (!curve) return null;
  const L = curve.getLength();
  if (!(L > 1)) return null;
  const half = GATE_DEPTH / 2;
  const hx = FOOTPRINT_HALF_X;
  const dMax = GATE.passHalf - 1.503 - 0.3;

  const pt = (s) => curve.getPointAt((((s / L) % 1) + 1) % 1, new THREE.Vector3());
  const tg = (s) =>
    curve.getTangentAt((((s / L) % 1) + 1) % 1, new THREE.Vector3()).normalize();

  const hits = [];
  for (let s = 0; s < L; s += 1) {
    const p0 = pt(s);
    const up = p0.clone().normalize();
    if (canyonOffsetDir(up) !== 0) continue;
    const fwd = tg(s);
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    let footprintInCanyon = false;
    for (let d = -half; d <= half && !footprintInCanyon; d += 1) {
      const along = pt(s + d);
      for (const lateralOffset of [-hx, -hx * 0.5, 0, hx * 0.5, hx]) {
        const sampleDir = along.clone().addScaledVector(right, lateralOffset).normalize();
        if (canyonOffsetDir(sampleDir) !== 0) {
          footprintInCanyon = true;
          break;
        }
      }
    }
    if (footprintInCanyon) continue;
    let dev = 0;
    for (let d = -half; d <= half; d += 0.5) {
      const lateral = Math.abs(pt(s + d).sub(p0).dot(right));
      if (lateral > dev) dev = lateral;
    }
    if (dev > dMax) continue;
    hits.push({ s, u: s / L, dev, offIsland: !worldToFlatXZ(up, planetRadius) });
  }
  if (!hits.length) return null;

  const runs = [];
  for (const h of hits) {
    const last = runs[runs.length - 1];
    if (last && h.s - last.end <= 1.5) {
      last.end = h.s;
      last.items.push(h);
    } else {
      runs.push({ start: h.s, end: h.s, items: [h] });
    }
  }
  const scored = runs.map((r) => ({
    len: r.end - r.start,
    offIsland: r.items.every((i) => i.offIsland),
    best: r.items.reduce((a, b) => (b.dev < a.dev ? b : a)),
  }));
  const offIsland = scored.filter((r) => r.offIsland);
  const pool = offIsland.length ? offIsland : scored;
  pool.sort((a, b) => b.len - a.len || a.best.dev - b.best.dev);
  return pool[0].best.u;
}

function extrudeGatePart(shape, depth) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: GATE.curveSegments,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  return facet(geo);
}

function matMain(color = TERRACOTTA) {
  return toonMat(color, { flatShading: true });
}
function matDeep(color = TERRACOTTA_DEEP) {
  return toonMat(color, { flatShading: true });
}
function matWarm(color = TERRACOTTA_WARM) {
  return toonMat(color, { flatShading: true });
}
function matRubble(color = RUBBLE_GREY) {
  return toonMat(color, { flatShading: true });
}

/** 按主色生成一套 Towerscaper 材质：主色 / 暗部 / 屋顶（保留 hex 供插值） */
function makePalette(mainHex, roofHex) {
  return {
    mainHex,
    roofHex,
    main: matMain(mainHex),
    deep: matDeep(deepen(mainHex, 0.78)),
    warm: matWarm(roofHex),
    strip: matDeep(deepen(mainHex, 0.62)), // 科技刻线更深
    rubble: matRubble(),
  };
}

/**
 * 多级立方体阶梯塔（下粗上细，平顶祭坛）。
 * 局部：Y 向上，X 横向（远离轨道为正「外」），Z 沿轨。
 */
function buildTieredTower(sideSign, rnd, palette) {
  const g = new THREE.Group();
  g.name = sideSign < 0 ? "leftTowerGroup" : "rightTowerGroup";
  // 塔组原点：夹道半宽处（±5），体量向外侧展开
  g.position.set(sideSign * GATE.towerOffset, 0, 0);

  const main = palette.main;
  const deep = palette.deep;
  const warm = palette.warm;
  const stripMat = palette.strip;

  // 由底到顶：主色逐渐向屋顶暖色偏移（Towerscaper 层层水彩感）
  const tierTints = [0.0, 0.12, 0.28, 0.52];

  // 4 级：每级 XZ 缩 12% 左右，Y 累加
  // 底层宽大；「内侧」朝向轨道（-sideSign * X）
  const tiers = [
    { w: 9.2, d: 16.0, h: 12.5 },
    { w: 8.0, d: 13.8, h: 11.0 },
    { w: 6.9, d: 11.8, h: 10.0 },
    { w: 5.9, d: 10.0, h: 8.5 }, // 平顶平台
  ];

  let yCursor = 0;
  const tierMeshes = [];
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    // 向外偏心：内侧贴 ±5 通道，外侧更远
    const cx = sideSign * (t.w * 0.42);

    // 由底到顶：主色逐渐向屋顶暖色偏移（Towerscaper 层层水彩感）
    const isTop = i === tiers.length - 1;
    const tierHex = isTop
      ? palette.roofHex
      : _cMain
          .setHex(palette.mainHex)
          .lerp(_cRoof.setHex(palette.roofHex), tierTints[i])
          .getHex();
    const tierMat = isTop ? warm : matMain(tierHex);

    const mesh = new THREE.Mesh(
      facet(new THREE.BoxGeometry(t.w, t.h, t.d)),
      tierMat
    );
    mesh.name = `tower-tier-${i}`;
    mesh.position.set(cx, yCursor + t.h * 0.5, (rnd() - 0.5) * 0.6);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addOutline(mesh, GATE.outline);
    g.add(mesh);
    tierMeshes.push({ mesh, t, cx, y0: yCursor });
    yCursor += t.h * (0.92 + rnd() * 0.04); // 轻微咬合叠压
  }

  // 科技加固刻线：正面 / 内壁 纵横薄片
  const stripCount = 34 + Math.floor(rnd() * 8);
  for (let i = 0; i < stripCount; i++) {
    const ti = Math.floor(rnd() * tierMeshes.length);
    const { mesh: host, t, cx, y0 } = tierMeshes[ti];
    const horizontal = rnd() > 0.42;
    let sx, sy, sz, px, py, pz;
    if (horizontal) {
      sx = t.w * (0.35 + rnd() * 0.55);
      sy = 0.07 + rnd() * 0.06;
      sz = 0.12 + rnd() * 0.1;
      px = cx + sideSign * (t.w * 0.5 + 0.02);
      py = y0 + t.h * (0.15 + rnd() * 0.7);
      pz = (rnd() - 0.5) * t.d * 0.7;
    } else {
      sx = 0.08 + rnd() * 0.07;
      sy = t.h * (0.25 + rnd() * 0.55);
      sz = 0.12 + rnd() * 0.1;
      px = cx + sideSign * (t.w * 0.5 + 0.02);
      py = y0 + t.h * (0.2 + rnd() * 0.55);
      pz = (rnd() - 0.5) * t.d * 0.65;
    }
    // 内壁刻线（朝轨道）
    if (rnd() < 0.35) {
      px = cx - sideSign * (t.w * 0.5 + 0.02);
    }
    const strip = new THREE.Mesh(
      facet(new THREE.BoxGeometry(sx, sy, sz)),
      stripMat
    );
    strip.name = "mech-strip";
    strip.position.set(px, py, pz);
    // 略外凸
    strip.position.x += sideSign * 0.01;
    addOutline(strip, GATE.outline * 0.85);
    g.add(strip);
  }

  // 基座风化乱石（浅暖灰褐，呼应 Towerscaper 水岸石基）
  const rubbleN = 10 + Math.floor(rnd() * 6);
  const rubbleMat = palette.rubble;
  for (let i = 0; i < rubbleN; i++) {
    const rs = 0.35 + rnd() * 1.1;
    const rock = new THREE.Mesh(
      facet(new THREE.DodecahedronGeometry(rs, 0)),
      rubbleMat
    );
    rock.name = "rubble";
    const ang = rnd() * Math.PI * 2;
    const rad = 2.2 + rnd() * 3.5;
    rock.position.set(
      sideSign * (2.5 + rnd() * 3.5) + Math.cos(ang) * rad * 0.15,
      rs * 0.35 - GATE.plinthH * 0.3,
      Math.sin(ang) * rad * 0.55
    );
    rock.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
    rock.scale.set(0.7 + rnd() * 0.6, 0.45 + rnd() * 0.4, 0.7 + rnd() * 0.55);
    addOutline(rock, 0.04);
    g.add(rock);
  }

  g.userData.towerHeight = yCursor;
  return g;
}

/**
 * 在轨道「离开草地、进入峡谷」交界建太古双子要塞 + 三重圆拱门。
 */
export function buildAbandonedGate({
  curve,
  planetRadius = PLANET_RADIUS,
  setback = GATE_SETBACK,
  anchorU = null,
  seed = 20260808,
} = {}) {
  const group = new THREE.Group();
  group.name = "cyber-megalithic-twin-gates";
  if (!curve) return group;

  const totalLen = curve.getLength();
  if (!(totalLen > 1)) return group;

  const groundRadiusAt = (dir) => {
    const flat = worldToFlatXZ(dir, planetRadius);
    if (flat) return planetRadius + groundLiftAt(flat.x, flat.z);
    return planetRadius + canyonOffsetDir(dir);
  };

  let entryU = -1;
  if (!Number.isFinite(anchorU)) {
    const N = 1200;
    let prevDrop = 0;
    for (let i = 0; i < N; i++) {
      const u = i / N;
      curve.getPointAt(u, _p);
      _up.copy(_p).normalize();
      const drop = canyonOffsetDir(_up);
      if (i > 0 && prevDrop === 0 && drop < 0) {
        entryU = u;
        break;
      }
      prevDrop = drop;
    }
    if (entryU < 0) return group;
  }

  const autoU = Number.isFinite(anchorU) ? null : findGateSeatU(curve, planetRadius);
  const gateU = Number.isFinite(anchorU)
    ? ((anchorU % 1) + 1) % 1
    : Number.isFinite(autoU)
      ? autoU
      : entryU - setback / totalLen;
  if (!(gateU > 0)) return group;

  curve.getPointAt(gateU, _p);
  curve.getTangentAt(gateU, _fwd).normalize();
  _up.copy(_p).normalize();
  _right.crossVectors(_up, _fwd).normalize();
  _up.crossVectors(_fwd, _right).normalize();

  const groundR = groundRadiusAt(_up);
  const seat = _up.clone().multiplyScalar(groundR);

  _m.makeBasis(_right, _up, _fwd);
  const basisQ = new THREE.Quaternion().setFromRotationMatrix(_m);

  // ---------- seatRoot：全部要塞本地层级 ----------
  const seatRoot = new THREE.Group();
  seatRoot.name = "gate-seat-root";
  group.add(seatRoot);

  const rnd = lcg(seed);
  // Towerscaper 糖果色：左右塔不同色，拱门用奶油白，矮墩随塔
  const [leftColor, rightColor] = pickTowerColors(rnd);
  const leftPalette = makePalette(leftColor.main, leftColor.roof);
  const rightPalette = makePalette(rightColor.main, rightColor.roof);
  const archMat = matMain(TS_ARCH);
  const pierMat = matMain(TS_ARCH);

  // 1) 三重圆拱（形状不变）
  const archGeo = extrudeGatePart(createGateShape(GATE.passHalf), GATE.archDepth);
  const archZ = [-ARCH_PITCH, 0, ARCH_PITCH];
  for (let i = 0; i < archZ.length; i++) {
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.name = `gate-arch-${i}`;
    arch.position.set(0, 0, archZ[i]);
    arch.castShadow = true;
    arch.receiveShadow = true;
    addOutline(arch, GATE.outline);
    arch.userData.collideRadius = 0;
    seatRoot.add(arch);
  }

  // 2) 双子巨塔：±5 夹道 10（左右塔不同糖果色）
  const leftTower = buildTieredTower(-1, rnd, leftPalette);
  const rightTower = buildTieredTower(1, rnd, rightPalette);
  seatRoot.add(leftTower, rightTower);

  // 3) 通道两侧额外矮墩：强化「一线天」纵深
  for (const side of [-1, 1]) {
    const pier = new THREE.Mesh(
      facet(new THREE.BoxGeometry(1.8, GATE.archTop * 0.92, GATE_DEPTH * 0.92)),
      pierMat
    );
    pier.name = side < 0 ? "channel-pier-L" : "channel-pier-R";
    pier.position.set(
      side * (GATE.passHalf + 1.1),
      GATE.archTop * 0.46,
      0
    );
    addOutline(pier, GATE.outline);
    seatRoot.add(pier);
  }

  // 沉降：整组沿径向埋脚
  const sink = measureFootFloat(seat, basisQ, groundRadiusAt) + BURY_MARGIN;
  seatRoot.position.copy(seat).addScaledVector(_up, -sink);
  seatRoot.quaternion.copy(basisQ);

  group.userData.sink = sink;
  group.userData.seatRoot = seatRoot;
  group.userData.kind = "cyber-megalithic-twin-gates";
  group.userData.arches = archZ.length;
  group.userData.anchor = {
    entryU,
    gateU,
    defaultGateU: gateU,
    entryS: entryU * totalLen,
    gateS: gateU * totalLen,
    setback,
  };
  group.userData.metrics = Object.freeze({
    totalHeight: TOTAL_HEIGHT,
    towerHeight: TOWER_HEIGHT,
    wallWidth: GATE.channelWidth + 9.2 * 2,
    passageWidth: GATE.passHalf * 2,
    channelWidth: GATE.channelWidth,
    towerOffset: GATE.towerOffset,
    passageApex: PASS_APEX,
    gateDepth: GATE_DEPTH,
    archDepth: GATE.archDepth,
    archGap: GATE.archGap,
    archPitch: ARCH_PITCH,
    playerHeightMultiple: +(TOWER_HEIGHT / PLAYER_H).toFixed(2),
    deckWidthMultiple: +((GATE.passHalf * 2) / 3.35).toFixed(2),
  });
  group.userData.relocate = (u) => relocateAbandonedGate(group, curve, u, planetRadius);
  return group;
}

/**
 * 搬迁：只动 seatRoot 位姿（层级内相对位置不变）。
 */
export function relocateAbandonedGate(group, curve, u, planetRadius = PLANET_RADIUS) {
  if (!group || !curve || !Number.isFinite(u)) return false;
  const seatRoot = group.userData.seatRoot;
  if (!seatRoot) return false;

  const gateU = ((u % 1) + 1) % 1;
  const totalLen = curve.getLength();

  curve.getPointAt(gateU, _p);
  curve.getTangentAt(gateU, _fwd).normalize();
  _up.copy(_p).normalize();
  _right.crossVectors(_up, _fwd).normalize();
  _up.crossVectors(_fwd, _right).normalize();

  const groundRadiusAt = (dir) => {
    const f = worldToFlatXZ(dir, planetRadius);
    if (f) return planetRadius + groundLiftAt(f.x, f.z);
    return planetRadius + canyonOffsetDir(dir);
  };
  const groundR = groundRadiusAt(_up);
  const seat = _up.clone().multiplyScalar(groundR);

  _m.makeBasis(_right, _up, _fwd);
  const basisQ = new THREE.Quaternion().setFromRotationMatrix(_m);
  const sink = measureFootFloat(seat, basisQ, groundRadiusAt) + BURY_MARGIN;

  seatRoot.position.copy(seat).addScaledVector(_up, -sink);
  seatRoot.quaternion.copy(basisQ);
  group.userData.sink = sink;

  const prev = group.userData.anchor || {};
  group.userData.anchor = {
    ...prev,
    gateU,
    gateS: gateU * totalLen,
    defaultGateU: Number.isFinite(prev.defaultGateU) ? prev.defaultGateU : gateU,
    relocated: true,
  };
  return true;
}
