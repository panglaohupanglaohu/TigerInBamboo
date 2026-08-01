// =====================================================================
//  星球实验页：星球 + 球面玩家（跳/疾跑）+ 低多边散布 + 相机缩放环绕
// =====================================================================
import * as THREE from "three";
import { Timer } from "three/addons/misc/Timer.js";
import { createPlanet, PLANET_RADIUS } from "../world/planet.js";
import { createSphericalPlayer, updateSphericalPlayer } from "./sphericalPlayer.js";
import {
  createLowPolyTree,
  createLowPolyHouse,
  placeOnSphere,
  scatterOnSphere,
} from "../assets/lowPoly.js";
import { createInput } from "../core/input.js";
import { createNpcs, findNearbyNpc } from "./npcs.js";

// ---------- 场景 / 相机 / 渲染器 ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080f);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 光源 ----------
scene.add(new THREE.AmbientLight(0x8899bb, 0.35));

const sun = new THREE.DirectionalLight(0xfff2d8, 1.3);
sun.position.set(60, 80, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 300;
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.bias = -0.0005;
scene.add(sun);

// ---------- 星球 + 玩家 ----------
createPlanet(scene);
const player = createSphericalPlayer(scene, PLANET_RADIUS);

// ---------- 出生点附近固定演示 + 全图随机散布 ----------
{
  const spots = [
    { make: createLowPolyTree, lat: 84, lon: -30 },
    { make: createLowPolyTree, lat: 82, lon: 20 },
    { make: createLowPolyHouse, lat: 80, lon: -10 },
  ];
  for (const { make, lat, lon } of spots) {
    scene.add(placeOnSphere(make(), lat, lon, PLANET_RADIUS));
  }
}

const { colliders } = scatterOnSphere(scene, PLANET_RADIUS, {
  seed: 20260802,
  trees: 32,
  rocks: 22,
  flowers: 48,
  fences: 10,
  houses: 5,
  bridges: 2,
  latMax: 78,
  latMin: -35,
});

// 出生点固定物也进碰撞（简单：再扫一遍附近硬编码半径）
colliders.push(
  { position: placeOnSphere(new THREE.Object3D(), 84, -30, PLANET_RADIUS).position.clone(), radius: 0.55 },
  { position: placeOnSphere(new THREE.Object3D(), 82, 20, PLANET_RADIUS).position.clone(), radius: 0.55 },
  { position: placeOnSphere(new THREE.Object3D(), 80, -10, PLANET_RADIUS).position.clone(), radius: 1.1 }
);

// ---------- NPC：球面固定位置的 3 个彩色方块 ----------
const npcs = createNpcs(scene, PLANET_RADIUS);
const elNpcHint = document.getElementById("npc-hint");

// ---------- 相机：距离 + 环绕角 ----------
let camDist = 12;
const CAM_DIST_MIN = 5;
const CAM_DIST_MAX = 28;
let camOrbit = 0; // 相对玩家 forward 的水平偏角
let midDrag = false;

const keys = createInput({
  isActive: () => true,
  onZoom: (d) => {
    camDist = Math.min(CAM_DIST_MAX, Math.max(CAM_DIST_MIN, camDist + d));
  },
  onOrbit: (dx) => {
    camOrbit -= dx;
  },
  onMidDrag: (on) => {
    midDrag = !!on;
  },
});

// ---------- 球面跟随相机 ----------
const _camUp = new THREE.Vector3();
const _upSmooth = new THREE.Vector3(0, 1, 0); // 平滑翻转的相机 Up（出生点即北极法线）
const _camBack = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _look = new THREE.Vector3();

function updateFollowCamera(dt) {
  _camUp.copy(player.position).normalize();

  // 相机 Up 平滑追踪球面法线：玩家走到侧面/底部时姿态渐进翻转，
  // 玩家在屏幕上始终"头顶朝上"（硬拷贝会在跨半球瞬间跳变）
  _upSmooth.lerp(_camUp, 1 - Math.exp(-4 * dt));
  if (_upSmooth.lengthSq() < 1e-6) _upSmooth.copy(_camUp); // 过对跖点兜底
  _upSmooth.normalize();

  // 背后方向：玩家 forward 的反方向，再按 camOrbit 绕 up 旋转
  _camBack.copy(player.forward).multiplyScalar(-1);
  _camBack.addScaledVector(_camUp, -_camBack.dot(_camUp));
  if (_camBack.lengthSq() < 1e-6) _camBack.set(0, 0, 1);
  _camBack.normalize();
  _camRight.crossVectors(_camUp, _camBack).normalize();
  // orbit
  const cos = Math.cos(camOrbit);
  const sin = Math.sin(camOrbit);
  const bx = _camBack.x * cos + _camRight.x * sin;
  const by = _camBack.y * cos + _camRight.y * sin;
  const bz = _camBack.z * cos + _camRight.z * sin;
  _camBack.set(bx, by, bz).normalize();

  const height = 4 + camDist * 0.2;
  _camDesired
    .copy(player.position)
    .addScaledVector(_camUp, height)
    .addScaledVector(_camBack, camDist);

  const t = 1 - Math.exp(-(midDrag ? 12 : 6) * dt);
  camera.position.lerp(_camDesired, t);
  camera.up.copy(_upSmooth);
  _look.copy(player.position).addScaledVector(_upSmooth, 0.6);
  camera.lookAt(_look);
}
updateFollowCamera(1);

// ---------- 主循环 ----------
const timer = new Timer();
function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);

  updateSphericalPlayer(player, keys, camera, dt, PLANET_RADIUS, colliders);
  updateFollowCamera(dt);

  // NPC 距离检测：小于 5 显示对话提示
  elNpcHint.classList.toggle("show", !!findNearbyNpc(player, npcs));

  renderer.render(scene, camera);
}
animate();
