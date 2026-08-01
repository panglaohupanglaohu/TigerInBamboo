// =====================================================================
//  星球实验页：球面玩家 + 散布 + 跟随相机 + NPC 送信任务
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
import { createLetterQuest, createCarryLetterVisual } from "./letterQuest.js";
import { createFollowCamera } from "./followCamera.js";

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
const carryVisual = createCarryLetterVisual(player.mesh);

// ---------- 固定演示 + 散布 ----------
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

window.__lab = { player, npcs, quest, carryVisual };

// ---------- 相机 ----------
const followCam = createFollowCamera(camera, player);
const keys = createInput({
  isActive: () => true,
  onZoom: (d) => followCam.zoomBy(d),
  onOrbit: (dx) => followCam.orbitBy(dx),
  onMidDrag: (on) => followCam.setMidDrag(on),
});
followCam.snap();

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

  elNpcHint.classList.toggle("show", !!findNearbyNpc(player, npcs));

  if (dialogTimer > 0) {
    dialogTimer -= dt;
    if (dialogTimer <= 0) elDialog.classList.remove("show");
  }

  renderer.render(scene, camera);
}
animate();
