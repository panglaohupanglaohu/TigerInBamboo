// =====================================================================
// 月亮湖的月亮（主人 2026-09-06：「在地标月亮湖构建如图所示那么大的月亮模型」）
//
// 地标卡片上那轮月亮几乎和整片湖一样宽，压在远岸上。「那么大」是个视角问题，
// 不是一个可以拍脑袋的数字，所以这条测试直接验**张角**：
// 站在环湖小径的对岸，月亮该占多少度。
//
// 另外三件事一起钉住：
//   · 走不进去（底缘高过人头、圆心在小径外沿之外）——地标不能变成一堵墙；
//   · 确定性（禁 Math.random）——这个仓库的老规矩；
//   · 白天收起月光路——大中午湖面上铺一条月光比没有月亮还假。
//
// 运行：node tools/test_moon_orb.mjs
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" }));
}
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {}, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.location = { search: "", href: "http://localhost/", hash: "" };
const stubEl = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, textContent: "", appendChild() {}, addEventListener() {}, querySelector: () => stubEl(), querySelectorAll: () => [] });
const stubCanvas = () => { const el = stubEl(); el.width = 64; el.height = 64; el.getContext = () => ({ canvas: el, fillRect() {}, clearRect() {}, measureText: () => ({ width: 6 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), fillText() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }); el.toDataURL = () => ""; return el; };
globalThis.document = { createElement: (t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), createElementNS: (_n, t) => String(t).toLowerCase() === "canvas" ? stubCanvas() : stubEl(), getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], body: { appendChild() {} }, addEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createMoonLake, LAKE } = await import(new URL("src/world/lake.js", BASE).href);
const { MOON_ORB } = await import(new URL("src/world/moonOrb.js", BASE).href);
const { P } = await import(new URL("src/core/params.js", BASE).href);

const R = 160;
const DEG = 180 / Math.PI;
const scene = new THREE.Scene();
const lake = createMoonLake(scene, R);
const orb = lake.moonOrb;
assert.ok(orb, "月亮湖必须有月亮——它就是这个地标的同名主角");

// ---- ① 尺寸：和整片湖差不多宽 ----
{
  const moonD = MOON_ORB.radius * 2;
  const lakeD = LAKE.rOuter * 2;
  const ratio = moonD / lakeD;
  assert.ok(ratio > 0.7 && ratio < 1.1,
    `月亮直径应当和湖宽相当（卡片上的比例），实得 ${ratio.toFixed(2)} 倍`);
  console.log(`  ✓ ① 尺寸：月亮直径 ${moonD} · 湖宽 ${lakeD} · 比 ${ratio.toFixed(2)}`);
}

// ---- ② 张角：从对岸小径看过去 25°~34° ----
{
  // 观察者站在环湖小径上、月亮的**正对面**，眼高 1.7（湖局部坐标）
  const gx = MOON_ORB.dirX * MOON_ORB.offset;
  const gz = MOON_ORB.dirZ * MOON_ORB.offset;
  const n = Math.hypot(gx, gz);
  const eye = new THREE.Vector3(
    (-gx / n) * LAKE.pathOuter,
    1.7,
    (-gz / n) * LAKE.pathOuter
  );
  const center = new THREE.Vector3(gx, MOON_ORB.height, gz);
  const dist = eye.distanceTo(center);
  const ang = 2 * Math.atan(MOON_ORB.radius / dist) * DEG;
  assert.ok(ang > 24 && ang < 35,
    `从对岸看月亮该占 25°~34°（卡片上就是这个比例），实测 ${ang.toFixed(1)}°，斜距 ${dist.toFixed(1)}`);
  console.log(`  ✓ ② 张角：对岸小径 → 斜距 ${dist.toFixed(1)} · 张角 ${ang.toFixed(1)}°`);
}

// ---- ③ 走不进去：底缘高过人头 + 圆心在小径外沿之外 ----
{
  const bottom = MOON_ORB.height - MOON_ORB.radius;
  assert.ok(bottom > 2.0,
    `月亮底缘要高过人头（约 1.87），实测 ${bottom.toFixed(2)}——` +
    "地标不能变成一堵能撞上的墙");
  assert.ok(MOON_ORB.offset > LAKE.pathOuter + 1.5,
    `圆心要落在环湖小径外沿（${LAKE.pathOuter}）之外，实测 ${MOON_ORB.offset}——` +
    "不占动线");
  // 月亮不该被当成碰撞体登记（它在天上）
  assert.equal(lake.deepCollider.radius, LAKE.rDeep,
    "湖的碰撞体只有深水区那一个，月亮不该混进去");
  console.log(`  ✓ ③ 走不进去：底缘 ${bottom.toFixed(2)} 高 · 圆心离湖心 ${MOON_ORB.offset}（小径外沿 ${LAKE.pathOuter}）`);
}

// ---- ④ 确定性：重建两次逐位一致（禁 Math.random）----
{
  const snap = (o) => {
    const out = [];
    o.group.traverse((n) => out.push(
      n.name || n.type,
      n.position.x.toFixed(6), n.position.y.toFixed(6), n.position.z.toFixed(6),
      n.scale.x.toFixed(6), n.scale.y.toFixed(6), n.scale.z.toFixed(6)));
    return out.join("|");
  };
  const scene2 = new THREE.Scene();
  const lake2 = createMoonLake(scene2, R);
  assert.equal(snap(orb), snap(lake2.moonOrb),
    "重建两次必须逐位一致——月海位置用的是常量表，不许有 Math.random");
  console.log("  ✓ ④ 确定性：重建两次逐位一致");
}

// ---- ⑤ 它确实是个月牙（不是圆环、不是碎片）----
{
  // 月牙 = 外圆内 ∩ 内圆外。把这两条直接套在**每一个顶点**上，
  // 是比看截图可靠得多的判据：
  //  · 第一版按湖面那套写成 Shape + hole，而月牙要求那个洞**捅出外圆**，
  //    Earcut 于是崩出一道横贯月面的碎三角——碎片的顶点会落进内圆里，
  //    这条断言当场抓住；
  //  · 洞要是没捅出去，切出来的是个「缺一小口的圆环」，
  //    下面「最厚处 / 缺口宽度」那两条会把它挡下来。
  const R = MOON_ORB.radius;
  const r = R * MOON_ORB.holeRatio;
  const d = R * MOON_ORB.holeOffset;
  const pos = orb.body.geometry.attributes.position;
  let worstOuter = 0;
  let worstInner = Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    worstOuter = Math.max(worstOuter, Math.hypot(x, y));
    worstInner = Math.min(worstInner, Math.hypot(x - d, y));
  }
  assert.ok(worstOuter <= R + 1e-3,
    `月牙不许长到外圆之外，实测最远顶点 ${worstOuter.toFixed(4)}（外圆 ${R}）`);
  assert.ok(worstInner >= r - 1e-3,
    `月牙里不许有顶点掉进被切掉的内圆，实测最深 ${worstInner.toFixed(4)}（内圆 ${r}）——` +
    "掉进去就说明三角剖分崩了（Shape+hole 那版就是这么崩的）");

  // 缺口必须真的**捅出去**：内圆最远端要越过外圆，否则切出来是个圆环
  assert.ok(r + d > R + 1e-6,
    `内圆必须捅出外圆（r + d = ${(r + d).toFixed(3)} > R = ${R}），` +
    "不然是个缺一小口的圆环，不是月牙");
  // 最厚处：等半径时就是偏移量本身。太薄看不见，太厚又成了半圆
  const thick = R - (r - d);
  assert.ok(thick > R * 0.25 && thick < R * 0.62,
    `月牙最厚处应在外圆半径的 0.25~0.62 之间，实测 ${(thick / R).toFixed(2)}`);
  console.log(`  ✓ ⑤ 月牙：顶点全在外圆内(${worstOuter.toFixed(2)}≤${R})、内圆外(${worstInner.toFixed(2)}≥${r})· 最厚 ${(thick / R).toFixed(2)}R`);
}

// ---- ⑤b 月海落在月牙的实体上 ----
{
  const R = MOON_ORB.radius;
  const r = R * MOON_ORB.holeRatio;
  const d = R * MOON_ORB.holeOffset;
  const patches = orb.maria.children;
  assert.ok(patches.length >= 4, `月海应有 4 块以上，实得 ${patches.length}`);
  for (const p of patches) {
    // 圆盘半径从几何里取，别信参数表——参数改了这里要跟着响
    p.geometry.computeBoundingSphere();
    const cr = p.geometry.boundingSphere.radius;
    const x = p.position.x;
    const y = p.position.y;
    assert.ok(Math.hypot(x, y) + cr <= R,
      `月海连边缘都要在外圆内：中心 (${x.toFixed(2)}, ${y.toFixed(2)}) 半径 ${cr.toFixed(2)}`);
    assert.ok(Math.hypot(x - d, y) - cr >= r,
      `月海不许探进缺口里（那儿是空气）：中心 (${x.toFixed(2)}, ${y.toFixed(2)}) 半径 ${cr.toFixed(2)}`);
  }
  console.log(`  ✓ ⑤b 月海 ${patches.length} 块 · 整块都压在月牙的实体上`);
}

// ---- ⑥ 昼夜：白天收起光晕与月光路 ----
{
  const viewer = new THREE.Vector3(-MOON_ORB.dirX * 5, 1.7, -MOON_ORB.dirZ * 5);
  P.timeOfDay = 0.0; // 午夜
  orb.update(10, 0.016, viewer);
  const nightGlow = orb.glows[0].material.opacity;
  const nightPath = orb.streak.material.opacity;
  assert.ok(nightPath > 0.05, `午夜湖面要有月光路，实测 ${nightPath.toFixed(3)}`);
  assert.equal(orb.reflect.visible, true, "午夜月光路要在");

  P.timeOfDay = 0.5; // 正午
  orb.update(11, 0.016, viewer);
  assert.ok(orb.glows[0].material.opacity < nightGlow * 0.5,
    "正午光晕要压下去");
  assert.ok(orb.streak.material.opacity < 0.01,
    `正午不许在湖面上铺月光路，实测 ${orb.streak.material.opacity.toFixed(4)}——` +
    "比没有月亮还假");
  assert.equal(orb.reflect.visible, false, "正午月光路要整组收起（省一批半透明 draw）");
  P.timeOfDay = 0.0;
  console.log(`  ✓ ⑥ 昼夜：午夜光晕 ${nightGlow.toFixed(3)} / 月光路 ${nightPath.toFixed(3)} → 正午全收`);
}

// ---- ⑦ 月光路朝着观察者铺（真实的月光路永远指向看的人）----
{
  const gx = MOON_ORB.dirX * MOON_ORB.offset;
  const gz = MOON_ORB.dirZ * MOON_ORB.offset;
  const probe = (vx, vz) => {
    orb.update(12, 0.016, new THREE.Vector3(vx, 1.7, vz));
    // 月光路的拉长方向 = 局部 -Z 经 rotation.y 旋转后的世界（湖局部）方向
    const yaw = orb.reflect.rotation.y;
    return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  };
  for (const [vx, vz] of [[0, 4.4], [4.4, 0], [-3, -3.2], [0, -4.4]]) {
    const f = probe(vx, vz);
    const wantX = vx - gx;
    const wantZ = vz - gz;
    const n = Math.hypot(wantX, wantZ);
    const dot = (f.x * wantX + f.z * wantZ) / n;
    assert.ok(dot > 0.99,
      `月光路必须朝观察者铺开（观察者 ${vx},${vz}），实测方向点积 ${dot.toFixed(3)}`);
  }
  console.log("  ✓ ⑦ 月光路：走到哪一侧，它就朝哪一侧铺（4 个方位全对）");
}

// ---- ⑧ 预算：一个地标主体的三角数不能失控 ----
{
  let tris = 0;
  orb.group.traverse((n) => {
    const g = n.geometry;
    if (!g) return;
    tris += g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
  });
  assert.ok(tris < 6000, `月亮总三角数 ${tris}，超预算（城堡那次崩溃之后这条线上要盯着）`);
  console.log(`  ✓ ⑧ 预算：${tris} 三角（月牙本体 + 地球反照 + 月海 + 光晕 Sprite）`);
}

// ---- ⑨ 月牙是片状的：必须转过来对着人 ----
{
  // 真实的月亮在无穷远处，本来就永远正对观察者——所以这个跟随是「对」的，
  // 不是取巧。少了它，绕湖走到侧面时月牙会薄成一条线。
  const gx = MOON_ORB.dirX * MOON_ORB.offset;
  const gz = MOON_ORB.dirZ * MOON_ORB.offset;
  const settle = (vx, vz) => {
    // 转速有上限（yawRate），要喂够帧才转得到位
    for (let i = 0; i < 400; i++) orb.update(20 + i * 0.05, 0.05, new THREE.Vector3(vx, 1.7, vz));
    return orb.face.rotation.y;
  };
  for (const [vx, vz] of [[0, 4.4], [4.4, 0], [-3, -3.2]]) {
    const yaw = settle(vx, vz);
    // 月牙脸的局部 +Z 转到世界后应当指向观察者
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const wx = vx - gx;
    const wz = vz - gz;
    const n = Math.hypot(wx, wz);
    const dot = (fx * wx + fz * wz) / n;
    assert.ok(dot > 0.999,
      `月牙必须正面朝向观察者（观察者 ${vx},${vz}），实测点积 ${dot.toFixed(4)}`);
  }
  // 只转偏航，不许翻滚：月亮不该躺下来
  assert.equal(orb.face.rotation.x, 0, "月牙不许俯仰");
  assert.equal(orb.face.rotation.z, 0, "月牙不许翻滚——倾角是在脸**内部**给的（body.rotation.z）");
  assert.ok(Math.abs(orb.body.rotation.z - MOON_ORB.tilt) < 1e-9,
    "两只角的斜度由 MOON_ORB.tilt 定，跟随转动时不该跟着变");
  console.log("  ✓ ⑨ 偏航跟随：走到哪一侧，月牙就转过来正对哪一侧（不俯仰、不翻滚）");
}

console.log("✅ test_moon_orb（月亮湖的月牙：和湖同宽 · 对岸看 30° · 走不进去 · 确定性 · 真月牙 · 昼夜 · 月光路朝人 · 正面朝人）");
