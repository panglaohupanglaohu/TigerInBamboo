// =====================================================================
// 苔庭之战 · SOCCO 载具化（主人 2026-09-04 需求）
//
// SOCCO 就是 gateHaulerCraft（主人确认）。本测试只管 `carrier: true` 这一档：
//   ① 布景艇不受影响：carrier=false 的形体与货舱化之前逐字相同（无 socco-* 部件）
//   ② 腹内 14 个座位（= 20 名先锋兵 − GatePod 索降的 6 名），排布不重叠
//   ③ 尾门朝 −Z：关门时跳板贴腹，开门时末端**探到腹板下方**（能踏到海面）
//   ④ 气帘不描边、不投影、不写深度——它是水雾不是构件（描边壳会变成一圈黑框）
//   ⑤ 贴海巡航把艇钉到 seaRadius + skimHeight（球面世界：up 是径向不是 (0,1,0)）
//   ⑥ 绳锚 2 个，在尾门口（撤离攀绳用）
//   ⑦ 确定性：两次构建包围盒逐位一致（禁止 Math.random）
//
// 运行：node tools/test_socco_craft.mjs
// =====================================================================
import assert from "node:assert/strict";
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
const stubCanvas = () => { const el = stubEl(); el.width=64; el.height=64; el.getContext=()=>({ canvas:el, fillRect(){}, clearRect(){}, measureText:()=>({width:6}), createLinearGradient:()=>({addColorStop(){}}), fillText(){}, drawImage(){}, getImageData:()=>({data:new Uint8ClampedArray(4)}), putImageData(){} }); el.toDataURL=()=>""; return el; };
globalThis.document = { createElement:(t)=>String(t).toLowerCase()==="canvas"?stubCanvas():stubEl(), createElementNS:(_n,t)=>String(t).toLowerCase()==="canvas"?stubCanvas():stubEl(), getElementById:()=>stubEl(), querySelector:()=>stubEl(), querySelectorAll:()=>[], body:{appendChild(){}}, addEventListener(){} };
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const H = await import(new URL("src/world/gateHaulerCraft.js", BASE).href);
const {
  createGateHaulerCraft, createSoccoCraft, setSoccoRamp, soccoRampReady,
  soccoSeatWorldPositions, soccoRampFootWorld, updateSoccoSeaSkim, SOCCO,
} = H;

const countSocco = (root) => {
  let n = 0;
  root.traverse((o) => { if (/^socco-/.test(o.name || "")) n++; });
  return n;
};

// ---------- ① 布景艇不受影响 ----------
{
  const scenery = createGateHaulerCraft();
  assert.equal(countSocco(scenery), 0, "carrier=false 不得混进任何 socco-* 部件（叹息之门那三台是布景）");
  assert.equal(scenery.userData.isSocco, false);
  console.log("✓ ① 布景艇零污染");
}

const socco = createSoccoCraft();
assert.equal(socco.userData.isSocco, true);
assert.equal(socco.name, "socco-craft");

// ---------- ② 腹内 14 个座位 ----------
{
  assert.equal(SOCCO.holdSeats, 14, "14 = 20 名先锋兵 − GatePod 索降的 6 名");
  const seats = socco.userData.soccoSeats;
  assert.equal(seats.length, 14, `座位应 14 个，实得 ${seats.length}`);
  // 不重叠：任意两座位间距 ≥ 0.4
  let minGap = Infinity;
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      minGap = Math.min(minGap, seats[i].position.distanceTo(seats[j].position));
    }
  }
  assert.ok(minGap >= 0.4, `座位最小间距 ${minGap.toFixed(3)} < 0.4，人会叠在一起`);
  // 全部在机体内（|x| < 1.0, z ∈ [-2.3, 2.3]）
  for (const s of seats) {
    assert.ok(Math.abs(s.position.x) < 1.0, `座位 ${s.name} 横向出舱 x=${s.position.x}`);
    assert.ok(s.position.z > -2.4 && s.position.z < 2.4, `座位 ${s.name} 纵向出舱 z=${s.position.z}`);
  }
  console.log(`✓ ② 腹内 14 座，最小间距 ${minGap.toFixed(3)}`);
}

// ---------- ③ 尾门朝 −Z，开门后末端探到腹板下方 ----------
{
  socco.updateWorldMatrix(true, true);
  setSoccoRamp(socco, 0);
  assert.equal(soccoRampReady(socco), false, "关门时不能算 ready");
  const closed = soccoRampFootWorld(socco, new THREE.Vector3());
  setSoccoRamp(socco, 1);
  assert.equal(soccoRampReady(socco), true, "全开必须 ready");
  const open = soccoRampFootWorld(socco, new THREE.Vector3());
  assert.ok(open.z < 0, `跳板必须朝 −Z（尾）放，实得 z=${open.z.toFixed(2)}`);
  const drop = closed.y - open.y;
  assert.ok(drop > 2.0, `全开时末端应明显下探（能踏到海面），实得 ${drop.toFixed(2)}`);
  assert.ok(Math.abs(open.x) < 0.01, "跳板必须居中");
  console.log(`✓ ③ 尾门：关 y=${closed.y.toFixed(2)} → 开 y=${open.y.toFixed(2)}（下探 ${drop.toFixed(2)}），末端 z=${open.z.toFixed(2)}`);
}

// ---------- ④ 气帘是水雾不是构件 ----------
{
  const spray = socco.getObjectByName("socco-spray");
  assert.ok(spray, "缺气帘");
  assert.equal(spray.castShadow, false, "气帘不投影");
  assert.equal(spray.receiveShadow, false, "气帘不接影");
  assert.equal(spray.material.depthWrite, false, "气帘不写深度（否则会挡住身后的海）");
  assert.equal(spray.material.transparent, true);
  let outlines = 0;
  spray.traverse((o) => { if (o.userData?.isOutline) outlines++; });
  assert.equal(outlines, 0, "气帘描边会变成一圈黑框");
  assert.equal(spray.userData.transientFx, true, "气帘不得进静态合并块");
  console.log("✓ ④ 气帘：无描边 / 不投影 / 不写深度 / 不进合并");
}

// ---------- ⑤ 贴海巡航（球面世界：up 是径向） ----------
{
  const R = 300;
  socco.position.set(0, 0, 0);
  updateSoccoSeaSkim(socco, { t: 0, seaRadius: R });
  assert.equal(socco.position.lengthSq(), 0, "位置为原点时不该被归一化炸掉");
  // 放到球面某处再压
  socco.position.set(180, 210, 60);
  for (const t of [0, 0.7, 1.9, 3.3]) {
    updateSoccoSeaSkim(socco, { t, seaRadius: R });
    const h = socco.position.length() - R;
    assert.ok(Math.abs(h - SOCCO.skimHeight) < 0.35,
      `t=${t} 时离海面 ${h.toFixed(3)}，应在 ${SOCCO.skimHeight}±0.35（浮沉幅度）`);
  }
  console.log(`✓ ⑤ 贴海：离海面稳定在 ${SOCCO.skimHeight}±0.35`);
}

// ---------- ⑥ 绳锚 ----------
{
  const anchors = socco.userData.soccoRopeAnchors;
  assert.equal(anchors.length, 2, "尾门口两个绳锚");
  for (const a of anchors) assert.ok(a.position.z < -2.0, `绳锚必须在尾门口，实得 z=${a.position.z}`);
  console.log("✓ ⑥ 绳锚 2 个，都在尾门口");
}

// ---------- ⑦ 确定性 ----------
{
  const sig = (o) => {
    o.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(o);
    return [b.min.toArray(), b.max.toArray()].flat().map((v) => v.toFixed(6)).join(",");
  };
  assert.equal(sig(createSoccoCraft()), sig(createSoccoCraft()), "两次构建包围盒必须逐位一致（禁止 Math.random）");
  console.log("✓ ⑦ 确定性");
}

const tris = (() => {
  let n = 0;
  socco.traverse((o) => {
    if (!o.isMesh || o.userData?.isOutline) return;
    const g = o.geometry;
    n += g?.index ? g.index.count / 3 : (g?.attributes?.position?.count ?? 0) / 3;
  });
  return n;
})();
console.log(`✅ test_socco_craft（${tris} 三角 · 14 座 · 尾门 · 气垫裙 + 气帘 · 2 绳锚）`);
