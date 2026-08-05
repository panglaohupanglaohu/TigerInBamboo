// =====================================================================
//  墨比斯气泡座舱飞行器
//  球形透明泡泡 + 紫蓝色下半舱 + 米金赤道环 + 单人驾驶舱
// =====================================================================
import * as THREE from "three";

const _worldQuat = new THREE.Quaternion();
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _front = new THREE.Vector3();
const _base = new THREE.Vector3();
const _orientation = new THREE.Matrix4();
const _orbitTangent = new THREE.Vector3();
const _orbitSide = new THREE.Vector3();

function standardMaterial(options, flatShading = false) {
  const mat = new THREE.MeshStandardMaterial(options);
  if (flatShading) {
    mat.flatShading = true;
    mat.needsUpdate = true;
  }
  return mat;
}

function addMesh(group, geometry, material, name, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
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

  // ---------- 透明球形泡泡外罩 ----------
  const bubble = addMesh(
    group,
    new THREE.SphereGeometry(2.7, 48, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0x9edcff,
      transparent: true,
      opacity: 0.25,
      transmission: 0.9,
      roughness: 0.05,
      metalness: 0.1,
      ior: 1.45,
      thickness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    "bubble-shell",
    false
  );
  bubble.renderOrder = 10;

  // 玻璃高光弧线与顶部亮环
  const highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const highlightRing = addMesh(
    group,
    new THREE.TorusGeometry(2.71, 0.025, 8, 72),
    highlightMaterial,
    "bubble-highlight-ring",
    false
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
    arc.getPoints(32).map((p) => new THREE.Vector3(p.x, p.y, 2.53))
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
    new THREE.SphereGeometry(2.5, 36, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    standardMaterial(
      {
        color: 0x625792,
        roughness: 0.8,
        metalness: 0.05,
        side: THREE.DoubleSide,
      },
      true
    ),
    "purple-lower-cabin"
  );
  base.position.y = -0.08;

  // ---------- 赤道环 ----------
  const equatorialRing = addMesh(
    group,
    new THREE.TorusGeometry(2.72, 0.105, 10, 80),
    standardMaterial({ color: 0xf8f3d4, roughness: 0.62, metalness: 0.12 }),
    "equatorial-ring"
  );
  equatorialRing.rotation.x = Math.PI / 2;

  const bottomRing = addMesh(
    group,
    new THREE.TorusGeometry(1.72, 0.05, 8, 56),
    standardMaterial({ color: 0xf8f3d4, roughness: 0.58, metalness: 0.12 }),
    "bottom-ring"
  );
  bottomRing.rotation.x = Math.PI / 2;
  bottomRing.position.y = -2.45;

  // ---------- 驾驶座 ----------
  const seatMaterial = standardMaterial(
    { color: 0xc85f76, roughness: 0.78, metalness: 0.02 },
    true
  );
  addMesh(
    group,
    new THREE.BoxGeometry(0.9, 0.18, 0.78),
    seatMaterial,
    "pilot-seat-base"
  ).position.set(0, -1.55, -0.42);
  const seatBack = addMesh(
    group,
    new THREE.BoxGeometry(0.9, 1.15, 0.18),
    seatMaterial,
    "pilot-seat-back"
  );
  seatBack.position.set(0, -1.05, -0.78);
  seatBack.rotation.x = THREE.MathUtils.degToRad(-8);

  // ---------- 灰白控制台与双操纵杆 ----------
  const consoleMaterial = standardMaterial(
    { color: 0xd9dde3, roughness: 0.58, metalness: 0.18 },
    true
  );
  const console = addMesh(
    group,
    new THREE.BoxGeometry(1.3, 0.32, 0.56),
    consoleMaterial,
    "cockpit-console"
  );
  console.position.set(0, -0.95, 0.72);
  console.rotation.x = THREE.MathUtils.degToRad(-12);

  const panel = addMesh(
    group,
    new THREE.BoxGeometry(0.5, 0.018, 0.13),
    new THREE.MeshBasicMaterial({ color: accent }),
    "cockpit-panel",
    false
  );
  panel.position.set(0, -0.72, 0.59);
  panel.rotation.x = THREE.MathUtils.degToRad(-12);

  const handleMaterial = standardMaterial({
    color: 0xc3cad1,
    roughness: 0.45,
    metalness: 0.35,
  });
  const gripMaterial = standardMaterial({
    color: 0xff807d,
    roughness: 0.5,
    metalness: 0.1,
  });
  for (const side of [-1, 1]) {
    const handle = addMesh(
      group,
      new THREE.CylinderGeometry(0.055, 0.08, 0.48, 10),
      handleMaterial,
      `control-stick-${side}`
    );
    handle.position.set(side * 0.38, -0.52, 0.75);
    handle.rotation.z = side * THREE.MathUtils.degToRad(12);

    const grip = addMesh(
      group,
      new THREE.SphereGeometry(0.1, 12, 8),
      gripMaterial,
      `control-grip-${side}`
    );
    grip.position.set(side * 0.43, -0.27, 0.75);
  }

  // ---------- 简化飞行员 ----------
  const uniformMaterial = standardMaterial({ color: 0x4775ba, roughness: 0.82 }, true);
  const helmetMaterial = standardMaterial(
    { color: 0xd94d62, roughness: 0.48, metalness: 0.16 },
    true
  );
  const pilotBody = addMesh(
    group,
    new THREE.CylinderGeometry(0.32, 0.4, 0.82, 12),
    uniformMaterial,
    "pilot-body"
  );
  pilotBody.position.set(0, -0.9, -0.18);
  const pilotHead = addMesh(
    group,
    new THREE.SphereGeometry(0.3, 18, 12),
    helmetMaterial,
    "pilot-helmet"
  );
  pilotHead.position.set(0, -0.23, -0.16);

  const visor = addMesh(
    group,
    new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x7ee5ff,
      transparent: true,
      opacity: 0.72,
      roughness: 0.08,
      metalness: 0.2,
      side: THREE.DoubleSide,
    }),
    "pilot-visor",
    false
  );
  visor.position.set(0, -0.2, 0.08);
  visor.rotation.x = Math.PI;

  // 座舱内部青绿色补光
  const interiorLight = new THREE.PointLight(accent, 1.7, 5, 2);
  interiorLight.name = "bubble-interior-light";
  interiorLight.position.set(0, -0.35, 0.5);
  group.add(interiorLight);

  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.name = "cockpit-anchor";
  cockpitAnchor.position.set(0, 0.1, 2.15);
  group.add(cockpitAnchor);

  group.userData.kind = "moebius-bubble-pod";
  group.userData.cockpitAnchor = cockpitAnchor;
  group.userData.basePosition = new THREE.Vector3();
  group.userData.hoverPhase = 0;
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

/** 更新 3 艘气泡飞艇围绕 3 座花厅建筑的巡游。 */
export function updateBubblePodPatrol(fleet, t) {
  if (!fleet) return;
  fleet.traverse((pod) => {
    if (pod.userData?.kind !== "moebius-bubble-pod") return;
    applyBubblePodOrbitPose(pod, t);
    pod.rotateY(Math.sin(t * 0.35 + (pod.userData.hoverPhase || 0)) * 0.12);
  });
}
