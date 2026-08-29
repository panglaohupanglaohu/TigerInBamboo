// ============================================================================
// 三重门小型侦察飞行器
// 参考：用户提供的浅蓝色短翼飞行器概念图，并加入零式战机式的
// 低翼、长机身、座舱、尾翼与机头螺旋桨轮廓。
// - 低模、浅蓝硬壳、奶白鼻锥、黄色识别条
// - 半透明泡形座舱，但不使用 transmission，兼容移动端/SwiftShader
// - 局部 +Z 是机头，挂载时局部 +Y 对齐球面外法线
// ============================================================================

import * as THREE from "three";
import { facet } from "../../assets/lowPoly.js";
import { addOutline, toonMat } from "../../assets/toon.js";
import { computeTripleGateScoutPlacement } from "./tripleGateScoutPlacement.js";

function mesh(geometry, material, outline = 0.018) {
  const result = new THREE.Mesh(facet(geometry), material);
  result.castShadow = true;
  result.receiveShadow = true;
  if (outline > 0) addOutline(result, outline);
  return result;
}

function extrudedWing(side = 1, material = null) {
  const shape = new THREE.Shape();
  // x = 横向展开，y = 机身前后；负 y 是向尾部后掠。
  shape.moveTo(0.18, 1.05);
  shape.lineTo(3.0, 0.25);
  shape.lineTo(2.25, -1.05);
  shape.lineTo(0.32, -0.48);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, -0.07);
  geometry.rotateX(-Math.PI / 2);
  if (side < 0) geometry.scale(-1, 1, 1);
  return mesh(geometry, material, 0.014);
}

function makeNavigationLight(color, position) {
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 8, 6),
    new THREE.MeshBasicMaterial({ color }),
  );
  light.position.copy(position);
  light.renderOrder = 12;
  return light;
}

export function createTripleGateScoutAircraft({ scale = 1 } = {}) {
  const root = new THREE.Group();
  root.name = "triple-gate-scout-aircraft";

  const blue = toonMat(0x82c7dc, { flatShading: true });
  const blueDark = toonMat(0x4b93ad, { flatShading: true });
  const cream = toonMat(0xe8e2d3, { flatShading: true });
  const dark = toonMat(0x26343f, { flatShading: true });
  const yellow = toonMat(0xf0b84a, { flatShading: true });

  // 主机身：收窄的长机身 + 扁平腹舱，比例接近二战单发战斗机。
  const shoulder = mesh(new THREE.SphereGeometry(1, 12, 7), blue, 0.022);
  shoulder.scale.set(0.76, 0.62, 2.72);
  shoulder.position.z = -0.05;
  root.add(shoulder);

  const belly = mesh(new THREE.BoxGeometry(1.18, 0.42, 3.85), blueDark, 0.02);
  belly.position.y = -0.28;
  belly.position.z = -0.05;
  root.add(belly);

  const nose = mesh(new THREE.ConeGeometry(0.68, 1.5, 8), cream, 0.018);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 2.25;
  root.add(nose);

  const noseBand = mesh(new THREE.TorusGeometry(0.57, 0.045, 6, 12), dark, 0.012);
  noseBand.rotation.y = Math.PI / 2;
  noseBand.position.z = 1.92;
  root.add(noseBand);

  // 泡形座舱：上半球 + 暗色底框，既透出驾驶舱又不会整艘机体消失。
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
    toonMat(0xaedfec, {
      flatShading: true,
      emissive: 0x1b5267,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  canopy.name = "triple-gate-scout-canopy";
  canopy.position.set(0, 0.48, 0.72);
  canopy.renderOrder = 8;
  root.add(canopy);
  const canopyFrame = mesh(new THREE.TorusGeometry(0.72, 0.055, 6, 14), dark, 0.012);
  canopyFrame.rotation.x = Math.PI / 2;
  canopyFrame.position.set(0, 0.2, 0.72);
  root.add(canopyFrame);

  // 宽大的低翼与尾翼：轮廓参考零式的低翼单发战斗机布局。
  const wing = toonMat(0x9fd7e3, { flatShading: true });
  for (const side of [-1, 1]) {
    const part = extrudedWing(side, wing);
    part.position.y = -0.05;
    root.add(part);
    const tip = mesh(new THREE.BoxGeometry(0.18, 0.12, 0.65), yellow, 0.01);
    tip.position.set(side * 2.5, -0.02, -0.35);
    tip.rotation.y = side * 0.18;
    root.add(tip);
  }

  const tailWing = toonMat(0x6faec3, { flatShading: true });
  for (const side of [-1, 1]) {
    const tail = mesh(new THREE.BoxGeometry(0.95, 0.1, 0.55), tailWing, 0.012);
    tail.position.set(side * 0.65, 0.06, -2.1);
    tail.rotation.y = side * 0.22;
    root.add(tail);
  }
  const fin = mesh(new THREE.BoxGeometry(0.12, 0.8, 1.0), blue, 0.014);
  fin.position.set(0, 0.42, -1.72);
  fin.rotation.x = -0.22;
  root.add(fin);

  // 机头整流罩（主人验收 2026-08-28：去掉螺旋桨——本机是喷气式，
  // 尾部已有三喷口+尾焰；前端螺旋桨在拦截俯冲时视觉穿帮）。保留
  // propeller 组与引用，避免驾驶/防卫队兼容链断裂，但组内不再有桨叶。
  const propeller = new THREE.Group();
  propeller.name = "triple-gate-scout-propeller";
  propeller.position.set(0, 0, 3.02);
  const spinner = mesh(new THREE.ConeGeometry(0.3, 1.05, 14), cream, 0.01);
  spinner.rotation.x = Math.PI / 2; // 尖朝 +Z（喷气整流锥）
  spinner.position.z = 0.42;
  propeller.add(spinner);
  root.add(propeller);

  // 两挺机炮，枪口锚点由防卫队用来生成成对曳光弹与枪口闪光。
  const gunMuzzles = [];
  for (const side of [-1, 1]) {
    const barrel = mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.82, 8), dark, 0.008);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(side * 0.7, -0.16, 1.18);
    root.add(barrel);
    const muzzle = new THREE.Object3D();
    muzzle.name = `triple-gate-scout-cannon-muzzle-${side < 0 ? "left" : "right"}`;
    muzzle.position.set(side * 0.7, -0.16, 1.6);
    root.add(muzzle);
    gunMuzzles.push(muzzle);
  }

  // 机身上的黄色维护条和两侧进气口，让大轮廓不会变成纯色胶囊。
  const stripe = mesh(new THREE.BoxGeometry(0.1, 0.12, 1.65), yellow, 0.01);
  stripe.position.set(0.73, -0.02, -0.3);
  stripe.rotation.y = -0.2;
  root.add(stripe);
  for (const side of [-1, 1]) {
    const vent = mesh(new THREE.BoxGeometry(0.08, 0.2, 0.45), dark, 0.008);
    vent.position.set(side * 0.86, 0.02, -0.72);
    vent.rotation.y = side * 0.25;
    root.add(vent);
  }

  const leftNav = makeNavigationLight(0x67e6ff, new THREE.Vector3(-0.94, 0.02, -0.2));
  const rightNav = makeNavigationLight(0xffc44d, new THREE.Vector3(0.94, 0.02, -0.2));
  const beacon = makeNavigationLight(0xff8b3d, new THREE.Vector3(0, 0.18, -1.65));
  root.add(leftNav, rightNav, beacon);
  const beaconLight = new THREE.PointLight(0xff9a43, 0.65, 5, 2);
  beaconLight.position.copy(beacon.position);
  root.add(beaconLight);

  // 驾驶员眼位：F 驾驶时由 scoutAircraftRide 接管相机。
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.name = "triple-gate-scout-cockpit-anchor";
  cockpitAnchor.position.set(0, 0.48, 0.72);
  root.add(cockpitAnchor);

  root.scale.setScalar(Math.max(0.1, Number.isFinite(scale) ? scale : 1));
  root.userData.kind = "triple-gate-scout-aircraft";
  root.userData.modelVersion = "triple-gate-scout-aircraft-v1";
  root.userData.forwardLocal = [0, 0, 1];
  root.userData.canopy = canopy;
  root.userData.cockpitAnchor = cockpitAnchor;
  root.userData.navigationLights = [leftNav, rightNav, beacon];
  root.userData.beaconLight = beaconLight;
  root.userData.propeller = propeller;
  root.userData.gunMuzzles = gunMuzzles;
  root.userData.update = (time = 0, dt = 0.016) => {
    if (!root.userData.basePosition || !root.userData.up) return;
    const bob = Math.sin(time * 1.7 + 0.35) * 0.32;
    root.position.fromArray(root.userData.basePosition);
    root.position.addScaledVector(root.userData.up, bob);
    const pulse = 0.78 + 0.22 * Math.sin(time * 5.2);
    beacon.material.opacity = pulse;
    beaconLight.intensity = 0.45 + pulse * 0.35;
    // Keep the callback explicitly dt-aware for future GPU/CPU animation gates.
    root.userData.lastDelta = dt;
  };
  return root;
}

/**
 * Mount one scout above the compiled triple-gate terrain, with a tangent-space
 * heading. `surfacePosition` should come from compiler.surface.sample().
 */
export function mountTripleGateScoutAircraft({
  scene,
  radius = 160,
  landmark = null,
  surfacePosition = null,
  scale = 0.86,
  hoverHeight = 9,
  forwardOffset = 4.5,
  lateralOffset = 0,
} = {}) {
  if (!scene) throw new Error("mountTripleGateScoutAircraft requires scene");
  const entry = landmark || {
    id: "triple-gate",
    direction: [-0.46, 0.88, 0.09],
    forward: [0, 0, 1],
  };
  const placement = computeTripleGateScoutPlacement({
    radius,
    landmarkDirection: entry.direction,
    landmarkForward: entry.forward,
    surfacePosition,
    hoverHeight,
    forwardOffset,
    lateralOffset,
  });
  const aircraft = createTripleGateScoutAircraft({ scale });
  aircraft.position.fromArray(placement.position);
  aircraft.userData.basePosition = placement.position.slice();
  aircraft.userData.placement = placement;
  aircraft.userData.up = new THREE.Vector3().fromArray(placement.up);
  aircraft.userData.forward = new THREE.Vector3().fromArray(placement.forward);
  aircraft.userData.right = new THREE.Vector3().fromArray(placement.right);
  aircraft.userData.landmarkId = entry.id || "triple-gate";
  const basis = new THREE.Matrix4().makeBasis(
    aircraft.userData.right,
    aircraft.userData.up,
    aircraft.userData.forward,
  );
  aircraft.quaternion.setFromRotationMatrix(basis);
  scene.add(aircraft);
  return aircraft;
}
