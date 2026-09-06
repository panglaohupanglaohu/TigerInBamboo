// =====================================================================
// 编辑器越用越卡：几何泄漏探针（主人 2026-09-05 截屏 fps 11.9 / geoms 12922 /
// calls 3686 / hitch 844 worst 1582.6ms —— 声音在放，画面几乎不动）
//
// 现网读数对照 tools/test_perf_budget.mjs 的预算：
//   calls ≤ 1200（实测 3686）· programs ≤ 120（实测 181）· geometries ~1200（实测 12922）
// 三项全部大幅超标，量级像**每次编辑都新建几何却没有 dispose**。
//
// 本探针不看画面，只做一件事：**数**。
// 挂钩 BufferGeometry 的构造与 dispose，跑 N 次增量编辑，报告
//   新建 / 释放 / 净增，以及净增几何按名字归类的排行。
//
// 运行：node tools/probe_geom_leak.mjs [编辑次数]
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
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);

// ---- 挂钩：所有 BufferGeometry 的生死都记账 --------------------------------
const live = new Set();
const birth = new Map();   // geometry -> 出生地（仅 TRACE 时填）
const TRACE = process.env.TRACE !== "0";
let created = 0;
let disposed = 0;
{
  const proto = THREE.BufferGeometry.prototype;
  const origDispose = proto.dispose;
  proto.dispose = function patchedDispose(...args) {
    if (live.delete(this)) disposed++;
    return origDispose.apply(this, args);
  };
  // 构造计数：BufferGeometry 及其所有子类都会走到 setAttribute / 构造器，
  // 这里挂 setAttribute 最省事且覆盖全（每个几何至少写一次 position）
  const origSet = proto.setAttribute;
  proto.setAttribute = function patchedSetAttribute(name, attr) {
    if (!live.has(this)) {
      live.add(this);
      created++;
      // 记出生地：泄漏的几何是「没人引用也没 dispose」的，光看名字定位不到，
      // 得知道是**哪段代码**造的。只留仓库内的前 3 帧。
      if (TRACE) {
        const st = (new Error().stack || "").split("\n").slice(2)
          .map((l) => l.trim())
          .filter((l) => l.includes("/src/") && !l.includes("three.module.js"))
          .slice(0, 3)
          .map((l) => {
            const mm = l.match(/at ([^\s(]+).*?\/src\/(.+?):(\d+):/);
            return mm ? `${mm[2]}:${mm[3]} ${mm[1]}` : l.slice(0, 90);
          })
          .join("  <-  ");
        birth.set(this, st || "(仓库外)");
      }
    }
    return origSet.call(this, name, attr);
  };
}

const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

// 与 test_edit_soak 同一条路径：整座古堡 + terraces[0].levels 的 ASCII 布局
const citadel = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
let spec = JSON.parse(JSON.stringify(citadel.userData.townSpec));

const mark = () => ({ created, disposed, live: live.size });
const base = mark();
console.log(`建城后：新建 ${base.created} · 释放 ${base.disposed} · 存活 ${base.live}`);

const levels = spec.terraces[0].levels;
const targets = [];
for (let iy = 1; iy < 6; iy++) {
  for (let iz = 3; iz < 9; iz++) {
    const row = String(levels[iy]?.[iz] ?? "");
    for (let ix = 3; ix < 9; ix++) if ((row[ix] ?? ".") !== ".") targets.push({ ix, iy, iz });
  }
}
const N = Math.min(Math.max(1, Number(process.argv[2]) || 20), targets.length);
console.log(`可编辑格 ${targets.length}，将做 ${N} 次编辑（每次挖掉一格，几何**本应减少**）`);

const perEdit = [];
for (let n = 0; n < N; n++) {
  const before = mark();
  const t = targets[n];
  const next = JSON.parse(JSON.stringify(spec));
  const rows = next.terraces[0].levels[t.iy];
  const row = String(rows[t.iz]).split("");
  row[t.ix] = ".";
  rows[t.iz] = row.join("");
  const dirty = [...m.computeCitadelDirtyCells(m.diffCitadelLayouts(spec, next))].map(String);
  const r = m.rebuildCitadelTownIncremental(citadel, next, dirty, { debounceMs: 0 });
  if (!r.ok) { console.log(`  #${n} 增量失败：${r.error ?? ""}`); break; }
  spec = next;
  const after = mark();
  perEdit.push({
    i: n,
    created: after.created - before.created,
    disposed: after.disposed - before.disposed,
    net: after.live - before.live,
  });
}

const tot = mark();
const sum = perEdit.reduce((a, e) => a + e.net, 0);
console.log("\n每次编辑（新建 / 释放 / 净增存活）：");
for (const e of perEdit) {
  console.log(`  #${String(e.i).padStart(2)}  +${String(e.created).padStart(5)} / -${String(e.disposed).padStart(5)} / 净 ${e.net >= 0 ? "+" : ""}${e.net}`);
}
console.log(`\n合计：新建 ${tot.created - base.created} · 释放 ${tot.disposed - base.disposed} · **净增 ${sum}**`);
console.log(`存活几何：建城后 ${base.live} → ${N} 次编辑后 ${tot.live}` +
  `（${((tot.live / Math.max(1, base.live) - 1) * 100).toFixed(1)}%，人均每次编辑 +${(sum / Math.max(1, N)).toFixed(1)}）`);

const root = citadel;
// ---- 净增的都是些什么：按持有它的网格名归类 --------------------------------
const byName = new Map();
let orphan = 0;
root.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  if (!live.has(o.geometry)) return;
  const key = (o.name || "(无名)").replace(/[0-9]+$/, "#");
  byName.set(key, (byName.get(key) || 0) + 1);
});
// 场景里挂不到的存活几何 = 真泄漏（没人引用却没 dispose）
{
  const inScene = new Set();
  root.traverse((o) => { if (o.geometry) inScene.add(o.geometry); });
  for (const g of live) if (!inScene.has(g)) orphan++;
}
const top = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log("\n场景里存活几何 Top（按网格名）：");
for (const [k, v] of top) console.log(`  ${String(v).padStart(5)}  ${k}`);
console.log(`\n⚠️ **游离几何（没挂在场景里、也没 dispose）= ${orphan}** —— 这一项就是纯泄漏`);

if (TRACE) {
  const inScene = new Set();
  root.traverse((o) => { if (o.geometry) inScene.add(o.geometry); });
  const byBirth = new Map();
  for (const g of live) {
    if (inScene.has(g)) continue;
    const k = birth.get(g) || "(未记录)";
    byBirth.set(k, (byBirth.get(k) || 0) + 1);
  }
  const rank = [...byBirth.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log("\n泄漏几何按出生地排行（造它的那段代码）：");
  for (const [k, v] of rank) console.log(`  ${String(v).padStart(6)}  ${k}`);
}
