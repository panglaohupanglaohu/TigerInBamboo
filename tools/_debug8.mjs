import fs from "node:fs";
import { fileURLToPath } from "node:url";
const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), createPattern: () => ({}), fillText() {}, strokeText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {}, save() {}, restore() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, closePath() {}, moveTo() {}, lineTo() {}, translate() {}, rotate() {}, scale() {}, setTransform() {}, globalAlpha: 1, fillStyle: "", strokeStyle: "" }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const VA = await import(new URL("src/world/vanguardAssault.js", BASE).href);
const VT = await import(new URL("src/world/vanguardTrooper.js", BASE).href);
const GH = await import(new URL("src/world/gateHaulerCraft.js", BASE).href);
const SW = await import(new URL("src/world/moebiusSwamp.js", BASE).href);

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log("  ✓", msg); } else { fail++; console.log("  ✗", msg); } };

// =====================================================================
console.log("【1】威胁优先：谁在打机队就瞄准谁（无视更近的红盔）");
{
  const R = 160;
  const scene = new THREE.Scene();
  const squad = VT.createVanguardSquad(); scene.add(squad);
  const haulers = [0, 1, 2].map(() => { const c = GH.createSoccoCraft(); c.visible = false; scene.add(c); return c; });
  const wing = new THREE.Group(); scene.add(wing);
  const pods = [];
  for (let i = 0; i < 3; i++) { const p = new THREE.Group(); wing.add(p); pods.push(p); }
  const hub = new THREE.Vector3(0.3, 0.8, 0.5).normalize();
  // A：近处红盔（不打机队）；B：远处红盔（正在打机队）
  const mkSoldier = (dir) => { const d = new THREE.Group(); d.userData = { uid: 1, phalanxRole: "longbow" }; d.position.copy(dir).multiplyScalar(R + 0.5); scene.add(d); return d; };
  const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hub).normalize();
  const A = mkSoldier(hub.clone().addScaledVector(east, 0.02).normalize());
  const B = mkSoldier(hub.clone().addScaledVector(east, -0.09).normalize());
  const assault = VA.createVanguardAssault({
    scene, squad, R,
    getPods: () => pods, getHaulers: () => haulers,
    getGroundHeightAt: () => ((dir) => R + 0.5),
    getDefenders: () => [A, B].filter((d) => d.parent),
    getTourAnchor: () => hub.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 1.2).normalize(),
    getTourTargets: () => [],
  });
  assault.begin(hub);
  for (let i = 0; i < 9000 && assault.phase() !== "combat"; i++) assault.update(0.1, i * 0.1);
  ok(assault.phase() === "combat", "推进到 combat");
  // B 打了机队（连续登记）
  assault.onFleetUnderAttack(B, hub.clone());
  assault.onFleetUnderAttack(B, hub.clone());
  const threats = assault.threatTargets();
  ok(threats.length === 1 && threats[0] === B, "威胁名单只含 B（登记不受节流吞并）");
  // 落地重甲兵的战斗目标 = B
  let bestTargetUid = null;
  for (let i = 0; i < 400; i++) {
    assault.update(0.05, 100 + i * 0.05);
  }
  const preferPassed = { hit: false };
  // 直接调 updateVanguardCombat 验证 prefer 选 B
  const vanguardRoot = squad;
  vanguardRoot.userData.state = "deployed";
  for (const tr of vanguardRoot.userData.troopers) { tr.visible = true; tr.userData.onGround = true; }
  VT.updateVanguardCombat(vanguardRoot, 0.016, 1, {
    soldiers: [A, B],
    prefer: threats,
    onWound: (s) => { preferPassed.hit = s === B; },
  });
  // 验证瞄准朝向：任一重甲兵的面朝方向更接近 B 而不是 A
  const tr0 = vanguardRoot.userData.troopers.find((t) => t.visible && !t.userData.dead);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(tr0.quaternion);
  const toB = B.position.clone().sub(tr0.position).normalize();
  const toA = A.position.clone().sub(tr0.position).normalize();
  ok(fwd.dot(toB) > fwd.dot(toA), "重甲兵面朝威胁 B 而非更近的 A");
}

// =====================================================================
console.log("【2】光圈弹慢速可见轨迹");
{
  ok(VT.VANGUARD_BOLT.ringSpeed === 30, `ringSpeed=30（${VT.VANGUARD_BOLT.ringSpeed}）`);
  const R = 160;
  const scene = new THREE.Scene();
  const squad = VT.createVanguardSquad(); scene.add(squad);
  squad.userData.state = "deployed";
  const tgt = new THREE.Group(); scene.add(tgt);
  tgt.position.set(0, 0, -100); // 100m 外
  const farTgt = new THREE.Group(); scene.add(farTgt);
  farTgt.position.set(0, 0, -300); // 300m 外：第二发永不触发（>boltRange）
  const tr = squad.userData.troopers[0];
  tr.visible = true; tr.userData.onGround = true;
  tr.userData.boltPhase = "charging"; tr.userData.boltT = 1.54; tr.userData.boltCharge = 1;
  // 逼一帧放电
  let fired = false;
  for (let i = 0; i < 60 && !fired; i++) {
    const r = VT.updateVanguardCombat(squad, 0.016, i * 0.016, { soldiers: [tgt], onWound: () => {} });
    if (r.bolt > 0 || i < 3) console.log("  [dbg] 逼放帧", i, "bolt:", r.bolt, "tr0 phase:", tr.userData.boltPhase, "flight:", (squad.userData._boltRingsInFlight || []).length);
    fired = r.bolt > 0;
  }
  ok(fired, "放电发生");
  const flight = squad.userData._boltRingsInFlight || [];
  ok(flight.length === 1, "光圈弹在飞");
  if (flight.length) {
    const ring0 = flight[0].ring;
    console.log("  [dbg] ring0=", !!ring0, "pos=", ring0?.position.toArray().map((v) => +v.toFixed(1)).join(","), "tgt=", flight[0].target?.position.toArray().map((v) => +v.toFixed(1)).join(","));
    let frames = 0;
    while (frames < 2000) {
      // 目标换成 300m 外：不再开新火，只推进已有光圈飞完
      VT.updateVanguardCombat(squad, 0.033, frames * 0.033, { soldiers: [farTgt], onWound: () => {} });
      frames++;
      // 注意：flight 存的是 entry{ring,...}，判定用 entry.ring 比对 mesh
      if (!flight.some((x) => x.ring === ring0)) break;
    }
    const flightTime = frames * 0.033;
    ok(flightTime > 2.5 && flightTime < 8, `100m 飞行 ${flightTime.toFixed(1)}s（2.5~8s 可见轨迹）`);
  }
}

// =====================================================================
console.log("【3】湖沼生物袭击机队（猴/蜥蜴/鸟）");
{
  const swamp = SW.createMoebiusSwampZone({ seed: 20260804 });
  const scene = new THREE.Scene();
  scene.add(swamp);
  const update = swamp.update;
  ok(typeof update === "function", "swamp update 存在");
  // 找一只猴做距离参照：局部 (20, 45, 0) 附近应有猴/树冠
  const fakeCraft = new THREE.Group();
  scene.add(fakeCraft);
  // 把机队放在湖沼上空局部 (18, 52, 12)（树冠层上方）
  const localAim = new THREE.Vector3(18, 52, 12);
  fakeCraft.position.copy(swamp.localToWorld(localAim.clone()));
  const attackers = [];
  const runtime = {
    fleetObjects: [fakeCraft],
    onFleetAttacked: (who) => attackers.push(who),
  };
  let firedMonkey = 0, firedLizard = 0, firedBird = 0, spikeSeen = false;
  for (let i = 0; i < 60 * 30; i++) { // 模拟 30 秒
    update(1 / 60, i / 60, runtime);
    if (attackers.length) {
      const name = attackers[attackers.length - 1]?.name || "";
      if (name.includes("monkey")) firedMonkey++;
      if (name.includes("lizard")) firedLizard++;
      if (name.includes("bird") || name.includes("Bird")) firedBird++;
    }
    const sp = swamp.children.find?.((c) => c.visible && c.userData?.active && c.userData?.owner);
    if (sp) spikeSeen = true;
  }
  ok(attackers.length > 0, `命中回调触发 ${attackers.length} 次`);
  ok(firedMonkey > 0 || firedLizard > 0 || firedBird > 0, `攻击者类型 猴:${firedMonkey} 蜥蜴:${firedLizard} 鸟:${firedBird}`);
  ok(spikeSeen, "飞刺在飞（可见攻击物）");
  // 无 fleetObjects 时不炸
  update(1 / 60, 0, {});
  ok(true, "无机队清单时安全跳过");
}

console.log(`\n结果：${pass} 通过 · ${fail} 失败`);
process.exit(fail ? 1 : 0);
