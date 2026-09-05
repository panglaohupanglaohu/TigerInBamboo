// =====================================================================
// C4 性能 · 第二刀：一次编辑的**固定成本**有多大？
// probe_edit_phases 发现：什么都没改的空转编辑（新网格 0、重合并层 0）
// 仍然要 68~78ms。那这 70ms 花在哪？本探针把 rebuild 前半段拆开量：
//   ① createCitadelBlueprint（每次都从 spec 重算整份蓝图）
//   ② buildCitadelTerraceTownAssembly（带 dirty 子集，但**建表/收户/聚簇**是全量的）
// 运行：node tools/probe_edit_fixed_cost.mjs
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

await import(new URL("vendor/three.module.js", BASE).href);
const bp = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const ct = await import(new URL("src/world/citadelTown.js", BASE).href);
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const spec = JSON.parse(JSON.stringify(castle.userData.townSpec));

const N = 12;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

// ---- ① createCitadelBlueprint 单独耗时
const mk = () => bp.createCitadelBlueprint({
  spec,
  contour: castle.userData.contourSpec ?? m.CITADEL?.contourTerrain,
  floors: castle.userData.floors,
  instanceId: castle.userData.instanceId ?? null,
  skipOuterTerrain: castle.userData.skipOuterTerrain === true,
  townBaseLift: castle.userData.townBaseLift ?? 0.6,
});
mk(); mk();
const bpMs = [];
for (let i = 0; i < N; i++) { const t = performance.now(); mk(); bpMs.push(performance.now() - t); }

// ---- ② buildCitadelTown：dirty 全集 vs 单格 dirty vs 空 dirty
const blueprint = mk();
const layout = blueprint.town.layout;
const mkCtx = () => ({
  mesh: (geo, mat, name) => { const o = { isMesh: true, geometry: geo, material: mat, name, userData: {}, position: { set(){}, copy(){}, add(){}, addScaledVector(){} }, rotation: { set(){} }, scale: { set(){}, setScalar(){} }, quaternion: { copy(){} }, traverse(f){ f(this); }, add(){}, attach(){}, getWorldPosition(v){ return v; } }; return o; },
});
void mkCtx;

// 用真实入口：只改 dirty 规模，量装配耗时
const buildOnce = (dirty) => {
  const t = performance.now();
  ct.buildCitadelTown(layout, {
    ...castle.userData.townCtxCache?.ctx,
  });
  return performance.now() - t;
};
void buildOnce;

// buildCitadelTown 的 ctx 构造在 odysseyCitadel 内部，这里改量整条 rebuild：
// 只有 dirty 规模不同，差值就是「按格发几何」的可变成本，截距就是固定成本。
const work = JSON.parse(JSON.stringify(spec));
const digAt = (ix, iy, iz) => { const r = work.terraces[0].levels[iy][iz].split(""); r[ix] = "."; work.terraces[0].levels[iy][iz] = r.join(""); };
digAt(7, 2, 7);
m.rebuildCitadelTownIncremental(castle, work, [...m.computeCitadelDirtyCells([{ ix:7, iy:2, iz:7 }])]);

// 空 dirty 不会进主体（会 early-return），所以用「已经是空的格」当空转样本
const emptyEdits = [];
const realEdits = [];
for (let iy = 2; iy <= 4; iy++) {
  for (let iz = 3; iz < 24; iz += 3) {
    for (let ix = 3; ix < 24; ix += 5) {
      const ch = work.terraces[0].levels[iy]?.[iz]?.[ix];
      if (ch === undefined) continue;
      (ch === "." ? emptyEdits : realEdits).push([ix, iy, iz]);
    }
  }
}
const runOne = ([ix, iy, iz]) => {
  digAt(ix, iy, iz);
  const seed = [...m.computeCitadelDirtyCells([{ ix, iy, iz }])];
  const t = performance.now();
  const r = m.rebuildCitadelTownIncremental(castle, work, seed);
  return { ms: performance.now() - t, newMesh: r.newMeshCount, merged: r.mergedCount ?? 0 };
};
const emptyRuns = emptyEdits.slice(0, 14).map(runOne);
const realRuns = realEdits.slice(0, 14).map(runOne);

console.log(`createCitadelBlueprint 单次中位 ${med(bpMs).toFixed(1)}ms（${N} 次：${bpMs.map((v)=>v.toFixed(0)).join("/")}）`);
console.log(`空转编辑（新网格 0）  中位 ${med(emptyRuns.map(r=>r.ms)).toFixed(1)}ms  n=${emptyRuns.length}  新网格=${emptyRuns.map(r=>r.newMesh).join(",")}`);
console.log(`真实编辑（有新网格）  中位 ${med(realRuns.map(r=>r.ms)).toFixed(1)}ms  n=${realRuns.length}  新网格中位=${med(realRuns.map(r=>r.newMesh))}`);
const fixed = med(emptyRuns.map(r=>r.ms));
const real = med(realRuns.map(r=>r.ms));
console.log(`\n结论：固定成本 ≈ ${fixed.toFixed(0)}ms，其中蓝图 ${med(bpMs).toFixed(0)}ms（占 ${(med(bpMs)/fixed*100).toFixed(0)}%）`);
console.log(`      真实编辑 ${real.toFixed(0)}ms 里，可变部分只有 ${(real-fixed).toFixed(0)}ms —— 固定成本占 ${(fixed/real*100).toFixed(0)}%`);
