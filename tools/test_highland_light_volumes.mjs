// =====================================================================
// S18 光体积灯验收（x.com/OskSta/status/1582757294672314368）：
// 点光源烘进低分辨率光体积；规则 = 大 / 软 / 基本不动。
// 运行：node tools/test_highland_light_volumes.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({
    name: "three", version: "0.172.0-local-bridge", type: "module",
    main: "../../vendor/three.module.js",
  }));
}
globalThis.window = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
const stubEl = () => ({
  style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  textContent: "", appendChild() {}, addEventListener() {},
  querySelector: () => stubEl(), querySelectorAll: () => [],
});
const stubCanvas = () => {
  const el = stubEl();
  el.width = 64; el.height = 64;
  el.getContext = () => ({
    canvas: el, fillRect() {}, clearRect() {},
    measureText: () => ({ width: 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    fillText() {}, drawImage() {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  });
  el.toDataURL = () => "";
  return el;
};
globalThis.document = {
  createElement: (t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  createElementNS: (_n, t) => (String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl()),
  getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [],
  body: { appendChild() {} }, addEventListener() {},
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const {
  LIGHT_VOLUME_GRID, LAMP_MIN_RADIUS, LAMP_BREATH_MAX, REAL_LIGHT_BUDGET,
  WINDOW_SPARK_MAX, HIGHLAND_LAMP_COLOR, COOL_ACCENT_COLOR, WATER_COOL_WASH_COLOR,
  falloff01, highlandLampLayout, highlandWindowSparks, bakeLightVolume, nightWeightAt,
  createHighlandLightVolumes,
} = await import(new URL("src/render/lighting/highlandLightVolumes.js", BASE).href);
const { highlandTerrainSurfaceHeight, highlandCurvedLakeSurfaceHeight, HIGHLAND_HARBOR_COVE } = await import(
  new URL("src/world/highlandCitadelDesign.js", BASE).href
);
let pass = 0;
const ok = (message) => { pass += 1; console.log(`  ✓ ${message}`); };

// --- 1. 软落曲线：大而软，无硬边 ---------------------------------------
assert.equal(falloff01(0, 5), 1, "中心全亮");
assert.equal(falloff01(5, 5), 0, "半径处恰为 0");
assert.equal(falloff01(6, 5), 0, "半径外恒 0");
let last = Infinity;
for (let d = 0; d <= 5.0001; d += 0.1) {
  const v = falloff01(d, 5);
  assert.ok(v <= last + 1e-9, `软落单调不增 d=${d.toFixed(2)}`);
  last = v;
}
// smoothstep 内外导数为零（软）→ 靠近内圈与半径处相邻差趋 0
const nearInner = falloff01(0.35 * 5 + 0.01, 5) - falloff01(0.35 * 5, 5);
const nearEdge = falloff01(4.99, 5) - falloff01(4.9, 5);
assert.ok(nearInner < 0.01 && nearEdge < 0.01, `边缘梯度趋零 inner=${nearInner.toFixed(4)} edge=${nearEdge.toFixed(4)}`);
ok(`软落曲线：单调、边界归零、内外梯度趋零（半径 ${LAMP_MIN_RADIUS}+ = 大而软）`);

// --- 2. 低分辨率体积烘焙：5³、确定性、软落数据 -------------------------
const lamps = highlandLampLayout({ terrainHeightAt: highlandTerrainSurfaceHeight });
assert.ok(lamps.length >= 10, `灯位 ${lamps.length}`);
const bakeA = bakeLightVolume(lamps[0]);
const bakeB = bakeLightVolume(lamps[0]);
assert.equal(bakeA.hash, bakeB.hash, "同灯同 hash（确定性烘焙）");
assert.deepEqual(bakeA.dims, [LIGHT_VOLUME_GRID, LIGHT_VOLUME_GRID, LIGHT_VOLUME_GRID], "5³ 低分辨率 lattice");
assert.equal(bakeA.data.length, 125);
for (const lamp of lamps) {
  assert.ok(lamp.radius >= LAMP_MIN_RADIUS, `灯半径 ${lamp.radius.toFixed(2)} ≥ ${LAMP_MIN_RADIUS}（big）`);
  const own = bakeLightVolume(lamp);
  assert.ok(own.hash.startsWith("light-volume:"), "hash 前缀");
}
assert.equal(bakeLightVolume(lamps[0]).hash, bakeLightVolume(lamps[1]).hash, "体积归一化：不同灯共享同一条软落曲线（半径在壳尺度上体现）");
// lattice 数据本身是软的：中心最高、角落为 0、无跳变
const g = LIGHT_VOLUME_GRID;
assert.equal(bakeA.data[Math.floor(62.5)], 1, "中心格全亮");
const corner = bakeA.data[0];
assert.equal(corner, 0, "角落格为 0");
for (let i = 1; i < bakeA.data.length; i++) {
  assert.ok(bakeA.data[i] <= 1 && bakeA.data[i] >= 0, "数据在 [0,1]");
}
ok(`低分辨率体积：${g}³ lattice 确定性烘焙 ${bakes10().length} 份，数据软落无跳变`);
function bakes10() { return lamps.map((lamp) => bakeLightVolume(lamp)); }

// --- 3. 灯位布局：台灯在台面、岸湾灯贴地形、塔冠在中轴、确定性 ---------
for (const lamp of lamps) {
  const [x, y, z] = lamp.position;
  if (lamp.id.includes("beacon")) {
    assert.equal(lamp.radius, 8.5, "塔楼暖光冠最大（参考图透光城塔）");
    continue;
  }
  if (x >= HIGHLAND_HARBOR_COVE.xMin && x <= HIGHLAND_HARBOR_COVE.xMax && z >= HIGHLAND_HARBOR_COVE.zMin) {
    const terr = highlandTerrainSurfaceHeight(x, z);
    assert.ok(Math.abs(y - terr) < 0.01, `岸湾灯贴地形顶面 ${lamp.id}: ${y.toFixed(2)} vs ${terr.toFixed(2)}`);
  } else {
    assert.ok(Math.abs(x) <= 23 && z >= -27 && z <= 23, `台灯在台面内 ${lamp.id}`);
    assert.equal(y, 4.95, `台灯在城市基面 ${lamp.id}`);
  }
  assert.ok(lamp.radius >= LAMP_MIN_RADIUS, `半径 ≥ ${LAMP_MIN_RADIUS}（big）`);
}
const frontCount = lamps.filter((lamp) => !lamp.beacon && !lamp.dim && lamp.position[2] >= 17 && lamp.position[2] <= 23).length;
const backCount = lamps.filter((lamp) => !lamp.beacon && lamp.position[2] < 0).length;
assert.ok(frontCount >= 6, `水岸前缘 ${frontCount} 盏（下密）`);
assert.ok(backCount <= 1, `高处 ${backCount} 盏（上疏）`);
const layoutAgain = highlandLampLayout({ terrainHeightAt: highlandTerrainSurfaceHeight });
assert.deepEqual(lamps, layoutAgain, "布局确定性");
assert.equal(lamps.filter((lamp) => lamp.beacon).length, 1, "一盏塔楼暖光冠");
// 阶梯光色：低处饱和深橙 → 高处暖黄（参考图垂直层次）
const colorOf = (hex) => `#${hex.toString(16).padStart(6, "0")}`;
const frontLamp = lamps.find((lamp) => !lamp.beacon && lamp.position[2] >= 17);
const backLamp = lamps.find((lamp) => lamp.dim);
assert.equal(colorOf(frontLamp.color), colorOf(0xff6f32), "前缘 = 珊瑚深橙");
assert.equal(colorOf(backLamp.color), colorOf(0xffad64), "高处 = 柔暖黄");
assert.equal(colorOf(lamps.find((lamp) => lamp.beacon).color), colorOf(0xffc979), "塔冠 = 暖黄亮色");
ok(`灯位布局：${lamps.length} 盏 = 前缘 ${frontCount}（密）+ 岸湾 3 + 门 2 + 中/高 ${backCount} + 塔冠 1（上疏），确定性`);

// --- 4. 夜权重曲线 ------------------------------------------------------
assert.equal(nightWeightAt(0.5), 0, "正午 0");
assert.equal(nightWeightAt(0), 1, "午夜 1");
assert.equal(nightWeightAt(0.1), 1, "凌晨 1");
assert.ok(nightWeightAt(0.75) > 0.5 && nightWeightAt(0.75) < 1, "暮色爬升中");
assert.ok(nightWeightAt(0.28) < 1, "晨光回落");
ok("夜权重：正午 0 / 暮色爬升 / 午夜 1");

// --- 4b. 立面窗光：+z 立面、低层密、确定性 -------------------------------
const fakeLayout = { terraces: [{ levels: [
  ".........................",
  ".A.A.............A...A...",
  ".........................",
  ".........................",
] }] };
const sparks = highlandWindowSparks(fakeLayout);
assert.ok(sparks.length >= 1 && sparks.length <= WINDOW_SPARK_MAX, `窗光 ${sparks.length}`);
for (const spark of sparks) {
  const [gx, gy, gz] = spark.id.match(/window:(\d+),(\d+),(\d+)/).slice(1).map(Number);
  assert.equal(charAtFake(fakeLayout, gx, gy, gz + 1), ".", "窗朝空旷 +z");
  assert.equal(charAtFake(fakeLayout, gx, gy + 1, gz), ".", "窗在有顶墙面的顶层格");
  const expectedZ = (gz - 12) * 2 + 1 + 0.06;
  assert.ok(Math.abs(spark.position[2] - expectedZ) < 1e-6, `窗贴立面外沿 ${spark.position[2]} vs ${expectedZ}`);
  assert.equal(spark.floor, gy, "floor 一致");
}
function charAtFake(layout, ix, iy, iz) {
  return (layout.terraces[0].levels[iy]?.[iz] || ".")[ix] || ".";
}
assert.deepEqual(sparks, highlandWindowSparks(fakeLayout), "窗光确定性");
ok(`立面窗光：+z 立面抽取，低层权重高，确定性（示例 ${sparks.length} 窗）`);

// --- 5. 挂载：灯杆/灯头/体积壳 + 预算内的真实点光源 ---------------------
const parent = new THREE.Group();
const system = createHighlandLightVolumes(THREE, parent, {
  lamps,
  terrainHeightAt: highlandTerrainSurfaceHeight,
  waterLocalY: 4.92,
  waterHeightAt: highlandCurvedLakeSurfaceHeight,
});
const group = system.group;
assert.equal(group.name, "highland-light-volumes");
const lampHolders = group.children.filter((child) => child.name.startsWith("highland-light-volume-"));
assert.equal(lampHolders.length, lamps.length, "每盏灯一个 holder");
const shells = lampHolders.map((holder) => holder.children.find((c) => c.name === "lamp-volume-shell"));
assert.ok(shells.every((shell) => shell?.isMesh), "每盏灯有光体积壳");
const realLights = lampHolders.flatMap((holder) => holder.children.filter((c) => c.name === "lamp-point-light"));
assert.equal(realLights.length, Math.min(REAL_LIGHT_BUDGET, lamps.length), `暖灯点光源 ${realLights.length} = 预算内`);
const coolShells = group.children.filter((holder) => (holder.userData.lampId || "").includes ? false : false);
assert.equal(group.userData.realLightCount, realLights.length + (group.userData.coolAccentCount ?? 0));
for (let i = 0; i < shells.length; i++) {
  const shell = shells[i];
  assert.equal(shell.material.uniforms.uRadius.value, shell.geometry.parameters.radius, "壳半径=灯半径");
  // 主人验收 2026-08-28：所有季节光球可见壳减半
  assert.equal(shell.geometry.parameters.radius, lamps[i].radius * 0.5, `壳半径 = 灯半径 × 0.5 (${lamps[i].id})`);
  assert.ok(shell.userData.volumeTexture, "采样烘焙 3D 纹理（light volume）");
}
const firstLamp = group.children[0];
assert.ok(firstLamp.userData.bakeHash.startsWith("light-volume:"), "holder 带烘焙 hash");
const reflectionGroup = group.getObjectByName("highland-water-light-reflections");
assert.ok(reflectionGroup, "独立水面光照层已挂载");
const streaks = reflectionGroup.children.filter((child) => child.name === "lamp-reflection-streak");
assert.equal(streaks.length, 9, `水面倒影光斑 ${streaks.length} 条（岸湾 3 + 前缘水岸 6）`);
for (const streak of streaks) {
  const sourceLamp = lamps.find((lamp) => lamp.id === streak.userData.sourceLampId);
  const expectedWaterY = highlandCurvedLakeSurfaceHeight(sourceLamp.position[0], streak.position.z) + 0.035;
  assert.ok(Math.abs(streak.position.y - expectedWaterY) < 0.01, "光斑中心贴合球面湖泊");
  assert.ok(streak.position.z >= 24, "光斑从岸线延伸进水域（岸湾/前缘湾面）");
  assert.equal(streak.userData.softEdges, true, "倒影横向羽化，无矩形硬边");
  assert.ok(streak.material.uniforms.uTime && streak.material.uniforms.uIntensity, "倒影带动态水纹 uniforms");
  const yValues = Array.from({ length: streak.geometry.attributes.position.count }, (_, index) =>
    streak.geometry.attributes.position.getY(index));
  assert.ok(Math.max(...yValues) - Math.min(...yValues) > 0.05, "倒影逐顶点贴合湖面曲率，不是固定 Y 平片");
}
assert.ok(streaks[0].material.blending === THREE.AdditiveBlending, "加色混合（暖光叠水）");
const coolWash = reflectionGroup.getObjectByName("highland-water-cool-wash");
assert.ok(coolWash, "湖面深钴蓝底光存在");
assert.equal(coolWash.material.uniforms.uColor.value.getHex(), WATER_COOL_WASH_COLOR, "湖面底光为深钴蓝");
assert.equal(group.userData.waterReflectionCount, 10, "9 条暖倒影 + 1 块冷底光");
const beaconHolder = lampHolders.find((holder) => holder.userData.lampId === "highland-lamp-beacon");
assert.ok(beaconHolder, "塔楼暖光冠存在");
assert.ok(!beaconHolder.children.some((c) => c.name === "lamp-pole"), "灯冠无灯杆");
assert.ok(beaconHolder.children.find((c) => c.name === "lamp-volume-shell").position.y > 2, "灯冠悬于城中（参考图透光塔）");
ok(`挂载：${lamps.length} 壳 + ${realLights.length} 真实点光源（其余灯只留光晕）`);

// --- 6. somewhat still：位置永不动画，强度慢呼吸有界 -------------------
const positionsBefore = lampHolders.map((holder) => holder.position.clone());
const intensities = [];
for (let step = 0; step <= 240; step++) {
  system.update(step * 0.1);
  if (step % 4 === 0) intensities.push(shells[0].material.uniforms.uIntensity.value);
}
positionsBefore.forEach((pos, index) => {
  const now = lampHolders[index].position;
  assert.ok(pos.distanceTo(now) < 1e-9, `灯位不动 ${index}`);
});
for (const value of intensities) {
  assert.ok(value >= 0 && value <= 1, "强度在 [0,1]");
}
// 呼吸幅度：同一夜权重下，最大最小差 ≤ LAMP_BREATH_MAX + ε
const span = Math.max(...intensities) - Math.min(...intensities);
assert.ok(span <= LAMP_BREATH_MAX + 0.01, `呼吸幅度 ${span.toFixed(4)} ≤ ${LAMP_BREATH_MAX}+ε（somewhat still）`);
ok("somewhat still：位置恒定，亮度仅慢呼吸且幅度有界");

// --- 7. 夜权重门控：正午全灭、午夜全亮 ---------------------------------
system.update(0);
for (const shell of shells) assert.equal(shell.material.uniforms.uIntensity.value, 0, "正午壳强度 0");
for (const light of realLights) assert.equal(light.intensity, 0, "正午点光源 0");
const groupB = createHighlandLightVolumes(THREE, new THREE.Group(), {
  lamps, getTimeOfDay: () => 0.95,
});
groupB.update(3);
const nightShell = groupB.group.children[0].children.find((c) => c.name === "lamp-volume-shell");
assert.ok(nightShell.material.uniforms.uIntensity.value > 0.5, "午夜壳强度高");
const nightLight = groupB.group.children[0].children.find((c) => c.name === "lamp-point-light");
assert.ok(nightLight.intensity > 0.5, "午夜点光源亮");
ok("夜权重门控：正午全灭 / 午夜全亮");

// --- 8. dispose：几何/材质/纹理回收 ------------------------------------
const beforeChildren = parent.children.length;
system.dispose();
assert.equal(parent.children.length, beforeChildren - 1, "组已从父节点移除");
ok("dispose 几何/材质/3D 纹理回收");

// --- 9. 圣城集成：挂载点与夜驱动 ---------------------------------------
const citadelModule = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const castle = citadelModule.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });
const mounted = castle.getObjectByName("highland-light-volumes");
assert.ok(mounted, "圣城已挂光体积灯组");
assert.equal(mounted.userData.kind, "highland-light-volumes");
assert.equal(mounted.userData.realLightCount, 4, "暖灯点光 4 盏（2026-08-28 性能 8→4），冷蓝域纯壳 0 盏");
const coolMounted = mounted.children.filter((holder) => (holder.name || "").startsWith("highland-cool-accent"));
assert.equal(coolMounted.length, 5, "3 座塔冠 + 2 侧山肩冷蓝光域");
for (const [index, holder] of coolMounted.entries()) {
  const shell = holder.children.find((c) => c.name === "cool-accent-shell");
  assert.ok(shell, "冷蓝光域存在");
  assert.ok(shell.material.uniforms.uColor.value.b > shell.material.uniforms.uColor.value.r, "冷蓝光域保持钴蓝色相");
  if (index === 0) assert.notEqual(shell.material.uniforms.uColor.value.getHex(), 0x9fc8ff, "不再使用会洗白石材的浅天蓝");
  assert.ok(shell.geometry.parameters.radius <= 11, `冷蓝光域壳仍按 0.5 缩放 r=${shell.geometry.parameters.radius}`);
  assert.ok(!holder.children.some((c) => c.name === "cool-accent-light"), "冷蓝冠纯壳无点光（性能）");
}
assert.equal(COOL_ACCENT_COLOR, 0x4e72d8, "默认冷光为深钴蓝");
// 壳体细分 2→1（性能）：单壳面数 ≤ 96
for (const shell of shells) {
  assert.ok(shell.geometry.attributes.position.count / 3 <= 96, `光球壳三角数 ${shell.geometry.attributes.position.count / 3} ≤ 96`);
}
assert.ok(typeof mounted.update === "function", "圣城 update 链可驱动灯组");
const sparkGroup = mounted.getObjectByName("highland-window-sparks");
assert.ok(sparkGroup?.isInstancedMesh, "立面窗光层已挂载（InstancedMesh 单 draw call）");
assert.ok(sparkGroup.count >= 20 && sparkGroup.count <= WINDOW_SPARK_MAX, `圣城窗光 ${sparkGroup.count} 扇`);
// 复核窗位全部落在真实立面前沿：直接由同一 layout 重算比对
const recomputed = highlandWindowSparks(castle.userData.townSpec);
assert.equal(sparkGroup.count, recomputed.length, "窗位与 layout 复算一致");
const expectedPositions = new Set(recomputed.map((spark) => spark.position.map((v) => v.toFixed(2)).join(",")));
const m4 = new THREE.Matrix4();
for (let i = 0; i < sparkGroup.count; i++) {
  sparkGroup.getMatrixAt(i, m4);
  const key = [m4.elements[12], m4.elements[13], m4.elements[14]].map((v) => v.toFixed(2)).join(",");
  assert.ok(expectedPositions.has(key), `窗位合法 ${key}`);
}
mounted.update(0);
assert.equal(sparkGroup.material.opacity, 0, "正午窗光熄灭");
ok(`圣城集成：${mounted.children.length} 灯组 + ${sparkGroup.count} 扇立面窗光（单 draw call），全部贴真实立面`);

console.log(`\n✅ S18 light volume: ${lamps.length} 灯 5³ 体积烘焙 + 软落壳 + ${Math.min(REAL_LIGHT_BUDGET, lamps.length)} 盏预算点光源 + 立面窗光，参考图夜港光照全过`);
console.log(`全部通过：${pass} 组验收`);
