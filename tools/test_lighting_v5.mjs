// tools/test_lighting_v5.mjs — V5 光照 K0b/K0/K1 单元验收
// 运行：node tools/test_lighting_v5.mjs
import assert from "node:assert/strict";

const theme = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingTheme.js", import.meta.url).href
);
const stateMod = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingState.js", import.meta.url).href
);
const directorMod = await import(
  new URL("../TigerMessenger/src/render/lighting/lightingDirector.js", import.meta.url).href
);
const THREE = await import(
  new URL("../TigerMessenger/vendor/three.module.js", import.meta.url).href
);

const { LIGHTING_V5_KEYFRAMES, sampleLightingTheme } = theme;
const { composeLightingState, lightingWeatherName } = stateMod;
const { createLightingDirector } = directorMod;

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log(`✓ ${name}`);
}

ok("主题表：5 关键时刻 + 样片初值（正午/日落/深夜）", () => {
  assert.deepEqual(
    LIGHTING_V5_KEYFRAMES.map((k) => k.name),
    ["night", "predawn", "dawn", "noon", "sunset", "night"]
  );
  const noon = LIGHTING_V5_KEYFRAMES.find((k) => k.t === 0.5);
  assert.equal(noon.ambientFloor, 0.2);
  assert.equal(noon.hemiIntensity, 0.82);
  assert.equal(noon.sunIntensity, 1.35);
  assert.deepEqual(noon.sunDir, [0.6, 0.72, 0.35]);
  const sunset = LIGHTING_V5_KEYFRAMES.find((k) => k.t === 0.75);
  assert.equal(sunset.ambientFloor, 0.18);
  assert.deepEqual(sunset.sunDir, [-0.2, 0.38, 0.9]);
  const night = LIGHTING_V5_KEYFRAMES[0];
  assert.equal(night.ambientFloor, 0.03);
  assert.equal(night.hemiIntensity, 0.2);
  assert.equal(night.sunIntensity, 0.24);
  assert.equal(night.background, "#070A12");
  assert.deepEqual(night.sunDir, [-0.25, 0.65, 0.7]);
});

ok("主题采样：关键点命中、中点插值、跨午夜回绕、方向归一", () => {
  const noon = sampleLightingTheme(0.5);
  assert.equal(noon.sunColor, "#FFE2B9");
  assert.equal(noon.sunIntensity, 1.35);
  const mid = sampleLightingTheme(0.625); // 正午↔日落中点
  assert.ok(mid.sunIntensity > 1.35 && mid.sunIntensity < 1.5);
  const wrap = sampleLightingTheme(0.95); // 入夜→午夜
  assert.ok(wrap.sunColor.startsWith("#"));
  for (const t of [0, 0.13, 0.28, 0.5, 0.77, 0.999]) {
    const d = sampleLightingTheme(t).sunDir;
    assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-6, `t=${t} 方向未归一`);
  }
});

ok("compose：晴天正午 = 主题值；雨降太阳、加密雾；雪加 ambient", () => {
  const noon = composeLightingState({ timeOfDay: 0.5, weather: "clear" });
  assert.equal(noon.sun.intensity, 1.35);
  assert.equal(noon.ambientFloor, 0.2);
  assert.equal(noon.exposure, 1);
  const rain = composeLightingState({ timeOfDay: 0.5, weather: "rain" });
  assert.ok(Math.abs(rain.sun.intensity - 1.35 * 0.55) < 1e-9);
  assert.ok(rain.fog.density > noon.fog.density);
  const snow = composeLightingState({ timeOfDay: 0.5, weather: "snow" });
  assert.ok(snow.ambientFloor > noon.ambientFloor);
  assert.equal(lightingWeatherName(0), "clear");
  assert.equal(lightingWeatherName(1), "rain");
  assert.equal(lightingWeatherName(2), "snow");
});

ok("compose：trims 与莫比斯染色生效", () => {
  const trimmed = composeLightingState({ timeOfDay: 0.5, weather: "clear", trims: { sunMul: 0.5, ambientMul: 2 } });
  assert.ok(Math.abs(trimmed.sun.intensity - 0.675) < 1e-9);
  assert.ok(Math.abs(trimmed.ambientFloor - 0.4) < 1e-9);
  const moe = composeLightingState({ timeOfDay: 0.5, weather: "clear", moebius: 1 });
  assert.equal(moe.background, "#EBB9B6"); // 全染色 = 莫比斯粉紫
});

// ---------- LightingDirector（three 桥接，无 GL） ----------
function makeScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xebb9b6);
  scene.fog = new THREE.FogExp2(0xebb9b6, 0.007);
  const legacyAmbient = new THREE.AmbientLight(0xffffff, 1.4);
  const legacySun = new THREE.DirectionalLight(0xffffff, 1.6);
  legacySun.position.set(20, 28, 16);
  scene.add(legacyAmbient, legacySun);
  const renderer = {
    shadowMap: { enabled: true, type: THREE.BasicShadowMap },
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: THREE.SRGBColorSpace,
  };
  return { scene, renderer, legacyAmbient, legacySun };
}

ok("director：开关切换不创建第二套全局灯，关闭完整恢复", () => {
  const { scene, renderer, legacyAmbient, legacySun } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: { ambient: legacyAmbient, sun: legacySun } });
  const countLights = () => {
    let n = 0;
    scene.traverse((o) => {
      if (!o.isLight) return;
      let p = o;
      let visible = true;
      while (p) {
        if (p.visible === false) {
          visible = false;
          break;
        }
        p = p.parent;
      }
      if (visible) n++;
    });
    return n;
  };
  assert.equal(countLights(), 2); // 旧两灯
  d.setEnabled(true);
  assert.equal(countLights(), 3); // V5 rig 三灯，旧灯隐藏
  assert.equal(legacySun.visible, false);
  d.setEnabled(false);
  assert.equal(countLights(), 2);
  assert.equal(legacySun.visible, true);
  assert.equal(renderer.toneMappingExposure, 1);
  assert.equal(scene.background.getHex(), 0xebb9b6, "背景恢复原值");
  assert.equal(scene.fog.density, 0.007, "雾密度恢复原值");
});

ok("director：太阳方向只来自时刻主题，与相机无关（环视回归）", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  const box = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial());
  scene.add(box);
  d.setFocus(box);
  d.update(1, { timeOfDay: 0.5, weather: 0 });
  const dir1 = d.getState().sunDirection;
  // 模拟环视 90°/180°：相机根本不进入合成路径
  const cam = new THREE.PerspectiveCamera();
  cam.rotation.y = Math.PI / 2;
  d.update(1, { timeOfDay: 0.5, weather: 0 });
  cam.rotation.y = Math.PI;
  d.update(1, { timeOfDay: 0.5, weather: 0 });
  const dir2 = d.getState().sunDirection;
  assert.deepEqual(dir1, dir2);
  // 与主题正午方向一致
  const noonDir = [0.6, 0.72, 0.35];
  const len = Math.hypot(...noonDir);
  const expect = noonDir.map((v) => v / len);
  dir1.forEach((v, i) => assert.ok(Math.abs(v - expect[i]) < 1e-6, `dir[${i}]`));
});

ok("director：阴影拟合产出 texel snapping 后的正交相机", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  const box = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), new THREE.MeshBasicMaterial());
  scene.add(box);
  d.setFocus(box);
  d.update(1, { timeOfDay: 0.5, weather: 0 });
  const fit = d.getState().fit;
  assert.ok(fit, "应有 fit");
  assert.ok(fit.span >= 10, "span 覆盖目标");
  assert.ok(fit.texel > 0);
  const cam = d.lights.sun.shadow.camera;
  // texel snapping：中心必为 texel 的整数倍
  const cx = (cam.left + cam.right) / 2;
  assert.ok(Math.abs(cx / fit.texel - Math.round(cx / fit.texel)) < 1e-6, "未对齐 texel 网格");
  assert.ok(cam.far > cam.near);
});

ok("director：焦点静止 + 方向不变 → 不重复拟合", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  const box = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial());
  scene.add(box);
  d.setFocus(box);
  d.update(1, { timeOfDay: 0.5, weather: 0 });
  const fit1 = d.getState().fit;
  d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  assert.equal(d.getState().fit, fit1, "texel 内静止不应重拟合");
});

ok("director：建筑 dirty（invalidateShadowFit）→ 强制重拟合", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  const box = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial());
  scene.add(box);
  d.setFocus(box);
  d.update(1, { timeOfDay: 0.5, weather: 0 });
  const fit1 = d.getState().fit;
  d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  assert.equal(d.getState().fit, fit1, "无 dirty 不应重拟合");
  d.invalidateShadowFit();
  d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  assert.notEqual(d.getState().fit, fit1, "dirty 后应重拟合");
  assert.equal(d.getState().fit.reason, "init");
});

ok("director：焦点移动超 1.5 纹素 → 触发 focus-moved 重拟合", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  const box = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial());
  scene.add(box);
  d.setFocus(box);
  d.update(1, { timeOfDay: 0.5, weather: 0 });
  const fit1 = d.getState().fit;
  // 移动远超 1.5 纹素（texel ~ span/2048 量级）
  box.position.set(fit1.texel * 20, 0, 0);
  box.updateMatrixWorld(true);
  d.update(0.016, { timeOfDay: 0.5, weather: 0 });
  const fit2 = d.getState().fit;
  assert.notEqual(fit2, fit1, "焦点移动应触发重拟合");
  assert.equal(fit2.reason, "focus-moved");
});

ok("director：阴影预设 paper/soft 切换且可回切", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  d.setEnabled(true);
  assert.equal(renderer.shadowMap.type, THREE.BasicShadowMap, "默认 paper 硬边");
  d.setShadowPreset("soft");
  assert.equal(renderer.shadowMap.type, THREE.PCFSoftShadowMap);
  assert.equal(d.getShadowDebugInfo().shadowType, "soft");
  d.setShadowPreset("paper");
  assert.equal(renderer.shadowMap.type, THREE.BasicShadowMap);
});

ok("director：caster 分类——实体进入、透明水/粒子/背面壳排除", () => {
  const { scene, renderer } = makeScene();
  const d = createLightingDirector({ scene, renderer, legacy: {} });
  const root = new THREE.Group();
  const solid = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial());
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.6 })
  );
  const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
  root.add(solid, water, points);
  scene.add(root);
  const r = d.classifyShadowCasters(root);
  assert.equal(r.casters, 1);
  assert.equal(r.excluded, 1); // Points 非 Mesh 直接跳过不计
  assert.equal(solid.castShadow, true);
  assert.equal(water.castShadow, false);
  assert.equal(points.castShadow, false);
});

console.log(`\n全部通过：${passed} 项`);
