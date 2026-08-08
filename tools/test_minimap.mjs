// 小地图验收：等距方位投影正确性 · 图例菜单 · 玩家标记 · 场景接线
// 运行：node tools/test_minimap.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({
      name: "three",
      version: "0.172.0-local-bridge",
      type: "module",
      main: "../../vendor/three.module.js",
    })
  );
}

// ---------- DOM 桩（Proxy 2D 上下文：任意方法均空操作） ----------
const mkCtx2d = (canvas) =>
  new Proxy(
    {
      canvas,
      measureText: () => ({ width: 10 }),
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    {
      get(t, k) {
        if (k in t) return t[k];
        return () => {};
      },
      set() {
        return true;
      },
    }
  );
function mkEl(tag = "div") {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: "",
    className: "",
    children: [],
    style: {},
    dataset: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c) { const h = this._s.has(c); h ? this._s.delete(c) : this._s.add(c); return !h; },
      contains(c) { return this._s.has(c); },
    },
    listeners: {},
    innerHTML: "",
    textContent: "",
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.unshift(c); return c; },
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    removeEventListener() {},
    setAttribute() {},
    _elCache: {},
    querySelector(sel) {
      // 真实浏览器 innerHTML 会解析出子树；桩里按选择器惰性创建并缓存，
      // 同时挂进 children，使测试侧的 tree-walk query() 也能找到同一对象。
      if (!this._elCache[sel]) {
        const tag = sel.includes("canvas") ? "canvas" : sel.startsWith(".") ? "span" : "div";
        const sub = mkEl(tag);
        if (sel.startsWith("#")) sub.id = sel.slice(1);
        if (sel.startsWith(".")) sub.classList.add(sel.slice(1));
        this._elCache[sel] = sub;
        this.children.push(sub);
      }
      return this._elCache[sel];
    },
    querySelectorAll() { return []; },
    getBoundingClientRect() {
      // 反映 style.left/top：拖拽后 pointerup 要读到新位置做持久化
      const l = parseFloat(this.style?.left) || 0;
      const t = parseFloat(this.style?.top) || 0;
      return { left: l, top: t, width: this.width || 190, height: this.height || 190 };
    },
    parentNode: null,
  };
  if (String(tag).toLowerCase() === "canvas") {
    el.width = 190;
    el.height = 190;
    el.getContext = () => mkCtx2d(el);
  }
  return el;
}
function query(root, sel) {
  // 极简选择器：仅支持 #id 与 .class（测试够用）
  const byId = sel.startsWith("#") ? sel.slice(1) : null;
  const byClass = sel.startsWith(".") ? sel.slice(1) : null;
  let found = null;
  (function walk(node) {
    if (found) return;
    if (byId && node.id === byId) { found = node; return; }
    if (byClass && node.classList?.contains(byClass)) { found = node; return; }
    for (const c of node.children || []) walk(c);
  })(root);
  return found || mkEl();
}

const hudEl = mkEl();
hudEl.id = "hud";
const questEl = mkEl();
questEl.id = "quest-panel";
questEl.parentNode = hudEl;
hudEl.children.push(questEl);

const byIdMap = { hud: hudEl, "quest-panel": questEl };
globalThis.document = {
  createElement: (t) => mkEl(t),
  getElementById: (id) => byIdMap[id] || null,
  querySelector: () => mkEl(),
  querySelectorAll: () => [],
  body: mkEl(),
  addEventListener() {},
};
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _store: store,
  };
})();
globalThis.performance = { now: () => Date.now() };
globalThis.Element = class Element {}; // dragPanel 的控件豁免判定依赖

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createMinimap, azimuthalProject, hFovHalfRad } = await import(
  new URL("src/ui/minimap.js", BASE).href
);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] 等距方位投影数学");
const C = new THREE.Vector3(0, 1, 0); // 图心 = 北极
const UP3 = new THREE.Vector3(0, 0, 1); // 切平面上轴（任意取）
const RIGHT = new THREE.Vector3().crossVectors(UP3, C).normalize();
const MAXR = Math.PI / 2;
// 图心自身 → 圆盘中心
const p0 = azimuthalProject(C, C, RIGHT, UP3, MAXR, 80);
assert(Math.abs(p0.x) < 1e-9 && Math.abs(p0.y) < 1e-9, "图心应投到圆盘中心");
// 赤道上 +X 方向 → 水平直径上贴边（|x|=radius、y≈0；符号 = 相机遇例，左右均可）
const p1 = azimuthalProject(new THREE.Vector3(1, 0, 0), C, RIGHT, UP3, MAXR, 80);
assert(Math.abs(Math.abs(p1.x) - 80) < 1e-6 && Math.abs(p1.y) < 1e-6, `+X 应在水平缘，实际 (${p1.x}, ${p1.y})`);
// 角距单调：近点比远点更靠内
const pNear = azimuthalProject(new THREE.Vector3(0.2, 0.98, 0), C, RIGHT, UP3, MAXR, 80);
const pFar = azimuthalProject(new THREE.Vector3(0.9, 0.44, 0), C, RIGHT, UP3, MAXR, 80);
assert(Math.hypot(pNear.x, pNear.y) < Math.hypot(pFar.x, pFar.y), "角距应单调映射半径");
// 超出 maxRho → clamped 贴边不外溢
const pOut = azimuthalProject(new THREE.Vector3(0, -1, 0), C, RIGHT, UP3, MAXR, 80);
assert(pOut.clamped && Math.hypot(pOut.x, pOut.y) <= 80 + 1e-9, "超界点应贴边截断");
ok("中心/边缘/单调/截断四项投影性质正确");

console.log("[2] 面板构建与图例菜单");
const toasts = [];
const player = {
  position: new THREE.Vector3(0, 160, 0),
  facing: new THREE.Vector3(1, 0, 0),
};
const LANDMARKS = [
  { id: "citadel", name: "高山圣城", color: "#d4af37",
    getDir: () => new THREE.Vector3(0.3, -0.6, -0.7) },
  { id: "gate", name: "叹息之门", color: "#b85a42",
    getDir: () => new THREE.Vector3(-0.3, -0.2, -0.9) },
  { id: "bookshop", name: "书店镇", color: "#d98a2b",
    getDir: () => new THREE.Vector3(0.05, 0.99, 0.05) },
  { id: "broken", name: "缺位场景", color: "#888",
    getDir: () => null }, // 防御：缺数据不炸
];
const mm = createMinimap({
  landmarks: LANDMARKS,
  getPlayer: () => player,
  planetRadius: 160,
  toast: (m) => toasts.push(m),
});
assert(mm, "createMinimap 应返回句柄");
const stack = query(hudEl, "#topleft-stack");
assert(stack.children.includes(questEl), "任务面板应收编进左上角竖排栈");
const panel = query(hudEl, "#minimap-panel");
assert(panel.id === "minimap-panel", "小地图面板应挂载");
ok("左上角竖排栈：任务面板 + 小地图");

// 图例行数 = 地标数（缺位项也占位，只是距离显示 —）
const legend = query(panel, "#minimap-legend");
assert.equal(legend.children.length, 4, `图例应 4 行，实际 ${legend.children.length}`);
ok("图例菜单 4 行（含缺位防御行）");

console.log("[3] 更新循环 + 交互脉冲 + 视野扇形框");
// 水平 FOV 半角换算：fov 60° aspect 1 → 半角恰为 30°
const h1 = hFovHalfRad(60, 1);
assert(Math.abs(h1 - Math.PI / 6) < 1e-9, `aspect=1 时 hfov/2 应 = vfov/2，实际 ${h1}`);
// 宽屏 aspect 16:9 → 水平张角必须大于垂直
const hWide = hFovHalfRad(60, 16 / 9);
assert(hWide > Math.PI / 6 && hWide < Math.PI / 2, `宽屏半角应展宽，实际 ${hWide}`);
// 超宽不爆：aspect 极大时趋近 π/2 但绝不达到（扇形不会反卷）
assert(hFovHalfRad(60, 100) < Math.PI / 2, "极端宽高比不应反卷");
ok("hFovHalfRad：垂直/水平换算与宽屏展宽正确");

const camPos = new THREE.Vector3(0, 160, 0);
const camFwd = new THREE.Vector3(0.3, -0.1, 0.9).normalize();
const mmView = {
  position: camPos,
  forward: camFwd,
  fov: 60,
  aspect: 1280 / 720,
};
// 带视野框的第二个实例（验证 getView 绘制路径不炸）
const mm2 = createMinimap({
  landmarks: LANDMARKS,
  getPlayer: () => player,
  getView: () => mmView,
  planetRadius: 160,
  toast: (m) => toasts.push(m),
});
for (let i = 0; i < 10; i++) mm2.update(); // 多次触发（内部节流）
// 相机切到玩家身后另一侧：视野框应跟随翻转，不报错
camFwd.set(-0.5, -0.05, -0.8).normalize();
for (let i = 0; i < 3; i++) mm2.update();
ok("update ×13 含视野扇形绘制/翻转无异常（2D 节流）");

// 点击图例第一行 → 脉冲 + toast 报距离
legend.children[0].listeners.click?.forEach((fn) => fn());
assert(toasts.some((m) => m.includes("高山圣城") && m.includes("距离")), `应有距离 toast，实际 ${toasts.join("|")}`);
ok("点击图例 → 脉冲高亮 + 距离播报");

// 折叠按钮
const collapseBtn = query(panel, "#minimap-collapse");
collapseBtn.listeners.click?.forEach((fn) => fn());
assert(panel.classList.contains("collapsed"), "折叠态应加 collapsed 类");
ok("折叠/展开切换正常");

console.log("[3.5] 面板拖拽摆放");
// mm2 的面板：初始在竖排栈文档流（非 fixed）
const panel2 = mm2.panel;
assert.notEqual(panel2.style.position, "fixed", "未拖拽前应留在竖排栈文档流");
const head2 = query(panel2, "#minimap-head");
assert(head2.listeners.pointerdown?.length >= 2, "标题栏应挂脱流 + 通用拖拽两个监听");
// 按下 → 脱流为 fixed；拖动 (+60,+40) → left/top 跟随
const down = { target: head2, button: 0, pointerId: 1, clientX: 100, clientY: 100, preventDefault() {} };
head2.listeners.pointerdown.forEach((fn) => fn(down));
assert.equal(panel2.style.position, "fixed", "首次拖拽应脱流为 fixed");
head2.listeners.pointermove.forEach((fn) => fn({ pointerId: 1, clientX: 160, clientY: 140 }));
assert.equal(panel2.style.left, "60px", `左移 60，实际 ${panel2.style.left}`);
assert.equal(panel2.style.top, "40px", `下移 40，实际 ${panel2.style.top}`);
// 抬手 → 位置写 localStorage
head2.listeners.pointerup.forEach((fn) => fn({ pointerId: 1 }));
const saved = JSON.parse(globalThis.localStorage.getItem("tm.minimap.pos.v1") || "null");
assert(saved && saved.left === 60 && saved.top === 40, `位置应持久化，实际 ${JSON.stringify(saved)}`);
// 有存档时新建实例：创建即恢复 fixed 定位
const mm3 = createMinimap({
  landmarks: LANDMARKS,
  getPlayer: () => player,
  planetRadius: 160,
});
assert.equal(mm3.panel.style.position, "fixed", "有存档时应直接恢复固定定位");
assert.equal(mm3.panel.style.left, "60px", "应恢复上次 left");
ok("拖拽脱流/跟随/持久化/恢复 全链路正确");

console.log("[4] 场景接线");
const mainSrc = fs.readFileSync(fileURLToPath(new URL("src/main.js", BASE)), "utf8");
assert(mainSrc.includes("createMinimap"), "main.js 应导入 createMinimap");
assert(mainSrc.includes("minimap?.update()"), "主循环应驱动 minimap.update");
assert(mainSrc.includes("getView"), "main.js 应向小地图传入相机视野 getView");
assert(mainSrc.includes("camera.getWorldDirection"), "视野前向应取自相机");
for (const key of ["odysseyCitadel", "abandonedGate", "bookshop", "citySeaLake"]) {
  assert(mainSrc.includes(key), `小地图应标注 ${key}`);
}
const html = fs.readFileSync(fileURLToPath(new URL("index.html", BASE)), "utf8");
assert(html.includes("#minimap-panel"), "index.html 应含小地图样式");
assert(html.includes("#topleft-stack"), "index.html 应含左上角竖排栈样式");
ok("main.js 接线 + 高山圣城等经典场景标注 + 样式就绪");

console.log(`\n全部通过：${pass} 项断言`);
