// =====================================================================
//  星海运河环线（World Canal Loop）
//  一条闭合的、在球面地面上挖出来的浅沟，连通主要场景：
//  - 路径：CatmullRom 闭合样条，控制点取各场景方向（稍曲折，绕开正对）
//  - 形态：地面沟渠（河床 + 水面 + 两侧立壁 + 岸顶土埂），不是埋进球心的地下通道
//  - 贴球：随球面曲率逐点倾斜；整体略抬离球面，避免与实心星球 z-fight
//  - 每个场景处留登岸参数（sinks，供 nav/marker 使用）
//
//  剖面（径向，自球心向外）：
//      土埂顶  R + bedBias + depth
//      水面    R + bedBias + waterFill
//      河床    R + bedBias          ← 略高于实心球面，整条沟可见
//      星球面  R
// =====================================================================
import * as THREE from "three";
import { toonMat } from "../assets/toon.js";
import { PLANET_RADIUS } from "./planet.js";

// 沟深（岸顶到河床，世界单位）——地面浅沟，不是地下隧道
export const CANAL_DEPTH = 0.95;
// 河床相对实心球面的抬升：必须 > 0，否则河床/立壁被实心星球遮挡
const BED_BIAS = 0.05;
// 水面相对河床的抬升（约占沟深 2/3，像灌了水的沟）
const WATER_FILL = 0.62;
/** 运河水面相对当地地表抬升（= 河床偏置 + 水深）。护城河交接必须用同一值。 */
export const CANAL_WATER_LIFT = BED_BIAS + WATER_FILL;
// 运河半宽（沟内缘到中线）：原 2.1 × 3 = 6.3（全宽约 12.6）
export const CANAL_HALF_WIDTH = 6.3;
// 岸顶土埂外延宽度（随河道加宽略放大，仍明显窄于河面）
const LIP_WIDTH = 1.4;
// 土埂厚度（径向）
const LIP_THICK = 0.1;
// 立壁厚度（横向，避免纸片闪烁）
const WALL_THICK = 0.22;
// 围边样式对外公开：纳沃纳广场等节点复用同一套立壁/土埂语言
export const CANAL_LIP_WIDTH = LIP_WIDTH;
export const CANAL_LIP_THICK = LIP_THICK;
export const CANAL_WALL_THICK = WALL_THICK;
export const CANAL_BANK_COLOR = 0x6b563f; // 立壁土色
export const CANAL_LIP_COLOR = 0x7a6548; // 岸顶土埂
// 场景登岸浅湾半径（数据预留）
const DOCK_RADIUS = 8.4;
// 运河水面色：护城河/交接水系以此为准（不再用护城河旧淡青）
export const SHARED_WATER_COLOR = 0x3a86a0;

/** 运河水面材质；护城河水面复用，保证色相+质感一致。 */
export function createCanalWaterMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: SHARED_WATER_COLOR,
    transparent: true,
    opacity: 0.78,
    roughness: 0.14,
    metalness: 0.04,
    clearcoat: 0.5,
    clearcoatRoughness: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

const _p = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

/**
 * 在 [a, b] 大圆弧之间插入 k 个曲折中间点，用于让运河在场景间绕行。
 * 沿大圆 slerp 后，再在切向平面内左右微偏，形成"S"形曲折。
 * @param {THREE.Vector3} a 起点（单位方向或世界位）
 * @param {THREE.Vector3} b 终点
 * @param {number} k 插入点数
 * @param {number} wiggle 横向摆动幅度（弧度）
 * @param {number} r 径向半径（球面 R）
 */
export function insertWindingPoints(a, b, k, wiggle, getR, out) {
  const ad = a.clone().normalize();
  const bd = b.clone().normalize();
  for (let i = 1; i <= k; i++) {
    const t = i / (k + 1);
    // 球面线性插值（大圆弧）
    const dir = ad.clone().lerp(bd, t).normalize();
    // 在切向平面内左右摆动，制造曲折
    _fwd.copy(bd).sub(ad).normalize();
    _right.crossVectors(dir, _fwd).normalize();
    if (_right.lengthSq() < 1e-6) {
      _right.set(1, 0, 0).addScaledVector(dir, -dir.x).normalize();
    }
    const sway = Math.sin(t * Math.PI) * wiggle;
    dir.addScaledVector(_right, sway).normalize();
    // 按当前方向查询地表抬升后得到河床半径（在圣城区域贴合高度场）
    out.push(dir.multiplyScalar(getR(dir)));
  }
}

/**
 * 沿采样扫掠一条“四棱柱条带”：横向 [side0, side1]，径向高度 [h0, h1]（相对河床 p）。
 * 用于河床薄板、水面薄板、单侧立壁、岸顶土埂。
 * sample.gap === true 的区段不生成面（给广场等节点让路，避免重叠）。
 */
function sweepPrism(samplesArr, side0, side1, h0, h1, mat) {
  const n = samplesArr.length;
  const positions = new Float32Array(n * 4 * 3);
  const v = new THREE.Vector3();
  const write = (idx, s, side, h) => {
    v.copy(s.p).addScaledVector(s.right, side).addScaledVector(s.up, h);
    positions[idx] = v.x;
    positions[idx + 1] = v.y;
    positions[idx + 2] = v.z;
  };
  for (let i = 0; i < n; i++) {
    const s = samplesArr[i];
    // 顶面两顶点（h1）+ 底面两顶点（h0）
    write(i * 12 + 0, s, side0, h1);
    write(i * 12 + 3, s, side1, h1);
    write(i * 12 + 6, s, side0, h0);
    write(i * 12 + 9, s, side1, h0);
  }
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    // 两端任一点在缺口内则跳过该段，广场/节点处运河断开
    if (samplesArr[i].gap || samplesArr[i + 1].gap) continue;
    const a = i * 4;
    const b = (i + 1) * 4;
    idx.push(a, b, a + 1, a + 1, b, b + 1); // 顶
    idx.push(a + 2, a + 3, b + 2, a + 3, b + 3, b + 2); // 底
    idx.push(a, a + 2, b, a + 2, b + 2, b); // side0 壁
    idx.push(a + 1, b + 1, a + 3, a + 3, b + 1, b + 3); // side1 壁
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (idx.length) geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * 构建星海运河：地面浅沟环线。
 * @param {THREE.Scene} scene
 * @param {number} planetRadius 星球半径
 * @param {object} opts
 * @param {Array<THREE.Vector3>} opts.anchors 各场景锚点方向/位置（World 或单位 dir）
 * @param {string[]} [opts.names] 锚点名称
 * @param {number} [opts.depth=CANAL_DEPTH] 沟深
 * @param {Array<{center:THREE.Vector3, radius:number}>} [opts.excludeZones]
 *        排除区：center 为世界方向/位置，radius 为切向半宽（世界单位）。
 *        落在区内的采样不生成河道网格（给纳沃纳广场等让路）。
 * @returns {{ group:THREE.Group, curve:THREE.CatmullRomCurve3, sinks:Array, planetRadius:number, waterR:number, bedR:number, depth:number }}
 */
export function buildWorldCanal(scene, planetRadius = PLANET_RADIUS, opts = {}) {
  const depth = opts.depth ?? CANAL_DEPTH;
  // 地表抬升查询：在圣城等区域贴合高度场；默认 0（普通球面）
  const groundLift = opts.groundLift ?? (() => 0);
  const bedRAt = (dir) => planetRadius + groundLift(dir) + BED_BIAS;
  // 排除区：优先用世界距离（覆盖河道半宽偏移）；并辅以角半径
  const excludeZones = (opts.excludeZones || [])
    .map((z) => {
      if (!(z?.radius > 0)) return null;
      const dir = (z.center?.isVector3 ? z.center : z.worldCenter)?.clone?.();
      if (!dir || dir.lengthSq() < 1e-12) return null;
      const worldCenter = z.worldCenter?.isVector3
        ? z.worldCenter.clone()
        : dir.clone().normalize().multiplyScalar(planetRadius);
      return {
        dir: dir.normalize(),
        worldCenter,
        radius: z.radius,
        ang: z.radius / Math.max(1, planetRadius),
      };
    })
    .filter(Boolean);
  const inExclude = (dir, worldP) => {
    for (const z of excludeZones) {
      if (worldP && worldP.distanceTo(z.worldCenter) <= z.radius) return true;
      if (dir.angleTo(z.dir) <= z.ang) return true;
    }
    return false;
  };
  // 返回给外部的基准半径（不含动态抬升），实际几何与曲线按每点抬升计算
  const bedR = planetRadius + BED_BIAS;
  const waterR = bedR + WATER_FILL;
  const lipR = bedR + depth;

  const anchors = (opts.anchors || []).map((a) => a.clone().normalize());

  // ---- 组装控制点：每个场景锚点 + 场景间曲折中间点（按方向贴合地表） ----
  const controls = [];
  const count = anchors.length;
  for (let i = 0; i < count; i++) {
    const a = anchors[i];
    const b = anchors[(i + 1) % count];
    controls.push(a.clone().multiplyScalar(bedRAt(a)));
    const dist = a.angleTo(b);
    const wiggle = THREE.MathUtils.clamp(dist * 0.16, 0.015, 0.11);
    insertWindingPoints(a, b, 3, wiggle, bedRAt, controls);
  }

  // ---- 初始 CatmullRom 闭合样条 ----
  const rawCurve = new THREE.CatmullRomCurve3(controls, true, "centripetal", 0.5);

  // ---- 高密度重采样 + 投影回当前方向河床半径 + 滑动平均抹角 ----
  const N = 1400;
  const projected = [];
  for (let i = 0; i < N; i++) {
    rawCurve.getPointAt(i / N, _p);
    projected.push(_p.clone().normalize().multiplyScalar(bedRAt(_p.clone().normalize())));
  }
  for (let pass = 0; pass < 2; pass++) {
    const src = projected.map((v) => v.clone());
    for (let i = 0; i < N; i++) {
      const a = src[(i - 1 + N) % N];
      const b = src[i];
      const c = src[(i + 1 + N) % N];
      projected[i]
        .set((a.x + 2 * b.x + c.x) / 4, (a.y + 2 * b.y + c.y) / 4, (a.z + 2 * b.z + c.z) / 4)
        .normalize()
        .multiplyScalar(bedRAt(projected[i].clone().normalize()));
    }
  }
  const curve = new THREE.CatmullRomCurve3(projected, true, "centripetal", 0.5);

  // ---- 采样：河床点 + 局部基（up=径向, right=横向, fwd=切向） ----
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) % 1;
    curve.getPointAt(t, _p);
    _fwd.copy(curve.getTangentAt(t)).normalize();
    _up.copy(_p).normalize();
    _right.crossVectors(_up, _fwd).normalize();
    if (_right.lengthSq() < 1e-8) {
      _right.set(1, 0, 0).addScaledVector(_up, -_up.x).normalize();
    }
    const pBed = _up.clone().multiplyScalar(bedRAt(_up));
    samples.push({
      p: pBed,
      up: _up.clone(),
      right: _right.clone(),
      fwd: _fwd.clone(),
      t,
      gap: inExclude(_up, pBed),
    });
  }

  const group = new THREE.Group();
  group.name = "world-canal";
  group.userData.excludeZones = excludeZones.length;
  group.userData.gapSampleCount = samples.filter((s) => s.gap).length;

  const half = CANAL_HALF_WIDTH;
  const bedMat = toonMat(0x3a2f26, { flatShading: true });
  const bankMat = toonMat(CANAL_BANK_COLOR, { flatShading: true });
  const lipMat = toonMat(CANAL_LIP_COLOR, { flatShading: true });
  const waterMat = createCanalWaterMaterial();

  // 1) 河床：沟底薄板（整条贴地浅沟底）
  const bed = sweepPrism(samples, -half, half, -0.02, 0.02, bedMat);
  bed.name = "canal-bed";
  group.add(bed);

  // 2) 水面：灌在沟里，低于岸顶
  const water = sweepPrism(samples, -half + 0.04, half - 0.04, WATER_FILL - 0.02, WATER_FILL + 0.02, waterMat);
  water.name = "canal-water";
  water.renderOrder = 2;
  water.castShadow = false;
  group.add(water);

  // 3) 左右立壁：只做两侧墙，不再用整宽实心条盖住水面
  const wallH0 = 0;
  const wallH1 = depth;
  const leftWall = sweepPrism(samples, -half - WALL_THICK, -half, wallH0, wallH1, bankMat);
  leftWall.name = "canal-wall-L";
  group.add(leftWall);
  const rightWall = sweepPrism(samples, half, half + WALL_THICK, wallH0, wallH1, bankMat);
  rightWall.name = "canal-wall-R";
  group.add(rightWall);

  // 4) 岸顶土埂：挖沟堆在两岸，略高出沟沿，让“地面沟”轮廓可读
  const lipH0 = depth - LIP_THICK * 0.2;
  const lipH1 = depth + LIP_THICK;
  const leftLip = sweepPrism(samples, -half - LIP_WIDTH, -half - WALL_THICK * 0.5, lipH0, lipH1, lipMat);
  leftLip.name = "canal-lip-L";
  group.add(leftLip);
  const rightLip = sweepPrism(samples, half + WALL_THICK * 0.5, half + LIP_WIDTH, lipH0, lipH1, lipMat);
  rightLip.name = "canal-lip-R";
  group.add(rightLip);

  scene.add(group);

  // 各场景登岸信息（曲线参数 u + 方向）
  const sinks = anchors.map((dir, i) => {
    let bestT = 0;
    let bestD = Infinity;
    for (let s = 0; s < samples.length; s++) {
      const d = samples[s].p.clone().normalize().angleTo(dir);
      if (d < bestD) {
        bestD = d;
        bestT = samples[s].t;
      }
    }
    return { dir, u: bestT, name: opts.names?.[i], dockRadius: DOCK_RADIUS };
  });

  return {
    group,
    curve,
    sinks,
    planetRadius,
    waterR,
    bedR,
    lipR,
    depth,
  };
}
