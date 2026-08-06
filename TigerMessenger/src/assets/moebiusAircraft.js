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
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: _gradient3,
    flatShading: true,
    transparent: opts.transparent ?? true,
    opacity: opts.opacity ?? 0.85,
    side: opts.side ?? THREE.FrontSide,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    vertexColors: opts.vertexColors ?? false,
  });
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

/**
 * 创建飞行器：所有部件加入一个 Group 并返回。
 * 机身长轴沿 +Z（机头朝 +Z），局部中心在原点附近。
 */
export function createMoebiusAircraft() {
  const g = new THREE.Group();
  g.name = "moebius-aircraft";

  // ---------- 1. 外层卡通水晶外壳 (LatheGeometry · 12 棱低多边形 · 复古橙红) ----------
  // 废除 MeshPhysicalMaterial transmission，改用 MeshToonMaterial + opacity 半透明。
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

  const hullMat = crystalToon(0xD35400, {
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    emissive: 0xD35400,
    emissiveIntensity: 0.12,
  });
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

  // ---------- 3. 内部核心引擎与能量管 ----------
  // 3a. 前段：发光橘红能量球
  const coreMat = crystalToon(0xff7a2a, {
    transparent: false,
    emissive: 0xff6600,
    emissiveIntensity: 2.0,
  });
  const core = part(new THREE.SphereGeometry(0.7, 12, 8), coreMat, 0.04);
  core.scale.set(1.0, 1.0, 1.2); // 沿 Z 略拉长
  core.position.z = 1.3;
  g.add(core);

  // 内核橘红光源（点亮半透明外壳）
  const coreLight = new THREE.PointLight(0xff7a2a, 2.2, 9, 2);
  coreLight.position.z = 1.3;
  g.add(coreLight);

  // 3b. 中后段：拧麻花状能量管（TubeGeometry 沿扭曲曲线），橘黄渐变浅绿
  const tubePts = [];
  const tubeLen = 4.2;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const z = 1.2 - t * tubeLen;            // 从核心向后(-Z)
    const ang = t * Math.PI * 5.0;          // 螺旋扭转
    const rad = 0.18 * (1 - t * 0.55);      // 向后收窄
    tubePts.push(new THREE.Vector3(Math.sin(ang) * rad, Math.cos(ang) * rad, z));
  }
  const tubeCurve = new THREE.CatmullRomCurve3(tubePts);
  const tubeMat = crystalToon(0xffd24a, {
    transparent: false,
    vertexColors: true,
    emissive: 0x88ff99,
    emissiveIntensity: 0.5,
  });
  const tubeGeo = new THREE.TubeGeometry(tubeCurve, 60, 0.16, 8, false);
  {
    const pos = tubeGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cFront = new THREE.Color(0xffd24a);
    const cBack = new THREE.Color(0xa8ff9a);
    for (let i = 0; i < pos.count; i++) {
      const t = i / (pos.count - 1);
      const c = cFront.clone().lerp(cBack, t);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    tubeGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  const tube = part(tubeGeo, tubeMat, 0.04);
  g.add(tube);

  // 3c. 尾部喷口：灰黑机械喷罩
  const nozzleMat = crystalToon(0x2a2a2e, { transparent: false });
  const nozzle = part(new THREE.CylinderGeometry(0.55, 0.32, 0.9, 12, 1, true), nozzleMat, 0.04);
  nozzle.rotation.x = Math.PI / 2; // 轴朝 Z
  nozzle.position.z = -3.2;
  g.add(nozzle);
  const nozzleRing = part(new THREE.TorusGeometry(0.55, 0.07, 8, 16), nozzleMat, 0.04);
  nozzleRing.rotation.y = Math.PI / 2;
  nozzleRing.position.z = -2.75;
  g.add(nozzleRing);

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

  // ---------- 6. 驾驶舱锚点 + 驾驶舱青柠色光源 ----------
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(0, 0.5, 1.6); // 玻璃罩内、机头附近
  cockpitAnchor.name = "cockpit-anchor";
  g.add(cockpitAnchor);

  // 可见的青柠驾驶室核心：实心高亮内核 + 加色混合外辉光晕，远处/雨天也醒目。
  // MeshBasicMaterial 不受光、不触发 SwiftShader 回读，保留原样。
  const cockpitCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xcbff9e, // 核心更亮，接近白青柠
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
  );
  cockpitCore.name = "cockpit-lime-core";
  cockpitCore.position.set(0, 0, 0.3);
  cockpitCore.renderOrder = 11;
  cockpitAnchor.add(cockpitCore);

  // 外层加色混合光晕：比核心大一圈，Additive 混合让亮度视觉上远高于普通透明球。
  const cockpitGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x9cff5e,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  cockpitGlow.name = "cockpit-lime-glow";
  cockpitGlow.position.copy(cockpitCore.position);
  cockpitGlow.renderOrder = 10;
  cockpitAnchor.add(cockpitGlow);

  const cockpitLight = new THREE.PointLight(0x9cff5e, 5.5, 34, 1.4); // 青柠绿，加倍亮度与照射范围
  cockpitLight.position.set(0, 0.55, 1.9);
  g.add(cockpitLight);

  // 喷焰（机尾，向后脉动），保留 userData.flames 供 updateAircraftHover 脉动
  // MeshBasicMaterial 不受光，保留原样。
  const flames = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0.6 });
  for (const sx of [-1, 1]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.3, 6), flameMat);
    flame.rotation.x = -Math.PI / 2; // 锥尖朝 -Z
    flame.position.set(sx * 0.32, 0, -3.7);
    g.add(flame);
    flames.push(flame);
  }

  // part() 已对全部实体网格设置 castShadow = true + addOutline 描边，
  // 无需再 traverse。驾驶舱核心/光晕/喷焰为特效件不投影。

  g.userData.kind = "moebius-aircraft";
  g.userData.thrusters = [core]; // 内核发光件，供脉动
  g.userData.flames = flames;
  g.userData.cockpitAnchor = cockpitAnchor;
  g.userData.cockpitLight = cockpitLight;
  g.userData.cockpitGlow = cockpitGlow;
  g.userData.cockpitCore = cockpitCore;
  return g;
}

/**
 * 把飞行器锚到某方向上空（沿法线抬升 height）。
 * @param {THREE.Object3D} aircraft 飞行器 Group
 * @param {THREE.Vector3} dir 单位方向（球面法线）
 * @param {number} R 星球半径
 * @param {number} [height] 离地表高度
 */
export function placeAircraftAbove(aircraft, dir, R, height = 22) {
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
export function syncAircraftSquadToAnchor(squad, anchor, R, height = 24) {
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
 * @param {number} [opts.height=24]  编队中心离地表高度
 * @param {number} [opts.radius=10]  环形半径（切平面内）
 * @param {number} [opts.spin=0.06]  编队绕法线自旋角速度（无航线时生效）
 * @param {object} [opts.patrol]     航线 { dirA:Vector3, dirB:Vector3 }
 * @param {number} [opts.speed=0.12] 往返巡航速度（0~1 相位/秒）
 */
export function createMoebiusAircraftSquad(centerDir, R, opts = {}) {
  const { count = 5, height = 24, radius = 10, spin = 0.06, patrol = null, speed = 0.12, formation = "ring" } = opts;
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
  // 编队中心用于无航线锚点同步，以及有航线时计算成员平移量。
  squad.userData.anchorCenter = center.clone();
  squad.userData._patrolCenter = center.clone();
  for (let i = 0; i < count; i++) {
    const ac = createMoebiusAircraft();
    let off, heading = 0;

    if (formation === "v") {
      // 大雁人字阵（V 字）：第 0 架领头在尖端，其余分左右两翼向后延伸
      // tangent = 队列前进方向，side = 左右翼展开方向
      if (i === 0) {
        // 领头机：最前方
        off = tangent.clone().multiplyScalar(radius * 0.6)
          .add(up.clone().multiplyScalar(0));
        heading = 0; // 朝 tangent（前方）
      } else {
        const wingIdx = Math.ceil(i / 2);          // 第几排（1,2,...）
        const isLeft = (i % 2 === 1);               // 奇数左翼，偶数右翼
        const wingSign = isLeft ? 1 : -1;
        const back = wingIdx * radius * 0.8;        // 向后逐排延伸
        const spread = wingIdx * radius * 0.7;      // 向两侧展开
        off = tangent.clone().multiplyScalar(radius * 0.6 - back)
          .add(side.clone().multiplyScalar(wingSign * spread))
          .add(up.clone().multiplyScalar(0));
        heading = wingSign * 0.35; // 略偏朝队形外侧
      }
    } else {
      // 默认环形编队
      const a = (i / count) * Math.PI * 2;
      const ringR = radius * (0.55 + 0.45 * ((i % 3) / 2));
      off = tangent.clone().multiplyScalar(Math.cos(a) * ringR)
        .add(side.clone().multiplyScalar(Math.sin(a) * ringR))
        .add(up.clone().multiplyScalar((i % 2 === 0 ? 1 : -1) * 2.2));
      heading = -a;
    }

    ac.position.copy(center).add(off);
    orientAircraftToDir(ac, up);
    ac.rotateY(heading); // 机头朝队列方向
    ac.userData.formationHeading = heading;
    squad.add(ac);
    members.push(ac);
  }

  squad.userData.kind = "moebius-aircraft-squad";
  squad.userData.centerDir = d.clone();
  squad.userData.spin = spin;
  squad.userData.members = members;
  squad.userData.thrusters = members.flatMap((m) => m.userData.thrusters || []);
  squad.userData.flames = members.flatMap((m) => m.userData.flames || []);
  // 聚合每架机的驾驶舱发光件，供 updateAircraftHover(squad, ...) 统一驱动脉动。
  squad.userData.cockpitCores = members.map((m) => m.userData.cockpitCore).filter(Boolean);
  squad.userData.cockpitGlows = members.map((m) => m.userData.cockpitGlow).filter(Boolean);
  squad.userData.cockpitLights = members.map((m) => m.userData.cockpitLight).filter(Boolean);
  // 航线巡航参数（有 patrol 时启用）
  if (patrol) {
    const dA = patrol.dirA.clone().normalize();
    const dB = patrol.dirB.clone().normalize();
    squad.userData.patrol = {
      dirA: dA,
      dirB: dB,
      R, height,
      // 球面弧长（dirA↔dirB 大圆距离），运行时据速度换算单程时长
      arcLen: dA.angleTo(dB) * R,
      speed,
      maxSpeed: Number.isFinite(patrol.maxSpeed) && patrol.maxSpeed > 0
        ? patrol.maxSpeed
        : Infinity,
    };
  }
  return squad;
}

/** 悬停/巡航动画（在场景 update 中调用）
 *  - 有 patrol 航线：编队沿球面在水晶城(dirA)↔书店(dirB)之间往返，
 *    途经赤道云墙；到达端点后停留 aircraftHoldSec 秒再折返；机头朝运动切向。
 *  - 无航线：编队绕母晶塔法线缓慢自旋。
 *  - 各机喷射脉动始终生效。
 *  @param {number} [dt] 帧间隔（秒），用于基于时间推进的停留/巡航状态机
 */
export function updateAircraftHover(aircraft, t, dt = 0.016) {
  if (!aircraft) return;

  if (aircraft.userData.patrol) {
    const p = aircraft.userData.patrol;
    // 基于时间推进的状态机：0=水晶城→书店 1=书店停留 2=书店→水晶城 3=水晶城停留
    if (!aircraft.userData._patrol) aircraft.userData._patrol = { seg: 0, u: 0, phase: 0 };
    const st = aircraft.userData._patrol;
    const configuredSpeed = Number.isFinite(P.aircraftSpeed) ? P.aircraftSpeed : 3.1;
    const speed = Math.min(Math.max(configuredSpeed, 0.01), p.maxSpeed); // 低速巡航上限由航线配置控制
    const legTime = p.arcLen > 1e-3 ? p.arcLen / Math.max(speed, 0.01) : 1; // 单程时长
    const hold = Number.isFinite(P.aircraftHoldSec) ? P.aircraftHoldSec : 30;

    // 推进状态机
    st.u += dt / (st.seg === 1 || st.seg === 3 ? Math.max(hold, 0.001) : legTime);
    if (st.u >= 1) {
      st.u = 0;
      st.seg = (st.seg + 1) % 4;
    }
    // 计算 phase：去程 0→1，书店停留=1，回程 1→0，水晶城停留=0
    st.phase =
      st.seg === 0 ? st.u :
      st.seg === 1 ? 1 :
      st.seg === 2 ? 1 - st.u :
      0;
    const phase = st.phase;
    const moving = st.seg === 0 || st.seg === 2;

    // 球面方向 slerp 插值
    const dir = p.dirA.clone().normalize().lerp(p.dirB.clone().normalize(), phase).normalize();
    // 成员位置最初保存为世界坐标；巡航时只把整队平移本帧中心位移，避免 squad 再次叠加位移。
    const center = dir.clone().multiplyScalar(p.R + p.height);
    const previousCenter = aircraft.userData._patrolCenter || center.clone();
    const delta = center.clone().sub(previousCenter);
    if (delta.lengthSq() > 1e-10) {
      for (const member of aircraft.userData.members || []) member.position.add(delta);
    }
    previousCenter.copy(center);
    aircraft.userData._patrolCenter = previousCenter;

    // 机头朝运动切向（停留时沿用上一帧切线），局部 +Y 对齐球面法线。
    const dirNext = p.dirA.clone().normalize().lerp(p.dirB.clone().normalize(), Math.min(1, phase + (moving ? 0.01 : 0))).normalize();
    const tangent = moving
      ? dirNext.clone().sub(dir).normalize()
      : (aircraft.userData._prevTangent || new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize());
    for (const member of aircraft.userData.members || []) {
      orientAircraftToDir(member, dir, tangent);
      member.rotateY(member.userData.formationHeading || 0);
    }

    // -------- 飞行姿态：banking(滚转) + pitch(俯仰) --------
    // 1) 转向率 → banking：比较当前切向与上一帧切向的夹角，转弯压坡度
    let bank = 0;
    const prevTan = aircraft.userData._prevTangent;
    if (prevTan && moving) {
      const turn = tangent.clone().sub(prevTan).length(); // 切向变化量 ≈ 转向率
      bank = THREE.MathUtils.clamp(turn * 26, -0.6, 0.6);
      // 去程/回程压坡方向相反
      bank *= st.seg === 2 ? -1 : 1;
    }
    aircraft.userData._prevTangent = tangent.clone();

    // 2) 俯仰：接近站点(phase≈0/1)抬头，中点压低，模拟掠过球面起伏
    const pitch = Math.sin(phase * Math.PI) * 0.18;

    // 在每架机的基础朝向上叠加局部滚转与俯仰。
    const qBank = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bank);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch);
    for (const member of aircraft.userData.members || []) {
      member.quaternion.multiply(qPitch).multiply(qBank);
    }
  } else if (aircraft.userData.centerDir) {
    // 无航线：绕母晶塔法线缓慢自旋
    const d = aircraft.userData.centerDir;
    const spinQ = new THREE.Quaternion().setFromAxisAngle(d, aircraft.userData.spin * 0.016);
    aircraft.quaternion.premultiply(spinQ);
  }

  // 体积：开发者可调倍数（默认 1.25，与飞艇同体量），每帧应用以响应菜单实时改动。
  // localStorage 或开发者菜单中的 0/负值不能让整个编队缩成不可见。
  const sc = Number.isFinite(P.aircraftScale) && P.aircraftScale > 0
    ? P.aircraftScale
    : P_DEFAULTS.aircraftScale;
  aircraft.scale.setScalar(sc);

  const pulse = 0.8 + Math.sin(t * 14) * 0.25;
  if (aircraft.userData.flames) {
    for (const f of aircraft.userData.flames) f.scale.set(1, pulse, 1);
  }
  // 内核发光脉动（仅调 emissiveIntensity，不改 opacity，避免半透明内核）
  if (aircraft.userData.thrusters) {
    const glow = 1.6 + Math.sin(t * 10) * 0.5;
    for (const c of aircraft.userData.thrusters) {
      if (c.material.emissiveIntensity !== undefined) c.material.emissiveIntensity = glow;
    }
  }
  // 驾驶舱青柠核心 + 加色光晕 + 点光源同步脉动，整体亮度更高更醒目。
  // updateAircraftHover 始终作用于整支 squad，因此优先用聚合数组驱动全队每架机；
  // 兼容单机对象（无聚合数组时）直接使用其自身驾驶舱件。
  const cockpitPulse = 0.85 + Math.sin(t * 8) * 0.15;
  const cores = aircraft.userData.cockpitCores || (aircraft.userData.cockpitCore ? [aircraft.userData.cockpitCore] : []);
  const glows = aircraft.userData.cockpitGlows || (aircraft.userData.cockpitGlow ? [aircraft.userData.cockpitGlow] : []);
  const lights = aircraft.userData.cockpitLights || (aircraft.userData.cockpitLight ? [aircraft.userData.cockpitLight] : []);
  for (const core of cores) core.scale.setScalar(0.95 + cockpitPulse * 0.15);
  for (const glow of glows) {
    glow.material.opacity = 0.45 + cockpitPulse * 0.3;
    glow.scale.setScalar(0.85 + cockpitPulse * 0.35);
  }
  for (const light of lights) light.intensity = 4.5 + cockpitPulse * 2.2;
}

/** 让飞行器机身 +Z 朝给定切向 tangent、局部 +Y 对齐球面法线 dir */
function orientAircraftToDir(aircraft, d, tangentHint = null) {
  const up = d.clone();
  let tangent = tangentHint ? tangentHint.clone() : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), up);
  if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
  tangent.normalize();
  const side = new THREE.Vector3().crossVectors(up, tangent).normalize();
  const m = new THREE.Matrix4().makeBasis(tangent, up, side);
  aircraft.quaternion.setFromRotationMatrix(m);
}
