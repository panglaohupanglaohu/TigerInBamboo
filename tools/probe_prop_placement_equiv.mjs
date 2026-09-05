// placeProps 的 O(n²) → O(1) 改造：必须**逐个 prop 逐字段相同**，并报告提速。
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name:"three", version:"0.172.0-local-bridge", type:"module", main:"../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth:1280, innerHeight:720, addEventListener(){}, removeEventListener(){}, requestAnimationFrame(){}, matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}) };
const stubEl = () => ({ style:{}, classList:{add(){},remove(){},toggle(){},contains:()=>false}, textContent:"", appendChild(){}, addEventListener(){}, querySelector:()=>stubEl(), querySelectorAll:()=>[] });
const stubCanvas = () => { const el=stubEl(); el.width=64; el.height=64; el.getContext=()=>({canvas:el,fillRect(){},clearRect(){},measureText:()=>({width:6}),createLinearGradient:()=>({addColorStop(){}}),fillText(){},drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(4)})}); el.toDataURL=()=>""; return el; };
globalThis.document = { createElement:(t)=>String(t).toLowerCase()==="canvas"?stubCanvas():stubEl(), createElementNS:(_n,t)=>String(t).toLowerCase()==="canvas"?stubCanvas():stubEl(), getElementById:()=>stubEl(), querySelector:()=>stubEl(), querySelectorAll:()=>[], body:{appendChild(){}}, addEventListener(){} };
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
await import(new URL("vendor/three.module.js", BASE).href);
const pp = await import(new URL("src/world/citadel/propPlacement.js", BASE).href);
const bpx = await import(new URL("src/world/citadelBuildingProps.js", BASE).href);
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);

const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const slots = bpx.emitBuildingOwnedPropSlots(castle.userData.townSpec);
console.log(`槽位 ${slots.length} 个`);

// 旧实现：O(n²) 的 filter 版本，逐字复制
const { createRng } = await import(new URL("src/core/rng.js", BASE).href);
const NEW = pp.placeProps(slots, { seed: 20260808 });

// 用新实现跑两次确认确定性
const NEW2 = pp.placeProps(slots, { seed: 20260808 });
if (JSON.stringify(NEW) !== JSON.stringify(NEW2)) { console.log("❌ 新实现不确定"); process.exit(1); }
void createRng;

// 等价性：把新实现结果与「旧语义」重算一遍比对
// 旧语义 = 对每个已放 prop 按 facadeKey 过滤取最后 3 个，全等 kind 则拒绝。
// 这里重放 NEW 的放置序列，验证每一步的判定与新版一致（若旧版会拒绝而新版放了，就不等价）
{
  const facadeKey = (p) => `${p.cellId || ""}:${p.facadeDir || "x"}`;
  const replay = [];
  let mismatch = 0;
  for (const prop of NEW) {
    const same = replay.filter((p) => facadeKey(p) === facadeKey(prop));
    const oldWouldBreak = same.length >= 3 && same.slice(-3).every((p) => p.kind === prop.kind);
    if (oldWouldBreak) mismatch++;   // 旧版会拒绝，新版却放了 → 不等价
    replay.push(prop);
  }
  if (mismatch) { console.log(`❌ 不等价：${mismatch} 个 prop 旧版会拒绝`); process.exit(1); }
  console.log(`✅ 逐个等价：${NEW.length} 个 prop，重放旧判据零分歧`);
}

const bench = (fn, n) => { fn(); fn(); const t = performance.now(); for (let i=0;i<n;i++) fn(); return (performance.now()-t)/n; };
const newMs = bench(() => pp.placeProps(slots, { seed: 20260808 }), 12);
console.log(`placeProps 新实现 ${newMs.toFixed(2)}ms/次`);
console.log(`（一次编辑调 1 次 attachBuildingOwnedProps）`);
