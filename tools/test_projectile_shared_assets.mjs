// =====================================================================
// 箭矢/投枪共享资产验收（2026-09-04，PERF C3 第一刀）
//
// 箭矢池 150 支、投枪池 44 支，原本每支各造一整套几何与材质
// （150×5 + 44×4 = 926 个材质实例 / 970 个几何实例）。
// 箭之间除变换外完全一致，绝大部分可共享。
//
// 但共享有**边界**：update() 里逐箭按各自飞行进度改
//   trail.material.opacity / trailCore.material.opacity
// 这几件必须保持逐箭独立，否则全体拖尾会跟着最后更新的那支一起闪。
//
// 这条测试就是把这个边界钉死：该共享的必须共享，该独立的不许被"顺手优化"掉。
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

const src = fs.readFileSync(new URL("src/world/saihojiPhalanx.js", BASE), "utf8");

// --- 1. 共享工厂存在，且箭/枪各一套 -------------------------------------
assert.match(src, /function arrowShared\(\)/, "箭矢共享资产工厂缺失");
assert.match(src, /function javelinShared\(\)/, "投枪共享资产工厂缺失");

// --- 2. makeArrow / makeJavelin 不得再在函数体内造几何 -------------------
// 按行首 `}` 收边：本文件是顶层函数声明，闭合大括号一定在第 0 列。
// （早先按「下一个 function」切会跑过头，把后面的代码算进函数体，误报 5 个几何。）
const bodyOf = (name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start > 0, `找不到 ${name}`);
  const rest = src.slice(start);
  const end = rest.indexOf("\n}");
  assert.ok(end > 0, `${name} 找不到行首闭合大括号`);
  return rest.slice(0, end);
};

for (const fn of ["makeArrow", "makeJavelin"]) {
  const body = bodyOf(fn);
  const geoms = body.match(/new THREE\.(Cylinder|Cone|Box|Sphere|Plane)Geometry/g) ?? [];
  assert.equal(geoms.length, 0,
    `${fn} 内不得再逐支创建几何（发现 ${geoms.length} 处：${geoms.join(", ")}）——` +
    "池里每支都造一份会白白多出几百个几何实例");
}

// --- 3. 拖尾材质必须逐支独立（有逐箭 opacity 动画）----------------------
// 这三处是动画点，改共享材质会让全体拖尾一起闪。
assert.match(src, /trail\.material\.opacity\s*=/, "箭矢拖尾 opacity 动画不该被删");
assert.match(src, /trailCore\.material\.opacity\s*=/, "箭矢拖尾核 opacity 动画不该被删");

const arrowBody = bodyOf("makeArrow");
const arrowTrailMats = arrowBody.match(/new THREE\.MeshBasicMaterial/g) ?? [];
assert.equal(arrowTrailMats.length, 2,
  `makeArrow 内应恰好保留 2 个逐支材质（trail + trailCore），实际 ${arrowTrailMats.length}。` +
  "多了说明本可共享的没共享；少了说明拖尾被误共享，全体会一起闪");

const javelinBody = bodyOf("makeJavelin");
const javelinTrailMats = javelinBody.match(/new THREE\.MeshBasicMaterial/g) ?? [];
assert.equal(javelinTrailMats.length, 1,
  `makeJavelin 内应恰好保留 1 个逐支材质（trail），实际 ${javelinTrailMats.length}`);

// --- 4. 共享缓存必须跟随调色板开关失效 ----------------------------------
// 箭杆/箭头颜色取自 isCitadelPaletteV3()，缓存不按它分桶就会串色。
for (const fn of ["arrowShared", "javelinShared"]) {
  const start = src.indexOf(`function ${fn}(`);
  const body = src.slice(start, start + 900);
  assert.match(body, /isCitadelPaletteV3\(\)/, `${fn} 必须读调色板开关`);
  assert.match(body, /\?\.v3 === v3/, `${fn} 的缓存必须按 v3 分桶，否则切调色板后串色`);
}

console.log("✅ test_projectile_shared_assets（共享 3+3 材质与 5+4 几何；拖尾保持逐支独立）");
