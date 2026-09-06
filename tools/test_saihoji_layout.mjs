// =====================================================================
// 西芳寺六景球面布局净空验收（2026-09-05 球面平移后）
// 用法：node tools/test_saihoji_layout.mjs
//
// 苔庭中枢 2026-09-05 从 lat 56 平移到 lat 32，六景整体加同一纬度偏移。
// 这条测的是**平移没有破坏原有的净空约束**：
//   任意两景圆心的球面弧长 ≥ rᵢ + rⱼ + SAIHOJI_MIN_DISTANCE
//
// 为什么必须实测而不是推理：往低纬走 cos(lat) 变大，同样的 Δlon 张开成更大的
// 弧长，"间距只会变宽"这个推理是对的——但 2026-09-05 本会话已经两次被自己
// 说得通的推理打脸（plinth 撒到 iy=9、裙边贴地），所以一律用数字说话。
// =====================================================================
import assert from "node:assert/strict";
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

const SRC = new URL("src/", BASE);
const { SAIHOJI_ZONES, SAIHOJI_HUB, SAIHOJI_MIN_DISTANCE, SAIHOJI_LAT_SHIFT } = await import(
  new URL("world/saihoji.js", SRC).href
);
const { PLANET_RADIUS } = await import(new URL("world/planet.js", SRC).href);

let pass = 0;
const ok = (m) => {
  console.log(`  ✓ ${m}`);
  pass++;
};

const R = PLANET_RADIUS;
const rad = (d) => (d * Math.PI) / 180;
/** lat/lon（度）→ 单位方向，与 sphereMath.latLonToDir 同式 */
const dirOf = (latDeg, lonDeg) => {
  const la = rad(latDeg);
  const lo = rad(lonDeg);
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
};
/** 两点球面弧长（世界单位） */
const arc = (a, b) => {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return Math.acos(dot) * R;
};

console.log(`R=${R}  中枢=lat ${SAIHOJI_HUB.lat} / lon ${SAIHOJI_HUB.lon}  纬移=${SAIHOJI_LAT_SHIFT}`);

console.log("[1] 中枢已平移到 lat 32，六景随之整体平移（偏移一致）");
assert.equal(SAIHOJI_HUB.lat, 32, `中枢纬度应为 32，实际 ${SAIHOJI_HUB.lat}`);
assert.equal(SAIHOJI_LAT_SHIFT, -24, `纬移量应为 -24，实际 ${SAIHOJI_LAT_SHIFT}`);
// 反查原始布局：每景 lat - SHIFT 应回到平移前的值，且六景偏移必须**完全一致**
// （逐个手改最容易漏一个，那会让某一景孤零零留在旧纬度）
const ORIGINAL_LATS = Object.freeze({
  "moss-entry": 56.0,
  "master-stones": 55.5136,
  "dry-cascade": 53.9805,
  "moss-islands": 59.802,
  "empty-court": 61.7147,
  "return-view": 62.3304,
});
for (const zone of SAIHOJI_ZONES) {
  const original = ORIGINAL_LATS[zone.id];
  assert.ok(original !== undefined, `未知景区 ${zone.id}，请同步更新本测试的原始纬度表`);
  const restored = zone.lat - SAIHOJI_LAT_SHIFT;
  assert.ok(
    Math.abs(restored - original) < 1e-6,
    `${zone.id} 纬移不一致：现 ${zone.lat}，反查得 ${restored}，应为 ${original}` +
      `（六景必须整体加同一偏移，漏改一个就会脱队）`
  );
}
// 入口苔径与中枢同址（原设计：入口 = 中枢）
const entry = SAIHOJI_ZONES.find((z) => z.id === "moss-entry");
assert.ok(
  Math.abs(entry.lat - SAIHOJI_HUB.lat) < 1e-6 && Math.abs(entry.lon - SAIHOJI_HUB.lon) < 1e-6,
  `入口苔径应与中枢同址，实际 (${entry.lat}, ${entry.lon}) vs (${SAIHOJI_HUB.lat}, ${SAIHOJI_HUB.lon})`
);
ok(`六景纬移一致（全部 ${SAIHOJI_LAT_SHIFT}）；入口苔径与中枢同址`);

console.log("[2] 净空：任意两景弧长 ≥ rᵢ + rⱼ + 净空");
const dirs = new Map(SAIHOJI_ZONES.map((z) => [z.id, dirOf(z.lat, z.lon)]));
let worstSlack = Infinity;
let worstPair = "";
const rows = [];
for (let i = 0; i < SAIHOJI_ZONES.length; i++) {
  for (let j = i + 1; j < SAIHOJI_ZONES.length; j++) {
    const a = SAIHOJI_ZONES[i];
    const b = SAIHOJI_ZONES[j];
    const d = arc(dirs.get(a.id), dirs.get(b.id));
    const need = a.radius + b.radius + SAIHOJI_MIN_DISTANCE;
    const slack = d - need;
    rows.push({ pair: `${a.id}↔${b.id}`, d, need, slack });
    if (slack < worstSlack) {
      worstSlack = slack;
      worstPair = `${a.id}↔${b.id}`;
    }
  }
}
for (const r of rows.sort((x, y) => x.slack - y.slack).slice(0, 4)) {
  console.log(
    `    ${r.pair.padEnd(30)} 弧长 ${r.d.toFixed(2)}  需 ${r.need.toFixed(2)}  余 ${r.slack >= 0 ? "+" : ""}${r.slack.toFixed(2)}`
  );
}
assert.ok(
  worstSlack >= 0,
  `净空被破坏：最紧的 ${worstPair} 还差 ${(-worstSlack).toFixed(2)}（需 ≥ rᵢ+rⱼ+${SAIHOJI_MIN_DISTANCE}）`
);
ok(`${rows.length} 对全部满足净空，最紧 ${worstPair} 余量 +${worstSlack.toFixed(2)}`);

console.log("[3] 平移确实把间距放宽了（低纬 cos 更大）");
// 同一组 lat/lon 在平移前的弧长，用来证明这次平移是"放宽"而不是"收紧"
let minBefore = Infinity;
let minAfter = Infinity;
for (let i = 0; i < SAIHOJI_ZONES.length; i++) {
  for (let j = i + 1; j < SAIHOJI_ZONES.length; j++) {
    const a = SAIHOJI_ZONES[i];
    const b = SAIHOJI_ZONES[j];
    const before = arc(
      dirOf(a.lat - SAIHOJI_LAT_SHIFT, a.lon),
      dirOf(b.lat - SAIHOJI_LAT_SHIFT, b.lon)
    );
    const after = arc(dirs.get(a.id), dirs.get(b.id));
    minBefore = Math.min(minBefore, before);
    minAfter = Math.min(minAfter, after);
  }
}
console.log(`    平移前最小圆心距 ${minBefore.toFixed(2)} → 平移后 ${minAfter.toFixed(2)}`);
assert.ok(
  minAfter >= minBefore - 1e-6,
  `平移后最小间距反而变小了（${minBefore.toFixed(2)} → ${minAfter.toFixed(2)}）——` +
    "与「低纬张开更大」的预期相反，说明纬移不是整体一致的"
);
ok(`最小圆心距 ${minBefore.toFixed(2)} → ${minAfter.toFixed(2)}（放宽 +${(minAfter - minBefore).toFixed(2)}）`);

console.log("[4] 中枢常量只有一个来源（禁止再手抄经纬度）");
// messengerIsland.js 曾硬抄两份 (56, -120)：苔丘留旧位、和六景脱开，且不报错。
const island = fs.readFileSync(fileURLToPath(new URL("scenes/messengerIsland.js", SRC)), "utf8");
const hardcoded = island.match(/latLonToDir\(\s*\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*,/g) ?? [];
assert.equal(
  hardcoded.length,
  0,
  `messengerIsland.js 里仍有硬抄的经纬度：${hardcoded.join(" ")}——应从 SAIHOJI_HUB / 常量取`
);
assert.match(island, /SAIHOJI_HUB/, "messengerIsland.js 应从 SAIHOJI_HUB 取苔庭中枢方向");
ok("messengerIsland.js 无硬抄经纬度，中枢只有一个来源");

console.log(`\n全部通过：${pass} 项`);
console.log(
  "六景：" +
    SAIHOJI_ZONES.map((z) => `${z.id}(${z.lat.toFixed(2)},${z.lon.toFixed(1)},r${z.radius})`).join(" ")
);
