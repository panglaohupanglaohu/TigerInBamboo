// 拟生环境工作空间：home 画框原作 → 像素锁定场景抬升 → Three.js 工作区
import * as THREE from "../assets/vendor/three/three.module.js";
import { OrbitControls } from "../assets/vendor/three/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "../assets/vendor/three/jsm/loaders/GLTFLoader.js";
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

const ENVIRONMENT_CATALOG = {
  terrain: {
    label: "地势",
    note: "从原图明暗提取高程，保留画中的峰脊、坡度与岸线关系。",
    items: [
      { id: "mountain", label: "山", preset: "mountain", note: "山体量块", prompt: "mountain. mountain mass. mountain in a painting." },
      { id: "rock", label: "石", preset: "mountain", note: "原图岩色与轮廓", prompt: "rock. stone. boulder in a painting." },
      { id: "earth", label: "土", preset: "grove", note: "土色地表", prompt: "soil. earth ground. bare ground in a painting." },
      { id: "slope", label: "坡", preset: "mountain", note: "连续坡面", prompt: "hillside. slope. sloping terrain in a painting." },
      { id: "brook-bank", label: "溪", preset: "stream", note: "浅溪与两岸", prompt: "brook. creek. stream bank in a painting." },
      { id: "ravine", label: "涧", preset: "stream", note: "纵深涧谷", prompt: "ravine. gorge. mountain stream valley in a painting." },
      { id: "peak", label: "峰", preset: "mountain", note: "主峰高差", prompt: "mountain peak. summit in a painting." },
      { id: "range", label: "峦", preset: "mountain", note: "远近层峦", prompt: "mountain range. layered mountains in a painting." },
    ],
  },
  plants: {
    label: "草木",
    note: "以原图色板建立枝、叶、花层级，保留可受风驱动的结构。",
    items: [
      { id: "pine", label: "松", preset: "mountain", note: "松干与针冠", prompt: "pine tree. pine branch in a painting." },
      { id: "bamboo", label: "竹", preset: "grove", note: "竹节与叶簇", prompt: "bamboo. bamboo stalks and leaves in a painting." },
      { id: "plum", label: "梅", preset: "snow", note: "古干与梅花", prompt: "plum tree. plum blossom. flowering plum branch in a painting." },
      { id: "orchid", label: "兰", preset: "grove", note: "修叶兰瓣", prompt: "orchid plant. orchid flower in a painting." },
      { id: "chrysanthemum", label: "菊", preset: "grove", note: "重瓣菊花", prompt: "chrysanthemum flower in a painting." },
      { id: "calamus", label: "菖蒲", preset: "pond", note: "水岸剑叶", prompt: "sweet flag plant. calamus plant by water in a painting." },
      { id: "reed", label: "芦苇", preset: "pond", note: "芦秆与穗", prompt: "reeds. reed bed in a painting." },
      { id: "shore-herb", label: "岸芷", preset: "stream", note: "岸边香草", prompt: "shore herbs. plants on a river bank in a painting." },
      { id: "ting-orchid", label: "汀兰", preset: "pond", note: "沙洲兰草", prompt: "orchids on a sandbank. waterside orchid in a painting." },
      { id: "wisteria", label: "紫藤", preset: "grove", note: "藤蔓垂花", prompt: "wisteria vine. hanging wisteria flowers in a painting." },
      { id: "lotus-bloom", label: "荷花", preset: "pond", note: "出水荷叶花苞", prompt: "lotus flower and lotus leaves on water in a painting." },
      { id: "lotus", label: "莲花", preset: "pond", note: "盛放莲瓣", prompt: "blooming lotus flower in a painting." },
      { id: "camellia", label: "山茶", preset: "grove", note: "常绿叶与茶花", prompt: "camellia shrub. camellia flower in a painting." },
      { id: "azalea", label: "杜鹃", preset: "mountain", note: "山岩花簇", prompt: "azalea shrub. rhododendron flowers in a painting." },
      { id: "daylily", label: "萱草", preset: "grove", note: "长叶漏斗花", prompt: "daylily plant and flower in a painting." },
      { id: "hibiscus", label: "芙蓉", preset: "pond", note: "木芙蓉花冠", prompt: "hibiscus shrub. hibiscus flower in a painting." },
    ],
  },
  water: {
    label: "水势",
    note: "原图提供水色与岸线，实时波场提供流向、涟漪、浪峰与泡沫。",
    items: [
      { id: "brook", label: "溪水", preset: "stream", note: "窄幅顺流", prompt: "brook water. creek water in a painting.", flow: 0.72, wave: 0.035, foam: 0.06 },
      { id: "ripples", label: "涟漪", preset: "pond", note: "环形细波", prompt: "water ripples. ripples on a pond in a painting.", flow: 0.18, wave: 0.025, foam: 0.01 },
      { id: "river", label: "江流", preset: "stream", note: "宽幅定向流", prompt: "river water. flowing river in a painting.", flow: 0.84, wave: 0.065, foam: 0.16 },
      { id: "lake", label: "湖泊", preset: "pond", note: "缓慢长波", prompt: "lake water. lake surface in a painting.", flow: 0.34, wave: 0.075, foam: 0.1 },
      { id: "waves", label: "浪涛", preset: "pond", note: "叠加浪峰", prompt: "ocean waves. breaking waves in a painting.", flow: 0.9, wave: 0.15, foam: 0.68 },
      { id: "cascade", label: "飞瀑", preset: "stream", note: "急流与白沫", prompt: "waterfall. cascade. white water in a painting.", flow: 1, wave: 0.11, foam: 0.86 },
    ],
  },
};

const ATMOSPHERES = {
  paper: { bg: 0xd8cfb6, hemi: 0xf9f0dc, ground: 0x4a483b, dir: 1.05, fog: 0.24 },
  dawn: { bg: 0xd5c8af, hemi: 0xffe5bd, ground: 0x435148, dir: 1.18, fog: 0.18 },
  dusk: { bg: 0xb8aaa2, hemi: 0xf2c39c, ground: 0x2d3440, dir: 0.78, fog: 0.34 },
  moon: { bg: 0x9aa7b0, hemi: 0xcdddf2, ground: 0x202936, dir: 0.52, fog: 0.42 },
};

const BIO_LIBRARY = {
  auto: { mark: "原", label: "原作生灵", note: "从画中物种推断" },
  digitigrade: { mark: "兽", label: "虎豹犬科", note: "实例轮廓 · 趾行结构", prompt: "tiger." },
  unguligrade: { mark: "蹄", label: "鹿马蹄兽", note: "实例轮廓 · 蹄行结构", prompt: "deer." },
  saltatorial: { mark: "跃", label: "兔类小兽", note: "实例轮廓 · 跳跃结构", prompt: "rabbit." },
  avian: { mark: "禽", label: "画中禽鸟", note: "实例轮廓 · 翼羽结构", prompt: "bird." },
  fish: { mark: "鱼", label: "画中游鱼", note: "实例轮廓 · 水中深度", prompt: "fish." },
  insect: { mark: "蝶", label: "画中蝴蝶", note: "实例轮廓 · 薄翼结构", prompt: "butterfly." },
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
  envDomain: "terrain",
  envSubject: "mountain",
  envTint: DEFAULT_PALETTE[0],
  atmosphere: "paper",
  creatureKind: "auto",
  creatureColor: DEFAULT_PALETTE[0],
  behavior: "IDLE",
  showSkeleton: false,
  wind: 0.35,
  mist: 0.25,
  flow: 0.55,
  referenceMap: null,
  generationMode: "image-locked",
  sceneLiftOnline: false,
  sceneLiftSegmentation: false,
  sceneLiftResult: null,
  sceneLiftCache: new Map(),
  independentLayerCount: 0,
  reviewCandidateCount: 0,
  pbrLayerCount: 0,
  modelsExploded: false,
  bioSceneLiftResult: null,
  bioSceneLiftCache: new Map(),
  bioIndependentLayerCount: 0,
  bioReviewCandidateCount: 0,
  bioPbrLayerCount: 0,
  bioModelsExploded: false,
  bioGenerationBusy: false,
  trellisOnline: false,
  imageTo3dLabel: "图生 3D",
  generationBusy: false,
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
let bioGroup;
let sourceGroup;
let hemiLight;
let keyLight;
let fillLight;
let snowPoints = null;
let skeletonHelper = null;
let animationStarted = false;
let waterSurfaces = [];
let swayingPlants = [];
let sourceTexture = null;
let artworkFrame = null;
let artworkReferencePlane = null;
let independentLayerMeshes = new Map();
let bioLayerMeshes = new Map();
let activeReviewScope = "environment";
const candidateRaycaster = new THREE.Raycaster();
const candidatePointer = new THREE.Vector2();
const candidatePointerDown = { x: 0, y: 0 };
const gltfLoader = new GLTFLoader();
const candidateReview = {
  environment: { result: null, subject: null, selectedId: null, generatingIds: new Set(), generatedIds: new Set(), cropUrls: new Map(), previewMeshes: new Map() },
  biology: { result: null, subject: null, selectedId: null, generatingIds: new Set(), generatedIds: new Set(), cropUrls: new Map(), previewMeshes: new Map() },
};

async function main() {
  initThree();
  bindControls();
  await Promise.all([checkSceneLiftStatus(), checkTrellisStatus()]);
  await applySource(readStoredSource());
  if (!animationStarted) {
    animationStarted = true;
    animate();
  }
}

function initThree() {
  const canvas = el("wall-viewport");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
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
  bindCanvasCandidateSelection(canvas);

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

  bioGroup = new THREE.Group();
  scene.add(bioGroup);

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
  el("generate-environment")?.addEventListener("click", generateEnvironmentFromSource);
  el("separate-environment-models")?.addEventListener("click", () => setIndependentModelsExploded(true));
  el("restore-environment-models")?.addEventListener("click", () => setIndependentModelsExploded(false));
  el("generate-biology")?.addEventListener("click", generateBiologyFromSource);
  el("separate-biology-models")?.addEventListener("click", () => setBiologyModelsExploded(true));
  el("restore-biology-models")?.addEventListener("click", () => setBiologyModelsExploded(false));
  el("env-domain-tabs")?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-domain]");
    const domain = btn?.dataset.domain;
    if (!domain || !ENVIRONMENT_CATALOG[domain]) return;
    state.envDomain = domain;
    const items = ENVIRONMENT_CATALOG[domain].items;
    if (!items.some((item) => item.id === state.envSubject)) state.envSubject = items[0].id;
    renderEnvironmentButtons();
    renderSegments();
    setEnvironment(state.envSubject);
  });
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
    updateBiologyModelState();
    updateReadout();
  });

  el("wind-range")?.addEventListener("input", (event) => {
    state.wind = parseFloat(event.target.value);
  });
  el("mist-range")?.addEventListener("input", (event) => {
    state.mist = parseFloat(event.target.value);
    applyAtmosphere();
  });
  el("flow-range")?.addEventListener("input", (event) => {
    state.flow = parseFloat(event.target.value);
    for (const water of waterSurfaces) water.material.uniforms.uFlow.value = state.flow;
  });
  el("skeleton-toggle")?.addEventListener("click", () => {
    state.showSkeleton = !state.showSkeleton;
    const btn = el("skeleton-toggle");
    btn?.setAttribute("aria-pressed", String(state.showSkeleton));
    btn?.classList.toggle("active", state.showSkeleton);
    updateSkeletonOverlay();
  });
  el("rebuild-creature")?.addEventListener("click", () => {
    clearBiologyModels();
    buildCreature(state.creatureKind);
    showToast("已启用程序化备选；原画识别模型可随时重新生成");
  });
}

async function applySource(source) {
  state.source = source || null;
  state.estimate = null;
  state.palette = [...DEFAULT_PALETTE];
  state.envTint = DEFAULT_PALETTE[0];
  state.creatureColor = DEFAULT_PALETTE[0];
  state.referenceMap = null;
  state.sceneLiftResult = null;
  state.sceneLiftCache = new Map();
  state.independentLayerCount = 0;
  state.reviewCandidateCount = 0;
  state.pbrLayerCount = 0;
  state.modelsExploded = false;
  independentLayerMeshes = new Map();
  state.bioSceneLiftResult = null;
  state.bioSceneLiftCache = new Map();
  state.bioIndependentLayerCount = 0;
  state.bioReviewCandidateCount = 0;
  state.bioPbrLayerCount = 0;
  state.bioModelsExploded = false;
  state.bioGenerationBusy = false;
  bioLayerMeshes = new Map();
  state.generationMode = "image-locked";
  resetReviewState("environment");
  resetReviewState("biology");
  updateSourceCopy();
  await setWallArtwork(state.source);

  if (state.source?.dataUrl) {
    setStatus("正在把 home 画框中的原作解析为环境母版…");
    try {
      const file = await sourceToFile(state.source);
      const [estimate, referenceMap] = await Promise.all([
        analyzeAndEstimate(file),
        sampleReferenceMap(state.source.dataUrl),
      ]);
      state.estimate = estimate;
      state.referenceMap = referenceMap;
      state.palette = cleanPalette(estimate.palette);
      state.envTint = pickEnvironmentTint(state.palette);
      state.creatureColor = makeVisibleColor(estimate.bestHex || state.palette[0]);
      const inferredEnvironment = inferEnvironmentFromArtwork();
      state.envDomain = inferredEnvironment.domain;
      state.envSubject = inferredEnvironment.subject;
      state.envId = state.envSubject;
      state.creatureKind = "auto";
      setStatus(`原画像素已锁定 · ${ENVIRONMENT_CATALOG[state.envDomain].label} / ${environmentSubject(state.envSubject)?.label}`);
    } catch (err) {
      console.error("[wall-workspace] image analysis failed", err);
      setStatus("原作已载入；深度解析暂使用本地图像浮雕");
    }
  } else {
    state.envDomain = "terrain";
    state.envSubject = "mountain";
    state.envId = state.envSubject;
    state.creatureKind = "auto";
    setStatus("请先在 home 页第三个画框中填入图画");
  }

  renderMenus();
  setEnvironment(state.envSubject);
  clearCreatureFromScene();
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
  const envName = el("environment-source-name");
  const envPreview = el("environment-source-preview");
  if (state.source?.dataUrl) {
    const name = state.source.name || "画框原作";
    if (title) title.textContent = name;
    if (meta) meta.textContent = "home 画框母版 · 已对映";
    if (envName) envName.textContent = name;
    if (envPreview) {
      envPreview.src = state.source.dataUrl;
      envPreview.hidden = false;
    }
  } else {
    if (title) title.textContent = "尚未选择画作";
    if (meta) meta.textContent = "请从 home 画框进入";
    if (envName) envName.textContent = "等待 home 画框中的图画";
    if (envPreview) {
      envPreview.hidden = true;
      envPreview.removeAttribute("src");
    }
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
  const catalog = ENVIRONMENT_CATALOG[state.envDomain] || ENVIRONMENT_CATALOG.terrain;
  for (const opt of catalog.items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "wall-subject-btn";
    btn.textContent = opt.label;
    btn.title = opt.note;
    btn.classList.toggle("active", state.envSubject === opt.id);
    btn.addEventListener("click", () => setEnvironment(opt.id));
    wrap.appendChild(btn);
  }
  const selected = environmentSubject(state.envSubject) || catalog.items[0];
  const note = el("environment-note");
  if (note) {
    const result = state.sceneLiftCache.get(selected.id);
    const count = result?.layers?.length || 0;
    const suffix = result
      ? (count ? `已识别 ${count} 个候选，请先确认裁剪，再生成 3D 模型。` : "画中未确认该要素，系统不会生成替代物。")
      : "点击“识别候选对象”提取实例裁剪、深度和画中坐标。";
    note.textContent = `${catalog.label} · ${selected.label}：${selected.note}；${suffix}`;
  }
}

function renderBioButtons() {
  const wrap = el("bio-buttons");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const opt of bioOptions()) {
    const btn = makeToolButton(opt, state.creatureKind === opt.id);
    btn.addEventListener("click", () => selectBiologySubject(opt.id));
    wrap.appendChild(btn);
  }
  updateBiologySelectionNote();
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
    if (scope === "env") {
      btn.disabled = true;
      btn.title = `${hex} · 原画固有色（锁位重建不改写）`;
      wrap.appendChild(btn);
      return;
    }
    if (scope === "bio" && state.source?.dataUrl) {
      btn.disabled = true;
      btn.title = `${hex} · 原画固有色（识别模型不改写）`;
      wrap.appendChild(btn);
      return;
    }
    btn.addEventListener("click", () => {
      state.creatureColor = makeVisibleColor(hex);
      buildCreature(state.creatureKind);
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
  document.querySelectorAll("#env-domain-tabs button[data-domain]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.domain === state.envDomain);
  });
}

function environmentSubject(id) {
  for (const [domain, catalog] of Object.entries(ENVIRONMENT_CATALOG)) {
    const item = catalog.items.find((candidate) => candidate.id === id);
    if (item) return { ...item, domain };
  }
  return null;
}

function inferEnvironmentFromArtwork() {
  const name = `${state.source?.name || ""}`.toLowerCase();
  if (/tiger|竹虎|虎|bamboo/.test(name)) return { domain: "terrain", subject: "ravine" };
  if (/plum|梅|goose|雁/.test(name)) return { domain: "plants", subject: "plum" };
  const mood = paletteMood(state.palette);
  if (mood.blue > 0.18) return { domain: "water", subject: "lake" };
  if (mood.green > 0.16) return { domain: "plants", subject: "bamboo" };
  if (state.estimate?.anatomyType === "AVES") return { domain: "water", subject: "ripples" };
  return { domain: "terrain", subject: "mountain" };
}

function bioOptions() {
  const ids = ["auto"];
  const add = (id) => { if (!ids.includes(id)) ids.push(id); };
  const inferred = biologySubject("auto").kind;
  add(inferred);
  if (inferred === "avian") add("fish");
  if (inferred === "digitigrade") add("saltatorial");
  if (inferred === "unguligrade") add("avian");
  ["digitigrade", "unguligrade", "saltatorial", "avian", "fish", "insect"].forEach(add);
  return ids.map((id) => ({ id, ...BIO_LIBRARY[id] }));
}

function biologySubject(kind = state.creatureKind) {
  let resolved = resolveCreatureKind(kind);
  const name = `${state.source?.name || ""}`.toLowerCase();
  let prompt = BIO_LIBRARY[resolved]?.prompt || "animal.";
  if (kind === "auto") {
    if (/tiger|竹虎|虎/.test(name)) {
      prompt = "tiger.";
      resolved = "digitigrade";
    } else if (/plum|goose|雁/.test(name)) {
      prompt = "goose.";
      resolved = "avian";
    } else if (/crane|鹤/.test(name)) {
      prompt = "crane.";
      resolved = "avian";
    } else if (/fish|鱼/.test(name)) {
      prompt = "fish.";
      resolved = "fish";
    } else if (/butterfly|蝶/.test(name)) {
      prompt = "butterfly.";
      resolved = "insect";
    }
  }
  const promptKey = prompt.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || resolved;
  return {
    id: `biology-${kind}-${promptKey}`,
    kind: resolved,
    domain: "biology",
    label: kind === "auto" ? `${BIO_LIBRARY.auto.label}（${BIO_LIBRARY[resolved]?.label || "生物"}）` : BIO_LIBRARY[kind]?.label || "画中生灵",
    prompt,
  };
}

function selectBiologySubject(kind) {
  state.creatureKind = kind;
  state.bioModelsExploded = false;
  clearCreatureFromScene({ keepBiology: true });
  const subject = biologySubject(kind);
  const cached = state.bioSceneLiftCache.get(subject.id);
  if (cached) {
    if (candidateReview.biology.subject?.id !== subject.id || candidateReview.biology.result !== cached) {
      installBiologySceneLiftResult(cached, subject);
    }
  } else {
    clearBiologyModels();
  }
  renderBioButtons();
  renderPalette("bio-palette", "bio");
  updateBiologyModelState(subject);
  updateReadout();
}

function updateBiologySelectionNote() {
  const note = el("biology-note");
  if (!note) return;
  const subject = biologySubject();
  const result = state.bioSceneLiftCache.get(subject.id);
  const count = result?.layers?.length || 0;
  const suffix = result
    ? (count ? `已识别 ${count} 个候选，请确认裁剪后再生成生物 3D 模型。` : "画中未确认该生物，不生成替代物。")
    : "点击“识别候选生灵”提取实例裁剪、深度与坐标。";
  note.textContent = `${subject.label} · 识别提示“${subject.prompt.replace(/\.$/, "")}”；${suffix}`;
}

async function checkSceneLiftStatus() {
  const badge = el("scene-lift-status");
  try {
    const response = await fetch("/api/scene-lift/status", { cache: "no-store" });
    const info = await response.json();
    state.sceneLiftOnline = Boolean(response.ok && info.available);
    state.sceneLiftSegmentation = Boolean(info.capabilities?.segmentation);
    if (badge) {
      badge.dataset.state = state.sceneLiftOnline ? "online" : "offline";
      badge.textContent = state.sceneLiftOnline ? "已连接" : "待连接";
      badge.title = info.reason || `${info.geometry || "MapAnything"} · ${info.segmentation || "Grounded SAM 2"}`;
    }
    const line = el("generation-state");
    if (line) {
      line.textContent = state.sceneLiftOnline
        ? (state.sceneLiftSegmentation ? "可识别候选裁剪 · 等待确认" : "深度可用 · 语义分割待连接")
        : "AI 识别服务待连接";
    }
    const biologyLine = el("biology-generation-state");
    if (biologyLine) {
      biologyLine.textContent = state.sceneLiftOnline && state.sceneLiftSegmentation
        ? "可识别候选裁剪 · 等待确认"
        : "Grounded SAM 2 实例分割待连接";
    }
  } catch (_) {
    state.sceneLiftOnline = false;
    state.sceneLiftSegmentation = false;
    if (badge) {
      badge.dataset.state = "offline";
      badge.textContent = "待连接";
    }
    const biologyLine = el("biology-generation-state");
    if (biologyLine) biologyLine.textContent = "生物实例分割服务待连接";
    const line = el("generation-state");
    if (line) line.textContent = "AI 识别服务待连接";
  }
}

async function checkTrellisStatus() {
  const badge = el("trellis-status");
  try {
    const response = await fetch("/api/trellis2/status", { cache: "no-store" });
    const info = await response.json();
    state.trellisOnline = Boolean(response.ok && info.available);
    state.imageTo3dLabel = resolveImageTo3dLabel(info);
    if (badge) {
      badge.dataset.state = state.trellisOnline ? "online" : "offline";
      badge.textContent = state.trellisOnline ? `${state.imageTo3dLabel} 已连接` : `${state.imageTo3dLabel} 待连接`;
      badge.title = info.reason || info.model || "";
    }
  } catch (_) {
    state.trellisOnline = false;
    state.imageTo3dLabel = "图生 3D";
    if (badge) {
      badge.dataset.state = "offline";
      badge.textContent = "图生3D待连接";
    }
  }
}

function resolveImageTo3dLabel(info = {}) {
  const engine = `${info.engine || ""}`.toLowerCase();
  const model = `${info.model || ""}`;
  if (engine.includes("triposr") || model.toLowerCase().includes("triposr")) return "TripoSR";
  if (engine.includes("trellis") || model.toLowerCase().includes("trellis")) return "TRELLIS.2";
  return model || "图生 3D";
}

function imageTo3dLabel() {
  return state.imageTo3dLabel || "图生 3D";
}

async function generateEnvironmentFromSource() {
  if (state.generationBusy) return;
  if (!state.source?.dataUrl) {
    showToast("请先在 home 页第三个画框中填入图画");
    return;
  }
  const button = el("generate-environment");
  const line = el("generation-state");
  const subject = environmentSubject(state.envSubject);
  const cached = state.sceneLiftCache.get(subject.id);
  if (cached) {
    installCandidateReview("environment", cached, subject);
    if (line) line.textContent = describeSceneLiftResult(cached, subject);
    showToast(`已恢复“${subject.label}”候选，请确认裁剪后生成 3D`);
    return;
  }
  if (!state.sceneLiftOnline || !state.sceneLiftSegmentation) {
    if (line) line.textContent = "识别服务未连接 · 不生成剪影替代物";
    showToast("需要 Grounded SAM 2 先识别候选裁剪");
    return;
  }
  state.generationBusy = true;
  if (button) button.disabled = true;
  if (line) line.textContent = `正在识别“${subject.label}”候选，并准备给你审裁剪…`;
  try {
    const response = await fetch("/api/scene-lift/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: state.source.dataUrl,
        name: state.source.name || "artwork",
        domain: subject.domain,
        subject: { id: subject.id, label: subject.label, prompt: subject.prompt },
        gridMaxSide: 320,
      }),
    });
    if (!response.ok) {
      let message = `转换失败（${response.status}）`;
      try { message = (await response.json()).detail || message; } catch (_) { /* ignore */ }
      throw new Error(message);
    }
    const result = await response.json();
    validateSceneLiftResult(result);
    const segmentationFailure = result.warnings?.find((warning) => warning.startsWith("semantic segmentation unavailable:"));
    if (state.sceneLiftSegmentation && segmentationFailure) {
      throw new Error(segmentationFailure.replace("semantic segmentation unavailable:", "对象分割失败："));
    }
    state.sceneLiftCache.set(subject.id, result);
    installCandidateReview("environment", result, subject);
    if (line) line.textContent = describeSceneLiftResult(result, subject);
    showToast(result.layers?.length ? `请检查“${subject.label}”裁剪，确认后再生成 3D` : `未在画中确认“${subject.label}”，未凭空生成`);
  } catch (err) {
    console.error("[wall-workspace] scene lift failed", err);
    const currentLine = el("generation-state");
    if (currentLine) currentLine.textContent = `AI 转换失败 · ${err?.message || "未知错误"}`;
    showToast(err?.message || "场景转换失败");
  } finally {
    state.generationBusy = false;
    if (button) button.disabled = false;
  }
}

function validateSceneLiftResult(result) {
  const depth = result?.depth;
  if (!depth || !Number.isInteger(depth.width) || !Number.isInteger(depth.height) || !Array.isArray(depth.values)) {
    throw new Error("场景转换服务没有返回有效深度图");
  }
  if (depth.values.length !== depth.width * depth.height) {
    throw new Error("场景转换服务返回的深度图尺寸不一致");
  }
}

function installSceneLiftResult(result, subject) {
  installCandidateReview("environment", result, subject);
}

function describeSceneLiftResult(result, subject) {
  const count = result.layers?.length || 0;
  const geometry = result.engine?.geometry || "MapAnything";
  if (!count) return `${geometry} 深度已读 · 画中未识别到“${subject.label}”候选`;
  return `${geometry} 深度 + Grounded SAM 2 · ${count} 个“${subject.label}”候选待确认`;
}

async function generateBiologyFromSource() {
  if (state.bioGenerationBusy) return;
  if (!state.source?.dataUrl) {
    showToast("请先在 home 页第三个画框中填入图画");
    return;
  }
  const button = el("generate-biology");
  const subject = biologySubject();
  const cached = state.bioSceneLiftCache.get(subject.id);
  if (cached) {
    installCandidateReview("biology", cached, subject);
    const line = el("biology-generation-state");
    if (line) line.textContent = describeBiologyResult(cached, subject);
    showToast(`已恢复“${subject.label}”候选，请确认裁剪后生成 3D`);
    return;
  }
  if (!state.sceneLiftOnline || !state.sceneLiftSegmentation) {
    const line = el("biology-generation-state");
    if (line) line.textContent = "实例分割引擎未连接 · 不生成替代生物";
    showToast("需要 Grounded SAM 2 才能建立与原画对映的生物实例");
    return;
  }

  state.bioGenerationBusy = true;
  if (button) button.disabled = true;
  const initialLine = el("biology-generation-state");
  if (initialLine) initialLine.textContent = `正在识别“${subject.label}”候选，并准备给你审裁剪…`;
  try {
    const response = await fetch("/api/scene-lift/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: state.source.dataUrl,
        name: state.source.name || "artwork",
        domain: "biology",
        subject: { id: subject.id, label: subject.label, prompt: subject.prompt },
        gridMaxSide: 320,
      }),
    });
    if (!response.ok) {
      let message = `生物转换失败（${response.status}）`;
      try { message = (await response.json()).detail || message; } catch (_) { /* ignore */ }
      throw new Error(message);
    }
    const result = await response.json();
    validateSceneLiftResult(result);
    const segmentationFailure = result.warnings?.find((warning) => warning.startsWith("semantic segmentation unavailable:"));
    if (segmentationFailure) throw new Error(segmentationFailure.replace("semantic segmentation unavailable:", "生物实例分割失败："));

    state.bioSceneLiftCache.set(subject.id, result);
    installCandidateReview("biology", result, subject);
    const line = el("biology-generation-state");
    if (line) line.textContent = describeBiologyResult(result, subject);
    showToast(result.layers?.length ? `请检查“${subject.label}”裁剪，确认后再生成 3D` : `画中未确认“${subject.label}”，未生成替代物`);
  } catch (err) {
    console.error("[wall-workspace] biology scene lift failed", err);
    clearBiologyModels();
    const line = el("biology-generation-state");
    if (line) line.textContent = `生物转换失败 · ${err?.message || "未知错误"}`;
    showToast(err?.message || "生物实例转换失败");
  } finally {
    state.bioGenerationBusy = false;
    const currentButton = el("generate-biology");
    if (currentButton) currentButton.disabled = false;
    updateReadout();
  }
}

function biologyReferenceMap(result) {
  return referenceMapFromResult(result);
}

function referenceMapFromResult(result) {
  return {
    width: result.depth.width,
    height: result.depth.height,
    values: Float32Array.from(result.depth.values),
    validRle: result.depth.validRle || null,
    aspect: result.image?.width && result.image?.height ? result.image.width / result.image.height : undefined,
    source: result.engine?.geometry || "MapAnything",
  };
}

function resetReviewState(scope) {
  const review = candidateReview[scope];
  if (!review) return;
  review.result = null;
  review.subject = null;
  review.selectedId = null;
  review.generatingIds = new Set();
  review.generatedIds = new Set();
  review.cropUrls = new Map();
  review.previewMeshes = new Map();
  const panel = el(scope === "biology" ? "biology-candidate-panel" : "environment-candidate-panel");
  if (panel) {
    panel.hidden = true;
    panel.innerHTML = "";
  }
  if (scope === "biology") state.bioReviewCandidateCount = 0;
  else state.reviewCandidateCount = 0;
}

function installCandidateReview(scope, result, subject) {
  const isBiology = scope === "biology";
  const review = candidateReview[scope];
  if (!review) return;
  activeReviewScope = scope;
  const ref = referenceMapFromResult(result);
  review.result = result;
  review.subject = subject;
  review.selectedId = null;
  review.generatingIds = new Set();
  review.generatedIds = new Set();
  review.cropUrls = new Map();
  review.previewMeshes = new Map();

  if (isBiology) {
    state.bioSceneLiftResult = result;
    state.bioPbrLayerCount = 0;
    state.bioIndependentLayerCount = 0;
    state.bioModelsExploded = false;
    bioLayerMeshes = new Map();
    clearGroup(bioGroup);
    if (state.creature) {
      scene.remove(state.creature);
      disposeObject(state.creature);
      state.creature = null;
    }
    clearSkeletonOverlay();
    state.creatureRecord = null;
  } else {
    state.sceneLiftResult = result;
    state.referenceMap = ref;
    state.generationMode = "candidate-review";
    state.pbrLayerCount = 0;
    state.independentLayerCount = 0;
    state.modelsExploded = false;
    independentLayerMeshes = new Map();
    clearGroup(envGroup);
    snowPoints = null;
    waterSurfaces = [];
    swayingPlants = [];
  }

  const count = buildCandidatePreviewAnchors(scope, result, subject, ref);
  if (isBiology) state.bioReviewCandidateCount = count;
  else state.reviewCandidateCount = count;

  const firstLayer = reviewLayerList(scope)[0];
  if (firstLayer) setReviewSelection(scope, firstLayer.id, false);
  renderCandidateReview(scope);
  if (isBiology) {
    updateBiologySelectionNote();
    updateBiologyModelState(subject);
    renderBioButtons();
  } else {
    updateIndependentModelState(subject);
    renderEnvironmentButtons();
  }
  updateReadout();
}

function buildCandidatePreviewAnchors(scope, result, subject, ref) {
  const review = candidateReview[scope];
  const group = scope === "biology" ? bioGroup : envGroup;
  const frame = syncArtworkReferencePlane(ref, 1) || ensureArtworkFrame(ref);
  const layers = (result.layers || []).filter((layer) => layer.subjectId === subject.id);
  for (const layer of layers) {
    const entity = createCandidatePreviewEntity(scope, ref, layer, frame);
    if (!entity) continue;
    group.add(entity);
    review.previewMeshes.set(layer.id, entity);
  }
  frameArtworkCamera(false);
  return review.previewMeshes.size;
}

function ensureArtworkFrame(ref) {
  const aspect = clamp(ref.aspect || ref.width / ref.height || 1.6, 0.45, 3.4);
  const width = aspect >= 1 ? 5.8 : 5.8 * aspect;
  const height = width / aspect;
  const centerY = Math.max(1.72, height * 0.5 + 0.08);
  const baseZ = -1.35;
  artworkFrame = { width, height, centerY, z: baseZ };
  return artworkFrame;
}

function setThreeSourceBackdropActive(active) {
  const shell = el("wall-viewport")?.parentElement;
  shell?.classList.toggle("three-source-active", Boolean(active));
}

function clearArtworkReferencePlane() {
  if (!artworkReferencePlane) return;
  scene?.remove(artworkReferencePlane);
  disposeObject(artworkReferencePlane);
  artworkReferencePlane = null;
}

function syncArtworkReferencePlane(ref, opacity = 1) {
  if (!scene || !sourceTexture || !ref) return null;
  const frame = ensureArtworkFrame(ref);
  clearArtworkReferencePlane();
  const material = new THREE.MeshBasicMaterial({
    map: sourceTexture,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(frame.width, frame.height), material);
  plane.name = "artwork-reference-plane";
  plane.position.set(0, frame.centerY, frame.z - 0.035);
  plane.renderOrder = 0;
  plane.userData = { artworkReferencePlane: true };
  scene.add(plane);
  artworkReferencePlane = plane;
  setThreeSourceBackdropActive(true);
  return frame;
}

function createCandidatePreviewEntity(scope, ref, layer, frame) {
  const mask = decodeMaskRle(layer.maskRle, ref.width * ref.height);
  const isolated = createIndependentLayerGeometry(ref, mask, layer, frame.width, frame.height, false);
  if (!isolated) return null;
  const color = scope === "biology" ? 0xb94c3e : 0xdab25d;
  const fill = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const surface = new THREE.Mesh(isolated.geometry, fill);
  surface.renderOrder = 28;
  surface.userData = {
    reviewAnchor: true,
    scope,
    layerId: layer.id,
    sourceBbox: layer.bbox,
    sourceAnchor: layer.anchor || null,
  };
  const outline = new THREE.Mesh(
    isolated.geometry.clone(),
    new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.42,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
  );
  outline.renderOrder = 29;
  outline.userData = { reviewOutline: true, scope, layerId: layer.id };

  const entity = new THREE.Group();
  entity.position.set(isolated.anchor.x, frame.centerY + isolated.anchor.y, frame.z + isolated.anchor.z + 0.1);
  entity.userData = {
    reviewCandidate: true,
    scope,
    independentModel: true,
    layerId: layer.id,
    subjectId: layer.subjectId,
    sourceBbox: layer.bbox,
    sourceAnchor: layer.anchor || null,
    homePosition: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
    surface,
    outline,
  };
  entity.add(surface, outline);
  return entity;
}

function bindCanvasCandidateSelection(canvas) {
  canvas.addEventListener("pointerdown", (event) => {
    candidatePointerDown.x = event.clientX;
    candidatePointerDown.y = event.clientY;
  });
  canvas.addEventListener("pointerup", (event) => {
    const dx = event.clientX - candidatePointerDown.x;
    const dy = event.clientY - candidatePointerDown.y;
    if (Math.hypot(dx, dy) > 6) return;
    selectCandidateFromCanvas(event);
  });
}

function selectCandidateFromCanvas(event) {
  if (!camera || !renderer) return false;
  const candidateRoots = [
    ...candidateReview.environment.previewMeshes.values(),
    ...candidateReview.biology.previewMeshes.values(),
  ];
  if (!candidateRoots.length) return false;
  const rect = renderer.domElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  candidatePointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  candidatePointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  candidateRaycaster.setFromCamera(candidatePointer, camera);
  const hits = candidateRaycaster.intersectObjects(candidateRoots, true);
  const candidates = [];
  for (const hit of hits) {
    const candidate = findCandidateEntity(hit.object);
    const scope = candidate?.userData?.scope;
    const layerId = candidate?.userData?.layerId;
    if (!scope || !layerId || !candidateReview[scope]?.previewMeshes.has(layerId)) continue;
    candidates.push({ scope, layerId });
  }
  const picked = candidates.find((candidate) => candidate.scope === activeReviewScope) || candidates[0];
  if (picked) {
    setReviewSelection(picked.scope, picked.layerId);
    const label = candidateReview[picked.scope]?.subject?.label || "候选";
    showToast(`已选中画中“${label}”候选，可确认生成 3D`);
    return true;
  }
  return false;
}

function findCandidateEntity(object) {
  let node = object;
  while (node) {
    if (node.userData?.reviewCandidate) return node;
    node = node.parent;
  }
  return null;
}

function reviewLayerList(scope) {
  const review = candidateReview[scope];
  if (!review?.result || !review.subject) return [];
  return (review.result.layers || []).filter((layer) => layer.subjectId === review.subject.id && review.previewMeshes.has(layer.id));
}

function setReviewSelection(scope, layerId, render = true) {
  const review = candidateReview[scope];
  if (!review || !layerId) return;
  activeReviewScope = scope;
  review.selectedId = layerId;
  for (const [id, entity] of review.previewMeshes.entries()) {
    applyCandidateVisualState(scope, id, entity);
  }
  if (render) {
    renderCandidateReview(scope);
    scrollSelectedCandidateCard(scope);
  }
}

function scrollSelectedCandidateCard(scope) {
  const review = candidateReview[scope];
  const panel = el(scope === "biology" ? "biology-candidate-panel" : "environment-candidate-panel");
  if (!panel || !review?.selectedId) return;
  requestAnimationFrame(() => {
    const card = [...panel.querySelectorAll(".wall-candidate-card")]
      .find((candidateCard) => candidateCard.dataset.layerId === review.selectedId);
    card?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}

function applyCandidateVisualState(scope, layerId, entity) {
  const review = candidateReview[scope];
  const selected = review.selectedId === layerId;
  const generated = review.generatedIds.has(layerId);
  const generating = review.generatingIds.has(layerId);
  const fill = entity.userData.surface?.material;
  const outline = entity.userData.outline?.material;
  const color = generated ? 0x73c58f : generating ? 0xdab25d : scope === "biology" ? 0xb94c3e : 0xdab25d;
  if (fill) {
    fill.color.setHex(color);
    fill.opacity = generated ? (selected ? 0.18 : 0.04) : selected ? 0.46 : 0.16;
    fill.needsUpdate = true;
  }
  if (outline) {
    outline.color.setHex(color);
    outline.opacity = selected ? 0.76 : generated ? 0.28 : 0.34;
    outline.needsUpdate = true;
  }
  if (entity.userData.surface) entity.userData.surface.visible = !generated;
  if (entity.userData.outline) entity.userData.outline.visible = selected || !generated;
}

function renderCandidateReview(scope) {
  const isBiology = scope === "biology";
  const panel = el(isBiology ? "biology-candidate-panel" : "environment-candidate-panel");
  const review = candidateReview[scope];
  if (!panel || !review?.result || !review.subject) {
    if (panel) panel.hidden = true;
    return;
  }
  const layers = reviewLayerList(scope);
  panel.hidden = false;
  panel.innerHTML = "";

  const head = document.createElement("div");
  head.className = "wall-candidate-head";
  const title = document.createElement("b");
  title.textContent = layers.length ? `${layers.length} 个候选 · 请确认裁剪是否正确` : "未识别到候选";
  const prompt = document.createElement("span");
  prompt.textContent = layers.length
    ? `点画中高亮区域或候选卡来选取；确认后才调用 ${imageTo3dLabel()} 生成真正 GLB 模型。`
    : "没有通过分割审查的对象，系统不会用剪影或随机模型顶替。";
  head.append(title, prompt);
  panel.appendChild(head);

  for (const [index, layer] of layers.entries()) {
    const card = document.createElement("div");
    card.className = "wall-candidate-card";
    card.dataset.layerId = layer.id;
    card.classList.toggle("is-selected", review.selectedId === layer.id);
    card.classList.toggle("is-generated", review.generatedIds.has(layer.id));
    card.addEventListener("click", () => setReviewSelection(scope, layer.id));

    const image = document.createElement("img");
    image.alt = `${review.subject.label} 候选裁剪`;
    image.src = cropUrlForReview(scope, layer);

    const copy = document.createElement("div");
    copy.className = "wall-candidate-copy";
    const label = document.createElement("b");
    label.textContent = `${review.subject.label}候选 ${index + 1}`;
    const score = document.createElement("small");
    score.textContent = candidateMeta(layer);
    const actions = document.createElement("div");
    actions.className = "wall-candidate-actions";

    const select = document.createElement("button");
    select.type = "button";
    select.textContent = review.selectedId === layer.id ? "已高亮" : "高亮位置";
    select.disabled = review.selectedId === layer.id;
    select.addEventListener("click", (event) => {
      event.stopPropagation();
      setReviewSelection(scope, layer.id);
    });

    const generate = document.createElement("button");
    generate.type = "button";
    const generated = review.generatedIds.has(layer.id);
    const generating = review.generatingIds.has(layer.id);
    generate.textContent = generated ? "已生成 GLB" : generating ? "生成中" : "确认生成3D";
    generate.disabled = generated || generating;
    generate.addEventListener("click", (event) => {
      event.stopPropagation();
      confirmReviewLayer(scope, layer.id);
    });

    actions.append(select, generate);
    copy.append(label, score, actions);
    card.append(image, copy);
    panel.appendChild(card);
  }
}

function candidateMeta(layer) {
  const score = Number.isFinite(layer.score) ? `置信 ${Math.round(layer.score * 100)}%` : "语义候选";
  const area = Number.isFinite(layer.coverage) ? `覆盖 ${(layer.coverage * 100).toFixed(1)}%` : "";
  return [score, area, "透明 PNG 裁剪"].filter(Boolean).join(" · ");
}

function cropUrlForReview(scope, layer) {
  const review = candidateReview[scope];
  if (review.cropUrls.has(layer.id)) return review.cropUrls.get(layer.id);
  try {
    const ref = scope === "biology" ? referenceMapFromResult(review.result) : state.referenceMap;
    const url = createLayerCropDataUrl(layer, ref);
    review.cropUrls.set(layer.id, url);
    return url;
  } catch (err) {
    console.warn("[wall-workspace] candidate crop failed", err);
    return transparentPixel();
  }
}

function transparentPixel() {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8BQDwAFgwJ/l9gdrwAAAABJRU5ErkJggg==";
}

async function confirmReviewLayer(scope, layerId) {
  const review = candidateReview[scope];
  const layer = reviewLayerList(scope).find((candidate) => candidate.id === layerId);
  if (!review?.subject || !layer) return;
  setReviewSelection(scope, layerId);
  await checkTrellisStatus();
  const line = el(scope === "biology" ? "biology-generation-state" : "generation-state");
  if (!state.trellisOnline) {
    if (line) line.textContent = "图生 3D 引擎未连接 · 候选已高亮，但不会用剪影冒充 3D";
    showToast("图生 3D 引擎未连接，无法生成真正 GLB");
    return;
  }

  review.generatingIds.add(layerId);
  applyCandidateVisualState(scope, layerId, review.previewMeshes.get(layerId));
  renderCandidateReview(scope);
  if (line) line.textContent = `正在把“${review.subject.label}”候选送入 ${imageTo3dLabel()} 图生 3D…`;
  try {
    const crop = cropUrlForReview(scope, layer);
    const response = await fetch("/api/trellis2/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: crop,
        name: `${state.source?.name || "artwork"}-${scope}-${layer.id}`,
        domain: review.subject.domain,
        subject: review.subject.id,
        layerId: layer.id,
        seed: (scope === "biology" ? 4126 : 2026) + review.generatedIds.size,
      }),
    });
    if (!response.ok) {
      let message = `${imageTo3dLabel()} ${response.status}`;
      try { message = (await response.json()).detail || message; } catch (_) { /* ignore */ }
      throw new Error(message);
    }
    const gltf = await parseGeneratedGlb(await response.arrayBuffer());
    const anchorEntity = review.previewMeshes.get(layer.id);
    installGeneratedLayer(gltf.scene, layer, anchorEntity);
    review.generatedIds.add(layer.id);
    if (scope === "biology") {
      bioLayerMeshes.set(layer.id, anchorEntity);
      state.bioIndependentLayerCount = bioLayerMeshes.size;
      state.bioPbrLayerCount = review.generatedIds.size;
      updateBiologyModelState(review.subject);
    } else {
      independentLayerMeshes.set(layer.id, anchorEntity);
      state.independentLayerCount = independentLayerMeshes.size;
      state.pbrLayerCount = review.generatedIds.size;
      updateIndependentModelState(review.subject);
    }
    if (line) line.textContent = `${review.subject.label} · ${review.generatedIds.size} 个 ${imageTo3dLabel()} GLB 已回装原画锚点`;
    showToast("确认裁剪已生成 3D 模型，并回装到原画位置");
  } catch (err) {
    console.error("[wall-workspace] confirmed image-to-3d failed", err);
    if (line) line.textContent = `图生 3D 失败 · ${err?.message || "未知错误"}`;
    showToast(err?.message || "图生 3D 失败");
  } finally {
    review.generatingIds.delete(layerId);
    const anchorEntity = review.previewMeshes.get(layerId);
    if (anchorEntity) applyCandidateVisualState(scope, layerId, anchorEntity);
    renderCandidateReview(scope);
    updateReadout();
  }
}

function installBiologySceneLiftResult(result, subject) {
  installCandidateReview("biology", result, subject);
}

function describeBiologyResult(result, subject) {
  const count = result.layers?.length || 0;
  const geometry = result.engine?.geometry || "MapAnything";
  if (!count) return `${geometry} 深度已读 · 画中未识别到“${subject.label}”候选`;
  return `${geometry} 深度 + Grounded SAM 2 实例 · ${count} 个候选待确认`;
}

function buildBiologyImageLockedModels(result, subject) {
  clearGroup(bioGroup);
  bioLayerMeshes = new Map();
  if (state.creature) {
    scene.remove(state.creature);
    disposeObject(state.creature);
    state.creature = null;
  }
  clearSkeletonOverlay();
  state.creatureRecord = null;
  const ref = biologyReferenceMap(result);
  const aspect = clamp(ref.aspect || ref.width / ref.height || 1.6, 0.45, 3.4);
  const width = artworkFrame?.width || (aspect >= 1 ? 5.8 : 5.8 * aspect);
  const height = artworkFrame?.height || width / aspect;
  const centerY = artworkFrame?.centerY || Math.max(1.72, height * 0.5 + 0.08);
  const baseZ = artworkFrame?.z ?? -1.35;
  const layers = (result.layers || []).filter((layer) => layer.subjectId === subject.id);

  for (const layer of layers) {
    const mask = decodeMaskRle(layer.maskRle, ref.width * ref.height);
    const isolated = createIndependentLayerGeometry(ref, mask, layer, width, height, true);
    if (!isolated) continue;
    const material = new THREE.MeshBasicMaterial({
      map: sourceTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const surface = new THREE.Mesh(isolated.geometry, material);
    surface.renderOrder = 7;
    surface.castShadow = true;
    surface.receiveShadow = true;
    surface.userData = {
      biologyModel: true,
      independentModel: true,
      layerId: layer.id,
      sourceAnchor: layer.anchor || null,
      sourceBbox: layer.bbox,
      pbrCompleted: false,
    };
    const entity = new THREE.Group();
    entity.position.set(isolated.anchor.x, centerY + isolated.anchor.y, baseZ + isolated.anchor.z + 0.09);
    entity.userData = {
      biologyModel: true,
      independentModel: true,
      layerId: layer.id,
      biologyKind: subject.kind,
      sourceAnchor: layer.anchor || null,
      sourceBbox: layer.bbox,
      homePosition: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
      homeRotation: { x: 0, y: 0, z: 0 },
      surface,
      phase: bioLayerMeshes.size * 0.73,
    };
    entity.add(surface);
    const inspection = new THREE.Mesh(
      isolated.geometry,
      new THREE.MeshBasicMaterial({
        color: 0xb94c3e,
        wireframe: true,
        transparent: true,
        opacity: 0.42,
        depthTest: false,
        toneMapped: false,
      })
    );
    inspection.visible = false;
    inspection.renderOrder = 20;
    inspection.userData.inspectionOverlay = true;
    entity.userData.inspection = inspection;
    entity.add(inspection);
    bioGroup.add(entity);
    bioLayerMeshes.set(layer.id, entity);
  }
  state.bioIndependentLayerCount = bioLayerMeshes.size;
  state.creatureBaseY = 0;
}

function updateBiologyModelState(subject = biologySubject()) {
  const node = el("bio-independent-model-state");
  const separate = el("separate-biology-models");
  const restore = el("restore-biology-models");
  const skeleton = el("skeleton-toggle");
  const canTransform = state.bioIndependentLayerCount > 0;
  if (separate) separate.disabled = !canTransform || state.bioModelsExploded;
  if (restore) restore.disabled = !canTransform || (!state.bioModelsExploded && state.behavior === "IDLE");
  if (skeleton) {
    skeleton.disabled = canTransform;
    skeleton.title = canTransform ? "原画实例网格尚未绑定骨骼；行为以实体锚点驱动" : "显示程序化备选模型骨相";
  }
  if (!node) return;
  const result = state.bioSceneLiftCache.get(subject.id);
  if (!result) {
    node.textContent = "等待候选确认 · 尚无 2D→3D 生物模型";
    return;
  }
  if (state.bioReviewCandidateCount && !state.bioIndependentLayerCount) {
    node.textContent = `${state.bioReviewCandidateCount} 个候选待确认 · 先审裁剪，再生成 ${imageTo3dLabel()} GLB`;
    return;
  }
  if (!state.bioIndependentLayerCount) {
    node.textContent = `画中未确认“${subject.label}” · 0 个实体 · 未生成替代物`;
    return;
  }
  const pbr = state.bioPbrLayerCount ? ` · ${state.bioPbrLayerCount} 个 ${imageTo3dLabel()} GLB` : " · 等待图生 3D";
  const view = state.bioModelsExploded ? " · 当前为分离检查视图" : " · 当前与原画坐标对映";
  node.textContent = `${state.bioIndependentLayerCount} 个已确认生物 2D→3D 模型 · 独立原点/原画锚点${pbr}${view}`;
}

function setBiologyModelsExploded(exploded) {
  if (!bioLayerMeshes.size) return;
  const entities = [...bioLayerMeshes.values()];
  entities.forEach((entity, index) => {
    const home = entity.userData.homePosition;
    if (!home) return;
    entity.position.set(home.x, home.y, home.z);
    entity.rotation.set(0, 0, 0);
    if (entity.userData.inspection) entity.userData.inspection.visible = exploded;
    if (!exploded) return;
    const centeredIndex = index - (entities.length - 1) * 0.5;
    entity.position.x += entities.length === 1 ? 0.78 : centeredIndex * 0.56;
    entity.position.z += 0.56 + Math.abs(centeredIndex) * 0.08;
    entity.rotation.y = entities.length === 1 ? 0.34 : centeredIndex * 0.16;
  });
  state.bioModelsExploded = exploded;
  if (!exploded) {
    state.behavior = "IDLE";
    renderSegments();
  }
  updateBiologyModelState();
  updateReadout();
  showToast(exploded ? "生物实体已从原画锚点分离，可检查独立体积" : "生物实体已归位到原画坐标");
}

function parseGeneratedGlb(buffer) {
  return new Promise((resolve, reject) => gltfLoader.parse(buffer, "", resolve, reject));
}

async function completeIndependentLayers(layers, subject) {
  return completeLayerModels(layers, subject, independentLayerMeshes, state.referenceMap, 2026);
}

async function completeLayerModels(layers, subject, registry, referenceMap, seedBase) {
  let completed = 0;
  for (const layer of layers.slice(0, 4)) {
    const anchorMesh = registry.get(layer.id);
    if (!anchorMesh) continue;
    try {
      const crop = createLayerCropDataUrl(layer, referenceMap);
      const response = await fetch("/api/trellis2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: crop,
          name: `${state.source?.name || "artwork"}-${layer.id}`,
          domain: subject.domain,
          subject: subject.id,
          layerId: layer.id,
          seed: seedBase + completed,
        }),
      });
      if (!response.ok) throw new Error(`${imageTo3dLabel()} ${response.status}`);
      const gltf = await parseGeneratedGlb(await response.arrayBuffer());
      installGeneratedLayer(gltf.scene, layer, anchorMesh);
      completed++;
    } catch (err) {
      console.warn(`[wall-workspace] PBR completion skipped for ${layer.id}`, err);
    }
  }
  return completed;
}

function createLayerCropDataUrl(layer, referenceMap = state.referenceMap) {
  const image = sourceTexture?.image;
  const ref = referenceMap;
  if (!image || !ref || !Array.isArray(layer.bbox) || layer.bbox.length !== 4) {
    throw new Error("独立物体缺少原图或遮罩包围盒");
  }
  const padding = 0.035;
  const x0 = clamp(layer.bbox[0] - padding, 0, 1);
  const y0 = clamp(layer.bbox[1] - padding, 0, 1);
  const x1 = clamp(layer.bbox[2] + padding, 0, 1);
  const y1 = clamp(layer.bbox[3] + padding, 0, 1);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const cropWidth = Math.max(2, (x1 - x0) * sourceWidth);
  const cropHeight = Math.max(2, (y1 - y0) * sourceHeight);
  const scale = Math.min(1, 768 / Math.max(cropWidth, cropHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(32, Math.round(cropWidth * scale));
  canvas.height = Math.max(32, Math.round(cropHeight * scale));
  const context = canvas.getContext("2d");
  context.drawImage(
    image,
    x0 * sourceWidth,
    y0 * sourceHeight,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const mask = decodeMaskRle(layer.maskRle, ref.width * ref.height);
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = ref.width;
  maskCanvas.height = ref.height;
  const maskContext = maskCanvas.getContext("2d");
  const pixels = maskContext.createImageData(ref.width, ref.height);
  for (let i = 0; i < mask.length; i++) {
    const offset = i * 4;
    pixels.data[offset] = 255;
    pixels.data[offset + 1] = 255;
    pixels.data[offset + 2] = 255;
    pixels.data[offset + 3] = mask[i] ? 255 : 0;
  }
  maskContext.putImageData(pixels, 0, 0);
  context.globalCompositeOperation = "destination-in";
  context.imageSmoothingEnabled = false;
  context.drawImage(
    maskCanvas,
    x0 * ref.width,
    y0 * ref.height,
    Math.max(1, (x1 - x0) * ref.width),
    Math.max(1, (y1 - y0) * ref.height),
    0,
    0,
    canvas.width,
    canvas.height
  );
  context.globalCompositeOperation = "source-over";
  return canvas.toDataURL("image/png");
}

function installGeneratedLayer(root, layer, anchorEntity) {
  const anchorMesh = anchorEntity.userData.surface;
  if (!anchorMesh?.geometry) throw new Error(`独立实体 ${layer.id} 缺少原画表面`);
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    }
  });
  root.updateMatrixWorld(true);
  const sourceBox = new THREE.Box3().setFromObject(root);
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  anchorMesh.geometry.computeBoundingBox();
  const targetBox = anchorMesh.geometry.boundingBox.clone();
  const targetSize = targetBox.getSize(new THREE.Vector3());
  const scale = Math.min(
    targetSize.x / Math.max(sourceSize.x, 0.001),
    targetSize.y / Math.max(sourceSize.y, 0.001)
  );
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);
  const scaledCenter = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  const targetCenter = targetBox.getCenter(new THREE.Vector3());
  root.position.add(targetCenter.sub(scaledCenter));
  root.userData = {
    ...root.userData,
    independentModel: true,
    pbrCompletion: true,
    layerId: layer.id,
    sourceAnchor: layer.anchor || null,
  };
  anchorEntity.add(root);
  anchorEntity.userData.pbrCompleted = true;
  anchorMesh.userData.pbrCompleted = true;
  if (anchorMesh.userData.reviewAnchor) {
    anchorMesh.visible = false;
    const outline = anchorEntity.userData.outline;
    if (outline) outline.visible = false;
  } else if (anchorMesh.material && !Array.isArray(anchorMesh.material)) {
    anchorMesh.material.transparent = true;
    anchorMesh.material.opacity = 0.78;
    anchorMesh.material.depthWrite = false;
    anchorMesh.material.needsUpdate = true;
  }
}

function installGeneratedEnvironment(root, subject) {
  clearGroup(envGroup);
  snowPoints = null;
  waterSurfaces = [];
  swayingPlants = [];
  independentLayerMeshes = new Map();
  state.independentLayerCount = 0;
  state.pbrLayerCount = 0;
  state.modelsExploded = false;
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of mats) {
      if (!mat) continue;
      mat.side = THREE.DoubleSide;
      mat.needsUpdate = true;
    }
  });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z, 0.001);
  const target = subject.domain === "plants" ? 2.1 : 4.4;
  root.scale.setScalar(target / longest);
  root.updateMatrixWorld(true);
  const nextBox = new THREE.Box3().setFromObject(root);
  const center = nextBox.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z + 0.28;
  root.position.y -= nextBox.min.y;
  envGroup.add(root);
}

function setEnvironment(id) {
  const subject = environmentSubject(id) || environmentSubject("mountain");
  state.envId = subject.id;
  state.envSubject = subject.id;
  state.envDomain = subject.domain;
  state.envResolved = subject.preset;
  if (subject.domain === "water" && Number.isFinite(subject.flow)) {
    state.flow = subject.flow;
    if (el("flow-range")) el("flow-range").value = String(state.flow);
  }
  const preset = ENV_LIBRARY[state.envResolved] || ENV_LIBRARY.blank;
  const tint = new THREE.Color(state.envTint || DEFAULT_PALETTE[0]);
  ground.material.color.setHex(preset.ground).lerp(tint, 0.2);
  ground.visible = !state.source?.dataUrl;
  wall.visible = false;

  const cached = state.sceneLiftCache.get(subject.id);
  if (cached) {
    if (candidateReview.environment.subject?.id !== subject.id || candidateReview.environment.result !== cached) {
      installCandidateReview("environment", cached, subject);
    }
    return;
  }

  clearGroup(envGroup);
  snowPoints = null;
  waterSurfaces = [];
  swayingPlants = [];
  independentLayerMeshes = new Map();
  state.independentLayerCount = 0;
  state.reviewCandidateCount = 0;
  state.pbrLayerCount = 0;
  state.modelsExploded = false;
  state.sceneLiftResult = null;
  state.generationMode = state.source?.dataUrl ? "candidate-review" : "image-locked";
  resetReviewState("environment");
  updateIndependentModelState(subject);
  applyAtmosphere();
  renderEnvironmentButtons();
  renderSegments();
  renderPalette("env-palette", "env");
  updateReadout();
}

function updateIndependentModelState(subject) {
  const node = el("independent-model-state");
  if (!node) return;
  const separate = el("separate-environment-models");
  const restore = el("restore-environment-models");
  const canTransform = state.independentLayerCount > 0;
  if (separate) separate.disabled = !canTransform || state.modelsExploded;
  if (restore) restore.disabled = !canTransform || !state.modelsExploded;
  const result = state.sceneLiftCache.get(subject.id);
  if (!result) {
    node.textContent = "等待候选确认 · 尚无 2D→3D 模型";
    return;
  }
  if (state.reviewCandidateCount && !state.independentLayerCount) {
    node.textContent = `${state.reviewCandidateCount} 个候选待确认 · 先审裁剪，再生成 ${imageTo3dLabel()} GLB`;
    return;
  }
  if (!state.independentLayerCount) {
    node.textContent = `画中未确认“${subject.label}” · 0 个实体 · 未生成替代物`;
    return;
  }
  const pbr = state.pbrLayerCount ? ` · ${state.pbrLayerCount} 个 ${imageTo3dLabel()} GLB` : " · 等待图生 3D";
  const view = state.modelsExploded ? " · 当前为分离检查视图" : " · 当前与原画坐标对映";
  node.textContent = `${state.independentLayerCount} 个已确认 2D→3D 模型 · 独立原点/原画锚点${pbr}${view}`;
}

function setIndependentModelsExploded(exploded) {
  if (!independentLayerMeshes.size) return;
  const entities = [...independentLayerMeshes.values()];
  entities.forEach((entity, index) => {
    const home = entity.userData.homePosition;
    if (!home) return;
    entity.position.set(home.x, home.y, home.z);
    entity.rotation.set(0, 0, 0);
    if (!exploded) return;
    if (entities.length === 1) {
      entity.position.x += 0.72;
      entity.position.z += 0.5;
      entity.rotation.y = 0.28;
      return;
    }
    const centeredIndex = index - (entities.length - 1) * 0.5;
    entity.position.x += centeredIndex * 0.48;
    entity.position.z += 0.34 + Math.abs(centeredIndex) * 0.06;
    entity.rotation.y = centeredIndex * 0.12;
  });
  state.modelsExploded = exploded;
  updateIndependentModelState(environmentSubject(state.envSubject));
  showToast(exploded ? "独立实体已分离；可确认它们不是同一张浮雕" : "独立实体已归位到原画坐标");
}

function buildImageLockedEnvironment(subject) {
  const ref = state.referenceMap;
  const aspect = clamp(ref.aspect || ref.width / ref.height || 1.6, 0.45, 3.4);
  const width = aspect >= 1 ? 5.8 : 5.8 * aspect;
  const height = width / aspect;
  const centerY = Math.max(1.72, height * 0.5 + 0.08);
  const baseZ = -1.35;
  const geometry = createReliefGeometry(ref, width, height);
  const layers = (state.sceneLiftResult?.layers || []).filter((layer) => layer.subjectId === subject.id);
  artworkFrame = { width, height, centerY, z: baseZ };
  const validTexture = ref.validRle ? createMaskTexture(ref.validRle, ref.width, ref.height) : null;
  const baseOpacity = layers.length ? 0.16 : 1;
  const baseMaterial = new THREE.MeshBasicMaterial({
    map: sourceTexture,
    alphaMap: validTexture,
    alphaTest: validTexture ? 0.05 : 0,
    transparent: baseOpacity < 1 || Boolean(validTexture),
    opacity: baseOpacity,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const baseMesh = new THREE.Mesh(geometry, baseMaterial);
  baseMesh.position.set(0, centerY, baseZ);
  baseMesh.userData.imageLocked = true;
  envGroup.add(baseMesh);

  for (const layer of layers) {
    const mask = decodeMaskRle(layer.maskRle, ref.width * ref.height);
    const isolated = createIndependentLayerGeometry(ref, mask, layer, width, height, subject.domain !== "water");
    if (!isolated) continue;
    const maskTexture = subject.domain === "water" ? createMaskTexture(layer.maskRle, ref.width, ref.height) : null;
    const layerMaterial = subject.domain === "water"
      ? createMaskedWaterMaterial(maskTexture, subject)
      : new THREE.MeshBasicMaterial({
          map: sourceTexture,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
    const layerMesh = new THREE.Mesh(isolated.geometry, layerMaterial);
    layerMesh.renderOrder = 4;
    layerMesh.castShadow = subject.domain !== "water";
    layerMesh.receiveShadow = true;
    layerMesh.userData = {
      imageLocked: true,
      independentModel: true,
      layerId: layer.id,
      subjectId: subject.id,
      sourceBbox: layer.bbox,
      sourceAnchor: layer.anchor || null,
      pbrCompleted: false,
    };
    const entity = new THREE.Group();
    entity.position.set(isolated.anchor.x, centerY + isolated.anchor.y, baseZ + isolated.anchor.z + 0.018);
    entity.userData = {
      independentModel: true,
      layerId: layer.id,
      subjectId: subject.id,
      sourceBbox: layer.bbox,
      sourceAnchor: layer.anchor || null,
      homePosition: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
      surface: layerMesh,
    };
    entity.add(layerMesh);
    envGroup.add(entity);
    independentLayerMeshes.set(layer.id, entity);
    if (subject.domain === "water") waterSurfaces.push(layerMesh);
  }
  state.independentLayerCount = independentLayerMeshes.size;

  const shell = el("wall-viewport")?.parentElement;
  shell?.classList.add("relief-active");
  frameArtworkCamera(false);
}

function createIndependentLayerGeometry(ref, mask, layer, width, height, solid = true) {
  const gridWidth = ref.width;
  const gridHeight = ref.height;
  if (!mask?.length || mask.length !== gridWidth * gridHeight || gridWidth < 2 || gridHeight < 2) return null;
  let pixelCount = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (!mask[y * gridWidth + x]) continue;
      pixelCount++;
      sumX += x;
      sumY += y;
    }
  }
  if (pixelCount < 4) return null;

  const centroid = layer.anchor?.centroid || [sumX / pixelCount / (gridWidth - 1), sumY / pixelCount / (gridHeight - 1)];
  const centerX = (centroid[0] - 0.5) * width;
  const centerY = (0.5 - centroid[1]) * height;
  const amplitude = ref.source === "local-luminance" ? 0.11 : 0.72;
  const centerRelief = Number.isFinite(layer.anchor?.reliefMedian)
    ? layer.anchor.reliefMedian
    : sampleRelief(centroid[0], centroid[1]);
  const centerZ = clamp(centerRelief, -1, 1) * amplitude;
  const thickness = solid ? Math.max(0.045, Math.min(width, height) * 0.035) : 0;
  const cellWidth = gridWidth - 1;
  const cellHeight = gridHeight - 1;
  const active = new Uint8Array(cellWidth * cellHeight);
  const cellAt = (x, y) => (x >= 0 && y >= 0 && x < cellWidth && y < cellHeight ? active[y * cellWidth + x] : 0);
  for (let y = 0; y < cellHeight; y++) {
    for (let x = 0; x < cellWidth; x++) {
      const coverage = mask[y * gridWidth + x]
        + mask[y * gridWidth + x + 1]
        + mask[(y + 1) * gridWidth + x]
        + mask[(y + 1) * gridWidth + x + 1];
      if (coverage >= 2) active[y * cellWidth + x] = 1;
    }
  }

  const positions = [];
  const uvs = [];
  const point = (x, y, back = false) => {
    const u = x / (gridWidth - 1);
    const fromTop = y / (gridHeight - 1);
    const relief = clamp(ref.values[y * gridWidth + x] || 0, -1, 1) * amplitude;
    return {
      x: (u - 0.5) * width - centerX,
      y: (0.5 - fromTop) * height - centerY,
      z: relief - centerZ - (back ? thickness : 0),
      u,
      v: 1 - fromTop,
    };
  };
  const triangle = (a, b, c) => {
    for (const vertex of [a, b, c]) {
      positions.push(vertex.x, vertex.y, vertex.z);
      uvs.push(vertex.u, vertex.v);
    }
  };
  const quad = (a, b, c, d) => {
    triangle(a, b, c);
    triangle(a, c, d);
  };

  for (let y = 0; y < cellHeight; y++) {
    for (let x = 0; x < cellWidth; x++) {
      if (!cellAt(x, y)) continue;
      const p00 = point(x, y);
      const p10 = point(x + 1, y);
      const p01 = point(x, y + 1);
      const p11 = point(x + 1, y + 1);
      quad(p00, p01, p11, p10);
      if (!solid) continue;
      const b00 = point(x, y, true);
      const b10 = point(x + 1, y, true);
      const b01 = point(x, y + 1, true);
      const b11 = point(x + 1, y + 1, true);
      quad(b00, b10, b11, b01);
      if (!cellAt(x, y - 1)) quad(p00, p10, b10, b00);
      if (!cellAt(x + 1, y)) quad(p10, p11, b11, b10);
      if (!cellAt(x, y + 1)) quad(p11, p01, b01, b11);
      if (!cellAt(x - 1, y)) quad(p01, p00, b00, b01);
    }
  }
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = { independentLayer: true, layerId: layer.id, closedVolume: solid };
  return { geometry, anchor: { x: centerX, y: centerY, z: centerZ }, pixelCount };
}

function createReliefGeometry(ref, width, height) {
  const geometry = new THREE.PlaneGeometry(width, height, ref.width - 1, ref.height - 1);
  const positions = geometry.attributes.position;
  const values = ref.values;
  const amplitude = ref.source === "local-luminance" ? 0.11 : 0.72;
  for (let i = 0; i < positions.count; i++) {
    const relief = Number.isFinite(values[i]) ? values[i] : 0;
    positions.setZ(i, clamp(relief, -1, 1) * amplitude);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createMaskTexture(rle, width, height) {
  const mask = decodeMaskRle(rle, width * height);
  const bytes = new Uint8Array(mask.length * 4);
  for (let i = 0; i < mask.length; i++) {
    const value = mask[i] ? 255 : 0;
    const offset = i * 4;
    bytes[offset] = value;
    bytes[offset + 1] = value;
    bytes[offset + 2] = value;
    bytes[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.flipY = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function decodeMaskRle(rle, expectedSize) {
  const out = new Uint8Array(expectedSize);
  const counts = Array.isArray(rle?.counts) ? rle.counts : [];
  let offset = 0;
  let value = Number(rle?.startsWith || 0) ? 1 : 0;
  for (const rawCount of counts) {
    const count = Math.max(0, Number(rawCount) || 0);
    if (value) out.fill(1, offset, Math.min(expectedSize, offset + count));
    offset += count;
    value = value ? 0 : 1;
    if (offset >= expectedSize) break;
  }
  return out;
}

function createMaskedWaterMaterial(maskTexture, subject) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: sourceTexture },
      uMask: { value: maskTexture },
      uTime: { value: 0 },
      uFlow: { value: subject.flow ?? state.flow },
      uAmplitude: { value: Math.min(0.055, (subject.wave ?? 0.04) * 0.42) },
    },
    vertexShader: `
      uniform sampler2D uMask;
      uniform float uTime;
      uniform float uFlow;
      uniform float uAmplitude;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        float mask = texture2D(uMask, uv).r;
        vec3 p = position;
        float wave = sin(uv.x * 34.0 + uTime * (1.2 + uFlow * 2.2));
        wave += sin(uv.y * 47.0 - uTime * (0.9 + uFlow * 1.6)) * 0.46;
        p.z += wave * uAmplitude * smoothstep(0.12, 0.85, mask);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform sampler2D uMask;
      uniform float uTime;
      uniform float uFlow;
      varying vec2 vUv;
      void main() {
        float mask = texture2D(uMask, vUv).r;
        if (mask < 0.18) discard;
        vec2 drift = vec2(sin(vUv.y * 31.0 + uTime * 1.5), cos(vUv.x * 27.0 - uTime)) * 0.0018 * uFlow;
        vec4 painted = texture2D(uMap, clamp(vUv + drift, 0.0, 1.0));
        float glint = (0.5 + 0.5 * sin((vUv.x + vUv.y) * 52.0 + uTime * 2.0)) * 0.08;
        gl_FragColor = vec4(painted.rgb + glint, mask);
      }
    `,
  });
}

function frameArtworkCamera(force = true) {
  if (!artworkFrame || !camera || !controls) return;
  if (!force && controls.userData?.hasUserFramedArtwork) return;
  const canvas = el("wall-viewport");
  const aspect = Math.max(0.6, (canvas?.clientWidth || 900) / (canvas?.clientHeight || 620));
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const distance = Math.max(
    artworkFrame.height / (2 * Math.tan(verticalFov / 2)),
    artworkFrame.width / (2 * Math.tan(horizontalFov / 2))
  ) * 1.06;
  controls.target.set(0, artworkFrame.centerY, artworkFrame.z);
  camera.position.set(0, artworkFrame.centerY, artworkFrame.z + distance);
  camera.lookAt(controls.target);
  controls.update();
  controls.userData = controls.userData || {};
  controls.userData.hasUserFramedArtwork = true;
}

function buildTerrainEnvironment(subject, tint) {
  const width = 5.8;
  const depth = 4.6;
  const sx = 42;
  const sy = 32;
  const geometry = new THREE.PlaneGeometry(width, depth, sx, sy);
  const positions = geometry.attributes.position;
  const rand = seededRandom(`terrain:${subject.id}:${state.source?.name || "blank"}`);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const u = x / width + 0.5;
    const v = y / depth + 0.5;
    const imageRelief = sampleRelief(u, 1 - v);
    let h = imageRelief * 0.42 + (rand() - 0.5) * 0.018;
    if (subject.id === "earth") h *= 0.18;
    if (subject.id === "slope") h = h * 0.3 + (v - 0.2) * 0.42;
    if (subject.id === "peak") h += Math.exp(-(x * x * 0.82 + (y + 0.45) ** 2 * 0.48)) * 0.78;
    if (subject.id === "range") h += (Math.sin(x * 2.1 + y * 0.35) * 0.15 + 0.18) * (0.45 + v);
    if (subject.id === "brook-bank") h -= Math.exp(-x * x * 3.8) * 0.28;
    if (subject.id === "ravine") h -= Math.exp(-((x + Math.sin(y * 1.2) * 0.36) ** 2) * 5.2) * 0.48;
    positions.setZ(i, h);
  }
  geometry.computeVertexNormals();
  const terrainColor = tint.clone().lerp(new THREE.Color(ENV_LIBRARY[subject.preset].ground), 0.58);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: terrainColor,
    roughness: 0.96,
    metalness: 0,
    transparent: Boolean(state.source?.dataUrl),
    opacity: state.source?.dataUrl ? 0.62 : 1,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.015, -0.35);
  mesh.receiveShadow = true;
  envGroup.add(mesh);

  if (subject.id === "rock") {
    for (let i = 0; i < 13; i++) addStone(rand, -2.25 + rand() * 4.5, -1.8 + rand() * 3.5, 0.14 + rand() * 0.42);
  }
  if (subject.id === "mountain" || subject.id === "peak" || subject.id === "range") {
    for (let i = 0; i < 4; i++) addRidge(-1.85 + i * 1.22, 1.1 - i * 0.08, -2.28, 2.35 - i * 0.18, 0.58 + i * 0.1);
  }
  if (subject.id === "brook-bank" || subject.id === "ravine") {
    addDynamicWaterSurface(subject.id === "ravine" ? 0.15 : -0.05, 0.055, 0.1, subject.id === "ravine" ? 0.78 : 1.05, 4.9, 0x6e98a7, {
      flow: subject.id === "ravine" ? 0.88 : 0.65,
      wave: 0.034,
      foam: subject.id === "ravine" ? 0.28 : 0.08,
    });
  }
}

function sampleRelief(u, v) {
  const ref = state.referenceMap;
  if (!ref?.values?.length) return Math.sin(u * Math.PI * 3) * Math.sin(v * Math.PI * 2) * 0.16;
  const x = clamp(Math.round(u * (ref.width - 1)), 0, ref.width - 1);
  const y = clamp(Math.round(v * (ref.height - 1)), 0, ref.height - 1);
  return ref.values[y * ref.width + x] || 0;
}

function buildPlantEnvironment(subject, tint) {
  const rand = seededRandom(`plant:${subject.id}:${state.source?.name || "blank"}`);
  const aquatic = ["calamus", "reed", "lotus-bloom", "lotus", "hibiscus"].includes(subject.id);
  if (aquatic) addDynamicWaterSurface(0, 0.025, -0.25, 4.9, 3.5, 0x7596a1, { flow: 0.22, wave: 0.025, foam: 0.01 });
  const count = ["pine", "plum", "wisteria", "camellia", "azalea", "hibiscus"].includes(subject.id) ? 6 : 10;
  for (let i = 0; i < count; i++) {
    const x = -2.2 + rand() * 4.4;
    const z = -1.55 + rand() * 2.9;
    const scale = 0.72 + rand() * 0.7;
    addPlantSpecimen(subject.id, rand, x, z, scale, tint);
  }
}

function addPlantSpecimen(kind, rand, x, z, scale, tint) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  root.scale.setScalar(scale);
  root.userData.sway = { phase: rand() * Math.PI * 2, flex: 0.012 + rand() * 0.025 };
  swayingPlants.push(root);
  envGroup.add(root);
  const green = tint.clone().lerp(new THREE.Color(0x53704b), 0.62);
  const leafMat = new THREE.MeshStandardMaterial({ color: green, roughness: 0.78, side: THREE.DoubleSide });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x67513b, roughness: 0.94 });
  const accent = new THREE.Color(state.palette[4] || "#b03a2e");

  if (kind === "pine") {
    addCylinder(root, 0.055, 1.45, stemMat, 0, 0.72, 0);
    for (let i = 0; i < 4; i++) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.42 - i * 0.05, 0.46, 10), leafMat);
      crown.position.y = 0.58 + i * 0.25;
      crown.castShadow = true;
      root.add(crown);
    }
    return;
  }
  if (kind === "bamboo") {
    const bambooMat = new THREE.MeshStandardMaterial({ color: green.clone().lerp(new THREE.Color(0x315f3d), 0.32), roughness: 0.82 });
    for (let c = 0; c < 3; c++) {
      const cx = (c - 1) * 0.1;
      addCylinder(root, 0.025, 1.45 - c * 0.12, bambooMat, cx, 0.7, c * 0.05);
      for (let j = 0; j < 6; j++) addPlantLeaf(root, leafMat, cx + (rand() - 0.5) * 0.22, 0.55 + rand() * 0.82, c * 0.05, 0.34, rand() * Math.PI);
    }
    return;
  }
  if (["plum", "wisteria", "camellia", "azalea", "hibiscus"].includes(kind)) {
    addCylinder(root, 0.045, 0.92, stemMat, 0, 0.44, 0);
    for (let b = 0; b < 4; b++) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.62, 7), stemMat);
      branch.position.set((b - 1.5) * 0.08, 0.72 + b * 0.06, 0);
      branch.rotation.z = (b % 2 ? -1 : 1) * (0.68 + rand() * 0.28);
      root.add(branch);
    }
    const flowers = kind === "wisteria" ? 11 : 7;
    const flowerColor = kind === "wisteria" ? new THREE.Color(0x8062a2) : kind === "plum" ? new THREE.Color(0xe8d4d1) : accent;
    for (let f = 0; f < flowers; f++) {
      addFlowerHead(root, flowerColor, (rand() - 0.5) * 0.78, kind === "wisteria" ? 0.34 + rand() * 0.7 : 0.65 + rand() * 0.55, (rand() - 0.5) * 0.35, kind === "hibiscus" ? 0.13 : 0.085, kind === "chrysanthemum" ? 12 : 6);
    }
    for (let l = 0; l < 8; l++) addPlantLeaf(root, leafMat, (rand() - 0.5) * 0.7, 0.52 + rand() * 0.62, (rand() - 0.5) * 0.3, 0.25, rand() * Math.PI);
    return;
  }
  if (kind === "lotus-bloom" || kind === "lotus") {
    const waterStem = new THREE.MeshStandardMaterial({ color: 0x527355, roughness: 0.82 });
    addCylinder(root, 0.016, 0.72, waterStem, 0, 0.36, 0);
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), leafMat);
    leaf.rotation.x = -Math.PI / 2;
    leaf.position.set(-0.12, 0.42, 0.04);
    root.add(leaf);
    addFlowerHead(root, kind === "lotus" ? new THREE.Color(0xf0c9cf) : new THREE.Color(0xe9a9b4), 0.08, 0.76, 0, kind === "lotus" ? 0.16 : 0.12, 10);
    return;
  }

  const bladeCount = kind === "chrysanthemum" ? 8 : 12;
  for (let i = 0; i < bladeCount; i++) {
    const h = 0.38 + rand() * (kind === "reed" ? 0.9 : 0.52);
    addPlantLeaf(root, leafMat, (rand() - 0.5) * 0.28, h * 0.5, (rand() - 0.5) * 0.22, h, rand() * Math.PI);
  }
  if (kind === "reed") {
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.2, 4, 7), new THREE.MeshStandardMaterial({ color: 0x9a754d, roughness: 1 }));
    head.position.y = 1.08;
    root.add(head);
  } else {
    const flowerColor = kind === "daylily" ? new THREE.Color(0xd78342) : kind === "chrysanthemum" ? new THREE.Color(0xd4a93e) : accent.clone().lerp(new THREE.Color(0xd8d3b4), 0.45);
    addFlowerHead(root, flowerColor, 0, 0.66, 0, kind === "chrysanthemum" ? 0.13 : 0.085, kind === "chrysanthemum" ? 14 : 6);
  }
}

function addCylinder(parent, radius, height, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.82, radius, height, 8), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addPlantLeaf(parent, material, x, y, z, length, rotationY) {
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.035, length * 0.16), length), material);
  leaf.position.set(x, y, z);
  leaf.rotation.set((Math.random() - 0.5) * 0.26, rotationY, (Math.random() - 0.5) * 0.7);
  parent.add(leaf);
}

function addFlowerHead(parent, color, x, y, z, radius, petals = 6) {
  const petalMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xd6af49, roughness: 0.78 });
  const group = new THREE.Group();
  group.position.set(x, y, z);
  for (let i = 0; i < petals; i++) {
    const petal = new THREE.Mesh(new THREE.CircleGeometry(radius, 10), petalMat);
    const angle = i / petals * Math.PI * 2;
    petal.scale.set(0.52, 1.15, 1);
    petal.position.set(Math.cos(angle) * radius * 0.75, Math.sin(angle) * radius * 0.75, 0);
    petal.rotation.z = angle - Math.PI / 2;
    group.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.42, 10, 7), centerMat);
  center.position.z = 0.012;
  group.add(center);
  parent.add(group);
}

function buildWaterEnvironment(subject, tint) {
  const waterColor = tint.clone().lerp(new THREE.Color(0x5c8a98), 0.68).getHex();
  const dims = subject.id === "brook" || subject.id === "cascade" ? { x: -0.5, w: 1.25, d: 5.2 } : { x: 0, w: 5.4, d: 4.0 };
  addDynamicWaterSurface(dims.x, 0.035, -0.2, dims.w, dims.d, waterColor, subject);
  const rand = seededRandom(`water:${subject.id}:${state.source?.name || "blank"}`);
  if (subject.id === "brook" || subject.id === "cascade") {
    for (let i = 0; i < 14; i++) addStone(rand, -1.75 + rand() * 3.5, -1.9 + rand() * 3.7, 0.1 + rand() * 0.24);
  }
  if (subject.id === "ripples" || subject.id === "lake") {
    for (let i = 0; i < 7; i++) addLotusLeaf(-1.9 + rand() * 3.8, -1.35 + rand() * 2.6, 0.13 + rand() * 0.12);
  }
}

function addDynamicWaterSurface(x, y, z, w, d, color, options = {}) {
  const deep = new THREE.Color(color).lerp(new THREE.Color(0x183744), 0.48);
  const shallow = new THREE.Color(color).lerp(new THREE.Color(0xc8ded5), 0.3);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: options.flow ?? state.flow },
      uAmplitude: { value: options.wave ?? 0.05 },
      uFoam: { value: options.foam ?? 0.08 },
      uDeep: { value: deep },
      uShallow: { value: shallow },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uFlow;
      uniform float uAmplitude;
      varying float vWave;
      varying vec2 vUvWater;
      void main() {
        vec3 p = position;
        float directional = sin(p.y * 3.2 - uTime * (0.8 + uFlow * 2.4));
        float crossWave = sin(p.x * 5.4 + p.y * 1.2 + uTime * 1.15) * 0.52;
        float ripple = sin(length(p.xy) * 10.0 - uTime * 2.1) * 0.34;
        vWave = directional * 0.54 + crossWave + ripple;
        p.z += vWave * uAmplitude;
        vUvWater = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uFoam;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      varying float vWave;
      varying vec2 vUvWater;
      void main() {
        float lightBand = 0.5 + 0.5 * sin((vUvWater.x + vUvWater.y) * 18.0 + uTime * 1.4 + vWave * 3.0);
        vec3 color = mix(uDeep, uShallow, clamp(0.42 + vWave * 0.28 + lightBand * 0.16, 0.0, 1.0));
        float foam = smoothstep(0.72, 1.08, abs(vWave)) * uFoam;
        color = mix(color, vec3(0.94, 0.96, 0.91), foam);
        gl_FragColor = vec4(color, 0.54 + lightBand * 0.12 + foam * 0.26);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 48, 36), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.userData.water = true;
  waterSurfaces.push(mesh);
  envGroup.add(mesh);
  return mesh;
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
  scene.background = state.source?.dataUrl ? null : bg;
  scene.fog = state.source?.dataUrl && state.mist < 0.08 ? null : new THREE.Fog(bg, fogNear, fogFar);
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

function clearCreatureFromScene({ keepBiology = false } = {}) {
  if (state.creature) {
    scene.remove(state.creature);
    disposeObject(state.creature);
    state.creature = null;
  }
  clearSkeletonOverlay();
  state.creatureRecord = null;
  state.gait = 0;
  state.orbit = 0;
  if (!keepBiology) clearBiologyModels();
}

function clearBiologyModels() {
  clearGroup(bioGroup);
  bioLayerMeshes = new Map();
  state.bioSceneLiftResult = null;
  state.bioIndependentLayerCount = 0;
  state.bioReviewCandidateCount = 0;
  state.bioPbrLayerCount = 0;
  state.bioModelsExploded = false;
  resetReviewState("biology");
  updateBiologyModelState();
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
  rec.cnName = state.source?.name ? "画中生灵" : "待选生灵";
  rec.scientificName = "Ex pictura viva";
  rec.taxonomyClass = anatomy === "AVES" ? "bird" : "mammal";
  rec.anatomyType = anatomy;
  rec.dimensions = { ...baseDims, ...(dims || {}) };
  rec.anatomicalRef = {
    withersHeight: +(rec.dimensions.height * (anatomy === "AVES" ? 0.62 : 0.78)).toFixed(2),
    tailLength: +(rec.dimensions.height * tailScale).toFixed(2),
    wingspan: +(Math.max(rec.dimensions.length * 1.55, 0.55)).toFixed(2),
    earLength: anatomy === "SALTATORIAL" ? 0.16 : 0.04,
    note: "由 home 画框原作的轮廓与色板推断，可用右侧菜单继续重构。",
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
  if (bioLayerMeshes.size) {
    updateImageLockedBiology(time);
    return;
  }
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

function updateImageLockedBiology(time) {
  if (state.bioModelsExploded) return;
  const behavior = state.behavior;
  for (const entity of bioLayerMeshes.values()) {
    const home = entity.userData.homePosition;
    if (!home) continue;
    const phase = entity.userData.phase || 0;
    const kind = entity.userData.biologyKind;
    entity.position.set(home.x, home.y, home.z);
    entity.rotation.set(0, 0, 0);
    if (behavior === "IDLE") continue;

    const travel = Math.sin(time * 0.72 + phase);
    if (behavior === "WALK") {
      entity.position.x += travel * (kind === "fish" ? 0.42 : 0.28);
      entity.position.y += Math.sin(time * 1.44 + phase) * (kind === "avian" || kind === "insect" ? 0.13 : 0.025);
      entity.rotation.z = Math.cos(time * 0.72 + phase) * 0.035;
    } else if (behavior === "FORAGE") {
      entity.position.y -= 0.065 + Math.max(0, Math.sin(time * 1.2 + phase)) * 0.045;
      entity.rotation.x = 0.12;
      entity.rotation.z = Math.sin(time * 1.2 + phase) * 0.028;
    } else if (behavior === "LEAP") {
      const leap = Math.max(0, Math.sin(time * 1.8 + phase));
      entity.position.x += travel * 0.18;
      entity.position.y += leap * (kind === "avian" || kind === "insect" ? 0.42 : 0.28);
      entity.rotation.z = Math.cos(time * 1.8 + phase) * 0.055;
    }
  }
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
  clearArtworkReferencePlane();
  const backdrop = el("source-backdrop");
  const shell = el("wall-viewport")?.parentElement;
  shell?.classList.remove("relief-active");
  shell?.classList.remove("three-source-active");
  artworkFrame = null;
  if (sourceTexture) {
    sourceTexture.dispose();
    sourceTexture = null;
  }
  if (source?.dataUrl) {
    const image = await loadImage(source.dataUrl);
    sourceTexture = new THREE.Texture(image);
    sourceTexture.colorSpace = THREE.SRGBColorSpace;
    sourceTexture.minFilter = THREE.LinearMipmapLinearFilter;
    sourceTexture.magFilter = THREE.LinearFilter;
    sourceTexture.needsUpdate = true;
    if (backdrop) {
      backdrop.src = source.dataUrl;
      backdrop.hidden = false;
    }
  } else {
    if (backdrop) {
      backdrop.hidden = true;
      backdrop.removeAttribute("src");
    }
  }
  if (controls?.userData) controls.userData.hasUserFramedArtwork = false;
  wall.visible = false;
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
  if (artworkFrame) {
    if (controls?.userData) controls.userData.hasUserFramedArtwork = false;
    frameArtworkCamera(true);
    return;
  }
  camera.position.set(3.7, 2.1, 4.9);
  controls.target.set(0, 0.82, -0.25);
  controls.update();
}

function updateReadout() {
  const subject = environmentSubject(state.envSubject);
  const envLabel = subject ? `${ENVIRONMENT_CATALOG[subject.domain].label} · ${subject.label}` : "画境";
  const bioSubject = biologySubject();
  const bio = state.bioIndependentLayerCount
    ? `${bioSubject.label} · ${state.bioIndependentLayerCount} 个 2D→3D 模型${state.bioPbrLayerCount ? ` · ${state.bioPbrLayerCount} GLB` : ""}`
    : state.bioReviewCandidateCount
      ? `${bioSubject.label} · ${state.bioReviewCandidateCount} 候选待确认`
    : state.creature
      ? (state.creatureKind === "auto" ? `${BIO_LIBRARY.auto.label} · ${BIO_LIBRARY[resolveCreatureKind("auto")]?.label}` : BIO_LIBRARY[state.creatureKind]?.label)
      : "生物尚未入境";
  const behavior = BEHAVIOR_LABEL[state.behavior] || state.behavior;
  const readout = el("state-readout");
  const geometryEngine = state.sceneLiftResult?.engine?.geometry || "MapAnything";
  const geometryLabel = geometryEngine.includes("Depth-Anything") ? "Depth Anything V2" : geometryEngine.includes("map-anything") ? "MapAnything" : geometryEngine;
  const hasSemanticLayer = Boolean(state.sceneLiftResult?.layers?.length);
  const pbrSuffix = state.pbrLayerCount ? ` · ${state.pbrLayerCount} PBR 实体` : "";
  const generator = state.independentLayerCount
    ? `${geometryLabel} 深度 · ${state.independentLayerCount} 个 ${imageTo3dLabel()} GLB${pbrSuffix}`
    : state.reviewCandidateCount
      ? `${geometryLabel} 深度 · Grounded SAM 2 · ${state.reviewCandidateCount} 候选待确认`
      : state.source?.dataUrl ? "等待候选识别" : "等待画作";
  if (readout) readout.textContent = `${envLabel} · ${generator} · ${bio} · ${behavior}`;
  const meta = el("source-meta");
  if (meta) meta.textContent = state.estimate
    ? `home 画框母版 · ${state.palette.slice(0, 3).join(" ")}`
    : "请从 home 画框进入";
}

function updateEnvironmentMotion(time) {
  for (const water of waterSurfaces) {
    if (water.material?.uniforms?.uTime) water.material.uniforms.uTime.value = time;
  }
  for (const plant of swayingPlants) {
    const sway = plant.userData.sway;
    if (!sway) continue;
    plant.rotation.z = Math.sin(time * (0.72 + state.wind * 1.4) + sway.phase) * sway.flex * (0.3 + state.wind * 1.7);
    plant.rotation.x = Math.cos(time * 0.48 + sway.phase) * sway.flex * state.wind * 0.38;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;
  updateSnow(dt, time);
  updateEnvironmentMotion(time);
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

function pickEnvironmentTint(palette) {
  for (const hex of palette || []) {
    const c = new THREE.Color(hex);
    const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
    if (lum >= 0.16 && lum <= 0.82) return hex;
  }
  return palette?.[0] || DEFAULT_PALETTE[0];
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

async function sampleReferenceMap(src) {
  const img = await loadImage(src);
  const maxSide = 128;
  const scale = maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const width = Math.max(24, Math.round((img.naturalWidth || img.width) * scale));
  const height = Math.max(24, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const luminance = new Float32Array(width * height);
  let mean = 0;
  for (let i = 0; i < luminance.length; i++) {
    const o = i * 4;
    const value = (rgba[o] * 0.299 + rgba[o + 1] * 0.587 + rgba[o + 2] * 0.114) / 255;
    luminance[i] = value;
    mean += value;
  }
  mean /= luminance.length;
  let variance = 0;
  for (const value of luminance) variance += (value - mean) ** 2;
  const sigma = Math.sqrt(variance / luminance.length) || 0.18;
  const values = new Float32Array(luminance.length);
  for (let i = 0; i < luminance.length; i++) values[i] = clamp((mean - luminance[i]) / sigma * 0.22, -0.36, 0.58);
  return { width, height, values, aspect: (img.naturalWidth || img.width) / (img.naturalHeight || img.height), source: "local-luminance" };
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
    const disposeMaterial = (material) => {
      if (!material) return;
      if (material.alphaMap && material.alphaMap !== sourceTexture) material.alphaMap.dispose?.();
      const mask = material.uniforms?.uMask?.value;
      if (mask && mask !== sourceTexture) mask.dispose?.();
      material.dispose?.();
    };
    if (Array.isArray(mat)) mat.forEach(disposeMaterial);
    else disposeMaterial(mat);
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
