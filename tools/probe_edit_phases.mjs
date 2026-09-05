// =====================================================================
// C4 性能：一次编辑的**分阶段**耗时。
// P90 的尾巴到底花在哪一步？在改任何东西之前先把这张表打出来。
//   A 蓝图+装配（buildCitadelTown 的 dirty 子集）
//   B 摘旧网格 + 合并块区间压缩（dropCellsFromMerged）
//   C 挂新网格 + 描边
//   D 重合并（mergeStaticGroup，debounce=0 时同帧做）
// 运行：node tools/probe_edit_phases.mjs
// =====================================================================
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener(){}, removeEventListener(){}, requestAnimationFrame(){}, matchMedia: () => ({ matches:false, addEventListener(){}, removeEventListener(){} }) };
const stubEl = () => ({ style:{}, classList:{add(){},remove(){},toggle(){},contains:()=>false}, textContent:"", appendChild(){}, addEventListener(){}, querySelector:()=>stubEl(), querySelectorAll:()=>[] });
const stubCanvas = () => { const el = stubEl(); el.width=64; el.height=64; el.getContext=()=>({ canvas:el, fillRect(){}, clearRect(){}, measureText:()=>({width:6}), createLinearGradient:()=>({addColorStop(){}}), fillText(){}, drawImage(){}, getImageData:()=>({data:new Uint8ClampedArray(4)}) }); el.toDataURL=()=>""; return el; };
globalThis.document = { createElement:(t)=>String(t).toLowerCase()==="canvas"?stubCanvas():stubEl(), createElementNS:(_n,t)=>String(t).toLowerCase()==="canvas"?stubCanvas():stubEl(), getElementById:()=>stubEl(), querySelector:()=>stubEl(), querySelectorAll:()=>[], body:{appendChild(){}}, addEventListener(){} };
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const gm = await import(new URL("src/world/geometryMerge.js", BASE).href);
const ct = await import(new URL("src/world/citadelTown.js", BASE).href);

// ---- 插桩：把两个热点函数包一层计时（不改生产代码） ----
const phase = { merge: 0, mergeCalls: 0, build: 0, buildCalls: 0 };
const realMerge = gm.mergeStaticGroup;
const realBuild = ct.buildCitadelTown;
// ESM 导出是只读绑定，改不了；改用 Object.defineProperty 到模块命名空间会失败，
// 所以退而求其次：直接量 rebuild 的总时间，再单独量 mergeStaticGroup 的净时间。
void realMerge; void realBuild;

const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const cloneLayout = (l) => JSON.parse(JSON.stringify(l));
let workSpec = cloneLayout(castle.userData.townSpec);

const editSpots = [
  [5,2,5],[12,3,8],[20,4,15],[8,2,18],[16,3,12],[3,4,9],[22,2,6],[10,3,20],
  [18,4,4],[6,2,14],[14,3,17],[2,4,22],[24,2,10],[9,3,3],[19,4,13],[7,2,11],
  [13,4,7],[21,3,19],[4,2,16],[11,4,21],
];

const dig = (ix, iy, iz) => {
  const r = workSpec.terraces[0].levels[iy][iz].split("");
  r[ix] = ".";
  workSpec.terraces[0].levels[iy][iz] = r.join("");
};

// warmup
dig(7, 2, 7);
m.rebuildCitadelTownIncremental(castle, workSpec, [...m.computeCitadelDirtyCells([{ ix:7, iy:2, iz:7 }])]);

const rows = [];
for (const [ix, iy, iz] of editSpots) {
  dig(ix, iy, iz);
  const seed = [...m.computeCitadelDirtyCells([{ ix, iy, iz }])];

  // 同帧合并（debounce=0）＝ 门 D 走的路径
  const t0 = performance.now();
  const res = m.rebuildCitadelTownIncremental(castle, workSpec, seed);
  const total = performance.now() - t0;

  // 合并成本单独量：把这一层再重合并一次，量净耗时（几何量相同，是可比的代理值）
  let mergeMs = 0;
  let mergedTris = 0;
  for (const layer of castle.userData.layers) {
    for (const level of layer.children) {
      if (!level.isGroup) continue;
      let has = false;
      level.traverse((o) => { if (o.isMesh && o.userData.mergedGeometry) has = true; });
      if (!has) continue;
      const t = performance.now();
      const r = gm.mergeStaticGroup(level, { mergedTag: "probe" });
      mergeMs += performance.now() - t;
      for (const s of r.surfaces ?? []) {
        const g = s.geometry;
        mergedTris += g.index ? g.index.count / 3 : (g.attributes?.position?.count ?? 0) / 3;
      }
    }
  }

  rows.push({
    cell: `${ix},${iy},${iz}`,
    total: +total.toFixed(1),
    dirty: res.dirtyCount,
    closure: res.spanClosure?.added ?? 0,
    removed: res.removedCount,
    newMesh: res.newMeshCount,
    merged: res.mergedCount ?? 0,
    remergeMs: +mergeMs.toFixed(1),
  });
}

rows.forEach((r) => console.log(
  `${r.cell.padEnd(9)} ${String(r.total).padStart(6)}ms  dirty=${String(r.dirty).padStart(4)}(+${String(r.closure).padStart(3)})  ` +
  `摘=${String(r.removed).padStart(4)} 新=${String(r.newMesh).padStart(4)} 合并层=${String(r.merged).padStart(2)}  重合并代理=${String(r.remergeMs).padStart(6)}ms`
));
const times = rows.map((r) => r.total).sort((a, b) => a - b);
const pct = (p) => times[Math.min(times.length - 1, Math.floor(times.length * p))];
const avg = (k) => (rows.reduce((a, r) => a + r[k], 0) / rows.length);
console.log(`\n总: P50=${pct(0.5).toFixed(1)}ms P90=${pct(0.9).toFixed(1)}ms max=${times[times.length-1].toFixed(1)}ms`);
console.log(`平均: dirty=${avg("dirty").toFixed(0)}(闭包+${avg("closure").toFixed(1)}) 摘=${avg("removed").toFixed(0)} 新=${avg("newMesh").toFixed(0)} 合并层=${avg("merged").toFixed(1)}`);
console.log(`慢的 5 次 vs 快的 5 次：`);
const bySlow = [...rows].sort((a, b) => b.total - a.total);
const fmt = (r) => `${r.cell}(${r.total}ms dirty=${r.dirty} 新=${r.newMesh} 层=${r.merged})`;
console.log(`  慢: ${bySlow.slice(0, 5).map(fmt).join("  ")}`);
console.log(`  快: ${bySlow.slice(-5).map(fmt).join("  ")}`);
