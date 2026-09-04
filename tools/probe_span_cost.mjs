// =====================================================================
// C4「分量签名缓存」派单前的成本探针：一次编辑里，跨格构件（userData.cells）
// 到底占多少重建量？签名缓存能省的上限就是这个数。
// 运行：node tools/probe_span_cost.mjs
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
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const cloneLayout = (l) => JSON.parse(JSON.stringify(l));
let workSpec = cloneLayout(castle.userData.townSpec);

const editSpots = [
  [5, 2, 5], [12, 3, 8], [20, 4, 15], [8, 2, 18], [16, 3, 12],
  [3, 4, 9], [22, 2, 6], [10, 3, 20], [18, 4, 4], [6, 2, 14],
  [14, 3, 17], [2, 4, 22], [24, 2, 10], [9, 3, 3], [19, 4, 13],
];

const triOf = (o) => {
  const g = o.geometry;
  if (!g) return 0;
  return g.index ? g.index.count / 3 : (g.attributes?.position?.count ?? 0) / 3;
};

const rows = [];
// warmup（首次构建 ctx 的一次性成本）
{
  const [ix, iy, iz] = [7, 2, 7];
  const r = workSpec.terraces[0].levels[iy][iz].split(""); r[ix] = "."; workSpec.terraces[0].levels[iy][iz] = r.join("");
  m.rebuildCitadelTownIncremental(castle, workSpec, [...m.computeCitadelDirtyCells([{ ix, iy, iz }])]);
}

for (const [ix, iy, iz] of editSpots) {
  const r = workSpec.terraces[0].levels[iy][iz].split("");
  r[ix] = ".";
  workSpec.terraces[0].levels[iy][iz] = r.join("");
  const seed = [...m.computeCitadelDirtyCells([{ ix, iy, iz }])];
  const before = performance.now();
  const res = m.rebuildCitadelTownIncremental(castle, workSpec, seed, { debounceMs: 5000 });
  const ms = performance.now() - before;

  // 本次新挂上去的散网格：按「有没有 userData.cells」分跨格 / 单格
  let spanMeshes = 0, spanTris = 0, cellMeshes = 0, cellTris = 0;
  const spanIds = new Set();
  const fresh = new Set(res.freshMeshes ?? []);
  for (const o of res._newMeshList ?? []) void o;
  for (const layer of castle.userData.layers) {
    layer.traverse((o) => {
      if (!o.isMesh || o.userData.mergedGeometry || o.userData.isOutline) return;
      if (o.userData.cells) {
        spanMeshes++; spanTris += triOf(o);
        spanIds.add([...o.userData.cells].map(String).sort().join("|"));
      } else if (o.userData.cell || o.userData.townModule) { cellMeshes++; cellTris += triOf(o); }
    });
  }
  void fresh;
  rows.push({
    cell: `${ix},${iy},${iz}`, ms: +ms.toFixed(1),
    seedDirty: seed.length, closureAdded: res.spanClosure?.added ?? 0, dirty: res.dirtyCount,
    removed: res.removedCount, newMesh: res.newMeshCount,
    spanMeshes, spanTris, spanComponents: spanIds.size, cellMeshes, cellTris,
  });
}

const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const times = rows.map((r) => r.ms).sort((a, b) => a - b);
console.log(rows.map((r) =>
  `${r.cell.padEnd(9)} ${String(r.ms).padStart(6)}ms  seed=${String(r.seedDirty).padStart(3)}→dirty=${String(r.dirty).padStart(4)} (+${r.closureAdded})  ` +
  `removed=${String(r.removed).padStart(4)} new=${String(r.newMesh).padStart(4)}  跨格件=${String(r.spanMeshes).padStart(5)}/${String(r.spanComponents).padStart(3)}组 ${String(r.spanTris).padStart(6)}tris  单格件=${String(r.cellMeshes).padStart(5)} ${String(r.cellTris).padStart(6)}tris`
).join("\n"));
console.log(
  `\nP50=${times[Math.floor(times.length*0.5)].toFixed(1)}ms P90=${times[Math.floor(times.length*0.9)].toFixed(1)}ms  ` +
  `闭包平均 +${(sum("closureAdded")/rows.length).toFixed(1)} 格/次  跨格构件常驻 ${(sum("spanTris")/rows.length).toFixed(0)} tris / ${(sum("spanMeshes")/rows.length).toFixed(0)} 件`
);
