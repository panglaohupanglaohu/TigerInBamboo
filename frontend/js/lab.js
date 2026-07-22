// lab.js — 物种实验室：四模块造物管线 + 3D 实时预览
import * as THREE from "../assets/vendor/three/three.module.js";
import { OrbitControls } from "../assets/vendor/three/jsm/controls/OrbitControls.js";
import { loadSpecies, saveSpecies, querySpecies, DEFAULT_SPECIES } from './species.js';
import { BioEntityMesh } from './bio/BioEntityMesh.js';
import { buildAvianBody } from './bio/AvianBodyBuilder.js';
import { paintGeometry } from './tiger.js';
import { createLabEnv } from './labEnv.js';
import { BioSemantics, fitHabitat } from './bioSemantics.js';
import { computeGait, applyGait as applyComputedGait } from './locomotionModel.js';

const labEnv = createLabEnv('snow');

/* ============ 字段映射：HTML id → record 路径 ============ */
const FIELD_MAP = {
  "cfg-name": "cnName",
  "cfg-latin": "scientificName",
  "cfg-class": "taxonomyClass",
  "cfg-anatomy": "anatomyType",
  "cfg-tid": "taxonomyId",
  "cfg-bx": "dimensions.width",
  "cfg-by": "dimensions.height",
  "cfg-bz": "dimensions.length",
  "cfg-withers": "anatomicalRef.withersHeight",
  "cfg-tail-length": "anatomicalRef.tailLength",
  "cfg-wingspan": "anatomicalRef.wingspan",
  "cfg-anatRef": "anatomicalRef.note",
  "cfg-ear": "anatomicalRef.earLength",
  "cfg-neck": "rigTuning.neckLen",
  "cfg-leg": "shape.legScale",
  "cfg-slouch": "rigTuning.backAngle",
  "cfg-head": "shape.headScale",
  "cfg-chest": "shape.chestScale",
  "cfg-rump": "shape.rumpScale",
  "cfg-tail": "shape.tailScale",
  "cfg-girth": "shape.bellyScale",
  "cfg-hock": "rigTuning.hockLift",
  "cfg-color": "rendering.baseColor",
  "cfg-stripe": "rendering.stripeColor",
  "cfg-pattern": "rendering.pattern",
  "cfg-density": "rendering.stripeDensity",
  "cfg-seg": "rendering.furLayers",
  "cfg-belly": "rendering.bellyLightenAmt",
  "cfg-rough": "rendering.roughness",
  "cfg-pose": "pose",
  "cfg-stride": "gait.freq",
  "cfg-step-len": "gait.stepLen",
  "cfg-lean": "gait.lean",
  "cfg-creep-low": "gait.creepLow",
  "cfg-direct-register": "gait.directRegister",
  "cfg-creep-cadence": "gait.creepCadence",
  "cfg-tailwhip": "gait.tail",
  "cfg-breathe": "gait.breathe",
};
const SEM_MAP = { "sem-niche": "niche", "sem-diet": "diet", "sem-activity": "activityCycle", "sem-social": "sociality" };
const ARC_MAP = { "arc-discoverer": "discoverer", "arc-site": "site", "arc-era": "era", "arc-conserv": "conservation", "arc-desc": "description", "arc-thumb": "thumb" };

const el = (id) => document.getElementById(id);
const getAt = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const setAt = (obj, path, val) => { const ks = path.split('.'); const last = ks.pop(); let o = obj; for (const k of ks) o = (o[k] ??= {}); o[last] = val; };
const hexToRgb = (hex) => { const h = hex.replace('#', ''); return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }; };
const rgbToHexStr = (r, g, b) => '#' + [r,g,b].map(v => Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');

const ANATOMY_TO_MODEL = {
  FELINE: "DIGITIGRADE",
  CANINE: "DIGITIGRADE",
  URSOID: "DIGITIGRADE",
  UNGULATE: "UNGULIGRADE",
  AVIAN: "AVES",
  AVIAN_CURSORIAL: "AVES",
};
const MODEL_TO_LAB = { AVES: "AVIAN", UNGULIGRADE: "UNGULATE", DIGITIGRADE: "FELINE", SALTATORIAL: "SALTATORIAL" };
const ANATOMY_LABELS = {
  FELINE: "猫科趾行",
  CANINE: "犬科趾行",
  UNGULATE: "蹄行",
  SALTATORIAL: "跳跃行",
  AVIAN: "禽类",
  AVIAN_CURSORIAL: "走禽健步",
  DIGITIGRADE: "趾行",
  UNGULIGRADE: "蹄行",
  AVES: "禽类",
  RODENT: "啮齿",
  REPTILE: "爬行",
  AMPHIBIAN: "两栖",
  FISH: "鱼类",
  INSECT: "昆虫",
};

const PARAMETER_PROFILES = {
  FELINE: {
    labels: {
      "cfg-withers": "肩高 Withers",
      "cfg-tail-length": "尾长（米）",
      "cfg-ear": "耳长",
      "cfg-neck": "颈背紧凑",
      "cfg-leg": "四肢长度",
      "cfg-slouch": "背线压低",
      "cfg-head": "头颅占比",
      "cfg-chest": "胸肩肌量",
      "cfg-rump": "臀胯肌量",
      "cfg-tail": "尾长系数",
      "cfg-girth": "躯干围度",
      "cfg-hock": "飞节抬升",
      "cfg-color": "皮毛主色",
      "cfg-stripe": "斑纹色",
      "cfg-pattern": "花纹类型",
      "cfg-density": "斑纹密度",
      "cfg-seg": "皮毛分段",
      "cfg-belly": "腹部提亮",
      "cfg-stride": "运动步频",
      "cfg-step-len": "步伐幅长",
      "cfg-lean": "颈前伸度",
      "cfg-creep-low": "潜行压低",
      "cfg-direct-register": "后足贴印",
      "cfg-creep-cadence": "潜行步频",
      "cfg-tailwhip": "尾摆幅",
      "cfg-breathe": "呼吸起伏",
    },
    hide: ["cfg-wingspan"],
    show: ["cfg-ear", "cfg-hock", "cfg-creep-low", "cfg-direct-register", "cfg-creep-cadence", "cfg-seg", "cfg-belly", "cfg-breathe"],
    ranges: {
      "cfg-neck": [0.45, 1.4, 0.05],
      "cfg-leg": [0.7, 1.6, 0.05],
      "cfg-slouch": [-0.25, 0.16, 0.02],
      "cfg-head": [0.75, 1.45, 0.02],
      "cfg-tail": [0.45, 1.7, 0.05],
      "cfg-step-len": [0.05, 0.45, 0.01],
      "cfg-tailwhip": [0, 0.5, 0.02],
    },
    pose: { stand: "静立", crouch: "低伏" },
  },
  AVIAN: {
    labels: {
      "cfg-withers": "站高基准",
      "cfg-tail-length": "尾羽长度",
      "cfg-wingspan": "翼展（米）",
      "cfg-neck": "颈长系数",
      "cfg-leg": "跗跖腿长",
      "cfg-slouch": "躯干俯仰",
      "cfg-head": "头/喙占比",
      "cfg-chest": "翼肩胸肌",
      "cfg-rump": "背腰体量",
      "cfg-tail": "尾羽展开",
      "cfg-girth": "腹囊体量",
      "cfg-color": "羽背主色",
      "cfg-stripe": "翼缘/尾纹",
      "cfg-pattern": "羽纹类型",
      "cfg-density": "尾羽层次",
      "cfg-stride": "踱步频率",
      "cfg-step-len": "步距",
      "cfg-lean": "探头幅度",
      "cfg-tailwhip": "尾羽摆幅",
    },
    hide: ["cfg-ear", "cfg-hock", "cfg-creep-low", "cfg-direct-register", "cfg-creep-cadence", "cfg-seg", "cfg-belly", "cfg-breathe"],
    show: ["cfg-wingspan"],
    ranges: {
      "cfg-neck": [0.85, 2.3, 0.05],
      "cfg-leg": [0.45, 1.15, 0.05],
      "cfg-slouch": [-0.12, 0.18, 0.02],
      "cfg-head": [0.6, 1.35, 0.02],
      "cfg-chest": [0.75, 1.6, 0.02],
      "cfg-rump": [0.75, 1.45, 0.02],
      "cfg-tail": [0.1, 1.35, 0.05],
      "cfg-density": [0, 1, 0.05],
      "cfg-stride": [0.6, 2.2, 0.05],
      "cfg-step-len": [0.03, 0.3, 0.01],
      "cfg-lean": [0, 0.35, 0.02],
      "cfg-tailwhip": [0, 0.3, 0.02],
    },
    pose: { stand: "栖立", crouch: "觅食低头" },
  },
};
PARAMETER_PROFILES.AVIAN_CURSORIAL = {
  ...PARAMETER_PROFILES.AVIAN,
  labels: {
    ...PARAMETER_PROFILES.AVIAN.labels,
    "cfg-withers": "站高",
    "cfg-wingspan": "短翼展",
    "cfg-neck": "长颈系数",
    "cfg-leg": "长腿步幅",
    "cfg-chest": "胸肩/翼根",
    "cfg-rump": "躯干重心",
    "cfg-tail": "尾羽平衡",
    "cfg-stride": "健步频率",
    "cfg-step-len": "跨步长度",
    "cfg-lean": "探头平衡",
    "cfg-tailwhip": "尾羽配平",
  },
  ranges: {
    ...PARAMETER_PROFILES.AVIAN.ranges,
    "cfg-neck": [1.2, 2.35, 0.05],
    "cfg-leg": [0.75, 1.35, 0.05],
    "cfg-chest": [0.55, 1.2, 0.02],
    "cfg-rump": [0.9, 1.6, 0.02],
    "cfg-tail": [0.1, 0.8, 0.05],
    "cfg-stride": [0.8, 2.4, 0.05],
    "cfg-step-len": [0.08, 0.42, 0.01],
    "cfg-lean": [0.04, 0.35, 0.02],
  },
  pose: { stand: "伫立", crouch: "低头觅食" },
};

const RESEARCH_SOURCE_SETS = {
  feline: [
    ["San Diego Zoo", "https://animals.sandiegozoo.org/animals/tiger"],
    ["PLOS One", "https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0003808"],
    ["Animal Diversity Web", "https://animaldiversity.org/collections/mammal_anatomy/running_fast/"],
  ],
  avian: [
    ["Avian Skeletal System", "https://www.pheasant.com/resources/avian-skeletal-system"],
    ["SeaWorld Golden Pheasant", "https://seaworld.org/animals/facts/birds/golden-pheasant/"],
    ["JEB Ostrich Gait", "https://journals.biologists.com/jeb/article/219/20/3301/15422/Preferred-gait-and-walk-run-transition-speeds-in"],
  ],
  cursorial: [
    ["JEB Ostrich Gait", "https://journals.biologists.com/jeb/article/219/20/3301/15422/Preferred-gait-and-walk-run-transition-speeds-in"],
    ["RVC Ostrich Model", "https://www.rvc.ac.uk/research/research-centres-and-facilities/structure-and-motion/news/rvc-study-uses-computer-optimization-to-show-ostrich-gait-in-detail-never-seen-before"],
    ["Avian Skeletal System", "https://www.pheasant.com/resources/avian-skeletal-system"],
  ],
  saltatorial: [
    ["Animal Diversity Web", "https://animaldiversity.org/collections/mammal_anatomy/running_fast/"],
    ["PLOS One", "https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0003808"],
  ],
};

const TIGER_STALK_PRESET = {
  cnName: "东北虎潜行样本",
  scientificName: "Panthera tigris altaica",
  taxonomyClass: "mammal",
  anatomyType: "FELINE",
  taxonomyId: "CARNIVORA-FELIDAE-PANTHERA",
  dimensions: { width: 0.72, height: 1.24, length: 3.1 },
  anatomicalRef: {
    withersHeight: 0.97,
    tailLength: 1.0,
    earLength: 0.11,
    note: "调研基线：虎为伏击猎手；潜行时低头、低重心，靠条纹遮蔽与安静落足接近。",
  },
  rigTuning: { neckLen: 0.92, legFold: 1, backAngle: -0.06, hockLift: 0.28 },
  shape: { rumpScale: 1.05, bellyScale: 1.08, chestScale: 1.18, headScale: 1.12, legScale: 1.0, tailScale: 1.08 },
  rendering: {
    vertexColors: true,
    baseColor: "#d27a24",
    stripeColor: "#1d140d",
    pattern: "stripes",
    stripeDensity: 0.72,
    bellyLightenAmt: 0.45,
    roughness: 0.86,
    furLayers: 12,
    furLength: 0.032,
  },
  pose: "crouch",
  gait: {
    freq: 0.72,
    swing: 0.82,
    spine: 1.08,
    tail: 0.22,
    stepLen: 0.16,
    lean: 0.16,
    breathe: 0.02,
    creepLow: 0.22,
    directRegister: 0.9,
    creepCadence: 0.56,
  },
  semantics: { niche: "apex", diet: "carnivore", activityCycle: "crepuscular", sociality: "solitary" },
  habitat: "snow",
  archive: {
    discoverer: "林泉",
    site: "雪竹溪涧",
    era: "拟生纪·冬",
    conservation: "濒危",
    description: "大型独居伏击者，借林草遮蔽缓慢接近，以短距离冲刺和扑击完成猎捕。",
  },
  relations: [
    { type: "prey", target: "野猪 / 鹿", strength: 0.9, note: "主要猎物" },
    { type: "rival", target: "豹 / 豺", strength: 0.45, note: "同域竞争" },
    { type: "symbiotic", target: "竹林 / 高草", strength: 0.7, note: "遮蔽潜行" },
  ],
};

const AVIAN_PRESET = {
  cnName: "白额雁建模样本",
  scientificName: "Anser albifrons",
  taxonomyClass: "bird",
  anatomyType: "AVIAN",
  taxonomyId: "ANSERIFORMES-ANATIDAE-ANSER",
  dimensions: { width: 0.35, height: 0.78, length: 0.85 },
  anatomicalRef: {
    withersHeight: 0.5,
    tailLength: 0.16,
    wingspan: 1.55,
    earLength: 0.02,
    note: "禽类基线：二足站立、长颈前伸、双翼由肩部展开，行走时以头颈顿挫补偿身体移动。",
  },
  rigTuning: { neckLen: 1.65, legFold: 0.65, backAngle: 0.02, hockLift: 0.1 },
  shape: { rumpScale: 1.1, bellyScale: 1.15, chestScale: 1.05, headScale: 0.9, legScale: 0.72, tailScale: 0.25 },
  rendering: {
    vertexColors: true,
    baseColor: "#8a7a5f",
    stripeColor: "#3f372c",
    pattern: "solid",
    stripeDensity: 0.15,
    bellyLightenAmt: 0.55,
    roughness: 0.9,
    furLayers: 0,
    furLength: 0,
  },
  pose: "stand",
  gait: {
    freq: 1.1,
    swing: 1.05,
    spine: 0.5,
    tail: 0.08,
    stepLen: 0.1,
    lean: 0.03,
    breathe: 0.018,
    creepLow: 0.08,
    directRegister: 0.15,
    creepCadence: 0.8,
  },
  semantics: { niche: "canopy", diet: "omnivore", activityCycle: "diurnal", sociality: "flock" },
  habitat: "pond",
  archive: {
    discoverer: "林泉",
    site: "寒梅塘岸",
    era: "拟生纪·冬",
    conservation: "迁徙鸟类",
    description: "群飞水禽，长颈与翼面决定主要轮廓；落地后以二足步态、探头顿挫和收拢双翼活动。",
  },
  relations: [
    { type: "symbiotic", target: "寒塘 / 溪岸", strength: 0.8, note: "栖息与取水" },
    { type: "predator", target: "大型猫科", strength: 0.75, note: "警戒回避" },
    { type: "symbiotic", target: "雁群", strength: 0.9, note: "编队与集群警戒" },
  ],
};

let record = null;
let entity = null;
let renderer, scene, camera, controls, clock;
let skeletonHelper = null;
let controller = null;
let behaviorState = "IDLE";
let anatomyLockedByUser = false;
let viewInitialized = false;
let userAdjustedView = false;
let anatomyInspectMode = false;

function snapshotView() {
  if (!renderer || !scene || !camera) return null;
  try { return renderer.domElement.toDataURL('image/png'); } catch (e) { return null; }
}

function modelAnatomy(type) {
  return ANATOMY_TO_MODEL[type] || type || "DIGITIGRADE";
}

function labAnatomy(type) {
  return MODEL_TO_LAB[type] || type || "FELINE";
}

function anatomyLabel(type) {
  return ANATOMY_LABELS[type] || ANATOMY_LABELS[modelAnatomy(type)] || type || "未知";
}

function isAvianRecord(rec, previousType = null) {
  return modelAnatomy(rec?.anatomyType) === "AVES"
    || modelAnatomy(previousType) === "AVES"
    || rec?.taxonomyClass === "bird"
    || el("cfg-class")?.value === "bird";
}

function normalizeAnatomyChoice(rec, previousType = null) {
  if (!rec) return;
  if (rec.anatomyType === "SALTATORIAL" && isAvianRecord(rec, previousType)) {
    rec.anatomyType = "AVIAN_CURSORIAL";
  }
}

function computedGaitFor(rec) {
  const gait = computeGait(modelAnatomy(rec.anatomyType), rec.dimensions || {}, {
    neckLen: rec.rigTuning?.neckLen,
    legLen: rec.shape?.legScale,
    tailLen: rec.shape?.tailScale,
  });
  if (rec.anatomyType === "AVIAN_CURSORIAL") {
    gait.freq = Math.max(gait.freq, 1.25);
    gait.swing = Math.max(gait.swing, 1.25);
    gait.tail = Math.min(gait.tail, 0.55);
    gait.locomotion = "cursorial";
    gait.note = "长腿走禽健步行走，短翼参与平衡，颈部随步伐探头配重";
  }
  return gait;
}

function applyBiomechanics(rec) {
  const gait = computedGaitFor(rec);
  applyComputedGait(rec, gait);
  rec.gait.locomotion = gait.locomotion;
  rec.gait.froude = gait.froude;
  rec.gait.prefSpeed = gait.prefSpeed;
  return gait;
}

function colorHex(value, fallback) {
  try { return new THREE.Color(value ?? fallback).getHex(); }
  catch (_) { return fallback; }
}

function avianBuildParams(rec) {
  const dim = rec.dimensions || {};
  const ref = rec.anatomicalRef || {};
  const shape = rec.shape || {};
  const cursorial = rec.anatomyType === "AVIAN_CURSORIAL";
  const h = Math.max(0.22, dim.height || 0.5);
  const k = h / 0.42;
  const bodyHalfWidth = THREE.MathUtils.clamp((dim.width || 0.28) / Math.max(k * 2, 0.1), 0.075, 0.17);
  const rump = THREE.MathUtils.clamp(shape.rumpScale ?? 1, 0.75, 1.45);
  const bodyHalfLen = THREE.MathUtils.clamp((dim.length || 0.75) / Math.max(k, 0.1) * 0.42 * (0.92 + (rump - 1) * 0.2), 0.18, 0.34);
  const neckScaleY = THREE.MathUtils.clamp(rec.rigTuning?.neckLen ?? 1.2, 0.9, 2.25);
  const wingSpan = ref.wingspan || (dim.length || 0.75) * 1.7;
  const wingHalf = THREE.MathUtils.clamp(wingSpan / Math.max(k, 0.1) / 10, cursorial ? 0.045 : 0.075, cursorial ? 0.11 : 0.17);
  const tailLen = THREE.MathUtils.clamp((ref.tailLength || 0.16) / Math.max(k, 0.1) * (shape.tailScale || 1), 0.11, 0.45);
  const belly = THREE.MathUtils.clamp(shape.bellyScale ?? 1, 0.75, 1.35);
  const chest = THREE.MathUtils.clamp(shape.chestScale ?? 1, 0.75, 1.35);
  const featherDetail = THREE.MathUtils.clamp(rec.rendering?.stripeDensity ?? 0.25, 0, 1);
  const base = colorHex(rec.rendering?.baseColor, 0x8a7a5f);
  const dark = colorHex(rec.rendering?.stripeColor, 0x3f372c);
  return {
    height: h,
    bodyColor: base,
    accentColor: 0xd9d2c2,
    neckColor: new THREE.Color(base).lerp(new THREE.Color(dark), 0.35).getHex(),
    wingColor: new THREE.Color(base).lerp(new THREE.Color(dark), 0.22).getHex(),
    tailColor: dark,
    tailBaseColor: base,
    crestColor: 0xd8c35a,
    wingPatchColor: featherDetail > 0.55 ? new THREE.Color(base).lerp(new THREE.Color(dark), 0.55).getHex() : null,
    shape: {
      bodyScale: [bodyHalfWidth, (cursorial ? 0.115 : 0.13) * belly, bodyHalfLen],
      bodyY: 0.23,
      neckPos: [0, 0.34 + neckScaleY * 0.035, bodyHalfLen * 0.82],
      neckR: THREE.MathUtils.clamp(bodyHalfWidth * 0.42, 0.035, 0.075),
      neckSausage: neckScaleY > 1.2,
      neckScale: [1, neckScaleY, 1.2 + neckScaleY * 0.2],
      neckRBase: THREE.MathUtils.clamp(bodyHalfWidth * 0.55, 0.045, 0.09),
      neckRTip: THREE.MathUtils.clamp(bodyHalfWidth * 0.28, 0.025, 0.05),
      headR: THREE.MathUtils.clamp(bodyHalfWidth * (shape.headScale ?? 1) * 0.38, 0.032, 0.058),
      headPos: [0, 0.08, 0.05],
      crestCount: cursorial ? 0 : rec.scientificName?.toLowerCase().includes("chrysolophus") ? 7 : 0,
      beakR: THREE.MathUtils.clamp(bodyHalfWidth * 0.16, 0.012, 0.022),
      beakLen: THREE.MathUtils.clamp((dim.length || 0.75) / Math.max(k, 0.1) * 0.09, 0.055, 0.12),
      beakColor: 0x2e2a26,
      beakPos: [0, 0.08, 0.1],
      eyePos: [THREE.MathUtils.clamp(bodyHalfWidth * 0.28, 0.026, 0.04), 0.09, 0.073],
      eyeR: 0.011,
      wingScale: [0.035 * chest, wingHalf, THREE.MathUtils.clamp(bodyHalfLen * (cursorial ? 0.62 : 0.86), 0.12, 0.28)],
      wingPivot: [bodyHalfWidth * 0.72, 0.26, bodyHalfLen * 0.08],
      wingTipX: bodyHalfWidth * 0.2,
      tailPos: [0, 0.22, -bodyHalfLen * 0.95],
      tailLen,
      tailW: THREE.MathUtils.clamp(bodyHalfWidth * 0.36, 0.03, 0.06),
      tailCount: THREE.MathUtils.clamp(Math.round((tailLen > 0.28 ? 5 : 3) + featherDetail * 5), 3, 10),
      legH: THREE.MathUtils.clamp(h * (shape.legScale ?? 0.7) / Math.max(k, 0.1) * 0.28, 0.11, 0.2),
      legR: THREE.MathUtils.clamp(bodyHalfWidth * 0.055, 0.006, 0.012),
      legX: bodyHalfWidth * 0.34,
      legZ: -bodyHalfLen * 0.08,
      legColor: 0x4a4038,
    },
  };
}

function buildAvianEntity(rec) {
  const built = buildAvianBody(avianBuildParams(rec));
  built.cursorial = rec.anatomyType === "AVIAN_CURSORIAL";
  const node = built.group;
  node.currentState = behaviorState;
  node.userData.kind = built.cursorial ? "AVIAN_CURSORIAL" : "AVIAN";
  node.setBehaviorState = (state) => { node.currentState = state; };
  node.tick = (ctx) => tickAvianPreview(built, node.currentState, ctx);
  return node;
}

function tickAvianPreview(built, state, ctx) {
  const t = ctx.time ?? 0;
  const dt = ctx.dt ?? 0.016;
  const gait = ctx.gait ?? 0;
  const phase = gait * Math.PI * 2;
  const k = Math.min(dt * 8, 1);
  const lerp = (obj, prop, val, rate = k) => { obj[prop] += (val - obj[prop]) * rate; };
  const n1 = built.head, n2 = built.headBone, hg = built.headGroup;
  const headBob = 1 + THREE.MathUtils.clamp(ctx.lean ?? 0.08, 0, 0.35) * 1.6;
  const stride = THREE.MathUtils.clamp((ctx.stepLen ?? 0.1) / 0.1, 0.5, 2.4) * (built.cursorial ? 1.18 : 1);
  const tailAmp = THREE.MathUtils.clamp(ctx.tail ?? 0.08, 0, 0.3);
  const wingSpread = state === "POUNCE" ? (built.cursorial ? 1.65 : 2.8) : state === "TROT" ? (built.cursorial ? 1.25 : 1.7) : 1;
  let wingBase = 0.36;
  if (state === "POUNCE") wingBase = built.cursorial ? 0.88 + Math.sin(t * 9) * 0.16 : 1.35 + Math.sin(t * 13) * 0.72;
  else if (state === "TROT") wingBase = built.cursorial ? 0.58 + Math.sin(t * 8) * 0.08 : 0.82 + Math.sin(t * 10) * 0.18;
  else if (state === "WALK") wingBase = 0.42 + Math.sin(phase) * 0.03;
  for (const w of built.wings || []) {
    lerp(w.pivot.rotation, "z", w.side * wingBase);
    if (w.mesh) {
      lerp(w.mesh.scale, "y", wingSpread, Math.min(dt * 4, 1));
      lerp(w.mesh.scale, "z", state === "POUNCE" ? 1.35 : 1, Math.min(dt * 4, 1));
    }
  }

  if (n1 && n2) {
    if (state === "WALK" || state === "TROT") {
      const jerk = Math.pow(Math.sin(phase), 3);
      const n1x = 0.16 + jerk * 0.26 * headBob;
      const n2x = -0.24 - Math.pow(Math.sin(phase - 0.35), 3) * 0.34 * headBob;
      lerp(n1.rotation, "x", n1x);
      lerp(n1.rotation, "y", Math.sin(phase) * 0.08 * stride);
      lerp(n2.rotation, "x", n2x);
      lerp(n2.rotation, "y", -Math.sin(phase - 0.35) * 0.08 * stride);
      if (hg) {
        lerp(hg.rotation, "x", -(n1x + n2x) * 0.4 + 0.03);
        lerp(hg.rotation, "y", 0);
      }
    } else if (state === "CREEP") {
      const peck = Math.sin(phase) > -0.2 ? 0.72 : 0.25;
      lerp(n1.rotation, "x", peck);
      lerp(n1.rotation, "y", Math.sin(t * 1.3) * 0.12);
      lerp(n2.rotation, "x", -0.18);
      if (hg) lerp(hg.rotation, "x", -peck * 0.28 + Math.max(0, Math.sin(phase)) * 0.22);
    } else if (state === "POUNCE") {
      lerp(n1.rotation, "x", -0.06);
      lerp(n1.rotation, "y", 0);
      lerp(n2.rotation, "x", 0.08);
      if (hg) lerp(hg.rotation, "x", 0.02);
    } else {
      const scan = Math.sin(t * 0.8);
      lerp(n1.rotation, "x", Math.sin(t * 1.4) * 0.04);
      lerp(n1.rotation, "y", scan * 0.24);
      lerp(n2.rotation, "x", Math.sin(t * 1.4 + 0.6) * -0.035);
      lerp(n2.rotation, "y", -scan * 0.12);
      if (hg) lerp(hg.rotation, "x", 0.02);
    }
  }

  for (const [i, leg] of (built.legs || []).entries()) {
    const side = i === 0 ? 1 : -1;
    const walk = (state === "WALK" || state === "TROT" || state === "CREEP") ? Math.sin(phase + i * Math.PI) : 0;
    lerp(leg.rotation, "x", walk * (state === "TROT" ? 0.34 : 0.2) * stride);
    lerp(leg.rotation, "z", side * Math.abs(walk) * 0.08);
  }
  if (built.tail) {
    lerp(built.tail.rotation, "x", state === "POUNCE" ? -0.05 : 0.1 + Math.sin(t * 1.1) * 0.03);
    lerp(built.tail.rotation, "y", Math.sin(phase) * tailAmp);
  }
}

function researchModeFor(rec) {
  if (rec?.anatomyType === "AVIAN_CURSORIAL") return "cursorial";
  if (modelAnatomy(rec?.anatomyType) === "AVES") return "avian";
  if (rec?.anatomyType === "SALTATORIAL" || rec?.anatomyType === "LAGOMORPH") return "saltatorial";
  return "feline";
}

function isPheasantLike(rec) {
  const name = `${rec?.cnName || ""} ${rec?.scientificName || ""}`.toLowerCase();
  return /锦鸡|雉|pheasant|chrysolophus|phasianus/.test(name);
}

function researchRowsFor(rec, gait = null) {
  const mode = researchModeFor(rec);
  const dim = rec?.dimensions || {};
  const ref = rec?.anatomicalRef || {};
  const shape = rec?.shape || {};
  const rig = rec?.rigTuning || {};
  const g = gait || computedGaitFor(rec);
  const species = rec?.scientificName || rec?.cnName || "未命名物种";

  if (mode === "cursorial") {
    return [
      ["走禽比例", `${species}：长腿短翼的二足体型 → 站高 ${fmt(dim.height)}m、短翼展 ${fmt(ref.wingspan)}m、长腿步幅 ${fmt(shape.legScale)}。`],
      ["后肢骨架", `骨盆-股骨-胫跗跖链承担主要推进 → 长颈系数 ${fmt(rig.neckLen)}、躯干重心 ${fmt(shape.rumpScale)}、尾羽配平 ${fmt(shape.tailScale)}。`],
      ["健步状态机", `鸵鸟自由活动步态给走禽分支定标 → 步距 ${fmt(rec?.gait?.stepLen)}m、步频 ${fmt(g.freq)}Hz、Fr ${g.froude ?? "—"}。`],
    ];
  }

  if (mode === "avian") {
    const habitatCue = isPheasantLike(rec)
      ? "山地林下地栖、短促飞行"
      : "二足站立、颈部探头、双翼收放";
    return [
      ["鸟体轮廓", `${species}：${habitatCue} → 站高 ${fmt(dim.height)}m、翼展 ${fmt(ref.wingspan)}m、尾羽 ${fmt(ref.tailLength)}m。`],
      ["禽类骨架", `禽类骨架以胸肩、翼、腿分区装配 → 颈长 ${fmt(rig.neckLen)}、跗跖腿长 ${fmt(shape.legScale)}、翼肩胸肌 ${fmt(shape.chestScale)}。`],
      ["二足步态", `踱步/觅食以头颈顿挫补偿身体移动 → 步距 ${fmt(rec?.gait?.stepLen)}m、探头 ${fmt(rec?.gait?.lean)}、尾羽摆幅 ${fmt(rec?.gait?.tail)}。`],
    ];
  }

  if (mode === "saltatorial") {
    return [
      ["跳跃比例", `${species}：后肢发达的跳跃型轮廓 → 总高 ${fmt(dim.height)}m、后肢长度 ${fmt(shape.legScale)}、臀胯肌量 ${fmt(shape.rumpScale)}。`],
      ["落地骨架", `髋、膝、跗关节用于蓄力和缓冲 → 躯干俯仰 ${fmt(rig.backAngle)}、飞节抬升 ${fmt(rig.hockLift)}、尾部配平 ${fmt(shape.tailScale)}。`],
      ["弹跳状态机", `跳跃分支保持后肢推进，而不回退猫科潜行 → 步距 ${fmt(rec?.gait?.stepLen)}m、步频 ${fmt(g.freq)}Hz、尾摆 ${fmt(rec?.gait?.tail)}。`],
    ];
  }

  return [
    ["伏击伪装", `${species}：伏击猎手与条纹遮蔽 → 背线压低 ${fmt(rig.backAngle)}、潜行压低 ${fmt(rec?.gait?.creepLow)}、颈前伸 ${fmt(rec?.gait?.lean)}。`],
    ["趾行骨架", `猫科肩胛和尾部参与平衡 → 肩高 ${fmt(ref.withersHeight)}m、四肢长度 ${fmt(shape.legScale)}、尾长 ${fmt(ref.tailLength)}m。`],
    ["潜行步态", `猫科慢速潜行强调稳定和安静落足 → 后足贴印 ${fmt(rec?.gait?.directRegister)}、步距 ${fmt(rec?.gait?.stepLen)}m、步频 ${fmt(g.freq)}Hz。`],
  ];
}

function refreshResearchMapping(gait = null) {
  if (!record) return;
  const list = el("evidence-list");
  if (list) {
    list.innerHTML = "";
    for (const [label, text] of researchRowsFor(record, gait)) {
      const li = document.createElement("li");
      const b = document.createElement("b");
      const em = document.createElement("em");
      b.textContent = label;
      em.textContent = text;
      li.append(b, em);
      list.appendChild(li);
    }
  }

  const links = el("source-links");
  if (links) {
    links.innerHTML = "";
    const sources = RESEARCH_SOURCE_SETS[researchModeFor(record)] || RESEARCH_SOURCE_SETS.feline;
    for (const [label, href] of sources) {
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = label;
      links.appendChild(a);
    }
  }
}

function markPipeline(activeStep = "state") {
  document.querySelectorAll("#pipeline-list li").forEach((li) => {
    const order = ["image", "rig", "mesh", "state"];
    const i = order.indexOf(li.dataset.buildStep);
    const activeI = order.indexOf(activeStep);
    li.classList.toggle("done", activeI < 0 || i <= activeI);
    li.classList.toggle("active", li.dataset.buildStep === activeStep);
  });
}

function refreshBuildReadouts(activeStep = "state") {
  if (!record) return;
  const gait = computedGaitFor(record);
  const dim = record.dimensions || {};
  const ref = record.anatomicalRef || {};
  const isAvian = modelAnatomy(record.anatomyType) === "AVES";
  updateStateButtonsForAnatomy();
  if (el("read-anatomy")) el("read-anatomy").textContent = `${anatomyLabel(record.anatomyType)} · ${record.scientificName || "未命名"}`;
  if (el("read-rig")) el("read-rig").textContent = isAvian
    ? `站高 ${fmt(dim.height)}m · 翼展 ${fmt(ref.wingspan)}m`
    : `肩高 ${fmt(ref.withersHeight)}m · 尾长 ${fmt(ref.tailLength)}m`;
  if (el("read-mesh")) el("read-mesh").textContent = isAvian
    ? `${fmt(dim.width)}×${fmt(dim.height)}×${fmt(dim.length)}m · 喙/翼/尾羽`
    : `${fmt(dim.width)}×${fmt(dim.height)}×${fmt(dim.length)}m · ${record.rendering?.furLayers ?? 0} 层皮毛`;
  if (el("read-gait")) el("read-gait").textContent = `Fr ${gait.froude} · ${gait.freq}Hz · ${gait.locomotion}`;
  if (el("kind-hint")) el("kind-hint").textContent = `${anatomyLabel(record.anatomyType)} · ${behaviorState} · ${gait.note || "状态机动画"}`;
  refreshResearchMapping(gait);
  markPipeline(activeStep);
}

function updateStateButtonsForAnatomy() {
  const isAvian = modelAnatomy(record?.anatomyType) === "AVES";
  const labels = record?.anatomyType === "AVIAN_CURSORIAL"
    ? { IDLE: "伫立", WALK: "健步", TROT: "疾跑", CREEP: "觅食", POUNCE: "展翼平衡" }
    : isAvian
    ? { IDLE: "栖立", WALK: "踱步", TROT: "奔跑", CREEP: "觅食", POUNCE: "振翅" }
    : { IDLE: "静立", WALK: "行走", TROT: "小跑", CREEP: "匍匐", POUNCE: "扑击" };
  document.querySelectorAll(".state-btn").forEach((btn) => {
    btn.textContent = labels[btn.dataset.state] || btn.textContent;
  });
}

function fmt(v) {
  return Number.isFinite(v) ? Number(v).toFixed(2) : "—";
}

function setBehaviorStateUI(state) {
  behaviorState = state;
  document.querySelectorAll(".state-btn").forEach((x) => x.classList.toggle("active", x.dataset.state === state));
  if (el("cfg-pose")) el("cfg-pose").value = state === "CREEP" ? "crouch" : "stand";
  if (entity) entity.setBehaviorState(behaviorState);
  refreshBuildReadouts("state");
}

function buildEntity(rec) {
  if (modelAnatomy(rec.anatomyType) === "AVES") return buildAvianEntity(rec);
  // 模块一（数据仓库）/ 二（装配器）/ 三（网格生成器）经 BioEntityMesh 一次性构建：
  // familyNode 提供 anatomyType，speciesNode 提供 dimensions/anatomicalRef/rendering/shape。
  const familyNode = { anatomyType: modelAnatomy(rec.anatomyType) };
  const speciesNode = { ...rec, anatomyType: modelAnatomy(rec.anatomyType) };
  const hooks = {
    paintGeometry: (geo) => paintGeometry(geo, speciesNode.dimensions, speciesNode.anatomicalRef, speciesNode.rendering),
  };
  const node = new BioEntityMesh(familyNode, speciesNode, hooks);
  node.setBehaviorState(behaviorState);
  return node;
}

function frameEntityView(box, { resetView = false } = {}) {
  if (!camera || !box) return;
  const sizeV = box.getSize(new THREE.Vector3());
  const size = Math.max(sizeV.length(), 0.5);
  const target = new THREE.Vector3(0, box.min.y + sizeV.y * 0.45, 0);
  const dist = size * 1.5;
  if (!controls) {
    camera.position.set(dist * 0.7, target.y + size * 0.28, dist);
    camera.lookAt(target);
    return;
  }
  if (resetView || !viewInitialized || !userAdjustedView) {
    camera.position.set(dist * 0.7, target.y + size * 0.28, dist);
    controls.target.copy(target);
  } else {
    const offset = camera.position.clone().sub(controls.target);
    controls.target.copy(target);
    camera.position.copy(target).add(offset);
  }
  controls.minDistance = Math.max(size * 0.35, 0.6);
  controls.maxDistance = Math.max(size * 6, 8);
  controls.update();
  viewInitialized = true;
}

function rebuild(opts = {}) {
  if (entity) {
    clearAnatomyOverlay();
    scene.remove(entity);
    disposeEntity(entity);
  }
  entity = buildEntity(record);
  scene.add(entity);
  const box = new THREE.Box3().setFromObject(entity);
  const c = box.getCenter(new THREE.Vector3());
  const sizeV = box.getSize(new THREE.Vector3());
  const rawSize = sizeV.length();
  // 模型整体居中到原点，并把高度归一到 ~2.5m（实验室标准预览尺寸），过小/过大都能看清
  const TARGET_H = 2.5;
  const scale = rawSize > 1e-4 ? Math.max(TARGET_H / sizeV.y, 0.1) : 1;
  entity.scale.setScalar(scale);
  entity.position.x -= c.x;
  entity.position.z -= c.z;
  // 缩放后重新算包围盒贴地
  entity.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(entity);
  entity.position.y -= box2.min.y;
  entity.updateMatrixWorld(true);
  const framedBox = new THREE.Box3().setFromObject(entity);
  frameEntityView(framedBox, opts);
  refreshAnatomyOverlay();
  refreshBuildReadouts("mesh");
}

function setMaterialInspectState(mat, enabled, isFurLayer = false) {
  if (!mat || !mat.isMaterial) return;
  if (enabled) {
    mat.userData.labInspectOriginal ??= {
      transparent: mat.transparent,
      opacity: mat.opacity,
      depthWrite: mat.depthWrite,
      alphaTest: mat.alphaTest,
    };
    const baseOpacity = mat.userData.labInspectOriginal.opacity ?? 1;
    mat.transparent = true;
    mat.opacity = Math.min(baseOpacity, isFurLayer ? 0.13 : 0.34);
    mat.depthWrite = false;
    mat.needsUpdate = true;
    return;
  }
  const original = mat.userData.labInspectOriginal;
  if (!original) return;
  mat.transparent = original.transparent;
  mat.opacity = original.opacity;
  mat.depthWrite = original.depthWrite;
  mat.alphaTest = original.alphaTest;
  delete mat.userData.labInspectOriginal;
  mat.needsUpdate = true;
}

function applyInspectMaterials(root, enabled) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const isFurLayer = o.isSkinnedMesh && o !== root.skin && mats.some((m) => (m?.alphaTest ?? 0) > 0);
    mats.forEach((mat) => setMaterialInspectState(mat, enabled, isFurLayer));
  });
}

function configureBoneLine(obj, color = 0xffe4a3) {
  if (!obj?.material) return;
  obj.material.color?.set?.(color);
  obj.material.transparent = true;
  obj.material.opacity = 0.95;
  obj.material.depthTest = false;
  obj.material.depthWrite = false;
  obj.material.needsUpdate = true;
  obj.renderOrder = 50;
  obj.frustumCulled = false;
}

function addSegment(points, a, b) {
  points.push(a.clone(), b.clone());
}

function createGuideSkeletonLines(root, rec) {
  if (!root) return null;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (size.lengthSq() <= 1e-6) return null;
  const c = box.getCenter(new THREE.Vector3());
  const points = [];
  const yFoot = box.min.y + size.y * 0.05;
  const yHip = box.min.y + size.y * 0.45;
  const yShoulder = box.min.y + size.y * 0.58;
  const yHead = box.min.y + size.y * 0.78;
  const rear = box.min.z + size.z * 0.22;
  const mid = c.z;
  const front = box.max.z - size.z * 0.2;
  const side = size.x * 0.28;
  const isAvian = modelAnatomy(rec?.anatomyType) === "AVES";

  if (isAvian) {
    const pelvis = new THREE.Vector3(c.x, yHip, mid - size.z * 0.08);
    const chest = new THREE.Vector3(c.x, yShoulder, front - size.z * 0.08);
    const neck = new THREE.Vector3(c.x, yHead, front + size.z * 0.02);
    const skull = new THREE.Vector3(c.x, box.min.y + size.y * 0.9, front + size.z * 0.12);
    addSegment(points, pelvis, chest);
    addSegment(points, chest, neck);
    addSegment(points, neck, skull);
    addSegment(points, pelvis, new THREE.Vector3(c.x, yHip, rear));
    addSegment(points, new THREE.Vector3(c.x, yHip, rear), new THREE.Vector3(c.x, yHip - size.y * 0.04, box.min.z + size.z * 0.08));
    for (const s of [-1, 1]) {
      const wingRoot = new THREE.Vector3(c.x + s * side * 0.55, yShoulder, front - size.z * 0.1);
      const wingTip = new THREE.Vector3(c.x + s * size.x * 0.44, yShoulder - size.y * 0.06, mid);
      const knee = new THREE.Vector3(c.x + s * side * 0.28, yFoot + size.y * 0.18, mid - size.z * 0.02);
      const foot = new THREE.Vector3(c.x + s * side * 0.42, yFoot, front - size.z * 0.05);
      addSegment(points, chest, wingRoot);
      addSegment(points, wingRoot, wingTip);
      addSegment(points, pelvis, knee);
      addSegment(points, knee, foot);
      addSegment(points, foot, new THREE.Vector3(foot.x, foot.y, foot.z + size.z * 0.08));
    }
  } else {
    const pelvis = new THREE.Vector3(c.x, yHip, rear);
    const chest = new THREE.Vector3(c.x, yShoulder, front);
    const neck = new THREE.Vector3(c.x, yHead, front + size.z * 0.05);
    const skull = new THREE.Vector3(c.x, box.min.y + size.y * 0.72, box.max.z - size.z * 0.02);
    addSegment(points, pelvis, chest);
    addSegment(points, chest, neck);
    addSegment(points, neck, skull);
    addSegment(points, pelvis, new THREE.Vector3(c.x, yHip - size.y * 0.02, box.min.z + size.z * 0.04));
    for (const z of [front - size.z * 0.08, rear + size.z * 0.04]) {
      addSegment(points, new THREE.Vector3(c.x - side, yHip, z), new THREE.Vector3(c.x + side, yHip, z));
      for (const s of [-1, 1]) {
        const hip = new THREE.Vector3(c.x + s * side, z > mid ? yShoulder : yHip, z);
        const knee = new THREE.Vector3(c.x + s * side * 0.88, yFoot + size.y * 0.22, z + (z > mid ? -1 : 1) * size.z * 0.04);
        const paw = new THREE.Vector3(c.x + s * side * 0.72, yFoot, z + (z > mid ? 1 : -1) * size.z * 0.08);
        addSegment(points, hip, knee);
        addSegment(points, knee, paw);
      }
    }
  }

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: 0xbfe7ff,
    transparent: true,
    opacity: 0.75,
    depthTest: false,
    depthWrite: false,
  });
  const line = new THREE.LineSegments(geo, mat);
  line.name = "AnatomyGuideSkeleton";
  line.renderOrder = 49;
  line.frustumCulled = false;
  return line;
}

function clearAnatomyOverlay({ restoreMaterials = true } = {}) {
  if (restoreMaterials) applyInspectMaterials(entity, false);
  if (!skeletonHelper) return;
  scene?.remove(skeletonHelper);
  skeletonHelper.traverse((o) => {
    o.geometry?.dispose?.();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose?.());
  });
  skeletonHelper = null;
}

function refreshAnatomyOverlay() {
  if (!scene) return;
  if (skeletonHelper) clearAnatomyOverlay({ restoreMaterials: false });
  if (!entity) return;
  if (!anatomyInspectMode) {
    applyInspectMaterials(entity, false);
    return;
  }
  applyInspectMaterials(entity, true);
  entity.updateMatrixWorld(true);
  const overlay = new THREE.Group();
  overlay.name = "AnatomyRigOverlay";
  const helper = new THREE.SkeletonHelper(entity);
  configureBoneLine(helper);
  overlay.add(helper);
  const guide = createGuideSkeletonLines(entity, record);
  if (guide) overlay.add(guide);
  skeletonHelper = overlay;
  scene.add(skeletonHelper);
}

function setAnatomyInspectMode(enabled) {
  anatomyInspectMode = !!enabled;
  const btn = el("inspect-rig-btn");
  btn?.classList.toggle("active", anatomyInspectMode);
  btn?.setAttribute("aria-pressed", String(anatomyInspectMode));
  refreshAnatomyOverlay();
  refreshBuildReadouts("rig");
}

function disposeEntity(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  });
}

/* ============ 字段双向绑定 ============ */
function applyFromUI() {
  for (const [id, path] of Object.entries(FIELD_MAP)) {
    const input = el(id);
    if (!input) continue;
    let v;
    if (input.type === "range" || input.type === "number") v = parseFloat(input.value);
    else if (input.type === "checkbox") v = input.checked;
    else v = input.value;
    setAt(record, path, v);
  }
  record.semantics ??= {};
  for (const [id, key] of Object.entries(SEM_MAP)) {
    const s = el(id); if (s) record.semantics[key] = s.value;
  }
  record.archive ??= {};
  for (const [id, key] of Object.entries(ARC_MAP)) {
    const s = el(id); if (s) record.archive[key] = s.value;
  }
  record.habitat = el("sem-env")?.value || record.habitat || "stream";
}

function refreshFields() {
  const VAL_ALIAS = { "cfg-step-len": "v-step" };
  for (const [id, path] of Object.entries(FIELD_MAP)) {
    const input = el(id);
    if (!input) continue;
    const v = getAt(record, path);
    if (v == null) continue;
    if (input.type === "range" || input.type === "number") {
      input.value = v;
      const out = el(VAL_ALIAS[id] || ("v-" + id.replace("cfg-", "")));
      if (out) out.textContent = (typeof v === "number") ? (Number.isInteger(v) ? v : v.toFixed(2)) : v;
    } else if (input.type === "checkbox") {
      input.checked = !!v;
    } else {
      input.value = v;
    }
  }
  record.semantics ??= {};
  for (const [id, key] of Object.entries(SEM_MAP)) {
    const s = el(id); if (s && record.semantics[key] != null) s.value = record.semantics[key];
  }
  record.archive ??= {};
  for (const [id, key] of Object.entries(ARC_MAP)) {
    const s = el(id); if (s && record.archive[key] != null) s.value = record.archive[key];
  }
  if (el("sem-env") && record.habitat) el("sem-env").value = record.habitat;
  if (el("arc-thumb")) el("arc-thumb").value = record.archive.thumb || "";
  refreshSpeciesSpecificUI();
}

function refreshSpeciesSpecificUI() {
  const isAves = modelAnatomy(record?.anatomyType) === "AVES";
  const profile = record?.anatomyType === "AVIAN_CURSORIAL"
    ? PARAMETER_PROFILES.AVIAN_CURSORIAL
    : isAves ? PARAMETER_PROFILES.AVIAN : PARAMETER_PROFILES.FELINE;
  document.body?.setAttribute("data-lab-anatomy", isAves ? "avian" : "feline");
  applyParameterProfile(profile);
  updateStateButtonsForAnatomy();
}

function fieldForInput(id) {
  return el(id)?.closest(".field") || el(id);
}

function setFieldVisible(id, visible) {
  const field = fieldForInput(id);
  if (!field) return;
  field.hidden = !visible;
  field.style.display = visible ? "" : "none";
}

function setFieldLabel(id, text) {
  const label = fieldForInput(id)?.querySelector("label");
  if (label && text) label.textContent = text;
}

function applyRangeProfile(id, spec) {
  const input = el(id);
  if (!input || !Array.isArray(spec)) return;
  const [min, max, step] = spec;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  if (input.type !== "range" && input.type !== "number") return;
  const current = parseFloat(input.value);
  if (!Number.isFinite(current)) return;
  const next = THREE.MathUtils.clamp(current, min, max);
  if (next !== current) {
    input.value = next;
    const path = FIELD_MAP[id];
    if (path && record) setAt(record, path, next);
  }
}

function applyPoseLabels(profile) {
  const pose = el("cfg-pose");
  if (!pose || !profile.pose) return;
  for (const option of pose.options) {
    if (profile.pose[option.value]) option.textContent = profile.pose[option.value];
  }
}

function applyParameterProfile(profile) {
  const hidden = new Set(profile.hide || []);
  const shown = new Set(profile.show || []);
  for (const id of Object.keys(FIELD_MAP)) {
    if (hidden.has(id)) setFieldVisible(id, false);
    else if (shown.has(id)) setFieldVisible(id, true);
  }
  for (const [id, text] of Object.entries(profile.labels || {})) setFieldLabel(id, text);
  for (const [id, spec] of Object.entries(profile.ranges || {})) applyRangeProfile(id, spec);
  applyPoseLabels(profile);
  refreshValueLabels();
}

function bindFields() {
  // 形体/骨架/皮毛/姿态：input → record，并重建（防抖）
  let timer = null;
  const onChange = ({ anatomyChanged = false, previousAnatomyType = null } = {}) => {
    applyFromUI();
    if (anatomyChanged) {
      normalizeAnatomyChoice(record, previousAnatomyType);
      applyAnatomyProfileDefaults(record);
      refreshFields();
    }
    // 标注禽类专属字段
    refreshSpeciesSpecificUI();
    refreshValueLabels();
    refreshBuildReadouts("rig");
    clearTimeout(timer);
    timer = setTimeout(() => rebuild(), 220);
  };
  for (const id of Object.keys(FIELD_MAP)) {
    const input = el(id);
    if (!input) continue;
    if (id === "cfg-anatomy") {
      input.addEventListener("change", () => {
        const previousAnatomyType = record?.anatomyType;
        anatomyLockedByUser = true;
        onChange({ anatomyChanged: true, previousAnatomyType });
      });
    } else {
      input.addEventListener("input", onChange);
    }
  }
  el("rebuild-btn")?.addEventListener("click", () => {
    applyFromUI();
    rebuild();
    refreshSemantics();
    showToast("已按当前参数重建模型");
  });
  el("inspect-rig-btn")?.addEventListener("click", () => {
    setAnatomyInspectMode(!anatomyInspectMode);
  });
  for (const id of Object.keys(SEM_MAP)) el(id)?.addEventListener("change", () => { applyFromUI(); refreshSemantics(); });
  el("sem-env")?.addEventListener("change", onEnvChange);
  for (const id of Object.keys(ARC_MAP)) el(id)?.addEventListener("input", applyFromUI);
  refreshSpeciesSpecificUI();
}

function refreshValueLabels() {
  // HTML 中个别值标签 id 与 cfg-id 不完全对应（如 cfg-step-len → v-step），用别名补齐
  const VAL_ALIAS = { "cfg-step-len": "v-step" };
  for (const [id, path] of Object.entries(FIELD_MAP)) {
    const input = el(id);
    if (!input || (input.type !== "range" && input.type !== "number")) continue;
    const out = el(VAL_ALIAS[id] || ("v-" + id.replace("cfg-", "")));
    if (out) { const v = parseFloat(input.value); out.textContent = Number.isInteger(v) ? v : v.toFixed(2); }
  }
}

/* ============ 环境切换 ============ */
function onEnvChange() {
  const env = el("sem-env")?.value;
  if (env) { labEnv.setEnvironment(env); record.habitat = env; }
  const envObj = { id: labEnv.id, props: labEnv.props, isSnow: labEnv.isSnow };
  if (entity) entity.setBehaviorState(behaviorState);
  refreshSemantics();
}

/* ============ 导航 Tab ============ */
function bindTabs() {
  const btns = document.querySelectorAll(".lab-nav-btn");
  btns.forEach((b) => {
    b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".lab-pane").forEach((p) => p.classList.remove("active"));
      b.classList.add("active");
      const pane = el(b.dataset.pane);
      if (pane) pane.classList.add("active");
    });
  });
}

/* ============ 状态按钮 ============ */
function bindStateButtons() {
  const btns = document.querySelectorAll(".state-btn");
  btns.forEach((b) => {
    b.addEventListener("click", () => {
      btns.forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      behaviorState = b.dataset.state;
      if (entity) entity.setBehaviorState(behaviorState);
      // pose 选择同步
      if (el("cfg-pose")) el("cfg-pose").value = (behaviorState === "CREEP") ? "crouch" : "stand";
      refreshBuildReadouts("state");
    });
  });
  // 姿态下拉同步
  el("cfg-pose")?.addEventListener("change", (e) => {
    const v = e.target.value;
    const target = v === "crouch" ? "CREEP" : "WALK";
    behaviorState = target;
    btns.forEach((x) => x.classList.toggle("active", x.dataset.state === target));
    if (entity) entity.setBehaviorState(behaviorState);
    refreshBuildReadouts("state");
  });
}

/* ============ 习性语义 ============ */
function refreshSemantics() {
  const sem = new BioSemantics({
    niche: el("sem-niche")?.value,
    diet: el("sem-diet")?.value,
    activityCycle: el("sem-activity")?.value,
    sociality: el("sem-social")?.value,
  });
  const env = el("sem-env")?.value || labEnv.id;
  const fit = fitHabitat(sem, env);
  el("archetype-label").textContent = fit.archetypeLabel || "—";
  const fitBar = el("fit-bar");
  if (fitBar) fitBar.style.width = Math.round(fit.affinity * 100) + "%";
  if (el("fit-num")) el("fit-num").textContent = fit.affinity.toFixed(2);
  if (el("fit-pill")) el("fit-pill").textContent =
    fit.affinity > 0.75 ? "高度适生" : fit.affinity > 0.5 ? "较适生" : fit.affinity > 0.35 ? "勉强生境" : "错配生境";
  // 行为先验条
  const bars = el("sem-bars");
  if (bars) {
    const items = [
      ["攻击性", fit.aggression], ["大胆度", fit.boldness],
      ["活跃度", fit.activity], ["社会性", fit.social],
      ["觅食欲", fit.foraging], ["适配度", fit.affinity],
    ];
    bars.innerHTML = items.map(([k, v]) =>
      `<div class="ib">${k}<b>${(v * 100).toFixed(0)}%</b></div>`).join("");
  }
  // 持久化语义到 record
  record.semantics = { ...record.semantics, ...sem.toJSON() };
  record.behavior = { state: fit.state, aggression: fit.aggression, boldness: fit.boldness, activity: fit.activity, social: fit.social, foraging: fit.foraging };
  renderHabitSummary(fit, sem.toJSON(), env);
  refreshBuildReadouts("state");
}

function renderHabitSummary(fit, sem, env) {
  const box = el("habit-summary");
  if (!box) return;
  const activity = ({ diurnal: "昼行", nocturnal: "夜行", crepuscular: "晨昏活动", cathemeral: "昼夜无定" })[sem.activityCycle] || "活动节律未定";
  const social = ({ solitary: "独行", pair: "成对", herd: "群居", flock: "集群" })[sem.sociality] || "社会性未定";
  const diet = ({ carnivore: "肉食", herbivore: "草食", omnivore: "杂食", piscivore: "鱼食", insectivore: "虫食" })[sem.diet] || "食性未定";
  const envName = ({ stream: "溪涧", pond: "寒塘", snow: "雪竹", mountain: "山岩" })[env] || env;
  box.innerHTML = `<b>${fit.archetypeLabel || "习性原型"}</b>：${activity}、${social}、${diet}。在${envName}环境中适配度为 ${(fit.affinity * 100).toFixed(0)}%，状态机倾向 ${fit.state}；攻击 ${pct(fit.aggression)}、大胆 ${pct(fit.boldness)}、觅食 ${pct(fit.foraging)}。`;
}

function pct(v) {
  return `${Math.round((v || 0) * 100)}%`;
}

/* ============ 图像分析 → 解剖推断 → 3D 建模 ============ */
function bindImage() {
  el("img-upload")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const thumb = el("view-thumb");
    if (thumb) thumb.src = url;
    try {
      showToast("正在分析图像…");
      markPipeline("image");
      record.image = await fileToDataURL(file);
      const mod = await import('./imageAnalysis.js');
      const r = await mod.analyzeAndEstimate(file);
      // 展示推断卡片
      const card = el("infer-card");
      if (card) card.hidden = false;
      const inferredType = labAnatomy(r.anatomy);
      const currentType = el("cfg-anatomy")?.value || record.anatomyType;
      el("infer-type").textContent = anatomyLockedByUser
        ? `${anatomyLabel(inferredType)} → 保留 ${anatomyLabel(currentType)}`
        : anatomyLabel(inferredType);
      el("infer-conf").textContent = "置信 " + Math.round((r.confidence || 0) * 100) + "%";
      const bars = el("infer-bars");
      if (bars) {
        const r2 = r.ratios || {};
        bars.innerHTML = Object.entries(r2)
          .map(([k, v]) => `<div class="ib">${k}<b>${(v * 100).toFixed(0)}%</b></div>`).join("");
      }
      const aBtn = el("apply-infer");
      if (aBtn) { aBtn.hidden = false; aBtn.onclick = () => { applyEstimate(r); card.hidden = true; }; }
      const sBtn = el("apply-suggest");
      if (sBtn) { sBtn.hidden = true; }
      applyEstimate(r, { silent: true });
      showToast(anatomyLockedByUser ? "图像分析完成，已按当前解剖型重建模型" : "图像分析完成，已按推断重建模型");
    } catch (err) {
      showToast("图像分析失败：" + err.message);
    }
  });

  el("snap-btn")?.addEventListener("click", () => {
    const data = snapshotView();
    const thumb = el("view-thumb");
    if (thumb && data) thumb.src = data;
    if (data) record.image = data;
    showToast("已摄取模型影相");
  });

  el("tiger-preset-btn")?.addEventListener("click", applyTigerPreset);
  el("avian-preset-btn")?.addEventListener("click", applyAvianPreset);
}

/** 将推断结果应用到 record 并重建模型 */
function applyEstimate(r, opts = {}) {
  if (!r) return;
  // 1. 解剖类型
  if (r.anatomy) {
    const sel = el("cfg-anatomy");
    const inferredVal = labAnatomy(r.anatomy);
    const currentVal = sel?.value || record.anatomyType || inferredVal;
    const val = anatomyLockedByUser ? currentVal : inferredVal;
    if (sel && [...sel.options].some((o) => o.value === val)) sel.value = val;
    record.anatomyType = val;
  }
  // 2. 边界盒尺寸（先写 record，再由 refreshFields 同步到滑块；滑块 min/max 会截断到合法范围）
  if (r.dimensions) {
    if (r.dimensions.width != null) record.dimensions.width = r.dimensions.width;
    if (r.dimensions.height != null) record.dimensions.height = r.dimensions.height;
    if (r.dimensions.length != null) record.dimensions.length = r.dimensions.length;
  }
  // 3. 肩高 ≈ 身高 × 0.75
  if (r.dimensions?.height) record.anatomicalRef.withersHeight = +(r.dimensions.height * 0.75).toFixed(2);
  // 4. 比例 → rigTuning / shape
  if (r.proportions) {
    if (r.proportions.neckLen != null) record.rigTuning.neckLen = r.proportions.neckLen;
    if (r.proportions.legLen != null) record.shape.legScale = r.proportions.legLen;
    if (r.proportions.tailLen != null) {
      record.shape.tailScale = r.proportions.tailLen;
      if (record.dimensions?.height) record.anatomicalRef.tailLength = +(record.dimensions.height * r.proportions.tailLen).toFixed(2);
    }
  }
  applyAnatomyEstimateDefaults(record);
  // 5. 主色（若推断色过暗，提亮到中等亮度以免在深色背景下不可见）
  if (r.bestHex) {
    const c = hexToRgb(r.bestHex);
    const lum = (c.r * 0.299 + c.g * 0.587 + c.b * 0.114) / 255;
    if (lum < 0.55) {
      // 提亮：向白色混合到亮度 ~0.62
      const t = Math.min(1, (0.62 - lum) / (1 - lum + 0.01));
      c.r = Math.round(c.r + (255 - c.r) * t);
      c.g = Math.round(c.g + (255 - c.g) * t);
      c.b = Math.round(c.b + (255 - c.b) * t);
      record.rendering.baseColor = rgbToHexStr(c.r, c.g, c.b);
    } else {
      record.rendering.baseColor = r.bestHex;
    }
  }
  if (r.palette?.length >= 2) record.rendering.stripeColor = r.palette[1];
  applyBiomechanics(record);
  // 同步表单显示（把 record 值写到 UI 滑块），然后重建模型
  refreshFields();
  rebuild();
  refreshSemantics();
  refreshBuildReadouts("state");
  if (!opts.silent) showToast("已应用推断参数并重建模型");
}

function applyAnatomyEstimateDefaults(rec) {
  rec.dimensions ??= {};
  rec.anatomicalRef ??= {};
  rec.rigTuning ??= {};
  rec.shape ??= {};
  rec.rendering ??= {};
  if (rec.anatomyType === "AVIAN_CURSORIAL") {
    applyCursorialAvianDefaults(rec);
    return;
  }
  const anatomy = modelAnatomy(rec.anatomyType);
  if (anatomy === "AVES") {
    rec.anatomicalRef.wingspan = +(Math.max((rec.dimensions.length || 0.7) * 1.55, (rec.dimensions.width || 0.2) * 3.2, 0.45)).toFixed(2);
    rec.anatomicalRef.tailLength = +(Math.min(Math.max((rec.dimensions.length || 0.7) * 0.2, 0.08), 0.35)).toFixed(2);
    rec.rigTuning.neckLen = Math.max(rec.rigTuning.neckLen ?? 1, 1.1);
    rec.shape.legScale = THREE.MathUtils.clamp(rec.shape.legScale ?? 0.55, 0.45, 0.85);
    rec.shape.tailScale = THREE.MathUtils.clamp(rec.shape.tailScale ?? 0.25, 0.15, 0.45);
    rec.rendering.furLayers = 0;
    rec.rendering.furLength = 0;
    rec.rendering.pattern = "solid";
  }
}

function applyCursorialAvianDefaults(rec, { overwriteDimensions = false } = {}) {
  rec.dimensions ??= {};
  rec.anatomicalRef ??= {};
  rec.rigTuning ??= {};
  rec.shape ??= {};
  rec.rendering ??= {};
  rec.gait ??= {};
  rec.taxonomyClass = "bird";
  rec.anatomyType = "AVIAN_CURSORIAL";
  if (overwriteDimensions) {
    rec.cnName = rec.cnName && rec.cnName !== AVIAN_PRESET.cnName ? rec.cnName : "鸵鸟健步样本";
    rec.scientificName = "Struthio camelus";
    rec.taxonomyId = "STRUTHIONIFORMES-STRUTHIONIDAE-STRUTHIO";
    rec.dimensions.width = 0.55;
    rec.dimensions.height = 2.15;
    rec.dimensions.length = 1.65;
  }
  const h = rec.dimensions.height || 2.0;
  const len = rec.dimensions.length || 1.5;
  rec.anatomicalRef.withersHeight = +(h * 0.92).toFixed(2);
  rec.anatomicalRef.wingspan = +(Math.max(Math.min(len * 0.95, 1.75), 0.8)).toFixed(2);
  rec.anatomicalRef.tailLength = +(Math.max(Math.min(len * 0.18, 0.36), 0.16)).toFixed(2);
  rec.anatomicalRef.note = "走禽基线：保留禽类双足骨架，长腿健步行走，短翼用于转向与奔跑平衡。";
  rec.rigTuning.neckLen = Math.max(rec.rigTuning.neckLen ?? 1.8, 1.85);
  rec.rigTuning.backAngle = THREE.MathUtils.clamp(rec.rigTuning.backAngle ?? 0.04, -0.08, 0.14);
  rec.rigTuning.hockLift = 0.06;
  rec.shape.legScale = THREE.MathUtils.clamp(rec.shape.legScale ?? 1.15, 0.95, 1.3);
  rec.shape.headScale = THREE.MathUtils.clamp(rec.shape.headScale ?? 0.75, 0.6, 1);
  rec.shape.chestScale = THREE.MathUtils.clamp(rec.shape.chestScale ?? 0.72, 0.55, 1.2);
  rec.shape.rumpScale = THREE.MathUtils.clamp(rec.shape.rumpScale ?? 1.22, 0.9, 1.6);
  rec.shape.bellyScale = THREE.MathUtils.clamp(rec.shape.bellyScale ?? 0.92, 0.75, 1.25);
  rec.shape.tailScale = THREE.MathUtils.clamp(rec.shape.tailScale ?? 0.38, 0.1, 0.8);
  rec.rendering.furLayers = 0;
  rec.rendering.furLength = 0;
  rec.rendering.pattern = "solid";
  rec.gait.freq = THREE.MathUtils.clamp(rec.gait.freq ?? 1.35, 0.8, 2.4);
  rec.gait.stepLen = THREE.MathUtils.clamp(rec.gait.stepLen ?? 0.26, 0.08, 0.42);
  rec.gait.lean = THREE.MathUtils.clamp(rec.gait.lean ?? 0.14, 0.04, 0.35);
  rec.gait.tail = THREE.MathUtils.clamp(rec.gait.tail ?? 0.06, 0, 0.3);
}

function applyAnatomyProfileDefaults(rec) {
  rec.dimensions ??= {};
  rec.anatomicalRef ??= {};
  rec.rigTuning ??= {};
  rec.shape ??= {};
  rec.rendering ??= {};
  const anatomy = modelAnatomy(rec.anatomyType);
  if (rec.anatomyType === "AVIAN_CURSORIAL") {
    applyCursorialAvianDefaults(rec, { overwriteDimensions: true });
    return;
  }
  if (anatomy === "AVES") {
    rec.taxonomyClass = "bird";
    applyAnatomyEstimateDefaults(rec);
    rec.gait ??= {};
    rec.gait.tail = THREE.MathUtils.clamp(rec.gait.tail ?? 0.08, 0, 0.3);
    rec.gait.stepLen = THREE.MathUtils.clamp(rec.gait.stepLen ?? 0.1, 0.03, 0.3);
    rec.gait.lean = THREE.MathUtils.clamp(rec.gait.lean ?? 0.08, 0, 0.35);
    return;
  }
  if (rec.anatomyType === "FELINE") {
    rec.taxonomyClass = "mammal";
    rec.rendering.furLayers = Math.max(Math.round(rec.rendering.furLayers ?? 10), 8);
    if (!rec.rendering.pattern || rec.rendering.pattern === "solid") rec.rendering.pattern = "stripes";
    rec.rigTuning.hockLift = Math.max(rec.rigTuning.hockLift ?? 0.25, 0.18);
    rec.gait ??= {};
    rec.gait.creepLow = THREE.MathUtils.clamp(rec.gait.creepLow ?? 0.2, 0.08, 0.32);
    rec.gait.directRegister = THREE.MathUtils.clamp(rec.gait.directRegister ?? 0.85, 0, 1);
    rec.gait.creepCadence = THREE.MathUtils.clamp(rec.gait.creepCadence ?? 0.58, 0.35, 1.1);
  }
}

function applyTigerPreset() {
  applyFromUI();
  anatomyLockedByUser = true;
  const keepArchiveThumb = record.archive?.thumb || record.image || "";
  record = mergeDefaults({
    ...record,
    ...structuredClone(TIGER_STALK_PRESET),
    archive: { ...TIGER_STALK_PRESET.archive, thumb: keepArchiveThumb },
  });
  labEnv.setEnvironment(record.habitat || "snow");
  applyBiomechanics(record);
  record.gait = { ...record.gait, ...TIGER_STALK_PRESET.gait };
  refreshFields();
  renderRelations();
  rebuild();
  refreshSemantics();
  setBehaviorStateUI("CREEP");
  showToast("已载入老虎潜行调研预设");
}

function applyAvianPreset() {
  applyFromUI();
  anatomyLockedByUser = true;
  const keepArchiveThumb = record.archive?.thumb || record.image || "";
  record = mergeDefaults({
    ...record,
    ...structuredClone(AVIAN_PRESET),
    archive: { ...AVIAN_PRESET.archive, thumb: keepArchiveThumb },
  });
  labEnv.setEnvironment(record.habitat || "pond");
  applyBiomechanics(record);
  record.gait = { ...record.gait, ...AVIAN_PRESET.gait };
  behaviorState = "IDLE";
  refreshFields();
  renderRelations();
  rebuild();
  refreshSemantics();
  setBehaviorStateUI("IDLE");
  showToast("已切换到禽类专用建模管线");
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("无法读取图片"));
    reader.readAsDataURL(file);
  });
}

/* ============ 物种关系 ============ */
function renderRelations() {
  const body = el("rel-body");
  if (!body) return;
  body.innerHTML = "";
  (record.relations || []).forEach((rel, i) => {
    const tr = document.createElement("tr");
    const target = rel.target || rel.b || "";
    const strength = rel.strength ?? 0.5;
    tr.innerHTML = `<td>${relTypeLabel(rel.type)}</td><td><input value="${target}" data-i="${i}" data-k="target" /></td>
      <td><input type="range" min="0" max="1" step="0.1" value="${strength}" data-i="${i}" data-k="strength" /></td>
      <td><button data-del="${i}">×</button></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll("input[data-i]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const i = +inp.dataset.i, k = inp.dataset.k;
      record.relations[i][k] = (inp.type === "range") ? parseFloat(inp.value) : inp.value;
    });
  });
  body.querySelectorAll("button[data-del]").forEach((b) => {
    b.addEventListener("click", () => { record.relations.splice(+b.dataset.del, 1); renderRelations(); });
  });
  refreshBuildReadouts("state");
}
function relTypeLabel(t) {
  return ({
    predator: "天敌",
    prey: "猎物",
    symbiotic: "共生",
    rival: "竞争",
    "predator-prey": "捕食链",
    resource: "资源",
    physical: "物理作用",
  })[t] || t;
}
function bindRelations() {
  el("rel-add-btn")?.addEventListener("click", () => {
    const type = el("rel-type")?.value;
    const target = el("rel-target")?.value.trim();
    const strength = parseFloat(el("rel-strength")?.value || "0.5");
    if (!target) { showToast("请填写对向物种名"); return; }
    record.relations.push({ type, target, strength });
    el("rel-target").value = "";
    renderRelations();
  });
}

/* ============ 保存 ============ */
function bindSave() {
  el("save-btn")?.addEventListener("click", async () => {
    applyFromUI();
    // 重新计算语义行为先验并写入
    const sem = new BioSemantics(record.semantics);
    const fit = fitHabitat(sem, record.habitat || labEnv.id);
    record.behavior = { state: fit.state, aggression: fit.aggression, boldness: fit.boldness, activity: fit.activity, social: fit.social, foraging: fit.foraging };
    record.archive ??= {};
    record.archive.thumb = el("view-thumb")?.src || record.archive.thumb || "";
    try {
      await saveSpecies(record);
      const hint = el("save-hint");
      if (hint) hint.textContent = "已封存 ✓ 可前往「猛虎 / 寒梅」场景漫游";
      showToast("物种已封存");
    } catch (e) {
      showToast("保存失败：" + e.message);
    }
  });
}

/* ============ 初始化 Three ============ */
function initThree() {
  const canvas = el("viewport");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a3f4a);
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(3, 1.8, 4.5);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.screenSpacePanning = true;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.addEventListener("start", () => { userAdjustedView = true; });

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(8, 48),
    new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x20242c, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(3, 6, 4);
  scene.add(dir);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  };
  window.addEventListener("resize", resize);
  requestAnimationFrame(resize);
  clock = new THREE.Clock();
}

/* ============ Swatches ============ */
function loadSwatches() {
  const wrap = el("swatches");
  if (!wrap) return;
  wrap.innerHTML = "";
  querySpecies().forEach((sp) => {
    const b = document.createElement("button");
    b.className = "swatch";
    b.title = sp.cnName;
    b.style.background = typeof sp.rendering?.baseColor === "string" ? sp.rendering.baseColor : "#888";
    b.onclick = () => {
      record = mergeDefaults(sp);
      anatomyLockedByUser = true;
      if (record.habitat) labEnv.setEnvironment(record.habitat);
      refreshFields();
      renderRelations();
      rebuild();
      refreshSemantics();
      refreshBuildReadouts("state");
    };
    wrap.appendChild(b);
  });
}

function showToast(msg) {
  const t = el("toast");
  if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ============ 动画循环 ============ */
let _gaitCyc = 0;
function animate() {
  requestAnimationFrame(animate);
  if (!renderer || !entity) return;
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const moving = (behaviorState === "WALK" || behaviorState === "TROT" || behaviorState === "CREEP" || behaviorState === "POUNCE") ? 1 : 0;
  const creepCadence = record.gait?.creepCadence ?? 0.58;
  const cadence = behaviorState === "CREEP" ? creepCadence : behaviorState === "TROT" ? 1.45 : behaviorState === "POUNCE" ? 1.8 : 1;
  // 步态相位按速度与步频积分；潜行是低频四拍，避免“脚下快、身体慢”的打滑感。
  _gaitCyc = (_gaitCyc + (moving ? (record.gait?.freq ?? 1.3) / 1.25 * cadence : 0) * dt) % 1;
  const envObj = { id: labEnv.id, props: labEnv.props, isSnow: labEnv.isSnow, slick: labEnv.slick };
  const tickCtx = {
    dt, time: t, gait: _gaitCyc, moving,
    crouch: behaviorState === "CREEP" || record.pose === "crouch",
    cadence: 1,
    gaitAmp: behaviorState === "CREEP" ? (record.gait?.swing ?? 0.82) : (record.gait?.swing ?? 1),
    locomotion: behaviorState === "TROT" || behaviorState === "POUNCE" ? "gallop" : record.gait?.locomotion,
    env: envObj,
    breathe: record.gait?.breathe ?? 0.03,
    lean: record.gait?.lean ?? 0.05,
    tail: record.gait?.tail ?? 0.18,
    stepLen: record.gait?.stepLen ?? 0.22,
    creepLow: record.gait?.creepLow ?? 0.2,
    directRegister: record.gait?.directRegister ?? 0.85,
    leap: behaviorState === "POUNCE"
      ? Math.max(0, Math.sin(_gaitCyc * Math.PI * 2))
      : modelAnatomy(record.anatomyType) === "SALTATORIAL" ? Math.max(0, Math.sin(_gaitCyc * Math.PI * 2)) : undefined,
  };
  const isAvianPreview = modelAnatomy(record.anatomyType) === "AVES";
  const driverState = (!isAvianPreview && (behaviorState === "TROT" || behaviorState === "POUNCE")) ? "WALK" : behaviorState;
  if (entity.currentState !== driverState) entity.setBehaviorState(driverState);
  entity.tick(tickCtx);
  skeletonHelper?.traverse((o) => {
    if (o.isSkeletonHelper) o.update?.();
  });
  controls?.update();
  renderer.render(scene, camera);
}

/* ============ 启动 ============ */
async function main() {
  try {
    initThree();
    bindTabs();
    bindStateButtons();
    bindRelations();
    bindImage();
    bindSave();

    record = await loadSpecies();
    record = mergeDefaults(record);
    if (record.habitat) labEnv.setEnvironment(record.habitat);
    bindFields();
    refreshFields();
    renderRelations();
    loadSwatches();
    rebuild();
    refreshSemantics();
    if (record.pose === "crouch") {
      behaviorState = "CREEP";
      document.querySelectorAll(".state-btn").forEach((x) => x.classList.toggle("active", x.dataset.state === "CREEP"));
    }
    if (el("kind-hint")) el("kind-hint").textContent = "模块四 · 状态机动画";
    refreshBuildReadouts("state");
    animate();
  } catch (e) {
    console.error("[lab] main 失败:", e);
    showToast("初始化失败：" + e.message);
  }
}

// 仅保留 DEFAULT_SPECIES 中声明的键，避免脏数据；并补全缺失键
function mergeDefaults(rec) {
  const base = structuredClone(DEFAULT_SPECIES);
  base.anatomicalRef = { ...base.anatomicalRef, tailLength: base.anatomicalRef.tailLength ?? 0.6 };
  base.anatomicalRef.wingspan ??= 1.2;
  base.shape = { rumpScale: 1, bellyScale: 1, chestScale: 1, headScale: 1, legScale: 1, tailScale: 1, ...(base.shape || {}) };
  base.rigTuning = { neckLen: 1, legFold: 1, backAngle: 0, hockLift: 0.25, ...(base.rigTuning || {}) };
  base.gait = {
    freq: 1,
    swing: 1,
    spine: 1,
    tail: 0.18,
    stepLen: 0.22,
    lean: 0.05,
    breathe: 0.03,
    creepLow: 0.2,
    directRegister: 0.85,
    creepCadence: 0.58,
    ...(base.gait || {}),
  };
  const out = {
    ...base,
    ...(rec || {}),
    dimensions: { ...base.dimensions, ...(rec?.dimensions || {}) },
    anatomicalRef: { ...base.anatomicalRef, ...(rec?.anatomicalRef || {}) },
    rendering: { ...base.rendering, ...(rec?.rendering || {}) },
    shape: { ...base.shape, ...(rec?.shape || {}) },
    rigTuning: { ...base.rigTuning, ...(rec?.rigTuning || {}) },
    gait: { ...base.gait, ...(rec?.gait || {}) },
    semantics: { ...base.semantics, ...(rec?.semantics || {}) },
    archive: { ...base.archive, ...(rec?.archive || {}) },
    relations: Array.isArray(rec?.relations) ? rec.relations : [],
  };
  out.anatomicalRef.tailLength ??= 0.6;
  out.anatomicalRef.wingspan ??= Math.max((out.dimensions.length || 0.7) * 1.6, 0.4);
  out.shape.rumpScale ??= 1;
  out.shape.chestScale ??= 1;
  out.gait.stepLen ??= 0.22;
  out.gait.lean ??= 0.05;
  out.gait.breathe ??= 0.03;
  out.gait.creepLow ??= 0.2;
  out.gait.directRegister ??= 0.85;
  out.gait.creepCadence ??= 0.58;
  if (!Number.isFinite(out.gait.tail) || out.gait.tail > 0.5) out.gait.tail = 0.18;
  return out;
}

main();
