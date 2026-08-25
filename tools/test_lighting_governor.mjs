// tools/test_lighting_governor.mjs — V5 光照 K7 自动降级器（TODO 575）单元验收
// 覆盖：抖动输入不抖档、持续超预算降级、恢复需更长稳定窗口、
//       滞回带不动、切档驻留期、结构化原因日志、同输入序列确定性。
// 运行：node tools/test_lighting_governor.mjs
import assert from "node:assert/strict";

const mod = await import(
  new URL("../TigerMessenger/src/render/lighting/qualityGovernor.js", import.meta.url).href
);
const { createQualityGovernor, QUALITY_GOVERNOR_ORDER, QUALITY_GOVERNOR_CODES } = mod;

let assertions = 0;
function eq(a, b, msg) { assertions++; assert.equal(a, b, msg); }
function deepEq(a, b, msg) { assertions++; assert.deepEqual(a, b, msg); }
function okA(cond, msg) { assertions++; assert.ok(cond, msg); }

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

/** 喂 n 帧同一帧时（时间戳用帧时累加，确定性），返回全部切档记录 */
function feed(gov, frameMs, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = gov.sample(frameMs);
    if (t) out.push(t);
  }
  return out;
}

ok("初始档位与非法回落；档位全序 low<medium<high", () => {
  deepEq(QUALITY_GOVERNOR_ORDER, ["low", "medium", "high"]);
  eq(createQualityGovernor({ initialTier: "medium" }).getTier(), "medium");
  eq(createQualityGovernor({ initialTier: "nope" }).getTier(), "high", "非法档位回落 high");
  eq(createQualityGovernor().getTier(), "high", "缺省从 high 起");
  eq(createQualityGovernor({ initialTier: "low" }).getTierSpec().voxelAo, false, "low 档无动态 AO");
});

ok("滞回带内抖动输入不抖档（12.5~16.7ms 之间两边计时清零）", () => {
  // budget 16.7：降级阈值 16.7，恢复阈值 12.525；14/16ms 交替落在滞回带内
  const gov = createQualityGovernor({ initialTier: "medium", minDwellMs: 0 });
  const switches = feed(gov, 14, 300).concat(feed(gov, 16, 300)).concat(feed(gov, 14, 300));
  eq(switches.length, 0, "滞回带内不得切档");
  eq(gov.getTier(), "medium");
  // 超预算与低帧时交替（抖动）：窗口不断被清零，也不得降级
  const gov2 = createQualityGovernor({ initialTier: "medium", minDwellMs: 0 });
  for (let i = 0; i < 600; i++) gov2.sample(i % 2 ? 25 : 8);
  eq(gov2.getTier(), "medium", "超/欠交替的抖动输入不得累积成切档");
});

ok("持续超预算满窗口才降级，且一次只降一档", () => {
  const gov = createQualityGovernor({ initialTier: "high", minDwellMs: 0 });
  // 20ms 连续 119 帧 = 2380ms > 2000ms hold；先验证窗口未满不降
  const govShort = createQualityGovernor({ initialTier: "high", minDwellMs: 0 });
  eq(feed(govShort, 20, 99).length, 0, "1980ms < 2000ms hold，不得降级");
  eq(govShort.getTier(), "high");
  const switches = feed(gov, 20, 119);
  eq(switches.length, 1, "应只切一次");
  eq(switches[0].code, QUALITY_GOVERNOR_CODES.downgrade);
  eq(switches[0].from, "high");
  eq(switches[0].to, "medium");
  eq(gov.getTier(), "medium");
});

ok("切档驻留期 + 窗口重新累计：降级后不能立刻再降", () => {
  const gov = createQualityGovernor({ initialTier: "high" }); // minDwellMs 5000
  const first = feed(gov, 25, 100); // 2500ms > hold → 降到 medium（at=2500）
  eq(first.length, 1);
  // 继续超预算：窗口清零重积 2000ms，但 minDwell 5000 未到 → 不得再降
  const second = feed(gov, 25, 100); // at=2500..5000，dwell 不足
  eq(second.length, 0, "驻留期内不得再次切档");
  eq(gov.getTier(), "medium");
  // 驻留期满 + 窗口重新积满 → 降到 low
  const third = feed(gov, 25, 100); // at=5000..7500：dwell 满 5000 且窗口满 2000
  eq(third.length, 1);
  eq(third[0].to, "low");
});

ok("恢复需更长稳定窗口（8s），且被一帧尖峰打断重计", () => {
  const gov = createQualityGovernor({ initialTier: "low", minDwellMs: 0 });
  // 10ms 连续 79 帧 = 790ms… 需要 8000ms：喂 799 帧 = 7990ms 仍不够
  eq(feed(gov, 10, 799).length, 0, "7990ms < 8000ms，不得升级");
  const up = feed(gov, 10, 2); // 8010ms ≥ 8000ms → 升 medium
  eq(up.length, 1);
  eq(up[0].code, QUALITY_GOVERNOR_CODES.upgrade);
  eq(up[0].to, "medium");
  // 尖峰打断：稳定 7000ms 后一帧 30ms → 窗口清零，再稳定 7000ms 仍不够
  const gov2 = createQualityGovernor({ initialTier: "low", minDwellMs: 0 });
  feed(gov2, 10, 700);
  gov2.sample(30); // 尖峰：over 且打断 under 窗口
  eq(feed(gov2, 10, 700).length, 0, "尖峰后重新累计，7000ms 不得升级");
  eq(feed(gov2, 10, 101).length, 1, "重新积满 8000ms 后才升级");
});

ok("原因日志结构完整：code/from/to/时间戳/窗口统计", () => {
  const gov = createQualityGovernor({ initialTier: "high", minDwellMs: 0 });
  feed(gov, 20, 119);
  const log = gov.getLog();
  eq(log.length, 1);
  const e = log[0];
  eq(e.code, "DOWNGRADE_OVER_BUDGET");
  eq(e.from, "high");
  eq(e.to, "medium");
  okA(Number.isFinite(e.at) && e.at >= 2000, "时间戳应记录切档时刻");
  eq(e.budgetMs, 16.7);
  okA(e.window.samples > 0 && e.window.samples <= 60, "窗口统计样本数受 windowSize 限制");
  okA(Math.abs(e.window.avgMs - 20) < 1e-9, "窗口均值应反映最近帧时");
  eq(e.window.maxMs, 20);
  okA(Object.isFrozen(e), "日志条目应冻结");
});

ok("确定性：同输入序列两次运行，切档序列逐条相等", () => {
  const seq = [];
  // 构造混合序列：超预算段 → 滞回带 → 恢复段 → 尖峰
  for (let i = 0; i < 200; i++) seq.push(22);
  for (let i = 0; i < 200; i++) seq.push(14);
  for (let i = 0; i < 900; i++) seq.push(10);
  seq.push(40);
  for (let i = 0; i < 900; i++) seq.push(10);
  const run = () => {
    const gov = createQualityGovernor({ initialTier: "high", minDwellMs: 0 });
    const out = [];
    for (const ms of seq) {
      const t = gov.sample(ms);
      if (t) out.push(t);
    }
    return { tier: gov.getTier(), log: gov.getLog(), transitions: out };
  };
  deepEq(run(), run(), "纯逻辑同输入必须同输出");
});

console.log(`\n全部通过：${passed} 组`);
console.log(`✅ quality-governor assertions=${assertions}`);
