// =====================================================================
//  P0 · 高山城堡攻防 V2 —— 可复现重放测试
//  固定 4 个回归场景：港口登陆 / 门洞瓶颈（攻城梯口混战）/ 跨台地追击（深夜清场驱赶）/ 深夜木马双组
//  验收：同 seed 连跑 3 次，事件流 digest 逐字节一致；换 seed（攻城场景）digest 必须不同。
//  运行：node tools/test_citadel_combat_replay.mjs
// =====================================================================
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

// DOM 桩（hud.js/sfx.js 等 UI 依赖在 Node 下需要；与 test_phalanx.mjs 同款）
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
  getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
    fillRect() {},
    createRadialGradient: () => ({ addColorStop() {} }),
  }),
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
const { createSaihojiPhalanxBattle } = await import(
  new URL("src/world/saihojiPhalanx.js", BASE).href
);
const { createCitadelNightInfiltration } = await import(
  new URL("src/world/citadelInfiltration.js", BASE).href
);
const { createCombatEventLog } = await import(new URL("src/world/combatEvents.js", BASE).href);

const DT = 1 / 60; // 固定步长：重放的前提

// ---------------------------------------------------------------------
// 攻城剧本驱动：steps 为 [atSec, fn(battle)] 命令表，timeOfDay 可为函数
// ---------------------------------------------------------------------
function runPhalanx({ seed, scenario, seconds, commands = [], timeOfDay = () => 0.5 }) {
  const scene = new THREE.Scene();
  const events = createCombatEventLog({ seed, scenario });
  let currentT = 0;
  const battle = createSaihojiPhalanxBattle({
    scene,
    isWhaleRisen: () => false,
    getSquad: () => null,
    getTram: () => null,
    getTimeOfDay: () => timeOfDay(currentT), // 剧本可让昼夜随仿真时间推进
    seed,
    events,
  });
  const fired = commands.map(() => false);
  let t = 0;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    t += DT;
    commands.forEach((c, k) => {
      if (!fired[k] && t >= c.at) {
        fired[k] = true;
        c.run(battle, t);
      }
    });
    currentT = t;
    battle.update(DT, t);
  }
  return { events, battle, phase: battle.root.userData.phase };
}

const kinds = (events) => {
  const m = new Map();
  for (const e of events.events) m.set(e.kind, (m.get(e.kind) || 0) + 1);
  return m;
};
const phases = (events) =>
  events.events.filter((e) => e.kind === "phase").map((e) => e.data.to);

// 场景 1 · 港口登陆：鼓息发船 → 两船运兵 → 全部下岸成阵
function scenarioHarborLanding(seed) {
  return runPhalanx({ seed, scenario: "harbor-landing", seconds: 75 });
}

// 场景 2 · 门洞瓶颈：鲸回 → 返程 → 攻城（集结/突破/梯口混战，梯口队列即瓶颈）
function scenarioGateBottleneck(seed) {
  return runPhalanx({
    seed,
    scenario: "gate-bottleneck",
    seconds: 240,
    commands: [{ at: 60, run: (b) => b.root.userData.whaleReturned() }],
    timeOfDay: () => 0.5,
  });
}

// 场景 3 · 跨台地追击：攻城入夜 → 深夜清场 → 木马兵驱赶蓝盔残部
function scenarioCrossTerracePursuit(seed) {
  return runPhalanx({
    seed,
    scenario: "cross-terrace-pursuit",
    seconds: 340,
    commands: [{ at: 60, run: (b) => b.root.userData.whaleReturned() }],
    // 白天开打（攻城约 t≈95 开始，至少演 62s 白天），t=200 后拨入深夜触发清场
    timeOfDay: (t) => (t < 200 ? 0.5 : 0.92),
  });
}

// 场景 4 · 深夜木马双组：四绳两批下降 → 双组分路巡查 → 天亮返回马腹
function scenarioTrojanNight(seed) {
  const scene = new THREE.Scene();
  const horse = new THREE.Group();
  horse.name = "trojan-horse-stub";
  horse.userData.setBellyOpen = () => {};
  scene.add(horse);
  const staticSquad = new THREE.Group();
  const events = createCombatEventLog({ seed, scenario: "trojan-night" });
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const inf = createCitadelNightInfiltration({
    scene,
    horse,
    staticSquad,
    siteUp: v(0, 1, 0),
    siteRight: v(1, 0, 0),
    horseGround: v(0, 0, 0),
    waterfallRoute: [v(0, 0.5, 4), v(0, 2, 6), v(0, 4, 7.5), v(0, 6, 8.5)],
    stairRoute: [v(3, 0.4, 4), v(4, 1.2, 6), v(5, 2.4, 8), v(6, 4, 10)],
    stairTransferRoutes: [
      { fromTerrace: 4, toTerrace: 3, points: [v(6, 4.2, 10), v(7, 5.4, 11), v(8, 6.6, 12)] },
      { fromTerrace: 3, toTerrace: 2, points: [v(8, 6.8, 12), v(9, 7.8, 13), v(10, 8.8, 14)] },
    ],
    patrolCastle: null,
    patrolSurfacePoint: null,
    events,
  });
  // 深夜 0.9 演 210 秒（绳降+攀爬+逐台巡查），再天亮 0.5 演 40 秒（全员回腹）
  let t = 0;
  const step = (phase, seconds) => {
    const n = Math.round(seconds / DT);
    for (let i = 0; i < n; i++) {
      t += DT;
      inf.update(DT, t, phase, {});
    }
  };
  step(0.9, 210);
  step(0.5, 40);
  return { events, inf };
}

// ---------------------------------------------------------------------
// 一致性断言：同 seed × 3 跑 digest 相同
// ---------------------------------------------------------------------
function assertReplayable(name, run, { seed = 7, divergesWithSeed = true } = {}) {
  const runs = [run(seed), run(seed), run(seed)];
  const digests = runs.map((r) => r.events.digest());
  const cmdDigests = runs.map((r) => r.events.commandDigest());
  assert.ok(digests[0].length > 0, `${name}: 事件流为空`);
  assert.equal(digests[1], digests[0], `${name}: 第 2 跑事件流不一致`);
  assert.equal(digests[2], digests[0], `${name}: 第 3 跑事件流不一致`);
  assert.equal(cmdDigests[1], cmdDigests[0], `${name}: 第 2 跑命令流不一致`);
  assert.equal(cmdDigests[2], cmdDigests[0], `${name}: 第 3 跑命令流不一致`);
  if (divergesWithSeed) {
    const other = run(seed + 999).events.digest();
    assert.notEqual(other, digests[0], `${name}: 换 seed 后事件流必须不同`);
  }
  return runs[0];
}

console.log("[1/4] 港口登陆（atCastle → sailOut → ashore → fight）");
{
  // 登陆为纯时间轴流程，不消耗 rng：换 seed 不必分歧
  const r = assertReplayable("港口登陆", scenarioHarborLanding, { divergesWithSeed: false });
  const k = kinds(r.events);
  // 主阵两船（index<100）；index≥100 是故事期补给船，≥200 是攻城增援船
  const mainWaves = r.events.events.filter(
    (e) => e.kind === "wave" && e.data.index < 100
  );
  assert.equal(mainWaves.length, 2, "应 spawn 两波运兵船");
  const mainAshore = r.events.events.filter((e) =>
    e.kind === "waveAshore" && /^saihoji-troopship-[01]$/.test(e.data.index)
  );
  assert.equal(mainAshore.length, 2, "两波主阵应全部下岸");
  assert.deepEqual(phases(r.events), ["sailOut", "fight"], "阶段顺序应为 sailOut→fight");
  const soldierCount = r.battle.root.getObjectByName("saihoji-cohort-0")?.children.length;
  assert.equal(soldierCount, 25, "每波 5×5 满编");
  console.log(`    ✓ 事件 ${r.events.events.length} 条，两船 50 人全部登陆成阵`);
}

console.log("[2/4] 门洞瓶颈（返程 → 攻城集结/突破/梯口）");
{
  const r = assertReplayable("门洞瓶颈", scenarioGateBottleneck);
  const k = kinds(r.events);
  const ph = phases(r.events);
  assert.ok(ph.includes("return"), "鲸回应触发返程");
  assert.ok(ph.includes("siege"), "返程完成应进入攻城");
  assert.equal(k.get("ladders"), 1, "攻城梯应架设一次（6 架）");
  console.log(
    `    ✓ 事件 ${r.events.events.length} 条：ladders=${k.get("ladders")} hit=${k.get("hit") || 0} ` +
      `arrow=${k.get("arrow") || 0} redSquad=${k.get("redSquad") || 0} redShip=${k.get("redShip") || 0} ` +
      `blueReinforce=${k.get("blueReinforce") || 0}`
  );
}

console.log("[3/4] 跨台地追击（攻城入夜 → 深夜清场驱赶残部）");
{
  const r = assertReplayable("跨台地追击", scenarioCrossTerracePursuit);
  const ph = phases(r.events);
  assert.ok(ph.includes("siege"), "应进入攻城");
  assert.ok(ph.includes("siegeNight"), "入夜应进入深夜清场");
  console.log(`    ✓ 事件 ${r.events.events.length} 条，阶段链 ${ph.join("→")}`);
}

console.log("[4/4] 深夜木马双组（四绳两批 → 双组巡查 → 天亮回腹）");
{
  const r = assertReplayable("深夜木马双组", scenarioTrojanNight, { divergesWithSeed: false });
  const k = kinds(r.events);
  assert.equal(k.get("nightStart"), 1, "应开启一次夜间行动");
  assert.equal(k.get("landed"), 8, "两组 8 人应全部落地");
  const wf = r.events.events.filter(
    (e) => e.kind === "landed" && e.data.group === "waterfall"
  ).length;
  const st = r.events.events.filter(
    (e) => e.kind === "landed" && e.data.group === "stairs"
  ).length;
  assert.equal(wf, 4, "瀑布组 4 人");
  assert.equal(st, 4, "阶梯组 4 人");
  assert.equal(k.get("returnStart"), 1, "天亮应触发返回");
  assert.equal(k.get("dayReset"), 1, "全员回腹后应收尾");
  console.log(
    `    ✓ 事件 ${r.events.events.length} 条：landed=${k.get("landed")} ` +
      `patrolStage=${k.get("patrolStage") || 0} javelin=${k.get("javelin") || 0}`
  );
}

console.log("\n全部通过：4 场景 × 3 跑事件流一致，攻城场景换 seed 必分歧。");
