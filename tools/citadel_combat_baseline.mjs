// =====================================================================
//  P0 · 高山城堡攻防 V2 —— 基线指标记录
//  记录：单位数量 / 到达率 / 悬空次数 / 寻路耗时 / 战斗帧耗时 / 胜负与总时长
//  输出：tools/out/citadel_combat_baseline.json + 控制台摘要
//  运行：node tools/citadel_combat_baseline.mjs
//  注：桩环境（无真实城堡几何）下「悬空次数/寻路耗时」记 null，
//      这两项的有效基线由 P1 后的 tools/e2e/citadel_combat_v2_e2e.mjs 补录。
// =====================================================================
import fs from "node:fs";
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

// DOM 桩（同 test_citadel_combat_replay.mjs）
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
const { createCombatEventLog } = await import(new URL("src/world/combatEvents.js", BASE).href);

const DT = 1 / 60;
const SEED = 7;

function runBattle({ scenario, seconds, commands = [], timeOfDay = () => 0.5 }) {
  const scene = new THREE.Scene();
  const events = createCombatEventLog({ seed: SEED, scenario });
  let currentT = 0;
  const battle = createSaihojiPhalanxBattle({
    scene,
    isWhaleRisen: () => false,
    getSquad: () => null,
    getTram: () => null,
    getTimeOfDay: () => timeOfDay(currentT),
    seed: SEED,
    events,
  });
  const fired = commands.map(() => false);
  const frameMs = [];
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
    const t0 = performance.now();
    battle.update(DT, t);
    frameMs.push(performance.now() - t0);
  }
  return { events, battle, frameMs, simSeconds: t };
}

function p95(sorted) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

function summarize(name, { events, battle, frameMs, simSeconds }) {
  const ev = events.events;
  const count = (kind) => ev.filter((e) => e.kind === kind).length;
  // 首波运兵船：index<100（index≥100 是故事期补给船，≥200 是攻城增援船）
  const waves = ev.filter((e) => e.kind === "wave" && e.data.index < 100).length;
  const ashore = ev.filter(
    (e) => e.kind === "waveAshore" && /^saihoji-troopship-[01]$/.test(e.data.index)
  ).length;
  const hits = ev.filter((e) => e.kind === "hit");
  const deadRed = hits.filter((e) => e.data.dead && e.data.side === "red").length;
  const deadBlue = hits.filter((e) => e.data.dead && e.data.side === "blue").length;
  const sorted = frameMs.slice().sort((a, b) => a - b);
  const phases = ev.filter((e) => e.kind === "phase").map((e) => e.data.to);
  return {
    scenario: name,
    seed: SEED,
    units: {
      waves,
      soldiersBlue: waves * 25,
      redSquads: count("redSquad"),
      redShips: count("redShip"),
      blueReinforce: count("blueReinforce"),
    },
    arrivalRate: waves ? +(ashore / waves).toFixed(3) : null,
    floatViolations: null, // 桩环境无真实地表：P1 后由 e2e 补录
    pathfindMs: null, // P1 前无寻路系统
    combatFrameMs: {
      avg: +(frameMs.reduce((a, b) => a + b, 0) / Math.max(1, frameMs.length)).toFixed(4),
      p95: +p95(sorted).toFixed(4),
    },
    outcome: {
      finalPhase: battle.root.userData.phase,
      phaseChain: phases.join("→"),
      deadRed,
      deadBlue,
    },
    totalSeconds: +simSeconds.toFixed(2),
    eventCount: ev.length,
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  note: "P0 基线（桩环境）。floatViolations/pathfindMs 待 P1 后由 e2e 补录。",
  scenarios: [],
};

console.log("[baseline] 港口登陆 …");
report.scenarios.push(
  summarize("harbor-landing", runBattle({ scenario: "harbor-landing", seconds: 75 }))
);
console.log("[baseline] 攻城全程（集结/突破/梯口瓶颈）…");
report.scenarios.push(
  summarize(
    "gate-bottleneck",
    runBattle({
      scenario: "gate-bottleneck",
      seconds: 240,
      commands: [{ at: 60, run: (b) => b.root.userData.whaleReturned() }],
    })
  )
);
console.log("[baseline] 深夜清场追击 …");
report.scenarios.push(
  summarize(
    "cross-terrace-pursuit",
    runBattle({
      scenario: "cross-terrace-pursuit",
      seconds: 340,
      commands: [{ at: 60, run: (b) => b.root.userData.whaleReturned() }],
      timeOfDay: (t) => (t < 200 ? 0.5 : 0.92), // 与重放测试同剧本：t=200 拨入深夜
    })
  )
);

const outPath = fileURLToPath(new URL("out/citadel_combat_baseline.json", import.meta.url));
fs.mkdirSync(fileURLToPath(new URL("out/", import.meta.url)), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

for (const s of report.scenarios) {
  console.log(
    `\n== ${s.scenario} ==\n` +
      `  单位: waves=${s.units.waves} 蓝兵=${s.units.soldiersBlue} 红队=${s.units.redSquads} ` +
      `红船=${s.units.redShips} 蓝增援=${s.units.blueReinforce}\n` +
      `  到达率=${s.arrivalRate}  战斗帧 avg=${s.combatFrameMs.avg}ms p95=${s.combatFrameMs.p95}ms\n` +
      `  结局: ${s.outcome.phaseChain} → 终态 ${s.outcome.finalPhase}，红死 ${s.outcome.deadRed} / 蓝死 ${s.outcome.deadBlue}\n` +
      `  总时长 ${s.totalSeconds}s（仿真），事件 ${s.eventCount} 条`
  );
}
console.log(`\n已写入 ${outPath}`);
