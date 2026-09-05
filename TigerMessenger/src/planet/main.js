// =====================================================================
//  星球实验页：球面玩家 + 散布 + 跟随相机 + NPC 送信任务
// =====================================================================
import * as THREE from "three";
import { Timer } from "three/addons/misc/Timer.js";
import { createPlanet, PLANET_RADIUS } from "../world/planet.js";
import { createSphericalPlayer, updateSphericalPlayer } from "./sphericalPlayer.js";
import {
  createLowPolyHouse,
  placeOnSphere,
  scatterOnSphere,
  updateClouds,
} from "../assets/lowPoly.js";
import { createAncientPineTree } from "../assets/ancient.js";
import { createInput } from "../core/input.js";
import { createNpcs, findNearbyNpc } from "./npcs.js";
import { createLetterQuest, createCarryLetterVisual } from "./letterQuest.js";
import { createFollowCamera } from "./followCamera.js";
import { createDevPanel } from "./devPanel.js";
import { P } from "./params.js";

// ---------- 场景 / 相机 / 渲染器 ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080f);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);

// 模板缓冲：见 src/core/stage.js 的同名注释（three r163 起默认 false）
const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
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
const ambient = new THREE.AmbientLight(0x8899bb, 0.35);
scene.add(ambient);
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
const carryVisual = createCarryLetterVisual(player.mesh);

// ---------- 固定演示 + 散布 ----------
{
  const spots = [
    { make: createAncientPineTree, lat: 84, lon: -30 },
    { make: createAncientPineTree, lat: 82, lon: 20 },
    { make: createLowPolyHouse, lat: 80, lon: -10 },
  ];
  for (const { make, lat, lon } of spots) {
    scene.add(placeOnSphere(make(), lat, lon, PLANET_RADIUS));
  }
}

const { colliders, clouds } = scatterOnSphere(scene, PLANET_RADIUS, {
  seed: 20260802,
  trees: 50,   // 规格：50 棵树
  treeMaker: createAncientPineTree,
  houses: 10,  // 规格：10 栋房子
  rocks: 30,   // 规格：30 块岩石
  clouds: 10,  // 规格：低空云朵（距球面 5）
  flowers: 0,  // 水墨花已清理（用户认为花模型不好看）
  fences: 6,
  bridges: 2,
  latMax: 78,
  latMin: -35,
  minSpacing: 2.2,
});

colliders.push(
  { position: placeOnSphere(new THREE.Object3D(), 84, -30, PLANET_RADIUS).position.clone(), radius: 0.55 },
  { position: placeOnSphere(new THREE.Object3D(), 82, 20, PLANET_RADIUS).position.clone(), radius: 0.55 },
  { position: placeOnSphere(new THREE.Object3D(), 80, -10, PLANET_RADIUS).position.clone(), radius: 1.1 }
);

// ---------- NPC + 送信 ----------
const npcs = createNpcs(scene, PLANET_RADIUS);
const elNpcHint = document.getElementById("npc-hint");
const elDialog = document.getElementById("dialog");
const elScoreNum = document.getElementById("score-num");
let score = 0;
let dialogTimer = 0;

const quest = createLetterQuest({
  player,
  npcs,
  onScore: () => {
    score += 1;
    elScoreNum.textContent = String(score);
  },
  onCarryChange: (on) => carryVisual.setCarrying(on),
});

window.addEventListener("keydown", (e) => {
  if (e.code !== "KeyE" || e.repeat) return;
  const result = quest.tryTalk();
  if (result) {
    elDialog.textContent = result.text;
    elDialog.classList.add("show");
    dialogTimer = result.completed ? 4.2 : 3.2;
  }
});

// 调试句柄在文件末尾（followCam 等初始化之后）统一挂载

// ---------- 相机 ----------
const followCam = createFollowCamera(camera, player);
const keys = createInput({
  isActive: () => true,
  onZoom: (d) => followCam.zoomBy(d),
  onOrbit: (dx) => followCam.orbitBy(dx),
  onMidDrag: (on) => followCam.setMidDrag(on),
});
followCam.snap();

// ---------- 右键拖拽环视（yaw + pitch，松手回弹） ----------
{
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  window.addEventListener("contextmenu", (e) => e.preventDefault()); // 屏蔽右键菜单
  window.addEventListener("mousedown", (e) => {
    if (e.button !== 2) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    followCam.setOrbitDrag(true);
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    followCam.orbitBy((e.clientX - lastX) * 0.005); // 水平偏航
    followCam.orbitPitchBy((e.clientY - lastY) * 0.004); // 俯仰
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    followCam.setOrbitDrag(false); // 触发平滑回弹
  };
  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) endDrag();
  });
  window.addEventListener("blur", endDrag);
}

// ---------- 开发者菜单（右上角 🤖 呼出） ----------
const devPanel = createDevPanel({
  sun,
  ambient,
  onCamDist: (d) => followCam.setDist(d),
});
void P; // 相机/玩家/交互参数已在各模块内运行时读取

// 调试句柄（无头验收用；须在所有引用对象初始化之后挂载）
window.__lab = { player, npcs, quest, carryVisual, followCam, scene, P };

// ---------- 主循环 ----------
const timer = new Timer();
function animate() {
  requestAnimationFrame(animate);
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = performance.now() * 0.001;

  updateSphericalPlayer(player, keys, camera, dt, PLANET_RADIUS, colliders);
  followCam.update(dt);
  carryVisual.update(t);
  updateClouds(clouds, dt, t);
  devPanel.tick(dt);

  elNpcHint.classList.toggle("show", !!findNearbyNpc(player, npcs));

  if (dialogTimer > 0) {
    dialogTimer -= dt;
    if (dialogTimer <= 0) elDialog.classList.remove("show");
  }

  renderer.render(scene, camera);
}
animate();
