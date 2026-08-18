// 气泡艇麻醉弹对莫比斯飞行器：攒满 20 发后像飞鸟坠地，再缓缓升空
// 运行：node tools/test_aircraft_tranq.mjs
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
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

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubEl = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "",
  appendChild() {},
  addEventListener() {},
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
});
globalThis.document = {
  createElement: () => stubEl(),
  createElementNS: () => stubEl(),
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  body: { appendChild() {} },
  addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const {
  applyAircraftTranqHit,
  tickAircraftTranqFall,
  isAircraftKnocked,
  TRANQ_HITS_AIRCRAFT,
  TRANQ_AIRCRAFT_FALL_SPEED,
  TRANQ_AIRCRAFT_RISE_SPEED,
  TRANQ_AIRCRAFT_DOWN_SEC,
} = await import(new URL("src/world/tranquilizer.js", BASE).href);
const { updateAircraftHover, createMoebiusAircraftSquad } = await import(
  new URL("src/assets/moebiusAircraft.js", BASE).href
);

const R = 160;
let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

console.log("[1] 19 发不坠，第 20 发进入坠落");
{
  const ac = new THREE.Group();
  ac.userData.kind = "moebius-aircraft";
  for (let i = 0; i < TRANQ_HITS_AIRCRAFT - 1; i++) {
    const r = applyAircraftTranqHit(ac);
    assert.equal(r.knocked, false, `第 ${i + 1} 发不应击坠`);
    assert.equal(isAircraftKnocked(ac), false);
  }
  assert.equal(ac.userData.tranqHits, 19);
  const last = applyAircraftTranqHit(ac);
  assert.equal(last.knocked, true);
  assert.equal(last.hits, 20);
  assert.equal(ac.userData.tranqFall.phase, "fall");
  assert.equal(isAircraftKnocked(ac), true);
  const extra = applyAircraftTranqHit(ac);
  assert.equal(extra.already, true);
  assert.equal(ac.userData.tranqHits, 20, "坠落中不再叠层");
  ok("19 发仍飞 · 第 20 发坠落 · 追加命中不计");
}

console.log("[2] 坠落速度与飞鸟同档，贴地后缓升");
{
  const ac = new THREE.Group();
  ac.position.set(0, R + 20, 0);
  ac.userData.kind = "moebius-aircraft";
  for (let i = 0; i < TRANQ_HITS_AIRCRAFT; i++) applyAircraftTranqHit(ac);
  const cruiseR = ac.position.length();
  const dt = 0.05;
  tickAircraftTranqFall(ac, dt, R, null);
  const dropped = cruiseR - ac.position.length();
  assert(dropped > 0.8, `一帧应明显下坠，实际 ${dropped.toFixed(2)}`);
  assert(
    Math.abs(dropped - TRANQ_AIRCRAFT_FALL_SPEED * dt) < 0.05,
    `坠速应 ≈ ${TRANQ_AIRCRAFT_FALL_SPEED} u/s`
  );
  for (let i = 0; i < 40; i++) tickAircraftTranqFall(ac, 0.05, R, null);
  assert.equal(ac.userData.tranqFall.phase, "down", "应已贴地");
  assert(Math.abs(ac.position.length() - (R + 0.2)) < 0.15, "贴地半径 ≈ R+0.2");
  for (let i = 0; i < Math.ceil(TRANQ_AIRCRAFT_DOWN_SEC / 0.05) + 1; i++) {
    tickAircraftTranqFall(ac, 0.05, R, null);
  }
  assert.equal(ac.userData.tranqFall.phase, "rise", "贴地后应缓升");
  const slot = new THREE.Vector3(0, R + 20, 0);
  const r0 = ac.position.length();
  tickAircraftTranqFall(ac, 0.2, R, slot);
  const risen = ac.position.length() - r0;
  assert(risen > 0.4, `缓升应离地，实际 ${risen.toFixed(2)}`);
  assert(
    risen < TRANQ_AIRCRAFT_FALL_SPEED * 0.2 * 0.5,
    "升空须明显慢于坠落"
  );
  assert(
    Math.abs(risen - TRANQ_AIRCRAFT_RISE_SPEED * 0.2) < 0.08,
    `升速应 ≈ ${TRANQ_AIRCRAFT_RISE_SPEED} u/s`
  );
  ok("坠速 22 · 贴地 R+0.2 · 升速 3.2");
}

console.log("[3] 编队 update 不得把坠落机瞬间拽回阵位");
{
  const dirA = new THREE.Vector3(0, 1, 0);
  const dirB = new THREE.Vector3(1, 0, 0);
  const squad = createMoebiusAircraftSquad(dirA, R, {
    count: 2,
    height: 20,
    patrol: { dirA, dirB, maxSpeed: 2.6 },
  });
  const member = squad.userData.members[0];
  const cruiseR = member.position.length();
  assert(cruiseR > R + 10, "巡航应在高空");
  for (let i = 0; i < TRANQ_HITS_AIRCRAFT; i++) applyAircraftTranqHit(member);
  for (let i = 0; i < 30; i++) updateAircraftHover(squad, i * 0.05, 0.05);
  assert.equal(isAircraftKnocked(member), true, "update 后仍应处于击坠");
  assert(
    member.position.length() < R + 4,
    `不得被阵位拽回高空，实际 +${(member.position.length() - R).toFixed(1)}`
  );
  const other = squad.userData.members[1];
  assert.equal(isAircraftKnocked(other), false, "未中弹僚机继续飞");
  assert(other.position.length() > R + 10, "僚机仍在巡航高度");
  ok("击坠机贴地 · 僚机继续巡航");
}

console.log("[4] 缓升结束清零，可再次被 20 发击坠");
{
  const ac = new THREE.Group();
  ac.position.set(0, R + 0.2, 0);
  ac.userData.tranqHits = 20;
  ac.userData.tranqFall = { phase: "rise", t: 0 };
  ac.userData.sedated = true;
  ac.userData.sedateT = 10;
  const slot = new THREE.Vector3(0, R + 20, 0);
  for (let i = 0; i < 400; i++) {
    if (!tickAircraftTranqFall(ac, 0.05, R, slot)) break;
  }
  assert.equal(ac.userData.tranqFall, null, "升回阵位后应解除");
  assert.equal(ac.userData.tranqHits, 0, "命中计数清零");
  assert.equal(ac.userData.sedated, false);
  assert(ac.position.distanceTo(slot) < 2.5, "应回到阵位附近");
  const again = applyAircraftTranqHit(ac);
  assert.equal(again.hits, 1);
  assert.equal(again.knocked, false);
  ok("升空复位 · 可再次攒弹");
}

console.log(`\n全部通过 ${pass} 项`);
