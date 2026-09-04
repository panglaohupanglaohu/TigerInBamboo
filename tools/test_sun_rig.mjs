// =====================================================================
// C13-7 · 太阳二维摇杆 + 逐窗错相点亮（PLAN §10.7）
//
// S23 sheet_2 150–165s / sheet_3 190–200s：Townscaper 的太阳是**方位 × 高度**
// 二维摇杆；拖到夜侧后整场变冷蓝，**窗口逐个亮起**——不是全城同一帧啪地一起亮。
//
//   ① sunDirectionFromAngles：单位向量、方位/高度语义正确、可逆
//   ② 摇杆写入后主光方向**在 1 帧内跟随**（方向不进一阶平滑，只有强度进）
//   ③ 关掉摇杆立刻回到按时刻自动跑
//   ④ nightFactor 是连续的夜色浓度，不是布尔；与 dayNight 的昼夜带对齐
//   ⑤ 逐窗错相：一整夜里，窗的点亮时刻差 > 0.3s（按默认 daySpeed 换算成秒）
//   ⑥ 确定性：同一扇窗的阈值/重掷结果可复现（禁止 Math.random）
//
// 运行：node tools/test_sun_rig.mjs
// =====================================================================
import assert from "node:assert/strict";
import {
  sunDirectionFromAngles,
  sunElevationForPhase,
  nightFactor,
  windowLitThreshold,
  windowIsLit,
  rollWindowLit,
  sunRigHash,
  DUSK_PHASE,
  DAWN_PHASE,
  MAX_SUN_ELEVATION,
  WINDOW_STAGGER_BAND,
} from "../TigerMessenger/src/world/sunRig.js";
import { composeLightingState } from "../TigerMessenger/src/render/lighting/lightingState.js";

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ---- ① 方向向量语义
{
  const up = sunDirectionFromAngles(0, 90);
  assert.ok(near(up[1], 1, 1e-9), `高度 90° 应指天顶，实得 ${up}`);
  const east = sunDirectionFromAngles(90, 0);
  assert.ok(near(east[0], 1, 1e-9) && near(east[1], 0), `方位 90°/高度 0° 应指 +X，实得 ${east}`);
  const north = sunDirectionFromAngles(0, 0);
  assert.ok(near(north[2], 1, 1e-9), `方位 0° 应指 +Z，实得 ${north}`);
  const down = sunDirectionFromAngles(210, -35);
  assert.ok(down[1] < 0, "负高度必须在地平线以下（夜侧）");
  for (const [az, el] of [[0, 0], [37, 12], [200, -48], [359, 89]]) {
    const d = sunDirectionFromAngles(az, el);
    assert.ok(near(Math.hypot(d[0], d[1], d[2]), 1, 1e-9), `必须是单位向量：${az}/${el} → ${d}`);
    assert.ok(near(Math.asin(d[1]) * 180 / Math.PI, el, 1e-6), "高度角必须可逆解出");
  }
}

// ---- ② / ③ composeLightingState 接管与放手
{
  const auto = composeLightingState({ timeOfDay: 0.5, weather: "clear" });
  const manual = composeLightingState({
    timeOfDay: 0.5, weather: "clear",
    sunOverride: { azimuth: 270, elevation: -20 },
  });
  const d = manual.sun.direction;
  assert.deepEqual(
    d.map((v) => +v.toFixed(9)),
    sunDirectionFromAngles(270, -20).map((v) => +v.toFixed(9)),
    "摇杆接管时方向必须逐位等于摇杆角度算出的方向"
  );
  assert.notDeepEqual(auto.sun.direction, manual.sun.direction, "接管必须真的改变方向");
  // 同一时刻、只动摇杆 → 方向立刻不同（这就是"1 帧内跟随"：无平滑、无插值状态）
  const a1 = composeLightingState({ timeOfDay: 0.5, sunOverride: { azimuth: 10, elevation: 40 } });
  const a2 = composeLightingState({ timeOfDay: 0.5, sunOverride: { azimuth: 190, elevation: 40 } });
  assert.notDeepEqual(a1.sun.direction, a2.sun.direction, "摇杆一动，下一次合成就必须是新方向");
  // 放手（sunOverride 为 null）→ 回到时刻主题
  const back = composeLightingState({ timeOfDay: 0.5, weather: "clear", sunOverride: null });
  assert.deepEqual(back.sun.direction, auto.sun.direction, "关掉摇杆必须逐位回到按时刻的方向");
  // 强度不受摇杆影响（摇杆只管方向；亮度仍归时刻/天气/trim）
  assert.equal(manual.sun.intensity, auto.sun.intensity, "摇杆不该顺手改亮度");
}

// ---- ④ 高度角曲线与昼夜带对齐 + 夜色浓度连续
{
  assert.ok(near(sunElevationForPhase(DAWN_PHASE), 0, 1e-9), "黎明 0.22 太阳应在地平线");
  assert.ok(near(sunElevationForPhase(DUSK_PHASE), 0, 1e-9), "入夜 0.82 太阳应在地平线");
  assert.ok(near(sunElevationForPhase(0.52), MAX_SUN_ELEVATION, 1e-9), "0.52 应是正午最高");
  assert.ok(sunElevationForPhase(0.02) < -70, "0.02 应是子夜最低");
  for (const t of [0.3, 0.5, 0.7]) assert.ok(sunElevationForPhase(t) > 0, `白天 ${t} 太阳应在地平线之上`);
  for (const t of [0.9, 0.0, 0.1]) assert.ok(sunElevationForPhase(t) < 0, `夜里 ${t} 太阳应在地平线之下`);
  // 连续：0..1 单调爬升，不是阶跃
  assert.equal(nightFactor(30), 0, "大白天不该有夜色");
  assert.equal(nightFactor(-40), 1, "深夜夜色应满");
  let prev = -1;
  const mids = [];
  for (let el = 10; el >= -20; el -= 0.5) {
    const f = nightFactor(el);
    assert.ok(f >= prev - 1e-12, "夜色浓度必须随高度下降单调不减");
    if (f > 0.001 && f < 0.999) mids.push(f);
    prev = f;
  }
  assert.ok(mids.length > 8, `必须是平滑过渡而不是阶跃，实得 ${mids.length} 个中间值`);
}

// ---- ⑤ 逐窗错相 > 0.3s
{
  // 200 扇窗，按默认 daySpeed=0.4 / DAY_LENGTH=90s 推进时刻，记录各自点亮时刻
  const DAY_LENGTH = 90;
  const DAY_SPEED = 0.4;
  const dt = 1 / 60;
  const dPhase = (DAY_SPEED * dt) / DAY_LENGTH;
  // 40 户 × 5 层 = 200 扇互不相同的窗（id 就是真实场景里的 houseId|楼层）
  const ids = [];
  for (let h = 0; h < 40; h++) for (let f = 0; f < 5; f++) ids.push(`house${h}|${f}`);
  const litAt = new Map();
  let t = 0;
  // 从黄昏前扫到完全入夜
  for (let phase = 0.78; phase < 0.90; phase += dPhase, t += dt) {
    const f = nightFactor(sunElevationForPhase(phase));
    for (const id of ids) {
      if (!litAt.has(id) && windowIsLit(f, id)) litAt.set(id, t);
    }
  }
  assert.equal(litAt.size, ids.length, `所有窗都应在这段里亮起，实得 ${litAt.size}/${ids.length}`);
  const times = [...litAt.values()].sort((a, b) => a - b);
  const spread = times[times.length - 1] - times[0];
  assert.ok(spread > 0.3, `逐窗点亮时刻差必须 > 0.3s（不同时亮），实得 ${spread.toFixed(3)}s`);
  // 不能是"两批"：中位数附近也要有窗在亮
  const uniq = new Set(times.map((v) => v.toFixed(2)));
  assert.ok(uniq.size > 10, `点亮时刻应铺开而不是分成几批，实得 ${uniq.size} 个不同时刻`);
  console.log(`  逐窗错相：${ids.length} 扇窗铺开 ${spread.toFixed(2)}s（${uniq.size} 个不同点亮时刻）`);

  // 阈值全部落在声明的区间里
  for (const id of ids) {
    const th = windowLitThreshold(id);
    assert.ok(th >= WINDOW_STAGGER_BAND[0] && th <= WINDOW_STAGGER_BAND[1], `阈值越界：${id} → ${th}`);
  }
}

// ---- ⑥ 确定性
{
  assert.equal(windowLitThreshold("h7|2"), windowLitThreshold("h7|2"), "同一扇窗阈值必须稳定");
  assert.notEqual(windowLitThreshold("h7|2"), windowLitThreshold("h7|3"), "不同窗应有不同阈值");
  assert.equal(rollWindowLit("h7|2", 5, 0.7), rollWindowLit("h7|2", 5, 0.7), "同一晚重掷结果必须可复现");
  // 每晚重掷：同一扇窗在不同夜里结果会变（抽 40 晚，至少出现两种结果）
  const rolls = new Set(Array.from({ length: 40 }, (_, n) => rollWindowLit("h7|2", n, 0.7)));
  assert.equal(rolls.size, 2, "同一扇窗跨夜应该会重掷（有亮有不亮）");
  // 命中率贴近 chance
  let hit = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) if (rollWindowLit(`w${i}`, 3, 0.7)) hit++;
  const rate = hit / N;
  assert.ok(Math.abs(rate - 0.7) < 0.03, `点亮率应贴近 0.7，实得 ${rate.toFixed(3)}`);
  assert.equal(sunRigHash("a", 1), sunRigHash("a", 1), "哈希必须确定");
  console.log(`  确定性：4000 扇窗点亮率 ${rate.toFixed(3)}（目标 0.700）`);
}

console.log("✅ test_sun_rig（摇杆接管方向 1 帧生效 · 放手回落 · 夜色浓度连续 · 逐窗错相 · 确定性）");
