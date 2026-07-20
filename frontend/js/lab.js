// 物种实验室：数据仓库 → 程序化网格 → 骨骼装配 → 状态机驱动 的全管线可视化调参台
// 形体/骨骼/渲染参数 → 防抖 120ms 整体重建预览实体；驱动器参数只改每帧 tick 的 ctx，不重建
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BioEntityMesh } from "./bio/BioEntityMesh.js";
import { buildAvianBody } from "./bio/AvianBodyBuilder.js";
import { loadSpecies, saveSpecies } from "./species.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let record = await loadSpecies();
let behaviorState = "WALK";
let entity = null;
let gaitCyc = 0;

/* ================= 3D 视窗 ================= */

const canvas = $("#viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8e3d5); // 浅灰宣纸

const camera = new THREE.PerspectiveCamera(42, 2, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.05;
controls.maxDistance = 15;

// 半球光 + 方向光（柔和宣纸照明）
scene.add(new THREE.HemisphereLight(0xfffaf0, 0x8f8878, 1.05));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(2.2, 3.6, 1.8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -2.5;
sun.shadow.camera.right = 2.5;
sun.shadow.camera.top = 2.5;
sun.shadow.camera.bottom = -2.5;
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 12;
scene.add(sun);

// 地面：0.1m 格距网格 + 柔和承影面
const grid = new THREE.GridHelper(4, 40, 0x8a7a5c, 0xcabfa6);
grid.position.y = 0.001;
scene.add(grid);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.ShadowMaterial({ opacity: 0.16 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// 1m 参考比例尺（10 格 × 0.1m，长格每 0.5m，附绢签）
(function buildScaleBar() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x57503f });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.006, 0.016), mat);
  bar.position.y = 0.004;
  g.add(bar);
  for (let i = 0; i <= 10; i++) {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.006, i % 5 === 0 ? 0.05 : 0.028), mat);
    tick.position.set(-0.5 + i * 0.1, 0.004, 0);
    g.add(tick);
  }
  const cv = document.createElement("canvas");
  cv.width = 128; cv.height = 48;
  const c2 = cv.getContext("2d");
  c2.fillStyle = "#57503f";
  c2.font = "30px serif";
  c2.textAlign = "center";
  c2.textBaseline = "middle";
  c2.fillText("1 m", 64, 24);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv) }));
  sprite.scale.set(0.24, 0.09, 1);
  sprite.position.set(0, 0.055, 0);
  g.add(sprite);
  g.position.set(0, 0, -0.85);
  scene.add(g);
})();

/* ================= 预览实体构建 ================= */

const CREAM = 0xf5f0e6; // 耳内/绒尾
const PINK = 0xc98a8a;  // 鼻
const DARK = 0x1a1410;  // 眼

function disposeObject(root) {
  const geos = new Set(), mats = new Set();
  root.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
  });
  geos.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
}

/** 外观件挂骨：SALTATORIAL 长耳（参考 rabbit.js _buildDetails）+ 全类型眼睛 */
function buildDetails(e) {
  const B = e.boneMap;
  const d = record.dimensions;
  const s = Math.max(d.width, 0.05) / 0.2; // 以雪兔体宽为基准的缩放
  const rough = record.rendering.roughness ?? 0.75;
  const furMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(record.rendering.baseColor ?? "#d3d3d3"),
    roughness: Math.min(rough + 0.05, 1),
  });
  const creamMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.8 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.25 });

  // 长耳：外基色内白的扁椭圆，耳根挂 Ear_L/Ear_R 骨（仅 SALTATORIAL 装配）
  const earLen = record.anatomicalRef.earLength ?? 0;
  if (record.anatomyType === "SALTATORIAL" && earLen > 0.004) {
    for (const [key, side] of [["Ear_L", -1], ["Ear_R", 1]]) {
      const bone = B.get(key);
      if (!bone) continue;
      const outer = new THREE.Mesh(new THREE.SphereGeometry(earLen * 0.24, 10, 8), furMat);
      outer.scale.set(0.55, earLen / (earLen * 0.48), 0.28); // 高约 earLen
      outer.position.set(0, earLen * 0.45, 0);
      outer.rotation.z = -side * 0.08;
      bone.add(outer);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(earLen * 0.15, 8, 6), creamMat);
      inner.scale.set(0.5, earLen / (earLen * 0.3) * 0.8, 0.2);
      inner.position.set(0, earLen * 0.42, earLen * 0.07);
      bone.add(inner);
    }
    // 粉鼻 + 绒尾小毛球
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.014 * s, 0.01 * s, 0.012 * s),
      new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.6 }));
    nose.position.set(0, -0.005 * s, 0.048 * s);
    B.get("Head")?.add(nose);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.032 * s, 10, 8), creamMat);
    pom.position.set(0, 0.005, -0.01);
    B.get("Tail3")?.add(pom);
  }

  // 眼：头部两个小黑球，位置按体宽比例缩放
  const head = B.get("Head");
  if (head) {
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013 * s, 10, 8), eyeMat);
      eye.position.set(side * 0.03 * s, 0.008 * s, 0.02 * s);
      head.add(eye);
    }
  }
}

/** 禽类预览实体：AvianBodyBuilder 构建，行走=啄食顿点、ROAR=展翅亮羽（接口对齐 BioEntityMesh） */
function buildAvianEntity() {
  const built = buildAvianBody({
    height: record.dimensions.height ?? 0.42,
    bodyColor: record.rendering.baseColor ?? "#a8261f",
    accentColor: 0xd9a520,
  });
  const g = new THREE.Group();
  g.add(built.group);
  let state = "WALK";
  g.setBehaviorState = (s) => { state = s; };
  g.tick = ({ time, gait, moving = 0, gaitAmp = 1 }) => {
    if (state === "ROAR") {
      // 展翅亮羽：双翼高频扑扇（翼根为轴）
      const flap = Math.sin(time * 10) * 0.35;
      for (const w of built.wings) w.pivot.rotation.z = w.side * (1.4 + flap) * gaitAmp;
    } else {
      for (const w of built.wings) w.pivot.rotation.z *= 0.85;
      built.group.position.y = state === "WALK" ? Math.abs(Math.sin(gait * Math.PI * 2)) * 0.02 * moving : 0;
      built.head.rotation.x = state === "WALK"
        ? Math.max(0, Math.sin(gait * Math.PI * 4)) * 0.7 * moving
        : Math.sin(time * 2.2) * 0.08;
    }
  };
  return g;
}

function buildEntity(fitCamera = false) {
  if (entity) {
    scene.remove(entity);
    disposeObject(entity);
    entity = null;
  }
  if (record.anatomyType === "AVES") {
    // 禽类不走四足管线：程序化鸟体（基色即体色）
    entity = buildAvianEntity();
    entity.setBehaviorState(behaviorState);
    scene.add(entity);
    if (fitCamera) frameCamera();
    return;
  }
  const familyNode = { anatomyType: record.anatomyType };
  entity = new BioEntityMesh(familyNode, structuredClone(record));
  buildDetails(entity);
  entity.setBehaviorState(behaviorState);
  scene.add(entity);
  if (fitCamera) frameCamera();
}

function frameCamera() {
  const d = record.dimensions;
  const r = Math.max(d.length, d.height, 0.3);
  camera.position.set(r * 0.85, Math.max(d.height * 0.8, 0.12) + r * 0.3, r * 1.3);
  controls.target.set(0, d.height * 0.5, 0);
  controls.update();
}

// 形体/骨骼/渲染参数变化 → 防抖 120ms 整体重建
let rebuildTimer = 0;
let rebuildFit = false;
function scheduleRebuild(fit = false) {
  rebuildFit = rebuildFit || fit;
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    buildEntity(rebuildFit);
    rebuildFit = false;
  }, 120);
}

/* ================= 字段绑定 ================= */

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}
const fmt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
};
// 这些路径变化需要重建实体；gait.* 与档案文本只改数据/每帧 ctx
const NEEDS_REBUILD = (p) =>
  p.startsWith("dimensions.") || p.startsWith("anatomicalRef.") ||
  p.startsWith("shape.") || p.startsWith("rigTuning.") || p.startsWith("rendering.");

function refreshFields() {
  $$("[data-path]").forEach((el) => {
    const v = getPath(record, el.dataset.path);
    if (v === undefined || v === null) return;
    if (el.type === "checkbox") el.checked = !!v;
    else el.value = v;
    const span = el.closest(".field")?.querySelector(".value");
    if (span) {
      if (el.type === "range") span.textContent = fmt(v);
      else if (el.type === "checkbox") span.textContent = v ? "启" : "闭";
      else if (el.type === "color") span.textContent = v;
    }
  });
  // 耳长仅 SALTATORIAL 有效
  const salt = record.anatomyType === "SALTATORIAL";
  const earField = $("#ear-field");
  if (earField) earField.classList.toggle("disabled", !salt);
  const ear = $("#m-ear");
  if (ear) ear.disabled = !salt;
  // ROAR：禽类为展翅亮羽；SALTATORIAL 无意义禁用
  const roarBtn = $("#state-roar");
  if (roarBtn) roarBtn.disabled = salt;
  if (salt && behaviorState === "ROAR") setState("IDLE");
  // 禽类不走四足管线：形体分区/装配/皮毛旋钮禁用
  const aves = record.anatomyType === "AVES";
  $$("[data-path]").forEach((el) => {
    const p = el.dataset.path;
    const na = aves && (p.startsWith("shape.") || p.startsWith("rigTuning.") ||
      p === "rendering.furLayers" || p === "rendering.furLength");
    el.disabled = na;
    el.closest(".field")?.classList.toggle("disabled", na);
  });
}

$$("[data-path]").forEach((el) => {
  el.addEventListener("input", () => {
    let v;
    if (el.type === "checkbox") v = el.checked;
    else if (el.type === "range" || el.type === "number") v = Number(el.value);
    else v = el.value;
    setPath(record, el.dataset.path, v);
    refreshFields();
    const p = el.dataset.path;
    if (p === "anatomyType") scheduleRebuild(true); // 换解剖类型：重建并重取机位
    else if (NEEDS_REBUILD(p)) scheduleRebuild();
  });
});

/* ================= 状态机按钮 ================= */

function setState(s) {
  behaviorState = s;
  $$(".state-btn").forEach((b) => b.classList.toggle("active", b.dataset.state === s));
  entity?.setBehaviorState(s);
}
$$(".state-btn").forEach((b) => b.addEventListener("click", () => setState(b.dataset.state)));

/* ================= 上传图片建模 ================= */

const readFile = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(file);
});
const loadImage = (src) => new Promise((res, rej) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = rej;
  im.src = src;
});

// 等比降采样到 maxDim 内（白底，供 JPEG 与像素分析共用）
function drawToCanvas(img, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(img.width * scale));
  cv.height = Math.max(1, Math.round(img.height * scale));
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return cv;
}

// 降采样像素分析：主色提取（3~5 代表色 + 最深/最饱和色）与主体纵横比
function analyzeImage(img) {
  const cv = drawToCanvas(img, 48);
  const ctx = cv.getContext("2d");
  const { data, width: W, height: H } = ctx.getImageData(0, 0, cv.width, cv.height);
  // 背景色 = 四角均值；前景 = 与背景色差超阈值的像素
  const corner = (x, y) => {
    const i = (y * W + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const cs = [corner(0, 0), corner(W - 1, 0), corner(0, H - 1), corner(W - 1, H - 1)];
  const bg = [0, 1, 2].map((k) => cs.reduce((a, c) => a + c[k], 0) / 4);
  const TH2 = 55 * 55;
  const isFg = (i) => {
    const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2];
    return dr * dr + dg * dg + db * db > TH2;
  };

  let minX = W, minY = H, maxX = -1, maxY = -1, fgCount = 0;
  const buckets = new Map(); // 5bit/通道色桶计数
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (!isFg(i)) continue;
      fgCount++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const key = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
      let b = buckets.get(key);
      if (!b) { b = { n: 0, r: 0, g: 0, b: 0 }; buckets.set(key, b); }
      b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
    }
  }
  const enough = fgCount > W * H * 0.03 && maxX >= minX && maxY >= minY;

  const toHex = (r, g, b) =>
    "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  // 代表色：按像素数取前 5 桶的均值色
  const palette = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 5)
    .map((b) => toHex(b.r / b.n, b.g / b.n, b.b / b.n));
  // 最深/最饱和的一色
  let bestHex = null, bestScore = -1;
  for (const b of buckets.values()) {
    const r = b.r / b.n, g = b.g / b.n, bl = b.b / b.n;
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
    const sat = (mx - mn) / 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * bl) / 255;
    const score = sat * 1.2 + (1 - lum) * 0.8;
    if (score > bestScore) { bestScore = score; bestHex = toHex(r, g, bl); }
  }
  return { palette, bestHex, ratio: enough ? (maxX - minX + 1) / (maxY - minY + 1) : null };
}

function renderSwatches(hexes) {
  const box = $("#swatches");
  box.innerHTML = "";
  for (const hex of hexes) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.title = `${hex} · 点取为基色`;
    b.style.background = hex;
    b.addEventListener("click", () => {
      record.rendering.baseColor = hex;
      refreshFields();
      scheduleRebuild();
    });
    box.appendChild(b);
  }
}

function updateThumbs() {
  for (const sel of ["#view-thumb", "#archive-thumb"]) {
    const im = $(sel);
    if (record.image) { im.src = record.image; im.hidden = false; }
    else im.hidden = sel === "#view-thumb";
  }
}

$("#img-upload").addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  try {
    const url = await readFile(file);
    const img = await loadImage(url);
    // (d) 128px JPEG 存入物种记录
    record.image = drawToCanvas(img, 128).toDataURL("image/jpeg", 0.82);
    updateThumbs();
    // (b) 主色提取：色板展示 + 最深/最饱和色设为基色
    const { palette, bestHex, ratio } = analyzeImage(img);
    renderSwatches(palette);
    if (bestHex) {
      record.rendering.baseColor = bestHex;
      refreshFields();
      scheduleRebuild();
    }
    // (c) 主体纵横比 → 建议总长/总高（不强制，按钮应用）
    if (ratio) {
      const d = record.dimensions;
      let length = d.height * ratio, height = d.height;
      if (length < 0.2 || length > 3.5) {
        length = Math.min(3.5, Math.max(0.2, length));
        height = Math.min(1.6, Math.max(0.1, length / ratio));
      }
      const btn = $("#apply-suggest");
      btn.hidden = false;
      btn.textContent = `应用建议尺寸（长 ${length.toFixed(2)} m × 高 ${height.toFixed(2)} m）`;
      btn.onclick = () => {
        record.dimensions.length = Number(length.toFixed(2));
        record.dimensions.height = Number(height.toFixed(2));
        refreshFields();
        scheduleRebuild(true);
        btn.hidden = true;
      };
    }
    toast("图片已解析 · 主色与比例已提取");
  } catch (err) {
    console.error(err);
    toast("图片解析失败");
  }
  ev.target.value = "";
});

// 摄型为照：当前视窗截为缩略图
$("#snap-btn").addEventListener("click", () => {
  renderer.render(scene, camera);
  record.image = renderer.domElement.toDataURL("image/jpeg", 0.85);
  updateThumbs();
  toast("已摄取模型影相");
});

/* ================= 物种关系表 ================= */

const TARGETS = [["tiger", "猛虎"], ["rabbit", "雪兔"], ["pheasant", "锦鸡"], ["bamboo", "竹"], ["stream", "溪涧"]];
const REL_TYPES = [["predator-prey", "捕食"], ["physical", "物理"], ["resource", "资源"],
  ["mutualism", "互利"], ["competition", "竞争"], ["kinship", "亲缘"]];
const DRIVES = ["fear", "hunger", "thirst", "libido", "none"];
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function renderRelations() {
  const body = $("#rel-body");
  body.innerHTML = "";
  record.relations.forEach((rel, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><select data-i="${i}" data-k="target">
        ${TARGETS.map(([v, l]) => `<option value="${v}" ${v === rel.target ? "selected" : ""}>${l} ${v}</option>`).join("")}
      </select></td>
      <td><select data-i="${i}" data-k="type">
        ${REL_TYPES.map(([v, l]) => `<option value="${v}" ${v === rel.type ? "selected" : ""}>${l} ${v}</option>`).join("")}
      </select></td>
      <td><select data-i="${i}" data-k="drive">
        ${DRIVES.map((d) => `<option ${d === rel.drive ? "selected" : ""}>${d}</option>`).join("")}
      </select></td>
      <td><input type="number" min="0" max="1" step="0.05" value="${rel.strength}" data-i="${i}" data-k="strength" /></td>
      <td><input type="text" value="${esc(rel.note)}" data-i="${i}" data-k="note" placeholder="说明" /></td>
      <td><button type="button" class="rel-del" data-i="${i}">删</button></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll("select, input").forEach((el) => {
    el.addEventListener("input", () => {
      const rel = record.relations[Number(el.dataset.i)];
      rel[el.dataset.k] = el.type === "number" ? Number(el.value) : el.value;
    });
  });
  body.querySelectorAll(".rel-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      record.relations.splice(Number(btn.dataset.i), 1);
      renderRelations();
    });
  });
}
$("#rel-add").addEventListener("click", () => {
  record.relations.push({ target: "tiger", type: "predator-prey", drive: "fear", strength: 0.5, note: "" });
  renderRelations();
});

/* ================= 保存 / Toast ================= */

let toastTimer = 0;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

$("#save-btn").addEventListener("click", async () => {
  const channel = await saveSpecies(record);
  if (channel === "api") toast("已封存 · 入溪涧图可见");
  else if (channel === "local") toast("后端未应 · 已离线存入浏览器 localStorage");
  else toast("保存失败");
});

/* ================= 主循环 ================= */

const clock = new THREE.Clock();
let time = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  // 视窗尺寸自适应
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pr = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if (entity) {
    if (behaviorState === "WALK") gaitCyc = (gaitCyc + record.gait.freq * dt) % 1;
    entity.tick({
      time, dt, gait: gaitCyc,
      moving: behaviorState === "WALK" ? 1 : 0,
      gaitAmp: record.gait.swing,
      spineAmp: record.gait.spine,
      tailAmp: record.gait.tail,
    });
  }
  controls.update();
  renderer.render(scene, camera);
}

/* ================= 初始化 ================= */

refreshFields();
renderRelations();
updateThumbs();
buildEntity(true);
setState("WALK");
animate();

// 调试/测试钩子
window.__lab = {
  get record() { return record; },
  get entity() { return entity; },
  get state() { return behaviorState; },
  scene, camera, renderer,
  buildEntity, setState,
};
