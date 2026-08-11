// =====================================================================
//  纳沃纳式双栖水利广场（Amphibious Canal Plaza）
//  运河进入高山圣城前的景观型水利节点：
//    旱季 isFlooded=false → 下凹石材广场 + 三大喷泉 + 巴洛克亲水台阶（市民座椅）
//    汛期 isFlooded=true  → 同一槽体蓄水 0.5–1m，台阶变码头，喷泉半浸
//  设计参照：纳沃纳广场三喷泉轴线 · 微凹 U 断面 · 边缘阶梯界面
//  局部约定：+Y 向上，+Z 长轴（朝城 / 运河走向），+X 横宽，原点为广场中心槽底。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "../assets/toon.js";
import { SHARED_WATER_COLOR, createCanalWaterMaterial, CANAL_WATER_LIFT } from "./canalSystem.js";

export const NAVONA_PLAZA_SPEC = Object.freeze({
  length: 38, // 长轴（运河走向）
  halfWidth: 9.5, // 半宽（建筑界面内缘）
  basinDepth: 0.85, // 槽心相对台沿下凹
  floodDepth: 0.72, // 蓄水目标深度（0.5–1m 带）
  segsL: 28,
  segsW: 14,
  stepCount: 4,
  stepTread: 0.55,
  stepRise: 0.2,
  fountainCount: 3,
  /** 运河网格排除半径余量（切向单位）：半对角 + 台阶 + 缓冲，避免与河道重叠 */
  canalGapPadding: 4.5,
});

/**
 * 运河排除区参数：以广场中心为球冠，半径覆盖广场槽体+台阶，使河道在此断开。
 * @param {THREE.Object3D} plaza createNavonaCanalPlaza 返回值（已放置）
 * @param {object} [spec]
 * @returns {{ center: THREE.Vector3, radius: number }|null}
 */
export function getNavonaPlazaCanalExcludeZone(plaza, spec = NAVONA_PLAZA_SPEC) {
  if (!plaza?.position) return null;
  const halfL = (spec.length ?? NAVONA_PLAZA_SPEC.length) * 0.5;
  const halfW = (spec.halfWidth ?? NAVONA_PLAZA_SPEC.halfWidth)
    + (spec.stepCount ?? 0) * (spec.stepTread ?? 0);
  const pad = spec.canalGapPadding ?? NAVONA_PLAZA_SPEC.canalGapPadding;
  const radius = Math.hypot(halfL, halfW) + pad;
  return {
    center: plaza.position.clone().normalize(),
    radius,
  };
}

const STONE_DARK = 0x3a4550; // 深青灰火山岩心
const STONE_MID = 0x5a6670; // 弧线铺装
const STONE_PALE = 0x9aa6ad; // 台阶 / 栏
const STONE_WARM = 0xc4b49a; // 喷泉基座暖石
const BRONZE = 0x8a6a3a;
const FOAM = 0xe8f4f0;

function part(geo, mat, name, outline = 0.028) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (outline > 0) addOutline(mesh, outline);
  return mesh;
}

/** 分段数：约每 1.5 单位一段（至少 1），让长盒体有足够顶点随地形曲率弯折 */
const segOf = (len) => Math.max(1, Math.round(len / 1.5));

/**
 * 微凹 U 断面广场底：中轴线最低，两侧抬升到台沿。
 * X ∈ [-halfW, halfW], Z ∈ [-halfL, halfL], Y 中心 0、两侧 +basinDepth。
 */
function makeConcaveBasinGeometry(halfW, halfL, depth, segsW, segsL) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let iz = 0; iz <= segsL; iz++) {
    const v = iz / segsL;
    const z = -halfL + v * halfL * 2;
    for (let ix = 0; ix <= segsW; ix++) {
      const u = ix / segsW;
      const x = -halfW + u * halfW * 2;
      // U 断面：|x/halfW|^1.6 抬升；长向两端略收口上扬
      const across = Math.pow(Math.abs(x) / halfW, 1.6);
      const along = Math.pow(Math.abs(z) / halfL, 2.2) * 0.18;
      const y = depth * (across * 0.92 + along);
      // 弧线铺装抖动（鸟瞰「石制运河」波纹感）
      const ripple = Math.sin(x * 0.55 + z * 0.22) * 0.012 * (1 - across);
      positions.push(x, y + ripple, z);
      uvs.push(u, v);
    }
  }
  const row = segsW + 1;
  for (let iz = 0; iz < segsL; iz++) {
    for (let ix = 0; ix < segsW; ix++) {
      const a = iz * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** 水面：与槽底同拓扑，Y 抬到 fillLevel（0–1 对应 0–floodDepth） */
function makeBasinWaterGeometry(halfW, halfL, depth, segsW, segsL) {
  // 比石面略小一圈，契合「不漫入两侧商铺」
  return makeConcaveBasinGeometry(halfW * 0.96, halfL * 0.98, depth * 0.15, segsW, segsL);
}

function makeFountain(name, scale, isCenter, random) {
  const g = new THREE.Group();
  g.name = name;
  const baseR = (isCenter ? 1.35 : 0.95) * scale;
  const base = part(
    new THREE.CylinderGeometry(baseR, baseR * 1.15, 0.35 * scale, 10),
    toonMat(STONE_WARM, { flatShading: true }),
    `${name}-base`,
    0.022
  );
  base.position.y = 0.18 * scale;
  g.add(base);

  // 方尖碑 / 雕塑柱（轴线焦点）
  const shaftH = (isCenter ? 3.6 : 2.2) * scale;
  const shaft = part(
    new THREE.BoxGeometry(0.28 * scale, shaftH, 0.28 * scale),
    toonMat(0xd8d0c0, { flatShading: true }),
    `${name}-obelisk`,
    0.02
  );
  shaft.position.y = 0.35 * scale + shaftH * 0.5;
  g.add(shaft);
  if (isCenter) {
    const cap = part(
      new THREE.ConeGeometry(0.18 * scale, 0.45 * scale, 6),
      toonMat(BRONZE, { flatShading: true }),
      `${name}-cap`,
      0.016
    );
    cap.position.y = 0.35 * scale + shaftH + 0.2 * scale;
    g.add(cap);
  }

  // 涌泉口盆
  const bowl = part(
    new THREE.TorusGeometry(baseR * 0.72, 0.08 * scale, 6, 14),
    toonMat(STONE_MID, { flatShading: true }),
    `${name}-bowl`,
    0.014
  );
  bowl.rotation.x = Math.PI / 2;
  bowl.position.y = 0.42 * scale;
  g.add(bowl);

  // 喷泉水柱（细柱，汛期半浸时仍露出上半）
  const jet = part(
    new THREE.CylinderGeometry(0.05 * scale, 0.07 * scale, 0.9 * scale, 6),
    toonMat(SHARED_WATER_COLOR, {
      flatShading: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),
    `${name}-jet`,
    0
  );
  jet.position.y = 0.55 * scale + 0.45 * scale;
  jet.userData.isJet = true;
  g.add(jet);

  // 方块水花
  const spray = new THREE.Group();
  spray.name = `${name}-spray`;
  for (let i = 0; i < (isCenter ? 8 : 5); i++) {
    const s = part(
      new THREE.BoxGeometry(0.08, 0.08, 0.08),
      toonMat(FOAM, { flatShading: true }),
      `${name}-spray-${i}`,
      0.008
    );
    const a = (i / 8) * Math.PI * 2 + random() * 0.2;
    s.position.set(Math.cos(a) * 0.25 * scale, 1.1 * scale + random() * 0.3, Math.sin(a) * 0.25 * scale);
    s.userData.phase = random() * Math.PI * 2;
    s.userData.baseY = s.position.y;
    spray.add(s);
  }
  g.add(spray);
  g.userData.spray = spray;
  g.userData.shaftH = shaftH;
  g.userData.isCenter = isCenter;
  return g;
}

/**
 * 构建双栖广场。
 * @param {object} [opts]
 * @param {number} [opts.seed]
 * @param {boolean} [opts.flooded=false] 初始是否蓄水
 * @returns {THREE.Group & {
 *   setFlooded(v: boolean|number): void,
 *   getFlooded(): number,
 *   update(dt: number, t: number): void,
 * }}
 */
export function createNavonaCanalPlaza(opts = {}) {
  const spec = { ...NAVONA_PLAZA_SPEC, ...opts };
  let _seed = (opts.seed ?? 7701) >>> 0;
  const random = () => {
    _seed = (Math.imul(1664525, _seed) + 1013904223) >>> 0;
    return _seed / 0x100000000;
  };

  const group = new THREE.Group();
  group.name = opts.name ?? "navona-canal-plaza";
  group.userData.kind = "navona-canal-plaza";
  group.userData.spec = spec;

  const halfW = spec.halfWidth;
  const halfL = spec.length * 0.5;
  const depth = spec.basinDepth;

  // ---- 1. 下凹石材广场（旱季主视觉）----
  const stoneMat = toonMat(STONE_DARK, { flatShading: true });
  const basin = part(
    makeConcaveBasinGeometry(halfW, halfL, depth, spec.segsW, spec.segsL),
    stoneMat,
    "navona-plaza-basin-stone",
    0.03
  );
  // 槽心落到 y=0 以下 depth，使台沿约在 y=depth
  basin.position.y = 0;
  basin.userData.conform = "basin"; // 顶点融合：整面顺地形曲率、边界埋入
  group.add(basin);

  // 弧线嵌缝：中轴深色「石制运河」条带（长向加密，顺地面曲率弯折）
  const inlay = part(
    new THREE.PlaneGeometry(halfW * 0.55, halfL * 1.9, 2, segOf(halfL * 1.9)),
    toonMat(0x2a3540, { flatShading: true, side: THREE.DoubleSide }),
    "navona-plaza-inlay-channel",
    0.012
  );
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.y = 0.04;
  inlay.userData.conform = "shell"; // 整面随广场曲率贴合地面
  group.add(inlay);

  // ---- 2. 双栖水面（汛期升起）----
  const waterMat = createCanalWaterMaterial();
  waterMat.opacity = 0.82;
  const water = part(
    makeBasinWaterGeometry(halfW, halfL, depth, spec.segsW, spec.segsL),
    waterMat,
    "navona-plaza-flood-water",
    0
  );
  water.position.y = 0.06;
  water.renderOrder = 3;
  water.visible = false;
  water.material.depthWrite = false;
  water.userData.conform = "basin"; // 水面同槽体一起顺地形曲率
  group.add(water);

  // ---- 3. 两侧巴洛克亲水台阶（旱=座椅，汛=码头/挡水）----
  const stepMat = toonMat(STONE_PALE, { flatShading: true });
  const stepsGroup = new THREE.Group();
  stepsGroup.name = "navona-plaza-baroque-steps";
  for (const side of [-1, 1]) {
    for (let s = 0; s < spec.stepCount; s++) {
      const tread = spec.stepTread;
      const rise = spec.stepRise;
      const step = part(
        new THREE.BoxGeometry(tread, rise, halfL * 1.85, 1, 1, segOf(halfL * 1.85)),
        stepMat,
        `navona-step-${side > 0 ? "R" : "L"}-${s}`,
        0.016
      );
      // 外侧更高：从槽缘向外爬升
      const x = side * (halfW + tread * (s + 0.5));
      const y = depth + rise * (s + 0.5);
      step.position.set(x, y, 0);
      step.userData.conform = "solid"; // 底边顺地形，踏面保持平整
      stepsGroup.add(step);
    }
    // 建筑界面矮墙
    const facade = part(
      new THREE.BoxGeometry(0.35, 1.1, halfL * 1.9, 1, 2, segOf(halfL * 1.9)),
      toonMat(STONE_MID, { flatShading: true }),
      `navona-facade-${side > 0 ? "R" : "L"}`,
      0.02
    );
    facade.position.set(
      side * (halfW + spec.stepTread * spec.stepCount + 0.4),
      depth + 0.55,
      0
    );
    facade.userData.conform = "solid";
    stepsGroup.add(facade);
  }
  group.add(stepsGroup);

  // 短端入口台阶（运河接入 / 城堡方向）
  for (const end of [-1, 1]) {
    for (let s = 0; s < 3; s++) {
      const step = part(
        new THREE.BoxGeometry(halfW * 1.5, 0.18, 0.5, segOf(halfW * 1.5), 1, 1),
        stepMat,
        `navona-end-step-${end > 0 ? "N" : "S"}-${s}`,
        0.014
      );
      step.position.set(0, depth + 0.18 * (s + 0.5), end * (halfL + 0.35 + s * 0.48));
      step.userData.conform = "solid"; // 相对台沿高度保持，整体顺地形曲率
      group.add(step);
    }
  }

  // ---- 4. 三大轴线喷泉（中轴泄洪/景观节点）----
  const fountains = new THREE.Group();
  fountains.name = "navona-plaza-fountains";
  const fountainNodes = [];
  for (let i = 0; i < spec.fountainCount; i++) {
    const t = (i + 1) / (spec.fountainCount + 1);
    const z = -halfL * 0.72 + t * halfL * 1.44;
    const isCenter = i === 1;
    const f = makeFountain(`navona-fountain-${i}`, isCenter ? 1.15 : 0.88, isCenter, random);
    // 座落在槽心略抬：旱季基座露出，汛期半浸
    f.position.set(0, depth * 0.08, z);
    f.userData.conform = "lift"; // 逐座随槽底曲率抬升，基座/碑体/水柱不脱节
    fountains.add(f);
    fountainNodes.push(f);
  }
  group.add(fountains);

  // ---- 5. 双栖状态 ----
  // floodAmount 0..1 平滑插值；targetFlood 目标
  let floodAmount = opts.flooded ? 1 : 0;
  let targetFlood = floodAmount;
  const FLOOD_SPEED = 0.35; // 满蓄约 3s

  function applyFloodVisuals(amount) {
    const a = THREE.MathUtils.clamp(amount, 0, 1);
    // 水面从槽底升起
    water.visible = a > 0.02;
    water.position.y = 0.06 + a * spec.floodDepth;
    water.material.opacity = 0.35 + a * 0.5;
    // 石材在深水时略压暗（仍可见池底铺装）
    if (basin.material?.color) {
      basin.material.color.setHex(STONE_DARK);
      basin.material.color.multiplyScalar(1 - a * 0.15);
    }
    // 喷泉水柱随水位缩短露出上半
    for (const f of fountainNodes) {
      f.traverse((o) => {
        if (o.userData?.isJet) {
          o.scale.y = 1 - a * 0.45;
          o.position.y = (0.55 + 0.45 * (1 - a * 0.3)) * (f.userData.isCenter ? 1.15 : 0.88);
        }
      });
    }
    group.userData.isFlooded = a > 0.5;
    group.userData.floodAmount = a;
  }

  function setFlooded(v) {
    if (typeof v === "number") targetFlood = THREE.MathUtils.clamp(v, 0, 1);
    else targetFlood = v ? 1 : 0;
  }

  function getFlooded() {
    return floodAmount;
  }

  function update(dt = 0, t = 0) {
    const d = Math.min(0.05, Math.max(0, dt));
    if (Math.abs(floodAmount - targetFlood) > 1e-4) {
      const dir = Math.sign(targetFlood - floodAmount);
      floodAmount = THREE.MathUtils.clamp(floodAmount + dir * FLOOD_SPEED * d, 0, 1);
      if (dir > 0 && floodAmount > targetFlood) floodAmount = targetFlood;
      if (dir < 0 && floodAmount < targetFlood) floodAmount = targetFlood;
      applyFloodVisuals(floodAmount);
    }
    // 喷雾轻抖
    const step = Math.floor(t * 8) / 8;
    for (const f of fountainNodes) {
      const spray = f.userData.spray;
      if (!spray) continue;
      for (const s of spray.children) {
        s.position.y =
          s.userData.baseY + Math.sin(step * 3.1 + s.userData.phase) * 0.06 * (1 - floodAmount * 0.5);
      }
    }
  }

  applyFloodVisuals(floodAmount);
  group.setFlooded = setFlooded;
  group.getFlooded = getFlooded;
  group.update = update;
  group.userData.update = update;
  group.userData.setFlooded = setFlooded;
  group.userData.getFlooded = getFlooded;
  group.userData.canalWaterLift = CANAL_WATER_LIFT;
  return group;
}

/**
 * 顶点融合（Boundary Blend + Curvature Conform）：广场整体带曲率贴合地面，
 * 消除「铁板插进土里」的生硬穿模与平面/球面脱节。
 *
 * 地形取高走高度函数回调（sampleDelta，等价于向下 Raycast 但确定性、
 * 零射线开销）：返回顶点沿世界“上”方向到地形面的带符号高差。
 *
 * 模式设计：
 *  - basin（槽体/水面网格）：全曲面贴合——内部顶点随地形曲率起伏
 *    （抬 clear 防 z-fight），边界环按到边缘距离 smoothstep 过渡到
 *    下埋 sink 遮住接缝；U 断面与波纹作为相对高差保留；
 *  - shell（嵌缝条等贴面薄片）：整面 delta + clear，无边界埋入；
 *  - solid（台阶/矮墙等实体盒体）：以台沿高度 refPlane 为基准采样
 *    地形高差，整个截面刚性平移——相对台沿的层叠高度保持，
 *    踏面顺地形曲率成为贴坡板，避免陡坡上底缘剪切翻转；
 *  - lift（喷泉等小组）：整组沿“上”方向刚性抬升到槽底地形处。
 *
 * 必须在摆放 + 定向之后调用（依赖世界矩阵）。
 * @param {THREE.Group} group 广场组
 * @param {{
 *   sampleDelta:(worldPos:THREE.Vector3)=>number,
 *   band?:number,  basin 边界融合带宽（局部单位）
 *   sink?:number,  边界额外下埋量（遮住接缝）
 *   clear?:number, 内部贴面抬升量（防与地形 z-fight）
 * }} opts
 */
export function conformPlazaToTerrain(group, opts = {}) {
  const { sampleDelta, band = 3.2, sink = 0.14, clear = 0.1 } = opts;
  if (!group || typeof sampleDelta !== "function") return;
  group.updateMatrixWorld(true);
  const world = new THREE.Vector3();
  const gl = new THREE.Vector3();
  const invGroup = new THREE.Matrix4();
  const smooth = (t) => t * t * (3 - 2 * t);
  // 台沿基准面：台阶/矮墙原始底缘都相对槽沿（y≈basinDepth）设计，
  // 在该高度采样地形高差即可保持层叠关系整体顺坡
  const refPlane = group.userData?.spec?.basinDepth ?? 0.85;
  // lift 组（喷泉）：整组抬到本处槽底地形，基座/碑体/水柱一起走
  group.traverse((node) => {
    if (node.userData?.conform !== "lift" || !node.isGroup) return;
    node.getWorldPosition(world);
    const delta = sampleDelta(world);
    if (!Number.isFinite(delta)) return;
    // 广场局部 +Y 即世界“上”（siteUpright），无中间旋转时直接改 y
    node.position.y += delta;
    node.userData.conform = null; // 只抬一次
  });
  group.updateMatrixWorld(true);
  invGroup.copy(group.matrixWorld).invert();
  const upW = new THREE.Vector3(0, 1, 0).applyQuaternion(
    group.getWorldQuaternion(new THREE.Quaternion())
  );
  const localUp = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  group.traverse((mesh) => {
    const mode = mesh.userData?.conform;
    if (!mode || !mesh.isMesh) return;
    const geo = mesh.geometry;
    const pos = geo?.attributes?.position;
    if (!pos || pos.count === 0) return;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const refY = mode === "solid" ? refPlane : 0; // 实体走台沿面，槽体/薄片走槽底面
    // 世界上方向在网格局部系的分量：带旋转的子网格（嵌缝条 -PI/2）
    // 沿该方向位移才是真正的抬升，而非拉伸几何轴
    mesh.getWorldQuaternion(tmpQ);
    localUp.copy(upW).applyQuaternion(tmpQ.invert());
    let changed = false;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      // 基准面采样：取顶点在广场组坐标系里的水平位置，把采样点放到
      // 组内 refY 高度——不受子网格自身位移/旋转（如嵌缝条 -PI/2）干扰
      world.set(x, y, z);
      mesh.localToWorld(world).applyMatrix4(invGroup);
      gl.copy(world);
      world.set(gl.x, refY, gl.z);
      group.localToWorld(world);
      const dRef = sampleDelta(world);
      if (!Number.isFinite(dRef)) continue;
      let amt;
      if (mode === "basin") {
        // U 断面/波纹作为相对高差保留，整面顺地形曲率；
        // 边界环 wEdge=1 埋到地形下 sink 遮接缝
        const dEdge = Math.min(bb.max.x - Math.abs(x), bb.max.z - Math.abs(z));
        const wEdge = 1 - smooth(THREE.MathUtils.clamp(dEdge / band, 0, 1));
        amt = dRef + THREE.MathUtils.lerp(clear, -(refPlane + sink), wEdge);
      } else if (mode === "shell") {
        // 薄片相对槽底的高差（0.04）保留，防与石面 z-fight
        amt = dRef + clear;
      } else {
        // 整个截面刚性平移：底缘埋 sink，相对台沿的层叠高度不变
        amt = dRef - sink;
      }
      pos.setXYZ(i, x + localUp.x * amt, y + localUp.y * amt, z + localUp.z * amt);
      changed = true;
    }
    if (changed) {
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
  });
}
