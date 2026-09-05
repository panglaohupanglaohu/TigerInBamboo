// =====================================================================
// C11 · stencil 挖窗原型自检（Claude 侧规格的机器判据；G-19 派单前必须绿）
//
// 能机器判定的只有三类，全在这里：
//   ① draw call 账目：每个有窗的层恰好 +2（cutter + reveal），不是每扇窗 +2
//   ② 材质状态机：墙与**描边壳**都拿到 NotEqual(ref)；玻璃与 reveal 拿到 Equal(ref)；
//      cutter 是 Always→Replace 且 colorWrite=false / depthWrite=true；
//      **共享材质一个都没被改**（只 clone）——这条最要命，改了会污染全场景
//   ③ 卸载可逆：cleanup 之后材质引用逐个回到原件，cutter/reveal 网格清空
//   ④ 窗位不跨格（G-19 门 L 的那一半）：用 `windowCellFootprint` 抽查
//
// **判不了的**：窗洞里露不露描边壳。那要看画面。本脚本绿 ≠ 效果对。
//
// 运行：node tools/probe_stencil_windows.mjs
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
globalThis.window = { innerWidth: 1280, innerHeight: 720, addEventListener(){}, removeEventListener(){}, requestAnimationFrame(){}, matchMedia: () => ({ matches:false, addEventListener(){}, removeEventListener(){} }) };
const stubEl = () => ({ style:{}, classList:{add(){},remove(){},toggle(){},contains:()=>false}, textContent:"", appendChild(){}, addEventListener(){}, querySelector:()=>stubEl(), querySelectorAll:()=>[] });
const stubCanvas = () => { const el = stubEl(); el.width=64; el.height=64; el.getContext=()=>({ canvas:el, fillRect(){}, clearRect(){}, measureText:()=>({width:6}), createLinearGradient:()=>({addColorStop(){}}), fillText(){}, drawImage(){}, getImageData:()=>({data:new Uint8ClampedArray(4)}) }); el.toDataURL=()=>""; return el; };
globalThis.document = { createElement:(t)=>String(t).toLowerCase()==="canvas"?stubCanvas():stubEl(), createElementNS:(_n,t)=>String(t).toLowerCase()==="canvas"?stubCanvas():stubEl(), getElementById:()=>stubEl(), querySelector:()=>stubEl(), querySelectorAll:()=>[], body:{appendChild(){}}, addEventListener(){} };
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const m = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const sw = await import(new URL("src/render/stencilWindows.js", BASE).href);

const castle = m.buildOdysseyCitadel({ latestDesign: true, place: false, seed: 20260808 });

// ---------- ① 计划与 draw call 账目 ----------
const plan = sw.stencilWindowPlan(castle);
const withWindows = plan.levels.filter((l) => l.windows > 0);
console.log(
  `层=${plan.levels.length}（有窗 ${withWindows.length}） 窗=${plan.totals.windows} 墙面=${plan.totals.surfaces} ` +
  `描边壳=${plan.totals.outlines} draw call 增量=${plan.totals.drawCallDelta}（${plan.totals.drawCallPerLevel}/层）`
);
assert.ok(plan.totals.windows > 0, "没找到任何 town-window，pass 无从谈起");
assert.equal(plan.totals.drawCallPerLevel, 2, "门 L：draw call 增量必须是 +2/层");
assert.equal(plan.totals.drawCallDelta, withWindows.length * 2, "总增量必须 = 有窗层数 × 2");
assert.equal(plan.sharedMaterialsMutated, 0, "计划阶段不得改任何材质");

// ---------- 记录改动前的材质引用 ----------
const before = new Map();
castle.traverse((o) => { if (o.isMesh) before.set(o, o.material); });
const sharedSnapshot = new Map();
for (const [, mat] of before) {
  if (!mat || Array.isArray(mat)) continue;
  if (!sharedSnapshot.has(mat)) {
    sharedSnapshot.set(mat, {
      stencilWrite: mat.stencilWrite, stencilFunc: mat.stencilFunc,
      stencilRef: mat.stencilRef, colorWrite: mat.colorWrite, depthWrite: mat.depthWrite,
    });
  }
}

// ---------- ② 施加并检查材质状态机 ----------
const report = sw.applyStencilWindows(castle, THREE, { enabled: true });
console.log(`applied=${report.applied} cutters=${report.cutters} reveals=${report.reveals}`);
assert.equal(report.cutters, withWindows.length, "每个有窗的层恰好一个 cutter");
assert.equal(report.reveals, withWindows.length, "每个有窗的层恰好一个 reveal");

// 共享材质一个都不能变
let mutated = 0;
for (const [mat, snap] of sharedSnapshot) {
  if (mat.stencilWrite !== snap.stencilWrite || mat.stencilFunc !== snap.stencilFunc
    || mat.stencilRef !== snap.stencilRef || mat.colorWrite !== snap.colorWrite
    || mat.depthWrite !== snap.depthWrite) mutated++;
}
assert.equal(mutated, 0, `${mutated} 个共享材质被就地改了 —— 会污染全场景（城门/废墟/岛屿都在用同一批）`);
console.log(`✓ 共享材质零污染（检查了 ${sharedSnapshot.size} 个原件）`);

let cut = 0;
let outside = 0;
let inside = 0;
let outlineChecked = 0;
castle.traverse((o) => {
  if (!o.isMesh) return;
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!mat) return;
  if (o.name === "town-window-stencil-cutter") {
    cut++;
    assert.equal(mat.stencilWrite, true);
    assert.equal(mat.stencilFunc, THREE.AlwaysStencilFunc, "cutter 必须 Always");
    assert.equal(mat.stencilZPass, THREE.ReplaceStencilOp, "cutter 必须 Replace");
    assert.equal(mat.colorWrite, false, "cutter 不能写颜色");
    assert.equal(mat.depthWrite, true, "cutter 必须写深度（否则 stencil 会打穿远处的墙）");
    assert.ok(o.renderOrder < 0, "cutter 必须最先画");
    return;
  }
  if (o.name === "town-window-stencil-reveal" || o.userData?.citadelWindow) {
    inside++;
    assert.equal(mat.stencilFunc, THREE.EqualStencilFunc, `${o.name}: 洞内内容必须 Equal(ref)`);
    return;
  }
  if (mat.stencilWrite && mat.stencilFunc === THREE.NotEqualStencilFunc) {
    outside++;
    if (o.userData?.isOutline) outlineChecked++;
  }
});
console.log(`✓ 状态机：cutter=${cut} 洞内=${inside} NotEqual 的墙/壳=${outside}（其中描边壳 ${outlineChecked}）`);
assert.ok(outlineChecked > 0, "描边壳一个都没被套上 stencil —— 窗洞里必然露黑（PLAN §阶段6 点名的冲突）");

// ---------- ③ 卸载可逆 ----------
castle.userData.stencilWindowCleanup();
let leftover = 0;
let restored = 0;
castle.traverse((o) => {
  if (o.name === "town-window-stencil-cutter" || o.name === "town-window-stencil-reveal") leftover++;
  if (o.isMesh && before.has(o) && o.material === before.get(o)) restored++;
});
assert.equal(leftover, 0, "cleanup 之后 cutter/reveal 必须清空");
assert.equal(restored, before.size, `材质未完全还原：${restored}/${before.size}`);
console.log(`✓ 卸载可逆：网格清空，${restored} 个材质引用逐个还原`);

// ---------- ④ 窗位不跨格角（门 L 的那一半；判据已修正，见模块注释） ----------
const CS = castle.userData.townSpec?.cellSize ?? 2.0;   // 别写死：高山用的是 2.0 不是 1.6
const GRID = castle.userData.townSpec?.gridSize ?? 25;
let bad = 0;
let worst = -Infinity;
const badSamples = [];
for (const w of plan.windows) {
  const r = sw.windowSpansCellCorner(
    { cell: w.cell, center: [w.position[0], w.position[2]], dir: w.dir, halfWidth: 0.19 },
    { cellSize: CS, gridSize: GRID }
  );
  worst = Math.max(worst, r.overhang);
  if (!r.ok) { bad++; if (badSamples.length < 5) badSamples.push(`cell=${JSON.stringify(w.cell)} dir=${JSON.stringify(w.dir)} pos=${w.position.map(n=>n.toFixed(2))} 越界 ${r.overhang}`); }
}
console.log(`✓ 窗位不跨格角：${plan.windows.length} 扇，越界 ${bad} 扇，最大越界 ${worst.toFixed(4)}（格宽 ${CS}）`);
if (badSamples.length) console.log("  " + badSamples.join(" | "));
assert.equal(bad, 0, "有窗跨过格角（沿墙方向超出所属格的边长）");

// 顺带记录一下「AABB 跨格」的数字，说明为什么它不能当门
let aabbSpanning = 0;
for (const w of plan.windows) {
  const [x, , z] = w.position;
  const corners = [[x - 0.19, z - 0.19], [x + 0.19, z - 0.19], [x + 0.19, z + 0.19], [x - 0.19, z + 0.19]];
  if (sw.windowCellFootprint(corners, { cellSize: CS, gridSize: GRID }).spans) aabbSpanning++;
}
console.log(
  `  参考：按「AABB 四角同格」这个旧判据会有 ${aabbSpanning}/${plan.windows.length} 扇"跨格"——` +
  `因为窗就贴在墙面上，而墙面正是两格的分界面。**那个判据不能当门 L 用。**`
);

console.log("✅ probe_stencil_windows（G-19 可派单）");
console.log(
  "  ⚠️ 本脚本判不了「窗洞里露不露描边壳」——那要看画面。" +
  "P.stencilWindowsV1 默认 false，上生产前必须有截图对照。"
);
