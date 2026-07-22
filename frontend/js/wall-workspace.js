// 题壁工作空间：上传原作 → 自动推断画境/生灵 → 中央 Three.js 工作区
import * as THREE from "../assets/vendor/three/three.module.js";
import { OrbitControls } from "../assets/vendor/three/jsm/controls/OrbitControls.js";
import { analyzeAndEstimate } from "./imageAnalysis.js";
import { DEFAULT_SPECIES } from "./species.js";
import { BioEntityMesh } from "./bio/BioEntityMesh.js";
import { buildAvianBody } from "./bio/AvianBodyBuilder.js";
import { paintGeometry } from "./tiger.js";
import { applyGait, computeGait } from "./locomotionModel.js";

const WALL_KEY = "living-classical-art-wall-source";
const DEFAULT_PALETTE = ["#d8c4a0", "#5a4632", "#386456", "#8a7a5f", "#b03a2e", "#f4efe2"];
const clamp = THREE.MathUtils.clamp;
const el = (id) => document.getElementById(id);
const clone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

const ENV_LIBRARY = {
  blank: { mark: "白", label: "留白墙", note: "白壁 · 画框 · 静场", ground: 0xe8dfc8, wall: 0xfffcf2, bg: 0xdad0b8 },
  stream: { mark: "溪", label: "溪涧", note: "碎石 · 浅水 · 岸草", ground: 0xcabf9e, wall: 0xf5efd9, bg: 0xcfd8cf },
  pond: { mark: "塘", label: "梅塘", note: "静水 · 荷叶 · 芦影", ground: 0xb9c2a6, wall: 0xf0eedf, bg: 0xb9c8cc },
  snow: { mark: "雪", label: "雪竹", note: "积雪 · 修竹 · 落雪", ground: 0xf0f2f0, wall: 0xf8f8f2, bg: 0xd4dce1 },
  mountain: { mark: "山", label: "山岩", note: "岩台 · 远岫 · 斜坡", ground: 0xc5beb0, wall: 0xf0ead8, bg: 0xc9ced2 },
  grove: { mark: "林", label: "林下", note: "竹影 · 草坡 · 暗绿", ground: 0xb8c2a0, wall: 0xf2eddb, bg: 0xc7d0bd },
};

const ATMOSPHERES = {
  paper: { bg: 0xd8cfb6, hemi: 0xf9f0dc, ground: 0x4a483b, dir: 1.05, fog: 0.24 },
  dawn: { bg: 0xd5c8af, hemi: 0xffe5bd, ground: 0x435148, dir: 1.18, fog: 0.18 },
  dusk: { bg: 0xb8aaa2, hemi: 0xf2c39c, ground: 0x2d3440, dir: 0.78, fog: 0.34 },
  moon: { bg: 0x9aa7b0, hemi: 0xcdddf2, ground: 0x202936, dir: 0.52, fog: 0.42 },
};

const BIO_LIBRARY = {
  auto: { mark: "原", label: "原作生灵", note: "由上传原作推断" },
  digitigrade: { mark: "兽", label: "伏行走兽", note: "趾行 · 尾部配平" },
  unguligrade: { mark: "蹄", label: "山野蹄兽", note: "高腿 · 稳步" },
  saltatorial: { mark: "跃", label: "跳跃小兽", note: "后肢弹跳" },
  avian: { mark: "禽", label: "塘岸禽鸟", note: "长颈 · 翼羽" },
  fish: { mark: "鱼", label: "鱼影", note: "水线摆尾" },
  insect: { mark: "蝶", label: "蝶群", note: "薄翼群飞" },
};

const BEHAVIOR_LABEL = { IDLE: "静立", WALK: "游走", FORAGE: "觅食", LEAP: "惊跃" };
const ANATOMY_LABEL = {
  AVES: "禽类轮廓",
  DIGITIGRADE: "趾行走兽",
  UNGULIGRADE: "蹄行走兽",
  SALTATORIAL: "跳跃小兽",
};

const state = {
  source: null,
  estimate: null,
  palette: [...DEFAULT_PALETTE],
  envId: "blank",
  envResolved: "blank",
  envTint: DEFAULT_PALETTE[0],
  atmosphere: "paper",
  creatureKind: "auto",
  creatureColor: DEFAULT_PALETTE[0],
  behavior: "IDLE",
  showSkeleton: false,
  wind: 0.35,
  mist: 0.25,
  gait: 0,
  orbit: 0,
  creature: null,
  creatureRecord: null,
  creatureBaseY: 0,
};

let renderer;
let scene;
let camera;
let controls;
let clock;
let ground;
let wall;
let envGroup;
let sourceGroup;
let hemiLight;
let keyLight;
let fillLight;
let snowPoints = null;
let skeletonHelper = null;
let animationStarted = false;

async function main() {
  initThree();
  bindControls();
  await applySource(readStoredSource());
  if (!animationStarted) {
    animationStarted = true;
    animate();
  }
}

function initThree() {
  const canvas = el("wall-viewport");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(ATMOSPHERES.paper.bg);
  camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
  camera.position.set(3.7, 2.1, 4.9);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.82, -0.25);
  controls.minDistance = 1.4;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.9;
  controls.update();

  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshStandardMaterial({ color: ENV_LIBRARY.blank.ground, roughness: 0.96 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  wall = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 3.25),
    new THREE.MeshStandardMaterial({ color: ENV_LIBRARY.blank.wall, roughness: 0.88 })
  );
  wall.position.set(0, 1.62, -2.42);
  wall.receiveShadow = true;
  scene.add(wall);

  sourceGroup = new THREE.Group();
  sourceGroup.position.set(0, 1.65, -2.36);
  scene.add(sourceGroup);

  envGroup = new THREE.Group();
  scene.add(envGroup);

  hemiLight = new THREE.HemisphereLight(0xf9f0dc, 0x4a483b, 0.95);
  scene.add(hemiLight);
  keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
  keyLight.position.set(3.4, 5.8, 3.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);
  fillLight = new THREE.DirectionalLight(0xbfd4ff, 0.28);
  fillLight.position.set(-4, 2.4, 2.6);
  scene.add(fillLight);

  clock = new THREE.Clock();
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  requestAnimationFrame(resize);
}

function bindControls() {
  el("reset-camera")?.addEventListener("click", resetCamera);
  el("source-upload")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      showToast("正在纳入原作…");
      const dataUrl = await fileToCompressedDataURL(file);
      const payload = { name: file.name || "untitled-artwork", type: "image/jpeg", dataUrl, updatedAt: Date.now() };
      sessionStorage.setItem(WALL_KEY, JSON.stringify(payload));
      await applySource(payload);
      showToast("原作已入壁");
    } catch (err) {
      showToast(err?.message || "图片读取失败");
    }
  });

  el("atmosphere-buttons")?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-atmosphere]");
    if (!btn) return;
    state.atmosphere = btn.dataset.atmosphere;
    applyAtmosphere();
    renderSegments();
    updateReadout();
  });

  el("behavior-buttons")?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-behavior]");
    if (!btn) return;
    state.behavior = btn.dataset.behavior;
    renderSegments();
    updateReadout();
  });

  el("wind-range")?.addEventListener("input", (event) => {
    state.wind = parseFloat(event.target.value);
  });
  el("mist-range")?.addEventListener("input", (event) => {
    state.mist = parseFloat(event.target.value);
    applyAtmosphere();
  });
  el("skeleton-toggle")?.addEventListener("click", () => {
    state.showSkeleton = !state.showSkeleton;
    const btn = el("skeleton-toggle");
    btn?.setAttribute("aria-pressed", String(state.showSkeleton));
    btn?.classList.toggle("active", state.showSkeleton);
    updateSkeletonOverlay();
  });
  el("rebuild-creature")?.addEventListener("click", () => {
    buildCreature(state.creatureKind);
    showToast("已重构生灵");
  });
}

async function applySource(source) {
  state.source = source || null;
  state.estimate = null;
  state.palette = [...DEFAULT_PALETTE];
  state.envTint = DEFAULT_PALETTE[0];
  state.creatureColor = DEFAULT_PALETTE[0];
  updateSourceCopy();
  await setWallArtwork(state.source);

  if (state.source?.dataUrl) {
    setStatus("正在解析原作轮廓与色板…");
    try {
      const file = await sourceToFile(state.source);
      const estimate = await analyzeAndEstimate(file);
      state.estimate = estimate;
      state.palette = cleanPalette(estimate.palette);
      state.envTint = state.palette[0];
      state.creatureColor = makeVisibleColor(estimate.bestHex || state.palette[0]);
      state.envId = "auto";
      state.creatureKind = "auto";
      setStatus(`${ANATOMY_LABEL[estimate.anatomyType] || "未知轮廓"} · 置信 ${Math.round((estimate.confidence || 0) * 100)}%`);
    } catch (err) {
      console.error("[wall-workspace] image analysis failed", err);
      setStatus("原作已入壁，自动分析暂不可用");
    }
  } else {
    state.envId = "blank";
    state.creatureKind = "auto";
    setStatus("留白墙 · 默认画境");
  }

  renderMenus();
  setEnvironment(state.envId);
  buildCreature(state.creatureKind);
  updateReadout();
}

function readStoredSource() {
  try {
    const raw = sessionStorage.getItem(WALL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function updateSourceCopy() {
  const title = el("source-title");
  const meta = el("source-meta");
  if (state.source?.dataUrl) {
    if (title) title.textContent = state.source.name || "题壁原作";
    if (meta) meta.textContent = "原作已入壁";
  } else {
    if (title) title.textContent = "待君题壁";
    if (meta) meta.textContent = "留白墙 · 默认画境";
  }
}

function setStatus(text) {
  const node = el("analysis-status");
  if (node) node.textContent = text;
}

function renderMenus() {
  renderEnvironmentButtons();
  renderBioButtons();
  renderPalette("env-palette", "env");
  renderPalette("bio-palette", "bio");
  renderSegments();
}

function renderEnvironmentButtons() {
  const wrap = el("env-buttons");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const opt of environmentOptions()) {
    const btn = makeToolButton(opt, state.envId === opt.id);
    btn.addEventListener("click", () => setEnvironment(opt.id));
    wrap.appendChild(btn);
  }
}

function renderBioButtons() {
  const wrap = el("bio-buttons");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const opt of bioOptions()) {
    const btn = makeToolButton(opt, state.creatureKind === opt.id);
    btn.addEventListener("click", () => buildCreature(opt.id));
    wrap.appendChild(btn);
  }
}

function makeToolButton(opt, active) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "wall-tool-btn";
  btn.classList.toggle("active", active);
  const mark = document.createElement("span");
  mark.className = "mark";
  mark.textContent = opt.mark;
  const copy = document.createElement("span");
  const label = document.createElement("b");
  label.textContent = opt.label;
  const note = document.createElement("em");
  note.textContent = opt.note;
  copy.append(label, note);
  btn.append(mark, copy);
  return btn;
}

function renderPalette(id, scope) {
  const wrap = el(id);
  if (!wrap) return;
  wrap.innerHTML = "";
  state.palette.slice(0, 6).forEach((hex) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wall-swatch";
    btn.style.background = hex;
    btn.title = hex;
    const active = scope === "env" ? hex === state.envTint : hex === state.creatureColor;
    btn.classList.toggle("active", active);
    btn.addEventListener("click", () => {
      if (scope === "env") {
        state.envTint = hex;
        setEnvironment(state.envId);
      } else {
        state.creatureColor = makeVisibleColor(hex);
        buildCreature(state.creatureKind);
      }
      renderPalette(id, scope);
    });
    wrap.appendChild(btn);
  });
}

function renderSegments() {
  document.querySelectorAll("#atmosphere-buttons button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.atmosphere === state.atmosphere);
  });
  document.querySelectorAll("#behavior-buttons button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.behavior === state.behavior);
  });
}

function environmentOptions() {
  const ids = [];
  const add = (id) => { if (!ids.includes(id)) ids.push(id); };
  if (state.estimate) {
    add("auto");
    const anatomy = state.estimate.anatomyType;
    if (anatomy === "AVES") { add("pond"); add("grove"); }
    else if (anatomy === "DIGITIGRADE") { add("snow"); add("stream"); }
    else if (anatomy === "UNGULIGRADE") { add("mountain"); add("grove"); }
    else if (anatomy === "SALTATORIAL") { add("grove"); add("stream"); }
  }
  ["blank", "stream", "pond", "snow", "mountain", "grove"].forEach(add);
  return ids.map((id) => id === "auto"
    ? { id, mark: "色", label: "原作色境", note: "由上传原作生成" }
    : { id, ...ENV_LIBRARY[id] });
}

function bioOptions() {
  const ids = ["auto"];
  const add = (id) => { if (!ids.includes(id)) ids.push(id); };
  const inferred = resolveCreatureKind("auto");
  add(inferred);
  if (inferred === "avian") add("fish");
  if (inferred === "digitigrade") add("saltatorial");
  if (inferred === "unguligrade") add("avian");
  ["digitigrade", "unguligrade", "saltatorial", "avian", "fish", "insect"].forEach(add);
  return ids.map((id) => ({ id, ...BIO_LIBRARY[id] }));
}

function resolveEnvironmentId(id) {
  if (id !== "auto") return id;
  const anatomy = state.estimate?.anatomyType;
  const mood = paletteMood(state.palette);
  if (anatomy === "AVES") return mood.blue > 0.18 ? "pond" : "grove";
  if (anatomy === "DIGITIGRADE") return mood.cool > 0.48 ? "snow" : "stream";
  if (anatomy === "UNGULIGRADE") return "mountain";
  if (anatomy === "SALTATORIAL") return mood.green > 0.15 ? "grove" : "stream";
  return "blank";
}

function setEnvironment(id) {
  state.envId = id;
  state.envResolved = resolveEnvironmentId(id);
  clearGroup(envGroup);
  snowPoints = null;

  const preset = ENV_LIBRARY[state.envResolved] || ENV_LIBRARY.blank;
  const tint = new THREE.Color(state.envTint || DEFAULT_PALETTE[0]);
  ground.material.color.setHex(preset.ground).lerp(tint, id === "auto" ? 0.22 : 0.08);
  wall.material.color.setHex(preset.wall).lerp(tint, id === "auto" ? 0.1 : 0.03);
  buildEnvironmentDecor(state.envResolved, tint);
  applyAtmosphere();
  renderEnvironmentButtons();
  renderPalette("env-palette", "env");
  updateReadout();
}

function buildEnvironmentDecor(id, tint) {
  const rand = seededRandom(`${id}:${state.source?.name || "blank"}`);
  if (id === "blank") {
    addLowPlatform(0, 0.02, -0.4, 1.6, 0.08, 0.76, tint.clone().lerp(new THREE.Color(0x9d875d), 0.45));
    addStone(rand, -1.8, 0.25, 0.46);
    addStone(rand, 1.8, -0.35, 0.36);
    return;
  }
  if (id === "stream") {
    addWaterRibbon(-1.25, 0.03, 0.05, 1.15, 5.2, 0x6d98a7);
    for (let i = 0; i < 12; i++) addStone(rand, -1.8 + rand() * 3.2, -1.8 + rand() * 3.6, 0.16 + rand() * 0.22);
    for (let i = 0; i < 18; i++) addGrassBlade(rand, 1.4 + rand() * 1.4, -2 + rand() * 4, 0x5e7b4d);
    return;
  }
  if (id === "pond") {
    addWaterRibbon(0, 0.025, 0.05, 4.6, 3.2, 0x6f93a8);
    for (let i = 0; i < 8; i++) addLotusLeaf(-1.8 + rand() * 3.6, -1.25 + rand() * 2.2, 0.16 + rand() * 0.12);
    for (let i = 0; i < 16; i++) addReed(rand, -2.35 + rand() * 4.7, -1.7 + rand() * 3.4);
    return;
  }
  if (id === "snow") {
    for (let i = 0; i < 11; i++) addBamboo(rand, 1.25 + rand() * 1.25, -1.75 + rand() * 3.5, 1.25 + rand() * 1.25);
    for (let i = 0; i < 7; i++) addStone(rand, -2.1 + rand() * 2.2, -1.8 + rand() * 3.6, 0.12 + rand() * 0.14);
    addSnowParticles(rand);
    return;
  }
  if (id === "mountain") {
    for (let i = 0; i < 9; i++) addStone(rand, -2.2 + rand() * 4.4, -1.4 + rand() * 2.5, 0.26 + rand() * 0.48);
    for (let i = 0; i < 4; i++) addRidge(-1.8 + i * 1.2, 1.1 - i * 0.04, -2.22, 2.4 - i * 0.22, 0.64 + i * 0.08);
    return;
  }
  if (id === "grove") {
    for (let i = 0; i < 14; i++) addBamboo(rand, -2.4 + rand() * 4.8, -2 + rand() * 3.6, 1.15 + rand() * 1.0);
    for (let i = 0; i < 24; i++) addGrassBlade(rand, -2.5 + rand() * 5, -2 + rand() * 4, 0x496f45);
  }
}

function applyAtmosphere() {
  const a = ATMOSPHERES[state.atmosphere] || ATMOSPHERES.paper;
  const preset = ENV_LIBRARY[state.envResolved] || ENV_LIBRARY.blank;
  const bg = new THREE.Color(preset.bg).lerp(new THREE.Color(a.bg), 0.45);
  const fogNear = THREE.MathUtils.lerp(9, 3.8, state.mist * (0.45 + a.fog));
  const fogFar = THREE.MathUtils.lerp(18, 7.2, state.mist * (0.55 + a.fog));
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, fogNear, fogFar);
  hemiLight.color.setHex(a.hemi);
  hemiLight.groundColor.setHex(a.ground);
  hemiLight.intensity = state.atmosphere === "moon" ? 0.72 : 0.95;
  keyLight.intensity = a.dir;
  fillLight.intensity = state.atmosphere === "moon" ? 0.42 : 0.28;
  renderSegments();
}

function addLowPlatform(x, y, z, w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.88 })
  );
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  envGroup.add(mesh);
}

function addWaterRibbon(x, y, z, w, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d, 1, 1),
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.68, roughness: 0.28, metalness: 0.08, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.userData.water = true;
  envGroup.add(mesh);
}

function addStone(rand, x, z, scale) {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(scale, 1),
    new THREE.MeshStandardMaterial({ color: 0x817b71, roughness: 1 })
  );
  mesh.scale.set(1.2 + rand() * 0.6, 0.45 + rand() * 0.38, 0.9 + rand() * 0.5);
  mesh.position.set(x, scale * 0.28, z);
  mesh.rotation.set(rand() * 0.4, rand() * Math.PI, rand() * 0.28);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  envGroup.add(mesh);
}

function addBamboo(rand, x, z, h) {
  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.034, h, 7),
    new THREE.MeshStandardMaterial({ color: 0x4d6f45, roughness: 0.84 })
  );
  stalk.position.set(x, h / 2, z);
  stalk.rotation.z = (rand() - 0.5) * 0.16;
  stalk.castShadow = true;
  envGroup.add(stalk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x688f5c, roughness: 0.72, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.55), leafMat);
    leaf.position.set(x + (rand() - 0.5) * 0.16, h * (0.55 + rand() * 0.4), z + (rand() - 0.5) * 0.16);
    leaf.rotation.set(0.8 + rand() * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.5);
    envGroup.add(leaf);
  }
}

function addGrassBlade(rand, x, z, color) {
  const h = 0.28 + rand() * 0.34;
  const blade = new THREE.Mesh(
    new THREE.PlaneGeometry(0.035, h),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, side: THREE.DoubleSide })
  );
  blade.position.set(x, h / 2, z);
  blade.rotation.set((rand() - 0.5) * 0.18, rand() * Math.PI, (rand() - 0.5) * 0.28);
  envGroup.add(blade);
}

function addLotusLeaf(x, z, r) {
  const leaf = new THREE.Mesh(
    new THREE.CircleGeometry(r, 18),
    new THREE.MeshStandardMaterial({ color: 0x4f7a4a, roughness: 0.8, side: THREE.DoubleSide })
  );
  leaf.rotation.x = -Math.PI / 2;
  leaf.position.set(x, 0.045, z);
  envGroup.add(leaf);
}

function addReed(rand, x, z) {
  const h = 0.7 + rand() * 0.75;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.014, h, 5),
    new THREE.MeshStandardMaterial({ color: 0x9b7b4a, roughness: 0.86 })
  );
  stem.position.set(x, h / 2, z);
  stem.rotation.z = (rand() - 0.5) * 0.22;
  envGroup.add(stem);
}

function addRidge(x, y, z, w, h) {
  const geom = new THREE.BufferGeometry();
  const verts = new Float32Array([
    -w / 2, -h / 2, 0,
    -w * 0.18, h / 2, 0,
    w / 2, -h / 2, 0,
  ]);
  geom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geom.setIndex([0, 1, 2]);
  geom.computeVertexNormals();
  const ridge = new THREE.Mesh(
    geom,
    new THREE.MeshBasicMaterial({ color: 0x6f6a60, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
  );
  ridge.position.set(x, y, z);
  envGroup.add(ridge);
}

function addSnowParticles(rand) {
  const count = 360;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = -2.9 + rand() * 5.8;
    positions[i * 3 + 1] = 0.2 + rand() * 3.0;
    positions[i * 3 + 2] = -2.1 + rand() * 4.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  snowPoints = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.028, transparent: true, opacity: 0.88 })
  );
  envGroup.add(snowPoints);
}

function buildCreature(kind) {
  state.creatureKind = kind;
  const resolved = resolveCreatureKind(kind);
  if (state.creature) {
    scene.remove(state.creature);
    disposeObject(state.creature);
    state.creature = null;
  }
  clearSkeletonOverlay();
  state.creatureRecord = null;
  state.gait = 0;
  state.orbit = 0;

  let creature;
  if (resolved === "fish") creature = createFishCreature(state.creatureColor);
  else if (resolved === "insect") creature = createButterflyCreature(state.creatureColor);
  else if (resolved === "avian") creature = createAvianCreature();
  else creature = createQuadrupedCreature(resolved);

  state.creature = creature;
  scene.add(creature);
  frameCreature(creature, resolved);
  updateSkeletonOverlay();
  renderBioButtons();
  renderPalette("bio-palette", "bio");
  updateReadout();
}

function resolveCreatureKind(kind) {
  if (kind !== "auto") return kind;
  const anatomy = state.estimate?.anatomyType;
  if (anatomy === "AVES") return "avian";
  if (anatomy === "UNGULIGRADE") return "unguligrade";
  if (anatomy === "SALTATORIAL") return "saltatorial";
  return "digitigrade";
}

function createQuadrupedCreature(kind) {
  const anatomy = kind === "unguligrade" ? "UNGULIGRADE" : kind === "saltatorial" ? "SALTATORIAL" : "DIGITIGRADE";
  const record = makeSpeciesRecord(anatomy);
  state.creatureRecord = record;
  const node = new BioEntityMesh({ anatomyType: anatomy }, record, {
    paintGeometry: (geo) => paintGeometry(geo, record.dimensions, record.anatomicalRef, record.rendering),
  });
  addEyeAndEarDetails(node, record, anatomy);
  return node;
}

function createAvianCreature() {
  const record = makeSpeciesRecord("AVES");
  state.creatureRecord = record;
  const base = colorToHex(state.creatureColor, 0x8a7a5f);
  const stripe = colorToHex(record.rendering.stripeColor, 0x3f372c);
  const h = clamp(record.dimensions.height || 0.62, 0.38, 1.25);
  const built = buildAvianBody({
    height: h,
    bodyColor: base,
    accentColor: lightenHex(base, 0.32),
    neckColor: mixHex(base, stripe, 0.28),
    wingColor: mixHex(base, stripe, 0.18),
    tailColor: stripe,
    tailBaseColor: base,
    wingPatchColor: state.estimate ? mixHex(base, stripe, 0.55) : null,
    shape: {
      bodyScale: [0.14, 0.13, 0.24],
      neckPos: [0, 0.36, 0.18],
      neckR: 0.052,
      neckSausage: true,
      neckScale: [1, clamp(record.rigTuning.neckLen || 1.2, 0.9, 2.1), 1.34],
      headR: 0.045,
      crestCount: 0,
      wingScale: [0.032, clamp((record.anatomicalRef.wingspan || 1.1) * 0.055, 0.08, 0.16), 0.18],
      tailLen: clamp(record.anatomicalRef.tailLength || 0.18, 0.12, 0.34),
      tailCount: 5,
      legH: 0.16,
      legZ: -0.02,
    },
  });
  built.group.userData.driver = { kind: "avian", built };
  return built.group;
}

function createFishCreature(color) {
  const group = new THREE.Group();
  group.userData.driver = { kind: "fish" };
  const base = new THREE.Color(makeVisibleColor(color));
  const mat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.55, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: base.clone().lerp(new THREE.Color(0x1f2b2d), 0.35), roughness: 0.62, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), mat);
  body.scale.set(0.42, 0.22, 1.0);
  body.castShadow = true;
  group.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.36, 3), dark);
  tail.name = "fishTail";
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -0.53;
  group.add(tail);
  for (const sx of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.34), dark);
    fin.position.set(sx * 0.24, 0.02, 0.08);
    fin.rotation.set(0.3, sx * 0.9, sx * 0.4);
    group.add(fin);
  }
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x16120e });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeMat);
    eye.position.set(sx * 0.12, 0.07, 0.38);
    group.add(eye);
  }
  return group;
}

function createButterflyCreature(color) {
  const root = new THREE.Group();
  root.userData.driver = { kind: "insect", butterflies: [] };
  const base = new THREE.Color(makeVisibleColor(color));
  const wingMat = new THREE.MeshStandardMaterial({
    color: base,
    transparent: true,
    opacity: 0.72,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.75 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    b.position.set((i - 1.5) * 0.38, 0.35 + (i % 2) * 0.16, -0.12 + i * 0.08);
    b.userData.phase = i * 0.7;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.18, 7), bodyMat);
    body.rotation.x = Math.PI / 2;
    b.add(body);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.CircleGeometry(0.14, 18), wingMat.clone());
      wing.name = sx < 0 ? "wingL" : "wingR";
      wing.scale.set(1.1, 0.72, 1);
      wing.position.set(sx * 0.08, 0.03, 0);
      wing.rotation.y = sx * 0.68;
      b.add(wing);
    }
    root.add(b);
    root.userData.driver.butterflies.push(b);
  }
  return root;
}

function makeSpeciesRecord(anatomy) {
  const est = state.estimate;
  const rec = clone(DEFAULT_SPECIES);
  const baseDims = {
    AVES: { width: 0.34, height: 0.72, length: 0.84 },
    DIGITIGRADE: { width: 0.42, height: 0.82, length: 1.55 },
    UNGULIGRADE: { width: 0.42, height: 1.08, length: 1.65 },
    SALTATORIAL: { width: 0.26, height: 0.42, length: 0.62 },
  }[anatomy];
  const useEstimate = est && (anatomy === est.anatomyType || state.creatureKind === "auto");
  const dims = useEstimate ? est.dimensions : baseDims;
  const prop = useEstimate ? est.proportions : null;
  const legScale = prop?.legLen ? clamp(prop.legLen * 1.7, 0.58, 1.45) : anatomy === "UNGULIGRADE" ? 1.18 : anatomy === "SALTATORIAL" ? 1.24 : 1;
  const neckLen = prop?.neckLen ? clamp(prop.neckLen, 0.45, 2.1) : anatomy === "AVES" ? 1.45 : anatomy === "UNGULIGRADE" ? 0.78 : 1;
  const tailScale = prop?.tailLen ? clamp(prop.tailLen * 1.2, 0.18, 1.55) : anatomy === "SALTATORIAL" ? 0.85 : anatomy === "AVES" ? 0.25 : 0.78;

  rec.enabled = true;
  rec.cnName = state.source?.name ? "题壁生灵" : "留白生灵";
  rec.scientificName = "Ex pictura viva";
  rec.taxonomyClass = anatomy === "AVES" ? "bird" : "mammal";
  rec.anatomyType = anatomy;
  rec.dimensions = { ...baseDims, ...(dims || {}) };
  rec.anatomicalRef = {
    withersHeight: +(rec.dimensions.height * (anatomy === "AVES" ? 0.62 : 0.78)).toFixed(2),
    tailLength: +(rec.dimensions.height * tailScale).toFixed(2),
    wingspan: +(Math.max(rec.dimensions.length * 1.55, 0.55)).toFixed(2),
    earLength: anatomy === "SALTATORIAL" ? 0.16 : 0.04,
    note: "由题壁原作的轮廓与色板推断，可用右侧菜单继续重构。",
  };
  rec.rigTuning = { neckLen, legFold: anatomy === "SALTATORIAL" ? 1.28 : 1, backAngle: anatomy === "DIGITIGRADE" ? -0.08 : 0.02, hockLift: anatomy === "DIGITIGRADE" ? 0.24 : 0.08 };
  rec.shape = {
    rumpScale: anatomy === "SALTATORIAL" ? 1.24 : 1,
    bellyScale: anatomy === "AVES" ? 1.16 : 1,
    chestScale: anatomy === "DIGITIGRADE" ? 1.12 : 1,
    headScale: anatomy === "AVES" ? 0.86 : 1,
    legScale,
    tailScale,
  };
  rec.rendering = {
    vertexColors: true,
    baseColor: makeVisibleColor(state.creatureColor),
    stripeColor: state.palette[1] || "#3f372c",
    pattern: anatomy === "DIGITIGRADE" ? "stripes" : anatomy === "SALTATORIAL" ? "patch" : "solid",
    stripeDensity: est ? 0.52 : 0.24,
    bellyLightenAmt: anatomy === "AVES" ? 0.28 : 0.38,
    roughness: 0.82,
    furLayers: anatomy === "AVES" ? 0 : anatomy === "UNGULIGRADE" ? 4 : 10,
    furLength: anatomy === "AVES" ? 0 : 0.012,
  };
  rec.gait = { freq: 1, swing: 1, spine: 1, tail: anatomy === "AVES" ? 0.08 : 0.18, stepLen: 0.18, lean: 0.08, breathe: 0.03, creepLow: 0.18, directRegister: 0.7, creepCadence: 0.62 };
  const gait = computeGait(anatomy, rec.dimensions, { neckLen, legLen: legScale, tailLen: tailScale });
  applyGait(rec, gait);
  rec.gait.stepLen = clamp(gait.prefSpeed * 0.12, 0.06, anatomy === "UNGULIGRADE" ? 0.32 : 0.24);
  rec.gait.lean = anatomy === "AVES" ? 0.12 : 0.08;
  rec.habitat = state.envResolved;
  rec.image = state.source?.dataUrl || null;
  return rec;
}

function addEyeAndEarDetails(node, rec, anatomy) {
  const head = node.boneMap?.get("Head");
  if (!head) return;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x17120d, roughness: 0.35 });
  const w = rec.dimensions.width || 0.3;
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(w * 0.052, 9, 7), eyeMat);
    eye.position.set(sx * w * 0.14, w * 0.04, w * 0.12);
    head.add(eye);
  }
  if (anatomy !== "SALTATORIAL") return;
  const furMat = new THREE.MeshStandardMaterial({ color: rec.rendering.baseColor, roughness: 0.8 });
  for (const key of ["Ear_L", "Ear_R"]) {
    const bone = node.boneMap.get(key);
    if (!bone) continue;
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), furMat);
    ear.scale.set(0.42, 1.65, 0.22);
    ear.position.y = 0.12;
    bone.add(ear);
  }
}

function frameCreature(creature, kind) {
  creature.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(creature);
  const size = box.getSize(new THREE.Vector3());
  const targetH = kind === "fish" ? 0.62 : kind === "insect" ? 0.82 : 1.35;
  if (size.y > 1e-5) creature.scale.multiplyScalar(targetH / size.y);
  creature.updateMatrixWorld(true);
  const nextBox = new THREE.Box3().setFromObject(creature);
  const center = nextBox.getCenter(new THREE.Vector3());
  creature.position.x -= center.x;
  creature.position.z -= center.z;
  creature.updateMatrixWorld(true);
  const grounded = new THREE.Box3().setFromObject(creature);
  const floatY = kind === "fish" ? 0.42 : kind === "insect" ? 0.72 : 0;
  creature.position.y += floatY - grounded.min.y;
  state.creatureBaseY = creature.position.y;
}

function updateCreature(dt, time) {
  const creature = state.creature;
  if (!creature) return;
  const kind = resolveCreatureKind(state.creatureKind);
  const moving = state.behavior !== "IDLE";
  const speed = state.behavior === "LEAP" ? 1.8 : state.behavior === "FORAGE" ? 0.55 : 0.82;
  state.gait = (state.gait + (moving ? dt * speed * 0.8 : dt * 0.08)) % 1;
  state.orbit += moving ? dt * speed * 0.34 : 0;

  if (moving) {
    const rx = kind === "fish" ? 0.8 : 0.62;
    const rz = kind === "fish" ? 0.42 : 0.32;
    const tx = Math.sin(state.orbit) * rx;
    const tz = Math.cos(state.orbit) * rz;
    const dx = tx - creature.position.x;
    const dz = tz - creature.position.z;
    creature.position.x += dx * Math.min(dt * 3, 1);
    creature.position.z += dz * Math.min(dt * 3, 1);
    if (Math.hypot(dx, dz) > 0.001) creature.rotation.y = Math.atan2(dx, dz);
  } else {
    creature.rotation.y += Math.sin(time * 0.4) * dt * 0.05;
  }

  const leap = state.behavior === "LEAP" ? Math.max(0, Math.sin(state.gait * Math.PI * 2)) : 0;
  if (kind === "fish") {
    creature.position.y = state.creatureBaseY + Math.sin(time * 1.8) * 0.05;
    tickFish(creature, time);
    return;
  }
  if (kind === "insect") {
    creature.position.y = state.creatureBaseY + Math.sin(time * 2.1) * 0.12 + leap * 0.18;
    tickButterflies(creature, time);
    return;
  }

  creature.position.y = state.creatureBaseY + leap * 0.2;
  const rec = state.creatureRecord || {};
  const driverState = state.behavior === "FORAGE" ? "CREEP" : moving ? "WALK" : "IDLE";
  if (creature.userData.driver?.kind === "avian") {
    tickAvian(creature.userData.driver.built, driverState, { dt, time, gait: state.gait, leap });
    return;
  }
  if (creature.setBehaviorState) creature.setBehaviorState(driverState);
  creature.tick?.({
    dt,
    time,
    gait: state.gait,
    moving: moving ? 1 : 0,
    gaitAmp: rec.gait?.swing ?? 1,
    spineAmp: rec.gait?.spine ?? 1,
    tailAmp: rec.gait?.tail ?? 1,
    crouch: state.behavior === "FORAGE" ? 0.7 : 0,
    lean: rec.gait?.lean ?? 0.08,
    stepLen: rec.gait?.stepLen ?? 0.18,
    creepLow: rec.gait?.creepLow ?? 0.18,
    directRegister: rec.gait?.directRegister ?? 0.7,
    leap,
    env: { isSnow: state.envResolved === "snow", slick: state.envResolved === "snow" ? 0.7 : 0.1 },
  });
}

function tickAvian(built, driverState, ctx) {
  const phase = ctx.gait * Math.PI * 2;
  const moving = driverState !== "IDLE";
  const flap = driverState === "WALK" ? Math.sin(phase) * 0.08 : driverState === "CREEP" ? 0.18 : 0.02;
  for (const wing of built.wings || []) {
    wing.pivot.rotation.z += (wing.side * (0.44 + flap + ctx.leap * 0.7) - wing.pivot.rotation.z) * 0.12;
    wing.mesh.scale.y += ((ctx.leap > 0.1 ? 1.9 : 1) - wing.mesh.scale.y) * 0.08;
  }
  if (built.head) {
    built.head.rotation.x = moving ? 0.08 + Math.pow(Math.sin(phase), 3) * 0.22 : Math.sin(ctx.time * 0.9) * 0.05;
    built.head.rotation.y = Math.sin(ctx.time * 0.7) * 0.16;
  }
  if (built.headBone) built.headBone.rotation.x = moving ? -0.14 - Math.pow(Math.sin(phase - 0.35), 3) * 0.24 : -0.05;
  for (const [i, leg] of (built.legs || []).entries()) {
    leg.rotation.x = moving ? Math.sin(phase + i * Math.PI) * 0.28 : 0;
  }
  if (built.tail) built.tail.rotation.y = Math.sin(phase) * 0.12;
}

function tickFish(group, time) {
  const tail = group.getObjectByName("fishTail");
  if (tail) tail.rotation.z = Math.sin(time * 7.5) * 0.42;
  group.rotation.z = Math.sin(time * 1.3) * 0.08;
}

function tickButterflies(root, time) {
  const butterflies = root.userData.driver?.butterflies || [];
  for (const b of butterflies) {
    const phase = time * 8 + b.userData.phase;
    b.position.y += Math.sin(phase * 0.3) * 0.001;
    b.rotation.y = Math.sin(phase * 0.2) * 0.35;
    const wingL = b.getObjectByName("wingL");
    const wingR = b.getObjectByName("wingR");
    if (wingL) wingL.rotation.y = -0.32 - Math.sin(phase) * 0.62;
    if (wingR) wingR.rotation.y = 0.32 + Math.sin(phase) * 0.62;
  }
}

async function setWallArtwork(source) {
  clearGroup(sourceGroup);
  let aspect = 1.25;
  let texture;
  if (source?.dataUrl) {
    const img = await loadImage(source.dataUrl);
    aspect = img.width / Math.max(1, img.height);
    texture = new THREE.TextureLoader().load(source.dataUrl);
  } else {
    texture = makePlaceholderTexture();
    aspect = 0.82;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  const maxW = 2.28;
  const maxH = 1.62;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 0.86 })
  );
  paper.castShadow = false;
  paper.receiveShadow = true;
  sourceGroup.add(paper);
  addArtworkFrame(w, h);
}

function addArtworkFrame(w, h) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d7145, roughness: 0.82 });
  const t = 0.055;
  const d = 0.052;
  const bars = [
    { x: 0, y: h / 2 + t / 2, w: w + t * 2, h: t },
    { x: 0, y: -h / 2 - t / 2, w: w + t * 2, h: t },
    { x: -w / 2 - t / 2, y: 0, w: t, h: h },
    { x: w / 2 + t / 2, y: 0, w: t, h },
  ];
  for (const b of bars) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, d), mat);
    mesh.position.set(b.x, b.y, 0.018);
    mesh.castShadow = true;
    sourceGroup.add(mesh);
  }
}

function makePlaceholderTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 820;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fffef8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(43,38,32,0.22)";
  ctx.lineWidth = 8;
  ctx.strokeRect(44, 44, canvas.width - 88, canvas.height - 88);
  ctx.fillStyle = "rgba(43,38,32,0.72)";
  ctx.font = "54px Songti SC, STSong, SimSun, serif";
  const chars = ["待", "君", "题", "壁"];
  chars.forEach((ch, i) => ctx.fillText(ch, canvas.width / 2 - 27, 260 + i * 78));
  return new THREE.CanvasTexture(canvas);
}

function updateSkeletonOverlay() {
  clearSkeletonOverlay();
  const creature = state.creature;
  if (!state.showSkeleton || !creature) return;
  skeletonHelper = new THREE.SkeletonHelper(creature);
  skeletonHelper.material.color.set(0xbfe7ff);
  skeletonHelper.material.transparent = true;
  skeletonHelper.material.opacity = 0.88;
  skeletonHelper.material.depthTest = false;
  skeletonHelper.renderOrder = 80;
  scene.add(skeletonHelper);
}

function clearSkeletonOverlay() {
  if (!skeletonHelper) return;
  scene.remove(skeletonHelper);
  skeletonHelper.geometry?.dispose?.();
  skeletonHelper.material?.dispose?.();
  skeletonHelper = null;
}

function updateSnow(dt, time) {
  if (!snowPoints) return;
  const pos = snowPoints.geometry.attributes.position;
  const drift = state.wind * dt * 0.55;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) - dt * (0.28 + state.wind * 0.3);
    if (y < 0.02) y = 3.1;
    pos.setY(i, y);
    pos.setX(i, pos.getX(i) + Math.sin(time + i * 0.31) * drift);
  }
  pos.needsUpdate = true;
}

function resetCamera() {
  camera.position.set(3.7, 2.1, 4.9);
  controls.target.set(0, 0.82, -0.25);
  controls.update();
}

function updateReadout() {
  const envLabel = state.envId === "auto" ? "原作色境" : (ENV_LIBRARY[state.envId]?.label || "画境");
  const resolved = ENV_LIBRARY[state.envResolved]?.label || envLabel;
  const bio = state.creatureKind === "auto" ? `${BIO_LIBRARY.auto.label} · ${BIO_LIBRARY[resolveCreatureKind("auto")]?.label}` : BIO_LIBRARY[state.creatureKind]?.label;
  const behavior = BEHAVIOR_LABEL[state.behavior] || state.behavior;
  const readout = el("state-readout");
  if (readout) readout.textContent = `${envLabel}（${resolved}） · ${bio} · ${behavior}`;
  const meta = el("source-meta");
  if (meta) meta.textContent = state.estimate
    ? `${ANATOMY_LABEL[state.estimate.anatomyType] || "轮廓"} · ${state.palette.slice(0, 3).join(" ")}`
    : "留白墙 · 默认画境";
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;
  updateSnow(dt, time);
  updateCreature(dt, time);
  if (skeletonHelper) skeletonHelper.update();
  controls.update();
  renderer.render(scene, camera);
}

function cleanPalette(palette) {
  const out = [];
  for (const hex of palette || []) {
    if (/^#[0-9a-f]{6}$/i.test(hex) && !out.includes(hex)) out.push(hex);
  }
  while (out.length < 6) out.push(DEFAULT_PALETTE[out.length]);
  return out.slice(0, 6);
}

function paletteMood(palette) {
  const mood = { green: 0, blue: 0, cool: 0 };
  for (const hex of palette || []) {
    const c = new THREE.Color(hex);
    const max = Math.max(c.r, c.g, c.b);
    if (max <= 0) continue;
    if (c.g === max && c.g > c.r * 1.05) mood.green += 1 / palette.length;
    if (c.b === max && c.b > c.r * 1.05) mood.blue += 1 / palette.length;
    if (c.b + c.g > c.r * 1.6) mood.cool += 1 / palette.length;
  }
  return mood;
}

function makeVisibleColor(hex) {
  const c = new THREE.Color(hex || DEFAULT_PALETTE[0]);
  const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  if (lum < 0.36) c.lerp(new THREE.Color(0xf2e8d5), 0.52);
  if (lum > 0.88) c.lerp(new THREE.Color(0x8a6a42), 0.28);
  return `#${c.getHexString()}`;
}

function colorToHex(value, fallback) {
  try { return new THREE.Color(value).getHex(); }
  catch (_) { return fallback; }
}

function mixHex(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

function lightenHex(hex, t) {
  return new THREE.Color(hex).lerp(new THREE.Color(0xf7edd8), t).getHex();
}

function sourceToFile(source) {
  return fetch(source.dataUrl)
    .then((res) => res.blob())
    .then((blob) => new File([blob], source.name || "wall-source.jpg", { type: blob.type || source.type || "image/jpeg" }));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片加载失败"));
    img.src = src;
  });
}

function fileToCompressedDataURL(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxSide = 1400;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片加载失败"));
    };
    img.src = url;
  });
}

function seededRandom(seedText) {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clearGroup(group) {
  if (!group) return;
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
}

function disposeObject(obj) {
  obj.traverse?.((node) => {
    node.geometry?.dispose?.();
    const mat = node.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
    else mat?.dispose?.();
  });
}

function showToast(msg) {
  const t = el("wall-toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 1800);
}

main().catch((err) => {
  console.error("[wall-workspace] init failed", err);
  setStatus("工作空间初始化失败");
  showToast(err?.message || "初始化失败");
});
