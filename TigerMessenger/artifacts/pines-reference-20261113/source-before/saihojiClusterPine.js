// =====================================================================
//  苔庭丛松（2026-11-11 用户参考图）
//  一丛 4–6 棵：高而细、近直略弯、外倾 2–8° 的灰橙斑驳树干；下部约 58% 光秃；
//  上部约 40% 由几层水平展开的扁平云团状针叶垫（黑松 / 盆景层片）组成，
//  深灰绿；枝条斜伸托住叶垫；丛中最高偏后一棵树冠稀疏、枝条发黑（近枯）。
//  模型以「树高 = 1」建造，摆放时整体缩放到目标高度；每棵树 2 个网格
//  （树皮 + 叶垫，顶点色），材质全局共享，不逐棵释放。
//  只供苔庭（world/saihoji.js + saihojiPineLayout.js）使用；主岛林带 /
//  圣城台地仍用 saihojiPineOptimized.js 的 Blender 古松，未改。
// =====================================================================
import * as THREE from "three";
import { getToonGradient } from "./toon.js";

/** 原苔庭古松在鲲背岛局部坐标中的实测平均高（25 株，2026-11-11 node 实测 5.4479）。 */
export const SAIHOJI_LEGACY_PINE_MEAN_HEIGHT = 5.4479;
/** 用户要求：新松平均高 = 原 × 2.5 */
export const SAIHOJI_CLUSTER_PINE_HEIGHT_FACTOR = 2.5;
export const SAIHOJI_CLUSTER_PINE_MEAN_HEIGHT =
  SAIHOJI_LEGACY_PINE_MEAN_HEIGHT * SAIHOJI_CLUSTER_PINE_HEIGHT_FACTOR;
/** 树干光秃段占树高比例（参考图约 55–60%） */
export const SAIHOJI_CLUSTER_PINE_BARE_FRACTION = 0.58;
const TRUNK_BASE_RADIUS = 0.027; // × 树高（参考图根部干径 ≈ 0.054H）

/**
 * 一丛 6 棵的模板（单位：丛平均树高 H）。x 向右、+z 为丛前（近观者）、−z 为丛后。
 * 2026-11-11 06:48 用户再次给图：「改成图示形状，位置关系按图示，数量按图示，去掉其他松树」。
 * 按参考图逐棵量（图宽 1116 px，平均树高 ≈ 834 px 作 H；根部 x → dx，根部纵向位置差 → dz）：
 *   左四棵一组：D 左倾约 9°、冠向左；B 最前、左组最高、微 S 弯、宽冠；C 紧贴 B 后（根距 0.056H）；E 最矮、冠向两侧铺开；
 *   中间空开约 0.2H；右两棵一组：A 偏后、最高、稀疏近枯（枝发黑）；F 在 A 右前、冠向右。
 *   dx/dz：根部位置；h：相对高；lean：外倾角（度）；leanAz：外倾方位（弧度，0=+x 右，π=左）；spread：枝条主伸展方位；reach：枝长倍率
 */
const CLUSTER_6 = Object.freeze([
  { key: "D", dx: -0.23, dz: 0.01, h: 0.95, lean: 9, leanAz: Math.PI + 0.1, spread: Math.PI, reach: 1.05 },
  { key: "B", dx: -0.13, dz: 0.06, h: 1.12, lean: 3, leanAz: Math.PI - 0.3, spread: Math.PI / 2 + 0.3, reach: 1.3 },
  { key: "C", dx: -0.105, dz: 0.01, h: 0.91, lean: 3, leanAz: -0.3, spread: -Math.PI / 2 - 0.2, reach: 1.0 },
  { key: "E", dx: -0.01, dz: 0.05, h: 0.83, lean: 3, leanAz: 0.2, spread: 0.3, reach: 1.25 },
  { key: "A", dx: 0.2, dz: -0.08, h: 1.17, lean: 3, leanAz: Math.PI - 0.2, sparse: true, spread: -Math.PI / 2 },
  { key: "F", dx: 0.27, dz: -0.06, h: 0.96, lean: 4, leanAz: 0.1, spread: 0, reach: 1.1 },
]);

/**
 * 苔庭只留这一丛 6 棵（2026-11-11 06:49 用户：「松树数量也按照图示的来，去掉其他的松树」）。
 * 丛中心为鲲背岛局部坐标的期望值，实际由 saihojiPineLayout 在真实地壳上就近找可用位（避浅池 / 石组）。
 *   mirror：模板左右镜像（不镜像，保持图示左右关系）；drop：去掉的成员；scale：该丛平均高倍率；zone：簿记归属景区。
 *   原西丛 / 东丛（共 10 棵）已去掉；旧版见 /tmp/pine-backup-20261111 与 artifacts/backups/pines-20261111。
 */
export const SAIHOJI_PINE_CLUSTERS = Object.freeze([
  { id: "grove", zone: "master-stones", cx: 0.6, cz: -3.1, yaw: Math.PI + 0.15, scale: 1, mirror: false, drop: [] },
]);

/** 展开所有成员，并把全体平均高度精确归一到 SAIHOJI_CLUSTER_PINE_MEAN_HEIGHT。 */
export function saihojiClusterMembers() {
  const out = [];
  let seed = 7301;
  for (const cluster of SAIHOJI_PINE_CLUSTERS) {
    for (const m of CLUSTER_6) {
      if (cluster.drop.includes(m.key)) continue;
      const sx = cluster.mirror ? -1 : 1;
      out.push({
        cluster: cluster.id,
        zone: cluster.zone,
        key: m.key,
        seed: seed++,
        dx: m.dx * sx,
        dz: m.dz,
        rel: m.h * cluster.scale,
        lean: m.lean,
        // 镜像：方位角关于 z 轴翻转
        leanAz: cluster.mirror ? Math.PI - m.leanAz : m.leanAz,
        // 枝条主伸展方位：两端树沿丛长轴向外，中间树向丛前后（−z / +z）铺开
        spread: cluster.mirror ? Math.PI - m.spread : m.spread,
        reach: m.reach ?? 1,
        sparse: !!m.sparse,
      });
    }
  }
  const mean = out.reduce((s, m) => s + m.rel, 0) / out.length;
  for (const m of out) m.height = (m.rel / mean) * SAIHOJI_CLUSTER_PINE_MEAN_HEIGHT;
  return out;
}

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let _materials = null;
function materials() {
  if (_materials) return _materials;
  const gradientMap = getToonGradient();
  const bark = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap });
  bark.name = "SaihojiClusterPine_Bark";
  const leaf = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap, side: THREE.DoubleSide });
  leaf.name = "SaihojiClusterPine_Needles";
  for (const m of [bark, leaf]) m.userData = { shared: true, revision: "saihoji-cluster-pine-20261111" };
  _materials = { bark, leaf };
  return _materials;
}

const BARK = [0x8e847a, 0x857b72, 0x9a8673, 0x746f69, 0xa08d7a].map((c) => new THREE.Color(c));
const DEAD = new THREE.Color(0x3b3632);
const NEEDLE_DARK = new THREE.Color(0x2f3d33);
const NEEDLE_MID = new THREE.Color(0x3f4f41);
const NEEDLE_TOP = new THREE.Color(0x56664f);

/** 简单网格累加器（非索引 → 平面着色），顶点色逐面。 */
class Builder {
  constructor() { this.pos = []; this.col = []; }
  tri(a, b, c, color) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
  }
  quad(a, b, c, d, color) { this.tri(a, b, c, color); this.tri(a, c, d, color); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** 沿折线做 n 边棱柱管，radii 与 points 一一对应。 */
function tube(builder, points, radii, sides, colorAt) {
  const rings = points.map((p, i) => {
    const next = points[Math.min(i + 1, points.length - 1)];
    const prev = points[Math.max(i - 1, 0)];
    const dir = next.clone().sub(prev).normalize();
    const ref = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(dir, ref).normalize();
    const v = new THREE.Vector3().crossVectors(dir, u).normalize();
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      ring.push(p.clone().addScaledVector(u, Math.cos(a) * radii[i]).addScaledVector(v, Math.sin(a) * radii[i]));
    }
    return ring;
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      builder.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2], colorAt(i, k));
    }
  }
  // 顶盖
  const last = rings[rings.length - 1], tip = points[points.length - 1];
  for (let k = 0; k < sides; k++) builder.tri(last[k], tip, last[(k + 1) % sides], colorAt(rings.length - 1, k));
}

/** 扁平云团叶垫：一圈参差的低多边形扁盘（上凸下平），半径 r、厚 t。 */
function needlePad(builder, center, r, t, rnd, tint = 0) {
  const n = 9;
  const ring = [], under = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.3;
    const rr = r * (0.7 + rnd() * 0.45); // 边缘参差
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr * (0.75 + rnd() * 0.3);
    ring.push(new THREE.Vector3(center.x + x, center.y + t * (0.15 + rnd() * 0.25), center.z + z));
    under.push(new THREE.Vector3(center.x + x * 0.82, center.y - t * 0.35, center.z + z * 0.82));
  }
  const top = new THREE.Vector3(center.x + (rnd() - 0.5) * r * 0.2, center.y + t, center.z + (rnd() - 0.5) * r * 0.2);
  const bottom = new THREE.Vector3(center.x, center.y - t * 0.45, center.z);
  const topColor = NEEDLE_MID.clone().lerp(NEEDLE_TOP, 0.35 + tint * 0.4);
  const sideColor = NEEDLE_DARK.clone().lerp(NEEDLE_MID, 0.35 + tint * 0.3);
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n;
    const shade = (k % 3) * 0.06;
    builder.tri(ring[k], top, ring[k2], topColor.clone().offsetHSL(0, 0, shade - 0.04));
    builder.quad(ring[k], ring[k2], under[k2], under[k], sideColor);
    builder.tri(under[k], under[k2], bottom, NEEDLE_DARK);
  }
}

/** 云团叶垫：主垫 + 2–3 个错落的副垫，边缘参差、厚薄不一（黑松层片）。 */
function cloudPad(builder, center, r, t, rnd, tint = 0) {
  needlePad(builder, center, r, t, rnd, tint);
  // 2026-11-11 参考图：叶团是厚实、参差的一团团（不是薄伞盘）→ 副垫 4–6 个，上下错落
  const n = 4 + ((rnd() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.8, d = r * (0.45 + rnd() * 0.4);
    const c = center.clone().add(new THREE.Vector3(Math.cos(a) * d, (rnd() - 0.35) * t * 1.6, Math.sin(a) * d));
    needlePad(builder, c, r * (0.5 + rnd() * 0.22), t * (0.75 + rnd() * 0.3), rnd, tint * 0.8);
  }
}

/**
 * 单棵丛松（树高 1）。opts: seed, lean(度), leanAz(弧度), sparse, outward(弧度：枝条主伸展方向), reach(枝长倍率)
 * 返回根 Group（userData.kind='gardenPine'），子网格：树皮（含枝）与叶垫（userData.pineCrown=true）。
 */
export function createSaihojiClusterPine(opts = {}) {
  const seed = opts.seed ?? 1;
  const rnd = rng(seed * 2654435761);
  const lean = THREE.MathUtils.degToRad(opts.lean ?? 4);
  const leanAz = opts.leanAz ?? 0;
  const sparse = !!opts.sparse;
  const outward = opts.outward ?? leanAz;
  const leanDir = new THREE.Vector3(Math.cos(leanAz), 0, Math.sin(leanAz));
  const bendDir = new THREE.Vector3(-leanDir.z, 0, leanDir.x);
  const bendAmp = (rnd() - 0.5) * 0.035;

  // 树干中心线：外倾 + 一道缓弯
  const SEG = 7;
  const trunkAt = (t) => {
    const p = new THREE.Vector3(0, t, 0);
    p.addScaledVector(leanDir, Math.tan(lean) * t + 0.005 * t * t);
    p.addScaledVector(bendDir, bendAmp * Math.sin(Math.PI * t));
    return p;
  };
  const trunkTop = 0.97;
  const points = [], radii = [];
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * trunkTop;
    points.push(trunkAt(t));
    const flare = i === 0 ? 1.45 : 1;
    radii.push(TRUNK_BASE_RADIUS * flare * (1 - 0.62 * (t / trunkTop)));
  }
  const bark = new Builder(), leaf = new Builder();
  const barkCol = [];
  for (let i = 0; i <= SEG; i++) barkCol.push(Array.from({ length: 6 }, () => BARK[(rnd() * BARK.length) | 0]));
  tube(bark, points, radii, 6, (i, k) => (sparse && i > SEG * 0.55 ? BARK[3].clone().lerp(DEAD, 0.5) : barkCol[i][k]));

  // 枝 + 叶垫：枝起于树高 0.555–0.91，最低叶垫约 0.57–0.6（下部约 58% 光秃）
  const tiers = sparse ? 5 : 5 + ((rnd() * 2) | 0);
  for (let i = 0; i < tiers; i++) {
    const f = i / Math.max(1, tiers - 1);
    const t = 0.57 + f * 0.34 + (rnd() - 0.5) * 0.02;   // 叶垫加厚后起枝点上移，保持下部约 58% 光秃
    const base = trunkAt(t);
    // 方位：交替两侧，整体偏向丛外
    const side = i % 2 === 0 ? 1 : -1;
    const az = outward + side * (0.6 + rnd() * 0.9) + (rnd() - 0.5) * 0.4;
    const len = (0.14 - f * 0.055) * (0.85 + rnd() * 0.3) * (sparse ? 0.85 : 1) * (opts.reach ?? 1);
    const dir = new THREE.Vector3(Math.cos(az), 0.3 + f * 0.3 + rnd() * 0.15, Math.sin(az)).normalize();   // 参考图枝条斜向上约 30–45°
    const mid = base.clone().addScaledVector(dir, len * 0.55);
    mid.y -= len * 0.05;
    const end = base.clone().addScaledVector(dir, len);
    const deadBranch = sparse && i !== tiers - 1 && rnd() < 0.7;
    const bc = deadBranch ? DEAD : BARK[1];
    tube(bark, [base, mid, end], [0.007, 0.0055, 0.0035], 4, () => bc);
    if (sparse) {
      // 枯枝状：再分两根黑色细枝，叶垫很少很小
      for (let j = 0; j < 2; j++) {
        const a2 = az + (j ? 0.7 : -0.7);
        const d2 = new THREE.Vector3(Math.cos(a2), 0.35, Math.sin(a2)).normalize();
        tube(bark, [mid, mid.clone().addScaledVector(d2, len * 0.45)], [0.004, 0.002], 3, () => DEAD);
      }
      if (!deadBranch) needlePad(leaf, end.clone().add(new THREE.Vector3(0, 0.012, 0)), 0.045 + rnd() * 0.02, 0.016, rnd, 0.2);
      continue;
    }
    // 一根枝托 1–2 片扁平叶垫
    const padR = (0.11 - f * 0.04) * (0.85 + rnd() * 0.3);
    cloudPad(leaf, end.clone().add(new THREE.Vector3(0, 0.02, 0)), padR, 0.045, rnd, f);
    if (rnd() < 0.85) {
      const p2 = mid.clone().addScaledVector(new THREE.Vector3(Math.cos(az + side * 0.8), 0, Math.sin(az + side * 0.8)), padR * 0.6);
      needlePad(leaf, p2.add(new THREE.Vector3(0, 0.024, 0)), padR * 0.65, 0.035, rnd, f * 0.6);
    }
  }
  // 树顶冠垫
  const top = points[points.length - 1];
  if (sparse) {
    tube(bark, [top, top.clone().add(new THREE.Vector3(0.03, 0.05, -0.01))], [0.004, 0.0015], 3, () => DEAD);
    needlePad(leaf, top.clone().add(new THREE.Vector3(0.02, 0.01, 0)), 0.04, 0.014, rnd, 0.5);
  } else {
    cloudPad(leaf, top.clone().add(new THREE.Vector3(0, 0.018, 0)), 0.085, 0.045, rnd, 1);
  }

  const mats = materials();
  const root = new THREE.Group();
  root.name = "saihojiClusterPine";
  const barkMesh = new THREE.Mesh(bark.geometry(), mats.bark);
  barkMesh.name = `saihoji-cluster-pine-${seed}-bark`;
  const leafMesh = new THREE.Mesh(leaf.geometry(), mats.leaf);
  leafMesh.name = `saihoji-cluster-pine-${seed}-needles`;
  leafMesh.userData.pineCrown = true;
  for (const m of [barkMesh, leafMesh]) { m.castShadow = true; m.receiveShadow = true; root.add(m); }
  const box = new THREE.Box3().union(barkMesh.geometry.boundingBox).union(leafMesh.geometry.boundingBox);
  root.userData = {
    kind: "gardenPine",
    sourceSeed: seed,
    collideRadius: TRUNK_BASE_RADIUS * 1.6,
    height: box.max.y - box.min.y,
    modelHeightUnit: 1,
    clusterPine: { sparse, lean: opts.lean ?? 4, leanAz, bareFraction: SAIHOJI_CLUSTER_PINE_BARE_FRACTION, trunkBaseRadius: TRUNK_BASE_RADIUS },
    pineOptimization: { asset: "saihoji-cluster-pine-20261111", procedural: true, geometryApplied: true },
  };
  return root;
}

/** 树干光秃比例实测：最低叶垫 / 枝条起点的高度 ÷ 树高（模型空间）。 */
export function measureClusterPineBare(root) {
  let lowestBranch = Infinity, h = 0;
  root.traverse((n) => {
    if (!n.isMesh) return;
    const p = n.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      h = Math.max(h, p.getY(i));
      if (n.userData.pineCrown) lowestBranch = Math.min(lowestBranch, p.getY(i));
    }
  });
  return { lowestCrown: lowestBranch, height: h, bareFraction: lowestBranch / h };
}
