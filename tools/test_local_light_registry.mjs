// tools/test_local_light_registry.mjs — V5 光照 K4 局部灯预算单元验收
// 运行：node tools/test_local_light_registry.mjs
import assert from "node:assert/strict";

const registryMod = await import(
  new URL("../TigerMessenger/src/render/lighting/localLightRegistry.js", import.meta.url).href
);
const bridgeMod = await import(
  new URL("../TigerMessenger/src/render/lighting/localLightBridge.js", import.meta.url).href
);
const stateMod = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingState.js", import.meta.url).href
);
const themeMod = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingTheme.js", import.meta.url).href
);
const directorMod = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingDirector.js", import.meta.url).href
);
const THREE = await import(
  new URL("../TigerMessenger/vendor/three.module.js", import.meta.url).href
);

const {
  LOCAL_LIGHT_BUDGETS,
  resolveLocalLightBudget,
  hashLightSeed,
  flickerNoise01,
  torchFlicker,
  TORCH_FLICKER_LIMITS,
  screenInfluence,
  selectLocalLights,
  createLocalLightRegistry,
} = registryMod;
const { createLocalLightBridge } = bridgeMod;
const { composeLightingState } = stateMod;
const { LIGHTING_V5_KEYFRAMES, sampleLightingTheme } = themeMod;
const { createLightingDirector } = directorMod;

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

const CAM = { position: [0, 0, 0], forward: [0, 0, 1] }; // 朝 +Z 看

function torchReq(id, z, priority = 6) {
  return {
    id,
    owner: "night-torch-soldier",
    kind: "torch",
    color: 0xff8a32,
    intensity: 0.75,
    radius: 3.2,
    priority,
    flicker: true,
    affectsSoldiers: true,
    position: [0, 1, z],
    remainingLife: Infinity,
  };
}

ok("注册：字段齐全 + 稳定 lightId（显式幂等 / owner 派生序号）", () => {
  const reg = createLocalLightRegistry();
  const a = reg.register(torchReq("torch-a", 5));
  assert.equal(a.lightId, "torch-a");
  assert.equal(a.owner, "night-torch-soldier");
  assert.equal(a.kind, "torch");
  assert.equal(a.priority, 6);
  assert.equal(a.flicker, true);
  assert.equal(a.affectsSoldiers, true);
  // 显式 id 重复注册 = 更新，不产生第二项
  reg.register({ ...torchReq("torch-a", 5), priority: 7 });
  assert.equal(reg.list().length, 1);
  assert.equal(reg.get("torch-a").priority, 7);
  // 无显式 id：owner#序号 派生
  const d0 = reg.register({ owner: "moebius-tower-dome", intensity: 1 });
  const d1 = reg.register({ owner: "moebius-tower-dome", intensity: 1 });
  assert.equal(d0.lightId, "moebius-tower-dome#0");
  assert.equal(d1.lightId, "moebius-tower-dome#1");
  // 种子稳定
  assert.equal(hashLightSeed("torch-a"), hashLightSeed("torch-a"));
  assert.notEqual(hashLightSeed("torch-a"), hashLightSeed("torch-b"));
});

ok("预算档：desktop 8 / medium 4 / low 2；数字与非法输入解析", () => {
  assert.equal(LOCAL_LIGHT_BUDGETS.desktop, 8);
  assert.equal(LOCAL_LIGHT_BUDGETS.medium, 4);
  assert.equal(LOCAL_LIGHT_BUDGETS.low, 2);
  assert.equal(resolveLocalLightBudget("low"), 2);
  assert.equal(resolveLocalLightBudget(3), 3);
  assert.equal(resolveLocalLightBudget("bogus"), 8);
});

ok("stable sort：同镜头不因数组顺序跳灯（score 降序 + lightId 升序 tie-break）", () => {
  const reqs = [
    torchReq("t-3", 10, 3),
    torchReq("t-1", 10, 3), // 与 t-3 同分（同位置同优先级）→ lightId 升序定胜负
    torchReq("t-2", 3, 3), // 更近 → 分更高
    torchReq("t-4", 40, 6), // 太远 → 低分
  ];
  const selA = selectLocalLights(reqs, CAM, 8).map((r) => r.lightId);
  const shuffled = [reqs[2], reqs[3], reqs[0], reqs[1]];
  const selB = selectLocalLights(shuffled, CAM, 8).map((r) => r.lightId);
  assert.deepEqual(selA, selB, "数组顺序不得改变选择结果");
  assert.deepEqual(selA, ["t-2", "t-1", "t-3", "t-4"], "近者优先；同分 lightId 升序");
  // 同分并列时两次排序完全一致（包括中间截断位置）
  const cut = selectLocalLights(reqs, CAM, 2).map((r) => r.lightId);
  assert.deepEqual(cut, ["t-2", "t-1"], "截断后仍是同一稳定前缀");
});

ok("预算：超预算请求不进 active；inactive 不影响他人", () => {
  const reqs = Array.from({ length: 10 }, (_, i) => torchReq(`torch-${i}`, 4 + i));
  const sel = selectLocalLights(reqs, CAM, LOCAL_LIGHT_BUDGETS.low);
  assert.equal(sel.length, 2, "low 档只激活 2 盏");
  // 最近的两盏入选
  assert.deepEqual(sel.map((r) => r.lightId), ["torch-0", "torch-1"]);
  // 未点亮的灯（intensity=0，如闪电间隙）不参与
  const off = selectLocalLights(
    [{ ...torchReq("off", 1), intensity: 0 }, torchReq("on", 50)],
    CAM,
    2
  );
  assert.deepEqual(off.map((r) => r.lightId), ["on"]);
  // 例外灯（layer-1 全局 rig）只占登记簿，不占预算
  const withExc = selectLocalLights(
    [...reqs.slice(0, 3), { ...torchReq("exc", 0.5), exception: true }],
    CAM,
    2
  );
  assert.ok(!withExc.some((r) => r.lightId === "exc"));
});

ok("屏幕影响：近>远，正前>背后", () => {
  const near = screenInfluence(torchReq("n", 4), CAM);
  const far = screenInfluence(torchReq("f", 40), CAM);
  assert.ok(near > far, `${near} 应大于 ${far}`);
  const behind = screenInfluence(
    { ...torchReq("b", 0, 6), position: [0, 1, -6] },
    CAM
  );
  const front = screenInfluence(torchReq("k", 6), CAM);
  assert.ok(front > behind, "同距离正前方应高于正后方");
});

ok("火炬闪动：固定 tick 噪声同 seed 可重放；亮度/半径/色温有上限", () => {
  for (const tick of [0, 3.7, 12.25, 99.5]) {
    const a = torchFlicker(hashLightSeed("torch-a"), tick);
    const b = torchFlicker(hashLightSeed("torch-a"), tick);
    assert.deepEqual(a, b, `tick=${tick} 同 seed 必须重放一致`);
    assert.ok(a.intensityMul >= TORCH_FLICKER_LIMITS.intensityMin - 1e-9);
    assert.ok(a.intensityMul <= TORCH_FLICKER_LIMITS.intensityMax + 1e-9);
    assert.ok(a.radiusMul >= TORCH_FLICKER_LIMITS.radiusMin - 1e-9);
    assert.ok(a.radiusMul <= TORCH_FLICKER_LIMITS.radiusMax + 1e-9);
    assert.ok(Math.abs(a.warmShift) <= TORCH_FLICKER_LIMITS.warmShiftMax + 1e-9);
  }
  // 全量值域扫描：上限在任意 tick 都成立（防偶发越界）
  for (let i = 0; i < 2000; i++) {
    const f = torchFlicker(12345, i * 0.137);
    assert.ok(f.intensityMul <= TORCH_FLICKER_LIMITS.intensityMax + 1e-9);
    assert.ok(f.intensityMul >= TORCH_FLICKER_LIMITS.intensityMin - 1e-9);
  }
  // 噪声确实随 tick 变化（不是常量）
  const seq = new Set(
    Array.from({ length: 16 }, (_, i) => flickerNoise01(7, i).toFixed(6))
  );
  assert.ok(seq.size > 8, "噪声序列应有多样性");
  // 不同 seed 不同序列
  assert.notEqual(flickerNoise01(1, 5), flickerNoise01(2, 5));
});

ok("生命期：到期回收，选择中消失", () => {
  const reg = createLocalLightRegistry();
  reg.register({ ...torchReq("flashy", 2), lifetimeSec: 0.5 });
  reg.register(torchReq("steady", 2));
  let sel = reg.selectActive(CAM, 8).map((r) => r.lightId);
  assert.deepEqual(sel.sort(), ["flashy", "steady"]);
  const expired = reg.update(0.6);
  assert.equal(expired.length, 1);
  assert.equal(expired[0].lightId, "flashy");
  assert.equal(reg.get("flashy"), null, "过期即从注册表移除");
  sel = reg.selectActive(CAM, 8).map((r) => r.lightId);
  assert.deepEqual(sel, ["steady"]);
});

// ---------- three 桥接（无 GL） ----------
function makeSceneAndRenderer() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2843);
  scene.fog = new THREE.FogExp2(0x1b2843, 0.007);
  const renderer = {
    shadowMap: { enabled: true, type: THREE.BasicShadowMap },
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: THREE.SRGBColorSpace,
  };
  return { scene, renderer };
}

ok("bridge：池灯数量=预算；选择映射到池；超预算火炬无真实灯", () => {
  const { scene } = makeSceneAndRenderer();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, 1);
  camera.updateMatrixWorld(true);
  const reg = createLocalLightRegistry();
  // 5 个真实 PointLight（火炬），预算 2
  const lights = [];
  for (let i = 0; i < 5; i++) {
    const l = new THREE.PointLight(0xff8a32, 0.75, 3.2, 2);
    l.position.set(0, 1, 3 + i * 2);
    scene.add(l);
    lights.push(l);
    reg.register({ ...torchReq(`t${i}`, 0), object: l });
  }
  const bridge = createLocalLightBridge({ scene, camera, registry: reg, budget: 2 });
  assert.equal(bridge.pool.length, 2);
  bridge.setEnabled(true);
  bridge.update(0.016);
  // 原灯全部被静音；池内恰好 2 盏可见，且是最近的两盏
  assert.ok(lights.every((l) => l.visible === false), "接管后原灯静音（emissive/halo 保留）");
  const on = bridge.pool.filter((l) => l.visible);
  assert.equal(on.length, 2);
  assert.equal(bridge.getDebugInfo().activeCount, 2);
  // 池灯不投影（K4：火炬默认不投动态阴影）
  assert.ok(bridge.pool.every((l) => l.castShadow === false));
  // 关闭：原灯可见性恢复，池灯全灭
  bridge.setEnabled(false);
  assert.ok(lights.every((l) => l.visible === true));
  assert.ok(bridge.pool.every((l) => l.visible === false));
});

ok("bridge：池灯按 tick 噪声写强度（同 tick 重放一致）", () => {
  const { scene } = makeSceneAndRenderer();
  const camera = new THREE.PerspectiveCamera();
  camera.lookAt(0, 0, 1);
  const reg = createLocalLightRegistry();
  const l = new THREE.PointLight(0xff8a32, 0.75, 3.2, 2);
  l.position.set(0, 1, 3);
  scene.add(l);
  reg.register({ ...torchReq("t0", 0), object: l, flicker: true });
  const bridge = createLocalLightBridge({ scene, camera, registry: reg, budget: 2 });
  bridge.setEnabled(true);
  // 两次同量 update → 同 tick → 同强度
  const run = () => {
    const r2 = createLocalLightRegistry();
    const l2 = new THREE.PointLight(0xff8a32, 0.75, 3.2, 2);
    l2.position.set(0, 1, 3);
    const s2 = new THREE.Scene();
    s2.add(l2);
    r2.register({ ...torchReq("t0", 0), object: l2, flicker: true });
    const b2 = createLocalLightBridge({ scene: s2, camera, registry: r2, budget: 2 });
    b2.setEnabled(true);
    b2.update(0.016);
    b2.update(0.016);
    return b2.pool[0].intensity;
  };
  bridge.update(0.016);
  bridge.update(0.016);
  assert.ok(Math.abs(bridge.pool[0].intensity - run()) < 1e-9, "同 seed 同 tick 序列强度一致");
  assert.ok(bridge.pool[0].intensity > 0);
});

ok("bridge：宿主祖先隐藏时请求视为熄灭（白天木马腹内不占预算）", () => {
  const { scene } = makeSceneAndRenderer();
  const camera = new THREE.PerspectiveCamera();
  camera.lookAt(0, 0, 1);
  const reg = createLocalLightRegistry();
  const belly = new THREE.Group();
  belly.visible = false; // 木马腹舱：白天隐藏
  scene.add(belly);
  const l = new THREE.PointLight(0xff8a32, 0.75, 3.2, 2);
  l.position.set(0, 1, 3);
  belly.add(l);
  reg.register({ ...torchReq("belly-torch", 0), object: l });
  const bridge = createLocalLightBridge({ scene, camera, registry: reg, budget: 2 });
  bridge.setEnabled(true);
  bridge.update(0.016);
  assert.equal(bridge.getDebugInfo().activeCount, 0, "隐藏组内火炬不得激活");
  assert.ok(bridge.pool.every((p) => !p.visible));
  // 开仓（入夜出兵）→ 当帧恢复参选
  belly.visible = true;
  bridge.update(0.016);
  assert.equal(bridge.getDebugInfo().activeCount, 1);
});

ok("闪电 override：导演合成叠加，平滑恢复回基线（不永久改主题）", () => {
  const { scene, renderer } = makeSceneAndRenderer();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  const box = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial());
  scene.add(box);
  d.setFocus(box);
  // 深夜基线
  for (let i = 0; i < 240; i++) d.update(1 / 60, { timeOfDay: 0.9, weather: 0 });
  const base = d.getState();
  // 闪电一击：参数被叠加抬高
  d.setLightning(1);
  for (let i = 0; i < 30; i++) d.update(1 / 60, { timeOfDay: 0.9, weather: 0 });
  const flashed = d.getState();
  assert.ok(flashed.sunIntensity > base.sunIntensity + 0.5, "闪电应显著抬高 sun");
  assert.ok(flashed.ambientFloor > base.ambientFloor + 0.3, "闪电应抬高 ambientFloor");
  assert.ok(flashed.lightning > 0.5);
  // 连续雷暴结束（setLightning(0)）→ 慢速释放，最终回到基线
  d.setLightning(0);
  for (let i = 0; i < 600; i++) d.update(1 / 60, { timeOfDay: 0.9, weather: 0 });
  const recovered = d.getState();
  assert.ok(Math.abs(recovered.sunIntensity - base.sunIntensity) < 0.01, "sun 回基线");
  assert.ok(Math.abs(recovered.ambientFloor - base.ambientFloor) < 0.005, "ambient 回基线");
  assert.ok(recovered.lightning < 0.01, "override 量归零");
});

ok("雨/雪只改 grade：连续雷雨后晴天回基线，主题表不被改写", () => {
  assert.ok(Object.isFrozen(LIGHTING_V5_KEYFRAMES[0]), "主题关键帧冻结");
  const clearA = composeLightingState({ timeOfDay: 0.5, weather: "clear" });
  composeLightingState({ timeOfDay: 0.5, weather: "rain" });
  composeLightingState({ timeOfDay: 0.5, weather: "snow" });
  const clearB = composeLightingState({ timeOfDay: 0.5, weather: "clear" });
  assert.deepEqual(clearB, clearA, "雨雪后再晴必须逐字段回到基线");
  // 主题采样本身不漂移
  assert.deepEqual(sampleLightingTheme(0.5), sampleLightingTheme(0.5));
  // 深夜档存在弱冷色月光/天空填充（K4 可读性来源，不允许归零）
  // 阈值对齐 K0b 样片校准常量（hemi 0.20 / sun 0.24 / ambientFloor 0.03，
  // 与 oskLightingPrototype 深夜原型同源；test_lighting_v5 已按相等锁定）。
  // 本断言只做"不归零/不腰斩"下界守卫，不重复锁定具体值。
  const night = sampleLightingTheme(0);
  assert.ok(night.hemiIntensity >= 0.15, `深夜天空填充 ${night.hemiIntensity} 不得归零`);
  assert.ok(night.sunIntensity >= 0.2, `深夜月光 ${night.sunIntensity} 不得归零`);
  assert.ok(night.ambientFloor >= 0.02, "深夜 ambientFloor 保底");
});

console.log(`\n全部通过：${passed} 项`);
