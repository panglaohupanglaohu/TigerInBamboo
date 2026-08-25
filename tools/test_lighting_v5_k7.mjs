// tools/test_lighting_v5_k7.mjs — V5 光照 K7 单元验收
// 覆盖：local light 选择/预算/闪动、天气与闪电恢复、bounce 开关回退、
//       确定性、城堡编辑（局部新建）的体素 AO 更新语义。
// 运行：node tools/test_lighting_v5_k7.mjs
//
// 如实注明的未覆盖项：
// - "storm" 天气：WEATHER_OVERLAYS 只有 clear/rain/snow，雷暴以 K4 lightning
//   override 表达；compose 对未知天气名回落 clear（本文件已断言该回落行为）。
// 2026-08-23 补：context loss 已有生产实现（lightingDirector/voxelAoRenderer 的
// webglcontextlost/restored 处理），覆盖见本文件第 6 节（mock canvas 捕获监听器）。
import assert from "node:assert/strict";

const registryMod = await import(
  new URL("../TigerMessenger/src/render/lighting/localLightRegistry.js", import.meta.url).href
);
const stateMod = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingState.js", import.meta.url).href
);
const bounceMod = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingBounce.js", import.meta.url).href
);
const directorMod = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingDirector.js", import.meta.url).href
);
const voxelMod = await import(
  new URL("../TigerMessenger/src/render/ao/voxelVolume.js", import.meta.url).href
);
const THREE = await import(
  new URL("../TigerMessenger/vendor/three.module.js", import.meta.url).href
);

const {
  resolveLocalLightBudget,
  compareScoreThenId,
  selectLocalLights,
  screenInfluence,
  torchFlicker,
  flickerNoise01,
  TORCH_FLICKER_LIMITS,
} = registryMod;
const { composeLightingState } = stateMod;
const { composeBounceLighting, applyBounceToState, BOUNCE_LIMITS } = bounceMod;
const { createLightingDirector } = directorMod;
const {
  fitVolumeRegion,
  createVoxelVolume,
  rasterizeTriangles,
  computeScalarAo,
  countSolidVoxels,
  hashVolume,
  createDirtyTracker,
} = voxelMod;

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

// =====================================================================
// 1. light selection：预算档 / 稳定排序 / 确定性丢弃 / 屏幕影响 / 火炬闪动
// =====================================================================

ok("resolveLocalLightBudget：档位名/正整数/非法回落", () => {
  eq(resolveLocalLightBudget("desktop"), 8);
  eq(resolveLocalLightBudget("medium"), 4);
  eq(resolveLocalLightBudget("low"), 2);
  eq(resolveLocalLightBudget(6), 6, "正整数直通");
  eq(resolveLocalLightBudget(3.9), 3, "取整");
  eq(resolveLocalLightBudget(100), 32, "封顶 32");
  eq(resolveLocalLightBudget(0), 8, "0 非正数 → desktop");
  eq(resolveLocalLightBudget(-2), 8, "负数 → desktop");
  eq(resolveLocalLightBudget("nope"), 8, "未知档位名 → desktop");
  eq(resolveLocalLightBudget(undefined), 8, "缺省 → desktop");
});

ok("compareScoreThenId：score 降序、lightId 字典序升序 tie-break", () => {
  okA(compareScoreThenId({ score: 2, lightId: "b" }, { score: 1, lightId: "a" }) < 0, "高分在前");
  okA(compareScoreThenId({ score: 1, lightId: "a" }, { score: 2, lightId: "b" }) > 0);
  okA(compareScoreThenId({ score: 1, lightId: "a" }, { score: 1, lightId: "b" }) < 0, "打平按 id 升序");
  okA(compareScoreThenId({ score: 1, lightId: "b" }, { score: 1, lightId: "a" }) > 0);
  eq(compareScoreThenId({ score: 1, lightId: "a" }, { score: 1, lightId: "a" }), 0);
});

ok("selectLocalLights：打平按 id 稳定排序，与输入顺序无关", () => {
  const cam = { position: [0, 0, 0], forward: [0, 0, 1] };
  const mk = (id) => ({ id, priority: 1, intensity: 1, radius: 2, position: [0, 0, 5] });
  const sel = selectLocalLights([mk("t-c"), mk("t-a"), mk("t-b")], cam, 8);
  deepEq(sel.map((r) => r.lightId), ["t-a", "t-b", "t-c"], "同分应按 lightId 升序");
  eq(sel[0].lightId, "t-a", "裸请求用 id 兜底 lightId");
  const sel2 = selectLocalLights([mk("t-b"), mk("t-c"), mk("t-a")], cam, 8);
  deepEq(sel2.map((r) => r.lightId), ["t-a", "t-b", "t-c"], "输入乱序不影响输出");
});

ok("selectLocalLights：超预算确定性丢弃低分项；过滤未点亮/例外/过期", () => {
  const cam = { position: [0, 0, 0], forward: [0, 0, 1] };
  const reqs = [
    { id: "far-low", priority: 1, intensity: 1, radius: 1, position: [0, 0, 100] },
    { id: "near-hi", priority: 3, intensity: 1, radius: 5, position: [0, 0, 3] },
    { id: "near-mid", priority: 2, intensity: 1, radius: 5, position: [0, 0, 4] },
    { id: "mid", priority: 1, intensity: 1, radius: 5, position: [0, 0, 10] },
  ];
  const a = selectLocalLights(reqs, cam, 2).map((r) => r.lightId);
  const b = selectLocalLights([...reqs].reverse(), cam, 2).map((r) => r.lightId);
  deepEq(a, ["near-hi", "near-mid"], "预算 2 应留 score 最高两项");
  deepEq(b, a, "输入顺序不影响丢弃结果");
  // 过滤语义：intensity≤0（未点亮）、exception（全局 rig）、remainingLife≤0（过期）不参与
  const filtered = selectLocalLights([
    { id: "off", priority: 9, intensity: 0, radius: 5, position: [0, 0, 1] },
    { id: "exc", priority: 9, intensity: 1, radius: 5, position: [0, 0, 1], exception: true },
    { id: "dead", priority: 9, intensity: 1, radius: 5, position: [0, 0, 1], remainingLife: 0 },
    { id: "live", priority: 1, intensity: 1, radius: 5, position: [0, 0, 5] },
  ], cam, 8);
  deepEq(filtered.map((r) => r.lightId), ["live"], "未点亮/例外/过期一律不占预算");
});

ok("screenInfluence：屏内近处 > 屏后（25% 底分）> 远处", () => {
  const cam = { position: [0, 0, 0], forward: [0, 0, 1] };
  const front = screenInfluence({ position: [0, 0, 4], radius: 4 }, cam);
  // dist=4, proximity=4/8=0.5, facing=1 → 0.5*(0.25+0.75)=0.5
  okA(Math.abs(front - 0.5) < 1e-9, `屏内正前方应得 ${front}`);
  const behind = screenInfluence({ position: [0, 0, -4], radius: 4 }, cam);
  // facing=0 → 0.5*0.25=0.125（相机背后仍留底分）
  okA(Math.abs(behind - 0.125) < 1e-9, `屏后应保留 25% 底分，得 ${behind}`);
  okA(front > behind, "屏内应高于屏后");
  okA(behind > 0, "屏后不归零");
  const far = screenInfluence({ position: [0, 0, 100], radius: 1 }, cam);
  okA(far < behind, "远处小灯应低于屏后近灯");
  // 无 forward：facing 取中性 0.5
  const noDir = screenInfluence({ position: [0, 0, 4], radius: 4 }, { position: [0, 0, 0] });
  okA(Math.abs(noDir - 0.5 * 0.625) < 1e-9, `无视线方向取中性分，得 ${noDir}`);
});

ok("torchFlicker：同 seed+tick 输出一致，振幅在 TORCH_FLICKER_LIMITS 内", () => {
  deepEq(torchFlicker(42, 7.3), torchFlicker(42, 7.3), "同 seed+tick 必须可重放");
  const L = TORCH_FLICKER_LIMITS;
  let minI = Infinity, maxI = -Infinity, minR = Infinity, maxR = -Infinity, maxW = 0;
  const seen = new Set();
  for (let seed = 0; seed < 24; seed++) {
    for (let t = 0; t < 40; t += 0.37) {
      const f = torchFlicker(seed * 2654435761, t);
      minI = Math.min(minI, f.intensityMul); maxI = Math.max(maxI, f.intensityMul);
      minR = Math.min(minR, f.radiusMul); maxR = Math.max(maxR, f.radiusMul);
      maxW = Math.max(maxW, Math.abs(f.warmShift));
      seen.add(f.intensityMul);
    }
  }
  okA(minI >= L.intensityMin && maxI <= L.intensityMax,
    `亮度倍率越界 [${minI}, ${maxI}]`);
  okA(minR >= L.radiusMin && maxR <= L.radiusMax,
    `半径倍率越界 [${minR}, ${maxR}]`);
  okA(maxW <= L.warmShiftMax + 1e-12, `色温偏移越界 ${maxW}`);
  okA(seen.size > 100, "闪动应真实变化而非常量");
});

// =====================================================================
// 2. 天气/闪电恢复
// =====================================================================

ok("compose：storm/rain 切回 clear 后各字段与纯 clear 完全一致", () => {
  const base = composeLightingState({ timeOfDay: 0.37, weather: "clear" });
  // 先经历雨、雪（生产上雷暴 = rain + lightning override，无独立 storm 天气）
  composeLightingState({ timeOfDay: 0.37, weather: "rain" });
  composeLightingState({ timeOfDay: 0.37, weather: "snow" });
  const back = composeLightingState({ timeOfDay: 0.37, weather: "clear" });
  deepEq(back, base, "切回 clear 不得残留染色/雾密度/强度");
  eq(back.fog.density, 0.007, "雾密度回到晴天基线");
  eq(back.background, base.background, "背景无残留 tint");
  // 未知天气名（如 "storm"）按 clear 处理，不抛错不残留
  deepEq(
    composeLightingState({ timeOfDay: 0.37, weather: "storm" }),
    base,
    "未知天气应回落 clear overlay"
  );
});

// ---------- director（three 桥接，无 GL；mock 风格同 test_lighting_v5.mjs） ----------
function makeScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xebb9b6);
  scene.fog = new THREE.FogExp2(0xebb9b6, 0.007);
  const renderer = {
    shadowMap: { enabled: true, type: THREE.BasicShadowMap },
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: THREE.SRGBColorSpace,
  };
  return { scene, renderer };
}

ok("director 闪电：setLightning(1) 快速上升（tau=0.06）", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  eq(d.getState().lightning, 0, "初始无闪电叠加");
  const baseSun = d.getState().sunIntensity;
  d.setLightning(1);
  let prev = 0;
  d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  const first = d.getState().lightning;
  okA(first > 0.2, `首帧应快速爬升（tau=0.06），得 ${first}`);
  prev = first;
  for (let i = 0; i < 9; i++) {
    d.update(0.016, { timeOfDay: 0.5, weather: 0 });
    const cur = d.getState().lightning;
    okA(cur > prev, "上升段应严格单调");
    prev = cur;
  }
  okA(prev > 0.9, `10 帧后应逼近 1，得 ${prev}`);
  okA(d.getState().sunIntensity > baseSun + 0.2, "闪电 override 应叠加到太阳强度输出");
});

ok("director 闪电：setLightning(0) 按 tau=1.1 衰减回 0 附近", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  d.setLightning(1);
  for (let i = 0; i < 10; i++) d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  okA(d.getState().lightning > 0.9, "前置：闪电已拉高");
  d.setLightning(0);
  let prev = d.getState().lightning;
  let frames = 0;
  for (; frames < 1000; frames++) {
    d.update(0.016, { timeOfDay: 0.5, weather: 0 });
    const cur = d.getState().lightning;
    okA(cur < prev, "衰减段应严格单调下降");
    prev = cur;
    if (cur < 0.01) break;
  }
  okA(prev < 0.01, `最终应回到 0 附近，得 ${prev}`);
  // tau=1.1 慢释放：不应在几帧内就掉没
  okA(frames > 60, `慢衰减应需百帧量级，实际 ${frames} 帧`);
});

ok("director 闪电：setEnabled(false) 清零残留，重开不带爆闪", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  d.setLightning(1);
  for (let i = 0; i < 10; i++) d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  okA(d.getState().lightning > 0.9, "前置：闪电已拉高");
  // lightingDirector.js:276-277：关闭即清 lightningTarget/lightningSmooth
  d.setEnabled(false);
  eq(d.getState().lightning, 0, "禁用时 lightningSmooth 必须清零");
  d.setEnabled(true);
  for (let i = 0; i < 5; i++) d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  eq(d.getState().lightning, 0, "重新 enable 不得带残留闪电");
  eq(d.getState().sunIntensity, 1.35, "输出应回到正午基线（无残留叠加）");
});

// =====================================================================
// 3. bounce 开关回退
// =====================================================================

ok("bounce：默认 disabled 且 intensity=0；超上限钳制到 BOUNCE_LIMITS", () => {
  deepEq(composeBounceLighting(), { enabled: false, intensity: 0, mix: 0, tint: "#FFFFFF" });
  const clamped = composeBounceLighting({ enabled: true, intensity: 99, mix: 99 });
  eq(clamped.intensity, BOUNCE_LIMITS.maxIntensity, "intensity 钳到 0.18");
  eq(clamped.mix, BOUNCE_LIMITS.maxMix, "mix 钳到 0.35");
  eq(composeBounceLighting({ enabled: true, intensity: -5, mix: -1 }).intensity, 0, "负数钳到 0");
  const off = composeBounceLighting({ enabled: false, intensity: 0.5, mix: 0.3 });
  eq(off.intensity, 0, "disabled 时 intensity 强制 0");
  eq(off.mix, 0, "disabled 时 mix 强制 0");
  eq(composeBounceLighting({ enabled: true, intensity: 0.1, tint: "#aabbcc" }).tint, "#AABBCC",
    "tint 归一化为大写");
});

ok("applyBounceToState：disabled 不改变 state 的 direct/shadow/sky 等字段", () => {
  const st = composeLightingState({ timeOfDay: 0.5, weather: "clear" });
  const out = applyBounceToState(st, { enabled: false, intensity: 0.5, mix: 0.3 });
  eq(out.bounce.enabled, false);
  eq(out.bounce.intensity, 0);
  // direct（sun）/ sky / 雾 / 背景 / ambient 字段逐一原样保留（引用相等）
  eq(out.sun, st.sun, "sun（direct/shadow 载体）不得被改动");
  eq(out.sky, st.sky, "sky 不得被改动");
  eq(out.fog, st.fog, "fog 不得被改动");
  eq(out.background, st.background, "background 不得被改动");
  eq(out.ambientFloor, st.ambientFloor, "ambientFloor 不得被改动");
  // enabled 时同样只换 bounce 字段
  const on = applyBounceToState(st, { enabled: true, intensity: 0.1 });
  eq(on.bounce.enabled, true);
  eq(on.sun, st.sun, "enabled 时也不应触碰 sun");
  eq(on.sky, st.sky, "enabled 时也不应触碰 sky");
});

// =====================================================================
// 4. 确定性
// =====================================================================

ok("确定性：同一 snapshot 两次 composeLightingState 深度相等", () => {
  const snap = {
    timeOfDay: 0.63,
    weather: "rain",
    trims: { sunMul: 0.8, ambientMul: 1.2 },
    moebius: 0.4,
    bounce: { enabled: true, intensity: 0.1 },
  };
  deepEq(composeLightingState(snap), composeLightingState(snap), "纯函数同输入必须同输出");
});

ok("确定性：同一组 requests 两次 selectLocalLights 顺序一致", () => {
  const cam = { position: [3, 1, -2], forward: [0, 1, 0].map(() => 0) }; // forward 占位，下面用真的
  cam.forward = [0.6, 0, 0.8];
  const reqs = Array.from({ length: 12 }, (_, i) => ({
    id: `L${i}`,
    priority: (i % 3) + 1,
    intensity: 1,
    radius: 2 + (i % 4),
    position: [i * 2 - 10, (i % 5) - 2, i * 3 - 15],
  }));
  const a = selectLocalLights(reqs, cam, 6).map((r) => r.lightId);
  const b = selectLocalLights(reqs.map((r) => ({ ...r })), cam, 6).map((r) => r.lightId);
  deepEq(a, b, "同内容请求两次选择顺序必须一致");
  eq(a.length, 6, "应按预算截断");
});

ok("确定性：flickerNoise01 固定序列（硬编码回归）", () => {
  const seq = Array.from({ length: 8 }, (_, i) => flickerNoise01(12345, i * 0.5));
  deepEq(seq, [
    0.40688223228789866,
    0.544457224663347,
    0.6820322170387954,
    0.8246442495146766,
    0.9672562819905579,
    0.581758312182501,
    0.196260342374444,
    0.590733116841875,
  ], "seed=12345 的固定序列不得漂移");
  for (const v of seq) okA(v >= 0 && v < 1, "值域 [0,1)");
  // smoothstep 插值在晶格边界连续：t→k⁻ 极限 == t=k
  okA(Math.abs(flickerNoise01(777, 3) - flickerNoise01(777, 3 - 1e-9)) < 1e-6,
    "晶格边界应连续");
});

// =====================================================================
// 5. 城堡编辑 AO 更新语义：空场景 → 局部新建一栋楼 → 局部重算
// =====================================================================

// 盒体六个面（12 三角形）→ 世界坐标数组；半尺寸 (hx,hy,hz)、中心 (cx,cy,cz)
function boxTriangles(cx, cy, cz, hx, hy, hz) {
  const x0 = cx - hx, x1 = cx + hx;
  const y0 = cy - hy, y1 = cy + hy;
  const z0 = cz - hz, z1 = cz + hz;
  const v = (x, y, z) => [x, y, z];
  const quads = [
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0)],
    [v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)],
    [v(x0, y0, z0), v(x1, y0, z0), v(x1, y0, z1), v(x0, y0, z1)],
    [v(x0, y1, z0), v(x1, y1, z0), v(x1, y1, z1), v(x0, y1, z1)],
    [v(x0, y0, z0), v(x0, y1, z0), v(x0, y1, z1), v(x0, y0, z1)],
    [v(x1, y0, z0), v(x1, y1, z0), v(x1, y1, z1), v(x1, y0, z1)],
  ];
  const out = [];
  for (const q of quads) {
    out.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  }
  return new Float32Array(out);
}

ok("城堡编辑：局部新建楼体 → dirty 局部重算，近处变暗、远处不变", () => {
  // 一栋楼：x,z∈[-2,2]、y∈[0,6]
  const buildingMin = [-2, 0, -2];
  const buildingMax = [2, 6, 2];
  const fit = fitVolumeRegion(buildingMin, buildingMax, { voxelSize: 0.5 });
  const vol = createVoxelVolume(fit);

  // 1) 空场景：栅格化零三角形 + 全量 AO + hash
  rasterizeTriangles(vol, new Float32Array(0));
  computeScalarAo(vol, { radius: 4 });
  const hashEmpty = hashVolume(vol);
  okA(vol.ao.every((v) => v === 0), "空场景 AO 应全开敞（全 0）");

  // 2) 编辑器局部新建楼体：dirty tracker 标记该区域。
  // 注意标脏包围盒要外扩 1 体素：rasterizeTriangles 的候选 lo 用 ceil-1，
  // 实心体素可比 worldBoxToVoxelRange 的下界外溢 1 体素，不扩会漏算邻域 AO。
  const pad = fit.voxelSize;
  const tracker = createDirtyTracker({ expand: 4 }); // expand = AO kernel 半径
  eq(
    tracker.markWorldRange(
      vol,
      buildingMin.map((v) => v - pad),
      buildingMax.map((v) => v + pad)
    ),
    true,
    "楼体区域应成功标脏"
  );
  const region = tracker.consume();
  okA(region, "应取出 dirty 区域");
  okA(tracker.isEmpty(), "consume 后清空");
  const zRange = [region.min[2], region.max[2]];

  // 3) 局部重栅格（append：空场景增量加楼）+ 局部 AO 重算
  rasterizeTriangles(vol, boxTriangles(0, 3, 0, 2, 3, 2), { zRange, append: true });
  computeScalarAo(vol, { radius: 4, zRange });
  countSolidVoxels(vol);
  okA(vol.solidVoxels > 0, "楼体表面应被栅格化为实心");
  okA(hashVolume(vol) !== hashEmpty, "新建楼体后 hash 必须变化");

  // 4) 楼体附近 AO 变暗（遮蔽值变大）
  const aoAt = (wx, wy, wz) => {
    const [x, y, z] = vol.worldToVoxel(wx, wy, wz);
    return vol.ao[vol.index(x, y, z)];
  };
  const nearWall = aoAt(2.25, 3, 0); // 紧贴墙面外侧一体素
  okA(nearWall > 0, `楼体附近体素应被遮蔽（ao=${nearWall}）`);

  // 5) 远处体素 AO 不变（仍为 0；体积 padding ≥8 体素 > kernel 半径 4）
  const farIdx = vol.index(0, 0, 0);
  eq(vol.ao[farIdx], 0, "远处体素 AO 不得被局部新建影响");
  const farCorner = aoAt(fit.origin[0] + 0.25, fit.origin[1] + 0.25, fit.origin[2] + 0.25);
  eq(farCorner, 0, "体积角落应无遮蔽");

  // 6) 局部重算结果 == 全量重算结果（局部更新语义正确性强断言）
  const ref = createVoxelVolume(fit);
  rasterizeTriangles(ref, boxTriangles(0, 3, 0, 2, 3, 2));
  computeScalarAo(ref, { radius: 4 });
  eq(hashVolume(vol), hashVolume(ref),
    "dirty 局部重算必须与全量重建逐体素一致");
});

// =====================================================================
// 6. context loss（webglcontextlost/restored，TODO 577）
//    mock canvas：捕获 addEventListener 注册的监听器并手动派发
// =====================================================================

const voxelAoRendererMod = await import(
  new URL("../TigerMessenger/src/render/ao/voxelAoRenderer.js", import.meta.url).href
);
const { createVoxelAoSystem } = voxelAoRendererMod;

function makeCanvasMock() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const l = listeners.get(type) || [];
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    },
    dispatch(type) {
      for (const fn of listeners.get(type) || []) fn({ type });
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    },
  };
}

/** 捕获 console.warn（结构化断言用），返回 { warns, restore } */
function captureWarn() {
  const warns = [];
  const orig = console.warn;
  console.warn = (...args) => warns.push(args);
  return { warns, restore: () => { console.warn = orig; } };
}

ok("director context loss：lost 挂起更新 + 只报一次结构化 warn；restored 强制全量 refit", () => {
  const { warns, restore } = captureWarn();
  try {
    const canvas = makeCanvasMock();
    const { scene, renderer } = makeScene();
    renderer.domElement = canvas;
    const d = createLightingDirector({ scene, renderer, legacy: {} });
    eq(canvas.listenerCount("webglcontextlost"), 1, "应注册 lost 监听");
    eq(canvas.listenerCount("webglcontextrestored"), 1, "应注册 restored 监听");
    d.setEnabled(true);
    const box = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial());
    scene.add(box);
    d.setFocus(box);
    d.update(1, { timeOfDay: 0.5, weather: 0 });
    const fitBefore = d.getState().fit;
    okA(fitBefore, "前置：已有 shadow fit");
    const sunBefore = d.getState().sunIntensity;

    canvas.dispatch("webglcontextlost");
    eq(d.isContextLost(), true);
    eq(d.getState().contextLost, true, "getState 应透出 contextLost");
    d.update(1, { timeOfDay: 0.75, weather: 2 }); // lost 期间 no-op
    eq(d.getState().sunIntensity, sunBefore, "lost 期间光照输出不得变化");
    eq(d.getState().fit, fitBefore, "lost 期间不得 refit");
    canvas.dispatch("webglcontextlost"); // 重复事件
    eq(warns.length, 1, "结构化 warn 只报一次");
    eq(warns[0][1].code, "V5_CONTEXT_LOST");
    eq(warns[0][1].scope, "lightingDirector");

    canvas.dispatch("webglcontextrestored");
    eq(d.isContextLost(), false);
    eq(d.isContextRebuildPending(), true, "restored 应标记完整重建");
    d.update(0.016, { timeOfDay: 0.5, weather: 0 });
    eq(d.isContextRebuildPending(), false, "重建标记消费后清零");
    const fitAfter = d.getState().fit;
    okA(fitAfter && fitAfter !== fitBefore, "restored 后应强制 shadow 全量 refit");
    eq(fitAfter.reason, "init", "全量重建走 init refit");
    eq(warns.length, 1, "restored 不得额外 warn");
  } finally {
    restore();
  }
});

ok("voxelAo context loss：lost 回退无 AO 直照并挂起；restored 全量 dirty 重建", () => {
  const { warns, restore } = captureWarn();
  try {
    const canvas = makeCanvasMock();
    const scene = new THREE.Scene();
    const renderer = { domElement: canvas }; // uploadRange 走 getContext?.() 兜底
    const region = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial());
    scene.add(region);
    const ao = createVoxelAoSystem({ scene, renderer, regionObjects: [region] });
    okA(ao, "应创建 AO 系统");
    eq(canvas.listenerCount("webglcontextlost"), 1);
    eq(canvas.listenerCount("webglcontextrestored"), 1);
    let guard = 0;
    while (ao.getDebugInfo().builds === 0 && guard++ < 2000) ao.update(0.016);
    eq(ao.getDebugInfo().builds, 1, "前置：首版全量构建完成");
    eq(ao.uniforms.uVoxelAoEnabled.value, 1);

    canvas.dispatch("webglcontextlost");
    eq(ao.isContextLost(), true);
    eq(ao.getDebugInfo().contextLost, true, "getDebugInfo 应透出 contextLost");
    eq(ao.uniforms.uVoxelAoEnabled.value, 0, "lost 应回退无 AO 直照");
    const buildsAtLost = ao.getDebugInfo().builds + ao.getDebugInfo().dirtyBuilds;
    ao.update(0.016);
    eq(ao.getDebugInfo().builds + ao.getDebugInfo().dirtyBuilds, buildsAtLost,
      "lost 期间 update 挂起，不得推进构建");
    canvas.dispatch("webglcontextlost"); // 重复事件
    eq(warns.length, 1, "结构化 warn 只报一次");
    eq(warns[0][1].code, "VOXEL_AO_CONTEXT_LOST");
    eq(warns[0][1].scope, "voxelAoRenderer");

    canvas.dispatch("webglcontextrestored");
    eq(ao.isContextLost(), false);
    eq(ao.uniforms.uVoxelAoEnabled.value, 1, "restored 应恢复 AO");
    okA(ao.getDebugInfo().pending, "restored 应标记 AO 全量 dirty");
    guard = 0;
    while (ao.getDebugInfo().dirtyBuilds === 0 && guard++ < 2000) ao.update(0.016);
    eq(ao.getDebugInfo().dirtyBuilds, 1, "restored 后应完成全量重建");
    ao.dispose();
  } finally {
    restore();
  }
});

ok("director K7 面板钩子：freeze 冻结输出；debug view mode 白名单 + FEATURES 风格状态", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  d.update(1, { timeOfDay: 0.5, weather: 0 });
  const noon = d.getState().sunIntensity;
  eq(d.setFrozen(true), true);
  eq(d.getState().frozen, true);
  d.update(1, { timeOfDay: 0.0, weather: 2 }); // 冻结期间 no-op
  eq(d.getState().sunIntensity, noon, "冻结时光照输出不得变化");
  d.setFrozen(false);
  d.update(1, { timeOfDay: 0.0, weather: 2 });
  okA(d.getState().sunIntensity !== noon, "解冻后应恢复随时刻/天气更新");

  eq(d.setDebugViewMode("ao"), "ao");
  eq(d.getDebugViewMode(), "ao");
  eq(d.getState().debugViewMode, "ao", "getState 应透出调试视图模式");
  eq(d.setDebugViewMode("nope"), "final", "非法模式回落 final");
  eq(d.setDebugViewMode("active-lights"), "active-lights");
  d.setDebugViewMode("final");
});

console.log(`\n全部通过：${passed} 组`);
console.log(`✅ V5-K7 assertions=${assertions}`);