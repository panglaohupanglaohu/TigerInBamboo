// =====================================================================
// 形状层波及半径审计（2026-09-03，C5 转向依据）
//
// 变体级邻接已证明 ≈ 随机（audit_module_adjacency.mjs），变体 WFC 是空操作。
// 真正可能需要约束求解的是**形状层**：屋顶分量分类 / 穹顶 / 塔楼 / 花园成立。
//
// 判据：改一格之后，有多少**别的**格的形状签名发生变化、离编辑点多远。
//   · 波及只限于所在分量  → 现有确定性规则已够，WFC 收益有限
//   · 波及跨分量 / 远距离  → 存在长程依赖，正是 WFC 的用武之地
//
// 用法：node tools/audit_shape_ripple.mjs
// =====================================================================
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({
    name: "three", version: "0.172.0-local-bridge", type: "module",
    main: "../../vendor/three.module.js",
  }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const od = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

// 形状构件：由邻接关系决定「长什么样」的那些，不含纯装饰
const SHAPE = /^town-(roof|roof-ridge|spire|dome|tower-cap|dome-cap|steeple|gable-oculus|garden|arch|support)/;

/** 每格的形状签名：该格上所有形状构件的名字集合 */
function shapeSignature(root) {
  const sig = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    const name = String(o.name || "").replace(/-\d+(?=-|$)/g, "-N");
    if (!SHAPE.test(name)) return;
    const owner = o.userData?.cell ?? o.userData?.townModule;
    const keys = owner
      ? [`${owner.ix},${owner.iy},${owner.iz}`]
      : (o.userData?.cells ?? []);
    for (const k of keys) {
      let s = sig.get(k);
      if (!s) sig.set(k, (s = new Set()));
      s.add(name);
    }
  });
  return sig;
}

// 形状构件构建后已被吸收进合并块（合并网格只有 faceToCell，没有 userData.cell）。
// 用全量 dirty + debounceMs>0 重走一遍装配，拿到合并前的独立网格。
const build = (specOverride) => {
  const c = od.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
  const s = specOverride ?? c.userData.townSpec;
  const cells = [];
  for (const terrace of s.terraces ?? []) {
    (terrace.levels ?? []).forEach((rows, iy) => (rows ?? []).forEach((row, iz) => {
      String(row).split("").forEach((ch, ix) => { if (ch !== ".") cells.push(`${ix},${iy},${iz}`); });
    }));
  }
  od.rebuildCitadelTownIncremental(c, s, cells, { debounceMs: 400 });
  return c;
};

const base = build(null);
const spec = base.userData.townSpec;
const sigA = shapeSignature(base);
if (sigA.size === 0) {
  console.error("❌ 基准签名为空——采样口径错了，测量不可信");
  process.exit(1);
}
console.log(`基准：带形状签名的格 ${sigA.size} 个`);

// 找一个有屋顶的格来编辑（形状层最活跃的地方）
const levels = spec.terraces[0].levels;
let target = null;
outer:
for (let iy = levels.length - 1; iy >= 1; iy--) {
  for (let iz = 2; iz < 22; iz++) {
    const row = String(levels[iy]?.[iz] ?? "");
    for (let ix = 2; ix < 22; ix++) {
      if ((row[ix] ?? ".") !== ".") { target = { ix, iy, iz }; break outer; }
    }
  }
}
if (!target) { console.log("找不到可编辑的格"); process.exit(0); }

// 多点采样：单点可能落在孤立格上，测不出分量级重分类
const candidates = [];
for (let iy = 1; iy < levels.length; iy++) {
  for (let iz = 2; iz < 22; iz++) {
    const row = String(levels[iy]?.[iz] ?? "");
    for (let ix = 2; ix < 22; ix++) {
      if ((row[ix] ?? ".") !== ".") candidates.push({ ix, iy, iz });
    }
  }
}
const SAMPLES = 8;
const picks = [];
for (let i = 0; i < SAMPLES && candidates.length; i++) {
  picks.push(candidates[Math.floor((i * 7919 + 13) % candidates.length)]);
}

let worst = 0;
let worstAt = null;
const rows = [];
for (const target of picks) {
  const edited = JSON.parse(JSON.stringify(spec));
  const rowsAt = edited.terraces[0].levels[target.iy];
  const row = String(rowsAt[target.iz]).split("");
  if (row[target.ix] === ".") continue;
  row[target.ix] = ".";
  rowsAt[target.iz] = row.join("");
  const sigB = shapeSignature(build(edited));

  const same = (a, b) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  };
  let changed = 0;
  let maxDist = 0;
  for (const key of new Set([...sigA.keys(), ...sigB.keys()])) {
    if (same(sigA.get(key), sigB.get(key))) continue;
    changed++;
    const [ix, , iz] = key.split(",").map(Number);
    const d = Math.abs(ix - target.ix) + Math.abs(iz - target.iz);
    if (d > maxDist) maxDist = d;
  }
  rows.push({ target, changed, maxDist });
  if (maxDist > worst) { worst = maxDist; worstAt = target; }
}

console.log("\n编辑格         变化格数  最远波及(曼哈顿)");
for (const r of rows) {
  console.log(`  ${`${r.target.ix},${r.target.iy},${r.target.iz}`.padEnd(12)} ${String(r.changed).padStart(8)}  ${String(r.maxDist).padStart(12)}`);
}
console.log(`\n最坏情况：${worst} 格${worstAt ? `（编辑 ${worstAt.ix},${worstAt.iy},${worstAt.iz}）` : ""}`);
console.log(worst <= 2
  ? "\n⇒ 波及严格局部（≤2）：现有确定性规则已覆盖，形状层 WFC 收益有限。"
  : `\n⇒ 存在 ${worst} 格远的长程依赖：这才是 WFC 该解决的层。`);
