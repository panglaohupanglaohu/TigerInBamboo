// =====================================================================
//  莫比斯复古科幻飞船（Mœbius 法式复古科幻 · 半透明琥珀玻璃飞艇）
//  - 风格：70-80 年代复古科幻手绘风；拉长玻璃灯泡 / 有机飞艇造型
//  - 核心技术：外层半透明玻璃外壳(MeshPhysicalMaterial, transmission) + 内层发光机械结构
//  - 机身长轴沿 +Z（机头朝 +Z），局部中心在原点附近（与编队/航线逻辑约定一致）
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";
import { P, P_DEFAULTS } from "../core/params.js";

/* ---------------- 3 阶硬边缘 Toon 渐变贴图（纯代码生成） ----------------
 * 三阶灰度阶梯 [0, 127, 255]：暗部 / 中间调 / 亮部，
 * Nearest 采样锁死边缘，产生干净的二次元色块切面，无模糊渐变。
 * RedFormat 兼容当前 Three.js（LuminanceFormat 已废弃）。
 */
const _gradient3 = (() => {
  const data = new Uint8Array([0, 127, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

/**
 * 卡通水晶材质（MeshToonMaterial · 3 阶渐变 + flatShading）。
 * 废除物理玻璃 transmission，改用基础 opacity 半透明 —— 不触发 SwiftShader
 * 屏幕空间回读，无头测试 100% 友好。
 * @param {number} color  色块
 * @param {object} [opts]  transparent / opacity / side / emissive / vertexColors
 */
function crystalToon(color, opts = {}) {
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: _gradient3,
    transparent: opts.transparent ?? true,
    opacity: opts.opacity ?? 0.85,
    side: opts.side ?? THREE.FrontSide,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    vertexColors: opts.vertexColors ?? false,
  });
  // flatShading 必须构造后赋值：MeshToonMaterial 未声明该字段，
  // 写在构造参数里会被 setValues() 告警并丢弃（分面硬边直接失效）。
  // WebGLPrograms 仍会读取 material.flatShading，与 toon.js 的 toonMat 同做法。
  material.flatShading = true;
  material.needsUpdate = true;
  return material;
}

/** 通用描边件工厂：facet 扁平分面 + castShadow + addOutline 墨线描边 */
function part(geo, mat, outline = 0.04) {
  const m = new THREE.Mesh(facet(geo), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  addOutline(m, outline);
  return m;
}

/**
 * 外壳剖面半径函数：前端尖细 -> 中段膨胀 -> 尾部收窄（钟形流线）。
 * u: 0(尾) .. 1(头)
 */
function hullRadiusAt(u, MIDR = 1.35) {
  return Math.sin(Math.PI * (u * 0.92 + 0.04)) * MIDR * (0.55 + 0.45 * Math.sin(Math.PI * u));
}

const LEN = 7.0; // 外壳总长（沿 Z 轴分布）

/** 羽箭攒射：每 50 支苔庭鲸下沉一档，共 6 档 / 300 支落地。飞艇本身不掉高度。 */
export const ARROW_SINK_STEP = 50;
export const ARROW_SINK_STEPS = 6;
export const ARROW_SINK_TOTAL = ARROW_SINK_STEP * ARROW_SINK_STEPS;

/**
 * 创建飞行器：所有部件加入一个 Group 并返回。
 * 机身长轴沿 +Z（机头朝 +Z），局部中心在原点附近。
 */
export function createMoebiusAircraft() {
  const g = new THREE.Group();
  g.name = "moebius-aircraft";

  // ---------- 1. 外层玻璃灯罩外壳 (LatheGeometry · 12 棱低多边形 · 复古琥珀) ----------
  // 真玻璃：MeshPhysicalMaterial 透射（内舱霓虹/舱核/尾焰透过玻璃可见）。
  // P.aircraftGlass=false 时回退旧式 Toon 半透明（无头 SwiftShader 渲染更稳）。
  // LatheGeometry 段数 48→12：配合 flatShading 产生干净的多面体硬朗棱角。
  const seg = 30;
  const profile = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;            // 0(尾) .. 1(头)
    const z = (u - 0.5) * LEN;    // -3.5(尾) .. 3.5(头)
    profile.push(new THREE.Vector2(Math.max(hullRadiusAt(u), 0.02), z));
  }
  const hullGeo = new THREE.LatheGeometry(profile, 12);
  hullGeo.rotateX(Math.PI / 2); // 旋转轴 Y -> Z，机头朝 +Z

  const glassHull = P.aircraftGlass !== false;
  const hullMat = glassHull
    ? new THREE.MeshPhysicalMaterial({
        color: 0xd35400, // 琥珀玻璃
        transparent: true,
        opacity: 0.5,
        transmission: 0.92, // 透射：透过外壳看到内部霓虹结构
        thickness: 1.4,
        roughness: 0.1,
        metalness: 0.05,
        ior: 1.45,
        clearcoat: 0.7,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.1,
        side: THREE.DoubleSide,
        depthWrite: false,
        emissive: 0xd35400,
        emissiveIntensity: 0.08,
      })
    : crystalToon(0xD35400, {
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        emissive: 0xD35400,
        emissiveIntensity: 0.12,
      });
  hullMat.flatShading = true;
  hullMat.needsUpdate = true;
  const hull = part(hullGeo, hullMat, 0.04);
  hull.name = "aircraft-hull";
  g.add(hull);

  // ---------- 2. 机身结构环 (黑色细圆环，沿外壳穿插) ----------
  const ringMat = crystalToon(0x141414, { transparent: false });
  const ringZs = [-2.4, -0.6, 1.2, 2.6];
  for (const rz of ringZs) {
    const u = rz / LEN + 0.5;
    const r = Math.max(hullRadiusAt(u), 0.12) + 0.05;
    const ring = part(new THREE.TorusGeometry(r, 0.06, 8, 16), ringMat, 0.04);
    ring.rotation.y = Math.PI / 2; // 环面法线朝 Z
    ring.position.z = rz;
    g.add(ring);
  }

  // ---------- 3. 内部光源分区（Toon 材质 · 舱核/霓虹/尾焰色相分离）----------
  // 3a. 前段：暖青柠舱核（与中段霓虹、尾焰橙红区分）
  const coreMat = crystalToon(0xd4ff9a, {
    transparent: false,
    emissive: 0xa8ff4a,
    emissiveIntensity: 1.6,
  });
  const core = part(new THREE.SphereGeometry(0.55, 12, 8), coreMat, 0.04);
  core.scale.set(1.0, 1.0, 1.15);
  core.position.z = 1.55;
  g.add(core);
  const cockpitCabinLight = new THREE.PointLight(0xb8ff66, 2.4, 8, 1.8);
  cockpitCabinLight.name = "aircraft-cockpit-light";
  cockpitCabinLight.position.set(0, 0.15, 1.55);
  g.add(cockpitCabinLight);

  // 3b. 中段：霓虹能量线（品红→青蓝）
  const tubePts = [];
  const tubeLen = 4.0;
  for (let i = 0; i <= 48; i++) {
    const tt = i / 48;
    const z = 1.15 - tt * tubeLen;
    const ang = tt * Math.PI * 5.5;
    const rad = 0.2 * (1 - tt * 0.5);
    tubePts.push(new THREE.Vector3(Math.sin(ang) * rad, Math.cos(ang) * rad, z));
  }
  const tubeCurve = new THREE.CatmullRomCurve3(tubePts);
  const tubeMat = crystalToon(0xffd24a, {
    transparent: false,
    vertexColors: true,
    emissive: 0x22eeff,
    emissiveIntensity: 1.2,
  });
  const tubeGeo = new THREE.TubeGeometry(tubeCurve, 72, 0.14, 8, false);
  {
    const pos = tubeGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cA = new THREE.Color(0xff2bd6); // 霓虹品红
    const cB = new THREE.Color(0x00f0ff); // 霓虹青
    for (let i = 0; i < pos.count; i++) {
      const tt = i / Math.max(1, pos.count - 1);
      const c = cA.clone().lerp(cB, tt);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    tubeGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  const energyTube = part(tubeGeo, tubeMat, 0.04);
  energyTube.name = "aircraft-neon-energy-line";
  g.add(energyTube);

  // 中段霓虹点光（冷色）
  const neonLight = new THREE.PointLight(0x00e8ff, 1.8, 7, 2);
  neonLight.name = "aircraft-neon-light";
  neonLight.position.set(0, 0, -0.4);
  g.add(neonLight);

  // 3c. 尾部喷口：灰黑机械喷罩 + 橙红尾焰光
  const nozzleMat = crystalToon(0x2a2a2e, { transparent: false });
  const nozzle = part(new THREE.CylinderGeometry(0.55, 0.32, 0.9, 12, 1, true), nozzleMat, 0.04);
  nozzle.rotation.x = Math.PI / 2; // 轴朝 Z
  nozzle.position.z = -3.2;
  g.add(nozzle);
  const nozzleRing = part(new THREE.TorusGeometry(0.55, 0.07, 8, 16), nozzleMat, 0.04);
  nozzleRing.rotation.y = Math.PI / 2;
  nozzleRing.position.z = -2.75;
  g.add(nozzleRing);
  const thrusterLight = new THREE.PointLight(0xff4a18, 2.6, 6, 2);
  thrusterLight.name = "aircraft-thruster-light";
  thrusterLight.position.set(0, 0, -3.5);
  g.add(thrusterLight);

  // ---------- 4. 头部鼻锥 (灰白锥 + 黑色圈纹 + 金属探针) ----------
  const noseMat = crystalToon(0xd9d4c8, { transparent: false });
  const nose = part(new THREE.ConeGeometry(0.42, 1.6, 12), noseMat, 0.04);
  nose.rotation.x = Math.PI / 2; // 尖朝 +Z
  nose.position.z = 3.9;
  g.add(nose);
  const noseBandMat = crystalToon(0x1a1a1a, { transparent: false });
  for (const bz of [3.5, 3.9, 4.3]) {
    const band = part(new THREE.TorusGeometry(0.40, 0.035, 6, 12), noseBandMat, 0.04);
    band.rotation.y = Math.PI / 2;
    band.position.z = bz;
    g.add(band);
  }
  const probe = part(
    new THREE.CylinderGeometry(0.02, 0.05, 0.7, 6),
    crystalToon(0xbfc4cc, { transparent: false }),
    0.04
  );
  probe.rotation.x = Math.PI / 2;
  probe.position.z = 5.2;
  g.add(probe);

  // ---------- 5. 尾翼 (4 片鱼鳍，浅灰 + 棕色条纹拼色) ----------
  const finGray = crystalToon(0xcabfa8, { transparent: false, side: THREE.DoubleSide });
  const finBrown = crystalToon(0x7a5a3a, { transparent: false, side: THREE.DoubleSide });
  const finCount = 4;
  for (let i = 0; i < finCount; i++) {
    const a = (i / finCount) * Math.PI * 2;
    const fin = new THREE.Group();
    const base = part(new THREE.BoxGeometry(1.0, 1.6, 0.08), finGray, 0.04);
    base.position.y = 0.8; // 沿 +Y 伸出
    fin.add(base);
    const stripe = part(new THREE.BoxGeometry(0.72, 0.7, 0.1), finBrown, 0.04);
    stripe.position.y = 0.5;
    fin.add(stripe);
    fin.position.z = -2.6;   // 尾部
    fin.rotation.z = a;      // 绕机身 Z 轴均布（XY 横截面径向分布）
    g.add(fin);
  }

  // ---------- 6. 驾驶舱锚点 + 暖青柠舱内灯（与霓虹/尾焰色相分离）----------
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(0, 0.5, 1.6);
  cockpitAnchor.name = "cockpit-anchor";
  g.add(cockpitAnchor);

  // 可见的青柠驾驶室核心：实心高亮内核 + 加色混合外辉光晕（MeshBasic 不受光）
  const cockpitCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xe8ffb8,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
  );
  cockpitCore.name = "cockpit-lime-core";
  cockpitCore.position.set(0, 0, 0.3);
  cockpitCore.renderOrder = 11;
  cockpitAnchor.add(cockpitCore);

  const cockpitGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xb4ff6a,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  cockpitGlow.name = "cockpit-lime-glow";
  cockpitGlow.position.copy(cockpitCore.position);
  cockpitGlow.renderOrder = 10;
  cockpitAnchor.add(cockpitGlow);

  const cockpitLight = new THREE.PointLight(0xc8ff70, 3.8, 22, 1.6);
  cockpitLight.name = "aircraft-cockpit-fill";
  cockpitLight.position.set(0, 0.55, 1.9);
  g.add(cockpitLight);

  // ---------- 7. 尾焰：橙红喷焰（MeshBasic · 供 updateAircraftHover 脉动）----------
  const flames = [];
  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: 0xff3b12,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: 0xff8a2a,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (const sx of [-1, 0, 1]) {
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.55, 7), flameOuterMat.clone());
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(sx * 0.28, 0, -3.75);
    g.add(outer);
    flames.push(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.05, 6), flameCoreMat.clone());
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(sx * 0.28, 0, -3.55);
    g.add(inner);
    flames.push(inner);
  }

  // ---------- 8. 地面扫描激光（机腹向下打到球面地表，飞行时扫掠）----------
  // 圆柱默认轴 = 局部 +Y；update 里用射线∩球面求落点
  const scanBeamMat = new THREE.MeshBasicMaterial({
    color: 0x39ff9a,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const scanBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.18, 1, 10, 1, true),
    scanBeamMat
  );
  scanBeam.name = "aircraft-scan-laser";
  scanBeam.visible = false;
  scanBeam.renderOrder = 8;
  scanBeam.userData.emitterLocal = new THREE.Vector3(0, -0.85, 0.35);
  g.add(scanBeam);

  const scanSpotMat = new THREE.MeshBasicMaterial({
    color: 0x66ffaa,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const scanSpot = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), scanSpotMat);
  scanSpot.name = "aircraft-scan-spot";
  scanSpot.visible = false;
  scanSpot.renderOrder = 5;
  g.add(scanSpot);

  const scanRing = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 1.75, 28),
    new THREE.MeshBasicMaterial({
      color: 0x9effcc,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  scanRing.name = "aircraft-scan-ring";
  scanRing.visible = false;
  scanRing.renderOrder = 6;
  g.add(scanRing);

  // part() 已设 castShadow + 描边；驾驶舱核/光晕/喷焰/激光为特效不投影
  g.userData.kind = "moebius-aircraft";
  g.userData.thrusters = [core];
  g.userData.flames = flames;
  g.userData.cockpitAnchor = cockpitAnchor;
  g.userData.cockpitLight = cockpitLight;
  g.userData.cockpitGlow = cockpitGlow;
  g.userData.cockpitCore = cockpitCore;
  g.userData.neonLight = neonLight;
  g.userData.thrusterLight = thrusterLight;
  g.userData.energyTube = energyTube;
  g.userData.scanBeam = scanBeam;
  g.userData.scanSpot = scanSpot;
  g.userData.scanRing = scanRing;
  g.userData.scanPhase = Math.random() * Math.PI * 2;
  return g;
}

/**
 * 把飞行器锚到某方向上空（沿法线抬升 height）。
 * @param {THREE.Object3D} aircraft 飞行器 Group
 * @param {THREE.Vector3} dir 单位方向（球面法线）
 * @param {number} R 星球半径
 * @param {number} [height] 离地表高度
 */
export function placeAircraftAbove(aircraft, dir, R, height = 20) {
  const d = dir.clone().normalize();
  aircraft.position.copy(d).multiplyScalar(R + height);
  orientAircraftToDir(aircraft, d);
  return aircraft;
}

/**
 * 让无航线编队跟随地图编辑器最终留下的建筑位置。
 * 编队成员保存的是世界坐标，因此只平移本次锚点变化量，不破坏人字阵布局。
 * @param {THREE.Group} squad aircraft 编队
 * @param {THREE.Object3D} anchor 地图锚点（这里是书店）
 * @param {number} R 星球半径
 * @param {number} height 离地表高度
 */
export function syncAircraftSquadToAnchor(squad, anchor, R, height = 20) {
  if (!squad || !anchor) return;
  if (!anchor.parent) {
    squad.visible = false;
    return;
  }

  const dir = anchor.position.clone();
  if (dir.lengthSq() < 1e-8) return;
  dir.normalize();
  const center = dir.multiplyScalar(R + height);
  const previousCenter = squad.userData.anchorCenter;

  if (previousCenter) {
    const delta = center.clone().sub(previousCenter);
    if (delta.lengthSq() > 1e-10) {
      for (const member of squad.userData.members || []) member.position.add(delta);
    }
    previousCenter.copy(center);
  } else {
    squad.userData.anchorCenter = center.clone();
  }

  if (squad.userData.centerDir) squad.userData.centerDir.copy(dir);
  squad.visible = true;
}

/**
 * 创建编队（squadron）：以母晶塔方向为中心，在切平面内环形 + 高度错列排布多架。
 * 返回 THREE.Group（squadron），自身绕母晶塔法线缓慢自旋 = 编队巡航。
 * 若 opts.patrol 提供 {dirA,dirB}，则编队改为沿球面在两站之间往返巡航
 * （途经赤道云墙），由 updateAircraftHover() 驱动。
 * @param {THREE.Vector3} centerDir 母晶塔方向（单位向量）
 * @param {number} R 星球半径
 * @param {object} [opts]
 * @param {number} [opts.count=5]
 * @param {number} [opts.height=20]  编队中心离地表高度（默认与航空艇 hover=20 同高）
 * @param {number} [opts.radius=10]  环形半径（切平面内）
 * @param {number} [opts.spin=0.06]  编队绕法线自旋角速度（无航线时生效）
 * @param {object} [opts.patrol]     航线 { dirA:Vector3, dirB:Vector3 }
 * @param {number} [opts.speed=0.12] 往返巡航速度（0~1 相位/秒）
 */
export function createMoebiusAircraftSquad(centerDir, R, opts = {}) {
  const {
    count = 5,
    height = 20,
    radius = 18,
    spin = 0.03,
    patrol = null,
    speed = 0.12,
    formation = "ring",
    whaleFlight = true,
  } = opts;
  const d = centerDir.clone().normalize();

  const squad = new THREE.Group();
  squad.name = "moebius-aircraft-squad";

  // 切平面基（与 placeAircraftAbove 同约定）
  const up = d.clone();
  const tangent = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), up);
  if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
  tangent.normalize();
  const side = new THREE.Vector3().crossVectors(up, tangent).normalize();

  // 编队中心（球面上方 height 处）
  const center = d.clone().multiplyScalar(R + height);

  const members = [];
  squad.userData.anchorCenter = center.clone();
  squad.userData._patrolCenter = center.clone();
  /** 相对编队中心的阵位（切平面：fwd/side/up 系数），每帧按当前朝向重建 */
  const slots = [];

  for (let i = 0; i < count; i++) {
    const ac = createMoebiusAircraft();
    let slot = { fwd: 0, side: 0, up: 0 };
    let heading = 0;

    if (formation === "v") {
      // 鲸群人字：领头在前，两翼后撤并拉开，略分层高度压迫感
      if (i === 0) {
        slot = { fwd: radius * 0.75, side: 0, up: 0.6 };
        heading = 0;
      } else {
        const wingIdx = Math.ceil(i / 2);
        const isLeft = i % 2 === 1;
        const wingSign = isLeft ? 1 : -1;
        slot = {
          fwd: radius * 0.75 - wingIdx * radius * 0.95,
          side: wingSign * wingIdx * radius * 0.85,
          up: -wingIdx * 1.4 + (isLeft ? 0.8 : -0.5), // 上下错层，像鲸群不同泳层
        };
        heading = wingSign * 0.22; // 外侧微张，不急转
      }
    } else {
      const a = (i / count) * Math.PI * 2;
      const ringR = radius * (0.55 + 0.45 * ((i % 3) / 2));
      slot = {
        fwd: Math.cos(a) * ringR,
        side: Math.sin(a) * ringR,
        up: (i % 2 === 0 ? 1 : -1) * 2.8,
      };
      heading = -a;
    }

    slots.push(slot);
    ac.userData.formationSlot = slot;
    ac.userData.formationIndex = i;
    ac.userData.formationHeading = heading;
    ac.userData.whalePhase = i * 0.85; // 个体起伏相位差

    const off = tangent
      .clone()
      .multiplyScalar(slot.fwd)
      .add(side.clone().multiplyScalar(slot.side))
      .add(up.clone().multiplyScalar(slot.up));
    ac.position.copy(center).add(off);
    orientAircraftToDir(ac, up);
    ac.rotateY(heading);
    squad.add(ac);
    members.push(ac);
  }

  squad.userData.kind = "moebius-aircraft-squad";
  squad.userData.centerDir = d.clone();
  squad.userData.spin = spin;
  squad.userData.members = members;
  squad.userData.formationSlots = slots;
  squad.userData.whaleFlight = whaleFlight !== false;
  squad.userData.thrusters = members.flatMap((m) => m.userData.thrusters || []);
  squad.userData.flames = members.flatMap((m) => m.userData.flames || []);
  squad.userData.cockpitCores = members.map((m) => m.userData.cockpitCore).filter(Boolean);
  squad.userData.cockpitGlows = members.map((m) => m.userData.cockpitGlow).filter(Boolean);
  squad.userData.cockpitLights = members.map((m) => m.userData.cockpitLight).filter(Boolean);
  squad.userData.neonLights = members.map((m) => m.userData.neonLight).filter(Boolean);
  squad.userData.thrusterLights = members.map((m) => m.userData.thrusterLight).filter(Boolean);
  if (patrol) {
    const dA = patrol.dirA.clone().normalize();
    const dB = patrol.dirB.clone().normalize();
    squad.userData.patrol = {
      dirA: dA,
      dirB: dB,
      R,
      height,
      arcLen: dA.angleTo(dB) * R,
      speed,
      maxSpeed:
        Number.isFinite(patrol.maxSpeed) && patrol.maxSpeed > 0
          ? patrol.maxSpeed
          : Infinity,
    };
  }
  return squad;
}

/** smoothstep 缓入缓出：鲸群进出站不急冲 */
function smooth01(u) {
  const x = THREE.MathUtils.clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
}

// 蜂鸟吸蜜：临时向量（避免每帧分配）
const _acTmpA = new THREE.Vector3();
const _acTmpB = new THREE.Vector3();
const _acTmpC = new THREE.Vector3();
const _acTmpD = new THREE.Vector3();
const _acTmpE = new THREE.Vector3();
const _acRedFlash = new THREE.Color(0xff4030);
const _acBaseCore = new THREE.Color(0xa8ff4a);
const _acSlotPos = new THREE.Vector3();
const _acFeedPos = new THREE.Vector3();
const _acFeedUp = new THREE.Vector3();
const _acFeedTan = new THREE.Vector3();

/**
 * 悬停 / 巡航 / 扫描寻沼 / 蜂鸟吸蜜（在场景 update 中调用）
 *
 * 生活节律：
 *  1. 水晶城 ↔ 书店镇 反复游走（基础航线）
 *  2. 沿途扫描航迹近区，有概率发现湖沼
 *  3. 发现后个体脱离阵型，像巨大蜂鸟吸食水面落花
 *  4. 吸食完毕归队 → 再次在两城之间往返游走（一段「归航义务」内不再下潜）
 *  5. 义务结束后重新扫描，循环往复
 *
 * @param {THREE.Group} aircraft 编队
 * @param {number} t 场景时间
 * @param {number} [dt]
 * @param {{ swamp?: THREE.Object3D }} [opts] swamp：地图放置的湖沼（含 nectarTargets）
 */
export function updateAircraftHover(aircraft, t, dt = 0.016, opts = {}) {
  if (!aircraft) return;

  const members =
    aircraft.userData.members ||
    (aircraft.userData.kind === "moebius-aircraft" ? [aircraft] : []);
  let patrolMoving = false;
  let formationCenter = null;
  let formationUp = null;
  let formationTan = null;
  let formationSide = null;
  let formationBank = 0;
  let formationPitch = 0;

  // ---------- 苔庭鲸对抗期：俯冲吸食 / 悬停盘顶（鲸起→战斗→拉回全程跟随） ----------
  // 苔庭鲸场景（saihojiGarden）每帧把 whaleLock 写入 squad.userData：
  //  { active, hubDir, hoverRadius } — hoverRadius = 盘面世界半径 + 7（贴背悬停）。
  // 锁定时冻结航线相位，编队中心平滑过渡到盘顶上方盘旋，随鲸升降；解锁后平滑回到航线。
  const wl = aircraft.userData.whaleLock;
  if (wl?.active && wl.hubDir && Number.isFinite(wl.hoverRadius)) {
    const hubD = wl.hubDir;
    const east = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), hubD)
      .normalize();
    const north = new THREE.Vector3().crossVectors(hubD, east).normalize();
    // 盘旋方位角：缓慢绕盘顶扫掠（0.075 rad 半径的倾斜小圆 → 角距 ~12 单位）
    const az0 = Number.isFinite(wl.az0) ? wl.az0 : 0;
    const az = az0 + t * 0.22;
    const tilt = 0.075;
    const dir = hubD
      .clone()
      .multiplyScalar(Math.cos(tilt))
      .addScaledVector(east, Math.cos(az) * Math.sin(tilt))
      .addScaledVector(north, Math.sin(az) * Math.sin(tilt))
      .normalize();
    const hoverCenter = dir
      .clone()
      .multiplyScalar(wl.hoverRadius + Math.sin(t * 1.3) * 1.2);
    // 盘侧悬停偏置（苔庭鲸写入：悬停盘顶北翼，长弓列阵正上方）
    if (wl.offset) hoverCenter.add(wl.offset);
    // 吃力晃动：鲸越被拽低（strain 越大），机队悬停越挣扎
    const strain = Number.isFinite(wl.strain) ? wl.strain : 0;
    if (strain > 0.02) {
      hoverCenter.addScaledVector(dir, Math.sin(t * 7.3) * 1.9 * strain);
      hoverCenter.addScaledVector(
        east,
        Math.cos(t * 5.1) * 1.1 * strain
      );
    }
    // 盘旋切向（绕 hubD 的角速度方向）
    const tanAz = east
      .clone()
      .multiplyScalar(-Math.sin(az))
      .addScaledVector(north, Math.cos(az));
    const orbitTan = tanAz
      .addScaledVector(hubD, -tanAz.dot(hubD))
      .normalize();

    // 冻结的航线位置（st.phase 不再推进，用最近一次相位复算）→ 平滑过渡锚点
    let holdCenter = null;
    let holdUp = null;
    let holdTan = null;
    let holdSide = null;
    const p = aircraft.userData.patrol;
    const st = aircraft.userData._patrol;
    if (p && st && !wl.blendStart) {
      const dA = p.dirA;
      const dB = p.dirB;
      const hdir = dA.clone().lerp(dB, st.phase).normalize();
      holdCenter = hdir
        .clone()
        .multiplyScalar(p.R + p.height + Math.sin(t * 0.28) * 1.35);
      holdUp = hdir;
      const tan = dB
        .clone()
        .addScaledVector(dA, -dB.dot(dA))
        .normalize();
      holdTan = tan;
      holdSide = new THREE.Vector3().crossVectors(holdUp, tan).normalize();
    }
    // 首次锁定记录过渡起点
    if (!wl.blendStart && holdCenter) {
      wl.blendStart = holdCenter.clone();
      wl.blendUp = holdUp.clone();
      wl.blendTan = holdTan.clone();
    }
    const from = wl.blendStart || hoverCenter.clone();
    const upFrom = wl.blendUp || hubD;
    const tanFrom = wl.blendTan || orbitTan;
    wl.blend = Math.min(1, (wl.blend ?? 0) + dt / 3.2);
    const e = wl.blend * wl.blend * (3 - 2 * wl.blend);
    formationCenter = from.clone().lerp(hoverCenter, e);
    formationUp = upFrom.clone().lerp(hubD, e).normalize();
    formationTan = tanFrom.clone().lerp(orbitTan, e).normalize();
    formationSide = new THREE.Vector3()
      .crossVectors(formationUp, formationTan)
      .normalize();
    formationTan.crossVectors(formationSide, formationUp).normalize();
    formationBank = -Math.sin(az) * 0.3 - (1 - wl.blend) * 0.12;
    formationPitch = 0.05 + Math.sin(t * 0.9) * 0.03;
    patrolMoving = true;
    wl._lastHoverCenter = hoverCenter.clone();
    aircraft.userData._patrolCenter = formationCenter.clone();
  } else if (aircraft.userData.patrol) {
    const p = aircraft.userData.patrol;
    // 状态机：0 城→店 1 店停留 2 店→城 3 城停留
    if (!aircraft.userData._patrol) aircraft.userData._patrol = { seg: 0, u: 0, phase: 0 };
    const st = aircraft.userData._patrol;
    const configuredSpeed = Number.isFinite(P.aircraftSpeed) ? P.aircraftSpeed : 1.65;
    // 鲸群：实际速度再压一档，更沉重
    const whaleMul = aircraft.userData.whaleFlight !== false ? 0.72 : 1;
    const speed = Math.min(Math.max(configuredSpeed * whaleMul, 0.01), p.maxSpeed);
    const legTime = p.arcLen > 1e-3 ? p.arcLen / Math.max(speed, 0.01) : 1;
    const hold = Number.isFinite(P.aircraftHoldSec) ? P.aircraftHoldSec : 36;

    st.u += dt / (st.seg === 1 || st.seg === 3 ? Math.max(hold, 0.001) : legTime);
    if (st.u >= 1) {
      st.u = 0;
      st.seg = (st.seg + 1) % 4;
    }
    const uEase = st.seg === 0 || st.seg === 2 ? smooth01(st.u) : st.u;
    st.phase =
      st.seg === 0 ? uEase : st.seg === 1 ? 1 : st.seg === 2 ? 1 - uEase : 0;
    const phase = st.phase;
    const moving = st.seg === 0 || st.seg === 2;
    patrolMoving = moving;

    const dirA = p.dirA.clone().normalize();
    const dirB = p.dirB.clone().normalize();
    const dir = dirA.clone().lerp(dirB, phase).normalize();

    const pathHeave = Math.sin(phase * Math.PI) * 4.2;
    const breath = Math.sin(t * 0.28) * 1.35;
    const flyH = p.height + pathHeave + breath;
    let center = dir.clone().multiplyScalar(p.R + flyH);
    // 解锁过渡：从盘顶悬停位平滑回到航线（blend 1 → 0，2.5s）
    const wlOut = aircraft.userData.whaleLock;
    if (wlOut && !wlOut.active && wlOut._lastHoverCenter && (wlOut.blend ?? 0) > 0.002) {
      wlOut.blend = Math.max(0, (wlOut.blend ?? 0) - dt / 2.5);
      const e2 = wlOut.blend * wlOut.blend * (3 - 2 * wlOut.blend);
      center = center.clone().lerp(wlOut._lastHoverCenter, e2);
    }

    const phaseStep = moving ? 0.012 : 0;
    const dirNext = dirA
      .clone()
      .lerp(dirB, THREE.MathUtils.clamp(phase + (st.seg === 2 ? -phaseStep : phaseStep), 0, 1))
      .normalize();
    let tangent = moving
      ? dirNext.clone().sub(dir)
      : aircraft.userData._prevTangent?.clone() ||
        new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir);
    if (tangent.lengthSq() < 1e-8) {
      tangent = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    tangent.normalize();
    if (!moving && aircraft.userData._prevTangent) {
      tangent.copy(aircraft.userData._prevTangent);
    }

    let up = dir.clone();
    // 解锁过渡：编队朝向量也从盘顶悬停位渐变回航线法向
    if (wlOut && !wlOut.active && wlOut._lastHoverCenter && (wlOut.blend ?? 0) > 0.002) {
      up = up.clone().lerp(wlOut.hubDir, wlOut.blend).normalize();
    }
    const side = new THREE.Vector3().crossVectors(up, tangent).normalize();
    tangent.crossVectors(side, up).normalize();

    let bank = 0;
    const prevTan = aircraft.userData._prevTangent;
    if (prevTan && moving) {
      const turn = tangent.clone().sub(prevTan).length();
      const rawBank = THREE.MathUtils.clamp(turn * 38, -0.72, 0.72);
      bank = rawBank * (st.seg === 2 ? -1 : 1);
    }
    const prevBank = aircraft.userData._smoothBank || 0;
    bank = THREE.MathUtils.lerp(prevBank, bank, 0.06);
    aircraft.userData._smoothBank = bank;
    aircraft.userData._prevTangent = tangent.clone();

    const pitch =
      Math.sin(phase * Math.PI) * 0.12 +
      (moving ? Math.sin(t * 0.35) * 0.04 : Math.sin(t * 0.25) * 0.02);

    formationCenter = center;
    formationUp = up;
    formationTan = tangent;
    formationSide = side;
    formationBank = bank;
    formationPitch = pitch;
    aircraft.userData._patrolCenter = center.clone();
  } else if (aircraft.userData.centerDir) {
    const d = aircraft.userData.centerDir;
    const spinQ = new THREE.Quaternion().setFromAxisAngle(d, aircraft.userData.spin * 0.016);
    aircraft.quaternion.premultiply(spinQ);
  }

  // -------- 扫描航迹走廊 + 概率发现湖沼 → 蜂鸟吸蜜 → 归队两城往返 --------
  const nectarList = resolveNectarTargets(opts.swamp);
  const scan = updateSwampScan(aircraft, opts.swamp, formationCenter, nectarList, dt, t);

  // 吸蜜后的归航义务：在水晶城↔书店镇编队游走一段时间，禁止再次下潜
  if (!aircraft.userData._forageDuty) {
    aircraft.userData._forageDuty = { postFeedPatrol: 0, feeds: 0 };
  }
  const duty = aircraft.userData._forageDuty;
  if (duty.postFeedPatrol > 0) duty.postFeedPatrol -= dt;

  // 归航期内：清掉湖沼锁定，专心走航线（仍可地面扫掠，但不接蜜）
  const onPostFeedPatrol = duty.postFeedPatrol > 0;
  if (onPostFeedPatrol && scan.found) {
    scan.found = false;
    scan.memory = 0;
    scan.heat = Math.min(scan.heat, 0.25);
  }

  updateHummingbirdForage(members, nectarList, {
    t,
    dt,
    aircraft,
    formationCenter,
    formationUp,
    formationTan,
    formationSide,
    formationBank,
    formationPitch,
    R: aircraft.userData.patrol?.R,
    // 仅在已发现且不在归航义务内时允许新吸蜜
    swampFound: !!scan.found && !onPostFeedPatrol,
    scan,
    onSuccessfulFeed: () => {
      duty.feeds = (duty.feeds || 0) + 1;
      // 约一趟半城际行程：让玩家清楚看到编队在两城间往返
      const hold = Number.isFinite(P.aircraftHoldSec) ? P.aircraftHoldSec : 36;
      const patrolBoost = 48 + hold * 0.45 + Math.random() * 22;
      duty.postFeedPatrol = Math.max(duty.postFeedPatrol, patrolBoost);
      // 吸完即忘：下次要重新扫描发现
      scan.found = false;
      scan.memory = 0;
      scan.heat = Math.max(0, scan.heat * 0.2);
    },
  });

  // 体积：开发者可调倍数（默认 1.25，与飞艇同体量），每帧应用以响应菜单实时改动。
  // localStorage 或开发者菜单中的 0/负值不能让整个编队缩成不可见。
  const sc =
    Number.isFinite(P.aircraftScale) && P.aircraftScale > 0
      ? P.aircraftScale
      : P_DEFAULTS.aircraftScale;
  aircraft.scale.setScalar(sc);

  // 巡航 / 扫描中 / 吸蜜 时保持扫描激光；归航义务期走常规巡航光
  const anyForaging = members.some(
    (m) => m.userData._forage && m.userData._forage.mode !== "cruise"
  );
  const laserActive = patrolMoving || anyForaging || (!onPostFeedPatrol && scan.inRange);
  const laserMode = onPostFeedPatrol
    ? "patrol"
    : scan.found
      ? "lock"
      : scan.inRange
        ? "search"
        : "patrol";

  const squadSuction01 = Number.isFinite(aircraft.userData.squadSuction01)
    ? aircraft.userData.squadSuction01
    : 1;

  // 橙红尾焰脉动（悬停吸蜜时更急促，像蜂鸟振翅余韵；受创后尾焰随吸取力萎缩）
  const forageBoost = anyForaging ? 1.35 : 1;
  const pulse = 0.75 + Math.sin(t * 16 * forageBoost) * 0.3;
  const woundDim = 0.35 + 0.65 * squadSuction01;
  if (aircraft.userData.flames) {
    for (const f of aircraft.userData.flames) {
      f.scale.set(1, pulse * woundDim, 1);
      if (f.material?.opacity != null) {
        f.material.opacity =
          f.material.color?.r > 0.9 && f.material.color?.g < 0.4
            ? (0.75 + pulse * 0.2) * woundDim
            : (0.4 + pulse * 0.25) * woundDim;
      }
    }
  }
  if (aircraft.userData.thrusters) {
    const glow = (1.3 + Math.sin(t * 9) * 0.4) * woundDim;
    for (const c of aircraft.userData.thrusters) {
      if (c.material.emissiveIntensity !== undefined) c.material.emissiveIntensity = glow;
    }
  }
  const neonPulse = (1.1 + Math.sin(t * 11 + 1.2) * 0.45) * woundDim;
  for (const m of members) {
    const tube = m.userData?.energyTube;
    if (tube?.material?.emissiveIntensity !== undefined) {
      tube.material.emissiveIntensity = neonPulse;
    }
  }

  const cockpitPulse = 0.85 + Math.sin(t * 8) * 0.15;
  const cores =
    aircraft.userData.cockpitCores ||
    (aircraft.userData.cockpitCore ? [aircraft.userData.cockpitCore] : []);
  const glows =
    aircraft.userData.cockpitGlows ||
    (aircraft.userData.cockpitGlow ? [aircraft.userData.cockpitGlow] : []);
  const lights =
    aircraft.userData.cockpitLights ||
    (aircraft.userData.cockpitLight ? [aircraft.userData.cockpitLight] : []);
  for (const core of cores) core.scale.setScalar(0.95 + cockpitPulse * 0.15);
  for (const glow of glows) {
    glow.material.opacity = (0.4 + cockpitPulse * 0.28) * woundDim;
    glow.scale.setScalar((0.85 + cockpitPulse * 0.35) * (0.6 + 0.4 * woundDim));
  }
  for (const light of lights) light.intensity = (3.2 + cockpitPulse * 1.6) * woundDim;

  // 中箭瞬间：舱核闪红（成员级冲击冲量）
  for (const m of members) {
    const imp2 = m.userData?._hitImpulse || 0;
    const coreMat = m.userData?.cockpitCore?.material;
    if (coreMat?.emissive) {
      coreMat.emissive.copy(_acRedFlash).lerp(_acBaseCore, 1 - Math.min(1, imp2 * 1.4));
    }
  }

  const neonLights = aircraft.userData.neonLights || [];
  for (const nl of neonLights) nl.intensity = 1.2 + Math.sin(t * 12 + 0.7) * 0.7;

  const thrusterLights = aircraft.userData.thrusterLights || [];
  for (const tl of thrusterLights) tl.intensity = 1.8 + Math.sin(t * 18) * 1.1;

  updateAircraftScanLasers(
    members,
    t,
    laserActive,
    aircraft.userData.patrol?.R,
    laserMode,
    scan,
    nectarList,
    dt
  );
}

/**
 * 从湖沼节点读取水面蜜源列表（兼容 placement wrap / 内层 zone）
 * @returns {{ flower: THREE.Object3D, worldPos: THREE.Vector3, nectar: number }[]}
 */
function resolveNectarTargets(swamp) {
  if (!swamp) return [];
  let list = swamp.userData?.nectarTargets;
  if ((!list || !list.length) && swamp.userData?.inner) {
    list = swamp.userData.inner.userData?.nectarTargets;
  }
  if (!list || !list.length) {
    // 若 wrap 有多个子节点，尝试找 kind=moebius-swamp 的内层
    swamp.traverse?.((o) => {
      if (list?.length) return;
      if (o !== swamp && o.userData?.nectarTargets?.length) {
        list = o.userData.nectarTargets;
      }
    });
  }
  return list || [];
}

/** 航迹扫描走廊：核心带 / 软边界（世界单位，相对编队中心） */
const SCAN_CORE_R = 44;
const SCAN_SOFT_R = 78;
/** 发现后记忆时长（秒）— 过期需重新扫描 */
const SCAN_MEMORY_MIN = 38;
const SCAN_MEMORY_SPAN = 28;

/**
 * 沿航线扫描轨道及近区：湖沼进入扫描带后按距离与蜜源有概率「发现」。
 * 返回编队级扫描状态（供吸蜜门控 + 激光视觉）。
 */
function updateSwampScan(aircraft, swamp, formationCenter, nectarList, dt, t) {
  if (!aircraft.userData._swampScan) {
    aircraft.userData._swampScan = {
      found: false,
      memory: 0,
      heat: 0, // 0..1 扫描热度（越扫越容易发现）
      inRange: false,
      proximity: 0,
      dist: Infinity,
      justFound: false,
    };
  }
  const scan = aircraft.userData._swampScan;
  scan.justFound = false;
  scan.inRange = false;
  scan.proximity = 0;

  // 记忆衰减：忘记湖沼位置后需重新扫到
  if (scan.found) {
    scan.memory -= dt;
    if (scan.memory <= 0) {
      scan.found = false;
      scan.heat = Math.max(0, scan.heat * 0.35);
      scan.memory = 0;
    }
  }

  if (!swamp || !formationCenter) {
    // 远离时热度缓慢冷却
    scan.heat = Math.max(0, scan.heat - dt * 0.08);
    return scan;
  }

  // 湖沼世界坐标（placement 根通常已在球面世界位）
  if (typeof swamp.getWorldPosition === "function") {
    swamp.getWorldPosition(_acTmpA);
  } else {
    _acTmpA.copy(swamp.position);
  }
  const dist = formationCenter.distanceTo(_acTmpA);
  scan.dist = dist;

  // 扫描带：核心走廊高灵敏，软边界低灵敏（轨道附近区域）
  if (dist >= SCAN_SOFT_R) {
    scan.heat = Math.max(0, scan.heat - dt * 0.12);
    return scan;
  }

  scan.inRange = true;
  const proximity =
    dist <= SCAN_CORE_R
      ? 1
      : 1 - (dist - SCAN_CORE_R) / Math.max(SCAN_SOFT_R - SCAN_CORE_R, 1e-3);
  scan.proximity = proximity;

  // 水面有发光落花时更容易被扫到
  const nectarN = nectarList?.length || 0;
  const nectarBonus = nectarN > 0 ? 1.55 + Math.min(nectarN, 3) * 0.12 : 0.75;

  // 热度累积：在扫描带内持续扫掠
  scan.heat = Math.min(1, scan.heat + dt * (0.1 + 0.32 * proximity) * nectarBonus * 0.55);

  // 已发现：刷新记忆（仍在带内时缓慢续航），不重复掷骰
  if (scan.found) {
    if (proximity > 0.35) {
      scan.memory = Math.min(scan.memory + dt * 0.35, SCAN_MEMORY_MIN + SCAN_MEMORY_SPAN);
    }
    return scan;
  }

  // 泊松发现：每秒基础概率随距离、热度、蜜源变化
  // 核心带 + 有花 + 热度满 ≈ 约 4–8 秒内较大概率发现；擦边带更慢
  const pPerSec =
    (0.08 + 0.22 * proximity) * nectarBonus * (0.35 + 0.9 * scan.heat);
  // 1 - exp(-λ dt) 近似每帧独立发现概率
  const p = 1 - Math.exp(-pPerSec * dt);
  if (Math.random() < p) {
    scan.found = true;
    scan.memory = SCAN_MEMORY_MIN + Math.random() * SCAN_MEMORY_SPAN;
    scan.heat = 1;
    scan.justFound = true;
  }

  return scan;
}

/**
 * 每架独立状态机：cruise | approach | hover | depart
 * 门控：编队扫描「发现」湖沼后，才允许脱离阵型去吸水面落花
 * 吸食成功 → onSuccessfulFeed → 编队进入两城往返归航期
 */
function updateHummingbirdForage(members, nectarList, ctx) {
  const {
    t,
    dt,
    aircraft = null,
    formationCenter,
    formationUp,
    formationTan,
    formationSide,
    formationBank,
    formationPitch,
    R = 40,
    swampFound = false,
    onSuccessfulFeed = null,
  } = ctx;

  // 已占用的花朵（一花一机）
  const claimed = new Set();
  for (const m of members) {
    const fg = m.userData._forage;
    if (fg?.flower && (fg.mode === "approach" || fg.mode === "hover")) {
      claimed.add(fg.flower);
    }
  }

  // 蜜源失效：花已复位 / 蜜尽 → 强制离场
  for (const m of members) {
    const fg = m.userData._forage;
    if (!fg || fg.mode === "cruise") continue;
    if (fg.flower) {
      const still =
        fg.flower.userData?.onWater && (fg.flower.userData?.nectar ?? 0) > 0.05;
      if (!still && fg.mode !== "depart") {
        fg.mode = "depart";
        fg.t = 0;
        fg.flower.userData.feeding = false;
        fg.flower = null;
      }
    }
  }

  // 编队合计中箭：每 50 支鲸下一档，300 支落地。飞艇高度不变。
  let squadHits = 0;
  for (const m of members) squadHits += m.userData?.arrowHits || 0;
  const sinkStep = THREE.MathUtils.clamp(
    Math.floor(squadHits / ARROW_SINK_STEP),
    0,
    ARROW_SINK_STEPS
  );
  const wantSquadSuction = 1 - sinkStep / ARROW_SINK_STEPS;
  const prevSquadSuction = Number.isFinite(aircraft?.userData?.squadSuction01)
    ? aircraft.userData.squadSuction01
    : 1;
  if (aircraft) {
    aircraft.userData.squadSuction01 =
      prevSquadSuction + (wantSquadSuction - prevSquadSuction) * Math.min(1, dt * 1.2);
    aircraft.userData.squadArrowHits = squadHits;
    aircraft.userData.whaleSinkStep = sinkStep;
  }

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (!member.userData._forage) {
      member.userData._forage = { mode: "cruise", t: 0, flower: null, cooldown: i * 0.7 };
    }
    const fg = member.userData._forage;

    // 阵位目标（巡航归位用）
    const slot = member.userData.formationSlot || { fwd: 0, side: 0, up: 0 };
    const lag = i * 0.09;
    const wph = (member.userData.whalePhase || 0) + t * 0.32 - lag;
    const personalHeave = Math.sin(wph) * 1.85 + Math.sin(wph * 0.45 + i) * 0.55;
    const personalSway = Math.sin(wph * 0.7 + i * 1.1) * 0.9;

    if (formationCenter && formationTan && formationUp && formationSide) {
      _acSlotPos
        .copy(formationCenter)
        .add(_acTmpA.copy(formationTan).multiplyScalar(slot.fwd))
        .add(_acTmpB.copy(formationSide).multiplyScalar(slot.side + personalSway))
        .add(_acTmpC.copy(formationUp).multiplyScalar(slot.up + personalHeave));
      // 中箭只抖、不掉高度——下沉的是苔庭鲸
      const hits = member.userData.arrowHits || 0;
      member.userData.woundHeightMul = 1;
      member.userData.suction01 = wantSquadSuction;
      const prevHits = member.userData._prevHits ?? 0;
      if (hits > prevHits) {
        member.userData._hitImpulse = Math.min(1.6, (member.userData._hitImpulse || 0) + 0.4);
      }
      member.userData._prevHits = hits;
      const imp = Math.max(0, (member.userData._hitImpulse || 0) - dt * 2.4);
      member.userData._hitImpulse = imp;
      if (imp > 0.01) {
        _acSlotPos
          .addScaledVector(formationTan, (Math.random() - 0.5) * imp * 1.1)
          .addScaledVector(formationSide, (Math.random() - 0.5) * imp * 1.1)
          .addScaledVector(formationUp, (Math.random() - 0.5) * imp * 0.5);
      }
    } else {
      _acSlotPos.copy(member.position);
    }

    // ---- 状态：cruise — 阵中巡航 + 扫描，仅「已发现湖沼」才接蜜 ----
    if (fg.mode === "cruise") {
      if (fg.cooldown > 0) fg.cooldown -= dt;

      member.position.copy(_acSlotPos);
      if (formationUp && formationTan) {
        orientAircraftToDir(member, formationUp, formationTan);
        member.rotateY(member.userData.formationHeading || 0);
        // 机头 = +Z：俯仰绕右舷 +X，滚转绕机头 +Z
        const bodyRoll = formationBank + Math.sin(wph * 0.9) * 0.06;
        const bodyPitch = formationPitch + Math.sin(wph * 0.55) * 0.05;
        member.quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bodyPitch)
        );
        member.quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), bodyRoll)
        );
      }

      // 必须编队扫描发现湖沼后，才允许个体去吸蜜
      if (fg.cooldown <= 0 && swampFound && nectarList.length) {
        let best = null;
        let bestD = Infinity;
        for (const n of nectarList) {
          if (!n.flower || claimed.has(n.flower)) continue;
          if ((n.nectar ?? 0) < 0.08) continue;
          if (n.flower.userData.feeding && n.flower.userData._feeder !== member) continue;
          const d = member.position.distanceTo(n.worldPos);
          if (d < bestD) {
            bestD = d;
            best = n;
          }
        }
        // 已发现：允许更远冲刺（知道湖沼方位）
        if (best && bestD < 120) {
          // 个体再掷一次：不是全队同时俯冲，有先后（蜂鸟轮换感）
          const peelChance = 0.55 + 0.35 * (1 - Math.min(bestD / 120, 1));
          if (Math.random() < peelChance * Math.min(1, dt * 4.5)) {
            fg.mode = "approach";
            fg.t = 0;
            fg.flower = best.flower;
            fg.targetPos = best.worldPos.clone();
            claimed.add(best.flower);
          }
        }
      }
      continue;
    }

    // 更新目标世界坐标（花可能随球面/父节点动）
    if (fg.flower) {
      fg.flower.getWorldPosition(_acFeedPos);
      fg.targetPos = _acFeedPos.clone();
    }
    const target = fg.targetPos || _acSlotPos;
    // 花上方悬停点：沿球面外法线抬高一点（像蜂鸟停在花冠上）
    _acFeedUp.copy(target).normalize();
    if (_acFeedUp.lengthSq() < 1e-8) _acFeedUp.set(0, 1, 0);
    const hoverH = 2.8 + (member.userData.formationIndex || 0) * 0.35; // 略错层，不撞
    _acTmpD.copy(target).addScaledVector(_acFeedUp, hoverH);

    // ---- approach：俯冲靠近 ----
    if (fg.mode === "approach") {
      fg.t += dt;
      // 朝目标加速滑翔（比巡航更轻快，蜂鸟冲刺）
      const to = _acTmpE.copy(_acTmpD).sub(member.position);
      const dist = to.length();
      const approachSpeed = 14 + Math.min(dist * 0.35, 18);
      if (dist > 0.001) to.multiplyScalar(1 / dist);
      const step = Math.min(dist, approachSpeed * dt);
      member.position.addScaledVector(to, step);

      // 机头朝目标，略俯冲
      const up = member.position.clone().normalize();
      let tan = to.clone();
      // 投影到切平面，避免机头扎进球心
      tan.addScaledVector(up, -tan.dot(up));
      if (tan.lengthSq() < 1e-8) {
        tan = formationTan ? formationTan.clone() : new THREE.Vector3(1, 0, 0);
        tan.addScaledVector(up, -tan.dot(up));
      }
      tan.normalize();
      orientAircraftToDir(member, up, tan);
      // 俯冲俯仰（绕右舷 +X）
      const divePitch = -0.35 * THREE.MathUtils.clamp(dist / 40, 0.2, 1);
      member.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), divePitch)
      );

      if (dist < 3.2 || fg.t > 14) {
        fg.mode = "hover";
        fg.t = 0;
        if (fg.flower) {
          fg.flower.userData.feeding = true;
          fg.flower.userData._feeder = member;
        }
      }
      continue;
    }

    // ---- hover：巨大蜂鸟悬停吸蜜 ----
    if (fg.mode === "hover") {
      fg.t += dt;
      // 高频微颤 + 横向小幅闪移（蜂鸟特征）
      const buzz = Math.sin(t * 28 + i * 2.1) * 0.22 + Math.sin(t * 41 + i) * 0.08;
      const dartX = Math.sin(t * 5.5 + i * 1.7) * 0.55;
      const dartZ = Math.cos(t * 4.2 + i * 0.9) * 0.4;
      // 切平面基
      _acFeedTan.set(1, 0, 0);
      _acFeedTan.addScaledVector(_acFeedUp, -_acFeedTan.dot(_acFeedUp));
      if (_acFeedTan.lengthSq() < 1e-8) _acFeedTan.set(0, 0, 1);
      _acFeedTan.normalize();
      const side = _acTmpA.crossVectors(_acFeedUp, _acFeedTan).normalize();

      _acTmpB
        .copy(_acTmpD)
        .addScaledVector(_acFeedUp, buzz)
        .addScaledVector(_acFeedTan, dartX)
        .addScaledVector(side, dartZ);
      // 平滑贴合悬停点（不完全瞬移，保留重量感）
      member.position.lerp(_acTmpB, 1 - Math.exp(-dt * 6));

      // 机头微微俯向花心，机身朝切向缓转
      const face = _acTmpC.copy(target).sub(member.position);
      face.addScaledVector(_acFeedUp, -face.dot(_acFeedUp));
      if (face.lengthSq() < 1e-8) face.copy(_acFeedTan);
      face.normalize();
      orientAircraftToDir(member, _acFeedUp, face);
      // 悬停俯角（绕 +X）+ 轻微左右偏航（绕 +Y）
      const sipPitch = -0.48 + Math.sin(t * 9 + i) * 0.06;
      const sipYaw = Math.sin(t * 3.2 + i) * 0.12;
      member.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), sipPitch)
      );
      member.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sipYaw)
      );

      // 吸够一段时间 / 蜜尽 → 离场，回报编队进入「两城往返」归航
      const nectarLeft = fg.flower?.userData?.nectar ?? 0;
      if (fg.t > 5.5 || nectarLeft < 0.08) {
        if (fg.flower) {
          fg.flower.userData.feeding = false;
          if (fg.flower.userData._feeder === member) fg.flower.userData._feeder = null;
        }
        // 实际悬停吸过才算成功（t 够长）
        if (fg.t > 1.2 && typeof onSuccessfulFeed === "function") {
          onSuccessfulFeed(member);
        }
        fg.mode = "depart";
        fg.t = 0;
        fg.flower = null;
        fg.returningToPatrol = true; // 标记：归队后专走城际航线
      }
      continue;
    }

    // ---- depart：爬升归队 → 重新编入水晶城↔书店镇往返 --------
    if (fg.mode === "depart") {
      fg.t += dt;
      const to = _acTmpE.copy(_acSlotPos).sub(member.position);
      const dist = to.length();
      if (dist > 0.001) to.multiplyScalar(1 / dist);
      const climbSpeed = 11 + Math.min(dist * 0.25, 14);
      member.position.addScaledVector(to, Math.min(dist, climbSpeed * dt));

      const up = member.position.clone().normalize();
      let tan = to.clone();
      tan.addScaledVector(up, -tan.dot(up));
      if (tan.lengthSq() < 1e-8 && formationTan) tan.copy(formationTan);
      if (tan.lengthSq() < 1e-8) tan.set(1, 0, 0);
      tan.normalize();
      orientAircraftToDir(member, up, tan);
      // 爬升抬头（绕右舷 +X）
      member.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          0.28 * THREE.MathUtils.clamp(dist / 30, 0.15, 1)
        )
      );

      if (dist < 2.5 || fg.t > 12) {
        fg.mode = "cruise";
        fg.t = 0;
        // 归队后长冷却：先跟着编队在两城间游走，不立刻再扎湖沼
        fg.cooldown = fg.returningToPatrol ? 28 + i * 4 : 2.5 + i * 0.4;
        fg.returningToPatrol = false;
        fg.flower = null;
      }
    }
  }
}

// 扫描激光临时量（世界空间射线 → 球面落点）
const _scanOrigin = new THREE.Vector3();
const _scanDir = new THREE.Vector3();
const _scanHit = new THREE.Vector3();
const _scanNadir = new THREE.Vector3();
const _scanTan = new THREE.Vector3();
const _scanSide = new THREE.Vector3();
const _scanUp = new THREE.Vector3();
const _scanLocalO = new THREE.Vector3();
const _scanLocalH = new THREE.Vector3();
const _scanLocalD = new THREE.Vector3();
const _scanLocalN = new THREE.Vector3();
const _scanInv = new THREE.Matrix4();
const _scanY = new THREE.Vector3(0, 1, 0);
const _scanZ = new THREE.Vector3(0, 0, 1);
const _scanAxis = new THREE.Vector3();

/** from → to 的安全四元数（处理近平行 / 反平行） */
function alignVecTo(from, to, outQ) {
  const d = from.dot(to);
  if (d > 0.9999) {
    outQ.identity();
    return outQ;
  }
  if (d < -0.9999) {
    // 反平行：绕任意垂直轴转 180°
    _scanAxis.set(1, 0, 0);
    if (Math.abs(from.x) > 0.9) _scanAxis.set(0, 1, 0);
    _scanAxis.cross(from).normalize();
    outQ.setFromAxisAngle(_scanAxis, Math.PI);
    return outQ;
  }
  return outQ.setFromUnitVectors(from, to);
}

/** 扫描吸力落点池（避免每帧 new Vector3） */
const _scanHitPool = [];
const _scanObjPos = new THREE.Vector3();
const _scanCraftPos = new THREE.Vector3();
const _scanLocalTarget = new THREE.Vector3();
const _scanWaveSide = new THREE.Vector3();
const _scanWaveFwd = new THREE.Vector3();

// 仅湖沼「发光花朵」可被吸入 aircraft
const SCAN_PULL_RADIUS = 5.5; // 光斑锁定半径
const SCAN_SUCK_SPEED = 11; // 沿光束吸入速度（世界单位/秒）
const SCAN_WAVE_AMP = 0.42; // 吸入途中正弦横向颤
const SCAN_WAVE_FREQ = 8.5;
const SCAN_ABSORB_DIST = 1.35; // 距机腹多近算吸入

/**
 * 是否为湖沼水面发光蜜源花（唯一可被扫描吸入的物体）。
 * 树冠上的花 / 落叶 / 其它道具一律不吸。
 */
function isSwampGlowFlower(f) {
  if (!f?.userData) return false;
  // 必须已落水且仍有蜜（巨型发光花的蜜源态）
  if (f.userData.onWater !== true) return false;
  if ((f.userData.nectar ?? 0) <= 0.05) return false;
  // 发光花蕊 core 作为发光花身份标记
  if (!f.userData.core && f.userData.kind !== "swamp-giant-flower") return false;
  // 正在被吸完则跳过
  if (f.userData._scanAbsorbed) return false;
  return true;
}

/**
 * 激光扫到湖沼发光花 → 沿光束向上吸入最近的 aircraft 机腹。
 * 吸入途中带正弦横向波动；抵达机腹后吸收复位。
 */
function applyScanSuction(hits, nectarList, t, dt) {
  const flowers = [];
  if (nectarList?.length) {
    for (const n of nectarList) {
      if (n?.flower && isSwampGlowFlower(n.flower)) flowers.push(n.flower);
    }
  }

  // 无激光：未锁定的花回落；已锁定的继续吸完
  const activeHits = hits?.length ? hits : [];

  for (let i = 0; i < flowers.length; i++) {
    const f = flowers[i];
    f.getWorldPosition(_scanObjPos);

    // 找最近光斑 / 已锁定的机
    let best = 0;
    let bestHit = null;
    for (let h = 0; h < activeHits.length; h++) {
      const hit = activeHits[h];
      const d = _scanObjPos.distanceTo(hit.pos);
      const r = hit.r || SCAN_PULL_RADIUS;
      if (d < r) {
        const s = 1 - d / r;
        if (s > best) {
          best = s;
          bestHit = hit;
        }
      }
    }

    // 首次进入光斑 → 锁定吸入目标机
    if (!f.userData._scanSuckLock && bestHit && best > 0.12) {
      f.userData._scanSuckLock = {
        craft: bestHit.craft,
        phase: i * 1.91 + t * 0.01,
      };
      f.userData._scanPullRestY = f.position.y;
      f.userData._scanPullRestPos = f.position.clone();
      // 延长水面停留，防止湖沼逻辑中途复位
      f.userData.restT = Math.min(f.userData.restT ?? 0, 2);
      f.userData.scanSucking = true;
    }

    const lock = f.userData._scanSuckLock;
    if (!lock?.craft) {
      // 未锁定：光斑上仅轻微托起 + 正弦波（尚未吸入机腹）
      if (best > 0.05 && f.userData._scanPullRestY != null) {
        const phase = i * 1.7;
        const wave = Math.sin(t * SCAN_WAVE_FREQ + phase) * SCAN_WAVE_AMP * best;
        const lift = 0.85 * best + wave;
        f.position.y = f.userData._scanPullRestY + lift;
      } else if (f.userData._scanPullRestY != null && !lock) {
        // 离开光斑回落
        const rest = f.userData._scanPullRestY;
        f.position.y += (rest - f.position.y) * (1 - Math.exp(-6 * Math.max(dt, 1e-4)));
        if (Math.abs(f.position.y - rest) < 0.03) {
          f.position.y = rest;
          f.userData._scanPullRestY = undefined;
          f.scale.setScalar(1);
        }
      }
      continue;
    }

    // —— 已锁定：沿世界直线吸入机腹发射口 ——
    const craft = lock.craft;
    if (!craft?.parent) {
      releaseScanSuck(f, true);
      continue;
    }
    craft.updateWorldMatrix(true, false);
    const emitter =
      craft.userData?.scanBeam?.userData?.emitterLocal ||
      new THREE.Vector3(0, -0.85, 0.35);
    _scanCraftPos.copy(emitter).applyMatrix4(craft.matrixWorld);

    f.getWorldPosition(_scanObjPos);
    const dist = _scanObjPos.distanceTo(_scanCraftPos);
    if (dist < SCAN_ABSORB_DIST) {
      absorbGlowFlowerIntoAircraft(f, craft);
      continue;
    }

    // 目标点：机腹 + 正弦横向波动（沿光束路径颤动）
    const phase = lock.phase ?? 0;
    _scanWaveSide.set(1, 0, 0).transformDirection(craft.matrixWorld);
    _scanWaveFwd.set(0, 0, 1).transformDirection(craft.matrixWorld);
    const w = Math.sin(t * SCAN_WAVE_FREQ + phase) * SCAN_WAVE_AMP;
    const w2 = Math.cos(t * SCAN_WAVE_FREQ * 0.73 + phase) * SCAN_WAVE_AMP * 0.55;
    _scanLocalTarget
      .copy(_scanCraftPos)
      .addScaledVector(_scanWaveSide, w)
      .addScaledVector(_scanWaveFwd, w2);

    // 世界目标 → 父节点本地坐标，再 lerp
    const parent = f.parent;
    if (parent) {
      parent.worldToLocal(_scanLocalTarget);
      const step = 1 - Math.exp(-SCAN_SUCK_SPEED * 0.22 * Math.max(dt, 1e-4));
      // 距离越近吸得越快
      const boost = THREE.MathUtils.clamp(1.2 + (8 / Math.max(dist, 1)) * 0.35, 1, 2.2);
      f.position.lerp(_scanLocalTarget, Math.min(1, step * boost));
    } else {
      f.position.lerp(_scanLocalTarget, 0.15);
    }

    // 吸入途中缩小 + 自旋
    const shrink = THREE.MathUtils.clamp(dist / 18, 0.25, 1);
    f.scale.setScalar(shrink);
    f.rotation.y += dt * 4.5;
    f.rotation.x += dt * 2.2;
    // 阻止湖沼超时复位
    f.userData.restT = Math.min(f.userData.restT ?? 0, 1);
    f.userData.scanSucking = true;
  }
}

/** 发光花被吸入机腹：消耗蜜源并复位回树冠开放态 */
function absorbGlowFlowerIntoAircraft(f, craft) {
  if (!f?.userData) return;
  f.userData.nectar = 0;
  f.userData.onWater = false;
  f.userData.falling = false;
  f.userData.splashed = false;
  f.userData.feeding = false;
  f.userData.restT = 0;
  f.userData.scanSucking = false;
  f.userData._scanAbsorbed = false;
  f.userData._scanSuckLock = null;
  f.userData._scanPullRestY = undefined;
  f.userData._scanPullRestPos = undefined;
  // 回树冠高度重新开放
  if (Number.isFinite(f.userData.baseY)) f.position.y = f.userData.baseY;
  f.rotation.set(0, f.rotation.y, 0);
  f.scale.setScalar(1);
  f.visible = true;
  // 可选：机腹闪一下（若有 thruster light）
  if (craft?.userData?.thrusterLight) {
    craft.userData.thrusterLight.intensity = Math.max(
      craft.userData.thrusterLight.intensity,
      4.5
    );
  }
}

function releaseScanSuck(f, snap = false) {
  if (!f?.userData) return;
  f.userData._scanSuckLock = null;
  f.userData.scanSucking = false;
  const rest = f.userData._scanPullRestY;
  if (snap && Number.isFinite(rest)) f.position.y = rest;
  f.userData._scanPullRestY = undefined;
  f.scale.setScalar(1);
}

/**
 * 地面扫描激光：从机腹发出，打到星球球面并扫掠。
 * 世界空间求射线-球面交点，再写回机身局部（光束为子物体）。
 * 扫到的物体：向上吸力 + 正弦波动。
 * mode: patrol | search | lock
 */
function updateAircraftScanLasers(
  members,
  t,
  flying,
  R = 40,
  mode = "patrol",
  scan = null,
  nectarList = null,
  dt = 0.016
) {
  if (!members?.length) {
    applyScanSuction([], nectarList, t, dt);
    return;
  }
  const heat = scan?.heat ?? 0;
  const prox = scan?.proximity ?? 0;
  const planetR = Math.max(8, R);
  let hitCount = 0;

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const beam = m.userData?.scanBeam;
    const spot = m.userData?.scanSpot;
    const ring = m.userData?.scanRing;
    if (!beam || !spot) continue;

    if (!flying) {
      beam.visible = false;
      spot.visible = false;
      if (ring) ring.visible = false;
      continue;
    }

    m.updateWorldMatrix(true, false);
    _scanInv.copy(m.matrixWorld).invert();

    // 发射口：机腹局部点 → 世界
    const emitter =
      beam.userData.emitterLocal ||
      (beam.userData.emitterLocal = new THREE.Vector3(0, -0.85, 0.35));
    _scanOrigin.copy(emitter).applyMatrix4(m.matrixWorld);

    // 天顶 = 球心→机（外法线）；天底 = 指向地表
    _scanUp.copy(_scanOrigin).normalize();
    _scanNadir.copy(_scanUp).negate();

    // 切平面基：用机身世界朝向投影（扫掠左右/前后）
    _scanTan.set(0, 0, 1).transformDirection(m.matrixWorld);
    _scanTan.addScaledVector(_scanUp, -_scanTan.dot(_scanUp));
    if (_scanTan.lengthSq() < 1e-8) {
      _scanTan.set(1, 0, 0).transformDirection(m.matrixWorld);
      _scanTan.addScaledVector(_scanUp, -_scanTan.dot(_scanUp));
    }
    if (_scanTan.lengthSq() < 1e-8) _scanTan.set(1, 0, 0);
    _scanTan.normalize();
    _scanSide.crossVectors(_scanUp, _scanTan).normalize();

    // 扫掠幅度（相对天底的倾斜）
    const sweepMul = mode === "search" ? 1.4 : mode === "lock" ? 0.45 : 1;
    const speedMul = mode === "search" ? 1.55 + heat * 0.55 : mode === "lock" ? 0.65 : 1;
    const ph = (m.userData.scanPhase || 0) + t * 1.85 * speedMul + i * 0.85;
    const amp = 0.42 * sweepMul * (mode === "lock" ? 0.35 + 0.2 * Math.sin(t * 6) : 1);
    const swingSide = Math.sin(ph) * amp;
    const swingFwd = Math.cos(ph * 0.72) * amp * 0.55;

    // 扫描方向 = 天底 + 切向扫掠（归一化）
    _scanDir
      .copy(_scanNadir)
      .addScaledVector(_scanSide, swingSide)
      .addScaledVector(_scanTan, swingFwd)
      .normalize();

    // 射线 ∩ 球面 |O + t D| = planetR（机在球外，取较小正根）
    const bCoef = 2 * _scanOrigin.dot(_scanDir);
    const cCoef = _scanOrigin.lengthSq() - planetR * planetR;
    const disc = bCoef * bCoef - 4 * cCoef;
    let tHit = -1;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      const t1 = (-bCoef - s) * 0.5;
      const t2 = (-bCoef + s) * 0.5;
      if (t1 > 0.15) tHit = t1;
      else if (t2 > 0.15) tHit = t2;
    }
    // 无交点时沿天底落到近似地表距离
    if (tHit < 0) {
      tHit = Math.max(4, _scanOrigin.length() - planetR);
      _scanDir.copy(_scanNadir);
    }
    // 防止超长射线
    tHit = Math.min(tHit, 120);

    _scanHit.copy(_scanOrigin).addScaledVector(_scanDir, tHit);

    // —— 写回机身局部：光束从 emitter 连到 hit ——
    _scanLocalO.copy(emitter);
    _scanLocalH.copy(_scanHit).applyMatrix4(_scanInv);
    _scanLocalD.copy(_scanLocalH).sub(_scanLocalO);
    const beamLen = Math.max(0.5, _scanLocalD.length());
    _scanLocalD.multiplyScalar(1 / beamLen);

    // 圆柱默认 +Y → 对齐局部发射方向；中点在半程
    beam.position.copy(_scanLocalO).addScaledVector(_scanLocalD, beamLen * 0.5);
    alignVecTo(_scanY, _scanLocalD, beam.quaternion);
    beam.scale.set(1, beamLen, 1);
    beam.visible = true;

    // 光斑：落点处，面朝地表外法线（世界 hit 方向 → 局部）
    _scanLocalN.copy(_scanHit).normalize().transformDirection(_scanInv);
    if (_scanLocalN.lengthSq() < 1e-8) _scanLocalN.set(0, 1, 0);
    else _scanLocalN.normalize();
    // 略抬离地表，防 z-fight
    spot.position.copy(_scanLocalH).addScaledVector(_scanLocalN, 0.08);
    // Circle 法线默认 +Z → 对齐地表法线
    alignVecTo(_scanZ, _scanLocalN, spot.quaternion);
    spot.visible = true;

    if (ring) {
      ring.position.copy(spot.position);
      ring.quaternion.copy(spot.quaternion);
      ring.visible = true;
    }

    // 外观：模式色 + 脉动
    let baseOp = 0.38 + Math.abs(Math.sin(ph * 1.3)) * 0.38;
    if (mode === "search") baseOp = 0.48 + heat * 0.25 + prox * 0.12;
    if (mode === "lock") baseOp = 0.58 + Math.abs(Math.sin(t * 10 + i)) * 0.32;
    beam.material.opacity = Math.min(0.95, baseOp);

    if (beam.material.color) {
      if (mode === "lock") beam.material.color.setRGB(0.35, 1.0, 0.75);
      else if (mode === "search") beam.material.color.setRGB(0.55, 0.95, 1.0);
      else beam.material.color.setRGB(0.4, 0.95, 0.7);
    }

    const spotPulse =
      mode === "lock"
        ? 0.5 + Math.abs(Math.sin(t * 11 + i)) * 0.4
        : 0.35 + Math.abs(Math.sin(t * 9 + i)) * 0.35 + (mode === "search" ? heat * 0.2 : 0);
    spot.material.opacity = spotPulse;
    const spotSc =
      (mode === "search" ? 1.2 : mode === "lock" ? 1.4 : 1.0) +
      Math.abs(Math.sin(ph)) * 0.55;
    spot.scale.setScalar(spotSc);
    if (ring) {
      ring.scale.setScalar(spotSc);
      ring.material.opacity = spotPulse * 0.75;
    }

    if (spot.material.color) {
      if (mode === "lock") spot.material.color.setRGB(0.4, 1.0, 0.7);
      else if (mode === "search") spot.material.color.setRGB(0.6, 0.95, 1.0);
      else spot.material.color.setRGB(0.45, 1.0, 0.75);
    }

    // 记录世界落点 + 所属飞机：仅湖沼发光花会被吸入该机机腹
    if (!_scanHitPool[hitCount]) {
      _scanHitPool[hitCount] = {
        pos: new THREE.Vector3(),
        r: SCAN_PULL_RADIUS,
        craft: null,
      };
    }
    const rec = _scanHitPool[hitCount++];
    rec.pos.copy(_scanHit);
    rec.r = SCAN_PULL_RADIUS * (0.85 + spotSc * 0.35);
    rec.craft = m;
  }

  // 激光扫到的物体：向上吸 + 正弦波
  const hits = flying ? _scanHitPool.slice(0, hitCount) : [];
  applyScanSuction(hits, nectarList, t, dt);
}

/**
 * 机身朝向：局部 +Z = 机头前向（与尾焰在 -Z 一致，尾焰推力推船向前），
 * 局部 +Y = 球面外法线 up，局部 +X = 右舷。
 * 注意：旧实现误把 +X 当机头，导致船身横着飞、尾焰朝侧面。
 */
function orientAircraftToDir(aircraft, d, tangentHint = null) {
  const up = d.clone().normalize();
  let tangent = tangentHint
    ? tangentHint.clone()
    : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), up);
  if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
  // 切向必须垂直于 up（球面切平面内的前向）
  tangent.addScaledVector(up, -tangent.dot(up));
  if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
  tangent.normalize();
  // 右手系：X = Y × Z = up × forward → 右舷
  const side = new THREE.Vector3().crossVectors(up, tangent).normalize();
  // makeBasis(x, y, z)：局部 +Z 对齐飞行切向（机头），+Y 对齐法线
  const m = new THREE.Matrix4().makeBasis(side, up, tangent);
  aircraft.quaternion.setFromRotationMatrix(m);
}
