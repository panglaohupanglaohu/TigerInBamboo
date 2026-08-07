// =====================================================================
//  墨比斯气泡座舱飞行器
//  球形卡通水晶泡泡 + 紫蓝色下半舱 + 米金赤道环 + 单人驾驶舱
//
//  材质策略（无头 SwiftShader 硬性约束）：
//  - 彻底废除 MeshPhysicalMaterial / transmission 物理透射
//  - 全件 MeshToonMaterial + 3 阶硬边 gradientMap + flatShading
//  - 玻璃罩半透明仅用 opacity（底层 alpha，不触发屏幕空间回读）
//  - 主体网格 addOutline 唐伯虎水墨细描边 + castShadow
// =====================================================================
import * as THREE from "three";
import { addOutline } from "./toon.js";
import { facet } from "./lowPoly.js";

const _worldQuat = new THREE.Quaternion();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _front = new THREE.Vector3();
const _base = new THREE.Vector3();
const _orientation = new THREE.Matrix4();
const _orbitTangent = new THREE.Vector3();
const _orbitSide = new THREE.Vector3();

/* ---------------- 3 阶硬边缘 Toon 渐变贴图（纯代码生成） ----------------
 * 三阶灰度阶梯 [0, 127, 255]：暗部 / 中间调 / 亮部，
 * Nearest 采样锁死边缘 → 干净二次元色块切面。
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
 * 卡通水晶材质（MeshToonMaterial · 3 阶渐变 + 分面着色）。
 * 废除物理玻璃 transmission，改用基础 opacity 半透明。
 * flatShading 须构造后赋值（构造参数会触发 setValues 告警）。
 * @param {number|string|THREE.Color} color
 * @param {object} [opts]
 */
function crystalToon(color, opts = {}) {
  const material = new THREE.MeshToonMaterial({
    color: color instanceof THREE.Color ? color : new THREE.Color(color),
    gradientMap: _gradient3,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
  material.flatShading = true;
  material.needsUpdate = true;
  return material;
}

/**
 * 描边件工厂：可选 facet 扁平分面 + castShadow + addOutline。
 * @param {THREE.Group} group
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {string} name
 * @param {{ castShadow?: boolean, outline?: number|false, doFacet?: boolean }} [opts]
 */
function addMesh(group, geometry, material, name, opts = {}) {
  const castShadow = opts.castShadow !== false;
  const doFacet = opts.doFacet !== false;
  const geo = doFacet ? facet(geometry) : geometry;
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  if (opts.outline !== false) {
    addOutline(mesh, opts.outline ?? 0.04);
  }
  group.add(mesh);
  return mesh;
}

/**
 * 创建单人墨比斯气泡座舱。
 * @param {{scale?: number, accent?: number}} [opts]
 * @returns {THREE.Group}
 */
export function createBubblePod(opts = {}) {
  const scale = opts.scale ?? 0.72;
  const accent = opts.accent ?? 0x8effd8;
  const group = new THREE.Group();
  group.name = "moebius-bubble-pod";
  group.scale.setScalar(scale);

  // ---------- 卡通水晶球形泡泡外罩（废除物理透射） ----------
  // 低多边形 12×10 + flatShading → 莫比斯多面体硬边；opacity 半透明无 transmission
  const bubble = addMesh(
    group,
    new THREE.SphereGeometry(2.7, 12, 10),
    crystalToon(0x9edcff, {
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: 0x4aa8d8,
      emissiveIntensity: 0.12,
    }),
    "bubble-shell",
    { castShadow: true, outline: 0.04 }
  );
  bubble.renderOrder = 10;

  // 玻璃高光弧线与顶部亮环（Basic 不参与光照，仅装饰描边感）
  const highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const highlightRing = addMesh(
    group,
    new THREE.TorusGeometry(2.71, 0.025, 6, 24),
    highlightMaterial,
    "bubble-highlight-ring",
    { castShadow: false, outline: false, doFacet: false }
  );
  highlightRing.rotation.x = Math.PI / 2;
  highlightRing.position.y = 0.72;
  highlightRing.renderOrder = 12;

  const arc = new THREE.EllipseCurve(
    0,
    0,
    2.45,
    2.45,
    THREE.MathUtils.degToRad(125),
    THREE.MathUtils.degToRad(235),
    false,
    0
  );
  const arcGeometry = new THREE.BufferGeometry().setFromPoints(
    arc.getPoints(24).map((p) => new THREE.Vector3(p.x, p.y, 2.53))
  );
  const arcLine = new THREE.Line(arcGeometry, highlightMaterial);
  arcLine.name = "bubble-highlight-arc";
  arcLine.rotation.x = THREE.MathUtils.degToRad(-18);
  arcLine.rotation.z = THREE.MathUtils.degToRad(18);
  arcLine.renderOrder = 13;
  group.add(arcLine);

  // ---------- 紫蓝色下半部底座 ----------
  const base = addMesh(
    group,
    new THREE.SphereGeometry(2.5, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    crystalToon(0x625792, { transparent: false, side: THREE.DoubleSide }),
    "purple-lower-cabin",
    { outline: 0.04 }
  );
  base.position.y = -0.08;

  // ---------- 赤道环 ----------
  const equatorialRing = addMesh(
    group,
    new THREE.TorusGeometry(2.72, 0.105, 8, 28),
    crystalToon(0xf8f3d4, {
      transparent: false,
      emissive: 0xf8f3d4,
      emissiveIntensity: 0.08,
    }),
    "equatorial-ring",
    { outline: 0.03 }
  );
  equatorialRing.rotation.x = Math.PI / 2;

  const bottomRing = addMesh(
    group,
    new THREE.TorusGeometry(1.72, 0.05, 6, 20),
    crystalToon(0xf8f3d4, { transparent: false }),
    "bottom-ring",
    { outline: 0.02 }
  );
  bottomRing.rotation.x = Math.PI / 2;
  bottomRing.position.y = -2.45;

  // ---------- 驾驶座（略抬高，配合驾驶员视线） ----------
  const seatMaterial = crystalToon(0xc85f76, { transparent: false });
  addMesh(group, new THREE.BoxGeometry(0.9, 0.18, 0.78), seatMaterial, "pilot-seat-base", {
    outline: 0.02,
  }).position.set(0, -1.35, -0.42);
  const seatBack = addMesh(
    group,
    new THREE.BoxGeometry(0.9, 1.15, 0.18),
    seatMaterial,
    "pilot-seat-back",
    { outline: 0.02 }
  );
  seatBack.position.set(0, -0.85, -0.78);
  seatBack.rotation.x = THREE.MathUtils.degToRad(-8);

  // ---------- 灰白控制台与双操纵杆 ----------
  const consoleMaterial = crystalToon(0xd9dde3, { transparent: false });
  const console = addMesh(
    group,
    new THREE.BoxGeometry(1.3, 0.32, 0.56),
    consoleMaterial,
    "cockpit-console",
    { outline: 0.02 }
  );
  console.position.set(0, -0.75, 0.72);
  console.rotation.x = THREE.MathUtils.degToRad(-12);

  const panel = addMesh(
    group,
    new THREE.BoxGeometry(0.5, 0.018, 0.13),
    new THREE.MeshBasicMaterial({ color: accent }),
    "cockpit-panel",
    { castShadow: false, outline: false, doFacet: false }
  );
  panel.position.set(0, -0.52, 0.59);
  panel.rotation.x = THREE.MathUtils.degToRad(-12);

  const handleMaterial = crystalToon(0xc3cad1, { transparent: false });
  const gripMaterial = crystalToon(0xff807d, { transparent: false });
  for (const side of [-1, 1]) {
    const handle = addMesh(
      group,
      new THREE.CylinderGeometry(0.055, 0.08, 0.48, 8),
      handleMaterial,
      `control-stick-${side}`,
      { outline: 0.012 }
    );
    handle.position.set(side * 0.38, -0.32, 0.75);
    handle.rotation.z = side * THREE.MathUtils.degToRad(12);

    const grip = addMesh(
      group,
      new THREE.SphereGeometry(0.1, 8, 6),
      gripMaterial,
      `control-grip-${side}`,
      { outline: 0.01 }
    );
    grip.position.set(side * 0.43, -0.07, 0.75);
  }

  // ---------- 简化飞行员（头部抬高，便于透过泡罩看向窗外） ----------
  // 原头部位于 y≈-0.23，视线被下半舱与控制台遮挡；整体上抬约 0.45，
  // 使头盔接近赤道环高度，从座舱内能清楚看到窗外巡游景色。
  const uniformMaterial = crystalToon(0x4775ba, { transparent: false });
  const helmetMaterial = crystalToon(0xd94d62, {
    transparent: false,
    emissive: 0xd94d62,
    emissiveIntensity: 0.1,
  });
  const pilotBody = addMesh(
    group,
    new THREE.CylinderGeometry(0.32, 0.4, 0.82, 10),
    uniformMaterial,
    "pilot-body",
    { outline: 0.025 }
  );
  pilotBody.position.set(0, -0.55, -0.18);

  const pilotHead = addMesh(
    group,
    new THREE.SphereGeometry(0.3, 10, 8),
    helmetMaterial,
    "pilot-helmet",
    { outline: 0.025 }
  );
  // 头部中心抬至 y≈0.22（原 -0.23），约升高 0.45，越过控制台顶沿
  pilotHead.position.set(0, 0.22, -0.16);

  const visor = addMesh(
    group,
    new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI, 0, Math.PI / 2),
    crystalToon(0x7ee5ff, {
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: 0x3ec8e8,
      emissiveIntensity: 0.2,
    }),
    "pilot-visor",
    { castShadow: false, outline: 0.012 }
  );
  visor.position.set(0, 0.25, 0.08);
  visor.rotation.x = Math.PI;

  // 座舱内部青绿色补光
  const interiorLight = new THREE.PointLight(accent, 1.7, 5, 2);
  interiorLight.name = "bubble-interior-light";
  interiorLight.position.set(0, -0.15, 0.5);
  group.add(interiorLight);

  // 驾驶相机锚点：略抬高，与飞行员视线对齐
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.name = "cockpit-anchor";
  cockpitAnchor.position.set(0, 0.35, 2.15);
  group.add(cockpitAnchor);

  // 炮口：泡泡前缘，气泡弹从此射出
  const muzzle = new THREE.Object3D();
  muzzle.name = "bubble-muzzle";
  muzzle.position.set(0, 0.15, 2.55);
  group.add(muzzle);

  group.userData.kind = "moebius-bubble-pod";
  group.userData.cockpitAnchor = cockpitAnchor;
  group.userData.muzzle = muzzle;
  group.userData.accentColor = accent;
  group.userData.basePosition = new THREE.Vector3();
  group.userData.hoverPhase = 0;
  group.userData.piloted = false; // 玩家驾驶时暂停花厅巡游
  return group;
}

/**
 * 让气泡飞艇分别围绕含花厅的水晶建筑巡游。
 * @param {THREE.Scene} scene
 * @param {{group: THREE.Object3D, r?: number}[]} buildings 水晶城建筑记录
 * @param {{count?: number, orbitRadius?: number}} [opts]
 * @returns {THREE.Group}
 */
export function createBubblePodsAroundFlowerBuildings(scene, buildings, opts = {}) {
  const targets = (Array.isArray(buildings) ? buildings : []).filter(
    (building) => building?.group?.userData?.bioLayers?.length
  );
  const count = Math.min(opts.count ?? 3, targets.length);
  const fleet = new THREE.Group();
  fleet.name = "flower-hall-bubble-patrol";

  const accents = [0x8effd8, 0xffd98e, 0xffa8d9];
  for (let i = 0; i < count; i++) {
    const target = targets[i];
    const towerGroup = target.group;
    const primaryHall = towerGroup.userData.bioLayers[0].hall;
    const center = primaryHall.getWorldPosition(new THREE.Vector3());

    towerGroup.getWorldQuaternion(_worldQuat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(_worldQuat).normalize();
    const orbitRight = new THREE.Vector3(1, 0, 0).applyQuaternion(_worldQuat).normalize();
    const orbitFront = new THREE.Vector3(0, 0, 1).applyQuaternion(_worldQuat).normalize();
    const radius = opts.orbitRadius ?? Math.max(2.8, Math.min(5.2, (target.r || 3) * 0.65));
    const altitude = 2.8 + (i % 2) * 0.7;
    const phase = (i / count) * Math.PI * 2;

    const pod = createBubblePod({ scale: 0.72, accent: accents[i % accents.length] });
    pod.userData.orbit = {
      center,
      up,
      right: orbitRight,
      front: orbitFront,
      radius,
      altitude,
      phase,
      speed: 0.22 + i * 0.025,
    };
    pod.userData.hoverPhase = phase;
    pod.userData.anchorDirection = up.clone();
    applyBubblePodOrbitPose(pod, 0);
    fleet.add(pod);
  }

  fleet.userData.kind = "flower-hall-bubble-patrol";
  fleet.userData.count = count;
  scene.add(fleet);
  return fleet;
}

function applyBubblePodOrbitPose(pod, t) {
  const orbit = pod.userData.orbit;
  if (!orbit) return;

  const angle = orbit.phase + t * orbit.speed;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  _base
    .copy(orbit.center)
    .addScaledVector(orbit.right, cos * orbit.radius)
    .addScaledVector(orbit.front, sin * orbit.radius)
    .addScaledVector(orbit.up, orbit.altitude + Math.sin(t * 1.15 + orbit.phase) * 0.22);
  pod.position.copy(_base);

  // 局部 +Y 朝星球外法线；局部 -Y 的小环因此始终朝向建筑/星球内侧。
  _orbitTangent
    .copy(orbit.right)
    .multiplyScalar(-sin)
    .addScaledVector(orbit.front, cos)
    .normalize();
  _orbitSide.crossVectors(orbit.up, _orbitTangent).normalize();
  _orientation.makeBasis(_orbitSide, orbit.up, _orbitTangent);
  pod.quaternion.setFromRotationMatrix(_orientation);
  pod.rotateZ(Math.sin(t * 0.8 + orbit.phase) * 0.025);
}

/** 更新 3 艘气泡飞艇围绕 3 座花厅建筑的巡游（被驾驶的不跟巡游）。 */
export function updateBubblePodPatrol(fleet, t) {
  if (!fleet) return;
  fleet.traverse((pod) => {
    if (pod.userData?.kind !== "moebius-bubble-pod") return;
    if (pod.userData.piloted) {
      // 驾驶中：原地轻微漂浮
      const bob = Math.sin(t * 1.4 + (pod.userData.hoverPhase || 0)) * 0.06;
      if (pod.userData._pilotBase) {
        _up.copy(pod.userData._pilotBase).normalize();
        pod.position.copy(pod.userData._pilotBase).addScaledVector(_up, bob);
      }
      return;
    }
    applyBubblePodOrbitPose(pod, t);
    pod.rotateY(Math.sin(t * 0.35 + (pod.userData.hoverPhase || 0)) * 0.12);
  });
}

// ---------- 气泡弹（半透明卡通泡泡弹，沿瞄准方向飞行） ----------
const _bbUp = new THREE.Vector3();
const BUBBLE_SHOT_SPEED = 32;
const BUBBLE_SHOT_LIFE = 2.8;
const BUBBLE_SHOT_GRAVITY = 3.5; // 轻微朝球心下坠，弧线更有泡感

/**
 * 创建一枚气泡弹（MeshToonMaterial，无物理透射）
 * @param {THREE.Scene} scene
 * @param {THREE.Vector3} origin
 * @param {THREE.Vector3} dir 单位方向
 * @param {number} [accent=0x8effd8]
 */
export function createBubbleShot(scene, origin, dir, accent = 0x8effd8) {
  const group = new THREE.Group();
  group.name = "bubble-shot";
  group.position.copy(origin);

  const shell = new THREE.Mesh(
    facet(new THREE.SphereGeometry(0.38, 10, 8)),
    crystalToon(accent, {
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      emissive: accent,
      emissiveIntensity: 0.25,
    })
  );
  shell.castShadow = false;
  shell.renderOrder = 20;
  addOutline(shell, 0.02);
  group.add(shell);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })
  );
  group.add(core);

  // 拖尾小泡
  const trail = [];
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 - i * 0.015, 6, 5),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.35 - i * 0.06,
        depthWrite: false,
      })
    );
    p.position.set(0, 0, -0.25 - i * 0.22);
    group.add(p);
    trail.push(p);
  }

  if (scene) scene.add(group);

  const vel = dir.clone().normalize().multiplyScalar(BUBBLE_SHOT_SPEED);
  return {
    group,
    shell,
    core,
    trail,
    vel,
    age: 0,
    life: BUBBLE_SHOT_LIFE,
    dead: false,
    accent,
  };
}

/**
 * 推进气泡弹；触地或超时则破灭
 * @returns {boolean} 是否仍存活
 */
export function updateBubbleShot(shot, dt, planetRadius = 40) {
  if (!shot || shot.dead) return false;
  shot.age += dt;
  if (shot.age >= shot.life) {
    disposeBubbleShot(shot);
    return false;
  }

  // 轻微朝球心下坠
  _bbUp.copy(shot.group.position).normalize();
  shot.vel.addScaledVector(_bbUp, -BUBBLE_SHOT_GRAVITY * dt);
  shot.group.position.addScaledVector(shot.vel, dt);

  // 朝飞行方向
  if (shot.vel.lengthSq() > 1e-6) {
    const fwd = shot.vel.clone().normalize();
    const up = _bbUp;
    const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
    if (side.lengthSq() > 1e-6) {
      const realUp = new THREE.Vector3().crossVectors(fwd, side).normalize();
      const m = new THREE.Matrix4().makeBasis(side, realUp, fwd);
      shot.group.quaternion.setFromRotationMatrix(m);
    }
  }

  // 脉动
  const pulse = 1 + Math.sin(shot.age * 14) * 0.08;
  shot.shell.scale.setScalar(pulse);
  const fade = 1 - shot.age / shot.life;
  if (shot.shell.material) shot.shell.material.opacity = 0.25 + fade * 0.35;
  if (shot.core.material) shot.core.material.opacity = 0.35 + fade * 0.4;

  // 触地
  const r = shot.group.position.length();
  if (r <= planetRadius + 0.6) {
    disposeBubbleShot(shot, true);
    return false;
  }
  return true;
}

/** 破灭并清理 */
export function disposeBubbleShot(shot, pop = false) {
  if (!shot || shot.dead) return;
  shot.dead = true;
  if (pop && shot.group?.parent) {
    // 简易破泡：瞬间放大淡出由调用方可选；此处直接移除
  }
  if (shot.group?.parent) shot.group.parent.remove(shot.group);
  shot.group?.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

/**
 * 从舰队中取最近的气泡艇
 * @param {THREE.Object3D} fleet
 * @param {THREE.Vector3} worldPos
 * @param {number} [maxDist=5]
 */
export function findNearestBubblePod(fleet, worldPos, maxDist = 5) {
  if (!fleet || !worldPos) return null;
  let best = null;
  let bestD = maxDist * maxDist;
  const _p = new THREE.Vector3();
  fleet.traverse((o) => {
    if (o.userData?.kind !== "moebius-bubble-pod") return;
    o.getWorldPosition(_p);
    const d = _p.distanceToSquared(worldPos);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  });
  return best;
}
